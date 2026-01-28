"""
Base Repository Pattern
Provides common CRUD operations for all repositories
"""
from typing import Optional, List, Dict, Any, AsyncIterator
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
        limit: int = 100,
        skip: int = 0,
        sort: Optional[List[tuple]] = None,
        *,
        allow_over_limit: bool = False
    ) -> List[Dict]:
        """
        Find multiple documents.
        
        RC6: Default limit=100, max 1000 unless allow_over_limit=True (prevents OOM).
        """
        if not allow_over_limit and limit > 1000:
            raise ValueError(
                "limit cannot exceed 1000. Use pagination or pass allow_over_limit=True for internal use."
            )
        projection = projection or {"_id": 0}
        cursor = self.collection.find(filters, projection)
        
        if sort:
            cursor = cursor.sort(sort)
        
        cursor = cursor.skip(skip).limit(limit)
        return await cursor.to_list(limit)
    
    async def find_iter(
        self,
        filters: Dict[str, Any],
        projection: Optional[Dict[str, int]] = None,
        sort: Optional[List[tuple]] = None
    ) -> AsyncIterator[Dict]:
        """
        Async iterator over documents (cursor-based, no limit). PHASE 8: avoids .collection in services.
        """
        projection = projection or {"_id": 0}
        cursor = self.collection.find(filters, projection)
        if sort:
            cursor = cursor.sort(sort)
        async for doc in cursor:
            yield doc
    
    async def count(self, filters: Dict[str, Any]) -> int:
        """Count documents matching filters"""
        return await self.collection.count_documents(filters)
    
    async def exists(self, filters: Dict[str, Any]) -> bool:
        """Check if document exists"""
        count = await self.collection.count_documents(filters, limit=1)
        return count > 0
    
    async def distinct(self, field: str, filters: Optional[Dict[str, Any]] = None) -> List:
        """
        Get distinct values for a field
        
        Args:
            field: Field name to get distinct values for
            filters: Optional query filters
            
        Returns:
            List of distinct values
        """
        return await self.collection.distinct(field, filters or {})
    
    # ===== WRITE OPERATIONS =====
    
    async def insert_one(self, document: Dict[str, Any]) -> str:
        """
        Insert a single document
        Returns the document id
        """
        result = await self.collection.insert_one(document)
        return document.get('id', str(result.inserted_id))
    
    async def insert_many(self, documents: List[Dict[str, Any]], ordered: bool = True) -> List[str]:
        """Insert multiple documents. ordered=False continues on duplicate key (e.g. sync logs)."""
        if not documents:
            return []
        
        result = await self.collection.insert_many(documents, ordered=ordered)
        return [doc.get('id') for doc in documents]
    
    async def update_one(
        self,
        filters: Dict[str, Any],
        update: Dict[str, Any],
        upsert: bool = False
    ) -> bool:
        """
        Update a single document
        Returns True if document was modified.
        Cache invalidation is the responsibility of the calling Service (context métier).
        """
        # Add updated_at timestamp
        if "$set" in update:
            update["$set"]["updated_at"] = datetime.now(timezone.utc)
        else:
            update["$set"] = {"updated_at": datetime.now(timezone.utc)}
        
        result = await self.collection.update_one(filters, update, upsert=upsert)
        return result.modified_count > 0 or (upsert and result.upserted_id is not None)
    
    async def update_many(
        self,
        filters: Dict[str, Any],
        update: Dict[str, Any]
    ) -> int:
        """
        Update multiple documents
        Returns number of documents modified.
        Cache invalidation is the responsibility of the calling Service.
        """
        result = await self.collection.update_many(filters, update)
        return result.modified_count
    
    async def delete_one(self, filters: Dict[str, Any]) -> bool:
        """
        Delete a single document
        Returns True if document was deleted.
        Cache invalidation is the responsibility of the calling Service.
        """
        result = await self.collection.delete_one(filters)
        return result.deleted_count > 0
    
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
