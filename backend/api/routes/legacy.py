"""
Legacy / compatibility routes.
Duplicate or old endpoints for backward compatibility (e.g. old invitation links, manager KPI paths).
Routes handle HTTP only; business logic in services. No repository or db in routes.
"""
from typing import Optional

from fastapi import APIRouter, Depends, Query, Request

from api.dependencies import get_auth_service, get_competence_service, get_manager_service
from core.constants import QUERY_STORE_ID_REQUIS_GERANT
from core.exceptions import ValidationError
from models.pagination import PaginationParams
from services.auth_service import AuthService
from services.competence_service import CompetenceService
from services.manager_service import ManagerService

# Import from manager for delegation (store context + handlers)
from api.routes.manager import get_store_context, get_seller_kpi_entries, get_seller_stats

router = APIRouter(prefix="", tags=["Legacy"])


# ----- Manager KPI compatibility (same paths as manager router, delegate to handler) -----

@router.get("/manager/kpi-entries/{seller_id}")
async def get_seller_kpi_entries_compat(
    request: Request,
    seller_id: str,
    days: int = Query(30, description="Number of days to fetch"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    store_id: Optional[str] = Query(None, description=QUERY_STORE_ID_REQUIS_GERANT),
    pagination: PaginationParams = Depends(),
    context: dict = Depends(get_store_context),
    manager_service: ManagerService = Depends(get_manager_service),
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
        manager_service=manager_service,
    )


@router.get("/manager/seller/{seller_id}/stats")
async def get_seller_stats_compat(
    request: Request,
    seller_id: str,
    days: int = Query(30, description="Number of days for stats calculation"),
    store_id: Optional[str] = Query(None, description=QUERY_STORE_ID_REQUIS_GERANT),
    context: dict = Depends(get_store_context),
    competence_service: CompetenceService = Depends(get_competence_service),
    manager_service: ManagerService = Depends(get_manager_service),
):
    """Compatibility route for GET /api/manager/seller/{seller_id}/stats. Delegates to manager handler."""
    return await get_seller_stats(
        request=request,
        seller_id=seller_id,
        days=days,
        store_id=store_id,
        context=context,
        competence_service=competence_service,
        manager_service=manager_service,
    )


# ----- Invitation legacy (old RegisterManager / RegisterSeller pages) -----

@router.get("/invitations/gerant/verify/{token}")
async def verify_gerant_invitation_legacy(
    token: str,
    auth_service: AuthService = Depends(get_auth_service),
):
    """
    Legacy endpoint for verifying gerant invitations.
    Used by old RegisterManager.js and RegisterSeller.js pages.
    No db in route; delegates to AuthService.
    """
    return await auth_service.verify_invitation_for_display(token)


@router.post("/auth/register-with-gerant-invite")
async def register_with_gerant_invite_legacy(
    request_data: dict,
    auth_service: AuthService = Depends(get_auth_service),
):
    """
    Legacy endpoint for registering with gerant invitation.
    Used by old RegisterManager.js and RegisterSeller.js pages.
    No db or UserRepository in route; delegates to AuthService.
    """
    invitation_token = request_data.get("invitation_token")
    email = request_data.get("email", "")
    if not email:
        invitation = await auth_service.get_invitation_by_token(invitation_token)
        if invitation:
            email = invitation.get("email", "")
    try:
        return await auth_service.register_with_invitation(
            email=email,
            password=request_data.get("password"),
            name=request_data.get("name"),
            invitation_token=invitation_token,
        )
    except ValidationError:
        raise
    except Exception as e:
        raise ValidationError(str(e))
