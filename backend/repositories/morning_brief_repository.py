"""
Morning Brief Repository - Data access for morning briefs
Security: All methods require store_id or manager_id to prevent IDOR
"""
from typing import Optional, List, Dict, Any
from repositories.base_repository import BaseRepository


class MorningBriefRepository(BaseRepository):
    """Repository for morning_briefs collection with security filters"""
    
    def __init__(self, db):
        super().__init__(db, "morning_briefs")
    
    # ===== SECURE READ OPERATIONS (with store_id/manager_id filter) =====
    
    async def find_by_store(
        self,
        store_id: str,
        projection: Optional[Dict[str, int]] = None,
        limit: int = 30,
        skip: int = 0,
        sort: Optional[List[tuple]] = None
    ) -> List[Dict]:
        """
        Find morning briefs for a store (SECURITY: requires store_id)
        
        Args:
            store_id: Store ID (required for security)
            projection: MongoDB projection
            limit: Maximum number of results
            skip: Number of results to skip
            sort: Sort order (default: [("generated_at", -1)])
        """
        if not store_id:
            raise ValueError("store_id is required for security")
        
        filters = {"store_id": store_id}
        sort = sort or [("generated_at", -1)]
        return await self.find_many(filters, projection, limit, skip, sort)
    
    async def find_by_manager(
        self,
        manager_id: str,
        store_id: Optional[str] = None,
        projection: Optional[Dict[str, int]] = None,
        limit: int = 30,
        skip: int = 0,
        sort: Optional[List[tuple]] = None
    ) -> List[Dict]:
        """
        Find morning briefs for a manager (SECURITY: requires manager_id)
        
        Args:
            manager_id: Manager ID (required for security)
            store_id: Optional store filter (additional security layer)
            projection: MongoDB projection
            limit: Maximum number of results
            skip: Number of results to skip
            sort: Sort order (default: [("generated_at", -1)])
        """
        if not manager_id:
            raise ValueError("manager_id is required for security")
        
        filters = {"manager_id": manager_id}
        if store_id:
            filters["store_id"] = store_id
        
        sort = sort or [("generated_at", -1)]
        return await self.find_many(filters, projection, limit, skip, sort)
    
    async def find_by_id(
        self,
        brief_id: str,
        store_id: Optional[str] = None,
        manager_id: Optional[str] = None,
        projection: Optional[Dict[str, int]] = None
    ) -> Optional[Dict]:
        """
        Find morning brief by ID (SECURITY: requires store_id or manager_id)
        
        Args:
            brief_id: Brief ID
            store_id: Store ID (for security verification)
            manager_id: Manager ID (for security verification)
            projection: MongoDB projection
        """
        if not brief_id:
            raise ValueError("brief_id is required")
        
        filters = {"brief_id": brief_id}
        
        # Security: Require at least one filter
        if store_id:
            filters["store_id"] = store_id
        elif manager_id:
            filters["manager_id"] = manager_id
        else:
            raise ValueError("store_id or manager_id is required for security")
        
        return await self.find_one(filters, projection)
    
    # ===== WRITE OPERATIONS (with security validation) =====
    
    async def create_brief(
        self,
        brief_data: Dict[str, Any],
        store_id: str,
        manager_id: str
    ) -> str:
        """
        Create a new morning brief (SECURITY: validates store_id and manager_id)
        
        Args:
            brief_data: Brief data
            store_id: Store ID (required for security)
            manager_id: Manager ID (required for security)
        """
        if not store_id or not manager_id:
            raise ValueError("store_id and manager_id are required for security")
        
        # Ensure security fields are set
        brief_data["store_id"] = store_id
        brief_data["manager_id"] = manager_id
        
        return await self.insert_one(brief_data)
    
    async def delete_brief(
        self,
        brief_id: str,
        store_id: Optional[str] = None,
        manager_id: Optional[str] = None
    ) -> bool:
        """
        Delete a morning brief (SECURITY: requires store_id or manager_id)
        
        Args:
            brief_id: Brief ID
            store_id: Store ID (for security verification)
            manager_id: Manager ID (for security verification)
        """
        if not brief_id:
            raise ValueError("brief_id is required")
        
        filters = {"brief_id": brief_id}
        
        # Security: Require at least one filter
        if store_id:
            filters["store_id"] = store_id
        elif manager_id:
            filters["manager_id"] = manager_id
        else:
            raise ValueError("store_id or manager_id is required for security")
        
        return await self.delete_one(filters)
    
    # ===== COUNT OPERATIONS =====
    
    async def count_by_store(self, store_id: str) -> int:
        """Count morning briefs for a store (SECURITY: requires store_id)"""
        if not store_id:
            raise ValueError("store_id is required for security")
        return await self.count({"store_id": store_id})
    
    async def count_by_manager(self, manager_id: str, store_id: Optional[str] = None) -> int:
        """Count morning briefs for a manager (SECURITY: requires manager_id)"""
        if not manager_id:
            raise ValueError("manager_id is required for security")
        filters = {"manager_id": manager_id}
        if store_id:
            filters["store_id"] = store_id
        return await self.count(filters)
