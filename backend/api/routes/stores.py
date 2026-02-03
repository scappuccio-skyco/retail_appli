"""Store & Workspace Routes"""
import logging
from fastapi import APIRouter, Depends
from typing import Dict

from core.constants import ERR_ACCES_REFUSE_MAGASIN_AUTRE_GERANT
from core.exceptions import NotFoundError, ForbiddenError, ValidationError
from models.stores import StoreCreate, StoreUpdate
from services.store_service import StoreService
from api.dependencies import get_store_service
from core.security import get_current_gerant, get_gerant_or_manager, get_current_user, require_active_space

logger = logging.getLogger(__name__)
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
    return await store_service.create_store(
        gerant_id=current_user['id'],
        name=store_data.name,
        location=store_data.location,
        manager_id=store_data.manager_id
    )


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
    return await store_service.get_stores_by_gerant(current_user['id'])


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
    hierarchy = await store_service.get_store_hierarchy(store_id)
    if not hierarchy:
        raise NotFoundError("Store not found")
    store = hierarchy['store']
    user_role = current_user.get('role')
    if user_role in ['gerant', 'gérant']:
        if store.get('gerant_id') != current_user['id']:
            raise ForbiddenError("Access denied")
    elif user_role == 'manager':
        if current_user.get('store_id') != store_id:
            raise ForbiddenError("Access denied: not your store")
    else:
        raise ForbiddenError("Access denied")
    return hierarchy


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
    store = await store_service.get_store_by_id(store_id)
    if not store:
        raise NotFoundError("Store not found")
    if not store.get('active', True):
        raise ForbiddenError("Store is inactive")
    user_role = current_user.get('role')
    if user_role in ['gerant', 'gérant']:
        store_gerant_id = store.get('gerant_id')
        user_id = current_user.get('id')
        if store_gerant_id != user_id:
            logger.warning(f"Gérant {user_id} attempted to access store {store_id} owned by {store_gerant_id}")
            raise ForbiddenError(
                ERR_ACCES_REFUSE_MAGASIN_AUTRE_GERANT.format(
                    store_id=store_id, user_id=user_id, store_gerant_id=store_gerant_id
                )
            )
    elif user_role == 'manager':
        user_store_id = current_user.get('store_id')
        if user_store_id != store_id:
            raise ForbiddenError(
                f"Access denied: manager is assigned to store {user_store_id}, not {store_id}"
            )
    elif user_role == 'seller':
        user_store_id = current_user.get('store_id')
        if user_store_id != store_id:
            raise ForbiddenError(
                f"Access denied: seller is assigned to store {user_store_id}, not {store_id}"
            )
        return {
            "id": store.get('id'),
            "name": store.get('name'),
            "location": store.get('location')
        }
    else:
        raise ForbiddenError("Access denied: invalid role")
    return store
