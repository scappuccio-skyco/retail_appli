"""Admin Service Package — split into mixins for maintainability."""
from typing import List, Dict, Optional
from datetime import datetime, timezone, timedelta
import uuid
import bcrypt
import secrets
import logging
import stripe

from core.config import settings
from repositories.admin_repository import AdminRepository
from repositories.admin_log_repository import AdminLogRepository
from repositories.user_repository import UserRepository
from repositories.store_repository import StoreRepository, WorkspaceRepository
from repositories.subscription_repository import SubscriptionRepository
from repositories.gerant_invitation_repository import GerantInvitationRepository
from repositories.invitation_repository import InvitationRepository
from repositories.system_log_repository import SystemLogRepository
from utils.pagination import paginate, paginate_aggregation
from config.limits import MAX_PAGE_SIZE
from models.pagination import PaginatedResponse

from services.admin_service._repos import (
    PaymentTransactionRepository,
    StripeEventRepository,
    AIConversationRepository,
    AIMessageRepository,
    AIUsageLogRepository,
)
from services.admin_service._workspaces_mixin import WorkspacesMixin
from services.admin_service._stats_mixin import StatsMixin
from services.admin_service._subscriptions_mixin import SubscriptionsMixin
from services.admin_service._admins_mixin import AdminsMixin
from services.admin_service._ai_mixin import AiMixin

logger = logging.getLogger(__name__)


class AdminService(WorkspacesMixin, StatsMixin, SubscriptionsMixin, AdminsMixin, AiMixin):
    """Service for SuperAdmin business logic."""

    def __init__(
        self,
        admin_repo: AdminRepository,
        admin_log_repo: AdminLogRepository,
        user_repo: UserRepository,
        store_repo: StoreRepository,
        workspace_repo: WorkspaceRepository,
        subscription_repo: SubscriptionRepository,
        payment_transaction_repo: PaymentTransactionRepository,
        stripe_event_repo: StripeEventRepository,
        ai_conversation_repo: AIConversationRepository,
        ai_message_repo: AIMessageRepository,
        gerant_invitation_repo: GerantInvitationRepository,
        invitation_repo: InvitationRepository,
        system_log_repo: SystemLogRepository,
        ai_usage_log_repo: AIUsageLogRepository,
    ):
        self.admin_repo = admin_repo
        self.admin_log_repo = admin_log_repo
        self.user_repo = user_repo
        self.store_repo = store_repo
        self.workspace_repo = workspace_repo
        self.subscription_repo = subscription_repo
        self.payment_transaction_repo = payment_transaction_repo
        self.stripe_event_repo = stripe_event_repo
        self.ai_conversation_repo = ai_conversation_repo
        self.ai_message_repo = ai_message_repo
        self.gerant_invitation_repo = gerant_invitation_repo
        self.invitation_repo = invitation_repo
        self.system_log_repo = system_log_repo
        self.ai_usage_log_repo = ai_usage_log_repo
