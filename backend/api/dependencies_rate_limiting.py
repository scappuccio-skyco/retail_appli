"""
Dependency helpers for rate limiting
Allows routes to access the rate limiter from app.state (dynamique).
Main.py imports routers AFTER init_global_limiter so get_rate_limiter() returns app.state.limiter.
"""
from typing import Optional

try:
    from fastapi import Request
except ImportError:
    Request = None

# Optional: slowapi for rate limiting
try:
    from slowapi import Limiter
    from slowapi.util import get_remote_address
    SLOWAPI_AVAILABLE = True
except ImportError:
    SLOWAPI_AVAILABLE = False
    # Create dummy classes for graceful degradation
    class Limiter:
        def __init__(self, *args, **kwargs):
            pass
        def limit(self, *args, **kwargs):
            def decorator(func):
                return func
            return decorator
    
    def get_remote_address(*args, **kwargs):
        return "unknown"


# Global limiter instance (will be set from app.state in main.py)
_global_limiter: Optional[Limiter] = None


def init_global_limiter(limiter: Limiter):
    """
    Initialize the global rate limiter instance.
    Called from main.py after app.state.limiter is set.
    """
    global _global_limiter
    _global_limiter = limiter


def get_rate_limiter() -> Limiter:
    """
    Get the rate limiter instance.
    Returns the limiter set by main.py (app.state.limiter via init_global_limiter).
    Routers are imported AFTER init_global_limiter so this always returns the app limiter.
    """
    global _global_limiter
    
    if _global_limiter is not None:
        return _global_limiter
    
    # Fallback: create new limiter (or dummy if slowapi not available)
    if SLOWAPI_AVAILABLE:
        return Limiter(key_func=get_remote_address)
    else:
        return Limiter()  # Dummy limiter that does nothing


def get_limiter_from_request(request: "Request") -> Optional[Limiter]:
    """
    Dependency: return the rate limiter from request.app.state (dynamique).
    Use this when you need the limiter at request time instead of at import time.
    """
    if Request is None:
        return None
    return getattr(request.app.state, "limiter", None) or get_rate_limiter()
