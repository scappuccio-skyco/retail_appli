"""
Dependency helpers for rate limiting
Allows routes to access the rate limiter from app.state
"""
from typing import Optional

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
    Returns the limiter from app.state if available, otherwise creates a new one.
    """
    global _global_limiter
    
    if _global_limiter is not None:
        return _global_limiter
    
    # Fallback: create new limiter (or dummy if slowapi not available)
    if SLOWAPI_AVAILABLE:
        return Limiter(key_func=get_remote_address)
    else:
        return Limiter()  # Dummy limiter that does nothing
