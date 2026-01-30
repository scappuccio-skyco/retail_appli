# 📋 Résumé Complet - Implémentation API Intégrations CRUD

## 🎯 Objectif

Réintroduire une API Intégrations (X-API-Key) multi-tenant, stable, avec endpoints CRUD pour stores/managers/sellers/users.

## 📁 Fichiers Impactés

### À modifier

1. **`backend/services/integration_service.py`**
   - Ajouter `store_ids` paramètre à `create_api_key()`
   - Ajouter méthode `get_tenant_id_from_api_key()`

2. **`backend/api/routes/integrations.py`**
   - Ajouter middlewares `verify_api_key_with_scope()` et `verify_store_access()`
   - Ajouter 5 routes CRUD
   - Supprimer endpoint legacy `/v1/kpi/sync`

3. **`routes.runtime.json`**
   - Ajouter 5 nouvelles routes
   - Marquer `/v1/kpi/sync` comme deprecated

4. **`backend/tests/test_integrations_crud.py`** (nouveau)
   - Tests basiques

5. **`API_INTEGRATION_GUIDE.md`**
   - Documentation complète

6. **`API_EXAMPLES.md`**
   - Exemples cURL

### Vérifiés (pas de modification)

- `backend/models/integrations.py` - Modèles déjà présents ✅
- `backend/repositories/integration_repository.py` - Supporte store_ids ✅
- `backend/services/store_service.py` - Réutilisable ✅
- `backend/repositories/user_repository.py` - Réutilisable ✅

---

## 🔍 Diagnostic

**Pourquoi les routes n'existent pas ?**

1. Migration incomplète vers Clean Architecture
2. Endpoints existaient dans `backend/_archived_legacy/server.py` (lignes 14530-14747)
3. Seuls KPI sync et gestion des clés API ont été migrés
4. Routes CRUD jamais recréées

**Solution** : Réintroduire dans `backend/api/routes/integrations.py` en réutilisant les services existants.

---

## 📝 Diff Complet

### 1. `backend/services/integration_service.py`

Voir `PLAN_IMPLEMENTATION_INTEGRATIONS_CRUD.md` section "Diff de Code" pour le code exact.

**Changements** :
- Ajouter paramètre `store_ids` à `create_api_key()`
- Ajouter méthode `get_tenant_id_from_api_key()`

### 2. `backend/api/routes/integrations.py`

Voir `DIFF_INTEGRATIONS_ROUTES.py` pour le code complet.

**Ajouts** :
- Middleware `verify_api_key_with_scope(required_scope: str)`
- Middleware `verify_store_access(store_id: str)`
- Route `GET /api/integrations/stores`
- Route `POST /api/integrations/stores`
- Route `POST /api/integrations/stores/{store_id}/managers`
- Route `POST /api/integrations/stores/{store_id}/sellers`
- Route `PUT /api/integrations/users/{user_id}`

**Suppressions** :
- Endpoint legacy `/v1/kpi/sync` (lignes 152-165)

### 3. `routes.runtime.json`

Ajouter ces routes :

```json
{
  "path": "/api/integrations/stores",
  "method": "GET",
  "name": "list_stores",
  "tags": ["Integrations"],
  "dependencies": ["verify_api_key_with_scope"],
  "deprecated": false
},
{
  "path": "/api/integrations/stores",
  "method": "POST",
  "name": "create_store_integration",
  "tags": ["Integrations"],
  "dependencies": ["verify_api_key_with_scope"],
  "deprecated": false
},
{
  "path": "/api/integrations/stores/{store_id}/managers",
  "method": "POST",
  "name": "create_manager_integration",
  "tags": ["Integrations"],
  "dependencies": ["verify_api_key_with_scope", "verify_store_access"],
  "deprecated": false
},
{
  "path": "/api/integrations/stores/{store_id}/sellers",
  "method": "POST",
  "name": "create_seller_integration",
  "tags": ["Integrations"],
  "dependencies": ["verify_api_key_with_scope", "verify_store_access"],
  "deprecated": false
},
{
  "path": "/api/integrations/users/{user_id}",
  "method": "PUT",
  "name": "update_user_integration",
  "tags": ["Integrations"],
  "dependencies": ["verify_api_key_with_scope"],
  "deprecated": false
}
```

Marquer `/api/integrations/v1/kpi/sync` comme deprecated.

---

## 🧪 Tests

### Fichier : `backend/tests/test_integrations_crud.py`

Voir `PLAN_IMPLEMENTATION_INTEGRATIONS_CRUD.md` section "Tests" pour le code.

**Tests obligatoires** :
- ✅ 401 sans clé API
- ✅ 401 avec clé invalide
- ✅ 403 scope manquant
- ✅ 403 store non autorisé
- ✅ 200 create store
- ✅ 200 create manager
- ✅ 200 update user dans scope

### Commandes

```bash
# Tests
cd backend
pytest tests/test_integrations_crud.py -v

# Lint docs
python backend/scripts/lint_docs.py

# Vérification imports
python -m py_compile backend/api/routes/integrations.py
python -m py_compile backend/services/integration_service.py
```

---

## 📦 Plan de Commits (6 commits)

### Commit 1: Support store_ids dans IntegrationService
```
feat(integrations): ajouter support store_ids dans IntegrationService

- Ajouter paramètre store_ids à create_api_key()
- Ajouter méthode get_tenant_id_from_api_key()
- Mettre à jour key_doc pour inclure store_ids
```

**Fichiers** : `backend/services/integration_service.py`

---

### Commit 2: Middlewares de sécurité
```
feat(integrations): ajouter middlewares verify_api_key_with_scope et verify_store_access

- verify_api_key_with_scope: vérifie permission requise
- verify_store_access: vérifie accès multi-tenant au store
- Support store_ids: None = global, ["*"] = global, [id1, id2] = spécifiques
```

**Fichiers** : `backend/api/routes/integrations.py` (middlewares uniquement)

---

### Commit 3: Routes CRUD Stores
```
feat(integrations): ajouter routes CRUD pour stores (GET, POST)

- GET /api/integrations/stores: lister stores autorisés
- POST /api/integrations/stores: créer un store
- Réutilisation de StoreService existant
- Contrôle multi-tenant via store_ids
```

**Fichiers** : `backend/api/routes/integrations.py` (routes stores)

---

### Commit 4: Routes CRUD Users
```
feat(integrations): ajouter routes CRUD pour users (managers, sellers, update)

- POST /api/integrations/stores/{store_id}/managers: créer manager
- POST /api/integrations/stores/{store_id}/sellers: créer seller
- PUT /api/integrations/users/{user_id}: mettre à jour user
- Réutilisation de UserRepository existant
- Forcer store_id du path (ignorer body)
- Supprimer endpoint legacy /v1/kpi/sync
```

**Fichiers** : `backend/api/routes/integrations.py` (routes users + suppression legacy)

---

### Commit 5: Tests et routes.runtime.json
```
test(integrations): ajouter tests basiques pour endpoints CRUD

- Tests 401 sans clé
- Tests 403 scope manquant
- Tests 403 store non autorisé
- Tests 200 create/update success
- Mettre à jour routes.runtime.json avec nouvelles routes
```

**Fichiers** :
- `backend/tests/test_integrations_crud.py` (nouveau)
- `routes.runtime.json`

---

### Commit 6: Documentation
```
docs(api): mettre à jour documentation pour endpoints CRUD intégrations

- Ajouter section "Gestion des Magasins via API" dans API_INTEGRATION_GUIDE.md
- Ajouter section "Gestion des Utilisateurs via API"
- Ajouter exemples cURL dans API_EXAMPLES.md
- Vérifier lint_docs.py
```

**Fichiers** :
- `API_INTEGRATION_GUIDE.md`
- `API_EXAMPLES.md`

---

## 📋 Exemples cURL

Voir `EXEMPLES_CURL_INTEGRATIONS_CRUD.md` pour les exemples complets.

---

## ✅ Checklist Finale

- [ ] Commit 1: Support store_ids dans IntegrationService
- [ ] Commit 2: Middlewares de sécurité
- [ ] Commit 3: Routes CRUD Stores
- [ ] Commit 4: Routes CRUD Users
- [ ] Commit 5: Tests et routes.runtime.json
- [ ] Commit 6: Documentation
- [ ] Vérifier que tous les tests passent (`pytest tests/test_integrations_crud.py -v`)
- [ ] Vérifier que lint_docs.py passe (`python backend/scripts/lint_docs.py`)
- [ ] Vérifier que les exemples cURL fonctionnent
- [ ] Vérifier que routes.runtime.json est à jour

---

## 🔐 Sécurité

### Permissions (scopes)

- `stores:read` - Lire les stores
- `stores:write` - Créer des stores
- `users:write` - Créer managers/sellers et mettre à jour users
- `kpi:write` - Synchroniser les KPI

### Multi-tenant

- `store_ids: null` ou `["*"]` = Accès global à tous les stores du tenant
- `store_ids: [id1, id2]` = Accès uniquement aux stores listés
- `store_ids: []` = Aucun accès

### Audit log (TODO)

- `api_key_id`
- `endpoint`
- `tenant_id` (gerant_id)
- `store_id` (si applicable)
- `user_id` (si applicable)

---

## 📚 Documentation

- `PLAN_IMPLEMENTATION_INTEGRATIONS_CRUD.md` - Plan complet
- `DIFF_INTEGRATIONS_ROUTES.py` - Diff complet des routes
- `EXEMPLES_CURL_INTEGRATIONS_CRUD.md` - Exemples cURL
- `RESUME_IMPLEMENTATION_COMPLETE.md` - Ce fichier (résumé)

