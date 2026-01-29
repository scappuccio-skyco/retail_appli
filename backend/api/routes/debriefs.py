"""
Debriefs Routes. Phase 0 Vague 2: services only (no db, no Repository(db)).
"""
import logging
from fastapi import APIRouter, Depends, Query
from typing import Dict, List, Optional
from datetime import datetime, timezone
from uuid import uuid4
from pydantic import BaseModel

from core.exceptions import ForbiddenError, BusinessLogicError, NotFoundError
from core.security import get_current_user, require_active_space
from api.dependencies import get_ai_service, get_seller_service
from services.ai_service import AIService
from services.seller_service import SellerService

logger = logging.getLogger(__name__)

router = APIRouter(
    tags=["Debriefs"],
    dependencies=[Depends(require_active_space)]
)


# ===== PYDANTIC MODELS =====

class DebriefCreate(BaseModel):
    vente_conclue: bool = True
    produit: Optional[str] = ""
    type_client: Optional[str] = ""
    situation_vente: Optional[str] = ""
    description_vente: Optional[str] = ""
    moment_perte_client: Optional[str] = ""
    raisons_echec: Optional[str] = ""
    amelioration_pensee: Optional[str] = ""


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
        'accueil': diagnostic.get('score_accueil', 3.0) if diagnostic else 3.0,
        'decouverte': diagnostic.get('score_decouverte', 3.0) if diagnostic else 3.0,
        'argumentation': diagnostic.get('score_argumentation', 3.0) if diagnostic else 3.0,
        'closing': diagnostic.get('score_closing', 3.0) if diagnostic else 3.0,
        'fidelisation': diagnostic.get('score_fidelisation', 3.0) if diagnostic else 3.0
    }
    today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    today_kpi = await seller_service.get_kpi_entry_for_seller_date(seller_id, today)
    kpi_context = ""
    if today_kpi:
        kpi_context = f"\n\nKPIs du jour: CA {today_kpi.get('ca_journalier', 0):.0f}€, {today_kpi.get('nb_ventes', 0)} ventes"
    new_scores = current_scores.copy()
    ai_analyse = ""
    ai_points_travailler = ""
    ai_recommandation = ""
    ai_exemple_concret = ""
    if ai_service.available:
        try:
            feedback_result = await ai_service.generate_debrief(
                debrief_data=debrief_data.dict(),
                current_scores=current_scores,
                kpi_context=kpi_context,
                is_success=debrief_data.vente_conclue
            )
            if feedback_result:
                ai_analyse = feedback_result.get('analyse', '')
                ai_points_travailler = feedback_result.get('points_travailler', '')
                ai_recommandation = feedback_result.get('recommandation', '')
                ai_exemple_concret = feedback_result.get('exemple_concret', '')
                new_scores = {
                    'accueil': feedback_result.get('score_accueil', current_scores['accueil']),
                    'decouverte': feedback_result.get('score_decouverte', current_scores['decouverte']),
                    'argumentation': feedback_result.get('score_argumentation', current_scores['argumentation']),
                    'closing': feedback_result.get('score_closing', current_scores['closing']),
                    'fidelisation': feedback_result.get('score_fidelisation', current_scores['fidelisation'])
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
        "score_accueil": new_scores.get('accueil', current_scores['accueil']),
        "score_decouverte": new_scores.get('decouverte', current_scores['decouverte']),
        "score_argumentation": new_scores.get('argumentation', current_scores['argumentation']),
        "score_closing": new_scores.get('closing', current_scores['closing']),
        "score_fidelisation": new_scores.get('fidelisation', current_scores['fidelisation']),
        "shared_with_manager": False,
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
    if 'shared_with_manager' in debrief:
        debrief['visible_to_manager'] = debrief['shared_with_manager']
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
    
    # Add visible_to_manager alias for frontend compatibility
    for debrief in debriefs:
        if 'shared_with_manager' in debrief:
            debrief['visible_to_manager'] = debrief['shared_with_manager']
    
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
    return {"success": True, "shared_with_manager": shared, "visible_to_manager": shared}


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
