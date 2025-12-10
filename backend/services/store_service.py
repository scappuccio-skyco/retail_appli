"""Store Service - Business logic for stores and workspaces"""
from typing import List, Dict, Optional
from datetime import datetime, timezone
from uuid import uuid4

from repositories.store_repository import StoreRepository, WorkspaceRepository
from repositories.user_repository import UserRepository


class StoreService:
    """Service for store and workspace management"""
    
    def __init__(self, db):
        self.store_repo = StoreRepository(db)
        self.workspace_repo = WorkspaceRepository(db)
        self.user_repo = UserRepository(db)
        self.db = db
    
    async def create_store(
        self,
        gerant_id: str,
        name: str,
        location: str,
        manager_id: Optional[str] = None
    ) -> Dict:
        """
        Create a new store
        
        Args:
            gerant_id: Gérant ID
            name: Store name
            location: Store location
            manager_id: Optional manager ID
            
        Returns:
            Created store
        """
        store = {
            "id": str(uuid4()),
            "name": name,
            "location": location,
            "gerant_id": gerant_id,
            "manager_id": manager_id,
            "active": True,
            "created_at": datetime.now(timezone.utc)
        }
        
        await self.store_repo.insert_one(store)
        return store
    
    async def get_store_hierarchy(self, store_id: str) -> Dict:
        """
        Get complete store hierarchy with users
        
        Args:
            store_id: Store ID
            
        Returns:
            Dict with store, manager, and sellers
        """
        # Get store
        store = await self.store_repo.find_by_id(store_id)
        if not store:
            return None
        
        # Get manager
        manager = None
        if store.get('manager_id'):
            manager = await self.user_repo.find_by_id(store['manager_id'])
        
        # Get sellers
        sellers = await self.user_repo.find_by_store(store_id)
        
        return {
            "store": store,
            "manager": manager,
            "sellers": sellers
        }
    
    async def transfer_manager(
        self,
        manager_id: str,
        from_store_id: str,
        to_store_id: str
    ) -> bool:
        """
        Transfer manager between stores
        
        Args:
            manager_id: Manager ID
            from_store_id: Source store ID
            to_store_id: Destination store ID
            
        Returns:
            True if successful
        """
        # Update manager's store
        await self.user_repo.update_one(
            {"id": manager_id},
            {"$set": {"store_id": to_store_id}}
        )
        
        # Update old store (remove manager)
        await self.store_repo.update_one(
            {"id": from_store_id},
            {"$set": {"manager_id": None}}
        )
        
        # Update new store (add manager)
        await self.store_repo.update_one(
            {"id": to_store_id},
            {"$set": {"manager_id": manager_id}}
        )
        
        return True
