"""
Objective Repository - Data access for manager objectives
Security: All methods require store_id or manager_id to prevent IDOR
"""
from typing import Optional, List, Dict, Any
from repositories.base_repository import BaseRepository


class ObjectiveRepository(BaseRepository):
    """Repository for objectives collection with security filters"""
    
    def __init__(self, db):
        super().__init__(db, "objectives")
    
    # ===== SECURE READ OPERATIONS (with store_id/manager_id filter) =====
    
    async def find_by_store(
        self,
        store_id: str,
        projection: Optional[Dict[str, int]] = None,
        limit: int = 100,
        skip: int = 0,
        sort: Optional[List[tuple]] = None
    ) -> List[Dict]:
        """
        Find objectives for a store (SECURITY: requires store_id)
        
        Args:
            store_id: Store ID (required for security)
            projection: MongoDB projection
            limit: Maximum number of results
            skip: Number of results to skip
            sort: Sort order (default: [("created_at", -1)])
        """
        if not store_id:
            raise ValueError("store_id is required for security")
        
        filters = {"store_id": store_id}
        sort = sort or [("created_at", -1)]
        return await self.find_many(filters, projection, limit, skip, sort)
    
    async def find_by_manager(
        self,
        manager_id: str,
        store_id: Optional[str] = None,
        projection: Optional[Dict[str, int]] = None,
        limit: int = 100,
        skip: int = 0,
        sort: Optional[List[tuple]] = None
    ) -> List[Dict]:
        """
        Find objectives for a manager (SECURITY: requires manager_id)
        
        Args:
            manager_id: Manager ID (required for security)
            store_id: Optional store filter (additional security layer)
            projection: MongoDB projection
            limit: Maximum number of results
            skip: Number of results to skip
            sort: Sort order (default: [("created_at", -1)])
        """
        if not manager_id:
            raise ValueError("manager_id is required for security")
        
        filters = {"manager_id": manager_id}
        if store_id:
            filters["store_id"] = store_id
        
        sort = sort or [("created_at", -1)]
        return await self.find_many(filters, projection, limit, skip, sort)
    
    async def find_by_seller(
        self,
        seller_id: str,
        store_id: str,
        projection: Optional[Dict[str, int]] = None,
        limit: int = 100,
        skip: int = 0,
        sort: Optional[List[tuple]] = None
    ) -> List[Dict]:
        """
        Find objectives visible to a seller (SECURITY: requires seller_id and store_id)
        
        Args:
            seller_id: Seller ID
            store_id: Store ID (required for security)
            projection: MongoDB projection
            limit: Maximum number of results
            skip: Number of results to skip
            sort: Sort order
        """
        if not seller_id or not store_id:
            raise ValueError("seller_id and store_id are required for security")
        
        filters = {
            "store_id": store_id,
            "$or": [
                {"seller_id": seller_id},  # Individual objective
                {"type": "collective", "visible": True}  # Collective visible objective
            ]
        }
        sort = sort or [("created_at", -1)]
        return await self.find_many(filters, projection, limit, skip, sort)
    
    async def find_by_id(
        self,
        objective_id: str,
        store_id: Optional[str] = None,
        manager_id: Optional[str] = None,
        projection: Optional[Dict[str, int]] = None
    ) -> Optional[Dict]:
        """
        Find objective by ID (SECURITY: requires store_id or manager_id)
        
        Args:
            objective_id: Objective ID
            store_id: Store ID (for security verification)
            manager_id: Manager ID (for security verification)
            projection: MongoDB projection
        """
        if not objective_id:
            raise ValueError("objective_id is required")
        
        filters = {"id": objective_id}
        
        # Security: Require at least one filter
        if store_id:
            filters["store_id"] = store_id
        elif manager_id:
            filters["manager_id"] = manager_id
        else:
            raise ValueError("store_id or manager_id is required for security")
        
        return await self.find_one(filters, projection)
    
    async def find_by_store_and_status(
        self,
        store_id: str,
        status: str,
        projection: Optional[Dict[str, int]] = None,
        limit: int = 100,
        skip: int = 0,
        sort: Optional[List[tuple]] = None
    ) -> List[Dict]:
        """
        Find objectives by store and status (SECURITY: requires store_id)
        
        Args:
            store_id: Store ID (required for security)
            status: Objective status (active, achieved, failed)
            projection: MongoDB projection
            limit: Maximum number of results
            skip: Number of results to skip
            sort: Sort order
        """
        if not store_id:
            raise ValueError("store_id is required for security")
        
        filters = {"store_id": store_id, "status": status}
        sort = sort or [("created_at", -1)]
        return await self.find_many(filters, projection, limit, skip, sort)
    
    # ===== WRITE OPERATIONS (with security validation) =====
    
    async def create_objective(
        self,
        objective_data: Dict[str, Any],
        store_id: str,
        manager_id: str
    ) -> str:
        """
        Create a new objective (SECURITY: validates store_id and manager_id)
        
        Args:
            objective_data: Objective data
            store_id: Store ID (required for security)
            manager_id: Manager ID (required for security)
        """
        if not store_id or not manager_id:
            raise ValueError("store_id and manager_id are required for security")
        
        # Ensure security fields are set
        objective_data["store_id"] = store_id
        objective_data["manager_id"] = manager_id
        
        return await self.insert_one(objective_data)
    
    async def update_objective(
        self,
        objective_id: str,
        update_data: Dict[str, Any],
        store_id: Optional[str] = None,
        manager_id: Optional[str] = None
    ) -> bool:
        """
        Update an objective (SECURITY: requires store_id or manager_id)
        
        Args:
            objective_id: Objective ID
            update_data: Update data
            store_id: Store ID (for security verification)
            manager_id: Manager ID (for security verification)
        """
        if not objective_id:
            raise ValueError("objective_id is required")
        
        filters = {"id": objective_id}
        
        # Security: Require at least one filter
        if store_id:
            filters["store_id"] = store_id
        elif manager_id:
            filters["manager_id"] = manager_id
        else:
            raise ValueError("store_id or manager_id is required for security")
        
        return await self.update_one(filters, {"$set": update_data})
    
    async def delete_objective(
        self,
        objective_id: str,
        store_id: Optional[str] = None,
        manager_id: Optional[str] = None
    ) -> bool:
        """
        Delete an objective (SECURITY: requires store_id or manager_id)
        
        Args:
            objective_id: Objective ID
            store_id: Store ID (for security verification)
            manager_id: Manager ID (for security verification)
        """
        if not objective_id:
            raise ValueError("objective_id is required")
        
        filters = {"id": objective_id}
        
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
        """Count objectives for a store (SECURITY: requires store_id)"""
        if not store_id:
            raise ValueError("store_id is required for security")
        return await self.count({"store_id": store_id})
    
    async def count_by_manager(self, manager_id: str, store_id: Optional[str] = None) -> int:
        """Count objectives for a manager (SECURITY: requires manager_id)"""
        if not manager_id:
            raise ValueError("manager_id is required for security")
        filters = {"manager_id": manager_id}
        if store_id:
            filters["store_id"] = store_id
        return await self.count(filters)
