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


# Note: Add more service dependencies here as needed:
# - get_diagnostic_service()
# - get_challenge_service()
# etc.
