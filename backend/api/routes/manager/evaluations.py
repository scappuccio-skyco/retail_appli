"""
Manager - Evaluations: diagnostics vendeur, debriefs, historique compétences, conseil relationnel, résolution conflits.
"""
import logging
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from core.exceptions import AppException, NotFoundError, ValidationError
from api.routes.manager.dependencies import get_store_context, get_verified_seller
from api.dependencies import get_manager_service, get_relationship_service, get_conflict_service
from core.security import verify_seller_store_access
from services.manager_service import ManagerService
from services.relationship_service import RelationshipService
from services.conflict_service import ConflictService

router = APIRouter(prefix="")
logger = logging.getLogger(__name__)


# ----- Pydantic models for request bodies -----

class RelationshipAdviceRequest(BaseModel):
    seller_id: str
    advice_type: str  # "relationnel" or "conflit"
    situation_type: str  # "augmentation", "conflit_equipe", "demotivation", etc.
    description: str


class ConflictResolutionRequest(BaseModel):
    seller_id: str
    contexte: str
    comportement_observe: str
    impact: str
    tentatives_precedentes: str
    description_libre: str


# ----- Seller diagnostic (manager view) -----

@router.get("/seller/{seller_id}/diagnostic")
async def get_seller_diagnostic(
    seller_id: str,
    store_id: Optional[str] = Query(None, description="Store ID (requis pour gérant)"),
    context: dict = Depends(get_store_context),
    manager_service: ManagerService = Depends(get_manager_service),
):
    """Get DISC diagnostic profile for a specific seller."""
    try:
        resolved_store_id = context.get("resolved_store_id")
        if not resolved_store_id:
            raise ValidationError("store_id requis")
        seller = await verify_seller_store_access(
            seller_id=seller_id,
            user_store_id=resolved_store_id,
            user_role=context.get("role"),
            user_id=context.get("id"),
            manager_service=manager_service,
        )
        diagnostic = await manager_service.get_diagnostic_by_seller(seller_id)
        if not diagnostic:
            return {
                "seller_id": seller_id,
                "seller_name": seller.get("name", "Unknown"),
                "has_diagnostic": False,
                "style": "Non défini",
                "level": 0,
                "strengths": [],
                "weaknesses": [],
                "recommendations": [],
            }
        return {
            "seller_id": seller_id,
            "seller_name": seller.get("name", "Unknown"),
            "has_diagnostic": True,
            **diagnostic,
        }
    except AppException:
        raise


# ----- Debriefs & competences history -----

@router.get("/debriefs/{seller_id}")
async def get_seller_debriefs(
    page: int = 1,
    size: int = 50,
    seller: dict = Depends(get_verified_seller),
    manager_service: ManagerService = Depends(get_manager_service),
):
    """Get paginated debriefs for a specific seller. Access verified via get_verified_seller."""
    seller_id = seller.get("id")
    result = await manager_service.get_debriefs_by_seller_paginated(
        seller_id, page=page, size=size
    )
    return {
        "debriefs": result.items,
        "pagination": {
            "total": result.total,
            "page": result.page,
            "size": result.size,
            "pages": result.pages,
        },
    }


def _history_item(debrief_or_diagnostic: dict, item_type: str) -> dict:
    """Build a single competences-history item from diagnostic or debrief."""
    return {
        "type": item_type,
        "date": debrief_or_diagnostic.get("created_at"),
        "score_accueil": debrief_or_diagnostic.get("score_accueil", 3.0),
        "score_decouverte": debrief_or_diagnostic.get("score_decouverte", 3.0),
        "score_argumentation": debrief_or_diagnostic.get("score_argumentation", 3.0),
        "score_closing": debrief_or_diagnostic.get("score_closing", 3.0),
        "score_fidelisation": debrief_or_diagnostic.get("score_fidelisation", 3.0),
    }


@router.get("/competences-history/{seller_id}")
async def get_seller_competences_history(
    page: int = 1,
    size: int = 50,
    seller: dict = Depends(get_verified_seller),
    manager_service: ManagerService = Depends(get_manager_service),
):
    """Get seller's competences evolution history (paginated). Access verified via get_verified_seller."""
    seller_id = seller.get("id")
    diagnostic = await manager_service.get_diagnostic_by_seller(seller_id)
    debrief_count = await manager_service.get_debriefs_count_by_seller(seller_id)
    has_diagnostic = diagnostic is not None
    total = (1 if has_diagnostic else 0) + debrief_count
    pages = (total + size - 1) // size if total > 0 else 0
    items: list = []
    if page == 1 and diagnostic:
        items.append(_history_item(diagnostic, "diagnostic"))
        debriefs_slice = await manager_service.get_debriefs_by_seller(
            seller_id, limit=size - 1, skip=0
        )
        for debrief in debriefs_slice:
            items.append(_history_item(debrief, "debrief"))
    elif page > 1 and has_diagnostic:
        debrief_skip = (page - 1) * size - 1
        debriefs_slice = await manager_service.get_debriefs_by_seller(
            seller_id, limit=size, skip=debrief_skip
        )
        for debrief in debriefs_slice:
            items.append(_history_item(debrief, "debrief"))
    else:
        debriefs_result = await manager_service.get_debriefs_by_seller_paginated(
            seller_id, page=page, size=size
        )
        for debrief in debriefs_result.items:
            items.append(_history_item(debrief, "debrief"))
    return {
        "items": items,
        "pagination": {
            "total": total,
            "page": page,
            "size": size,
            "pages": pages,
        },
    }


# ----- Relationship advice -----

@router.post("/relationship-advice")
async def get_relationship_advice(
    request: RelationshipAdviceRequest,
    store_id: Optional[str] = Query(None, description="Store ID (requis pour gérant)"),
    context: dict = Depends(get_store_context),
    relationship_service: RelationshipService = Depends(get_relationship_service),
    manager_service: ManagerService = Depends(get_manager_service),
):
    """Generate AI-powered relationship/conflict management advice for managers."""
    try:
        resolved_store_id = context.get("resolved_store_id")
        manager_id = context.get("id")
        manager_name = context.get("name", "Manager")
        advice_result = await relationship_service.generate_recommendation(
            seller_id=request.seller_id,
            advice_type=request.advice_type,
            situation_type=request.situation_type,
            description=request.description,
            manager_id=manager_id,
            manager_name=manager_name,
            store_id=resolved_store_id,
            is_seller_request=False,
        )
        seller = await manager_service.get_seller_by_id_and_store(request.seller_id, resolved_store_id)
        seller_status = seller.get("status", "active") if seller else "active"
        consultation_id = await relationship_service.save_consultation({
            "store_id": resolved_store_id,
            "manager_id": manager_id,
            "seller_id": request.seller_id,
            "seller_name": advice_result["seller_name"],
            "seller_status": seller_status,
            "advice_type": request.advice_type,
            "situation_type": request.situation_type,
            "description": request.description,
            "recommendation": advice_result["recommendation"],
        })
        return {
            "consultation_id": consultation_id,
            "recommendation": advice_result["recommendation"],
            "seller_name": advice_result["seller_name"],
        }
    except ValueError as ve:
        raise ValidationError(str(ve))
    except AppException:
        raise


@router.get("/relationship-history")
@router.get("/relationship-advice/history")
async def get_relationship_history(
    seller_id: Optional[str] = Query(None, description="Filter by seller ID"),
    store_id: Optional[str] = Query(None, description="Store ID (requis pour gérant)"),
    context: dict = Depends(get_store_context),
    manager_service: ManagerService = Depends(get_manager_service),
):
    """Get manager's relationship consultation history. Optionally filter by seller_id."""
    resolved_store_id = context.get("resolved_store_id")
    manager_id = context.get("id")
    consultations_result = await manager_service.get_relationship_consultations_paginated(
        resolved_store_id, page=1, size=50
    )
    items = consultations_result.items
    if seller_id:
        items = [c for c in items if c.get("seller_id") == seller_id]
    return {
        "consultations": items,
        "pagination": {
            "total": len(items) if seller_id else consultations_result.total,
            "page": consultations_result.page,
            "size": consultations_result.size,
            "pages": consultations_result.pages,
        },
    }


# ----- Conflict resolution -----

@router.post("/conflict-resolution")
async def create_conflict_resolution(
    request: ConflictResolutionRequest,
    store_id: Optional[str] = Query(None, description="Store ID (requis pour gérant)"),
    context: dict = Depends(get_store_context),
    conflict_service: ConflictService = Depends(get_conflict_service),
    manager_service: ManagerService = Depends(get_manager_service),
):
    """Generate AI-powered conflict resolution advice for managers."""
    try:
        resolved_store_id = context.get("resolved_store_id")
        manager_id = context.get("id")
        manager_name = context.get("name", "Manager")
        advice_result = await conflict_service.generate_conflict_advice(
            seller_id=request.seller_id,
            contexte=request.contexte,
            comportement_observe=request.comportement_observe,
            impact=request.impact,
            tentatives_precedentes=request.tentatives_precedentes,
            description_libre=request.description_libre,
            manager_id=manager_id,
            manager_name=manager_name,
            store_id=resolved_store_id,
            is_seller_request=False,
        )
        conflict_id = await conflict_service.save_conflict({
            "store_id": resolved_store_id,
            "manager_id": manager_id,
            "seller_id": request.seller_id,
            "seller_name": advice_result["seller_name"],
            "contexte": request.contexte,
            "comportement_observe": request.comportement_observe,
            "impact": request.impact,
            "tentatives_precedentes": request.tentatives_precedentes,
            "description_libre": request.description_libre,
            "ai_analyse_situation": advice_result["ai_analyse_situation"],
            "ai_approche_communication": advice_result["ai_approche_communication"],
            "ai_actions_concretes": advice_result["ai_actions_concretes"],
            "ai_points_vigilance": advice_result["ai_points_vigilance"],
            "statut": "ouvert",
        })
        return {
            "id": conflict_id,
            "seller_name": advice_result["seller_name"],
            "ai_analyse_situation": advice_result["ai_analyse_situation"],
            "ai_approche_communication": advice_result["ai_approche_communication"],
            "ai_actions_concretes": advice_result["ai_actions_concretes"],
            "ai_points_vigilance": advice_result["ai_points_vigilance"],
        }
    except ValueError as ve:
        raise ValidationError(str(ve))
    except AppException:
        raise


@router.get("/conflict-history/{seller_id}")
async def get_conflict_history(
    seller_id: str,
    store_id: Optional[str] = Query(None, description="Store ID (requis pour gérant)"),
    context: dict = Depends(get_store_context),
    conflict_service: ConflictService = Depends(get_conflict_service),
    manager_service: ManagerService = Depends(get_manager_service),
):
    """Get conflict resolution history for a specific seller."""
    resolved_store_id = context.get("resolved_store_id")
    manager_id = context.get("id")
    conflicts = await conflict_service.list_conflicts(
        manager_id=manager_id,
        seller_id=seller_id,
        store_id=resolved_store_id,
        limit=100,
    )
    return {"consultations": conflicts, "total": len(conflicts)}


@router.delete("/relationship-consultation/{consultation_id}")
async def delete_relationship_consultation(
    consultation_id: str,
    store_id: Optional[str] = Query(None, description="Store ID (requis pour gérant)"),
    context: dict = Depends(get_store_context),
    manager_service: ManagerService = Depends(get_manager_service),
):
    """Delete a relationship consultation from history."""
    try:
        resolved_store_id = context.get("resolved_store_id")
        manager_id = context.get("id")
        deleted = await manager_service.delete_relationship_consultation_one(
            {"id": consultation_id, "manager_id": manager_id, "store_id": resolved_store_id}
        )
        if not deleted:
            raise NotFoundError("Consultation non trouvée")
        return {"success": True, "message": "Consultation supprimée"}
    except AppException:
        raise
