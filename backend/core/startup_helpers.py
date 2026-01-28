"""
Startup helpers for main.py: rate limiter (slowapi) and CORS allowed origins.
Keeps main.py under single responsibility.
"""
import logging

logger = logging.getLogger(__name__)

try:
    import slowapi
    from slowapi import Limiter, _rate_limit_exceeded_handler
    from slowapi.util import get_remote_address
    from slowapi.errors import RateLimitExceeded
    SLOWAPI_AVAILABLE = True
except ImportError as e:
    SLOWAPI_AVAILABLE = False
    logger.critical(
        "SECURITY WARNING: slowapi not found. Rate limiting DISABLED. "
        "Application vulnerable to cost abuse and scraping. Error: %s", e
    )
    Limiter = None
    RateLimitExceeded = type("RateLimitExceeded", (Exception,), {})
    _rate_limit_exceeded_handler = lambda *a, **k: None
    get_remote_address = lambda *a, **k: "unknown"


def get_dummy_limiter():
    """Dummy limiter when slowapi is not available (prevents AttributeError on @limiter.limit())."""
    class DummyLimiter:
        def __init__(self, *args, **kwargs):
            pass
        def limit(self, *args, **kwargs):
            def decorator(func):
                return func
            return decorator
    return DummyLimiter()


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
