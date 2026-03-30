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
SELLERS_LIST_LIMIT: Final[int] = 50
"""Limit for seller listing queries within a store (IDOR-safe bound)"""
KPI_RECENT_DAYS: Final[int] = 7
"""Lookback window in days for recent KPI entries (seller detail view)"""
DEBRIEFS_HISTORY_CAP: Final[int] = 200
"""Hard cap for competence-history debriefs (pagination preferred client-side)"""

# ===== JWT =====
JWT_EXPIRATION_HOURS: Final[int] = 24
"""JWT token expiration time in hours"""

# ===== PASSWORD RESET =====
PASSWORD_RESET_TOKEN_EXPIRATION_SECONDS: Final[int] = 600
"""Password reset token expiration (10 minutes)"""

# ===== TRIAL =====
TRIAL_DAYS: Final[int] = 30
"""Durée de la période d'essai gratuit en jours. Modifier ici pour changer partout."""

# ===== CGU / RGPD =====
CGU_CURRENT_VERSION: Final[str] = "v1.0"
"""Version actuelle des CGU acceptées à l'inscription. À incrémenter (v1.1, v2.0...) à chaque
mise à jour des Conditions Générales d'Utilisation ou de la Politique de Confidentialité."""
