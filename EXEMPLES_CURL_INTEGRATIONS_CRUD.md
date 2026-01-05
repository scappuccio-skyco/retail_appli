# 📋 Exemples cURL - API Intégrations CRUD

## Base URL

```
https://api.retailperformerai.com
```

## Authentification

Toutes les requêtes nécessitent le header :
```
X-API-Key: sk_live_votre_cle_api_ici
```

---

## 1. Lister les magasins

```bash
curl -X GET "https://api.retailperformerai.com/api/integrations/stores" \
  -H "X-API-Key: sk_live_votre_cle_api_ici" \
  -H "Content-Type: application/json"
```

**Réponse 200 OK** :
```json
{
  "stores": [
    {
      "id": "c2dd1ada-d0a2-4a90-be81-644b7cb78bc7",
      "name": "Skyco Lyon Part-Dieu",
      "location": "69003 Lyon",
      "address": "45 Rue de la République",
      "phone": "+33 4 78 00 00 00",
      "active": true,
      "gerant_id": "gerant-uuid-123",
      "created_at": "2025-01-15T10:30:00Z"
    }
  ],
  "total": 1
}
```

**Erreurs** :
- `401` : Clé API invalide ou expirée
- `403` : Permission `stores:read` manquante

---

## 2. Créer un magasin

```bash
curl -X POST "https://api.retailperformerai.com/api/integrations/stores" \
  -H "X-API-Key: sk_live_votre_cle_api_ici" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Skyco Marseille",
    "location": "13001 Marseille",
    "address": "12 Rue de la République, 13001 Marseille",
    "phone": "+33 4 91 00 00 00",
    "opening_hours": "Lun-Sam: 9h-19h",
    "external_id": "STORE_MRS_001"
  }'
```

**Réponse 200 OK** :
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
    "opening_hours": "Lun-Sam: 9h-19h",
    "external_id": "STORE_MRS_001",
    "gerant_id": "gerant-uuid-123",
    "active": true,
    "created_at": "2025-01-15T10:30:00Z"
  }
}
```

**Erreurs** :
- `401` : Clé API invalide
- `403` : Permission `stores:write` manquante

---

## 3. Créer un manager

```bash
curl -X POST "https://api.retailperformerai.com/api/integrations/stores/c2dd1ada-d0a2-4a90-be81-644b7cb78bc7/managers" \
  -H "X-API-Key: sk_live_votre_cle_api_ici" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Sophie Martin",
    "email": "sophie.martin@example.com",
    "phone": "+33 6 12 34 56 78",
    "external_id": "MGR_MRS_001",
    "send_invitation": true
  }'
```

**Réponse 200 OK** :
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

**Erreurs** :
- `401` : Clé API invalide
- `403` : Permission `users:write` manquante OU accès refusé au store
- `404` : Store non trouvé
- `400` : Email déjà utilisé

---

## 4. Créer un vendeur

```bash
curl -X POST "https://api.retailperformerai.com/api/integrations/stores/c2dd1ada-d0a2-4a90-be81-644b7cb78bc7/sellers" \
  -H "X-API-Key: sk_live_votre_cle_api_ici" \
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

**Réponse 200 OK** :
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

**Erreurs** :
- `401` : Clé API invalide
- `403` : Permission `users:write` manquante OU accès refusé au store
- `404` : Store ou manager non trouvé
- `400` : Email déjà utilisé OU aucun manager dans le store

---

## 5. Mettre à jour un utilisateur

```bash
curl -X PUT "https://api.retailperformerai.com/api/integrations/users/2a1c816b-fd21-463a-8a8f-bfe98616aeba" \
  -H "X-API-Key: sk_live_votre_cle_api_ici" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Lucas Bernard-Dupont",
    "email": "lucas.dupont@example.com",
    "phone": "+33 6 11 22 33 44",
    "status": "active",
    "external_id": "SELLER_MRS_012_NEW"
  }'
```

**Réponse 200 OK** :
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

**Erreurs** :
- `401` : Clé API invalide
- `403` : Permission `users:write` manquante OU utilisateur n'appartient pas au tenant/store autorisé
- `404` : Utilisateur non trouvé
- `400` : Email déjà utilisé OU aucun champ à mettre à jour

---

## 6. Synchroniser les KPI (déjà existant)

```bash
curl -X POST "https://api.retailperformerai.com/api/integrations/kpi/sync" \
  -H "X-API-Key: sk_live_votre_cle_api_ici" \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2025-01-15",
    "kpi_entries": [
      {
        "seller_id": "2a1c816b-fd21-463a-8a8f-bfe98616aeba",
        "ca_journalier": 1500.00,
        "nb_ventes": 12,
        "nb_articles": 24,
        "prospects": 35
      }
    ]
  }'
```

**Note** : Cet endpoint existe déjà, pas de changement.

---

## Codes d'erreur

| Code | Description |
|------|-------------|
| `401` | Clé API invalide, expirée ou absente |
| `403` | Permission insuffisante ou accès refusé au store |
| `404` | Ressource non trouvée (store, user, manager) |
| `400` | Données invalides (email déjà utilisé, champs manquants) |
| `422` | Erreur de validation (format incorrect) |

---

## Permissions requises

| Endpoint | Permission requise |
|----------|-------------------|
| `GET /api/integrations/stores` | `stores:read` |
| `POST /api/integrations/stores` | `stores:write` |
| `POST /api/integrations/stores/{store_id}/managers` | `users:write` |
| `POST /api/integrations/stores/{store_id}/sellers` | `users:write` |
| `PUT /api/integrations/users/{user_id}` | `users:write` |
| `POST /api/integrations/kpi/sync` | `kpi:write` |

---

## Multi-tenant

### Accès global (tous les stores du tenant)
```json
{
  "store_ids": null
}
```
ou
```json
{
  "store_ids": ["*"]
}
```

### Accès restreint (stores spécifiques)
```json
{
  "store_ids": ["store-id-1", "store-id-2"]
}
```

### Aucun accès
```json
{
  "store_ids": []
}
```

