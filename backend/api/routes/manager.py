"""
Manager Routes
Team management, KPIs, objectives, challenges for managers
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional

from core.security import get_current_user
from services.manager_service import ManagerService, APIKeyService
from api.dependencies import get_manager_service, get_api_key_service

router = APIRouter(prefix="/manager", tags=["Manager"])


async def verify_manager(current_user: dict = Depends(get_current_user)) -> dict:
    """Verify current user is a manager"""
    if current_user.get('role') != 'manager':
        raise HTTPException(status_code=403, detail="Access restricted to managers")
    return current_user


@router.get("/sellers")
async def get_sellers(
    current_user: dict = Depends(verify_manager),
    manager_service: ManagerService = Depends(get_manager_service)
):
    """
    Get all sellers for manager's store
    
    Returns list of sellers (active and suspended, excluding deleted)
    """
    try:
        store_id = current_user.get('store_id')
        if not store_id:
            raise HTTPException(status_code=400, detail="Manager not assigned to a store")
        
        sellers = await manager_service.get_sellers(
            manager_id=current_user['id'],
            store_id=store_id
        )
        return sellers
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/invitations")
async def get_invitations(
    current_user: dict = Depends(verify_manager),
    manager_service: ManagerService = Depends(get_manager_service)
):
    """Get pending invitations created by manager"""
    try:
        invitations = await manager_service.get_invitations(current_user['id'])
        return invitations
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sync-mode")
async def get_sync_mode(
    current_user: dict = Depends(verify_manager),
    manager_service: ManagerService = Depends(get_manager_service)
):
    """Get sync mode configuration for manager's store"""
    try:
        store_id = current_user.get('store_id')
        if not store_id:
            raise HTTPException(status_code=400, detail="Manager not assigned to a store")
        
        config = await manager_service.get_sync_mode(store_id)
        return config
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/kpi-config")
async def get_kpi_config(
    current_user: dict = Depends(verify_manager),
    manager_service: ManagerService = Depends(get_manager_service)
):
    """Get KPI configuration for manager's store"""
    try:
        store_id = current_user.get('store_id')
        if not store_id:
            raise HTTPException(status_code=400, detail="Manager not assigned to a store")
        
        config = await manager_service.get_kpi_config(store_id)
        return config
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/team-bilans/all")
async def get_team_bilans_all(
    current_user: dict = Depends(verify_manager),
    manager_service: ManagerService = Depends(get_manager_service)
):
    """Get all team bilans for manager"""
    try:
        store_id = current_user.get('store_id')
        if not store_id:
            raise HTTPException(status_code=400, detail="Manager not assigned to a store")
        
        bilans = await manager_service.get_team_bilans_all(
            manager_id=current_user['id'],
            store_id=store_id
        )
        return bilans
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/store-kpi/stats")
async def get_store_kpi_stats(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_user: dict = Depends(verify_manager),
    manager_service: ManagerService = Depends(get_manager_service)
):
    """
    Get aggregated KPI statistics for manager's store
    
    Args:
        start_date: Start date (YYYY-MM-DD), defaults to first day of current month
        end_date: End date (YYYY-MM-DD), defaults to today
    """
    try:
        store_id = current_user.get('store_id')
        if not store_id:
            raise HTTPException(status_code=400, detail="Manager not assigned to a store")
        
        stats = await manager_service.get_store_kpi_stats(
            store_id=store_id,
            start_date=start_date,
            end_date=end_date
        )
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/objectives/active")
async def get_active_objectives(
    current_user: dict = Depends(verify_manager),
    manager_service: ManagerService = Depends(get_manager_service)
):
    """Get active objectives for manager's team"""
    try:
        store_id = current_user.get('store_id')
        if not store_id:
            raise HTTPException(status_code=400, detail="Manager not assigned to a store")
        
        objectives = await manager_service.get_active_objectives(
            manager_id=current_user['id'],
            store_id=store_id
        )
        return objectives
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/challenges/active")
async def get_active_challenges(
    current_user: dict = Depends(verify_manager),
    manager_service: ManagerService = Depends(get_manager_service)
):
    """Get active challenges for manager's team"""
    try:
        store_id = current_user.get('store_id')
        if not store_id:
            raise HTTPException(status_code=400, detail="Manager not assigned to a store")
        
        challenges = await manager_service.get_active_challenges(
            manager_id=current_user['id'],
            store_id=store_id
        )
        return challenges
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



# ===== API KEYS MANAGEMENT =====
# NOTE: These routes are accessible by both Manager AND Gérant roles
# The frontend uses /api/manager/api-keys for both roles

async def verify_manager_or_gerant(current_user: dict = Depends(get_current_user)) -> dict:
    """Verify current user is a manager or gérant"""
    if current_user.get('role') not in ['manager', 'gerant', 'gérant']:
        raise HTTPException(status_code=403, detail="Only managers and gérants can manage API keys")
    return current_user


@router.post("/api-keys")
async def create_api_key(
    key_data: dict,
    current_user: dict = Depends(verify_manager_or_gerant),
    api_key_service: APIKeyService = Depends(get_api_key_service)
):
    """
    Create a new API key for integrations
    
    Accessible by both Manager and Gérant roles
    Used for external integrations (N8N, Zapier, etc.)
    """
    try:
        gerant_id = current_user.get('id') if current_user['role'] in ['gerant', 'gérant'] else None
        
        result = await api_key_service.create_api_key(
            user_id=current_user['id'],
            store_id=current_user.get('store_id'),
            gerant_id=gerant_id,
            name=key_data.get('name', 'API Key'),
            permissions=key_data.get('permissions', ["write:kpi", "read:stats"]),
            store_ids=key_data.get('store_ids'),
            expires_days=key_data.get('expires_days')
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/api-keys")
async def list_api_keys(
    current_user: dict = Depends(verify_manager_or_gerant),
    api_key_service: APIKeyService = Depends(get_api_key_service)
):
    """
    List all API keys for current user
    
    Accessible by both Manager and Gérant roles
    Returns list of API keys (without the actual key value for security)
    """
    try:
        return await api_key_service.list_api_keys(current_user['id'])
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/api-keys/{key_id}")
async def delete_api_key(
    key_id: str,
    current_user: dict = Depends(verify_manager_or_gerant),
    api_key_service: APIKeyService = Depends(get_api_key_service)
):
    """
    Delete (deactivate) an API key
    
    Accessible by both Manager and Gérant roles
    Deactivates the key instead of deleting for audit trail
    """
    try:
        return await api_key_service.deactivate_api_key(key_id, current_user['id'])
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/api-keys/{key_id}/regenerate")
async def regenerate_api_key(
    key_id: str,
    current_user: dict = Depends(verify_manager_or_gerant),
    api_key_service: APIKeyService = Depends(get_api_key_service)
):
    """
    Regenerate an API key (creates new key, deactivates old)
    
    Accessible by both Manager and Gérant roles
    Useful when key is compromised or needs rotation
    """
    try:
        return await api_key_service.regenerate_api_key(key_id, current_user['id'])
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/api-keys/{key_id}/permanent")
async def delete_api_key_permanent(
    key_id: str,
    current_user: dict = Depends(verify_manager_or_gerant),
    api_key_service: APIKeyService = Depends(get_api_key_service)
):
    """
    Permanently delete an inactive API key
    
    Accessible by both Manager and Gérant roles
    Can only delete keys that have been deactivated first
    """
    try:
        return await api_key_service.delete_api_key_permanent(
            key_id, 
            current_user['id'],
            current_user['role']
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

