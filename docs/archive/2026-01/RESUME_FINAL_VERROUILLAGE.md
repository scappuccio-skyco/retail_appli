# 🔒 Résumé Final - Verrouillage Sécurité Multi-Tenant

## ✅ Point Critique 1: Tenant Resolution

### Modèle Exact de l'API Key

**Collection MongoDB** : `api_keys`

```python
{
    "id": str,                           # UUID
    "key_hash": str,                     # Hash bcrypt
    "key_prefix": str,                   # 12 premiers caractères
    "name": str,                         # Nom descriptif
    "user_id": str,                      # Propriétaire de la clé
    "tenant_id": str,                    # 🔒 CRITIQUE: Tenant explicite (gerant_id)
    "permissions": List[str],            # ["stores:read", "stores:write", "users:write", "kpi:write"]
    "store_ids": Optional[List[str]],     # None = all, ["*"] = all, [id1, id2] = specific
    "expires_at": Optional[float],        # Timestamp Unix
    "active": bool,
    "created_at": datetime
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

**Interdiction** : Aucune déduction implicite non fiable. Si `tenant_id` est absent et ne peut pas être résolu, erreur.

---

## ✅ Point Critique 2: PUT /api/integrations/users/{user_id}

### Code Exact de Vérification

```python
# 1. Obtenir tenant_id explicitement
tenant_id = await integration_service.get_tenant_id_from_api_key(api_key)

# 2. Vérifier que user appartient au tenant
user_gerant_id = user.get('gerant_id')
if user_gerant_id != tenant_id:
    raise HTTPException(403, "User does not belong to your tenant")

# 3. Si store_ids est défini, vérifier que user.store_id est autorisé
user_store_id = user.get('store_id')
if user_store_id:
    store_ids = api_key.get('store_ids')
    if store_ids is not None and "*" not in store_ids:
        if user_store_id not in store_ids:
            raise HTTPException(403, "User does not belong to an authorized store")

# 4. Whitelist stricte des champs modifiables
ALLOWED_FIELDS = ['name', 'phone', 'status', 'external_id', 'email']
FORBIDDEN_FIELDS = ['gerant_id', 'tenant_id', 'store_id', 'role', 'password', 'id']
```

### Whitelist Stricte

**Autorisés** : `name`, `phone`, `status`, `external_id`, `email` (avec vérification unicité)

**Interdits** : `gerant_id`, `tenant_id`, `store_id`, `role`, `password`, `id`

---

## ✅ Point Critique 3: POST managers/sellers

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
    # Le store document est passé en paramètre
    
    # CRITIQUE: Double vérification tenant
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
1. `store_id` du path est utilisé, celui du body est ignoré
2. `verify_store_access()` est appelé AVANT la création
3. Double vérification : `store.gerant_id == tenant_id`

---

## 📦 Diffs Finaux

### Diff 1: `backend/services/integration_service.py`

**Fichier** : `DIFF_FINAL_1_integration_service.py`

**Changements** :
- Ajouter paramètre `store_ids` à `create_api_key()`
- Résoudre `tenant_id` explicitement lors de la création
- Ajouter `tenant_id` dans `key_doc`
- Ajouter méthode `get_tenant_id_from_api_key()` avec résolution explicite
- Migration automatique pour clés existantes sans `tenant_id`

### Diff 2: `backend/api/routes/integrations.py`

**Fichier** : `DIFF_FINAL_2_integrations_routes.py`

**Changements** :
- Middleware `verify_api_key_with_scope()` - Vérifie permission
- Middleware `verify_store_access()` - Vérifie tenant + store_ids
- Route `PUT /users/{user_id}` - Vérifications strictes + whitelist
- Routes `POST /stores/{store_id}/managers` et `/sellers` - Forcer store_id depuis path
- Supprimer endpoint legacy `/v1/kpi/sync`

### Diff 3: `backend/tests/test_integrations_crud.py`

**Fichier** : `DIFF_FINAL_3_tests.py`

**Tests critiques** :
- ✅ `test_update_user_hors_tenant_403()` - User hors tenant => 403
- ✅ `test_update_user_hors_store_ids_403()` - User hors store_ids => 403
- ✅ `test_update_user_dans_scope_200()` - User dans scope => 200
- ✅ `test_create_manager_body_store_id_ignored()` - Body store_id ignoré
- ✅ `test_create_seller_body_store_id_ignored()` - Body store_id ignoré

---

## 🔐 Garanties de Sécurité

1. **Tenant Isolation** : `tenant_id` explicite, aucune déduction implicite
2. **Store Isolation** : Si `store_ids` défini, accès uniquement aux stores listés
3. **Path Enforcement** : `store_id` du path toujours utilisé, body ignoré
4. **Field Whitelist** : Seuls les champs autorisés peuvent être modifiés
5. **Double Vérification** : Tenant vérifié à chaque étape critique

---

## 📋 Checklist d'Implémentation

- [ ] Appliquer Diff 1: `integration_service.py`
- [ ] Appliquer Diff 2: `integrations.py`
- [ ] Créer Diff 3: `test_integrations_crud.py`
- [ ] Vérifier que tous les tests passent
- [ ] Vérifier que `tenant_id` est bien stocké dans la base
- [ ] Vérifier que la migration fonctionne pour les clés existantes

