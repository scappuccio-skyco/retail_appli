"""
Dependency helpers for rate limiting (Audit 2.1).
Imports from core.rate_limiting (get_remote_address, get_dummy_limiter, etc.).
"""
import asyncio
from typing import Optional

try:
    from fastapi import Request, Depends
except ImportError:
    Request = None
    Depends = None

from core.rate_limiting import (
    SLOWAPI_AVAILABLE,
    Limiter,
    get_remote_address,
    get_dummy_limiter,
    init_global_limiter,
    get_rate_limiter,
)


def get_limiter_from_request(request: "Request") -> Optional[Limiter]:
    """Return limiter from request.app.state or get_rate_limiter fallback."""
    if Request is None:
        return None
    return getattr(request.app.state, "limiter", None) or get_rate_limiter()


def rate_limit(limit_str: str):
    """Depends() that applies rate limit via request.app.state.limiter.
    Uses key_func = IP + path so each endpoint has its own bucket (otherwise
    all routes sharing this Depends would use the same slowapi bucket and
    the first registered limit e.g. 10/minute could apply to all).
    """
    async def _check_limit(request: Request):
        limiter = get_limiter_from_request(request)
        if not limiter:
            return None
        # Per-endpoint key so /api/manager/sellers gets 200/min, /api/auth/login 10/min, etc.
        def _key_func(req: Request):
            return f"{get_remote_address(req)}:{req.url.path}"
        async def _noop(req: Request):
            return None
        wrapped = limiter.limit(limit_str, key_func=_key_func)(_noop)
        result = wrapped(request)
        if asyncio.iscoroutine(result):
            await result
        return None
    return Depends(_check_limit)
