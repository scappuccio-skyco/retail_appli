"""
Seller Routes
API endpoints for seller-specific features (tasks, objectives, challenges)
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from exceptions.custom_exceptions import NotFoundError, ValidationError, ForbiddenError
from typing import Dict, List, Optional, Union
from datetime import datetime, timezone, timedelta
import uuid

from services.seller_service import SellerService
from api.dependencies import get_seller_service, get_relationship_service, get_conflict_service
from core.security import get_current_seller, get_current_user, verify_resource_store_access, require_active_space
from models.pagination import PaginatedResponse, PaginationParams
from utils.pagination import paginate, paginate_with_params
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
    try:
        gerant_id = current_user.get("gerant_id")
        return await seller_service.get_seller_subscription_status(gerant_id or "")
    except Exception as e:
        return {"isReadOnly": True, "status": "error", "message": str(e)}


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
    try:
        user = await seller_service.user_repo.find_by_id(user_id=current_user["id"])
        if user and not user.get("manager_id") and user.get("store_id"):
            store_id = user.get("store_id")
            managers = await seller_service.user_repo.find_by_store(
                store_id=store_id, role="manager",
                projection={"_id": 0, "id": 1, "name": 1}, limit=1
            )
            manager = managers[0] if managers and managers[0].get("status") == "active" else None
            if manager:
                manager_id = manager.get("id")
                await seller_service.user_repo.update_one(
                    {"id": current_user["id"]},
                    {"$set": {"manager_id": manager_id, "updated_at": datetime.now(timezone.utc).isoformat()}}
                )
                user["manager_id"] = manager_id
        # Objectives are filtered by store_id, not manager_id
        # The manager_id is only used for progress calculation, not for filtering visibility
        
        # Get seller's store_id
        seller_store_id = user.get('store_id') if user else None
        if not seller_store_id:
            return []
        
        # Use manager_id if available (for progress calculation), otherwise use None
        manager_id = user.get('manager_id') if user else None
        
        # Fetch objectives - filtered by store_id, not manager_id
        objectives = await seller_service.get_seller_objectives_active(
            current_user['id'], 
            manager_id  # Can be None - only used for progress calculation
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
    try:
        user = await seller_service.user_repo.find_by_id(user_id=current_user["id"])
        seller_store_id = user.get("store_id") if user else None
        if not seller_store_id:
            return {"active": [], "inactive": []}
        
        # Use manager_id if available (for progress calculation), otherwise use None
        manager_id = user.get('manager_id') if user else None
        
        # Fetch all objectives - filtered by store_id, not manager_id
        result = await seller_service.get_seller_objectives_all(
            current_user['id'], 
            manager_id  # Can be None - only used for progress calculation
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
    try:
        user = await seller_service.user_repo.find_by_id(user_id=current_user["id"])
        seller_store_id = user.get("store_id") if user else None
        if not seller_store_id:
            return []
        manager_id = user.get("manager_id") if user else None
        objectives = await seller_service.get_seller_objectives_history(
            current_user['id'], 
            manager_id  # Can be None - only used for progress calculation
        )
        return objectives


@router.post("/objectives/{objective_id}/mark-achievement-seen")
async def mark_objective_achievement_seen(
    objective_id: str,
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service),
    seller_service: SellerService = Depends(get_seller_service),
):
    """
    Mark an objective achievement notification as seen by the seller
    After this, the objective will move to history
    """
    seller_id = current_user['id']
    seller_store_id = current_user.get('store_id')
    
    if not seller_store_id:
        raise ValidationError("Vendeur sans magasin assigné")
    
    await verify_resource_store_access(
        resource_id=objective_id, resource_type="objective", user_store_id=seller_store_id,
        user_role="seller", user_id=seller_id,
        objective_repo=seller_service.objective_repo, challenge_repo=seller_service.challenge_repo,
    )
    
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
    user = await seller_service.user_repo.find_by_id(user_id=current_user["id"])
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
    try:
        user = await seller_service.user_repo.find_by_id(user_id=current_user["id"])
        if user and not user.get("manager_id") and user.get("store_id"):
            store_id = user.get("store_id")
            managers = await seller_service.user_repo.find_by_store(
                store_id=store_id, role="manager",
                projection={"_id": 0, "id": 1, "name": 1}, limit=1
            )
            manager = managers[0] if managers and managers[0].get("status") == "active" else None
            if manager:
                manager_id = manager.get("id")
                await seller_service.user_repo.update_one(
                    {"id": current_user["id"]},
                    {"$set": {"manager_id": manager_id, "updated_at": datetime.now(timezone.utc).isoformat()}}
                )
                user["manager_id"] = manager_id
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
    try:
        seller_id = current_user["id"]
        seller_store_id = current_user.get("store_id")
        if not seller_store_id:
            raise ValidationError("Vendeur sans magasin assigné")
        await verify_resource_store_access(
            resource_id=challenge_id, resource_type="challenge", user_store_id=seller_store_id,
            user_role="seller", user_id=seller_id,
            objective_repo=seller_service.objective_repo, challenge_repo=seller_service.challenge_repo,
        )
        
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
        seller = await seller_service.user_repo.find_by_id(
            user_id=seller_id,
            projection={"_id": 0, "store_id": 1, "manager_id": 1}
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
    seller = await seller_service.user_repo.find_by_id(
        user_id=seller_id, projection={"_id": 0, "store_id": 1}
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
        seller = await seller_service.user_repo.find_by_id(
            user_id=seller_id,
            projection={"_id": 0, "store_id": 1, "manager_id": 1}
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
    seller = await seller_service.user_repo.find_by_id(
        user_id=seller_id, projection={"_id": 0, "store_id": 1}
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
    seller = await seller_service.user_repo.find_by_id(
        user_id=seller_id,
        projection={"_id": 0, "manager_id": 1, "store_id": 1}
    )
    if not seller:
        raise NotFoundError("Vendeur non trouvé")
    seller_store_id = seller.get("store_id")
    if not seller_store_id:
        raise NotFoundError("Vendeur sans magasin assigné")
    manager_id = seller.get("manager_id")
    objective = await verify_resource_store_access(
            resource_id=objective_id, resource_type="objective", user_store_id=seller_store_id,
            user_role="seller", user_id=seller_id,
            objective_repo=seller_service.objective_repo, challenge_repo=seller_service.challenge_repo,
        )
        
        # CONTROLE D'ACCÈS: Vérifier data_entry_responsible
        if objective.get('data_entry_responsible') != 'seller':
            raise ForbiddenError("Vous n'êtes pas autorisé à mettre à jour cet objectif. Seul le manager peut le faire.")
        
        # CONTROLE D'ACCÈS: Vérifier visible
        if not objective.get('visible', True):
            raise ForbiddenError("Cet objectif n'est pas visible")
        
        # CONTROLE D'ACCÈS: Vérifier type et seller_id/visible_to_sellers
        obj_type = objective.get('type', 'collective')
        if obj_type == 'individual':
            # Individual: seller_id must match
            if objective.get('seller_id') != seller_id:
                raise ForbiddenError("Vous n'êtes pas autorisé à mettre à jour cet objectif individuel")
        else:
            # Collective: check visible_to_sellers
            visible_to = objective.get('visible_to_sellers', [])
            if visible_to and len(visible_to) > 0 and seller_id not in visible_to:
                raise ForbiddenError("Vous n'êtes pas autorisé à mettre à jour cet objectif collectif")
        
        # Get increment value
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
        
        # Recalculate progress_percentage
        progress_percentage = 0
        if target_value > 0:
            progress_percentage = round((new_value / target_value) * 100, 1)
        
        # Recompute status using centralized helper
        new_status = seller_service.compute_status(new_value, target_value, end_date)
        
        actor_name = current_user.get('name') or current_user.get('full_name') or current_user.get('email') or 'Vendeur'

        # Update objective
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
        
        # ✅ MIGRÉ: Utilisation du repository avec sécurité
        objective_repo = seller_service.objective_repo
        # Utiliser update_one de base_repository qui supporte $push
        await objective_repo.update_one(
            {"id": objective_id, "store_id": seller_store_id},
            {
                "$set": update_data,
                "$push": {"progress_history": {"$each": [progress_entry], "$slice": -50}}
            }
        )
        
        # Fetch and return the complete updated objective
        updated_objective = await objective_repo.find_by_id(
            objective_id=objective_id,
            store_id=seller_store_id,
            projection={"_id": 0}
        )
        
        if updated_objective:
            # If objective just became "achieved", add the achievement notification flag
            if new_status == 'achieved':
                # Check if notification has been seen
                has_seen = await seller_service.check_achievement_notification(seller_id, "objective", objective_id)
                updated_objective['has_unseen_achievement'] = not has_seen
                updated_objective['just_achieved'] = True  # Flag to indicate this just happened
            
            return updated_objective
        else:
            result = {
                "success": True,
                "current_value": new_value,
                "progress_percentage": progress_percentage,
                "status": new_status,
                "updated_at": update_data["updated_at"]
            }
            # If objective just became "achieved", add the flag
            if new_status == 'achieved':
                has_seen = await seller_service.check_achievement_notification(seller_id, "objective", objective_id)
                result['has_unseen_achievement'] = not has_seen
                result['just_achieved'] = True
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
    seller = await seller_service.user_repo.find_by_id(
        user_id=seller_id,
        projection={"_id": 0, "manager_id": 1, "store_id": 1}
    )
    if not seller:
        raise NotFoundError("Vendeur non trouvé")
    
    seller_store_id = seller.get('store_id')
    if not seller_store_id:
        raise NotFoundError("Vendeur sans magasin assigné")
    
    manager_id = seller.get('manager_id')  # Still needed for progress calculation
    
    challenge = await verify_resource_store_access(
        resource_id=challenge_id, resource_type="challenge", user_store_id=seller_store_id,
        user_role="seller", user_id=seller_id,
        objective_repo=seller_service.objective_repo, challenge_repo=seller_service.challenge_repo,
    )
    
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

    # ✅ MIGRÉ: Utilisation du repository avec sécurité
    challenge_repo = seller_service.challenge_repo
    # Utiliser update_one de base_repository qui supporte $push
    await challenge_repo.update_one(
        {"id": challenge_id, "store_id": seller_store_id},
        {
            "$set": update_data,
            "$push": {"progress_history": {"$each": [progress_entry], "$slice": -50}}
        }
    )
    
    # Fetch and return the complete updated challenge
    updated_challenge = await challenge_repo.find_by_id(
        challenge_id=challenge_id,
        store_id=seller_store_id,
        projection={"_id": 0}
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
    user = await seller_service.user_repo.find_by_id(user_id=current_user["id"])
    
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
    
    # ✅ REPOSITORY: Get distinct dates with data
    kpi_repo = seller_service.kpi_repo
    dates = await kpi_repo.distinct_dates(query)
    
    all_dates = sorted(set(dates))
    
    # Get locked dates (from API/POS imports - cannot be edited manually)
    locked_query = {**query, "locked": True}
    locked_dates = await kpi_repo.distinct_dates(locked_query)
    
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
    try:
        # Get seller's store_id
        user = await seller_service.user_repo.find_by_id(user_id=current_user["id"])
        
        # Use provided store_id or seller's store_id
        effective_store_id = store_id or (user.get('store_id') if user else None)
        
        if not effective_store_id:
            # No store, return default config (all enabled)
            return {
                "track_ca": True,
                "track_ventes": True,
                "track_clients": True,
                "track_articles": True,
                "track_prospects": True
            }
        
        # ✅ REPOSITORY: Get KPI config for this store (CRITICAL: search by store_id, not manager_id)
        kpi_config_repo = seller_service.kpi_config_repo
        config = await kpi_config_repo.find_by_store(effective_store_id)
        
        if not config:
            # No config found for this store, return default
            return {
                "track_ca": True,
                "track_ventes": True,
                "track_clients": True,
                "track_articles": True,
                "track_prospects": True
            }
        
        # Use seller_track_* if it exists, otherwise fallback to track_* (legacy), otherwise default to True
        # Priority: seller_track_* > track_* (legacy) > True (default)
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
    seller_id = current_user['id']
    
    # ✅ MIGRÉ: Utilisation du repository avec pagination
    kpi_repo = seller_service.kpi_repo
    
    # Si days est spécifié, limiter à ce nombre, sinon utiliser pagination
    size = days if days and days <= 365 else pagination.size
    
    result = await paginate(
        collection=kpi_repo.collection,
        query={"seller_id": seller_id},
        page=pagination.page,
        size=min(size, 365),  # Max 365 jours
        projection={"_id": 0},
        sort=[("date", -1)]
    )
    
    # Log for debugging
    logger.info(f"Fetched {len(result.items)} KPI entries for seller {seller_id} (total: {result.total})")
    if result.items:
        logger.info(f"Date range: {result.items[-1].get('date')} to {result.items[0].get('date')}")
    
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
    
    # ✅ REPOSITORY: Check if there's an uncompleted challenge for today
    daily_challenge_repo = seller_service.daily_challenge_repo
    existing = await daily_challenge_repo.find_by_seller_and_date(seller_id, today)
    
    if existing and not existing.get('completed'):
            return existing
    
    # Check if there's already a completed challenge for today
    # If yes, don't generate a new one - user must wait until tomorrow
    completed_today = await daily_challenge_repo.find_completed_today(seller_id, today)
    
    if completed_today:
            # Return the completed challenge instead of generating a new one
            return completed_today
    
    # Generate new challenge
    # ✅ REPOSITORY: Get seller's diagnostic for personalization
    diagnostic_repo = seller_service.diagnostic_repo
    diagnostic = await diagnostic_repo.find_by_seller(seller_id)
    
    # ✅ REPOSITORY: Pagination avec limite 5 (using repository collection)
    recent_result = await paginate(
            collection=daily_challenge_repo.collection,
            query={"seller_id": seller_id},
            page=1,
            size=5,
            projection={"_id": 0},
            sort=[("date", -1)]
    )
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
    
    # ✅ REPOSITORY: Create challenge using DailyChallengeRepository
    daily_challenge_repo = seller_service.daily_challenge_repo
    await daily_challenge_repo.create_challenge(challenge)
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
    
    # ✅ REPOSITORY: Update challenge using DailyChallengeRepository
    daily_challenge_repo = seller_service.daily_challenge_repo
    update_result = await daily_challenge_repo.update_challenge(
        seller_id=current_user['id'],
        date=datetime.now(timezone.utc).strftime('%Y-%m-%d'),
        update_data={
            "completed": True,
            "challenge_result": result,
            "feedback_comment": feedback,
            "completed_at": datetime.now(timezone.utc).isoformat()
        }
    )
    
    if update_result.modified_count == 0:
        raise NotFoundError("Challenge not found")
    
    return {"success": True, "message": "Challenge complété !"}


# ===== DIAGNOSTIC FOR SELLER =====

@router.get("/diagnostic/me")
async def get_my_diagnostic(
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service),
):
    """Get seller's own DISC diagnostic profile."""
    # ✅ REPOSITORY: Get diagnostic using DiagnosticRepository
    diagnostic_repo = seller_service.diagnostic_repo
    diagnostic = await diagnostic_repo.find_by_seller(current_user['id'])
    
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
    try:
        # ✅ REPOSITORY: Get diagnostic using DiagnosticRepository
        diagnostic_repo = seller_service.diagnostic_repo
        diagnostic = await diagnostic_repo.find_by_seller(current_user['id'])
        
        if not diagnostic:
            # Return default scores instead of 404 (consistent with diagnostic_router)
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
        
        # Return live scores (consistent with diagnostic_router)
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
    
    try:
        seller_id = current_user['id']
        date = kpi_data.get('date', datetime.now(timezone.utc).strftime('%Y-%m-%d'))
        
        # Get seller info for store_id and manager_id
        seller = await seller_service.user_repo.find_by_id(user_id=seller_id)
        if not seller:
            raise NotFoundError("Seller not found")
        
        store_id = seller.get('store_id')
        
        # ✅ REPOSITORY: Vérifier si cette date a des données API verrouillées
        kpi_repo = seller_service.kpi_repo
        locked_entries = await kpi_repo.find_many(
            {
                "store_id": store_id,
                "date": date,
                "$or": [
                    {"locked": True},
                    {"source": "api"}
                ]
            },
            projection={"_id": 0, "locked": 1, "source": 1},
            limit=1
        )
        
        if locked_entries:
            raise HTTPException(
                status_code=403, 
                detail="🔒 Cette date est verrouillée. Les données proviennent de l'API/ERP et ne peuvent pas être modifiées manuellement."
            )
        
        # ✅ REPOSITORY: Check if entry exists for this date
        existing = await kpi_repo.find_by_seller_and_date(seller_id, date)
        
        # 🔒 Vérifier si l'entrée existante est verrouillée
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
            "source": "manual",  # Marquer comme saisie manuelle
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        if existing:
            # ✅ REPOSITORY: Update existing entry
            await kpi_repo.update_one(
                {"id": existing.get('id')},
                {"$set": entry_data}
            )
            entry_data['id'] = existing.get('id')
        else:
            # ✅ REPOSITORY: Create new entry
            entry_data['id'] = str(uuid4())
            entry_data['created_at'] = datetime.now(timezone.utc).isoformat()
            await kpi_repo.insert_one(entry_data)
        
        if '_id' in entry_data:
            del entry_data['_id']
        
        return entry_data
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error saving KPI entry: {str(e)}")


# ===== DAILY CHALLENGE STATS =====

@router.get("/daily-challenge/stats")
async def get_daily_challenge_stats(
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service),
):
    """Get statistics for seller's daily challenges."""
    try:
        seller_id = current_user['id']
        
        # ✅ REPOSITORY: Pagination avec limite par défaut (pour stats, on peut limiter)
        daily_challenge_repo = seller_service.daily_challenge_repo
        challenges_result = await paginate(
            collection=daily_challenge_repo.collection,
            query={"seller_id": seller_id},
            page=1,
            size=50,  # Limite par défaut pour éviter chargement massif
            projection={"_id": 0},
            sort=[("date", -1)]
        )
        challenges = challenges_result.items
        
        # Calculate stats
        total = challenges_result.total  # Utiliser total du résultat paginé
        completed = len([c for c in challenges if c.get('completed')])
        
        # Stats by competence
        by_competence = {}
        for c in challenges:
            comp = c.get('competence', 'unknown')
            if comp not in by_competence:
                by_competence[comp] = {'total': 0, 'completed': 0}
            by_competence[comp]['total'] += 1
            if c.get('completed'):
                by_competence[comp]['completed'] += 1
        
        # Current streak
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
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/daily-challenge/history")
async def get_daily_challenge_history(
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service),
):
    """Get all past daily challenges for the seller."""
    try:
        # ✅ REPOSITORY: Pagination avec limite par défaut
        daily_challenge_repo = seller_service.daily_challenge_repo
        challenges_result = await paginate(
            collection=daily_challenge_repo.collection,
            query={"seller_id": current_user['id']},
            page=1,
            size=50,  # Limite par défaut
            projection={"_id": 0},
            sort=[("date", -1)]
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
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ===== BILAN INDIVIDUEL =====

@router.get("/bilan-individuel/all")
async def get_all_bilans_individuels(
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service),
):
    """Get all individual performance reports (bilans) for seller."""
    try:
        # ✅ REPOSITORY: Pagination avec limite par défaut
        seller_bilan_repo = seller_service.seller_bilan_repo
        bilans_result = await paginate(
            collection=seller_bilan_repo.collection,
            query={"seller_id": current_user['id']},
            page=1,
            size=50,  # Limite par défaut
            projection={"_id": 0},
            sort=[("created_at", -1)]
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
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/bilan-individuel")
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
    
    try:
        seller_id = current_user['id']
        
        # Get KPIs for the period
        query = {"seller_id": seller_id}
        if start_date and end_date:
            query["date"] = {"$gte": start_date, "$lte": end_date}
        
        # ✅ MIGRÉ: Utilisation d'agrégation MongoDB pour calculs optimisés
        kpi_repo = seller_service.kpi_repo
        
        # Use aggregation for efficient summary calculation
        aggregate_pipeline = [
            {"$match": query},
            {"$group": {
                "_id": None,
                "total_ca": {"$sum": {"$ifNull": ["$ca_journalier", {"$ifNull": ["$seller_ca", 0]}]}},
                "total_ventes": {"$sum": {"$ifNull": ["$nb_ventes", 0]}},
                "total_clients": {"$sum": {"$ifNull": ["$nb_clients", 0]}}
            }}
        ]
        
        aggregate_result = await kpi_repo.aggregate(aggregate_pipeline, max_results=1)
        summary = aggregate_result[0] if aggregate_result else {}
        
        total_ca = summary.get('total_ca', 0) or 0
        total_ventes = summary.get('total_ventes', 0) or 0
        total_clients = summary.get('total_clients', 0) or 0
        
        panier_moyen = total_ca / total_ventes if total_ventes > 0 else 0
        
        # Get limited KPIs for AI context (max 50)
        kpis = await paginate(
            collection=kpi_repo.collection,
            query=query,
            page=1,
            size=50,  # Limite pour contexte AI
            projection={"_id": 0},
            sort=[("date", -1)]
        )
        kpis_list = kpis.items
        
        # Try to generate AI bilan with structured format
        ai_service = AIService()
        seller_data = await seller_service.user_repo.find_by_id(
            user_id=seller_id,
            include_password=False
        )
        seller_name = seller_data.get('name', 'Vendeur') if seller_data else 'Vendeur'
        
        # Default values
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
        
        # Build periode string for frontend compatibility
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
        
        # ✅ REPOSITORY: Create bilan using SellerBilanRepository
        seller_bilan_repo = seller_service.seller_bilan_repo
        await seller_bilan_repo.create_bilan(bilan)
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
    try:
        # ✅ REPOSITORY: Get diagnostic using DiagnosticRepository
        diagnostic_repo = seller_service.diagnostic_repo
        diagnostic = await diagnostic_repo.find_by_seller(current_user['id'])
        
        if not diagnostic:
            # Return empty response instead of 404 to avoid console errors
            return {
                "status": "not_started",
                "has_diagnostic": False,
                "message": "Diagnostic DISC non encore complété"
            }
        
        # Return with status 'completed' for frontend compatibility
        return {
            "status": "completed",
            "has_diagnostic": True,
            "diagnostic": diagnostic  # Include the full diagnostic data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@diagnostic_router.get("/me/live-scores")
async def get_diagnostic_live_scores(
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service),
):
    """Get seller's live competence scores (updated after debriefs)."""
    try:
        # ✅ REPOSITORY: Get diagnostic using DiagnosticRepository
        diagnostic_repo = seller_service.diagnostic_repo
        diagnostic = await diagnostic_repo.find_by_seller(current_user['id'])
        
        if not diagnostic:
            # Return default scores instead of 404
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
        
        # Return live scores
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
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
    try:
        user_role = current_user.get('role')
        user_id = current_user.get('id')
        
        # Verify user is manager or gérant
        if user_role not in ['manager', 'gerant', 'gérant']:
            raise ForbiddenError("Accès réservé aux managers et gérants")
        
        # Verify seller exists
        seller = await seller_service.user_repo.find_by_id(user_id=seller_id)
        if seller and seller.get("role") != "seller":
            seller = None
        if not seller:
            return None
        
        seller_store_id = seller.get('store_id')
        
        # Check access rights
        has_access = False
        
        if user_role == 'manager':
            # Manager can only see sellers from their own store
            has_access = (seller_store_id == current_user.get('store_id'))
        elif user_role in ['gerant', 'gérant']:
            # Gérant can see sellers from any store they own
            store_repo = seller_service.store_repo
            store = await store_repo.find_by_id(
                store_id=seller_store_id,
                gerant_id=user_id
            )
            # Additional check for active status
            if store and not store.get("active"):
                store = None
            # Convert to dict format for compatibility
            if store:
                store = {
                "id": seller_store_id,
                "gerant_id": user_id,
                "active": True
            })
            has_access = store is not None
        
        if not has_access:
            raise ForbiddenError("Accès non autorisé à ce vendeur")
        
        # ✅ REPOSITORY: Get the diagnostic using DiagnosticRepository
        diagnostic_repo = seller_service.diagnostic_repo
        diagnostic = await diagnostic_repo.find_by_seller(seller_id)
        
        return diagnostic  # Can be None if not completed
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ===== STORE INFO FOR SELLER =====

@router.get("/store-info")
async def get_seller_store_info(
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service),
):
    """Get basic store info for the seller's store."""
    try:
        seller = await seller_service.user_repo.find_by_id(
            user_id=current_user['id'],
            projection={"_id": 0, "store_id": 1}
        )
        
        if not seller or not seller.get('store_id'):
            return {"name": "Magasin", "id": None}
        
        store_repo = seller_service.store_repo
        store = await store_repo.find_by_id(
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
    
    try:
        seller_id = current_user['id']
        # Ensure responses is a dict (convert from list if needed)
        if isinstance(diagnostic_data.responses, list):
            # Convert list format to dict format
            responses = {}
            for item in diagnostic_data.responses:
                if isinstance(item, dict) and 'question_id' in item:
                    responses[str(item['question_id'])] = str(item.get('answer', ''))
        else:
            responses = diagnostic_data.responses
        
        # Convert string responses to int for calculations (questions expect option indices as integers)
        if isinstance(responses, dict):
            normalized_responses = {}
            for key, value in responses.items():
                try:
                    # Try to convert to int (for option indices: 0, 1, 2, 3)
                    if isinstance(value, str) and value.isdigit():
                        normalized_responses[key] = int(value)
                    elif isinstance(value, (int, float)):
                        normalized_responses[key] = int(value)
                    else:
                        normalized_responses[key] = value
                except (ValueError, TypeError):
                    normalized_responses[key] = value
            responses = normalized_responses
        
        # ✅ REPOSITORY: Delete existing diagnostic if any (allow update)
        diagnostic_repo = seller_service.diagnostic_repo
        await diagnostic_repo.delete_by_seller(seller_id)
        
        # Calculate competence scores from questionnaire
        competence_scores = calculate_competence_scores_from_questionnaire(responses)
        
        # Calculate DISC profile from questions 16-23
        disc_responses = {k: v for k, v in responses.items() if k.isdigit() and int(k) >= 16}
        disc_profile = calculate_disc_profile(disc_responses)
        
        # AI Analysis for style, level, motivation
        ai_service = AIService()
        ai_analysis = {
            "style": "Convivial",
            "level": "Challenger",
            "motivation": "Relation",
            "summary": "Profil en cours d'analyse."
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
        
        if ai_service.available:
            try:
                # Format responses for AI
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
                    # Parse JSON
                    clean = response.strip()
                    if "```json" in clean:
                        clean = clean.split("```json")[1].split("```")[0]
                    elif "```" in clean:
                        clean = clean.split("```")[1].split("```")[0]
                    
                    try:
                        ai_analysis = json.loads(clean.strip())
                    except:
                        pass
                        
            except Exception as e:
                logger.error("AI diagnostic error: %s", e, exc_info=True)
        
        # Get strengths and axes_de_developpement from request if provided (from /ai/diagnostic)
        strengths = diagnostic_data.dict().get('strengths') or ai_analysis.get('strengths', [])
        axes_de_developpement = diagnostic_data.dict().get('axes_de_developpement') or ai_analysis.get('axes_de_developpement', [])
        
        # Generate ai_profile_summary from strengths and axes if available
        ai_summary = ai_analysis.get('summary', '')
        # Remove default "Profil en cours d'analyse" message if it's still the default
        if ai_summary == "Profil en cours d'analyse.":
            ai_summary = ''
        if not ai_summary and (strengths or axes_de_developpement):
            summary_parts = []
            if strengths:
                summary_parts.append("💪 Tes forces :")
                for strength in strengths[:3]:  # Max 3 strengths
                    summary_parts.append(f"• {strength}")
            if axes_de_developpement:
                summary_parts.append("\n🎯 Axes de développement :")
                for axe in axes_de_developpement[:3]:  # Max 3 axes
                    summary_parts.append(f"• {axe}")
            if summary_parts:
                ai_summary = "\n".join(summary_parts)
        
        # Use provided style/level/motivation from request if available, otherwise use AI analysis
        final_style = map_style(diagnostic_data.dict().get('style') or ai_analysis.get('style', 'Convivial'))
        final_level = map_level(diagnostic_data.dict().get('level') or ai_analysis.get('level', 'Challenger'))
        final_motivation = map_motivation(diagnostic_data.dict().get('motivation') or ai_analysis.get('motivation', 'Relation'))
        
        # Create diagnostic document with mapped values
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
        
        # Validate diagnostic before saving
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
            logger.warning(f"Diagnostic validation warnings for seller {seller_id}: {validation_errors}")
            # Log the responses for debugging
            response_keys = list(responses.keys())
            response_types = [type(v).__name__ for v in list(responses.values())[:10]]
            logger.debug(f"Responses received: {len(response_keys)} questions, sample types: {response_types}")
        
        # ✅ REPOSITORY: Create diagnostic using DiagnosticRepository
        diagnostic_repo = seller_service.diagnostic_repo
        await diagnostic_repo.create_diagnostic(diagnostic)
        if '_id' in diagnostic:
            del diagnostic['_id']
        
        return diagnostic
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating diagnostic: {str(e)}")

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
    try:
        # ✅ REPOSITORY: Delete diagnostic using DiagnosticRepository
        diagnostic_repo = seller_service.diagnostic_repo
        deleted_count = await diagnostic_repo.delete_by_seller(current_user['id'])
        return {"success": True, "deleted_count": deleted_count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
    
    try:
        seller_id = current_user['id']
        today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
        
        # Get force_competence from data if provided
        force_competence = None
        if data:
            force_competence = data.get('force_competence') or data.get('competence')
        
        # ✅ REPOSITORY: Delete current uncompleted challenge for today
        daily_challenge_repo = seller_service.daily_challenge_repo
        await daily_challenge_repo.delete_many({
            "seller_id": seller_id,
            "date": today,
            "completed": False
        })
        
        # ✅ REPOSITORY: Get seller's diagnostic for personalization
        diagnostic_repo = seller_service.diagnostic_repo
        diagnostic = await diagnostic_repo.find_by_seller(seller_id)
        
        # ✅ REPOSITORY: Pagination avec limite 5
        recent_result = await paginate(
            collection=daily_challenge_repo.collection,
            query={"seller_id": seller_id},
            page=1,
            size=5,
            projection={"_id": 0},
            sort=[("date", -1)]
        )
        recent = recent_result.items
        recent_competences = [ch.get('competence') for ch in recent if ch.get('competence')]
        
        # Select competence
        if force_competence and force_competence in ['accueil', 'decouverte', 'argumentation', 'closing', 'fidelisation']:
            selected_competence = force_competence
        elif not diagnostic:
            competences = ['accueil', 'decouverte', 'argumentation', 'closing', 'fidelisation']
            # Random but avoid last used
            import random
            available = [c for c in competences if c not in recent_competences[:2]]
            selected_competence = random.choice(available) if available else random.choice(competences)
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
        
        # ✅ REPOSITORY: Create challenge using DailyChallengeRepository
        daily_challenge_repo = seller_service.daily_challenge_repo
        await daily_challenge_repo.create_challenge(challenge)
        if '_id' in challenge:
            del challenge['_id']
        
        return challenge
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error refreshing challenge: {str(e)}")


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
    try:
        seller_id = current_user['id']
        
        # ✅ REPOSITORY: Pagination avec limite par défaut
        interview_note_repo = seller_service.interview_note_repo
        notes_result = await paginate(
            collection=interview_note_repo.collection,
            query={"seller_id": seller_id},
            page=1,
            size=50,  # Limite par défaut pour éviter chargement massif
            projection={"_id": 0},
            sort=[("date", -1)]
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
    except Exception as e:
        logger.error(f"Error fetching interview notes: {e}")
        raise HTTPException(status_code=500, detail=f"Erreur lors de la récupération des notes: {str(e)}")


@router.get("/interview-notes/{date}")
async def get_interview_note_by_date(
    date: str,
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service),
):
    """
    Récupère la note d'entretien pour une date spécifique.
    """
    try:
        seller_id = current_user['id']
        
        # ✅ REPOSITORY: Get interview note using InterviewNoteRepository
        interview_note_repo = seller_service.interview_note_repo
        note = await interview_note_repo.find_by_seller_and_date(seller_id, date)
        
        if not note:
            return {"note": None}
        
        return {"note": note}
    except Exception as e:
        logger.error(f"Error fetching interview note for date {date}: {e}")
        raise HTTPException(status_code=500, detail=f"Erreur lors de la récupération de la note: {str(e)}")


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
    try:
        seller_id = current_user['id']
        date = note_data.get('date')
        content = note_data.get('content', '').strip()
        
        if not date:
            raise ValidationError("La date est requise")
        
        # Valider le format de date
        try:
            datetime.strptime(date, "%Y-%m-%d")
        except ValueError:
            raise ValidationError("Format de date invalide. Utilisez YYYY-MM-DD")
        
        now = datetime.now(timezone.utc)
        
        # ✅ REPOSITORY: Vérifier si une note existe déjà pour cette date
        interview_note_repo = seller_service.interview_note_repo
        existing_note = await interview_note_repo.find_by_seller_and_date(seller_id, date)
        
        if existing_note:
            # ✅ REPOSITORY: Mettre à jour la note existante
            await interview_note_repo.update_note_by_date(
                seller_id=seller_id,
                date=date,
                update_data={
                    "content": content,
                    "updated_at": now.isoformat()
                }
            )
            note_id = existing_note.get('id')
            message = "Note mise à jour avec succès"
        else:
            # ✅ REPOSITORY: Créer une nouvelle note
            note = {
                "id": str(uuid.uuid4()),
                "seller_id": seller_id,
                "date": date,
                "content": content,
                "created_at": now.isoformat(),
                "updated_at": now.isoformat()
            }
            note_id = await interview_note_repo.create_note(note)
            message = "Note créée avec succès"
        
        return {
            "success": True,
            "message": message,
            "note_id": note_id,
            "date": date
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating/updating interview note: {e}")
        raise HTTPException(status_code=500, detail=f"Erreur lors de la sauvegarde de la note: {str(e)}")


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
    try:
        seller_id = current_user['id']
        content = note_data.get('content', '').strip()
        
        # ✅ REPOSITORY: Vérifier que la note appartient au vendeur et mettre à jour
        interview_note_repo = seller_service.interview_note_repo
        note = await interview_note_repo.find_one(
            {"id": note_id, "seller_id": seller_id},
            {"_id": 0}
        )
        
        if not note:
            raise NotFoundError("Note non trouvée")
        
        # ✅ REPOSITORY: Mettre à jour
        await interview_note_repo.update_one(
            {"id": note_id, "seller_id": seller_id},
            {"$set": {
                "content": content,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        return {
            "success": True,
            "message": "Note mise à jour avec succès"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating interview note: {e}")
        raise HTTPException(status_code=500, detail=f"Erreur lors de la mise à jour: {str(e)}")


@router.delete("/interview-notes/{note_id}")
async def delete_interview_note(
    note_id: str,
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service),
):
    """
    Supprime une note d'entretien.
    """
    try:
        seller_id = current_user['id']
        
        # ✅ REPOSITORY: Vérifier que la note appartient au vendeur et supprimer
        interview_note_repo = seller_service.interview_note_repo
        deleted = await interview_note_repo.delete_note_by_id(note_id, seller_id)
        
        if not deleted:
            raise NotFoundError("Note non trouvée")
        
        return {
            "success": True,
            "message": "Note supprimée avec succès"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting interview note: {e}")
        raise HTTPException(status_code=500, detail=f"Erreur lors de la suppression: {str(e)}")


@router.delete("/interview-notes/date/{date}")
async def delete_interview_note_by_date(
    date: str,
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service),
):
    """
    Supprime une note d'entretien par date.
    """
    try:
        seller_id = current_user['id']
        
        # Valider le format de date
        try:
            datetime.strptime(date, "%Y-%m-%d")
        except ValueError:
            raise ValidationError("Format de date invalide. Utilisez YYYY-MM-DD")
        
        # Supprimer
        # ✅ REPOSITORY: Supprimer la note par date
        interview_note_repo = seller_service.interview_note_repo
        deleted = await interview_note_repo.delete_note_by_date(seller_id, date)
        
        if not deleted:
            raise NotFoundError("Note non trouvée pour cette date")
        
        return {
            "success": True,
            "message": "Note supprimée avec succès"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting interview note by date: {e}")
        raise HTTPException(status_code=500, detail=f"Erreur lors de la suppression: {str(e)}")
