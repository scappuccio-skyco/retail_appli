"""Store & Workspace Routes"""
from fastapi import APIRouter, Depends, HTTPException
from typing import Dict

from models.stores import StoreCreate, StoreUpdate
from services.store_service import StoreService
from api.dependencies import get_store_service
from core.security import get_current_gerant, get_gerant_or_manager

router = APIRouter(prefix="/stores", tags=["Stores & Workspaces"])


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
        from repositories.store_repository import StoreRepository
        from core.database import get_db
        
        db = await get_db()
        store_repo = StoreRepository(db)
        
        stores = await store_repo.find_by_gerant(current_user['id'])
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
