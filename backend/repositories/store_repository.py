"""
Store Repository - Data access for stores collection
Security: All methods require gerant_id to prevent IDOR
"""
from typing import Optional, List, Dict
from repositories.base_repository import BaseRepository


class StoreRepository(BaseRepository):
    """Repository for stores collection with security filters"""
    
    def __init__(self, db):
        super().__init__(db, "stores")
    
    # ===== SECURE READ OPERATIONS (with gerant_id filter) =====
    
    async def find_by_id(
        self,
        store_id: str,
        gerant_id: Optional[str] = None,
        projection: Optional[Dict] = None
    ) -> Optional[Dict]:
        """
        Find store by ID (SECURITY: requires gerant_id for verification)
        
        Args:
            store_id: Store ID
            gerant_id: Gérant ID (for security verification)
            projection: MongoDB projection
        """
        if not store_id:
            raise ValueError("store_id is required")
        
        store = await self.find_one({"id": store_id}, projection)
        
        # Security: Verify ownership if gerant_id provided
        if store and gerant_id:
            if store.get("gerant_id") != gerant_id:
                return None  # Store doesn't belong to this gérant
        
        return store
    
    async def find_by_gerant(
        self,
        gerant_id: str,
        active_only: bool = False,
        projection: Optional[Dict] = None,
        limit: int = 100,
        skip: int = 0
    ) -> List[Dict]:
        """
        Find all stores for a gérant (SECURITY: requires gerant_id)
        
        Args:
            gerant_id: Gérant ID (required for security)
            active_only: Filter only active stores
            projection: MongoDB projection
            limit: Maximum number of results
            skip: Number of results to skip
        """
        if not gerant_id:
            raise ValueError("gerant_id is required for security")
        
        filters = {"gerant_id": gerant_id}
        if active_only:
            filters["active"] = True
        
        return await self.find_many(filters, projection, limit, skip)
    
    async def find_active_stores(
        self,
        gerant_id: str,
        projection: Optional[Dict] = None,
        limit: int = 100,
        skip: int = 0
    ) -> List[Dict]:
        """
        Find active stores for a gérant (SECURITY: requires gerant_id)
        
        Args:
            gerant_id: Gérant ID (required for security)
            projection: MongoDB projection
            limit: Maximum number of results
            skip: Number of results to skip
        """
        if not gerant_id:
            raise ValueError("gerant_id is required for security")
        
        return await self.find_many(
            {"gerant_id": gerant_id, "active": True},
            projection,
            limit,
            skip
        )
    
    # ===== COUNT OPERATIONS =====
    
    async def count_by_gerant(self, gerant_id: str, active_only: bool = False) -> int:
        """Count stores for a gérant (SECURITY: requires gerant_id)"""
        if not gerant_id:
            raise ValueError("gerant_id is required for security")
        filters = {"gerant_id": gerant_id}
        if active_only:
            filters["active"] = True
        return await self.count(filters)
    
    # ===== ADMIN OPERATIONS (Global search - Admin only) =====
    
    async def admin_find_all_paginated(
        self,
        active_only: Optional[bool] = None,
        gerant_id: Optional[str] = None,
        projection: Optional[Dict] = None,
        limit: int = 100,
        skip: int = 0,
        sort: Optional[List[tuple]] = None
    ) -> List[Dict]:
        """
        Find all stores with pagination (ADMIN ONLY - No security filter)
        
        Args:
            active_only: Optional filter for active stores only
            gerant_id: Optional filter by gérant_id
            projection: MongoDB projection
            limit: Maximum number of results (default: 100, max recommended: 100)
            skip: Number of results to skip
            sort: Optional sort order (default: [("created_at", -1)])
        """
        filters = {}
        if active_only is not None:
            filters["active"] = active_only
        if gerant_id:
            filters["gerant_id"] = gerant_id
        
        if sort is None:
            sort = [("created_at", -1)]
        
        return await self.find_many(filters, projection, limit, skip, sort)
    
    async def admin_count_all(
        self,
        active_only: Optional[bool] = None,
        gerant_id: Optional[str] = None
    ) -> int:
        """
        Count all stores (ADMIN ONLY - No security filter)
        
        Args:
            active_only: Optional filter for active stores only
            gerant_id: Optional filter by gérant_id
        """
        filters = {}
        if active_only is not None:
            filters["active"] = active_only
        if gerant_id:
            filters["gerant_id"] = gerant_id
        
        return await self.count(filters)


class WorkspaceRepository(BaseRepository):
    """Repository for workspaces collection"""
    
    def __init__(self, db):
        super().__init__(db, "workspaces")
    
    async def find_by_id(
        self, workspace_id: str, projection: Optional[Dict] = None
    ) -> Optional[Dict]:
        """Find workspace by ID"""
        return await self.find_one({"id": workspace_id}, projection)
    
    async def find_by_gerant(self, gerant_id: str) -> Optional[Dict]:
        """Find workspace by gérant ID"""
        return await self.find_one({"gerant_id": gerant_id})
    
    async def find_by_stripe_customer(self, stripe_customer_id: str) -> Optional[Dict]:
        """Find workspace by Stripe customer ID"""
        return await self.find_one({"stripe_customer_id": stripe_customer_id})

    async def find_by_name_case_insensitive(self, name: str, projection: Optional[Dict] = None) -> Optional[Dict]:
        """Find workspace by name (case-insensitive). Used for availability check."""
        return await self.find_one(
            {"name": {"$regex": f"^{name}$", "$options": "i"}},
            projection or {"_id": 0, "id": 1}
        )

    async def update_by_id(self, workspace_id: str, update_data: Dict) -> bool:
        """Update workspace by ID (e.g. subscription_status)."""
        return await self.update_one({"id": workspace_id}, {"$set": update_data})
