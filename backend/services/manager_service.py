"""
Manager Service
Facade over specialized manager services (store, sellers, KPI, achievements) + remaining repos.
"""
from __future__ import annotations
from typing import Dict, List, Optional, Any, TYPE_CHECKING

if TYPE_CHECKING:
    from services.manager import (
        ManagerStoreService,
        ManagerSellerManagementService,
        ManagerKpiService,
        ManagerAchievementService,
    )
from datetime import datetime, timezone, timedelta
import logging

from models.pagination import PaginatedResponse
from utils.pagination import paginate
from repositories.store_repository import StoreRepository
from repositories.user_repository import UserRepository
from repositories.manager_diagnostic_repository import ManagerDiagnosticRepository
from repositories.enterprise_repository import APIKeyRepository
from repositories.morning_brief_repository import MorningBriefRepository
from repositories.diagnostic_repository import DiagnosticRepository
from repositories.debrief_repository import DebriefRepository
from repositories.team_analysis_repository import TeamAnalysisRepository
from repositories.relationship_consultation_repository import RelationshipConsultationRepository
from repositories.kpi_repository import KPIRepository, StoreKPIRepository
from repositories.interview_note_repository import InterviewNoteRepository
from repositories.objective_repository import ObjectiveRepository
from repositories.challenge_repository import ChallengeRepository
from repositories.manager_seller_metadata_repository import ManagerSellerMetadataRepository

logger = logging.getLogger(__name__)


class ManagerService:
    """Facade: délègue store/sellers/KPI/achievements aux services spécialisés; garde diagnostic/brief/team_analysis/relationship."""

    def __init__(
        self,
        store_svc: "ManagerStoreService",
        seller_mgmt_svc: "ManagerSellerManagementService",
        kpi_svc: "ManagerKpiService",
        achievement_svc: "ManagerAchievementService",
        manager_diagnostic_repo: ManagerDiagnosticRepository,
        api_key_repo: APIKeyRepository,
        store_repo: StoreRepository,
        user_repo: UserRepository,
        store_kpi_repo: Optional[StoreKPIRepository] = None,
        kpi_repo: Optional[KPIRepository] = None,
        morning_brief_repo: Optional[MorningBriefRepository] = None,
        diagnostic_repo: Optional[DiagnosticRepository] = None,
        debrief_repo: Optional[DebriefRepository] = None,
        team_analysis_repo: Optional[TeamAnalysisRepository] = None,
        relationship_consultation_repo: Optional[RelationshipConsultationRepository] = None,
        interview_note_repo: Optional[InterviewNoteRepository] = None,
        objective_repo: Optional[ObjectiveRepository] = None,
        challenge_repo: Optional[ChallengeRepository] = None,
        manager_seller_metadata_repo: Optional[ManagerSellerMetadataRepository] = None,
    ):
        self._store = store_svc
        self._sellers = seller_mgmt_svc
        self._kpi = kpi_svc
        self._achievement = achievement_svc
        self.manager_diagnostic_repo = manager_diagnostic_repo
        self.api_key_repo = api_key_repo
        self.store_repo = store_repo
        self.user_repo = user_repo
        self.store_kpi_repo = store_kpi_repo
        self.kpi_repo = kpi_repo
        self.morning_brief_repo = morning_brief_repo
        self.diagnostic_repo = diagnostic_repo
        self.debrief_repo = debrief_repo
        self.team_analysis_repo = team_analysis_repo
        self.relationship_consultation_repo = relationship_consultation_repo
        self.interview_note_repo = interview_note_repo
        self.objective_repo = objective_repo
        self.challenge_repo = challenge_repo
        self.manager_seller_metadata_repo = manager_seller_metadata_repo

    # ===== STORE (délégation) =====
    async def get_store_by_id(
        self,
        store_id: str,
        gerant_id: Optional[str] = None,
        projection: Optional[Dict] = None,
    ) -> Optional[Dict]:
        return await self._store.get_store_by_id(
            store_id, gerant_id=gerant_id, projection=projection
        )

    async def get_store_by_id_simple(
        self, store_id: str, projection: Optional[Dict] = None
    ) -> Optional[Dict]:
        return await self._store.get_store_by_id_simple(
            store_id, projection=projection
        )

    # ===== USER / SELLERS (délégation) =====
    async def get_user_by_id(
        self, user_id: str, projection: Optional[Dict] = None
    ) -> Optional[Dict]:
        return await self._sellers.get_user_by_id(user_id, projection=projection)

    async def get_seller_by_id_and_store(
        self, seller_id: str, store_id: str
    ) -> Optional[Dict]:
        return await self._sellers.get_seller_by_id_and_store(
            seller_id, store_id
        )

    async def get_users_by_ids_and_store(
        self,
        user_ids: List[str],
        store_id: str,
        role: str = "seller",
        limit: int = 50,
        projection: Optional[Dict] = None,
    ) -> List[Dict]:
        return await self._sellers.get_users_by_ids_and_store(
            user_ids, store_id, role=role, limit=limit, projection=projection
        )

    async def get_sellers_for_store_paginated(
        self, store_id: str, page: int = 1, size: int = 100
    ) -> PaginatedResponse:
        return await self._sellers.get_sellers_for_store_paginated(
            store_id, page=page, size=size
        )

    async def get_sellers_by_status_paginated(
        self, store_id: str, status: str, page: int = 1, size: int = 50
    ) -> PaginatedResponse:
        return await self._sellers.get_sellers_by_status_paginated(
            store_id, status, page=page, size=size
        )

    # ===== OBJECTIVE / CHALLENGE (délégation) =====
    async def get_objective_by_id(self, objective_id: str) -> Optional[Dict]:
        return await self._achievement.get_objective_by_id(objective_id)

    async def get_objective_by_id_and_store(
        self, objective_id: str, store_id: str
    ) -> Optional[Dict]:
        return await self._achievement.get_objective_by_id_and_store(
            objective_id, store_id
        )

    async def get_challenge_by_id(self, challenge_id: str) -> Optional[Dict]:
        return await self._achievement.get_challenge_by_id(challenge_id)

    async def get_challenge_by_id_and_store(
        self, challenge_id: str, store_id: str
    ) -> Optional[Dict]:
        return await self._achievement.get_challenge_by_id_and_store(
            challenge_id, store_id
        )

    # ===== KPI (délégation) =====
    async def get_kpi_distinct_dates(self, query: Dict) -> List[str]:
        return await self._kpi.get_kpi_distinct_dates(query)

    async def get_manager_kpi_distinct_dates(self, query: Dict) -> List[str]:
        return await self._kpi.get_manager_kpi_distinct_dates(query)

    async def get_manager_kpis_paginated(
        self,
        store_id: str,
        start_date: str,
        end_date: str,
        page: int = 1,
        size: int = 50,
    ) -> PaginatedResponse:
        return await self._kpi.get_manager_kpis_paginated(
            store_id, start_date, end_date, page=page, size=size
        )

    async def get_kpi_locked_entries(
        self, store_id: str, date: str, limit: int = 1
    ) -> List[Dict]:
        return await self._kpi.get_kpi_locked_entries(
            store_id, date, limit=limit
        )

    async def get_kpi_entries_locked_or_api(
        self, store_id: str, date: str, limit: int = 1
    ) -> List[Dict]:
        return await self._kpi.get_kpi_entries_locked_or_api(
            store_id, date, limit=limit
        )

    async def get_kpi_entry_by_seller_and_date(
        self, seller_id: str, date: str
    ) -> Optional[Dict]:
        return await self._kpi.get_kpi_entry_by_seller_and_date(
            seller_id, date
        )

    async def update_kpi_entry_one(self, filter: Dict, update: Dict) -> bool:
        return await self._kpi.update_kpi_entry_one(filter, update)

    async def insert_kpi_entry_one(self, data: Dict) -> str:
        return await self._kpi.insert_kpi_entry_one(data)

    async def get_manager_kpi_by_store_and_date(
        self, store_id: str, date: str
    ) -> Optional[Dict]:
        return await self._kpi.get_manager_kpi_by_store_and_date(
            store_id, date
        )

    async def update_manager_kpi_one(self, filter: Dict, update: Dict) -> bool:
        return await self._kpi.update_manager_kpi_one(filter, update)

    async def insert_manager_kpi_one(self, data: Dict) -> str:
        return await self._kpi.insert_manager_kpi_one(data)

    async def aggregate_kpi(
        self, pipeline: List[Dict], max_results: int = 1
    ) -> List[Dict]:
        return await self._kpi.aggregate_kpi(
            pipeline, max_results=max_results
        )

    async def aggregate_manager_kpi(
        self, pipeline: List[Dict], max_results: int = 1
    ) -> List[Dict]:
        return await self._kpi.aggregate_manager_kpi(
            pipeline, max_results=max_results
        )

    async def get_seller_kpi_metrics(
        self, seller_id: str, start_date: str, end_date: str
    ) -> Dict:
        """Source unique de vérité pour les métriques KPI d'un vendeur. Agrégation server-side."""
        return await self._kpi.get_seller_kpi_metrics(seller_id, start_date, end_date)

    async def get_kpi_entries_paginated(
        self,
        query: Dict,
        page: int = 1,
        size: int = 50,
    ) -> PaginatedResponse:
        return await self._kpi.get_kpi_entries_paginated(
            query, page=page, size=size
        )

    # ===== KPI CONFIG / SYNC (délégation) =====
    async def upsert_kpi_config(
        self,
        store_id: Optional[str],
        manager_id: Optional[str],
        update_data: Dict,
    ) -> Dict:
        return await self._store.upsert_kpi_config(
            store_id, manager_id, update_data
        )

    # ===== OBJECTIVES (délégation) =====
    async def get_objectives_by_store(
        self, store_id: str, limit: int = 100
    ) -> List[Dict]:
        return await self._achievement.get_objectives_by_store(
            store_id, limit=limit
        )

    async def create_objective(
        self, data: Dict, store_id: str, manager_id: str
    ) -> str:
        return await self._achievement.create_objective(
            data, store_id, manager_id
        )

    async def update_objective(
        self,
        objective_id: str,
        update_data: Dict,
        store_id: Optional[str] = None,
        manager_id: Optional[str] = None,
    ) -> bool:
        return await self._achievement.update_objective(
            objective_id, update_data, store_id=store_id, manager_id=manager_id
        )

    async def get_objective_by_id_for_route(self, objective_id: str) -> Optional[Dict]:
        return await self._achievement.get_objective_by_id(objective_id)

    async def delete_objective(
        self,
        objective_id: str,
        store_id: Optional[str] = None,
        manager_id: Optional[str] = None,
    ) -> bool:
        return await self._achievement.delete_objective(
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
        return await self._achievement.update_objective_with_progress_history(
            objective_id, update_data, progress_entry, store_id, manager_id
        )

    # ===== CHALLENGES (délégation) =====
    async def get_challenges_by_store(
        self, store_id: str, limit: int = 100
    ) -> List[Dict]:
        return await self._achievement.get_challenges_by_store(
            store_id, limit=limit
        )

    async def create_challenge(
        self, data: Dict, store_id: str, manager_id: str
    ) -> str:
        return await self._achievement.create_challenge(
            data, store_id, manager_id
        )

    async def update_challenge(
        self,
        challenge_id: str,
        update_data: Dict,
        store_id: Optional[str] = None,
        manager_id: Optional[str] = None,
    ) -> bool:
        return await self._achievement.update_challenge(
            challenge_id, update_data, store_id=store_id, manager_id=manager_id
        )

    async def get_challenge_by_id_for_route(self, challenge_id: str) -> Optional[Dict]:
        return await self._achievement.get_challenge_by_id(challenge_id)

    async def delete_challenge(
        self,
        challenge_id: str,
        store_id: Optional[str] = None,
        manager_id: Optional[str] = None,
    ) -> bool:
        return await self._achievement.delete_challenge(
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
        return await self._achievement.update_challenge_with_progress_history(
            challenge_id, update_data, progress_entry, store_id, manager_id
        )

    # ===== DIAGNOSTIC / DEBRIEF =====

    async def get_diagnostic_by_seller(self, seller_id: str) -> Optional[Dict]:
        """Get diagnostic for seller. Used by routes instead of diagnostic_repo.find_by_seller."""
        if not self.diagnostic_repo:
            return None
        return await self.diagnostic_repo.find_by_seller(seller_id)

    async def get_team_disc_profiles(self, store_id: str) -> List[Dict]:
        """
        Return [{first_name, disc_style}] for all active sellers in the store.
        Used to personalise the morning brief (tone adaptation per profile).
        """
        if not self.diagnostic_repo or not store_id:
            return []
        try:
            sellers = await self.user_repo.find_by_store(
                store_id, role="seller", status="active",
                projection={"_id": 0, "id": 1, "name": 1}, limit=50,
            )
            if not sellers:
                return []
            import asyncio as _asyncio
            diagnostics = await _asyncio.gather(
                *[self.diagnostic_repo.find_by_seller(s["id"]) for s in sellers],
                return_exceptions=True,
            )
            profiles = []
            for seller, diag in zip(sellers, diagnostics):
                first_name = seller.get("name", "").split()[0]
                disc_style = ""
                if isinstance(diag, dict):
                    disc_style = (diag.get("profile") or {}).get("style", "")
                profiles.append({"first_name": first_name, "disc_style": disc_style or "?"})
            return profiles
        except Exception as e:
            logger.warning("get_team_disc_profiles failed: %s", e)
            return []

    async def get_debriefs_by_seller(
        self, seller_id: str, limit: int = 100, skip: int = 0
    ) -> List[Dict]:
        """Get debriefs for seller. Used by routes instead of debrief_repo.find_by_seller."""
        if not self.debrief_repo:
            return []
        return await self.debrief_repo.find_by_seller(
            seller_id, projection={"_id": 0}, limit=limit, skip=skip
        )

    async def get_debriefs_by_seller_paginated(
        self, seller_id: str, page: int = 1, size: int = 50
    ) -> PaginatedResponse:
        """Get paginated debriefs for seller. Used by manager evaluations routes."""
        if not self.debrief_repo:
            return PaginatedResponse(items=[], total=0, page=page, size=size, pages=0)
        return await paginate(
            collection=self.debrief_repo.collection,
            query={"seller_id": seller_id},
            page=page,
            size=size,
            projection={"_id": 0},
            sort=[("created_at", -1)],
        )

    async def get_debriefs_count_by_seller(self, seller_id: str) -> int:
        """Count debriefs for seller. Used for competences-history pagination."""
        if not self.debrief_repo:
            return 0
        return await self.debrief_repo.count_by_seller(seller_id)

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
        """Get paginated relationship consultations for manager (and optional seller).
        Filtrage (store_id, manager_id, seller_id) et pagination appliqués en base (query MongoDB)."""
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

    async def resolve_relationship_consultation(
        self, consultation_id: str, manager_id: str, store_id: str, resolved: bool
    ) -> bool:
        """Toggle resolved status of a relationship consultation."""
        if not self.relationship_consultation_repo:
            return False
        return await self.relationship_consultation_repo.update_one(
            {"id": consultation_id, "manager_id": manager_id, "store_id": store_id},
            {"$set": {"resolved": resolved}}
        )

    async def get_sellers(
        self,
        manager_id: str,
        store_id: str,
        page: int = 1,
        size: int = 50,
    ) -> PaginatedResponse:
        """
        Liste paginée des vendeurs actifs du magasin (pour manager/gérant).
        Utilise paginate() via get_sellers_for_store_paginated. Préférer cette méthode
        à get_sellers() du sous-service pour éviter des .find() sans limite.
        """
        return await self._sellers.get_sellers_for_store_paginated(
            store_id, page=page, size=size
        )

    async def get_invitations(self, manager_id: str) -> List[Dict]:
        return await self._sellers.get_invitations(manager_id)

    async def get_sync_mode(self, store_id: str) -> Dict:
        return await self._store.get_sync_mode(store_id)

    async def get_kpi_config(self, store_id: str) -> Dict:
        return await self._store.get_kpi_config(store_id)

    async def get_team_bilans_all(self, manager_id: str, store_id: str) -> List[Dict]:
        return await self._kpi.get_team_bilans_all(manager_id, store_id)

    async def get_store_kpi_stats(
        self,
        store_id: str,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
    ) -> Dict:
        return await self._kpi.get_store_kpi_stats(
            store_id, start_date=start_date, end_date=end_date
        )

    async def get_active_objectives(
        self, manager_id: str, store_id: str
    ) -> List[Dict]:
        return await self._achievement.get_active_objectives(
            manager_id, store_id
        )

    async def get_active_challenges(
        self, manager_id: str, store_id: str
    ) -> List[Dict]:
        return await self._achievement.get_active_challenges(
            manager_id, store_id
        )

    # ── Manager tasks ──────────────────────────────────────────

    async def get_manager_tasks(self, manager_id: str, store_id: str) -> List[Dict]:
        """
        Calcule dynamiquement les tâches à faire pour un manager :
        - Notes partagées non vues par ce manager
        - Vendeurs sans diagnostic
        - Vendeurs silencieux (pas de KPI depuis 3 jours)
        - Objectifs expirant dans ≤ 3 jours
        - Challenges terminés (period_end < aujourd'hui, status active)
        - Aucun objectif ni challenge dans les 7 prochains jours
        """
        from datetime import date
        tasks: List[Dict] = []
        today = date.today()
        today_str = today.isoformat()

        # Liste des vendeurs du magasin
        sellers: List[Dict] = []
        try:
            sellers = await self.user_repo.find_by_manager(manager_id, store_id) or []
        except Exception:
            pass

        # ── Notes partagées non vues ──────────────────────────
        if self.interview_note_repo and self.manager_seller_metadata_repo:
            for seller in sellers:
                seller_id = seller.get("id")
                if not seller_id:
                    continue
                try:
                    meta = await self.manager_seller_metadata_repo.find_by_manager_seller(
                        manager_id, seller_id
                    )
                    last_seen = meta.get("notes_last_seen_at") if meta else None
                    query = {"seller_id": seller_id, "shared_with_manager": True}
                    if last_seen:
                        query["updated_at"] = {"$gt": last_seen}
                    notes = await self.interview_note_repo.find_many(
                        query,
                        projection={"_id": 0, "id": 1},
                        limit=10,
                    )
                    count = len(notes)
                    if count > 0:
                        name = seller.get("name", "Un vendeur")
                        label = "note" if count == 1 else "notes"
                        tasks.append({
                            "id": f"notes-{seller_id}",
                            "type": "notes",
                            "seller_id": seller_id,
                            "seller_name": name,
                            "title": f"{name} a partagé {count} {label}",
                            "description": "Consultez les notes avant l'entretien",
                            "priority": "important",
                            "icon": "🗒️",
                        })
                except Exception:
                    pass

        # ── Vendeurs sans diagnostic ──────────────────────────
        if self.diagnostic_repo:
            for seller in sellers:
                seller_id = seller.get("id")
                if not seller_id:
                    continue
                try:
                    diag = await self.diagnostic_repo.find_by_seller(seller_id)
                    if not diag:
                        name = seller.get("name", "Un vendeur")
                        tasks.append({
                            "id": f"diag-{seller_id}",
                            "type": "missing_diagnostic",
                            "seller_id": seller_id,
                            "seller_name": name,
                            "title": f"{name} n'a pas fait son diagnostic",
                            "description": "Invitez-le à compléter son profil vendeur",
                            "priority": "normal",
                            "icon": "📋",
                        })
                except Exception:
                    pass

        # ── Vendeurs silencieux (pas de KPI depuis 3 jours) ───
        if self.kpi_repo and sellers:
            cutoff = (today - timedelta(days=3)).isoformat()
            for seller in sellers:
                seller_id = seller.get("id")
                if not seller_id:
                    continue
                try:
                    recent = await self.kpi_repo.find_many(
                        {"seller_id": seller_id, "date": {"$gte": cutoff}},
                        projection={"_id": 0, "id": 1},
                        limit=1,
                    )
                    if not recent:
                        # Vérifier qu'il a au moins un KPI historique (vendeur actif)
                        any_kpi = await self.kpi_repo.find_many(
                            {"seller_id": seller_id},
                            projection={"_id": 0, "id": 1},
                            limit=1,
                        )
                        if any_kpi:
                            name = seller.get("name", "Un vendeur")
                            tasks.append({
                                "id": f"silent-{seller_id}",
                                "type": "silent_seller",
                                "seller_id": seller_id,
                                "seller_name": name,
                                "title": f"{name} n'a pas saisi de KPI depuis 3 jours",
                                "description": "Envoyez-lui un rappel",
                                "priority": "normal",
                                "icon": "📊",
                            })
                except Exception:
                    pass

        # ── Objectifs expirant dans ≤ 3 jours ────────────────
        if self.objective_repo:
            try:
                deadline_str = (today + timedelta(days=3)).isoformat()
                objectives = await self.objective_repo.find_by_manager(
                    manager_id,
                    store_id,
                    projection={"_id": 0, "id": 1, "title": 1, "period_end": 1, "status": 1},
                    limit=20,
                )
                for obj in objectives:
                    if obj.get("status") == "active" and today_str <= obj.get("period_end", "") <= deadline_str:
                        days_left = (date.fromisoformat(obj["period_end"]) - today).days
                        label = "aujourd'hui" if days_left == 0 else ("demain" if days_left == 1 else f"dans {days_left} jours")
                        tasks.append({
                            "id": f"obj-expiring-{obj.get('id', '')}",
                            "type": "objective_expiring",
                            "title": f"Objectif « {obj.get('title', '')} » se termine {label}",
                            "description": "Vérifiez la progression de votre équipe",
                            "priority": "important" if days_left <= 1 else "normal",
                            "icon": "🎯",
                        })
            except Exception:
                pass

        # ── Challenges terminés (sans suivi) ──────────────────
        if self.challenge_repo:
            try:
                yesterday_str = (today - timedelta(days=1)).isoformat()
                week_ago_str = (today - timedelta(days=7)).isoformat()
                challenges = await self.challenge_repo.find_by_manager(
                    manager_id,
                    store_id,
                    projection={"_id": 0, "id": 1, "title": 1, "period_end": 1, "status": 1},
                    limit=20,
                )
                for ch in challenges:
                    end = ch.get("period_end", "")
                    if ch.get("status") == "active" and week_ago_str <= end <= yesterday_str:
                        tasks.append({
                            "id": f"ch-ended-{ch.get('id', '')}",
                            "type": "challenge_ended",
                            "title": f"Challenge « {ch.get('title', '')} » est terminé",
                            "description": "Faites un retour à votre équipe sur les résultats",
                            "priority": "normal",
                            "icon": "⚡",
                        })
            except Exception:
                pass

        # ── Aucun objectif/challenge à venir dans 7 jours ─────
        if self.objective_repo and self.challenge_repo:
            try:
                horizon_str = (today + timedelta(days=7)).isoformat()
                upcoming_obj = await self.objective_repo.find_by_manager(
                    manager_id, store_id,
                    projection={"_id": 0, "id": 1, "status": 1, "period_end": 1},
                    limit=10,
                )
                upcoming_ch = await self.challenge_repo.find_by_manager(
                    manager_id, store_id,
                    projection={"_id": 0, "id": 1, "status": 1, "period_end": 1},
                    limit=10,
                )
                has_upcoming = any(
                    item.get("status") == "active" and item.get("period_end", "") >= today_str
                    for item in (upcoming_obj + upcoming_ch)
                )
                if not has_upcoming:
                    tasks.append({
                        "id": "no-upcoming-goals",
                        "type": "no_upcoming_goals",
                        "title": "Aucun objectif ni challenge à venir",
                        "description": "Motivez votre équipe en en créant un pour les 7 prochains jours",
                        "priority": "normal",
                        "icon": "💡",
                    })
            except Exception:
                pass

        return tasks

    async def mark_notes_seen(
        self, manager_id: str, seller_id: str, store_id: str
    ) -> str:
        """Met à jour notes_last_seen_at pour cette paire manager/vendeur. Retourne le timestamp ISO."""
        if not self.manager_seller_metadata_repo:
            raise ValueError("manager_seller_metadata_repo not configured")
        return await self.manager_seller_metadata_repo.upsert_notes_last_seen(
            manager_id, seller_id, store_id
        )


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
            # Pre-fetch seller IDs for store as fallback when store_id doesn't match kpi_entries
            seller_ids_for_store = []
            if self.user_repo:
                sellers_in_store = await self.user_repo.find_by_store(
                    store_id, role="seller", status="active",
                    projection={"_id": 0, "id": 1}, limit=200
                )
                seller_ids_for_store = [s["id"] for s in sellers_in_store if s.get("id")]
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
                # Fallback: search by seller_ids in case store_id doesn't match kpi_entries
                if not kpi_check and seller_ids_for_store:
                    kpi_check = await kpi_repo.find_one(
                        {"seller_id": {"$in": seller_ids_for_store}, "date": check_date_str, "ca_journalier": {"$gt": 0}},
                        {"_id": 0, "date": 1},
                    )
                if kpi_check:
                    last_data_date = check_date_str
                    break
            if not last_data_date:
                last_data_date = (today - timedelta(days=1)).strftime("%Y-%m-%d")
            stats["data_date"] = last_data_date
            logger.info("[BRIEF] store_id=%s last_data_date=%s", store_id, last_data_date)

            kpis_yesterday = await store_kpi_repo.find_many_for_store(
                store_id, date=last_data_date, limit=50
            )
            logger.info("[BRIEF] kpis_yesterday (legacy kpis collection): %d entries", len(kpis_yesterday))
            if not kpis_yesterday:
                kpi_entries = await kpi_repo.find_by_store(store_id, last_data_date)
                logger.info("[BRIEF] kpi_entries by store_id count: %d", len(kpi_entries))
                # Fallback: query by seller_ids if store_id didn't match (API sync may use different store_id)
                if not kpi_entries and seller_ids_for_store:
                    kpi_entries = await kpi_repo.find_many(
                        {"seller_id": {"$in": seller_ids_for_store}, "date": last_data_date},
                        projection={"_id": 0},
                        limit=200,
                    )
                    logger.info("[BRIEF] kpi_entries by seller_ids fallback count: %d", len(kpi_entries))
                if kpi_entries:
                    total_ca = sum(k.get("ca_journalier", 0) or 0 for k in kpi_entries)
                    logger.info("[BRIEF] total_ca computed from kpi_entries: %s", total_ca)
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

