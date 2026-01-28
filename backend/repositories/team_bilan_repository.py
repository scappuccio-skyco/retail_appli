"""
Team Bilan Repository - Data access for team_bilans collection
Security: All methods require manager_id and store_id to prevent IDOR
"""
from typing import Optional, List, Dict, Any
from repositories.base_repository import BaseRepository


class TeamBilanRepository(BaseRepository):
    """Repository for team_bilans collection with security filters"""
    
    def __init__(self, db):
        super().__init__(db, "team_bilans")
    
    async def find_by_manager(
        self,
        manager_id: str,
        store_id: str,
        projection: Optional[Dict[str, int]] = None,
        limit: int = 100,
        skip: int = 0,
        sort: Optional[List[tuple]] = None
    ) -> List[Dict]:
        """
        Find team bilans by manager and store (SECURITY: requires manager_id and store_id)
        
        Args:
            manager_id: Manager ID (required for security)
            store_id: Store ID (required for security)
            projection: MongoDB projection
            limit: Maximum number of results
            skip: Number of results to skip
            sort: Sort order (default: [("created_at", -1)])
        """
        if not manager_id or not store_id:
            raise ValueError("manager_id and store_id are required for security")
        
        filters = {"manager_id": manager_id, "store_id": store_id}
        sort = sort or [("created_at", -1)]
        return await self.find_many(filters, projection, limit, skip, sort)
    
    async def find_by_periode(
        self,
        manager_id: str,
        store_id: str,
        periode: str,
        projection: Optional[Dict[str, int]] = None
    ) -> Optional[Dict]:
        """
        Find team bilan by periode (SECURITY: requires manager_id and store_id)
        
        Args:
            manager_id: Manager ID (required for security)
            store_id: Store ID (required for security)
            periode: Period string (e.g., "Semaine du X au Y")
            projection: MongoDB projection
        """
        if not manager_id or not store_id or not periode:
            raise ValueError("manager_id, store_id, and periode are required")
        
        return await self.find_one(
            {"manager_id": manager_id, "store_id": store_id, "periode": periode},
            projection
        )
    
    async def create_bilan(
        self,
        bilan_data: Dict[str, Any],
        manager_id: str,
        store_id: str
    ) -> str:
        """
        Create a new team bilan (SECURITY: validates manager_id and store_id)
        
        Args:
            bilan_data: Bilan data
            manager_id: Manager ID (required for security)
            store_id: Store ID (required for security)
        """
        if not manager_id or not store_id:
            raise ValueError("manager_id and store_id are required for security")
        
        bilan_data["manager_id"] = manager_id
        bilan_data["store_id"] = store_id
        
        return await self.insert_one(bilan_data)
    
    async def upsert_bilan(
        self,
        manager_id: str,
        store_id: str,
        periode: str,
        bilan_data: Dict[str, Any]
    ) -> bool:
        """
        Upsert a team bilan (create if not exists, update if exists)
        
        Args:
            manager_id: Manager ID (required for security)
            store_id: Store ID (required for security)
            periode: Period string
            bilan_data: Bilan data
        """
        if not manager_id or not store_id or not periode:
            raise ValueError("manager_id, store_id, and periode are required")
        
        bilan_data["manager_id"] = manager_id
        bilan_data["store_id"] = store_id
        bilan_data["periode"] = periode
        
        filters = {"manager_id": manager_id, "store_id": store_id, "periode": periode}
        return await self.update_one(filters, {"$set": bilan_data}, upsert=True)
    
    async def count_by_manager(self, manager_id: str, store_id: str) -> int:
        """Count team bilans by manager and store (SECURITY: requires manager_id and store_id)"""
        if not manager_id or not store_id:
            raise ValueError("manager_id and store_id are required for security")
        return await self.count({"manager_id": manager_id, "store_id": store_id})
