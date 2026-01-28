"""
Invitation Repository - Data access for invitations collection (manager invitations)
Security: All methods require store_id or manager_id to prevent IDOR
"""
from typing import Optional, List, Dict, Any
from repositories.base_repository import BaseRepository


class InvitationRepository(BaseRepository):
    """Repository for invitations collection with security filters"""
    
    def __init__(self, db):
        super().__init__(db, "invitations")
    
    async def find_by_store(
        self,
        store_id: str,
        projection: Optional[Dict[str, int]] = None,
        limit: int = 100,
        skip: int = 0,
        sort: Optional[List[tuple]] = None
    ) -> List[Dict]:
        """Find invitations by store (SECURITY: requires store_id)"""
        if not store_id:
            raise ValueError("store_id is required for security")
        
        filters = {"store_id": store_id}
        sort = sort or [("created_at", -1)]
        return await self.find_many(filters, projection, limit, skip, sort)
    
    async def find_by_manager(
        self,
        manager_id: str,
        status: Optional[str] = None,
        projection: Optional[Dict[str, int]] = None,
        limit: int = 100,
        skip: int = 0,
        sort: Optional[List[tuple]] = None
    ) -> List[Dict]:
        """Find invitations by manager (SECURITY: requires manager_id)"""
        if not manager_id:
            raise ValueError("manager_id is required for security")
        
        filters = {"invited_by": manager_id}
        if status:
            filters["status"] = status
        
        sort = sort or [("created_at", -1)]
        return await self.find_many(filters, projection, limit, skip, sort)
    
    async def find_by_id(
        self,
        invitation_id: str,
        store_id: Optional[str] = None,
        manager_id: Optional[str] = None,
        projection: Optional[Dict[str, int]] = None
    ) -> Optional[Dict]:
        """Find invitation by ID (SECURITY: requires store_id or manager_id)"""
        if not invitation_id:
            raise ValueError("invitation_id is required")
        
        filters = {"id": invitation_id}
        if store_id:
            filters["store_id"] = store_id
        elif manager_id:
            filters["invited_by"] = manager_id
        else:
            raise ValueError("store_id or manager_id is required for security")
        
        return await self.find_one(filters, projection)
    
    async def create_invitation(
        self,
        invitation_data: Dict[str, Any],
        store_id: str,
        manager_id: Optional[str] = None
    ) -> str:
        """Create a new invitation (SECURITY: validates store_id)"""
        if not store_id:
            raise ValueError("store_id is required for security")
        
        invitation_data["store_id"] = store_id
        if manager_id:
            invitation_data["invited_by"] = manager_id
        
        return await self.insert_one(invitation_data)
    
    async def update_invitation(
        self,
        invitation_id: str,
        update_data: Dict[str, Any],
        store_id: Optional[str] = None,
        manager_id: Optional[str] = None
    ) -> bool:
        """Update an invitation (SECURITY: requires store_id or manager_id)"""
        if not invitation_id:
            raise ValueError("invitation_id is required")
        
        filters = {"id": invitation_id}
        if store_id:
            filters["store_id"] = store_id
        elif manager_id:
            filters["invited_by"] = manager_id
        else:
            raise ValueError("store_id or manager_id is required for security")
        
        return await self.update_one(filters, {"$set": update_data})
    
    async def count_by_store(self, store_id: str) -> int:
        """Count invitations by store (SECURITY: requires store_id)"""
        if not store_id:
            raise ValueError("store_id is required for security")
        return await self.count({"store_id": store_id})
    
    async def count_by_manager(self, manager_id: str, status: Optional[str] = None) -> int:
        """Count invitations by manager (SECURITY: requires manager_id)"""
        if not manager_id:
            raise ValueError("manager_id is required for security")
        
        filters = {"invited_by": manager_id}
        if status:
            filters["status"] = status
        
        return await self.count(filters)
