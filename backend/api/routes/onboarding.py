"""
Onboarding Routes
User onboarding progress tracking
"""
from fastapi import APIRouter, Depends, HTTPException
from typing import Dict

from core.security import get_current_user
from services.onboarding_service import OnboardingService
from api.dependencies import get_onboarding_service

router = APIRouter(prefix="/onboarding", tags=["Onboarding"])


@router.get("/progress")
async def get_onboarding_progress(
    current_user: dict = Depends(get_current_user),
    onboarding_service: OnboardingService = Depends(get_onboarding_service)
):
    """
    Get onboarding progress for current user
    
    Returns:
        Dict with user_id, current_step, completed_steps, is_completed
    """
    try:
        progress = await onboarding_service.get_progress(current_user['id'])
        return progress
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/progress")
async def save_onboarding_progress(
    progress_data: Dict,
    current_user: dict = Depends(get_current_user),
    onboarding_service: OnboardingService = Depends(get_onboarding_service)
):
    """
    Save or update onboarding progress for current user
    
    Args:
        progress_data: Dict with current_step, completed_steps, is_completed
        
    Returns:
        Updated progress document
    """
    try:
        progress = await onboarding_service.save_progress(
            user_id=current_user['id'],
            current_step=progress_data.get('current_step', 0),
            completed_steps=progress_data.get('completed_steps', []),
            is_completed=progress_data.get('is_completed', False)
        )
        return progress
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/complete")
async def mark_onboarding_complete(
    current_user: dict = Depends(get_current_user),
    onboarding_service: OnboardingService = Depends(get_onboarding_service)
):
    """
    Mark onboarding as completed for current user
    
    Returns:
        Success message
    """
    try:
        await onboarding_service.mark_complete(current_user['id'])
        return {"success": True, "message": "Onboarding marked as complete"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
