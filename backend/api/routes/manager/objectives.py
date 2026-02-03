"""
Manager - Objectives: objectifs d'équipe (CRUD, progression, mark-achievement-seen).
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


@router.get("/objectives/active")
async def get_active_objectives(
    store_id: Optional[str] = Query(None, description=QUERY_STORE_ID_REQUIS_GERANT),
    context: dict = Depends(get_store_context),
    achievement_service: ManagerAchievementService = Depends(
        get_manager_achievement_service
    ),
):
    """Get active objectives for the store's team."""
    resolved_store_id = context.get("resolved_store_id")
    manager_id = context.get("id")
    return await achievement_service.get_active_objectives(
        manager_id=manager_id,
        store_id=resolved_store_id,
    )


@router.get("/objectives")
async def get_all_objectives(
    store_id: Optional[str] = Query(None, description=QUERY_STORE_ID_REQUIS_GERANT),
    context: dict = Depends(get_store_context),
    seller_service: SellerService = Depends(get_seller_service),
    achievement_service: ManagerAchievementService = Depends(
        get_manager_achievement_service
    ),
):
    """
    Get ALL objectives for the store (active + inactive).
    Used by the manager settings modal.
    """
    from utils.db_counter import init_counter, get_db_ops_count, get_request_id

    start_time = time.time()
    init_counter()
    resolved_store_id = context.get("resolved_store_id")
    manager_id = context.get("id")
    objectives = await achievement_service.get_objectives_by_store(
        resolved_store_id, limit=100
    )
    objectives = await seller_service.calculate_objectives_progress_batch(
        objectives, manager_id, resolved_store_id
    )
    for objective in objectives:
        target_value = objective.get("target_value", 0)
        if target_value > 0:
            current_value = 0
            prefer_manual = (
                str(objective.get("data_entry_responsible", "")).lower()
                in ["manager", "seller"]
            )
            obj_type = objective.get("objective_type")
            if obj_type == "kpi_standard":
                if prefer_manual and objective.get("current_value") is not None:
                    current_value = float(objective.get("current_value") or 0)
                else:
                    kpi_name = objective.get("kpi_name", "ca")
                    if kpi_name == "ca":
                        current_value = objective.get("progress_ca", 0)
                    elif kpi_name == "ventes":
                        current_value = objective.get("progress_ventes", 0)
                    elif kpi_name == "articles":
                        current_value = objective.get("progress_articles", 0)
                    elif kpi_name == "panier_moyen":
                        current_value = objective.get("progress_panier_moyen", 0)
                    elif kpi_name == "indice_vente":
                        current_value = objective.get("progress_indice_vente", 0)
            elif obj_type == "product_focus":
                if prefer_manual and objective.get("current_value") is not None:
                    current_value = float(objective.get("current_value") or 0)
                else:
                    unit = (objective.get("unit") or "").lower()
                    if "€" in unit or "ca" in unit:
                        current_value = objective.get("progress_ca", 0)
                    elif "vente" in unit:
                        current_value = objective.get("progress_ventes", 0)
                    elif "article" in unit:
                        current_value = objective.get("progress_articles", 0)
                    else:
                        current_value = objective.get("progress_ventes", 0)
            else:
                current_value = objective.get(
                    "current_value", objective.get("progress_ca", 0)
                )
            objective["current_value"] = current_value
            objective["progress_percentage"] = round(
                (float(current_value) / float(target_value)) * 100, 1
            )
        else:
            objective["progress_percentage"] = 0
    duration_ms = (time.time() - start_time) * 1000
    db_ops_count = get_db_ops_count()
    request_id = get_request_id()
    log_extra = {
        "endpoint": "/api/manager/objectives",
        "objectives_count": len(objectives),
        "duration_ms": round(duration_ms, 2),
        "store_id": resolved_store_id,
        "manager_id": manager_id,
    }
    if db_ops_count > 0:
        log_extra["db_ops_count"] = db_ops_count
        if request_id:
            log_extra["request_id"] = request_id
    logger.info("get_all_objectives completed", extra=log_extra)
    return objectives


@router.post("/objectives")
async def create_objective(
    objective_data: dict,
    store_id: Optional[str] = Query(None, description=QUERY_STORE_ID_REQUIS_GERANT),
    context: dict = Depends(get_store_context),
    seller_service: SellerService = Depends(get_seller_service),
    achievement_service: ManagerAchievementService = Depends(
        get_manager_achievement_service
    ),
):
    """Create a new team objective."""
    try:
        resolved_store_id = context.get("resolved_store_id")
        manager_id = context.get("id")
        if not resolved_store_id:
            raise ValidationError(
                "store_id est requis. Pour un gérant, passez store_id en paramètre de requête."
            )
        objective = {
            "id": str(uuid4()),
            "store_id": resolved_store_id,
            "manager_id": manager_id,
            "title": objective_data.get("title", ""),
            "description": objective_data.get("description", ""),
            "target_value": objective_data.get("target_value", 0),
            "current_value": 0,
            "kpi_type": objective_data.get("kpi_type", "ca_journalier"),
            "period_start": objective_data.get("period_start") or objective_data.get("start_date"),
            "period_end": objective_data.get("period_end") or objective_data.get("end_date"),
            "start_date": objective_data.get("start_date") or objective_data.get("period_start"),
            "end_date": objective_data.get("end_date") or objective_data.get("period_end"),
            "status": "active",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "type": objective_data.get("type", "collective"),
            "seller_id": objective_data.get("seller_id"),
            "visible": objective_data.get("visible", True),
            "visible_to_sellers": objective_data.get("visible_to_sellers")
            if objective_data.get("visible", True)
            else None,
            "objective_type": objective_data.get("objective_type", "kpi_standard"),
            "kpi_name": objective_data.get("kpi_name"),
            "product_name": objective_data.get("product_name"),
            "custom_description": objective_data.get("custom_description"),
            "data_entry_responsible": objective_data.get("data_entry_responsible", "manager"),
            "unit": objective_data.get("unit"),
            "progress_ca": 0,
            "progress_ventes": 0,
            "progress_articles": 0,
            "progress_panier_moyen": 0,
            "progress_indice_vente": 0,
            "progress_percentage": 0,
        }
        objective["status"] = seller_service.compute_status(
            current_value=0,
            target_value=objective.get("target_value", 0),
            end_date=objective.get("period_end"),
        )
        if not objective.get("store_id"):
            raise ValidationError(
                "Impossible de créer un objectif sans store_id. Vérifiez que le store_id est bien passé en paramètre."
            )
        objective_id = await achievement_service.create_objective(
            objective, resolved_store_id, manager_id
        )
        objective["id"] = objective_id
        objective.pop("_id", None)
        await seller_service.calculate_objective_progress(objective, manager_id)
        target_value = objective.get("target_value", 0)
        if target_value > 0:
            current_value = 0
            if objective.get("objective_type") == "kpi_standard":
                kpi_name = objective.get("kpi_name", "ca")
                if kpi_name == "ca":
                    current_value = objective.get("progress_ca", 0)
                elif kpi_name == "ventes":
                    current_value = objective.get("progress_ventes", 0)
                elif kpi_name == "articles":
                    current_value = objective.get("progress_articles", 0)
                elif kpi_name == "panier_moyen":
                    current_value = objective.get("progress_panier_moyen", 0)
                elif kpi_name == "indice_vente":
                    current_value = objective.get("progress_indice_vente", 0)
            else:
                current_value = objective.get(
                    "current_value", objective.get("progress_ca", 0)
                )
            objective["current_value"] = current_value
            objective["progress_percentage"] = round(
                (current_value / target_value) * 100, 1
            )
            objective["status"] = seller_service.compute_status(
                current_value=current_value,
                target_value=target_value,
                end_date=objective.get("period_end"),
            )
            await achievement_service.update_objective(
                objective_id=objective["id"],
                update_data={
                    "current_value": current_value,
                    "progress_percentage": objective["progress_percentage"],
                    "status": objective["status"],
                    "progress_ca": objective.get("progress_ca", 0),
                    "progress_ventes": objective.get("progress_ventes", 0),
                    "progress_articles": objective.get("progress_articles", 0),
                    "progress_panier_moyen": objective.get("progress_panier_moyen", 0),
                    "progress_indice_vente": objective.get("progress_indice_vente", 0),
                },
                store_id=resolved_store_id,
            )
        else:
            objective["progress_percentage"] = 0
            objective["status"] = seller_service.compute_status(
                current_value=0,
                target_value=0,
                end_date=objective.get("period_end"),
            )
            await achievement_service.update_objective(
                objective_id=objective["id"],
                update_data={"status": objective["status"]},
                store_id=resolved_store_id,
            )
        return objective
    except Exception:
        raise


@router.put("/objectives/{objective_id}")
async def update_objective(
    objective_id: str,
    objective_data: dict,
    store_id: Optional[str] = Query(None, description=QUERY_STORE_ID_REQUIS_GERANT),
    context: dict = Depends(get_store_context),
    manager_service: ManagerService = Depends(get_manager_service),
):
    """Update an existing objective."""
    try:
        resolved_store_id = context.get("resolved_store_id")
        existing = await manager_service.get_objective_by_id_and_store(
            objective_id, resolved_store_id
        )
        if not existing:
            raise NotFoundError("Objectif non trouvé")
        update_fields = {
            "title": objective_data.get("title", existing.get("title")),
            "description": objective_data.get("description", existing.get("description")),
            "target_value": objective_data.get("target_value", existing.get("target_value")),
            "kpi_type": objective_data.get("kpi_type", existing.get("kpi_type")),
            "period_start": objective_data.get("period_start")
            or objective_data.get("start_date")
            or existing.get("period_start"),
            "period_end": objective_data.get("period_end")
            or objective_data.get("end_date")
            or existing.get("period_end"),
            "start_date": objective_data.get("start_date")
            or objective_data.get("period_start")
            or existing.get("start_date"),
            "end_date": objective_data.get("end_date")
            or objective_data.get("period_end")
            or existing.get("end_date"),
            "status": objective_data.get("status", existing.get("status")),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "type": objective_data.get("type") if "type" in objective_data else existing.get("type"),
            "seller_id": objective_data.get("seller_id") if "seller_id" in objective_data else existing.get("seller_id"),
            "visible": objective_data.get("visible") if "visible" in objective_data else existing.get("visible", True),
            "visible_to_sellers": objective_data.get("visible_to_sellers") if "visible_to_sellers" in objective_data else existing.get("visible_to_sellers"),
            "objective_type": objective_data.get("objective_type") if "objective_type" in objective_data else existing.get("objective_type"),
            "kpi_name": objective_data.get("kpi_name") if "kpi_name" in objective_data else existing.get("kpi_name"),
            "product_name": objective_data.get("product_name") if "product_name" in objective_data else existing.get("product_name"),
            "custom_description": objective_data.get("custom_description") if "custom_description" in objective_data else existing.get("custom_description"),
            "data_entry_responsible": objective_data.get("data_entry_responsible") if "data_entry_responsible" in objective_data else existing.get("data_entry_responsible"),
            "unit": objective_data.get("unit") if "unit" in objective_data else existing.get("unit"),
        }
        await achievement_service.update_objective(
            objective_id, update_fields, store_id=resolved_store_id
        )
        return {"success": True, "message": "Objectif mis à jour", "id": objective_id}
    except AppException:
        raise


@router.delete("/objectives/{objective_id}")
async def delete_objective(
    objective_id: str,
    store_id: Optional[str] = Query(None, description=QUERY_STORE_ID_REQUIS_GERANT),
    context: dict = Depends(get_store_context),
    manager_service: ManagerService = Depends(get_manager_service),
    achievement_service: ManagerAchievementService = Depends(
        get_manager_achievement_service
    ),
):
    """Delete an objective."""
    try:
        resolved_store_id = context.get("resolved_store_id")
        if not resolved_store_id:
            raise ValidationError(ERR_STORE_ID_REQUIS)
        await verify_resource_store_access(
            resource_id=objective_id,
            resource_type="objective",
            user_store_id=resolved_store_id,
            manager_service=manager_service,
        )
        ok = await achievement_service.delete_objective(
            objective_id, store_id=resolved_store_id
        )
        if not ok:
            raise NotFoundError("Objectif non trouvé")
        return {"success": True, "message": "Objectif supprimé"}
    except AppException:
        raise


@router.post("/objectives/{objective_id}/mark-achievement-seen")
async def mark_objective_achievement_seen_manager(
    objective_id: str,
    context: dict = Depends(get_store_context),
    seller_service: SellerService = Depends(get_seller_service),
    manager_service: ManagerService = Depends(get_manager_service),
):
    """Mark an objective achievement notification as seen by the manager/gérant."""
    try:
        resolved_store_id = context.get("resolved_store_id")
        if not resolved_store_id:
            raise ValidationError(ERR_STORE_ID_REQUIS)
        await verify_resource_store_access(
            resource_id=objective_id,
            resource_type="objective",
            user_store_id=resolved_store_id,
            manager_service=manager_service,
        )
        manager_id = context.get("id")
        await seller_service.mark_achievement_as_seen(
            manager_id, "objective", objective_id
        )
        return {"success": True, "message": "Notification marquée comme vue"}
    except AppException:
        raise


@router.post("/objectives/{objective_id}")
@router.post("/objectives/{objective_id}/progress")
async def update_objective_progress(
    objective_id: str,
    progress_data: dict,
    store_id: Optional[str] = Query(None, description=QUERY_STORE_ID_REQUIS_GERANT),
    context: dict = Depends(get_store_context),
    achievement_service: ManagerAchievementService = Depends(
        get_manager_achievement_service
    ),
    seller_service: SellerService = Depends(get_seller_service),
    notification_service: NotificationService = Depends(get_notification_service),
):
    """
    Update progress on an objective.
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
                "Le paramètre store_id est requis pour mettre à jour la progression d'un objectif"
            )
        if not resolved_store_id:
            raise ValidationError("Impossible de déterminer le magasin")
        existing = await achievement_service.get_objective_by_id_and_store(
            objective_id, resolved_store_id
        )
        if not existing:
            raise NotFoundError(
                f"Objectif non trouvé dans le magasin spécifié (store_id: {resolved_store_id})"
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
        end_date = existing.get("period_end")
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
        if existing.get("objective_type") == "kpi_standard":
            kpi_name = existing.get("kpi_name", "ca")
            if kpi_name == "ca":
                update_data["progress_ca"] = new_value
            elif kpi_name == "ventes":
                update_data["progress_ventes"] = new_value
            elif kpi_name == "articles":
                update_data["progress_articles"] = new_value
            elif kpi_name == "panier_moyen":
                update_data["progress_panier_moyen"] = new_value
            elif kpi_name == "indice_vente":
                update_data["progress_indice_vente"] = new_value
        progress_entry = {
            "value": increment_value,
            "date": update_data["updated_at"],
            "updated_by": manager_id,
            "updated_by_name": actor_name,
            "role": user_role,
            "total_after": new_value,
        }
        await achievement_service.update_objective_with_progress_history(
            objective_id, update_data, progress_entry, resolved_store_id, manager_id
        )
        updated_objective = await achievement_service.get_objective_by_id_and_store(
            objective_id, resolved_store_id
        )
        if updated_objective:
            old_status = existing.get("status", "active")
            if new_status == "achieved" and old_status != "achieved":
                updated_objective["just_achieved"] = True
                await notification_service.add_achievement_notification_flag(
                    [updated_objective], manager_id, "objective"
                )
            return updated_objective
        return {
            "success": True,
            "current_value": new_value,
            "progress_percentage": progress_percentage,
            "status": new_status,
            "updated_at": update_data["updated_at"],
        }
    except AppException:
        raise
