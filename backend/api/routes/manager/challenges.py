"""
Manager - Challenges: défis d'équipe (CRUD, progression, mark-achievement-seen).
"""
import logging
import time
from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, Query

from core.constants import ERR_STORE_ID_REQUIS, QUERY_STORE_ID_REQUIS_GERANT
from core.exceptions import AppException, NotFoundError, ValidationError, ForbiddenError
from core.security import verify_resource_store_access
from api.routes.manager.dependencies import get_store_context
from api.dependencies import (
    get_manager_service,
    get_manager_achievement_service,
    get_seller_service,
    get_notification_service,
)
from services.manager_service import ManagerService
from services.manager import ManagerAchievementService
from services.seller_service import SellerService
from services.notification_service import NotificationService

router = APIRouter(prefix="")
logger = logging.getLogger(__name__)


@router.get("/challenges/active")
async def get_active_challenges(
    store_id: Optional[str] = Query(None, description="Store ID (requis pour gérant)"),
    context: dict = Depends(get_store_context),
    achievement_service: ManagerAchievementService = Depends(
        get_manager_achievement_service
    ),
):
    """Get active challenges for the store's team."""
    resolved_store_id = context.get("resolved_store_id")
    manager_id = context.get("id")
    return await achievement_service.get_active_challenges(
        manager_id=manager_id,
        store_id=resolved_store_id,
    )


@router.post("/challenges/{challenge_id}/mark-achievement-seen")
async def mark_challenge_achievement_seen_manager(
    challenge_id: str,
    context: dict = Depends(get_store_context),
    seller_service: SellerService = Depends(get_seller_service),
    manager_service: ManagerService = Depends(get_manager_service),
):
    """Mark a challenge achievement notification as seen by the manager/gérant."""
    try:
        resolved_store_id = context.get("resolved_store_id")
        if not resolved_store_id:
            raise ValidationError(ERR_STORE_ID_REQUIS)
        await verify_resource_store_access(
            resource_id=challenge_id,
            resource_type="challenge",
            user_store_id=resolved_store_id,
            manager_service=manager_service,
        )
        manager_id = context.get("id")
        await seller_service.mark_achievement_as_seen(
            manager_id, "challenge", challenge_id
        )
        return {"success": True, "message": "Notification marquée comme vue"}
    except AppException:
        raise


@router.get("/challenges")
async def get_all_challenges(
    store_id: Optional[str] = Query(None, description="Store ID (requis pour gérant)"),
    context: dict = Depends(get_store_context),
    seller_service: SellerService = Depends(get_seller_service),
    achievement_service: ManagerAchievementService = Depends(
        get_manager_achievement_service
    ),
):
    """
    Get ALL challenges for the store (active + inactive).
    Used by the manager settings modal.
    """
    from utils.db_counter import init_counter, get_db_ops_count, get_request_id

    start_time = time.time()
    init_counter()
    try:
        resolved_store_id = context.get("resolved_store_id")
        manager_id = context.get("id")
        challenges = await manager_service.get_challenges_by_store(
            resolved_store_id, limit=100
        )
        challenges = await seller_service.calculate_challenges_progress_batch(
            challenges, manager_id, resolved_store_id
        )
        enriched_challenges = []
        for challenge in challenges:
            if not challenge.get("challenge_type") and challenge.get("kpi_type"):
                challenge["challenge_type"] = "kpi_standard"
                kpi_type = challenge.get("kpi_type", "")
                if "ca" in kpi_type.lower() or "journalier" in kpi_type.lower():
                    challenge["kpi_name"] = "ca"
                elif "vente" in kpi_type.lower():
                    challenge["kpi_name"] = "ventes"
                elif "article" in kpi_type.lower():
                    challenge["kpi_name"] = "articles"
                else:
                    challenge["kpi_name"] = "ca"
            elif challenge.get("challenge_type") == "kpi_standard" and not challenge.get("kpi_name"):
                challenge["kpi_name"] = "ca"
            if "challenge_type" not in challenge:
                challenge["challenge_type"] = None
            if "unit" not in challenge:
                challenge["unit"] = "€"
            if "data_entry_responsible" not in challenge:
                challenge["data_entry_responsible"] = "manager"
            if "visible" not in challenge:
                challenge["visible"] = True
            if "visible_to_sellers" not in challenge:
                challenge["visible_to_sellers"] = []
            if challenge.get("target_value") and challenge.get("target_value") > 0:
                current_value = challenge.get("current_value", 0)
                if challenge.get("challenge_type") == "kpi_standard" and challenge.get("kpi_name"):
                    kpi_name = challenge.get("kpi_name")
                    if kpi_name == "ca":
                        current_value = challenge.get("progress_ca", 0)
                    elif kpi_name == "ventes":
                        current_value = challenge.get("progress_ventes", 0)
                    elif kpi_name == "articles":
                        current_value = challenge.get("progress_articles", 0)
                    elif kpi_name == "panier_moyen":
                        current_value = challenge.get("progress_panier_moyen", 0)
                    elif kpi_name == "indice_vente":
                        current_value = challenge.get("progress_indice_vente", 0)
                challenge["current_value"] = current_value
                challenge["progress_percentage"] = round(
                    (current_value / challenge["target_value"]) * 100, 1
                )
            else:
                challenge["progress_percentage"] = 0
            for key in ["progress_ca", "progress_ventes", "progress_articles", "progress_panier_moyen", "progress_indice_vente"]:
                if key not in challenge:
                    challenge[key] = 0
            enriched_challenges.append(challenge)
        duration_ms = (time.time() - start_time) * 1000
        db_ops_count = get_db_ops_count()
        request_id = get_request_id()
        log_extra = {
            "endpoint": "/api/manager/challenges",
            "challenges_count": len(enriched_challenges),
            "duration_ms": round(duration_ms, 2),
            "store_id": resolved_store_id,
            "manager_id": manager_id,
        }
        if db_ops_count > 0:
            log_extra["db_ops_count"] = db_ops_count
            if request_id:
                log_extra["request_id"] = request_id
        logger.info("get_all_challenges completed", extra=log_extra)
        return enriched_challenges
    except Exception:
        raise


@router.post("/challenges")
async def create_challenge(
    challenge_data: dict,
    store_id: Optional[str] = Query(None, description="Store ID (requis pour gérant)"),
    context: dict = Depends(get_store_context),
    achievement_service: ManagerAchievementService = Depends(
        get_manager_achievement_service
    ),
):
    """Create a new team challenge."""
    try:
        resolved_store_id = context.get("resolved_store_id")
        manager_id = context.get("id")
        challenge = {
            "id": str(uuid4()),
            "store_id": resolved_store_id,
            "manager_id": manager_id,
            "title": challenge_data.get("title", ""),
            "description": challenge_data.get("description", ""),
            "target_value": challenge_data.get("target_value", 0),
            "current_value": 0,
            "reward": challenge_data.get("reward", ""),
            "kpi_type": challenge_data.get("kpi_type", "ca_journalier"),
            "period_start": challenge_data.get("period_start") or challenge_data.get("start_date"),
            "period_end": challenge_data.get("period_end") or challenge_data.get("end_date"),
            "start_date": challenge_data.get("start_date") or challenge_data.get("period_start"),
            "end_date": challenge_data.get("end_date") or challenge_data.get("period_end"),
            "status": "active",
            "participants": challenge_data.get("participants", []),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "type": challenge_data.get("type", "collective"),
            "seller_id": challenge_data.get("seller_id"),
            "visible": challenge_data.get("visible", True),
            "visible_to_sellers": challenge_data.get("visible_to_sellers")
            if challenge_data.get("visible", True)
            else None,
            "challenge_type": challenge_data.get("challenge_type", "kpi_standard"),
            "kpi_name": challenge_data.get("kpi_name"),
            "product_name": challenge_data.get("product_name"),
            "custom_description": challenge_data.get("custom_description"),
            "data_entry_responsible": challenge_data.get("data_entry_responsible", "manager"),
            "unit": challenge_data.get("unit"),
        }
        challenge_id = await achievement_service.create_challenge(
            challenge, resolved_store_id, manager_id
        )
        challenge.pop("_id", None)
        return challenge
    except Exception:
        raise


@router.put("/challenges/{challenge_id}")
async def update_challenge(
    challenge_id: str,
    challenge_data: dict,
    store_id: Optional[str] = Query(None, description="Store ID (requis pour gérant)"),
    context: dict = Depends(get_store_context),
    manager_service: ManagerService = Depends(get_manager_service),
    achievement_service: ManagerAchievementService = Depends(
        get_manager_achievement_service
    ),
):
    """Update an existing challenge."""
    try:
        resolved_store_id = context.get("resolved_store_id")
        if not resolved_store_id:
            raise ValidationError(ERR_STORE_ID_REQUIS)
        existing = await verify_resource_store_access(
            resource_id=challenge_id,
            resource_type="challenge",
            user_store_id=resolved_store_id,
            manager_service=manager_service,
        )
        update_fields = {
            "title": challenge_data.get("title", existing.get("title")),
            "description": challenge_data.get("description", existing.get("description")),
            "target_value": challenge_data.get("target_value", existing.get("target_value")),
            "reward": challenge_data.get("reward", existing.get("reward")),
            "kpi_type": challenge_data.get("kpi_type", existing.get("kpi_type")),
            "period_start": challenge_data.get("period_start")
            or challenge_data.get("start_date")
            or existing.get("period_start"),
            "period_end": challenge_data.get("period_end")
            or challenge_data.get("end_date")
            or existing.get("period_end"),
            "start_date": challenge_data.get("start_date")
            or challenge_data.get("period_start")
            or existing.get("start_date"),
            "end_date": challenge_data.get("end_date")
            or challenge_data.get("period_end")
            or existing.get("period_end"),
            "status": challenge_data.get("status", existing.get("status")),
            "participants": challenge_data.get("participants", existing.get("participants", [])),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "type": challenge_data.get("type") if "type" in challenge_data else existing.get("type"),
            "seller_id": challenge_data.get("seller_id") if "seller_id" in challenge_data else existing.get("seller_id"),
            "visible": challenge_data.get("visible") if "visible" in challenge_data else existing.get("visible", True),
            "visible_to_sellers": challenge_data.get("visible_to_sellers") if "visible_to_sellers" in challenge_data else existing.get("visible_to_sellers"),
            "challenge_type": challenge_data.get("challenge_type") if "challenge_type" in challenge_data else existing.get("challenge_type"),
            "kpi_name": challenge_data.get("kpi_name") if "kpi_name" in challenge_data else existing.get("kpi_name"),
            "product_name": challenge_data.get("product_name") if "product_name" in challenge_data else existing.get("product_name"),
            "custom_description": challenge_data.get("custom_description") if "custom_description" in challenge_data else existing.get("custom_description"),
            "data_entry_responsible": challenge_data.get("data_entry_responsible") if "data_entry_responsible" in challenge_data else existing.get("data_entry_responsible"),
            "unit": challenge_data.get("unit") if "unit" in challenge_data else existing.get("unit"),
        }
        await achievement_service.update_challenge(
            challenge_id, update_fields, store_id=resolved_store_id
        )
        return {"success": True, "message": "Challenge mis à jour", "id": challenge_id}
    except AppException:
        raise


@router.delete("/challenges/{challenge_id}")
async def delete_challenge(
    challenge_id: str,
    store_id: Optional[str] = Query(None, description="Store ID (requis pour gérant)"),
    context: dict = Depends(get_store_context),
    manager_service: ManagerService = Depends(get_manager_service),
    achievement_service: ManagerAchievementService = Depends(
        get_manager_achievement_service
    ),
):
    """Delete a challenge."""
    try:
        resolved_store_id = context.get("resolved_store_id")
        if not resolved_store_id:
            raise ValidationError(ERR_STORE_ID_REQUIS)
        await verify_resource_store_access(
            resource_id=challenge_id,
            resource_type="challenge",
            user_store_id=resolved_store_id,
            manager_service=manager_service,
        )
        ok = await achievement_service.delete_challenge(
            challenge_id, store_id=resolved_store_id
        )
        if not ok:
            raise NotFoundError("Challenge non trouvé")
        return {"success": True, "message": "Challenge supprimé"}
    except AppException:
        raise


@router.post("/challenges/{challenge_id}")
@router.post("/challenges/{challenge_id}/progress")
async def update_challenge_progress(
    challenge_id: str,
    progress_data: dict,
    store_id: Optional[str] = Query(None, description="Store ID (requis pour gérant)"),
    context: dict = Depends(get_store_context),
    manager_service: ManagerService = Depends(get_manager_service),
    achievement_service: ManagerAchievementService = Depends(
        get_manager_achievement_service
    ),
    seller_service: SellerService = Depends(get_seller_service),
    notification_service: NotificationService = Depends(get_notification_service),
):
    """
    Update progress on a challenge.
    Payload: {"value": number, "date": "YYYY-MM-DD" (optional), "comment": string (optional)}
    """
    try:
        resolved_store_id = context.get("resolved_store_id")
        manager_id = context.get("id")
        user_role = context.get("role")
        actor_name = (
            context.get("name") or context.get("full_name") or context.get("email") or "Manager"
        )
        if user_role in ["gerant", "gérant"] and not resolved_store_id:
            raise ValidationError(
                "Le paramètre store_id est requis pour mettre à jour la progression d'un challenge"
            )
        if not resolved_store_id:
            raise ValidationError("Impossible de déterminer le magasin")
        existing = await verify_resource_store_access(
            resource_id=challenge_id,
            resource_type="challenge",
            user_store_id=resolved_store_id,
            manager_service=manager_service,
        )
        if not existing:
            raise NotFoundError(
                f"Challenge non trouvé dans le magasin spécifié (store_id: {resolved_store_id})"
            )
        if user_role not in ["manager", "gerant", "gérant"]:
            raise ForbiddenError(
                "Seuls les managers peuvent mettre à jour la progression via cette route"
            )
        increment_value = progress_data.get("value")
        if increment_value is None:
            increment_value = progress_data.get("current_value", 0)
        try:
            increment_value = float(increment_value)
        except Exception:
            increment_value = 0.0
        mode = (progress_data.get("mode") or "add").lower()
        previous_total = float(existing.get("current_value", 0) or 0)
        new_value = increment_value if mode == "set" else previous_total + increment_value
        target_value = existing.get("target_value", 0)
        end_date = existing.get("end_date")
        progress_percentage = (
            round((new_value / target_value) * 100, 1) if target_value > 0 else 0
        )
        new_status = seller_service.compute_status(new_value, target_value, end_date)
        update_data = {
            "current_value": new_value,
            "progress_percentage": progress_percentage,
            "status": new_status,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "updated_by": manager_id,
            "updated_by_name": actor_name,
        }
        if new_status == "achieved":
            update_data["completed_at"] = datetime.now(timezone.utc).isoformat()
        progress_entry = {
            "value": increment_value,
            "date": update_data["updated_at"],
            "updated_by": manager_id,
            "updated_by_name": actor_name,
            "role": user_role,
            "total_after": new_value,
        }
        await achievement_service.update_challenge_with_progress_history(
            challenge_id, update_data, progress_entry, resolved_store_id, manager_id
        )
        updated_challenge = await achievement_service.get_challenge_by_id_and_store(
            challenge_id, resolved_store_id
        )
        if updated_challenge:
            old_status = existing.get("status", "active")
            if new_status == "achieved" and old_status != "achieved":
                updated_challenge["just_achieved"] = True
                await notification_service.add_achievement_notification_flag(
                    [updated_challenge], manager_id, "challenge"
                )
            return updated_challenge
        return {
            "success": True,
            "current_value": new_value,
            "progress_percentage": progress_percentage,
            "status": new_status,
            "updated_at": update_data["updated_at"],
        }
    except AppException:
        raise
