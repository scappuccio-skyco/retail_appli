"""
Notification Service
Service for achievement notifications. Dependencies injected via __init__.
"""
import logging
from datetime import datetime, timezone
from typing import List, Dict

from repositories.achievement_notification_repository import AchievementNotificationRepository

logger = logging.getLogger(__name__)


class NotificationService:
    """Service for achievement notifications. Repo injected via __init__."""

    def __init__(self, achievement_notification_repo: AchievementNotificationRepository):
        self.achievement_notification_repo = achievement_notification_repo
    
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
