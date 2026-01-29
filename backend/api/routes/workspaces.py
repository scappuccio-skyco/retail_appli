"""
Workspace Routes
Workspace availability check and management.
Routes handle HTTP only; business logic in StoreService.
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from api.dependencies import get_store_service
from services.store_service import StoreService

router = APIRouter(prefix="/workspaces", tags=["Workspaces"])


class WorkspaceCheckRequest(BaseModel):
    name: str


@router.post("/check-availability")
async def check_workspace_availability(
    request: WorkspaceCheckRequest,
    store_service: StoreService = Depends(get_store_service),
):
    """Check if a workspace name is available. Delegates to StoreService."""
    return await store_service.check_workspace_availability(request.name)
