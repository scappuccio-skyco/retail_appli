"""
Startup helpers for main.py: rate limiter (slowapi) and CORS allowed origins.
Imports get_remote_address, get_dummy_limiter, etc. from core.rate_limiting (Audit 2.1).
"""
import logging

from core.rate_limiting import (
    SLOWAPI_AVAILABLE,
    Limiter,
    get_remote_address,
    get_dummy_limiter,
    RateLimitExceeded,
    rate_limit_exceeded_handler,
    SlowAPIMiddleware,
)

logger = logging.getLogger(__name__)


def get_allowed_origins(settings) -> list:
    """Build CORS allowed origins list (always includes production domains)."""
    production_origins = [
        "https://retailperformerai.com",
        "https://www.retailperformerai.com",
        "https://api.retailperformerai.com",
    ]
    if getattr(settings, "CORS_ORIGINS", "*") == "*":
        logger.warning("CORS_ORIGINS set to '*' - using explicit production origins")
        return production_origins.copy()
    parsed = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]
    allowed = list(set(parsed + production_origins))
    for o in production_origins:
        if o not in allowed:
            allowed.append(o)
    return allowed
