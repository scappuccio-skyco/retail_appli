"""
Base Repository Pattern
Provides common CRUD operations for all repositories
"""
from typing import Optional, List, Dict, Any
from motor.motor_asyncio import AsyncIOMotorDatabase, AsyncIOMotorCollection
from datetime import datetime, timezone


class BaseRepository:
    """
    Base repository with common database operations
    All repositories should inherit from this class
    """
    
    def __init__(self, db: AsyncIOMotorDatabase, collection_name: str):
        """
        Initialize repository with database and collection
        
        Args:
            db: MongoDB database instance
            collection_name: Name of the MongoDB collection
        """
        self.db = db
        self.collection_name = collection_name
        self.collection: AsyncIOMotorCollection = db[collection_name]
    
    # ===== READ OPERATIONS =====
    
    async def find_one(
        self,
        filters: Dict[str, Any],
        projection: Optional[Dict[str, int]] = None
    ) -> Optional[Dict]:
        """Find a single document"""
        projection = projection or {"_id": 0}
        return await self.collection.find_one(filters, projection)
    
    async def find_many(
        self,
        filters: Dict[str, Any],
        projection: Optional[Dict[str, int]] = None,
        limit: int = 1000,
        skip: int = 0,
        sort: Optional[List[tuple]] = None
    ) -> List[Dict]:
        """Find multiple documents"""
        projection = projection or {"_id": 0}
        cursor = self.collection.find(filters, projection)
        
        if sort:
            cursor = cursor.sort(sort)
        
        cursor = cursor.skip(skip).limit(limit)
        return await cursor.to_list(limit)
    
    async def count(self, filters: Dict[str, Any]) -> int:
        """Count documents matching filters"""
        return await self.collection.count_documents(filters)
    
    async def exists(self, filters: Dict[str, Any]) -> bool:
        """Check if document exists"""
        count = await self.collection.count_documents(filters, limit=1)
        return count > 0
    
    # ===== WRITE OPERATIONS =====
    
    async def insert_one(self, document: Dict[str, Any]) -> str:
        """
        Insert a single document
        Returns the document id
        """
        result = await self.collection.insert_one(document)
        return document.get('id', str(result.inserted_id))
    
    async def insert_many(self, documents: List[Dict[str, Any]]) -> List[str]:
        """Insert multiple documents"""
        if not documents:
            return []
        
        result = await self.collection.insert_many(documents)
        return [doc.get('id') for doc in documents]
    
    async def update_one(
        self,
        filters: Dict[str, Any],
        update: Dict[str, Any],
        upsert: bool = False
    ) -> bool:
        """
        Update a single document
        Returns True if document was modified
        
        ✅ CACHE INVALIDATION: Automatically invalidates cache for users, stores, and workspaces
        """
        # Add updated_at timestamp
        if "$set" in update:
            update["$set"]["updated_at"] = datetime.now(timezone.utc)
        else:
            update["$set"] = {"updated_at": datetime.now(timezone.utc)}
        
        result = await self.collection.update_one(filters, update, upsert=upsert)
        modified = result.modified_count > 0 or (upsert and result.upserted_id is not None)
        
        # ✅ CACHE INVALIDATION: Invalidate cache if document was modified
        if modified:
            await self._invalidate_cache_for_update(filters)
        
        return modified
    
    async def _invalidate_cache_for_update(self, filters: Dict[str, Any]):
        """
        Invalidate cache after update based on collection type.
        Called automatically by update_one and update_many.
        """
        try:
            from core.cache import invalidate_user_cache, invalidate_store_cache, invalidate_workspace_cache
            
            # Get document ID from filters (most common case: {"id": "xxx"})
            doc_id = filters.get("id") or filters.get("_id")
            
            if not doc_id:
                return  # Can't invalidate without ID
            
            # Invalidate based on collection type
            if self.collection_name == "users":
                await invalidate_user_cache(str(doc_id))
            elif self.collection_name == "stores":
                await invalidate_store_cache(str(doc_id))
            elif self.collection_name == "workspaces":
                await invalidate_workspace_cache(str(doc_id))
        except Exception as e:
            # Don't fail the update if cache invalidation fails
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Cache invalidation failed (non-critical): {e}")
    
    async def update_many(
        self,
        filters: Dict[str, Any],
        update: Dict[str, Any]
    ) -> int:
        """
        Update multiple documents
        Returns number of documents modified
        
        ✅ CACHE INVALIDATION: Invalidates cache for all affected documents
        """
        result = await self.collection.update_many(filters, update)
        
        # ✅ CACHE INVALIDATION: Invalidate cache for all affected documents
        if result.modified_count > 0:
            await self._invalidate_cache_for_update_many(filters)
        
        return result.modified_count
    
    async def _invalidate_cache_for_update_many(self, filters: Dict[str, Any]):
        """
        Invalidate cache for multiple documents after update_many.
        Uses pattern-based invalidation for efficiency.
        """
        try:
            from core.cache import get_cache_service, CacheKeys
            
            cache = await get_cache_service()
            if not cache.enabled:
                return
            
            # Pattern-based invalidation for bulk updates
            if self.collection_name == "users":
                # If filtering by specific IDs, invalidate those
                if "id" in filters and isinstance(filters["id"], dict) and "$in" in filters["id"]:
                    for user_id in filters["id"]["$in"]:
                        await cache.delete(CacheKeys.user(str(user_id)))
                else:
                    # Invalidate all user cache (use with caution)
                    await cache.invalidate_pattern("user:*")
            elif self.collection_name == "stores":
                if "id" in filters and isinstance(filters["id"], dict) and "$in" in filters["id"]:
                    for store_id in filters["id"]["$in"]:
                        await cache.delete(CacheKeys.store(str(store_id)))
                        await cache.delete(CacheKeys.store_config(str(store_id)))
                else:
                    await cache.invalidate_pattern("store:*")
                    await cache.invalidate_pattern("store_config:*")
            elif self.collection_name == "workspaces":
                if "id" in filters and isinstance(filters["id"], dict) and "$in" in filters["id"]:
                    for workspace_id in filters["id"]["$in"]:
                        await cache.delete(CacheKeys.workspace(str(workspace_id)))
                else:
                    await cache.invalidate_pattern("workspace:*")
        except Exception as e:
            # Don't fail the update if cache invalidation fails
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Cache invalidation failed (non-critical): {e}")
    
    async def delete_one(self, filters: Dict[str, Any]) -> bool:
        """
        Delete a single document
        Returns True if document was deleted
        
        ✅ CACHE INVALIDATION: Automatically invalidates cache
        """
        result = await self.collection.delete_one(filters)
        deleted = result.deleted_count > 0
        
        # ✅ CACHE INVALIDATION: Invalidate cache if document was deleted
        if deleted:
            await self._invalidate_cache_for_update(filters)
        
        return deleted
    
    async def delete_many(self, filters: Dict[str, Any]) -> int:
        """
        Delete multiple documents
        Returns number of documents deleted
        """
        result = await self.collection.delete_many(filters)
        return result.deleted_count
    
    # ===== AGGREGATION =====
    
    async def aggregate(self, pipeline: List[Dict], max_results: int = 10000) -> List[Dict]:
        """
        Run aggregation pipeline
        
        Args:
            pipeline: MongoDB aggregation pipeline
            max_results: Maximum number of results to return (default: 10000)
                        Set to None to disable limit (use with caution)
            
        Returns:
            List of aggregation results (limited to max_results)
        """
        cursor = self.collection.aggregate(pipeline)
        # ⚠️ SECURITY: Default limit to prevent OOM
        # If you need more results, explicitly pass max_results=None (use with caution)
        if max_results is None:
            return await cursor.to_list(None)
        return await cursor.to_list(max_results)
    
    # ===== BULK OPERATIONS =====
    
    async def bulk_write(self, operations: List) -> Dict[str, int]:
        """
        Execute bulk write operations
        
        Args:
            operations: List of pymongo operations (InsertOne, UpdateOne, etc.)
            
        Returns:
            Dict with operation counts
        """
        if not operations:
            return {"inserted": 0, "updated": 0, "deleted": 0}
        
        result = await self.collection.bulk_write(operations, ordered=False)
        
        return {
            "inserted": result.inserted_count,
            "updated": result.modified_count,
            "deleted": result.deleted_count,
            "upserted": result.upserted_count
        }
