"""API route modules"""
from api.routes.auth import router as auth_router
from api.routes.kpis import router as kpi_router
from api.routes.stores import router as store_router
from api.routes.ai import router as ai_router

# List of all routers to include in main app
routers = [
    auth_router,
    kpi_router,
    store_router,
    ai_router,
]

__all__ = ['routers']
