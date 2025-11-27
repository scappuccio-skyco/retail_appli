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
   - **Nom** : Identifiant de la clé (ex: "Caisse Magasin Paris")
   - **Permissions** : Sélectionnez les permissions nécessaires
     - `write:kpi` : Écriture des KPI (CA, ventes, articles)
     - `read:stats` : Lecture des statistiques
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

> **💡 Note importante** : Il existe deux endpoints pour récupérer des données :
> - `/my-stores` → Retourne les **magasins + personnel** (managers et vendeurs avec leurs IDs)
> - `/my-stats` → Retourne les **statistiques uniquement** (CA, ventes) sans les noms/IDs du personnel

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
2. **URL** : `https://votre-domaine.com/api/v1/integrations/my-stores`
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
2. **URL** : `https://votre-domaine.com/api/v1/integrations/my-stats`
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
BASE_URL = "https://votre-domaine.com/api"

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
const BASE_URL = 'https://votre-domaine.com/api';

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

**Endpoint** : `POST /api/v1/integrations/kpi/sync`

**Description** : Envoyez les KPI journaliers d'un ou plusieurs vendeurs

**Headers** :
```
Authorization: Bearer rp_live_votre_cle_api_ici
Content-Type: application/json
```

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
BASE_URL = "https://votre-domaine.com/api"

# Headers
headers = {
    "Authorization": f"Bearer {API_KEY}",
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
const BASE_URL = 'https://votre-domaine.com/api';

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
          'Authorization': `Bearer ${API_KEY}`,
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

### Version 1.1 (27 Nov 2025)
- ✨ Nouvel endpoint `/api/v1/integrations/my-stats` pour récupérer facilement les stats
- 🎯 Détection automatique des magasins autorisés (plus besoin de spécifier store_id)
- 📖 Guide de configuration N8N ajouté
- 🔧 Correction des exemples de code avec le préfixe `/v1`

### Version 1.0 (26 Nov 2025)
- 🎉 Lancement de l'API
- ✨ Endpoint de synchronisation KPI
- 🔐 Gestion des clés API pour les Gérants
