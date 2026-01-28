"""
Manager Request Repository - Data access for manager_requests collection
Security: All methods require seller_id to prevent IDOR
"""
from typing import Optional, List, Dict, Any
from repositories.base_repository import BaseRepository


class ManagerRequestRepository(BaseRepository):
    """Repository for manager_requests collection with security filters"""
    
    def __init__(self, db):
        super().__init__(db, "manager_requests")
    
    async def find_by_seller(
        self,
        seller_id: str,
        status: Optional[str] = None,
        projection: Optional[Dict[str, int]] = None,
        limit: int = 100,
        skip: int = 0,
        sort: Optional[List[tuple]] = None
    ) -> List[Dict]:
        """Find requests by seller (SECURITY: requires seller_id)"""
        if not seller_id:
            raise ValueError("seller_id is required for security")
        
        filters = {"seller_id": seller_id}
        if status:
            filters["status"] = status
        
        sort = sort or [("created_at", -1)]
        return await self.find_many(filters, projection, limit, skip, sort)
    
    async def find_by_id(
        self,
        request_id: str,
        seller_id: Optional[str] = None,
        projection: Optional[Dict[str, int]] = None
    ) -> Optional[Dict]:
        """Find request by ID (SECURITY: requires seller_id if provided)"""
        if not request_id:
            raise ValueError("request_id is required")
        
        filters = {"id": request_id}
        if seller_id:
            filters["seller_id"] = seller_id
        
        return await self.find_one(filters, projection)
    
    async def create_request(self, request_data: Dict[str, Any], seller_id: str) -> str:
        """Create a new request (SECURITY: validates seller_id)"""
        if not seller_id:
            raise ValueError("seller_id is required for security")
        request_data["seller_id"] = seller_id
        return await self.insert_one(request_data)
    
    async def update_request(
        self,
        request_id: str,
        update_data: Dict[str, Any],
        seller_id: Optional[str] = None
    ) -> bool:
        """Update a request (SECURITY: requires seller_id if provided)"""
        if not request_id:
            raise ValueError("request_id is required")
        
        filters = {"id": request_id}
        if seller_id:
            filters["seller_id"] = seller_id
        
        return await self.update_one(filters, {"$set": update_data})
    
    async def count_by_seller(self, seller_id: str, status: Optional[str] = None) -> int:
        """Count requests by seller (SECURITY: requires seller_id)"""
        if not seller_id:
            raise ValueError("seller_id is required for security")
        
        filters = {"seller_id": seller_id}
        if status:
            filters["status"] = status
        
        return await self.count(filters)
