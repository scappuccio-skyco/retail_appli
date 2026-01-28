"""
Admin Log Repository
Database access layer for admin_logs collection
"""
from typing import List, Dict, Optional
from datetime import datetime, timezone
from repositories.base_repository import BaseRepository


class AdminLogRepository(BaseRepository):
    """Repository for admin_logs collection"""
    
    def __init__(self, db):
        super().__init__(db, "admin_logs")
    
    async def create_log(self, log_data: Dict) -> str:
        """
        Create an admin log entry
        
        Args:
            log_data: Dictionary with log data (id, timestamp, created_at will be auto-added if missing)
        """
        if "id" not in log_data:
            import uuid
            log_data["id"] = str(uuid.uuid4())
        if "timestamp" not in log_data:
            log_data["timestamp"] = datetime.now(timezone.utc).isoformat()
        if "created_at" not in log_data:
            log_data["created_at"] = datetime.now(timezone.utc).isoformat()
        return await self.insert_one(log_data)
    
    async def find_recent_logs(
        self,
        hours: int = 24,
        limit: int = 100,
        action: Optional[str] = None,
        admin_emails: Optional[List[str]] = None,
        sort: Optional[List[tuple]] = None
    ) -> List[Dict]:
        """
        Find recent admin logs within time window
        
        Args:
            hours: Number of hours to look back
            limit: Maximum number of logs to return
            action: Optional action filter
            admin_emails: Optional list of admin emails to filter
            sort: Optional sort order (default: [("timestamp", -1)])
        """
        from datetime import timedelta
        
        time_threshold = datetime.now(timezone.utc) - timedelta(hours=hours)
        
        filters = {"timestamp": {"$gte": time_threshold.isoformat()}}
        
        if action:
            filters["action"] = action
        
        if admin_emails:
            filters["admin_email"] = {"$in": admin_emails}
        
        if sort is None:
            sort = [("timestamp", -1)]
        
        return await self.find_many(filters, limit=limit, sort=sort)
    
    async def get_distinct_actions(self, hours: int = 24) -> List[str]:
        """Get distinct admin actions within time window"""
        from datetime import timedelta
        
        time_threshold = datetime.now(timezone.utc) - timedelta(hours=hours)
        
        return await self.distinct(
            "action",
            {"timestamp": {"$gte": time_threshold.isoformat()}}
        )
    
    async def get_distinct_admins(self, hours: int = 24) -> List[Dict]:
        """
        Get distinct admins from audit logs within time window
        
        Returns:
            List of dicts with email and name
        """
        from datetime import timedelta
        
        time_threshold = datetime.now(timezone.utc) - timedelta(hours=hours)
        
        pipeline = [
            {"$match": {
                "timestamp": {"$gte": time_threshold.isoformat()},
                "admin_email": {"$exists": True, "$ne": None, "$ne": ""}
            }},
            {"$group": {
                "_id": {
                    "admin_email": "$admin_email",
                    "admin_name": "$admin_name"
                }
            }},
            {"$project": {
                "_id": 0,
                "email": "$_id.admin_email",
                "name": "$_id.admin_name"
            }}
        ]
        
        return await self.aggregate(pipeline, max_results=1000)
