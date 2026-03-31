"""
Middleware : bloc en lecture seule pour les sessions de démonstration.

Si le JWT contient `is_demo: True`, toute requête d'écriture
(POST / PUT / PATCH / DELETE) retourne 403 sauf les routes d'auth.
"""
import logging
from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)

_WRITE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}

# Routes qui doivent rester accessibles même en mode démo
_DEMO_PASSTHROUGH = {
    "/api/auth/logout",
    "/api/auth/me",
    "/api/demo/login",
}


def _extract_token(request: Request) -> str | None:
    """Extrait le JWT depuis le header Authorization ou le cookie httpOnly."""
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth[7:]
    return request.cookies.get("access_token")


class DemoReadOnlyMiddleware(BaseHTTPMiddleware):
    """Bloque les écritures pour les tokens demo (is_demo=True dans le payload JWT)."""

    async def dispatch(self, request: Request, call_next):
        # Passe-droit : méthodes de lecture et routes autorisées
        if request.method not in _WRITE_METHODS:
            return await call_next(request)

        path = request.url.path
        if path in _DEMO_PASSTHROUGH:
            return await call_next(request)

        # Vérifie le flag is_demo dans le JWT (sans appel DB)
        token = _extract_token(request)
        if token:
            try:
                from core.security import decode_token
                payload = decode_token(token)
                if payload.get("is_demo"):
                    return JSONResponse(
                        status_code=403,
                        content={
                            "detail": "Mode démo — action non disponible. Créez un compte pour accéder à toutes les fonctionnalités.",
                            "error_code": "DEMO_READ_ONLY",
                        },
                    )
            except Exception:
                pass  # Token invalide ou expiré → géré par les dépendances d'auth

        return await call_next(request)
