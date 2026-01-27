"""
Application Limits Configuration

Centralized configuration for all application limits.
Replace magic numbers throughout the codebase with these constants.
"""
from typing import Final

# ===== PAGINATION LIMITS =====
DEFAULT_PAGE_SIZE: Final[int] = 20
"""Default number of items per page"""
MAX_PAGE_SIZE: Final[int] = 100
"""Maximum number of items per page (prevents memory issues)"""

# ===== DATABASE LIMITS =====
MONGODB_MAX_POOL_SIZE: Final[int] = 50  # ✅ Production-ready (configurable via MONGO_MAX_POOL_SIZE env var)
"""Maximum MongoDB connection pool size (default: 50, can be increased to 100 for high load)"""
MONGODB_MIN_POOL_SIZE: Final[int] = 1
"""Minimum MongoDB connection pool size"""

# ===== RATE LIMITING =====
RATE_LIMIT_AI: Final[str] = "10/minute"
"""Rate limit for AI endpoints (cost protection)"""
RATE_LIMIT_READ: Final[str] = "100/minute"
"""Rate limit for read endpoints"""
RATE_LIMIT_WRITE: Final[str] = "60/minute"
"""Rate limit for write endpoints"""

# ===== QUERY LIMITS =====
DEBRIEFS_LIMIT: Final[int] = 5
"""Default limit for debriefs queries"""
MAX_QUERY_RESULTS: Final[int] = 1000
"""Maximum results for non-paginated queries (⚠️ À remplacer par pagination)"""

# ===== JWT =====
JWT_EXPIRATION_HOURS: Final[int] = 24
"""JWT token expiration time in hours"""

# ===== PASSWORD RESET =====
PASSWORD_RESET_TOKEN_EXPIRATION_SECONDS: Final[int] = 600
"""Password reset token expiration (10 minutes)"""
