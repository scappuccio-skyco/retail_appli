"""Integration Routes - API Keys and External Systems - Clean Architecture"""
from fastapi import APIRouter, Depends, HTTPException, Header
from typing import Dict, Optional, List
from datetime import datetime, timezone
from uuid import uuid4
import logging
from motor.motor_asyncio import AsyncIOMotorDatabase

from models.integrations import (
    APIKeyCreate, KPISyncRequest, APIStoreCreate, 
    APIManagerCreate, APISellerCreate, APIUserUpdate
)
from services.kpi_service import KPIService
from services.integration_service import IntegrationService
from services.store_service import StoreService
from services.gerant_service import GerantService
from repositories.user_repository import UserRepository
from api.dependencies import get_kpi_service, get_integration_service
from core.database import get_db
from core.security import get_current_gerant, get_password_hash

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/integrations", tags=["Integrations"])


# ===== API KEY MANAGEMENT =====

@router.post("/api-keys")
async def create_api_key(
    key_data: APIKeyCreate,
    current_user: Dict = Depends(get_current_gerant),
    integration_service: IntegrationService = Depends(get_integration_service)
):
    """Create new API key for integrations"""
    try:
        return await integration_service.create_api_key(
            user_id=current_user['id'],
            name=key_data.name,
            permissions=key_data.permissions,
            expires_days=key_data.expires_days,
            store_ids=key_data.store_ids
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/api-keys")
async def list_api_keys(
    current_user: Dict = Depends(get_current_gerant),
    integration_service: IntegrationService = Depends(get_integration_service)
):
    """List all API keys for current user"""
    try:
        return await integration_service.list_api_keys(current_user['id'])
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ===== API KEY VERIFICATION =====

async def verify_api_key(
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
    authorization: Optional[str] = Header(None),
    integration_service: IntegrationService = Depends(get_integration_service)
) -> Dict:
    """
    Verify API key from header.
    Supports both X-API-Key header and Authorization: Bearer <API_KEY> (not JWT).
    """
    # Try X-API-Key first
    api_key = x_api_key
    
    # If not found, try Authorization header
    if not api_key and authorization:
        if authorization.startswith("Bearer "):
            api_key = authorization[7:]  # Remove "Bearer " prefix
        else:
            api_key = authorization
    
    if not api_key:
        raise HTTPException(
            status_code=401, 
            detail="API key required. Use X-API-Key header or Authorization: Bearer <API_KEY>"
        )
    
    try:
        api_key_data = await integration_service.verify_api_key(api_key)
        return api_key_data
    except ValueError as e:
        error_message = str(e)
        logger.warning(f"API key verification failed: {error_message}")
        raise HTTPException(
            status_code=401, 
            detail=error_message
        )
    except Exception as e:
        logger.error(f"Unexpected error during API key verification: {e}", exc_info=True)
        raise HTTPException(
            status_code=401,
            detail="Invalid or inactive API Key"
        )


# ===== SECURITY MIDDLEWARES =====

def verify_api_key_with_scope(required_scope: str):
    """
    Factory function to create a dependency that verifies API key and checks scope.
    
    Usage:
        @router.get("/stores")
        async def list_stores(
            api_key_data: Dict = Depends(verify_api_key_with_scope("stores:read"))
        ):
            ...
    """
    async def _verify_scope(
        x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
        authorization: Optional[str] = Header(None),
        integration_service: IntegrationService = Depends(get_integration_service)
    ) -> Dict:
        api_key_data = await verify_api_key(x_api_key, authorization, integration_service)
        permissions = api_key_data.get('permissions', [])
        if required_scope not in permissions:
            raise HTTPException(
                status_code=403,
                detail=f"Insufficient permissions. Requires '{required_scope}'"
            )
        return api_key_data
    return _verify_scope


async def verify_store_access(
    store_id: str,
    api_key_data: Dict,
    integration_service: IntegrationService,
    db: AsyncIOMotorDatabase
) -> Dict:
    """
    Verify that the API key has access to the specified store_id.
    
    Args:
        store_id: Store ID to verify access for
        api_key_data: API key data from verify_api_key_with_scope
        integration_service: Integration service instance
        db: Database instance
    
    Returns:
        Store document if accessible
    
    Raises:
        HTTPException: 404 if store not found, 403 if access denied
    """
    # Get tenant_id from API key (source of truth)
    tenant_id = await integration_service.get_tenant_id_from_api_key(api_key_data)
    if not tenant_id:
        raise HTTPException(status_code=403, detail="Invalid API key configuration: missing tenant_id")
    
    # Check if the store exists and belongs to the tenant
    store_service = StoreService(db)
    store = await store_service.get_store_by_id(store_id)
    
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    
    # Normalize IDs for comparison
    store_gerant_id = str(store.get('gerant_id') or '')
    tenant_id_str = str(tenant_id)
    
    if store_gerant_id != tenant_id_str:
        raise HTTPException(status_code=404, detail="Store not found or not accessible by this tenant")
    
    # CRITIQUE: Vérification 2 - store_ids restriction
    store_ids = api_key_data.get('store_ids')
    if store_ids is not None:
        # Check if key is restricted (not "*" and not None)
        if "*" not in store_ids:
            # Key is restricted - check if store_id is in the list
            store_id_str = str(store_id)
            if store_id_str not in [str(sid) for sid in store_ids]:
                raise HTTPException(
                    status_code=403,
                    detail="API key does not have access to this store (not in store_ids list)"
                )
    
    return store


# ===== CRUD ENDPOINTS =====

@router.get("/stores")
async def list_stores(
    api_key_data: Dict = Depends(verify_api_key_with_scope("stores:read")),
    integration_service: IntegrationService = Depends(get_integration_service),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """List all stores accessible by the API key"""
    tenant_id = await integration_service.get_tenant_id_from_api_key(api_key_data)
    if not tenant_id:
        raise HTTPException(status_code=403, detail="Invalid API key configuration")
    
    store_service = StoreService(db)
    stores = await store_service.get_stores_by_gerant(tenant_id)
    
    # Filter by store_ids if restricted
    store_ids = api_key_data.get('store_ids')
    if store_ids is not None and "*" not in store_ids:
        stores = [s for s in stores if str(s.get('id')) in [str(sid) for sid in store_ids]]
    
    return {"stores": stores}


@router.post("/stores")
async def create_store(
    store_data: APIStoreCreate,
    api_key_data: Dict = Depends(verify_api_key_with_scope("stores:write")),
    integration_service: IntegrationService = Depends(get_integration_service),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Create a new store"""
    tenant_id = await integration_service.get_tenant_id_from_api_key(api_key_data)
    if not tenant_id:
        raise HTTPException(status_code=403, detail="Invalid API key configuration")
    
    gerant_service = GerantService(db)
    
    # Build store dict with proper handling of optional fields
    store_dict = {
        "name": store_data.name,
        "location": store_data.location,
        "address": store_data.address or "",
        "phone": store_data.phone or "",
        "opening_hours": store_data.opening_hours or ""
    }
    
    # Add external_id if provided
    if store_data.external_id:
        store_dict["external_id"] = store_data.external_id
    
    try:
        store = await gerant_service.create_store(store_dict, tenant_id)
        
        # Add external_id to the returned store if it was provided
        if store_data.external_id:
            store["external_id"] = store_data.external_id
            # Update in database if needed
            await db.stores.update_one(
                {"id": store["id"]},
                {"$set": {"external_id": store_data.external_id}}
            )
        
        return {"success": True, "store": store}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating store: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to create store: {str(e)}")


@router.get("/stores/{store_id}/managers")
async def list_managers(
    store_id: str,
    api_key_data: Dict = Depends(verify_api_key_with_scope("stores:read")),
    integration_service: IntegrationService = Depends(get_integration_service),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """
    List all managers for a store.
    Requires stores:read permission.
    """
    # Verify store access FIRST
    store = await verify_store_access(store_id, api_key_data, integration_service, db)
    
    tenant_id = await integration_service.get_tenant_id_from_api_key(api_key_data)
    
    # Get managers using GerantService
    gerant_service = GerantService(db)
    
    try:
        managers = await gerant_service.get_store_managers(store_id, tenant_id)
        return {"managers": managers}
    except Exception as e:
        logger.error(f"Error listing managers: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to list managers: {str(e)}")


@router.post("/stores/{store_id}/managers")
async def create_manager(
    store_id: str,
    manager_data: APIManagerCreate,
    api_key_data: Dict = Depends(verify_api_key_with_scope("users:write")),
    integration_service: IntegrationService = Depends(get_integration_service),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """
    Create a new manager for a store.
    CRITIQUE: store_id is forced from path, any store_id in body is ignored.
    """
    # Verify store access FIRST
    store = await verify_store_access(store_id, api_key_data, integration_service, db)
    
    tenant_id = await integration_service.get_tenant_id_from_api_key(api_key_data)
    user_repo = UserRepository(db)
    
    # Check if email already exists
    existing_user = await user_repo.find_by_email(manager_data.email)
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create manager user - store_id is FORCED from path
    manager_id = str(uuid4())
    temp_password = "TempPassword123!"
    
    manager = {
        "id": manager_id,
        "name": manager_data.name,
        "email": manager_data.email,
        "password": get_password_hash(temp_password),
        "role": "manager",
        "status": "active",
        "phone": manager_data.phone,
        "gerant_id": tenant_id,  # From API key tenant
        "store_id": store_id,  # FORCED from path, ignoring any body.store_id
        "external_id": manager_data.external_id,
        "sync_mode": "api_sync",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(manager)
    
    return {
        "success": True,
        "manager_id": manager_id,
        "manager": {
            "id": manager_id,
            "name": manager_data.name,
            "email": manager_data.email,
            "store_id": store_id,
            "external_id": manager_data.external_id
        }
    }


@router.get("/stores/{store_id}/sellers")
async def list_sellers(
    store_id: str,
    api_key_data: Dict = Depends(verify_api_key_with_scope("stores:read")),
    integration_service: IntegrationService = Depends(get_integration_service),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """
    List all sellers for a store.
    Requires stores:read permission.
    """
    # Verify store access FIRST
    store = await verify_store_access(store_id, api_key_data, integration_service, db)
    
    tenant_id = await integration_service.get_tenant_id_from_api_key(api_key_data)
    
    # Get sellers using GerantService
    gerant_service = GerantService(db)
    
    try:
        sellers = await gerant_service.get_store_sellers(store_id, tenant_id)
        return {"sellers": sellers}
    except Exception as e:
        logger.error(f"Error listing sellers: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to list sellers: {str(e)}")


@router.post("/stores/{store_id}/sellers")
async def create_seller(
    store_id: str,
    seller_data: APISellerCreate,
    api_key_data: Dict = Depends(verify_api_key_with_scope("users:write")),
    integration_service: IntegrationService = Depends(get_integration_service),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """
    Create a new seller for a store.
    CRITIQUE: store_id is forced from path, any store_id in body is ignored.
    """
    # Verify store access FIRST
    store = await verify_store_access(store_id, api_key_data, integration_service, db)
    
    tenant_id = await integration_service.get_tenant_id_from_api_key(api_key_data)
    user_repo = UserRepository(db)
    
    # Check if email already exists
    existing_user = await user_repo.find_by_email(seller_data.email)
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Verify manager if provided
    manager_id = seller_data.manager_id
    if manager_id:
        manager = await user_repo.find_one({
            "id": manager_id,
            "role": "manager",
            "store_id": store_id
        })
        if not manager:
            raise HTTPException(status_code=404, detail="Manager not found in this store")
    else:
        # Find a manager in the store
        manager = await user_repo.find_one({
            "role": "manager",
            "store_id": store_id,
            "status": "active"
        })
        if manager:
            manager_id = str(manager.get("id") or manager.get("_id"))
    
    # Create seller user - store_id is FORCED from path
    seller_id = str(uuid4())
    temp_password = "TempPassword123!"
    
    seller = {
        "id": seller_id,
        "name": seller_data.name,
        "email": seller_data.email,
        "password": get_password_hash(temp_password),
        "role": "seller",
        "status": "active",
        "phone": seller_data.phone,
        "gerant_id": tenant_id,  # From API key tenant
        "store_id": store_id,  # FORCED from path, ignoring any body.store_id
        "manager_id": manager_id,
        "external_id": seller_data.external_id,
        "sync_mode": "api_sync",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(seller)
    
    return {
        "success": True,
        "seller_id": seller_id,
        "seller": {
            "id": seller_id,
            "name": seller_data.name,
            "email": seller_data.email,
            "store_id": store_id,
            "manager_id": manager_id,
            "external_id": seller_data.external_id
        }
    }


@router.put("/users/{user_id}")
async def update_user(
    user_id: str,
    user_data: APIUserUpdate,
    api_key_data: Dict = Depends(verify_api_key_with_scope("users:write")),
    integration_service: IntegrationService = Depends(get_integration_service),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """
    Update a user (manager or seller).
    CRITIQUE: Whitelist only, email is FORBIDDEN, tenant/store_id checks enforced.
    """
    tenant_id = await integration_service.get_tenant_id_from_api_key(api_key_data)
    if not tenant_id:
        raise HTTPException(status_code=403, detail="Invalid API key configuration")
    
    user_repo = UserRepository(db)
    
    # Find user - normalize ID lookup
    user = await user_repo.find_by_id(user_id)
    if not user:
        # Try with _id as fallback
        user = await db.users.find_one({"_id": user_id}, {"_id": 0})
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Normalize user data
    user_id_normalized = str(user.get("id") or user.get("_id"))
    role_norm = (user.get("role") or "").strip().lower()
    
    # Calculate user's tenant_id
    if role_norm in ["gerant", "gérant"]:
        user_tenant_id = user_id_normalized
    else:
        user_tenant_id = user.get("gerant_id")
    
    # Verify tenant access
    if not user_tenant_id or str(user_tenant_id) != str(tenant_id):
        raise HTTPException(status_code=403, detail="User does not belong to this tenant")
    
    # VERROUILLAGE STORE_IDS STRICT
    store_ids = api_key_data.get('store_ids')
    user_store_id = user.get("store_id")
    
    if store_ids is not None and "*" not in store_ids:
        # Key is restricted
        if str(api_key_data.get('tenant_id')) == str(tenant_id):
            # Gérant can access all their stores
            pass
        else:
            # Non-gérant: check store_id
            if not user_store_id or str(user_store_id) not in [str(sid) for sid in store_ids]:
                raise HTTPException(
                    status_code=403,
                    detail="API key does not have access to this user's store"
                )
    
    # WHITELIST: Only allow specific fields (email is FORBIDDEN)
    ALLOWED_FIELDS = ["name", "phone", "status", "external_id"]
    
    updates = {k: v for k, v in user_data.model_dump(exclude_unset=True).items() if k in ALLOWED_FIELDS}
    
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    # Validate status if provided
    if "status" in updates:
        if updates["status"] not in ["active", "suspended"]:
            raise HTTPException(status_code=400, detail="Status must be 'active' or 'suspended'")
        if updates["status"] == "suspended":
            updates["deactivated_at"] = datetime.now(timezone.utc).isoformat()
    
    # Update user
    await db.users.update_one(
        {"id": user_id_normalized},
        {"$set": updates}
    )
    
    # Get updated user
    updated_user = await user_repo.find_by_id(user_id_normalized)
    
    return {
        "success": True,
        "user_id": user_id_normalized,
        "user": {
            "id": updated_user['id'],
            "name": updated_user['name'],
            "role": updated_user['role'],
            "status": updated_user.get('status'),
            "phone": updated_user.get('phone'),
            "store_id": updated_user.get('store_id'),
            "external_id": updated_user.get('external_id')
        }
    }


@router.delete("/stores/{store_id}")
async def delete_store(
    store_id: str,
    api_key_data: Dict = Depends(verify_api_key_with_scope("stores:write")),
    integration_service: IntegrationService = Depends(get_integration_service),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """
    Delete (deactivate) a store.
    This is a soft delete - sets active=False and suspends all staff.
    """
    # Verify store access FIRST
    store = await verify_store_access(store_id, api_key_data, integration_service, db)
    
    tenant_id = await integration_service.get_tenant_id_from_api_key(api_key_data)
    gerant_service = GerantService(db)
    
    try:
        result = await gerant_service.delete_store(store_id, tenant_id)
        return {"success": True, "message": result.get("message", "Magasin supprimé avec succès")}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error deleting store: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete store")


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: str,
    api_key_data: Dict = Depends(verify_api_key_with_scope("users:write")),
    integration_service: IntegrationService = Depends(get_integration_service),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """
    Delete (soft delete) a user (manager or seller).
    Sets status to 'deleted'.
    """
    tenant_id = await integration_service.get_tenant_id_from_api_key(api_key_data)
    if not tenant_id:
        raise HTTPException(status_code=403, detail="Invalid API key configuration")
    
    user_repo = UserRepository(db)
    
    # Find user
    user = await user_repo.find_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Normalize user data
    user_id_normalized = str(user.get("id") or user.get("_id"))
    role_norm = (user.get("role") or "").strip().lower()
    
    # Verify it's a manager or seller (not gérant)
    if role_norm in ["gerant", "gérant"]:
        raise HTTPException(status_code=403, detail="Cannot delete gérant via API")
    
    # Calculate user's tenant_id
    user_tenant_id = user.get("gerant_id")
    
    # Verify tenant access
    if not user_tenant_id or str(user_tenant_id) != str(tenant_id):
        raise HTTPException(status_code=403, detail="User does not belong to this tenant")
    
    # VERROUILLAGE STORE_IDS STRICT
    store_ids = api_key_data.get('store_ids')
    user_store_id = user.get("store_id")
    
    if store_ids is not None and "*" not in store_ids:
        # Key is restricted
        if not user_store_id or str(user_store_id) not in [str(sid) for sid in store_ids]:
            raise HTTPException(
                status_code=403,
                detail="API key does not have access to this user's store"
            )
    
    # Use GerantService to delete user (soft delete)
    gerant_service = GerantService(db)
    
    try:
        role = "manager" if role_norm == "manager" else "seller"
        result = await gerant_service.delete_user(user_id_normalized, tenant_id, role)
        return {"success": True, "message": result.get("message", f"{role.capitalize()} supprimé avec succès")}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error deleting user: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete user")


# ===== KPI SYNC ENDPOINT =====

@router.post("/kpi/sync")
async def sync_kpi_data(
    data: KPISyncRequest,
    api_key: Dict = Depends(verify_api_key),
    kpi_service: KPIService = Depends(get_kpi_service)
):
    """
    Sync KPI data from external systems (POS, ERP, etc.)
    
    IMPORTANT: Full path is /api/integrations/kpi/sync
    Legacy path /api/v1/integrations/kpi/sync supported via alias below
    """
    try:
        # === GUARD CLAUSE: Check subscription access ===
        from services.gerant_service import GerantService
        from core.database import get_database
        db = get_database()
        gerant_service = GerantService(db)
        gerant_id = api_key.get('user_id')
        if gerant_id:
            await gerant_service.check_gerant_active_access(gerant_id)
        
        # Limit to 100 items per request
        if len(data.kpi_entries) > 100:
            raise HTTPException(
                status_code=400,
                detail=f"Maximum 100 KPI entries per request. Received {len(data.kpi_entries)}."
            )
        
        # Verify permissions
        if "write:kpi" not in api_key.get('permissions', []):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        
        # Process entries via bulk operations
        from pymongo import InsertOne, UpdateOne
        seller_operations = []
        entries_created = 0
        entries_updated = 0
        
        for entry in data.kpi_entries:
            if entry.seller_id:
                # Check if exists
                existing = await kpi_service.kpi_repo.find_by_seller_and_date(
                    entry.seller_id,
                    data.date
                )
                
                kpi_data = {
                    "ca_journalier": entry.ca_journalier,
                    "nb_ventes": entry.nb_ventes,
                    "nb_articles": entry.nb_articles,
                    "nb_prospects": entry.prospects or 0,
                    "source": "api",
                    "locked": True,
                    "updated_at": datetime.now(timezone.utc)
                }
                
                if existing:
                    seller_operations.append(UpdateOne(
                        {"seller_id": entry.seller_id, "date": data.date},
                        {"$set": kpi_data}
                    ))
                    entries_updated += 1
                else:
                    kpi_data.update({
                        "id": str(uuid4()),
                        "seller_id": entry.seller_id,
                        "date": data.date,
                        "created_at": datetime.now(timezone.utc)
                    })
                    seller_operations.append(InsertOne(kpi_data))
                    entries_created += 1
        
        # Execute bulk operations
        if seller_operations:
            await kpi_service.kpi_repo.bulk_write(seller_operations)
        
        return {
            "status": "success",
            "entries_created": entries_created,
            "entries_updated": entries_updated,
            "total": entries_created + entries_updated
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail="Database write operation failed")


# Legacy endpoint alias for backward compatibility with N8N
@router.post("/v1/kpi/sync")
async def sync_kpi_data_legacy(
    data: KPISyncRequest,
    api_key: Dict = Depends(verify_api_key),
    kpi_service: KPIService = Depends(get_kpi_service)
):
    """
    Legacy endpoint for N8N compatibility
    Redirects to main sync endpoint
    
    Full path: /api/integrations/v1/kpi/sync
    """
    return await sync_kpi_data(data, api_key, kpi_service)
