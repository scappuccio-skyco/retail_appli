"""
Morning Brief Routes
API endpoints for generating morning briefs for managers
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, Dict
from datetime import datetime, timedelta

from api.dependencies import get_db, get_current_user
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
    
    # Générer le brief via le service IA
    result = await ai_service.generate_morning_brief(
        stats=stats,
        manager_name=manager_name,
        store_name=store_name,
        context=request.comments
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
    
    # Récupérer le magasin
    store = await db.stores.find_one(
        {"$or": [{"manager_id": user_id}, {"gerant_id": user_id}]},
        {"_id": 0}
    )
    
    store_id = store.get("id") if store else None
    stats = await _fetch_yesterday_stats(db, store_id, user_id)
    
    return {
        "store_name": store.get("name") if store else None,
        "manager_name": current_user.get("name"),
        "stats": stats,
        "date": datetime.now().strftime("%A %d %B %Y")
    }


async def _fetch_yesterday_stats(db, store_id: Optional[str], manager_id: str) -> Dict:
    """
    Récupère les statistiques d'hier pour le brief matinal.
    """
    yesterday = datetime.now() - timedelta(days=1)
    yesterday_str = yesterday.strftime("%Y-%m-%d")
    
    # Début et fin de la semaine en cours
    today = datetime.now()
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
        "team_present": "Non renseigné"
    }
    
    if not store_id:
        return stats
    
    try:
        # Récupérer les KPIs d'hier pour le magasin
        kpis_yesterday = await db.kpis.find({
            "store_id": store_id,
            "date": yesterday_str
        }, {"_id": 0}).to_list(100)
        
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
        
        # CA de la semaine
        week_start_str = start_of_week.strftime("%Y-%m-%d")
        kpis_week = await db.kpis.find({
            "store_id": store_id,
            "date": {"$gte": week_start_str, "$lte": yesterday_str}
        }, {"_id": 0, "ca": 1}).to_list(500)
        
        if kpis_week:
            stats["ca_week"] = sum(k.get("ca", 0) or 0 for k in kpis_week)
        
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
