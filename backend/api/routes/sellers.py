"""
Seller Routes
API endpoints for seller-specific features (tasks, objectives, challenges)
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Dict, List

from services.seller_service import SellerService
from api.dependencies import get_seller_service, get_db
from core.security import get_current_seller, get_current_user

router = APIRouter(prefix="/seller", tags=["Seller"])


# ===== KPI ENABLED CHECK =====

@router.get("/kpi-enabled")
async def check_kpi_enabled(
    store_id: str = Query(None),
    current_user: Dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """
    Check if KPI input is enabled for seller
    Used to determine if sellers can input their own KPIs or if manager does it
    """
    # Allow sellers, managers, and gérants to check KPI status
    if current_user['role'] not in ['seller', 'manager', 'gerant', 'gérant']:
        raise HTTPException(status_code=403, detail="Access denied")
    
    SELLER_INPUT_KPIS = ['ca_journalier', 'nb_ventes', 'nb_clients', 'nb_articles', 'nb_prospects']
    
    # Determine manager_id or store_id to check
    manager_id = None
    effective_store_id = store_id
    
    if current_user['role'] == 'seller':
        manager_id = current_user.get('manager_id')
        if not manager_id:
            return {"enabled": False, "seller_input_kpis": SELLER_INPUT_KPIS}
    elif store_id and current_user['role'] in ['gerant', 'gérant']:
        effective_store_id = store_id
    elif current_user.get('store_id'):
        effective_store_id = current_user['store_id']
    elif current_user['role'] == 'manager':
        manager_id = current_user['id']
    
    # Find config by store_id or manager_id
    config = None
    if effective_store_id:
        config = await db.kpi_configs.find_one({"store_id": effective_store_id}, {"_id": 0})
    if not config and manager_id:
        config = await db.kpi_configs.find_one({"manager_id": manager_id}, {"_id": 0})
    
    if not config:
        return {"enabled": False, "seller_input_kpis": SELLER_INPUT_KPIS}
    
    return {
        "enabled": config.get('enabled', True),
        "seller_input_kpis": SELLER_INPUT_KPIS
    }


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
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service)
) -> List[Dict]:
    """
    Get active team objectives for display in seller dashboard
    Returns only objectives that are:
    - Within the current period (period_end >= today)
    - Visible to this seller (individual or collective with visibility rules)
    """
    try:
        # Get seller's manager
        user = await seller_service.db.users.find_one({"id": current_user['id']}, {"_id": 0})
        
        if not user or not user.get('manager_id'):
            return []
        
        # Fetch objectives
        objectives = await seller_service.get_seller_objectives_active(
            current_user['id'], 
            user['manager_id']
        )
        return objectives
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch objectives: {str(e)}")


@router.get("/objectives/all")
async def get_all_seller_objectives(
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service)
) -> Dict:
    """
    Get all team objectives (active and inactive) for seller
    Returns objectives separated into:
    - active: objectives with period_end > today
    - inactive: objectives with period_end <= today
    """
    try:
        # Get seller's manager
        user = await seller_service.db.users.find_one({"id": current_user['id']}, {"_id": 0})
        
        if not user or not user.get('manager_id'):
            return {"active": [], "inactive": []}
        
        # Fetch all objectives
        result = await seller_service.get_seller_objectives_all(
            current_user['id'], 
            user['manager_id']
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch objectives: {str(e)}")


@router.get("/objectives/history")
async def get_seller_objectives_history(
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service)
) -> List[Dict]:
    """
    Get completed objectives (past period_end date) for seller
    Returns objectives that have ended (period_end < today)
    """
    try:
        # Get seller's manager
        user = await seller_service.db.users.find_one({"id": current_user['id']}, {"_id": 0})
        
        if not user or not user.get('manager_id'):
            return []
        
        # Fetch history
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
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service)
) -> List[Dict]:
    """
    Get all challenges (collective + individual) for seller
    Returns all challenges from seller's manager
    """
    try:
        # Get seller's manager
        user = await seller_service.db.users.find_one({"id": current_user['id']}, {"_id": 0})
        
        if not user or not user.get('manager_id'):
            return []
        
        # Fetch challenges
        challenges = await seller_service.get_seller_challenges(
            current_user['id'], 
            user['manager_id']
        )
        return challenges
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch challenges: {str(e)}")


@router.get("/challenges/active")
async def get_active_seller_challenges(
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service)
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
        user = await seller_service.db.users.find_one({"id": current_user['id']}, {"_id": 0})
        
        if not user or not user.get('manager_id'):
            return []
        
        # Fetch active challenges
        challenges = await seller_service.get_seller_challenges_active(
            current_user['id'], 
            user['manager_id']
        )
        return challenges
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch active challenges: {str(e)}")


@router.get("/challenges/history")
async def get_seller_challenges_history(
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service)
) -> List[Dict]:
    """
    Get completed challenges (past end_date) for seller
    Returns challenges that have ended (end_date < today)
    """
    try:
        # Get seller's manager
        user = await seller_service.db.users.find_one({"id": current_user['id']}, {"_id": 0})
        
        if not user or not user.get('manager_id'):
            return []
        
        # Fetch history
        challenges = await seller_service.get_seller_challenges_history(
            current_user['id'], 
            user['manager_id']
        )
        return challenges
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch challenges history: {str(e)}")
