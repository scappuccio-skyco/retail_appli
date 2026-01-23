"""
Notification Service
Service for achievement notifications (extracted from SellerService for decoupling)

✅ ÉTAPE C : Service partagé pour notifications (découplage)
"""
import logging
from datetime import datetime, timezone
from typing import List, Dict

logger = logging.getLogger(__name__)


class NotificationService:
    """Service for achievement notifications"""
    
    def __init__(self, db):
        self.db = db
    
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
        notification = await self.db.achievement_notifications.find_one({
            "user_id": user_id,
            "item_type": item_type,
            "item_id": item_id
        })
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
        await self.db.achievement_notifications.update_one(
            {
                "user_id": user_id,
                "item_type": item_type,
                "item_id": item_id
            },
            {
                "$set": {
                    "seen_at": now,
                    "updated_at": now
                },
                "$setOnInsert": {
                    "user_id": user_id,
                    "item_type": item_type,
                    "item_id": item_id,
                    "created_at": now
                }
            },
            upsert=True
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
