# 📘 Notice d'Utilisation - API Intégrations Retail Performer AI

**Version** : 1.0  
**Date** : 2025-01-XX  
**Base URL** : `https://api.retailperformerai.com`

---

## 📋 Table des matières

1. [À quoi sert l'API Intégrations](#à-quoi-sert-lapi-intégrations)
2. [Pré-requis](#pré-requis)
3. [Authentification](#authentification)
4. [Permissions & Store IDs](#permissions--store-ids)
5. [Base URL](#base-url)
6. [Endpoints](#endpoints)
7. [FAQ / Erreurs fréquentes](#faq--erreurs-fréquentes)
8. [Bonnes pratiques](#bonnes-pratiques)

---

## 🎯 À quoi sert l'API Intégrations

L'API Intégrations permet aux logiciels externes (caisse, ERP, systèmes de paie) de :

- **Synchroniser les KPI journaliers** (CA, ventes, articles, prospects) depuis votre système de caisse
- **Gérer les magasins** : créer et lister les magasins
- **Gérer les utilisateurs** : créer des managers et vendeurs, mettre à jour leurs informations
- **Automatiser l'intégration** avec authentification simple par API Key (sans JWT)

> ⚠️ **Important** : Cette API est distincte de l'API App (JWT Bearer) utilisée par le frontend. Elle utilise l'authentification par **X-API-Key**.

---

## ✅ Pré-requis

### 1. Rôle Gérant

Seuls les **gérants** peuvent créer et gérer les clés API depuis l'interface web.

### 2. Création d'une clé API

1. Connectez-vous à l'interface gérant
2. Accédez à la section "API Intégrations" ou "Clés API"
3. Cliquez sur **"Créer une nouvelle clé API"**
4. Remplissez le formulaire :
   - **Nom** : Identifiant de la clé (ex: "Caisse Magasin Paris")
   - **Permissions** : Sélectionnez les permissions nécessaires (voir [Permissions](#permissions--store-ids))
   - **Store IDs** : Optionnel - Limitez l'accès à certains magasins (voir [Store IDs](#store-ids))
   - **Expiration** : Optionnel - Nombre de jours avant expiration
5. Cliquez sur **"Créer la clé"**
6. **⚠️ IMPORTANT** : Copiez immédiatement la clé générée - elle ne sera plus affichée

### 3. Récupération de la clé

La clé API est affichée **une seule fois** lors de la création. Si vous l'avez perdue, vous devez :
- Désactiver l'ancienne clé
- Créer une nouvelle clé

---

## 🔐 Authentification

### Header principal (recommandé)

```http
X-API-Key: sk_live_votre_cle_api_ici
```

### Alias optionnel

```http
Authorization: Bearer sk_live_votre_cle_api_ici
```

> ⚠️ **Note** : L'alias `Authorization: Bearer` utilise une **API Key**, pas un JWT. Ne confondez pas avec l'API App qui utilise des tokens JWT.

### Exemple de requête

```bash
curl -X GET "https://api.retailperformerai.com/api/integrations/stores" \
  -H "X-API-Key: sk_live_votre_cle_api_ici"
```

---

## 🔑 Permissions & Store IDs

### Permissions (Scopes)

Chaque clé API possède des **permissions** (scopes) qui définissent ce qu'elle peut faire :

| Permission | Description |
|------------|-------------|
| `stores:read` | Lire la liste des magasins |
| `stores:write` | Créer des magasins |
| `users:write` | Créer et modifier des utilisateurs (managers, vendeurs) |
| `kpi:write` | Synchroniser les KPI journaliers |

> ⚠️ **Note** : Les permissions utilisent le format `resource:action` (ex: `stores:read`, `users:write`).

### Store IDs

Les clés API peuvent être **restreintes** à certains magasins pour renforcer la sécurité :

| Configuration | Comportement |
|--------------|-------------|
| `store_ids: null` ou `store_ids: ["*"]` | Accès à **tous** les magasins du tenant (gérant) |
| `store_ids: ["id1", "id2"]` | Accès **limité** aux magasins spécifiés |

#### Règles de sécurité

- Si `store_ids` est **restreint** (liste spécifique, pas `null` ni `["*"]`) :
  - Un utilisateur avec `store_id: null` ne peut **pas** être créé/modifié (sauf si c'est le gérant lui-même)
  - Seuls les magasins dans la liste sont accessibles

#### Exemples

**Clé avec accès global** :
```json
{
  "name": "Clé ERP principale",
  "permissions": ["stores:read", "users:write", "kpi:write"],
  "store_ids": null
}
```

**Clé avec accès limité** :
```json
{
  "name": "Clé Caisse Magasin Paris",
  "permissions": ["kpi:write"],
  "store_ids": ["store-paris-123", "store-paris-456"]
}
```

---

## 🌐 Base URL

Tous les endpoints sont accessibles via :

```
https://api.retailperformerai.com
```

Les endpoints d'intégration sont préfixés par `/api/integrations`.

---

## 📡 Endpoints

### 1. GET /api/integrations/stores

Liste tous les magasins accessibles par la clé API.

**Permission requise** : `stores:read`

**Headers** :
```http
X-API-Key: sk_live_votre_cle_api_ici
```

**Réponse 200** :
```json
{
  "stores": [
    {
      "id": "store-123",
      "name": "Magasin Paris Centre",
      "location": "75001 Paris",
      "address": "123 Rue de Rivoli",
      "phone": "0123456789",
      "opening_hours": "9h-19h du lundi au samedi",
      "gerant_id": "gerant-xyz",
      "active": true,
      "created_at": "2024-01-15T10:00:00Z"
    }
  ]
}
```

**Réponses d'erreur** :
- `401` : Clé API invalide ou manquante
- `403` : Permission `stores:read` manquante

**Exemple cURL** :
```bash
curl -X GET "https://api.retailperformerai.com/api/integrations/stores" \
  -H "X-API-Key: sk_live_votre_cle_api_ici"
```

**Exemple Python** :
```python
import requests

API_KEY = "sk_live_votre_cle_api_ici"
BASE_URL = "https://api.retailperformerai.com"

response = requests.get(
    f"{BASE_URL}/api/integrations/stores",
    headers={"X-API-Key": API_KEY}
)

if response.status_code == 200:
    stores = response.json()["stores"]
    print(f"Nombre de magasins : {len(stores)}")
else:
    print(f"Erreur {response.status_code}: {response.json()}")
```

---

### 2. POST /api/integrations/stores

Crée un nouveau magasin.

**Permission requise** : `stores:write`

**Headers** :
```http
X-API-Key: sk_live_votre_cle_api_ici
Content-Type: application/json
```

**Body JSON** :
```json
{
  "name": "Magasin Lyon Centre",
  "location": "69001 Lyon",
  "address": "456 Rue de la République",
  "phone": "0123456789",
  "opening_hours": "9h-19h du lundi au samedi",
  "external_id": "LYON-001"
}
```

**Champs** :
- `name` (requis) : Nom du magasin
- `location` (requis) : Localisation (ville, code postal)
- `address` (optionnel) : Adresse complète
- `phone` (optionnel) : Numéro de téléphone
- `opening_hours` (optionnel) : Horaires d'ouverture
- `external_id` (optionnel) : ID dans le système externe (ERP, caisse)

**Réponse 200** :
```json
{
  "success": true,
  "store": {
    "id": "store-456",
    "name": "Magasin Lyon Centre",
    "location": "69001 Lyon",
    "address": "456 Rue de la République",
    "phone": "0123456789",
    "opening_hours": "9h-19h du lundi au samedi",
    "gerant_id": "gerant-xyz",
    "active": true,
    "created_at": "2024-01-15T10:00:00Z"
  }
}
```

**Réponses d'erreur** :
- `400` : Données invalides (nom manquant, magasin déjà existant)
- `401` : Clé API invalide
- `403` : Permission `stores:write` manquante

**Exemple cURL** :
```bash
curl -X POST "https://api.retailperformerai.com/api/integrations/stores" \
  -H "X-API-Key: sk_live_votre_cle_api_ici" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Magasin Lyon Centre",
    "location": "69001 Lyon",
    "address": "456 Rue de la République"
  }'
```

**Exemple Python** :
```python
import requests

API_KEY = "sk_live_votre_cle_api_ici"
BASE_URL = "https://api.retailperformerai.com"

store_data = {
    "name": "Magasin Lyon Centre",
    "location": "69001 Lyon",
    "address": "456 Rue de la République",
    "phone": "0123456789"
}

response = requests.post(
    f"{BASE_URL}/api/integrations/stores",
    headers={"X-API-Key": API_KEY},
    json=store_data
)

if response.status_code == 200:
    store = response.json()["store"]
    print(f"Magasin créé : {store['id']}")
else:
    print(f"Erreur {response.status_code}: {response.json()}")
```

---

### 3. POST /api/integrations/stores/{store_id}/managers

Crée un nouveau manager pour un magasin.

**Permission requise** : `users:write`

**⚠️ Important** : Le `store_id` est **forcé depuis le path**. Tout `store_id` dans le body est **ignoré**.

**Headers** :
```http
X-API-Key: sk_live_votre_cle_api_ici
Content-Type: application/json
```

**Body JSON** :
```json
{
  "name": "Jean Dupont",
  "email": "jean.dupont@example.com",
  "phone": "0123456789",
  "external_id": "MANAGER-001",
  "send_invitation": true
}
```

**Champs** :
- `name` (requis) : Nom du manager
- `email` (requis) : Email du manager (doit être unique)
- `phone` (optionnel) : Numéro de téléphone
- `external_id` (optionnel) : ID dans le système externe
- `send_invitation` (optionnel, défaut: `true`) : Envoyer un email d'invitation

**Réponse 200** :
```json
{
  "success": true,
  "manager_id": "manager-789",
  "manager": {
    "id": "manager-789",
    "name": "Jean Dupont",
    "email": "jean.dupont@example.com",
    "store_id": "store-123",
    "external_id": "MANAGER-001"
  }
}
```

**Réponses d'erreur** :
- `400` : Email déjà enregistré, données invalides
- `401` : Clé API invalide
- `403` : Permission `users:write` manquante, accès au magasin refusé
- `404` : Magasin non trouvé

**Exemple cURL** :
```bash
curl -X POST "https://api.retailperformerai.com/api/integrations/stores/store-123/managers" \
  -H "X-API-Key: sk_live_votre_cle_api_ici" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jean Dupont",
    "email": "jean.dupont@example.com",
    "phone": "0123456789"
  }'
```

**Exemple Python** :
```python
import requests

API_KEY = "sk_live_votre_cle_api_ici"
BASE_URL = "https://api.retailperformerai.com"
STORE_ID = "store-123"

manager_data = {
    "name": "Jean Dupont",
    "email": "jean.dupont@example.com",
    "phone": "0123456789"
}

response = requests.post(
    f"{BASE_URL}/api/integrations/stores/{STORE_ID}/managers",
    headers={"X-API-Key": API_KEY},
    json=manager_data
)

if response.status_code == 200:
    manager = response.json()["manager"]
    print(f"Manager créé : {manager['id']}")
else:
    print(f"Erreur {response.status_code}: {response.json()}")
```

---

### 4. POST /api/integrations/stores/{store_id}/sellers

Crée un nouveau vendeur pour un magasin.

**Permission requise** : `users:write`

**⚠️ Important** : Le `store_id` est **forcé depuis le path**. Tout `store_id` dans le body est **ignoré**.

**Headers** :
```http
X-API-Key: sk_live_votre_cle_api_ici
Content-Type: application/json
```

**Body JSON** :
```json
{
  "name": "Marie Martin",
  "email": "marie.martin@example.com",
  "manager_id": "manager-789",
  "phone": "0123456789",
  "external_id": "SELLER-001",
  "send_invitation": true
}
```

**Champs** :
- `name` (requis) : Nom du vendeur
- `email` (requis) : Email du vendeur (doit être unique)
- `manager_id` (optionnel) : ID du manager. Si non fourni, un manager actif du magasin est assigné automatiquement
- `phone` (optionnel) : Numéro de téléphone
- `external_id` (optionnel) : ID dans le système externe
- `send_invitation` (optionnel, défaut: `true`) : Envoyer un email d'invitation

**Réponse 200** :
```json
{
  "success": true,
  "seller_id": "seller-456",
  "seller": {
    "id": "seller-456",
    "name": "Marie Martin",
    "email": "marie.martin@example.com",
    "store_id": "store-123",
    "manager_id": "manager-789",
    "external_id": "SELLER-001"
  }
}
```

**Réponses d'erreur** :
- `400` : Email déjà enregistré, données invalides
- `401` : Clé API invalide
- `403` : Permission `users:write` manquante, accès au magasin refusé
- `404` : Magasin non trouvé, manager non trouvé dans ce magasin

**Exemple cURL** :
```bash
curl -X POST "https://api.retailperformerai.com/api/integrations/stores/store-123/sellers" \
  -H "X-API-Key: sk_live_votre_cle_api_ici" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Marie Martin",
    "email": "marie.martin@example.com",
    "manager_id": "manager-789"
  }'
```

**Exemple Python** :
```python
import requests

API_KEY = "sk_live_votre_cle_api_ici"
BASE_URL = "https://api.retailperformerai.com"
STORE_ID = "store-123"

seller_data = {
    "name": "Marie Martin",
    "email": "marie.martin@example.com",
    "manager_id": "manager-789"
}

response = requests.post(
    f"{BASE_URL}/api/integrations/stores/{STORE_ID}/sellers",
    headers={"X-API-Key": API_KEY},
    json=seller_data
)

if response.status_code == 200:
    seller = response.json()["seller"]
    print(f"Vendeur créé : {seller['id']}")
else:
    print(f"Erreur {response.status_code}: {response.json()}")
```

---

### 5. PUT /api/integrations/users/{user_id}

Met à jour un utilisateur (manager ou vendeur).

**Permission requise** : `users:write`

**⚠️ Important** : Seuls les champs **whitelist** peuvent être modifiés. L'email est **interdit**.

**Headers** :
```http
X-API-Key: sk_live_votre_cle_api_ici
Content-Type: application/json
```

**Body JSON** (tous les champs sont optionnels) :
```json
{
  "name": "Jean Dupont Modifié",
  "phone": "0987654321",
  "status": "active",
  "external_id": "MANAGER-001-UPDATED"
}
```

**Champs whitelist** (seuls ces champs peuvent être modifiés) :
- `name` : Nom de l'utilisateur
- `phone` : Numéro de téléphone
- `status` : Statut (`"active"` ou `"suspended"`)
- `external_id` : ID dans le système externe

**Champs interdits** :
- ❌ `email` : Ne peut pas être modifié via l'API
- ❌ `tenant_id` / `gerant_id` : Ne peut pas être modifié
- ❌ `store_id` : Ne peut pas être modifié
- ❌ `role` : Ne peut pas être modifié

**Réponse 200** :
```json
{
  "success": true,
  "user_id": "manager-789",
  "user": {
    "id": "manager-789",
    "name": "Jean Dupont Modifié",
    "role": "manager",
    "status": "active",
    "phone": "0987654321",
    "store_id": "store-123",
    "external_id": "MANAGER-001-UPDATED"
  }
}
```

**Réponses d'erreur** :
- `400` : Aucun champ whitelist dans le payload, statut invalide
- `401` : Clé API invalide
- `403` : Permission `users:write` manquante, utilisateur n'appartient pas au tenant, accès au store refusé
- `404` : Utilisateur non trouvé

**Exemple cURL** :
```bash
curl -X PUT "https://api.retailperformerai.com/api/integrations/users/manager-789" \
  -H "X-API-Key: sk_live_votre_cle_api_ici" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jean Dupont Modifié",
    "phone": "0987654321",
    "status": "active"
  }'
```

**Exemple Python** :
```python
import requests

API_KEY = "sk_live_votre_cle_api_ici"
BASE_URL = "https://api.retailperformerai.com"
USER_ID = "manager-789"

update_data = {
    "name": "Jean Dupont Modifié",
    "phone": "0987654321",
    "status": "active"
}

response = requests.put(
    f"{BASE_URL}/api/integrations/users/{USER_ID}",
    headers={"X-API-Key": API_KEY},
    json=update_data
)

if response.status_code == 200:
    user = response.json()["user"]
    print(f"Utilisateur mis à jour : {user['name']}")
else:
    print(f"Erreur {response.status_code}: {response.json()}")
```

---

### 6. DELETE /api/integrations/stores/{store_id}

Supprime (désactive) un magasin.

**Permission requise** : `stores:write`

**⚠️ Important** : Cette opération est une **suppression douce** (soft delete) :
- Le magasin est marqué comme `active=False`
- Tous les membres du personnel du magasin sont suspendus automatiquement
- Les données historiques sont conservées

**Headers** :
```http
X-API-Key: sk_live_votre_cle_api_ici
```

**Réponse 200** :
```json
{
  "success": true,
  "message": "Magasin supprimé avec succès"
}
```

**Réponses d'erreur** :
- `401` : Clé API invalide
- `403` : Permission `stores:write` manquante, accès au magasin refusé
- `404` : Magasin non trouvé

**Exemple cURL** :
```bash
curl -X DELETE "https://api.retailperformerai.com/api/integrations/stores/store-123" \
  -H "X-API-Key: sk_live_votre_cle_api_ici"
```

**Exemple Python** :
```python
import requests

API_KEY = "sk_live_votre_cle_api_ici"
BASE_URL = "https://api.retailperformerai.com"
STORE_ID = "store-123"

response = requests.delete(
    f"{BASE_URL}/api/integrations/stores/{STORE_ID}",
    headers={"X-API-Key": API_KEY}
)

if response.status_code == 200:
    print("Magasin supprimé avec succès")
else:
    print(f"Erreur {response.status_code}: {response.json()}")
```

---

### 7. DELETE /api/integrations/users/{user_id}

Supprime (soft delete) un utilisateur (manager ou vendeur).

**Permission requise** : `users:write`

**⚠️ Important** :
- Cette opération est une **suppression douce** : le statut est défini à `"deleted"`
- Les données historiques sont conservées
- **Impossible de supprimer un gérant** via l'API
- L'utilisateur doit appartenir au tenant de la clé API
- Si la clé est restreinte par `store_ids`, l'utilisateur doit appartenir à un magasin autorisé

**Headers** :
```http
X-API-Key: sk_live_votre_cle_api_ici
```

**Réponse 200** :
```json
{
  "success": true,
  "message": "Manager supprimé avec succès"
}
```

ou

```json
{
  "success": true,
  "message": "Seller supprimé avec succès"
}
```

**Réponses d'erreur** :
- `400` : Utilisateur déjà supprimé
- `401` : Clé API invalide
- `403` : Permission `users:write` manquante, utilisateur n'appartient pas au tenant, accès au store refusé, tentative de supprimer un gérant
- `404` : Utilisateur non trouvé

**Exemple cURL** :
```bash
curl -X DELETE "https://api.retailperformerai.com/api/integrations/users/manager-789" \
  -H "X-API-Key: sk_live_votre_cle_api_ici"
```

**Exemple Python** :
```python
import requests

API_KEY = "sk_live_votre_cle_api_ici"
BASE_URL = "https://api.retailperformerai.com"
USER_ID = "manager-789"

response = requests.delete(
    f"{BASE_URL}/api/integrations/users/{USER_ID}",
    headers={"X-API-Key": API_KEY}
)

if response.status_code == 200:
    print(response.json()["message"])
else:
    print(f"Erreur {response.status_code}: {response.json()}")
```

---

### 8. POST /api/integrations/kpi/sync

Synchronise les KPI journaliers depuis un système externe (caisse, ERP).

**Permission requise** : `kpi:write`

**Headers** :
```http
X-API-Key: sk_live_votre_cle_api_ici
Content-Type: application/json
```

**Body JSON** :
```json
{
  "store_id": "store-123",
  "date": "2024-01-15",
  "kpi_entries": [
    {
      "seller_id": "seller-456",
      "ca_journalier": 1250.50,
      "nb_ventes": 12,
      "nb_articles": 28,
      "prospects": 35
    },
    {
      "seller_id": "seller-789",
      "ca_journalier": 980.25,
      "nb_ventes": 8,
      "nb_articles": 15,
      "prospects": 20
    }
  ],
  "source": "external_api"
}
```

**Champs** :
- `store_id` (requis) : ID du magasin
- `date` (requis) : Date au format `YYYY-MM-DD`
- `kpi_entries` (requis) : Tableau d'entrées KPI (maximum 100 entrées par requête)
  - `seller_id` (requis) : ID du vendeur
  - `ca_journalier` (requis) : Chiffre d'affaires journalier en €
  - `nb_ventes` (requis) : Nombre de ventes
  - `nb_articles` (requis) : Nombre d'articles vendus
  - `prospects` (optionnel, défaut: 0) : Nombre de prospects/clients
  - `timestamp` (optionnel) : Horodatage de l'entrée
- `source` (optionnel, défaut: `"external_api"`) : Identifiant de la source

**Limites** :
- Maximum **100 entrées KPI** par requête
- Les entrées existantes pour la même date et le même vendeur sont **mises à jour**
- Les nouvelles entrées sont **créées**

**Réponse 200** :
```json
{
  "status": "success",
  "entries_created": 2,
  "entries_updated": 0,
  "total": 2
}
```

**Réponses d'erreur** :
- `400` : Plus de 100 entrées, données invalides, erreur d'écriture en base
- `401` : Clé API invalide
- `403` : Permission `kpi:write` manquante

**Exemple cURL** :
```bash
curl -X POST "https://api.retailperformerai.com/api/integrations/kpi/sync" \
  -H "X-API-Key: sk_live_votre_cle_api_ici" \
  -H "Content-Type: application/json" \
  -d '{
    "store_id": "store-123",
    "date": "2024-01-15",
    "kpi_entries": [
      {
        "seller_id": "seller-456",
        "ca_journalier": 1250.50,
        "nb_ventes": 12,
        "nb_articles": 28,
        "prospects": 35
      }
    ]
  }'
```

**Exemple Python** :
```python
import requests
from datetime import datetime

API_KEY = "sk_live_votre_cle_api_ici"
BASE_URL = "https://api.retailperformerai.com"

kpi_data = {
    "store_id": "store-123",
    "date": datetime.now().strftime("%Y-%m-%d"),
    "kpi_entries": [
        {
            "seller_id": "seller-456",
            "ca_journalier": 1250.50,
            "nb_ventes": 12,
            "nb_articles": 28,
            "prospects": 35
        }
    ]
}

response = requests.post(
    f"{BASE_URL}/api/integrations/kpi/sync",
    headers={"X-API-Key": API_KEY},
    json=kpi_data
)

if response.status_code == 200:
    result = response.json()
    print(f"KPI synchronisés : {result['total']} entrées")
else:
    print(f"Erreur {response.status_code}: {response.json()}")
```

---

## ❓ FAQ / Erreurs fréquentes

### 401 Unauthorized

**Cause** : Clé API invalide, manquante ou expirée.

**Solutions** :
- Vérifiez que le header `X-API-Key` est présent
- Vérifiez que la clé API est correcte (copie exacte, sans espaces)
- Vérifiez que la clé API n'est pas expirée
- Vérifiez que la clé API est active (non désactivée)

### 403 Forbidden - Insufficient permissions

**Cause** : La clé API n'a pas la permission requise.

**Exemple** :
```json
{
  "detail": "Insufficient permissions. Requires 'stores:write'"
}
```

**Solutions** :
- Vérifiez les permissions de la clé API dans l'interface gérant
- Créez une nouvelle clé API avec les permissions nécessaires

### 403 Forbidden - Store not accessible

**Cause** : La clé API est restreinte à certains magasins et n'a pas accès au magasin demandé.

**Exemple** :
```json
{
  "detail": "API key does not have access to this store (not in store_ids list)"
}
```

**Solutions** :
- Vérifiez que le magasin est dans la liste `store_ids` de la clé API
- Utilisez une clé API avec accès global (`store_ids: null` ou `["*"]`)

### 400 Bad Request - No fields to update

**Cause** : Aucun champ whitelist n'est présent dans le payload de `PUT /users/{user_id}`.

**Exemple** :
```json
{
  "detail": "No fields to update"
}
```

**Solutions** :
- Vérifiez que vous envoyez au moins un champ whitelist : `name`, `phone`, `status`, ou `external_id`
- Ne pas envoyer uniquement `email` (interdit) ou des champs non whitelist

### 400 Bad Request - Email already registered

**Cause** : L'email est déjà utilisé par un autre utilisateur.

**Solutions** :
- Utilisez un email unique
- Vérifiez si l'utilisateur existe déjà

### 404 Not Found - Store not found

**Cause** : Le magasin n'existe pas ou n'appartient pas au tenant de la clé API.

**Solutions** :
- Vérifiez que le `store_id` est correct
- Vérifiez que le magasin appartient au tenant (gérant) de la clé API

---

## 💡 Bonnes pratiques

### 1. Rotation des clés API

- **Régénérer les clés API** tous les 3-6 mois
- **Désactiver les anciennes clés** après migration
- **Ne jamais partager les clés API** publiquement (Git, logs, etc.)

### 2. Limiter les permissions

- **Principe du moindre privilège** : Accordez uniquement les permissions nécessaires
- **Créez des clés séparées** pour différents systèmes (ex: une clé pour la caisse, une autre pour l'ERP)

### 3. Limiter les Store IDs

- **Restreignez les clés API** à des magasins spécifiques si possible
- **Utilisez des clés globales** uniquement si nécessaire

### 4. Logs et monitoring

- **Loggez les appels API** (sans la clé API complète)
- **Surveillez les erreurs 401/403** pour détecter les tentatives d'accès non autorisées
- **Limitez le taux de requêtes** côté client pour éviter les abus

### 5. Gestion des erreurs

- **Implémentez une gestion d'erreurs robuste** avec retry pour les erreurs temporaires (5xx)
- **Ne réessayez pas** les erreurs 4xx (client) sauf pour les timeouts
- **Loggez les erreurs** pour le débogage

### 6. Validation des données

- **Validez les données** avant l'envoi (format date, IDs, etc.)
- **Vérifiez les limites** (max 100 entrées KPI par requête)

---

## 📞 Support

Pour toute question ou problème :

- **Email** : contact@retailperformerai.com
- **Documentation** : https://docs.retailperformerai.com

---

**© 2025 Retail Performer AI - Tous droits réservés**

