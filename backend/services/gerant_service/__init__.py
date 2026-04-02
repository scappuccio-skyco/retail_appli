"""
Gérant Service Package
Split into mixins for maintainability.
"""
from typing import Dict, Optional, List
from repositories.user_repository import UserRepository
from repositories.store_repository import StoreRepository, WorkspaceRepository
from repositories.gerant_invitation_repository import GerantInvitationRepository
from repositories.subscription_repository import SubscriptionRepository
from repositories.kpi_repository import KPIRepository, ManagerKPIRepository
from repositories.billing_repository import BillingProfileRepository
from repositories.system_log_repository import SystemLogRepository

from services.gerant_service._profile_mixin import ProfileMixin
from services.gerant_service._subscription_mixin import SubscriptionMixin
from services.gerant_service._stores_mixin import StoresMixin
from services.gerant_service._staff_mixin import StaffMixin
from services.gerant_service._staff_invitation_mixin import StaffInvitationMixin
from services.gerant_service._staff_lifecycle_mixin import StaffLifecycleMixin
from services.gerant_service._kpi_mixin import KpiMixin


class GerantService(ProfileMixin, SubscriptionMixin, StoresMixin, StaffMixin, StaffInvitationMixin, StaffLifecycleMixin, KpiMixin):
    """Service for gérant-specific operations. Phase 0: repositories only, no self.db."""

    def __init__(
        self,
        user_repo: UserRepository,
        store_repo: StoreRepository,
        workspace_repo: WorkspaceRepository,
        gerant_invitation_repo: GerantInvitationRepository,
        subscription_repo: SubscriptionRepository,
        kpi_repo: KPIRepository,
        manager_kpi_repo: ManagerKPIRepository,
        billing_profile_repo: Optional[BillingProfileRepository] = None,
        system_log_repo: Optional[SystemLogRepository] = None,
    ):
        self.user_repo = user_repo
        self.store_repo = store_repo
        self.workspace_repo = workspace_repo
        self.gerant_invitation_repo = gerant_invitation_repo
        self.subscription_repo = subscription_repo
        self.kpi_repo = kpi_repo
        self.manager_kpi_repo = manager_kpi_repo
        self.billing_profile_repo = billing_profile_repo
        self.system_log_repo = system_log_repo
