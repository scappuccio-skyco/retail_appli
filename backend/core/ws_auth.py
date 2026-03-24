"""
Authentification WebSocket — logique isolee pour pouvoir etre importee
sans declencher api.routes.__init__ (qui charge tous les routeurs).
"""
import logging

from core.database import get_db
from core.exceptions import ForbiddenError, UnauthorizedError
from core.security import decode_token, _normalize_role
from repositories.store_repository import StoreRepository
from repositories.user_repository import UserRepository

logger = logging.getLogger(__name__)


async def _authenticate_ws(token: str, store_id: str) -> dict:
    """
    Decode le JWT, charge l'utilisateur et verifie qu'il a acces au store.
    Leve UnauthorizedError ou ForbiddenError en cas de refus.
    """
    payload = decode_token(token)
    user_id = payload.get("user_id") or payload.get("sub")
    if not user_id:
        raise UnauthorizedError("Token invalide")

    db = await get_db()
    user = await UserRepository(db).find_one(
        {"id": user_id}, {"_id": 0, "password": 0}
    )
    if not user:
        raise UnauthorizedError("Utilisateur non trouve")

    role = _normalize_role(user.get("role"))

    if role == "manager":
        if user.get("store_id") != store_id:
            raise ForbiddenError("Ce store ne vous est pas assigne")
        return user

    if role == "gerant":
        store = await StoreRepository(db).find_one(
            {"id": store_id, "gerant_id": user_id, "active": True},
            {"_id": 0, "id": 1},
        )
        if not store:
            raise ForbiddenError("Ce store ne vous appartient pas")
        return user

    raise ForbiddenError("Acces reserve aux managers et gerants")
