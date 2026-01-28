"""
Gerant Invitation Repository - Data access for gerant_invitations collection
Security: All methods require gerant_id to prevent IDOR
"""
from typing import Optional, List, Dict, Any, AsyncIterator
from repositories.base_repository import BaseRepository


class GerantInvitationRepository(BaseRepository):
    """Repository for gerant_invitations collection with security filters"""
    
    def __init__(self, db):
        super().__init__(db, "gerant_invitations")
    
    async def find_by_gerant_iter(
        self,
        gerant_id: str,
        status: Optional[str] = None,
        projection: Optional[Dict[str, int]] = None
    ) -> AsyncIterator[Dict]:
        """
        Async iterator of invitations by gérant (cursor-based, no limit).
        SECURITY: requires gerant_id. PHASE 8: avoids limit=1000 in services.
        """
        if not gerant_id:
            raise ValueError("gerant_id is required for security")
        filters = {"gerant_id": gerant_id}
        if status:
            filters["status"] = status
        projection = projection or {"_id": 0}
        cursor = self.collection.find(filters, projection).sort("created_at", -1)
        async for doc in cursor:
            yield doc
    
    async def find_by_gerant(
        self,
        gerant_id: str,
        status: Optional[str] = None,
        projection: Optional[Dict[str, int]] = None,
        limit: int = 100,
        skip: int = 0,
        sort: Optional[List[tuple]] = None
    ) -> List[Dict]:
        """Find invitations by gérant (SECURITY: requires gerant_id)"""
        if not gerant_id:
            raise ValueError("gerant_id is required for security")
        
        filters = {"gerant_id": gerant_id}
        if status:
            filters["status"] = status
        
        sort = sort or [("created_at", -1)]
        return await self.find_many(filters, projection, limit, skip, sort)
    
    async def find_by_token(self, token: str, projection: Optional[Dict[str, int]] = None) -> Optional[Dict]:
        """Find invitation by token (for registration flow)"""
        if not token:
            raise ValueError("token is required")
        return await self.find_one({"token": token}, projection)
    
    async def find_by_email(
        self,
        email: str,
        gerant_id: Optional[str] = None,
        status: Optional[str] = None,
        projection: Optional[Dict[str, int]] = None
    ) -> Optional[Dict]:
        """Find invitation by email (SECURITY: requires gerant_id if provided)"""
        if not email:
            raise ValueError("email is required")
        
        filters = {"email": email}
        if gerant_id:
            filters["gerant_id"] = gerant_id
        if status:
            filters["status"] = status
        
        return await self.find_one(filters, projection)
    
    async def find_by_id(
        self,
        invitation_id: str,
        gerant_id: Optional[str] = None,
        projection: Optional[Dict[str, int]] = None
    ) -> Optional[Dict]:
        """Find invitation by ID (SECURITY: requires gerant_id if provided)"""
        if not invitation_id:
            raise ValueError("invitation_id is required")
        
        filters = {"id": invitation_id}
        if gerant_id:
            filters["gerant_id"] = gerant_id
        
        return await self.find_one(filters, projection)
    
    async def create_invitation(self, invitation_data: Dict[str, Any], gerant_id: str) -> str:
        """Create a new invitation (SECURITY: validates gerant_id)"""
        if not gerant_id:
            raise ValueError("gerant_id is required for security")
        invitation_data["gerant_id"] = gerant_id
        return await self.insert_one(invitation_data)
    
    async def update_invitation(
        self,
        invitation_id: str,
        update_data: Dict[str, Any],
        gerant_id: Optional[str] = None
    ) -> bool:
        """Update an invitation (SECURITY: requires gerant_id if provided)"""
        if not invitation_id:
            raise ValueError("invitation_id is required")
        
        filters = {"id": invitation_id}
        if gerant_id:
            filters["gerant_id"] = gerant_id
        
        return await self.update_one(filters, {"$set": update_data})
    
    async def update_by_token(self, token: str, update_data: Dict[str, Any]) -> bool:
        """Update an invitation by token (for registration flow)"""
        if not token:
            raise ValueError("token is required")
        return await self.update_one({"token": token}, {"$set": update_data})
    
    async def count_by_gerant(self, gerant_id: str, status: Optional[str] = None) -> int:
        """Count invitations by gérant (SECURITY: requires gerant_id)"""
        if not gerant_id:
            raise ValueError("gerant_id is required for security")
        
        filters = {"gerant_id": gerant_id}
        if status:
            filters["status"] = status
        
        return await self.count(filters)
    
    # ===== ADMIN OPERATIONS (Global search - Admin only) =====
    
    async def admin_find_all_paginated(
        self,
        status: Optional[str] = None,
        projection: Optional[Dict] = None,
        limit: int = 100,
        skip: int = 0,
        sort: Optional[List[tuple]] = None
    ) -> List[Dict]:
        """
        Find all gerant invitations with pagination (ADMIN ONLY - No security filter)
        
        Args:
            status: Optional status filter
            projection: MongoDB projection
            limit: Maximum number of results (default: 100, max recommended: 100)
            skip: Number of results to skip
            sort: Optional sort order (default: [("created_at", -1)])
        """
        filters = {}
        if status:
            filters["status"] = status
        
        if sort is None:
            sort = [("created_at", -1)]
        
        return await self.find_many(filters, projection, limit, skip, sort)
    
    async def admin_count_all(self, status: Optional[str] = None) -> int:
        """
        Count all gerant invitations (ADMIN ONLY - No security filter)
        
        Args:
            status: Optional status filter
        """
        filters = {}
        if status:
            filters["status"] = status
        
        return await self.count(filters)
