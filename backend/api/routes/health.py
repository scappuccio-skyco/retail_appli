"""Health, root and debug routes (no prefix)."""
from datetime import datetime
from fastapi import APIRouter, Request

router = APIRouter(prefix="", tags=["Health"])


def _get_settings():
    try:
        from core.config import settings
        return settings
    except Exception:
        import os
        class MinimalSettings:
            ENVIRONMENT = os.environ.get("ENVIRONMENT", "production")
            DEBUG = False
        return MinimalSettings()


@router.get("/health")
async def health_check():
    s = _get_settings()
    return {"status": "healthy", "version": "2.0.0", "environment": s.ENVIRONMENT}


@router.get("/api/health")
async def api_health_check():
    s = _get_settings()
    try:
        from core.database import database
        db_ok = database is not None and getattr(database, "db", None)
    except Exception:
        db_ok = False
    return {
        "status": "healthy",
        "version": "2.0.0",
        "environment": s.ENVIRONMENT,
        "db_status": "connected" if db_ok else "disconnected",
    }


@router.get("/")
async def root():
    s = _get_settings()
    return {
        "message": "Retail Performer AI API",
        "version": "2.0.0",
        "docs": "/docs" if s.ENVIRONMENT != "production" else "Contact admin for documentation",
    }


@router.get("/_debug/routes", include_in_schema=False)
async def debug_routes(request: Request):
    app = request.app
    routes_list = []
    for route in app.routes:
        if not hasattr(route, "path"):
            continue
        methods = sorted(m for m in getattr(route, "methods", set()) if m not in ("OPTIONS", "HEAD"))
        if not methods:
            continue
        for method in methods:
            routes_list.append({
                "path": getattr(route, "path", ""),
                "method": method,
                "name": getattr(route, "name", ""),
                "tags": list(getattr(route, "tags", [])),
            })
    routes_list.sort(key=lambda x: (x["path"], x["method"]))
    return {"generated_at": datetime.now().isoformat(), "total_routes": len(routes_list), "routes": routes_list}
