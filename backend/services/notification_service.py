"""
Notification Service
- Achievement notifications (objectives/challenges seen flags)
- Generic in-app notifications (kpi_saved, silent_seller, …)
"""
import logging
from datetime import datetime, timezone
from typing import List, Dict, Optional

from repositories.achievement_notification_repository import AchievementNotificationRepository
from repositories.notification_repository import NotificationRepository

logger = logging.getLogger(__name__)


class NotificationService:
    """Service for achievement + generic in-app notifications."""

    def __init__(
        self,
        achievement_notification_repo: AchievementNotificationRepository,
        notification_repo: Optional[NotificationRepository] = None,
    ):
        self.achievement_notification_repo = achievement_notification_repo
        self.notification_repo = notification_repo
    
    async def check_achievement_notification(self, user_id: str, item_type: str, item_id: str) -> bool:
        """
        Check if user has already seen the achievement notification for an objective/challenge
        
        Args:
            user_id: User ID (seller or manager)
            item_type: "objective" or "challenge"
            item_id: Objective or challenge ID
            
        Returns:
            True if notification has been seen, False if unseen
        """
        notification = await self.achievement_notification_repo.find_by_user_and_item(
            user_id, item_type, item_id
        )
        return notification is not None
    
    async def mark_achievement_as_seen(self, user_id: str, item_type: str, item_id: str):
        """
        Mark an achievement notification as seen by a user
        
        Args:
            user_id: User ID (seller or manager)
            item_type: "objective" or "challenge"
            item_id: Objective or challenge ID
        """
        now = datetime.now(timezone.utc).isoformat()
        await self.achievement_notification_repo.upsert_notification(
            user_id, item_type, item_id,
            {"seen_at": now, "updated_at": now, "created_at": now}
        )
    
    async def add_achievement_notification_flag(self, items: List[Dict], user_id: str, item_type: str):
        """
        Add has_unseen_achievement flag to objectives or challenges
        
        ✅ ÉTAPE C : Logique extraite de SellerService pour découplage
        
        Args:
            items: List of objectives or challenges
            user_id: User ID (seller or manager)
            item_type: "objective" or "challenge"
        """
        for item in items:
            # Check if item is achieved/completed and notification not seen
            status = item.get('status')
            is_achieved = status in ['achieved', 'completed']
            
            if is_achieved:
                item_id = item.get('id')
                has_seen = await self.check_achievement_notification(user_id, item_type, item_id)
                item['has_unseen_achievement'] = not has_seen
            else:
                item['has_unseen_achievement'] = False

    # ── Generic in-app notifications ────────────────────────────────────────

    async def create(self, user_id: str, notif_type: str, title: str, message: str, data: Optional[Dict] = None) -> None:
        """Create a generic notification. No-op if repo not injected."""
        if not self.notification_repo:
            return
        try:
            await self.notification_repo.create(user_id, notif_type, title, message, data)
        except Exception:
            logger.exception("Failed to create notification type=%s user=%s", notif_type, user_id)

    async def get_for_user(self, user_id: str, limit: int = 20) -> List[Dict]:
        if not self.notification_repo:
            return []
        return await self.notification_repo.find_for_user(user_id, limit=limit)

    async def count_unread(self, user_id: str) -> int:
        if not self.notification_repo:
            return 0
        return await self.notification_repo.count_unread(user_id)

    async def mark_read(self, notif_id: str, user_id: str) -> bool:
        if not self.notification_repo:
            return False
        return await self.notification_repo.mark_read(notif_id, user_id)

    async def mark_all_read(self, user_id: str) -> int:
        if not self.notification_repo:
            return 0
        return await self.notification_repo.mark_all_read(user_id)
