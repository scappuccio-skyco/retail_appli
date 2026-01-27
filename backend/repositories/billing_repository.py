"""Billing Profile Repository"""
from typing import Optional, List, Dict
from repositories.base_repository import BaseRepository


class BillingProfileRepository(BaseRepository):
    """Repository for billing_profiles collection"""
    
    def __init__(self, db):
        super().__init__(db, "billing_profiles")
    
    async def find_by_gerant(self, gerant_id: str) -> Optional[Dict]:
        """Find billing profile for a gérant"""
        return await self.find_one({"gerant_id": gerant_id})
    
    async def find_by_id(self, profile_id: str) -> Optional[Dict]:
        """Find billing profile by ID"""
        return await self.find_one({"id": profile_id})
    
    async def create(self, profile_data: Dict) -> str:
        """Create a new billing profile"""
        if "id" not in profile_data:
            import uuid
            profile_data["id"] = str(uuid.uuid4())
        return await self.insert_one(profile_data)
    
    async def update_by_gerant(self, gerant_id: str, update_data: Dict) -> bool:
        """Update billing profile for a gérant"""
        return await self.update_one({"gerant_id": gerant_id}, {"$set": update_data})
    
    async def update_by_id(self, profile_id: str, update_data: Dict) -> bool:
        """Update billing profile by ID"""
        return await self.update_one({"id": profile_id}, {"$set": update_data})
