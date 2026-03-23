"""
Seller Objectives Routes
Routes for seller tasks and objectives management.
"""
from fastapi import APIRouter, Depends
from typing import Dict, List

from services.seller_service import SellerService
from api.dependencies import get_seller_service
from core.security import get_current_seller
from core.constants import ERR_VENDEUR_SANS_MAGASIN
from core.exceptions import NotFoundError, ValidationError, ForbiddenError

router = APIRouter()


# ===== TASKS =====

@router.get("/tasks")
async def get_seller_tasks(
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service)
) -> List[Dict]:
    """Get all pending tasks for current seller (diagnostic, debrief, KPI, objectives)"""
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
    return objectives if isinstance(objectives, list) else []


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
