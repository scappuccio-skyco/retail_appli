"""
User Repository - Data access for users collection
Security: All methods require store_id, gerant_id, or manager_id to prevent IDOR
"""
from typing import Optional, List, Dict, Any, AsyncIterator
from datetime import datetime, timezone
from repositories.base_repository import BaseRepository


class UserRepository(BaseRepository):
    """Repository for users collection with security filters"""
    
    def __init__(self, db):
        super().__init__(db, "users")
    
    # ===== SECURE READ OPERATIONS (with store_id/gerant_id/manager_id filter) =====
    
    async def find_by_id(
        self,
        user_id: str,
        store_id: Optional[str] = None,
        gerant_id: Optional[str] = None,
        manager_id: Optional[str] = None,
        include_password: bool = False
    ) -> Optional[Dict]:
        """
        Find user by ID (SECURITY: requires store_id, gerant_id, or manager_id for verification)
        
        Args:
            user_id: User ID
            store_id: Store ID (for security verification)
            gerant_id: Gérant ID (for security verification)
            manager_id: Manager ID (for security verification)
            include_password: Include password in result
        """
        if not user_id:
            raise ValueError("user_id is required")
        
        projection = {"_id": 0}
        if not include_password:
            projection["password"] = 0
        
        user = await self.find_one({"id": user_id}, projection)
        
        # Security: Verify access if security filters provided
        if user and (store_id or gerant_id or manager_id):
            if store_id and user.get("store_id") != store_id:
                return None  # User doesn't belong to this store
            if gerant_id and user.get("gerant_id") != gerant_id:
                return None  # User doesn't belong to this gérant
            if manager_id and user.get("manager_id") != manager_id:
                return None  # User doesn't belong to this manager
        
        return user
    
    async def find_by_email(self, email: str) -> Optional[Dict]:
        """
        Find user by email (SECURITY: No filter required for auth operations)
        Note: This is used for authentication, so no security filter needed
        """
        return await self.find_one({"email": email})
    
    async def find_by_store(
        self,
        store_id: str,
        role: Optional[str] = None,
        projection: Optional[Dict] = None,
        limit: int = 100,
        skip: int = 0
    ) -> List[Dict]:
        """
        Find all users in a store (SECURITY: requires store_id)
        
        Args:
            store_id: Store ID (required for security)
            role: Optional role filter
            projection: MongoDB projection
            limit: Maximum number of results
            skip: Number of results to skip
        """
        if not store_id:
            raise ValueError("store_id is required for security")
        
        filters = {"store_id": store_id}
        if role:
            filters["role"] = role
        
        return await self.find_many(filters, projection, limit, skip)
    
    async def find_by_gerant(
        self,
        gerant_id: str,
        role: Optional[str] = None,
        projection: Optional[Dict] = None,
        limit: int = 100,
        skip: int = 0
    ) -> List[Dict]:
        """
        Find all users under a gérant (SECURITY: requires gerant_id)
        
        Args:
            gerant_id: Gérant ID (required for security)
            role: Optional role filter
            projection: MongoDB projection
            limit: Maximum number of results
            skip: Number of results to skip
        """
        if not gerant_id:
            raise ValueError("gerant_id is required for security")
        
        filters = {"gerant_id": gerant_id}
        if role:
            filters["role"] = role
        
        return await self.find_many(filters, projection, limit, skip)
    
    async def find_by_manager(
        self,
        manager_id: str,
        store_id: Optional[str] = None,
        projection: Optional[Dict] = None,
        limit: int = 100,
        skip: int = 0
    ) -> List[Dict]:
        """
        Find all sellers under a manager (SECURITY: requires manager_id)
        
        Args:
            manager_id: Manager ID (required for security)
            store_id: Optional store filter (additional security layer)
            projection: MongoDB projection
            limit: Maximum number of results
            skip: Number of results to skip
        """
        if not manager_id:
            raise ValueError("manager_id is required for security")
        
        filters = {"manager_id": manager_id, "role": "seller"}
        if store_id:
            filters["store_id"] = store_id
        
        return await self.find_many(filters, projection, limit, skip)
    
    async def find_by_role(
        self,
        role: str,
        gerant_id: Optional[str] = None,
        store_id: Optional[str] = None,
        limit: int = 100,
        skip: int = 0
    ) -> List[Dict]:
        """
        Find all users with a specific role (SECURITY: requires gerant_id or store_id)
        
        Args:
            role: User role
            gerant_id: Gérant ID (required for security if store_id not provided)
            store_id: Store ID (required for security if gerant_id not provided)
            limit: Maximum number of results
            skip: Number of results to skip
        """
        if not gerant_id and not store_id:
            raise ValueError("gerant_id or store_id is required for security")
        
        filters = {"role": role}
        if gerant_id:
            filters["gerant_id"] = gerant_id
        if store_id:
            filters["store_id"] = store_id
        
        return await self.find_many(filters, limit=limit, skip=skip)
    
    # ===== COUNT OPERATIONS =====
    
    async def count_by_store(self, store_id: str, role: Optional[str] = None) -> int:
        """Count users in a store (SECURITY: requires store_id)"""
        if not store_id:
            raise ValueError("store_id is required for security")
        filters = {"store_id": store_id}
        if role:
            filters["role"] = role
        return await self.count(filters)
    
    async def count_by_gerant(self, gerant_id: str, role: Optional[str] = None) -> int:
        """Count users under a gérant (SECURITY: requires gerant_id)"""
        if not gerant_id:
            raise ValueError("gerant_id is required for security")
        filters = {"gerant_id": gerant_id}
        if role:
            filters["role"] = role
        return await self.count(filters)
    
    async def count_active_sellers(self, gerant_id: str) -> int:
        """Count active sellers for a gérant (SECURITY: requires gerant_id)"""
        if not gerant_id:
            raise ValueError("gerant_id is required for security")
        return await self.count({
            "gerant_id": gerant_id,
            "role": "seller",
            "status": "active"
        })
    
    # ===== PHASE 8: Iterator & complex update (no .collection in services) =====
    
    async def find_ids_by_query(self, query: Dict[str, Any]) -> AsyncIterator[str]:
        """
        Return an async iterator of user IDs matching the query (cursor-based, no limit).
        SECURITY: query must contain store_id, manager_id, or gerant_id to prevent full scan.
        """
        if not any(k in query for k in ("store_id", "manager_id", "gerant_id")):
            raise ValueError("query must contain store_id, manager_id, or gerant_id for security")
        projection = {"_id": 0, "id": 1}
        cursor = self.collection.find(query, projection)
        async for doc in cursor:
            if doc.get("id"):
                yield doc["id"]
    
    async def find_by_store_iter(
        self,
        store_id: str,
        role: Optional[str] = None,
        status_exclude: Optional[str] = None,
        projection: Optional[Dict[str, int]] = None
    ) -> AsyncIterator[Dict]:
        """
        Async iterator of users in a store (cursor-based, no limit).
        SECURITY: requires store_id.
        """
        if not store_id:
            raise ValueError("store_id is required for security")
        filters = {"store_id": store_id}
        if role:
            filters["role"] = role
        if status_exclude:
            filters["status"] = {"$ne": status_exclude}
        projection = projection or {"_id": 0, "password": 0}
        cursor = self.collection.find(filters, projection)
        async for doc in cursor:
            yield doc
    
    async def update_with_unset(
        self,
        filter: Dict[str, Any],
        set_data: Dict[str, Any],
        unset_data: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Update one document with $set and optional $unset (e.g. reactivate user).
        Returns True if document was modified. Invalidates cache.
        """
        set_data = dict(set_data)
        set_data["updated_at"] = datetime.now(timezone.utc)
        update = {"$set": set_data}
        if unset_data:
            update["$unset"] = {k: "" for k in unset_data}
        result = await self.collection.update_one(filter, update)
        modified = result.modified_count > 0
        if modified:
            await self._invalidate_cache_for_update(filter)
        return modified
    
    # ===== ADMIN OPERATIONS (Global search - Admin only) =====
    
    async def admin_find_all_paginated(
        self,
        role: Optional[str] = None,
        status: Optional[str] = None,
        projection: Optional[Dict] = None,
        limit: int = 100,
        skip: int = 0,
        sort: Optional[List[tuple]] = None
    ) -> List[Dict]:
        """
        Find all users with pagination (ADMIN ONLY - No security filter)
        
        Args:
            role: Optional role filter (e.g., "gerant", "manager", "seller")
            status: Optional status filter (e.g., "active", "suspended")
            projection: MongoDB projection
            limit: Maximum number of results (default: 100, max recommended: 100)
            skip: Number of results to skip
            sort: Optional sort order (default: [("created_at", -1)])
        """
        filters = {}
        if role:
            filters["role"] = role
        if status:
            filters["status"] = status
        
        if projection is None:
            projection = {"_id": 0, "password": 0}
        
        if sort is None:
            sort = [("created_at", -1)]
        
        return await self.find_many(filters, projection, limit, skip, sort)
    
    async def admin_count_all(
        self,
        role: Optional[str] = None,
        status: Optional[str] = None
    ) -> int:
        """
        Count all users (ADMIN ONLY - No security filter)
        
        Args:
            role: Optional role filter
            status: Optional status filter
        """
        filters = {}
        if role:
            filters["role"] = role
        if status:
            filters["status"] = status
        
        return await self.count(filters)
    
    # ===== UTILITY OPERATIONS (No security filter needed) =====
    
    async def email_exists(self, email: str) -> bool:
        """Check if email already exists (used for registration validation)"""
        return await self.exists({"email": email})
