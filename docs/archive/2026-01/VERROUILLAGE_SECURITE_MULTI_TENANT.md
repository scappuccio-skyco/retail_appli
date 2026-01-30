# 🔒 Verrouillage Sécurité Multi-Tenant - API Intégrations

## 📋 Modèle Exact de l'API Key

### Schéma Database (Collection `api_keys`)

```python
{
    "id": str,                    # UUID de la clé
    "key_hash": str,              # Hash bcrypt de la clé
    "key_prefix": str,           # 12 premiers caractères (pour recherche)
    "name": str,                  # Nom descriptif
    "user_id": str,               # ID du propriétaire de la clé (gérant ou user)
    "tenant_id": str,             # 🔒 CRITIQUE: Tenant explicite (gerant_id)
    "permissions": List[str],     # ["stores:read", "stores:write", "users:write", "kpi:write"]
    "store_ids": Optional[List[str]],  # None = all stores, ["*"] = all, [id1, id2] = specific
    "expires_at": Optional[float], # Timestamp Unix (ou None)
    "active": bool,               # True si active
    "created_at": datetime        # Date de création
}
```

### Résolution du Tenant

**Source de vérité** : `api_key.tenant_id` (champ explicite)

**Résolution lors de la création** :
```python
if user.role in ['gerant', 'gérant']:
    tenant_id = user_id  # Le gérant est son propre tenant
else:
    tenant_id = user.gerant_id  # Le tenant est le gérant du user
    if not tenant_id:
        raise ValueError("User must have a gerant_id")
```

**Migration** : Pour les clés existantes sans `tenant_id`, résolution automatique depuis `user_id` lors de `verify_api_key()`.

---

## 🔒 Point Critique 1: Tenant Resolution

### Code Exact dans `IntegrationService.create_api_key()`

```python
# CRITIQUE: Résoudre tenant_id explicitement AVANT création
db = get_database()
user_repo = UserRepository(db)
user = await user_repo.find_by_id(user_id)

if not user:
    raise ValueError("User not found")

# CRITIQUE: Résolution explicite du tenant_id
user_role = user.get('role')
if user_role in ['gerant', 'gérant']:
    tenant_id = user_id
else:
    tenant_id = user.get('gerant_id')
    if not tenant_id:
        raise ValueError("User must have a gerant_id (tenant) to create API key")

# CRITIQUE: Build key document avec tenant_id explicite
key_doc = {
    # ... autres champs ...
    "tenant_id": tenant_id,  # 🔒 CRITIQUE: Tenant explicite
    # ...
}
```

### Code Exact dans `IntegrationService.get_tenant_id_from_api_key()`

```python
async def get_tenant_id_from_api_key(self, api_key_data: Dict) -> Optional[str]:
    """
    CRITIQUE: Obtenir tenant_id explicitement depuis API key data
    
    PRIORITÉ 1: tenant_id explicite dans le document
    PRIORITÉ 2: Résolution depuis user_id (pour compatibilité)
    """
    # PRIORITÉ 1: tenant_id explicite dans le document
    tenant_id = api_key_data.get('tenant_id')
    if tenant_id:
        return tenant_id
    
    # PRIORITÉ 2: Résolution depuis user_id (pour compatibilité)
    user_id = api_key_data.get('user_id')
    if user_id:
        resolved_tenant_id = await self._resolve_tenant_id_from_user_id(user_id)
        if resolved_tenant_id:
            return resolved_tenant_id
    
    # CRITIQUE: Si aucun tenant_id ne peut être résolu, erreur
    raise ValueError("API key missing tenant_id and cannot resolve from user_id")
```

**Interdiction** : Aucune déduction implicite non fiable. Si `tenant_id` est absent et ne peut pas être résolu depuis `user_id`, erreur.

---

## 🔒 Point Critique 2: PUT /api/integrations/users/{user_id}

### Code Exact de Vérification

```python
@router.put("/users/{user_id}")
async def update_user_integration(
    user_id: str,
    user_data: APIUserUpdate,
    api_key: Dict = Depends(lambda: verify_api_key_with_scope("users:write"))
):
    # Get user to update
    user = await user_repo.find_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # CRITIQUE: Obtenir tenant_id explicitement depuis API key
    tenant_id = await integration_service.get_tenant_id_from_api_key(api_key)
    if not tenant_id:
        raise HTTPException(status_code=403, detail="Invalid API key configuration: missing tenant_id")
    
    # CRITIQUE: Vérification 1 - User appartient au tenant
    user_gerant_id = user.get('gerant_id')
    if user_gerant_id != tenant_id:
        raise HTTPException(
            status_code=403,
            detail="User does not belong to your tenant"
        )
    
    # CRITIQUE: Vérification 2 - store_ids restriction (si applicable)
    user_store_id = user.get('store_id')
    if user_store_id:
        store_ids = api_key.get('store_ids')
        if store_ids is not None and "*" not in store_ids:
            # store_ids spécifiques définis
            if user_store_id not in store_ids:
                raise HTTPException(
                    status_code=403,
                    detail="User does not belong to an authorized store"
                )
    
    # CRITIQUE: Whitelist stricte des champs modifiables
    ALLOWED_UPDATE_FIELDS = {
        'name': str,
        'phone': str,
        'status': str,
        'external_id': str
    }
    
    # Build update data avec whitelist
    update_data = {}
    
    if user_data.name:
        update_data['name'] = user_data.name
    
    # CRITIQUE: Email peut être modifié mais avec vérification
    if user_data.email:
        if user_data.email != user.get('email'):
            existing_user = await user_repo.find_by_email(user_data.email)
            if existing_user:
                raise HTTPException(status_code=400, detail="Email already registered")
            update_data['email'] = user_data.email
    
    # ... autres champs autorisés ...
    
    # CRITIQUE: Vérifier qu'aucun champ interdit n'est présent
    FORBIDDEN_FIELDS = ['gerant_id', 'tenant_id', 'store_id', 'role', 'password', 'id']
    for field in FORBIDDEN_FIELDS:
        if field in update_data:
            raise HTTPException(
                status_code=400,
                detail=f"Field '{field}' cannot be updated via API"
            )
    
    # Update user
    await user_repo.update_one(user_id, update_data)
```

### Whitelist Stricte

**Champs autorisés** :
- `name` (str)
- `phone` (str, peut être None)
- `status` (str: "active" | "suspended")
- `external_id` (str, peut être None)
- `email` (EmailStr, avec vérification unicité)

**Champs interdits** :
- ❌ `gerant_id` / `tenant_id` - Interdit (changement de tenant)
- ❌ `store_id` - Interdit (changement de store)
- ❌ `role` - Interdit (changement de rôle)
- ❌ `password` - Interdit (utiliser endpoint dédié)
- ❌ `id` - Interdit (immutable)

---

## 🔒 Point Critique 3: POST managers/sellers

### Code Exact - Forcer store_id depuis Path

```python
@router.post("/stores/{store_id}/managers")
async def create_manager_integration(
    store_id: str,  # 🔒 CRITIQUE: store_id depuis path uniquement
    manager_data: APIManagerCreate,
    api_key: Dict = Depends(lambda: verify_api_key_with_scope("users:write")),
    store: Dict = Depends(verify_store_access)  # 🔒 CRITIQUE: Vérifie accès AVANT création
):
    """
    CRITIQUE: Create a new manager for a store via API Key
    
    Sécurité:
    - store_id est FORCÉ depuis le path (ignoré dans body si présent)
    - verify_store_access() vérifie tenant + store_ids AVANT création
    - manager créé avec store_id du path uniquement
    """
    
    # CRITIQUE: store_id est déjà vérifié par verify_store_access
    # Le store document est passé en paramètre, garantissant l'accès
    
    # CRITIQUE: Obtenir tenant_id explicitement depuis API key
    tenant_id = await integration_service.get_tenant_id_from_api_key(api_key)
    if not tenant_id:
        raise HTTPException(status_code=403, detail="Invalid API key configuration: missing tenant_id")
    
    # CRITIQUE: Vérifier que store.gerant_id == tenant_id (double vérification)
    if store.get('gerant_id') != tenant_id:
        raise HTTPException(
            status_code=403,
            detail="Store does not belong to API key tenant"
        )
    
    # Create manager user
    manager_doc = {
        # ... autres champs ...
        "gerant_id": tenant_id,  # 🔒 CRITIQUE: tenant_id explicite
        "store_id": store_id,    # 🔒 CRITIQUE: Forcé depuis path, ignoré si présent dans body
        # ...
    }
    
    await user_repo.insert_one(manager_doc)
```

### Vérification dans `verify_store_access()`

```python
async def verify_store_access(
    store_id: str,
    api_key_data: Dict = Depends(verify_api_key),
    integration_service: IntegrationService = Depends(get_integration_service)
) -> Dict:
    # Get store
    store = await store_service.get_store_by_id(store_id)
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    
    # CRITIQUE: Obtenir tenant_id explicitement depuis API key
    tenant_id = await integration_service.get_tenant_id_from_api_key(api_key_data)
    if not tenant_id:
        raise HTTPException(status_code=403, detail="Invalid API key configuration: missing tenant_id")
    
    # CRITIQUE: Vérification 1 - Store appartient au tenant
    store_gerant_id = store.get('gerant_id')
    if store_gerant_id != tenant_id:
        raise HTTPException(
            status_code=403,
            detail="API key does not have access to this store (tenant mismatch)"
        )
    
    # CRITIQUE: Vérification 2 - store_ids restriction
    store_ids = api_key_data.get('store_ids')
    if store_ids is not None:
        if "*" in store_ids:
            # Accès global autorisé
            pass
        elif store_id not in store_ids:
            # store_ids spécifiques mais store_id pas dans la liste
            raise HTTPException(
                status_code=403,
                detail="API key does not have access to this store (not in store_ids list)"
            )
    
    return store
```

**Garanties** :
1. `store_id` du path est utilisé, celui du body est ignoré
2. `verify_store_access()` est appelé AVANT la création
3. Double vérification : `store.gerant_id == tenant_id`

---

## 📋 Tests Critiques

### Test 1: Update user hors tenant => 403

```python
def test_update_user_hors_tenant_403():
    """
    Scénario:
    - API key tenant A
    - User appartient à tenant B
    - Attendu: 403 "User does not belong to your tenant"
    """
    # Mock API key tenant A
    # Mock user avec gerant_id = tenant B
    # Vérifier 403
```

### Test 2: Update user hors store_ids => 403

```python
def test_update_user_hors_store_ids_403():
    """
    Scénario:
    - API key tenant A avec store_ids=["store-a-1", "store-a-2"]
    - User appartient à tenant A mais store_id="store-a-3"
    - Attendu: 403 "User does not belong to an authorized store"
    """
    # Mock API key avec store_ids restreints
    # Mock user dans store non autorisé
    # Vérifier 403
```

### Test 3: Body store_id ignoré => user créé dans store du path

```python
def test_create_manager_body_store_id_ignored():
    """
    Scénario:
    - POST /api/integrations/stores/store-a-1/managers
    - Body contient store_id="store-a-2"
    - Attendu: Manager créé avec store_id="store-a-1" (depuis path)
    """
    # Mock verify_store_access pour store-a-1
    # Body avec store_id="store-a-2"
    # Vérifier que insert_one est appelé avec store_id="store-a-1"
```

---

## 📦 Diffs Finaux

### Diff 1: `backend/services/integration_service.py`

Voir `DIFF_FINAL_1_integration_service.py`

**Changements** :
- Ajouter `store_ids` paramètre à `create_api_key()`
- Résoudre `tenant_id` explicitement lors de la création
- Ajouter `tenant_id` dans `key_doc`
- Ajouter méthode `get_tenant_id_from_api_key()` avec résolution explicite
- Migration automatique pour clés existantes sans `tenant_id`

### Diff 2: `backend/api/routes/integrations.py`

Voir `DIFF_FINAL_2_integrations_routes.py`

**Changements** :
- Middleware `verify_api_key_with_scope()` - Vérifie permission
- Middleware `verify_store_access()` - Vérifie tenant + store_ids
- Route `PUT /users/{user_id}` - Vérifications strictes tenant + store_ids + whitelist
- Routes `POST /stores/{store_id}/managers` et `/sellers` - Forcer store_id depuis path
- Supprimer endpoint legacy `/v1/kpi/sync`

### Diff 3: `backend/tests/test_integrations_crud.py`

Voir `DIFF_FINAL_3_tests.py`

**Tests** :
- `test_update_user_hors_tenant_403()` - User hors tenant
- `test_update_user_hors_store_ids_403()` - User hors store_ids
- `test_update_user_dans_scope_200()` - User dans scope autorisé
- `test_create_manager_body_store_id_ignored()` - Body store_id ignoré
- `test_create_seller_body_store_id_ignored()` - Body store_id ignoré

---

## ✅ Checklist de Vérification

- [x] `tenant_id` stocké explicitement dans `api_keys` collection
- [x] Résolution `tenant_id` explicite (pas de déduction implicite)
- [x] `PUT /users/{user_id}` vérifie tenant + store_ids
- [x] Whitelist stricte des champs modifiables
- [x] `POST managers/sellers` force `store_id` depuis path
- [x] `verify_store_access()` appelé AVANT création
- [x] Tests couvrent tous les cas critiques
- [x] Migration automatique pour clés existantes

---

## 🔐 Garanties de Sécurité

1. **Tenant Isolation** : Aucun accès cross-tenant possible
2. **Store Isolation** : Si `store_ids` est défini, accès uniquement aux stores listés
3. **Path Enforcement** : `store_id` du path est toujours utilisé, body ignoré
4. **Field Whitelist** : Seuls les champs autorisés peuvent être modifiés
5. **Explicit Resolution** : `tenant_id` toujours résolu explicitement, jamais déduit implicitement

