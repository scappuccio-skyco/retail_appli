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


class WorkspaceRepository(BaseRepository):
    """Repository for workspaces collection"""
    
    def __init__(self, db):
        super().__init__(db, "workspaces")
    
    async def find_by_id(self, workspace_id: str) -> Optional[Dict]:
        """Find workspace by ID"""
        return await self.find_one({"id": workspace_id})
    
    async def find_by_gerant(self, gerant_id: str) -> Optional[Dict]:
        """Find workspace by gérant ID"""
        return await self.find_one({"gerant_id": gerant_id})
    
    async def find_by_stripe_customer(self, stripe_customer_id: str) -> Optional[Dict]:
        """Find workspace by Stripe customer ID"""
        return await self.find_one({"stripe_customer_id": stripe_customer_id})
