"""
Manager Service
Business logic for manager operations (team management, KPIs, diagnostics)
"""
from typing import Dict, List, Optional, Any
from datetime import datetime, timezone, timedelta
import logging

from models.pagination import PaginatedResponse
from utils.pagination import paginate
from repositories.user_repository import UserRepository
from repositories.store_repository import StoreRepository
from repositories.invitation_repository import InvitationRepository
from repositories.kpi_config_repository import KPIConfigRepository
from repositories.team_bilan_repository import TeamBilanRepository
from repositories.kpi_repository import KPIRepository, ManagerKPIRepository, StoreKPIRepository
from repositories.objective_repository import ObjectiveRepository
from repositories.challenge_repository import ChallengeRepository
from repositories.manager_diagnostic_repository import ManagerDiagnosticRepository
from repositories.enterprise_repository import APIKeyRepository
from repositories.morning_brief_repository import MorningBriefRepository
from repositories.diagnostic_repository import DiagnosticRepository
from repositories.debrief_repository import DebriefRepository
from repositories.team_analysis_repository import TeamAnalysisRepository
from repositories.relationship_consultation_repository import RelationshipConsultationRepository

logger = logging.getLogger(__name__)


class ManagerService:
    """Service for manager operations. Phase 0: repositories + notification_service only, no self.db."""

    def __init__(
        self,
        user_repo: UserRepository,
        store_repo: StoreRepository,
        invitation_repo: InvitationRepository,
        kpi_config_repo: KPIConfigRepository,
        team_bilan_repo: TeamBilanRepository,
        kpi_repo: KPIRepository,
        manager_kpi_repo: ManagerKPIRepository,
        objective_repo: ObjectiveRepository,
        challenge_repo: ChallengeRepository,
        manager_diagnostic_repo: ManagerDiagnosticRepository,
        api_key_repo: APIKeyRepository,
        notification_service,
        store_kpi_repo: Optional[StoreKPIRepository] = None,
        morning_brief_repo: Optional[MorningBriefRepository] = None,
        diagnostic_repo: Optional[DiagnosticRepository] = None,
        debrief_repo: Optional[DebriefRepository] = None,
        team_analysis_repo: Optional[TeamAnalysisRepository] = None,
        relationship_consultation_repo: Optional[RelationshipConsultationRepository] = None,
    ):
        self.user_repo = user_repo
        self.store_repo = store_repo
        self.invitation_repo = invitation_repo
        self.kpi_config_repo = kpi_config_repo
        self.team_bilan_repo = team_bilan_repo
        self.kpi_repo = kpi_repo
        self.manager_kpi_repo = manager_kpi_repo
        self.objective_repo = objective_repo
        self.challenge_repo = challenge_repo
        self.manager_diagnostic_repo = manager_diagnostic_repo
        self.api_key_repo = api_key_repo
        self.notification_service = notification_service
        self.store_kpi_repo = store_kpi_repo
        self.morning_brief_repo = morning_brief_repo
        self.diagnostic_repo = diagnostic_repo
        self.debrief_repo = debrief_repo
        self.team_analysis_repo = team_analysis_repo
        self.relationship_consultation_repo = relationship_consultation_repo

    # ===== STORE (for routes: no direct store_repo access) =====

    async def get_store_by_id(
        self,
        store_id: str,
        gerant_id: Optional[str] = None,
        projection: Optional[Dict] = None,
    ) -> Optional[Dict]:
        """Get store by id (optionally verify gerant_id). Used by routes instead of store_repo.find_by_id."""
        return await self.store_repo.find_by_id(
            store_id=store_id,
            gerant_id=gerant_id,
            projection=projection or {"_id": 0},
        )

    async def get_store_by_id_simple(
        self, store_id: str, projection: Optional[Dict] = None
    ) -> Optional[Dict]:
        """Get store by id without gerant check (for existence/active check)."""
        return await self.store_repo.find_one(
            {"id": store_id}, projection or {"_id": 0}
        )

    # ===== USER (for routes: no direct user_repo access) =====

    async def get_user_by_id(
        self, user_id: str, projection: Optional[Dict] = None
    ) -> Optional[Dict]:
        """Get user by id. Used by routes instead of user_repo.find_by_id/find_one."""
        proj = projection or {"_id": 0, "password": 0}
        return await self.user_repo.find_one({"id": user_id}, proj)

    async def get_seller_by_id_and_store(
        self, seller_id: str, store_id: str
    ) -> Optional[Dict]:
        """Get seller by id and store (for access verification)."""
        return await self.user_repo.find_one(
            {"id": seller_id, "store_id": store_id, "role": "seller"},
            {"_id": 0, "password": 0},
        )

    async def get_users_by_ids_and_store(
        self,
        user_ids: List[str],
        store_id: str,
        role: str = "seller",
        limit: int = 50,
        projection: Optional[Dict] = None,
    ) -> List[Dict]:
        """Get users by ids and store (for validation). Used by routes instead of user_repo.find_many."""
        if not user_ids:
            return []
        proj = projection or {"_id": 0, "id": 1, "name": 1}
        return await self.user_repo.find_many(
            {"id": {"$in": user_ids}, "store_id": store_id, "role": role},
            proj,
            limit=limit,
        )

    async def get_sellers_for_store_paginated(
        self, store_id: str, page: int = 1, size: int = 100
    ) -> PaginatedResponse:
        """Get paginated sellers for store. Used by routes instead of paginate(collection=user_repo.collection)."""
        query = {
            "store_id": store_id,
            "role": "seller",
            "$or": [
                {"status": {"$exists": False}},
                {"status": None},
                {"status": "active"},
            ],
        }
        return await paginate(
            collection=self.user_repo.collection,
            query=query,
            page=page,
            size=size,
            projection={"_id": 0, "password": 0},
            sort=[("name", 1)],
        )

    async def get_sellers_by_status_paginated(
        self, store_id: str, status: str, page: int = 1, size: int = 50
    ) -> PaginatedResponse:
        """Get paginated sellers for store by status (e.g. 'suspended' for archived). Used by routes."""
        query = {
            "store_id": store_id,
            "role": "seller",
            "status": status,
        }
        return await paginate(
            collection=self.user_repo.collection,
            query=query,
            page=page,
            size=size,
            projection={"_id": 0, "password": 0},
            sort=[("updated_at", -1)],
        )

    # ===== OBJECTIVE / CHALLENGE (for verify_resource_store_access) =====

    async def get_objective_by_id(self, objective_id: str) -> Optional[Dict]:
        """Get objective by id (any store). Used by security/routes."""
        return await self.objective_repo.find_one(
            {"id": objective_id}, {"_id": 0}
        )

    async def get_objective_by_id_and_store(
        self, objective_id: str, store_id: str
    ) -> Optional[Dict]:
        """Get objective by id and store_id. Used by verify_resource_store_access."""
        return await self.objective_repo.find_one(
            {"id": objective_id, "store_id": store_id}, {"_id": 0}
        )

    async def get_challenge_by_id(self, challenge_id: str) -> Optional[Dict]:
        """Get challenge by id (any store). Used by security/routes."""
        return await self.challenge_repo.find_one(
            {"id": challenge_id}, {"_id": 0}
        )

    async def get_challenge_by_id_and_store(
        self, challenge_id: str, store_id: str
    ) -> Optional[Dict]:
        """Get challenge by id and store_id. Used by verify_resource_store_access."""
        return await self.challenge_repo.find_one(
            {"id": challenge_id, "store_id": store_id}, {"_id": 0}
        )

    # ===== KPI (for routes: no direct kpi_repo / manager_kpi_repo access) =====

    async def get_kpi_distinct_dates(self, query: Dict) -> List[str]:
        """Get distinct dates from seller KPIs. Used by routes."""
        return await self.kpi_repo.distinct_dates(query)

    async def get_manager_kpi_distinct_dates(self, query: Dict) -> List[str]:
        """Get distinct dates from manager KPIs. Used by routes."""
        return await self.manager_kpi_repo.distinct_dates(query)

    async def get_manager_kpis_paginated(
        self,
        store_id: str,
        start_date: str,
        end_date: str,
        page: int = 1,
        size: int = 50,
    ) -> PaginatedResponse:
        """Get paginated manager KPI entries for store/date range. Used by routes."""
        query = {
            "store_id": store_id,
            "date": {"$gte": start_date, "$lte": end_date},
        }
        return await paginate(
            collection=self.manager_kpi_repo.collection,
            query=query,
            page=page,
            size=size,
            projection={"_id": 0},
            sort=[("date", -1)],
        )

    async def get_kpi_locked_entries(
        self, store_id: str, date: str, limit: int = 1
    ) -> List[Dict]:
        """Get locked KPI entries for store/date (for lock check)."""
        return await self.kpi_repo.find_many(
            {"store_id": store_id, "date": date, "locked": True},
            {"_id": 0},
            limit=limit,
        )

    async def get_kpi_entries_locked_or_api(
        self, store_id: str, date: str, limit: int = 1
    ) -> List[Dict]:
        """Get KPI entries that are locked or from API (for save guard)."""
        return await self.kpi_repo.find_many(
            {
                "store_id": store_id,
                "date": date,
                "$or": [{"locked": True}, {"source": "api"}],
            },
            {"_id": 0, "locked": 1},
            limit=limit,
        )

    async def get_kpi_entry_by_seller_and_date(
        self, seller_id: str, date: str
    ) -> Optional[Dict]:
        """Get KPI entry for seller on date. Used by routes."""
        return await self.kpi_repo.find_by_seller_and_date(seller_id, date)

    async def update_kpi_entry_one(self, filter: Dict, update: Dict) -> bool:
        """Update one KPI entry. Used by routes instead of kpi_repo.update_one."""
        return await self.kpi_repo.update_one(filter, {"$set": update})

    async def insert_kpi_entry_one(self, data: Dict) -> str:
        """Insert one KPI entry. Used by routes instead of kpi_repo.insert_one."""
        return await self.kpi_repo.insert_one(data)

    async def get_manager_kpi_by_store_and_date(
        self, store_id: str, date: str
    ) -> Optional[Dict]:
        """Get manager KPI (prospects) for store/date. Used by routes."""
        return await self.manager_kpi_repo.find_by_store_and_date(
            store_id, date
        )

    async def update_manager_kpi_one(self, filter: Dict, update: Dict) -> bool:
        """Update one manager KPI entry. Used by routes."""
        return await self.manager_kpi_repo.update_one(filter, {"$set": update})

    async def insert_manager_kpi_one(self, data: Dict) -> str:
        """Insert one manager KPI entry. Used by routes."""
        return await self.manager_kpi_repo.insert_one(data)

    async def aggregate_kpi(
        self, pipeline: List[Dict], max_results: int = 1
    ) -> List[Dict]:
        """Run KPI aggregation. Used by routes."""
        return await self.kpi_repo.aggregate(pipeline, max_results=max_results)

    async def aggregate_manager_kpi(
        self, pipeline: List[Dict], max_results: int = 1
    ) -> List[Dict]:
        """Run manager KPI aggregation. Used by routes."""
        return await self.manager_kpi_repo.aggregate(
            pipeline, max_results=max_results
        )

    async def get_kpi_entries_paginated(
        self,
        query: Dict,
        page: int = 1,
        size: int = 50,
    ) -> PaginatedResponse:
        """Get paginated KPI entries (seller entries) by query. Used by routes."""
        return await paginate(
            collection=self.kpi_repo.collection,
            query=query,
            page=page,
            size=size,
            projection={"_id": 0},
            sort=[("date", -1)],
        )

    # ===== KPI CONFIG =====

    async def upsert_kpi_config(
        self,
        store_id: Optional[str],
        manager_id: Optional[str],
        update_data: Dict,
    ) -> Dict:
        """Upsert KPI config. Used by routes instead of kpi_config_repo.upsert_config."""
        return await self.kpi_config_repo.upsert_config(
            store_id=store_id,
            manager_id=manager_id,
            update_data=update_data,
        )

    # ===== OBJECTIVES (CRUD for routes) =====

    async def get_objectives_by_store(
        self, store_id: str, limit: int = 100
    ) -> List[Dict]:
        """Get objectives for store. Used by routes instead of objective_repo.find_by_store."""
        return await self.objective_repo.find_by_store(
            store_id, projection={"_id": 0}, limit=limit
        )

    async def create_objective(
        self, data: Dict, store_id: str, manager_id: str
    ) -> str:
        """Create objective. Used by routes."""
        return await self.objective_repo.create_objective(
            data, store_id=store_id, manager_id=manager_id
        )

    async def update_objective(
        self,
        objective_id: str,
        update_data: Dict,
        store_id: Optional[str] = None,
        manager_id: Optional[str] = None,
    ) -> bool:
        """Update objective. Used by routes."""
        return await self.objective_repo.update_objective(
            objective_id, update_data, store_id=store_id, manager_id=manager_id
        )

    async def get_objective_by_id_for_route(self, objective_id: str) -> Optional[Dict]:
        """Get objective by id (for route logic). Alias for get_objective_by_id."""
        return await self.get_objective_by_id(objective_id)

    async def delete_objective(
        self,
        objective_id: str,
        store_id: Optional[str] = None,
        manager_id: Optional[str] = None,
    ) -> bool:
        """Delete objective. Used by routes."""
        return await self.objective_repo.delete_objective(
            objective_id, store_id=store_id, manager_id=manager_id
        )

    async def update_objective_with_progress_history(
        self,
        objective_id: str,
        update_data: Dict,
        progress_entry: Dict,
        store_id: str,
        manager_id: Optional[str] = None,
    ) -> bool:
        """Update objective and append to progress_history (single atomic update)."""
        update_doc = {
            "$set": update_data,
            "$push": {
                "progress_history": {"$each": [progress_entry], "$slice": -50}
            },
        }
        filters = {"id": objective_id, "store_id": store_id}
        return await self.objective_repo.update_one(filters, update_doc)

    # ===== CHALLENGES (CRUD for routes) =====

    async def get_challenges_by_store(
        self, store_id: str, limit: int = 100
    ) -> List[Dict]:
        """Get challenges for store. Used by routes instead of challenge_repo.find_by_store."""
        return await self.challenge_repo.find_by_store(
            store_id, projection={"_id": 0}, limit=limit
        )

    async def create_challenge(
        self, data: Dict, store_id: str, manager_id: str
    ) -> str:
        """Create challenge. Used by routes (store_id and manager_id required for security)."""
        return await self.challenge_repo.create_challenge(
            data, store_id=store_id, manager_id=manager_id
        )

    async def update_challenge(
        self,
        challenge_id: str,
        update_data: Dict,
        store_id: Optional[str] = None,
        manager_id: Optional[str] = None,
    ) -> bool:
        """Update challenge. Used by routes."""
        return await self.challenge_repo.update_challenge(
            challenge_id, update_data, store_id=store_id, manager_id=manager_id
        )

    async def get_challenge_by_id_for_route(self, challenge_id: str) -> Optional[Dict]:
        """Get challenge by id (for route logic). Alias for get_challenge_by_id."""
        return await self.get_challenge_by_id(challenge_id)

    async def delete_challenge(
        self,
        challenge_id: str,
        store_id: Optional[str] = None,
        manager_id: Optional[str] = None,
    ) -> bool:
        """Delete challenge. Used by routes."""
        return await self.challenge_repo.delete_challenge(
            challenge_id, store_id=store_id, manager_id=manager_id
        )

    async def update_challenge_with_progress_history(
        self,
        challenge_id: str,
        update_data: Dict,
        progress_entry: Dict,
        store_id: str,
        manager_id: Optional[str] = None,
    ) -> bool:
        """Update challenge and append to progress_history (single atomic update)."""
        update_doc = {
            "$set": update_data,
            "$push": {
                "progress_history": {"$each": [progress_entry], "$slice": -50}
            },
        }
        filters = {"id": challenge_id, "store_id": store_id}
        return await self.challenge_repo.update_one(filters, update_doc)

    # ===== DIAGNOSTIC / DEBRIEF =====

    async def get_diagnostic_by_seller(self, seller_id: str) -> Optional[Dict]:
        """Get diagnostic for seller. Used by routes instead of diagnostic_repo.find_by_seller."""
        if not self.diagnostic_repo:
            return None
        return await self.diagnostic_repo.find_by_seller(seller_id)

    async def get_debriefs_by_seller(
        self, seller_id: str, limit: int = 100
    ) -> List[Dict]:
        """Get debriefs for seller. Used by routes instead of debrief_repo.find_by_seller."""
        if not self.debrief_repo:
            return []
        return await self.debrief_repo.find_by_seller(
            seller_id, projection={"_id": 0}, limit=limit
        )

    # ===== MORNING BRIEF (for routes: no direct morning_brief_repo access) =====

    async def create_morning_brief(
        self, brief_data: Dict, store_id: str, manager_id: str
    ) -> str:
        """Create morning brief. Used by briefs route."""
        if not self.morning_brief_repo:
            raise ValueError("Morning brief repository not available")
        return await self.morning_brief_repo.create_brief(
            brief_data=brief_data, store_id=store_id, manager_id=manager_id
        )

    async def get_morning_briefs_by_store(
        self,
        store_id: str,
        limit: int = 30,
        sort: Optional[List[tuple]] = None,
    ) -> List[Dict]:
        """Get morning briefs for store. Used by briefs route."""
        if not self.morning_brief_repo:
            return []
        s = sort or [("generated_at", -1)]
        return await self.morning_brief_repo.find_by_store(
            store_id=store_id, limit=limit, sort=s
        )

    async def count_morning_briefs_by_store(self, store_id: str) -> int:
        """Count morning briefs for store. Used by briefs route."""
        if not self.morning_brief_repo:
            return 0
        return await self.morning_brief_repo.count_by_store(store_id)

    async def delete_morning_brief(self, brief_id: str, store_id: str) -> bool:
        """Delete morning brief. Used by briefs route."""
        if not self.morning_brief_repo:
            return False
        return await self.morning_brief_repo.delete_brief(
            brief_id=brief_id, store_id=store_id
        )

    # ===== TEAM ANALYSIS =====

    async def get_team_analyses_paginated(
        self, store_id: str, page: int = 1, size: int = 50
    ) -> PaginatedResponse:
        """Get paginated team analyses for store. Used by routes."""
        if not self.team_analysis_repo:
            return PaginatedResponse(items=[], total=0, page=page, size=size, pages=0)
        return await paginate(
            collection=self.team_analysis_repo.collection,
            query={"store_id": store_id},
            page=page,
            size=size,
            projection={"_id": 0},
            sort=[("created_at", -1)],
        )

    async def create_team_analysis(self, data: Dict) -> str:
        """Create team analysis. Used by routes."""
        if not self.team_analysis_repo:
            raise ValueError("Team analysis service not configured")
        return await self.team_analysis_repo.create_analysis(data)

    async def delete_team_analysis_one(self, filter: Dict) -> bool:
        """Delete one team analysis. Used by routes."""
        if not self.team_analysis_repo:
            return False
        return await self.team_analysis_repo.delete_one(filter)

    # ===== RELATIONSHIP CONSULTATION =====

    async def get_relationship_consultations_paginated(
        self, store_id: str, page: int = 1, size: int = 50
    ) -> PaginatedResponse:
        """Get paginated relationship consultations for store. Used by routes."""
        if not self.relationship_consultation_repo:
            return PaginatedResponse(items=[], total=0, page=page, size=size, pages=0)
        return await paginate(
            collection=self.relationship_consultation_repo.collection,
            query={"store_id": store_id},
            page=page,
            size=size,
            projection={"_id": 0},
            sort=[("created_at", -1)],
        )

    async def get_relationship_consultations_for_manager_paginated(
        self,
        store_id: str,
        manager_id: str,
        seller_id: Optional[str] = None,
        page: int = 1,
        size: int = 50,
    ) -> PaginatedResponse:
        """Get paginated relationship consultations for manager (and optional seller). Used by relationship-history route."""
        if not self.relationship_consultation_repo:
            return PaginatedResponse(items=[], total=0, page=page, size=size, pages=0)
        query: Dict = {"store_id": store_id, "manager_id": manager_id}
        if seller_id:
            query["seller_id"] = seller_id
        return await paginate(
            collection=self.relationship_consultation_repo.collection,
            query=query,
            page=page,
            size=size,
            projection={"_id": 0},
            sort=[("created_at", -1)],
        )

    async def delete_relationship_consultation_one(self, filter: Dict) -> bool:
        """Delete one relationship consultation. Used by routes."""
        if not self.relationship_consultation_repo:
            return False
        return await self.relationship_consultation_repo.delete_one(filter)

    async def get_sellers(self, manager_id: str, store_id: str) -> List[Dict]:
        """
        Get all sellers for a store
        
        Note: Uses store_id as primary filter. 
        manager_id is used for logging/audit but not required for filtering
        since a gérant can also query sellers.
        
        Returns only active sellers (status is 'active' or null/undefined, not 'suspended' or 'deleted').
        """
        # Query: sellers with store_id, role=seller, and status NOT in ['deleted', 'suspended']
        # This includes: status='active', status=None, or status field doesn't exist
        sellers = await self.user_repo.find_many(
            {
                "store_id": store_id,
                "role": "seller",
                "$or": [
                    {"status": {"$exists": False}},  # No status field (defaults to active)
                    {"status": None},  # Explicitly null
                    {"status": "active"}  # Explicitly active
                ]
            },
            {"_id": 0, "password": 0}
        )
        # Filter out any sellers that might have been included with 'suspended' or 'deleted' status
        # (though the query above should already exclude them)
        active_sellers = [s for s in sellers if s.get('status') not in ['deleted', 'suspended']]
        return active_sellers
    
    async def get_invitations(self, manager_id: str) -> List[Dict]:
        """Get pending invitations for manager"""
        invitations = await self.invitation_repo.find_by_manager(
            manager_id, status="pending", projection={"_id": 0}, limit=100
        )
        return invitations
    
    async def get_sync_mode(self, store_id: str) -> Dict:
        """Get sync mode configuration for store"""
        store = await self.store_repo.find_one({"id": store_id}, {"_id": 0})
        
        if not store:
            return {
                "sync_mode": "manual",
                "external_sync_enabled": False,
                "is_enterprise": False,
                "can_edit_kpi": True,
                "can_edit_objectives": True
            }
        
        # Ensure sync_mode is never null - default to "manual"
        sync_mode = store.get("sync_mode") or "manual"
        
        return {
            "sync_mode": sync_mode,
            "external_sync_enabled": sync_mode == "api_sync",
            "is_enterprise": sync_mode in ["api_sync", "scim_sync"],
            "can_edit_kpi": sync_mode == "manual",
            "can_edit_objectives": True  # Objectives can always be edited
        }
    
    async def get_kpi_config(self, store_id: str) -> Dict:
        """Get KPI configuration for store"""
        config = await self.kpi_config_repo.find_one(
            {"store_id": store_id},
            {"_id": 0}
        )
        
        if not config:
            # Return default config
            return {
                "store_id": store_id,
                "enabled_kpis": ["ca_journalier", "nb_ventes", "nb_articles", "panier_moyen"],
                "required_kpis": ["ca_journalier", "nb_ventes"],
                "saisie_enabled": True
            }
        
        return config
    
    async def get_team_bilans_all(self, manager_id: str, store_id: str) -> List[Dict]:
        """Get all team bilans for manager"""
        bilans = await self.team_bilan_repo.find_by_manager(
            manager_id, store_id, projection={"_id": 0}, limit=100, sort=[("created_at", -1)]
        )
        
        return bilans
    
    async def get_store_kpi_stats(
        self,
        store_id: str,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> Dict:
        """Get aggregated KPI stats for store"""
        from datetime import timedelta
        
        # Default to current month if no dates provided
        if not start_date:
            today = datetime.now(timezone.utc)
            start_date = today.replace(day=1).strftime('%Y-%m-%d')
        
        if not end_date:
            end_date = datetime.now(timezone.utc).strftime('%Y-%m-%d')
        
        # Aggregate seller KPIs
        seller_pipeline = [
            {"$match": {
                "store_id": store_id,
                "date": {"$gte": start_date, "$lte": end_date}
            }},
            {"$group": {
                "_id": None,
                "total_ca": {"$sum": {"$ifNull": ["$seller_ca", {"$ifNull": ["$ca_journalier", 0]}]}},
                "total_ventes": {"$sum": {"$ifNull": ["$nb_ventes", 0]}},
                "total_articles": {"$sum": {"$ifNull": ["$nb_articles", 0]}}
            }}
        ]
        
        seller_stats = await self.kpi_repo.aggregate(seller_pipeline, max_results=1)
        
        # Aggregate manager KPIs
        manager_pipeline = [
            {"$match": {
                "store_id": store_id,
                "date": {"$gte": start_date, "$lte": end_date}
            }},
            {"$group": {
                "_id": None,
                "total_ca": {"$sum": {"$ifNull": ["$ca_journalier", 0]}},
                "total_ventes": {"$sum": {"$ifNull": ["$nb_ventes", 0]}},
                "total_articles": {"$sum": {"$ifNull": ["$nb_articles", 0]}}
            }}
        ]
        
        manager_stats = await self.manager_kpi_repo.aggregate(manager_pipeline, max_results=1)
        
        seller_ca = seller_stats[0].get("total_ca", 0) if seller_stats else 0
        seller_ventes = seller_stats[0].get("total_ventes", 0) if seller_stats else 0
        seller_articles = seller_stats[0].get("total_articles", 0) if seller_stats else 0
        
        manager_ca = manager_stats[0].get("total_ca", 0) if manager_stats else 0
        manager_ventes = manager_stats[0].get("total_ventes", 0) if manager_stats else 0
        manager_articles = manager_stats[0].get("total_articles", 0) if manager_stats else 0
        
        total_ca = seller_ca + manager_ca
        total_ventes = seller_ventes + manager_ventes
        total_articles = seller_articles + manager_articles
        
        return {
            "store_id": store_id,
            "period": {
                "start": start_date,
                "end": end_date
            },
            "total_ca": total_ca,
            "total_ventes": total_ventes,
            "total_articles": total_articles,
            "panier_moyen": (total_ca / total_ventes) if total_ventes > 0 else 0,
            "uvc": (total_articles / total_ventes) if total_ventes > 0 else 0,
            "seller_stats": {
                "ca": seller_ca,
                "ventes": seller_ventes,
                "articles": seller_articles
            },
            "manager_stats": {
                "ca": manager_ca,
                "ventes": manager_ventes,
                "articles": manager_articles
            }
        }
    
    async def get_active_objectives(
        self,
        manager_id: str,
        store_id: str,
    ) -> List[Dict]:
        """
        Get active objectives for manager's team
        
        ✅ ÉTAPE C : Utilise NotificationService injecté (découplage)
        """
        # Phase 0: use injected notification_service
        today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
        # Get all objectives for the store, then filter
        all_objectives = await self.objective_repo.find_by_store(
            store_id, projection={"_id": 0}, limit=100
        )
        # Filter by status and period
        objectives = [
            obj for obj in all_objectives
            if (obj.get("status") == "active" and obj.get("period_end", "") >= today)
            or obj.get("status") == "achieved"
        ]
        
        # Add achievement notification flags via NotificationService
        await self.notification_service.add_achievement_notification_flag(objectives, manager_id, "objective")
        
        return objectives
    
    async def get_active_challenges(
        self,
        manager_id: str,
        store_id: str,
    ) -> List[Dict]:
        """
        Get active challenges for manager's team
        
        ✅ ÉTAPE C : Utilise NotificationService injecté (découplage)
        """
        # Phase 0: use injected notification_service
        # Get all challenges for the store, then filter
        all_challenges = await self.challenge_repo.find_by_store(
            store_id, projection={"_id": 0}, limit=100
        )
        today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
        # Filter by status and end_date
        challenges = [
            c for c in all_challenges
            if c.get("status") in ["active", "completed"]
            and c.get("end_date", "") >= today
        ]
        
        # Add achievement notification flags via NotificationService
        await self.notification_service.add_achievement_notification_flag(challenges, manager_id, "challenge")
        
        return challenges


class DiagnosticService:
    """Service for diagnostic operations. Phase 0: repository only, no self.db."""

    def __init__(self, manager_diagnostic_repo: ManagerDiagnosticRepository):
        self.manager_diagnostic_repo = manager_diagnostic_repo

    async def get_manager_diagnostic(
        self, manager_id: str, projection: Optional[Dict] = None
    ) -> Optional[Dict]:
        """Get manager's latest DISC diagnostic profile. Used by diagnostics route."""
        proj = projection or {"_id": 0}
        return await self.manager_diagnostic_repo.find_latest_by_manager(
            manager_id, projection=proj
        )

    async def get_latest_manager_diagnostic(
        self, manager_id: str, projection: Optional[Dict] = None
    ) -> Optional[Dict]:
        """Alias for get_manager_diagnostic. Used by diagnostics route."""
        return await self.get_manager_diagnostic(manager_id, projection)

    async def delete_manager_diagnostic_by_manager(self, manager_id: str) -> bool:
        """Delete latest manager diagnostic (before creating new one). Used by diagnostics route."""
        return await self.manager_diagnostic_repo.delete_one({"manager_id": manager_id})

    async def create_manager_diagnostic(
        self, diagnostic_doc: Dict, manager_id: str
    ) -> str:
        """Create manager diagnostic. Used by diagnostics route."""
        return await self.manager_diagnostic_repo.create_diagnostic(
            diagnostic_doc, manager_id
        )


class APIKeyService:
    """Service for API key management operations. Phase 0: repository only, no self.db."""

    def __init__(self, api_key_repo: APIKeyRepository):
        self.api_key_repo = api_key_repo

    async def create_api_key(
        self,
        user_id: str,
        store_id: Optional[str],
        gerant_id: Optional[str],
        name: str,
        permissions: List[str],
        store_ids: Optional[List[str]] = None,
        expires_days: Optional[int] = None
    ) -> Dict:
        """
        Create a new API key
        
        Args:
            user_id: User ID owning the key
            store_id: Store ID (for manager)
            gerant_id: Gérant ID (if applicable)
            name: Friendly name for the key
            permissions: List of permissions
            store_ids: Optional list of specific store IDs
            expires_days: Optional expiration in days
            
        Returns:
            Dict with key details (including the key itself, shown only once)
        """
        from uuid import uuid4
        import secrets
        from core.security import get_password_hash
        
        # Generate secure API key
        random_part = secrets.token_urlsafe(32)
        api_key = f"sk_live_{random_part}"
        
        # Hash the key for storage (same system as IntegrationService)
        hashed_key = get_password_hash(api_key)
        
        # Calculate expiration
        expires_at = None
        if expires_days:
            expires_at = datetime.now(timezone.utc).timestamp() + (expires_days * 86400)
        
        # Create record (using same format as IntegrationService for compatibility)
        key_id = str(uuid4())
        key_record = {
            "id": key_id,
            "user_id": user_id,
            "store_id": store_id,
            "gerant_id": gerant_id,
            "key_hash": hashed_key,  # Store hashed key instead of plain text
            "key_prefix": api_key[:12],  # Store prefix for lookup
            "name": name,
            "permissions": permissions,
            "store_ids": store_ids,
            "active": True,
            "created_at": datetime.now(timezone.utc),
            "last_used_at": None,
            "expires_at": expires_at
        }
        
        await self.api_key_repo.create_key(key_record, user_id)
        
        # Convert created_at to ISO string for JSON serialization
        created_at_iso = key_record["created_at"].isoformat() if isinstance(key_record["created_at"], datetime) else key_record["created_at"]
        
        # Convert expires_at timestamp to ISO string if it exists
        expires_at_iso = None
        if expires_at:
            if isinstance(expires_at, (int, float)):
                expires_at_iso = datetime.fromtimestamp(expires_at, tz=timezone.utc).isoformat()
            elif isinstance(expires_at, datetime):
                expires_at_iso = expires_at.isoformat()
            else:
                expires_at_iso = expires_at
        
        return {
            "id": key_id,
            "name": name,
            "key": api_key,  # Only shown at creation (for frontend compatibility)
            "api_key": api_key,  # Also return as api_key for consistency
            "permissions": permissions,
            "active": True,
            "created_at": created_at_iso,
            "last_used_at": None,
            "expires_at": expires_at_iso,
            "store_ids": store_ids
        }
    
    async def list_api_keys(self, user_id: str) -> Dict:
        """
        List all API keys for a user (without the actual key value)
        
        Args:
            user_id: User ID
            
        Returns:
            Dict with api_keys list
        """
        keys = await self.api_key_repo.find_by_user(
            user_id,
            projection={"_id": 0, "key": 0}  # Don't return _id or actual key
        )
        
        return {"api_keys": keys}
    
    async def deactivate_api_key(self, key_id: str, user_id: str) -> Dict:
        """
        Deactivate an API key (soft delete)
        
        Args:
            key_id: API key ID
            user_id: User ID for ownership verification
            
        Returns:
            Success message
            
        Raises:
            ValueError: If key not found
        """
        # Verify ownership
        key = await self.api_key_repo.find_by_id(key_id, user_id=user_id)
        if not key:
            raise ValueError("API key not found")
        
        # Deactivate instead of delete (for audit)
        await self.api_key_repo.update_key(
            key_id,
            {"active": False, "deleted_at": datetime.now(timezone.utc).isoformat()},
            user_id=user_id
        )
        
        return {"message": "API key deactivated successfully"}
    
    async def regenerate_api_key(self, key_id: str, user_id: str) -> Dict:
        """
        Regenerate an API key (creates new key, deactivates old)
        
        Args:
            key_id: API key ID
            user_id: User ID for ownership verification
            
        Returns:
            New key details
            
        Raises:
            ValueError: If key not found
        """
        from uuid import uuid4
        import secrets
        
        # Find old key
        old_key = await self.api_key_repo.find_by_id(key_id, user_id=user_id)
        if not old_key:
            raise ValueError("API key not found")
        
        # Deactivate old key
        await self.api_key_repo.update_key(
            key_id,
            {"active": False, "regenerated_at": datetime.now(timezone.utc).isoformat()},
            user_id=user_id
        )
        
        # Generate new key
        from core.security import get_password_hash
        
        random_part = secrets.token_urlsafe(32)
        new_api_key = f"sk_live_{random_part}"
        
        # Hash the key for storage (same system as IntegrationService)
        hashed_key = get_password_hash(new_api_key)
        
        new_key_id = str(uuid4())
        
        # Handle expiration format (could be timestamp or ISO string)
        expires_at = old_key.get('expires_at')
        if expires_at and isinstance(expires_at, str):
            # Convert ISO string to timestamp if needed
            try:
                expires_dt = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
                expires_at = expires_dt.timestamp()
            except:
                pass
        
        new_key_record = {
            "id": new_key_id,
            "user_id": user_id,
            "store_id": old_key.get('store_id'),
            "gerant_id": old_key.get('gerant_id'),
            "key_hash": hashed_key,  # Store hashed key instead of plain text
            "key_prefix": new_api_key[:12],  # Store prefix for lookup
            "name": old_key['name'],
            "permissions": old_key['permissions'],
            "store_ids": old_key.get('store_ids'),
            "active": True,
            "created_at": datetime.now(timezone.utc),
            "last_used_at": None,
            "expires_at": expires_at,
            "previous_key_id": key_id
        }
        
        await self.api_key_repo.create_key(new_key_record, user_id)
        
        return {
            "id": new_key_id,
            "key": new_api_key,  # Only shown at regeneration (for frontend compatibility)
            "api_key": new_api_key,  # Also return as api_key for consistency
            "name": new_key_record["name"],
            "permissions": new_key_record["permissions"],
            "active": True,
            "created_at": new_key_record["created_at"],
            "last_used_at": None,
            "expires_at": new_key_record.get("expires_at"),
            "store_ids": new_key_record.get("store_ids")
        }
    
    async def delete_api_key_permanent(
        self,
        key_id: str,
        user_id: str,
        role: str
    ) -> Dict:
        """
        Permanently delete an inactive API key
        
        Args:
            key_id: API key ID
            user_id: User ID for ownership verification
            role: User role (manager, gerant)
            
        Returns:
            Success message
            
        Raises:
            ValueError: If key not found or not authorized
        """
        # Find the key
        key = await self.api_key_repo.find_by_id(key_id, projection={"_id": 0})
        
        if not key:
            raise ValueError("API key not found")
        
        # Verify ownership based on role
        if role == 'manager':
            if key.get('user_id') != user_id:
                raise PermissionError("Not authorized to delete this key")
        elif role in ['gerant', 'gérant']:
            if key.get('gerant_id') != user_id:
                raise PermissionError("Not authorized to delete this key")
        
        # Only allow deletion of inactive keys
        if key.get('active'):
            raise ValueError("Cannot permanently delete an active key. Deactivate it first.")
        
        # Permanently delete
        await self.api_key_repo.delete_key(key_id, user_id=user_id if role == 'manager' else None)
        
        return {"success": True, "message": "API key permanently deleted"}

    async def get_yesterday_stats_for_brief(
        self, store_id: Optional[str], manager_id: str
    ) -> Dict[str, Any]:
        """
        Récupère les statistiques du dernier jour avec des données de vente pour le brief matinal.
        Cherche dans les 30 derniers jours pour trouver le dernier jour travaillé.
        Utilise store_kpi_repo, kpi_repo, user_repo, store_repo (injectés).
        """
        today = datetime.now(timezone.utc)
        start_of_week = today - timedelta(days=today.weekday())
        stats: Dict[str, Any] = {
            "ca_yesterday": 0,
            "objectif_yesterday": 0,
            "ventes_yesterday": 0,
            "panier_moyen_yesterday": 0,
            "taux_transfo_yesterday": 0,
            "indice_vente_yesterday": 0,
            "top_seller_yesterday": None,
            "ca_week": 0,
            "objectif_week": 0,
            "team_present": "Non renseigné",
            "data_date": None,
        }
        if not store_id or not self.store_kpi_repo:
            return stats
        try:
            store_kpi_repo = self.store_kpi_repo
            kpi_repo = self.kpi_repo
            last_data_date = None
            for days_back in range(1, 31):
                check_date = today - timedelta(days=days_back)
                check_date_str = check_date.strftime("%Y-%m-%d")
                kpi_check = await store_kpi_repo.find_one_with_ca(store_id, check_date_str)
                if not kpi_check:
                    kpi_check = await kpi_repo.find_one(
                        {
                            "store_id": store_id,
                            "date": check_date_str,
                            "ca_journalier": {"$gt": 0},
                        },
                        {"_id": 0, "date": 1},
                    )
                if kpi_check:
                    last_data_date = check_date_str
                    break
            if not last_data_date:
                last_data_date = (today - timedelta(days=1)).strftime("%Y-%m-%d")
            stats["data_date"] = last_data_date

            kpis_yesterday = await store_kpi_repo.find_many_for_store(
                store_id, date=last_data_date, limit=50
            )
            if not kpis_yesterday:
                kpi_entries = await kpi_repo.find_by_store(store_id, last_data_date)
                if kpi_entries:
                    total_ca = sum(k.get("ca_journalier", 0) or 0 for k in kpi_entries)
                    total_ventes = sum(k.get("nb_ventes", 0) or 0 for k in kpi_entries)
                    total_articles = sum(
                        k.get("nb_articles", k.get("nb_ventes", 0)) or 0 for k in kpi_entries
                    )
                    total_visiteurs = sum(
                        k.get("nb_visiteurs", k.get("nb_prospects", 0)) or 0 for k in kpi_entries
                    )
                    stats["ca_yesterday"] = total_ca
                    stats["ventes_yesterday"] = total_ventes
                    if total_ventes > 0:
                        stats["panier_moyen_yesterday"] = total_ca / total_ventes
                        stats["indice_vente_yesterday"] = total_articles / total_ventes
                    if total_visiteurs > 0:
                        stats["taux_transfo_yesterday"] = (total_ventes / total_visiteurs) * 100
                    if kpi_entries:
                        sorted_sellers = sorted(
                            kpi_entries, key=lambda x: x.get("ca_journalier", 0) or 0, reverse=True
                        )
                        if sorted_sellers:
                            top_kpi = sorted_sellers[0]
                            top_seller = await self.user_repo.find_one(
                                {"id": top_kpi.get("seller_id")},
                                {"_id": 0, "name": 1},
                            )
                            if top_seller:
                                stats["top_seller_yesterday"] = (
                                    f"{top_seller.get('name')} ({top_kpi.get('ca_journalier', 0):,.0f}€)"
                                )
            if kpis_yesterday:
                total_ca = sum(k.get("ca", 0) or 0 for k in kpis_yesterday)
                total_ventes = sum(k.get("nb_ventes", 0) or 0 for k in kpis_yesterday)
                total_articles = sum(k.get("nb_articles", 0) or 0 for k in kpis_yesterday)
                total_visiteurs = sum(k.get("nb_visiteurs", 0) or 0 for k in kpis_yesterday)
                stats["ca_yesterday"] = total_ca
                stats["ventes_yesterday"] = total_ventes
                if total_ventes > 0:
                    stats["panier_moyen_yesterday"] = total_ca / total_ventes
                    stats["indice_vente_yesterday"] = total_articles / total_ventes
                if total_visiteurs > 0:
                    stats["taux_transfo_yesterday"] = (total_ventes / total_visiteurs) * 100
                sorted_sellers = sorted(
                    kpis_yesterday, key=lambda x: x.get("ca", 0) or 0, reverse=True
                )
                if sorted_sellers:
                    top_kpi = sorted_sellers[0]
                    top_seller = await self.user_repo.find_one(
                        {"id": top_kpi.get("seller_id")},
                        {"_id": 0, "name": 1},
                    )
                    if top_seller:
                        stats["top_seller_yesterday"] = (
                            f"{top_seller.get('name')} ({top_kpi.get('ca', 0):,.0f}€)"
                        )

            store_obj = await self.store_repo.find_by_id(
                store_id, None, {"_id": 0, "objective_daily": 1, "objective_weekly": 1}
            )
            if store_obj:
                stats["objectif_yesterday"] = store_obj.get("objective_daily", 0) or 0
                stats["objectif_week"] = store_obj.get("objective_weekly", 0) or 0

            week_start_str = start_of_week.strftime("%Y-%m-%d")
            kpi_week_aggregate = [
                {
                    "$match": {
                        "store_id": store_id,
                        "date": {"$gte": week_start_str, "$lte": last_data_date},
                    }
                },
                {"$group": {"_id": None, "total_ca": {"$sum": {"$ifNull": ["$ca_journalier", 0]}}}},
            ]
            kpi_week_result = await kpi_repo.aggregate(kpi_week_aggregate, max_results=1)
            if kpi_week_result:
                stats["ca_week"] = kpi_week_result[0].get("total_ca", 0) or 0
            else:
                kpis_week = await store_kpi_repo.find_many_for_store(
                    store_id,
                    date_range={"$gte": week_start_str, "$lte": last_data_date},
                    limit=500,
                    projection={"_id": 0, "ca": 1},
                )
                if kpis_week:
                    stats["ca_week"] = sum(k.get("ca", 0) or 0 for k in kpis_week)

            sellers = await self.user_repo.find_by_store(
                store_id, role="seller", status="active",
                projection={"_id": 0, "name": 1}, limit=50
            )
            if sellers:
                names = [s.get("name", "").split()[0] for s in sellers[:5]]
                stats["team_present"] = ", ".join(names)
                if len(sellers) > 5:
                    stats["team_present"] += f" et {len(sellers) - 5} autres"
        except Exception as e:
            logger.error("Erreur récupération stats brief: %s", e)
        return stats

