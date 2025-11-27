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

#### 1. Récupérer les statistiques de vos magasins (Recommandé - Simple)

**Endpoint** : `GET /api/v1/integrations/my-stats`

**Description** : Récupère automatiquement les statistiques de tous les magasins autorisés par votre clé API. Pas besoin de spécifier les magasins !

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
3. **Send Query Parameters** : ✅ Activé
   - `start_date` → `2025-01-01`
   - `end_date` → `2025-01-31`
4. **Send Headers** : ✅ Activé
   - Name: `X-API-Key`
   - Value: `rp_live_votre_cle_api_ici`

**Codes d'erreur** :
- `401` : Clé API invalide ou expirée
- `403` : Permission insuffisante (nécessite `read:stats`)
- `400` : Paramètres manquants (start_date ou end_date)
- `404` : Aucun magasin accessible avec cette clé

---

#### 2. Synchroniser les KPI journaliers

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
