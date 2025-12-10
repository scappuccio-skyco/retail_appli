"""
Diagnostic Routes
Manager DISC diagnostic profiles
"""
from fastapi import APIRouter, Depends, HTTPException

from core.security import get_current_user
from services.manager_service import DiagnosticService
from api.dependencies import get_diagnostic_service

router = APIRouter(prefix="/manager-diagnostic", tags=["Diagnostics"])


async def verify_manager(current_user: dict = Depends(get_current_user)) -> dict:
    """Verify current user is a manager"""
    if current_user.get('role') != 'manager':
        raise HTTPException(status_code=403, detail="Access restricted to managers")
    return current_user


@router.get("/me")
async def get_my_diagnostic(
    current_user: dict = Depends(verify_manager),
    diagnostic_service: DiagnosticService = Depends(get_diagnostic_service)
):
    """
    Get current manager's DISC diagnostic profile
    
    Returns manager's personality profile (DISC method)
    """
    try:
        diagnostic = await diagnostic_service.get_manager_diagnostic(current_user['id'])
        
        if not diagnostic:
            return {
                "manager_id": current_user['id'],
                "completed": False,
                "message": "Diagnostic not completed yet"
            }
        
        return diagnostic
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
