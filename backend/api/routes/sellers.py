"""
Seller Routes
API endpoints for seller-specific features (tasks, objectives, challenges)
"""
from fastapi import APIRouter, Depends, Query
from api.dependencies_rate_limiting import rate_limit
from core.constants import (
    ERR_VENDEUR_NON_TROUVE,
    ERR_VENDEUR_SANS_MAGASIN,
)
from core.exceptions import NotFoundError, ValidationError, ForbiddenError
from typing import Dict, List, Optional, Union
from datetime import datetime, timezone, timedelta
import uuid

from services.seller_service import SellerService
from api.dependencies import get_seller_service, get_relationship_service, get_conflict_service
from core.security import get_current_seller, get_current_user, require_active_space
from models.pagination import PaginationParams
import logging

router = APIRouter(
    prefix="/seller",
    tags=["Seller"],
    dependencies=[Depends(require_active_space)]
)
logger = logging.getLogger(__name__)


# ===== SUBSCRIPTION ACCESS CHECK =====

@router.get("/subscription-status")
async def get_seller_subscription_status(
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service),
):
    """
    Check if the seller's gérant has an active subscription.
    Returns isReadOnly: true if trial expired.
    """
    gerant_id = current_user.get("gerant_id")
    return await seller_service.get_seller_subscription_status(gerant_id or "")


# ===== KPI ENABLED CHECK =====

@router.get("/kpi-enabled")
async def check_kpi_enabled(
    store_id: str = Query(None),
    current_user: Dict = Depends(get_current_user),
    seller_service: SellerService = Depends(get_seller_service),
):
    """
    Check if KPI input is enabled for seller
    Used to determine if sellers can input their own KPIs or if manager does it
    """
    if current_user["role"] not in ["seller", "manager", "gerant", "gérant"]:
        raise ForbiddenError("Access denied")
    SELLER_INPUT_KPIS = ["ca_journalier", "nb_ventes", "nb_clients", "nb_articles", "nb_prospects"]
    manager_id = None
    effective_store_id = store_id
    if current_user["role"] == "seller":
        manager_id = current_user.get("manager_id")
        if not manager_id:
            return {"enabled": False, "seller_input_kpis": SELLER_INPUT_KPIS}
    elif store_id and current_user["role"] in ["gerant", "gérant"]:
        effective_store_id = store_id
    elif current_user.get("store_id"):
        effective_store_id = current_user["store_id"]
    elif current_user["role"] == "manager":
        manager_id = current_user["id"]
    config = await seller_service.get_kpi_config_for_seller(effective_store_id, manager_id)
    if not config:
        return {"enabled": False, "seller_input_kpis": SELLER_INPUT_KPIS}
    return {"enabled": config.get("enabled", True), "seller_input_kpis": SELLER_INPUT_KPIS}


# ===== TASKS =====

@router.get("/tasks")
async def get_seller_tasks(
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service)
) -> List[Dict]:
    """
    Get all pending tasks for current seller
    - Diagnostic completion status
    - Pending manager requests
    """
    tasks = await seller_service.get_seller_tasks(current_user['id'])
    return tasks


# ===== OBJECTIVES =====

@router.get("/objectives/active")
async def get_active_seller_objectives(
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service)
) -> List[Dict]:
    """
    Get active team objectives for display in seller dashboard
    Returns only objectives that are:
    - Within the current period (period_end >= today)
    - Visible to this seller (individual or collective with visibility rules)
    """
    user = await seller_service.ensure_seller_has_manager_link(current_user["id"])
    seller_store_id = user.get("store_id") if user else None
    if not seller_store_id:
        return []
    manager_id = user.get("manager_id") if user else None
    objectives = await seller_service.get_seller_objectives_active(
        current_user["id"], manager_id
    )
    return objectives


@router.get("/objectives/all")
async def get_all_seller_objectives(
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service)
) -> Dict:
    """
    Get all team objectives (active and inactive) for seller
    Returns objectives separated into:
    - active: objectives with period_end > today
    - inactive: objectives with period_end <= today
    """
    user = await seller_service.get_seller_profile(current_user["id"])
    seller_store_id = user.get("store_id") if user else None
    if not seller_store_id:
        return {"active": [], "inactive": []}
    manager_id = user.get("manager_id") if user else None
    result = await seller_service.get_seller_objectives_all(
        current_user["id"], manager_id
    )
    return result


@router.get("/objectives/history")
async def get_seller_objectives_history(
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service)
) -> List[Dict]:
    """
    Get completed objectives (past period_end date) for seller
    Returns objectives that have ended (period_end < today)
    """
    user = await seller_service.get_seller_profile(current_user["id"])
    seller_store_id = user.get("store_id") if user else None
    if not seller_store_id:
        return []
    manager_id = user.get("manager_id") if user else None
    objectives = await seller_service.get_seller_objectives_history(
        current_user["id"], manager_id
    )
    return objectives


@router.post("/objectives/{objective_id}/mark-achievement-seen")
async def mark_objective_achievement_seen(
    objective_id: str,
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service),
):
    """
    Mark an objective achievement notification as seen by the seller
    After this, the objective will move to history
    """
    seller_id = current_user["id"]
    seller_store_id = current_user.get("store_id")
    if not seller_store_id:
        raise ValidationError(ERR_VENDEUR_SANS_MAGASIN)
    await seller_service.get_objective_if_accessible(objective_id, seller_store_id)
    
    await seller_service.mark_achievement_as_seen(
        seller_id,
        "objective",
        objective_id
    )
    return {"success": True, "message": "Notification marquée comme vue"}


# ===== CHALLENGES =====

@router.get("/challenges")
async def get_seller_challenges(
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service)
) -> List[Dict]:
    """
    Get all challenges (collective + individual) for seller
    Returns all challenges from seller's manager
    """
    user = await seller_service.get_seller_profile(current_user["id"])
    if not user or not user.get("manager_id"):
        return []
    challenges = await seller_service.get_seller_challenges(
        current_user["id"], user["manager_id"]
    )
    return challenges


@router.get("/challenges/active")
async def get_active_seller_challenges(
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service)
) -> List[Dict]:
    """
    Get only active challenges (collective + personal) for display in seller dashboard
    Returns challenges that are:
    - Active status
    - Not yet ended (end_date >= today)
    - Visible to this seller
    """
    user = await seller_service.ensure_seller_has_manager_link(current_user["id"])
    seller_store_id = user.get("store_id") if user else None
    if not seller_store_id:
        return []
    manager_id = user.get("manager_id") if user else None
    challenges = await seller_service.get_seller_challenges_active(
        current_user["id"], manager_id
    )
    return challenges


@router.post("/challenges/{challenge_id}/mark-achievement-seen")
async def mark_challenge_achievement_seen(
    challenge_id: str,
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service),
):
    """
    Mark a challenge achievement notification as seen by the seller
    After this, the challenge will move to history
    """
    seller_id = current_user["id"]
    seller_store_id = current_user.get("store_id")
    if not seller_store_id:
        raise ValidationError(ERR_VENDEUR_SANS_MAGASIN)
    await seller_service.get_challenge_if_accessible(challenge_id, seller_store_id)
    await seller_service.mark_achievement_as_seen(
        seller_id,
        "challenge",
        challenge_id
    )
    return {"success": True, "message": "Notification marquée comme vue"}


@router.post("/relationship-advice")
async def create_seller_relationship_advice(
    advice_data: dict,
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service),
    relationship_service = Depends(get_relationship_service),
):
    """
    Seller requests relationship advice (self-advice).
    """
    try:
        seller_id = current_user["id"]
        seller_name = current_user.get("name", "Vendeur")
        seller = await seller_service.get_seller_profile(
            seller_id, projection={"_id": 0, "store_id": 1, "manager_id": 1}
        )
        if not seller:
            raise NotFoundError("Vendeur non trouvé")
        store_id = seller.get("store_id")
        manager_id = seller.get("manager_id")
        if not manager_id:
            raise ValidationError("Vendeur sans manager associé")
        # Generate recommendation (seller self-advice)
        advice_result = await relationship_service.generate_recommendation(
            seller_id=seller_id,
            advice_type=advice_data.get('advice_type'),
            situation_type=advice_data.get('situation_type'),
            description=advice_data.get('description'),
            manager_id=manager_id,
            store_id=store_id,
            is_seller_request=True
        )
        
        # Save to history
        consultation_id = await relationship_service.save_consultation({
            "store_id": store_id,
            "manager_id": manager_id,
            "seller_id": seller_id,
            "seller_name": seller_name,
            "seller_status": current_user.get('status', 'active'),
            "advice_type": advice_data.get('advice_type'),
            "situation_type": advice_data.get('situation_type'),
            "description": advice_data.get('description'),
            "recommendation": advice_result["recommendation"]
        })
        
        return {
            "consultation_id": consultation_id,
            "recommendation": advice_result["recommendation"],
            "seller_name": seller_name
        }
        
    except ValueError as ve:
        raise ValidationError(str(ve))


@router.get("/relationship-advice/history")
async def get_seller_relationship_history(
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service),
    relationship_service = Depends(get_relationship_service),
):
    """Get seller's relationship advice history (self-advice only)."""
    seller_id = current_user["id"]
    seller = await seller_service.get_seller_profile(
        seller_id, projection={"_id": 0, "store_id": 1}
    )
    store_id = seller.get("store_id") if seller else None
    consultations = await relationship_service.list_consultations(
        seller_id=seller_id,
        store_id=store_id,
        limit=100
    )
    
    return {
        "consultations": consultations,
        "total": len(consultations)
    }


@router.post("/conflict-resolution")
async def create_seller_conflict_resolution(
    conflict_data: dict,
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service),
    conflict_service = Depends(get_conflict_service),
):
    """Seller reports a conflict and gets AI advice."""
    try:
        seller_id = current_user["id"]
        seller_name = current_user.get("name", "Vendeur")
        seller = await seller_service.get_seller_profile(
            seller_id, projection={"_id": 0, "store_id": 1, "manager_id": 1}
        )
        if not seller:
            raise NotFoundError("Vendeur non trouvé")
        store_id = seller.get("store_id")
        manager_id = seller.get("manager_id")
        if not manager_id:
            raise ValidationError("Vendeur sans manager associé")
        
        # Generate conflict advice (seller self-advice)
        advice_result = await conflict_service.generate_conflict_advice(
            seller_id=seller_id,
            contexte=conflict_data.get('contexte'),
            comportement_observe=conflict_data.get('comportement_observe'),
            impact=conflict_data.get('impact'),
            tentatives_precedentes=conflict_data.get('tentatives_precedentes'),
            description_libre=conflict_data.get('description_libre'),
            manager_id=manager_id,
            store_id=store_id,
            is_seller_request=True
        )
        
        # Save to history
        conflict_id = await conflict_service.save_conflict({
            "store_id": store_id,
            "manager_id": manager_id,
            "seller_id": seller_id,
            "seller_name": seller_name,
            "contexte": conflict_data.get('contexte'),
            "comportement_observe": conflict_data.get('comportement_observe'),
            "impact": conflict_data.get('impact'),
            "tentatives_precedentes": conflict_data.get('tentatives_precedentes'),
            "description_libre": conflict_data.get('description_libre'),
            "ai_analyse_situation": advice_result["ai_analyse_situation"],
            "ai_approche_communication": advice_result["ai_approche_communication"],
            "ai_actions_concretes": advice_result["ai_actions_concretes"],
            "ai_points_vigilance": advice_result["ai_points_vigilance"],
            "statut": "ouvert"
        })
        
        return {
            "id": conflict_id,
            "seller_name": seller_name,
            "ai_analyse_situation": advice_result["ai_analyse_situation"],
            "ai_approche_communication": advice_result["ai_approche_communication"],
            "ai_actions_concretes": advice_result["ai_actions_concretes"],
            "ai_points_vigilance": advice_result["ai_points_vigilance"]
        }
        
    except ValueError as ve:
        raise ValidationError(str(ve))


@router.get("/conflict-history")
async def get_seller_conflict_history(
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service),
    conflict_service = Depends(get_conflict_service),
):
    """Get seller's conflict resolution history."""
    seller_id = current_user["id"]
    seller = await seller_service.get_seller_profile(
        seller_id, projection={"_id": 0, "store_id": 1}
    )
    store_id = seller.get("store_id") if seller else None
    conflicts = await conflict_service.list_conflicts(
        seller_id=seller_id,
        store_id=store_id,
        limit=100
    )
    return {
        "consultations": conflicts,
        "total": len(conflicts)
    }


@router.post("/objectives/{objective_id}/progress")
async def update_seller_objective_progress(
    objective_id: str,
    progress_data: dict,
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service),
):
    """Update progress on an objective (seller route with access control)."""
    seller_id = current_user["id"]
    seller = await seller_service.get_seller_profile(
        seller_id, projection={"_id": 0, "manager_id": 1, "store_id": 1}
    )
    if not seller:
        raise NotFoundError("Vendeur non trouvé")
    seller_store_id = seller.get("store_id")
    if not seller_store_id:
        raise NotFoundError(ERR_VENDEUR_SANS_MAGASIN)
    manager_id = seller.get("manager_id")
    objective = await seller_service.get_objective_if_accessible(objective_id, seller_store_id)
    if not objective:
        raise NotFoundError("Objectif non trouvé")

    if objective.get('data_entry_responsible') != 'seller':
        raise ForbiddenError("Vous n'êtes pas autorisé à mettre à jour cet objectif. Seul le manager peut le faire.")
    if not objective.get('visible', True):
        raise ForbiddenError("Cet objectif n'est pas visible")
    obj_type = objective.get('type', 'collective')
    if obj_type == 'individual':
        if objective.get('seller_id') != seller_id:
            raise ForbiddenError("Vous n'êtes pas autorisé à mettre à jour cet objectif individuel")
    else:
        visible_to = objective.get('visible_to_sellers', [])
        if visible_to and len(visible_to) > 0 and seller_id not in visible_to:
            raise ForbiddenError("Vous n'êtes pas autorisé à mettre à jour cet objectif collectif")

    increment_value = progress_data.get("value")
    if increment_value is None:
        increment_value = progress_data.get("current_value", 0)
    try:
        increment_value = float(increment_value)
    except Exception:
        increment_value = 0.0
    mode = (progress_data.get("mode") or "add").lower()
    previous_total = float(objective.get("current_value", 0) or 0)
    new_value = increment_value if mode == "set" else previous_total + increment_value
    target_value = objective.get('target_value', 0)
    end_date = objective.get('period_end')

    progress_percentage = 0
    if target_value > 0:
        progress_percentage = round((new_value / target_value) * 100, 1)

    new_status = seller_service.compute_status(new_value, target_value, end_date)
    actor_name = current_user.get('name') or current_user.get('full_name') or current_user.get('email') or 'Vendeur'

    update_data = {
        "current_value": new_value,
        "progress_percentage": progress_percentage,
        "status": new_status,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": seller_id,
        "updated_by_name": actor_name
    }

    progress_entry = {
        "value": increment_value,
        "date": update_data["updated_at"],
        "updated_by": seller_id,
        "updated_by_name": actor_name,
        "role": "seller",
        "total_after": new_value
    }

    updated_objective = await seller_service.update_objective_progress(
        objective_id, seller_store_id, update_data, progress_entry
    )

    if updated_objective:
        if new_status == 'achieved':
            has_seen = await seller_service.check_achievement_notification(seller_id, "objective", objective_id)
            updated_objective['has_unseen_achievement'] = not has_seen
            updated_objective['just_achieved'] = True
        return updated_objective
    result = {
        "success": True,
        "current_value": new_value,
        "progress_percentage": progress_percentage,
        "status": new_status,
        "updated_at": update_data["updated_at"]
    }
    if new_status == 'achieved':
        has_seen = await seller_service.check_achievement_notification(seller_id, "objective", objective_id)
        result["has_unseen_achievement"] = not has_seen
        result["just_achieved"] = True
    return result


@router.post("/challenges/{challenge_id}/progress")
async def update_seller_challenge_progress(
    challenge_id: str,
    progress_data: dict,
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service),
):
    """
    Update progress on a challenge (seller route with access control)
    
    Payload:
    {
        "value": number,  # or "current_value" for backward compatibility
        "date": "YYYY-MM-DD" (optional),
        "comment": string (optional)
    }
    
    Access Control:
    - Seller can only update if data_entry_responsible == "seller"
    - For individual challenges: seller_id must match current_user.id
    - For collective challenges: seller must be in visible_to_sellers or visible_to_sellers is null/[]
    - Challenge must be visible (visible == true)
    """
    seller_id = current_user['id']
    
    # Get seller's manager and store_id
    seller = await seller_service.get_seller_profile(
        seller_id, projection={"_id": 0, "manager_id": 1, "store_id": 1}
    )
    if not seller:
        raise NotFoundError("Vendeur non trouvé")
    seller_store_id = seller.get("store_id")
    if not seller_store_id:
        raise NotFoundError(ERR_VENDEUR_SANS_MAGASIN)
    manager_id = seller.get("manager_id")

    challenge = await seller_service.get_challenge_if_accessible(challenge_id, seller_store_id)

    # CONTROLE D'ACCÈS: Vérifier data_entry_responsible
    if challenge.get('data_entry_responsible') != 'seller':
        raise ForbiddenError("Vous n'êtes pas autorisé à mettre à jour ce challenge. Seul le manager peut le faire.")
    
    # CONTROLE D'ACCÈS: Vérifier visible
    if not challenge.get('visible', True):
        raise ForbiddenError("Ce challenge n'est pas visible")
    
    # CONTROLE D'ACCÈS: Vérifier type et seller_id/visible_to_sellers
    chall_type = challenge.get('type', 'collective')
    if chall_type == 'individual':
        # Individual: seller_id must match
        if challenge.get('seller_id') != seller_id:
            raise ForbiddenError("Vous n'êtes pas autorisé à mettre à jour ce challenge individuel")
    else:
        # Collective: check visible_to_sellers
        visible_to = challenge.get('visible_to_sellers', [])
        if visible_to and len(visible_to) > 0 and seller_id not in visible_to:
            raise ForbiddenError("Vous n'êtes pas autorisé à mettre à jour ce challenge collectif")
    
    # Get increment value
    increment_value = progress_data.get("value")
    if increment_value is None:
        increment_value = progress_data.get("current_value", 0)
    try:
        increment_value = float(increment_value)
    except Exception:
        increment_value = 0.0
    mode = (progress_data.get("mode") or "add").lower()
    previous_total = float(challenge.get("current_value", 0) or 0)
    new_value = increment_value if mode == "set" else previous_total + increment_value
    target_value = challenge.get('target_value', 0)
    end_date = challenge.get('end_date')
    
    # Recalculate progress_percentage
    progress_percentage = 0
    if target_value > 0:
        progress_percentage = round((new_value / target_value) * 100, 1)
    
    # Recompute status using centralized helper
    new_status = seller_service.compute_status(new_value, target_value, end_date)
    
    actor_name = current_user.get('name') or current_user.get('full_name') or current_user.get('email') or 'Vendeur'

    # Update challenge
    update_data = {
        "current_value": new_value,
        "progress_percentage": progress_percentage,
        "status": new_status,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": seller_id,
        "updated_by_name": actor_name
    }
    
    # If achieved, set completed_at
    if new_status == "achieved":
        update_data["completed_at"] = datetime.now(timezone.utc).isoformat()
    
    progress_entry = {
        "value": increment_value,
        "date": update_data["updated_at"],
        "updated_by": seller_id,
        "updated_by_name": actor_name,
        "role": "seller",
        "total_after": new_value
    }

    updated_challenge = await seller_service.update_challenge_progress(
        challenge_id, seller_store_id, update_data, progress_entry
    )

    if updated_challenge:
        # Check if challenge just became "achieved" (status changed)
        old_status = challenge.get('status', 'active')
        if new_status == 'achieved' and old_status != 'achieved':
            updated_challenge['just_achieved'] = True
            
            # Add has_unseen_achievement flag for immediate frontend use
            await seller_service.add_achievement_notification_flag(
                [updated_challenge], 
                seller_id, 
                'challenge'
            )
        return updated_challenge
    else:
        return {
            "success": True,
            "current_value": new_value,
            "progress_percentage": progress_percentage,
            "status": new_status,
            "updated_at": update_data["updated_at"]
        }


@router.get("/challenges/history")
async def get_seller_challenges_history(
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service)
) -> List[Dict]:
    """
    Get completed challenges (past end_date) for seller
    Returns challenges that have ended (end_date < today)
    """
    # Get seller info
    user = await seller_service.get_seller_profile(current_user["id"])

    # CRITICAL: Challenges are filtered by store_id, not manager_id
    # A seller can see challenges even without a manager_id, as long as they have a store_id
    seller_store_id = user.get('store_id') if user else None
    if not seller_store_id:
        return []
    
    # Use manager_id if available (for progress calculation), otherwise use None
    manager_id = user.get('manager_id') if user else None
    
    # Fetch history - filtered by store_id, not manager_id
    challenges = await seller_service.get_seller_challenges_history(
        current_user['id'], 
        manager_id  # Can be None - only used for progress calculation
    )
    return challenges



# ===== CALENDAR DATA =====

@router.get("/dates-with-data")
async def get_seller_dates_with_data(
    year: int = Query(None),
    month: int = Query(None),
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service),
):
    """
    Get list of dates that have KPI data for the seller
    Used for calendar highlighting
    
    Returns:
        - dates: list of dates with any KPI data
        - lockedDates: list of dates with locked/validated KPI entries (from API/POS)
    """
    seller_id = current_user['id']
    
    # Build date filter
    query = {"seller_id": seller_id}
    if year and month:
        start_date = f"{year}-{month:02d}-01"
        if month == 12:
            end_date = f"{year + 1}-01-01"
        else:
            end_date = f"{year}-{month + 1:02d}-01"
        query["date"] = {"$gte": start_date, "$lt": end_date}
    
    dates = await seller_service.get_kpi_distinct_dates(query)
    all_dates = sorted(set(dates))
    locked_query = {**query, "locked": True}
    locked_dates = await seller_service.get_kpi_distinct_dates(locked_query)
    
    return {
        "dates": all_dates,
        "lockedDates": sorted(locked_dates)
    }



# ===== KPI CONFIG FOR SELLER =====
# 🏺 LEGACY RESTORED

@router.get("/kpi-config")
async def get_seller_kpi_config(
    store_id: Optional[str] = Query(None, description="Store ID (optionnel, utilise celui du vendeur si non fourni)"),
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service),
):
    """
    Get KPI configuration that applies to this seller for a specific store.
    Returns which KPIs the seller should track (based on store's config).
    
    CRITICAL: Uses store_id to ensure config is store-specific, not manager-specific.
    This allows sellers and managers to work across multiple stores.
    """
    user = await seller_service.get_seller_profile(current_user["id"])
    effective_store_id = store_id or (user.get('store_id') if user else None)

    if not effective_store_id:
        return {
            "track_ca": True,
            "track_ventes": True,
            "track_clients": True,
            "track_articles": True,
            "track_prospects": True
        }

    config = await seller_service.get_kpi_config_by_store(effective_store_id)
    if not config:
        return {
            "track_ca": True,
            "track_ventes": True,
            "track_clients": True,
            "track_articles": True,
            "track_prospects": True
        }

    return {
        "track_ca": config.get('seller_track_ca') if 'seller_track_ca' in config else config.get('track_ca', True),
        "track_ventes": config.get('seller_track_ventes') if 'seller_track_ventes' in config else config.get('track_ventes', True),
        "track_clients": config.get('seller_track_clients') if 'seller_track_clients' in config else config.get('track_clients', True),
        "track_articles": config.get('seller_track_articles') if 'seller_track_articles' in config else config.get('track_articles', True),
        "track_prospects": config.get('seller_track_prospects') if 'seller_track_prospects' in config else config.get('track_prospects', True)
    }


# ===== KPI ENTRIES FOR SELLER =====

@router.get("/kpi-entries")
async def get_my_kpi_entries(
    days: int = Query(None, description="Number of days to fetch"),
    pagination: PaginationParams = Depends(),
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service),
):
    """
    Get seller's KPI entries.
    Returns KPI data for the seller.
    ✅ MIGRÉ: Pagination avec PaginatedResponse
    """
    seller_id = current_user["id"]
    size = days if days and days <= 365 else pagination.size
    result = await seller_service.get_kpi_entries_paginated(
        seller_id, pagination.page, min(size, 365)
    )
    return result


# ===== DAILY CHALLENGE FOR SELLER =====

@router.get("/daily-challenge")
async def get_daily_challenge(
    force_competence: str = Query(None, description="Force a specific competence"),
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service),
):
    """
    Get or generate daily challenge for seller.
    Returns an uncompleted challenge for today, or generates a new one.
    """
    from uuid import uuid4
    
    seller_id = current_user['id']
    today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    
    # Check if there's an uncompleted challenge for today
    existing = await seller_service.get_daily_challenge_for_seller_date(seller_id, today)
    
    if existing and not existing.get('completed'):
            return existing
    
    # Check if there's already a completed challenge for today
    completed_today = await seller_service.get_daily_challenge_completed_today(seller_id, today)
    
    if completed_today:
            # Return the completed challenge instead of generating a new one
            return completed_today
    
    # Generate new challenge
    diagnostic = await seller_service.get_diagnostic_for_seller(seller_id)
    
    recent_result = await seller_service.get_daily_challenges_paginated(seller_id, 1, 5)
    recent = recent_result.items
    recent_competences = [ch.get('competence') for ch in recent if ch.get('competence')]
    
    # Select competence
    if force_competence and force_competence in ['accueil', 'decouverte', 'argumentation', 'closing', 'fidelisation']:
            selected_competence = force_competence
    elif not diagnostic:
            competences = ['accueil', 'decouverte', 'argumentation', 'closing', 'fidelisation']
            selected_competence = competences[datetime.now().day % len(competences)]
    else:
            # Find weakest competence not recently used
            scores = {
                'accueil': diagnostic.get('score_accueil', 3),
                'decouverte': diagnostic.get('score_decouverte', 3),
                'argumentation': diagnostic.get('score_argumentation', 3),
                'closing': diagnostic.get('score_closing', 3),
                'fidelisation': diagnostic.get('score_fidelisation', 3)
            }
            sorted_comps = sorted(scores.items(), key=lambda x: x[1])
            
            selected_competence = None
            for comp, score in sorted_comps:
                if comp not in recent_competences[:2]:
                    selected_competence = comp
                    break
            
            if not selected_competence:
                selected_competence = sorted_comps[0][0]
    
    # Challenge templates by competence - with pedagogical tips and reasons
    templates = {
            'accueil': {
                'title': 'Accueil Excellence',
                'description': 'Accueillez chaque client avec un sourire et une phrase personnalisée dans les 10 premières secondes.',
                'pedagogical_tip': 'Un sourire authentique crée instantanément une connexion positive. Pensez à sourire avec les yeux aussi !',
                'reason': "L'accueil est la première impression que tu donnes. Un excellent accueil augmente significativement tes chances de vente."
            },
            'decouverte': {
                'title': 'Questions Magiques',
                'description': 'Posez au moins 3 questions ouvertes à chaque client pour comprendre ses besoins.',
                'pedagogical_tip': 'Utilisez des questions commençant par "Comment", "Pourquoi", "Qu\'est-ce que" pour obtenir des réponses détaillées.',
                'reason': 'Les questions ouvertes révèlent les vrais besoins du client et te permettent de mieux personnaliser ton argumentaire.'
            },
            'argumentation': {
                'title': 'Argumentaire Pro',
                'description': 'Utilisez la technique CAB (Caractéristique-Avantage-Bénéfice) pour chaque produit présenté.',
                'pedagogical_tip': 'CAB = Caractéristique (ce que c\'est) → Avantage (ce que ça fait) → Bénéfice (ce que ça apporte au client).',
                'reason': 'Un argumentaire structuré est plus convaincant et aide le client à comprendre la valeur du produit pour lui.'
            },
            'closing': {
                'title': 'Closing Master',
                'description': 'Proposez la conclusion de la vente avec une question fermée positive.',
                'pedagogical_tip': 'Exemple : "On passe en caisse ensemble ?" ou "Je vous l\'emballe ?" - Des questions qui supposent un OUI.',
                'reason': 'Le closing est souvent négligé. Une question fermée positive aide le client à passer à l\'action.'
            },
            'fidelisation': {
                'title': 'Client Fidèle',
                'description': 'Remerciez chaque client et proposez un contact ou suivi personnalisé.',
                'pedagogical_tip': 'Proposez de les ajouter à la newsletter ou de les rappeler quand un nouveau produit arrive.',
                'reason': 'Un client fidélisé revient et recommande. C\'est la clé d\'une carrière commerciale réussie.'
            }
    }
    
    template = templates.get(selected_competence, templates['accueil'])
    
    challenge = {
            "id": str(uuid4()),
            "seller_id": seller_id,
            "date": today,
            "competence": selected_competence,
            "title": template['title'],
            "description": template['description'],
            "pedagogical_tip": template['pedagogical_tip'],
            "reason": template['reason'],
            "completed": False,
            "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await seller_service.create_daily_challenge(challenge)
    if '_id' in challenge:
            del challenge['_id']
    
    return challenge


@router.post("/daily-challenge/complete")
async def complete_daily_challenge(
    data: dict,
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service),
):
    """Mark a daily challenge as completed."""
    challenge_id = data.get('challenge_id')
    result = data.get('result', 'success')  # success, partial, failed
    feedback = data.get('feedback', '')
    
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    update_result = await seller_service.update_daily_challenge(
        current_user["id"],
        today_str,
        {
            "completed": True,
            "challenge_result": result,
            "feedback_comment": feedback,
            "completed_at": datetime.now(timezone.utc).isoformat(),
        },
    )
    if not update_result:
        raise NotFoundError("Challenge not found")
    
    return {"success": True, "message": "Challenge complété !"}


# ===== DIAGNOSTIC FOR SELLER =====

@router.get("/diagnostic/me")
async def get_my_diagnostic(
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service),
):
    """Get seller's own DISC diagnostic profile."""
    diagnostic = await seller_service.get_diagnostic_for_seller(current_user['id'])
    
    if not diagnostic:
        # Return empty response instead of 404 to avoid console errors (consistent with diagnostic_router)
        return {
            "status": "not_started",
            "has_diagnostic": False,
            "message": "Diagnostic DISC non encore complété"
        }
    
    # Mapping functions to convert raw values to formatted values
    def map_style(style_value):
        """Convert raw style (D, I, S, C) or other formats to formatted style"""
        if not style_value:
            return "Convivial"
        style_str = str(style_value).upper().strip()
        # DISC mapping
        disc_to_style = {
            'D': 'Dynamique',
            'I': 'Convivial',
            'S': 'Empathique',
            'C': 'Stratège'
        }
        if style_str in disc_to_style:
            return disc_to_style[style_str]
        # If already formatted, return as is
        valid_styles = ['Convivial', 'Explorateur', 'Dynamique', 'Discret', 'Stratège', 'Empathique', 'Relationnel']
        if style_value in valid_styles:
            return style_value
        return "Convivial"  # Default
    
    def map_level(level_value):
        """Convert raw level (number) to formatted level"""
        if not level_value:
            return "Challenger"
        # If it's already a string, return as is
        if isinstance(level_value, str):
            valid_levels = ['Explorateur', 'Challenger', 'Ambassadeur', 'Maître du Jeu', 'Débutant', 'Intermédiaire', 'Expert terrain']
            if level_value in valid_levels:
                return level_value
        # If it's a number, map to level
        if isinstance(level_value, (int, float)):
            if level_value >= 80:
                return "Maître du Jeu"
            elif level_value >= 60:
                return "Ambassadeur"
            elif level_value >= 40:
                return "Challenger"
            else:
                return "Explorateur"
        return "Challenger"  # Default
    
    def map_motivation(motivation_value):
        """Convert raw motivation to formatted motivation"""
        if not motivation_value:
            return "Relation"
        motivation_str = str(motivation_value).strip()
        valid_motivations = ['Relation', 'Reconnaissance', 'Performance', 'Découverte', 'Équipe', 'Résultats', 'Dépassement', 'Apprentissage', 'Progression', 'Stabilité', 'Polyvalence', 'Contribution']
        if motivation_str in valid_motivations:
            return motivation_str
        return "Relation"  # Default
    
    # Format diagnostic values if needed (convert raw values to formatted)
    if diagnostic:
        # Create a copy to avoid modifying the original dict
        formatted_diagnostic = dict(diagnostic)
        formatted_diagnostic['style'] = map_style(formatted_diagnostic.get('style'))
        formatted_diagnostic['level'] = map_level(formatted_diagnostic.get('level'))
        
        # If motivation is missing, infer it from style or use default
        if not formatted_diagnostic.get('motivation'):
            # Infer motivation from DISC style if available
            disc_style = formatted_diagnostic.get('disc_dominant', '').upper()
            # Check the original style value BEFORE mapping (could be "S", "D", "I", "C")
            original_style = str(diagnostic.get('style', '')).upper().strip()
            
            if disc_style == 'D' or original_style == 'D':
                formatted_diagnostic['motivation'] = 'Performance'
            elif disc_style == 'I' or original_style == 'I':
                formatted_diagnostic['motivation'] = 'Reconnaissance'
            elif disc_style == 'S' or original_style == 'S':
                formatted_diagnostic['motivation'] = 'Relation'
            elif disc_style == 'C' or original_style == 'C':
                formatted_diagnostic['motivation'] = 'Découverte'
            else:
                formatted_diagnostic['motivation'] = map_motivation(formatted_diagnostic.get('motivation'))
        else:
            formatted_diagnostic['motivation'] = map_motivation(formatted_diagnostic.get('motivation'))
        
        # Generate ai_profile_summary from strengths and axes_de_developpement if missing
        if not formatted_diagnostic.get('ai_profile_summary'):
            strengths = formatted_diagnostic.get('strengths', [])
            axes = formatted_diagnostic.get('axes_de_developpement', [])
            
            summary_parts = []
            if strengths:
                summary_parts.append("💪 Tes forces :")
                for strength in strengths[:3]:  # Max 3 strengths
                    summary_parts.append(f"• {strength}")
            
            if axes:
                summary_parts.append("\n🎯 Axes de développement :")
                for axe in axes[:3]:  # Max 3 axes
                    summary_parts.append(f"• {axe}")
            
            if summary_parts:
                formatted_diagnostic['ai_profile_summary'] = "\n".join(summary_parts)
        
            diagnostic = formatted_diagnostic
        
        # Return with status 'completed' for frontend compatibility (consistent with diagnostic_router)
        return {
            "status": "completed",
            "has_diagnostic": True,
            "diagnostic": diagnostic  # Include the full diagnostic data
        }
        


@router.get("/diagnostic/me/live-scores")
async def get_my_diagnostic_live_scores(
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service),
):
    """Get seller's live competence scores (updated after debriefs)."""
    diagnostic = await seller_service.get_diagnostic_for_seller(current_user['id'])

    if not diagnostic:
        return {
            "has_diagnostic": False,
            "seller_id": current_user['id'],
            "scores": {
                "accueil": 3.0,
                "decouverte": 3.0,
                "argumentation": 3.0,
                "closing": 3.0,
                "fidelisation": 3.0
            },
            "message": "Scores par défaut (diagnostic non complété)"
        }

    return {
        "has_diagnostic": True,
        "seller_id": current_user['id'],
        "scores": {
            "accueil": diagnostic.get('score_accueil', 3.0),
            "decouverte": diagnostic.get('score_decouverte', 3.0),
            "argumentation": diagnostic.get('score_argumentation', 3.0),
            "closing": diagnostic.get('score_closing', 3.0),
            "fidelisation": diagnostic.get('score_fidelisation', 3.0)
        },
        "updated_at": diagnostic.get('updated_at', diagnostic.get('created_at'))
    }


# ===== KPI ENTRY (Create/Update) =====

@router.post("/kpi-entry")
async def save_kpi_entry(
    kpi_data: dict,
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service),
):
    """
    Create or update a KPI entry for the seller.
    This is the main endpoint used by sellers to record their daily KPIs.
    """
    from uuid import uuid4
    seller_id = current_user['id']
    date = kpi_data.get('date', datetime.now(timezone.utc).strftime('%Y-%m-%d'))
    seller = await seller_service.get_seller_profile(seller_id)
    if not seller:
        raise NotFoundError("Seller not found")
    store_id = seller.get("store_id")
    if await seller_service.check_kpi_date_locked(store_id, date):
        raise ForbiddenError(
            "🔒 Cette date est verrouillée. Les données proviennent de l'API/ERP et ne peuvent pas être modifiées manuellement."
        )
    existing = await seller_service.get_kpi_entry_for_seller_date(seller_id, date)
    if existing and existing.get('locked'):
        raise ForbiddenError("🔒 Cette entrée est verrouillée (données API). Impossible de modifier.")
    entry_data = {
        "seller_id": seller_id,
        "seller_name": seller.get('name', current_user.get('name', 'Vendeur')),
        "manager_id": seller.get('manager_id'),
        "store_id": store_id,
        "date": date,
        "seller_ca": kpi_data.get('seller_ca') or kpi_data.get('ca_journalier') or 0,
        "ca_journalier": kpi_data.get('ca_journalier') or kpi_data.get('seller_ca') or 0,
        "nb_ventes": kpi_data.get('nb_ventes') or 0,
        "nb_clients": kpi_data.get('nb_clients') or 0,
        "nb_articles": kpi_data.get('nb_articles') or 0,
        "nb_prospects": kpi_data.get('nb_prospects') or 0,
        "source": "manual",
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    if existing:
        await seller_service.update_kpi_entry_by_id(existing.get("id"), entry_data)
        entry_data["id"] = existing.get("id")
    else:
        entry_data["id"] = str(uuid4())
        entry_data["created_at"] = datetime.now(timezone.utc).isoformat()
        await seller_service.create_kpi_entry(entry_data)
    if '_id' in entry_data:
        del entry_data['_id']
    return entry_data


# ===== DAILY CHALLENGE STATS =====

@router.get("/daily-challenge/stats")
async def get_daily_challenge_stats(
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service),
):
    """Get statistics for seller's daily challenges."""
    seller_id = current_user['id']
    challenges_result = await seller_service.get_daily_challenges_paginated(seller_id, 1, 50)
    challenges = challenges_result.items
    total = challenges_result.total
    completed = len([c for c in challenges if c.get('completed')])
    by_competence = {}
    for c in challenges:
        comp = c.get('competence', 'unknown')
        if comp not in by_competence:
            by_competence[comp] = {'total': 0, 'completed': 0}
        by_competence[comp]['total'] += 1
        if c.get('completed'):
            by_competence[comp]['completed'] += 1
    streak = 0
    sorted_challenges = sorted(
        [c for c in challenges if c.get('completed')],
        key=lambda x: x.get('date', ''),
        reverse=True
    )
    if sorted_challenges:
        today = datetime.now(timezone.utc).date()
        for i, ch in enumerate(sorted_challenges):
            ch_date = datetime.strptime(ch.get('date', '2000-01-01'), '%Y-%m-%d').date()
            expected_date = today - timedelta(days=i)
            if ch_date == expected_date or ch_date == expected_date - timedelta(days=1):
                streak += 1
            else:
                break
    return {
        "total_challenges": total,
        "completed_challenges": completed,
        "completion_rate": round(completed / total * 100, 1) if total > 0 else 0,
        "current_streak": streak,
        "by_competence": by_competence
    }


@router.get("/daily-challenge/history")
async def get_daily_challenge_history(
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service),
):
    """Get all past daily challenges for the seller."""
    challenges_result = await seller_service.get_daily_challenges_paginated(
        current_user["id"], 1, 50
    )
    return {
        "challenges": challenges_result.items,
        "pagination": {
            "total": challenges_result.total,
            "page": challenges_result.page,
            "size": challenges_result.size,
            "pages": challenges_result.pages
        }
    }


# ===== BILAN INDIVIDUEL =====

@router.get("/bilan-individuel/all")
async def get_all_bilans_individuels(
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service),
):
    """Get all individual performance reports (bilans) for seller."""
    bilans_result = await seller_service.get_bilans_paginated(
        current_user['id'], page=1, size=50
    )
    return {
        "status": "success",
        "bilans": bilans_result.items,
        "pagination": {
            "total": bilans_result.total,
            "page": bilans_result.page,
            "size": bilans_result.size,
            "pages": bilans_result.pages
        }
    }


@router.post("/bilan-individuel", dependencies=[rate_limit("5/minute")])
async def generate_bilan_individuel(
    start_date: Optional[str] = Query(None, description="Start date YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="End date YYYY-MM-DD"),
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service),
):
    """Generate an individual performance report for a period."""
    from uuid import uuid4
    from services.ai_service import AIService
    import json

    seller_id = current_user['id']
    # Get KPI summary and list for the period
    summary = await seller_service.get_kpi_aggregate_for_period(
        seller_id, start_date, end_date
    )
    total_ca = summary.get('total_ca', 0) or 0
    total_ventes = summary.get('total_ventes', 0) or 0
    total_clients = summary.get('total_clients', 0) or 0
    panier_moyen = total_ca / total_ventes if total_ventes > 0 else 0
    kpis_result = await seller_service.get_kpis_for_period_paginated(
        seller_id, start_date, end_date, page=1, size=50
    )
    kpis_list = kpis_result.items
    # Try to generate AI bilan with structured format
    ai_service = AIService()
    seller_data = await seller_service.get_seller_profile(seller_id)
    seller_name = seller_data.get('name', 'Vendeur') if seller_data else 'Vendeur'
    synthese = ""
    points_forts = []
    points_attention = []
    recommandations = []
    if ai_service.available and len(kpis_list) > 0:
            try:
                # 🛑 STRICT SELLER PROMPT V3 - No marketing, no traffic, no promotions
                prompt = f"""Génère un bilan de performance pour {seller_name}.

📊 DONNÉES VENDEUR (ignore tout ce qui n'est pas listé) :
- CA total: {total_ca:.0f}€
- Nombre de ventes: {total_ventes}
- Panier moyen: {panier_moyen:.2f}€
- Jours travaillés: {len(kpis_list)}

⚠️ RAPPEL STRICT : Ne parle PAS de trafic, promotions, réseaux sociaux ou marketing.
Si le CA est bon, félicite simplement. Focus sur accueil, vente additionnelle, closing.

Génère un bilan structuré au format JSON:
{{
  "synthese": "Une phrase de félicitation sincère basée sur le CA et le panier moyen",
  "points_forts": ["Point fort lié à la VENTE", "Point fort lié au SERVICE CLIENT"],
  "points_attention": ["Axe d'amélioration terrain (accueil, closing, vente additionnelle)"],
  "recommandations": ["Action concrète en boutique 1", "Action concrète en boutique 2"]
}}"""

                # Import the strict prompt
                from services.ai_service import SELLER_STRICT_SYSTEM_PROMPT
                
                chat = ai_service._create_chat(
                    session_id=f"bilan_{seller_id}_{start_date}",
                    system_message=SELLER_STRICT_SYSTEM_PROMPT + "\nRéponds uniquement en JSON valide.",
                    model="gpt-4o-mini"
                )
                
                response = await ai_service._send_message(chat, prompt)
                
                if response:
                    # Parse JSON
                    clean = response.strip()
                    if "```json" in clean:
                        clean = clean.split("```json")[1].split("```")[0]
                    elif "```" in clean:
                        clean = clean.split("```")[1].split("```")[0]
                    
                    try:
                        parsed = json.loads(clean.strip())
                        synthese = parsed.get('synthese', '')
                        points_forts = parsed.get('points_forts', [])
                        points_attention = parsed.get('points_attention', [])
                        recommandations = parsed.get('recommandations', [])
                    except:
                        # Fallback: use raw response as synthese
                        synthese = response[:500] if response else ""
                        
            except Exception as e:
                logger.error("AI bilan error: %s", e, exc_info=True)
    # If no AI, generate basic bilan
    if not synthese:
        if len(kpis_list) > 0:
            synthese = f"Cette semaine, tu as réalisé {total_ventes} ventes pour un CA de {total_ca:.0f}€. Continue comme ça !"
            points_forts = ["Assiduité dans la saisie des KPIs"]
            points_attention = ["Continue à développer tes compétences"]
            recommandations = ["Fixe-toi un objectif quotidien", "Analyse tes meilleures ventes"]
        else:
            synthese = "Aucune donnée KPI pour cette période. Commence à saisir tes performances !"
            points_attention = ["Pense à saisir tes KPIs quotidiennement"]
            recommandations = ["Saisis tes ventes chaque jour pour obtenir un bilan personnalisé"]
    periode = f"{start_date} - {end_date}" if start_date and end_date else "Période actuelle"
    bilan = {
        "id": str(uuid4()),
        "seller_id": seller_id,
        "periode": periode,
        "period_start": start_date,
        "period_end": end_date,
        "kpi_resume": {
            "ca": total_ca,
            "ventes": total_ventes,
            "clients": total_clients,
            "panier_moyen": round(panier_moyen, 2),
            "jours": len(kpis_list)
        },
        "synthese": synthese,
        "points_forts": points_forts,
        "points_attention": points_attention,
        "recommandations": recommandations,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await seller_service.create_bilan(bilan)
    if '_id' in bilan:
        del bilan['_id']
    return bilan
        


# ===== DIAGNOSTIC/ME ENDPOINT (ROOT LEVEL) =====
# This is needed because frontend calls /api/diagnostic/me
# But the diagnostics router has prefix /manager-diagnostic

from fastapi import APIRouter as DiagRouter

# Create a separate router for /diagnostic endpoints
diagnostic_router = APIRouter(prefix="/diagnostic", tags=["Seller Diagnostic"])

@diagnostic_router.get("/me")
async def get_diagnostic_me(
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service),
):
    """Get seller's own DISC diagnostic profile (at /api/diagnostic/me)."""
    diagnostic = await seller_service.get_diagnostic_for_seller(current_user['id'])
    if not diagnostic:
        return {
            "status": "not_started",
            "has_diagnostic": False,
            "message": "Diagnostic DISC non encore complété"
        }
    return {
        "status": "completed",
        "has_diagnostic": True,
        "diagnostic": diagnostic
    }


@diagnostic_router.get("/me/live-scores")
async def get_diagnostic_live_scores(
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service),
):
    """Get seller's live competence scores (updated after debriefs)."""
    diagnostic = await seller_service.get_diagnostic_for_seller(current_user['id'])
    if not diagnostic:
        return {
            "has_diagnostic": False,
            "seller_id": current_user['id'],
            "scores": {
                "accueil": 3.0,
                "decouverte": 3.0,
                "argumentation": 3.0,
                "closing": 3.0,
                "fidelisation": 3.0
            },
            "message": "Scores par défaut (diagnostic non complété)"
        }
    return {
        "has_diagnostic": True,
        "seller_id": current_user['id'],
        "scores": {
            "accueil": diagnostic.get('score_accueil', 3.0),
            "decouverte": diagnostic.get('score_decouverte', 3.0),
            "argumentation": diagnostic.get('score_argumentation', 3.0),
            "closing": diagnostic.get('score_closing', 3.0),
            "fidelisation": diagnostic.get('score_fidelisation', 3.0)
        },
        "updated_at": diagnostic.get('updated_at', diagnostic.get('created_at'))
    }


# ===== DIAGNOSTIC SELLER ENDPOINT (for managers viewing seller details) =====

@diagnostic_router.get("/seller/{seller_id}")
async def get_seller_diagnostic_for_manager(
    seller_id: str,
    current_user: Dict = Depends(get_current_user),
    seller_service: SellerService = Depends(get_seller_service),
):
    """
    Get a seller's diagnostic (for manager/gérant viewing seller details)
    Endpoint: GET /api/diagnostic/seller/{seller_id}
    Accessible to managers (same store) and gérants (owner of seller's store)
    """
    user_role = current_user.get('role')
    user_id = current_user.get('id')
    if user_role not in ['manager', 'gerant', 'gérant']:
        raise ForbiddenError("Accès réservé aux managers et gérants")
    seller = await seller_service.get_seller_profile(seller_id)
    if seller and seller.get("role") != "seller":
        seller = None
    if not seller:
        return None
    seller_store_id = seller.get('store_id')
    has_access = False
    if user_role == 'manager':
        has_access = (seller_store_id == current_user.get('store_id'))
    elif user_role in ['gerant', 'gérant']:
        store = await seller_service.get_store_by_id(
            store_id=seller_store_id,
            gerant_id=user_id
        )
        if store and not store.get("active"):
            store = None
        has_access = store is not None
    if not has_access:
        raise ForbiddenError("Accès non autorisé à ce vendeur")
    diagnostic = await seller_service.get_diagnostic_for_seller(seller_id)
    return diagnostic


# ===== STORE INFO FOR SELLER =====

@router.get("/store-info")
async def get_seller_store_info(
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service),
):
    """Get basic store info for the seller's store."""
    try:
        seller = await seller_service.get_seller_profile(
            current_user['id'],
            projection={"_id": 0, "store_id": 1}
        )
        
        if not seller or not seller.get('store_id'):
            return {"name": "Magasin", "id": None}
        
        store = await seller_service.get_store_by_id(
            store_id=seller['store_id'],
            projection={"_id": 0, "id": 1, "name": 1, "location": 1}
        )
        
        if not store:
            return {"name": "Magasin", "id": seller['store_id']}
        
        return store
        
    except Exception as e:
        return {"name": "Magasin", "id": None}


# ===== CREATE DIAGNOSTIC =====
# 🏺 LEGACY RESTORED - Full diagnostic creation with AI analysis

from pydantic import BaseModel, Field
from uuid import uuid4

class DiagnosticCreate(BaseModel):
    responses: dict
    style: Optional[str] = None
    level: Optional[Union[str, int, float]] = None
    motivation: Optional[str] = None
    strengths: Optional[List[str]] = None
    axes_de_developpement: Optional[List[str]] = None


def calculate_competence_scores_from_questionnaire(responses: dict) -> dict:
    """
    Calculate competence scores from questionnaire responses
    Questions 1-15 are mapped to 5 competences (3 questions each)
    """
    competence_mapping = {
        'accueil': [1, 2, 3],
        'decouverte': [4, 5, 6],
        'argumentation': [7, 8, 9],
        'closing': [10, 11, 12],
        'fidelisation': [13, 14, 15]
    }
    
    question_scores = {
        1: [5, 3, 4],
        2: [5, 4, 3, 2],
        3: [3, 5, 4],
        4: [5, 4, 3],
        5: [5, 4, 4, 3],
        6: [5, 3, 4],
        7: [3, 5, 4],
        8: [3, 5, 4, 3],
        9: [4, 3, 5],
        10: [5, 4, 5, 3],
        11: [4, 3, 5],
        12: [5, 4, 5, 3],
        13: [4, 4, 5, 5],
        14: [4, 5, 3],
        15: [5, 3, 5, 4]
    }
    
    scores = {
        'accueil': [],
        'decouverte': [],
        'argumentation': [],
        'closing': [],
        'fidelisation': []
    }
    
    for competence, question_ids in competence_mapping.items():
        for q_id in question_ids:
            q_key = str(q_id)
            if q_key in responses:
                response_value = responses[q_key]
                try:
                    # Convert to int if string (e.g., "0" -> 0)
                    option_idx = int(response_value) if not isinstance(response_value, int) else response_value
                    if q_id in question_scores and 0 <= option_idx < len(question_scores[q_id]):
                        scores[competence].append(question_scores[q_id][option_idx])
                    else:
                        scores[competence].append(3.0)
                except (ValueError, TypeError):
                    # Invalid response format, use default
                    scores[competence].append(3.0)
    
    final_scores = {}
    for competence, score_list in scores.items():
        if score_list:
            final_scores[f'score_{competence}'] = round(sum(score_list) / len(score_list), 1)
        else:
            final_scores[f'score_{competence}'] = 3.0
    
    return final_scores


def calculate_disc_profile(disc_responses: dict) -> dict:
    """Calculate DISC profile from questions 16-23"""
    d_score = 0
    i_score = 0
    s_score = 0
    c_score = 0
    
    disc_mapping = {
        '16': {'D': [0], 'I': [1], 'S': [2], 'C': [3]},
        '17': {'D': [0], 'I': [1], 'S': [2], 'C': [3]},
        '18': {'D': [0], 'I': [1], 'S': [2], 'C': [3]},
        '19': {'D': [0], 'I': [1], 'S': [2], 'C': [3]},
        '20': {'D': [0], 'I': [1], 'S': [2], 'C': [3]},
        '21': {'D': [0], 'I': [1], 'S': [2], 'C': [3]},
        '22': {'D': [0], 'I': [1], 'S': [2], 'C': [3]},
        '23': {'D': [0], 'I': [1], 'S': [2], 'C': [3]},
    }
    
    for q_key, response in disc_responses.items():
        if q_key in disc_mapping:
            mapping = disc_mapping[q_key]
            try:
                # Convert to int if string (e.g., "0" -> 0)
                response_int = int(response) if not isinstance(response, int) else response
                if response_int in mapping.get('D', []):
                    d_score += 1
                elif response_int in mapping.get('I', []):
                    i_score += 1
                elif response_int in mapping.get('S', []):
                    s_score += 1
                elif response_int in mapping.get('C', []):
                    c_score += 1
            except (ValueError, TypeError):
                # Skip invalid response
                pass
    
    total = d_score + i_score + s_score + c_score
    if total == 0:
        total = 1
    
    percentages = {
        'D': round(d_score / total * 100),
        'I': round(i_score / total * 100),
        'S': round(s_score / total * 100),
        'C': round(c_score / total * 100)
    }
    
    dominant = max(percentages, key=percentages.get)
    
    return {
        'dominant': dominant,
        'percentages': percentages
    }


# Helper function to create diagnostic (used by both routers)
async def _create_diagnostic_impl(
    diagnostic_data: DiagnosticCreate,
    current_user: Dict,
    seller_service: SellerService,
):
    """
    Create or update seller's DISC diagnostic profile.
    Uses AI to analyze responses and generate profile summary.
    """
    from services.ai_service import AIService
    import json

    seller_id = current_user['id']
    if isinstance(diagnostic_data.responses, list):
        responses = {}
        for item in diagnostic_data.responses:
            if isinstance(item, dict) and 'question_id' in item:
                responses[str(item['question_id'])] = str(item.get('answer', ''))
    else:
        responses = diagnostic_data.responses
    if isinstance(responses, dict):
        normalized_responses = {}
        for key, value in responses.items():
            try:
                if isinstance(value, str) and value.isdigit():
                    normalized_responses[key] = int(value)
                elif isinstance(value, (int, float)):
                    normalized_responses[key] = int(value)
                else:
                    normalized_responses[key] = value
            except (ValueError, TypeError):
                normalized_responses[key] = value
        responses = normalized_responses
    await seller_service.delete_diagnostic_by_seller(seller_id)
    competence_scores = calculate_competence_scores_from_questionnaire(responses)
    disc_responses = {k: v for k, v in responses.items() if k.isdigit() and int(k) >= 16}
    disc_profile = calculate_disc_profile(disc_responses)
    ai_service = AIService()
    ai_analysis = {
        "style": "Convivial",
        "level": "Challenger",
        "motivation": "Relation",
        "summary": "Profil en cours d'analyse."
    }

    def map_style(style_value):
        """Convert raw style (D, I, S, C) or other formats to formatted style"""
        if not style_value:
            return "Convivial"
        style_str = str(style_value).upper().strip()
        disc_to_style = {
            'D': 'Dynamique',
            'I': 'Convivial',
            'S': 'Empathique',
            'C': 'Stratège'
        }
        if style_str in disc_to_style:
            return disc_to_style[style_str]
        valid_styles = ['Convivial', 'Explorateur', 'Dynamique', 'Discret', 'Stratège', 'Empathique', 'Relationnel']
        if style_value in valid_styles:
            return style_value
        return "Convivial"

    def map_level(level_value):
        """Convert raw level (number) to formatted level"""
        if not level_value:
            return "Challenger"
        if isinstance(level_value, str):
            valid_levels = ['Explorateur', 'Challenger', 'Ambassadeur', 'Maître du Jeu', 'Débutant', 'Intermédiaire', 'Expert terrain']
            if level_value in valid_levels:
                return level_value
        if isinstance(level_value, (int, float)):
            if level_value >= 80:
                return "Maître du Jeu"
            elif level_value >= 60:
                return "Ambassadeur"
            elif level_value >= 40:
                return "Challenger"
            else:
                return "Explorateur"
        return "Challenger"

    def map_motivation(motivation_value):
        """Convert raw motivation to formatted motivation"""
        if not motivation_value:
            return "Relation"
        motivation_str = str(motivation_value).strip()
        valid_motivations = ['Relation', 'Reconnaissance', 'Performance', 'Découverte', 'Équipe', 'Résultats', 'Dépassement', 'Apprentissage', 'Progression', 'Stabilité', 'Polyvalence', 'Contribution']
        if motivation_str in valid_motivations:
            return motivation_str
        return "Relation"

    if ai_service.available:
        try:
            responses_text = "\n".join([f"Question {k}: {v}" for k, v in responses.items()])
            prompt = f"""Voici les réponses d'un vendeur à un test comportemental :

{responses_text}

Analyse ses réponses pour identifier :
- son style de vente dominant (Convivial, Explorateur, Dynamique, Discret ou Stratège)
- son niveau global (Explorateur, Challenger, Ambassadeur, Maître du Jeu)
- ses leviers de motivation (Relation, Reconnaissance, Performance, Découverte)

Rédige un retour structuré avec une phrase d'intro, deux points forts, un axe d'amélioration et une phrase motivante.

Réponds au format JSON:
{{"style": "...", "level": "...", "motivation": "...", "summary": "..."}}"""

            chat = ai_service._create_chat(
                session_id=f"diagnostic_{seller_id}",
                system_message="Tu es un expert en analyse comportementale de vendeurs retail. Focus uniquement sur le style de vente et les traits de personnalité. Ne parle jamais de marketing, réseaux sociaux ou génération de trafic.",
                model="gpt-4o-mini"
            )
            response = await ai_service._send_message(chat, prompt)
            if response:
                clean = response.strip()
                if "```json" in clean:
                    clean = clean.split("```json")[1].split("```")[0]
                elif "```" in clean:
                    clean = clean.split("```")[1].split("```")[0]
                try:
                    ai_analysis = json.loads(clean.strip())
                except Exception:
                    pass
        except Exception as e:
            logger.error("AI diagnostic error: %s", e, exc_info=True)

    strengths = diagnostic_data.dict().get('strengths') or ai_analysis.get('strengths', [])
    axes_de_developpement = diagnostic_data.dict().get('axes_de_developpement') or ai_analysis.get('axes_de_developpement', [])

    ai_summary = ai_analysis.get('summary', '')
    if ai_summary == "Profil en cours d'analyse.":
        ai_summary = ''
    if not ai_summary and (strengths or axes_de_developpement):
        summary_parts = []
        if strengths:
            summary_parts.append("💪 Tes forces :")
            for strength in strengths[:3]:
                summary_parts.append(f"• {strength}")
        if axes_de_developpement:
            summary_parts.append("\n🎯 Axes de développement :")
            for axe in axes_de_developpement[:3]:
                summary_parts.append(f"• {axe}")
        if summary_parts:
            ai_summary = "\n".join(summary_parts)

    final_style = map_style(diagnostic_data.dict().get('style') or ai_analysis.get('style', 'Convivial'))
    final_level = map_level(diagnostic_data.dict().get('level') or ai_analysis.get('level', 'Challenger'))
    final_motivation = map_motivation(diagnostic_data.dict().get('motivation') or ai_analysis.get('motivation', 'Relation'))

    diagnostic = {
        "id": str(uuid4()),
        "seller_id": seller_id,
        "responses": responses,
        "ai_profile_summary": ai_summary,
        "style": final_style,
        "level": final_level,
        "motivation": final_motivation,
        "strengths": strengths if strengths else [],
        "axes_de_developpement": axes_de_developpement if axes_de_developpement else [],
        "score_accueil": competence_scores.get('score_accueil', 3.0),
        "score_decouverte": competence_scores.get('score_decouverte', 3.0),
        "score_argumentation": competence_scores.get('score_argumentation', 3.0),
        "score_closing": competence_scores.get('score_closing', 3.0),
        "score_fidelisation": competence_scores.get('score_fidelisation', 3.0),
        "disc_dominant": disc_profile['dominant'],
        "disc_percentages": disc_profile['percentages'],
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    validation_errors = []
    if not disc_profile.get('percentages') or sum(disc_profile['percentages'].values()) == 0:
        validation_errors.append("DISC percentages are all zero")
    if all(score == 3.0 for score in [
        diagnostic['score_accueil'], diagnostic['score_decouverte'],
        diagnostic['score_argumentation'], diagnostic['score_closing'],
        diagnostic['score_fidelisation']
    ]):
        validation_errors.append("All competence scores are default (3.0)")

    if validation_errors:
        logger.warning("Diagnostic validation warnings for seller %s: %s", seller_id, validation_errors)

    await seller_service.create_diagnostic_for_seller(diagnostic)
    if '_id' in diagnostic:
        del diagnostic['_id']
    return diagnostic

# Add POST endpoint in main router for /seller/diagnostic path
@router.post("/diagnostic")
async def create_diagnostic_seller(
    diagnostic_data: DiagnosticCreate,
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service),
):
    """Create seller diagnostic - endpoint at /seller/diagnostic"""
    return await _create_diagnostic_impl(diagnostic_data, current_user, seller_service)

@diagnostic_router.post("")
async def create_diagnostic(
    diagnostic_data: DiagnosticCreate,
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service),
):
    """Create seller diagnostic - endpoint at /diagnostic"""
    return await _create_diagnostic_impl(diagnostic_data, current_user, seller_service)


@diagnostic_router.delete("/me")
async def delete_my_diagnostic(
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service),
):
    """Delete seller's diagnostic to allow re-taking the questionnaire."""
    deleted_count = await seller_service.delete_diagnostic_by_seller(current_user['id'])
    return {"success": True, "deleted_count": deleted_count}


# ===== DAILY CHALLENGE REFRESH =====

@router.post("/daily-challenge/refresh")
async def refresh_daily_challenge(
    data: dict = None,
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service),
):
    """
    Refresh/regenerate the daily challenge for the seller.
    Deletes the current uncompleted challenge and generates a new one.
    Optionally forces a specific competence.
    """
    from uuid import uuid4

    seller_id = current_user['id']
    today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    force_competence = None
    if data:
        force_competence = data.get('force_competence') or data.get('competence')
    await seller_service.delete_daily_challenges_by_filter({
        "seller_id": seller_id,
        "date": today,
        "completed": False
    })
    diagnostic = await seller_service.get_diagnostic_for_seller(seller_id)
    recent_result = await seller_service.get_daily_challenges_paginated(
        seller_id, 1, 5
    )
    recent = recent_result.items
    recent_competences = [ch.get('competence') for ch in recent if ch.get('competence')]
    if force_competence and force_competence in ['accueil', 'decouverte', 'argumentation', 'closing', 'fidelisation']:
        selected_competence = force_competence
    elif not diagnostic:
        import random
        competences = ['accueil', 'decouverte', 'argumentation', 'closing', 'fidelisation']
        available = [c for c in competences if c not in recent_competences[:2]]
        selected_competence = random.choice(available) if available else random.choice(competences)
    else:
        scores = {
            'accueil': diagnostic.get('score_accueil', 3),
            'decouverte': diagnostic.get('score_decouverte', 3),
            'argumentation': diagnostic.get('score_argumentation', 3),
            'closing': diagnostic.get('score_closing', 3),
            'fidelisation': diagnostic.get('score_fidelisation', 3)
        }
        sorted_comps = sorted(scores.items(), key=lambda x: x[1])
        selected_competence = None
        for comp, score in sorted_comps:
            if comp not in recent_competences[:2]:
                selected_competence = comp
                break
        if not selected_competence:
            selected_competence = sorted_comps[0][0]

    templates = {
        'accueil': [
                {'title': 'Accueil Excellence', 'description': 'Accueillez chaque client avec un sourire et une phrase personnalisée dans les 10 premières secondes.', 'pedagogical_tip': 'Un sourire authentique crée instantanément une connexion positive. Pensez à sourire avec les yeux aussi !', 'reason': "L'accueil est la première impression que tu donnes. Un excellent accueil augmente significativement tes chances de vente."},
                {'title': 'Premier Contact', 'description': 'Établissez un contact visuel et saluez chaque client qui entre en boutique.', 'pedagogical_tip': 'Le contact visuel montre que vous êtes attentif et disponible. 3 secondes suffisent !', 'reason': 'Un client qui se sent vu et accueilli est plus enclin à interagir et à rester dans le magasin.'},
                {'title': 'Ambiance Positive', 'description': "Créez une ambiance chaleureuse dès l'entrée du client avec une attitude ouverte.", 'pedagogical_tip': 'Adoptez une posture ouverte : bras décroisés, sourire, et orientation vers le client.', 'reason': "L'énergie positive est contagieuse. Une bonne ambiance met le client en confiance pour acheter."}
        ],
        'decouverte': [
                {'title': 'Questions Magiques', 'description': 'Posez au moins 3 questions ouvertes à chaque client pour comprendre ses besoins.', 'pedagogical_tip': 'Utilisez des questions commençant par "Comment", "Pourquoi", "Qu\'est-ce que" pour obtenir des réponses détaillées.', 'reason': 'Les questions ouvertes révèlent les vrais besoins du client et te permettent de mieux personnaliser ton argumentaire.'},
                {'title': 'Écoute Active', 'description': 'Reformulez les besoins du client pour montrer que vous avez bien compris.', 'pedagogical_tip': 'Exemple : "Si je comprends bien, vous cherchez..." - Cela crée de la confiance.', 'reason': 'La reformulation montre que tu écoutes vraiment et permet de clarifier les besoins.'},
                {'title': 'Détective Client', 'description': 'Identifiez le besoin caché derrière la demande initiale du client.', 'pedagogical_tip': 'Creusez avec "Et pourquoi est-ce important pour vous ?" pour découvrir la vraie motivation.', 'reason': 'Le besoin exprimé n\'est souvent que la surface. Trouver le besoin réel permet de vendre mieux.'}
            ],
            'argumentation': [
                {'title': 'Argumentaire Pro', 'description': 'Utilisez la technique CAB (Caractéristique-Avantage-Bénéfice) pour chaque produit présenté.', 'pedagogical_tip': 'CAB = Caractéristique (ce que c\'est) → Avantage (ce que ça fait) → Bénéfice (ce que ça apporte au client).', 'reason': 'Un argumentaire structuré est plus convaincant et aide le client à comprendre la valeur du produit pour lui.'},
                {'title': 'Storytelling', 'description': 'Racontez une histoire ou un cas client pour illustrer les avantages du produit.', 'pedagogical_tip': 'Exemple : "Un client comme vous a choisi ce produit et il m\'a dit que..."', 'reason': 'Les histoires créent une connexion émotionnelle et rendent les avantages plus concrets.'},
                {'title': 'Démonstration', 'description': "Faites toucher/essayer le produit à chaque client pour créer l'expérience.", 'pedagogical_tip': 'Mettez le produit dans les mains du client. Ce qui est touché est plus facilement acheté !', 'reason': 'L\'expérience sensorielle crée un attachement au produit et facilite la décision d\'achat.'}
        ],
        'closing': [
                {'title': 'Closing Master', 'description': 'Proposez la conclusion de la vente avec une question fermée positive.', 'pedagogical_tip': 'Exemple : "On passe en caisse ensemble ?" ou "Je vous l\'emballe ?" - Des questions qui supposent un OUI.', 'reason': 'Le closing est souvent négligé. Une question fermée positive aide le client à passer à l\'action.'},
                {'title': 'Alternative Gagnante', 'description': 'Proposez deux options au client plutôt qu\'une seule.', 'pedagogical_tip': 'Exemple : "Vous préférez le modèle A ou B ?" - Le client choisit, pas "si" mais "lequel".', 'reason': 'L\'alternative réduit le risque de "non" et guide le client vers une décision positive.'},
                {'title': 'Urgence Douce', 'description': "Créez un sentiment d'opportunité avec une offre limitée dans le temps.", 'pedagogical_tip': 'Exemple : "Cette promotion se termine ce week-end" - Factuel, pas agressif.', 'reason': 'Un sentiment d\'urgence légitime aide le client à ne pas procrastiner sa décision.'}
            ],
            'fidelisation': [
                {'title': 'Client Fidèle', 'description': 'Remerciez chaque client et proposez un contact ou suivi personnalisé.', 'pedagogical_tip': 'Proposez de les ajouter à la newsletter ou de les rappeler quand un nouveau produit arrive.', 'reason': 'Un client fidélisé revient et recommande. C\'est la clé d\'une carrière commerciale réussie.'},
                {'title': 'Carte VIP', 'description': "Proposez l'inscription au programme de fidélité à chaque client.", 'pedagogical_tip': 'Présentez les avantages concrets : réductions, avant-premières, cadeaux...', 'reason': 'Les programmes de fidélité augmentent le panier moyen et la fréquence de visite.'},
                {'title': 'Prochain RDV', 'description': 'Suggérez une prochaine visite avec un événement ou nouveauté à venir.', 'pedagogical_tip': 'Exemple : "On reçoit la nouvelle collection la semaine prochaine, je vous préviens ?"', 'reason': 'Créer une raison de revenir transforme un achat unique en relation durable.'}
        ]
    }
    import random
    template_list = templates.get(selected_competence, templates['accueil'])
    template = random.choice(template_list)
    challenge = {
        "id": str(uuid4()),
        "seller_id": seller_id,
        "date": today,
        "competence": selected_competence,
        "title": template['title'],
        "description": template['description'],
        "pedagogical_tip": template['pedagogical_tip'],
        "reason": template['reason'],
        "completed": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await seller_service.create_daily_challenge(challenge)
    if '_id' in challenge:
        del challenge['_id']
    return challenge


# ===== INTERVIEW NOTES (Bloc-notes pour préparation entretien) =====

@router.get("/interview-notes")
async def get_interview_notes(
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service),
):
    """
    Récupère toutes les notes d'entretien du vendeur.
    Retourne les notes triées par date (plus récentes en premier).
    """
    seller_id = current_user['id']
    notes_result = await seller_service.get_interview_notes_paginated(
        seller_id, page=1, size=50
    )
    return {
        "notes": notes_result.items,
        "pagination": {
            "total": notes_result.total,
            "page": notes_result.page,
            "size": notes_result.size,
            "pages": notes_result.pages
        }
    }


@router.get("/interview-notes/{date}")
async def get_interview_note_by_date(
    date: str,
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service),
):
    """
    Récupère la note d'entretien pour une date spécifique.
    """
    seller_id = current_user['id']
    note = await seller_service.get_interview_note_by_seller_and_date(seller_id, date)
    if not note:
        return {"note": None}
    return {"note": note}


@router.post("/interview-notes")
async def create_interview_note(
    note_data: dict,
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service),
):
    """
    Crée ou met à jour une note d'entretien pour une date donnée.
    Si une note existe déjà pour cette date, elle est mise à jour.
    """
    seller_id = current_user['id']
    date = note_data.get('date')
    content = note_data.get('content', '').strip()
    if not date:
        raise ValidationError("La date est requise")
    try:
        datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        raise ValidationError("Format de date invalide. Utilisez YYYY-MM-DD")
    now = datetime.now(timezone.utc)
    existing_note = await seller_service.get_interview_note_by_seller_and_date(
        seller_id, date
    )
    if existing_note:
        await seller_service.update_interview_note_by_date(
            seller_id, date,
            {"content": content, "updated_at": now.isoformat()}
        )
        note_id = existing_note.get('id')
        message = "Note mise à jour avec succès"
    else:
        note = {
            "id": str(uuid.uuid4()),
            "seller_id": seller_id,
            "date": date,
            "content": content,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat()
        }
        note_id = await seller_service.create_interview_note(note)
        message = "Note créée avec succès"
    return {
        "success": True,
        "message": message,
        "note_id": note_id,
        "date": date
    }


@router.put("/interview-notes/{note_id}")
async def update_interview_note(
    note_id: str,
    note_data: dict,
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service),
):
    """
    Met à jour une note d'entretien existante.
    """
    seller_id = current_user['id']
    content = note_data.get('content', '').strip()
    note = await seller_service.get_interview_note_by_id_and_seller(note_id, seller_id)
    if not note:
        raise NotFoundError("Note non trouvée")
    await seller_service.update_interview_note_by_id(
        note_id, seller_id,
        {"content": content, "updated_at": datetime.now(timezone.utc).isoformat()}
    )
    return {
        "success": True,
        "message": "Note mise à jour avec succès"
    }


@router.delete("/interview-notes/{note_id}")
async def delete_interview_note(
    note_id: str,
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service),
):
    """
    Supprime une note d'entretien.
    """
    seller_id = current_user['id']
    deleted = await seller_service.delete_interview_note_by_id(note_id, seller_id)
    if not deleted:
        raise NotFoundError("Note non trouvée")
    return {
        "success": True,
        "message": "Note supprimée avec succès"
    }


@router.delete("/interview-notes/date/{date}")
async def delete_interview_note_by_date(
    date: str,
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service),
):
    """
    Supprime une note d'entretien par date.
    """
    seller_id = current_user['id']
    try:
        datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        raise ValidationError("Format de date invalide. Utilisez YYYY-MM-DD")
    deleted = await seller_service.delete_interview_note_by_date(seller_id, date)
    if not deleted:
        raise NotFoundError("Note non trouvée pour cette date")
    return {
        "success": True,
        "message": "Note supprimée avec succès"
    }
