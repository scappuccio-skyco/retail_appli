"""Store Service - Business logic for stores and workspaces"""
import random
from typing import List, Dict, Optional
from datetime import datetime, timezone
from uuid import uuid4

from repositories.store_repository import StoreRepository, WorkspaceRepository
from repositories.user_repository import UserRepository


class StoreService:
    """Service for store and workspace management. Phase 0: repositories only, no self.db."""

    def __init__(
        self,
        store_repo: StoreRepository,
        workspace_repo: WorkspaceRepository,
        user_repo: UserRepository,
    ):
        self.store_repo = store_repo
        self.workspace_repo = workspace_repo
        self.user_repo = user_repo
    
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
    
    async def get_stores_by_gerant(self, gerant_id: str) -> List[Dict]:
        """
        Get all stores for a gérant
        
        Args:
            gerant_id: Gérant user ID
            
        Returns:
            List of stores
        """
        return await self.store_repo.find_by_gerant(gerant_id)
    
    async def get_store_by_id(self, store_id: str) -> Dict:
        """
        Get a store by its ID
        
        Args:
            store_id: Store ID
            
        Returns:
            Store dict or None
        """
        return await self.store_repo.find_by_id(store_id)
    
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
        from core.cache import invalidate_user_cache, invalidate_store_cache
        await invalidate_user_cache(manager_id)
        
        # Update old store (remove manager)
        await self.store_repo.update_one(
            {"id": from_store_id},
            {"$set": {"manager_id": None}}
        )
        await invalidate_store_cache(from_store_id)
        
        # Update new store (add manager)
        await self.store_repo.update_one(
            {"id": to_store_id},
            {"$set": {"manager_id": manager_id}}
        )
        await invalidate_store_cache(to_store_id)

        return True

    async def check_workspace_availability(self, name: str) -> Dict:
        """
        Check if a workspace name is available. Used by routes instead of instantiating WorkspaceRepository.
        """
        name = name.strip()
        if len(name) < 3:
            return {
                "available": False,
                "message": "Le nom doit contenir au moins 3 caractères",
            }
        existing = await self.workspace_repo.find_by_name_case_insensitive(name)
        if existing:
            suggestions = [
                f"{name}{random.randint(1, 99)}",
                f"{name}-{random.randint(100, 999)}",
                f"{name.lower().replace(' ', '-')}",
            ]
            return {
                "available": False,
                "message": "Ce nom est déjà utilisé",
                "suggestions": suggestions,
            }
        return {
            "available": True,
            "message": "Ce nom est disponible",
            "slug": name.lower().replace(" ", "-"),
        }
