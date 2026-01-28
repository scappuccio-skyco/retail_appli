"""
Workspace Routes
Workspace availability check and management
"""
import random
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from api.dependencies import get_db
from repositories.store_repository import WorkspaceRepository

router = APIRouter(prefix="/workspaces", tags=["Workspaces"])


class WorkspaceCheckRequest(BaseModel):
    name: str


@router.post("/check-availability")
async def check_workspace_availability(
    request: WorkspaceCheckRequest,
    db=Depends(get_db)
):
    """
    Check if a workspace name is available
    
    Args:
        request: Workspace name to check
        
    Returns:
        Dict with availability status and suggestions if taken
    """
    name = request.name.strip()
    
    if len(name) < 3:
        return {
            "available": False,
            "message": "Le nom doit contenir au moins 3 caractères"
        }
    
    workspace_repo = WorkspaceRepository(db)
    existing = await workspace_repo.find_by_name_case_insensitive(name)
    
    if existing:
        suggestions = [
            f"{name}{random.randint(1, 99)}",
            f"{name}-{random.randint(100, 999)}",
            f"{name.lower().replace(' ', '-')}"
        ]
        
        return {
            "available": False,
            "message": "Ce nom est déjà utilisé",
            "suggestions": suggestions
        }
    
    return {
        "available": True,
        "message": "Ce nom est disponible",
        "slug": name.lower().replace(' ', '-')
    }
