"""
Dependency helpers for rate limiting
Allows routes to access the rate limiter from app.state
"""
from slowapi import Limiter
from slowapi.util import get_remote_address
from typing import Optional


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
    
    # Fallback: create new limiter (should not happen in production)
    return Limiter(key_func=get_remote_address)
