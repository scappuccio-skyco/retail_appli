"""
Seller Diagnostic Routes
Routes for seller DISC diagnostic profile management.
Two sub-routers:
  - router (seller_router): routes mounted under the main /seller router
  - diag_router: routes mounted under the diagnostic_router (/diagnostic prefix)
"""
from fastapi import APIRouter, Depends
from typing import Dict, List, Optional, Union
from datetime import datetime, timezone
import logging

from pydantic import BaseModel, Field
from uuid import uuid4

from services.seller_service import SellerService
from api.dependencies import get_seller_service
from core.security import get_current_seller, get_current_user
from core.exceptions import ForbiddenError

# Sub-router for routes mounted under the main /seller router
router = APIRouter()

# Sub-router for routes mounted under the /diagnostic router
diag_router = APIRouter()

logger = logging.getLogger(__name__)


# ===== PYDANTIC MODEL =====

class DiagnosticCreate(BaseModel):
    responses: dict
    style: Optional[str] = None
    level: Optional[Union[str, int, float]] = None
    motivation: Optional[str] = None
    strengths: Optional[List[str]] = None
    axes_de_developpement: Optional[List[str]] = None


# ===== HELPER FUNCTIONS =====

def calculate_competence_scores_from_questionnaire(responses: dict) -> dict:
    """
    Calculate competence scores from questionnaire responses (scale 0-10, one decimal).
    Questions 1-15 are mapped to 5 competences (3 questions each).
    Barème: each option score is on 10 (e.g. former 4 -> 8, 5 -> 10).
    """
    competence_mapping = {
        'accueil': [1, 2, 3],
        'decouverte': [4, 5, 6],
        'argumentation': [7, 8, 9],
        'closing': [10, 11, 12],
        'fidelisation': [13, 14, 15]
    }
    # Barème sur 10 (une décimale). Au moins une option à 3 par question pour marge de progression (~3/10 min).
    question_scores = {
        1: [10, 3, 8],
        2: [10, 8, 6, 3],
        3: [3, 10, 8],
        4: [10, 8, 3],
        5: [10, 8, 8, 3],
        6: [10, 3, 8],
        7: [3, 10, 8],
        8: [3, 10, 8, 6],
        9: [8, 3, 10],
        10: [10, 8, 10, 3],
        11: [8, 3, 10],
        12: [10, 8, 10, 3],
        13: [3, 8, 10, 10],
        14: [8, 10, 3],
        15: [10, 3, 10, 8]
    }
    default_score = 6.0  # neutral on 0-10 scale
    scores = {
        'accueil': [],
        'decouverte': [],
        'argumentation': [],
        'closing': [],
        'fidelisation': []
    }

    for competence, question_ids in competence_mapping.items():
        for q_id in question_ids:
            q_key = str(q_id)
            if q_key in responses:
                response_value = responses[q_key]
                try:
                    option_idx = int(response_value) if not isinstance(response_value, int) else response_value
                    if q_id in question_scores and 0 <= option_idx < len(question_scores[q_id]):
                        scores[competence].append(question_scores[q_id][option_idx])
                    else:
                        scores[competence].append(default_score)
                except (ValueError, TypeError):
                    scores[competence].append(default_score)

    final_scores = {}
    for competence, score_list in scores.items():
        if score_list:
            final_scores[f'score_{competence}'] = round(sum(score_list) / len(score_list), 1)
        else:
            final_scores[f'score_{competence}'] = default_score
    return final_scores


def calculate_disc_profile(disc_responses: dict) -> dict:
    """Calculate DISC profile from questions 16-23"""
    d_score = 0
    i_score = 0
    s_score = 0
    c_score = 0

    disc_mapping = {
        '16': {'D': [0], 'I': [1], 'S': [2], 'C': [3]},
        '17': {'D': [0], 'I': [1], 'S': [2], 'C': [3]},
        '18': {'D': [0], 'I': [1], 'S': [2], 'C': [3]},
        '19': {'D': [0], 'I': [1], 'S': [2], 'C': [3]},
        '20': {'D': [0], 'I': [1], 'S': [2], 'C': [3]},
        '21': {'D': [0], 'I': [1], 'S': [2], 'C': [3]},
        '22': {'D': [0], 'I': [1], 'S': [2], 'C': [3]},
        '23': {'D': [0], 'I': [1], 'S': [2], 'C': [3]},
    }

    for q_key, response in disc_responses.items():
        if q_key in disc_mapping:
            mapping = disc_mapping[q_key]
            try:
                # Convert to int if string (e.g., "0" -> 0)
                response_int = int(response) if not isinstance(response, int) else response
                if response_int in mapping.get('D', []):
                    d_score += 1
                elif response_int in mapping.get('I', []):
                    i_score += 1
                elif response_int in mapping.get('S', []):
                    s_score += 1
                elif response_int in mapping.get('C', []):
                    c_score += 1
            except (ValueError, TypeError):
                # Skip invalid response
                pass

    total = d_score + i_score + s_score + c_score
    if total == 0:
        total = 1

    percentages = {
        'D': round(d_score / total * 100),
        'I': round(i_score / total * 100),
        'S': round(s_score / total * 100),
        'C': round(c_score / total * 100)
    }

    dominant = max(percentages, key=percentages.get)

    return {
        'dominant': dominant,
        'percentages': percentages
    }


# Helper function to create diagnostic (used by both routers)
async def _create_diagnostic_impl(
    diagnostic_data: DiagnosticCreate,
    current_user: Dict,
    seller_service: SellerService,
):
    """
    Create or update seller's DISC diagnostic profile.
    Uses AI to analyze responses and generate profile summary.
    """
    from services.ai_service import AIService
    import json

    seller_id = current_user['id']
    if isinstance(diagnostic_data.responses, list):
        responses = {}
        for item in diagnostic_data.responses:
            if isinstance(item, dict) and 'question_id' in item:
                responses[str(item['question_id'])] = str(item.get('answer', ''))
    else:
        responses = diagnostic_data.responses
    if isinstance(responses, dict):
        normalized_responses = {}
        for key, value in responses.items():
            try:
                if isinstance(value, str) and value.isdigit():
                    normalized_responses[key] = int(value)
                elif isinstance(value, (int, float)):
                    normalized_responses[key] = int(value)
                else:
                    normalized_responses[key] = value
            except (ValueError, TypeError):
                normalized_responses[key] = value
        responses = normalized_responses
    await seller_service.delete_diagnostic_by_seller(seller_id)
    competence_scores = calculate_competence_scores_from_questionnaire(responses)
    disc_responses = {k: v for k, v in responses.items() if k.isdigit() and int(k) >= 16}
    disc_profile = calculate_disc_profile(disc_responses)
    ai_service = AIService()
    ai_analysis = {
        "style": "Convivial",
        "level": "Challenger",
        "motivation": "Relation",
        "summary": "Profil en cours d'analyse."
    }

    def map_style(style_value):
        """Convert raw style (D, I, S, C) or other formats to formatted style"""
        if not style_value:
            return "Convivial"
        style_str = str(style_value).upper().strip()
        disc_to_style = {
            'D': 'Dynamique',
            'I': 'Convivial',
            'S': 'Empathique',
            'C': 'Stratège'
        }
        if style_str in disc_to_style:
            return disc_to_style[style_str]
        valid_styles = ['Convivial', 'Explorateur', 'Dynamique', 'Discret', 'Stratège', 'Empathique', 'Relationnel']
        if style_value in valid_styles:
            return style_value
        return "Convivial"

    def map_level(level_value):
        """Convert raw level (number or string) to the 4 niveaux gamifiés (aligné Guide des profils)."""
        if not level_value:
            return "Challenger"
        valid_levels = ['Nouveau Talent', 'Challenger', 'Ambassadeur', 'Maître du Jeu']
        legacy_to_gamified = {
            'Explorateur': 'Nouveau Talent',
            'Débutant': 'Nouveau Talent',
            'Intermédiaire': 'Challenger',
            'Expert terrain': 'Ambassadeur',
        }
        if isinstance(level_value, str):
            if level_value in valid_levels:
                return level_value
            if level_value in legacy_to_gamified:
                return legacy_to_gamified[level_value]
        if isinstance(level_value, (int, float)):
            if level_value >= 80:
                return "Maître du Jeu"
            elif level_value >= 60:
                return "Ambassadeur"
            elif level_value >= 40:
                return "Challenger"
            else:
                return "Nouveau Talent"
        return "Challenger"

    def map_motivation(motivation_value):
        """Convert raw motivation to formatted motivation"""
        if not motivation_value:
            return "Relation"
        motivation_str = str(motivation_value).strip()
        valid_motivations = ['Relation', 'Reconnaissance', 'Performance', 'Découverte', 'Équipe', 'Résultats', 'Dépassement', 'Apprentissage', 'Progression', 'Stabilité', 'Polyvalence', 'Contribution']
        if motivation_str in valid_motivations:
            return motivation_str
        return "Relation"

    if ai_service.available:
        try:
            responses_text = "\n".join([f"Question {k}: {v}" for k, v in responses.items()])
            prompt = f"""Voici les réponses d'un vendeur à un test comportemental :

{responses_text}

Analyse ses réponses pour identifier :
- son style de vente dominant (Convivial, Explorateur, Dynamique, Discret ou Stratège)
- son niveau global (Nouveau Talent, Challenger, Ambassadeur, Maître du Jeu)
- ses leviers de motivation (Relation, Reconnaissance, Performance, Découverte)

Rédige un retour structuré avec une phrase d'intro, deux points forts, un axe d'amélioration et une phrase motivante.

Réponds au format JSON:
{{"style": "...", "level": "...", "motivation": "...", "summary": "..."}}"""

            chat = ai_service._create_chat(
                session_id=f"diagnostic_{seller_id}",
                system_message="Tu es un expert en analyse comportementale de vendeurs retail. Focus uniquement sur le style de vente et les traits de personnalité. Ne parle jamais de marketing, réseaux sociaux ou génération de trafic.",
                model="gpt-4o-mini"
            )
            response = await ai_service._send_message(chat, prompt)
            if response:
                clean = response.strip()
                if "```json" in clean:
                    clean = clean.split("```json")[1].split("```")[0]
                elif "```" in clean:
                    clean = clean.split("```")[1].split("```")[0]
                try:
                    ai_analysis = json.loads(clean.strip())
                except Exception:
                    pass
        except Exception as e:
            logger.error("AI diagnostic error: %s", e, exc_info=True)

    strengths = diagnostic_data.dict().get('strengths') or ai_analysis.get('strengths', [])
    axes_de_developpement = diagnostic_data.dict().get('axes_de_developpement') or ai_analysis.get('axes_de_developpement', [])

    ai_summary = ai_analysis.get('summary', '')
    if ai_summary == "Profil en cours d'analyse.":
        ai_summary = ''
    if not ai_summary and (strengths or axes_de_developpement):
        summary_parts = []
        if strengths:
            summary_parts.append("💪 Tes forces :")
            for strength in strengths[:3]:
                summary_parts.append(f"• {strength}")
        if axes_de_developpement:
            summary_parts.append("\n🎯 Axes de développement :")
            for axe in axes_de_developpement[:3]:
                summary_parts.append(f"• {axe}")
        if summary_parts:
            ai_summary = "\n".join(summary_parts)

    final_style = map_style(diagnostic_data.dict().get('style') or ai_analysis.get('style', 'Convivial'))
    final_level = map_level(diagnostic_data.dict().get('level') or ai_analysis.get('level', 'Challenger'))
    final_motivation = map_motivation(diagnostic_data.dict().get('motivation') or ai_analysis.get('motivation', 'Relation'))

    diagnostic = {
        "id": str(uuid4()),
        "seller_id": seller_id,
        "responses": responses,
        "ai_profile_summary": ai_summary,
        "style": final_style,
        "level": final_level,
        "motivation": final_motivation,
        "strengths": strengths if strengths else [],
        "axes_de_developpement": axes_de_developpement if axes_de_developpement else [],
        "score_accueil": competence_scores.get('score_accueil', 6.0),
        "score_decouverte": competence_scores.get('score_decouverte', 6.0),
        "score_argumentation": competence_scores.get('score_argumentation', 6.0),
        "score_closing": competence_scores.get('score_closing', 6.0),
        "score_fidelisation": competence_scores.get('score_fidelisation', 6.0),
        "disc_dominant": disc_profile['dominant'],
        "disc_percentages": disc_profile['percentages'],
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    validation_errors = []
    if not disc_profile.get('percentages') or sum(disc_profile['percentages'].values()) == 0:
        validation_errors.append("DISC percentages are all zero")
    if all(score == 6.0 for score in [
        diagnostic['score_accueil'], diagnostic['score_decouverte'],
        diagnostic['score_argumentation'], diagnostic['score_closing'],
        diagnostic['score_fidelisation']
    ]):
        validation_errors.append("All competence scores are default (6.0)")

    if validation_errors:
        logger.warning("Diagnostic validation warnings for seller %s: %s", seller_id, validation_errors)

    await seller_service.create_diagnostic_for_seller(diagnostic)
    if '_id' in diagnostic:
        del diagnostic['_id']
    return diagnostic


# ===== ROUTES ON /seller ROUTER =====

@router.get("/diagnostic/me")
async def get_my_diagnostic(
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service),
):
    """Get seller's own DISC diagnostic profile."""
    diagnostic = await seller_service.get_diagnostic_for_seller(current_user['id'])

    if not diagnostic:
        # Return empty response instead of 404 to avoid console errors (consistent with diagnostic_router)
        return {
            "status": "not_started",
            "has_diagnostic": False,
            "message": "Diagnostic DISC non encore complété"
        }

    # Mapping functions to convert raw values to formatted values
    def map_style(style_value):
        """Convert raw style (D, I, S, C) or other formats to formatted style"""
        if not style_value:
            return "Convivial"
        style_str = str(style_value).upper().strip()
        # DISC mapping
        disc_to_style = {
            'D': 'Dynamique',
            'I': 'Convivial',
            'S': 'Empathique',
            'C': 'Stratège'
        }
        if style_str in disc_to_style:
            return disc_to_style[style_str]
        # If already formatted, return as is
        valid_styles = ['Convivial', 'Explorateur', 'Dynamique', 'Discret', 'Stratège', 'Empathique', 'Relationnel']
        if style_value in valid_styles:
            return style_value
        return "Convivial"  # Default

    def map_level(level_value):
        """Convert raw level (number or string) to the 4 niveaux gamifiés (aligné Guide des profils)."""
        if not level_value:
            return "Challenger"
        # Niveaux gamifiés = affichage frontend (GuideProfilsModal)
        valid_levels = ['Nouveau Talent', 'Challenger', 'Ambassadeur', 'Maître du Jeu']
        # Legacy: accepter anciens libellés et les normaliser
        legacy_to_gamified = {
            'Explorateur': 'Nouveau Talent',
            'Débutant': 'Nouveau Talent',
            'Intermédiaire': 'Challenger',
            'Expert terrain': 'Ambassadeur',
        }
        if isinstance(level_value, str):
            if level_value in valid_levels:
                return level_value
            if level_value in legacy_to_gamified:
                return legacy_to_gamified[level_value]
        if isinstance(level_value, (int, float)):
            if level_value >= 80:
                return "Maître du Jeu"
            elif level_value >= 60:
                return "Ambassadeur"
            elif level_value >= 40:
                return "Challenger"
            else:
                return "Nouveau Talent"
        return "Challenger"  # Default

    def map_motivation(motivation_value):
        """Convert raw motivation to formatted motivation"""
        if not motivation_value:
            return "Relation"
        motivation_str = str(motivation_value).strip()
        valid_motivations = ['Relation', 'Reconnaissance', 'Performance', 'Découverte', 'Équipe', 'Résultats', 'Dépassement', 'Apprentissage', 'Progression', 'Stabilité', 'Polyvalence', 'Contribution']
        if motivation_str in valid_motivations:
            return motivation_str
        return "Relation"  # Default

    # Format diagnostic values if needed (convert raw values to formatted)
    if diagnostic:
        # Create a copy to avoid modifying the original dict
        formatted_diagnostic = dict(diagnostic)
        formatted_diagnostic['style'] = map_style(formatted_diagnostic.get('style'))
        formatted_diagnostic['level'] = map_level(formatted_diagnostic.get('level'))

        # If motivation is missing, infer it from style or use default
        if not formatted_diagnostic.get('motivation'):
            # Infer motivation from DISC style if available
            disc_style = formatted_diagnostic.get('disc_dominant', '').upper()
            # Check the original style value BEFORE mapping (could be "S", "D", "I", "C")
            original_style = str(diagnostic.get('style', '')).upper().strip()

            if disc_style == 'D' or original_style == 'D':
                formatted_diagnostic['motivation'] = 'Performance'
            elif disc_style == 'I' or original_style == 'I':
                formatted_diagnostic['motivation'] = 'Reconnaissance'
            elif disc_style == 'S' or original_style == 'S':
                formatted_diagnostic['motivation'] = 'Relation'
            elif disc_style == 'C' or original_style == 'C':
                formatted_diagnostic['motivation'] = 'Découverte'
            else:
                formatted_diagnostic['motivation'] = map_motivation(formatted_diagnostic.get('motivation'))
        else:
            formatted_diagnostic['motivation'] = map_motivation(formatted_diagnostic.get('motivation'))

        # Generate ai_profile_summary from strengths and axes_de_developpement if missing
        if not formatted_diagnostic.get('ai_profile_summary'):
            strengths = formatted_diagnostic.get('strengths', [])
            axes = formatted_diagnostic.get('axes_de_developpement', [])

            summary_parts = []
            if strengths:
                summary_parts.append("💪 Tes forces :")
                for strength in strengths[:3]:  # Max 3 strengths
                    summary_parts.append(f"• {strength}")

            if axes:
                summary_parts.append("\n🎯 Axes de développement :")
                for axe in axes[:3]:  # Max 3 axes
                    summary_parts.append(f"• {axe}")

            if summary_parts:
                formatted_diagnostic['ai_profile_summary'] = "\n".join(summary_parts)

            diagnostic = formatted_diagnostic

        # Return with status 'completed' for frontend compatibility (consistent with diagnostic_router)
        return {
            "status": "completed",
            "has_diagnostic": True,
            "diagnostic": diagnostic  # Include the full diagnostic data
        }


@router.get("/diagnostic/me/live-scores")
async def get_my_diagnostic_live_scores(
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service),
):
    """Get seller's live competence scores (updated after debriefs)."""
    diagnostic = await seller_service.get_diagnostic_for_seller(current_user['id'])

    if not diagnostic:
        return {
            "has_diagnostic": False,
            "seller_id": current_user['id'],
            "scores": {
                "accueil": 6.0,
                "decouverte": 6.0,
                "argumentation": 6.0,
                "closing": 6.0,
                "fidelisation": 6.0
            },
            "message": "Scores par défaut (diagnostic non complété)"
        }

    return {
        "has_diagnostic": True,
        "seller_id": current_user['id'],
        "scores": {
            "accueil": diagnostic.get('score_accueil', 6.0),
            "decouverte": diagnostic.get('score_decouverte', 6.0),
            "argumentation": diagnostic.get('score_argumentation', 6.0),
            "closing": diagnostic.get('score_closing', 6.0),
            "fidelisation": diagnostic.get('score_fidelisation', 6.0)
        },
        "updated_at": diagnostic.get('updated_at', diagnostic.get('created_at'))
    }


@router.post("/diagnostic")
async def create_diagnostic_seller(
    diagnostic_data: DiagnosticCreate,
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service),
):
    """Create seller diagnostic - endpoint at /seller/diagnostic"""
    return await _create_diagnostic_impl(diagnostic_data, current_user, seller_service)


# ===== ROUTES ON /diagnostic ROUTER =====

@diag_router.get("/me")
async def get_diagnostic_me(
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service),
):
    """Get seller's own DISC diagnostic profile (at /api/diagnostic/me)."""
    diagnostic = await seller_service.get_diagnostic_for_seller(current_user['id'])
    if not diagnostic:
        return {
            "status": "not_started",
            "has_diagnostic": False,
            "message": "Diagnostic DISC non encore complété"
        }
    return {
        "status": "completed",
        "has_diagnostic": True,
        "diagnostic": diagnostic
    }


@diag_router.get("/me/live-scores")
async def get_diagnostic_live_scores(
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service),
):
    """Get seller's live competence scores (updated after debriefs)."""
    diagnostic = await seller_service.get_diagnostic_for_seller(current_user['id'])
    if not diagnostic:
        return {
            "has_diagnostic": False,
            "seller_id": current_user['id'],
            "scores": {
                "accueil": 6.0,
                "decouverte": 6.0,
                "argumentation": 6.0,
                "closing": 6.0,
                "fidelisation": 6.0
            },
            "message": "Scores par défaut (diagnostic non complété)"
        }
    return {
        "has_diagnostic": True,
        "seller_id": current_user['id'],
        "scores": {
            "accueil": diagnostic.get('score_accueil', 6.0),
            "decouverte": diagnostic.get('score_decouverte', 6.0),
            "argumentation": diagnostic.get('score_argumentation', 6.0),
            "closing": diagnostic.get('score_closing', 6.0),
            "fidelisation": diagnostic.get('score_fidelisation', 6.0)
        },
        "updated_at": diagnostic.get('updated_at', diagnostic.get('created_at'))
    }


@diag_router.get("/seller/{seller_id}")
async def get_seller_diagnostic_for_manager(
    seller_id: str,
    current_user: Dict = Depends(get_current_user),
    seller_service: SellerService = Depends(get_seller_service),
):
    """
    Get a seller's diagnostic (for manager/gérant viewing seller details)
    Endpoint: GET /api/diagnostic/seller/{seller_id}
    Accessible to managers (same store) and gérants (owner of seller's store)
    """
    user_role = current_user.get('role')
    user_id = current_user.get('id')
    if user_role not in ['manager', 'gerant', 'gérant']:
        raise ForbiddenError("Accès réservé aux managers et gérants")
    seller = await seller_service.get_seller_profile(seller_id)
    if seller and seller.get("role") != "seller":
        seller = None
    if not seller:
        return None
    seller_store_id = seller.get('store_id')
    has_access = False
    if user_role == 'manager':
        has_access = (seller_store_id == current_user.get('store_id'))
    elif user_role in ['gerant', 'gérant']:
        store = await seller_service.get_store_by_id(
            store_id=seller_store_id,
            gerant_id=user_id
        )
        if store and not store.get("active"):
            store = None
        has_access = store is not None
    if not has_access:
        raise ForbiddenError("Accès non autorisé à ce vendeur")
    diagnostic = await seller_service.get_diagnostic_for_seller(seller_id)
    return diagnostic


@diag_router.post("")
async def create_diagnostic(
    diagnostic_data: DiagnosticCreate,
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service),
):
    """Create seller diagnostic - endpoint at /diagnostic"""
    return await _create_diagnostic_impl(diagnostic_data, current_user, seller_service)


@diag_router.delete("/me")
async def delete_my_diagnostic(
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service),
):
    """Delete seller's diagnostic to allow re-taking the questionnaire."""
    deleted_count = await seller_service.delete_diagnostic_by_seller(current_user['id'])
    return {"success": True, "deleted_count": deleted_count}
