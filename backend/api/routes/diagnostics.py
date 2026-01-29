"""
Diagnostic Routes - Manager DISC diagnostic profiles.
Phase 10 RC6: No direct db access - DiagnosticRepository, ManagerDiagnosticRepository, UserRepository.
"""
import json
import logging
from uuid import uuid4
from datetime import datetime, timezone
from typing import Dict, Any
from pydantic import BaseModel

from fastapi import APIRouter, Depends, Request

logger = logging.getLogger(__name__)

from api.dependencies_rate_limiting import rate_limit
from core.exceptions import NotFoundError
from core.security import require_active_space
from api.dependencies import get_diagnostic_service, get_seller_service
from services.ai_service import AIService
from services.manager_service import DiagnosticService
from services.seller_service import SellerService
from api.routes.manager import get_store_context, verify_manager_or_gerant

router = APIRouter(
    prefix="/manager-diagnostic",
    tags=["Diagnostics"],
    dependencies=[Depends(require_active_space)]
)


class ManagerDiagnosticCreate(BaseModel):
    """Input model for creating manager diagnostic"""
    responses: Dict[str, Any]


async def analyze_manager_diagnostic_with_ai(responses: dict) -> dict:
    """Analyze manager diagnostic responses with AI"""
    ai_service = AIService()
    
    if not ai_service.available:
        # Fallback default response
        return {
            "profil_nom": "Le Coach",
            "profil_description": "Tu es un manager proche de ton équipe, à l'écoute et orienté développement. Tu valorises la progression individuelle avant tout.",
            "force_1": "Crée un climat de confiance fort",
            "force_2": "Encourage la montée en compétence",
            "axe_progression": "Gagner en fermeté sur le suivi des objectifs pour équilibrer empathie et performance.",
            "recommandation": "Lors de ton prochain brief, termine toujours par un objectif chiffré clair.",
            "exemple_concret": "\"Super énergie ce matin ! Notre but du jour : 15 ventes à 200 € de panier moyen — on y va ensemble 💪\""
        }
    
    try:
        # Format responses for prompt
        responses_text = ""
        for q_num, answer in responses.items():
            responses_text += f"\nQuestion {q_num}: {answer}\n"
        
        prompt = f"""Analyse les réponses de ce questionnaire pour déterminer le profil de management dominant.

Voici les réponses :
{responses_text}

Classe ce manager parmi les 5 profils suivants :
1️⃣ Le Pilote — orienté résultats, aime les chiffres, la clarté et les plans d'action.
2️⃣ Le Coach — bienveillant, à l'écoute, accompagne individuellement.
3️⃣ Le Dynamiseur — motivant, charismatique, met de l'énergie dans l'équipe.
4️⃣ Le Stratège — structuré, process, rigoureux et méthodique.
5️⃣ L'Inspire — empathique, donne du sens et fédère autour d'une vision.

Réponds UNIQUEMENT au format JSON suivant (sans markdown, sans ```json) :
{{
  "profil_nom": "Le Pilote/Le Coach/Le Dynamiseur/Le Stratège/L'Inspire",
  "profil_description": "2 phrases synthétiques pour décrire ce style",
  "force_1": "Premier point fort concret",
  "force_2": "Deuxième point fort concret",
  "axe_progression": "1 domaine clé à renforcer",
  "recommandation": "1 conseil personnalisé pour développer son management",
  "exemple_concret": "Une phrase ou un comportement à adopter lors d'un brief, coaching ou feedback"
}}

Ton style doit être positif, professionnel et orienté action. Pas de jargon RH. Mise en pratique et impact terrain. Tout en tutoiement."""

        chat = ai_service._create_chat(
            session_id=f"manager_diagnostic_{uuid4()}",
            system_message="Tu es un coach IA expert en management retail et en accompagnement d'équipes commerciales. Réponds UNIQUEMENT en JSON valide.",
            model="gpt-4o-mini"
        )
        
        response = await ai_service._send_message(chat, prompt)
        
        # Clean and parse response
        content = response.strip()
        if content.startswith('```'):
            content = content.split('```')[1]
            if content.startswith('json'):
                content = content[4:]
        content = content.strip()
        
        result = json.loads(content)
        return result
        
    except Exception as e:
        logger.error("Error in AI analysis: %s", e, exc_info=True)
        # Fallback default response
        return {
            "profil_nom": "Le Coach",
            "profil_description": "Tu es un manager proche de ton équipe, à l'écoute et orienté développement.",
            "force_1": "Crée un climat de confiance fort",
            "force_2": "Encourage la montée en compétence",
            "axe_progression": "Gagner en fermeté sur le suivi des objectifs.",
            "recommandation": "Lors de ton prochain brief, termine toujours par un objectif chiffré clair.",
            "exemple_concret": "\"Notre but du jour : 15 ventes à 200 € de panier moyen — on y va ensemble 💪\""
        }


@router.post("", dependencies=[rate_limit("5/minute")])
async def create_manager_diagnostic(
    diagnostic_data: ManagerDiagnosticCreate,
    current_user: dict = Depends(verify_manager_or_gerant),
    diagnostic_service: DiagnosticService = Depends(get_diagnostic_service),
):
    """
    Create or update manager DISC diagnostic profile.
    Phase 0 Vague 2: Uses DiagnosticService (no db, no Repository(db)).
    """
    existing = await diagnostic_service.get_latest_manager_diagnostic(current_user["id"])
    if existing:
        await diagnostic_service.delete_manager_diagnostic_by_manager(current_user["id"])
    ai_analysis = await analyze_manager_diagnostic_with_ai(diagnostic_data.responses)
    diagnostic_doc = {
        "id": str(uuid4()),
        "manager_id": current_user["id"],
        "responses": diagnostic_data.responses,
        "profil_nom": ai_analysis.get("profil_nom", "Le Coach"),
        "profil_description": ai_analysis.get("profil_description", ""),
        "force_1": ai_analysis.get("force_1", ""),
        "force_2": ai_analysis.get("force_2", ""),
        "axe_progression": ai_analysis.get("axe_progression", ""),
        "recommandation": ai_analysis.get("recommandation", ""),
        "exemple_concret": ai_analysis.get("exemple_concret", ""),
        "completed": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await diagnostic_service.create_manager_diagnostic(diagnostic_doc, current_user["id"])
    diagnostic_doc.pop("_id", None)
    return {"status": "completed", "diagnostic": diagnostic_doc}


@router.get("/me")
async def get_my_diagnostic(
    current_user: dict = Depends(verify_manager_or_gerant),
    diagnostic_service: DiagnosticService = Depends(get_diagnostic_service),
):
    """
    Get current user's DISC diagnostic profile. Phase 0 Vague 2: DiagnosticService only.
    """
    diagnostic = await diagnostic_service.get_latest_manager_diagnostic(
        current_user["id"], projection={"_id": 0}
    )
    if not diagnostic:
        return {
            "status": "not_completed",
            "manager_id": current_user["id"],
            "completed": False,
            "message": "Diagnostic not completed yet",
        }
    return {"status": "completed", "diagnostic": diagnostic}



@router.get("/seller/{seller_id}")
async def get_seller_diagnostic_for_manager(
    seller_id: str,
    request: Request,
    context: dict = Depends(get_store_context),
    seller_service: SellerService = Depends(get_seller_service),
):
    """
    Get a seller's diagnostic. Phase 0 Vague 2: SellerService only (no db).
    """
    resolved_store_id = context.get("resolved_store_id")

    seller = await seller_service.get_user_by_id_and_role(
        seller_id, "seller", projection={"_id": 0}
    )
    if not seller:
        return None
    if resolved_store_id and seller.get("store_id") != resolved_store_id:
        raise NotFoundError("Vendeur non trouvé ou n'appartient pas à ce magasin")

    diagnostic = await seller_service.get_diagnostic_for_seller(seller_id)
    if not diagnostic:
        return None
    return diagnostic
