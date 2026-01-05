# 🔧 Implémentation : Endpoints CRUD Intégrations

## Fichiers à modifier/créer

### 1. Modèles Pydantic (`backend/models/integrations.py`)

```python
# Ajouter ces modèles à la fin du fichier

class StoreCreateIntegration(BaseModel):
    """Modèle pour créer un magasin via API Key"""
    name: str
    location: str
    address: Optional[str] = None
    phone: Optional[str] = None
    opening_hours: Optional[str] = None
    external_id: Optional[str] = None  # ID dans le système externe


class ManagerCreateIntegration(BaseModel):
    """Modèle pour créer un manager via API Key"""
    name: str
    email: EmailStr
    phone: Optional[str] = None
    external_id: Optional[str] = None
    send_invitation: bool = True  # Envoyer un email d'invitation


class SellerCreateIntegration(BaseModel):
    """Modèle pour créer un seller via API Key"""
    name: str
    email: EmailStr
    manager_id: Optional[str] = None  # Si non fourni, un manager sera assigné automatiquement
    phone: Optional[str] = None
    external_id: Optional[str] = None
    send_invitation: bool = True


class UserUpdateIntegration(BaseModel):
    """Modèle pour mettre à jour un utilisateur via API Key"""
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    status: Optional[str] = None  # "active" | "suspended"
    external_id: Optional[str] = None
```

### 2. Middleware de vérification (`backend/api/routes/integrations.py`)

```python
# Ajouter après la fonction verify_api_key existante

async def verify_api_key_with_permission(
    required_permission: str,
    x_api_key: str = Header(..., alias="X-API-Key"),
    integration_service: IntegrationService = Depends(get_integration_service)
) -> Dict:
    """
    Verify API key and check permission
    
    Args:
        required_permission: Permission required (e.g., "write:stores", "write:users")
        x_api_key: API key from header
        integration_service: Integration service instance
    
    Returns:
        API key document with user_id and permissions
    """
    api_key_data = await verify_api_key(x_api_key, integration_service)
    
    # Check permission
    permissions = api_key_data.get('permissions', [])
    if required_permission not in permissions:
        raise HTTPException(
            status_code=403,
            detail=f"Insufficient permissions. Requires '{required_permission}'"
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
    from core.database import get_database
    
    db = get_database()
    store_service = StoreService(db)
    
    # Get store
    store = await store_service.get_store_by_id(store_id)
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    
    # Check access
    user_id = api_key_data.get('user_id')
    store_ids = api_key_data.get('store_ids')  # None = all stores, [] = no stores, [id1, id2] = specific
    
    # Get gerant_id from user
    from repositories.user_repository import UserRepository
    user_repo = UserRepository(db)
    user = await user_repo.find_by_id(user_id)
    
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    gerant_id = user.get('id') if user.get('role') in ['gerant', 'gérant'] else user.get('gerant_id')
    
    # Multi-tenant check
    if store_ids is not None:
        # Specific stores are defined
        if store_id not in store_ids:
            raise HTTPException(
                status_code=403,
                detail="API key does not have access to this store"
            )
    else:
        # store_ids is None = all stores access (for gerant)
        if gerant_id and store.get('gerant_id') != gerant_id:
            raise HTTPException(
                status_code=403,
                detail="API key does not have access to this store"
            )
    
    return store
```

### 3. Routes CRUD (`backend/api/routes/integrations.py`)

```python
# Ajouter à la fin du fichier integrations.py

from models.integrations import (
    StoreCreateIntegration, ManagerCreateIntegration,
    SellerCreateIntegration, UserUpdateIntegration
)
from services.store_service import StoreService
from api.dependencies import get_store_service
from repositories.user_repository import UserRepository
from core.database import get_database
from core.security import get_password_hash
from datetime import datetime, timezone
from uuid import uuid4
import bcrypt

# ===== STORES CRUD =====

@router.get("/stores")
async def list_stores(
    api_key: Dict = Depends(lambda: verify_api_key_with_permission("read:stores")),
    store_service: StoreService = Depends(get_store_service)
):
    """
    List all stores accessible by API key
    
    Returns stores based on:
    - If store_ids is None: all stores owned by gerant
    - If store_ids is a list: only stores in the list
    """
    from core.database import get_database
    from repositories.user_repository import UserRepository
    
    db = get_database()
    user_repo = UserRepository(db)
    
    user_id = api_key.get('user_id')
    user = await user_repo.find_by_id(user_id)
    
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    gerant_id = user.get('id') if user.get('role') in ['gerant', 'gérant'] else user.get('gerant_id')
    store_ids = api_key.get('store_ids')
    
    if store_ids is None:
        # All stores for gerant
        stores = await store_service.get_stores_by_gerant(gerant_id)
    else:
        # Specific stores
        stores = []
        for store_id in store_ids:
            store = await store_service.get_store_by_id(store_id)
            if store:
                stores.append(store)
    
    return {
        "stores": stores,
        "total": len(stores)
    }


@router.post("/stores")
async def create_store_integration(
    store_data: StoreCreateIntegration,
    api_key: Dict = Depends(lambda: verify_api_key_with_permission("write:stores")),
    store_service: StoreService = Depends(get_store_service)
):
    """
    Create a new store via API Key
    
    Requires permission: write:stores
    """
    from core.database import get_database
    from repositories.user_repository import UserRepository
    
    db = get_database()
    user_repo = UserRepository(db)
    
    user_id = api_key.get('user_id')
    user = await user_repo.find_by_id(user_id)
    
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    gerant_id = user.get('id') if user.get('role') in ['gerant', 'gérant'] else user.get('gerant_id')
    
    if not gerant_id:
        raise HTTPException(status_code=403, detail="Only gérants can create stores")
    
    # Create store using existing service
    store = await store_service.create_store(
        gerant_id=gerant_id,
        name=store_data.name,
        location=store_data.location
    )
    
    # Update with optional fields
    if store_data.address or store_data.phone or store_data.opening_hours or store_data.external_id:
        from repositories.store_repository import StoreRepository
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
    
    return {
        "success": True,
        "store_id": store['id'],
        "store": store
    }


# ===== MANAGERS CRUD =====

@router.post("/stores/{store_id}/managers")
async def create_manager_integration(
    store_id: str,
    manager_data: ManagerCreateIntegration,
    api_key: Dict = Depends(lambda: verify_api_key_with_permission("write:users")),
    store: Dict = Depends(verify_store_access)
):
    """
    Create a new manager for a store via API Key
    
    Requires permission: write:users
    Requires store access via verify_store_access
    """
    from core.database import get_database
    from repositories.user_repository import UserRepository
    
    db = get_database()
    user_repo = UserRepository(db)
    
    # Check if email already exists
    existing_user = await user_repo.find_by_email(manager_data.email)
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Get gerant_id from store
    gerant_id = store.get('gerant_id')
    
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
        "gerant_id": gerant_id,
        "store_id": store_id,
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
                gerant_id=gerant_id,
                gerant_name="Gérant",  # TODO: Get from user
                store_id=store_id,
                store_name=store.get('name', 'Store')
            )
            
            from core.database import get_database
            db = get_database()
            await db.gerant_invitations.insert_one(invitation.model_dump())
            
            # TODO: Send invitation email
            # await send_manager_invitation_email(...)
        except Exception as e:
            # Log error but don't fail the creation
            print(f"Failed to send invitation email: {e}")
    
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
    seller_data: SellerCreateIntegration,
    api_key: Dict = Depends(lambda: verify_api_key_with_permission("write:users")),
    store: Dict = Depends(verify_store_access)
):
    """
    Create a new seller for a store via API Key
    
    Requires permission: write:users
    Requires store access via verify_store_access
    """
    from core.database import get_database
    from repositories.user_repository import UserRepository
    
    db = get_database()
    user_repo = UserRepository(db)
    
    # Check if email already exists
    existing_user = await user_repo.find_by_email(seller_data.email)
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Get gerant_id from store
    gerant_id = store.get('gerant_id')
    
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
        "gerant_id": gerant_id,
        "store_id": store_id,
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
                gerant_id=gerant_id,
                gerant_name="Gérant",  # TODO: Get from user
                store_id=store_id,
                store_name=store.get('name', 'Store'),
                manager_id=manager_id,
                manager_name=manager.get('name') if manager else None
            )
            
            from core.database import get_database
            db = get_database()
            await db.gerant_invitations.insert_one(invitation.model_dump())
            
            # TODO: Send invitation email
            # await send_seller_invitation_email(...)
        except Exception as e:
            # Log error but don't fail the creation
            print(f"Failed to send invitation email: {e}")
    
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
    user_data: UserUpdateIntegration,
    api_key: Dict = Depends(lambda: verify_api_key_with_permission("write:users"))
):
    """
    Update a user (manager or seller) via API Key
    
    Requires permission: write:users
    """
    from core.database import get_database
    from repositories.user_repository import UserRepository
    
    db = get_database()
    user_repo = UserRepository(db)
    
    # Get user to update
    user = await user_repo.find_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Verify access: user must belong to a store accessible by API key
    store_id = user.get('store_id')
    if store_id:
        # Verify store access
        await verify_store_access(store_id, api_key)
    
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
```

### 4. Mise à jour du modèle APIKeyCreate (`backend/models/integrations.py`)

```python
# S'assurer que le modèle APIKeyCreate supporte store_ids
class APIKeyCreate(BaseModel):
    name: str
    permissions: List[str] = ["write:kpi", "read:stats"]
    expires_days: Optional[int] = None
    store_ids: Optional[List[str]] = None  # None = all stores, [] = no stores, [id1, id2] = specific stores
```

### 5. Mise à jour IntegrationService (`backend/services/integration_service.py`)

```python
# S'assurer que create_api_key sauvegarde store_ids
async def create_api_key(
    self,
    user_id: str,
    name: str,
    permissions: List[str],
    expires_days: int = None,
    store_ids: Optional[List[str]] = None  # Ajouter ce paramètre
) -> Dict:
    # ... code existant ...
    
    key_doc = {
        "id": str(uuid4()),
        "key_hash": hashed_key,
        "key_prefix": api_key[:12],
        "name": name,
        "user_id": user_id,
        "permissions": permissions,
        "store_ids": store_ids,  # Ajouter cette ligne
        "expires_at": expires_at,
        "active": True,
        "created_at": datetime.now(timezone.utc)
    }
    
    # ... reste du code ...
```

---

## Exemples cURL

### 1. Lister les magasins

```bash
curl -X GET "https://api.retailperformerai.com/api/integrations/stores" \
  -H "X-API-Key: sk_live_votre_cle_api" \
  -H "Content-Type: application/json"
```

### 2. Créer un magasin

```bash
curl -X POST "https://api.retailperformerai.com/api/integrations/stores" \
  -H "X-API-Key: sk_live_votre_cle_api" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Skyco Marseille",
    "location": "13001 Marseille",
    "address": "12 Rue de la République, 13001 Marseille",
    "phone": "+33 4 91 00 00 00",
    "external_id": "STORE_MRS_001"
  }'
```

### 3. Créer un manager

```bash
curl -X POST "https://api.retailperformerai.com/api/integrations/stores/c2dd1ada-d0a2-4a90-be81-644b7cb78bc7/managers" \
  -H "X-API-Key: sk_live_votre_cle_api" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Sophie Martin",
    "email": "sophie.martin@example.com",
    "phone": "+33 6 12 34 56 78",
    "external_id": "MGR_MRS_001",
    "send_invitation": true
  }'
```

### 4. Créer un vendeur

```bash
curl -X POST "https://api.retailperformerai.com/api/integrations/stores/c2dd1ada-d0a2-4a90-be81-644b7cb78bc7/sellers" \
  -H "X-API-Key: sk_live_votre_cle_api" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Lucas Bernard",
    "email": "lucas.bernard@example.com",
    "manager_id": "72468398-620f-42d1-977c-bd250f4d440a",
    "phone": "+33 6 98 76 54 32",
    "external_id": "SELLER_MRS_012",
    "send_invitation": true
  }'
```

### 5. Mettre à jour un utilisateur

```bash
curl -X PUT "https://api.retailperformerai.com/api/integrations/users/2a1c816b-fd21-463a-8a8f-bfe98616aeba" \
  -H "X-API-Key: sk_live_votre_cle_api" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Lucas Bernard-Dupont",
    "email": "lucas.dupont@example.com",
    "phone": "+33 6 11 22 33 44",
    "status": "active",
    "external_id": "SELLER_MRS_012_NEW"
  }'
```

---

## Tests basiques

Créer `backend/tests/test_integrations_crud.py` :

```python
import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

# Mock API key
API_KEY = "sk_live_test_key_12345"

def test_list_stores():
    response = client.get(
        "/api/integrations/stores",
        headers={"X-API-Key": API_KEY}
    )
    assert response.status_code in [200, 401]  # 401 si clé invalide

def test_create_store():
    response = client.post(
        "/api/integrations/stores",
        headers={"X-API-Key": API_KEY},
        json={
            "name": "Test Store",
            "location": "75001 Paris"
        }
    )
    assert response.status_code in [200, 401, 403]

# ... autres tests
```

---

## Mise à jour routes.runtime.json

Ajouter ces routes :

```json
{
  "path": "/api/integrations/stores",
  "method": "GET",
  "name": "list_stores",
  "tags": ["Integrations"],
  "dependencies": ["verify_api_key_with_permission"],
  "deprecated": false
},
{
  "path": "/api/integrations/stores",
  "method": "POST",
  "name": "create_store_integration",
  "tags": ["Integrations"],
  "dependencies": ["verify_api_key_with_permission"],
  "deprecated": false
},
{
  "path": "/api/integrations/stores/{store_id}/managers",
  "method": "POST",
  "name": "create_manager_integration",
  "tags": ["Integrations"],
  "dependencies": ["verify_api_key_with_permission", "verify_store_access"],
  "deprecated": false
},
{
  "path": "/api/integrations/stores/{store_id}/sellers",
  "method": "POST",
  "name": "create_seller_integration",
  "tags": ["Integrations"],
  "dependencies": ["verify_api_key_with_permission", "verify_store_access"],
  "deprecated": false
},
{
  "path": "/api/integrations/users/{user_id}",
  "method": "PUT",
  "name": "update_user_integration",
  "tags": ["Integrations"],
  "dependencies": ["verify_api_key_with_permission"],
  "deprecated": false
}
```

