"""
Enterprise Repository
Data access layer for enterprise accounts, API keys, and sync logs
"""
from typing import Dict, List, Optional
from datetime import datetime, timezone
from repositories.base_repository import BaseRepository


class EnterpriseAccountRepository(BaseRepository):
    """Repository for enterprise accounts"""
    
    def __init__(self, db):
        super().__init__(db, "enterprise_accounts")
    
    async def find_by_company_name(self, company_name: str) -> Optional[Dict]:
        """Find enterprise account by company name"""
        return await self.find_one({"company_name": company_name}, {"_id": 0})
    
    async def update_sync_status(self, enterprise_id: str, status: str, error_message: Optional[str] = None):
        """Update sync status for an enterprise account"""
        update_data = {
            "scim_last_sync": datetime.now(timezone.utc).isoformat(),
            "scim_sync_status": status
        }
        if error_message:
            update_data["scim_error_message"] = error_message
        
        return await self.collection.update_one(
            {"id": enterprise_id},
            {"$set": update_data}
        )


class APIKeyRepository(BaseRepository):
    """Repository for API keys"""
    
    def __init__(self, db):
        super().__init__(db, "api_keys")
    
    async def find_by_key(self, api_key: str) -> Optional[Dict]:
        """Find API key by key value"""
        return await self.find_one({"key": api_key, "is_active": True}, {"_id": 0})
    
    async def find_by_enterprise(self, enterprise_id: str, include_key: bool = False) -> List[Dict]:
        """Find all API keys for an enterprise account"""
        projection = {"_id": 0}
        if not include_key:
            projection["key"] = 0
        
        return await self.find_many(
            {"enterprise_account_id": enterprise_id},
            projection
        )
    
    async def find_by_user(self, user_id: str, projection: Optional[Dict] = None) -> List[Dict]:
        """Find all API keys for a user (SECURITY: requires user_id)"""
        if not user_id:
            raise ValueError("user_id is required for security")
        return await self.find_many({"user_id": user_id}, projection)
    
    async def find_by_id(
        self,
        key_id: str,
        user_id: Optional[str] = None,
        projection: Optional[Dict] = None
    ) -> Optional[Dict]:
        """Find API key by ID (SECURITY: requires user_id if provided)"""
        if not key_id:
            raise ValueError("key_id is required")
        
        filters = {"id": key_id}
        if user_id:
            filters["user_id"] = user_id
        
        return await self.find_one(filters, projection)
    
    async def create_key(self, key_data: Dict[str, Any], user_id: str) -> str:
        """Create a new API key (SECURITY: validates user_id)"""
        if not user_id:
            raise ValueError("user_id is required for security")
        key_data["user_id"] = user_id
        return await self.insert_one(key_data)
    
    async def update_key(
        self,
        key_id: str,
        update_data: Dict[str, Any],
        user_id: Optional[str] = None
    ) -> bool:
        """Update an API key (SECURITY: requires user_id if provided)"""
        if not key_id:
            raise ValueError("key_id is required")
        
        filters = {"id": key_id}
        if user_id:
            filters["user_id"] = user_id
        
        return await self.update_one(filters, {"$set": update_data})
    
    async def delete_key(
        self,
        key_id: str,
        user_id: Optional[str] = None
    ) -> bool:
        """Delete an API key (SECURITY: requires user_id if provided)"""
        if not key_id:
            raise ValueError("key_id is required")
        
        filters = {"id": key_id}
        if user_id:
            filters["user_id"] = user_id
        
        return await self.delete_one(filters)
    
    async def update_usage(self, key_id: str):
        """Update last used timestamp and increment request count"""
        # Use BaseRepository method but with $inc operator
        from pymongo import UpdateOne
        await self.collection.update_one(
            {"id": key_id},
            {
                "$set": {"last_used_at": datetime.now(timezone.utc).isoformat()},
                "$inc": {"request_count": 1}
            }
        )
    
    async def revoke_key(self, key_id: str, enterprise_id: str) -> bool:
        """Revoke (deactivate) an API key"""
        return await self.update_one(
            {"id": key_id, "enterprise_account_id": enterprise_id},
            {
                "is_active": False,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        )


class SyncLogRepository(BaseRepository):
    """Repository for sync logs"""
    
    def __init__(self, db):
        super().__init__(db, "sync_logs")
    
    async def find_recent_by_enterprise(self, enterprise_id: str, limit: int = 10) -> List[Dict]:
        """Find recent sync logs for an enterprise"""
        cursor = self.collection.find(
            {"enterprise_account_id": enterprise_id},
            {"_id": 0}
        ).sort("timestamp", -1).limit(limit)
        
        return await cursor.to_list(length=limit)
    
    async def find_by_filters(
        self,
        enterprise_id: str,
        operation: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 50
    ) -> List[Dict]:
        """Find sync logs with optional filters"""
        query = {"enterprise_account_id": enterprise_id}
        
        if operation:
            query["operation"] = operation
        if status:
            query["status"] = status
        
        cursor = self.collection.find(query, {"_id": 0})\
            .sort("timestamp", -1)\
            .limit(limit)
        
        return await cursor.to_list(length=limit)
