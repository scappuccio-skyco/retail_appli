"""API route modules"""
from api.routes.auth import router as auth_router
from api.routes.kpis import router as kpi_router
from api.routes.stores import router as store_router
from api.routes.ai import router as ai_router
from api.routes.admin import router as admin_router
from api.routes.integrations import router as integrations_router

# List of all routers to include in main app
routers = [
    auth_router,
    kpi_router,
    store_router,
    ai_router,
    admin_router,
    integrations_router,
]

__all__ = ['routers']
