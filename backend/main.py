"""Main FastAPI Application Entry Point - Phase 11: single responsibility."""
import sys
import os
import logging

sys.stdout.reconfigure(line_buffering=True) if hasattr(sys.stdout, "reconfigure") else None
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s", stream=sys.stdout)
logger = logging.getLogger(__name__)

try:
    from core.config import settings
except Exception as e:
    logger.warning("Settings import failed, using fallback: %s", e)
    class MinimalSettings:
        ENVIRONMENT = os.environ.get("ENVIRONMENT", "production")
        DEBUG = False
        CORS_ORIGINS = "*"
        DB_NAME = os.environ.get("DB_NAME", "retail_coach")
    settings = MinimalSettings()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from core.lifespan import lifespan
from core.startup_helpers import (
    SLOWAPI_AVAILABLE, Limiter, get_remote_address, RateLimitExceeded,
    _rate_limit_exceeded_handler, get_allowed_origins, get_dummy_limiter,
)

try:
    from core.database import database
except Exception:
    database = None

# --- App creation ---
app = FastAPI(
    title="Retail Performer AI",
    description="API for retail performance management and AI-powered insights",
    version="2.0.0",
    debug=settings.DEBUG,
    docs_url="/docs" if settings.ENVIRONMENT != "production" else None,
    redoc_url="/redoc" if settings.ENVIRONMENT != "production" else None,
    lifespan=lifespan,
)

# --- Rate limiter ---
if SLOWAPI_AVAILABLE and Limiter:
    limiter = Limiter(key_func=get_remote_address)
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    try:
        from core.rate_limiting import init_rate_limiter
        init_rate_limiter(limiter)
    except ImportError:
        pass
    from api.dependencies_rate_limiting import init_global_limiter
    init_global_limiter(limiter)
else:
    limiter = get_dummy_limiter()
    from api.dependencies_rate_limiting import init_global_limiter
    init_global_limiter(limiter)

# --- Routers (import AFTER init_global_limiter so get_rate_limiter() returns app.state.limiter) ---
try:
    from api.routes import routers
except Exception as e:
    logger.error("Routers import failed: %s", e)
    routers = []
try:
    from api.routes.legacy import router as legacy_router
except Exception as e:
    logger.warning("Legacy router import failed: %s", e)
    legacy_router = None
try:
    from api.routes.health import router as health_router
except Exception as e:
    logger.warning("Health router import failed: %s", e)
    health_router = None

# --- Middlewares (order: last added = first executed) ---
try:
    from api.middleware.error_handler import ErrorHandlerMiddleware
    app.add_middleware(ErrorHandlerMiddleware)
except Exception as e:
    logger.error("ErrorHandlerMiddleware not loaded: %s", e)
try:
    from middleware.logging import LoggingMiddleware
    app.add_middleware(LoggingMiddleware)
except Exception as e:
    logger.warning("LoggingMiddleware not loaded: %s", e)
try:
    from middleware.security_headers import SecurityHeadersMiddleware
    app.add_middleware(SecurityHeadersMiddleware)
except Exception as e:
    logger.warning("SecurityHeadersMiddleware not loaded: %s", e)

allowed_origins = get_allowed_origins(settings)
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"],
    allow_headers=[
        "Authorization", "Content-Type", "Accept", "Origin",
        "X-Requested-With", "X-API-Key",
        "Access-Control-Request-Method", "Access-Control-Request-Headers",
    ],
    expose_headers=["Content-Disposition", "Content-Type", "Content-Length", "Access-Control-Allow-Origin", "Access-Control-Allow-Credentials"],
    max_age=3600,
)

# --- Routers ---
auth_found = any(r.prefix == "/auth" for r in routers)
if not auth_found:
    raise RuntimeError("CRITICAL: Auth router not loaded - cannot start application")
for router in routers:
    app.include_router(router, prefix="/api")
if legacy_router:
    app.include_router(legacy_router, prefix="/api", tags=["Legacy"])
if health_router:
    app.include_router(health_router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8001,
        reload=settings.ENVIRONMENT == "development",
    )
