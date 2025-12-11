"""
Gérant-specific Routes
Dashboard stats, subscription status, and workspace management
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from datetime import datetime, timezone
from typing import Dict

from core.security import get_current_gerant
from services.gerant_service import GerantService
from api.dependencies import get_gerant_service

router = APIRouter(prefix="/gerant", tags=["Gérant"])


@router.get("/dashboard/stats")
async def get_dashboard_stats(
    current_user: dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service)
):
    """
    Get global statistics for gérant dashboard (all stores aggregated)
    
    Returns:
        Dict with total stores, managers, sellers, and monthly KPI aggregations
    """
    try:
        stats = await gerant_service.get_dashboard_stats(current_user['id'])
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/subscription/status")
async def get_subscription_status(
    current_user: dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service)
):
    """
    Get subscription status for the current gérant
    
    Checks:
    1. Workspace trial status (priority)
    2. Stripe subscription status
    3. Local database subscription fallback
    
    Returns:
        Dict with subscription details, plan, seats, trial info
    """
    try:
        status = await gerant_service.get_subscription_status(current_user['id'])
        return status
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stores")
async def get_all_stores(
    current_user: dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service)
):
    """
    Get all active stores for the current gérant
    
    Returns:
        List of stores with their details
    """
    try:
        stores = await gerant_service.get_all_stores(current_user['id'])
        return stores
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/managers")
async def get_all_managers(
    current_user: dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service)
):
    """
    Get all managers (active and suspended, excluding deleted)
    
    Returns:
        List of managers with their details (password excluded)
    """
    try:
        managers = await gerant_service.get_all_managers(current_user['id'])
        return managers
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sellers")
async def get_all_sellers(
    current_user: dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service)
):
    """
    Get all sellers (active and suspended, excluding deleted)
    
    Returns:
        List of sellers with their details (password excluded)
    """
    try:
        sellers = await gerant_service.get_all_sellers(current_user['id'])
        return sellers
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stores/{store_id}/stats")
async def get_store_stats(
    store_id: str,
    period_type: str = Query('week', regex='^(week|month|year)$'),
    period_offset: int = Query(0, ge=-52, le=52),
    current_user: dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service)
):
    """
    Get detailed statistics for a specific store
    
    Args:
        store_id: Store ID
        period_type: 'week', 'month', or 'year'
        period_offset: Number of periods to offset (0=current, -1=previous, +1=next)
        
    Returns:
        Dict with store stats, period KPIs, evolution, team counts
    """
    try:
        stats = await gerant_service.get_store_stats(
            store_id=store_id,
            gerant_id=current_user['id'],
            period_type=period_type,
            period_offset=period_offset
        )
        return stats
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



# ===== STORE DETAIL ROUTES (CRITICAL FOR FRONTEND) =====

@router.get("/stores/{store_id}/managers")
async def get_store_managers(
    store_id: str,
    current_user: Dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service)
):
    """Get all managers for a specific store"""
    try:
        return await gerant_service.get_store_managers(store_id, current_user['id'])
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))




@router.get("/stores/{store_id}/sellers")
async def get_store_sellers(
    store_id: str,
    current_user: Dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service)
):
    """Get all sellers for a specific store"""
    try:
        return await gerant_service.get_store_sellers(store_id, current_user['id'])
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/stores/{store_id}/kpi-overview")
async def get_store_kpi_overview(
    store_id: str,
    date: str = None,
    current_user: Dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service)
):
    """Get consolidated store KPI overview for a specific date"""
    try:
        return await gerant_service.get_store_kpi_overview(store_id, current_user['id'], date)
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/stores/{store_id}/kpi-history")
async def get_store_kpi_history(
    store_id: str,
    days: int = 30,
    current_user: Dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service)
):
    """
    Get historical KPI data for a specific store
    
    Args:
        store_id: Store identifier
        days: Number of days to retrieve (default: 30)
    
    Returns:
        List of daily aggregated KPI data sorted by date
    
    Security: Verify that the store belongs to the current gérant
    """
    try:
        return await gerant_service.get_store_kpi_history(store_id, current_user['id'], days)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stores/{store_id}/available-years")
async def get_store_available_years(
    store_id: str,
    current_user: Dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service)
):
    """
    Get available years with KPI data for this store
    
    Returns list of years (integers) in descending order (most recent first)
    Used for date filter dropdowns in the frontend
    
    Security: Verify that the store belongs to the current gérant
    """
    try:
        return await gerant_service.get_store_available_years(store_id, current_user['id'])
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))




# ===== SELLER MANAGEMENT ROUTES =====

@router.post("/sellers/{seller_id}/transfer")
async def transfer_seller_to_store(
    seller_id: str,
    transfer_data: Dict,
    current_user: Dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service)
):
    """
    Transfer a seller to another store with a new manager
    
    Args:
        seller_id: Seller user ID
        transfer_data: {
            "new_store_id": "store_uuid",
            "new_manager_id": "manager_uuid"
        }
    
    Security:
        - Verifies seller belongs to current gérant
        - Verifies new store belongs to current gérant
        - Verifies new store is active
        - Verifies new manager exists in new store
    
    Auto-reactivation:
        - If seller was suspended due to inactive store, automatically reactivates
    """
    try:
        return await gerant_service.transfer_seller_to_store(
            seller_id, transfer_data, current_user['id']
        )
    except ValueError as e:
        # Determine appropriate status code based on error message
        error_msg = str(e)
        if "Invalid transfer data" in error_msg:
            raise HTTPException(status_code=400, detail=error_msg)
        elif "inactif" in error_msg:
            raise HTTPException(status_code=400, detail=error_msg)
        else:
            raise HTTPException(status_code=404, detail=error_msg)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ===== INVITATION ROUTES =====

@router.post("/invitations")
async def send_invitation(
    invitation_data: Dict,
    current_user: Dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service)
):
    """
    Send an invitation to a new manager or seller.
    
    Args:
        invitation_data: {
            "name": "John Doe",
            "email": "john@example.com",
            "role": "manager" | "seller",
            "store_id": "store_uuid"
        }
    """
    try:
        result = await gerant_service.send_invitation(
            invitation_data, current_user['id']
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/invitations")
async def get_invitations(
    current_user: Dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service)
):
    """Get all invitations sent by this gérant"""
    try:
        return await gerant_service.get_invitations(current_user['id'])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/invitations/{invitation_id}")
async def cancel_invitation(
    invitation_id: str,
    current_user: Dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service)
):
    """Cancel a pending invitation"""
    try:
        return await gerant_service.cancel_invitation(invitation_id, current_user['id'])
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

