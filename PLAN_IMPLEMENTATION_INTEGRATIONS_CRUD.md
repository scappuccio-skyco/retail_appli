# 🔧 Plan d'Implémentation : API Intégrations CRUD

## 📋 Fichiers Impactés

### Fichiers à modifier

1. **`backend/services/integration_service.py`**
   - Ajouter support `store_ids` dans `create_api_key()`
   - Ajouter méthode `get_tenant_id_from_api_key()` pour extraire gerant_id

2. **`backend/api/routes/integrations.py`**
   - Ajouter middleware `verify_api_key_with_scope(required_scope: str)`
   - Ajouter middleware `verify_store_access(store_id: str)`
   - Ajouter routes CRUD :
     - `GET /api/integrations/stores`
     - `POST /api/integrations/stores`
     - `POST /api/integrations/stores/{store_id}/managers`
     - `POST /api/integrations/stores/{store_id}/sellers`
     - `PUT /api/integrations/users/{user_id}`
   - Supprimer endpoint legacy `/v1/kpi/sync` (pas de clients)

3. **`backend/models/integrations.py`**
   - Modèles déjà présents (APIStoreCreate, APIManagerCreate, APISellerCreate, APIUserUpdate)
   - Vérifier que tout est OK

4. **`routes.runtime.json`**
   - Ajouter les 5 nouvelles routes
   - Marquer `/api/integrations/v1/kpi/sync` comme deprecated

5. **`backend/tests/test_integrations_crud.py`** (nouveau fichier)
   - Tests basiques pour chaque endpoint

6. **`API_INTEGRATION_GUIDE.md`**
   - Ajouter section "Gestion des Magasins via API"
   - Ajouter section "Gestion des Utilisateurs via API"
   - Mettre à jour exemples

7. **`API_EXAMPLES.md`**
   - Ajouter exemples cURL pour les nouveaux endpoints

### Fichiers à vérifier (pas de modification)

- `backend/repositories/integration_repository.py` - OK, supporte déjà store_ids
- `backend/services/store_service.py` - OK, réutilisable
- `backend/repositories/user_repository.py` - OK, réutilisable

---

## 🔍 Diagnostic Rapide

### Pourquoi les routes n'existent pas ?

1. **Migration incomplète** : Lors de la migration vers Clean Architecture, seuls les endpoints KPI sync ont été migrés
2. **Fichier legacy** : Les endpoints CRUD existaient dans `backend/_archived_legacy/server.py` (lignes 14530-14747)
3. **Router mounting** : Le router `integrations.py` existe mais ne contient que la gestion des clés API et KPI sync
4. **Pas de suppression explicite** : Les routes n'ont jamais été supprimées, elles n'ont simplement jamais été recréées

### Solution

Réintroduire les endpoints dans `backend/api/routes/integrations.py` en réutilisant les services existants.

---

## 📝 Diff de Code

### 1. `backend/services/integration_service.py`

```python
# Modifier create_api_key pour supporter store_ids
async def create_api_key(
    self,
    user_id: str,
    name: str,
    permissions: List[str],
    expires_days: int = None,
    store_ids: Optional[List[str]] = None  # AJOUTER
) -> Dict:
    # ... code existant ...
    
    # Build key document
    key_doc = {
        "id": str(uuid4()),
        "key_hash": hashed_key,
        "key_prefix": api_key[:12],
        "name": name,
        "user_id": user_id,
        "permissions": permissions,
        "store_ids": store_ids,  # AJOUTER
        "expires_at": expires_at,
        "active": True,
        "created_at": datetime.now(timezone.utc)
    }
    
    # ... reste du code ...

# AJOUTER méthode pour obtenir tenant_id (gerant_id)
async def get_tenant_id_from_api_key(self, api_key_data: Dict) -> Optional[str]:
    """
    Get tenant_id (gerant_id) from API key data
    
    Args:
        api_key_data: API key document from verify_api_key
    
    Returns:
        gerant_id (tenant_id) or None
    """
    from core.database import get_database
    from repositories.user_repository import UserRepository
    
    user_id = api_key_data.get('user_id')
    if not user_id:
        return None
    
    db = get_database()
    user_repo = UserRepository(db)
    user = await user_repo.find_by_id(user_id)
    
    if not user:
        return None
    
    # Si l'utilisateur est un gérant, son ID est le tenant_id
    if user.get('role') in ['gerant', 'gérant']:
        return user_id
    
    # Sinon, utiliser gerant_id du user
    return user.get('gerant_id')
```

### 2. `backend/api/routes/integrations.py`

Voir le fichier complet dans la section suivante.

---

## 🧪 Tests

### `backend/tests/test_integrations_crud.py`

```python
import pytest
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, patch
from main import app

client = TestClient(app)

# Mock API key pour les tests
VALID_API_KEY = "sk_live_test_key_12345"
INVALID_API_KEY = "invalid_key"

# Mock API key data
MOCK_API_KEY_DATA = {
    "id": "key-123",
    "user_id": "gerant-123",
    "permissions": ["stores:read", "stores:write", "users:write", "kpi:write"],
    "store_ids": None,  # Accès global
    "active": True
}

def test_list_stores_no_api_key():
    """Test 401 sans clé API"""
    response = client.get("/api/integrations/stores")
    assert response.status_code == 401

def test_list_stores_invalid_api_key():
    """Test 401 avec clé invalide"""
    response = client.get(
        "/api/integrations/stores",
        headers={"X-API-Key": INVALID_API_KEY}
    )
    assert response.status_code == 401

def test_list_stores_missing_scope():
    """Test 403 avec scope manquant"""
    with patch('api.routes.integrations.verify_api_key') as mock_verify:
        mock_verify.return_value = {
            **MOCK_API_KEY_DATA,
            "permissions": ["kpi:write"]  # Pas stores:read
        }
        response = client.get(
            "/api/integrations/stores",
            headers={"X-API-Key": VALID_API_KEY}
        )
        assert response.status_code == 403

def test_create_store_success():
    """Test 200 create store"""
    # Mock à implémenter selon structure réelle
    pass

def test_create_manager_store_not_authorized():
    """Test 403 store non autorisé"""
    with patch('api.routes.integrations.verify_api_key') as mock_verify:
        mock_verify.return_value = {
            **MOCK_API_KEY_DATA,
            "store_ids": ["store-other"]  # Pas le bon store
        }
        response = client.post(
            "/api/integrations/stores/store-123/managers",
            headers={"X-API-Key": VALID_API_KEY},
            json={"name": "Test", "email": "test@example.com"}
        )
        assert response.status_code == 403

def test_update_user_success():
    """Test 200 update user dans scope"""
    # Mock à implémenter
    pass
```

---

## 📦 Plan de Commits Atomiques

### Commit 1: Support store_ids dans IntegrationService
```
feat(integrations): ajouter support store_ids dans IntegrationService

- Ajouter paramètre store_ids à create_api_key()
- Ajouter méthode get_tenant_id_from_api_key()
- Mettre à jour key_doc pour inclure store_ids
```

**Fichiers** :
- `backend/services/integration_service.py`

### Commit 2: Middlewares de sécurité pour API Key
```
feat(integrations): ajouter middlewares verify_api_key_with_scope et verify_store_access

- verify_api_key_with_scope: vérifie permission requise
- verify_store_access: vérifie accès multi-tenant au store
- Support store_ids: None = global, [] = aucun, [id1, id2] = spécifiques
```

**Fichiers** :
- `backend/api/routes/integrations.py` (middlewares uniquement)

### Commit 3: Routes CRUD Stores
```
feat(integrations): ajouter routes CRUD pour stores (GET, POST)

- GET /api/integrations/stores: lister stores autorisés
- POST /api/integrations/stores: créer un store
- Réutilisation de StoreService existant
- Contrôle multi-tenant via store_ids
```

**Fichiers** :
- `backend/api/routes/integrations.py` (routes stores)

### Commit 4: Routes CRUD Users (managers, sellers, update)
```
feat(integrations): ajouter routes CRUD pour users (managers, sellers, update)

- POST /api/integrations/stores/{store_id}/managers: créer manager
- POST /api/integrations/stores/{store_id}/sellers: créer seller
- PUT /api/integrations/users/{user_id}: mettre à jour user
- Réutilisation de UserRepository existant
- Forcer store_id du path (ignorer body)
```

**Fichiers** :
- `backend/api/routes/integrations.py` (routes users)
- Supprimer endpoint legacy `/v1/kpi/sync`

### Commit 5: Tests et mise à jour runtime
```
test(integrations): ajouter tests basiques pour endpoints CRUD

- Tests 401 sans clé
- Tests 403 scope manquant
- Tests 403 store non autorisé
- Tests 200 create/update success
- Mettre à jour routes.runtime.json
```

**Fichiers** :
- `backend/tests/test_integrations_crud.py` (nouveau)
- `routes.runtime.json`

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

## 🧪 Commandes de Test/Lint

### Tests
```bash
# Lancer les tests
cd backend
pytest tests/test_integrations_crud.py -v

# Lancer tous les tests
pytest tests/ -v
```

### Lint
```bash
# Vérifier la documentation
python backend/scripts/lint_docs.py

# Vérifier les imports
python -m py_compile backend/api/routes/integrations.py
python -m py_compile backend/services/integration_service.py
```

### Vérification runtime
```bash
# Vérifier que les routes sont bien montées
python -c "from backend.main import app; print([r.path for r in app.routes if 'integrations' in r.path])"
```

---

## 📋 Checklist d'Implémentation

- [ ] Commit 1: Support store_ids dans IntegrationService
- [ ] Commit 2: Middlewares de sécurité
- [ ] Commit 3: Routes CRUD Stores
- [ ] Commit 4: Routes CRUD Users
- [ ] Commit 5: Tests et routes.runtime.json
- [ ] Commit 6: Documentation
- [ ] Vérifier que tous les tests passent
- [ ] Vérifier que lint_docs.py passe
- [ ] Vérifier que les exemples cURL fonctionnent

