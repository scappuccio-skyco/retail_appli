"""
Demo Routes — connexion sans mot de passe pour l'espace démo public.

POST /demo/login?role=gerant|manager|seller
Retourne un JWT court (2h) avec is_demo=True et set le cookie httpOnly.
"""
import logging
from fastapi import APIRouter, Query, Response

from core.database import get_db
from core.security import create_token
from core.config import settings
from core.exceptions import NotFoundError, ValidationError
from api.dependencies_rate_limiting import rate_limit

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/demo", tags=["Demo"])

# Emails fixes des comptes démo (créés par le script scripts/seed_demo.py)
_DEMO_EMAILS = {
    "gerant": "demo-gerant@demo.retailperformerai.com",
    "manager": "demo-manager@demo.retailperformerai.com",
    "seller": "demo-seller-thomas@demo.retailperformerai.com",
}


@router.post("/login", dependencies=[rate_limit("20/minute")])
async def demo_login(
    response: Response,
    role: str = Query(..., description="gerant | manager | seller"),
):
    """
    Connexion à l'espace démo en lecture seule.
    Retourne un JWT valide 2h avec is_demo=True.
    """
    if role not in _DEMO_EMAILS:
        raise ValidationError("Rôle invalide. Valeurs acceptées : gerant, manager, seller")

    db = await get_db()
    email = _DEMO_EMAILS[role]
    user = await db["users"].find_one({"email": email}, {"_id": 0, "password": 0})

    if not user:
        raise NotFoundError(
            "Les données de démonstration ne sont pas encore initialisées. "
            "Veuillez contacter l'administrateur."
        )

    token = create_token(
        user_id=user["id"],
        email=user["email"],
        role=user["role"],
        is_demo=True,
        expiry_hours=2,
    )

    is_production = settings.ENVIRONMENT == "production"
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=is_production,
        samesite="none" if is_production else "lax",
        max_age=7200,  # 2h
        path="/",
    )

    # Ajoute le flag is_demo sur l'objet retourné (pour le frontend)
    user["is_demo"] = True
    return {"token": token, "user": user}
