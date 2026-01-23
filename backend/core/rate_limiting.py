"""
Rate Limiting Utilities
Helper functions for role-based rate limiting
"""
from slowapi import Limiter
from slowapi.util import get_remote_address
from fastapi import Request
from typing import Callable


def get_rate_limit_key_func_by_role() -> Callable:
    """
    Returns a key function for rate limiting based on user role.
    Uses user_id if authenticated, otherwise falls back to IP address.
    """
    def key_func(request: Request) -> str:
        # Try to get user from request state (set by auth middleware)
        if hasattr(request.state, 'user_id'):
            user_id = request.state.user_id
            return f"user:{user_id}"
        
        # Fallback to IP address
        return get_remote_address(request)
    
    return key_func


def get_rate_limit_by_role(role: str) -> str:
    """
    Get rate limit string based on user role.
    
    Args:
        role: User role (seller, manager, gerant, super_admin)
        
    Returns:
        Rate limit string (e.g., "10/minute", "100/minute")
    """
    # Rate limits by role
    limits = {
        'seller': '10/minute',      # Sellers: 10 req/min
        'manager': '50/minute',     # Managers: 50 req/min
        'gerant': '100/minute',     # Gérants: 100 req/min
        'gérant': '100/minute',     # Gérants: 100 req/min
        'super_admin': '200/minute' # Super admins: 200 req/min
    }
    
    return limits.get(role, '10/minute')  # Default: 10 req/min


# Global rate limiter instance (will be initialized in main.py)
limiter: Limiter = None


def init_rate_limiter(app_limiter: Limiter):
    """
    Initialize the global rate limiter instance.
    Called from main.py during startup.
    """
    global limiter
    limiter = app_limiter
