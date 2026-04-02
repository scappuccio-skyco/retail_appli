"""
Manager - Conseils IA compatibilité manager/vendeur.
"""
from datetime import datetime, timezone
import logging

from fastapi import APIRouter, Depends, Request
from motor.motor_asyncio import AsyncIOMotorDatabase

from core.exceptions import AppException
from api.routes.manager.dependencies import get_store_context
from api.dependencies_rate_limiting import rate_limit
from api.dependencies import get_ai_service
from core.database import get_db
from services.ai_service import AIService

router = APIRouter(prefix="")
logger = logging.getLogger(__name__)


@router.post("/compatibility-advice", dependencies=[rate_limit("20/minute")])
async def generate_compatibility_advice(
    request: Request,
    body: dict,
    context: dict = Depends(get_store_context),
    ai_service: AIService = Depends(get_ai_service),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Generate personalized AI compatibility advice between a manager and a seller."""
    manager_diagnostic = body.get("manager_diagnostic") or {}
    seller_name = body.get("seller_name", "Le vendeur")
    seller_style = body.get("seller_style", "")
    seller_id = body.get("seller_id")

    # Extract manager data for the prompt
    mgr_style = manager_diagnostic.get("profil_nom") or manager_diagnostic.get("management_style", "")
    disc = manager_diagnostic.get("disc_percentages") or {}
    disc_str = f"D:{disc.get('D',0)}% / I:{disc.get('I',0)}% / S:{disc.get('S',0)}% / C:{disc.get('C',0)}%"
    disc_dom = manager_diagnostic.get("disc_dominant", "")
    force_1 = manager_diagnostic.get("force_1", "")
    force_2 = manager_diagnostic.get("force_2", "")
    axe = manager_diagnostic.get("axe_progression", "")

    system_message = (
        "Tu es un expert en management, psychologie comportementale et développement commercial. "
        "Tu génères des conseils hyper-personnalisés basés sur les profils DISC et les styles de management/vente. "
        "Tes conseils sont concrets, actionnables, bienveillants et basés sur les données réelles fournies. "
        "Tu réponds UNIQUEMENT en JSON valide, sans markdown, sans commentaire."
    )

    user_prompt = f"""Génère des conseils de collaboration personnalisés pour ce duo manager-vendeur.

PROFIL MANAGER :
- Style de management : {mgr_style}
- DISC : {disc_str} (dominant : {disc_dom})
- Force 1 : {force_1}
- Force 2 : {force_2}
- Axe de progression : {axe}

PROFIL VENDEUR :
- Nom : {seller_name}
- Style de vente : {seller_style}

Génère 4 conseils personnalisés pour le manager et 4 conseils pour le vendeur.
Les conseils doivent être spécifiquement basés sur les scores DISC du manager et le style de vente du vendeur.
Chaque conseil doit être concret, court (1-2 phrases) et directement actionnable.

Réponds UNIQUEMENT avec ce JSON (sans markdown) :
{{
  "manager": [
    "conseil 1 personnalisé pour le manager",
    "conseil 2",
    "conseil 3",
    "conseil 4"
  ],
  "seller": [
    "conseil 1 personnalisé pour {seller_name}",
    "conseil 2",
    "conseil 3",
    "conseil 4"
  ]
}}"""

    if not ai_service.available:
        raise AppException(status_code=503, message="Service IA non disponible")

    try:
        raw = await ai_service._send_message(
            system_message=system_message,
            user_prompt=user_prompt,
            model="gpt-4o",
        )
        import json as _json
        # Strip potential markdown fences
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("```")[1]
            if cleaned.startswith("json"):
                cleaned = cleaned[4:]
        advice = _json.loads(cleaned)
        result = {
            "manager": advice.get("manager", []),
            "seller": advice.get("seller", []),
            "data_used": {
                "manager_style": mgr_style,
                "disc": disc_str,
                "disc_dominant": disc_dom,
                "force_1": force_1,
                "force_2": force_2,
                "axe_progression": axe,
                "seller_style": seller_style,
            },
        }
        # Persist advice so seller can retrieve it later
        if seller_id:
            try:
                manager_id = context.get("id")
                record = {
                    "seller_id": seller_id,
                    "manager_id": manager_id,
                    "advice": result,
                    "generated_at": datetime.now(timezone.utc).isoformat(),
                }
                await db["compatibility_advices"].update_one(
                    {"seller_id": seller_id, "manager_id": manager_id},
                    {"$set": record},
                    upsert=True,
                )
            except Exception as _e:
                logger.warning("Could not persist compatibility advice: %s", _e)
        return result
    except Exception as e:
        logger.error("Error generating compatibility advice: %s", e)
        raise AppException(status_code=500, message="Erreur lors de la génération des conseils IA")
