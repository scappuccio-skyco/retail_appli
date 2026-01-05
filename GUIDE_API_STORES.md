# 📘 Guide API - Boutiques (Stores)

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

### 1. POST /api/stores/ — Créer un magasin

**Description** : Crée un nouveau magasin. Réservé aux **gérants** uniquement.

**Endpoint** :
```
POST https://api.retailperformerai.com/api/stores/
```

**Headers** :
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Body** :
```json
{
  "name": "Skyco Marseille",
  "location": "13001 Marseille",
  "address": "12 Rue de la République",
  "phone": "+33 4 91 00 00 00"
}
```

**Champs** :
- `name` (string, requis) : Nom du magasin
- `location` (string, requis) : Localisation (ex: "13001 Marseille")
- `address` (string, optionnel) : Adresse complète
- `phone` (string, optionnel) : Numéro de téléphone
- `opening_hours` (string, optionnel) : Horaires d'ouverture

**Réponse (201 Created)** :
```json
{
  "id": "c2dd1ada-d0a2-4a90-be81-644b7cb78bc7",
  "name": "Skyco Marseille",
  "location": "13001 Marseille",
  "address": "12 Rue de la République",
  "phone": "+33 4 91 00 00 00",
  "gerant_id": "gerant-uuid-here",
  "active": true,
  "created_at": "2025-01-15T10:30:00Z",
  "updated_at": "2025-01-15T10:30:00Z"
}
```

**Codes de réponse** :
- `201` : Magasin créé avec succès
- `401` : Non authentifié (token invalide ou expiré)
- `403` : Accès refusé (rôle insuffisant - gérant requis)
- `422` : Erreur de validation (champs manquants ou invalides)

---

### 2. GET /api/stores/my-stores — Lister les magasins du gérant

**Description** : Récupère la liste de tous les magasins du gérant authentifié.

**Endpoint** :
```
GET https://api.retailperformerai.com/api/stores/my-stores
```

**Headers** :
```
Authorization: Bearer <token>
```

**Réponse (200 OK)** :
```json
[
  {
    "id": "c2dd1ada-d0a2-4a90-be81-644b7cb78bc7",
    "name": "Skyco Marseille",
    "location": "13001 Marseille",
    "address": "12 Rue de la République",
    "phone": "+33 4 91 00 00 00",
    "gerant_id": "gerant-uuid-here",
    "active": true,
    "created_at": "2025-01-15T10:30:00Z"
  },
  {
    "id": "another-store-uuid",
    "name": "Skyco Lyon",
    "location": "69003 Lyon",
    "active": true,
    "created_at": "2025-01-10T08:00:00Z"
  }
]
```

**Codes de réponse** :
- `200` : Liste des magasins
- `401` : Non authentifié
- `403` : Accès refusé (gérant requis)

---

### 3. GET /api/stores/{store_id}/info — Informations d'un magasin

**Description** : Récupère les informations détaillées d'un magasin spécifique. Accessible par :
- Le gérant propriétaire du magasin
- Le manager assigné au magasin
- Le vendeur assigné au magasin (informations limitées)

**Endpoint** :
```
GET https://api.retailperformerai.com/api/stores/{store_id}/info
```

**Path Parameters** :
- `store_id` (string, requis) : ID du magasin

**Headers** :
```
Authorization: Bearer <token>
```

**Réponse (200 OK)** :

Pour gérant/manager :
```json
{
  "id": "c2dd1ada-d0a2-4a90-be81-644b7cb78bc7",
  "name": "Skyco Marseille",
  "location": "13001 Marseille",
  "address": "12 Rue de la République",
  "phone": "+33 4 91 00 00 00",
  "opening_hours": "9h-19h",
  "gerant_id": "gerant-uuid-here",
  "active": true,
  "created_at": "2025-01-15T10:30:00Z",
  "updated_at": "2025-01-15T10:30:00Z"
}
```

Pour vendeur (informations limitées) :
```json
{
  "id": "c2dd1ada-d0a2-4a90-be81-644b7cb78bc7",
  "name": "Skyco Marseille",
  "location": "13001 Marseille"
}
```

**Codes de réponse** :
- `200` : Informations du magasin
- `401` : Non authentifié
- `403` : Accès refusé (magasin non accessible)
- `404` : Magasin non trouvé

---

## ⚠️ Endpoint Déprécié

**Ancien endpoint déprécié** :
- `POST /api/integrations/stores` → **Utiliser** `POST /api/stores/`

---

## 💻 Exemples d'Utilisation

### cURL

**Créer un magasin** :
```bash
curl -X POST https://api.retailperformerai.com/api/stores/ \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Skyco Marseille",
    "location": "13001 Marseille",
    "address": "12 Rue de la République",
    "phone": "+33 4 91 00 00 00"
  }'
```

**Lister les magasins** :
```bash
curl -X GET https://api.retailperformerai.com/api/stores/my-stores \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Récupérer les informations d'un magasin** :
```bash
curl -X GET https://api.retailperformerai.com/api/stores/c2dd1ada-d0a2-4a90-be81-644b7cb78bc7/info \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### Postman

**Collection Configuration** :
1. Créez une collection "Retail Performer AI - Stores"
2. Ajoutez une variable d'environnement `baseUrl` = `https://api.retailperformerai.com`
3. Configurez l'authentification au niveau de la collection :
   - Type : Bearer Token
   - Token : `{{token}}` (variable d'environnement)

**Requête : Créer un magasin** :
- Method : `POST`
- URL : `{{baseUrl}}/api/stores/`
- Headers :
  - `Content-Type: application/json`
- Body (raw JSON) :
  ```json
  {
    "name": "Skyco Marseille",
    "location": "13001 Marseille",
    "address": "12 Rue de la République",
    "phone": "+33 4 91 00 00 00"
  }
  ```

**Requête : Lister les magasins** :
- Method : `GET`
- URL : `{{baseUrl}}/api/stores/my-stores`

**Requête : Informations d'un magasin** :
- Method : `GET`
- URL : `{{baseUrl}}/api/stores/{{store_id}}/info`
- Variables : `store_id` (dans l'URL)

---

### n8n (HTTP Request)

**Node Configuration : Créer un magasin** :
- Method : `POST`
- URL : `https://api.retailperformerai.com/api/stores/`
- Authentication : Generic Credential Type
  - Name : `Authorization`
  - Value : `Bearer {{$json.token}}`
- Headers :
  - `Content-Type`: `application/json`
- Body (JSON) :
  ```json
  {
    "name": "{{$json.store_name}}",
    "location": "{{$json.location}}",
    "address": "{{$json.address}}",
    "phone": "{{$json.phone}}"
  }
  ```

**Node Configuration : Lister les magasins** :
- Method : `GET`
- URL : `https://api.retailperformerai.com/api/stores/my-stores`
- Authentication : Generic Credential Type
  - Name : `Authorization`
  - Value : `Bearer {{$json.token}}`

**Node Configuration : Informations d'un magasin** :
- Method : `GET`
- URL : `https://api.retailperformerai.com/api/stores/{{$json.store_id}}/info`
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

