# 📘 Guide API - Manager

## Base URL

**Base URL** : `https://api.retailperformerai.com`

---

## 🔐 Authentification

Tous les endpoints nécessitent un token JWT dans le header :

```
Authorization: Bearer <votre_token>
Content-Type: application/json
```

**Obtenir un token** :
1. Utilisez l'endpoint `/api/auth/login` pour vous authentifier
2. Le token JWT sera retourné dans la réponse
3. Utilisez ce token dans le header `Authorization: Bearer <token>` pour toutes les requêtes suivantes

---

## 🌐 CORS

Les origines suivantes sont autorisées :
- `https://retailperformerai.com`
- `https://www.retailperformerai.com`

---

## 📋 Endpoints Disponibles

### 1. GET /api/manager/subscription-status — Statut d'abonnement

**Description** : Vérifie le statut d'abonnement pour le contrôle d'accès. Retourne `isReadOnly: true` si l'essai a expiré.

**Endpoint** :
```
GET https://api.retailperformerai.com/api/manager/subscription-status
```

**Query Parameters** :
- `store_id` (string, optionnel) : ID du magasin (requis pour gérant)

**Headers** :
```
Authorization: Bearer <token>
```

**Réponse (200 OK)** :
```json
{
  "isReadOnly": false,
  "status": "active",
  "message": "Abonnement actif"
}
```

**Exemple de réponse (essai en cours)** :
```json
{
  "isReadOnly": false,
  "status": "trialing",
  "daysLeft": 12,
  "message": "Essai gratuit - 12 jours restants"
}
```

**Exemple de réponse (essai expiré)** :
```json
{
  "isReadOnly": true,
  "status": "trial_expired",
  "message": "Période d'essai terminée. Contactez votre administrateur."
}
```

**Codes de réponse** :
- `200` : Statut d'abonnement
- `401` : Non authentifié
- `403` : Accès refusé (rôle insuffisant)

---

### 2. GET /api/manager/store-kpi-overview — Vue d'ensemble KPI du magasin

**Description** : Récupère la vue d'ensemble des KPI du magasin pour une date spécifique. Retourne les KPI agrégés pour tous les vendeurs.

**Endpoint** :
```
GET https://api.retailperformerai.com/api/manager/store-kpi-overview
```

**Query Parameters** :
- `store_id` (string, requis pour gérant) : ID du magasin
- `date` (string, optionnel, format YYYY-MM-DD) : Date cible (par défaut: aujourd'hui)

**Headers** :
```
Authorization: Bearer <token>
```

**Exemple de requête** :
```
GET /api/manager/store-kpi-overview?store_id=c2dd1ada-d0a2-4a90-be81-644b7cb78bc7&date=2025-01-15
```

**Réponse (200 OK)** :
```json
{
  "date": "2025-01-15",
  "store_id": "c2dd1ada-d0a2-4a90-be81-644b7cb78bc7",
  "totals": {
    "ca_journalier": 12500.50,
    "nb_ventes": 120,
    "nb_clients": 150,
    "nb_articles": 280,
    "nb_prospects": 180
  },
  "derived": {
    "panier_moyen": 104.17,
    "taux_transformation": 80.0,
    "indice_vente": 2.33
  },
  "sellers_submitted": 8,
  "entries_count": 10
}
```

**Codes de réponse** :
- `200` : Vue d'ensemble KPI
- `401` : Non authentifié
- `403` : Accès refusé

---

### 3. GET /api/manager/dates-with-data — Dates avec données

**Description** : Récupère la liste des dates qui ont des données KPI pour le magasin. Utilisé pour le surlignage du calendrier.

**Endpoint** :
```
GET https://api.retailperformerai.com/api/manager/dates-with-data
```

**Query Parameters** :
- `store_id` (string, requis pour gérant) : ID du magasin
- `year` (integer, optionnel) : Année (ex: 2025)
- `month` (integer, optionnel) : Mois (1-12)

**Headers** :
```
Authorization: Bearer <token>
```

**Exemple de requête** :
```
GET /api/manager/dates-with-data?store_id=c2dd1ada-d0a2-4a90-be81-644b7cb78bc7&year=2025&month=1
```

**Réponse (200 OK)** :
```json
{
  "dates": [
    "2025-01-05",
    "2025-01-06",
    "2025-01-07",
    "2025-01-10",
    "2025-01-15"
  ],
  "lockedDates": [
    "2025-01-05",
    "2025-01-06"
  ]
}
```

**Codes de réponse** :
- `200` : Liste des dates
- `401` : Non authentifié
- `403` : Accès refusé

---

### 4. GET /api/manager/available-years — Années disponibles

**Description** : Récupère la liste des années pour lesquelles il existe des données KPI.

**Endpoint** :
```
GET https://api.retailperformerai.com/api/manager/available-years
```

**Query Parameters** :
- `store_id` (string, requis pour gérant) : ID du magasin

**Headers** :
```
Authorization: Bearer <token>
```

**Exemple de requête** :
```
GET /api/manager/available-years?store_id=c2dd1ada-d0a2-4a90-be81-644b7cb78bc7
```

**Réponse (200 OK)** :
```json
{
  "years": [2024, 2025, 2026]
}
```

**Codes de réponse** :
- `200` : Liste des années
- `401` : Non authentifié
- `403` : Accès refusé

---

## 💻 Exemples d'Utilisation

### cURL

**Statut d'abonnement** :
```bash
curl -X GET "https://api.retailperformerai.com/api/manager/subscription-status?store_id=c2dd1ada-d0a2-4a90-be81-644b7cb78bc7" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Vue d'ensemble KPI** :
```bash
curl -X GET "https://api.retailperformerai.com/api/manager/store-kpi-overview?store_id=c2dd1ada-d0a2-4a90-be81-644b7cb78bc7&date=2025-01-15" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Dates avec données** :
```bash
curl -X GET "https://api.retailperformerai.com/api/manager/dates-with-data?store_id=c2dd1ada-d0a2-4a90-be81-644b7cb78bc7&year=2025&month=1" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Années disponibles** :
```bash
curl -X GET "https://api.retailperformerai.com/api/manager/available-years?store_id=c2dd1ada-d0a2-4a90-be81-644b7cb78bc7" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### Postman

**Collection Configuration** :
1. Créez une collection "Retail Performer AI - Manager"
2. Ajoutez une variable d'environnement `baseUrl` = `https://api.retailperformerai.com`
3. Configurez l'authentification au niveau de la collection :
   - Type : Bearer Token
   - Token : `{{token}}` (variable d'environnement)

**Requête : Statut d'abonnement** :
- Method : `GET`
- URL : `{{baseUrl}}/api/manager/subscription-status`
- Query Params :
  - `store_id` : `{{store_id}}` (variable)

**Requête : Vue d'ensemble KPI** :
- Method : `GET`
- URL : `{{baseUrl}}/api/manager/store-kpi-overview`
- Query Params :
  - `store_id` : `{{store_id}}`
  - `date` : `2025-01-15` (optionnel)

**Requête : Dates avec données** :
- Method : `GET`
- URL : `{{baseUrl}}/api/manager/dates-with-data`
- Query Params :
  - `store_id` : `{{store_id}}`
  - `year` : `2025` (optionnel)
  - `month` : `1` (optionnel)

**Requête : Années disponibles** :
- Method : `GET`
- URL : `{{baseUrl}}/api/manager/available-years`
- Query Params :
  - `store_id` : `{{store_id}}`

---

### n8n (HTTP Request)

**Node Configuration : Statut d'abonnement** :
- Method : `GET`
- URL : `https://api.retailperformerai.com/api/manager/subscription-status`
- Query Parameters :
  - `store_id` : `{{$json.store_id}}`
- Authentication : Generic Credential Type
  - Name : `Authorization`
  - Value : `Bearer {{$json.token}}`

**Node Configuration : Vue d'ensemble KPI** :
- Method : `GET`
- URL : `https://api.retailperformerai.com/api/manager/store-kpi-overview`
- Query Parameters :
  - `store_id` : `{{$json.store_id}}`
  - `date` : `{{$json.date}}` (optionnel)
- Authentication : Generic Credential Type
  - Name : `Authorization`
  - Value : `Bearer {{$json.token}}`

**Node Configuration : Dates avec données** :
- Method : `GET`
- URL : `https://api.retailperformerai.com/api/manager/dates-with-data`
- Query Parameters :
  - `store_id` : `{{$json.store_id}}`
  - `year` : `{{$json.year}}` (optionnel)
  - `month` : `{{$json.month}}` (optionnel)
- Authentication : Generic Credential Type
  - Name : `Authorization`
  - Value : `Bearer {{$json.token}}`

**Node Configuration : Années disponibles** :
- Method : `GET`
- URL : `https://api.retailperformerai.com/api/manager/available-years`
- Query Parameters :
  - `store_id` : `{{$json.store_id}}`
- Authentication : Generic Credential Type
  - Name : `Authorization`
  - Value : `Bearer {{$json.token}}`

---

## 📞 Support

Pour toute question sur l'utilisation de l'API :
- **Email** : contact@retailperformerai.com
- **Documentation complète** : Consultez [API_README.md](./API_README.md)

---

**Version** : 1.0.0  
**Dernière mise à jour** : Janvier 2025

