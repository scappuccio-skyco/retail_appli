"""Store & Workspace Routes"""
from fastapi import APIRouter, Depends, HTTPException
from typing import Dict

from models.stores import StoreCreate, StoreUpdate
from services.store_service import StoreService
from api.dependencies import get_store_service
from core.security import get_current_gerant, get_gerant_or_manager, get_current_user, require_active_space

router = APIRouter(
    prefix="/stores",
    tags=["Stores & Workspaces"],
    dependencies=[Depends(require_active_space)]
)


@router.post("/")
async def create_store(
    store_data: StoreCreate,
    current_user: Dict = Depends(get_current_gerant),
    store_service: StoreService = Depends(get_store_service)
):
    """
    Create a new store
    
    Args:
        store_data: Store creation data
        current_user: Authenticated gérant
        store_service: Store service instance
        
    Returns:
        Created store
    """
    try:
        store = await store_service.create_store(
            gerant_id=current_user['id'],
            name=store_data.name,
            location=store_data.location,
            manager_id=store_data.manager_id
        )
        return store
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/my-stores")
async def get_my_stores(
    current_user: Dict = Depends(get_current_gerant),
    store_service: StoreService = Depends(get_store_service)
):
    """
    Get all stores for current gérant
    
    Args:
        current_user: Authenticated gérant
        store_service: Store service instance
        
    Returns:
        List of stores
    """
    try:
        stores = await store_service.get_stores_by_gerant(current_user['id'])
        return stores
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{store_id}/hierarchy")
async def get_store_hierarchy(
    store_id: str,
    current_user: Dict = Depends(get_gerant_or_manager),
    store_service: StoreService = Depends(get_store_service)
):
    """
    Get store with full hierarchy (manager + sellers)
    
    Accessible by:
    - Gérant who owns the store
    - Manager assigned to the store
    
    Args:
        store_id: Store ID
        current_user: Authenticated gérant or manager
        store_service: Store service instance
        
    Returns:
        Store hierarchy
    """
    try:
        hierarchy = await store_service.get_store_hierarchy(store_id)
        
        if not hierarchy:
            raise HTTPException(status_code=404, detail="Store not found")
        
        # Verify access rights
        store = hierarchy['store']
        user_role = current_user.get('role')
        
        # Gérant: must own the store
        if user_role in ['gerant', 'gérant']:
            if store.get('gerant_id') != current_user['id']:
                raise HTTPException(status_code=403, detail="Access denied")
        
        # Manager: must be assigned to this store
        elif user_role == 'manager':
            if current_user.get('store_id') != store_id:
                raise HTTPException(status_code=403, detail="Access denied: not your store")
        
        else:
            raise HTTPException(status_code=403, detail="Access denied")
        
        return hierarchy
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{store_id}/info")
async def get_store_info(
    store_id: str,
    current_user: Dict = Depends(get_current_user),
    store_service: StoreService = Depends(get_store_service)
):
    """
    Get store basic info
    
    Accessible by:
    - Gérant who owns the store
    - Manager assigned to the store
    - Seller assigned to the store (limited info)
    
    Args:
        store_id: Store ID
        current_user: Authenticated user
        
    Returns:
        Store info
    """
    try:
        store = await store_service.get_store_by_id(store_id)
        
        if not store:
            raise HTTPException(status_code=404, detail="Store not found")
        
        # Check if store is active
        if not store.get('active', True):
            raise HTTPException(status_code=403, detail="Store is inactive")
        
        # Verify access rights
        user_role = current_user.get('role')
        
        # Gérant: must own the store
        if user_role in ['gerant', 'gérant']:
            if store.get('gerant_id') != current_user['id']:
                raise HTTPException(status_code=403, detail="Access denied: not your store")
        
        # Manager: must be assigned to this store
        elif user_role == 'manager':
            user_store_id = current_user.get('store_id')
            if user_store_id != store_id:
                raise HTTPException(
                    status_code=403, 
                    detail=f"Access denied: manager is assigned to store {user_store_id}, not {store_id}"
                )
        
        # Seller: must be assigned to this store (return limited info)
        elif user_role == 'seller':
            user_store_id = current_user.get('store_id')
            if user_store_id != store_id:
                raise HTTPException(
                    status_code=403, 
                    detail=f"Access denied: seller is assigned to store {user_store_id}, not {store_id}"
                )
            # Return only basic info for sellers
            return {
                "id": store.get('id'),
                "name": store.get('name'),
                "location": store.get('location')
            }
        
        else:
            raise HTTPException(status_code=403, detail="Access denied: invalid role")
        
        return store
    except HTTPException:
        raise
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error fetching store info: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
