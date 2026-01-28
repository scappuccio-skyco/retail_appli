"""
API Dependencies - Dependency Injection for Services
Assembles repositories and services with database connection
"""
from fastapi import Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from core.database import get_db
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
    Get StoreService instance with database dependency
    
    Usage in routes:
        @router.post("/store")
        async def create_store(
            store_service: StoreService = Depends(get_store_service)
        ):
            return await store_service.create_store(...)
    """
    return StoreService(db)


def get_gerant_service(db: AsyncIOMotorDatabase = Depends(get_db)) -> GerantService:
    """
    Get GerantService instance with database dependency
    
    Usage in routes:
        @router.get("/dashboard/stats")
        async def get_stats(
            gerant_service: GerantService = Depends(get_gerant_service)
        ):
            return await gerant_service.get_dashboard_stats(...)
    """
    return GerantService(db)


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
    Get EnterpriseService instance with database dependency
    
    Usage in routes:
        @router.post("/users/bulk-import")
        async def bulk_import(
            enterprise_service: EnterpriseService = Depends(get_enterprise_service)
        ):
            return await enterprise_service.bulk_import_users(...)
    """
    return EnterpriseService(db)


def get_manager_service(db: AsyncIOMotorDatabase = Depends(get_db)) -> ManagerService:
    """Get ManagerService instance with database dependency"""
    return ManagerService(db)


def get_diagnostic_service(db: AsyncIOMotorDatabase = Depends(get_db)) -> DiagnosticService:
    """Get DiagnosticService instance with database dependency"""
    return DiagnosticService(db)


def get_seller_service(db: AsyncIOMotorDatabase = Depends(get_db)) -> SellerService:
    """
    Get SellerService instance with database dependency
    
    Usage in routes:
        @router.get("/tasks")
        async def get_tasks(
            seller_service: SellerService = Depends(get_seller_service)
        ):
            return await seller_service.get_seller_tasks(...)
    """
    return SellerService(db)


# Integration Service
from services.integration_service import IntegrationService
from repositories.integration_repository import IntegrationRepository

def get_integration_service(db: AsyncIOMotorDatabase = Depends(get_db)) -> IntegrationService:
    """
    Get IntegrationService instance with database dependency
    
    Usage in routes:
        @router.post("/api-keys")
        async def create_key(
            integration_service: IntegrationService = Depends(get_integration_service)
        ):
            return await integration_service.create_api_key(...)
    """
    integration_repo = IntegrationRepository(db)
    return IntegrationService(integration_repo, db)


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


# Notification Service
def get_notification_service(
    db: AsyncIOMotorDatabase = Depends(get_db)
) -> NotificationService:
    """
    Get NotificationService instance with database dependency
    
    ✅ ÉTAPE C : Service partagé pour notifications (découplage)
    
    Usage in routes:
        @router.get("/objectives")
        async def get_objectives(
            notification_service: NotificationService = Depends(get_notification_service)
        ):
            await notification_service.add_achievement_notification_flag(...)
    """
    return NotificationService(db)


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
    Get CompetenceService instance with database dependency
    
    Usage in routes:
        @router.get("/seller/{seller_id}/stats")
        async def get_stats(
            competence_service: CompetenceService = Depends(get_competence_service)
        ):
            scores = await competence_service.calculate_seller_performance_scores(...)
    """
    return CompetenceService(db)


# Admin Service (PHASE 9: Refactoring)
def get_admin_service(
    db: AsyncIOMotorDatabase = Depends(get_db)
) -> AdminService:
    """
    Get AdminService instance with all required repositories
    
    PHASE 9: Refactoring - AdminService uses only repositories, no direct DB access
    
    Usage in routes:
        @router.get("/superadmin/stats")
        async def get_stats(
            admin_service: AdminService = Depends(get_admin_service)
        ):
            return await admin_service.get_platform_stats()
    """
    from repositories.admin_repository import AdminRepository
    from repositories.admin_log_repository import AdminLogRepository
    from repositories.user_repository import UserRepository
    from repositories.store_repository import StoreRepository, WorkspaceRepository
    from repositories.subscription_repository import SubscriptionRepository
    from repositories.gerant_invitation_repository import GerantInvitationRepository
    from repositories.invitation_repository import InvitationRepository
    from repositories.system_log_repository import SystemLogRepository
    from repositories.base_repository import BaseRepository
    
    # Repositories pour collections sans repository dédié
    class PaymentTransactionRepository(BaseRepository):
        def __init__(self, db):
            super().__init__(db, "payment_transactions")
    
    class StripeEventRepository(BaseRepository):
        def __init__(self, db):
            super().__init__(db, "stripe_events")
    
    class AIConversationRepository(BaseRepository):
        def __init__(self, db):
            super().__init__(db, "ai_conversations")
    
    class AIMessageRepository(BaseRepository):
        def __init__(self, db):
            super().__init__(db, "ai_messages")
    
    class AIUsageLogRepository(BaseRepository):
        def __init__(self, db):
            super().__init__(db, "ai_usage_logs")
    
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

from repositories.objective_repository import ObjectiveRepository
from repositories.challenge_repository import ChallengeRepository
from repositories.debrief_repository import DebriefRepository
from repositories.sale_repository import SaleRepository
from repositories.evaluation_repository import EvaluationRepository
from repositories.morning_brief_repository import MorningBriefRepository

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
