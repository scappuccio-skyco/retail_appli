"""
Manager routes package.
Aggregates sub-routers: store, sellers, analytics, objectives, challenges, evaluations, consultations.
All are mounted under prefix /manager (see router below).
Utilitaires (get_store_context, verify_manager_or_gerant, etc.) : api.routes.manager.dependencies.
"""
import logging

from fastapi import APIRouter, Depends

from core.security import require_active_space

from api.routes.manager.dependencies import (
    get_store_context,
    get_store_context_with_seller,
    get_verified_seller,
    verify_manager_or_gerant,
)
from api.routes.manager.store import router as store_router
from api.routes.manager.sellers import (
    router as sellers_router,
    get_seller_kpi_entries,
    get_seller_stats,
)
from api.routes.manager.analytics import router as analytics_router
from api.routes.manager.objectives import router as objectives_router
from api.routes.manager.challenges import router as challenges_router
from api.routes.manager.evaluations import router as evaluations_router
from api.routes.manager.consultations import router as consultations_router

logger = logging.getLogger(__name__)

# Main manager router: prefix /manager
router = APIRouter(
    prefix="/manager",
    tags=["Manager"],
    dependencies=[Depends(require_active_space)],
)

router.include_router(store_router)
router.include_router(sellers_router)
router.include_router(analytics_router)
router.include_router(objectives_router)
router.include_router(challenges_router)
router.include_router(evaluations_router)
router.include_router(consultations_router)

logger.info(
    "Manager package loaded: store, sellers, analytics, objectives, challenges, evaluations, consultations"
)

__all__ = [
    "router",
    "get_store_context",
    "get_store_context_with_seller",
    "get_verified_seller",
    "verify_manager_or_gerant",
    "get_seller_kpi_entries",
    "get_seller_stats",
]
