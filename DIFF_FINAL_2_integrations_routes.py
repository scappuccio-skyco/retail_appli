--- backend/api/routes/integrations.py
+++ backend/api/routes/integrations.py
@@ -1,12 +1,19 @@
 """Integration Routes - API Keys and External Systems - Clean Architecture"""
 from fastapi import APIRouter, Depends, HTTPException, Header
-from typing import Dict
+from typing import Dict, Optional, List
 from datetime import datetime, timezone
 from uuid import uuid4
+import logging
+from motor.motor_asyncio import AsyncIOMotorDatabase
 
-from models.integrations import APIKeyCreate, KPISyncRequest
+from models.integrations import (
+    APIKeyCreate, KPISyncRequest, APIStoreCreate, 
+    APIManagerCreate, APISellerCreate, APIUserUpdate
+)
 from services.kpi_service import KPIService
 from services.integration_service import IntegrationService
+from services.store_service import StoreService
+from services.gerant_service import GerantService
+from repositories.user_repository import UserRepository
 from api.dependencies import get_kpi_service, get_integration_service
+from core.database import get_db
 from core.security import get_current_gerant
+from core.security import get_password_hash
+
+logger = logging.getLogger(__name__)
 
 router = APIRouter(prefix="/integrations", tags=["Integrations"])
@@ -26,6 +33,7 @@ async def create_api_key(
         return await integration_service.create_api_key(
             user_id=current_user['id'],
             name=key_data.name,
             permissions=key_data.permissions,
-            expires_days=key_data.expires_days
+            expires_days=key_data.expires_days,
+            store_ids=key_data.store_ids
         )
     except Exception as e:
         raise HTTPException(status_code=400, detail=str(e))
@@ -48,6 +56,7 @@ async def verify_api_key(
     """Verify API key from header"""
     try:
-        return await integration_service.verify_api_key(x_api_key)
+        api_key_data = await integration_service.verify_api_key(x_api_key)
+        return api_key_data
     except ValueError as e:
         raise HTTPException(status_code=401, detail=str(e))
 
@@ -55,6 +64,200 @@ async def verify_api_key(
+# ===== SECURITY MIDDLEWARES =====
+
+async def verify_api_key_with_scope(
+    required_scope: str,
+    x_api_key: str = Header(..., alias="X-API-Key"),
+    integration_service: IntegrationService = Depends(get_integration_service)
+) -> Dict:
+    """
+    Verify API key and check required scope/permission
+    
+    Args:
+        required_scope: Required permission (e.g., "stores:read", "users:write")
+        x_api_key: API key from header
+        integration_service: Integration service instance
+    
+    Returns:
+        API key data dict
+    
+    Raises:
+        HTTPException: 401 if invalid key, 403 if insufficient permissions
+    """
+    api_key_data = await verify_api_key(x_api_key, integration_service)
+    permissions = api_key_data.get('permissions', [])
+    if required_scope not in permissions:
+        raise HTTPException(
+            status_code=403,
+            detail=f"Insufficient permissions. Requires '{required_scope}'"
+        )
+    return api_key_data
+
+
+async def verify_store_access(
+    store_id: str,
+    api_key_data: Dict = Depends(verify_api_key_with_scope("stores:read")),
+    integration_service: IntegrationService = Depends(get_integration_service),
+    db: AsyncIOMotorDatabase = Depends(get_db)
+) -> Dict:
+    """
+    Verify that the API key has access to the specified store_id.
+    
+    Args:
+        store_id: Store ID to verify access for
+        api_key_data: API key data from verify_api_key_with_scope
+        integration_service: Integration service instance
+        db: Database instance
+    
+    Returns:
+        Store document if accessible
+    
+    Raises:
+        HTTPException: 404 if store not found, 403 if access denied
+    """
+    # Get tenant_id from API key (source of truth)
+    tenant_id = await integration_service.get_tenant_id_from_api_key(api_key_data)
+    if not tenant_id:
+        raise HTTPException(status_code=403, detail="Invalid API key configuration: missing tenant_id")
+    
+    # Check if the store exists and belongs to the tenant
+    store_service = StoreService(db)
+    store = await store_service.get_store_by_id(store_id)
+    
+    if not store:
+        raise HTTPException(status_code=404, detail="Store not found")
+    
+    # Normalize IDs for comparison
+    store_gerant_id = str(store.get('gerant_id') or '')
+    tenant_id_str = str(tenant_id)
+    
+    if store_gerant_id != tenant_id_str:
+        raise HTTPException(status_code=404, detail="Store not found or not accessible by this tenant")
+    
+    # CRITIQUE: Vérification 2 - store_ids restriction
+    store_ids = api_key_data.get('store_ids')
+    if store_ids is not None:
+        # Check if key is restricted (not "*" and not None)
+        if "*" not in store_ids:
+            # Key is restricted - check if store_id is in the list
+            store_id_str = str(store_id)
+            if store_id_str not in [str(sid) for sid in store_ids]:
+                raise HTTPException(
+                    status_code=403,
+                    detail="API key does not have access to this store (not in store_ids list)"
+                )
+    
+    return store
+
+
+# ===== CRUD ENDPOINTS =====
+
+@router.get("/stores")
+async def list_stores(
+    api_key_data: Dict = Depends(verify_api_key_with_scope("stores:read")),
+    integration_service: IntegrationService = Depends(get_integration_service),
+    db: AsyncIOMotorDatabase = Depends(get_db)
+):
+    """List all stores accessible by the API key"""
+    tenant_id = await integration_service.get_tenant_id_from_api_key(api_key_data)
+    if not tenant_id:
+        raise HTTPException(status_code=403, detail="Invalid API key configuration")
+    
+    store_service = StoreService(db)
+    stores = await store_service.get_stores_by_gerant(tenant_id)
+    
+    # Filter by store_ids if restricted
+    store_ids = api_key_data.get('store_ids')
+    if store_ids is not None and "*" not in store_ids:
+        stores = [s for s in stores if str(s.get('id')) in [str(sid) for sid in store_ids]]
+    
+    return {"stores": stores}
+
+
+@router.post("/stores")
+async def create_store(
+    store_data: APIStoreCreate,
+    api_key_data: Dict = Depends(verify_api_key_with_scope("stores:write")),
+    integration_service: IntegrationService = Depends(get_integration_service),
+    db: AsyncIOMotorDatabase = Depends(get_db)
+):
+    """Create a new store"""
+    tenant_id = await integration_service.get_tenant_id_from_api_key(api_key_data)
+    if not tenant_id:
+        raise HTTPException(status_code=403, detail="Invalid API key configuration")
+    
+    gerant_service = GerantService(db)
+    
+    store_dict = {
+        "name": store_data.name,
+        "location": store_data.location,
+        "address": store_data.address,
+        "phone": store_data.phone,
+        "opening_hours": store_data.opening_hours
+    }
+    
+    try:
+        store = await gerant_service.create_store(store_dict, tenant_id)
+        return {"success": True, "store": store}
+    except ValueError as e:
+        raise HTTPException(status_code=400, detail=str(e))
+    except Exception as e:
+        logger.error(f"Error creating store: {e}")
+        raise HTTPException(status_code=500, detail="Failed to create store")
+
+
+@router.post("/stores/{store_id}/managers")
+async def create_manager(
+    store_id: str,
+    manager_data: APIManagerCreate,
+    api_key_data: Dict = Depends(verify_api_key_with_scope("users:write")),
+    integration_service: IntegrationService = Depends(get_integration_service),
+    db: AsyncIOMotorDatabase = Depends(get_db)
+):
+    """
+    Create a new manager for a store.
+    CRITIQUE: store_id is forced from path, any store_id in body is ignored.
+    """
+    # Verify store access FIRST
+    store = await verify_store_access(store_id, api_key_data, integration_service, db)
+    
+    tenant_id = await integration_service.get_tenant_id_from_api_key(api_key_data)
+    user_repo = UserRepository(db)
+    
+    # Check if email already exists
+    existing_user = await user_repo.find_by_email(manager_data.email)
+    if existing_user:
+        raise HTTPException(status_code=400, detail="Email already registered")
+    
+    # Create manager user - store_id is FORCED from path
+    manager_id = str(uuid4())
+    temp_password = "TempPassword123!"
+    
+    manager = {
+        "id": manager_id,
+        "name": manager_data.name,
+        "email": manager_data.email,
+        "password": get_password_hash(temp_password),
+        "role": "manager",
+        "status": "active",
+        "phone": manager_data.phone,
+        "gerant_id": tenant_id,  # From API key tenant
+        "store_id": store_id,  # FORCED from path, ignoring any body.store_id
+        "external_id": manager_data.external_id,
+        "sync_mode": "api_sync",
+        "created_at": datetime.now(timezone.utc).isoformat()
+    }
+    
+    await db.users.insert_one(manager)
+    
+    # TODO: Send invitation email if manager_data.send_invitation
+    
+    return {
+        "success": True,
+        "manager_id": manager_id,
+        "manager": {
+            "id": manager_id,
+            "name": manager_data.name,
+            "email": manager_data.email,
+            "store_id": store_id,
+            "external_id": manager_data.external_id
+        }
+    }
+
+
+@router.post("/stores/{store_id}/sellers")
+async def create_seller(
+    store_id: str,
+    seller_data: APISellerCreate,
+    api_key_data: Dict = Depends(verify_api_key_with_scope("users:write")),
+    integration_service: IntegrationService = Depends(get_integration_service),
+    db: AsyncIOMotorDatabase = Depends(get_db)
+):
+    """
+    Create a new seller for a store.
+    CRITIQUE: store_id is forced from path, any store_id in body is ignored.
+    """
+    # Verify store access FIRST
+    store = await verify_store_access(store_id, api_key_data, integration_service, db)
+    
+    tenant_id = await integration_service.get_tenant_id_from_api_key(api_key_data)
+    user_repo = UserRepository(db)
+    
+    # Check if email already exists
+    existing_user = await user_repo.find_by_email(seller_data.email)
+    if existing_user:
+        raise HTTPException(status_code=400, detail="Email already registered")
+    
+    # Verify manager if provided
+    manager_id = seller_data.manager_id
+    if manager_id:
+        manager = await user_repo.find_one({
+            "id": manager_id,
+            "role": "manager",
+            "store_id": store_id
+        })
+        if not manager:
+            raise HTTPException(status_code=404, detail="Manager not found in this store")
+    else:
+        # Find a manager in the store
+        manager = await user_repo.find_one({
+            "role": "manager",
+            "store_id": store_id,
+            "status": "active"
+        })
+        if manager:
+            manager_id = str(manager.get("id") or manager.get("_id"))
+    
+    # Create seller user - store_id is FORCED from path
+    seller_id = str(uuid4())
+    temp_password = "TempPassword123!"
+    
+    seller = {
+        "id": seller_id,
+        "name": seller_data.name,
+        "email": seller_data.email,
+        "password": get_password_hash(temp_password),
+        "role": "seller",
+        "status": "active",
+        "phone": seller_data.phone,
+        "gerant_id": tenant_id,  # From API key tenant
+        "store_id": store_id,  # FORCED from path, ignoring any body.store_id
+        "manager_id": manager_id,
+        "external_id": seller_data.external_id,
+        "sync_mode": "api_sync",
+        "created_at": datetime.now(timezone.utc).isoformat()
+    }
+    
+    await db.users.insert_one(seller)
+    
+    # TODO: Send invitation email if seller_data.send_invitation
+    
+    return {
+        "success": True,
+        "seller_id": seller_id,
+        "seller": {
+            "id": seller_id,
+            "name": seller_data.name,
+            "email": seller_data.email,
+            "store_id": store_id,
+            "manager_id": manager_id,
+            "external_id": seller_data.external_id
+        }
+    }
+
+
+@router.put("/users/{user_id}")
+async def update_user(
+    user_id: str,
+    user_data: APIUserUpdate,
+    api_key_data: Dict = Depends(verify_api_key_with_scope("users:write")),
+    integration_service: IntegrationService = Depends(get_integration_service),
+    db: AsyncIOMotorDatabase = Depends(get_db)
+):
+    """
+    Update a user (manager or seller).
+    CRITIQUE: Whitelist only, email is FORBIDDEN, tenant/store_id checks enforced.
+    """
+    tenant_id = await integration_service.get_tenant_id_from_api_key(api_key_data)
+    if not tenant_id:
+        raise HTTPException(status_code=403, detail="Invalid API key configuration")
+    
+    user_repo = UserRepository(db)
+    
+    # Find user - normalize ID lookup
+    user = await user_repo.find_by_id(user_id)
+    if not user:
+        # Try with _id as fallback
+        user = await db.users.find_one({"_id": user_id}, {"_id": 0})
+    
+    if not user:
+        raise HTTPException(status_code=404, detail="User not found")
+    
+    # Normalize user data
+    user_id_normalized = str(user.get("id") or user.get("_id"))
+    role_norm = (user.get("role") or "").strip().lower()
+    
+    # Calculate user's tenant_id
+    if role_norm in ["gerant", "gérant"]:
+        user_tenant_id = user_id_normalized
+    else:
+        user_tenant_id = user.get("gerant_id")
+    
+    # Verify tenant access
+    if not user_tenant_id or str(user_tenant_id) != str(tenant_id):
+        raise HTTPException(status_code=403, detail="User does not belong to this tenant")
+    
+    # VERROUILLAGE STORE_IDS STRICT
+    store_ids = api_key_data.get('store_ids')
+    user_store_id = user.get("store_id")
+    
+    if store_ids is not None and "*" not in store_ids:
+        # Key is restricted
+        if str(api_key_data.get('tenant_id')) == str(tenant_id):
+            # Gérant can access all their stores
+            pass
+        else:
+            # Non-gérant: check store_id
+            if not user_store_id or str(user_store_id) not in [str(sid) for sid in store_ids]:
+                raise HTTPException(
+                    status_code=403,
+                    detail="API key does not have access to this user's store"
+                )
+    
+    # WHITELIST: Only allow specific fields (email is FORBIDDEN)
+    ALLOWED_FIELDS = ["name", "phone", "status", "external_id"]
+    
+    updates = {k: v for k, v in user_data.model_dump(exclude_unset=True).items() if k in ALLOWED_FIELDS}
+    
+    if not updates:
+        raise HTTPException(status_code=400, detail="No fields to update")
+    
+    # Validate status if provided
+    if "status" in updates:
+        if updates["status"] not in ["active", "suspended"]:
+            raise HTTPException(status_code=400, detail="Status must be 'active' or 'suspended'")
+        if updates["status"] == "suspended":
+            updates["deactivated_at"] = datetime.now(timezone.utc).isoformat()
+    
+    # Update user
+    await db.users.update_one(
+        {"id": user_id_normalized},
+        {"$set": updates}
+    )
+    
+    # Get updated user
+    updated_user = await user_repo.find_by_id(user_id_normalized)
+    
+    return {
+        "success": True,
+        "user_id": user_id_normalized,
+        "user": {
+            "id": updated_user['id'],
+            "name": updated_user['name'],
+            "role": updated_user['role'],
+            "status": updated_user.get('status'),
+            "phone": updated_user.get('phone'),
+            "store_id": updated_user.get('store_id'),
+            "external_id": updated_user.get('external_id')
+        }
+    }
+
+
 # ===== KPI SYNC ENDPOINT =====
 
 @router.post("/kpi/sync")

