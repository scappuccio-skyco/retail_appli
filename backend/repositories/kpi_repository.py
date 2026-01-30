"""KPI Repository - Data access for KPI entries and store-level kpis (legacy)"""
from typing import Optional, List, Dict
from repositories.base_repository import BaseRepository


class StoreKPIRepository(BaseRepository):
    """
    Repository for legacy store-level 'kpis' collection.
    Used by morning briefs for yesterday stats and week CA fallback.
    """
    def __init__(self, db):
        super().__init__(db, "kpis")

    async def find_one_with_ca(
        self,
        store_id: str,
        date: str,
        projection: Optional[Dict] = None
    ) -> Optional[Dict]:
        """Find one store KPI for store/date with CA > 0."""
        q = {"store_id": store_id, "date": date, "ca": {"$gt": 0}}
        return await self.find_one(q, projection or {"_id": 0, "date": 1})

    async def find_many_for_store(
        self,
        store_id: str,
        date: Optional[str] = None,
        date_range: Optional[Dict] = None,
        projection: Optional[Dict] = None,
        limit: int = 50,
        sort: Optional[List[tuple]] = None
    ) -> List[Dict]:
        """Find store KPIs by store_id, optional date or date range."""
        q = {"store_id": store_id}
        if date:
            q["date"] = date
        if date_range:
            q["date"] = date_range
        return await self.find_many(q, projection or {"_id": 0}, limit, 0, sort)


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
    
    async def find_by_store(
        self, store_id: str, date: str, projection: Optional[Dict] = None
    ) -> List[Dict]:
        """Find all KPI entries for a store on a specific date"""
        return await self.find_many(
            {"store_id": store_id, "date": date},
            projection=projection,
        )
    
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
    
    async def aggregate_totals(
        self,
        query: Dict,
        date_range: Optional[Dict] = None
    ) -> Dict:
        """
        Aggregate KPI totals using MongoDB aggregation (optimized - no .to_list(10000))
        
        Args:
            query: Base query filter (e.g., {"seller_id": {"$in": [...]}})
            date_range: Optional date range filter {"$gte": start_date, "$lte": end_date}
        
        Returns:
            Dict with aggregated totals: {
                "total_ca": float,
                "total_ventes": int,
                "total_articles": int,
                "total_clients": int,
                "total_prospects": int
            }
        """
        match_stage = {**query}
        if date_range:
            match_stage["date"] = date_range
        
        pipeline = [
            {"$match": match_stage},
            {"$group": {
                "_id": None,
                "total_ca": {"$sum": {"$ifNull": ["$ca_journalier", 0]}},
                "total_ventes": {"$sum": {"$ifNull": ["$nb_ventes", 0]}},
                "total_articles": {"$sum": {"$ifNull": ["$nb_articles", 0]}},
                "total_clients": {"$sum": {"$ifNull": ["$nb_clients", 0]}},
                "total_prospects": {"$sum": {"$ifNull": ["$nb_prospects", 0]}}
            }}
        ]
        
        result = await self.collection.aggregate(pipeline).to_list(1)
        if result and result[0]:
            return {
                "total_ca": result[0].get("total_ca", 0),
                "total_ventes": result[0].get("total_ventes", 0),
                "total_articles": result[0].get("total_articles", 0),
                "total_clients": result[0].get("total_clients", 0),
                "total_prospects": result[0].get("total_prospects", 0)
            }
        return {
            "total_ca": 0,
            "total_ventes": 0,
            "total_articles": 0,
            "total_clients": 0,
            "total_prospects": 0
        }


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
    
    async def aggregate_totals(
        self,
        query: Dict,
        date_range: Optional[Dict] = None
    ) -> Dict:
        """
        Aggregate manager KPI totals using MongoDB aggregation (optimized - no .to_list(10000))
        
        Args:
            query: Base query filter (e.g., {"manager_id": manager_id})
            date_range: Optional date range filter {"$gte": start_date, "$lte": end_date}
        
        Returns:
            Dict with aggregated totals: {
                "total_ca": float,
                "total_ventes": int,
                "total_articles": int,
                "total_prospects": int
            }
        """
        match_stage = {**query}
        if date_range:
            match_stage["date"] = date_range
        
        pipeline = [
            {"$match": match_stage},
            {"$group": {
                "_id": None,
                "total_ca": {"$sum": {"$ifNull": ["$ca_journalier", 0]}},
                "total_ventes": {"$sum": {"$ifNull": ["$nb_ventes", 0]}},
                "total_articles": {"$sum": {"$ifNull": ["$nb_articles", 0]}},
                "total_prospects": {"$sum": {"$ifNull": ["$nb_prospects", 0]}}
            }}
        ]
        
        result = await self.collection.aggregate(pipeline).to_list(1)
        if result and result[0]:
            return {
                "total_ca": result[0].get("total_ca", 0),
                "total_ventes": result[0].get("total_ventes", 0),
                "total_articles": result[0].get("total_articles", 0),
                "total_prospects": result[0].get("total_prospects", 0)
            }
        return {
            "total_ca": 0,
            "total_ventes": 0,
            "total_articles": 0,
            "total_prospects": 0
        }
