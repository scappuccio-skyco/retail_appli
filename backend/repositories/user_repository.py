"""User Repository - Data access for users collection"""
from typing import Optional, List, Dict
from repositories.base_repository import BaseRepository


class UserRepository(BaseRepository):
    """Repository for users collection"""
    
    def __init__(self, db):
        super().__init__(db, "users")
    
    async def find_by_email(self, email: str) -> Optional[Dict]:
        """Find user by email"""
        return await self.find_one({"email": email})
    
    async def find_by_id(self, user_id: str, include_password: bool = False) -> Optional[Dict]:
        """Find user by ID"""
        projection = {"_id": 0}
        if not include_password:
            projection["password"] = 0
        return await self.find_one({"id": user_id}, projection)
    
    async def find_by_role(self, role: str, limit: int = 1000) -> List[Dict]:
        """Find all users with a specific role"""
        return await self.find_many({"role": role}, limit=limit)
    
    async def find_by_gerant(self, gerant_id: str) -> List[Dict]:
        """Find all users under a gérant"""
        return await self.find_many({"gerant_id": gerant_id})
    
    async def find_by_store(self, store_id: str) -> List[Dict]:
        """Find all users in a store"""
        return await self.find_many({"store_id": store_id})
    
    async def find_by_manager(self, manager_id: str) -> List[Dict]:
        """Find all sellers under a manager"""
        return await self.find_many({"manager_id": manager_id, "role": "seller"})
    
    async def count_active_sellers(self, gerant_id: str) -> int:
        """Count active sellers for a gérant"""
        return await self.count({
            "gerant_id": gerant_id,
            "role": "seller",
            "status": "active"
        })
    
    async def email_exists(self, email: str) -> bool:
        """Check if email already exists"""
        return await self.exists({"email": email})
