"""Challenge Repository"""
from typing import Optional, List, Dict
from repositories.base_repository import BaseRepository


class ChallengeRepository(BaseRepository):
    """Repository for challenges collection"""
    
    def __init__(self, db):
        super().__init__(db, "challenges")
    
    async def find_by_seller(self, seller_id: str) -> List[Dict]:
        """Find all challenges for a seller"""
        return await self.find_many(
            {"seller_id": seller_id},
            sort=[("created_at", -1)]
        )
    
    async def find_active_challenges(self, seller_id: str) -> List[Dict]:
        """Find active challenges for a seller"""
        return await self.find_many({
            "seller_id": seller_id,
            "status": {"$in": ["in_progress", "pending"]}
        })


class DailyChallengeRepository(BaseRepository):
    """Repository for daily_challenges collection"""
    
    def __init__(self, db):
        super().__init__(db, "daily_challenges")
    
    async def find_by_seller_and_date(self, seller_id: str, date: str) -> Optional[Dict]:
        """Find daily challenge for a seller on a specific date"""
        return await self.find_one({"seller_id": seller_id, "date": date})
    
    async def find_by_seller(self, seller_id: str, limit: int = 30) -> List[Dict]:
        """Find recent daily challenges for a seller"""
        return await self.find_many(
            {"seller_id": seller_id},
            sort=[("date", -1)],
            limit=limit
        )
