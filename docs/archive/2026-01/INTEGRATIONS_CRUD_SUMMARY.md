# 📋 Résumé : Rétablissement des Endpoints CRUD Intégrations

## 🎯 Objectif

Rétablir les endpoints CRUD pour stores/managers/sellers/users via API Key, en réutilisant les services existants de l'API App (JWT) pour éviter la duplication.

## 📊 Diagnostic

### Endpoints perdus

Les endpoints suivants existaient dans `backend/_archived_legacy/server.py` mais n'ont jamais été migrés :

- ❌ `GET /api/integrations/stores` - Lister les magasins
- ❌ `POST /api/integrations/stores` - Créer un magasin
- ❌ `POST /api/integrations/stores/{store_id}/managers` - Créer un manager
- ❌ `POST /api/integrations/stores/{store_id}/sellers` - Créer un vendeur
- ❌ `PUT /api/integrations/users/{user_id}` - Mettre à jour un utilisateur

### Cause

Migration vers Clean Architecture : les endpoints ont été archivés mais jamais recréés. Seul `/api/integrations/kpi/sync` a été migré.

## ✅ Solution

### Architecture

```
/api/integrations/
├── stores (GET, POST)
├── stores/{store_id}/managers (POST)
├── stores/{store_id}/sellers (POST)
└── users/{user_id} (PUT)
```

### Authentification

- **Header** : `X-API-Key: <API_KEY>`
- **Permissions** (scopes) :
  - `read:stores` - Lister les magasins
  - `write:stores` - Créer des magasins
  - `write:users` - Créer managers/sellers et mettre à jour users

### Multi-tenant

- **store_ids** dans la clé API :
  - `None` = accès à tous les magasins du gérant
  - `[]` = aucun magasin
  - `[id1, id2]` = accès uniquement aux stores listés

### Réutilisation des services

- ✅ `StoreService.create_store()` - Créer des magasins
- ✅ `StoreService.get_stores_by_gerant()` - Lister les magasins
- ✅ `StoreService.get_store_by_id()` - Vérifier l'existence d'un store
- ✅ `UserRepository` - Créer managers/sellers (pas de service dédié)

## 📝 Fichiers à modifier

1. **`backend/models/integrations.py`** - Ajouter modèles Pydantic
2. **`backend/api/routes/integrations.py`** - Ajouter routes CRUD
3. **`backend/services/integration_service.py`** - Ajouter support `store_ids`
4. **`routes.runtime.json`** - Ajouter nouvelles routes
5. **`API_INTEGRATION_GUIDE.md`** - Mettre à jour documentation

## 🔧 Code à implémenter

Voir `INTEGRATIONS_CRUD_IMPLEMENTATION.md` pour le code complet.

## 📋 Exemples cURL

### 1. Lister les magasins

```bash
curl -X GET "https://api.retailperformerai.com/api/integrations/stores" \
  -H "X-API-Key: sk_live_votre_cle_api" \
  -H "Content-Type: application/json"
```

**Réponse** :
```json
{
  "stores": [
    {
      "id": "c2dd1ada-d0a2-4a90-be81-644b7cb78bc7",
      "name": "Skyco Lyon Part-Dieu",
      "location": "69003 Lyon",
      "address": "45 Rue de la République",
      "active": true
    }
  ],
  "total": 1
}
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

**Réponse** :
```json
{
  "success": true,
  "store_id": "c2dd1ada-d0a2-4a90-be81-644b7cb78bc7",
  "store": {
    "id": "c2dd1ada-d0a2-4a90-be81-644b7cb78bc7",
    "name": "Skyco Marseille",
    "location": "13001 Marseille",
    "address": "12 Rue de la République, 13001 Marseille",
    "phone": "+33 4 91 00 00 00",
    "external_id": "STORE_MRS_001",
    "gerant_id": "gerant-uuid",
    "active": true,
    "created_at": "2025-01-15T10:30:00Z"
  }
}
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

**Réponse** :
```json
{
  "success": true,
  "manager_id": "72468398-620f-42d1-977c-bd250f4d440a",
  "manager": {
    "id": "72468398-620f-42d1-977c-bd250f4d440a",
    "name": "Sophie Martin",
    "email": "sophie.martin@example.com",
    "phone": "+33 6 12 34 56 78",
    "store_id": "c2dd1ada-d0a2-4a90-be81-644b7cb78bc7",
    "external_id": "MGR_MRS_001",
    "invitation_sent": true
  }
}
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

**Réponse** :
```json
{
  "success": true,
  "seller_id": "2a1c816b-fd21-463a-8a8f-bfe98616aeba",
  "seller": {
    "id": "2a1c816b-fd21-463a-8a8f-bfe98616aeba",
    "name": "Lucas Bernard",
    "email": "lucas.bernard@example.com",
    "phone": "+33 6 98 76 54 32",
    "store_id": "c2dd1ada-d0a2-4a90-be81-644b7cb78bc7",
    "manager_id": "72468398-620f-42d1-977c-bd250f4d440a",
    "external_id": "SELLER_MRS_012",
    "invitation_sent": true
  }
}
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

**Réponse** :
```json
{
  "success": true,
  "user_id": "2a1c816b-fd21-463a-8a8f-bfe98616aeba",
  "user": {
    "id": "2a1c816b-fd21-463a-8a8f-bfe98616aeba",
    "name": "Lucas Bernard-Dupont",
    "email": "lucas.dupont@example.com",
    "role": "seller",
    "status": "active",
    "phone": "+33 6 11 22 33 44",
    "store_id": "c2dd1ada-d0a2-4a90-be81-644b7cb78bc7",
    "external_id": "SELLER_MRS_012_NEW"
  }
}
```

## ⚠️ Codes d'erreur

- `401` - Clé API invalide ou expirée
- `403` - Permission insuffisante ou accès refusé au store
- `404` - Store ou utilisateur non trouvé
- `400` - Données invalides (email déjà utilisé, etc.)

## 📚 Documentation

Mettre à jour `API_INTEGRATION_GUIDE.md` avec :
- Section "Gestion des Magasins via API"
- Section "Gestion des Utilisateurs via API"
- Exemples cURL, Python, JavaScript, n8n

## ✅ Checklist d'implémentation

- [ ] Ajouter modèles Pydantic dans `backend/models/integrations.py`
- [ ] Ajouter middleware `verify_api_key_with_permission` et `verify_store_access`
- [ ] Ajouter routes CRUD dans `backend/api/routes/integrations.py`
- [ ] Mettre à jour `IntegrationService.create_api_key()` pour supporter `store_ids`
- [ ] Ajouter tests basiques dans `backend/tests/test_integrations_crud.py`
- [ ] Mettre à jour `routes.runtime.json`
- [ ] Mettre à jour `API_INTEGRATION_GUIDE.md`
- [ ] Vérifier que les invitations email fonctionnent (optionnel)

