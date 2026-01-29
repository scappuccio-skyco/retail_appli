"""
Rate limiting: slowapi setup, get_remote_address, dummy limiter (Audit 2.1).
Single source for api.dependencies_rate_limiting and core.startup_helpers.
"""
import logging
from typing import Callable, Optional

logger = logging.getLogger(__name__)

try:
    import slowapi
    from slowapi import Limiter
    from slowapi.util import get_remote_address
    from slowapi.errors import RateLimitExceeded
    from slowapi.middleware import SlowAPIMiddleware
    SLOWAPI_AVAILABLE = True
except ImportError as e:
    SLOWAPI_AVAILABLE = False
    logger.critical(
        "SECURITY WARNING: slowapi not found. Rate limiting DISABLED. Error: %s", e
    )
    RateLimitExceeded = type("RateLimitExceeded", (Exception,), {})
    SlowAPIMiddleware = None

    class Limiter:
        def __init__(self, *args, **kwargs):
            pass
        def limit(self, *args, **kwargs):
            def decorator(func):
                return func
            return decorator

    def get_remote_address(*args, **kwargs):
        return "unknown"


def get_dummy_limiter():
    """Dummy limiter when slowapi unavailable (no-op @limiter.limit())."""
    class DummyLimiter:
        def __init__(self, *args, **kwargs):
            pass
        def limit(self, *args, **kwargs):
            def decorator(func):
                return func
            return decorator
    return DummyLimiter()


def rate_limit_exceeded_handler(request, exc: "RateLimitExceeded"):
    """JSON response for RateLimitExceeded (error_code + detail)."""
    from fastapi.responses import JSONResponse
    detail = getattr(exc, "description", None) or "Trop de requêtes. Veuillez réessayer plus tard."
    return JSONResponse(
        status_code=429,
        content={"error_code": "RATE_LIMIT_EXCEEDED", "detail": detail},
    )


# Role-based helpers (use get_remote_address from above)
try:
    from fastapi import Request
except ImportError:
    Request = None


def get_rate_limit_key_func_by_role() -> Callable:
    """Key func: user_id if authenticated, else get_remote_address."""
    def key_func(request: "Request") -> str:
        if hasattr(request.state, "user_id"):
            return f"user:{request.state.user_id}"
        return get_remote_address(request)
    return key_func


def get_rate_limit_by_role(role: str) -> str:
    limits = {
        "seller": "10/minute",
        "manager": "50/minute",
        "gerant": "100/minute",
        "gérant": "100/minute",
        "super_admin": "200/minute",
    }
    return limits.get(role, "10/minute")


_global_limiter: Optional[Limiter] = None


def init_rate_limiter(app_limiter: Limiter):
    """Set global limiter (called from main.py)."""
    global _global_limiter
    _global_limiter = app_limiter


def init_global_limiter(limiter: Limiter):
    """Alias for init_rate_limiter. Used by main.py and dependencies_rate_limiting."""
    init_rate_limiter(limiter)


def get_rate_limiter() -> Limiter:
    """Return app limiter or fallback (new Limiter or dummy if slowapi missing)."""
    global _global_limiter
    if _global_limiter is not None:
        return _global_limiter
    if SLOWAPI_AVAILABLE:
        return Limiter(key_func=get_remote_address)
    return get_dummy_limiter()
