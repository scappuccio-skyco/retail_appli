# 🔒 Synthèse - 3 Points Critiques Verrouillés

## ✅ Point 1: Tenant Resolution

### Modèle Exact

**Collection** : `api_keys`

```python
{
    "id": str,
    "key_hash": str,
    "key_prefix": str,
    "name": str,
    "user_id": str,              # Propriétaire
    "tenant_id": str,            # 🔒 CRITIQUE: Tenant explicite (gerant_id)
    "permissions": List[str],
    "store_ids": Optional[List[str]],
    "expires_at": Optional[float],
    "active": bool,
    "created_at": datetime
}
```

### Résolution

**Source de vérité** : `api_key.tenant_id` (champ explicite)

**Résolution lors de la création** :
```python
if user.role in ['gerant', 'gérant']:
    tenant_id = user_id
else:
    tenant_id = user.gerant_id
    if not tenant_id:
        raise ValueError("User must have a gerant_id")
```

**Méthode** : `get_tenant_id_from_api_key()` - PRIORITÉ 1: `tenant_id` explicite, PRIORITÉ 2: Résolution depuis `user_id`

**Interdiction** : Aucune déduction implicite non fiable.

---

## ✅ Point 2: PUT /api/integrations/users/{user_id}

### Code Exact de Vérification

```python
# 1. Obtenir tenant_id explicitement
tenant_id = await integration_service.get_tenant_id_from_api_key(api_key)

# 2. Vérifier que user appartient au tenant
if user.get('gerant_id') != tenant_id:
    raise HTTPException(403, "User does not belong to your tenant")

# 3. Si store_ids est défini, vérifier que user.store_id est autorisé
user_store_id = user.get('store_id')
if user_store_id:
    store_ids = api_key.get('store_ids')
    if store_ids is not None and "*" not in store_ids:
        if user_store_id not in store_ids:
            raise HTTPException(403, "User does not belong to an authorized store")

# 4. Whitelist stricte
ALLOWED = ['name', 'phone', 'status', 'external_id', 'email']
FORBIDDEN = ['gerant_id', 'tenant_id', 'store_id', 'role', 'password', 'id']
```

### Whitelist

**Autorisés** : `name`, `phone`, `status`, `external_id`, `email` (avec vérification unicité)

**Interdits** : `gerant_id`, `tenant_id`, `store_id`, `role`, `password`, `id`

---

## ✅ Point 3: POST managers/sellers

### Code Exact - Forcer store_id depuis Path

```python
@router.post("/stores/{store_id}/managers")
async def create_manager_integration(
    store_id: str,  # 🔒 CRITIQUE: Depuis path uniquement
    manager_data: APIManagerCreate,
    api_key: Dict = Depends(lambda: verify_api_key_with_scope("users:write")),
    store: Dict = Depends(verify_store_access)  # 🔒 Vérifie AVANT création
):
    # CRITIQUE: store_id est déjà vérifié par verify_store_access
    # Double vérification tenant
    tenant_id = await integration_service.get_tenant_id_from_api_key(api_key)
    if store.get('gerant_id') != tenant_id:
        raise HTTPException(403, "Store does not belong to API key tenant")
    
    # CRITIQUE: Forcer store_id depuis path (ignorer body)
    manager_doc = {
        "store_id": store_id,  # Depuis path, pas body
        "gerant_id": tenant_id,
        # ...
    }
```

**Garanties** :
1. `store_id` du path utilisé, body ignoré
2. `verify_store_access()` appelé AVANT création
3. Double vérification : `store.gerant_id == tenant_id`

---

## 📦 Diffs Finaux

### Diff 1: `backend/services/integration_service.py`
**Fichier** : `DIFF_FINAL_1_integration_service.py`

### Diff 2: `backend/api/routes/integrations.py`
**Fichier** : `DIFF_FINAL_2_integrations_routes.py`

### Diff 3: `backend/tests/test_integrations_crud.py`
**Fichier** : `DIFF_FINAL_3_tests.py`

---

## 🧪 Tests Critiques

1. ✅ `test_update_user_hors_tenant_403()` - User hors tenant => 403
2. ✅ `test_update_user_hors_store_ids_403()` - User hors store_ids => 403
3. ✅ `test_create_manager_body_store_id_ignored()` - Body store_id ignoré
4. ✅ `test_create_seller_body_store_id_ignored()` - Body store_id ignoré

---

## 🔐 Garanties

1. **Tenant Isolation** : `tenant_id` explicite, aucune déduction implicite
2. **Store Isolation** : Si `store_ids` défini, accès uniquement aux stores listés
3. **Path Enforcement** : `store_id` du path toujours utilisé
4. **Field Whitelist** : Seuls les champs autorisés modifiables
5. **Double Vérification** : Tenant vérifié à chaque étape

