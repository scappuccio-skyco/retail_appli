"""
Daily Challenge Repository - Data access for daily_challenges collection
"""
from typing import Optional, Dict, Any
from datetime import datetime, timezone
from repositories.base_repository import BaseRepository


class DailyChallengeRepository(BaseRepository):
    """Repository for daily_challenges collection"""
    
    def __init__(self, db):
        super().__init__(db, "daily_challenges")
    
    async def find_by_seller_and_date(self, seller_id: str, date: str) -> Optional[Dict]:
        """Find daily challenge for a seller on a specific date"""
        return await self.find_one({"seller_id": seller_id, "date": date}, {"_id": 0})
    
    async def find_completed_today(self, seller_id: str, date: str) -> Optional[Dict]:
        """Find completed challenge for seller today"""
        return await self.find_one(
            {"seller_id": seller_id, "date": date, "completed": True},
            {"_id": 0}
        )
    
    async def create_challenge(self, challenge_data: Dict[str, Any]) -> str:
        """Create a new daily challenge"""
        if "id" not in challenge_data:
            import uuid
            challenge_data["id"] = str(uuid.uuid4())
        if "created_at" not in challenge_data:
            challenge_data["created_at"] = datetime.now(timezone.utc).isoformat()
        
        return await self.insert_one(challenge_data)
    
    async def update_challenge(
        self,
        seller_id: str,
        date: str,
        update_data: Dict[str, Any]
    ) -> bool:
        """Update daily challenge for seller on date"""
        return await self.update_one(
            {"seller_id": seller_id, "date": date},
            {"$set": update_data}
        )
    
    async def delete_by_seller(self, seller_id: str) -> int:
        """Delete all daily challenges for a seller"""
        return await self.delete_many({"seller_id": seller_id})
    
    async def delete_many(self, filters: Dict[str, Any]) -> int:
        """Delete multiple daily challenges matching filters"""
        return await super().delete_many(filters)
