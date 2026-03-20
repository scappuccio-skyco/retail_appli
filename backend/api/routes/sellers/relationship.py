"""
Seller Relationship & Conflict Routes
Routes for seller relationship advice and conflict resolution.
"""
from fastapi import APIRouter, Depends
from typing import Dict

from services.seller_service import SellerService
from api.dependencies import get_seller_service, get_relationship_service, get_conflict_service
from core.security import get_current_seller
from core.exceptions import NotFoundError, ValidationError

router = APIRouter()


@router.post("/relationship-advice")
async def create_seller_relationship_advice(
    advice_data: dict,
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service),
    relationship_service = Depends(get_relationship_service),
):
    """
    Seller requests relationship advice (self-advice).
    """
    try:
        seller_id = current_user["id"]
        seller_name = current_user.get("name", "Vendeur")
        seller = await seller_service.get_seller_profile(
            seller_id, projection={"_id": 0, "store_id": 1, "manager_id": 1}
        )
        if not seller:
            raise NotFoundError("Vendeur non trouvé")
        store_id = seller.get("store_id")
        manager_id = seller.get("manager_id")
        if not manager_id:
            raise ValidationError("Vendeur sans manager associé")
        # Generate recommendation (seller self-advice)
        advice_result = await relationship_service.generate_recommendation(
            seller_id=seller_id,
            advice_type=advice_data.get('advice_type'),
            situation_type=advice_data.get('situation_type'),
            description=advice_data.get('description'),
            manager_id=manager_id,
            store_id=store_id,
            is_seller_request=True
        )

        # Save to history
        consultation_id = await relationship_service.save_consultation({
            "store_id": store_id,
            "manager_id": manager_id,
            "seller_id": seller_id,
            "seller_name": seller_name,
            "seller_status": current_user.get('status', 'active'),
            "advice_type": advice_data.get('advice_type'),
            "situation_type": advice_data.get('situation_type'),
            "description": advice_data.get('description'),
            "recommendation": advice_result["recommendation"]
        })

        return {
            "consultation_id": consultation_id,
            "recommendation": advice_result["recommendation"],
            "seller_name": seller_name
        }

    except ValueError as ve:
        raise ValidationError(str(ve))


@router.get("/relationship-advice/history")
async def get_seller_relationship_history(
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service),
    relationship_service = Depends(get_relationship_service),
):
    """Get seller's relationship advice history (self-advice only)."""
    seller_id = current_user["id"]
    seller = await seller_service.get_seller_profile(
        seller_id, projection={"_id": 0, "store_id": 1}
    )
    store_id = seller.get("store_id") if seller else None
    consultations = await relationship_service.list_consultations(
        seller_id=seller_id,
        store_id=store_id,
        limit=100
    )

    return {
        "consultations": consultations,
        "total": len(consultations)
    }


@router.post("/conflict-resolution")
async def create_seller_conflict_resolution(
    conflict_data: dict,
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service),
    conflict_service = Depends(get_conflict_service),
):
    """Seller reports a conflict and gets AI advice."""
    try:
        seller_id = current_user["id"]
        seller_name = current_user.get("name", "Vendeur")
        seller = await seller_service.get_seller_profile(
            seller_id, projection={"_id": 0, "store_id": 1, "manager_id": 1}
        )
        if not seller:
            raise NotFoundError("Vendeur non trouvé")
        store_id = seller.get("store_id")
        manager_id = seller.get("manager_id")
        if not manager_id:
            raise ValidationError("Vendeur sans manager associé")

        # Generate conflict advice (seller self-advice)
        advice_result = await conflict_service.generate_conflict_advice(
            seller_id=seller_id,
            contexte=conflict_data.get('contexte'),
            comportement_observe=conflict_data.get('comportement_observe'),
            impact=conflict_data.get('impact'),
            tentatives_precedentes=conflict_data.get('tentatives_precedentes'),
            description_libre=conflict_data.get('description_libre'),
            manager_id=manager_id,
            store_id=store_id,
            is_seller_request=True
        )

        # Save to history
        conflict_id = await conflict_service.save_conflict({
            "store_id": store_id,
            "manager_id": manager_id,
            "seller_id": seller_id,
            "seller_name": seller_name,
            "contexte": conflict_data.get('contexte'),
            "comportement_observe": conflict_data.get('comportement_observe'),
            "impact": conflict_data.get('impact'),
            "tentatives_precedentes": conflict_data.get('tentatives_precedentes'),
            "description_libre": conflict_data.get('description_libre'),
            "ai_analyse_situation": advice_result["ai_analyse_situation"],
            "ai_approche_communication": advice_result["ai_approche_communication"],
            "ai_actions_concretes": advice_result["ai_actions_concretes"],
            "ai_points_vigilance": advice_result["ai_points_vigilance"],
            "statut": "ouvert"
        })

        return {
            "id": conflict_id,
            "seller_name": seller_name,
            "ai_analyse_situation": advice_result["ai_analyse_situation"],
            "ai_approche_communication": advice_result["ai_approche_communication"],
            "ai_actions_concretes": advice_result["ai_actions_concretes"],
            "ai_points_vigilance": advice_result["ai_points_vigilance"]
        }

    except ValueError as ve:
        raise ValidationError(str(ve))


@router.get("/conflict-history")
async def get_seller_conflict_history(
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service),
    conflict_service = Depends(get_conflict_service),
):
    """Get seller's conflict resolution history."""
    seller_id = current_user["id"]
    seller = await seller_service.get_seller_profile(
        seller_id, projection={"_id": 0, "store_id": 1}
    )
    store_id = seller.get("store_id") if seller else None
    conflicts = await conflict_service.list_conflicts(
        seller_id=seller_id,
        store_id=store_id,
        limit=100
    )
    return {
        "consultations": conflicts,
        "total": len(conflicts)
    }
