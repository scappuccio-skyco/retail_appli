"""
Morning Brief Routes
API endpoints for generating morning briefs for managers
"""
from fastapi import APIRouter, Depends, HTTPException, Query, Body, Request
from pydantic import BaseModel, Field
from typing import Optional, Dict, List
from datetime import datetime, timedelta, timezone
from uuid import uuid4
import logging

from api.dependencies import get_db, get_ai_service
from api.dependencies_rate_limiting import get_rate_limiter
from core.security import get_current_user, require_active_space, verify_store_ownership
from services.ai_service import AIService
from repositories.store_repository import StoreRepository
from repositories.kpi_repository import KPIRepository
from repositories.user_repository import UserRepository
from models.pagination import PaginatedResponse, PaginationParams
from utils.pagination import paginate

# Rate limiter instance (will be set from app.state in main.py)
limiter = get_rate_limiter()

router = APIRouter(
    prefix="/briefs",
    tags=["Morning Briefs"],
    dependencies=[Depends(require_active_space)]
)
logger = logging.getLogger(__name__)


class MorningBriefRequest(BaseModel):
    """Request model for generating a morning brief"""
    comments: Optional[str] = Field(
        None, 
        description="Consigne spécifique du manager pour le brief",
        max_length=500
    )
    objective_daily: Optional[float] = Field(
        None,
        description="Objectif CA du jour en euros (sera sauvegardé dans stores.objective_daily)",
        ge=0
    )
    # Stats can be provided or will be fetched automatically
    stats: Optional[Dict] = Field(None, description="Statistiques optionnelles (sinon auto-fetch)")


class StructuredBriefContent(BaseModel):
    """
    Structure détaillée du contenu du brief matinal.
    Utilisé pour afficher le brief de manière formatée dans le frontend.
    """
    flashback: str = Field(
        ..., 
        description="Bilan des performances du dernier jour travaillé (CA, ventes, points forts/vigilance)"
    )
    focus: str = Field(
        ..., 
        description="Mission/objectif principal du jour pour l'équipe"
    )
    examples: List[str] = Field(
        default_factory=list,
        description="Liste de méthodes ou actions concrètes pour atteindre l'objectif"
    )
    team_question: str = Field(
        ..., 
        description="Question à poser à l'équipe pour engager la discussion"
    )
    booster: str = Field(
        ..., 
        description="Citation motivante ou phrase boost pour clôturer le brief"
    )


class MorningBriefResponse(BaseModel):
    """
    Response model for morning brief.
    
    Le brief peut être retourné sous deux formes:
    - Format legacy: champ 'brief' contient du Markdown brut
    - Format structuré: champ 'structured' contient un objet StructuredBriefContent
    
    Le frontend doit gérer les deux cas pour la rétro-compatibilité.
    """
    success: bool
    brief: str = Field(..., description="Brief au format Markdown (rétro-compatibilité)")
    structured: Optional[StructuredBriefContent] = Field(
        None, 
        description="Brief structuré avec champs séparés (nouveau format)"
    )
    brief_id: Optional[str] = None  # ID pour l'historique
    date: str
    data_date: Optional[str] = None  # Date du dernier jour avec données
    store_name: str
    manager_name: str
    has_context: bool
    generated_at: str
    fallback: Optional[bool] = False


class BriefHistoryItem(BaseModel):
    """Model for brief history items"""
    brief_id: str
    brief: str
    date: str
    data_date: Optional[str] = None
    store_name: str
    manager_name: str
    has_context: bool
    context: Optional[str] = None
    generated_at: str


@router.post("/morning", response_model=MorningBriefResponse)
@limiter.limit("10/minute")  # ⚠️ SECURITY: Rate limit 10 req/min to prevent cost abuse
async def generate_morning_brief(
    request: Request,  # ⚠️ Required for rate limiting (slowapi expects 'request')
    store_id: Optional[str] = Query(None, description="Store ID (pour gérant visualisant un magasin)"),
    brief_request: MorningBriefRequest = Body(...),  # Renamed from 'request' to avoid conflict
    current_user: dict = Depends(get_current_user),
    ai_service: AIService = Depends(get_ai_service),  # ✅ ÉTAPE A: Injection de dépendance
    db = Depends(get_db)
):
    """
    Génère le brief matinal pour le manager.
    
    - **comments**: Consigne spécifique du manager (optionnel)
    - **store_id**: ID du magasin (optionnel, pour gérant visualisant un magasin spécifique)
    - Récupère automatiquement les stats du magasin d'hier
    - Retourne un brief formaté en Markdown
    """
    try:
        # Vérifier que l'utilisateur est manager
        if current_user.get("role") not in ["manager", "gerant", "super_admin"]:
            raise HTTPException(
                status_code=403, 
                detail="Seuls les managers peuvent générer des briefs matinaux"
            )
    
    user_id = current_user.get("id")
    user_store_id = current_user.get("store_id")
    manager_name = current_user.get("name", "Manager")
    
    # Si store_id passé en paramètre (gérant visualisant un magasin), l'utiliser en priorité
    effective_store_id = store_id if store_id else user_store_id
    
    # Récupérer le magasin
    store = None
    
    # ✅ MIGRÉ: Utilisation du repository avec vérification de sécurité
    store_repo = StoreRepository(db)
    
    # 1. D'abord par effective_store_id (store_id passé en param ou store_id de l'utilisateur)
    if effective_store_id:
        store = await store_repo.find_by_id(effective_store_id)
        
        # ✅ SÉCURITÉ: Vérifier que l'utilisateur a accès à ce store
        if store:
            if current_user.get("role") == "manager":
                if store.get("manager_id") != user_id and store.get("id") != user_store_id:
                    raise HTTPException(status_code=403, detail="Accès refusé à ce magasin")
            elif current_user.get("role") == "gerant":
                if store.get("gerant_id") != user_id:
                    raise HTTPException(status_code=403, detail="Accès refusé à ce magasin")
    
    # 2. Si pas trouvé, chercher par manager_id ou gerant_id (premier store trouvé)
    if not store:
        # Chercher dans les stores du gérant ou manager
        if current_user.get("role") == "gerant":
            stores = await store_repo.find_by_gerant(user_id)
            store = stores[0] if stores else None
        elif current_user.get("role") == "manager":
            if user_store_id:
                store = await store_repo.find_by_id(user_store_id)
    
    store_name = store.get("name", "Mon Magasin") if store else "Mon Magasin"
    final_store_id = store.get("id") if store else effective_store_id
    
    # ⭐ Sauvegarder l'objectif CA du jour dans le document du magasin
    if brief_request.objective_daily is not None and final_store_id:
        try:
            # ✅ MIGRÉ: Utilisation du repository
            await store_repo.update_one(
                {"id": final_store_id},
                {"$set": {"objective_daily": brief_request.objective_daily, "updated_at": datetime.now(timezone.utc).isoformat()}}
            )
            logger.info(f"Objectif CA du jour mis à jour pour le magasin {final_store_id}: {request.objective_daily}€")
        except Exception as e:
            logger.error(f"Erreur lors de la sauvegarde de l'objectif CA: {e}")
            # Ne pas bloquer la génération du brief si la sauvegarde échoue
    
    # Récupérer les statistiques du dernier jour avec données
    if brief_request.stats:
        stats = brief_request.stats
    else:
        stats = await _fetch_yesterday_stats(db, final_store_id, user_id)
    
    # Extraire la date des données (dernier jour actif)
    data_date = stats.get("data_date")
    
    # Générer le brief via le service IA (ai_service injecté via Depends)
    try:
        result = await ai_service.generate_morning_brief(
            stats=stats,
            manager_name=manager_name,
            store_name=store_name,
            context=brief_request.comments,
            data_date=data_date,  # Passer la date du dernier jour avec des données
            objective_daily=brief_request.objective_daily  # ⭐ Passer l'objectif CA du jour
        )
        
        # Sauvegarder le brief dans l'historique
        if result.get("success"):
            brief_id = str(uuid4())
            # Record minimum avec manager_id (requis pour history)
            brief_record = {
                "brief_id": brief_id,
                "store_id": final_store_id,
                "manager_id": user_id,  # REQUIS pour history
                "manager_name": manager_name,
                "store_name": store_name,
                "brief": result.get("brief"),
                "date": result.get("date"),
                "data_date": result.get("data_date"),
                "has_context": result.get("has_context", False),
                "context": brief_request.comments,
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "fallback": result.get("fallback", False)
            }
            
            # ✅ MIGRÉ: Utilisation du repository avec sécurité
            try:
                brief_repo = MorningBriefRepository(db)
                await brief_repo.create_brief(
                    brief_data=brief_record,
                    store_id=final_store_id,
                    manager_id=user_id
                )
                result["brief_id"] = brief_id
            except Exception as e:
                logger.error(f"Error saving brief to history: {e}")
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(
            "Morning brief generation failed",
            extra={
                "store_id": final_store_id,
                "user_id": user_id,
                "manager_name": manager_name,
                "store_name": store_name
            }
        )
        raise HTTPException(
            status_code=500,
            detail=f"Erreur lors de la génération du brief matinal: {str(e)}"
        )


@router.get("/morning/preview")
async def preview_morning_brief_data(
    store_id: Optional[str] = Query(None, description="Store ID (pour gérant visualisant un magasin)"),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """
    Prévisualise les données qui seront utilisées pour le brief.
    Utile pour debug ou pour afficher un aperçu avant génération.
    
    - **store_id**: ID du magasin (optionnel, pour gérant visualisant un magasin spécifique)
    """
    if current_user.get("role") not in ["manager", "gerant", "super_admin"]:
        raise HTTPException(status_code=403, detail="Accès refusé")
    
    user_id = current_user.get("id")
    user_store_id = current_user.get("store_id")
    
    # Si store_id passé en paramètre (gérant visualisant un magasin), l'utiliser en priorité
    effective_store_id = store_id if store_id else user_store_id
    
    # Récupérer le magasin
    store = None
    
    # ✅ MIGRÉ: Utilisation du repository avec vérification de sécurité
    store_repo = StoreRepository(db)
    
    # 1. D'abord par effective_store_id
    if effective_store_id:
        store = await store_repo.find_by_id(effective_store_id)
        
        # ✅ SÉCURITÉ: Vérifier que l'utilisateur a accès à ce store
        if store:
            if current_user.get("role") == "manager":
                if store.get("manager_id") != user_id and store.get("id") != user_store_id:
                    raise HTTPException(status_code=403, detail="Accès refusé à ce magasin")
            elif current_user.get("role") == "gerant":
                if store.get("gerant_id") != user_id:
                    raise HTTPException(status_code=403, detail="Accès refusé à ce magasin")
    
    # 2. Si pas trouvé, chercher par manager_id ou gerant_id
    if not store:
        if current_user.get("role") == "gerant":
            stores = await store_repo.find_by_gerant(user_id)
            store = stores[0] if stores else None
        elif current_user.get("role") == "manager":
            if user_store_id:
                store = await store_repo.find_by_id(user_store_id)
    
    final_store_id = store.get("id") if store else effective_store_id
    stats = await _fetch_yesterday_stats(db, final_store_id, user_id)
    
    return {
        "store_name": store.get("name") if store else None,
        "manager_name": current_user.get("name"),
        "stats": stats,
        "date": datetime.now().strftime("%A %d %B %Y")
    }


async def _fetch_yesterday_stats(db, store_id: Optional[str], manager_id: str) -> Dict:
    """
    Récupère les statistiques du dernier jour avec des données de vente pour le brief matinal.
    Cherche dans les 7 derniers jours pour trouver le dernier jour travaillé.
    """
    today = datetime.now()
    
    # Début et fin de la semaine en cours
    start_of_week = today - timedelta(days=today.weekday())
    
    stats = {
        "ca_yesterday": 0,
        "objectif_yesterday": 0,
        "ventes_yesterday": 0,
        "panier_moyen_yesterday": 0,
        "taux_transfo_yesterday": 0,
        "indice_vente_yesterday": 0,
        "top_seller_yesterday": None,
        "ca_week": 0,
        "objectif_week": 0,
        "team_present": "Non renseigné",
        "data_date": None  # Date du dernier jour avec données
    }
    
    if not store_id:
        return stats
    
    try:
        # Chercher le dernier jour avec des données de vente (dans les 30 derniers jours)
        last_data_date = None
        for days_back in range(1, 31):  # De hier jusqu'à 30 jours en arrière
            check_date = today - timedelta(days=days_back)
            check_date_str = check_date.strftime("%Y-%m-%d")
            
            # ✅ MIGRÉ: Utilisation du repository
            kpi_repo = KPIRepository(db)
            
            # Vérifier si des KPIs existent pour ce jour avec du CA > 0
            # Note: collection 'kpis' n'a pas de repository, on garde l'accès direct pour l'instant
            kpi_check = await db.kpis.find_one({
                "store_id": store_id,
                "date": check_date_str,
                "ca": {"$gt": 0}
            }, {"_id": 0, "date": 1})
            
            # Si pas dans kpis, vérifier kpi_entries (vendeurs)
            if not kpi_check:
                kpi_check = await kpi_repo.find_one({
                    "store_id": store_id,
                    "date": check_date_str,
                    "ca_journalier": {"$gt": 0}
                }, {"_id": 0, "date": 1})
            
            if kpi_check:
                last_data_date = check_date_str
                break
        
        # Si aucune donnée trouvée, utiliser hier par défaut
        if not last_data_date:
            last_data_date = (today - timedelta(days=1)).strftime("%Y-%m-%d")
        
        stats["data_date"] = last_data_date
        
        # ✅ MIGRÉ: Utilisation du repository avec pagination
        kpi_repo = KPIRepository(db)
        
        # Récupérer les KPIs du dernier jour avec données
        # D'abord essayer la collection kpis (données magasin) - pas de repository pour kpis
        kpis_yesterday_result = await paginate(
            collection=db.kpis,
            query={"store_id": store_id, "date": last_data_date},
            page=1,
            size=50,  # Limite par défaut
            projection={"_id": 0},
            sort=None
        )
        kpis_yesterday = kpis_yesterday_result.items
        
        # Si pas de données dans kpis, chercher dans kpi_entries (données vendeurs)
        if not kpis_yesterday:
            kpi_entries_result = await paginate(
                collection=kpi_repo.collection,
                query={"store_id": store_id, "date": last_data_date},
                page=1,
                size=50,  # Limite par défaut
                projection={"_id": 0},
                sort=None
            )
            kpi_entries = kpi_entries_result.items
            
            if kpi_entries:
                # Adapter les champs de kpi_entries vers le format attendu
                total_ca = sum(k.get("ca_journalier", 0) or 0 for k in kpi_entries)
                total_ventes = sum(k.get("nb_ventes", 0) or 0 for k in kpi_entries)
                total_articles = sum(k.get("nb_articles", k.get("nb_ventes", 0)) or 0 for k in kpi_entries)
                total_visiteurs = sum(k.get("nb_visiteurs", k.get("nb_prospects", 0)) or 0 for k in kpi_entries)
                
                stats["ca_yesterday"] = total_ca
                stats["ventes_yesterday"] = total_ventes
                
                if total_ventes > 0:
                    stats["panier_moyen_yesterday"] = total_ca / total_ventes
                    stats["indice_vente_yesterday"] = total_articles / total_ventes
                
                if total_visiteurs > 0:
                    stats["taux_transfo_yesterday"] = (total_ventes / total_visiteurs) * 100
                
                # Top vendeur depuis kpi_entries
                if kpi_entries:
                    sorted_sellers = sorted(kpi_entries, key=lambda x: x.get("ca_journalier", 0) or 0, reverse=True)
                    if sorted_sellers:
                        top_kpi = sorted_sellers[0]
                        # ✅ MIGRÉ: Utilisation du repository
                        user_repo = UserRepository(db)
                        top_seller = await user_repo.find_one(
                            {"id": top_kpi.get("seller_id")},
                            {"_id": 0, "name": 1}
                        )
                        if top_seller:
                            stats["top_seller_yesterday"] = f"{top_seller.get('name')} ({top_kpi.get('ca_journalier', 0):,.0f}€)"
        
        if kpis_yesterday:
            total_ca = sum(k.get("ca", 0) or 0 for k in kpis_yesterday)
            total_ventes = sum(k.get("nb_ventes", 0) or 0 for k in kpis_yesterday)
            total_articles = sum(k.get("nb_articles", 0) or 0 for k in kpis_yesterday)
            total_visiteurs = sum(k.get("nb_visiteurs", 0) or 0 for k in kpis_yesterday)
            
            stats["ca_yesterday"] = total_ca
            stats["ventes_yesterday"] = total_ventes
            
            if total_ventes > 0:
                stats["panier_moyen_yesterday"] = total_ca / total_ventes
                stats["indice_vente_yesterday"] = total_articles / total_ventes
            
            if total_visiteurs > 0:
                stats["taux_transfo_yesterday"] = (total_ventes / total_visiteurs) * 100
            
            # Top vendeur
            if kpis_yesterday:
                sorted_sellers = sorted(kpis_yesterday, key=lambda x: x.get("ca", 0) or 0, reverse=True)
                if sorted_sellers:
                    top_kpi = sorted_sellers[0]
                    # ✅ MIGRÉ: Utilisation du repository
                    user_repo = UserRepository(db)
                    top_seller = await user_repo.find_one(
                        {"id": top_kpi.get("seller_id")},
                        {"_id": 0, "name": 1}
                    )
                    if top_seller:
                        stats["top_seller_yesterday"] = f"{top_seller.get('name')} ({top_kpi.get('ca', 0):,.0f}€)"
        
        # ✅ MIGRÉ: Utilisation du repository
        store_obj = await store_repo.find_by_id(
            store_id,
            {"_id": 0, "objective_daily": 1, "objective_weekly": 1}
        )
        
        if store_obj:
            stats["objectif_yesterday"] = store_obj.get("objective_daily", 0) or 0
            stats["objectif_week"] = store_obj.get("objective_weekly", 0) or 0
        
        # ✅ MIGRÉ: Utilisation d'agrégation MongoDB pour calculs optimisés
        week_start_str = start_of_week.strftime("%Y-%m-%d")
        
        # Utiliser agrégation pour calculer CA de la semaine (plus efficace)
        kpi_week_aggregate = [
            {"$match": {
                "store_id": store_id,
                "date": {"$gte": week_start_str, "$lte": last_data_date}
            }},
            {"$group": {
                "_id": None,
                "total_ca": {"$sum": {"$ifNull": ["$ca_journalier", 0]}}
            }}
        ]
        
        kpi_week_result = await kpi_repo.aggregate(kpi_week_aggregate, max_results=1)
        if kpi_week_result:
            stats["ca_week"] = kpi_week_result[0].get("total_ca", 0) or 0
        else:
            # Fallback: chercher dans kpis (collection legacy)
            kpis_week_result = await paginate(
                collection=db.kpis,
                query={
                    "store_id": store_id,
                    "date": {"$gte": week_start_str, "$lte": last_data_date}
                },
                page=1,
                size=50,  # Limite par défaut
                projection={"_id": 0, "ca": 1},
                sort=None
            )
            if kpis_week_result.items:
                stats["ca_week"] = sum(k.get("ca", 0) or 0 for k in kpis_week_result.items)
        
        # ✅ MIGRÉ: Utilisation du repository pour équipe
        user_repo = UserRepository(db)
        sellers_result = await paginate(
            collection=user_repo.collection,
            query={
                "store_id": store_id,
                "role": "seller",
                "status": "active"
            },
            page=1,
            size=50,  # Limite par défaut
            projection={"_id": 0, "name": 1},
            sort=None
        )
        sellers = sellers_result.items
        
        if sellers:
            names = [s.get("name", "").split()[0] for s in sellers[:5]]  # Prénoms des 5 premiers
            stats["team_present"] = ", ".join(names)
            if len(sellers) > 5:
                stats["team_present"] += f" et {len(sellers) - 5} autres"
        
    except Exception as e:
        logger.error(f"Erreur récupération stats brief: {e}")
    
    return stats


# ===== HISTORIQUE DES BRIEFS =====

@router.get("/morning/history")
async def get_morning_briefs_history(
    store_id: Optional[str] = Query(None, description="Store ID (pour gérant visualisant un magasin)"),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """
    Récupère l'historique des briefs matinaux pour le magasin.
    Limité aux 30 derniers briefs.
    """
    if current_user.get("role") not in ["manager", "gerant", "super_admin"]:
        raise HTTPException(status_code=403, detail="Accès refusé")
    
    user_id = current_user.get("id")
    user_store_id = current_user.get("store_id")
    
    # Déterminer le store_id effectif
    effective_store_id = store_id if store_id else user_store_id
    
    # ✅ MIGRÉ: Utilisation du repository avec vérification de sécurité
    store_repo = StoreRepository(db)
    
    # Si pas de store_id direct, chercher par manager/gerant
    if not effective_store_id:
        if current_user.get("role") == "gerant":
            stores = await store_repo.find_by_gerant(user_id)
            store = stores[0] if stores else None
        elif current_user.get("role") == "manager":
            if user_store_id:
                store = await store_repo.find_by_id(user_store_id)
            else:
                store = None
        else:
            store = None
        effective_store_id = store.get("id") if store else None
    
    if not effective_store_id:
        return {"briefs": [], "total": 0}
    
    # ✅ SÉCURITÉ: Vérifier que l'utilisateur a accès à ce store
    if current_user.get("role") == "manager":
        if store.get("manager_id") != user_id and store.get("id") != user_store_id:
            raise HTTPException(status_code=403, detail="Accès refusé à ce magasin")
    elif current_user.get("role") == "gerant":
        if store.get("gerant_id") != user_id:
            raise HTTPException(status_code=403, detail="Accès refusé à ce magasin")
    
    try:
        # ✅ MIGRÉ: Utilisation du repository avec pagination
        brief_repo = MorningBriefRepository(db)
        briefs_result = await paginate(
            collection=brief_repo.collection,
            query={"store_id": effective_store_id},
            page=1,
            size=30,  # Limite par défaut
            projection={"_id": 0},
            sort=[("generated_at", -1)]
        )
        
        return {
            "briefs": briefs_result.items,
            "total": briefs_result.total,
            "pagination": {
                "page": briefs_result.page,
                "size": briefs_result.size,
                "pages": briefs_result.pages
            }
        }
        
    except Exception as e:
        logger.error(f"Error loading briefs history: {e}")
        return {"briefs": [], "total": 0}


@router.delete("/morning/{brief_id}")
async def delete_morning_brief(
    brief_id: str,
    store_id: Optional[str] = Query(None, description="Store ID (pour gérant)"),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """
    Supprime un brief de l'historique.
    """
    if current_user.get("role") not in ["manager", "gerant", "super_admin"]:
        raise HTTPException(status_code=403, detail="Accès refusé")
    
    user_id = current_user.get("id")
    user_store_id = current_user.get("store_id")
    
    # Déterminer le store_id effectif
    effective_store_id = store_id if store_id else user_store_id
    
    # ✅ MIGRÉ: Utilisation du repository avec vérification de sécurité
    store_repo = StoreRepository(db)
    
    if not effective_store_id:
        if current_user.get("role") == "gerant":
            stores = await store_repo.find_by_gerant(user_id)
            store = stores[0] if stores else None
        elif current_user.get("role") == "manager":
            if user_store_id:
                store = await store_repo.find_by_id(user_store_id)
            else:
                store = None
        else:
            store = None
        effective_store_id = store.get("id") if store else None
    
    if not effective_store_id:
        raise HTTPException(status_code=400, detail="Impossible de déterminer le magasin")
    
    # ✅ SÉCURITÉ: Vérifier que l'utilisateur a accès à ce store
    if store:
        if current_user.get("role") == "manager":
            if store.get("manager_id") != user_id and store.get("id") != user_store_id:
                raise HTTPException(status_code=403, detail="Accès refusé à ce magasin")
        elif current_user.get("role") == "gerant":
            if store.get("gerant_id") != user_id:
                raise HTTPException(status_code=403, detail="Accès refusé à ce magasin")
    
    try:
        # ✅ MIGRÉ: Utilisation du repository avec sécurité
        brief_repo = MorningBriefRepository(db)
        result = await brief_repo.delete_brief(
            brief_id=brief_id,
            store_id=effective_store_id
        )
        
        if not result:
            raise HTTPException(status_code=404, detail="Brief non trouvé")
        
        return {"success": True, "message": "Brief supprimé"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting brief: {e}")
        raise HTTPException(status_code=500, detail=str(e))
