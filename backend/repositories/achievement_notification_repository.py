"""
Achievement Notification Repository - Data access for achievement_notifications collection
Security: All methods require user_id to prevent IDOR
"""
from typing import Optional, List, Dict, Any
from repositories.base_repository import BaseRepository


class AchievementNotificationRepository(BaseRepository):
    """Repository for achievement_notifications collection with security filters"""
    
    def __init__(self, db):
        super().__init__(db, "achievement_notifications")
    
    async def find_by_user(
        self,
        user_id: str,
        item_type: Optional[str] = None,
        item_id: Optional[str] = None,
        projection: Optional[Dict[str, int]] = None,
        limit: int = 100,
        skip: int = 0,
        sort: Optional[List[tuple]] = None
    ) -> List[Dict]:
        """Find notifications by user (SECURITY: requires user_id)"""
        if not user_id:
            raise ValueError("user_id is required for security")
        
        filters = {"user_id": user_id}
        if item_type:
            filters["item_type"] = item_type
        if item_id:
            filters["item_id"] = item_id
        
        sort = sort or [("created_at", -1)]
        return await self.find_many(filters, projection, limit, skip, sort)
    
    async def find_by_user_and_item(
        self,
        user_id: str,
        item_type: str,
        item_id: str,
        projection: Optional[Dict[str, int]] = None
    ) -> Optional[Dict]:
        """Find notification by user, item type and item ID (SECURITY: requires user_id)"""
        if not user_id or not item_type or not item_id:
            raise ValueError("user_id, item_type, and item_id are required")
        
        return await self.find_one(
            {"user_id": user_id, "item_type": item_type, "item_id": item_id},
            projection
        )
    
    async def create_notification(self, notification_data: Dict[str, Any], user_id: str) -> str:
        """Create a new notification (SECURITY: validates user_id)"""
        if not user_id:
            raise ValueError("user_id is required for security")
        notification_data["user_id"] = user_id
        return await self.insert_one(notification_data)
    
    async def update_notification(
        self,
        user_id: str,
        item_type: str,
        item_id: str,
        update_data: Dict[str, Any]
    ) -> bool:
        """Update a notification (SECURITY: requires user_id)"""
        if not user_id or not item_type or not item_id:
            raise ValueError("user_id, item_type, and item_id are required")
        
        filters = {"user_id": user_id, "item_type": item_type, "item_id": item_id}
        return await self.update_one(filters, {"$set": update_data})
    
    async def upsert_notification(
        self,
        user_id: str,
        item_type: str,
        item_id: str,
        notification_data: Dict[str, Any]
    ) -> bool:
        """Upsert a notification (create if not exists, update if exists)"""
        if not user_id or not item_type or not item_id:
            raise ValueError("user_id, item_type, and item_id are required")
        
        filters = {"user_id": user_id, "item_type": item_type, "item_id": item_id}
        notification_data["user_id"] = user_id
        notification_data["item_type"] = item_type
        notification_data["item_id"] = item_id
        
        return await self.update_one(filters, {"$set": notification_data}, upsert=True)
    
    async def count_by_user(self, user_id: str) -> int:
        """Count notifications by user (SECURITY: requires user_id)"""
        if not user_id:
            raise ValueError("user_id is required for security")
        return await self.count({"user_id": user_id})
