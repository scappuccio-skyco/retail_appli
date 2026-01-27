"""KPI Repository - Data access for KPI entries"""
from typing import Optional, List, Dict
from repositories.base_repository import BaseRepository


class KPIRepository(BaseRepository):
    """Repository for kpi_entries collection (seller KPIs)"""
    
    def __init__(self, db):
        super().__init__(db, "kpi_entries")
    
    async def find_by_seller_and_date(self, seller_id: str, date: str) -> Optional[Dict]:
        """Find KPI entry for a seller on a specific date"""
        return await self.find_one({"seller_id": seller_id, "date": date})
    
    async def find_by_seller(self, seller_id: str, limit: int = 1000) -> List[Dict]:
        """Find all KPI entries for a seller"""
        return await self.find_many(
            {"seller_id": seller_id},
            sort=[("date", -1)],
            limit=limit
        )
    
    async def find_by_date_range(self, seller_id: str, start_date: str, end_date: str) -> List[Dict]:
        """Find KPI entries for a seller within date range"""
        return await self.find_many({
            "seller_id": seller_id,
            "date": {"$gte": start_date, "$lte": end_date}
        }, sort=[("date", 1)])
    
    async def find_by_store(self, store_id: str, date: str) -> List[Dict]:
        """Find all KPI entries for a store on a specific date"""
        return await self.find_many({"store_id": store_id, "date": date})
    
    async def distinct_dates(self, query: Dict) -> List[str]:
        """
        Get distinct dates matching query (for calendar highlighting)
        
        Args:
            query: MongoDB query filter
        
        Returns:
            List of distinct date strings
        """
        # Motor's distinct() returns a coroutine that resolves to a list
        dates = await self.collection.distinct("date", query)
        return sorted(set(dates)) if dates else []
    
    async def find_locked_entries(self, query: Dict) -> List[str]:
        """
        Get distinct dates for locked entries matching query
        
        Args:
            query: MongoDB query filter (should include locked: True)
        
        Returns:
            List of distinct date strings for locked entries
        """
        return await self.distinct_dates(query)


class ManagerKPIRepository(BaseRepository):
    """Repository for manager_kpis collection"""
    
    def __init__(self, db):
        super().__init__(db, "manager_kpis")
    
    async def find_by_manager_and_date(self, manager_id: str, date: str) -> Optional[Dict]:
        """Find KPI entry for a manager on a specific date"""
        return await self.find_one({"manager_id": manager_id, "date": date})
    
    async def find_by_manager(self, manager_id: str, limit: int = 1000) -> List[Dict]:
        """Find all KPI entries for a manager"""
        return await self.find_many(
            {"manager_id": manager_id},
            sort=[("date", -1)],
            limit=limit
        )
    
    async def find_by_store_and_date(self, store_id: str, date: str) -> Optional[Dict]:
        """Find KPI entry for a store on a specific date"""
        return await self.find_one({"store_id": store_id, "date": date})
    
    async def distinct_dates(self, query: Dict) -> List[str]:
        """
        Get distinct dates matching query (for calendar highlighting)
        
        Args:
            query: MongoDB query filter
        
        Returns:
            List of distinct date strings
        """
        # Motor's distinct() returns a coroutine that resolves to a list
        dates = await self.collection.distinct("date", query)
        return sorted(set(dates)) if dates else []
    
    async def create_or_update(
        self,
        store_id: str,
        manager_id: str,
        date: str,
        entry_data: Dict
    ) -> str:
        """
        Create or update manager KPI entry
        
        Returns:
            Entry ID
        """
        existing = await self.find_by_store_and_date(store_id, date)
        
        if existing:
            await self.update_one(
                {"_id": existing.get("_id")},
                {"$set": entry_data}
            )
            return existing.get("id", str(existing.get("_id")))
        else:
            if "id" not in entry_data:
                import uuid
                entry_data["id"] = str(uuid.uuid4())
            if "created_at" not in entry_data:
                from datetime import datetime, timezone
                entry_data["created_at"] = datetime.now(timezone.utc).isoformat()
            
            return await self.insert_one(entry_data)
