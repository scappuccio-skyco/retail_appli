"""
Admin Repository
Database access layer for SuperAdmin operations.

Multi-collection facade: accesses workspaces, users, stores, admin_logs,
system_logs, logs, relationship_consultations, diagnostics. Does not inherit
BaseRepository (single-collection pattern); structure kept consistent with
other repositories (db injection, logger).

Phase 3: Pagination obligatoire pour listes (get_all_workspaces_paginated).
"""
import logging
from typing import List, Dict, Optional
from datetime import datetime, timezone, timedelta

from utils.pagination import paginate
from models.pagination import PaginatedResponse

logger = logging.getLogger(__name__)


class AdminRepository:
    """Multi-collection repository for SuperAdmin database operations."""

    def __init__(self, db):
        self.db = db
    
    async def get_all_workspaces(self, include_deleted: bool = False) -> List[Dict]:
        """Get all workspaces (legacy, non-paginated; max 1000).
        Prefer get_all_workspaces_paginated for scalability."""
        if include_deleted:
            return await self.db.workspaces.find({}, {"_id": 0}).to_list(1000)
        return await self.db.workspaces.find(
            {"$or": [
                {"status": {"$ne": "deleted"}},
                {"status": {"$exists": False}}
            ]},
            {"_id": 0}
        ).to_list(1000)

    async def get_all_workspaces_paginated(
        self,
        page: int = 1,
        size: int = 50,
        include_deleted: bool = False,
    ) -> PaginatedResponse[Dict]:
        """Get workspaces paginated (Phase 3: scalable admin)."""
        query: Dict = {}
        if not include_deleted:
            query = {
                "$or": [
                    {"status": {"$ne": "deleted"}},
                    {"status": {"$exists": False}}
                ]
            }
        return await paginate(
            self.db.workspaces,
            query,
            page=page,
            size=size,
            projection={"_id": 0},
            sort=[("created_at", -1)],
        )

    async def get_gerant_by_id(self, gerant_id: str) -> Optional[Dict]:
        """Get gérant user by ID"""
        return await self.db.users.find_one(
            {"id": gerant_id},
            {"_id": 0, "password": 0}
        )
    
    async def get_stores_by_gerant(self, gerant_id: str) -> List[Dict]:
        """Get all stores for a gérant"""
        if not gerant_id:
            return []
        return await self.db.stores.find(
            {"gerant_id": gerant_id},
            {"_id": 0}
        ).to_list(100)
    
    async def get_stores_by_workspace(self, workspace_id: str) -> List[Dict]:
        """Get all stores for a workspace (by workspace_id field)"""
        if not workspace_id:
            return []
        return await self.db.stores.find(
            {"workspace_id": workspace_id},
            {"_id": 0}
        ).to_list(100)
    
    async def get_manager_for_store(self, store_id: str) -> Optional[Dict]:
        """Get the manager assigned to a store"""
        return await self.db.users.find_one(
            {"store_id": store_id, "role": "manager"},
            {"_id": 0, "password": 0, "password_hash": 0}
        )
    
    async def get_sellers_for_store(self, store_id: str) -> List[Dict]:
        """Get all sellers for a store"""
        return await self.db.users.find(
            {"store_id": store_id, "role": "seller"},
            {"_id": 0, "password": 0, "password_hash": 0}
        ).to_list(100)
    
    async def count_active_sellers_for_store(self, store_id: str) -> int:
        """Count active sellers for a store"""
        return await self.db.users.count_documents({
            "store_id": store_id,
            "role": "seller",
            "status": "active"
        })
    
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

    async def get_admin_logs(
        self,
        time_threshold: datetime,
        limit: int,
        action: Optional[str] = None,
        admin_emails: Optional[List[str]] = None
    ) -> List[Dict]:
        """Get admin audit logs within time window"""
        query: Dict = {"timestamp": {"$gte": time_threshold.isoformat()}}
        if action:
            query["action"] = action
        if admin_emails:
            query["admin_email"] = {"$in": admin_emails}
        return await self.db.admin_logs.find(
            query,
            {"_id": 0}
        ).sort("timestamp", -1).limit(limit).to_list(limit)

    async def get_admin_actions(self, time_threshold: datetime) -> List[str]:
        """Get distinct admin actions within time window"""
        return await self.db.admin_logs.distinct(
            "action",
            {"timestamp": {"$gte": time_threshold.isoformat()}}
        )

    async def get_admins_from_logs(self, time_threshold: datetime) -> List[Dict]:
        """Get distinct admins from audit logs within time window"""
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
        return await self.db.admin_logs.aggregate(pipeline).to_list(length=1000)
