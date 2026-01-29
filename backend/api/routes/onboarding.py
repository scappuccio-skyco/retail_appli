"""
Onboarding Routes
User onboarding progress tracking
"""
from fastapi import APIRouter, Depends
from typing import Dict

from core.security import get_current_user, require_active_space
from services.onboarding_service import OnboardingService
from api.dependencies import get_onboarding_service

router = APIRouter(
    prefix="/onboarding",
    tags=["Onboarding"],
    # ✅ Note: require_active_space retiré pour permettre la lecture de progression même si trial_expired
    # La sauvegarde (POST) reste protégée par require_active_space dans les routes individuelles
)


@router.get("/progress")
async def get_onboarding_progress(
    current_user: dict = Depends(get_current_user),
    onboarding_service: OnboardingService = Depends(get_onboarding_service)
):
    """
    Get onboarding progress for current user
    
    ✅ AUTORISÉ même si trial_expired (lecture seule de la progression)
    
    Returns:
        Dict with user_id, current_step, completed_steps, is_completed
    """
    return await onboarding_service.get_progress(current_user['id'])


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
    return await onboarding_service.save_progress(
        user_id=current_user['id'],
        current_step=progress_data.get('current_step', 0),
        completed_steps=progress_data.get('completed_steps', []),
        is_completed=progress_data.get('is_completed', False)
    )


@router.post("/complete")
async def mark_onboarding_complete(
    current_user: dict = Depends(get_current_user),
    onboarding_service: OnboardingService = Depends(get_onboarding_service)
):
    """
    Mark onboarding as completed for current user
    
    ⚠️ BLOQUÉ si trial_expired (écriture nécessite abonnement actif)
    
    Returns:
        Success message
    """
    from core.security import require_active_space
    # ✅ Vérifier l'abonnement pour l'écriture
    await require_active_space(current_user)
    
    await onboarding_service.mark_complete(current_user['id'])
    return {"success": True, "message": "Onboarding marked as complete"}
