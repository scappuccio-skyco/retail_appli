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
        Returns number of documents modified
        """
        result = await self.collection.update_many(filters, update)
        return result.modified_count
    
    async def delete_one(self, filters: Dict[str, Any]) -> bool:
        """
        Delete a single document
        Returns True if document was deleted
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
    
    async def aggregate(self, pipeline: List[Dict]) -> List[Dict]:
        """
        Run aggregation pipeline
        
        Args:
            pipeline: MongoDB aggregation pipeline
            
        Returns:
            List of aggregation results
        """
        cursor = self.collection.aggregate(pipeline)
        return await cursor.to_list(None)
    
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
