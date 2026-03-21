"""Seller Service Package — split into mixins for maintainability."""
from typing import Dict, Optional, List

# import all repo types for __init__ signature
from repositories.user_repository import UserRepository
from repositories.store_repository import StoreRepository
from repositories.kpi_repository import KPIRepository, ManagerKPIRepository
from repositories.objective_repository import ObjectiveRepository
from repositories.challenge_repository import ChallengeRepository
from repositories.diagnostic_repository import DiagnosticRepository
from repositories.interview_note_repository import InterviewNoteRepository
from repositories.debrief_repository import DebriefRepository
from repositories.achievement_notification_repository import AchievementNotificationRepository
from repositories.sale_repository import SaleRepository
from repositories.evaluation_repository import EvaluationRepository
from repositories.manager_request_repository import ManagerRequestRepository
from repositories.store_repository import WorkspaceRepository
from repositories.kpi_config_repository import KPIConfigRepository
from repositories.daily_challenge_repository import DailyChallengeRepository
from repositories.seller_bilan_repository import SellerBilanRepository

from services.seller_service._profile_mixin import ProfileMixin
from services.seller_service._kpi_mixin import KpiMixin
from services.seller_service._objectives_mixin import ObjectivesMixin
from services.seller_service._challenges_mixin import ChallengesMixin
from services.seller_service._notes_mixin import NotesMixin
from services.seller_service._sales_mixin import SalesMixin


class SellerService(ProfileMixin, KpiMixin, ObjectivesMixin, ChallengesMixin, NotesMixin, SalesMixin):
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
