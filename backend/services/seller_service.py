"""
Seller Service
Business logic for seller-specific operations (tasks, objectives, challenges, sales, evaluations)
"""
import logging
from datetime import datetime, timezone
from typing import List, Dict, Optional
from uuid import uuid4

from repositories.user_repository import UserRepository
from repositories.diagnostic_repository import DiagnosticRepository
from repositories.manager_request_repository import ManagerRequestRepository
from repositories.objective_repository import ObjectiveRepository
from repositories.challenge_repository import ChallengeRepository
from repositories.kpi_repository import KPIRepository, ManagerKPIRepository
from repositories.achievement_notification_repository import AchievementNotificationRepository
from repositories.interview_note_repository import InterviewNoteRepository
from repositories.debrief_repository import DebriefRepository
from repositories.store_repository import StoreRepository, WorkspaceRepository
from repositories.kpi_config_repository import KPIConfigRepository
from repositories.daily_challenge_repository import DailyChallengeRepository
from repositories.seller_bilan_repository import SellerBilanRepository
from repositories.sale_repository import SaleRepository
from repositories.evaluation_repository import EvaluationRepository
from models.pagination import PaginatedResponse
from utils.pagination import paginate
from core.exceptions import NotFoundError, ForbiddenError

logger = logging.getLogger(__name__)


class SellerService:
    """Service for seller-specific operations. All repos injected via __init__ (no self.db)."""

    def __init__(
        self,
        user_repo: UserRepository,
        diagnostic_repo: DiagnosticRepository,
        manager_request_repo: ManagerRequestRepository,
        objective_repo: ObjectiveRepository,
        challenge_repo: ChallengeRepository,
        kpi_repo: KPIRepository,
        manager_kpi_repo: ManagerKPIRepository,
        achievement_notification_repo: AchievementNotificationRepository,
        interview_note_repo: Optional[InterviewNoteRepository] = None,
        debrief_repo: Optional[DebriefRepository] = None,
        store_repo: Optional[StoreRepository] = None,
        workspace_repo: Optional[WorkspaceRepository] = None,
        kpi_config_repo: Optional[KPIConfigRepository] = None,
        daily_challenge_repo: Optional[DailyChallengeRepository] = None,
        seller_bilan_repo: Optional[SellerBilanRepository] = None,
        sale_repo: Optional[SaleRepository] = None,
        evaluation_repo: Optional[EvaluationRepository] = None,
    ):
        self.user_repo = user_repo
        self.diagnostic_repo = diagnostic_repo
        self.manager_request_repo = manager_request_repo
        self.objective_repo = objective_repo
        self.challenge_repo = challenge_repo
        self.kpi_repo = kpi_repo
        self.manager_kpi_repo = manager_kpi_repo
        self.achievement_notification_repo = achievement_notification_repo
        self.interview_note_repo = interview_note_repo
        self.debrief_repo = debrief_repo
        self.store_repo = store_repo
        self.workspace_repo = workspace_repo
        self.kpi_config_repo = kpi_config_repo
        self.daily_challenge_repo = daily_challenge_repo
        self.seller_bilan_repo = seller_bilan_repo
        self.sale_repo = sale_repo
        self.evaluation_repo = evaluation_repo

    # ===== SUBSCRIPTION & CONFIG (for seller routes without db) =====

    async def get_seller_subscription_status(self, gerant_id: str) -> Dict:
        """
        Check if the seller's gérant has an active subscription (workspace).
        Returns dict with isReadOnly, status, message, optional daysLeft.
        """
        if not gerant_id:
            return {"isReadOnly": True, "status": "no_gerant", "message": "Aucun gérant associé"}
        gerant = await self.user_repo.find_by_id(user_id=gerant_id)
        if not gerant:
            return {"isReadOnly": True, "status": "gerant_not_found", "message": "Gérant non trouvé"}
        workspace_id = gerant.get("workspace_id")
        if not workspace_id:
            return {"isReadOnly": True, "status": "no_workspace", "message": "Aucun espace de travail"}
        if not self.workspace_repo:
            return {"isReadOnly": True, "status": "error", "message": "Service non configuré"}
        workspace = await self.workspace_repo.find_by_id(workspace_id)
        if not workspace:
            return {"isReadOnly": True, "status": "workspace_not_found", "message": "Espace de travail non trouvé"}
        subscription_status = workspace.get("subscription_status", "inactive")
        if subscription_status == "active":
            return {"isReadOnly": False, "status": "active", "message": "Abonnement actif"}
        if subscription_status == "trialing":
            trial_end = workspace.get("trial_end")
            if trial_end:
                from datetime import timezone as tz
                now = datetime.now(tz.utc)
                if isinstance(trial_end, str):
                    trial_end_dt = datetime.fromisoformat(trial_end.replace("Z", "+00:00"))
                else:
                    trial_end_dt = trial_end
                if trial_end_dt.tzinfo is None:
                    trial_end_dt = trial_end_dt.replace(tzinfo=tz.utc)
                if now < trial_end_dt:
                    days_left = (trial_end_dt - now).days
                    return {"isReadOnly": False, "status": "trialing", "message": f"Essai gratuit - {days_left} jours restants", "daysLeft": days_left}
        return {"isReadOnly": True, "status": "trial_expired", "message": "Période d'essai terminée. Contactez votre administrateur."}

    async def get_kpi_config_for_seller(self, store_id: Optional[str], manager_id: Optional[str]) -> Optional[Dict]:
        """Find KPI config by store_id or manager_id. Returns None if kpi_config_repo not set."""
        if not self.kpi_config_repo:
            return None
        return await self.kpi_config_repo.find_by_store_or_manager(store_id=store_id, manager_id=manager_id)

    async def get_kpi_config_by_store(self, store_id: str) -> Optional[Dict]:
        """Get KPI config for a store. Used by routes instead of service.kpi_config_repo."""
        if not self.kpi_config_repo:
            return None
        return await self.kpi_config_repo.find_by_store(store_id)

    async def get_diagnostic_for_seller(self, seller_id: str) -> Optional[Dict]:
        """Get diagnostic for a seller. Used by routes instead of service.diagnostic_repo."""
        return await self.diagnostic_repo.find_by_seller(seller_id)

    async def update_diagnostic_scores_by_seller(self, seller_id: str, scores: Dict) -> bool:
        """Update diagnostic competence scores for a seller. Used by debriefs route."""
        return await self.diagnostic_repo.update_scores_by_seller(seller_id, scores)

    async def get_disc_profile_for_evaluation(self, user_id: str) -> Optional[Dict]:
        """Get DISC profile for evaluation guide: diagnostic first, then user.disc_profile fallback."""
        diagnostic = await self.diagnostic_repo.find_one(
            {"seller_id": user_id},
            {"_id": 0, "style": 1, "level": 1, "strengths": 1, "weaknesses": 1, "axes_de_developpement": 1},
        )
        if diagnostic:
            if "weaknesses" in diagnostic and "axes_de_developpement" not in diagnostic:
                diagnostic["axes_de_developpement"] = diagnostic.pop("weaknesses", [])
            return diagnostic
        user = await self.user_repo.find_one(
            {"id": user_id},
            {"_id": 0, "disc_profile": 1},
        )
        if user and user.get("disc_profile"):
            return user["disc_profile"]
        return None

    async def get_kpi_distinct_dates(self, query: Dict) -> List[str]:
        """Get distinct dates matching KPI query. Used by routes instead of service.kpi_repo."""
        return await self.kpi_repo.distinct_dates(query)

    async def get_kpi_entries_paginated(
        self, seller_id: str, page: int, size: int, projection: Optional[Dict] = None
    ) -> PaginatedResponse:
        """Get paginated KPI entries for seller. Used by routes instead of service.kpi_repo.collection."""
        proj = projection or {"_id": 0}
        return await paginate(
            collection=self.kpi_repo.collection,
            query={"seller_id": seller_id},
            page=page,
            size=size,
            projection=proj,
            sort=[("date", -1)],
        )

    async def get_kpi_entry_for_seller_date(
        self, seller_id: str, date: str
    ) -> Optional[Dict]:
        """Get KPI entry for seller on date. Used by routes instead of kpi_repo.find_by_seller_and_date."""
        return await self.kpi_repo.find_by_seller_and_date(seller_id, date)

    async def get_kpis_by_date_range(
        self, seller_id: str, start_date: str, end_date: str
    ) -> List[Dict]:
        """Get KPI entries for seller in date range. Used by evaluations route."""
        return await self.kpi_repo.find_by_date_range(seller_id, start_date, end_date)

    async def check_kpi_date_locked(self, store_id: str, date: str) -> bool:
        """Check if store/date has locked or API-sourced KPI entries. Used by routes instead of kpi_repo.find_many."""
        entries = await self.kpi_repo.find_many(
            {
                "store_id": store_id,
                "date": date,
                "$or": [{"locked": True}, {"source": "api"}],
            },
            projection={"_id": 0, "locked": 1, "source": 1},
            limit=1,
        )
        return len(entries) > 0

    async def get_kpi_aggregate_for_period(
        self, seller_id: str, start_date: Optional[str], end_date: Optional[str]
    ) -> Dict:
        """Aggregate KPI totals for seller in date range. Used by routes instead of kpi_repo.aggregate."""
        query: Dict = {"seller_id": seller_id}
        if start_date and end_date:
            query["date"] = {"$gte": start_date, "$lte": end_date}
        pipeline = [
            {"$match": query},
            {
                "$group": {
                    "_id": None,
                    "total_ca": {"$sum": {"$ifNull": ["$ca_journalier", {"$ifNull": ["$seller_ca", 0]}]}},
                    "total_ventes": {"$sum": {"$ifNull": ["$nb_ventes", 0]}},
                    "total_clients": {"$sum": {"$ifNull": ["$nb_clients", 0]}},
                }
            },
        ]
        result = await self.kpi_repo.aggregate(pipeline, max_results=1)
        return result[0] if result else {}

    async def create_diagnostic_for_seller(self, diagnostic_data: Dict) -> str:
        """Create diagnostic. Used by routes instead of service.diagnostic_repo."""
        return await self.diagnostic_repo.create_diagnostic(diagnostic_data)

    async def delete_diagnostic_by_seller(self, seller_id: str) -> int:
        """Delete all diagnostics for a seller. Used by routes instead of service.diagnostic_repo."""
        return await self.diagnostic_repo.delete_by_seller(seller_id)

    async def update_kpi_entry_by_id(self, entry_id: str, update_data: Dict) -> bool:
        """Update KPI entry by id. Used by routes instead of kpi_repo.update_one."""
        return await self.kpi_repo.update_one(
            {"id": entry_id}, {"$set": update_data}
        )

    async def create_kpi_entry(self, entry_data: Dict) -> str:
        """Create KPI entry. Used by routes instead of kpi_repo.insert_one."""
        return await self.kpi_repo.insert_one(entry_data)

    async def get_kpis_for_period_paginated(
        self,
        seller_id: str,
        start_date: Optional[str],
        end_date: Optional[str],
        page: int = 1,
        size: int = 50,
    ) -> PaginatedResponse:
        """Get paginated KPI entries for seller in date range (e.g. for bilan)."""
        query: Dict = {"seller_id": seller_id}
        if start_date and end_date:
            query["date"] = {"$gte": start_date, "$lte": end_date}
        return await paginate(
            collection=self.kpi_repo.collection,
            query=query,
            page=page,
            size=size,
            projection={"_id": 0},
            sort=[("date", -1)],
        )

    async def get_bilans_paginated(
        self, seller_id: str, page: int = 1, size: int = 50
    ) -> PaginatedResponse:
        """Get paginated bilans for seller. Used by routes instead of seller_bilan_repo.collection."""
        if not self.seller_bilan_repo:
            return PaginatedResponse(items=[], total=0, page=page, size=size, pages=0)
        return await paginate(
            collection=self.seller_bilan_repo.collection,
            query={"seller_id": seller_id},
            page=page,
            size=size,
            projection={"_id": 0},
            sort=[("created_at", -1)],
        )

    async def create_bilan(self, bilan_data: Dict) -> str:
        """Create bilan. Used by routes instead of seller_bilan_repo.create_bilan."""
        if not self.seller_bilan_repo:
            raise ForbiddenError("Service bilan non configuré")
        return await self.seller_bilan_repo.create_bilan(bilan_data)

    # ===== SELLER PROFILE & USER ACCESS (for routes: no direct repo access) =====

    async def get_seller_profile(
        self, user_id: str, projection: Optional[Dict] = None
    ) -> Optional[Dict]:
        """Get user/seller by id. Used by routes instead of service.user_repo.find_by_id."""
        proj = projection if projection is not None else {"_id": 0, "password": 0}
        return await self.user_repo.find_one({"id": user_id}, proj)

    async def list_managers_for_store(
        self,
        store_id: str,
        projection: Optional[Dict] = None,
        limit: int = 1,
    ) -> List[Dict]:
        """List managers for a store. Used by routes instead of service.user_repo.find_by_store."""
        proj = projection or {"_id": 0, "id": 1, "name": 1}
        return await self.user_repo.find_by_store(
            store_id=store_id, role="manager", projection=proj, limit=limit
        )

    async def get_user_by_id_and_role(
        self, user_id: str, role: str, projection: Optional[Dict] = None
    ) -> Optional[Dict]:
        """Get user by id and role. Used by evaluations/diagnostics and verify_evaluation_employee_access."""
        proj = projection or {"_id": 0}
        return await self.user_repo.find_one({"id": user_id, "role": role}, proj)

    async def get_users_by_store_and_role(
        self,
        store_id: str,
        role: str,
        projection: Optional[Dict] = None,
        limit: int = 100,
    ) -> List[Dict]:
        """Get users in store by role. Used by debriefs route for seller_ids."""
        proj = projection or {"_id": 0, "id": 1}
        return await self.user_repo.find_by_store(
            store_id=store_id, role=role, projection=proj, limit=limit
        )

    async def update_seller_manager_id(self, seller_id: str, manager_id: str) -> None:
        """Set manager_id on a seller. Used by routes instead of service.user_repo.update_one."""
        await self.user_repo.update_one(
            {"id": seller_id},
            {"$set": {"manager_id": manager_id, "updated_at": datetime.now(timezone.utc).isoformat()}},
        )

    async def ensure_seller_has_manager_link(self, seller_id: str) -> Optional[Dict]:
        """
        If seller has store_id but no manager_id, find first active manager for store and link.
        Returns seller profile (possibly updated). Used by objectives/challenges routes.
        """
        user = await self.get_seller_profile(seller_id)
        if not user or user.get("manager_id") or not user.get("store_id"):
            return user
        store_id = user["store_id"]
        managers = await self.list_managers_for_store(store_id, limit=1)
        manager = managers[0] if managers and managers[0].get("status") == "active" else None
        if not manager:
            return user
        manager_id = manager.get("id")
        await self.update_seller_manager_id(seller_id, manager_id)
        user["manager_id"] = manager_id
        return user

    async def get_store_by_id(
        self,
        store_id: str,
        gerant_id: Optional[str] = None,
        projection: Optional[Dict] = None,
    ) -> Optional[Dict]:
        """Get store by id. Used by routes instead of service.store_repo."""
        if not self.store_repo:
            return None
        return await self.store_repo.find_by_id(
            store_id=store_id, gerant_id=gerant_id, projection=projection
        )

    async def get_objective_if_accessible(self, objective_id: str, store_id: str) -> Dict:
        """Return objective if it belongs to store; else raise NotFoundError or ForbiddenError."""
        resource = await self.objective_repo.find_one(
            {"id": objective_id, "store_id": store_id}, {"_id": 0}
        )
        if resource:
            return resource
        exists = await self.objective_repo.find_one({"id": objective_id}, {"_id": 0})
        if exists:
            raise ForbiddenError("Objective non trouvé ou accès refusé")
        raise NotFoundError("Objective non trouvé")

    async def get_challenge_if_accessible(self, challenge_id: str, store_id: str) -> Dict:
        """Return challenge if it belongs to store; else raise NotFoundError or ForbiddenError."""
        resource = await self.challenge_repo.find_one(
            {"id": challenge_id, "store_id": store_id}, {"_id": 0}
        )
        if resource:
            return resource
        exists = await self.challenge_repo.find_one({"id": challenge_id}, {"_id": 0})
        if exists:
            raise ForbiddenError("Challenge non trouvé ou accès refusé")
        raise NotFoundError("Challenge non trouvé")

    async def update_objective_progress(
        self,
        objective_id: str,
        store_id: str,
        update_data: Dict,
        progress_entry: Dict,
    ) -> Optional[Dict]:
        """Update objective progress and progress_history. Returns updated objective or None."""
        await self.objective_repo.update_one(
            {"id": objective_id, "store_id": store_id},
            {
                "$set": update_data,
                "$push": {"progress_history": {"$each": [progress_entry], "$slice": -50}},
            },
        )
        return await self.objective_repo.find_by_id(
            objective_id=objective_id, store_id=store_id, projection={"_id": 0}
        )

    async def update_challenge_progress(
        self,
        challenge_id: str,
        store_id: str,
        update_data: Dict,
        progress_entry: Dict,
    ) -> Optional[Dict]:
        """Update challenge progress and progress_history. Returns updated challenge or None."""
        await self.challenge_repo.update_one(
            {"id": challenge_id, "store_id": store_id},
            {
                "$set": update_data,
                "$push": {"progress_history": {"$each": [progress_entry], "$slice": -50}},
            },
        )
        return await self.challenge_repo.find_by_id(
            challenge_id=challenge_id, store_id=store_id, projection={"_id": 0}
        )

    # ===== DAILY CHALLENGE (for routes: no direct daily_challenge_repo access) =====

    async def get_daily_challenge_for_seller_date(
        self, seller_id: str, date: str
    ) -> Optional[Dict]:
        """Get daily challenge for seller on date. Returns None if not set."""
        if not self.daily_challenge_repo:
            return None
        return await self.daily_challenge_repo.find_by_seller_and_date(seller_id, date)

    async def get_daily_challenge_completed_today(
        self, seller_id: str, date: str
    ) -> Optional[Dict]:
        """Get completed daily challenge for seller on date."""
        if not self.daily_challenge_repo:
            return None
        return await self.daily_challenge_repo.find_completed_today(seller_id, date)

    async def create_daily_challenge(self, challenge_data: Dict) -> str:
        """Create a daily challenge. Returns challenge id."""
        if not self.daily_challenge_repo:
            raise ForbiddenError("Service non configuré pour les défis quotidiens")
        return await self.daily_challenge_repo.create_challenge(challenge_data)

    async def update_daily_challenge(
        self, seller_id: str, date: str, update_data: Dict
    ) -> bool:
        """Update daily challenge for seller on date."""
        if not self.daily_challenge_repo:
            return False
        return await self.daily_challenge_repo.update_challenge(
            seller_id, date, update_data
        )

    async def delete_daily_challenges_for_seller(self, seller_id: str) -> int:
        """Delete all daily challenges for a seller."""
        if not self.daily_challenge_repo:
            return 0
        return await self.daily_challenge_repo.delete_by_seller(seller_id)

    async def get_daily_challenges_paginated(
        self, seller_id: str, page: int, size: int
    ) -> PaginatedResponse:
        """Get paginated daily challenges for seller."""
        if not self.daily_challenge_repo:
            return PaginatedResponse(items=[], total=0, page=page, size=size, pages=0)
        return await paginate(
            collection=self.daily_challenge_repo.collection,
            query={"seller_id": seller_id},
            page=page,
            size=size,
            projection={"_id": 0},
            sort=[("date", -1)],
        )

    async def delete_daily_challenges_by_filter(self, filters: Dict) -> int:
        """Delete daily challenges matching filters (e.g. for reset)."""
        if not self.daily_challenge_repo:
            return 0
        return await self.daily_challenge_repo.delete_many(filters)

    # ===== INTERVIEW NOTES (for routes: no direct interview_note_repo access) =====

    async def get_interview_notes_paginated(
        self, seller_id: str, page: int = 1, size: int = 50
    ) -> PaginatedResponse:
        """Get paginated interview notes for seller."""
        if not self.interview_note_repo:
            return PaginatedResponse(items=[], total=0, page=page, size=size, pages=0)
        return await paginate(
            collection=self.interview_note_repo.collection,
            query={"seller_id": seller_id},
            page=page,
            size=size,
            projection={"_id": 0},
            sort=[("date", -1)],
        )

    async def get_interview_note_by_seller_and_date(
        self, seller_id: str, date: str
    ) -> Optional[Dict]:
        """Get interview note for seller on date."""
        if not self.interview_note_repo:
            return None
        return await self.interview_note_repo.find_by_seller_and_date(seller_id, date)

    async def get_interview_notes_by_seller(self, seller_id: str) -> List[Dict]:
        """Get all interview notes for a seller. Used by evaluations route."""
        if not self.interview_note_repo:
            return []
        return await self.interview_note_repo.find_by_seller(seller_id)

    async def create_interview_note(self, note_data: Dict) -> str:
        """Create interview note. Returns note id."""
        if not self.interview_note_repo:
            raise ForbiddenError("Service notes d'entretien non configuré")
        return await self.interview_note_repo.create_note(note_data)

    async def update_interview_note_by_date(
        self, seller_id: str, date: str, update_data: Dict
    ) -> bool:
        """Update interview note by seller and date."""
        if not self.interview_note_repo:
            return False
        return await self.interview_note_repo.update_note_by_date(
            seller_id, date, update_data
        )

    async def get_interview_note_by_id_and_seller(
        self, note_id: str, seller_id: str
    ) -> Optional[Dict]:
        """Get interview note by id and seller (for ownership check)."""
        if not self.interview_note_repo:
            return None
        return await self.interview_note_repo.find_one(
            {"id": note_id, "seller_id": seller_id}, {"_id": 0}
        )

    async def update_interview_note_by_id(
        self, note_id: str, seller_id: str, update_data: Dict
    ) -> bool:
        """Update interview note by id (with seller_id for security)."""
        if not self.interview_note_repo:
            return False
        return await self.interview_note_repo.update_one(
            {"id": note_id, "seller_id": seller_id}, {"$set": update_data}
        )

    async def delete_interview_note_by_id(self, note_id: str, seller_id: str) -> bool:
        """Delete interview note by id (with seller_id for security)."""
        if not self.interview_note_repo:
            return False
        return await self.interview_note_repo.delete_note_by_id(note_id, seller_id)

    async def delete_interview_note_by_date(self, seller_id: str, date: str) -> bool:
        """Delete interview note by seller and date."""
        if not self.interview_note_repo:
            return False
        return await self.interview_note_repo.delete_note_by_date(seller_id, date)

    # ===== DEBRIEFS (for routes: no direct debrief_repo access) =====

    async def create_debrief(self, debrief_data: Dict, seller_id: str) -> str:
        """Create debrief. Used by debriefs route."""
        if not self.debrief_repo:
            raise ForbiddenError("Debrief repository not available")
        return await self.debrief_repo.create_debrief(debrief_data=debrief_data, seller_id=seller_id)

    async def get_debriefs_by_seller(
        self,
        seller_id: str,
        projection: Optional[Dict] = None,
        limit: int = 100,
        sort: Optional[List[tuple]] = None,
    ) -> List[Dict]:
        """Get debriefs for a seller. Used by debriefs route."""
        if not self.debrief_repo:
            return []
        proj = projection or {"_id": 0}
        s = sort or [("created_at", -1)]
        return await self.debrief_repo.find_by_seller(
            seller_id=seller_id, projection=proj, limit=limit, sort=s
        )

    async def get_debriefs_by_store(
        self,
        store_id: str,
        seller_ids: List[str],
        visible_to_manager: bool = True,
        projection: Optional[Dict] = None,
        limit: int = 100,
        sort: Optional[List[tuple]] = None,
    ) -> List[Dict]:
        """Get debriefs for a store (manager view). Used by debriefs route."""
        if not self.debrief_repo:
            return []
        proj = projection or {"_id": 0}
        s = sort or [("created_at", -1)]
        return await self.debrief_repo.find_by_store(
            store_id=store_id,
            seller_ids=seller_ids,
            visible_to_manager=visible_to_manager,
            projection=proj,
            limit=limit,
            sort=s,
        )

    async def update_debrief(
        self, debrief_id: str, update_data: Dict, seller_id: str
    ) -> bool:
        """Update debrief. Used by debriefs route."""
        if not self.debrief_repo:
            return False
        return await self.debrief_repo.update_debrief(
            debrief_id=debrief_id, update_data=update_data, seller_id=seller_id
        )

    async def delete_debrief(self, debrief_id: str, seller_id: str) -> bool:
        """Delete debrief. Used by debriefs route."""
        if not self.debrief_repo:
            return False
        return await self.debrief_repo.delete_debrief(
            debrief_id=debrief_id, seller_id=seller_id
        )

    # ===== ACHIEVEMENT NOTIFICATIONS =====
    
    async def check_achievement_notification(self, user_id: str, item_type: str, item_id: str) -> bool:
        """
        Check if user has already seen the achievement notification for an objective/challenge
        
        Args:
            user_id: User ID (seller or manager)
            item_type: "objective" or "challenge"
            item_id: Objective or challenge ID
            
        Returns:
            True if notification has been seen, False if unseen
        """
        notification = await self.achievement_notification_repo.find_by_user_and_item(
            user_id, item_type, item_id
        )
        return notification is not None
    
    async def mark_achievement_as_seen(self, user_id: str, item_type: str, item_id: str):
        """
        Mark an achievement notification as seen by a user
        
        Args:
            user_id: User ID (seller or manager)
            item_type: "objective" or "challenge"
            item_id: Objective or challenge ID
        """
        now = datetime.now(timezone.utc).isoformat()
        notification_data = {
            "seen_at": now,
            "updated_at": now,
            "created_at": now
        }
        await self.achievement_notification_repo.upsert_notification(
            user_id, item_type, item_id, notification_data
        )
    
    async def add_achievement_notification_flag(self, items: List[Dict], user_id: str, item_type: str):
        """
        Add has_unseen_achievement flag to objectives or challenges
        
        Args:
            items: List of objectives or challenges
            user_id: User ID (seller or manager)
            item_type: "objective" or "challenge"
        """
        for item in items:
            # Check if item is achieved/completed and notification not seen
            status = item.get('status')
            is_achieved = status in ['achieved', 'completed']
            
            if is_achieved:
                item_id = item.get('id')
                has_seen = await self.check_achievement_notification(user_id, item_type, item_id)
                item['has_unseen_achievement'] = not has_seen
            else:
                item['has_unseen_achievement'] = False
    
    # ===== TASKS =====
    
    async def get_seller_tasks(self, seller_id: str) -> List[Dict]:
        """
        Get all pending tasks for a seller
        - Check if diagnostic is completed
        - Check for pending manager requests
        """
        tasks = []
        
        # Check diagnostic
        diagnostic = await self.diagnostic_repo.find_by_seller(seller_id)
        
        if not diagnostic:
            tasks.append({
                "id": "diagnostic",
                "type": "diagnostic",
                "title": "Complète ton diagnostic vendeur",
                "description": "Découvre ton profil unique en 10 minutes",
                "priority": "high",
                "icon": "📋"
            })
        
        # Check pending manager requests
        requests_list = await self.manager_request_repo.find_by_seller(
            seller_id, status="pending", limit=100
        )
        
        for req in requests_list:
            # Ensure created_at is properly formatted
            if isinstance(req.get('created_at'), str):
                req['created_at'] = datetime.fromisoformat(req['created_at'])
            
            tasks.append({
                "id": req['id'],
                "type": "manager_request",
                "title": req['title'],
                "description": req['message'],
                "priority": "medium",
                "icon": "💬",
                "data": req
            })
        
        return tasks
    
    # ===== OBJECTIVES =====
    
    async def get_seller_objectives_active(self, seller_id: str, manager_id: Optional[str] = None) -> List[Dict]:
        """
        Get active team objectives for display in seller dashboard
        
        CRITICAL: Filter by store_id (not manager_id) to include objectives created by:
        - Managers of the store
        - Gérants (store owners)
        
        The manager_id parameter is optional and only used for progress calculation, NOT for filtering visibility.
        If manager_id is None, progress calculation may be limited but objectives will still be visible.
        """
        today = datetime.now(timezone.utc).date().isoformat()
        
        # Get seller's store_id for filtering
        seller = await self.user_repo.find_by_id(seller_id, projection={"_id": 0, "store_id": 1})
        seller_store_id = seller.get("store_id") if seller else None
        
        if not seller_store_id:
            return []
        
        # Build query: filter by store_id (not manager_id), visible, and period
        # This ensures objectives created by gérants are also visible to sellers
        query = {
            "store_id": seller_store_id,  # ✅ Filter by store, not manager
            "period_end": {"$gte": today},
            "visible": True
        }
        # manager_id removed from query - used only for progress calculation
        
        # Get active objectives from the store (created by manager OR gérant)
        objectives = await self.objective_repo.find_by_store(
            seller_store_id,
            projection={"_id": 0},
            limit=100,
            sort=[("period_start", 1)]
        )
        # Filter by period_end and visible
        objectives = [obj for obj in objectives if obj.get("period_end", "") >= today and obj.get("visible", False)]
        
        # Filter objectives based on visibility rules
        filtered_objectives = []
        for objective in objectives:
            obj_type = objective.get('type', 'collective')
            visible_to = objective.get('visible_to_sellers')
            
            # Individual objectives: only show if it's for this seller
            if obj_type == 'individual':
                if objective.get('seller_id') == seller_id:
                    filtered_objectives.append(objective)
            # Collective objectives: check visible_to_sellers list
            else: 
                # - If visible_to_sellers is None or [] (empty), objective is visible to ALL sellers
                # - If visible_to_sellers is [id1, id2], objective is visible ONLY to these sellers
                if visible_to is None or (isinstance(visible_to, list) and len(visible_to) == 0):
                    # Visible to all sellers (no restriction)
                    filtered_objectives.append(objective)
                elif isinstance(visible_to, list) and seller_id in visible_to:
                    # Visible only to specific sellers, and this seller is in the list
                    filtered_objectives.append(objective)
        
        # Ensure status field exists and is up-to-date (recalculate if needed)
        for objective in filtered_objectives:
            current_val = objective.get('current_value', 0)
            target_val = objective.get('target_value', 0)
            period_end = objective.get('period_end')
            
            # Always recalculate status to ensure it's correct (especially after progress updates)
            if period_end:
                new_status = self.compute_status(current_val, target_val, period_end)
                old_status = objective.get('status')
                objective['status'] = new_status
                
                # Status updated
            else:
                objective['status'] = 'active'  # Fallback if no end_date
        
        # Add achievement notification flags
        await self.add_achievement_notification_flag(filtered_objectives, seller_id, "objective")
        
        # Filter out achieved objectives (they should go to history)
        # Achieved objectives are moved to history, regardless of notification status
        # The notification can still be shown when viewing history or dashboard
        # IMPORTANT: Once an objective is "achieved", it should NEVER appear in active list again
        final_objectives = []
        
        for objective in filtered_objectives:
            status = objective.get('status')
            
            # Keep in active list ONLY if status is 'active' or 'failed'
            # ALL achieved objectives go to history (even if has_unseen_achievement is true)
            # The notification modal should be triggered BEFORE the objective moves to history
            if status in ['active', 'failed']:
                final_objectives.append(objective)
            elif status == 'achieved':
                # Exclude from active list - will appear in history
                # Even if has_unseen_achievement is true, don't show it in active list
                pass
            # All other statuses are excluded
        
        return final_objectives
    
    async def get_seller_objectives_all(self, seller_id: str, manager_id: Optional[str] = None) -> Dict:
        """
        Get all team objectives (active and inactive) for seller
        
        CRITICAL: Filter by store_id (not manager_id) to include objectives created by:
        - Managers of the store
        - Gérants (store owners)
        
        The manager_id parameter is optional and only used for progress calculation, NOT for filtering visibility.
        """
        today = datetime.now(timezone.utc).date().isoformat()
        
        # Get seller's store_id for filtering
        seller = await self.user_repo.find_by_id(seller_id, projection={"_id": 0, "store_id": 1})
        seller_store_id = seller.get("store_id") if seller else None
        
        if not seller_store_id:
            return {"active": [], "inactive": []}
        
        # Build query: filter by store_id (not manager_id), and visible
        # This ensures objectives created by gérants are also visible to sellers
        query = {
            "store_id": seller_store_id,  # ✅ Filter by store, not manager
            "visible": True
        }
        # manager_id removed from query - used only for progress calculation
        
        # Get ALL objectives from the store (created by manager OR gérant)
        # CRITICAL: Use 'objectives' collection (not 'manager_objectives') to match where objectives are created
        all_objectives = await self.objective_repo.find_by_store(
            seller_store_id,
            projection={"_id": 0},
            limit=100,
            sort=[("period_start", -1)]
        )
        # Filter by visible
        all_objectives = [obj for obj in all_objectives if obj.get("visible", False)]
        
        # Filter objectives based on visibility rules and separate active/inactive
        active_objectives = []
        inactive_objectives = []
        
        for objective in all_objectives:
            obj_type = objective.get('type', 'collective')
            should_include = False
            
            # Individual objectives: only show if it's for this seller
            if obj_type == 'individual':
                if objective.get('seller_id') == seller_id:
                    should_include = True
            # Collective objectives: check visible_to_sellers list
            else:
                visible_to = objective.get('visible_to_sellers')
                # CRITICAL: 
                # - If visible_to_sellers is None or [] (empty), objective is visible to ALL sellers
                # - If visible_to_sellers is [id1, id2], objective is visible ONLY to these sellers
                if visible_to is None or (isinstance(visible_to, list) and len(visible_to) == 0):
                    # Visible to all sellers (no restriction)
                    should_include = True
                elif isinstance(visible_to, list) and seller_id in visible_to:
                    # Visible only to specific sellers, and this seller is in the list
                    should_include = True
            
            if should_include:
                # Calculate progress
                await self.calculate_objective_progress(objective, manager_id)
                
                # Separate active vs inactive
                if objective.get('period_end', '') > today:
                    active_objectives.append(objective)
                else:
                    inactive_objectives.append(objective)
        
        return {
            "active": active_objectives,
            "inactive": inactive_objectives
        }
    
    async def get_seller_objectives_history(self, seller_id: str, manager_id: Optional[str] = None) -> List[Dict]:
        """
        Get completed objectives (past period_end date OR achieved with notification seen) for seller
        
        CRITICAL: Filter by store_id (not manager_id) to include objectives created by:
        - Managers of the store
        - Gérants (store owners)
        
        The manager_id parameter is optional and only used for progress calculation, NOT for filtering visibility.
        """
        today = datetime.now(timezone.utc).date().isoformat()
        
        # Get seller's store_id for filtering
        seller = await self.user_repo.find_by_id(seller_id, projection={"_id": 0, "store_id": 1})
        seller_store_id = seller.get("store_id") if seller else None
        
        if not seller_store_id:
            return []
        
        # Build query: filter by store_id (not manager_id), visible
        # Include objectives that are:
        # 1. Past period_end date (period_end < today)
        # 2. OR status is 'achieved' or 'failed' (regardless of period_end)
        query = {
            "store_id": seller_store_id,  # ✅ Filter by store, not manager
            "visible": True,
            "$or": [
                {"period_end": {"$lt": today}},  # Period ended
                {"status": {"$in": ["achieved", "failed"]}}  # Or achieved/failed (even if period not ended)
            ]
        }
        # manager_id removed from query - used only for progress calculation
        
        # Get past objectives from the store (created by manager OR gérant)
        # CRITICAL: Use 'objectives' collection (not 'manager_objectives') to match where objectives are created
        objectives = await self.objective_repo.find_by_store(
            seller_store_id,
            projection={"_id": 0},
            limit=50,
            sort=[("period_start", -1)]
        )
        # Filter by period_end, status, and visible
        objectives = [obj for obj in objectives if (
            obj.get("period_end", "") < today or obj.get("status") in ["achieved", "failed"]
        ) and obj.get("visible", False)]
        
        # Filter objectives based on visibility rules
        filtered_objectives = []
        for objective in objectives:
            obj_type = objective.get('type', 'collective')
            
            # Individual objectives: only show if it's for this seller
            if obj_type == 'individual':
                if objective.get('seller_id') == seller_id:
                    filtered_objectives.append(objective)
            # Collective objectives: check visible_to_sellers list
            else:
                visible_to = objective.get('visible_to_sellers')
                # CRITICAL: 
                # - If visible_to_sellers is None or [] (empty), objective is visible to ALL sellers
                # - If visible_to_sellers is [id1, id2], objective is visible ONLY to these sellers
                if visible_to is None or (isinstance(visible_to, list) and len(visible_to) == 0):
                    # Visible to all sellers (no restriction)
                    filtered_objectives.append(objective)
                elif isinstance(visible_to, list) and seller_id in visible_to:
                    # Visible only to specific sellers, and this seller is in the list
                    filtered_objectives.append(objective)
        
        # Calculate progress for each objective (this will recalculate status)
        for objective in filtered_objectives:
            await self.calculate_objective_progress(objective, manager_id)
        
        # Filter: include ALL objectives that should be in history
        # 1. Period ended (period_end < today) - regardless of status
        # 2. OR status is 'achieved'/'failed' - regardless of notification status
        # This ensures achieved objectives appear in history even if notification wasn't seen
        final_objectives = []
        for objective in filtered_objectives:
            # Recalculate status to ensure it's up-to-date based on current_value and target_value
            # Ensure values are floats for proper comparison (handles string/int/float types)
            current_val = float(objective.get('current_value', 0)) if objective.get('current_value') is not None else 0.0
            target_val = float(objective.get('target_value', 0)) if objective.get('target_value') is not None else 0.0
            period_end_str = objective.get('period_end', '')
            
            if period_end_str:
                # Always recalculate status to ensure it's correct
                new_status = self.compute_status(current_val, target_val, period_end_str)
                objective['status'] = new_status
            
            status = objective.get('status')
            period_end = objective.get('period_end', '')
            
            # Include in history if:
            # 1. Period has ended (regardless of status)
            # 2. OR status is achieved/failed (regardless of period_end or notification status)
            if period_end < today:
                # Period ended, include in history
                final_objectives.append(objective)
            elif status in ['achieved', 'failed']:
                # Achieved/failed, include in history (even if notification not seen)
                final_objectives.append(objective)
            
            # Add 'achieved' property for frontend compatibility
            # achieved = True if status is 'achieved', False otherwise
            objective['achieved'] = (status == 'achieved')
        
        return final_objectives
    
    # ===== CHALLENGES =====
    
    async def get_seller_challenges(self, seller_id: str, manager_id: str) -> List[Dict]:
        """
        Get all challenges (collective + individual) for seller
        
        CRITICAL: Filter by store_id (not manager_id) to include challenges created by:
        - Managers of the store
        - Gérants (store owners)
        """
        # Get seller's store_id for filtering
        seller = await self.user_repo.find_by_id(seller_id, projection={"_id": 0, "store_id": 1})
        seller_store_id = seller.get("store_id") if seller else None
        
        if not seller_store_id:
            return []
        
        # Build query: filter by store_id (not manager_id), visible, and type
        # This ensures challenges created by gérants are also visible to sellers
        query = {
            "store_id": seller_store_id,  # ✅ Filter by store, not manager
            "visible": True,
            "$or": [
                {"type": "collective"},
                {"type": "individual", "seller_id": seller_id}
            ]
        }
        # manager_id removed from query - used only for progress calculation
        
        # Get collective challenges + individual challenges assigned to this seller
        # From the store (created by manager OR gérant)
        challenges = await self.challenge_repo.find_by_store(
            seller_store_id,
            projection={"_id": 0},
            limit=100,
            sort=[("created_at", -1)]
        )
        # Filter by visible and type
        challenges = [c for c in challenges if c.get("visible", False) and (
            c.get("type") == "collective" or (c.get("type") == "individual" and c.get("seller_id") == seller_id)
        )]
        
        # Filter challenges based on visibility rules (for collective challenges)
        filtered_challenges = []
        for challenge in challenges:
            chall_type = challenge.get('type', 'collective')
            
            # Individual challenges: already filtered by query
            if chall_type == 'individual':
                filtered_challenges.append(challenge)
            # Collective challenges: check visible_to_sellers list
            else:
                visible_to = challenge.get('visible_to_sellers')
                # CRITICAL: 
                # - If visible_to_sellers is None or [] (empty), challenge is visible to ALL sellers
                # - If visible_to_sellers is [id1, id2], challenge is visible ONLY to these sellers
                if visible_to is None or (isinstance(visible_to, list) and len(visible_to) == 0):
                    # Visible to all sellers (no restriction)
                    filtered_challenges.append(challenge)
                elif isinstance(visible_to, list) and seller_id in visible_to:
                    # Visible only to specific sellers, and this seller is in the list
                    filtered_challenges.append(challenge)
        
        for challenge in filtered_challenges:
            await self.calculate_challenge_progress(challenge, seller_id)
        await self.add_achievement_notification_flag(filtered_challenges, seller_id, "challenge")

        result = filtered_challenges
        return result

    async def get_seller_challenges_active(self, seller_id: str, manager_id: Optional[str] = None) -> List[Dict]:
        """
        Get only active challenges (collective + personal) for display in seller dashboard
        
        CRITICAL: Filter by store_id (not manager_id) to include challenges created by:
        - Managers of the store
        - Gérants (store owners)
        
        The manager_id parameter is optional and only used for progress calculation, NOT for filtering visibility.
        If manager_id is None, progress calculation may be limited but challenges will still be visible.
        """
        today = datetime.now(timezone.utc).date().isoformat()
        
        # Get seller's store_id for filtering
        seller = await self.user_repo.find_by_id(seller_id, projection={"_id": 0, "store_id": 1})
        seller_store_id = seller.get("store_id") if seller else None
        
        if not seller_store_id:
            return []
        
        # Build query: filter by store_id (not manager_id), visible, and period
        # This ensures challenges created by gérants are also visible to sellers
        # Note: We don't filter by status here because we need to calculate it first
        query = {
            "store_id": seller_store_id,  # ✅ Filter by store, not manager
            "end_date": {"$gte": today},
            "visible": True
        }
        # manager_id removed from query - used only for progress calculation
        
        # Get active challenges from the store (created by manager OR gérant)
        challenges = await self.challenge_repo.find_by_store(
            seller_store_id,
            projection={"_id": 0},
            limit=10,
            sort=[("start_date", 1)]
        )
        # Filter by end_date and visible
        challenges = [c for c in challenges if c.get("end_date", "") >= today and c.get("visible", False)]
        
        # Filter challenges based on visibility rules
        filtered_challenges = []
        for challenge in challenges:
            chall_type = challenge.get('type', 'collective')
            visible_to = challenge.get('visible_to_sellers')
            
            # Individual challenges: only show if it's for this seller
            if chall_type == 'individual':
                if challenge.get('seller_id') == seller_id:
                    filtered_challenges.append(challenge)
            # Collective challenges: check visible_to_sellers list
            else:
                # If visible_to_sellers is None or [] (empty), challenge is visible to ALL sellers
                # If visible_to_sellers is [id1, id2], challenge is visible ONLY to these sellers
                if visible_to is None or (isinstance(visible_to, list) and len(visible_to) == 0):
                    filtered_challenges.append(challenge)
                elif isinstance(visible_to, list) and seller_id in visible_to:
                    filtered_challenges.append(challenge)
        
        # Calculate progress for each challenge
        for challenge in filtered_challenges:
            await self.calculate_challenge_progress(challenge, seller_id)
        
        # Add achievement notification flags
        await self.add_achievement_notification_flag(filtered_challenges, seller_id, "challenge")
        
        # Filter out achieved/completed challenges (they should go to history)
        final_challenges = []
        for challenge in filtered_challenges:
            status = challenge.get('status')
            
            # Keep in active list ONLY if status is 'active' or 'failed'
            # ALL achieved/completed challenges go to history
            if status in ['active', 'failed']:
                final_challenges.append(challenge)
            elif status in ['achieved', 'completed']:
                # Exclude from active list - will appear in history
                pass
            # All other statuses are excluded
        
        return final_challenges
    
    async def get_seller_challenges_history(self, seller_id: str, manager_id: Optional[str] = None) -> List[Dict]:
        """
        Get completed challenges (past end_date) for seller
        
        CRITICAL: Filter by store_id (not manager_id) to include challenges created by:
        - Managers of the store
        - Gérants (store owners)
        
        The manager_id parameter is optional and only used for progress calculation, NOT for filtering visibility.
        """
        today = datetime.now(timezone.utc).date().isoformat()
        
        # Get seller's store_id for filtering
        seller = await self.user_repo.find_by_id(seller_id, projection={"_id": 0, "store_id": 1})
        seller_store_id = seller.get("store_id") if seller else None
        
        if not seller_store_id:
            return []
        
        # Build query: filter by store_id (not manager_id), visible, and period
        # This ensures challenges created by gérants are also visible to sellers
        query = {
            "store_id": seller_store_id,  # ✅ Filter by store, not manager
            "end_date": {"$lt": today},
            "visible": True
        }
        # manager_id removed from query - used only for progress calculation
        
        # Get past challenges from the store (created by manager OR gérant)
        challenges = await self.challenge_repo.find_by_store(
            seller_store_id,
            projection={"_id": 0},
            limit=50,
            sort=[("start_date", -1)]
        )
        # Filter by end_date and visible
        challenges = [c for c in challenges if c.get("end_date", "") < today and c.get("visible", False)]
        
        # Filter challenges based on visibility rules
        filtered_challenges = []
        for challenge in challenges:
            chall_type = challenge.get('type', 'collective')
            
            # Individual challenges: only show if it's for this seller
            if chall_type == 'individual':
                if challenge.get('seller_id') == seller_id:
                    filtered_challenges.append(challenge)
            # Collective challenges: check visible_to_sellers list
            else:
                visible_to = challenge.get('visible_to_sellers')
                # CRITICAL: 
                # - If visible_to_sellers is None or [] (empty), challenge is visible to ALL sellers
                # - If visible_to_sellers is [id1, id2], challenge is visible ONLY to these sellers
                if visible_to is None or (isinstance(visible_to, list) and len(visible_to) == 0):
                    # Visible to all sellers (no restriction)
                    filtered_challenges.append(challenge)
                elif isinstance(visible_to, list) and seller_id in visible_to:
                    # Visible only to specific sellers, and this seller is in the list
                    filtered_challenges.append(challenge)
        
        # Calculate progress for each challenge
        for challenge in filtered_challenges:
            await self.calculate_challenge_progress(challenge, seller_id)
        
        # Add 'achieved' property for frontend compatibility
        for challenge in filtered_challenges:
            status = challenge.get('status')
            # achieved = True if status is 'achieved' or 'completed', False otherwise
            challenge['achieved'] = (status in ['achieved', 'completed'])
        
        return filtered_challenges
    
    # ===== HELPER FUNCTIONS =====
    
    @staticmethod
    def compute_status(current_value: float, target_value: float, end_date: str) -> str:
        """
        Compute objective status based on current value, target value, and end date.
        
        Rules:
        - status="active" by default (at creation)
        - status="achieved" only if current_value >= target_value (and target_value > 0)
        - status="failed" only if now > end_date AND not achieved
        - Never force "achieved" based on objective_type alone
        
        Args:
            current_value: Current progress value
            target_value: Target value
            end_date: End date in format YYYY-MM-DD
            
        Returns:
            "active" | "achieved" | "failed"
        """
        today = datetime.now(timezone.utc).date()
        end_date_obj = datetime.fromisoformat(end_date).date()
        
        # Ensure both values are floats for proper comparison (handles string/int/float types)
        current_value = float(current_value) if current_value is not None else 0.0
        target_value = float(target_value) if target_value is not None else 0.0
        
        # Check if objective is achieved (only if target is meaningful and current >= target)
        is_achieved = False
        if target_value > 0.01:  # Only consider achieved if target is meaningful
            # Use a small epsilon for floating point comparison to handle precision issues
            # This ensures that values like 30000.0 >= 30000.0 are correctly identified as achieved
            is_achieved = current_value >= (target_value - 0.001)
        
        # Check if period is over (today is after end_date)
        is_expired = today > end_date_obj
        
        # Determine status
        if is_achieved:
            return "achieved"
        elif is_expired:
            return "failed"
        else:
            return "active"
    
    async def calculate_objective_progress(self, objective: dict, manager_id: Optional[str] = None):
        """Calculate progress for an objective (team-wide)
        
        Args:
            objective: Objective dictionary
            manager_id: Optional manager ID (used only if store_id is not available for backward compatibility)
        """
        # If progress is entered manually by the manager or seller, do NOT overwrite it from KPI aggregates.
        # Otherwise, any refresh will "reset" manual progress back to KPI-derived totals (often 0).
        # This prevents synchronization issues where manual updates are overwritten by automatic calculations.
        data_entry_responsible = str(objective.get('data_entry_responsible', '')).lower()
        if data_entry_responsible in ['manager', 'seller']:
            target_value = objective.get('target_value', 0)
            end_date = objective.get('period_end') or objective.get('end_date')
            current_value = float(objective.get('current_value') or 0)
            objective['status'] = self.compute_status(current_value, target_value, end_date)
            # Only update status in DB, keep current_value as-is (manually entered)
            await self.objective_repo.update_objective(
                objective['id'],
                {"status": objective['status']},
                store_id=objective.get('store_id'),
                manager_id=objective.get('manager_id')
            )
            return

        start_date = objective['period_start']
        end_date = objective['period_end']
        store_id = objective.get('store_id')
        
        # Build query for sellers - prioritize store_id (multi-store support)
        seller_query = {"role": "seller"}
        if store_id:
            # CRITICAL: Use store_id for filtering (works for objectives created by managers OR gérants)
            seller_query["store_id"] = store_id
        elif manager_id:
            # Fallback to manager_id for backward compatibility (only if store_id is not available)
            seller_query["manager_id"] = manager_id
        else:
            # No store_id and no manager_id - cannot calculate progress
            return
        
        # Get all sellers for this store/manager (PHASE 8: iterator via repository, no .collection)
        seller_ids = []
        async for uid in self.user_repo.find_ids_by_query(seller_query):
            seller_ids.append(uid)
        
        # ✅ PHASE 6: Use aggregation instead of .to_list(10000) for memory efficiency. Phase 0: use injected repos.
        # Build KPI query with store_id filter if available
        kpi_query = {
            "seller_id": {"$in": seller_ids}
        }
        if store_id:
            kpi_query["store_id"] = store_id
        
        # Use aggregation to calculate totals (optimized - no .to_list(10000))
        date_range = {"$gte": start_date, "$lte": end_date}
        seller_totals = await self.kpi_repo.aggregate_totals(kpi_query, date_range)
        
        total_ca = seller_totals["total_ca"]
        total_ventes = seller_totals["total_ventes"]
        total_articles = seller_totals["total_articles"]
        
        # Fallback to manager KPIs if seller data is missing (only if manager_id is available)
        if manager_id and (total_ca == 0 or total_ventes == 0 or total_articles == 0):
            manager_kpi_query = {"manager_id": manager_id}
            if store_id:
                manager_kpi_query["store_id"] = store_id
            
            manager_totals = await self.manager_kpi_repo.aggregate_totals(manager_kpi_query, date_range)
            
            if total_ca == 0:
                total_ca = manager_totals["total_ca"]
            if total_ventes == 0:
                total_ventes = manager_totals["total_ventes"]
            if total_articles == 0:
                total_articles = manager_totals["total_articles"]
        
        # Calculate averages
        panier_moyen = total_ca / total_ventes if total_ventes > 0 else 0
        indice_vente = total_ca / total_articles if total_articles > 0 else 0
        
        # Update progress
        objective['progress_ca'] = total_ca
        objective['progress_ventes'] = total_ventes
        objective['progress_articles'] = total_articles
        objective['progress_panier_moyen'] = panier_moyen
        objective['progress_indice_vente'] = indice_vente
        
        # Determine current_value and target_value for status computation
        target_value = objective.get('target_value', 0)
        current_value = 0
        
        # For kpi_standard objectives, use the relevant KPI value
        if objective.get('objective_type') == 'kpi_standard' and objective.get('kpi_name'):
            kpi_name = objective['kpi_name']
            if kpi_name == 'ca':
                current_value = total_ca
            elif kpi_name == 'ventes':
                current_value = total_ventes
            elif kpi_name == 'articles':
                current_value = total_articles
            elif kpi_name == 'panier_moyen':
                current_value = panier_moyen
            elif kpi_name == 'indice_vente':
                current_value = indice_vente
        elif objective.get('objective_type') == 'product_focus':
            # For product_focus objectives, use current_value if manually entered, otherwise use target_value as fallback
            # The current_value should be updated manually by seller/manager via progress update endpoint
            current_value = float(objective.get('current_value', 0))
            # If current_value is 0 but we have progress data, it means it hasn't been updated yet
            # In this case, we should use the stored current_value (which might be from manual entry)
        elif objective.get('objective_type') == 'custom':
            # For custom objectives, use current_value if manually entered
            current_value = float(objective.get('current_value', 0))
        else:
            # For other objective types, use current_value if set, otherwise calculate from CA
            current_value = objective.get('current_value', total_ca)
            # For legacy objectives, check if they have specific targets
            if objective.get('ca_target'):
                target_value = objective.get('ca_target', 0)
                current_value = total_ca
            elif objective.get('panier_moyen_target'):
                target_value = objective.get('panier_moyen_target', 0)
                current_value = panier_moyen
            elif objective.get('indice_vente_target'):
                target_value = objective.get('indice_vente_target', 0)
                current_value = indice_vente
        
        # Ensure current_value and target_value are floats for proper comparison
        current_value = float(current_value) if current_value else 0.0
        target_value = float(target_value) if target_value else 0.0
        
        # Use centralized status computation
        objective['status'] = self.compute_status(current_value, target_value, end_date)
        
        # Save progress to database (including computed status)
        # CRITICAL: Use 'objectives' collection (not 'manager_objectives') to match where objectives are created
        await self.objective_repo.update_objective(
            objective['id'],
            {
                "progress_ca": total_ca,
                "progress_ventes": total_ventes,
                "progress_articles": total_articles,
                "progress_panier_moyen": panier_moyen,
                "progress_indice_vente": indice_vente,
                "status": objective['status'],
                "current_value": current_value
            },
            store_id=objective.get('store_id'),
            manager_id=objective.get('manager_id')
        )
    
    async def calculate_objectives_progress_batch(self, objectives: List[Dict], manager_id: str, store_id: str):
        """
        Calculate progress for multiple objectives in batch (optimized version)
        Preloads all KPI data once instead of N queries per objective
        
        Args:
            objectives: List of objective dicts
            manager_id: Manager ID
            store_id: Store ID (all objectives must be from same store)
        
        Returns:
            List of objectives with progress calculated (in-place modification)
        """
        if not objectives:
            return objectives
        
        # Get all sellers for this store/manager (1 query)
        from utils.db_counter import increment_db_op
        
        seller_query = {"role": "seller"}
        if store_id:
            seller_query["store_id"] = store_id
        else:
            seller_query["manager_id"] = manager_id
        
        increment_db_op("db.users.find (sellers - objectives)")
        # PHASE 8: iterator via repository, no .collection / no limit=1000
        seller_ids = []
        async for uid in self.user_repo.find_ids_by_query(seller_query):
            seller_ids.append(uid)
        
        if not seller_ids:
            # No sellers, set all progress to 0
            for objective in objectives:
                objective['progress_ca'] = 0
                objective['progress_ventes'] = 0
                objective['progress_articles'] = 0
                objective['progress_panier_moyen'] = 0
                objective['progress_indice_vente'] = 0
                objective['current_value'] = 0
                objective['status'] = self.compute_status(0, objective.get('target_value', 0), objective.get('period_end'))
            return objectives
        
        # Calculate global date range (min start, max end)
        min_start = min(obj.get('period_start', '') for obj in objectives if obj.get('period_start'))
        max_end = max(obj.get('period_end', '') for obj in objectives if obj.get('period_end'))
        
        if not min_start or not max_end:
            # Invalid date ranges, set all progress to 0
            for objective in objectives:
                objective['progress_ca'] = 0
                objective['progress_ventes'] = 0
                objective['progress_articles'] = 0
                objective['progress_panier_moyen'] = 0
                objective['progress_indice_vente'] = 0
                objective['current_value'] = 0
                objective['status'] = self.compute_status(0, objective.get('target_value', 0), objective.get('period_end'))
            return objectives
        
        # Preload all KPI entries for the global date range (1 query)
        kpi_query = {
            "seller_id": {"$in": seller_ids},
            "date": {"$gte": min_start, "$lte": max_end}
        }
        if store_id:
            kpi_query["store_id"] = store_id
        
        increment_db_op("db.kpi_entries.find (batch - objectives)")
        # ⚠️ SECURITY: Limit to 10,000 documents max to prevent OOM
        # If more data is needed, use streaming/cursor approach
        MAX_KPI_BATCH_SIZE = 10000
        # ✅ PHASE 7: Use repository instead of direct DB access
        all_kpi_entries = await self.kpi_repo.find_many(kpi_query, {"_id": 0}, limit=MAX_KPI_BATCH_SIZE)
        
        if len(all_kpi_entries) == MAX_KPI_BATCH_SIZE:
            logger.warning(f"KPI entries query hit limit of {MAX_KPI_BATCH_SIZE} documents. Consider using pagination or date range filtering.")
        
        # Preload all manager KPIs for the global date range (1 query)
        manager_kpi_query = {
            "manager_id": manager_id,
            "date": {"$gte": min_start, "$lte": max_end}
        }
        if store_id:
            manager_kpi_query["store_id"] = store_id
        
        increment_db_op("db.manager_kpis.find (batch - objectives)")
        # ⚠️ SECURITY: Limit to 10,000 documents max to prevent OOM
        # ✅ PHASE 7: Use repository instead of direct DB access
        all_manager_kpis = await self.manager_kpi_repo.find_many(manager_kpi_query, {"_id": 0}, limit=MAX_KPI_BATCH_SIZE)
        
        if len(all_manager_kpis) == MAX_KPI_BATCH_SIZE:
            logger.warning(f"Manager KPIs query hit limit of {MAX_KPI_BATCH_SIZE} documents. Consider using pagination or date range filtering.")
        
        # Group KPI entries by (seller_id, date) for fast lookup
        kpi_by_seller_date = {}
        for entry in all_kpi_entries:
            seller_id = entry.get('seller_id')
            date = entry.get('date')
            if seller_id and date:
                key = (seller_id, date)
                if key not in kpi_by_seller_date:
                    kpi_by_seller_date[key] = []
                kpi_by_seller_date[key].append(entry)
        
        # Group manager KPIs by (manager_id, date) for fast lookup
        manager_kpi_by_date = {}
        for entry in all_manager_kpis:
            date = entry.get('date')
            if date:
                if date not in manager_kpi_by_date:
                    manager_kpi_by_date[date] = []
                manager_kpi_by_date[date].append(entry)
        
        # Calculate progress for each objective using preloaded data
        updates = []
        for objective in objectives:
            start_date = objective.get('period_start')
            end_date = objective.get('period_end')

            # If progress is entered manually by the manager or seller, do NOT overwrite it from KPI aggregates.
            # Important: this function bulk-writes computed fields back to DB; we must skip manual objectives.
            # This prevents synchronization issues where manual updates are overwritten by automatic calculations.
            data_entry_responsible = str(objective.get('data_entry_responsible', '')).lower()
            if data_entry_responsible in ['manager', 'seller']:
                target_value = objective.get('target_value', 0)
                current_value = float(objective.get('current_value') or 0)
                objective['status'] = self.compute_status(current_value, target_value, end_date)
                # Keep stored progress_* and current_value as-is; do not append bulk update.
                continue
            
            if not start_date or not end_date:
                # Invalid date range, set progress to 0
                objective['progress_ca'] = 0
                objective['progress_ventes'] = 0
                objective['progress_articles'] = 0
                objective['progress_panier_moyen'] = 0
                objective['progress_indice_vente'] = 0
                objective['current_value'] = 0
                objective['status'] = self.compute_status(0, objective.get('target_value', 0), end_date)
                continue
            
            # Filter KPI entries for this objective's date range (in-memory filter)
            objective_kpi_entries = [
                entry for entry in all_kpi_entries
                if start_date <= entry.get('date', '') <= end_date
            ]
            
            # Filter manager KPIs for this objective's date range (in-memory filter)
            objective_manager_kpis = [
                entry for entry in all_manager_kpis
                if start_date <= entry.get('date', '') <= end_date
            ]
            
            # Calculate totals from seller entries
            total_ca = sum(e.get('ca_journalier', 0) for e in objective_kpi_entries)
            total_ventes = sum(e.get('nb_ventes', 0) for e in objective_kpi_entries)
            total_articles = sum(e.get('nb_articles', 0) for e in objective_kpi_entries)
            
            # Fallback to manager KPIs if seller data is missing
            if objective_manager_kpis:
                if total_ca == 0:
                    total_ca = sum(e.get('ca_journalier', 0) for e in objective_manager_kpis if e.get('ca_journalier'))
                if total_ventes == 0:
                    total_ventes = sum(e.get('nb_ventes', 0) for e in objective_manager_kpis if e.get('nb_ventes'))
                if total_articles == 0:
                    total_articles = sum(e.get('nb_articles', 0) for e in objective_manager_kpis if e.get('nb_articles'))
            
            # Calculate averages
            panier_moyen = total_ca / total_ventes if total_ventes > 0 else 0
            indice_vente = total_ca / total_articles if total_articles > 0 else 0
            
            # Update progress
            objective['progress_ca'] = total_ca
            objective['progress_ventes'] = total_ventes
            objective['progress_articles'] = total_articles
            objective['progress_panier_moyen'] = panier_moyen
            objective['progress_indice_vente'] = indice_vente
            
            # Determine current_value and target_value for status computation
            target_value = objective.get('target_value', 0)
            current_value = 0
            
            # For kpi_standard objectives, use the relevant KPI value
            if objective.get('objective_type') == 'kpi_standard' and objective.get('kpi_name'):
                kpi_name = objective['kpi_name']
                if kpi_name == 'ca':
                    current_value = total_ca
                elif kpi_name == 'ventes':
                    current_value = total_ventes
                elif kpi_name == 'articles':
                    current_value = total_articles
                elif kpi_name == 'panier_moyen':
                    current_value = panier_moyen
                elif kpi_name == 'indice_vente':
                    current_value = indice_vente
            else:
                # For other objective types, use current_value if set, otherwise calculate from CA
                current_value = objective.get('current_value', total_ca)
                # For legacy objectives, check if they have specific targets
                if objective.get('ca_target'):
                    target_value = objective.get('ca_target', 0)
                    current_value = total_ca
                elif objective.get('panier_moyen_target'):
                    target_value = objective.get('panier_moyen_target', 0)
                    current_value = panier_moyen
                elif objective.get('indice_vente_target'):
                    target_value = objective.get('indice_vente_target', 0)
                    current_value = indice_vente
            
            # Use centralized status computation
            objective['status'] = self.compute_status(current_value, target_value, end_date)
            objective['current_value'] = current_value
            
            # Prepare batch update
            updates.append({
                "id": objective['id'],
                "update": {
                    "$set": {
                        "progress_ca": total_ca,
                        "progress_ventes": total_ventes,
                        "progress_articles": total_articles,
                        "progress_panier_moyen": panier_moyen,
                        "progress_indice_vente": indice_vente,
                        "status": objective['status'],
                        "current_value": current_value
                    }
                }
            })
        
        # Batch update all objectives (1 bulk operation)
        if updates:
            from pymongo import UpdateOne
            bulk_ops = [UpdateOne({"id": u["id"]}, u["update"]) for u in updates]
            if bulk_ops:
                # CRITICAL: Use 'objectives' collection (not 'manager_objectives') to match where objectives are created
                increment_db_op("db.objectives.bulk_write")
                await self.objective_repo.bulk_write(bulk_ops)
        
        return objectives
    
    async def calculate_challenge_progress(self, challenge: dict, seller_id: str = None):
        """Calculate progress for a challenge"""
        # If progress is entered manually by the manager or seller, do NOT overwrite it from KPI aggregates.
        # Otherwise, any refresh will "reset" manual progress back to KPI-derived totals (often 0).
        # This prevents synchronization issues where manual updates are overwritten by automatic calculations.
        data_entry_responsible = str(challenge.get('data_entry_responsible', '')).lower()
        if data_entry_responsible in ['manager', 'seller']:
            target_value = challenge.get('target_value', 0)
            end_date = challenge.get('end_date') or challenge.get('period_end')
            current_value = float(challenge.get('current_value') or 0)
            # Recalculate status based on current_value (manually entered)
            new_status = self.compute_status(current_value, target_value, end_date)
            challenge['status'] = new_status
            # Only update status in DB, keep current_value as-is (manually entered)
            update_data = {"status": new_status}
            if new_status in ['achieved', 'completed']:
                update_data["completed_at"] = datetime.now(timezone.utc).isoformat()
            await self.challenge_repo.update_challenge(
                challenge['id'],
                update_data,
                store_id=challenge.get('store_id'),
                manager_id=challenge.get('manager_id')
            )
            return
        
        start_date = challenge.get('start_date') or challenge.get('period_start')
        end_date = challenge.get('end_date') or challenge.get('period_end')
        manager_id = challenge['manager_id']
        store_id = challenge.get('store_id')
        
        if challenge.get('type') == 'collective':
            # Get all sellers for this manager/store
            seller_query = {"role": "seller"}
            if store_id:
                seller_query["store_id"] = store_id
            else:
                seller_query["manager_id"] = manager_id
            
            # PHASE 8: iterator via repository, no .collection / no limit=1000
            seller_ids = []
            async for uid in self.user_repo.find_ids_by_query(seller_query):
                seller_ids.append(uid)
            
            # ✅ PHASE 6: Use aggregation instead of .to_list(10000) for memory efficiency
            # ✅ PHASE 7: Use injected repositories
            kpi_repo = self.kpi_repo
            manager_kpi_repo = self.manager_kpi_repo
            
            # Get KPI entries for all sellers in date range
            kpi_query = {
                "seller_id": {"$in": seller_ids}
            }
            if store_id:
                kpi_query["store_id"] = store_id
            
            date_range = {"$gte": start_date, "$lte": end_date}
            seller_totals = await kpi_repo.aggregate_totals(kpi_query, date_range)
            
            total_ca = seller_totals["total_ca"]
            total_ventes = seller_totals["total_ventes"]
            total_articles = seller_totals["total_articles"]
        else:
            # Individual challenge. Phase 0: use injected kpi_repo.
            target_seller_id = seller_id or challenge.get('seller_id')
            
            kpi_query = {"seller_id": target_seller_id}
            date_range = {"$gte": start_date, "$lte": end_date}
            seller_totals = await self.kpi_repo.aggregate_totals(kpi_query, date_range)
            
            total_ca = seller_totals["total_ca"]
            total_ventes = seller_totals["total_ventes"]
            total_articles = seller_totals["total_articles"]
        
        # Fallback to manager KPIs if seller data is missing
        if manager_id and (total_ca == 0 or total_ventes == 0 or total_articles == 0):
            manager_kpi_query = {"manager_id": manager_id}
            if store_id:
                manager_kpi_query["store_id"] = store_id
            
            date_range = {"$gte": start_date, "$lte": end_date}
            manager_totals = await self.manager_kpi_repo.aggregate_totals(manager_kpi_query, date_range)
            
            if total_ca == 0:
                total_ca = manager_totals["total_ca"]
            if total_ventes == 0:
                total_ventes = manager_totals["total_ventes"]
            if total_articles == 0:
                total_articles = manager_totals["total_articles"]
        
        # Calculate averages
        panier_moyen = total_ca / total_ventes if total_ventes > 0 else 0
        indice_vente = total_ca / total_articles if total_articles > 0 else 0
        
        # Update progress
        challenge['progress_ca'] = total_ca
        challenge['progress_ventes'] = total_ventes
        challenge['progress_articles'] = total_articles
        challenge['progress_panier_moyen'] = panier_moyen
        challenge['progress_indice_vente'] = indice_vente
        
        # Check if challenge is completed
        if datetime.now().strftime('%Y-%m-%d') > end_date:
            if challenge['status'] == 'active':
                # Check if all targets are met
                completed = True
                if challenge.get('ca_target') and total_ca < challenge['ca_target']:
                    completed = False
                if challenge.get('ventes_target') and total_ventes < challenge['ventes_target']:
                    completed = False
                if challenge.get('panier_moyen_target') and panier_moyen < challenge['panier_moyen_target']:
                    completed = False
                if challenge.get('indice_vente_target') and indice_vente < challenge['indice_vente_target']:
                    completed = False
                
                new_status = 'completed' if completed else 'failed'
                await self.challenge_repo.update_challenge(
                    challenge['id'],
                    {
                        "status": new_status,
                        "completed_at": datetime.now(timezone.utc).isoformat(),
                        "progress_ca": total_ca,
                        "progress_ventes": total_ventes,
                        "progress_articles": total_articles,
                        "progress_panier_moyen": panier_moyen,
                        "progress_indice_vente": indice_vente
                    },
                    store_id=challenge.get('store_id'),
                    manager_id=challenge.get('manager_id')
                )
                challenge['status'] = new_status
        else:
            # Challenge in progress: save only progress values
            await self.challenge_repo.update_challenge(
                challenge['id'],
                {
                    "progress_ca": total_ca,
                    "progress_ventes": total_ventes,
                    "progress_articles": total_articles,
                    "progress_panier_moyen": panier_moyen,
                    "progress_indice_vente": indice_vente
                },
                store_id=challenge.get('store_id'),
                manager_id=challenge.get('manager_id')
            )
    
    async def calculate_challenges_progress_batch(self, challenges: List[Dict], manager_id: str, store_id: str):
        """
        Calculate progress for multiple challenges in batch (optimized version)
        Preloads all KPI data once instead of N queries per challenge
        
        Args:
            challenges: List of challenge dicts
            manager_id: Manager ID
            store_id: Store ID (all challenges must be from same store)
        
        Returns:
            List of challenges with progress calculated (in-place modification)
        """
        if not challenges:
            return challenges
        
        # Get all sellers for this store/manager (1 query)
        from utils.db_counter import increment_db_op
        
        seller_query = {"role": "seller"}
        if store_id:
            seller_query["store_id"] = store_id
        else:
            seller_query["manager_id"] = manager_id
        
        increment_db_op("db.users.find (sellers - challenges)")
        # PHASE 8: iterator via repository, no .collection / no limit=1000
        seller_ids = []
        async for uid in self.user_repo.find_ids_by_query(seller_query):
            seller_ids.append(uid)
        
        # Calculate global date range (min start, max end)
        date_ranges = []
        individual_seller_ids = set()
        for challenge in challenges:
            start_date = challenge.get('start_date') or challenge.get('period_start')
            end_date = challenge.get('end_date') or challenge.get('period_end')
            if start_date and end_date:
                date_ranges.append((start_date, end_date))
            
            # Collect individual challenge seller_ids
            if challenge.get('type') != 'collective':
                individual_seller_id = challenge.get('seller_id')
                if individual_seller_id:
                    individual_seller_ids.add(individual_seller_id)
        
        if not date_ranges:
            # No valid date ranges, set all progress to 0
            for challenge in challenges:
                challenge['progress_ca'] = 0
                challenge['progress_ventes'] = 0
                challenge['progress_articles'] = 0
                challenge['progress_panier_moyen'] = 0
                challenge['progress_indice_vente'] = 0
            return challenges
        
        min_start = min(dr[0] for dr in date_ranges)
        max_end = max(dr[1] for dr in date_ranges)
        
        # Combine seller_ids (collective + individual)
        all_seller_ids = list(set(seller_ids + list(individual_seller_ids)))
        
        # Preload all KPI entries for the global date range (1 query)
        kpi_query = {
            "seller_id": {"$in": all_seller_ids},
            "date": {"$gte": min_start, "$lte": max_end}
        }
        if store_id:
            kpi_query["store_id"] = store_id
        
        increment_db_op("db.kpi_entries.find (batch - challenges)")
        # ⚠️ SECURITY: Limit to 10,000 documents max to prevent OOM
        MAX_KPI_BATCH_SIZE = 10000
        # ✅ PHASE 7: Use repository instead of direct DB access
        all_kpi_entries = await self.kpi_repo.find_many(kpi_query, {"_id": 0}, limit=MAX_KPI_BATCH_SIZE)
        
        if len(all_kpi_entries) == MAX_KPI_BATCH_SIZE:
            logger.warning(f"KPI entries query hit limit of {MAX_KPI_BATCH_SIZE} documents. Consider using pagination or date range filtering.")
        
        # Preload all manager KPIs for the global date range (1 query)
        manager_kpi_query = {
            "manager_id": manager_id,
            "date": {"$gte": min_start, "$lte": max_end}
        }
        if store_id:
            manager_kpi_query["store_id"] = store_id
        
        increment_db_op("db.manager_kpis.find (batch - challenges)")
        # ⚠️ SECURITY: Limit to 10,000 documents max to prevent OOM
        # ✅ PHASE 7: Use repository instead of direct DB access
        all_manager_kpis = await self.manager_kpi_repo.find_many(manager_kpi_query, {"_id": 0}, limit=MAX_KPI_BATCH_SIZE)
        
        if len(all_manager_kpis) == MAX_KPI_BATCH_SIZE:
            logger.warning(f"Manager KPIs query hit limit of {MAX_KPI_BATCH_SIZE} documents. Consider using pagination or date range filtering.")
        
        # Calculate progress for each challenge using preloaded data
        updates = []
        today = datetime.now(timezone.utc).date().isoformat()
        
        for challenge in challenges:
            start_date = challenge.get('start_date') or challenge.get('period_start')
            end_date = challenge.get('end_date') or challenge.get('period_end')
            
            # If progress is entered manually by the manager or seller, do NOT overwrite it from KPI aggregates.
            # Important: this function bulk-writes computed fields back to DB; we must skip manual challenges.
            # This prevents synchronization issues where manual updates are overwritten by automatic calculations.
            data_entry_responsible = str(challenge.get('data_entry_responsible', '')).lower()
            if data_entry_responsible in ['manager', 'seller']:
                target_value = challenge.get('target_value', 0)
                current_value = float(challenge.get('current_value') or 0)
                new_status = self.compute_status(current_value, target_value, end_date)
                challenge['status'] = new_status
                # Keep stored progress_* and current_value as-is; do not append bulk update.
                continue
            
            if not start_date or not end_date:
                # Invalid date range, set progress to 0
                challenge['progress_ca'] = 0
                challenge['progress_ventes'] = 0
                challenge['progress_articles'] = 0
                challenge['progress_panier_moyen'] = 0
                challenge['progress_indice_vente'] = 0
                continue
            
            # Filter KPI entries for this challenge's date range and type
            if challenge.get('type') == 'collective':
                # Collective: filter by seller_ids and date range
                challenge_kpi_entries = [
                    entry for entry in all_kpi_entries
                    if entry.get('seller_id') in seller_ids
                    and start_date <= entry.get('date', '') <= end_date
                ]
            else:
                # Individual: filter by specific seller_id and date range
                target_seller_id = challenge.get('seller_id')
                challenge_kpi_entries = [
                    entry for entry in all_kpi_entries
                    if entry.get('seller_id') == target_seller_id
                    and start_date <= entry.get('date', '') <= end_date
                ]
            
            # Filter manager KPIs for this challenge's date range
            challenge_manager_kpis = [
                entry for entry in all_manager_kpis
                if start_date <= entry.get('date', '') <= end_date
            ]
            
            # Calculate totals from seller entries
            total_ca = sum(e.get('ca_journalier', 0) for e in challenge_kpi_entries)
            total_ventes = sum(e.get('nb_ventes', 0) for e in challenge_kpi_entries)
            total_articles = sum(e.get('nb_articles', 0) for e in challenge_kpi_entries)
            
            # Fallback to manager KPIs if seller data is missing
            if challenge_manager_kpis:
                if total_ca == 0:
                    total_ca = sum(e.get('ca_journalier', 0) for e in challenge_manager_kpis if e.get('ca_journalier'))
                if total_ventes == 0:
                    total_ventes = sum(e.get('nb_ventes', 0) for e in challenge_manager_kpis if e.get('nb_ventes'))
                if total_articles == 0:
                    total_articles = sum(e.get('nb_articles', 0) for e in challenge_manager_kpis if e.get('nb_articles'))
            
            # Calculate averages
            panier_moyen = total_ca / total_ventes if total_ventes > 0 else 0
            indice_vente = total_ca / total_articles if total_articles > 0 else 0
            
            # Update progress
            challenge['progress_ca'] = total_ca
            challenge['progress_ventes'] = total_ventes
            challenge['progress_articles'] = total_articles
            challenge['progress_panier_moyen'] = panier_moyen
            challenge['progress_indice_vente'] = indice_vente
            
            # Check if challenge is completed
            update_data = {
                "progress_ca": total_ca,
                "progress_ventes": total_ventes,
                "progress_articles": total_articles,
                "progress_panier_moyen": panier_moyen,
                "progress_indice_vente": indice_vente
            }
            
            if today > end_date:
                if challenge.get('status') == 'active':
                    # Check if all targets are met
                    completed = True
                    if challenge.get('ca_target') and total_ca < challenge['ca_target']:
                        completed = False
                    if challenge.get('ventes_target') and total_ventes < challenge['ventes_target']:
                        completed = False
                    if challenge.get('panier_moyen_target') and panier_moyen < challenge['panier_moyen_target']:
                        completed = False
                    if challenge.get('indice_vente_target') and indice_vente < challenge['indice_vente_target']:
                        completed = False
                    
                    new_status = 'completed' if completed else 'failed'
                    challenge['status'] = new_status
                    update_data['status'] = new_status
                    update_data['completed_at'] = datetime.now(timezone.utc).isoformat()
            
            # Prepare batch update
            updates.append({
                "id": challenge['id'],
                "update": {"$set": update_data}
            })
        
        # Batch update all challenges (1 bulk operation)
        if updates:
            from pymongo import UpdateOne
            bulk_ops = [UpdateOne({"id": u["id"]}, u["update"]) for u in updates]
            if bulk_ops:
                increment_db_op("db.challenges.bulk_write")
                await self.challenge_repo.bulk_write(bulk_ops)

        return challenges

    # ===== SALES & EVALUATIONS (for sales_evaluations routes, no repo in route) =====

    async def create_sale(self, seller_id: str, sale_data: Dict) -> Dict:
        """Create a sale for a seller. Used by routes instead of instantiating SaleRepository."""
        if not self.sale_repo:
            raise ForbiddenError("Service non configuré pour les ventes")
        await self.sale_repo.create_sale(sale_data=sale_data, seller_id=seller_id)
        out = {k: v for k, v in sale_data.items() if k != "_id"}
        return out

    async def get_sales_paginated(
        self, user_id: str, role: str, store_id: Optional[str], page: int, size: int
    ) -> PaginatedResponse:
        """Get sales paginated: seller sees own, manager sees store's sellers."""
        if not self.sale_repo:
            return PaginatedResponse(items=[], total=0, page=page, size=size, pages=0)
        if role == "seller":
            return await paginate(
                collection=self.sale_repo.collection,
                query={"seller_id": user_id},
                page=page,
                size=size,
                projection={"_id": 0},
                sort=[("date", -1)],
            )
        if store_id:
            sellers = await self.user_repo.find_many(
                {"store_id": store_id, "role": "seller"},
                projection={"_id": 0, "id": 1},
                limit=100,
            )
            seller_ids = [s["id"] for s in sellers]
            if seller_ids:
                return await paginate(
                    collection=self.sale_repo.collection,
                    query={"seller_id": {"$in": seller_ids}},
                    page=page,
                    size=size,
                    projection={"_id": 0},
                    sort=[("date", -1)],
                )
        return PaginatedResponse(items=[], total=0, page=page, size=size, pages=0)

    async def get_sale_by_id_for_seller(self, sale_id: str, seller_id: str) -> Optional[Dict]:
        """Get a sale by id for a seller (for validation before creating evaluation)."""
        if not self.sale_repo:
            return None
        return await self.sale_repo.find_by_id(
            sale_id=sale_id, seller_id=seller_id, projection={"_id": 0}
        )

    async def create_evaluation(self, seller_id: str, evaluation_data: Dict) -> Dict:
        """Create an evaluation for a sale. Used by routes instead of instantiating EvaluationRepository."""
        if not self.evaluation_repo:
            raise ForbiddenError("Service non configuré pour les évaluations")
        await self.evaluation_repo.create_evaluation(
            evaluation_data=evaluation_data, seller_id=seller_id
        )
        return {k: v for k, v in evaluation_data.items() if k != "_id"}

    async def get_evaluations_paginated(
        self, user_id: str, role: str, store_id: Optional[str], page: int, size: int
    ) -> PaginatedResponse:
        """Get evaluations paginated: seller sees own, manager sees store's sellers."""
        if not self.evaluation_repo:
            return PaginatedResponse(items=[], total=0, page=page, size=size, pages=0)
        if role == "seller":
            return await paginate(
                collection=self.evaluation_repo.collection,
                query={"seller_id": user_id},
                page=page,
                size=size,
                projection={"_id": 0},
                sort=[("created_at", -1)],
            )
        if store_id:
            sellers = await self.user_repo.find_many(
                {"store_id": store_id, "role": "seller"},
                projection={"_id": 0, "id": 1},
                limit=100,
            )
            seller_ids = [s["id"] for s in sellers]
            if seller_ids:
                return await paginate(
                    collection=self.evaluation_repo.collection,
                    query={"seller_id": {"$in": seller_ids}},
                    page=page,
                    size=size,
                    projection={"_id": 0},
                    sort=[("created_at", -1)],
                )
        return PaginatedResponse(items=[], total=0, page=page, size=size, pages=0)
