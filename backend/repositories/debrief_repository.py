"""
Debrief Repository - Data access for seller debriefs
Security: All methods require seller_id or store_id to prevent IDOR
"""
from typing import Optional, List, Dict, Any
from repositories.base_repository import BaseRepository


class DebriefRepository(BaseRepository):
    """Repository for debriefs collection with security filters"""
    
    def __init__(self, db):
        super().__init__(db, "debriefs")
    
    # ===== SECURE READ OPERATIONS (with seller_id/store_id filter) =====
    
    async def find_by_seller(
        self,
        seller_id: str,
        projection: Optional[Dict[str, int]] = None,
        limit: int = 100,
        skip: int = 0,
        sort: Optional[List[tuple]] = None
    ) -> List[Dict]:
        """
        Find debriefs for a seller (SECURITY: requires seller_id)
        
        Args:
            seller_id: Seller ID (required for security)
            projection: MongoDB projection
            limit: Maximum number of results
            skip: Number of results to skip
            sort: Sort order (default: [("created_at", -1)])
        """
        if not seller_id:
            raise ValueError("seller_id is required for security")
        
        filters = {"seller_id": seller_id}
        sort = sort or [("created_at", -1)]
        return await self.find_many(filters, projection, limit, skip, sort)
    
    async def find_by_store(
        self,
        store_id: str,
        seller_ids: Optional[List[str]] = None,
        visible_to_manager: Optional[bool] = None,
        projection: Optional[Dict[str, int]] = None,
        limit: int = 100,
        skip: int = 0,
        sort: Optional[List[tuple]] = None
    ) -> List[Dict]:
        """
        Find debriefs for a store (SECURITY: requires store_id and seller_ids)
        
        Args:
            store_id: Store ID (required for security)
            seller_ids: List of seller IDs in the store (required for security)
            visible_to_manager: Filter by visibility to manager (optional)
            projection: MongoDB projection
            limit: Maximum number of results
            skip: Number of results to skip
            sort: Sort order (default: [("created_at", -1)])
        """
        if not store_id:
            raise ValueError("store_id is required for security")
        
        if not seller_ids:
            raise ValueError("seller_ids are required for security (prevents access to all debriefs)")
        
        filters = {"seller_id": {"$in": seller_ids}}
        
        # Additional filter for manager visibility
        if visible_to_manager is not None:
            # Support both field names for compatibility
            filters["$or"] = [
                {"visible_to_manager": visible_to_manager},
                {"shared_with_manager": visible_to_manager}
            ]
        
        sort = sort or [("created_at", -1)]
        return await self.find_many(filters, projection, limit, skip, sort)
    
    async def find_by_id(
        self,
        debrief_id: str,
        seller_id: Optional[str] = None,
        store_id: Optional[str] = None,
        seller_ids: Optional[List[str]] = None,
        projection: Optional[Dict[str, int]] = None
    ) -> Optional[Dict]:
        """
        Find debrief by ID (SECURITY: requires seller_id or store_id + seller_ids)
        
        Args:
            debrief_id: Debrief ID
            seller_id: Seller ID (for security verification)
            store_id: Store ID (for security verification, requires seller_ids)
            seller_ids: List of seller IDs (required if using store_id)
            projection: MongoDB projection
        """
        if not debrief_id:
            raise ValueError("debrief_id is required")
        
        filters = {"id": debrief_id}
        
        # Security: Require at least one filter
        if seller_id:
            filters["seller_id"] = seller_id
        elif store_id:
            if not seller_ids:
                raise ValueError("seller_ids are required when using store_id for security")
            filters["seller_id"] = {"$in": seller_ids}
        else:
            raise ValueError("seller_id or (store_id + seller_ids) is required for security")
        
        return await self.find_one(filters, projection)
    
    async def find_by_seller_and_date(
        self,
        seller_id: str,
        date: str,
        projection: Optional[Dict[str, int]] = None
    ) -> Optional[Dict]:
        """
        Find debrief for a seller on a specific date (SECURITY: requires seller_id)
        
        Args:
            seller_id: Seller ID (required for security)
            date: Date in format YYYY-MM-DD
            projection: MongoDB projection
        """
        if not seller_id:
            raise ValueError("seller_id is required for security")
        
        # Extract date part from created_at (if stored as datetime)
        # Or match by date string if stored as string
        filters = {"seller_id": seller_id}
        
        # Try to match by date (assuming created_at is datetime)
        # This is a simplified version - adjust based on your date storage format
        return await self.find_one(filters, projection)
    
    # ===== WRITE OPERATIONS (with security validation) =====
    
    async def create_debrief(
        self,
        debrief_data: Dict[str, Any],
        seller_id: str
    ) -> str:
        """
        Create a new debrief (SECURITY: validates seller_id)
        
        Args:
            debrief_data: Debrief data
            seller_id: Seller ID (required for security)
        """
        if not seller_id:
            raise ValueError("seller_id is required for security")
        
        # Ensure security field is set
        debrief_data["seller_id"] = seller_id
        
        return await self.insert_one(debrief_data)
    
    async def update_debrief(
        self,
        debrief_id: str,
        update_data: Dict[str, Any],
        seller_id: Optional[str] = None,
        store_id: Optional[str] = None,
        seller_ids: Optional[List[str]] = None
    ) -> bool:
        """
        Update a debrief (SECURITY: requires seller_id or store_id + seller_ids)
        
        Args:
            debrief_id: Debrief ID
            update_data: Update data
            seller_id: Seller ID (for security verification)
            store_id: Store ID (for security verification, requires seller_ids)
            seller_ids: List of seller IDs (required if using store_id)
        """
        if not debrief_id:
            raise ValueError("debrief_id is required")
        
        filters = {"id": debrief_id}
        
        # Security: Require at least one filter
        if seller_id:
            filters["seller_id"] = seller_id
        elif store_id:
            if not seller_ids:
                raise ValueError("seller_ids are required when using store_id for security")
            filters["seller_id"] = {"$in": seller_ids}
        else:
            raise ValueError("seller_id or (store_id + seller_ids) is required for security")
        
        return await self.update_one(filters, {"$set": update_data})
    
    async def delete_debrief(
        self,
        debrief_id: str,
        seller_id: Optional[str] = None,
        store_id: Optional[str] = None,
        seller_ids: Optional[List[str]] = None
    ) -> bool:
        """
        Delete a debrief (SECURITY: requires seller_id or store_id + seller_ids)
        
        Args:
            debrief_id: Debrief ID
            seller_id: Seller ID (for security verification)
            store_id: Store ID (for security verification, requires seller_ids)
            seller_ids: List of seller IDs (required if using store_id)
        """
        if not debrief_id:
            raise ValueError("debrief_id is required")
        
        filters = {"id": debrief_id}
        
        # Security: Require at least one filter
        if seller_id:
            filters["seller_id"] = seller_id
        elif store_id:
            if not seller_ids:
                raise ValueError("seller_ids are required when using store_id for security")
            filters["seller_id"] = {"$in": seller_ids}
        else:
            raise ValueError("seller_id or (store_id + seller_ids) is required for security")
        
        return await self.delete_one(filters)
    
    # ===== COUNT OPERATIONS =====
    
    async def count_by_seller(self, seller_id: str) -> int:
        """Count debriefs for a seller (SECURITY: requires seller_id)"""
        if not seller_id:
            raise ValueError("seller_id is required for security")
        return await self.count({"seller_id": seller_id})
    
    async def count_by_store(
        self,
        store_id: str,
        seller_ids: List[str]
    ) -> int:
        """Count debriefs for a store (SECURITY: requires store_id and seller_ids)"""
        if not store_id:
            raise ValueError("store_id is required for security")
        if not seller_ids:
            raise ValueError("seller_ids are required for security")
        return await self.count({"seller_id": {"$in": seller_ids}})
