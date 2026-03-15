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


def _extract_user_id_from_request(request: "Request") -> str:
    """Extract user_id from JWT Bearer token, fall back to IP address."""
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        try:
            from core.security import decode_token as decode_access_token
            token = auth_header[7:]
            payload = decode_access_token(token)
            user_id = payload.get("user_id") or payload.get("sub") or payload.get("id")
            if user_id:
                return f"user:{user_id}"
        except Exception:
            pass
    return get_remote_address(request)


def rate_limit(limit_str: str):
    """Depends() that applies rate limit via request.app.state.limiter.
    Key = user_id (from JWT) + path when authenticated, else IP + path.
    This ensures each user has their own bucket even behind a shared proxy (Railway).
    """
    async def _check_limit(request: Request):
        limiter = get_limiter_from_request(request)
        if not limiter:
            return None
        def _key_func():
            identity = _extract_user_id_from_request(request)
            return f"{identity}:{request.url.path}"
        async def _noop(request: Request):
            return None
        wrapped = limiter.limit(limit_str, key_func=_key_func)(_noop)
        result = wrapped(request)
        if asyncio.iscoroutine(result):
            await result
        return None
    return Depends(_check_limit)
