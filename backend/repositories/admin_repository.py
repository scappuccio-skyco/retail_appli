"""
Admin Repository
Database access layer for SuperAdmin operations
"""
from typing import List, Dict, Optional
from datetime import datetime, timezone, timedelta


class AdminRepository:
    """Repository for SuperAdmin database operations"""
    
    def __init__(self, db):
        self.db = db
    
    async def get_all_workspaces(self) -> List[Dict]:
        """Get all workspaces"""
        return await self.db.workspaces.find({}, {"_id": 0}).to_list(1000)
    
    async def get_gerant_by_id(self, gerant_id: str) -> Optional[Dict]:
        """Get gérant user by ID"""
        return await self.db.users.find_one(
            {"id": gerant_id},
            {"_id": 0, "password": 0}
        )
    
    async def get_stores_by_gerant(self, gerant_id: str) -> List[Dict]:
        """Get all stores for a gérant"""
        return await self.db.stores.find(
            {"gerant_id": gerant_id},
            {"_id": 0}
        ).to_list(100)
    
    async def count_users_by_criteria(self, criteria: Dict) -> int:
        """Count users matching criteria"""
        return await self.db.users.count_documents(criteria)
    
    async def count_workspaces_by_criteria(self, criteria: Dict) -> int:
        """Count workspaces matching criteria"""
        return await self.db.workspaces.count_documents(criteria)
    
    async def count_diagnostics(self) -> int:
        """Count total diagnostics"""
        return await self.db.diagnostics.count_documents({})
    
    async def count_relationship_consultations(self) -> int:
        """Count AI relationship consultations"""
        try:
            return await self.db.relationship_consultations.count_documents({})
        except:
            return 0
    
    async def get_system_logs(
        self,
        time_threshold: datetime,
        limit: int
    ) -> List[Dict]:
        """Get system logs within time window"""
        # Try system_logs collection
        try:
            logs = await self.db.system_logs.find(
                {"timestamp": {"$gte": time_threshold.isoformat()}},
                {"_id": 0}
            ).sort("timestamp", -1).limit(limit).to_list(limit)
            if logs:
                return logs
        except:
            pass
        
        # Fallback to logs collection
        try:
            logs = await self.db.logs.find(
                {"timestamp": {"$gte": time_threshold.isoformat()}},
                {"_id": 0}
            ).sort("timestamp", -1).limit(limit).to_list(limit)
            return logs
        except:
            return []
