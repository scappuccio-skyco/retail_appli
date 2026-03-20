"""
Sellers Package
Exposes the three routers consumed by api/routes/__init__.py:
  - router          (prefix="/seller",     dependencies=[require_active_space])
  - status_router   (prefix="/seller",     no require_active_space — public routes)
  - diagnostic_router (prefix="/diagnostic", separate router)
"""
from fastapi import APIRouter, Depends
from core.security import require_active_space

# ── Sub-module imports ──────────────────────────────────────────────────────
from api.routes.sellers.status import router as status_sub_router
from api.routes.sellers.objectives import router as objectives_router
from api.routes.sellers.challenges import router as challenges_router
from api.routes.sellers.kpi import router as kpi_router
from api.routes.sellers.diagnostic import router as seller_diagnostic_router
from api.routes.sellers.diagnostic import diag_router as diag_sub_router
from api.routes.sellers.relationship import router as relationship_router
from api.routes.sellers.bilans import router as bilans_router
from api.routes.sellers.interview_notes import router as interview_notes_router

# ── Root routers (exported) ─────────────────────────────────────────────────

router = APIRouter(
    prefix="/seller",
    tags=["Seller"],
    dependencies=[Depends(require_active_space)]
)

# Public router: auth-only (no require_active_space) — accessible even when subscription is expired.
status_router = APIRouter(prefix="/seller", tags=["Seller"])

# Separate router for /diagnostic endpoints (frontend calls /api/diagnostic/me)
diagnostic_router = APIRouter(prefix="/diagnostic", tags=["Seller Diagnostic"])

# ── Mount sub-routers ───────────────────────────────────────────────────────

# Routes protected by require_active_space (via parent router dependency)
router.include_router(objectives_router)
router.include_router(challenges_router)
router.include_router(kpi_router)
router.include_router(seller_diagnostic_router)
router.include_router(relationship_router)
router.include_router(bilans_router)
router.include_router(interview_notes_router)

# Public routes (no require_active_space)
status_router.include_router(status_sub_router)

# /diagnostic/* routes
diagnostic_router.include_router(diag_sub_router)
