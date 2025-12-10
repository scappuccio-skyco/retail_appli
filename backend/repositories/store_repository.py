"""Store & Workspace Repository"""
from typing import Optional, List, Dict
from repositories.base_repository import BaseRepository


class StoreRepository(BaseRepository):
    """Repository for stores collection"""
    
    def __init__(self, db):
        super().__init__(db, "stores")
    
    async def find_by_id(self, store_id: str) -> Optional[Dict]:
        """Find store by ID"""
        return await self.find_one({"id": store_id})
    
    async def find_by_gerant(self, gerant_id: str) -> List[Dict]:
        """Find all stores for a gérant"""
        return await self.find_many({"gerant_id": gerant_id})
    
    async def find_active_stores(self, gerant_id: str) -> List[Dict]:
        """Find active stores for a gérant"""
        return await self.find_many({"gerant_id": gerant_id, "active": True})


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
