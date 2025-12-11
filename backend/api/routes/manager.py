"""
Manager Routes
Team management, KPIs, objectives, challenges for managers
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional

from core.security import get_current_user
from services.manager_service import ManagerService
from api.dependencies import get_manager_service

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
    current_user: dict = Depends(verify_manager_or_gerant)
):
    """
    Create a new API key for integrations
    
    Accessible by both Manager and Gérant roles
    Used for external integrations (N8N, Zapier, etc.)
    """
    from uuid import uuid4
    from datetime import datetime, timezone, timedelta
    import secrets
    from core.database import database
    from models.api_keys import APIKeyResponse
    
    db = database.db
    
    # Generate secure API key
    def generate_api_key() -> str:
        random_part = secrets.token_urlsafe(32)
        return f"rp_live_{random_part}"
    
    # Generate unique key
    api_key = generate_api_key()
    
    # Calculate expiration
    expires_at = None
    if key_data.get('expires_days'):
        expires_at = (datetime.now(timezone.utc) + timedelta(days=key_data['expires_days'])).isoformat()
    
    # Create record
    key_id = str(uuid4())
    key_record = {
        "id": key_id,
        "user_id": current_user['id'],
        "store_id": current_user.get('store_id'),
        "gerant_id": current_user.get('id') if current_user['role'] in ['gerant', 'gérant'] else None,
        "key": api_key,
        "name": key_data.get('name', 'API Key'),
        "permissions": key_data.get('permissions', ["write:kpi", "read:stats"]),
        "store_ids": key_data.get('store_ids'),  # None = all stores
        "active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "last_used_at": None,
        "expires_at": expires_at
    }
    
    await db.api_keys.insert_one(key_record)
    
    return {
        "id": key_id,
        "name": key_record["name"],
        "key": api_key,  # Only shown at creation
        "permissions": key_record["permissions"],
        "active": True,
        "created_at": key_record["created_at"],
        "last_used_at": None,
        "expires_at": expires_at,
        "store_ids": key_record.get("store_ids")
    }


@router.get("/api-keys")
async def list_api_keys(
    current_user: dict = Depends(verify_manager_or_gerant)
):
    """
    List all API keys for current user
    
    Accessible by both Manager and Gérant roles
    Returns list of API keys (without the actual key value for security)
    """
    from core.database import database
    
    db = database.db
    
    # Find keys - CRITICAL: Exclude _id to avoid MongoDB ObjectId serialization issues
    query = {"user_id": current_user['id']}
    keys_cursor = db.api_keys.find(query, {"_id": 0, "key": 0})  # Don't return _id or actual key
    keys = await keys_cursor.to_list(100)
    
    return {"api_keys": keys}


@router.delete("/api-keys/{key_id}")
async def delete_api_key(
    key_id: str,
    current_user: dict = Depends(verify_manager_or_gerant)
):
    """
    Delete (deactivate) an API key
    
    Accessible by both Manager and Gérant roles
    Deactivates the key instead of deleting for audit trail
    """
    from datetime import datetime, timezone
    from core.database import database
    
    db = database.db
    
    # Verify ownership
    key = await db.api_keys.find_one({"id": key_id, "user_id": current_user['id']})
    if not key:
        raise HTTPException(status_code=404, detail="API key not found")
    
    # Deactivate instead of delete (for audit)
    await db.api_keys.update_one(
        {"id": key_id},
        {"$set": {"active": False, "deleted_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "API key deactivated successfully"}


@router.post("/api-keys/{key_id}/regenerate")
async def regenerate_api_key(
    key_id: str,
    current_user: dict = Depends(verify_manager_or_gerant)
):
    """
    Regenerate an API key (creates new key, deactivates old)
    
    Accessible by both Manager and Gérant roles
    Useful when key is compromised or needs rotation
    """
    from uuid import uuid4
    from datetime import datetime, timezone
    import secrets
    from core.database import database
    
    db = database.db
    
    # Generate secure API key
    def generate_api_key() -> str:
        random_part = secrets.token_urlsafe(32)
        return f"rp_live_{random_part}"
    
    # Find old key
    old_key = await db.api_keys.find_one({"id": key_id, "user_id": current_user['id']})
    if not old_key:
        raise HTTPException(status_code=404, detail="API key not found")
    
    # Deactivate old key
    await db.api_keys.update_one(
        {"id": key_id},
        {"$set": {"active": False, "regenerated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Create new key with same settings
    new_api_key = generate_api_key()
    new_key_id = str(uuid4())
    
    new_key_record = {
        "id": new_key_id,
        "user_id": current_user['id'],
        "store_id": old_key.get('store_id'),
        "gerant_id": old_key.get('gerant_id'),
        "key": new_api_key,
        "name": old_key['name'],
        "permissions": old_key['permissions'],
        "store_ids": old_key.get('store_ids'),  # Preserve store access
        "active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "last_used_at": None,
        "expires_at": old_key.get('expires_at'),
        "previous_key_id": key_id
    }
    
    await db.api_keys.insert_one(new_key_record)
    
    return {
        "id": new_key_id,
        "name": new_key_record["name"],
        "key": new_api_key,  # Only shown at regeneration
        "permissions": new_key_record["permissions"],
        "active": True,
        "created_at": new_key_record["created_at"],
        "last_used_at": None,
        "expires_at": new_key_record.get("expires_at"),
        "store_ids": new_key_record.get("store_ids")
    }


@router.delete("/api-keys/{key_id}/permanent")
async def delete_api_key_permanent(
    key_id: str,
    current_user: dict = Depends(verify_manager_or_gerant)
):
    """
    Permanently delete an inactive API key
    
    Accessible by both Manager and Gérant roles
    Can only delete keys that have been deactivated first
    """
    from core.database import database
    
    db = database.get_db()
    
    # Find the key and verify ownership
    key = await db.api_keys.find_one({"id": key_id}, {"_id": 0})
    
    if not key:
        raise HTTPException(status_code=404, detail="API key not found")
    
    # Verify ownership
    if current_user['role'] == 'manager':
        if key.get('user_id') != current_user['id']:
            raise HTTPException(status_code=403, detail="Not authorized to delete this key")
    elif current_user['role'] in ['gerant', 'gérant']:
        if key.get('gerant_id') != current_user['id']:
            raise HTTPException(status_code=403, detail="Not authorized to delete this key")
    
    # Only allow deletion of inactive keys
    if key.get('active'):
        raise HTTPException(status_code=400, detail="Cannot permanently delete an active key. Deactivate it first.")
    
    # Permanently delete the key
    await db.api_keys.delete_one({"id": key_id})
    
    return {"success": True, "message": "API key permanently deleted"}

