# 📚 Documentation API - Retail Performer AI

> **💡 Note importante** : Cette documentation couvre les endpoints avec **authentification JWT** (pour l'interface web).
> 
> **Pour l'intégration de systèmes externes** (ERP, caisse, etc.) avec **authentification par API Key**, consultez :
> - 📘 **[API_INTEGRATION_GUIDE.md](./API_INTEGRATION_GUIDE.md)** - Intégration complète (KPI + gestion utilisateurs)
> - 🏢 **[ENTERPRISE_API_DOCUMENTATION.md](./ENTERPRISE_API_DOCUMENTATION.md)** - API Enterprise (grandes entreprises)

---

## 🔐 Authentification

Tous les endpoints (sauf `/auth/login`, `/auth/register`, `/auth/forgot-password`) nécessitent un token JWT dans le header :

```
Authorization: Bearer <votre_token>
```

---

## 👥 GESTION DES UTILISATEURS

### 1. 🏪 CRÉER UN MAGASIN (Gérant uniquement)

**Endpoint :** `POST /api/gerant/stores`

**Headers :**
```json
{
  "Authorization": "Bearer <token>",
  "Content-Type": "application/json"
}
```

**Body :**
```json
{
  "name": "Boutique Paris Centre",
  "location": "75001 Paris",
  "address": "123 Rue de Rivoli",
  "phone": "0123456789",
  "opening_hours": "9h-19h du lundi au samedi"
}
```

**Réponse (200) :**
```json
{
  "id": "store_abc123",
  "name": "Boutique Paris Centre",
  "location": "75001 Paris",
  "gerant_id": "gerant_xyz",
  "address": "123 Rue de Rivoli",
  "phone": "0123456789",
  "opening_hours": "9h-19h du lundi au samedi",
  "active": true
}
```

---

### 2. 👔 INVITER UN MANAGER (Gérant uniquement)

**Endpoint :** `POST /api/gerant/invitations`

**Body :**
```json
{
  "email": "manager@example.com",
  "name": "Jean Dupont",
  "role": "manager",
  "store_id": "store_abc123"
}
```

**Réponse (200) :**
```json
{
  "id": "invite_xyz789",
  "email": "manager@example.com",
  "name": "Jean Dupont",
  "role": "manager",
  "store_id": "store_abc123",
  "status": "pending",
  "invitation_token": "long_secure_token",
  "created_at": "2025-12-04T10:00:00Z"
}
```

**Notes :**
- Un email d'invitation est automatiquement envoyé
- Le lien d'invitation est valable pour inscription
- Le manager sera automatiquement assigné au magasin spécifié

---

### 3. 👤 INVITER UN VENDEUR (Gérant uniquement)

**Endpoint :** `POST /api/gerant/invitations`

**Body :**
```json
{
  "email": "vendeur@example.com",
  "name": "Marie Martin",
  "role": "seller",
  "store_id": "store_abc123",
  "manager_id": "manager_id_123"
}
```

**Options pour `manager_id` :**
- `"manager_id_actif"` - Manager déjà inscrit
- `"pending_invite_id"` - Manager invité mais pas encore inscrit
- `null` ou absent - Sera assigné plus tard

**Réponse (200) :**
```json
{
  "id": "invite_seller_456",
  "email": "vendeur@example.com",
  "name": "Marie Martin",
  "role": "seller",
  "store_id": "store_abc123",
  "manager_id": "manager_id_123",
  "status": "pending",
  "invitation_token": "long_secure_token",
  "created_at": "2025-12-04T10:00:00Z"
}
```

**Vérifications automatiques :**
- ✅ Quota de vendeurs (selon abonnement Stripe)
- ✅ Email unique (pas de doublon)
- ✅ Magasin appartient au gérant
- ✅ Manager existe dans le magasin (si spécifié)

---

## 📋 LISTE DES ENDPOINTS DISPONIBLES

### 🏪 MAGASINS (Gérant)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/api/gerant/stores` | Créer un magasin |
| GET | `/api/gerant/stores` | Liste des magasins |
| GET | `/api/gerant/stores/{store_id}` | Détails d'un magasin |
| PUT | `/api/gerant/stores/{store_id}` | Modifier un magasin |
| DELETE | `/api/gerant/stores/{store_id}` | Supprimer un magasin |
| POST | `/api/gerant/stores/{store_id}/assign-manager` | Assigner un manager |

### 👥 INVITATIONS (Gérant)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/api/gerant/invitations` | Inviter manager ou vendeur |
| GET | `/api/gerant/invitations` | Liste des invitations |
| DELETE | `/api/gerant/invitations/{invite_id}` | Annuler une invitation |

### 🔄 TRANSFERT (Gérant)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/api/gerant/managers/{manager_id}/transfer` | Transférer un manager |
| POST | `/api/gerant/sellers/{seller_id}/transfer` | Transférer un vendeur |

### 👤 UTILISATEURS (Gérant)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/gerant/managers` | Liste des managers |
| GET | `/api/gerant/sellers` | Liste des vendeurs |
| DELETE | `/api/gerant/users/{user_id}` | Supprimer un utilisateur |

---

## 🔑 AUTHENTIFICATION & SÉCURITÉ

### Login
```bash
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "password123"
}
```

### Mot de passe oublié
```bash
POST /api/auth/forgot-password
{
  "email": "user@example.com"
}
```

### Réinitialiser mot de passe
```bash
POST /api/auth/reset-password
{
  "token": "reset_token_from_email",
  "new_password": "NewPassword123!"
}
```

---

## 📊 EXEMPLES COMPLETS

### Exemple 1 : Créer un magasin et inviter une équipe

```bash
# 1. Login en tant que Gérant
TOKEN=$(curl -s -X POST "https://your-domain.com/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"gerant@example.com","password":"password"}' | jq -r '.token')

# 2. Créer un magasin
STORE_ID=$(curl -s -X POST "https://your-domain.com/api/gerant/stores" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Boutique Lyon",
    "location": "69001 Lyon",
    "address": "1 Place Bellecour",
    "phone": "0478123456",
    "opening_hours": "10h-19h"
  }' | jq -r '.id')

# 3. Inviter un manager
MANAGER_INVITE=$(curl -s -X POST "https://your-domain.com/api/gerant/invitations" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"manager@example.com\",
    \"name\": \"Pierre Durand\",
    \"role\": \"manager\",
    \"store_id\": \"$STORE_ID\"
  }")

# 4. Inviter un vendeur
curl -X POST "https://your-domain.com/api/gerant/invitations" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"vendeur@example.com\",
    \"name\": \"Sophie Martin\",
    \"role\": \"seller\",
    \"store_id\": \"$STORE_ID\"
  }"
```

### Exemple 2 : Python avec requests

```python
import requests

BASE_URL = "https://your-domain.com/api"

# 1. Login
response = requests.post(f"{BASE_URL}/auth/login", json={
    "email": "gerant@example.com",
    "password": "password"
})
token = response.json()["token"]

headers = {
    "Authorization": f"Bearer {token}",
    "Content-Type": "application/json"
}

# 2. Créer un magasin
store_data = {
    "name": "Boutique Test",
    "location": "75001 Paris",
    "address": "123 Rue Test",
    "phone": "0123456789",
    "opening_hours": "9h-19h"
}
store = requests.post(f"{BASE_URL}/gerant/stores", json=store_data, headers=headers).json()
store_id = store["id"]

# 3. Inviter un manager
invite_data = {
    "email": "manager@test.com",
    "name": "Manager Test",
    "role": "manager",
    "store_id": store_id
}
invitation = requests.post(f"{BASE_URL}/gerant/invitations", json=invite_data, headers=headers).json()
print(f"Invitation envoyée à {invitation['email']}")
```

---

## ⚠️ ERREURS COURANTES

| Code | Erreur | Solution |
|------|--------|----------|
| 401 | Unauthorized | Vérifier le token JWT |
| 403 | Forbidden | Vérifier les permissions du rôle |
| 400 | Email déjà utilisé | Utiliser un autre email |
| 400 | Quota dépassé | Upgrader l'abonnement Stripe |
| 404 | Store not found | Vérifier l'ID du magasin |

---

## 🔗 LIENS UTILES

- **Base URL Production :** `https://dashboardfix.preview.emergentagent.com/api`
- **Documentation Postman :** À venir
- **Webhook Stripe :** `/api/stripe/webhook`

---

**Dernière mise à jour :** 4 décembre 2025
