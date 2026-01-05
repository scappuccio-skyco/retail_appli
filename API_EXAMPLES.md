# Exemples d'Intégration API - Retail Performer AI

Base URL: `https://api.retailperformerai.com`

## 🔐 Authentification

### Bearer Token (JWT) - Par défaut
Utilisé pour l'authentification utilisateur (Gérant, Manager, Seller)

```bash
Authorization: Bearer <votre_token_jwt>
```

### X-API-Key - Enterprise/Bulk
Utilisé pour les intégrations système (ERP, caisse, etc.)

```bash
X-API-Key: rp_live_votre_cle_api
```

---

## 📋 Exemples cURL

### 1. POST /api/stores/ - Créer un magasin (Bearer)

```bash
curl -X POST "https://api.retailperformerai.com/api/stores/" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Boutique Paris Centre",
    "location": "75001 Paris",
    "manager_id": "optional-manager-id"
  }'
```

### 2. GET /api/stores/my-stores - Lister mes magasins (Bearer)

```bash
curl -X GET "https://api.retailperformerai.com/api/stores/my-stores" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 3. GET /api/stores/{store_id}/info - Info magasin (Bearer)

```bash
curl -X GET "https://api.retailperformerai.com/api/stores/store-123/info" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 4. GET /api/manager/subscription-status - Statut abonnement Manager (Bearer)

```bash
curl -X GET "https://api.retailperformerai.com/api/manager/subscription-status" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 5. GET /api/manager/store-kpi-overview - Vue d'ensemble KPI (Bearer)

```bash
curl -X GET "https://api.retailperformerai.com/api/manager/store-kpi-overview?date=2025-01-15" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 6. GET /api/manager/dates-with-data - Dates avec données (Bearer)

```bash
curl -X GET "https://api.retailperformerai.com/api/manager/dates-with-data?year=2025&month=1" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 7. GET /api/manager/available-years - Années disponibles (Bearer)

```bash
curl -X GET "https://api.retailperformerai.com/api/manager/available-years" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 8. GET /api/seller/subscription-status - Statut abonnement Seller (Bearer)

```bash
curl -X GET "https://api.retailperformerai.com/api/seller/subscription-status" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 9. GET /api/seller/kpi-enabled - Vérifier si KPI activé (Bearer)

```bash
curl -X GET "https://api.retailperformerai.com/api/seller/kpi-enabled" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 10. GET /api/seller/tasks - Tâches vendeur (Bearer)

```bash
curl -X GET "https://api.retailperformerai.com/api/seller/tasks" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 11. GET /api/seller/objectives/active - Objectifs actifs (Bearer)

```bash
curl -X GET "https://api.retailperformerai.com/api/seller/objectives/active" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 12. GET /api/seller/objectives/all - Tous les objectifs (Bearer)

```bash
curl -X GET "https://api.retailperformerai.com/api/seller/objectives/all" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 13. POST /api/integrations/kpi/sync - Synchroniser KPI (X-API-Key)

**Endpoint officiel pour intégrations ERP** :

```bash
curl -X POST "https://api.retailperformerai.com/api/integrations/kpi/sync" \
  -H "X-API-Key: rp_live_votre_cle_api" \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2025-01-15",
    "kpi_entries": [
      {
        "seller_id": "seller-uuid-123",
        "ca_journalier": 1250.50,
        "nb_ventes": 12,
        "nb_articles": 28,
        "prospects": 35
      }
    ]
  }'
```

### 14. POST /api/integrations/v1/kpi/sync - Alias Legacy (Déprécié)

**Alias legacy pour compatibilité N8N** (déprécié, utilisez `/api/integrations/kpi/sync`) :

```bash
curl -X POST "https://api.retailperformerai.com/api/integrations/v1/kpi/sync" \
  -H "X-API-Key: rp_live_votre_cle_api" \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2025-01-15",
    "kpi_entries": [
      {
        "seller_id": "seller-uuid-123",
        "ca_journalier": 1250.50,
        "nb_ventes": 12,
        "nb_articles": 28
      }
    ]
  }'
```

> ⚠️ **Note**: `/api/integrations/v1/kpi/sync` est déprécié. Utilisez `/api/integrations/kpi/sync` pour les nouvelles intégrations.

---

## 📮 Collection Postman

### Configuration de la Collection

1. **Variable d'environnement** :
   - `baseUrl`: `https://api.retailperformerai.com`
   - `jwtToken`: Votre token JWT (pour Bearer)
   - `apiKey`: Votre clé API (pour X-API-Key)

2. **Auth au niveau Collection** :
   - Type: Bearer Token
   - Token: `{{jwtToken}}`

### Exemples de Requêtes Postman

#### POST /api/stores/
```
Method: POST
URL: {{baseUrl}}/api/stores/
Headers:
  Authorization: Bearer {{jwtToken}}
  Content-Type: application/json
Body (raw JSON):
{
  "name": "Boutique Paris Centre",
  "location": "75001 Paris"
}
```

#### GET /api/manager/subscription-status
```
Method: GET
URL: {{baseUrl}}/api/manager/subscription-status
Headers:
  Authorization: Bearer {{jwtToken}}
```

#### POST /api/integrations/kpi/sync (avec API Key)
```
Method: POST
URL: {{baseUrl}}/api/integrations/kpi/sync
Headers:
  X-API-Key: {{apiKey}}
  Content-Type: application/json
Body (raw JSON):
{
  "date": "2025-01-15",
  "kpi_entries": [
    {
      "seller_id": "seller-uuid-123",
      "ca_journalier": 1250.50,
      "nb_ventes": 12,
      "nb_articles": 28
    }
  ]
}
```

---

## 🔄 n8n - HTTP Request Node

### Configuration du Node HTTP Request

#### Exemple 1: POST /api/stores/ (Bearer)

```json
{
  "method": "POST",
  "url": "https://api.retailperformerai.com/api/stores/",
  "authentication": "genericCredentialType",
  "genericAuthType": "httpHeaderAuth",
  "sendHeaders": true,
  "headerParameters": {
    "parameters": [
      {
        "name": "Authorization",
        "value": "Bearer {{$json.token}}"
      },
      {
        "name": "Content-Type",
        "value": "application/json"
      }
    ]
  },
  "sendBody": true,
  "bodyParameters": {
    "parameters": [
      {
        "name": "name",
        "value": "{{$json.storeName}}"
      },
      {
        "name": "location",
        "value": "{{$json.location}}"
      }
    ]
  },
  "options": {}
}
```

#### Exemple 2: POST /api/integrations/kpi/sync (X-API-Key)

```json
{
  "method": "POST",
  "url": "https://api.retailperformerai.com/api/integrations/kpi/sync",
  "authentication": "genericCredentialType",
  "genericAuthType": "httpHeaderAuth",
  "sendHeaders": true,
  "headerParameters": {
    "parameters": [
      {
        "name": "X-API-Key",
        "value": "{{$env.API_KEY}}"
      },
      {
        "name": "Content-Type",
        "value": "application/json"
      }
    ]
  },
  "sendBody": true,
  "bodyContentType": "json",
  "jsonBody": "={{{\n  \"date\": \"2025-01-15\",\n  \"kpi_entries\": [\n    {\n      \"seller_id\": \"{{$json.sellerId}}\",\n      \"ca_journalier\": {{$json.ca}},\n      \"nb_ventes\": {{$json.ventes}},\n      \"nb_articles\": {{$json.articles}}\n    }\n  ]\n}}}",
  "options": {}
}
```

#### Exemple 3: GET /api/manager/store-kpi-overview

```json
{
  "method": "GET",
  "url": "https://api.retailperformerai.com/api/manager/store-kpi-overview",
  "authentication": "genericCredentialType",
  "genericAuthType": "httpHeaderAuth",
  "sendHeaders": true,
  "headerParameters": {
    "parameters": [
      {
        "name": "Authorization",
        "value": "Bearer {{$json.token}}"
      }
    ]
  },
  "sendQuery": true,
  "queryParameters": {
    "parameters": [
      {
        "name": "date",
        "value": "={{$json.date}}"
      }
    ]
  },
  "options": {}
}
```

---

## ⚠️ Routes Dépréciées

Les routes suivantes sont **dépréciées** mais conservées pour compatibilité :

- `/api/integrations/v1/kpi/sync` → Utiliser `/api/integrations/kpi/sync` (endpoint officiel)

## ❌ Routes Non Disponibles

Les routes suivantes sont **absentes du runtime** et ne sont **pas disponibles** :

- ❌ `GET /api/integrations/my-stores` - **Non disponible**
- ❌ `GET /api/integrations/my-stats` - **Non disponible**
- ❌ `POST /api/integrations/stores` - **Non disponible**
- ❌ `POST /api/integrations/stores/{store_id}/managers` - **Non disponible**
- ❌ `POST /api/integrations/stores/{store_id}/sellers` - **Non disponible**
- ❌ `PUT /api/integrations/users/{user_id}` - **Non disponible**

**Alternatives** :
- Pour créer des magasins : Utilisez `POST /api/stores/` avec Bearer Token (voir [GUIDE_API_STORES.md](./GUIDE_API_STORES.md))
- Pour lister les magasins : Utilisez `GET /api/stores/my-stores` avec Bearer Token (voir [GUIDE_API_STORES.md](./GUIDE_API_STORES.md))

---

## 🔍 Endpoint de Debug

Pour lister toutes les routes au runtime (non inclus dans OpenAPI) :

```bash
curl -X GET "https://api.retailperformerai.com/_debug/routes"
```

> ⚠️ **Note**: Cet endpoint peut nécessiter une authentification en production.

---

## 📚 Documentation Complète

- [Guide d'Intégration API](./API_INTEGRATION_GUIDE.md) - Intégration système (API Key)
- [Guide API Stores](./GUIDE_API_STORES.md) - Gestion des magasins (JWT)
- [Guide API Manager](./GUIDE_API_MANAGER.md) - Endpoints Manager (JWT)
- [Guide API Seller](./GUIDE_API_SELLER.md) - Endpoints Seller (JWT)
- [Documentation Enterprise](./ENTERPRISE_API_DOCUMENTATION.md) - API Enterprise

