"""
Manager - Consultations: conseils relationnels et résolutions de conflits (IA).
"""
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from core.exceptions import AppException, NotFoundError, ValidationError
from api.routes.manager.dependencies import get_store_context
from api.dependencies import (
    get_manager_service,
    get_relationship_service,
    get_conflict_service,
)
from models.pagination import PaginationParams
from services.manager_service import ManagerService
from services.relationship_service import RelationshipService
from services.conflict_service import ConflictService

router = APIRouter(prefix="")


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


@router.post("/relationship-advice")
async def get_relationship_advice(
    request: RelationshipAdviceRequest,
    store_id: Optional[str] = Query(None, description="Store ID (requis pour gérant)"),
    context: dict = Depends(get_store_context),
    relationship_service: RelationshipService = Depends(get_relationship_service),
    manager_service: ManagerService = Depends(get_manager_service),
):
    """
    Generate AI-powered relationship/conflict management advice for managers.
    Uses RelationshipService for centralized logic.
    """
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

        seller = await manager_service.get_seller_by_id_and_store(
            request.seller_id, resolved_store_id
        )
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
    pagination: PaginationParams = Depends(),
    context: dict = Depends(get_store_context),
    manager_service: ManagerService = Depends(get_manager_service),
):
    """
    Get manager's relationship consultation history.
    Filtrage par seller_id et pagination appliqués en base (query MongoDB).
    """
    resolved_store_id = context.get("resolved_store_id")
    manager_id = context.get("id")

    consultations_result = await manager_service.get_relationship_consultations_for_manager_paginated(
        store_id=resolved_store_id,
        manager_id=manager_id,
        seller_id=seller_id,
        page=pagination.page,
        size=pagination.size,
    )

    return {
        "consultations": consultations_result.items,
        "pagination": {
            "total": consultations_result.total,
            "page": consultations_result.page,
            "size": consultations_result.size,
            "pages": consultations_result.pages,
        },
    }


@router.post("/conflict-resolution")
async def create_conflict_resolution(
    request: ConflictResolutionRequest,
    store_id: Optional[str] = Query(None, description="Store ID (requis pour gérant)"),
    context: dict = Depends(get_store_context),
    conflict_service: ConflictService = Depends(get_conflict_service),
    manager_service: ManagerService = Depends(get_manager_service),
):
    """
    Generate AI-powered conflict resolution advice for managers.
    Uses manager profile, seller profile, and conflict details.
    """
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
