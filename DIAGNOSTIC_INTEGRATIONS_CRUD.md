# 🔍 Diagnostic : Endpoints CRUD Intégrations Perdus

## 1. Diagnostic : Où les endpoints ont été perdus

### 📍 Localisation dans le code legacy

Les endpoints CRUD pour stores/managers/sellers/users existaient dans :
- **Fichier** : `backend/_archived_legacy/server.py`
- **Lignes** : 14530-14747
- **Endpoints** :
  - `POST /api/v1/integrations/stores` - Créer un magasin
  - `POST /api/v1/integrations/stores/{store_id}/managers` - Créer un manager
  - `POST /api/v1/integrations/stores/{store_id}/sellers` - Créer un vendeur
  - `PUT /api/v1/integrations/users/{user_id}` - Mettre à jour un utilisateur

### ❌ Pourquoi ils ont été perdus

1. **Migration vers Clean Architecture** : Lors de la refactorisation vers une architecture propre, les endpoints ont été archivés mais jamais recréés dans la nouvelle structure.

2. **Focus sur KPI Sync** : Seul l'endpoint `/api/integrations/kpi/sync` a été migré car c'était le plus utilisé.

3. **Fichier actuel** : `backend/api/routes/integrations.py` ne contient que :
   - Gestion des clés API (GET/POST `/api/integrations/api-keys`)
   - Synchronisation KPI (POST `/api/integrations/kpi/sync`)

### ✅ Services existants à réutiliser

Les services suivants existent et peuvent être réutilisés :

1. **StoreService** (`backend/services/store_service.py`)
   - `create_store()` - Créer un magasin
   - `get_stores_by_gerant()` - Lister les magasins

2. **UserRepository** (`backend/repositories/user_repository.py`)
   - Pour créer managers et sellers (pas de service dédié, création directe)

3. **IntegrationService** (`backend/services/integration_service.py`)
   - `verify_api_key()` - Vérification de la clé API
   - Gestion des permissions

### 🔐 Gestion Multi-Tenant dans le legacy

Dans le code legacy, la vérification multi-tenant était gérée ainsi :

```python
# Vérification store_ids dans api_key_data
store_ids = api_key_data.get('store_ids')
gerant_id = api_key_data.get('gerant_id')

# Si store_ids est None = accès à tous les magasins du gérant
# Si store_ids est une liste = accès uniquement aux stores listés
if store_ids is not None:
    if store_id not in store_ids:
        raise HTTPException(403, "API key does not have access to this store")
else:
    # Vérifier que le gérant possède le store
    if store.get('gerant_id') != gerant_id:
        raise HTTPException(403, "API key does not have access to this store")
```

### 📋 Permissions requises (legacy)

- `write:stores` - Pour créer des magasins
- `write:users` - Pour créer managers/sellers et mettre à jour users
- `read:stores` - Pour lister les magasins (optionnel)

---

## 2. Solution : Rétablir les endpoints

### Architecture proposée

```
/api/integrations/
├── stores (GET, POST) - Gestion des magasins
├── stores/{store_id}/managers (POST) - Créer manager
├── stores/{store_id}/sellers (POST) - Créer seller
└── users/{user_id} (PUT) - Mettre à jour user
```

### Middleware d'authentification

Réutiliser `verify_api_key` existant mais ajouter :
1. Vérification des permissions (scopes)
2. Vérification multi-tenant (store_ids)
3. Extraction du gerant_id depuis la clé API

### Réutilisation des services

- **StoreService.create_store()** - Pour créer des magasins
- **UserRepository** - Pour créer managers/sellers (pas de service dédié)
- **StoreService.get_store_by_id()** - Pour vérifier l'existence d'un store

---

## 3. Diff de code

Voir le fichier `INTEGRATIONS_CRUD_IMPLEMENTATION.md` pour le code complet.

---

## 4. Exemples cURL

Voir la section "Exemples cURL" ci-dessous.

