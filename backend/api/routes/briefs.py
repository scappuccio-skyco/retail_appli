"""
Morning Brief Routes
API endpoints for generating morning briefs for managers
"""
from fastapi import APIRouter, Depends, HTTPException, Query, Body, Request
from pydantic import BaseModel, Field
from typing import Optional, Dict, List
from datetime import datetime, timezone
from uuid import uuid4
import logging

from api.dependencies import get_ai_service, get_manager_service, get_store_service
from api.dependencies_rate_limiting import rate_limit, get_rate_limiter
from core.security import get_current_user, require_active_space
from services.ai_service import AIService
from services.manager_service import ManagerService
from services.store_service import StoreService
from models.pagination import PaginatedResponse, PaginationParams

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


@router.post("/morning", response_model=MorningBriefResponse, dependencies=[rate_limit("10/minute")])
async def generate_morning_brief(
    request: Request,
    store_id: Optional[str] = Query(None, description="Store ID (pour gérant visualisant un magasin)"),
    brief_request: MorningBriefRequest = Body(...),
    current_user: dict = Depends(get_current_user),
    ai_service: AIService = Depends(get_ai_service),
    manager_service: ManagerService = Depends(get_manager_service),
    store_service: StoreService = Depends(get_store_service),
):
    """
    Génère le brief matinal pour le manager.
    
    - **comments**: Consigne spécifique du manager (optionnel)
    - **store_id**: ID du magasin (optionnel, pour gérant visualisant un magasin spécifique)
    - Récupère automatiquement les stats du magasin d'hier
    - Retourne un brief formaté en Markdown
    """
    try:
        if current_user.get("role") not in ["manager", "gerant", "super_admin"]:
            raise HTTPException(
                status_code=403,
                detail="Seuls les managers peuvent générer des briefs matinaux"
            )
    except HTTPException:
        raise

    user_id = current_user.get("id")
    user_store_id = current_user.get("store_id")
    manager_name = current_user.get("name", "Manager")
    effective_store_id = store_id if store_id else user_store_id
    store = None

    if effective_store_id:
        store = await store_service.get_store_by_id(effective_store_id)
        if store:
            if current_user.get("role") == "manager":
                if store.get("manager_id") != user_id and store.get("id") != user_store_id:
                    raise HTTPException(status_code=403, detail="Accès refusé à ce magasin")
            elif current_user.get("role") == "gerant":
                if store.get("gerant_id") != user_id:
                    raise HTTPException(status_code=403, detail="Accès refusé à ce magasin")

    if not store:
        if current_user.get("role") == "gerant":
            stores = await store_service.get_stores_by_gerant(user_id)
            store = stores[0] if stores else None
        elif current_user.get("role") == "manager" and user_store_id:
            store = await store_service.get_store_by_id(user_store_id)

    store_name = store.get("name", "Mon Magasin") if store else "Mon Magasin"
    final_store_id = store.get("id") if store else effective_store_id

    if brief_request.objective_daily is not None and final_store_id:
        try:
            await store_service.store_repo.update_one(
                {"id": final_store_id},
                {"$set": {"objective_daily": brief_request.objective_daily, "updated_at": datetime.now(timezone.utc).isoformat()}}
            )
            logger.info("Objectif CA du jour mis à jour pour le magasin %s: %s€", final_store_id, brief_request.objective_daily)
        except Exception as e:
            logger.error("Erreur lors de la sauvegarde de l'objectif CA: %s", e)

    if brief_request.stats:
        stats = brief_request.stats
    else:
        stats = await manager_service.get_yesterday_stats_for_brief(final_store_id, user_id)
    data_date = stats.get("data_date")

    try:
        result = await ai_service.generate_morning_brief(
            stats=stats,
            manager_name=manager_name,
            store_name=store_name,
            context=brief_request.comments,
            data_date=data_date,
            objective_daily=brief_request.objective_daily
        )

        if result.get("success") and manager_service.morning_brief_repo:
            brief_id = str(uuid4())
            brief_record = {
                "brief_id": brief_id,
                "store_id": final_store_id,
                "manager_id": user_id,
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
            try:
                await manager_service.morning_brief_repo.create_brief(
                    brief_data=brief_record,
                    store_id=final_store_id,
                    manager_id=user_id
                )
                result["brief_id"] = brief_id
            except Exception as e:
                logger.error("Error saving brief to history: %s", e)

        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(
            "Morning brief generation failed",
            extra={"store_id": final_store_id, "user_id": user_id, "manager_name": manager_name, "store_name": store_name}
        )
        raise HTTPException(
            status_code=500,
            detail=f"Erreur lors de la génération du brief matinal: {str(e)}"
        )


@router.get("/morning/preview")
async def preview_morning_brief_data(
    store_id: Optional[str] = Query(None, description="Store ID (pour gérant visualisant un magasin)"),
    current_user: dict = Depends(get_current_user),
    manager_service: ManagerService = Depends(get_manager_service),
    store_service: StoreService = Depends(get_store_service),
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
    effective_store_id = store_id if store_id else user_store_id
    store = None
    if effective_store_id:
        store = await store_service.get_store_by_id(effective_store_id)
        if store:
            if current_user.get("role") == "manager":
                if store.get("manager_id") != user_id and store.get("id") != user_store_id:
                    raise HTTPException(status_code=403, detail="Accès refusé à ce magasin")
            elif current_user.get("role") == "gerant":
                if store.get("gerant_id") != user_id:
                    raise HTTPException(status_code=403, detail="Accès refusé à ce magasin")
    if not store:
        if current_user.get("role") == "gerant":
            stores = await store_service.get_stores_by_gerant(user_id)
            store = stores[0] if stores else None
        elif current_user.get("role") == "manager" and user_store_id:
            store = await store_service.get_store_by_id(user_store_id)
    final_store_id = store.get("id") if store else effective_store_id
    stats = await manager_service.get_yesterday_stats_for_brief(final_store_id, user_id)
    return {
        "store_name": store.get("name") if store else None,
        "manager_name": current_user.get("name"),
        "stats": stats,
        "date": datetime.now().strftime("%A %d %B %Y")
    }


# ===== HISTORIQUE DES BRIEFS =====

@router.get("/morning/history")
async def get_morning_briefs_history(
    store_id: Optional[str] = Query(None, description="Store ID (pour gérant visualisant un magasin)"),
    current_user: dict = Depends(get_current_user),
    manager_service: ManagerService = Depends(get_manager_service),
    store_service: StoreService = Depends(get_store_service),
):
    """
    Récupère l'historique des briefs matinaux pour le magasin.
    Limité aux 30 derniers briefs.
    """
    if current_user.get("role") not in ["manager", "gerant", "super_admin"]:
        raise HTTPException(status_code=403, detail="Accès refusé")
    user_id = current_user.get("id")
    user_store_id = current_user.get("store_id")
    effective_store_id = store_id if store_id else user_store_id
    store = None
    if not effective_store_id:
        if current_user.get("role") == "gerant":
            stores = await store_service.get_stores_by_gerant(user_id)
            store = stores[0] if stores else None
        elif current_user.get("role") == "manager" and user_store_id:
            store = await store_service.get_store_by_id(user_store_id)
        effective_store_id = store.get("id") if store else None
    if not effective_store_id:
        return {"briefs": [], "total": 0}
    if store is None and effective_store_id:
        store = await store_service.get_store_by_id(effective_store_id)
    if store:
        if current_user.get("role") == "manager":
            if store.get("manager_id") != user_id and store.get("id") != user_store_id:
                raise HTTPException(status_code=403, detail="Accès refusé à ce magasin")
        elif current_user.get("role") == "gerant":
            if store.get("gerant_id") != user_id:
                raise HTTPException(status_code=403, detail="Accès refusé à ce magasin")
    try:
        if not manager_service.morning_brief_repo:
            return {"briefs": [], "total": 0}
        briefs = await manager_service.morning_brief_repo.find_by_store(
            effective_store_id, limit=30, sort=[("generated_at", -1)]
        )
        total = await manager_service.morning_brief_repo.count_by_store(effective_store_id)
        return {
            "briefs": briefs,
            "total": total,
            "pagination": {"page": 1, "size": 30, "pages": (total + 29) // 30 if total else 0}
        }
    except Exception as e:
        logger.error("Error loading briefs history: %s", e)
        return {"briefs": [], "total": 0}


@router.delete("/morning/{brief_id}")
async def delete_morning_brief(
    brief_id: str,
    store_id: Optional[str] = Query(None, description="Store ID (pour gérant)"),
    current_user: dict = Depends(get_current_user),
    manager_service: ManagerService = Depends(get_manager_service),
    store_service: StoreService = Depends(get_store_service),
):
    """
    Supprime un brief de l'historique.
    """
    if current_user.get("role") not in ["manager", "gerant", "super_admin"]:
        raise HTTPException(status_code=403, detail="Accès refusé")
    user_id = current_user.get("id")
    user_store_id = current_user.get("store_id")
    effective_store_id = store_id if store_id else user_store_id
    store = None
    if not effective_store_id:
        if current_user.get("role") == "gerant":
            stores = await store_service.get_stores_by_gerant(user_id)
            store = stores[0] if stores else None
        elif current_user.get("role") == "manager" and user_store_id:
            store = await store_service.get_store_by_id(user_store_id)
        effective_store_id = store.get("id") if store else None
    if not effective_store_id:
        raise HTTPException(status_code=400, detail="Impossible de déterminer le magasin")
    if store:
        if current_user.get("role") == "manager":
            if store.get("manager_id") != user_id and store.get("id") != user_store_id:
                raise HTTPException(status_code=403, detail="Accès refusé à ce magasin")
        elif current_user.get("role") == "gerant":
            if store.get("gerant_id") != user_id:
                raise HTTPException(status_code=403, detail="Accès refusé à ce magasin")
    try:
        if not manager_service.morning_brief_repo:
            raise HTTPException(status_code=404, detail="Brief non trouvé")
        result = await manager_service.morning_brief_repo.delete_brief(
            brief_id=brief_id, store_id=effective_store_id
        )
        if not result:
            raise HTTPException(status_code=404, detail="Brief non trouvé")
        return {"success": True, "message": "Brief supprimé"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error deleting brief: %s", e)
        raise HTTPException(status_code=500, detail=str(e))
