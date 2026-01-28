"""API route modules"""
import logging

logger = logging.getLogger(__name__)

# List of all routers to include in main app
routers = []

# CRITICAL: Import auth router FIRST with explicit import (no silent failures)
try:
    from api.routes.auth import router as auth_router
    routers.append(auth_router)
    logger.info("Loaded auth router (%s routes)", len(auth_router.routes))
except Exception as e:
    logger.exception("FATAL: Failed to load auth router: %s", e)
    raise RuntimeError(f"CRITICAL: Cannot load auth router: {e}") from e


def safe_import(module_path, router_name, fallback_prefix=None):
    """Safely import a router with error handling"""
    try:
        module = __import__(module_path, fromlist=[router_name])
        router = getattr(module, router_name)
        routers.append(router)
        logger.info(
            "Loaded %s.%s (prefix: %s, routes: %s)",
            module_path, router_name, router.prefix, len(router.routes),
        )
        return router
    except Exception as e:
        logger.exception("Failed to load %s.%s: %s", module_path, router_name, e)
        return None

# Import other routers with error handling
safe_import('api.routes.kpis', 'router')
safe_import('api.routes.stores', 'router')
safe_import('api.routes.ai', 'router')
safe_import('api.routes.admin', 'router')
safe_import('api.routes.integrations', 'router')
safe_import('api.routes.gerant', 'router')
safe_import('api.routes.onboarding', 'router')
safe_import('api.routes.enterprise', 'router')
safe_import('api.routes.manager', 'router')
safe_import('api.routes.diagnostics', 'router')
safe_import('api.routes.sellers', 'router')
safe_import('api.routes.sellers', 'diagnostic_router')
safe_import('api.routes.stripe_webhooks', 'router')
safe_import('api.routes.support', 'router')
safe_import('api.routes.sales_evaluations', 'router')
safe_import('api.routes.debriefs', 'router')
safe_import('api.routes.evaluations', 'router')
safe_import('api.routes.workspaces', 'router')
safe_import('api.routes.briefs', 'router')
safe_import('api.routes.docs', 'router')
safe_import('api.routes.early_access', 'router')

logger.info("Loaded %s routers total", len(routers))

__all__ = ['routers']
