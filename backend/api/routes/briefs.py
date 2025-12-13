"""
Morning Brief Routes
API endpoints for generating morning briefs for managers
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, Dict
from datetime import datetime, timedelta

from api.dependencies import get_db
from core.security import get_current_user
from services.ai_service import ai_service

router = APIRouter(prefix="/briefs", tags=["Morning Briefs"])


class MorningBriefRequest(BaseModel):
    """Request model for generating a morning brief"""
    comments: Optional[str] = Field(
        None, 
        description="Consigne spécifique du manager pour le brief",
        max_length=500
    )
    # Stats can be provided or will be fetched automatically
    stats: Optional[Dict] = Field(None, description="Statistiques optionnelles (sinon auto-fetch)")


class MorningBriefResponse(BaseModel):
    """Response model for morning brief"""
    success: bool
    brief: str
    date: str
    data_date: Optional[str] = None  # Date du dernier jour avec données
    store_name: str
    manager_name: str
    has_context: bool
    generated_at: str
    fallback: Optional[bool] = False


@router.post("/morning", response_model=MorningBriefResponse)
async def generate_morning_brief(
    request: MorningBriefRequest,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """
    Génère le brief matinal pour le manager.
    
    - **comments**: Consigne spécifique du manager (optionnel)
    - Récupère automatiquement les stats du magasin d'hier
    - Retourne un brief formaté en Markdown
    """
    # Vérifier que l'utilisateur est manager
    if current_user.get("role") not in ["manager", "gerant", "super_admin"]:
        raise HTTPException(
            status_code=403, 
            detail="Seuls les managers peuvent générer des briefs matinaux"
        )
    
    user_id = current_user.get("id")
    manager_name = current_user.get("name", "Manager")
    
    # Récupérer le magasin du manager
    store = await db.stores.find_one(
        {"manager_id": user_id},
        {"_id": 0}
    )
    
    if not store:
        # Essayer avec gerant_id pour les gérants
        store = await db.stores.find_one(
            {"gerant_id": user_id},
            {"_id": 0}
        )
    
    store_name = store.get("name", "Mon Magasin") if store else "Mon Magasin"
    store_id = store.get("id") if store else None
    
    # Récupérer les statistiques d'hier si non fournies
    if request.stats:
        stats = request.stats
    else:
        stats = await _fetch_yesterday_stats(db, store_id, user_id)
    
    # Extraire la date des données (dernier jour actif)
    data_date = stats.get("data_date")
    
    # Générer le brief via le service IA
    result = await ai_service.generate_morning_brief(
        stats=stats,
        manager_name=manager_name,
        store_name=store_name,
        context=request.comments,
        data_date=data_date  # Passer la date du dernier jour avec des données
    )
    
    return result


@router.get("/morning/preview")
async def preview_morning_brief_data(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """
    Prévisualise les données qui seront utilisées pour le brief.
    Utile pour debug ou pour afficher un aperçu avant génération.
    """
    if current_user.get("role") not in ["manager", "gerant", "super_admin"]:
        raise HTTPException(status_code=403, detail="Accès refusé")
    
    user_id = current_user.get("id")
    user_store_id = current_user.get("store_id")
    
    # Récupérer le magasin - essayer plusieurs méthodes
    store = None
    
    # 1. D'abord par le store_id de l'utilisateur (cas manager)
    if user_store_id:
        store = await db.stores.find_one({"id": user_store_id}, {"_id": 0})
    
    # 2. Si pas trouvé, chercher par manager_id ou gerant_id
    if not store:
        store = await db.stores.find_one(
            {"$or": [{"manager_id": user_id}, {"gerant_id": user_id}]},
            {"_id": 0}
        )
    
    store_id = store.get("id") if store else user_store_id
    stats = await _fetch_yesterday_stats(db, store_id, user_id)
    
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
        # Chercher le dernier jour avec des données de vente (dans les 7 derniers jours)
        last_data_date = None
        for days_back in range(1, 8):  # De hier jusqu'à 7 jours en arrière
            check_date = today - timedelta(days=days_back)
            check_date_str = check_date.strftime("%Y-%m-%d")
            
            # Vérifier si des KPIs existent pour ce jour avec du CA > 0
            kpi_check = await db.kpis.find_one({
                "store_id": store_id,
                "date": check_date_str,
                "ca": {"$gt": 0}
            }, {"_id": 0, "date": 1})
            
            # Si pas dans kpis, vérifier kpi_entries (vendeurs)
            if not kpi_check:
                kpi_check = await db.kpi_entries.find_one({
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
        
        # Récupérer les KPIs du dernier jour avec données
        # D'abord essayer la collection kpis (données magasin)
        kpis_yesterday = await db.kpis.find({
            "store_id": store_id,
            "date": last_data_date
        }, {"_id": 0}).to_list(100)
        
        # Si pas de données dans kpis, chercher dans kpi_entries (données vendeurs)
        if not kpis_yesterday:
            kpi_entries = await db.kpi_entries.find({
                "store_id": store_id,
                "date": last_data_date
            }, {"_id": 0}).to_list(100)
            
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
                        top_seller = await db.users.find_one(
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
                    top_seller = await db.users.find_one(
                        {"id": top_kpi.get("seller_id")},
                        {"_id": 0, "name": 1}
                    )
                    if top_seller:
                        stats["top_seller_yesterday"] = f"{top_seller.get('name')} ({top_kpi.get('ca', 0):,.0f}€)"
        
        # Récupérer l'objectif du magasin
        store_obj = await db.stores.find_one(
            {"id": store_id},
            {"_id": 0, "objective_daily": 1, "objective_weekly": 1}
        )
        
        if store_obj:
            stats["objectif_yesterday"] = store_obj.get("objective_daily", 0) or 0
            stats["objectif_week"] = store_obj.get("objective_weekly", 0) or 0
        
        # CA de la semaine (chercher dans les 2 collections)
        week_start_str = start_of_week.strftime("%Y-%m-%d")
        kpis_week = await db.kpis.find({
            "store_id": store_id,
            "date": {"$gte": week_start_str, "$lte": last_data_date}
        }, {"_id": 0, "ca": 1}).to_list(500)
        
        if kpis_week:
            stats["ca_week"] = sum(k.get("ca", 0) or 0 for k in kpis_week)
        else:
            # Chercher dans kpi_entries si pas dans kpis
            kpi_entries_week = await db.kpi_entries.find({
                "store_id": store_id,
                "date": {"$gte": week_start_str, "$lte": last_data_date}
            }, {"_id": 0, "ca_journalier": 1}).to_list(500)
            
            if kpi_entries_week:
                stats["ca_week"] = sum(k.get("ca_journalier", 0) or 0 for k in kpi_entries_week)
        
        # Équipe du magasin
        sellers = await db.users.find({
            "store_id": store_id,
            "role": "seller",
            "status": "active"
        }, {"_id": 0, "name": 1}).to_list(50)
        
        if sellers:
            names = [s.get("name", "").split()[0] for s in sellers[:5]]  # Prénoms des 5 premiers
            stats["team_present"] = ", ".join(names)
            if len(sellers) > 5:
                stats["team_present"] += f" et {len(sellers) - 5} autres"
        
    except Exception as e:
        import logging
        logging.error(f"Erreur récupération stats brief: {e}")
    
    return stats
