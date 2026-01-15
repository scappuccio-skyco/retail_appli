"""
Diagnostic Routes
Manager DISC diagnostic profiles
"""
import json
from uuid import uuid4
from datetime import datetime, timezone
from typing import Dict, Any
from pydantic import BaseModel

from fastapi import APIRouter, Depends, HTTPException

from fastapi import Request

from core.security import get_current_user, require_active_space
from services.manager_service import DiagnosticService
from api.dependencies import get_diagnostic_service, get_db
from services.ai_service import AIService
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
        print(f"Error in AI analysis: {str(e)}")
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


@router.post("")
async def create_manager_diagnostic(
    diagnostic_data: ManagerDiagnosticCreate,
    current_user: dict = Depends(verify_manager_or_gerant),
    db = Depends(get_db)
):
    """
    Create or update manager DISC diagnostic profile
    
    Analyzes responses with AI to determine management style
    """
    try:
        # Check if diagnostic already exists - if yes, delete it to allow update
        existing = await db.manager_diagnostics.find_one(
            {"manager_id": current_user['id']},
            {"_id": 0}
        )
        if existing:
            await db.manager_diagnostics.delete_one({"manager_id": current_user['id']})
        
        # Analyze with AI
        ai_analysis = await analyze_manager_diagnostic_with_ai(diagnostic_data.responses)
        
        # Create diagnostic document
        diagnostic_doc = {
            "id": str(uuid4()),
            "manager_id": current_user['id'],
            "responses": diagnostic_data.responses,
            "profil_nom": ai_analysis.get('profil_nom', 'Le Coach'),
            "profil_description": ai_analysis.get('profil_description', ''),
            "force_1": ai_analysis.get('force_1', ''),
            "force_2": ai_analysis.get('force_2', ''),
            "axe_progression": ai_analysis.get('axe_progression', ''),
            "recommandation": ai_analysis.get('recommandation', ''),
            "exemple_concret": ai_analysis.get('exemple_concret', ''),
            "completed": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.manager_diagnostics.insert_one(diagnostic_doc)
        
        # Remove _id before returning
        diagnostic_doc.pop('_id', None)
        
        # Return in format expected by frontend
        return {
            "status": "completed",
            "diagnostic": diagnostic_doc
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating diagnostic: {str(e)}")


@router.get("/me")
async def get_my_diagnostic(
    current_user: dict = Depends(verify_manager_or_gerant),
    db = Depends(get_db)
):
    """
    Get current user's DISC diagnostic profile
    
    Returns manager's/gérant's personality profile (DISC method)
    """
    try:
        diagnostic = await db.manager_diagnostics.find_one(
            {"manager_id": current_user['id']},
            {"_id": 0}
        )
        
        if not diagnostic:
            return {
                "status": "not_completed",
                "manager_id": current_user['id'],
                "completed": False,
                "message": "Diagnostic not completed yet"
            }
        
        return {
            "status": "completed",
            "diagnostic": diagnostic
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.get("/seller/{seller_id}")
async def get_seller_diagnostic_for_manager(
    seller_id: str,
    request: Request,
    context: dict = Depends(get_store_context),
    db = Depends(get_db)
):
    """
    Get a seller's diagnostic (for manager/gérant viewing seller details)
    """
    try:
        resolved_store_id = context.get('resolved_store_id')
        current_user = context
        
        # Verify seller exists and belongs to the store
        seller = await db.users.find_one({"id": seller_id, "role": "seller"}, {"_id": 0})
        if not seller:
            return None
        
        # Verify seller belongs to the resolved store_id
        if resolved_store_id and seller.get('store_id') != resolved_store_id:
            raise HTTPException(status_code=404, detail="Vendeur non trouvé ou n'appartient pas à ce magasin")
        
        diagnostic = await db.diagnostics.find_one({"seller_id": seller_id}, {"_id": 0})
        
        if not diagnostic:
            return None
        
        return diagnostic
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
