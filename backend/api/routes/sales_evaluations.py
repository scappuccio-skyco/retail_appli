"""
Sales and Evaluations Routes
Routes handle HTTP only; business logic in SellerService.
No repository instantiation in routes.
"""
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from api.dependencies import get_seller_service
from core.security import get_current_user, require_active_space
from exceptions.custom_exceptions import ForbiddenError, NotFoundError
from models.pagination import PaginationParams
from services.seller_service import SellerService

router = APIRouter(
    tags=["Sales & Evaluations"],
    dependencies=[Depends(require_active_space)],
)


# ===== PYDANTIC MODELS =====

class SaleCreate(BaseModel):
    amount: float
    product: str
    notes: str = ""


class EvaluationCreate(BaseModel):
    sale_id: str
    accueil: int
    decouverte: int
    argumentation: int
    closing: int
    fidelisation: int
    auto_comment: str = ""


# ===== SALES ROUTES =====

@router.post("/sales")
async def create_sale(
    sale_data: SaleCreate,
    current_user: dict = Depends(get_current_user),
    seller_service: SellerService = Depends(get_seller_service),
):
    """Create a new sale record (seller only). Delegates to SellerService."""
    if current_user["role"] != "seller":
        raise ForbiddenError("Only sellers can create sales")
    sale = {
        "id": str(uuid4()),
        "seller_id": current_user["id"],
        "amount": sale_data.amount,
        "product": sale_data.product,
        "notes": sale_data.notes,
        "date": datetime.now(timezone.utc).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    return await seller_service.create_sale(current_user["id"], sale)


@router.get("/sales")
async def get_sales(
    pagination: PaginationParams = Depends(),
    current_user: dict = Depends(get_current_user),
    seller_service: SellerService = Depends(get_seller_service),
):
    """Get sales for current user (seller sees own, manager sees team). Delegates to SellerService."""
    return await seller_service.get_sales_paginated(
        user_id=current_user["id"],
        role=current_user["role"],
        store_id=current_user.get("store_id"),
        page=pagination.page,
        size=pagination.size,
    )


# ===== EVALUATIONS ROUTES =====

@router.post("/evaluations")
async def create_evaluation(
    eval_data: EvaluationCreate,
    current_user: dict = Depends(get_current_user),
    seller_service: SellerService = Depends(get_seller_service),
):
    """Create a self-evaluation for a sale (seller only). Delegates to SellerService."""
    if current_user["role"] != "seller":
        raise ForbiddenError("Only sellers can create evaluations")
    sale = await seller_service.get_sale_by_id_for_seller(
        eval_data.sale_id, current_user["id"]
    )
    if not sale:
        raise NotFoundError("Sale not found")
    radar_scores = {
        "accueil": eval_data.accueil,
        "decouverte": eval_data.decouverte,
        "argumentation": eval_data.argumentation,
        "closing": eval_data.closing,
        "fidelisation": eval_data.fidelisation,
    }
    avg_score = sum(radar_scores.values()) / len(radar_scores)
    evaluation = {
        "id": str(uuid4()),
        "seller_id": current_user["id"],
        "sale_id": eval_data.sale_id,
        "accueil": eval_data.accueil,
        "decouverte": eval_data.decouverte,
        "argumentation": eval_data.argumentation,
        "closing": eval_data.closing,
        "fidelisation": eval_data.fidelisation,
        "radar_scores": radar_scores,
        "average_score": round(avg_score, 2),
        "auto_comment": eval_data.auto_comment,
        "ai_feedback": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    return await seller_service.create_evaluation(current_user["id"], evaluation)


@router.get("/evaluations")
async def get_evaluations(
    pagination: PaginationParams = Depends(),
    current_user: dict = Depends(get_current_user),
    seller_service: SellerService = Depends(get_seller_service),
):
    """Get evaluations for current user. Delegates to SellerService."""
    return await seller_service.get_evaluations_paginated(
        user_id=current_user["id"],
        role=current_user["role"],
        store_id=current_user.get("store_id"),
        page=pagination.page,
        size=pagination.size,
    )
