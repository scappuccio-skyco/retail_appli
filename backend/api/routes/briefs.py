"""
Morning Brief Routes
API endpoints for generating morning briefs for managers
"""
from fastapi import APIRouter, Depends, Query, Body, Request
from pydantic import BaseModel, Field
from typing import Optional, Dict, List, Tuple
from datetime import datetime, timezone
from uuid import uuid4
import logging

from api.dependencies import get_ai_service, get_manager_service, get_store_service
from api.dependencies_rate_limiting import rate_limit
from api.schemas.common import EMPTY_BRIEFS_RESPONSE
from core.constants import (
    ERR_ACCES_REFUSE,
    QUERY_STORE_ID_POUR_GERANT,
    QUERY_STORE_ID_POUR_GERANT_VISUALISANT,
)
from core.exceptions import ForbiddenError, ValidationError, NotFoundError, BusinessLogicError
from core.security import get_current_user, require_active_space, verify_store_access_for_user
from services.ai_service import AIService
from services.manager_service import ManagerService
from services.store_service import StoreService

router = APIRouter(
    prefix="/briefs",
    tags=["Morning Briefs"],
    dependencies=[Depends(require_active_space)]
)
logger = logging.getLogger(__name__)


async def _resolve_store_for_briefs(
    store_id: Optional[str],
    current_user: dict,
    store_service: StoreService,
) -> Tuple[Optional[Dict], Optional[str]]:
    """
    Résout le magasin effectif pour les routes briefs (manager/gérant).
    Retourne (store, effective_store_id). Peut retourner (None, None) si aucun magasin.
    """
    user_id = current_user.get("id")
    user_store_id = current_user.get("store_id")
    effective_store_id = store_id if store_id else user_store_id
    store = None
    if effective_store_id:
        store = await store_service.get_store_by_id(effective_store_id)
        if store:
            verify_store_access_for_user(store, current_user)
    if not store:
        if current_user.get("role") == "gerant":
            stores = await store_service.get_stores_by_gerant(user_id)
            store = stores[0] if stores else None
        elif current_user.get("role") == "manager" and user_store_id:
            store = await store_service.get_store_by_id(user_store_id)
        effective_store_id = store.get("id") if store else effective_store_id
    if store is None and effective_store_id:
        store = await store_service.get_store_by_id(effective_store_id)
    if store:
        verify_store_access_for_user(store, current_user)
    return (store, effective_store_id)


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
    store_id: Optional[str] = Query(None, description=QUERY_STORE_ID_POUR_GERANT_VISUALISANT),
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
    if current_user.get("role") not in ["manager", "gerant", "super_admin"]:
        raise ForbiddenError("Seuls les managers peuvent générer des briefs matinaux")

    store, final_store_id = await _resolve_store_for_briefs(store_id, current_user, store_service)
    user_id = current_user.get("id")
    manager_name = current_user.get("name", "Manager")
    store_name = store.get("name", "Mon Magasin") if store else "Mon Magasin"

    if brief_request.objective_daily is not None and final_store_id:
        try:
            await store_service.update_store_objective_daily(final_store_id, brief_request.objective_daily)
            logger.info("Objectif CA du jour mis à jour pour le magasin %s: %s€", final_store_id, brief_request.objective_daily)
        except Exception as e:
            logger.error("Erreur lors de la sauvegarde de l'objectif CA: %s", e)

    if brief_request.stats and isinstance(brief_request.stats, dict):
        stats = brief_request.stats
    else:
        try:
            stats = await manager_service.get_yesterday_stats_for_brief(final_store_id, user_id)
        except Exception as e:
            logger.warning("get_yesterday_stats_for_brief failed, using empty stats: %s", e)
            stats = {"ca_yesterday": 0, "data_date": None, "team_present": "Non renseigné"}
    if not isinstance(stats, dict):
        stats = {"ca_yesterday": 0, "data_date": None, "team_present": "Non renseigné"}
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

        if result.get("success"):
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
                await manager_service.create_morning_brief(
                    brief_record, final_store_id, user_id
                )
                result["brief_id"] = brief_id
            except (ValueError, Exception) as e:
                logger.error("Error saving brief to history: %s", e)

        # Garantir les champs requis pour MorningBriefResponse (éviter 500 si le service omet generated_at)
        if isinstance(result, dict) and not result.get("generated_at"):
            result["generated_at"] = datetime.now(timezone.utc).isoformat()
        return result
    except BusinessLogicError:
        raise
    except Exception as e:
        logger.exception(
            "Morning brief generation failed",
            extra={"store_id": final_store_id, "user_id": user_id, "manager_name": manager_name, "store_name": store_name}
        )
        raise BusinessLogicError(f"Erreur lors de la génération du brief matinal: {str(e)}")


@router.get("/morning/preview")
async def preview_morning_brief_data(
    store_id: Optional[str] = Query(None, description=QUERY_STORE_ID_POUR_GERANT_VISUALISANT),
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
        raise ForbiddenError(ERR_ACCES_REFUSE)
    store, final_store_id = await _resolve_store_for_briefs(store_id, current_user, store_service)
    user_id = current_user.get("id")
    stats = await manager_service.get_yesterday_stats_for_brief(final_store_id, user_id) if final_store_id else {"ca_yesterday": 0, "data_date": None, "team_present": "Non renseigné"}
    return {
        "store_name": store.get("name") if store else None,
        "manager_name": current_user.get("name"),
        "stats": stats,
        "date": datetime.now().strftime("%A %d %B %Y")
    }


# ===== HISTORIQUE DES BRIEFS =====

@router.get("/morning/history")
async def get_morning_briefs_history(
    store_id: Optional[str] = Query(None, description=QUERY_STORE_ID_POUR_GERANT_VISUALISANT),
    current_user: dict = Depends(get_current_user),
    manager_service: ManagerService = Depends(get_manager_service),
    store_service: StoreService = Depends(get_store_service),
):
    """
    Récupère l'historique des briefs matinaux pour le magasin.
    Limité aux 30 derniers briefs.
    """
    if current_user.get("role") not in ["manager", "gerant", "super_admin"]:
        raise ForbiddenError(ERR_ACCES_REFUSE)
    store, effective_store_id = await _resolve_store_for_briefs(store_id, current_user, store_service)
    if not effective_store_id:
        return EMPTY_BRIEFS_RESPONSE
    try:
        briefs = await manager_service.get_morning_briefs_by_store(
            effective_store_id, limit=30, sort=[("generated_at", -1)]
        )
        total = await manager_service.count_morning_briefs_by_store(effective_store_id)
        return {
            "briefs": briefs,
            "total": total,
            "pagination": {"page": 1, "size": 30, "pages": (total + 29) // 30 if total else 0}
        }
    except Exception as e:
        logger.error("Error loading briefs history: %s", e)
        return EMPTY_BRIEFS_RESPONSE


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
        raise ForbiddenError(ERR_ACCES_REFUSE)
    store, effective_store_id = await _resolve_store_for_briefs(store_id, current_user, store_service)
    if not effective_store_id:
        raise ValidationError("Impossible de déterminer le magasin")
    result = await manager_service.delete_morning_brief(
        brief_id=brief_id, store_id=effective_store_id
    )
    if not result:
        raise NotFoundError("Brief non trouvé")
    return {"success": True, "message": "Brief supprimé"}
