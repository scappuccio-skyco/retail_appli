"""
Legacy / compatibility routes.
Duplicate or old endpoints for backward compatibility (e.g. old invitation links, manager KPI paths).
Tag: Legacy.
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from api.dependencies import get_db, get_competence_service
from models.pagination import PaginationParams

# Import from manager for delegation (store context + handlers)
from api.routes.manager import get_store_context, get_seller_kpi_entries, get_seller_stats
from services.competence_service import CompetenceService

router = APIRouter(prefix="", tags=["Legacy"])


# ----- Manager KPI compatibility (same paths as manager router, delegate to handler) -----

@router.get("/manager/kpi-entries/{seller_id}")
async def get_seller_kpi_entries_compat(
    request: Request,
    seller_id: str,
    days: int = Query(30, description="Number of days to fetch"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    store_id: Optional[str] = Query(None, description="Store ID (requis pour gérant)"),
    pagination: PaginationParams = Depends(),
    context: dict = Depends(get_store_context),
    db=Depends(get_db),
):
    """Compatibility route for GET /api/manager/kpi-entries/{seller_id}. Delegates to manager handler."""
    return await get_seller_kpi_entries(
        request=request,
        seller_id=seller_id,
        days=days,
        start_date=start_date,
        end_date=end_date,
        store_id=store_id,
        pagination=pagination,
        context=context,
        db=db,
    )


@router.get("/manager/seller/{seller_id}/stats")
async def get_seller_stats_compat(
    request: Request,
    seller_id: str,
    days: int = Query(30, description="Number of days for stats calculation"),
    store_id: Optional[str] = Query(None, description="Store ID (requis pour gérant)"),
    context: dict = Depends(get_store_context),
    competence_service: CompetenceService = Depends(get_competence_service),
    db=Depends(get_db),
):
    """Compatibility route for GET /api/manager/seller/{seller_id}/stats. Delegates to manager handler."""
    return await get_seller_stats(
        request=request,
        seller_id=seller_id,
        days=days,
        store_id=store_id,
        context=context,
        competence_service=competence_service,
        db=db,
    )


# ----- Invitation legacy (old RegisterManager / RegisterSeller pages) -----

@router.get("/invitations/gerant/verify/{token}")
async def verify_gerant_invitation_legacy(token: str, db=Depends(get_db)):
    """
    Legacy endpoint for verifying gerant invitations.
    Used by old RegisterManager.js and RegisterSeller.js pages.
    """
    invitation = await db.gerant_invitations.find_one({"token": token}, {"_id": 0})
    if not invitation:
        invitation = await db.invitations.find_one({"token": token}, {"_id": 0})
    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation non trouvée ou expirée")
    if invitation.get("status") == "accepted":
        raise HTTPException(status_code=400, detail="Cette invitation a déjà été utilisée")
    if invitation.get("status") == "expired":
        raise HTTPException(status_code=400, detail="Cette invitation a expiré")
    return {
        "valid": True,
        "email": invitation.get("email"),
        "role": invitation.get("role", "seller"),
        "store_name": invitation.get("store_name"),
        "gerant_name": invitation.get("gerant_name"),
        "manager_name": invitation.get("manager_name"),
        "name": invitation.get("name", ""),
        "gerant_id": invitation.get("gerant_id"),
        "store_id": invitation.get("store_id"),
        "manager_id": invitation.get("manager_id"),
    }


@router.post("/auth/register-with-gerant-invite")
async def register_with_gerant_invite_legacy(request_data: dict, db=Depends(get_db)):
    """
    Legacy endpoint for registering with gerant invitation.
    Used by old RegisterManager.js and RegisterSeller.js pages.
    """
    from services.auth_service import AuthService
    from repositories.user_repository import UserRepository

    user_repo = UserRepository(db)
    auth_service = AuthService(db, user_repo)
    invitation_token = request_data.get("invitation_token")
    email = request_data.get("email", "")
    if not email:
        invitation = await db.gerant_invitations.find_one(
            {"token": invitation_token}, {"_id": 0}
        )
        if not invitation:
            invitation = await db.invitations.find_one(
                {"token": invitation_token}, {"_id": 0}
            )
        if invitation:
            email = invitation.get("email", "")
    try:
        return await auth_service.register_with_invitation(
            email=email,
            password=request_data.get("password"),
            name=request_data.get("name"),
            invitation_token=invitation_token,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
