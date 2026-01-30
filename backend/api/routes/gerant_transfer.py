"""
Routeur minimal gerant : ping + transfer manager/seller uniquement.
Chargé en premier pour garantir POST /api/gerant/sellers/{id}/transfer même si gerant.py échoue à l'import.
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Dict

from core.exceptions import NotFoundError, ValidationError
from core.security import get_current_gerant
from services.gerant_service import GerantService
from api.dependencies import get_gerant_service

router = APIRouter(prefix="/gerant", tags=["Gérant - Transfer"])


class ManagerTransferRequest(BaseModel):
    new_store_id: str


class SellerTransferRequest(BaseModel):
    new_store_id: str
    new_manager_id: str


@router.get("/ping")
async def gerant_ping():
    """GET /api/gerant/ping - vérifie que le préfixe gerant répond."""
    return {"ok": True, "message": "gerant router loaded"}


@router.post("/managers/{manager_id}/transfer")
async def transfer_manager_to_store(
    manager_id: str,
    body: ManagerTransferRequest,
    current_user: Dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service),
):
    try:
        return await gerant_service.transfer_manager_to_store(
            manager_id, body.model_dump(), current_user["id"]
        )
    except ValueError as e:
        raise ValidationError(str(e))


@router.post("/sellers/{seller_id}/transfer")
async def transfer_seller_to_store(
    seller_id: str,
    body: SellerTransferRequest,
    current_user: Dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service),
):
    try:
        return await gerant_service.transfer_seller_to_store(
            seller_id, body.model_dump(), current_user["id"]
        )
    except ValueError as e:
        error_msg = str(e)
        if "Invalid transfer data" in error_msg:
            raise ValidationError(error_msg)
        if "inactif" in error_msg:
            raise ValidationError(error_msg)
        raise NotFoundError(error_msg)
