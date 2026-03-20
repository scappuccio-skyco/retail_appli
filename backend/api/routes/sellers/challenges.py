"""
Seller Challenges Routes
Routes for seller challenges and daily challenge management.
"""
from fastapi import APIRouter, Depends, Query
from typing import Dict, List
from datetime import datetime, timezone, timedelta
import logging

from services.seller_service import SellerService
from api.dependencies import get_seller_service
from core.security import get_current_seller
from core.constants import ERR_VENDEUR_SANS_MAGASIN
from core.exceptions import NotFoundError, ValidationError, ForbiddenError

router = APIRouter()
logger = logging.getLogger(__name__)


# ===== CHALLENGES =====

@router.get("/challenges")
async def get_seller_challenges(
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service)
) -> List[Dict]:
    """
    Get all challenges (collective + individual) for seller
    Returns all challenges from seller's manager
    """
    user = await seller_service.get_seller_profile(current_user["id"])
    if not user or not user.get("manager_id"):
        return []
    challenges = await seller_service.get_seller_challenges(
        current_user["id"], user["manager_id"]
    )
    return challenges


@router.get("/challenges/active")
async def get_active_seller_challenges(
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service)
) -> List[Dict]:
    """
    Get only active challenges (collective + personal) for display in seller dashboard
    Returns challenges that are:
    - Active status
    - Not yet ended (end_date >= today)
    - Visible to this seller
    """
    user = await seller_service.ensure_seller_has_manager_link(current_user["id"])
    seller_store_id = user.get("store_id") if user else None
    if not seller_store_id:
        return []
    manager_id = user.get("manager_id") if user else None
    challenges = await seller_service.get_seller_challenges_active(
        current_user["id"], manager_id
    )
    return challenges if isinstance(challenges, list) else []


@router.post("/challenges/{challenge_id}/mark-achievement-seen")
async def mark_challenge_achievement_seen(
    challenge_id: str,
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service),
):
    """
    Mark a challenge achievement notification as seen by the seller
    After this, the challenge will move to history
    """
    seller_id = current_user["id"]
    seller_store_id = current_user.get("store_id")
    if not seller_store_id:
        raise ValidationError(ERR_VENDEUR_SANS_MAGASIN)
    await seller_service.get_challenge_if_accessible(challenge_id, seller_store_id)
    await seller_service.mark_achievement_as_seen(
        seller_id,
        "challenge",
        challenge_id
    )
    return {"success": True, "message": "Notification marquée comme vue"}


@router.post("/challenges/{challenge_id}/progress")
async def update_seller_challenge_progress(
    challenge_id: str,
    progress_data: dict,
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service),
):
    """
    Update progress on a challenge (seller route with access control)

    Payload:
    {
        "value": number,  # or "current_value" for backward compatibility
        "date": "YYYY-MM-DD" (optional),
        "comment": string (optional)
    }

    Access Control:
    - Seller can only update if data_entry_responsible == "seller"
    - For individual challenges: seller_id must match current_user.id
    - For collective challenges: seller must be in visible_to_sellers or visible_to_sellers is null/[]
    - Challenge must be visible (visible == true)
    """
    seller_id = current_user['id']

    # Get seller's manager and store_id
    seller = await seller_service.get_seller_profile(
        seller_id, projection={"_id": 0, "manager_id": 1, "store_id": 1}
    )
    if not seller:
        raise NotFoundError("Vendeur non trouvé")
    seller_store_id = seller.get("store_id")
    if not seller_store_id:
        raise NotFoundError(ERR_VENDEUR_SANS_MAGASIN)
    manager_id = seller.get("manager_id")

    challenge = await seller_service.get_challenge_if_accessible(challenge_id, seller_store_id)

    # CONTROLE D'ACCÈS: Vérifier data_entry_responsible
    if challenge.get('data_entry_responsible') != 'seller':
        raise ForbiddenError("Vous n'êtes pas autorisé à mettre à jour ce challenge. Seul le manager peut le faire.")

    # CONTROLE D'ACCÈS: Vérifier visible
    if not challenge.get('visible', True):
        raise ForbiddenError("Ce challenge n'est pas visible")

    # CONTROLE D'ACCÈS: Vérifier type et seller_id/visible_to_sellers
    chall_type = challenge.get('type', 'collective')
    if chall_type == 'individual':
        # Individual: seller_id must match
        if challenge.get('seller_id') != seller_id:
            raise ForbiddenError("Vous n'êtes pas autorisé à mettre à jour ce challenge individuel")
    else:
        # Collective: check visible_to_sellers
        visible_to = challenge.get('visible_to_sellers', [])
        if visible_to and len(visible_to) > 0 and seller_id not in visible_to:
            raise ForbiddenError("Vous n'êtes pas autorisé à mettre à jour ce challenge collectif")

    # Get increment value
    increment_value = progress_data.get("value")
    if increment_value is None:
        increment_value = progress_data.get("current_value", 0)
    try:
        increment_value = float(increment_value)
    except Exception:
        increment_value = 0.0
    mode = (progress_data.get("mode") or "add").lower()
    previous_total = float(challenge.get("current_value", 0) or 0)
    new_value = increment_value if mode == "set" else previous_total + increment_value
    target_value = challenge.get('target_value', 0)
    end_date = challenge.get('end_date')

    # Recalculate progress_percentage
    progress_percentage = 0
    if target_value > 0:
        progress_percentage = round((new_value / target_value) * 100, 1)

    # Recompute status using centralized helper
    new_status = seller_service.compute_status(new_value, target_value, end_date)

    actor_name = current_user.get('name') or current_user.get('full_name') or current_user.get('email') or 'Vendeur'

    # Update challenge
    update_data = {
        "current_value": new_value,
        "progress_percentage": progress_percentage,
        "status": new_status,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": seller_id,
        "updated_by_name": actor_name
    }

    # If achieved, set completed_at
    if new_status == "achieved":
        update_data["completed_at"] = datetime.now(timezone.utc).isoformat()

    progress_entry = {
        "value": increment_value,
        "date": update_data["updated_at"],
        "updated_by": seller_id,
        "updated_by_name": actor_name,
        "role": "seller",
        "total_after": new_value
    }

    updated_challenge = await seller_service.update_challenge_progress(
        challenge_id, seller_store_id, update_data, progress_entry
    )

    if updated_challenge:
        # Check if challenge just became "achieved" (status changed)
        old_status = challenge.get('status', 'active')
        if new_status == 'achieved' and old_status != 'achieved':
            updated_challenge['just_achieved'] = True

            # Add has_unseen_achievement flag for immediate frontend use
            await seller_service.add_achievement_notification_flag(
                [updated_challenge],
                seller_id,
                'challenge'
            )
        return updated_challenge
    else:
        return {
            "success": True,
            "current_value": new_value,
            "progress_percentage": progress_percentage,
            "status": new_status,
            "updated_at": update_data["updated_at"]
        }


@router.get("/challenges/history")
async def get_seller_challenges_history(
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service)
) -> List[Dict]:
    """
    Get completed challenges (past end_date) for seller
    Returns challenges that have ended (end_date < today)
    """
    # Get seller info
    user = await seller_service.get_seller_profile(current_user["id"])

    # CRITICAL: Challenges are filtered by store_id, not manager_id
    # A seller can see challenges even without a manager_id, as long as they have a store_id
    seller_store_id = user.get('store_id') if user else None
    if not seller_store_id:
        return []

    # Use manager_id if available (for progress calculation), otherwise use None
    manager_id = user.get('manager_id') if user else None

    # Fetch history - filtered by store_id, not manager_id
    challenges = await seller_service.get_seller_challenges_history(
        current_user['id'],
        manager_id  # Can be None - only used for progress calculation
    )
    return challenges


# ===== DAILY CHALLENGE FOR SELLER =====

@router.get("/daily-challenge")
async def get_daily_challenge(
    force_competence: str = Query(None, description="Force a specific competence"),
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service),
):
    """
    Get or generate daily challenge for seller.
    Returns an uncompleted challenge for today, or generates a new one.
    """
    from uuid import uuid4

    seller_id = current_user['id']
    today = datetime.now(timezone.utc).strftime('%Y-%m-%d')

    # Check if there's an uncompleted challenge for today
    existing = await seller_service.get_daily_challenge_for_seller_date(seller_id, today)

    if existing and not existing.get('completed'):
            return existing

    # Check if there's already a completed challenge for today
    completed_today = await seller_service.get_daily_challenge_completed_today(seller_id, today)

    if completed_today:
            # Return the completed challenge instead of generating a new one
            return completed_today

    # Generate new challenge
    diagnostic = await seller_service.get_diagnostic_for_seller(seller_id)

    recent_result = await seller_service.get_daily_challenges_paginated(seller_id, 1, 5)
    recent = recent_result.items
    recent_competences = [ch.get('competence') for ch in recent if ch.get('competence')]

    # Select competence
    if force_competence and force_competence in ['accueil', 'decouverte', 'argumentation', 'closing', 'fidelisation']:
            selected_competence = force_competence
    elif not diagnostic:
            competences = ['accueil', 'decouverte', 'argumentation', 'closing', 'fidelisation']
            selected_competence = competences[datetime.now().day % len(competences)]
    else:
            # Find weakest competence not recently used
            scores = {
                'accueil': diagnostic.get('score_accueil', 6.0),
                'decouverte': diagnostic.get('score_decouverte', 6.0),
                'argumentation': diagnostic.get('score_argumentation', 6.0),
                'closing': diagnostic.get('score_closing', 6.0),
                'fidelisation': diagnostic.get('score_fidelisation', 6.0)
            }
            sorted_comps = sorted(scores.items(), key=lambda x: x[1])

            selected_competence = None
            for comp, score in sorted_comps:
                if comp not in recent_competences[:2]:
                    selected_competence = comp
                    break

            if not selected_competence:
                selected_competence = sorted_comps[0][0]

    # Static fallback templates (used when AI is unavailable)
    _fallback_templates = {
            'accueil': {
                'title': 'Accueil Excellence',
                'description': 'Accueillez chaque client avec un sourire et une phrase personnalisée dans les 10 premières secondes.',
                'pedagogical_tip': 'Un sourire authentique crée instantanément une connexion positive. Pensez à sourire avec les yeux aussi !',
                'reason': "L'accueil est la première impression que tu donnes. Un excellent accueil augmente significativement tes chances de vente."
            },
            'decouverte': {
                'title': 'Questions Magiques',
                'description': 'Posez au moins 3 questions ouvertes à chaque client pour comprendre ses besoins.',
                'pedagogical_tip': 'Utilisez des questions commençant par "Comment", "Pourquoi", "Qu\'est-ce que" pour obtenir des réponses détaillées.',
                'reason': 'Les questions ouvertes révèlent les vrais besoins du client et te permettent de mieux personnaliser ton argumentaire.'
            },
            'argumentation': {
                'title': 'Argumentaire Pro',
                'description': 'Utilisez la technique CAB (Caractéristique-Avantage-Bénéfice) pour chaque produit présenté.',
                'pedagogical_tip': 'CAB = Caractéristique (ce que c\'est) → Avantage (ce que ça fait) → Bénéfice (ce que ça apporte au client).',
                'reason': 'Un argumentaire structuré est plus convaincant et aide le client à comprendre la valeur du produit pour lui.'
            },
            'closing': {
                'title': 'Closing Master',
                'description': 'Proposez la conclusion de la vente avec une question fermée positive.',
                'pedagogical_tip': 'Exemple : "On passe en caisse ensemble ?" ou "Je vous l\'emballe ?" - Des questions qui supposent un OUI.',
                'reason': 'Le closing est souvent négligé. Une question fermée positive aide le client à passer à l\'action.'
            },
            'fidelisation': {
                'title': 'Client Fidèle',
                'description': 'Remerciez chaque client et proposez un contact ou suivi personnalisé.',
                'pedagogical_tip': 'Proposez de les ajouter à la newsletter ou de les rappeler quand un nouveau produit arrive.',
                'reason': 'Un client fidélisé revient et recommande. C\'est la clé d\'une carrière commerciale réussie.'
            }
    }

    # Build context for AI generation
    competence_scores = None
    disc_profile = {}
    if diagnostic:
        competence_scores = {
            'accueil': diagnostic.get('score_accueil', 6.0),
            'decouverte': diagnostic.get('score_decouverte', 6.0),
            'argumentation': diagnostic.get('score_argumentation', 6.0),
            'closing': diagnostic.get('score_closing', 6.0),
            'fidelisation': diagnostic.get('score_fidelisation', 6.0),
        }
        disc_profile = diagnostic.get('profile', {}) or {}

    recent_challenge_titles = [ch.get('title', '') for ch in recent if ch.get('title')]

    # Fetch recent KPIs for AI context (last 7 days)
    from datetime import timedelta as _td
    seven_days_ago = (datetime.now(timezone.utc) - _td(days=7)).strftime('%Y-%m-%d')
    try:
        kpi_page = await seller_service.get_kpis_for_period_paginated(
            seller_id, seven_days_ago, today, page=1, size=7
        )
        recent_kpis = kpi_page.items if kpi_page else []
    except Exception:
        recent_kpis = []

    # Try AI-generated challenge first, fallback to static template
    ai_service_inst = None
    ai_title = None
    ai_description = None
    try:
        from services.ai_service import AIService as _AIService
        ai_service_inst = _AIService()
        if ai_service_inst.available:
            ai_result = await ai_service_inst.generate_daily_challenge(
                seller_profile=disc_profile,
                recent_kpis=recent_kpis if isinstance(recent_kpis, list) else [],
                target_competence=selected_competence,
                competence_scores=competence_scores,
                recent_challenge_titles=recent_challenge_titles,
            )
            ai_title = ai_result.get('title')
            ai_description = ai_result.get('description')
    except Exception as _e:
        logger.warning("AI daily challenge generation failed, using template: %s", _e)

    template = _fallback_templates.get(selected_competence, _fallback_templates['accueil'])

    challenge = {
            "id": str(uuid4()),
            "seller_id": seller_id,
            "date": today,
            "competence": selected_competence,
            "title": ai_title or template['title'],
            "description": ai_description or template['description'],
            "pedagogical_tip": template['pedagogical_tip'],
            "reason": template['reason'],
            "completed": False,
            "created_at": datetime.now(timezone.utc).isoformat()
    }

    await seller_service.create_daily_challenge(challenge)
    if '_id' in challenge:
            del challenge['_id']

    return challenge


@router.post("/daily-challenge/complete")
async def complete_daily_challenge(
    data: dict,
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service),
):
    """Mark a daily challenge as completed."""
    challenge_id = data.get('challenge_id')
    result = data.get('result', 'success')  # success, partial, failed
    feedback = data.get('feedback', '')

    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    update_result = await seller_service.update_daily_challenge(
        current_user["id"],
        today_str,
        {
            "completed": True,
            "challenge_result": result,
            "feedback_comment": feedback,
            "completed_at": datetime.now(timezone.utc).isoformat(),
        },
    )
    if not update_result:
        raise NotFoundError("Challenge not found")

    return {"success": True, "message": "Challenge complété !"}


# ===== DAILY CHALLENGE STATS =====

@router.get("/daily-challenge/stats")
async def get_daily_challenge_stats(
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service),
):
    """Get statistics for seller's daily challenges."""
    seller_id = current_user['id']
    challenges_result = await seller_service.get_daily_challenges_paginated(seller_id, 1, 50)
    challenges = challenges_result.items
    total = challenges_result.total
    completed = len([c for c in challenges if c.get('completed')])
    by_competence = {}
    for c in challenges:
        comp = c.get('competence', 'unknown')
        if comp not in by_competence:
            by_competence[comp] = {'total': 0, 'completed': 0}
        by_competence[comp]['total'] += 1
        if c.get('completed'):
            by_competence[comp]['completed'] += 1
    streak = 0
    sorted_challenges = sorted(
        [c for c in challenges if c.get('completed')],
        key=lambda x: x.get('date', ''),
        reverse=True
    )
    if sorted_challenges:
        today = datetime.now(timezone.utc).date()
        for i, ch in enumerate(sorted_challenges):
            ch_date = datetime.strptime(ch.get('date', '2000-01-01'), '%Y-%m-%d').date()
            expected_date = today - timedelta(days=i)
            if ch_date == expected_date or ch_date == expected_date - timedelta(days=1):
                streak += 1
            else:
                break
    return {
        "total_challenges": total,
        "completed_challenges": completed,
        "completion_rate": round(completed / total * 100, 1) if total > 0 else 0,
        "current_streak": streak,
        "by_competence": by_competence
    }


@router.get("/daily-challenge/history")
async def get_daily_challenge_history(
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service),
):
    """Get all past daily challenges for the seller."""
    challenges_result = await seller_service.get_daily_challenges_paginated(
        current_user["id"], 1, 50
    )
    return {
        "challenges": challenges_result.items,
        "pagination": {
            "total": challenges_result.total,
            "page": challenges_result.page,
            "size": challenges_result.size,
            "pages": challenges_result.pages
        }
    }


# ===== DAILY CHALLENGE REFRESH =====

@router.post("/daily-challenge/refresh")
async def refresh_daily_challenge(
    data: dict = None,
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service),
):
    """
    Refresh/regenerate the daily challenge for the seller.
    Deletes the current uncompleted challenge and generates a new one.
    Optionally forces a specific competence.
    """
    from uuid import uuid4
    import random

    seller_id = current_user['id']
    today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    force_competence = None
    if data:
        force_competence = data.get('force_competence') or data.get('competence')
    await seller_service.delete_daily_challenges_by_filter({
        "seller_id": seller_id,
        "date": today,
        "completed": False
    })
    diagnostic = await seller_service.get_diagnostic_for_seller(seller_id)
    recent_result = await seller_service.get_daily_challenges_paginated(
        seller_id, 1, 5
    )
    recent = recent_result.items
    recent_competences = [ch.get('competence') for ch in recent if ch.get('competence')]
    if force_competence and force_competence in ['accueil', 'decouverte', 'argumentation', 'closing', 'fidelisation']:
        selected_competence = force_competence
    elif not diagnostic:
        competences = ['accueil', 'decouverte', 'argumentation', 'closing', 'fidelisation']
        available = [c for c in competences if c not in recent_competences[:2]]
        selected_competence = random.choice(available) if available else random.choice(competences)
    else:
        scores = {
            'accueil': diagnostic.get('score_accueil', 6.0),
            'decouverte': diagnostic.get('score_decouverte', 6.0),
            'argumentation': diagnostic.get('score_argumentation', 6.0),
            'closing': diagnostic.get('score_closing', 6.0),
            'fidelisation': diagnostic.get('score_fidelisation', 6.0)
        }
        sorted_comps = sorted(scores.items(), key=lambda x: x[1])
        selected_competence = None
        for comp, score in sorted_comps:
            if comp not in recent_competences[:2]:
                selected_competence = comp
                break
        if not selected_competence:
            selected_competence = sorted_comps[0][0]

    templates = {
        'accueil': [
                {'title': 'Accueil Excellence', 'description': 'Accueillez chaque client avec un sourire et une phrase personnalisée dans les 10 premières secondes.', 'pedagogical_tip': 'Un sourire authentique crée instantanément une connexion positive. Pensez à sourire avec les yeux aussi !', 'reason': "L'accueil est la première impression que tu donnes. Un excellent accueil augmente significativement tes chances de vente."},
                {'title': 'Premier Contact', 'description': 'Établissez un contact visuel et saluez chaque client qui entre en boutique.', 'pedagogical_tip': 'Le contact visuel montre que vous êtes attentif et disponible. 3 secondes suffisent !', 'reason': 'Un client qui se sent vu et accueilli est plus enclin à interagir et à rester dans le magasin.'},
                {'title': 'Ambiance Positive', 'description': "Créez une ambiance chaleureuse dès l'entrée du client avec une attitude ouverte.", 'pedagogical_tip': 'Adoptez une posture ouverte : bras décroisés, sourire, et orientation vers le client.', 'reason': "L'énergie positive est contagieuse. Une bonne ambiance met le client en confiance pour acheter."}
        ],
        'decouverte': [
                {'title': 'Questions Magiques', 'description': 'Posez au moins 3 questions ouvertes à chaque client pour comprendre ses besoins.', 'pedagogical_tip': 'Utilisez des questions commençant par "Comment", "Pourquoi", "Qu\'est-ce que" pour obtenir des réponses détaillées.', 'reason': 'Les questions ouvertes révèlent les vrais besoins du client et te permettent de mieux personnaliser ton argumentaire.'},
                {'title': 'Écoute Active', 'description': 'Reformulez les besoins du client pour montrer que vous avez bien compris.', 'pedagogical_tip': 'Exemple : "Si je comprends bien, vous cherchez..." - Cela crée de la confiance.', 'reason': 'La reformulation montre que tu écoutes vraiment et permet de clarifier les besoins.'},
                {'title': 'Détective Client', 'description': 'Identifiez le besoin caché derrière la demande initiale du client.', 'pedagogical_tip': 'Creusez avec "Et pourquoi est-ce important pour vous ?" pour découvrir la vraie motivation.', 'reason': 'Le besoin exprimé n\'est souvent que la surface. Trouver le besoin réel permet de vendre mieux.'}
            ],
            'argumentation': [
                {'title': 'Argumentaire Pro', 'description': 'Utilisez la technique CAB (Caractéristique-Avantage-Bénéfice) pour chaque produit présenté.', 'pedagogical_tip': 'CAB = Caractéristique (ce que c\'est) → Avantage (ce que ça fait) → Bénéfice (ce que ça apporte au client).', 'reason': 'Un argumentaire structuré est plus convaincant et aide le client à comprendre la valeur du produit pour lui.'},
                {'title': 'Storytelling', 'description': 'Racontez une histoire ou un cas client pour illustrer les avantages du produit.', 'pedagogical_tip': 'Exemple : "Un client comme vous a choisi ce produit et il m\'a dit que..."', 'reason': 'Les histoires créent une connexion émotionnelle et rendent les avantages plus concrets.'},
                {'title': 'Démonstration', 'description': "Faites toucher/essayer le produit à chaque client pour créer l'expérience.", 'pedagogical_tip': 'Mettez le produit dans les mains du client. Ce qui est touché est plus facilement acheté !', 'reason': 'L\'expérience sensorielle crée un attachement au produit et facilite la décision d\'achat.'}
        ],
        'closing': [
                {'title': 'Closing Master', 'description': 'Proposez la conclusion de la vente avec une question fermée positive.', 'pedagogical_tip': 'Exemple : "On passe en caisse ensemble ?" ou "Je vous l\'emballe ?" - Des questions qui supposent un OUI.', 'reason': 'Le closing est souvent négligé. Une question fermée positive aide le client à passer à l\'action.'},
                {'title': 'Alternative Gagnante', 'description': 'Proposez deux options au client plutôt qu\'une seule.', 'pedagogical_tip': 'Exemple : "Vous préférez le modèle A ou B ?" - Le client choisit, pas "si" mais "lequel".', 'reason': 'L\'alternative réduit le risque de "non" et guide le client vers une décision positive.'},
                {'title': 'Urgence Douce', 'description': "Créez un sentiment d'opportunité avec une offre limitée dans le temps.", 'pedagogical_tip': 'Exemple : "Cette promotion se termine ce week-end" - Factuel, pas agressif.', 'reason': 'Un sentiment d\'urgence légitime aide le client à ne pas procrastiner sa décision.'}
            ],
            'fidelisation': [
                {'title': 'Client Fidèle', 'description': 'Remerciez chaque client et proposez un contact ou suivi personnalisé.', 'pedagogical_tip': 'Proposez de les ajouter à la newsletter ou de les rappeler quand un nouveau produit arrive.', 'reason': 'Un client fidélisé revient et recommande. C\'est la clé d\'une carrière commerciale réussie.'},
                {'title': 'Carte VIP', 'description': "Proposez l'inscription au programme de fidélité à chaque client.", 'pedagogical_tip': 'Présentez les avantages concrets : réductions, avant-premières, cadeaux...', 'reason': 'Les programmes de fidélité augmentent le panier moyen et la fréquence de visite.'},
                {'title': 'Prochain RDV', 'description': 'Suggérez une prochaine visite avec un événement ou nouveauté à venir.', 'pedagogical_tip': 'Exemple : "On reçoit la nouvelle collection la semaine prochaine, je vous préviens ?"', 'reason': 'Créer une raison de revenir transforme un achat unique en relation durable.'}
        ]
    }
    template_list = templates.get(selected_competence, templates['accueil'])
    template = random.choice(template_list)
    challenge = {
        "id": str(uuid4()),
        "seller_id": seller_id,
        "date": today,
        "competence": selected_competence,
        "title": template['title'],
        "description": template['description'],
        "pedagogical_tip": template['pedagogical_tip'],
        "reason": template['reason'],
        "completed": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await seller_service.create_daily_challenge(challenge)
    if '_id' in challenge:
        del challenge['_id']
    return challenge
