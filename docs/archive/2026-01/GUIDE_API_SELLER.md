# 📘 Guide API - Vendeur (Seller)

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

### 1. GET /api/seller/subscription-status — Statut d'abonnement

**Description** : Vérifie si le gérant du vendeur a un abonnement actif. Retourne `isReadOnly: true` si l'essai a expiré.

**Endpoint** :
```
GET https://api.retailperformerai.com/api/seller/subscription-status
```

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
  "message": "Essai gratuit - 12 jours restants",
  "daysLeft": 12
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
- `403` : Accès refusé (rôle insuffisant - vendeur requis)

---

### 2. GET /api/seller/kpi-enabled — Vérifier si les KPI sont activés

**Description** : Vérifie si la saisie de KPI est activée pour le vendeur. Utilisé pour déterminer si les vendeurs peuvent saisir leurs propres KPI ou si c'est le manager qui le fait.

**Endpoint** :
```
GET https://api.retailperformerai.com/api/seller/kpi-enabled
```

**Query Parameters** :
- `store_id` (string, optionnel) : ID du magasin

**Headers** :
```
Authorization: Bearer <token>
```

**Réponse (200 OK)** :
```json
{
  "enabled": true,
  "seller_input_kpis": [
    "ca_journalier",
    "nb_ventes",
    "nb_clients",
    "nb_articles",
    "nb_prospects"
  ]
}
```

**Codes de réponse** :
- `200` : Statut d'activation KPI
- `401` : Non authentifié
- `403` : Accès refusé

---

### 3. GET /api/seller/tasks — Tâches du vendeur

**Description** : Récupère toutes les tâches en attente pour le vendeur actuel.
- Statut de complétion du diagnostic
- Demandes en attente du manager

**Endpoint** :
```
GET https://api.retailperformerai.com/api/seller/tasks
```

**Headers** :
```
Authorization: Bearer <token>
```

**Réponse (200 OK)** :
```json
[
  {
    "type": "diagnostic",
    "status": "pending",
    "message": "Complétez votre diagnostic DISC"
  },
  {
    "type": "manager_request",
    "status": "pending",
    "message": "Répondez à la demande de votre manager"
  }
]
```

**Codes de réponse** :
- `200` : Liste des tâches
- `401` : Non authentifié
- `403` : Accès refusé
- `500` : Erreur serveur

---

### 4. GET /api/seller/objectives/active — Objectifs actifs

**Description** : Récupère les objectifs d'équipe actifs pour l'affichage dans le dashboard vendeur. Retourne uniquement les objectifs qui sont :
- Dans la période actuelle (period_end >= aujourd'hui)
- Visibles pour ce vendeur (individuels ou collectifs avec règles de visibilité)

**Endpoint** :
```
GET https://api.retailperformerai.com/api/seller/objectives/active
```

**Headers** :
```
Authorization: Bearer <token>
```

**Réponse (200 OK)** :
```json
[
  {
    "id": "objective-uuid",
    "title": "Atteindre 15 000€ de CA mensuel",
    "target": 15000,
    "current": 12500,
    "progress": 83.33,
    "period_start": "2025-01-01",
    "period_end": "2025-01-31",
    "type": "individual"
  },
  {
    "id": "objective-uuid-2",
    "title": "Taux de transformation > 80%",
    "target": 80,
    "current": 75,
    "progress": 93.75,
    "period_start": "2025-01-01",
    "period_end": "2025-01-31",
    "type": "collective"
  }
]
```

**Codes de réponse** :
- `200` : Liste des objectifs actifs
- `401` : Non authentifié
- `403` : Accès refusé
- `500` : Erreur serveur

---

### 5. GET /api/seller/objectives/all — Tous les objectifs

**Description** : Récupère tous les objectifs d'équipe (actifs et inactifs) pour le vendeur. Retourne les objectifs séparés en :
- `active` : objectifs avec period_end > aujourd'hui
- `inactive` : objectifs avec period_end <= aujourd'hui

**Endpoint** :
```
GET https://api.retailperformerai.com/api/seller/objectives/all
```

**Headers** :
```
Authorization: Bearer <token>
```

**Réponse (200 OK)** :
```json
{
  "active": [
    {
      "id": "objective-uuid",
      "title": "Atteindre 15 000€ de CA mensuel",
      "target": 15000,
      "current": 12500,
      "progress": 83.33,
      "period_start": "2025-01-01",
      "period_end": "2025-01-31",
      "type": "individual"
    }
  ],
  "inactive": [
    {
      "id": "objective-uuid-old",
      "title": "Atteindre 12 000€ de CA (Décembre)",
      "target": 12000,
      "current": 11800,
      "progress": 98.33,
      "period_start": "2024-12-01",
      "period_end": "2024-12-31",
      "type": "individual",
      "completed": true
    }
  ]
}
```

**Codes de réponse** :
- `200` : Objectifs actifs et inactifs
- `401` : Non authentifié
- `403` : Accès refusé
- `500` : Erreur serveur

---

## 💻 Exemples d'Utilisation

### cURL

**Statut d'abonnement** :
```bash
curl -X GET https://api.retailperformerai.com/api/seller/subscription-status \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Vérifier si les KPI sont activés** :
```bash
curl -X GET "https://api.retailperformerai.com/api/seller/kpi-enabled?store_id=c2dd1ada-d0a2-4a90-be81-644b7cb78bc7" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Récupérer les tâches** :
```bash
curl -X GET https://api.retailperformerai.com/api/seller/tasks \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Objectifs actifs** :
```bash
curl -X GET https://api.retailperformerai.com/api/seller/objectives/active \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Tous les objectifs** :
```bash
curl -X GET https://api.retailperformerai.com/api/seller/objectives/all \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### Postman

**Collection Configuration** :
1. Créez une collection "Retail Performer AI - Seller"
2. Ajoutez une variable d'environnement `baseUrl` = `https://api.retailperformerai.com`
3. Configurez l'authentification au niveau de la collection :
   - Type : Bearer Token
   - Token : `{{token}}` (variable d'environnement)

**Requête : Statut d'abonnement** :
- Method : `GET`
- URL : `{{baseUrl}}/api/seller/subscription-status`

**Requête : KPI activés** :
- Method : `GET`
- URL : `{{baseUrl}}/api/seller/kpi-enabled`
- Query Params :
  - `store_id` : `{{store_id}}` (optionnel)

**Requête : Tâches** :
- Method : `GET`
- URL : `{{baseUrl}}/api/seller/tasks`

**Requête : Objectifs actifs** :
- Method : `GET`
- URL : `{{baseUrl}}/api/seller/objectives/active`

**Requête : Tous les objectifs** :
- Method : `GET`
- URL : `{{baseUrl}}/api/seller/objectives/all`

---

### n8n (HTTP Request)

**Node Configuration : Statut d'abonnement** :
- Method : `GET`
- URL : `https://api.retailperformerai.com/api/seller/subscription-status`
- Authentication : Generic Credential Type
  - Name : `Authorization`
  - Value : `Bearer {{$json.token}}`

**Node Configuration : KPI activés** :
- Method : `GET`
- URL : `https://api.retailperformerai.com/api/seller/kpi-enabled`
- Query Parameters :
  - `store_id` : `{{$json.store_id}}` (optionnel)
- Authentication : Generic Credential Type
  - Name : `Authorization`
  - Value : `Bearer {{$json.token}}`

**Node Configuration : Tâches** :
- Method : `GET`
- URL : `https://api.retailperformerai.com/api/seller/tasks`
- Authentication : Generic Credential Type
  - Name : `Authorization`
  - Value : `Bearer {{$json.token}}`

**Node Configuration : Objectifs actifs** :
- Method : `GET`
- URL : `https://api.retailperformerai.com/api/seller/objectives/active`
- Authentication : Generic Credential Type
  - Name : `Authorization`
  - Value : `Bearer {{$json.token}}`

**Node Configuration : Tous les objectifs** :
- Method : `GET`
- URL : `https://api.retailperformerai.com/api/seller/objectives/all`
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

