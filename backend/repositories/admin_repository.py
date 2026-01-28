"""
Admin Repository
Database access layer for SuperAdmin operations.

Phase 1: Does NOT inherit from BaseRepository by design — multi-collection facade
that delegates to UserRepository, StoreRepository, WorkspaceRepository for users,
stores, workspaces. Uses skip/limit for all list operations (pagination-ready).
Collections without a dedicated repo (admin_logs, system_logs, logs, diagnostics,
relationship_consultations) still use self.db.
"""
import logging
from typing import List, Dict, Optional
from datetime import datetime, timezone, timedelta

from utils.pagination import paginate
from models.pagination import PaginatedResponse
from repositories.user_repository import UserRepository
from repositories.store_repository import StoreRepository, WorkspaceRepository

logger = logging.getLogger(__name__)

# Default limits for backward compatibility (pagination-ready: callers can pass skip/limit)
DEFAULT_WORKSPACES_LIST_LIMIT = 1000
DEFAULT_STORES_LIST_LIMIT = 100
DEFAULT_SELLERS_LIST_LIMIT = 100
DEFAULT_ADMINS_FROM_LOGS_LIMIT = 1000


class AdminRepository:
    """
    Multi-collection repository for SuperAdmin database operations.
    Does not inherit from BaseRepository (single-collection pattern); delegates to
    UserRepository, StoreRepository, WorkspaceRepository where applicable.
    All list methods accept skip/limit for pagination; prefer get_*_paginated when available.
    """

    def __init__(self, db):
        self.db = db
        self.user_repo = UserRepository(db)
        self.store_repo = StoreRepository(db)
        self.workspace_repo = WorkspaceRepository(db)

    async def get_all_workspaces(
        self,
        include_deleted: bool = False,
        limit: int = DEFAULT_WORKSPACES_LIST_LIMIT,
        skip: int = 0,
    ) -> List[Dict]:
        """Get workspaces with skip/limit (pagination-ready). Prefer get_all_workspaces_paginated for scalable listing."""
        query: Dict = {}
        if not include_deleted:
            query = {
                "$or": [
                    {"status": {"$ne": "deleted"}},
                    {"status": {"$exists": False}}
                ]
            }
        return await self.workspace_repo.find_many(
            query,
            {"_id": 0},
            limit=limit,
            skip=skip,
            sort=[("created_at", -1)],
        )

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
            self.workspace_repo.collection,
            query,
            page=page,
            size=size,
            projection={"_id": 0},
            sort=[("created_at", -1)],
        )

    async def get_gerant_by_id(self, gerant_id: str) -> Optional[Dict]:
        """Get gérant user by ID"""
        return await self.user_repo.find_one(
            {"id": gerant_id},
            {"_id": 0, "password": 0}
        )

    async def get_stores_by_gerant(
        self,
        gerant_id: str,
        limit: int = DEFAULT_STORES_LIST_LIMIT,
        skip: int = 0,
    ) -> List[Dict]:
        """Get all stores for a gérant (pagination-ready: skip/limit)."""
        if not gerant_id:
            return []
        return await self.store_repo.find_by_gerant(
            gerant_id,
            limit=limit,
            skip=skip,
        )

    async def get_stores_by_workspace(
        self,
        workspace_id: str,
        limit: int = DEFAULT_STORES_LIST_LIMIT,
        skip: int = 0,
    ) -> List[Dict]:
        """Get all stores for a workspace (by workspace_id field). Pagination-ready: skip/limit."""
        if not workspace_id:
            return []
        return await self.store_repo.find_many(
            {"workspace_id": workspace_id},
            {"_id": 0},
            limit=limit,
            skip=skip,
        )

    async def get_manager_for_store(self, store_id: str) -> Optional[Dict]:
        """Get the manager assigned to a store"""
        return await self.user_repo.find_one(
            {"store_id": store_id, "role": "manager"},
            {"_id": 0, "password": 0, "password_hash": 0}
        )

    async def get_sellers_for_store(
        self,
        store_id: str,
        limit: int = DEFAULT_SELLERS_LIST_LIMIT,
        skip: int = 0,
    ) -> List[Dict]:
        """Get all sellers for a store (pagination-ready: skip/limit)."""
        return await self.user_repo.find_by_store(
            store_id,
            role="seller",
            projection={"_id": 0, "password": 0, "password_hash": 0},
            limit=limit,
            skip=skip,
        )

    async def count_active_sellers_for_store(self, store_id: str) -> int:
        """Count active sellers for a store"""
        return await self.user_repo.count({
            "store_id": store_id,
            "role": "seller",
            "status": "active"
        })

    async def count_users_by_criteria(self, criteria: Dict) -> int:
        """Count users matching criteria"""
        return await self.user_repo.count(criteria)

    async def count_workspaces_by_criteria(self, criteria: Dict) -> int:
        """Count workspaces matching criteria"""
        return await self.workspace_repo.count(criteria)
    
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

    async def get_admins_from_logs(
        self,
        time_threshold: datetime,
        limit: int = DEFAULT_ADMINS_FROM_LOGS_LIMIT,
        skip: int = 0,
    ) -> List[Dict]:
        """Get distinct admins from audit logs within time window (pagination-ready: skip/limit)."""
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
            }},
            {"$skip": skip},
            {"$limit": limit},
        ]
        return await self.db.admin_logs.aggregate(pipeline).to_list(length=limit)
