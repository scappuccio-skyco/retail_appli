# Guide d'Intégration API - Retail Performer AI

## Vue d'ensemble

Ce guide décrit comment connecter vos logiciels externes (caisse, ERP, etc.) à Retail Performer AI via l'API REST.

## Gestion des Clés API (Gérant uniquement)

### Accéder à la gestion des clés
1. Connectez-vous en tant que Gérant
2. Cliquez sur l'onglet **"Intégrations API"** dans le dashboard
3. Vous accédez à la page de gestion des clés API

### Créer une clé API
1. Cliquez sur **"Créer une nouvelle clé API"**
2. Remplissez le formulaire :
   - **Nom** : Identifiant de la clé (ex: "Caisse Magasin Paris" ou "Système RH")
   - **Permissions** : Sélectionnez les permissions nécessaires
     - `write:kpi` : Écriture des KPI (CA, ventes, articles)
     - `read:stats` : Lecture des statistiques
     - `write:stores` : Créer des magasins (gérants uniquement)
     - `write:users` : Créer et modifier des managers et vendeurs
   - **Expiration** : Optionnel - nombre de jours avant expiration
3. Cliquez sur **"Créer la clé"**
4. **IMPORTANT** : Copiez immédiatement la clé générée - elle ne sera plus affichée

### Régénérer une clé
- Cliquez sur l'icône de régénération (🔄)
- Confirmez l'action
- L'ancienne clé sera désactivée
- Une nouvelle clé sera générée avec les mêmes paramètres

### Désactiver une clé
- Cliquez sur l'icône de suppression (🗑️)
- Confirmez l'action
- La clé sera désactivée mais conservée dans l'historique

## Utilisation de l'API

### Authentification

Toutes les requêtes API nécessitent une clé API dans le header :

```bash
Authorization: Bearer rp_live_votre_cle_api_ici
```

### Endpoints disponibles

> **💡 Note importante** : Il existe deux endpoints GET différents, ne pas les confondre !

| Endpoint | Retourne | Query Params | Cas d'usage |
|----------|----------|--------------|-------------|
| `/my-stores` | **Magasins + Personnel** (IDs, noms, emails) | ❌ Aucun | Obtenir les IDs pour envoyer des KPI |
| `/my-stats` | **Statistiques uniquement** (CA, ventes, articles) | ✅ Dates requises | Analyser les performances |

---

#### 1. Récupérer la liste de vos magasins, managers et vendeurs 👥

**Endpoint** : `GET /api/v1/integrations/my-stores`

**Description** : Récupère la liste complète de tous les magasins accessibles avec leur personnel (managers et vendeurs). **Idéal pour obtenir les IDs nécessaires avant d'envoyer des KPI.**

**⚠️ NE PAS CONFONDRE avec `/my-stats`** qui ne retourne que des chiffres sans les IDs du personnel.

**Headers** :
```
X-API-Key: rp_live_votre_cle_api_ici
```

**Réponse** (200 OK) :
```json
{
  "stores": [
    {
      "store_id": "c2dd1ada-d0a2-4a90-be81-644b7cb78bc7",
      "store_name": "Skyco Lyon Part-Dieu",
      "store_address": "45 Rue de la République, 69003 Lyon",
      "managers_count": 1,
      "managers": [
        {
          "id": "72468398-620f-42d1-977c-bd250f4d440a",
          "name": "DENIS TOM",
          "email": "Manager12@test.com"
        }
      ],
      "sellers_count": 8,
      "sellers": [
        {
          "id": "2a1c816b-fd21-463a-8a8f-bfe98616aeba",
          "name": "Vendeur Test 1",
          "email": "vendeur1@test.com"
        }
      ]
    }
  ],
  "total_stores": 4,
  "total_managers": 4,
  "total_sellers": 13
}
```

**Configuration N8N** :
1. **Method** : `GET`
2. **URL** : `https://retailperformerai.com/api/v1/integrations/my-stores`
3. **Send Query Parameters** : ❌ **DÉSACTIVÉ** (pas de paramètres nécessaires)
4. **Send Headers** : ✅ **ACTIVÉ**
   - Name: `X-API-Key`
   - Value: `rp_live_votre_cle_api_ici`

**Cas d'usage** : Utilisez cet endpoint au début de votre workflow N8N pour récupérer tous les IDs nécessaires avant d'envoyer des KPI.

**Codes d'erreur** :
- `401` : Clé API invalide ou expirée
- `403` : Permission insuffisante (nécessite `read:stats`)
- `404` : Aucun magasin accessible avec cette clé

---

#### 2. Récupérer les statistiques de vos magasins 📊

**Endpoint** : `GET /api/v1/integrations/my-stats`

**Description** : Récupère les **statistiques agrégées** (CA, ventes, articles) de tous les magasins autorisés par votre clé API pour une période donnée.

**⚠️ ATTENTION** : Cet endpoint retourne **uniquement des chiffres** (CA, ventes, etc.), **PAS les IDs des vendeurs/managers**. Pour obtenir les IDs du personnel, utilisez `/my-stores`.

**Headers** :
```
X-API-Key: rp_live_votre_cle_api_ici
```

**Query Parameters** :
- `start_date` : Date de début (format `YYYY-MM-DD`, ex: `2025-01-01`)
- `end_date` : Date de fin (format `YYYY-MM-DD`, ex: `2025-01-31`)

**Exemple de requête** :
```bash
GET /api/v1/integrations/my-stats?start_date=2025-01-01&end_date=2025-01-31
X-API-Key: rp_live_votre_cle_api_ici
```

**Réponse** (200 OK) :
```json
{
  "period": {
    "start": "2025-01-01",
    "end": "2025-01-31"
  },
  "stores": [
    {
      "store_id": "store-001",
      "store_name": "Skyco Paris Centre",
      "metrics": {
        "total_ca": 107359.70,
        "total_ventes": 833,
        "total_articles": 1417,
        "average_basket": 128.88
      }
    },
    {
      "store_id": "store-002",
      "store_name": "Skyco Lyon Part-Dieu",
      "metrics": {
        "total_ca": 209728.64,
        "total_ventes": 1403,
        "total_articles": 2300,
        "average_basket": 149.49
      }
    }
  ],
  "total_all_stores": {
    "total_ca": 317088.34,
    "total_ventes": 2236,
    "total_articles": 3717,
    "average_basket": 141.81
  }
}
```

**Configuration N8N** :
1. **Method** : `GET`
2. **URL** : `https://retailperformerai.com/api/v1/integrations/my-stats`
3. **Send Query Parameters** : ✅ **ACTIVÉ** (obligatoire)
   - `start_date` → `2025-01-01`
   - `end_date` → `2025-01-31`
4. **Send Headers** : ✅ **ACTIVÉ**
   - Name: `X-API-Key`
   - Value: `rp_live_votre_cle_api_ici`

**Codes d'erreur** :
- `401` : Clé API invalide ou expirée
- `403` : Permission insuffisante (nécessite `read:stats`)
- `400` : Paramètres manquants (start_date ou end_date)
- `404` : Aucun magasin accessible avec cette clé

**Exemple Python** :
```python
import requests

API_KEY = "rp_live_votre_cle_api_ici"
BASE_URL = "https://retailperformerai.com/api"

headers = {"X-API-Key": API_KEY}
params = {
    "start_date": "2025-01-01",
    "end_date": "2025-01-31"
}

response = requests.get(
    f"{BASE_URL}/v1/integrations/my-stats",
    headers=headers,
    params=params
)

if response.status_code == 200:
    data = response.json()
    print(f"✓ Statistiques récupérées pour {len(data['stores'])} magasins")
    print(f"CA Total: {data['total_all_stores']['total_ca']}€")
    for store in data['stores']:
        print(f"  - {store['store_name']}: {store['metrics']['total_ca']}€")
else:
    print(f"✗ Erreur: {response.status_code}")
```

**Exemple JavaScript/Node.js** :
```javascript
const axios = require('axios');

const API_KEY = 'rp_live_votre_cle_api_ici';
const BASE_URL = 'https://retailperformerai.com/api';

async function getStats() {
  try {
    const response = await axios.get(
      `${BASE_URL}/v1/integrations/my-stats`,
      {
        params: {
          start_date: '2025-01-01',
          end_date: '2025-01-31'
        },
        headers: {
          'X-API-Key': API_KEY
        }
      }
    );
    
    console.log(`✓ Statistiques récupérées pour ${response.data.stores.length} magasins`);
    console.log(`CA Total: ${response.data.total_all_stores.total_ca}€`);
    response.data.stores.forEach(store => {
      console.log(`  - ${store.store_name}: ${store.metrics.total_ca}€`);
    });
  } catch (error) {
    console.error('✗ Erreur:', error.response?.status);
  }
}

getStats();
```

---

#### 3. Synchroniser les KPI journaliers

> **💡 Plusieurs façons d'enregistrer les KPI :**
> - **Via API (API Key)** : `POST /v1/integrations/kpi/sync` - Pour systèmes externes (caisse, ERP)
> - **Via Interface Web (JWT)** : 
>   - Vendeur : `POST /seller/kpi-entry` - Le vendeur enregistre ses propres KPI
>   - Manager : `POST /manager/store-kpi` - Le manager enregistre les KPI de ses vendeurs

**Endpoint API** : `POST /api/v1/integrations/kpi/sync`

**Description** : Envoyez les KPI journaliers d'un ou plusieurs vendeurs depuis vos systèmes externes (caisse, ERP)

**Headers** :
```
X-API-Key: rp_live_votre_cle_api_ici
Content-Type: application/json
```

**Note** : Vous pouvez aussi utiliser `Authorization: Bearer rp_live_votre_cle_api_ici`

**Body** :
```json
{
  "store_id": "store-123",
  "date": "2025-11-26",
  "kpi_entries": [
    {
      "seller_id": "seller-456",
      "ca_journalier": 1500.00,
      "nb_ventes": 12,
      "nb_articles": 24,
      "prospects": 5
    },
    {
      "seller_id": "seller-789",
      "ca_journalier": 2300.00,
      "nb_ventes": 18,
      "nb_articles": 35,
      "prospects": 8
    }
  ],
  "source": "pos_system_v2"
}
```

**Champs du body :**
- `store_id` *(requis)* : ID du magasin
- `date` *(requis)* : Date au format YYYY-MM-DD
- `kpi_entries` *(requis)* : Liste des KPI des vendeurs
  - `seller_id` *(requis)* : ID du vendeur
  - `ca_journalier` *(requis)* : Chiffre d'affaires journalier en €
  - `nb_ventes` *(requis)* : Nombre de ventes réalisées
  - `nb_articles` *(requis)* : Nombre d'articles vendus
  - `prospects` *(optionnel)* : Nombre de prospects entrés dans le magasin (flux entrant) - Permet de calculer le **taux de transformation** = (nb_ventes / prospects) × 100
- `source` *(optionnel)* : Identifiant de la source des données (ex: "caisse_v2", "erp_sap")

**Réponse** (200 OK) :
```json
{
  "message": "KPI synchronized successfully",
  "synced_entries": 2,
  "store_id": "store-123",
  "date": "2025-11-26"
}
```

**Codes d'erreur** :
- `401` : Clé API invalide ou expirée
- `403` : Permission insuffisante
- `400` : Données invalides
- `404` : Magasin ou vendeur non trouvé

### Exemple d'intégration (Python)

```python
import requests
from datetime import datetime

# Configuration
API_KEY = "rp_live_votre_cle_api_ici"
BASE_URL = "https://retailperformerai.com/api"

# Headers
headers = {
    "X-API-Key": API_KEY,
    "Content-Type": "application/json"
}

# Données KPI
data = {
    "store_id": "store-123",
    "date": datetime.now().strftime("%Y-%m-%d"),
    "kpi_entries": [
        {
            "seller_id": "seller-456",
            "ca_journalier": 1500.00,
            "nb_ventes": 12,
            "nb_articles": 24,
            "prospects": 5
        }
    ],
    "source": "my_pos_system"
}

# Envoi
response = requests.post(
    f"{BASE_URL}/v1/integrations/kpi/sync",
    headers=headers,
    json=data
)

if response.status_code == 200:
    print("✓ KPI synchronisés avec succès")
    print(response.json())
else:
    print(f"✗ Erreur: {response.status_code}")
    print(response.json())
```

### Exemple d'intégration (JavaScript/Node.js)

```javascript
const axios = require('axios');

// Configuration
const API_KEY = 'rp_live_votre_cle_api_ici';
const BASE_URL = 'https://retailperformerai.com/api';

// Fonction de synchronisation
async function syncKPI() {
  try {
    const response = await axios.post(
      `${BASE_URL}/v1/integrations/kpi/sync`,
      {
        store_id: 'store-123',
        date: new Date().toISOString().split('T')[0],
        kpi_entries: [
          {
            seller_id: 'seller-456',
            ca_journalier: 1500.00,
            nb_ventes: 12,
            nb_articles: 24,
            prospects: 5
          }
        ],
        source: 'my_pos_system'
      },
      {
        headers: {
          'X-API-Key': API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✓ KPI synchronisés avec succès');
    console.log(response.data);
  } catch (error) {
    console.error('✗ Erreur:', error.response?.status);
    console.error(error.response?.data);
  }
}

syncKPI();
```

---

## Autres Méthodes d'Enregistrement des KPI 📝

### Via l'Interface Web (Authentification JWT)

Si vous développez une application web ou mobile, vous pouvez également utiliser les endpoints avec authentification JWT pour que les **vendeurs** et **managers** enregistrent les KPI directement.

#### 1. Vendeur enregistre ses propres KPI

**Endpoint** : `POST /api/seller/kpi-entry`

**Authentification** : JWT Token (connexion vendeur)

**Headers** :
```
Authorization: Bearer <jwt_token_vendeur>
Content-Type: application/json
```

**Body** :
```json
{
  "date": "2024-12-08",
  "ca_journalier": 1250.50,
  "nb_ventes": 12,
  "nb_articles": 28,
  "nb_prospects": 35
}
```

**Réponse** (200 OK) :
```json
{
  "message": "KPI entry created successfully",
  "kpi_id": "kpi-uuid-123"
}
```

---

#### 2. Manager enregistre les KPI d'un vendeur

**Endpoint** : `POST /api/manager/store-kpi`

**Authentification** : JWT Token (connexion manager)

**Headers** :
```
Authorization: Bearer <jwt_token_manager>
Content-Type: application/json
```

**Body** :
```json
{
  "seller_id": "uuid-du-vendeur",
  "date": "2024-12-08",
  "ca_journalier": 1250.50,
  "nb_ventes": 12,
  "nb_articles": 28,
  "nb_prospects": 35
}
```

**Réponse** (200 OK) :
```json
{
  "message": "KPI created successfully",
  "kpi_id": "kpi-uuid-123"
}
```

---

### 📊 Tableau Comparatif des Méthodes

| Méthode | Endpoint | Authentification | Cas d'usage |
|---------|----------|------------------|-------------|
| **API Externe** | `/v1/integrations/kpi/sync` | API Key | Systèmes de caisse, ERP, automatisation |
| **Vendeur (Web)** | `/seller/kpi-entry` | JWT Token | Application web/mobile pour vendeur |
| **Manager (Web)** | `/manager/store-kpi` | JWT Token | Application web/mobile pour manager |

**💡 Conseil** : 
- Utilisez l'**API Key** pour les intégrations automatiques (caisse, ERP)
- Utilisez le **JWT** pour les applications web/mobile où l'utilisateur se connecte

---

## Gestion des Utilisateurs via API 👥

### Permissions requises

Pour utiliser ces endpoints, votre clé API doit avoir les permissions suivantes :
- `write:stores` : Créer des magasins (gérants uniquement)
- `write:users` : Créer et modifier des managers et vendeurs

### 1. Créer un magasin 🏪

**Endpoint** : `POST /api/v1/integrations/stores`

**Description** : Créer un nouveau magasin. **Réservé aux gérants uniquement**.

**Headers** :
```
X-API-Key: rp_live_votre_cle_api_ici
Content-Type: application/json
```

**Body** :
```json
{
  "name": "Skyco Marseille",
  "location": "13001 Marseille",
  "address": "12 Rue de la République, 13001 Marseille",
  "phone": "+33 4 91 00 00 00",
  "opening_hours": "Lun-Sam: 9h-19h",
  "external_id": "STORE_MRS_001"
}
```

**Champs** :
- `name` *(requis)* : Nom du magasin
- `location` *(requis)* : Ville/code postal
- `address` *(optionnel)* : Adresse complète
- `phone` *(optionnel)* : Téléphone
- `opening_hours` *(optionnel)* : Horaires d'ouverture
- `external_id` *(optionnel)* : ID dans votre système externe (ERP, SAP, etc.)

**Réponse** (201 Created) :
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
    "external_id": "STORE_MRS_001"
  }
}
```

---

### 2. Créer un manager 👔

**Endpoint** : `POST /api/v1/integrations/stores/{store_id}/managers`

**Description** : Créer un nouveau manager pour un magasin spécifique.

**Headers** :
```
X-API-Key: rp_live_votre_cle_api_ici
Content-Type: application/json
```

**Body** :
```json
{
  "name": "Sophie Martin",
  "email": "sophie.martin@example.com",
  "phone": "+33 6 12 34 56 78",
  "external_id": "MGR_MRS_001",
  "send_invitation": true
}
```

**Champs** :
- `name` *(requis)* : Nom complet du manager
- `email` *(requis)* : Email professionnel
- `phone` *(optionnel)* : Téléphone mobile
- `external_id` *(optionnel)* : ID dans votre système externe
- `send_invitation` *(optionnel, défaut: true)* : Envoyer un email d'invitation pour créer son compte

**Réponse** (201 Created) :
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

---

### 3. Créer un vendeur 👤

**Endpoint** : `POST /api/v1/integrations/stores/{store_id}/sellers`

**Description** : Créer un nouveau vendeur pour un magasin spécifique.

**Headers** :
```
X-API-Key: rp_live_votre_cle_api_ici
Content-Type: application/json
```

**Body** :
```json
{
  "name": "Lucas Bernard",
  "email": "lucas.bernard@example.com",
  "manager_id": "72468398-620f-42d1-977c-bd250f4d440a",
  "phone": "+33 6 98 76 54 32",
  "external_id": "SELLER_MRS_012",
  "send_invitation": true
}
```

**Champs** :
- `name` *(requis)* : Nom complet du vendeur
- `email` *(requis)* : Email professionnel
- `manager_id` *(optionnel)* : ID du manager responsable. Si non fourni, un manager du magasin sera assigné automatiquement
- `phone` *(optionnel)* : Téléphone mobile
- `external_id` *(optionnel)* : ID dans votre système externe
- `send_invitation` *(optionnel, défaut: true)* : Envoyer un email d'invitation pour créer son compte

**Réponse** (201 Created) :
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

---

### 4. Mettre à jour un utilisateur 🔄

**Endpoint** : `PUT /api/v1/integrations/users/{user_id}`

**Description** : Mettre à jour les informations d'un manager ou vendeur.

**Headers** :
```
X-API-Key: rp_live_votre_cle_api_ici
Content-Type: application/json
```

**Body** :
```json
{
  "name": "Lucas Bernard-Dupont",
  "email": "lucas.dupont@example.com",
  "phone": "+33 6 11 22 33 44",
  "status": "active",
  "external_id": "SELLER_MRS_012_NEW"
}
```

**Champs** :
- `name` *(optionnel)* : Nouveau nom
- `email` *(optionnel)* : Nouvel email
- `phone` *(optionnel)* : Nouveau téléphone
- `status` *(optionnel)* : Statut (`active` | `suspended`)
- `external_id` *(optionnel)* : Nouvel ID externe

**Réponse** (200 OK) :
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

---

### 5. Workflow complet - Exemple Node.js 📦

```javascript
const axios = require('axios');

const API_BASE_URL = 'https://retailperformerai.com/api/v1/integrations';
const API_KEY = 'rp_live_votre_cle_api_ici';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'X-API-Key': API_KEY,
    'Content-Type': 'application/json'
  }
});

async function setupNewStore() {
  try {
    // 1. Créer le magasin
    console.log('📍 Création du magasin...');
    const storeResponse = await api.post('/stores', {
      name: 'Skyco Bordeaux',
      location: '33000 Bordeaux',
      address: '25 Rue Sainte-Catherine, 33000 Bordeaux',
      phone: '+33 5 56 00 00 00',
      external_id: 'STORE_BDX_001'
    });
    
    const storeId = storeResponse.data.store_id;
    console.log('✅ Magasin créé:', storeId);
    
    // 2. Créer le manager
    console.log('👔 Création du manager...');
    const managerResponse = await api.post(`/stores/${storeId}/managers`, {
      name: 'Marie Dubois',
      email: 'marie.dubois@example.com',
      phone: '+33 6 11 22 33 44',
      external_id: 'MGR_BDX_001',
      send_invitation: true
    });
    
    const managerId = managerResponse.data.manager_id;
    console.log('✅ Manager créé:', managerId);
    
    // 3. Créer plusieurs vendeurs
    console.log('👥 Création des vendeurs...');
    const sellers = [
      { name: 'Thomas Thomas', email: 'thomas@example.com', external_id: 'SELLER_BDX_001' },
      { name: 'Camille Robert', email: 'camille@example.com', external_id: 'SELLER_BDX_002' },
      { name: 'Alexandre Petit', email: 'alex@example.com', external_id: 'SELLER_BDX_003' }
    ];
    
    for (const seller of sellers) {
      const sellerResponse = await api.post(`/stores/${storeId}/sellers`, {
        ...seller,
        manager_id: managerId,
        send_invitation: true
      });
      console.log(`✅ Vendeur créé: ${seller.name} (${sellerResponse.data.seller_id})`);
    }
    
    console.log('🎉 Configuration du magasin terminée !');
    
  } catch (error) {
    console.error('❌ Erreur:', error.response?.data || error.message);
  }
}

setupNewStore();
```

---

## Bonnes pratiques

### Sécurité
- ✅ Stockez vos clés API en toute sécurité (variables d'environnement, gestionnaire de secrets)
- ✅ Ne partagez jamais vos clés API publiquement
- ✅ Régénérez régulièrement vos clés
- ✅ Désactivez immédiatement les clés compromises
- ✅ Utilisez HTTPS uniquement

### Performance
- ⚡ Regroupez les entrées KPI dans une seule requête (max 100 vendeurs)
- ⚡ Envoyez les données une fois par jour (fin de journée)
- ⚡ Gérez les réessais en cas d'erreur temporaire (429, 503)

### Monitoring
- 📊 Surveillez le champ `last_used_at` dans la gestion des clés
- 📊 Vérifiez régulièrement que les données sont bien synchronisées
- 📊 Configurez des alertes pour les erreurs d'API

## Support

Pour toute question ou problème :
- Email : contact@retailperformerai.com
- Documentation complète : [lien à ajouter]

## Changelog

### Version 1.2 (8 Déc 2025)
- ✨ **Gestion complète des utilisateurs via API** :
  - `POST /v1/integrations/stores` : Créer des magasins
  - `POST /v1/integrations/stores/{store_id}/managers` : Créer des managers
  - `POST /v1/integrations/stores/{store_id}/sellers` : Créer des vendeurs
  - `PUT /v1/integrations/users/{user_id}` : Mettre à jour les utilisateurs
- 🔐 Nouvelles permissions : `write:stores` et `write:users`
- 📧 Invitations automatiques par email pour les nouveaux utilisateurs
- 🔗 Support de l'`external_id` pour synchroniser avec vos systèmes externes
- 📖 Documentation complète avec exemples Node.js

### Version 1.1 (27 Nov 2025)
- ✨ Nouvel endpoint `/api/v1/integrations/my-stores` pour lister magasins + managers + vendeurs
- ✨ Nouvel endpoint `/api/v1/integrations/my-stats` pour récupérer les statistiques agrégées
- 🎯 Détection automatique des magasins autorisés (plus besoin de spécifier store_id manuellement)
- 📖 Guide de configuration N8N détaillé avec tableau comparatif des endpoints
- 🔧 Correction des exemples de code avec le préfixe `/v1`
- ⚠️ Clarification importante : distinction entre `/my-stores` (personnel) et `/my-stats` (chiffres)

### Version 1.0 (26 Nov 2025)
- 🎉 Lancement de l'API
- ✨ Endpoint de synchronisation KPI
- 🔐 Gestion des clés API pour les Gérants
