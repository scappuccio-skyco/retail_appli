"""
Generic notification repository.
Collection: notifications
TTL: 30 days (index on created_at)
"""
from typing import List, Dict, Optional
from datetime import datetime, timezone
from repositories.base_repository import BaseRepository


class NotificationRepository(BaseRepository):
    def __init__(self, db):
        super().__init__(db, "notifications")

    async def create(self, user_id: str, notif_type: str, title: str, message: str, data: Optional[Dict] = None) -> Dict:
        doc = {
            "user_id": user_id,
            "type": notif_type,
            "title": title,
            "message": message,
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "data": data or {},
        }
        return await self.insert_one(doc)

    async def find_for_user(self, user_id: str, limit: int = 20) -> List[Dict]:
        """Last `limit` notifications, unread first then by date desc."""
        return await self.find_many(
            {"user_id": user_id},
            projection={"_id": 0},
            sort=[("read", 1), ("created_at", -1)],
            limit=limit,
        )

    async def count_unread(self, user_id: str) -> int:
        return await self.count({"user_id": user_id, "read": False})

    async def mark_read(self, notif_id: str, user_id: str) -> bool:
        result = await self.update_one(
            {"id": notif_id, "user_id": user_id},
            {"$set": {"read": True}},
        )
        return result.modified_count > 0

    async def mark_all_read(self, user_id: str) -> int:
        result = await self.update_many(
            {"user_id": user_id, "read": False},
            {"$set": {"read": True}},
        )
        return result.modified_count
