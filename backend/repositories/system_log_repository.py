"""System Log Repository"""
from typing import Optional, List, Dict
from datetime import datetime, timezone
from repositories.base_repository import BaseRepository


class SystemLogRepository(BaseRepository):
    """Repository for system_logs collection"""
    
    def __init__(self, db):
        super().__init__(db, "system_logs")
    
    async def create_log(self, log_data: Dict) -> str:
        """Create a system log entry"""
        if "id" not in log_data:
            import uuid
            log_data["id"] = str(uuid.uuid4())
        if "timestamp" not in log_data:
            log_data["timestamp"] = datetime.now(timezone.utc).isoformat()
        return await self.insert_one(log_data)
    
    async def find_recent_logs(self, limit: int = 100, filters: Optional[Dict] = None) -> List[Dict]:
        """Find recent system logs"""
        query = filters or {}
        return await self.find_many(
            query,
            sort=[("timestamp", -1)],
            limit=limit
        )
