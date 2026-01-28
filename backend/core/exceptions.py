"""
Exceptions métier - Réexport centralisé.

Toutes les classes héritent d'AppException. Le ErrorHandlerMiddleware
convertit ces exceptions en réponses HTTP (404, 400, 403, 409, etc.).

Pour 403 (accès interdit) : utiliser ForbiddenError (PermissionError est un builtin Python).
"""
from exceptions.custom_exceptions import (
    AppException,
    NotFoundError,
    ValidationError,
    UnauthorizedError,
    ForbiddenError,
    BusinessLogicError,
    ConflictError,
)

__all__ = [
    "AppException",
    "NotFoundError",
    "ValidationError",
    "UnauthorizedError",
    "ForbiddenError",
    "BusinessLogicError",
    "ConflictError",
]
