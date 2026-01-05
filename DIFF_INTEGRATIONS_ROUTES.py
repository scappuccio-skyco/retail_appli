# ============================================================================
# DIFF COMPLET pour backend/api/routes/integrations.py
# ============================================================================

"""
Ajouter après la fonction verify_api_key existante (ligne 58)
"""

# ===== MIDDLEWARES DE SÉCURITÉ =====

async def verify_api_key_with_scope(
    required_scope: str,
    x_api_key: str = Header(..., alias="X-API-Key"),
    integration_service: IntegrationService = Depends(get_integration_service)
) -> Dict:
    """
    Verify API key and check required scope/permission
    
    Args:
        required_scope: Required permission (e.g., "stores:read", "stores:write", "users:write")
        x_api_key: API key from header
        integration_service: Integration service instance
    
    Returns:
        API key document with user_id, permissions, and store_ids
    
    Raises:
        HTTPException 401: If key is invalid
        HTTPException 403: If scope is missing
    """
    # Verify API key
    api_key_data = await verify_api_key(x_api_key, integration_service)
    
    # Check scope
    permissions = api_key_data.get('permissions', [])
    if required_scope not in permissions:
        raise HTTPException(
            status_code=403,
            detail=f"Insufficient permissions. Requires '{required_scope}'"
        )
    
    return api_key_data


async def verify_store_access(
    store_id: str,
    api_key_data: Dict = Depends(verify_api_key),
    integration_service: IntegrationService = Depends(get_integration_service)
) -> Dict:
    """
    Verify that API key has access to a specific store (multi-tenant)
    
    Args:
        store_id: Store ID to check
        api_key_data: API key data from verify_api_key
        integration_service: Integration service instance
    
    Returns:
        Store document if access granted
    
    Raises:
        HTTPException 403: If access denied
        HTTPException 404: If store not found
    """
    from services.store_service import StoreService
    from api.dependencies import get_store_service
    from core.database import get_database
    from repositories.user_repository import UserRepository
    
    db = get_database()
    store_service = StoreService(db)
    
    # Get store
    store = await store_service.get_store_by_id(store_id)
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    
    # Get tenant_id (gerant_id) from API key
    tenant_id = await integration_service.get_tenant_id_from_api_key(api_key_data)
    if not tenant_id:
        raise HTTPException(status_code=403, detail="Invalid API key configuration")
    
    # Check store ownership
    store_gerant_id = store.get('gerant_id')
    if store_gerant_id != tenant_id:
        raise HTTPException(
            status_code=403,
            detail="API key does not have access to this store"
        )
    
    # Check store_ids restriction
    store_ids = api_key_data.get('store_ids')
    if store_ids is not None:
        # Specific stores are defined (not None and not ["*"])
        if "*" not in store_ids and store_id not in store_ids:
            raise HTTPException(
                status_code=403,
                detail="API key does not have access to this store"
            )
    
    return store


# ===== STORES CRUD =====

@router.get("/stores")
async def list_stores(
    api_key: Dict = Depends(lambda: verify_api_key_with_scope("stores:read"))
):
    """
    List all stores accessible by API key
    
    Returns stores based on:
    - If store_ids is None or ["*"]: all stores owned by tenant (gerant)
    - If store_ids is a list: only stores in the list
    
    Requires scope: stores:read
    """
    from services.store_service import StoreService
    from core.database import get_database
    from repositories.user_repository import UserRepository
    from services.integration_service import IntegrationService
    from api.dependencies import get_integration_service
    
    db = get_database()
    store_service = StoreService(db)
    integration_service = IntegrationService(IntegrationRepository(db))
    
    # Get tenant_id (gerant_id)
    tenant_id = await integration_service.get_tenant_id_from_api_key(api_key)
    if not tenant_id:
        raise HTTPException(status_code=403, detail="Invalid API key configuration")
    
    store_ids = api_key.get('store_ids')
    
    if store_ids is None or "*" in store_ids:
        # All stores for tenant
        stores = await store_service.get_stores_by_gerant(tenant_id)
    else:
        # Specific stores
        stores = []
        for store_id in store_ids:
            store = await store_service.get_store_by_id(store_id)
            if store and store.get('gerant_id') == tenant_id:
                stores.append(store)
    
    return {
        "stores": stores,
        "total": len(stores)
    }


@router.post("/stores")
async def create_store_integration(
    store_data: APIStoreCreate,
    api_key: Dict = Depends(lambda: verify_api_key_with_scope("stores:write"))
):
    """
    Create a new store via API Key
    
    Requires scope: stores:write
    Creates store in the tenant of the API key owner
    """
    from services.store_service import StoreService
    from core.database import get_database
    from repositories.user_repository import UserRepository
    from services.integration_service import IntegrationService
    from api.dependencies import get_integration_service
    from repositories.store_repository import StoreRepository
    
    db = get_database()
    store_service = StoreService(db)
    integration_service = IntegrationService(IntegrationRepository(db))
    
    # Get tenant_id (gerant_id)
    tenant_id = await integration_service.get_tenant_id_from_api_key(api_key)
    if not tenant_id:
        raise HTTPException(status_code=403, detail="Invalid API key configuration")
    
    # Create store using existing service
    store = await store_service.create_store(
        gerant_id=tenant_id,
        name=store_data.name,
        location=store_data.location
    )
    
    # Update with optional fields
    if store_data.address or store_data.phone or store_data.opening_hours or store_data.external_id:
        store_repo = StoreRepository(db)
        
        update_data = {}
        if store_data.address:
            update_data['address'] = store_data.address
        if store_data.phone:
            update_data['phone'] = store_data.phone
        if store_data.opening_hours:
            update_data['opening_hours'] = store_data.opening_hours
        if store_data.external_id:
            update_data['external_id'] = store_data.external_id
        
        await store_repo.update_one(store['id'], update_data)
        store.update(update_data)
    
    # Audit log (minimal)
    # TODO: Implémenter audit log si nécessaire
    
    return {
        "success": True,
        "store_id": store['id'],
        "store": store
    }


# ===== MANAGERS CRUD =====

@router.post("/stores/{store_id}/managers")
async def create_manager_integration(
    store_id: str,
    manager_data: APIManagerCreate,
    api_key: Dict = Depends(lambda: verify_api_key_with_scope("users:write")),
    store: Dict = Depends(verify_store_access)
):
    """
    Create a new manager for a store via API Key
    
    Requires scope: users:write
    Requires store access via verify_store_access
    Forces store_id from path (ignores any store_id in body)
    """
    from core.database import get_database
    from repositories.user_repository import UserRepository
    from services.integration_service import IntegrationService
    from api.dependencies import get_integration_service
    from core.security import get_password_hash
    from datetime import datetime, timezone
    from uuid import uuid4
    
    db = get_database()
    user_repo = UserRepository(db)
    integration_service = IntegrationService(IntegrationRepository(db))
    
    # Check if email already exists
    existing_user = await user_repo.find_by_email(manager_data.email)
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Get tenant_id (gerant_id) from store
    tenant_id = store.get('gerant_id')
    
    # Create manager user
    manager_id = str(uuid4())
    temp_password = "TempPassword123!"  # Temporary password, user will reset via invitation
    hashed_password = get_password_hash(temp_password)
    
    manager_doc = {
        "id": manager_id,
        "name": manager_data.name,
        "email": manager_data.email,
        "password": hashed_password,
        "role": "manager",
        "status": "active",
        "phone": manager_data.phone,
        "gerant_id": tenant_id,
        "store_id": store_id,  # Force from path
        "external_id": manager_data.external_id,
        "sync_mode": "api_sync",
        "created_at": datetime.now(timezone.utc)
    }
    
    await user_repo.insert_one(manager_doc)
    
    # Send invitation email if requested
    if manager_data.send_invitation:
        try:
            # Create invitation token
            from models.users import GerantInvitation
            invitation = GerantInvitation(
                name=manager_data.name,
                email=manager_data.email,
                role="manager",
                gerant_id=tenant_id,
                gerant_name="Gérant",  # TODO: Get from user if needed
                store_id=store_id,
                store_name=store.get('name', 'Store')
            )
            
            await db.gerant_invitations.insert_one(invitation.model_dump())
            
            # TODO: Send invitation email
            # await send_manager_invitation_email(...)
        except Exception as e:
            # Log error but don't fail the creation
            print(f"Failed to send invitation email: {e}")
    
    # Audit log
    # TODO: Implémenter audit log
    
    return {
        "success": True,
        "manager_id": manager_id,
        "manager": {
            "id": manager_id,
            "name": manager_data.name,
            "email": manager_data.email,
            "phone": manager_data.phone,
            "store_id": store_id,
            "external_id": manager_data.external_id,
            "invitation_sent": manager_data.send_invitation
        }
    }


# ===== SELLERS CRUD =====

@router.post("/stores/{store_id}/sellers")
async def create_seller_integration(
    store_id: str,
    seller_data: APISellerCreate,
    api_key: Dict = Depends(lambda: verify_api_key_with_scope("users:write")),
    store: Dict = Depends(verify_store_access)
):
    """
    Create a new seller for a store via API Key
    
    Requires scope: users:write
    Requires store access via verify_store_access
    Forces store_id from path (ignores any store_id in body)
    """
    from core.database import get_database
    from repositories.user_repository import UserRepository
    from services.integration_service import IntegrationService
    from api.dependencies import get_integration_service
    from core.security import get_password_hash
    from datetime import datetime, timezone
    from uuid import uuid4
    
    db = get_database()
    user_repo = UserRepository(db)
    integration_service = IntegrationService(IntegrationRepository(db))
    
    # Check if email already exists
    existing_user = await user_repo.find_by_email(seller_data.email)
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Get tenant_id (gerant_id) from store
    tenant_id = store.get('gerant_id')
    
    # Find manager
    manager_id = seller_data.manager_id
    if manager_id:
        manager = await user_repo.find_by_id(manager_id)
        if not manager or manager.get('role') != 'manager' or manager.get('store_id') != store_id:
            raise HTTPException(status_code=404, detail="Manager not found in this store")
    else:
        # Find a manager in the store
        managers = await user_repo.find_by_store(store_id)
        manager = next((m for m in managers if m.get('role') == 'manager' and m.get('status') == 'active'), None)
        if manager:
            manager_id = manager['id']
        else:
            raise HTTPException(status_code=400, detail="No manager found in this store. Please specify manager_id.")
    
    # Create seller user
    seller_id = str(uuid4())
    temp_password = "TempPassword123!"  # Temporary password
    hashed_password = get_password_hash(temp_password)
    
    seller_doc = {
        "id": seller_id,
        "name": seller_data.name,
        "email": seller_data.email,
        "password": hashed_password,
        "role": "seller",
        "status": "active",
        "phone": seller_data.phone,
        "gerant_id": tenant_id,
        "store_id": store_id,  # Force from path
        "manager_id": manager_id,
        "external_id": seller_data.external_id,
        "sync_mode": "api_sync",
        "created_at": datetime.now(timezone.utc)
    }
    
    await user_repo.insert_one(seller_doc)
    
    # Send invitation email if requested
    if seller_data.send_invitation:
        try:
            # Create invitation token
            from models.users import GerantInvitation
            invitation = GerantInvitation(
                name=seller_data.name,
                email=seller_data.email,
                role="seller",
                gerant_id=tenant_id,
                gerant_name="Gérant",  # TODO: Get from user if needed
                store_id=store_id,
                store_name=store.get('name', 'Store'),
                manager_id=manager_id,
                manager_name=manager.get('name') if manager else None
            )
            
            await db.gerant_invitations.insert_one(invitation.model_dump())
            
            # TODO: Send invitation email
            # await send_seller_invitation_email(...)
        except Exception as e:
            # Log error but don't fail the creation
            print(f"Failed to send invitation email: {e}")
    
    # Audit log
    # TODO: Implémenter audit log
    
    return {
        "success": True,
        "seller_id": seller_id,
        "seller": {
            "id": seller_id,
            "name": seller_data.name,
            "email": seller_data.email,
            "phone": seller_data.phone,
            "store_id": store_id,
            "manager_id": manager_id,
            "external_id": seller_data.external_id,
            "invitation_sent": seller_data.send_invitation
        }
    }


# ===== USERS UPDATE =====

@router.put("/users/{user_id}")
async def update_user_integration(
    user_id: str,
    user_data: APIUserUpdate,
    api_key: Dict = Depends(lambda: verify_api_key_with_scope("users:write"))
):
    """
    Update a user (manager or seller) via API Key
    
    Requires scope: users:write
    Refuses if user doesn't belong to an authorized store (or tenant if global access)
    """
    from core.database import get_database
    from repositories.user_repository import UserRepository
    from services.integration_service import IntegrationService
    from api.dependencies import get_integration_service
    from datetime import datetime, timezone
    
    db = get_database()
    user_repo = UserRepository(db)
    integration_service = IntegrationService(IntegrationRepository(db))
    
    # Get user to update
    user = await user_repo.find_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Verify access: user must belong to a store accessible by API key
    store_id = user.get('store_id')
    tenant_id = await integration_service.get_tenant_id_from_api_key(api_key)
    
    if not tenant_id:
        raise HTTPException(status_code=403, detail="Invalid API key configuration")
    
    # Check tenant ownership
    user_gerant_id = user.get('gerant_id')
    if user_gerant_id != tenant_id:
        raise HTTPException(
            status_code=403,
            detail="User does not belong to your tenant"
        )
    
    # Check store_ids restriction if store_id exists
    if store_id:
        store_ids = api_key.get('store_ids')
        if store_ids is not None and "*" not in store_ids:
            if store_id not in store_ids:
                raise HTTPException(
                    status_code=403,
                    detail="User does not belong to an authorized store"
                )
    
    # Check if email change and if new email already exists
    if user_data.email and user_data.email != user.get('email'):
        existing_user = await user_repo.find_by_email(user_data.email)
        if existing_user:
            raise HTTPException(status_code=400, detail="Email already registered")
    
    # Build update data
    update_data = {}
    if user_data.name:
        update_data['name'] = user_data.name
    if user_data.email:
        update_data['email'] = user_data.email
    if user_data.phone is not None:
        update_data['phone'] = user_data.phone
    if user_data.status:
        if user_data.status not in ['active', 'suspended']:
            raise HTTPException(status_code=400, detail="Status must be 'active' or 'suspended'")
        update_data['status'] = user_data.status
    if user_data.external_id is not None:
        update_data['external_id'] = user_data.external_id
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    update_data['updated_at'] = datetime.now(timezone.utc)
    
    # Update user
    await user_repo.update_one(user_id, update_data)
    
    # Get updated user
    updated_user = await user_repo.find_by_id(user_id)
    
    # Audit log
    # TODO: Implémenter audit log
    
    return {
        "success": True,
        "user_id": user_id,
        "user": {
            "id": updated_user['id'],
            "name": updated_user.get('name'),
            "email": updated_user.get('email'),
            "role": updated_user.get('role'),
            "status": updated_user.get('status'),
            "phone": updated_user.get('phone'),
            "store_id": updated_user.get('store_id'),
            "external_id": updated_user.get('external_id')
        }
    }


# ===== SUPPRIMER ENDPOINT LEGACY =====

# SUPPRIMER cette section (lignes 152-165):
# @router.post("/v1/kpi/sync")
# async def sync_kpi_data_legacy(...):
#     ...

