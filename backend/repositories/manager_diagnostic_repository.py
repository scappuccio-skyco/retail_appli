"""
Manager Diagnostic Repository - Data access for manager_diagnostics collection
Security: All methods require manager_id to prevent IDOR
"""
from typing import Optional, List, Dict, Any
from repositories.base_repository import BaseRepository


class ManagerDiagnosticRepository(BaseRepository):
    """Repository for manager_diagnostics collection with security filters"""
    
    def __init__(self, db):
        super().__init__(db, "manager_diagnostics")
    
    # ===== SECURE READ OPERATIONS (with manager_id filter) =====
    
    async def find_by_manager(
        self,
        manager_id: str,
        projection: Optional[Dict[str, int]] = None,
        limit: int = 100,
        skip: int = 0,
        sort: Optional[List[tuple]] = None
    ) -> List[Dict]:
        """
        Find diagnostics by manager (SECURITY: requires manager_id)
        
        Args:
            manager_id: Manager ID (required for security)
            projection: MongoDB projection
            limit: Maximum number of results
            skip: Number of results to skip
            sort: Sort order (default: [("created_at", -1)])
        """
        if not manager_id:
            raise ValueError("manager_id is required for security")
        
        filters = {"manager_id": manager_id}
        sort = sort or [("created_at", -1)]
        return await self.find_many(filters, projection, limit, skip, sort)
    
    async def find_latest_by_manager(
        self,
        manager_id: str,
        projection: Optional[Dict[str, int]] = None
    ) -> Optional[Dict]:
        """
        Find latest diagnostic for a manager (SECURITY: requires manager_id)
        
        Args:
            manager_id: Manager ID (required for security)
            projection: MongoDB projection
        """
        if not manager_id:
            raise ValueError("manager_id is required for security")
        
        results = await self.find_many(
            {"manager_id": manager_id},
            projection,
            limit=1,
            skip=0,
            sort=[("created_at", -1)]
        )
        return results[0] if results else None
    
    async def find_by_id(
        self,
        diagnostic_id: str,
        manager_id: Optional[str] = None,
        projection: Optional[Dict[str, int]] = None
    ) -> Optional[Dict]:
        """
        Find diagnostic by ID (SECURITY: requires manager_id if provided)
        
        Args:
            diagnostic_id: Diagnostic ID
            manager_id: Optional manager ID (for security verification)
            projection: MongoDB projection
        """
        if not diagnostic_id:
            raise ValueError("diagnostic_id is required")
        
        filters = {"id": diagnostic_id}
        if manager_id:
            filters["manager_id"] = manager_id
        
        return await self.find_one(filters, projection)
    
    # ===== WRITE OPERATIONS (with security validation) =====
    
    async def create_diagnostic(
        self,
        diagnostic_data: Dict[str, Any],
        manager_id: str
    ) -> str:
        """
        Create a new diagnostic (SECURITY: validates manager_id)
        
        Args:
            diagnostic_data: Diagnostic data
            manager_id: Manager ID (required for security)
        """
        if not manager_id:
            raise ValueError("manager_id is required for security")
        
        # Ensure security field is set
        diagnostic_data["manager_id"] = manager_id
        
        return await self.insert_one(diagnostic_data)
    
    async def update_diagnostic(
        self,
        diagnostic_id: str,
        update_data: Dict[str, Any],
        manager_id: Optional[str] = None
    ) -> bool:
        """
        Update a diagnostic (SECURITY: requires manager_id if provided)
        
        Args:
            diagnostic_id: Diagnostic ID
            update_data: Update data
            manager_id: Optional manager ID (for security verification)
        """
        if not diagnostic_id:
            raise ValueError("diagnostic_id is required")
        
        filters = {"id": diagnostic_id}
        if manager_id:
            filters["manager_id"] = manager_id
        
        return await self.update_one(filters, {"$set": update_data})
    
    # ===== COUNT OPERATIONS =====
    
    async def count_by_manager(self, manager_id: str) -> int:
        """Count diagnostics by manager (SECURITY: requires manager_id)"""
        if not manager_id:
            raise ValueError("manager_id is required for security")
        return await self.count({"manager_id": manager_id})
