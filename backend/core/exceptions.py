"""
Phase 1 - Error Handling : hiérarchie d'exceptions métier.

Toutes les exceptions héritent d'AppException. Le middleware (ErrorHandlerMiddleware)
et le gestionnaire FastAPI (main.py) les convertissent en réponses JSON avec status_code,
detail et error_code.

À utiliser dans la couche Service (pas HTTPException) :
- NotFoundError       → 404 (ressource absente)
- ForbiddenError      → 403 (permissions insuffisantes)
- UnauthorizedError   → 401 (auth manquante ou invalide)
- ValidationError     → 400 (données / logique métier invalides)
- ConflictError       → 409 (doublons, conflit d'état)
- BusinessLogicError  → 422 (règles métier non respectées)
"""
from typing import Optional


class AppException(Exception):
    """
    Classe de base pour toutes les exceptions métier.

    Attributs:
        detail: Message lisible pour le client
        status_code: Code HTTP (défaut 500)
        error_code: Code pour le client (ex: NOT_FOUND)
    """

    def __init__(
        self,
        detail: str,
        status_code: int = 500,
        error_code: Optional[str] = None,
    ):
        self.detail = detail
        self.status_code = status_code
        self.error_code = error_code
        super().__init__(self.detail)


class NotFoundError(AppException):
    """Ressource non trouvée (404). Ex. : utilisateur, magasin, objet inexistant."""

    def __init__(self, detail: str, error_code: Optional[str] = None):
        super().__init__(
            detail=detail,
            status_code=404,
            error_code=error_code or "NOT_FOUND",
        )


class ValidationError(AppException):
    """Données invalides (400). Ex. : champ requis manquant, format invalide."""

    def __init__(self, detail: str, error_code: Optional[str] = None):
        super().__init__(
            detail=detail,
            status_code=400,
            error_code=error_code or "VALIDATION_ERROR",
        )


class UnauthorizedError(AppException):
    """Non autorisé (401). Ex. : token manquant, expiré ou invalide."""

    def __init__(self, detail: str, error_code: Optional[str] = None):
        super().__init__(
            detail=detail,
            status_code=401,
            error_code=error_code or "UNAUTHORIZED",
        )


class ForbiddenError(AppException):
    """Accès interdit (403). Ex. : pas le droit d'accéder à cette ressource."""

    def __init__(self, detail: str, error_code: Optional[str] = None):
        super().__init__(
            detail=detail,
            status_code=403,
            error_code=error_code or "FORBIDDEN",
        )


class ConflictError(AppException):
    """Conflit (409). Ex. : doublon, version concurrente."""

    def __init__(self, detail: str, error_code: Optional[str] = None):
        super().__init__(
            detail=detail,
            status_code=409,
            error_code=error_code or "CONFLICT",
        )


class BusinessLogicError(AppException):
    """Règle métier non respectée (422). Ex. : essai expiré, action interdite par la logique métier."""

    def __init__(self, detail: str, error_code: Optional[str] = None):
        super().__init__(
            detail=detail,
            status_code=422,
            error_code=error_code or "BUSINESS_LOGIC_ERROR",
        )


__all__ = [
    "AppException",
    "NotFoundError",
    "ValidationError",
    "UnauthorizedError",
    "ForbiddenError",
    "ConflictError",
    "BusinessLogicError",
]
