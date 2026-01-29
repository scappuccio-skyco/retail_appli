"""Integration Repository - Database operations for API keys and sync logs.
Phase 2: Pagination (page/size) for list operations."""
from typing import Dict, List, Optional, Tuple
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
    
    async def find_api_keys_by_user(
        self,
        user_id: str,
        page: int = 1,
        size: int = 50,
    ) -> Tuple[List[Dict], int]:
        """Find API keys for a user (paginated). Returns (items, total_count)."""
        query = {"user_id": user_id}
        projection = {"_id": 0, "key_hash": 0}
        skip = (page - 1) * size
        total = await self.api_keys.count_documents(query)
        items = await self.api_keys.find(
            query,
            projection
        ).skip(skip).limit(size).to_list(size)
        return (items, total)
    
    async def find_api_keys_by_prefix(
        self,
        prefix: str,
        page: int = 1,
        size: int = 20,
    ) -> Tuple[List[Dict], int]:
        """Find API keys by prefix for verification. Returns (items, total_count)."""
        query = {"key_prefix": prefix, "active": True}
        projection = {"_id": 0}
        skip = (page - 1) * size
        total = await self.api_keys.count_documents(query)
        items = await self.api_keys.find(
            query,
            projection
        ).skip(skip).limit(size).to_list(size)
        return (items, total)
    
    async def deactivate_api_key(self, key_id: str, user_id: str) -> bool:
        """Deactivate an API key"""
        result = await self.api_keys.update_one(
            {"id": key_id, "user_id": user_id},
            {"$set": {"active": False, "deactivated_at": datetime.now(timezone.utc)}}
        )
        return result.modified_count > 0
