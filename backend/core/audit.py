"""
Audit log for business mutations (KPI entries, objectives, evaluations, etc.).

Usage (fire-and-forget — n'attend pas la réponse) :
    asyncio.create_task(log_action(
        db=db,
        user_id=current_user["id"],
        user_role=current_user["role"],
        store_id=resolved_store_id,
        action="kpi_upsert",
        resource_type="kpi_entry",
        resource_id=entry_id,
        details={"date": date, "seller_id": seller_id},
    ))

Collection : audit_logs (TTL 365j, index sur store_id + created_at).
Tous les champs sauf user_id/action sont optionnels — la fonction ne lève jamais d'exception.
"""
import logging
from datetime import datetime, timezone
from typing import Any, Optional

logger = logging.getLogger(__name__)


async def log_action(
    *,
    db: Any,
    user_id: str,
    action: str,
    user_role: Optional[str] = None,
    store_id: Optional[str] = None,
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
    details: Optional[dict] = None,
) -> None:
    """
    Insert one audit log entry into the `audit_logs` collection.
    Silent on error — never raises (audit must not break the main request).
    """
    try:
        now = datetime.now(timezone.utc)
        doc = {
            "user_id": user_id,
            "action": action,
            "created_at": now,
            "timestamp": now.isoformat(),
        }
        if user_role:
            doc["user_role"] = user_role
        if store_id:
            doc["store_id"] = store_id
        if resource_type:
            doc["resource_type"] = resource_type
        if resource_id:
            doc["resource_id"] = resource_id
        if details:
            doc["details"] = details

        await db.audit_logs.insert_one(doc)
    except Exception as e:
        logger.debug("Audit log insert failed (non-critical): %s", e)
