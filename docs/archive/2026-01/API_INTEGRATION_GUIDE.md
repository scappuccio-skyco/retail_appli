# Guide d'Intégration API - Retail Performer AI

## Vue d'ensemble

Ce guide décrit comment connecter vos logiciels externes (caisse, ERP, etc.) à Retail Performer AI via l'API REST.

**Base URL** : `https://api.retailperformerai.com`

---

## 📋 Structure de l'API

L'API Retail Performer AI est organisée en deux sections principales :

### A) API App (Authentification JWT Bearer)

Endpoints pour l'application web/mobile avec authentification utilisateur (JWT).

**Authentification** : `Authorization: Bearer <JWT_TOKEN>`

**Endpoints disponibles** :
- `/api/stores/*` - Gestion des magasins
- `/api/manager/*` - Fonctionnalités manager
- `/api/seller/*` - Fonctionnalités vendeur

**Documentation détaillée** :
- 📘 [GUIDE_API_STORES.md](./GUIDE_API_STORES.md) - Gestion des boutiques
- 📘 [GUIDE_API_MANAGER.md](./GUIDE_API_MANAGER.md) - Endpoints Manager
- 📘 [GUIDE_API_SELLER.md](./GUIDE_API_SELLER.md) - Endpoints Vendeur

---

### B) API Intégrations (Authentification X-API-Key)

Endpoints pour les intégrations système (ERP, caisse, etc.) avec authentification par clé API.

**Authentification** : `X-API-Key: <API_KEY>`

**Endpoints disponibles** :
- `POST /api/integrations/kpi/sync` - Synchroniser les KPI (endpoint officiel ERP)
- `POST /api/integrations/v1/kpi/sync` - Alias legacy (déprécié)

**Gestion des clés API** :
- `GET /api/integrations/api-keys` - Lister les clés API (nécessite JWT gérant, pas API Key)
- `POST /api/integrations/api-keys` - Créer une clé API (nécessite JWT gérant, pas API Key)

> ⚠️ **Important** : Les endpoints `/api/integrations/api-keys` nécessitent une authentification **JWT Bearer** (gérant), **PAS** une API Key. Ils sont utilisés depuis l'interface web pour gérer les clés API.

---

## 🔑 Gestion des Clés API (Gérant uniquement)

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

---

## 🔌 API Intégrations - Synchronisation KPI

### POST /api/integrations/kpi/sync — Synchroniser les KPI (Endpoint Officiel)

**Description** : Envoyez les KPI journaliers d'un ou plusieurs vendeurs depuis vos systèmes externes (caisse, ERP). **Cet endpoint est l'endpoint officiel pour les intégrations ERP.**

**Endpoint** :
```
POST https://api.retailperformerai.com/api/integrations/kpi/sync
```

**Headers** :
```
X-API-Key: rp_live_votre_cle_api_ici
Content-Type: application/json
```

**Body** :
```json
{
  "date": "2025-01-15",
  "kpi_entries": [
    {
      "seller_id": "seller-uuid-123",
      "ca_journalier": 1500.00,
      "nb_ventes": 12,
      "nb_articles": 24,
      "prospects": 35
    },
    {
      "seller_id": "seller-uuid-456",
      "ca_journalier": 2300.00,
      "nb_ventes": 18,
      "nb_articles": 35,
      "prospects": 8
    }
  ]
}
```

**Champs du body** :
- `date` *(requis)* : Date au format YYYY-MM-DD
- `kpi_entries` *(requis)* : Liste des KPI des vendeurs (max 100 par requête)
  - `seller_id` *(requis)* : ID du vendeur
  - `ca_journalier` *(requis)* : Chiffre d'affaires journalier en €
  - `nb_ventes` *(requis)* : Nombre de ventes réalisées
  - `nb_articles` *(requis)* : Nombre d'articles vendus
  - `prospects` *(optionnel)* : Nombre de prospects entrés dans le magasin (flux entrant) - Permet de calculer le **taux de transformation** = (nb_ventes / prospects) × 100

**Réponse** (200 OK) :
```json
{
  "status": "success",
  "entries_created": 1,
  "entries_updated": 1,
  "total": 2
}
```

**Codes d'erreur** :
- `401` : Clé API invalide ou expirée
- `403` : Permission insuffisante (nécessite `write:kpi`)
- `400` : Données invalides (max 100 entrées par requête)
- `404` : Magasin ou vendeur non trouvé

---

### POST /api/integrations/v1/kpi/sync — Alias Legacy (Déprécié)

**Description** : Alias legacy pour compatibilité avec N8N et autres systèmes. **Déprécié** - utilisez `/api/integrations/kpi/sync` pour les nouvelles intégrations.

**Endpoint** :
```
POST https://api.retailperformerai.com/api/integrations/v1/kpi/sync
```

**Headers** : Identiques à `/api/integrations/kpi/sync`

**Body** : Identique à `/api/integrations/kpi/sync`

> ⚠️ **Note** : Cet endpoint est déprécié mais reste fonctionnel pour compatibilité. Utilisez `/api/integrations/kpi/sync` pour les nouvelles intégrations.

---

## 💻 Exemples d'Intégration

### Exemple Python

```python
import requests
from datetime import datetime

# Configuration
API_KEY = "rp_live_votre_cle_api_ici"
BASE_URL = "https://api.retailperformerai.com"

# Headers
headers = {
    "X-API-Key": API_KEY,
    "Content-Type": "application/json"
}

# Données KPI
data = {
    "date": datetime.now().strftime("%Y-%m-%d"),
    "kpi_entries": [
        {
            "seller_id": "seller-uuid-123",
            "ca_journalier": 1500.00,
            "nb_ventes": 12,
            "nb_articles": 24,
            "prospects": 35
        }
    ]
}

# Envoi
response = requests.post(
    f"{BASE_URL}/api/integrations/kpi/sync",
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

### Exemple JavaScript/Node.js

```javascript
const axios = require('axios');

// Configuration
const API_KEY = 'rp_live_votre_cle_api_ici';
const BASE_URL = 'https://api.retailperformerai.com';

// Fonction de synchronisation
async function syncKPI() {
  try {
    const response = await axios.post(
      `${BASE_URL}/api/integrations/kpi/sync`,
      {
        date: new Date().toISOString().split('T')[0],
        kpi_entries: [
          {
            seller_id: 'seller-uuid-123',
            ca_journalier: 1500.00,
            nb_ventes: 12,
            nb_articles: 24,
            prospects: 35
          }
        ]
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

### Exemple cURL

```bash
curl -X POST "https://api.retailperformerai.com/api/integrations/kpi/sync" \
  -H "X-API-Key: rp_live_votre_cle_api_ici" \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2025-01-15",
    "kpi_entries": [
      {
        "seller_id": "seller-uuid-123",
        "ca_journalier": 1500.00,
        "nb_ventes": 12,
        "nb_articles": 24,
        "prospects": 35
      }
    ]
  }'
```

### Exemple n8n (HTTP Request Node)

**Configuration du Node** :
- **Method** : `POST`
- **URL** : `https://api.retailperformerai.com/api/integrations/kpi/sync`
- **Authentication** : Generic Credential Type
  - **Name** : `X-API-Key`
  - **Value** : `{{$env.API_KEY}}`
- **Headers** :
  - `Content-Type`: `application/json`
- **Body (JSON)** :
  ```json
  {
    "date": "={{$json.date}}",
    "kpi_entries": "={{$json.kpi_entries}}"
  }
  ```

---

## ⚠️ Endpoints Non Disponibles

Les endpoints suivants sont **absents du runtime** et ne sont **pas disponibles** :

- ❌ `GET /api/integrations/my-stores` - **Non disponible**
- ❌ `GET /api/integrations/my-stats` - **Non disponible**
- ❌ `POST /api/integrations/stores` - **Non disponible**
- ❌ `POST /api/integrations/stores/{store_id}/managers` - **Non disponible**
- ❌ `POST /api/integrations/stores/{store_id}/sellers` - **Non disponible**
- ❌ `PUT /api/integrations/users/{user_id}` - **Non disponible**

**Alternatives** :

Pour créer des magasins et gérer les utilisateurs :
- **Via API App (JWT)** : Utilisez `/api/stores/` avec authentification Bearer (voir [GUIDE_API_STORES.md](./GUIDE_API_STORES.md))
- **Via API Enterprise** : Consultez [ENTERPRISE_API_DOCUMENTATION.md](./ENTERPRISE_API_DOCUMENTATION.md) pour les endpoints Enterprise avec API Key

Pour lister les magasins :
- **Via API App (JWT)** : Utilisez `GET /api/stores/my-stores` avec authentification Bearer (voir [GUIDE_API_STORES.md](./GUIDE_API_STORES.md))

---

## 📊 Autres Méthodes d'Enregistrement des KPI

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
  "date": "2025-01-15",
  "ca_journalier": 1250.50,
  "nb_ventes": 12,
  "nb_articles": 28,
  "nb_prospects": 35
}
```

**Documentation** : Voir [GUIDE_API_SELLER.md](./GUIDE_API_SELLER.md)

---

#### 2. Manager enregistre les KPI d'un vendeur

**Endpoint** : `POST /api/manager/manager-kpi`

**Authentification** : JWT Token (connexion manager)

**Headers** :
```
Authorization: Bearer <jwt_token_manager>
Content-Type: application/json
```

**Body** :
```json
{
  "date": "2025-01-15",
  "ca_journalier": 1250.50,
  "nb_ventes": 12,
  "nb_articles": 28,
  "nb_prospects": 35
}
```

**Documentation** : Voir [GUIDE_API_MANAGER.md](./GUIDE_API_MANAGER.md)

---

### 📊 Tableau Comparatif des Méthodes

| Méthode | Endpoint | Authentification | Cas d'usage |
|---------|----------|------------------|-------------|
| **API Externe** | `POST /api/integrations/kpi/sync` | X-API-Key | Systèmes de caisse, ERP, automatisation |
| **Vendeur (Web)** | `POST /api/seller/kpi-entry` | JWT Token | Application web/mobile pour vendeur |
| **Manager (Web)** | `POST /api/manager/manager-kpi` | JWT Token | Application web/mobile pour manager |

**💡 Conseil** : 
- Utilisez l'**X-API-Key** pour les intégrations automatiques (caisse, ERP)
- Utilisez le **JWT** pour les applications web/mobile où l'utilisateur se connecte

---

## 🔐 Bonnes Pratiques

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

---

## 📞 Support

Pour toute question ou problème :
- **Email** : contact@retailperformerai.com
- **Documentation complète** : Consultez [API_README.md](./API_README.md)

---

## 📝 Changelog

### Version 2.0 (Janvier 2025)
- 🔄 **Réorganisation de la documentation** en 2 sections (API App JWT vs API Intégrations)
- ❌ **Suppression des endpoints non disponibles** : `/api/integrations/my-stores`, `/api/integrations/my-stats`, `/api/integrations/stores/*`, `/api/integrations/users/*`
- ✅ **Correction des attributs deprecated** : `/api/integrations/kpi/sync` n'est plus déprécié (endpoint officiel ERP)
- 📝 **Mise à jour de tous les exemples** avec base URL `https://api.retailperformerai.com` et headers corrects
- 🔐 **Clarification de l'authentification** : `/api/integrations/api-keys` nécessite JWT gérant, pas API Key

### Version 1.2 (8 Déc 2025)
- ✨ Gestion complète des utilisateurs via API (endpoints maintenant non disponibles)
- 🔐 Nouvelles permissions : `write:stores` et `write:users`
- 📧 Invitations automatiques par email pour les nouveaux utilisateurs

### Version 1.1 (27 Nov 2025)
- ✨ Nouveaux endpoints `/my-stores` et `/my-stats` (maintenant non disponibles)

### Version 1.0 (26 Nov 2025)
- 🎉 Lancement de l'API
- ✨ Endpoint de synchronisation KPI
- 🔐 Gestion des clés API pour les Gérants
