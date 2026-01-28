"""
API Dependencies - Dependency Injection for Services
Assembles repositories and services with database connection
"""
from fastapi import Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from core.database import get_db
from repositories.admin_repository import AdminRepository
from repositories.admin_log_repository import AdminLogRepository
from repositories.user_repository import UserRepository
from repositories.store_repository import StoreRepository, WorkspaceRepository
from repositories.subscription_repository import SubscriptionRepository
from repositories.gerant_invitation_repository import GerantInvitationRepository
from repositories.invitation_repository import InvitationRepository
from repositories.kpi_repository import KPIRepository, ManagerKPIRepository, StoreKPIRepository
from repositories.diagnostic_repository import DiagnosticRepository
from repositories.manager_diagnostic_repository import ManagerDiagnosticRepository
from repositories.achievement_notification_repository import AchievementNotificationRepository
from repositories.interview_note_repository import InterviewNoteRepository
from repositories.debrief_repository import DebriefRepository
from repositories.manager_request_repository import ManagerRequestRepository
from repositories.objective_repository import ObjectiveRepository
from repositories.challenge_repository import ChallengeRepository
from repositories.kpi_config_repository import KPIConfigRepository
from repositories.team_bilan_repository import TeamBilanRepository
from repositories.morning_brief_repository import MorningBriefRepository
from repositories.daily_challenge_repository import DailyChallengeRepository
from repositories.seller_bilan_repository import SellerBilanRepository
from repositories.team_analysis_repository import TeamAnalysisRepository
from repositories.relationship_consultation_repository import RelationshipConsultationRepository
from repositories.enterprise_repository import (
    EnterpriseAccountRepository,
    APIKeyRepository,
    SyncLogRepository,
)
from repositories.system_log_repository import SystemLogRepository
from repositories.billing_repository import BillingProfileRepository
from repositories.payment_transaction_repository import PaymentTransactionRepository
from repositories.stripe_event_repository import StripeEventRepository
from repositories.ai_conversation_repository import AIConversationRepository
from repositories.ai_message_repository import AIMessageRepository
from repositories.ai_usage_log_repository import AIUsageLogRepository
from services.auth_service import AuthService
from services.kpi_service import KPIService
from services.ai_service import AIService
from services.store_service import StoreService
from services.gerant_service import GerantService
from services.onboarding_service import OnboardingService
from services.enterprise_service import EnterpriseService
from services.manager_service import ManagerService, DiagnosticService
from services.seller_service import SellerService
from services.notification_service import NotificationService
from services.conflict_service import ConflictService
from services.relationship_service import RelationshipService
from services.competence_service import CompetenceService
from services.admin_service import AdminService
from services.payment_service import PaymentService


# ===== SERVICE DEPENDENCIES =====

def get_auth_service(db: AsyncIOMotorDatabase = Depends(get_db)) -> AuthService:
    """
    Get AuthService instance with database dependency
    
    Usage in routes:
        @router.post("/login")
        async def login(
            auth_service: AuthService = Depends(get_auth_service)
        ):
            return await auth_service.login(...)
    """
    return AuthService(db)


def get_kpi_service(db: AsyncIOMotorDatabase = Depends(get_db)) -> KPIService:
    """
    Get KPIService instance with database dependency
    
    Usage in routes:
        @router.post("/kpi")
        async def create_kpi(
            kpi_service: KPIService = Depends(get_kpi_service)
        ):
            return await kpi_service.create_or_update_seller_kpi(...)
    """
    return KPIService(db)


def get_ai_service() -> AIService:
    """
    Get AIService instance (no database needed)
    
    Usage in routes:
        @router.post("/diagnostic")
        async def generate_diagnostic(
            ai_service: AIService = Depends(get_ai_service)
        ):
            return await ai_service.generate_diagnostic(...)
    """
    return AIService()


# AI Data Service (for AI routes with database access)
from services.ai_service import AIDataService

def get_ai_data_service(db: AsyncIOMotorDatabase = Depends(get_db)) -> AIDataService:
    """
    Get AIDataService instance with database dependency
    
    Usage in routes:
        @router.post("/daily-challenge")
        async def generate_challenge(
            ai_data_service: AIDataService = Depends(get_ai_data_service)
        ):
            return await ai_data_service.generate_daily_challenge_with_data(...)
    """
    return AIDataService(db)


def get_store_service(db: AsyncIOMotorDatabase = Depends(get_db)) -> StoreService:
    """
    Get StoreService instance with database dependency.
    Phase 0: assembleur — instanciation des repos ici (StoreService n'accepte pas db).
    """
    return StoreService(
        store_repo=StoreRepository(db),
        workspace_repo=WorkspaceRepository(db),
        user_repo=UserRepository(db),
    )


def get_gerant_service(db: AsyncIOMotorDatabase = Depends(get_db)) -> GerantService:
    """
    Get GerantService instance with database dependency.
    Phase 0: assembleur — instanciation des repos ici.
    """
    return GerantService(
        user_repo=UserRepository(db),
        store_repo=StoreRepository(db),
        workspace_repo=WorkspaceRepository(db),
        gerant_invitation_repo=GerantInvitationRepository(db),
        subscription_repo=SubscriptionRepository(db),
        kpi_repo=KPIRepository(db),
        manager_kpi_repo=ManagerKPIRepository(db),
        billing_profile_repo=BillingProfileRepository(db),
        system_log_repo=SystemLogRepository(db),
    )


def get_onboarding_service(db: AsyncIOMotorDatabase = Depends(get_db)) -> OnboardingService:
    """
    Get OnboardingService instance with database dependency
    
    Usage in routes:
        @router.get("/progress")
        async def get_progress(
            onboarding_service: OnboardingService = Depends(get_onboarding_service)
        ):
            return await onboarding_service.get_progress(...)
    """
    return OnboardingService(db)


def get_enterprise_service(db: AsyncIOMotorDatabase = Depends(get_db)) -> EnterpriseService:
    """
    Get EnterpriseService instance with database dependency.
    Phase 0: assembleur — instanciation des repos ici.
    """
    return EnterpriseService(
        enterprise_repo=EnterpriseAccountRepository(db),
        api_key_repo=APIKeyRepository(db),
        sync_log_repo=SyncLogRepository(db),
        user_repo=UserRepository(db),
        store_repo=StoreRepository(db),
    )


def get_notification_service(
    db: AsyncIOMotorDatabase = Depends(get_db)
) -> NotificationService:
    """
    Get NotificationService instance with database dependency.
    Service partagé pour notifications (découplage). Défini avant get_manager_service
    car ce dernier en dépend (Depends(get_notification_service)).
    """
    return NotificationService(db)


def get_manager_service(
    db: AsyncIOMotorDatabase = Depends(get_db),
    notification_service: "NotificationService" = Depends(get_notification_service),
) -> ManagerService:
    """
    Get ManagerService instance. Phase 0: assembleur — repos injectés, pas de db dans le service.
    """
    return ManagerService(
        user_repo=UserRepository(db),
        store_repo=StoreRepository(db),
        invitation_repo=InvitationRepository(db),
        kpi_config_repo=KPIConfigRepository(db),
        team_bilan_repo=TeamBilanRepository(db),
        kpi_repo=KPIRepository(db),
        manager_kpi_repo=ManagerKPIRepository(db),
        objective_repo=ObjectiveRepository(db),
        challenge_repo=ChallengeRepository(db),
        manager_diagnostic_repo=ManagerDiagnosticRepository(db),
        api_key_repo=APIKeyRepository(db),
        notification_service=notification_service,
        store_kpi_repo=StoreKPIRepository(db),
        morning_brief_repo=MorningBriefRepository(db),
        diagnostic_repo=DiagnosticRepository(db),
        debrief_repo=DebriefRepository(db),
        team_analysis_repo=TeamAnalysisRepository(db),
        relationship_consultation_repo=RelationshipConsultationRepository(db),
    )


def get_diagnostic_service(db: AsyncIOMotorDatabase = Depends(get_db)) -> DiagnosticService:
    """
    Get DiagnosticService instance with database dependency.
    Phase 0: assembleur — instanciation du repo ici.
    """
    return DiagnosticService(manager_diagnostic_repo=ManagerDiagnosticRepository(db))


def get_seller_service(db: AsyncIOMotorDatabase = Depends(get_db)) -> SellerService:
    """
    Get SellerService instance with database dependency.
    Phase 0: assembleur — instanciation des repos ici.
    """
    return SellerService(
        user_repo=UserRepository(db),
        diagnostic_repo=DiagnosticRepository(db),
        manager_request_repo=ManagerRequestRepository(db),
        objective_repo=ObjectiveRepository(db),
        challenge_repo=ChallengeRepository(db),
        kpi_repo=KPIRepository(db),
        manager_kpi_repo=ManagerKPIRepository(db),
        achievement_notification_repo=AchievementNotificationRepository(db),
        interview_note_repo=InterviewNoteRepository(db),
        debrief_repo=DebriefRepository(db),
        store_repo=StoreRepository(db),
        workspace_repo=WorkspaceRepository(db),
        kpi_config_repo=KPIConfigRepository(db),
        daily_challenge_repo=DailyChallengeRepository(db),
        seller_bilan_repo=SellerBilanRepository(db),
    )


# Integration Service
from services.integration_service import IntegrationService
from repositories.integration_repository import IntegrationRepository

def get_integration_service(db: AsyncIOMotorDatabase = Depends(get_db)) -> IntegrationService:
    """
    Get IntegrationService instance with database dependency.
    Phase 0: assembleur — instanciation des repos ici.
    """
    return IntegrationService(
        integration_repo=IntegrationRepository(db),
        user_repo=UserRepository(db),
    )


# API Key Service (for manager routes)
from services.manager_service import APIKeyService

def get_api_key_service(db: AsyncIOMotorDatabase = Depends(get_db)) -> APIKeyService:
    """
    Get APIKeyService instance with database dependency
    
    Usage in routes:
        @router.post("/api-keys")
        async def create_key(
            api_key_service: APIKeyService = Depends(get_api_key_service)
        ):
            return await api_key_service.create_api_key(...)
    """
    return APIKeyService(db)


def get_payment_service(db: AsyncIOMotorDatabase = Depends(get_db)) -> PaymentService:
    """
    Get PaymentService instance with database dependency (RC6: DI instead of explicit instantiation).
    
    Usage in routes:
        @router.post("/webhooks/stripe")
        async def stripe_webhook(
            payment_service: PaymentService = Depends(get_payment_service)
        ):
            ...
    """
    return PaymentService(db)


# Conflict Service (with injected AIService)
def get_conflict_service(
    db: AsyncIOMotorDatabase = Depends(get_db),
    ai_service: AIService = Depends(get_ai_service)
) -> ConflictService:
    """
    Get ConflictService with injected AIService
    
    ✅ ÉTAPE B : Injection de dépendance pour découplage
    
    Usage in routes:
        @router.post("/conflict")
        async def create_conflict(
            conflict_service: ConflictService = Depends(get_conflict_service)
        ):
            ...
    """
    return ConflictService(db, ai_service)


# Relationship Service (with injected AIService)
def get_relationship_service(
    db: AsyncIOMotorDatabase = Depends(get_db),
    ai_service: AIService = Depends(get_ai_service)
) -> RelationshipService:
    """
    Get RelationshipService with injected AIService
    
    ✅ ÉTAPE B : Injection de dépendance pour découplage
    
    Usage in routes:
        @router.post("/relationship")
        async def create_relationship(
            relationship_service: RelationshipService = Depends(get_relationship_service)
        ):
            ...
    """
    return RelationshipService(db, ai_service)


# Competence Service
def get_competence_service(
    db: AsyncIOMotorDatabase = Depends(get_db)
) -> CompetenceService:
    """
    Get CompetenceService instance with database dependency.
    Phase 0: assembleur — instanciation du repo ici.
    """
    return CompetenceService(diagnostic_repo=DiagnosticRepository(db))


# Admin Service (PHASE 9 / Phase 1 Refactoring: repositories imported at top)
def get_admin_service(
    db: AsyncIOMotorDatabase = Depends(get_db)
) -> AdminService:
    """
    Get AdminService instance with all required repositories.

    AdminService uses only repositories, no direct DB access.

    Usage in routes:
        @router.get("/superadmin/stats")
        async def get_stats(
            admin_service: AdminService = Depends(get_admin_service)
        ):
            return await admin_service.get_platform_stats()
    """
    return AdminService(
        admin_repo=AdminRepository(db),
        admin_log_repo=AdminLogRepository(db),
        user_repo=UserRepository(db),
        store_repo=StoreRepository(db),
        workspace_repo=WorkspaceRepository(db),
        subscription_repo=SubscriptionRepository(db),
        payment_transaction_repo=PaymentTransactionRepository(db),
        stripe_event_repo=StripeEventRepository(db),
        ai_conversation_repo=AIConversationRepository(db),
        ai_message_repo=AIMessageRepository(db),
        gerant_invitation_repo=GerantInvitationRepository(db),
        invitation_repo=InvitationRepository(db),
        system_log_repo=SystemLogRepository(db),
        ai_usage_log_repo=AIUsageLogRepository(db)
    )


# ===== REPOSITORY DEPENDENCIES =====

from repositories.sale_repository import SaleRepository
from repositories.evaluation_repository import EvaluationRepository

def get_objective_repository(
    db: AsyncIOMotorDatabase = Depends(get_db)
) -> ObjectiveRepository:
    """
    Get ObjectiveRepository instance with database dependency
    
    Usage in routes:
        @router.get("/objectives")
        async def get_objectives(
            objective_repo: ObjectiveRepository = Depends(get_objective_repository)
        ):
            return await objective_repo.find_by_store(store_id=store_id)
    """
    return ObjectiveRepository(db)


def get_challenge_repository(
    db: AsyncIOMotorDatabase = Depends(get_db)
) -> ChallengeRepository:
    """
    Get ChallengeRepository instance with database dependency
    
    Usage in routes:
        @router.get("/challenges")
        async def get_challenges(
            challenge_repo: ChallengeRepository = Depends(get_challenge_repository)
        ):
            return await challenge_repo.find_by_store(store_id=store_id)
    """
    return ChallengeRepository(db)


def get_debrief_repository(
    db: AsyncIOMotorDatabase = Depends(get_db)
) -> DebriefRepository:
    """
    Get DebriefRepository instance with database dependency
    
    Usage in routes:
        @router.get("/debriefs")
        async def get_debriefs(
            debrief_repo: DebriefRepository = Depends(get_debrief_repository)
        ):
            return await debrief_repo.find_by_seller(seller_id=seller_id)
    """
    return DebriefRepository(db)


def get_sale_repository(
    db: AsyncIOMotorDatabase = Depends(get_db)
) -> SaleRepository:
    """
    Get SaleRepository instance with database dependency
    
    Usage in routes:
        @router.get("/sales")
        async def get_sales(
            sale_repo: SaleRepository = Depends(get_sale_repository)
        ):
            return await sale_repo.find_by_seller(seller_id=seller_id)
    """
    return SaleRepository(db)


def get_evaluation_repository(
    db: AsyncIOMotorDatabase = Depends(get_db)
) -> EvaluationRepository:
    """
    Get EvaluationRepository instance with database dependency
    
    Usage in routes:
        @router.get("/evaluations")
        async def get_evaluations(
            eval_repo: EvaluationRepository = Depends(get_evaluation_repository)
        ):
            return await eval_repo.find_by_seller(seller_id=seller_id)
    """
    return EvaluationRepository(db)


def get_morning_brief_repository(
    db: AsyncIOMotorDatabase = Depends(get_db)
) -> MorningBriefRepository:
    """
    Get MorningBriefRepository instance with database dependency
    
    Usage in routes:
        @router.get("/briefs/history")
        async def get_briefs(
            brief_repo: MorningBriefRepository = Depends(get_morning_brief_repository)
        ):
            return await brief_repo.find_by_store(store_id=store_id)
    """
    return MorningBriefRepository(db)
