"""
Seller Routes
API endpoints for seller-specific features (tasks, objectives, challenges)
"""
from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, List

from services.seller_service import SellerService
from api.dependencies import get_seller_service
from core.security import get_current_seller
from core.database import database

router = APIRouter(prefix="/seller", tags=["Seller"])


# ===== TASKS =====

@router.get("/tasks")
async def get_seller_tasks(
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service)
) -> List[Dict]:
    """
    Get all pending tasks for current seller
    - Diagnostic completion status
    - Pending manager requests
    """
    try:
        tasks = await seller_service.get_seller_tasks(current_user['id'])
        return tasks
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch tasks: {str(e)}")


# ===== OBJECTIVES =====

@router.get("/objectives/active")
async def get_active_seller_objectives(
    current_user: Dict = Depends(get_current_seller)
) -> List[Dict]:
    """
    Get active team objectives for display in seller dashboard
    Returns only objectives that are:
    - Within the current period (period_end >= today)
    - Visible to this seller (individual or collective with visibility rules)
    """
    try:
        # Get seller's manager
        db = database.get_db()
        user = await db.users.find_one({"id": current_user['id']}, {"_id": 0})
        
        if not user or not user.get('manager_id'):
            return []
        
        # Create service instance and fetch objectives
        seller_service = SellerService()
        objectives = await seller_service.get_seller_objectives_active(
            current_user['id'], 
            user['manager_id']
        )
        return objectives
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch objectives: {str(e)}")


@router.get("/objectives/all")
async def get_all_seller_objectives(
    current_user: Dict = Depends(get_current_seller)
) -> Dict:
    """
    Get all team objectives (active and inactive) for seller
    Returns objectives separated into:
    - active: objectives with period_end > today
    - inactive: objectives with period_end <= today
    """
    try:
        # Get seller's manager
        db = database.get_db()
        user = await db.users.find_one({"id": current_user['id']}, {"_id": 0})
        
        if not user or not user.get('manager_id'):
            return {"active": [], "inactive": []}
        
        # Create service instance and fetch all objectives
        seller_service = SellerService()
        result = await seller_service.get_seller_objectives_all(
            current_user['id'], 
            user['manager_id']
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch objectives: {str(e)}")


@router.get("/objectives/history")
async def get_seller_objectives_history(
    current_user: Dict = Depends(get_current_seller)
) -> List[Dict]:
    """
    Get completed objectives (past period_end date) for seller
    Returns objectives that have ended (period_end < today)
    """
    try:
        # Get seller's manager
        db = database.get_db()
        user = await db.users.find_one({"id": current_user['id']}, {"_id": 0})
        
        if not user or not user.get('manager_id'):
            return []
        
        # Create service instance and fetch history
        seller_service = SellerService()
        objectives = await seller_service.get_seller_objectives_history(
            current_user['id'], 
            user['manager_id']
        )
        return objectives
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch objectives history: {str(e)}")


# ===== CHALLENGES =====

@router.get("/challenges")
async def get_seller_challenges(
    current_user: Dict = Depends(get_current_seller)
) -> List[Dict]:
    """
    Get all challenges (collective + individual) for seller
    Returns all challenges from seller's manager
    """
    try:
        # Get seller's manager
        db = database.get_db()
        user = await db.users.find_one({"id": current_user['id']}, {"_id": 0})
        
        if not user or not user.get('manager_id'):
            return []
        
        # Create service instance and fetch challenges
        seller_service = SellerService()
        challenges = await seller_service.get_seller_challenges(
            current_user['id'], 
            user['manager_id']
        )
        return challenges
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch challenges: {str(e)}")


@router.get("/challenges/active")
async def get_active_seller_challenges(
    current_user: Dict = Depends(get_current_seller)
) -> List[Dict]:
    """
    Get only active challenges (collective + personal) for display in seller dashboard
    Returns challenges that are:
    - Active status
    - Not yet ended (end_date >= today)
    - Visible to this seller
    """
    try:
        # Get seller's manager
        db = database.get_db()
        user = await db.users.find_one({"id": current_user['id']}, {"_id": 0})
        
        if not user or not user.get('manager_id'):
            return []
        
        # Create service instance and fetch active challenges
        seller_service = SellerService()
        challenges = await seller_service.get_seller_challenges_active(
            current_user['id'], 
            user['manager_id']
        )
        return challenges
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch active challenges: {str(e)}")


@router.get("/challenges/history")
async def get_seller_challenges_history(
    current_user: Dict = Depends(get_current_seller)
) -> List[Dict]:
    """
    Get completed challenges (past end_date) for seller
    Returns challenges that have ended (end_date < today)
    """
    try:
        # Get seller's manager
        db = database.get_db()
        user = await db.users.find_one({"id": current_user['id']}, {"_id": 0})
        
        if not user or not user.get('manager_id'):
            return []
        
        # Create service instance and fetch history
        seller_service = SellerService()
        challenges = await seller_service.get_seller_challenges_history(
            current_user['id'], 
            user['manager_id']
        )
        return challenges
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch challenges history: {str(e)}")
