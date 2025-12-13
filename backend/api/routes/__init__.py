"""API route modules"""
from api.routes.auth import router as auth_router
from api.routes.kpis import router as kpi_router
from api.routes.stores import router as store_router
from api.routes.ai import router as ai_router
from api.routes.admin import router as admin_router
from api.routes.integrations import router as integrations_router
from api.routes.gerant import router as gerant_router
from api.routes.onboarding import router as onboarding_router
from api.routes.enterprise import router as enterprise_router
from api.routes.manager import router as manager_router
from api.routes.diagnostics import router as diagnostics_router
from api.routes.sellers import router as seller_router
from api.routes.sellers import diagnostic_router  # For /diagnostic/me
from api.routes.stripe_webhooks import router as stripe_webhook_router
from api.routes.support import router as support_router
from api.routes.sales_evaluations import router as sales_evaluations_router
from api.routes.debriefs import router as debriefs_router
from api.routes.evaluations import router as evaluations_router  # Entretien Annuel

# List of all routers to include in main app
routers = [
    auth_router,
    kpi_router,
    store_router,
    ai_router,
    admin_router,
    integrations_router,
    gerant_router,
    onboarding_router,
    enterprise_router,
    manager_router,
    diagnostics_router,
    seller_router,
    diagnostic_router,  # Added for /api/diagnostic/me
    stripe_webhook_router,
    support_router,
    sales_evaluations_router,
    debriefs_router,
    evaluations_router,  # Guide d'entretien annuel IA
]

__all__ = ['routers']
