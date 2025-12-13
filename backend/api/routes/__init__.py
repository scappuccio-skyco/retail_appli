"""API route modules"""
import sys
print("[ROUTES] Loading API routes...", flush=True)

# List of all routers to include in main app
routers = []

def safe_import(module_path, router_name, fallback_prefix=None):
    """Safely import a router with error handling"""
    try:
        module = __import__(module_path, fromlist=[router_name])
        router = getattr(module, router_name)
        routers.append(router)
        print(f"[ROUTES] ✅ Loaded {module_path}.{router_name}", flush=True)
        return router
    except Exception as e:
        print(f"[ROUTES] ❌ Failed to load {module_path}.{router_name}: {e}", flush=True)
        return None

# Import all routers with error handling
safe_import('api.routes.auth', 'router')
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

print(f"[ROUTES] Loaded {len(routers)} routers total", flush=True)

__all__ = ['routers']
