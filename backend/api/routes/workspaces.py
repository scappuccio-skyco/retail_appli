"""
Workspace Routes
Workspace availability check and management
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from api.dependencies import get_db

router = APIRouter(prefix="/workspaces", tags=["Workspaces"])


class WorkspaceCheckRequest(BaseModel):
    name: str


@router.post("/check-availability")
async def check_workspace_availability(
    request: WorkspaceCheckRequest,
    db = Depends(get_db)
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
    
    # Check if workspace name already exists
    existing = await db.workspaces.find_one(
        {"name": {"$regex": f"^{name}$", "$options": "i"}},
        {"_id": 0, "id": 1}
    )
    
    if existing:
        # Generate suggestions
        import random
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
