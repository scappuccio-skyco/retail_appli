"""
Seller Status Routes
Public routes accessible even when subscription is expired.
"""
from fastapi import APIRouter, Depends, Query
from typing import Dict

from services.seller_service import SellerService
from api.dependencies import get_seller_service
from core.security import get_current_seller, get_current_user
from core.exceptions import ForbiddenError

router = APIRouter()


# ===== SUBSCRIPTION ACCESS CHECK (public) =====

@router.get("/subscription-status")
async def get_seller_subscription_status(
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service),
):
    """
    Check if the seller's gérant has an active subscription.
    Returns isReadOnly: true if trial expired.
    Accessible even when subscription is expired (no require_active_space).
    """
    gerant_id = current_user.get("gerant_id")
    return await seller_service.get_seller_subscription_status(gerant_id or "")


# ===== KPI ENABLED CHECK (public) =====

@router.get("/kpi-enabled")
async def check_kpi_enabled(
    store_id: str = Query(None),
    current_user: Dict = Depends(get_current_user),
    seller_service: SellerService = Depends(get_seller_service),
):
    """
    Check if KPI input is enabled for seller
    Used to determine if sellers can input their own KPIs or if manager does it
    """
    if current_user["role"] not in ["seller", "manager", "gerant", "gérant"]:
        raise ForbiddenError("Access denied")
    SELLER_INPUT_KPIS = ["ca_journalier", "nb_ventes", "nb_clients", "nb_articles", "nb_prospects"]
    manager_id = None
    effective_store_id = store_id
    if current_user["role"] == "seller":
        manager_id = current_user.get("manager_id")
        if not manager_id:
            return {"enabled": False, "seller_input_kpis": SELLER_INPUT_KPIS}
    elif store_id and current_user["role"] in ["gerant", "gérant"]:
        effective_store_id = store_id
    elif current_user.get("store_id"):
        effective_store_id = current_user["store_id"]
    elif current_user["role"] == "manager":
        manager_id = current_user["id"]
    config = await seller_service.get_kpi_config_for_seller(effective_store_id, manager_id)
    if not config:
        return {"enabled": False, "seller_input_kpis": SELLER_INPUT_KPIS}
    return {"enabled": config.get("enabled", True), "seller_input_kpis": SELLER_INPUT_KPIS}
