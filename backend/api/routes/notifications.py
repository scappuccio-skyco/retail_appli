"""
In-app notification endpoints.
GET  /notifications          — list (20 most recent, unread first)
PATCH /notifications/{id}/read — mark one read
PATCH /notifications/read-all  — mark all read
"""
from fastapi import APIRouter, Depends
from typing import Dict

from core.security import get_current_user
from core.database import get_db
from repositories.notification_repository import NotificationRepository
from services.notification_service import NotificationService
from repositories.achievement_notification_repository import AchievementNotificationRepository

router = APIRouter(prefix="/notifications", tags=["Notifications"])


def _get_service(db=Depends(get_db)) -> NotificationService:
    return NotificationService(
        achievement_notification_repo=AchievementNotificationRepository(db),
        notification_repo=NotificationRepository(db),
    )


@router.get("")
async def get_notifications(
    current_user: Dict = Depends(get_current_user),
    service: NotificationService = Depends(_get_service),
):
    user_id = current_user["id"]
    notifications = await service.get_for_user(user_id, limit=20)
    unread = await service.count_unread(user_id)
    return {"notifications": notifications, "unread_count": unread}


@router.patch("/read-all")
async def mark_all_read(
    current_user: Dict = Depends(get_current_user),
    service: NotificationService = Depends(_get_service),
):
    count = await service.mark_all_read(current_user["id"])
    return {"marked_read": count}


@router.patch("/{notif_id}/read")
async def mark_one_read(
    notif_id: str,
    current_user: Dict = Depends(get_current_user),
    service: NotificationService = Depends(_get_service),
):
    ok = await service.mark_read(notif_id, current_user["id"])
    return {"success": ok}
