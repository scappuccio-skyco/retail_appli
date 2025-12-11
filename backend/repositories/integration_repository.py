"""Integration Repository - Database operations for API keys and sync logs"""
from typing import Dict, List, Optional
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorDatabase


class IntegrationRepository:
    """Repository for integration-related database operations"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.api_keys = db.api_keys
    
    async def create_api_key(self, key_doc: Dict) -> str:
        """Create a new API key"""
        await self.api_keys.insert_one(key_doc)
        return key_doc['id']
    
    async def find_api_keys_by_user(self, user_id: str) -> List[Dict]:
        """Find all API keys for a user"""
        keys = await self.api_keys.find(
            {"user_id": user_id},
            {"_id": 0, "key_hash": 0}
        ).to_list(100)
        return keys
    
    async def find_api_keys_by_prefix(self, prefix: str) -> List[Dict]:
        """Find API keys by prefix for verification"""
        return await self.api_keys.find(
            {"key_prefix": prefix, "active": True},
            {"_id": 0}
        ).to_list(10)
    
    async def deactivate_api_key(self, key_id: str, user_id: str) -> bool:
        """Deactivate an API key"""
        result = await self.api_keys.update_one(
            {"id": key_id, "user_id": user_id},
            {"$set": {"active": False, "deactivated_at": datetime.now(timezone.utc)}}
        )
        return result.modified_count > 0
