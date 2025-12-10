"""
Enterprise Routes
API endpoints for enterprise account management, API keys, and bulk synchronization
"""
from fastapi import APIRouter, HTTPException, Depends, Header
from typing import Optional

from models.enterprise import (
    EnterpriseAccountCreate, EnterpriseAccountUpdate,
    APIKeyCreate, BulkUserImport, BulkStoreImport
)
from services.enterprise_service import EnterpriseService
from api.dependencies import get_enterprise_service
from core.security import get_current_user

router = APIRouter(prefix="/enterprise", tags=["Enterprise"])


# ============================================
# API KEY AUTHENTICATION
# ============================================

async def verify_api_key_header(
    x_api_key: str = Header(...),
    enterprise_service: EnterpriseService = Depends(get_enterprise_service)
) -> dict:
    """Verify API key from header"""
    api_key = await enterprise_service.verify_api_key(x_api_key)
    
    if not api_key:
        raise HTTPException(status_code=401, detail="Invalid or expired API key")
    
    return api_key


async def verify_it_admin(
    current_user: dict = Depends(get_current_user)
) -> dict:
    """Verify current user is IT Admin"""
    if current_user.get('role') != 'it_admin':
        raise HTTPException(status_code=403, detail="Access restricted to IT Admins")
    
    return current_user


# ============================================
# ENTERPRISE ACCOUNT MANAGEMENT
# ============================================

@router.post("/register")
async def register_enterprise_account(
    data: EnterpriseAccountCreate,
    enterprise_service: EnterpriseService = Depends(get_enterprise_service)
):
    """
    Self-service registration for enterprise account
    Creates enterprise account and first IT Admin
    """
    try:
        result = await enterprise_service.create_enterprise_account(
            company_name=data.company_name,
            company_email=data.company_email,
            sync_mode=data.sync_mode,
            it_admin_name=data.it_admin_name,
            it_admin_email=data.it_admin_email,
            it_admin_password=data.it_admin_password
        )
        
        return {
            "success": True,
            "message": "Enterprise account created successfully",
            **result
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create enterprise account: {str(e)}")


@router.get("/config")
async def get_enterprise_config(
    current_user: dict = Depends(verify_it_admin),
    enterprise_service: EnterpriseService = Depends(get_enterprise_service)
):
    """Get enterprise account configuration"""
    try:
        config = await enterprise_service.get_enterprise_config(
            current_user.get('enterprise_account_id')
        )
        return config
        
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/config")
async def update_enterprise_config(
    update_data: EnterpriseAccountUpdate,
    current_user: dict = Depends(verify_it_admin),
    enterprise_service: EnterpriseService = Depends(get_enterprise_service)
):
    """Update enterprise account configuration"""
    try:
        update_dict = update_data.model_dump(exclude_none=True)
        
        success = await enterprise_service.update_enterprise_config(
            current_user.get('enterprise_account_id'),
            update_dict
        )
        
        if not success:
            raise HTTPException(status_code=404, detail="Enterprise account not found")
        
        return {"success": True, "message": "Enterprise configuration updated successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# API KEY MANAGEMENT
# ============================================

@router.post("/api-keys/generate")
async def generate_api_key(
    key_data: APIKeyCreate,
    current_user: dict = Depends(verify_it_admin),
    enterprise_service: EnterpriseService = Depends(get_enterprise_service)
):
    """Generate new API key for provisioning"""
    try:
        result = await enterprise_service.generate_api_key(
            enterprise_id=current_user.get('enterprise_account_id'),
            created_by=current_user['id'],
            name=key_data.name,
            scopes=key_data.scopes or ["users:read", "users:write", "stores:read", "stores:write"],
            expires_in_days=key_data.expires_in_days
        )
        
        return {
            **result,
            "warning": "⚠️ Sauvegardez cette clé maintenant, elle ne sera plus affichée"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api-keys")
async def list_api_keys(
    current_user: dict = Depends(verify_it_admin),
    enterprise_service: EnterpriseService = Depends(get_enterprise_service)
):
    """List all API keys for enterprise account"""
    try:
        api_keys = await enterprise_service.list_api_keys(
            current_user.get('enterprise_account_id')
        )
        
        return {"api_keys": api_keys}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/api-keys/{key_id}")
async def revoke_api_key(
    key_id: str,
    current_user: dict = Depends(verify_it_admin),
    enterprise_service: EnterpriseService = Depends(get_enterprise_service)
):
    """Revoke (deactivate) an API key"""
    try:
        success = await enterprise_service.revoke_api_key(
            key_id,
            current_user.get('enterprise_account_id')
        )
        
        if not success:
            raise HTTPException(status_code=404, detail="API key not found")
        
        return {"success": True, "message": "API key revoked successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# SYNC STATUS & MONITORING
# ============================================

@router.get("/sync-status")
async def get_sync_status(
    current_user: dict = Depends(verify_it_admin),
    enterprise_service: EnterpriseService = Depends(get_enterprise_service)
):
    """Get synchronization status for enterprise account"""
    try:
        status = await enterprise_service.get_sync_status(
            current_user.get('enterprise_account_id')
        )
        return status
        
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sync-logs")
async def get_sync_logs(
    limit: int = 50,
    operation: Optional[str] = None,
    status: Optional[str] = None,
    current_user: dict = Depends(verify_it_admin),
    enterprise_service: EnterpriseService = Depends(get_enterprise_service)
):
    """Get synchronization logs"""
    try:
        logs = await enterprise_service.get_sync_logs(
            enterprise_id=current_user.get('enterprise_account_id'),
            limit=limit,
            operation=operation,
            status=status
        )
        
        return {"logs": logs, "total": len(logs)}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# BULK IMPORT ENDPOINTS (API KEY AUTH)
# ============================================

@router.post("/users/bulk-import")
async def bulk_import_users(
    import_data: BulkUserImport,
    api_key: dict = Depends(verify_api_key_header),
    enterprise_service: EnterpriseService = Depends(get_enterprise_service)
):
    """
    Bulk import users via API REST
    
    Format for each user:
    {
        "email": "user@example.com",
        "name": "John Doe",
        "role": "manager" | "seller",
        "store_id": "store-uuid",
        "manager_id": "manager-uuid" (required if role=seller),
        "external_id": "SAP-12345" (optional, ID in source system)
    }
    """
    try:
        results = await enterprise_service.bulk_import_users(
            enterprise_id=api_key['enterprise_account_id'],
            users=import_data.users,
            mode=import_data.mode,
            api_key_id=api_key['id'],
            send_invitations=import_data.send_invitations
        )
        
        return {
            "success": results["failed"] == 0,
            "total_processed": results["total_processed"],
            "created": results["created"],
            "updated": results["updated"],
            "failed": results["failed"],
            "errors": results["errors"]
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/stores/bulk-import")
async def bulk_import_stores(
    import_data: BulkStoreImport,
    api_key: dict = Depends(verify_api_key_header),
    enterprise_service: EnterpriseService = Depends(get_enterprise_service)
):
    """
    Bulk import stores via API REST
    
    Format for each store:
    {
        "name": "Store Name",
        "location": "Paris 75001",
        "external_id": "SAP-STORE-123" (optional),
        "address": "123 rue Example" (optional),
        "phone": "+33123456789" (optional)
    }
    """
    try:
        results = await enterprise_service.bulk_import_stores(
            enterprise_id=api_key['enterprise_account_id'],
            stores=import_data.stores,
            mode=import_data.mode,
            api_key_id=api_key['id']
        )
        
        return {
            "success": results["failed"] == 0,
            "total_processed": results["total_processed"],
            "created": results["created"],
            "updated": results["updated"],
            "failed": results["failed"],
            "errors": results["errors"]
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
