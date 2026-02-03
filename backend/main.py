"""Main FastAPI Application Entry Point - Phase 11: single responsibility."""
import sys
import logging
import traceback

sys.stdout.reconfigure(line_buffering=True) if hasattr(sys.stdout, "reconfigure") else None
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s", stream=sys.stdout)
logger = logging.getLogger(__name__)

from core.config import settings

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import HTTPException
from core.lifespan import lifespan
from core.exceptions import AppException
from core.startup_helpers import (
    SLOWAPI_AVAILABLE, Limiter, get_remote_address, RateLimitExceeded,
    get_allowed_origins, get_dummy_limiter,
    SlowAPIMiddleware,
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

# CORS: liste utilisée aussi dans les handlers d'erreur pour que les réponses 4xx/5xx aient l'en-tête
_cors_allowed_origins = get_allowed_origins(settings)


def _cors_headers_for_request(request) -> dict:
    """En-têtes CORS à ajouter aux réponses (y compris erreurs) pour éviter blocage navigateur."""
    if request is None:
        return {"Access-Control-Allow-Origin": _cors_allowed_origins[0], "Access-Control-Allow-Credentials": "true"} if _cors_allowed_origins else {}
    origin = request.headers.get("origin") if hasattr(request, "headers") else None
    if origin and origin in _cors_allowed_origins:
        return {"Access-Control-Allow-Origin": origin, "Access-Control-Allow-Credentials": "true"}
    if _cors_allowed_origins:
        return {"Access-Control-Allow-Origin": _cors_allowed_origins[0], "Access-Control-Allow-Credentials": "true"}
    return {}


# --- Phase 1: Error Handling - FastAPI Exception Handlers (single point of truth) ---
async def _app_exception_handler(request, exc: AppException):
    """Convert AppException (and subclasses) to consistent JSON response."""
    headers = _cors_headers_for_request(request)
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "detail": exc.detail,
            "error_code": exc.error_code,
        },
        headers=headers,
    )


async def _unhandled_exception_handler(request, exc: Exception):
    """Log unexpected errors with traceback and return clean 500. No internal details to client."""
    tb = "".join(traceback.format_exception(type(exc), exc, exc.__traceback__)) if exc.__traceback__ else str(exc)
    logger.error(
        "Unexpected error: %s",
        exc,
        extra={
            "error_type": type(exc).__name__,
            "path": getattr(getattr(request, "url", None), "path", None),
            "method": getattr(request, "method", None),
            "traceback": tb,
        },
        exc_info=True,
    )
    headers = _cors_headers_for_request(request)
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Une erreur interne s'est produite. Veuillez réessayer plus tard.",
            "error_code": "INTERNAL_SERVER_ERROR",
        },
        headers=headers,
    )


async def _http_exception_handler(request: Request, exc: HTTPException):
    """Réponse 4xx avec en-têtes CORS pour éviter blocage navigateur."""
    headers = _cors_headers_for_request(request)
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers=headers,
    )


async def _rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded):
    """429 avec en-têtes CORS (sinon le navigateur affiche une erreur CORS au lieu de 429)."""
    headers = _cors_headers_for_request(request)
    detail = getattr(exc, "description", None) or "Trop de requêtes. Veuillez réessayer plus tard."
    return JSONResponse(
        status_code=429,
        content={"error_code": "RATE_LIMIT_EXCEEDED", "detail": detail},
        headers=headers,
    )


app.add_exception_handler(AppException, _app_exception_handler)
app.add_exception_handler(HTTPException, _http_exception_handler)
app.add_exception_handler(Exception, _unhandled_exception_handler)

# --- Rate limiter (slowapi). Redis storage when REDIS_URL set (Audit 1.6 & 3.3) ---
if SLOWAPI_AVAILABLE and Limiter:
    limiter_kw: dict = {
        "key_func": get_remote_address,
        "default_limits": ["100/minute"],
    }
    redis_url = getattr(settings, "REDIS_URL", None)
    if redis_url and str(redis_url).strip():
        limiter_kw["storage_uri"] = redis_url
    limiter = Limiter(**limiter_kw)
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    if SlowAPIMiddleware:
        app.add_middleware(SlowAPIMiddleware)
    from api.dependencies_rate_limiting import init_global_limiter
    init_global_limiter(limiter)
else:
    limiter = get_dummy_limiter()
    app.state.limiter = limiter
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
# Error handling: FastAPI exception handlers only (AppException + Exception). No ErrorHandlerMiddleware.
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
