"""
KPI Config Repository - Data access for kpi_configs collection
"""
from typing import Optional, Dict, Any
from datetime import datetime, timezone
from repositories.base_repository import BaseRepository


class KPIConfigRepository(BaseRepository):
    """Repository for kpi_configs collection"""
    
    def __init__(self, db):
        super().__init__(db, "kpi_configs")
    
    async def find_by_store(self, store_id: str) -> Optional[Dict]:
        """Find KPI config by store_id"""
        return await self.find_one({"store_id": store_id}, {"_id": 0})
    
    async def find_by_manager(self, manager_id: str) -> Optional[Dict]:
        """Find KPI config by manager_id"""
        return await self.find_one({"manager_id": manager_id}, {"_id": 0})
    
    async def find_by_store_or_manager(
        self,
        store_id: Optional[str] = None,
        manager_id: Optional[str] = None
    ) -> Optional[Dict]:
        """Find KPI config by store_id or manager_id (prefers store_id)"""
        if store_id:
            return await self.find_by_store(store_id)
        elif manager_id:
            return await self.find_by_manager(manager_id)
        return None
    
    async def upsert_config(
        self,
        store_id: Optional[str] = None,
        manager_id: Optional[str] = None,
        update_data: Optional[Dict[str, Any]] = None
    ) -> Dict:
        """
        Upsert KPI config (create or update)
        
        Args:
            store_id: Store ID (preferred)
            manager_id: Manager ID (fallback)
            update_data: Data to update
        
        Returns:
            Updated config dict
        """
        if not store_id and not manager_id:
            raise ValueError("store_id or manager_id is required")
        
        # Build query - prefer store_id, fallback to manager_id
        query = {}
        if store_id:
            query["store_id"] = store_id
        else:
            query["manager_id"] = manager_id
        
        update_data = update_data or {}
        
        # Upsert config
        await self.update_one(
            query,
            {
                "$set": update_data,
                "$setOnInsert": {
                    "store_id": store_id,
                    "manager_id": manager_id,
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
            },
            upsert=True
        )
        
        # Fetch and return updated config
        config = await self.find_one(query, {"_id": 0})
        
        return config or {
            "store_id": store_id,
            "enabled": update_data.get('enabled', True),
            "saisie_enabled": update_data.get('saisie_enabled', True)
        }
