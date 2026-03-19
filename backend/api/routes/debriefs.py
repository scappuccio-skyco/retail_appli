"""
Debriefs Routes. Phase 0 Vague 2: services only (no db, no Repository(db)).
"""
import logging
from fastapi import APIRouter, Depends, Query
from typing import Dict, List, Optional
from datetime import datetime, timezone
from uuid import uuid4

from core.exceptions import ForbiddenError, BusinessLogicError, NotFoundError
from models.sales import DebriefCreate

# Dampening factor: the AI's suggested delta is multiplied by this value before
# being applied to the running score. Keeps individual debriefs from causing
# wild swings (max effective change = delta_max * SMOOTHING per debrief).
_SCORE_SMOOTHING = 0.4
_SCORE_MIN = 1.0
_SCORE_MAX = 10.0
# Allowed delta ranges to guard against out-of-range AI responses
_SUCCESS_DELTA_RANGE = (-0.1, 0.8)
_FAILURE_DELTA_RANGE = (-0.5, 0.2)


def _apply_delta(current: float, delta: float, is_success: bool) -> float:
    """Clamp delta to safe range, apply smoothing, return rounded score."""
    lo, hi = _SUCCESS_DELTA_RANGE if is_success else _FAILURE_DELTA_RANGE
    clamped = max(lo, min(hi, delta))
    new_val = current + clamped * _SCORE_SMOOTHING
    return round(max(_SCORE_MIN, min(_SCORE_MAX, new_val)), 1)
from core.security import get_current_user, require_active_space
from api.dependencies import get_ai_service, get_seller_service
from services.ai_service import AIService
from services.seller_service import SellerService

logger = logging.getLogger(__name__)

router = APIRouter(
    tags=["Debriefs"],
    dependencies=[Depends(require_active_space)]
)


# ===== DEBRIEFS ROUTES =====

@router.post("/debriefs")
async def create_debrief(
    debrief_data: DebriefCreate,
    current_user: Dict = Depends(get_current_user),
    ai_service: AIService = Depends(get_ai_service),
    seller_service: SellerService = Depends(get_seller_service),
):
    """
    Create a new debrief (post-sale analysis). Phase 0 Vague 2: SellerService only (no db).
    """
    if current_user['role'] != 'seller':
        raise ForbiddenError("Only sellers can create debriefs")
    seller_id = current_user['id']
    diagnostic = await seller_service.get_diagnostic_for_seller(seller_id)
    current_scores = {
        'accueil': diagnostic.get('score_accueil', 6.0) if diagnostic else 6.0,
        'decouverte': diagnostic.get('score_decouverte', 6.0) if diagnostic else 6.0,
        'argumentation': diagnostic.get('score_argumentation', 6.0) if diagnostic else 6.0,
        'closing': diagnostic.get('score_closing', 6.0) if diagnostic else 6.0,
        'fidelisation': diagnostic.get('score_fidelisation', 6.0) if diagnostic else 6.0
    }
    disc_style = ""
    if diagnostic:
        disc_style = (diagnostic.get('profile') or {}).get('style', '') or ''
    today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    today_kpi = await seller_service.get_kpi_entry_for_seller_date(seller_id, today)
    kpi_benchmark = ""
    try:
        from datetime import timedelta as _td
        seven_days_ago = (datetime.now(timezone.utc) - _td(days=7)).strftime('%Y-%m-%d')
        week_metrics = await seller_service.get_seller_kpi_metrics(seller_id, seven_days_ago, today)
        nb_jours_w = week_metrics.get('nb_jours', 0)
        if nb_jours_w > 1:
            avg_ca_week = week_metrics.get('ca', 0) / nb_jours_w
            kpi_benchmark = f" (moyenne 7j : {avg_ca_week:.0f}€/j)"
    except Exception:
        pass
    kpi_context = ""
    if today_kpi:
        kpi_context = f"\n\nKPIs du jour: CA {today_kpi.get('ca_journalier', 0):.0f}€{kpi_benchmark}, {today_kpi.get('nb_ventes', 0)} ventes"
    new_scores = current_scores.copy()
    ai_analyse = ""
    ai_points_travailler = ""
    ai_recommandation = ""
    ai_exemple_concret = ""
    ai_action_immediate = ""
    previous_coaching = []
    try:
        prev_debriefs = await seller_service.get_debriefs_by_seller(
            seller_id,
            projection={"_id": 0, "ai_recommandation": 1, "ai_action_immediate": 1, "vente_conclue": 1, "date": 1, "moment_perte_client": 1},
            limit=3,
            sort=[("created_at", -1)],
        )
        previous_coaching = [
            {
                "date": d.get("date", ""),
                "recommendation": d.get("ai_recommandation", ""),
                "action_immediate": d.get("ai_action_immediate", ""),
                "moment_blocage": d.get("moment_perte_client", ""),
                "was_success": d.get("vente_conclue", False),
            }
            for d in prev_debriefs
            if d.get("ai_recommandation")
        ]
    except Exception as _e:
        logger.warning("Could not fetch previous debriefs for feedback loop: %s", _e)

    if ai_service.available:
        try:
            feedback_result = await ai_service.generate_debrief(
                debrief_data=debrief_data.dict(),
                current_scores=current_scores,
                kpi_context=kpi_context,
                is_success=debrief_data.vente_conclue,
                previous_coaching=previous_coaching,
                disc_style=disc_style,
            )
            if feedback_result:
                ai_analyse = feedback_result.get('analyse', '')
                ai_points_travailler = feedback_result.get('points_travailler', '')
                ai_recommandation = feedback_result.get('recommandation', '')
                ai_exemple_concret = feedback_result.get('exemple_concret', '')
                ai_action_immediate = feedback_result.get('action_immediate', '')
                is_success = debrief_data.vente_conclue
                new_scores = {
                    k: _apply_delta(
                        current_scores[k],
                        feedback_result.get(f'delta_{k}', 0.0),
                        is_success,
                    )
                    for k in ('accueil', 'decouverte', 'argumentation', 'closing', 'fidelisation')
                }
        except Exception as e:
            logger.error("AI debrief error: %s", e, exc_info=True)
    debrief = {
        "id": str(uuid4()),
        "seller_id": seller_id,
        "vente_conclue": debrief_data.vente_conclue,
        "produit": debrief_data.produit,
        "type_client": debrief_data.type_client,
        "situation_vente": debrief_data.situation_vente,
        "description_vente": debrief_data.description_vente,
        "moment_perte_client": debrief_data.moment_perte_client,
        "raisons_echec": debrief_data.raisons_echec,
        "amelioration_pensee": debrief_data.amelioration_pensee,
        "ai_analyse": ai_analyse,
        "ai_points_travailler": ai_points_travailler,
        "ai_recommandation": ai_recommandation,
        "ai_exemple_concret": ai_exemple_concret,
        "ai_action_immediate": ai_action_immediate,
        "score_accueil": new_scores.get('accueil', current_scores['accueil']),
        "score_decouverte": new_scores.get('decouverte', current_scores['decouverte']),
        "score_argumentation": new_scores.get('argumentation', current_scores['argumentation']),
        "score_closing": new_scores.get('closing', current_scores['closing']),
        "score_fidelisation": new_scores.get('fidelisation', current_scores['fidelisation']),
        "shared_with_manager": debrief_data.shared_with_manager,
        "date": today,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    try:
        await seller_service.create_debrief(debrief, seller_id)
    except ValueError as e:
        raise BusinessLogicError(str(e))
    if new_scores != current_scores:
        await seller_service.update_diagnostic_scores_by_seller(seller_id, new_scores)
    if '_id' in debrief:
        del debrief['_id']
    return debrief


@router.get("/debriefs")
async def get_debriefs(
    current_user: Dict = Depends(get_current_user),
    seller_service: SellerService = Depends(get_seller_service),
):
    """Get debriefs for current user. Phase 0 Vague 2: SellerService only (no db)."""
    if current_user['role'] == 'seller':
        debriefs = await seller_service.get_debriefs_by_seller(
            seller_id=current_user['id'],
            projection={"_id": 0},
            limit=100,
            sort=[("created_at", -1)],
        )
    else:
        store_id = current_user.get('store_id')
        if store_id:
            sellers = await seller_service.get_users_by_store_and_role(
                store_id=store_id,
                role="seller",
                projection={"_id": 0, "id": 1},
                limit=100,
            )
            seller_ids = [s['id'] for s in sellers]
            debriefs = await seller_service.get_debriefs_by_store(
                store_id=store_id,
                seller_ids=seller_ids,
                visible_to_manager=True,
                projection={"_id": 0},
                limit=100,
                sort=[("created_at", -1)],
            )
        else:
            debriefs = []
    
    return debriefs


@router.patch("/debriefs/{debrief_id}/visibility")
async def toggle_debrief_visibility(
    debrief_id: str,
    data: dict,
    current_user: Dict = Depends(get_current_user),
    seller_service: SellerService = Depends(get_seller_service),
):
    """Toggle whether a debrief is shared with the manager. Phase 0 Vague 2: SellerService only."""
    shared = data.get('shared_with_manager', data.get('visible_to_manager', False))
    result = await seller_service.update_debrief(
        debrief_id=debrief_id,
        update_data={"shared_with_manager": shared},
        seller_id=current_user['id'],
    )
    if not result:
        raise NotFoundError("Debrief not found")
    return {"success": True, "shared_with_manager": shared}


@router.delete("/debriefs/{debrief_id}")
async def delete_debrief(
    debrief_id: str,
    current_user: Dict = Depends(get_current_user),
    seller_service: SellerService = Depends(get_seller_service),
):
    """Delete a debrief. Phase 0 Vague 2: SellerService only (no db)."""
    result = await seller_service.delete_debrief(
        debrief_id=debrief_id,
        seller_id=current_user['id'],
    )
    
    if not result:
        raise NotFoundError("Debrief not found")
    
    return {"success": True}
