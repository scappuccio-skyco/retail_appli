"""Integration Routes - API Keys and External Systems - Clean Architecture.
Phase 0: Zero Repo in Route - services only (StoreService, GerantService, KPIService, IntegrationService).
Phase 2: Exceptions métier (NotFoundError, ValidationError)."""
from fastapi import APIRouter, Depends, Header, Query
from typing import Dict, Optional, List
from datetime import datetime, timezone
from uuid import uuid4
import logging
from core.exceptions import NotFoundError, ValidationError, ForbiddenError, ConflictError, BusinessLogicError
from models.integrations import (
    APIKeyCreate, KPISyncRequest, APIStoreCreate,
    APIManagerCreate, APISellerCreate, APIUserUpdate
)
from services.kpi_service import KPIService
from services.integration_service import IntegrationService
from services.store_service import StoreService
from services.gerant_service import GerantService
from api.dependencies import get_kpi_service, get_integration_service, get_store_service, get_gerant_service
from core.security import (
    get_current_gerant, get_password_hash, require_active_space, get_api_key_from_headers,
    verify_integration_api_key, verify_integration_store_access,
)

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/integrations",
    tags=["Integrations"]
)


# ===== API KEY MANAGEMENT =====

@router.post("/api-keys")
async def create_api_key(
    key_data: APIKeyCreate,
    current_user: Dict = Depends(get_current_gerant),
    _active_space: Dict = Depends(require_active_space),
    integration_service: IntegrationService = Depends(get_integration_service)
):
    """Create new API key for integrations"""
    return await integration_service.create_api_key(
        user_id=current_user['id'],
        name=key_data.name,
        permissions=key_data.permissions,
        expires_days=key_data.expires_days,
        store_ids=key_data.store_ids
    )


@router.get("/api-keys")
async def list_api_keys(
    page: int = Query(1, ge=1, description="Numéro de page"),
    size: int = Query(50, ge=1, le=100, description="Nombre d'éléments par page"),
    current_user: Dict = Depends(get_current_gerant),
    _active_space: Dict = Depends(require_active_space),
    integration_service: IntegrationService = Depends(get_integration_service)
):
    """Liste les clés API du gérant (paginé: items, total, page, size, pages)."""
    return await integration_service.list_api_keys(
        current_user['id'], page=page, size=size
    )


# ===== API KEY VERIFICATION (Phase 3: centralized in core.security) =====

async def verify_api_key(
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
    authorization: Optional[str] = Header(None),
    integration_service: IntegrationService = Depends(get_integration_service)
) -> Dict:
    """
    Verify API key from header. Delegates to core.security.verify_integration_api_key.
    """
    return await verify_integration_api_key(x_api_key, authorization, integration_service)


# ===== SECURITY MIDDLEWARES (Phase 3: centralized logic in core.security) =====

def verify_api_key_with_scope(required_scope: str):
    """
    Factory: verify API key and check scope. Logic delegated to core.security.
    """
    async def _verify_scope(
        x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
        authorization: Optional[str] = Header(None),
        integration_service: IntegrationService = Depends(get_integration_service)
    ) -> Dict:
        api_key_data = await verify_integration_api_key(x_api_key, authorization, integration_service)
        permissions = api_key_data.get('permissions', [])
        if required_scope not in permissions:
            raise ForbiddenError(f"Insufficient permissions. Requires '{required_scope}'")
        return api_key_data
    return _verify_scope


async def verify_store_access(
    store_id: str,
    api_key_data: Dict,
    integration_service: IntegrationService,
    store_service: StoreService,
) -> Dict:
    """
    Verify store access for API key. Delegates to core.security.verify_integration_store_access.
    """
    return await verify_integration_store_access(store_id, api_key_data, integration_service, store_service)


# ===== CRUD ENDPOINTS =====

@router.get("/stores")
async def list_stores(
    api_key_data: Dict = Depends(verify_api_key_with_scope("stores:read")),
    integration_service: IntegrationService = Depends(get_integration_service),
    store_service: StoreService = Depends(get_store_service),
):
    """List all stores accessible by the API key (Phase 10: StoreService via DI)."""
    tenant_id = await integration_service.get_tenant_id_from_api_key(api_key_data)
    if not tenant_id:
        raise ForbiddenError("Invalid API key configuration")
    stores = await store_service.get_stores_by_gerant(tenant_id)
    store_ids = api_key_data.get("store_ids")
    if store_ids is not None and "*" not in store_ids:
        stores = [s for s in stores if str(s.get("id")) in [str(sid) for sid in store_ids]]
    return {"stores": stores}


@router.post("/stores")
async def create_store(
    store_data: APIStoreCreate,
    api_key_data: Dict = Depends(verify_api_key_with_scope("stores:write")),
    integration_service: IntegrationService = Depends(get_integration_service),
    gerant_service: GerantService = Depends(get_gerant_service),
    store_service: StoreService = Depends(get_store_service),
):
    """Create a new store. Phase 0 Vague 2: services only (no db)."""
    tenant_id = await integration_service.get_tenant_id_from_api_key(api_key_data)
    if not tenant_id:
        raise ForbiddenError("Invalid API key configuration")

    store_dict = {
        "name": store_data.name,
        "location": store_data.location,
        "address": store_data.address or "",
        "phone": store_data.phone or "",
        "opening_hours": store_data.opening_hours or "",
    }
    if store_data.external_id:
        store_dict["external_id"] = store_data.external_id

    try:
        store = await gerant_service.create_store(store_dict, tenant_id)
    except ValueError as e:
        raise ValidationError(str(e))

    if store_data.external_id:
        store["external_id"] = store_data.external_id
        await store_service.update_store_one(store["id"], {"external_id": store_data.external_id})
    return {"success": True, "store": store}


@router.get("/stores/{store_id}/managers")
async def list_managers(
    store_id: str,
    api_key_data: Dict = Depends(verify_api_key_with_scope("stores:read")),
    integration_service: IntegrationService = Depends(get_integration_service),
    store_service: StoreService = Depends(get_store_service),
    gerant_service: GerantService = Depends(get_gerant_service),
):
    """List all managers for a store (Phase 10: no db in route)."""
    await verify_store_access(store_id, api_key_data, integration_service, store_service)
    tenant_id = await integration_service.get_tenant_id_from_api_key(api_key_data)
    managers = await gerant_service.get_store_managers(store_id, tenant_id)
    return {"managers": managers}


@router.post("/stores/{store_id}/managers")
async def create_manager(
    store_id: str,
    manager_data: APIManagerCreate,
    api_key_data: Dict = Depends(verify_api_key_with_scope("users:write")),
    integration_service: IntegrationService = Depends(get_integration_service),
    store_service: StoreService = Depends(get_store_service),
    gerant_service: GerantService = Depends(get_gerant_service),
):
    """Create a new manager for a store. Phase 0 Vague 2: GerantService only (no db)."""
    await verify_store_access(store_id, api_key_data, integration_service, store_service)
    tenant_id = await integration_service.get_tenant_id_from_api_key(api_key_data)
    existing_user = await gerant_service.find_user_by_email(manager_data.email)
    if existing_user:
        raise ConflictError("Email already registered")

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
        "gerant_id": tenant_id,
        "store_id": store_id,
        "external_id": manager_data.external_id,
        "sync_mode": "api_sync",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await gerant_service.insert_user(manager)

    return {
        "success": True,
        "manager_id": manager_id,
        "manager": {
            "id": manager_id,
            "name": manager_data.name,
            "email": manager_data.email,
            "store_id": store_id,
            "external_id": manager_data.external_id,
        },
    }


@router.get("/stores/{store_id}/sellers")
async def list_sellers(
    store_id: str,
    api_key_data: Dict = Depends(verify_api_key_with_scope("stores:read")),
    integration_service: IntegrationService = Depends(get_integration_service),
    store_service: StoreService = Depends(get_store_service),
    gerant_service: GerantService = Depends(get_gerant_service),
):
    """List all sellers for a store (Phase 10: no db in route)."""
    await verify_store_access(store_id, api_key_data, integration_service, store_service)
    tenant_id = await integration_service.get_tenant_id_from_api_key(api_key_data)
    try:
        sellers = await gerant_service.get_store_sellers(store_id, tenant_id)
        return {"sellers": sellers}
    except Exception as e:
        logger.error(f"Error listing sellers: {e}", exc_info=True)
        raise BusinessLogicError(str(e))


@router.post("/stores/{store_id}/sellers")
async def create_seller(
    store_id: str,
    seller_data: APISellerCreate,
    api_key_data: Dict = Depends(verify_api_key_with_scope("users:write")),
    integration_service: IntegrationService = Depends(get_integration_service),
    store_service: StoreService = Depends(get_store_service),
    gerant_service: GerantService = Depends(get_gerant_service),
):
    """Create a new seller for a store. Phase 0 Vague 2: GerantService only (no db)."""
    await verify_store_access(store_id, api_key_data, integration_service, store_service)
    tenant_id = await integration_service.get_tenant_id_from_api_key(api_key_data)
    existing_user = await gerant_service.find_user_by_email(seller_data.email)
    if existing_user:
        raise ConflictError("Email already registered")

    manager_id = seller_data.manager_id
    manager = await gerant_service.get_manager_in_store(store_id, manager_id)
    if manager_id and not manager:
        raise NotFoundError("Manager not found in this store")
    if manager:
        manager_id = str(manager.get("id") or manager.get("_id"))
    else:
        manager_id = None

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
        "gerant_id": tenant_id,
        "store_id": store_id,
        "manager_id": manager_id,
        "external_id": seller_data.external_id,
        "sync_mode": "api_sync",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await gerant_service.insert_user(seller)

    return {
        "success": True,
        "seller_id": seller_id,
        "seller": {
            "id": seller_id,
            "name": seller_data.name,
            "email": seller_data.email,
            "store_id": store_id,
            "manager_id": manager_id,
            "external_id": seller_data.external_id,
        },
    }


@router.put("/users/{user_id}")
async def update_user(
    user_id: str,
    user_data: APIUserUpdate,
    api_key_data: Dict = Depends(verify_api_key_with_scope("users:write")),
    integration_service: IntegrationService = Depends(get_integration_service),
    gerant_service: GerantService = Depends(get_gerant_service),
):
    """
    Update a user (manager or seller). Phase 0 Vague 2: GerantService only (no db).
    """
    tenant_id = await integration_service.get_tenant_id_from_api_key(api_key_data)
    if not tenant_id:
        raise ForbiddenError("Invalid API key configuration")
    
    user = await gerant_service.get_user_by_id(user_id)
    if not user:
        raise NotFoundError("User not found")
    
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
        raise ForbiddenError("User does not belong to this tenant")
    
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
                raise ForbiddenError("API key does not have access to this user's store")
    
    # WHITELIST: Only allow specific fields (email is FORBIDDEN)
    ALLOWED_FIELDS = ["name", "phone", "status", "external_id"]
    
    updates = {k: v for k, v in user_data.model_dump(exclude_unset=True).items() if k in ALLOWED_FIELDS}
    
    if not updates:
        raise ValidationError("No fields to update")
    
    # Validate status if provided
    if "status" in updates:
        if updates["status"] not in ["active", "suspended"]:
            raise ValidationError("Status must be 'active' or 'suspended'")
        if updates["status"] == "suspended":
            updates["deactivated_at"] = datetime.now(timezone.utc).isoformat()
    
    await gerant_service.update_user_one(user_id_normalized, updates)
    updated_user = await gerant_service.get_user_by_id(user_id_normalized)
    
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
    store_service: StoreService = Depends(get_store_service),
    gerant_service: GerantService = Depends(get_gerant_service),
):
    """Delete (deactivate) a store (Phase 10: no db in route)."""
    await verify_store_access(store_id, api_key_data, integration_service, store_service)
    tenant_id = await integration_service.get_tenant_id_from_api_key(api_key_data)

    try:
        result = await gerant_service.delete_store(store_id, tenant_id)
    except ValueError as e:
        raise NotFoundError(str(e))
    return {"success": True, "message": result.get("message", "Magasin supprimé avec succès")}


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: str,
    api_key_data: Dict = Depends(verify_api_key_with_scope("users:write")),
    integration_service: IntegrationService = Depends(get_integration_service),
    gerant_service: GerantService = Depends(get_gerant_service),
):
    """Delete (soft delete) a user. Phase 0 Vague 2: GerantService only (no db)."""
    tenant_id = await integration_service.get_tenant_id_from_api_key(api_key_data)
    if not tenant_id:
        raise ForbiddenError("Invalid API key configuration")
    
    user = await gerant_service.get_user_by_id(user_id)
    if not user:
        raise NotFoundError("User not found")
    
    # Normalize user data
    user_id_normalized = str(user.get("id") or user.get("_id"))
    role_norm = (user.get("role") or "").strip().lower()
    
    # Verify it's a manager or seller (not gérant)
    if role_norm in ["gerant", "gérant"]:
        raise ForbiddenError("Cannot delete gérant via API")
    
    # Calculate user's tenant_id
    user_tenant_id = user.get("gerant_id")
    
    # Verify tenant access
    if not user_tenant_id or str(user_tenant_id) != str(tenant_id):
        raise ForbiddenError("User does not belong to this tenant")
    
    # VERROUILLAGE STORE_IDS STRICT
    store_ids = api_key_data.get('store_ids')
    user_store_id = user.get("store_id")
    
    if store_ids is not None and "*" not in store_ids:
        # Key is restricted
        if not user_store_id or str(user_store_id) not in [str(sid) for sid in store_ids]:
            raise ForbiddenError("API key does not have access to this user's store")
    
    try:
        role = "manager" if role_norm == "manager" else "seller"
        result = await gerant_service.delete_user(user_id_normalized, tenant_id, role)
    except ValueError as e:
        raise ValidationError(str(e))
    return {"success": True, "message": result.get("message", f"{role.capitalize()} supprimé avec succès")}


# ===== KPI SYNC ENDPOINT =====

@router.post("/kpi/sync")
async def sync_kpi_data(
    data: KPISyncRequest,
    api_key: Dict = Depends(verify_api_key),
    kpi_service: KPIService = Depends(get_kpi_service),
    gerant_service: GerantService = Depends(get_gerant_service),
):
    """
    Sync KPI data from external systems. Phase 0 Vague 2: no db.
    Full path: /api/integrations/kpi/sync
    """
    try:
        gerant_id = api_key.get("user_id")
        if gerant_id:
            await gerant_service.check_gerant_active_access(gerant_id)
        
        # Limit to 100 items per request
        if len(data.kpi_entries) > 100:
            raise ValidationError(f"Maximum 100 KPI entries per request. Received {len(data.kpi_entries)}.")
        
        # Verify permissions
        if "write:kpi" not in api_key.get('permissions', []):
            raise ForbiddenError("Insufficient permissions")
        
        # Process entries via bulk operations
        from pymongo import InsertOne, UpdateOne
        seller_operations = []
        entries_created = 0
        entries_updated = 0
        
        for entry in data.kpi_entries:
            if not entry.seller_id:
                logger.warning(f"Skipping entry without seller_id: {entry}")
                continue
                
            # Use entry-level date/store_id if provided, otherwise use root-level
            entry_date = entry.date or data.date
            entry_store_id = entry.store_id or data.store_id
            
            # Validate that we have both date and store_id
            if not entry_date:
                raise BusinessLogicError(f"Date is required for seller_id {entry.seller_id}. Provide it either at root level or in each kpi_entry.")
            if not entry_store_id:
                raise BusinessLogicError(f"store_id is required for seller_id {entry.seller_id}. Provide it either at root level or in each kpi_entry.")
            
            try:
                seller = await gerant_service.get_user_by_id(entry.seller_id)
                if not seller:
                    logger.warning(f"Seller {entry.seller_id} not found in database, but continuing with KPI creation")
                elif seller.get("role") != "seller":
                    logger.warning(f"User {entry.seller_id} is not a seller (role: {seller.get('role')}), but continuing")
            except Exception as seller_check_error:
                logger.warning(f"Error checking seller {entry.seller_id}: {str(seller_check_error)}, continuing anyway")
            
            # Check if exists
            try:
                existing = await kpi_service.get_kpi_by_seller_and_date(
                    entry.seller_id,
                    entry_date,
                )
            except Exception as find_error:
                logger.error(
                    "Error finding existing KPI for seller %s date %s: %s",
                    entry.seller_id, entry_date, find_error,
                    exc_info=True,
                )
                raise
            
            kpi_data = {
                "ca_journalier": entry.ca_journalier,
                "nb_ventes": entry.nb_ventes,
                "nb_articles": entry.nb_articles,
                "nb_prospects": entry.prospects or 0,
                "nb_clients": entry.prospects or 0,  # Use prospects as clients if not provided separately
                "source": "api",
                "locked": True,
                "updated_at": datetime.now(timezone.utc)
            }
            
            if existing:
                # Ensure store_id is included in update
                kpi_data["store_id"] = entry_store_id
                seller_operations.append(UpdateOne(
                    {"seller_id": entry.seller_id, "date": entry_date},
                    {"$set": kpi_data}
                ))
                entries_updated += 1
            else:
                kpi_data.update({
                    "id": str(uuid4()),
                    "seller_id": entry.seller_id,
                    "store_id": entry_store_id,  # CRITICAL: Add store_id for dashboard aggregation
                    "date": entry_date,
                    "created_at": datetime.now(timezone.utc)
                })
                seller_operations.append(InsertOne(kpi_data))
                entries_created += 1
        
        # Execute bulk operations
        if seller_operations:
            try:
                result = await kpi_service.bulk_write_kpis(seller_operations)
                logger.info("Bulk write completed: %s", result)
            except Exception as bulk_error:
                logger.error("Bulk write failed: %s", bulk_error, exc_info=True)
                raise ValidationError(f"Failed to write KPI data to database: {str(bulk_error)}")
        else:
            logger.warning("No seller operations to execute - all entries may have been skipped")
            return {
                "status": "warning",
                "message": "No KPI entries were processed. Check that seller_id values are valid.",
                "entries_created": 0,
                "entries_updated": 0,
                "total": 0
            }
        
        logger.info(f"KPI sync completed: {entries_created} created, {entries_updated} updated")
        return {
            "status": "success",
            "entries_created": entries_created,
            "entries_updated": entries_updated,
            "total": entries_created + entries_updated
        }
    except AppException:
        raise


# Legacy endpoint alias for backward compatibility with N8N
@router.post("/v1/kpi/sync")
async def sync_kpi_data_legacy(
    data: KPISyncRequest,
    api_key: Dict = Depends(verify_api_key),
    kpi_service: KPIService = Depends(get_kpi_service),
    gerant_service: GerantService = Depends(get_gerant_service),
):
    """Legacy endpoint for N8N compatibility. Phase 0 Vague 2: no db."""
    return await sync_kpi_data(data, api_key, kpi_service, gerant_service)
