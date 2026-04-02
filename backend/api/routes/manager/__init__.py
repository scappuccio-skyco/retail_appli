"""
Manager routes package.
Aggregates sub-routers: store, sellers, analytics, objectives, challenges, evaluations, consultations.
All are mounted under prefix /manager (see router below).
Utilitaires (get_store_context, verify_manager_or_gerant, etc.) : api.routes.manager.dependencies.
"""
import logging

from fastapi import APIRouter, Depends

from core.security import require_active_space, get_current_manager

from api.routes.manager.dependencies import (
    get_store_context,
    get_store_context_with_seller,
    get_verified_seller,
    verify_manager_or_gerant,
)
from api.routes.manager.store import router as store_router, public_router as store_public_router
from api.routes.manager.sellers import (
    router as sellers_router,
    get_seller_kpi_entries,
    get_seller_stats,
)
from api.routes.manager.kpi import router as kpi_router
from api.routes.manager.team_analyses import router as team_analyses_router
from api.routes.manager.compatibility import router as compatibility_router
from api.routes.manager.store_kpi_analysis import router as store_kpi_analysis_router
from api.routes.manager.objectives import router as objectives_router
from api.routes.manager.challenges import router as challenges_router
from api.routes.manager.evaluations import router as evaluations_router
from api.routes.manager.consultations import router as consultations_router

logger = logging.getLogger(__name__)

# Main manager router: prefix /manager — accès strictement réservé aux managers (pas aux gérants)
router = APIRouter(
    prefix="/manager",
    tags=["Manager"],
    dependencies=[Depends(require_active_space), Depends(get_current_manager)],
)

# Public router: auth-only (no require_active_space) for status/config endpoints
# Accessible even when subscription is expired so the frontend can display the right message.
public_router = APIRouter(
    prefix="/manager",
    tags=["Manager"],
    dependencies=[Depends(get_current_manager)],
)
public_router.include_router(store_public_router)

router.include_router(store_router)
router.include_router(sellers_router)
router.include_router(kpi_router)
router.include_router(team_analyses_router)
router.include_router(compatibility_router)
router.include_router(store_kpi_analysis_router)
router.include_router(objectives_router)
router.include_router(challenges_router)
router.include_router(evaluations_router)
router.include_router(consultations_router)

logger.info(
    "Manager package loaded: store, sellers, analytics, objectives, challenges, evaluations, consultations"
)

__all__ = [
    "router",
    "public_router",
    "get_store_context",
    "get_store_context_with_seller",
    "get_verified_seller",
    "verify_manager_or_gerant",
    "get_seller_kpi_entries",
    "get_seller_stats",
]
