# 🏢 Documentation API Enterprise - Retail Performer

## Vue d'ensemble

Cette API permet aux grandes entreprises d'intégrer Retail Performer avec leurs systèmes ERP/SAP via un provisionnement automatique des utilisateurs et magasins.

**Deux modes de synchronisation :**
- **API REST** : Import en masse via endpoints HTTP (recommandé pour démarrer)
- **SCIM 2.0** : Synchronisation automatique avec Azure AD, Okta, SAP (Phase 3)

---

## 🚀 Démarrage rapide

### 1. Créer un compte IT Admin

**Deux options :**

#### A. Inscription self-service
```bash
POST /api/enterprise/register
Content-Type: application/json

{
  "company_name": "Acme Corp",
  "company_email": "it@acme.com",
  "sync_mode": "api",
  "it_admin_name": "Jean Dupont",
  "it_admin_email": "jean.dupont@acme.com",
  "it_admin_password": "SecurePassword123!"
}
```

#### B. Création par Super Admin
Contactez notre équipe support pour créer votre compte entreprise.

### 2. Se connecter

```bash
POST /api/auth/login
Content-Type: application/json

{
  "email": "jean.dupont@acme.com",
  "password": "SecurePassword123!"
}
```

**Réponse :**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "abc123",
    "name": "Jean Dupont",
    "email": "jean.dupont@acme.com",
    "role": "it_admin",
    "enterprise_account_id": "ent-xyz789"
  }
}
```

### 3. Générer une clé API

```bash
POST /api/enterprise/api-keys/generate
Authorization: Bearer {votre_token_jwt}
Content-Type: application/json

{
  "name": "SAP Production Key",
  "scopes": ["users:read", "users:write", "stores:read", "stores:write"],
  "expires_in_days": 365
}
```

**Réponse :**
```json
{
  "id": "key-abc123",
  "key": "ent_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "name": "SAP Production Key",
  "scopes": ["users:read", "users:write", "stores:read", "stores:write"],
  "created_at": "2025-12-10T10:00:00Z",
  "expires_at": "2026-12-10T10:00:00Z",
  "warning": "⚠️ Sauvegardez cette clé maintenant, elle ne sera plus affichée"
}
```

⚠️ **IMPORTANT** : Copiez et stockez cette clé de manière sécurisée. Elle ne sera plus jamais affichée.

---

## 📊 Import en masse (Bulk Import)

### Import d'utilisateurs

```bash
POST /api/enterprise/users/bulk-import
X-API-Key: ent_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Content-Type: application/json

{
  "mode": "create_or_update",
  "send_invitations": false,
  "users": [
    {
      "email": "manager1@acme.com",
      "name": "Marie Martin",
      "role": "manager",
      "store_id": "store-123",
      "external_id": "SAP-USER-001"
    },
    {
      "email": "seller1@acme.com",
      "name": "Thomas Dubois",
      "role": "seller",
      "store_id": "store-123",
      "manager_id": "manager-uuid",
      "external_id": "SAP-USER-002"
    }
  ]
}
```

**Paramètres :**
- `mode` : 
  - `"create_only"` : Créer uniquement (erreur si existe)
  - `"update_only"` : Mettre à jour uniquement (erreur si n'existe pas)
  - `"create_or_update"` : Créer si n'existe pas, sinon mettre à jour
- `send_invitations` : Envoyer des emails d'invitation (non implémenté)
- `users` : Liste des utilisateurs à importer

**Réponse :**
```json
{
  "success": true,
  "total_processed": 2,
  "created": 2,
  "updated": 0,
  "failed": 0,
  "errors": []
}
```

### Import de magasins

```bash
POST /api/enterprise/stores/bulk-import
X-API-Key: ent_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Content-Type: application/json

{
  "mode": "create_or_update",
  "stores": [
    {
      "name": "Acme Paris Centre",
      "location": "75001 Paris",
      "external_id": "SAP-STORE-001",
      "address": "123 Rue de Rivoli",
      "phone": "+33123456789"
    },
    {
      "name": "Acme Lyon Bellecour",
      "location": "69002 Lyon",
      "external_id": "SAP-STORE-002",
      "address": "45 Place Bellecour",
      "phone": "+33423456789"
    }
  ]
}
```

**Réponse :**
```json
{
  "success": true,
  "total_processed": 2,
  "created": 2,
  "updated": 0,
  "failed": 0,
  "errors": []
}
```

---

## 📈 Monitoring & Statut

### Obtenir le statut de synchronisation

```bash
GET /api/enterprise/sync-status
Authorization: Bearer {votre_token_jwt}
```

**Réponse :**
```json
{
  "enterprise_account_id": "ent-xyz789",
  "company_name": "Acme Corp",
  "sync_mode": "api",
  "total_users": 245,
  "total_stores": 12,
  "active_users": 238,
  "last_sync_at": "2025-12-10T14:30:00Z",
  "last_sync_status": "success",
  "scim_enabled": false,
  "recent_logs": [
    {
      "id": "log-abc123",
      "operation": "bulk_user_import",
      "status": "success",
      "timestamp": "2025-12-10T14:30:00Z",
      "details": {
        "total_processed": 50,
        "created": 5,
        "updated": 45
      }
    }
  ]
}
```

### Consulter les logs de synchronisation

```bash
GET /api/enterprise/sync-logs?limit=100&status=success
Authorization: Bearer {votre_token_jwt}
```

**Paramètres optionnels :**
- `limit` : Nombre de logs (défaut: 50, max: 100)
- `operation` : Filtrer par type d'opération (`user_created`, `user_updated`, `bulk_user_import`, etc.)
- `status` : Filtrer par statut (`success`, `failed`, `partial`)

---

## 🔐 Gestion des clés API

### Lister les clés API

```bash
GET /api/enterprise/api-keys
Authorization: Bearer {votre_token_jwt}
```

**Réponse :**
```json
{
  "api_keys": [
    {
      "id": "key-abc123",
      "key_preview": "ent_***abc123",
      "name": "SAP Production Key",
      "scopes": ["users:read", "users:write", "stores:read", "stores:write"],
      "is_active": true,
      "created_at": "2025-12-10T10:00:00Z",
      "last_used_at": "2025-12-10T14:30:00Z",
      "request_count": 1234,
      "expires_at": "2026-12-10T10:00:00Z"
    }
  ]
}
```

### Révoquer une clé API

```bash
DELETE /api/enterprise/api-keys/{key_id}
Authorization: Bearer {votre_token_jwt}
```

---

## 🔒 Sécurité & Limites

### Rate Limiting
- **100 requêtes par minute** par clé API
- Au-delà, l'API retourne une erreur `429 Too Many Requests`

### Authentification
- **IT Admin** : Token JWT (via `/api/auth/login`)
- **API REST** : Clé API (header `X-API-Key`)

### Scopes (Permissions)
- `users:read` : Lire les utilisateurs
- `users:write` : Créer/modifier/supprimer des utilisateurs
- `stores:read` : Lire les magasins
- `stores:write` : Créer/modifier des magasins

### Meilleures pratiques
1. **Rotation des clés** : Régénérer les clés API tous les 6-12 mois
2. **Stockage sécurisé** : Ne jamais commiter les clés dans Git
3. **Surveillance** : Monitorer les logs de synchronisation régulièrement
4. **Test avant production** : Utiliser `mode: "create_only"` pour tester sans impacter les données existantes

---

## 🧪 Exemples d'intégration

### Python

```python
import requests
import json

API_BASE_URL = "https://your-domain.com"
API_KEY = "ent_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

def bulk_import_users(users_data):
    """Import en masse d'utilisateurs"""
    url = f"{API_BASE_URL}/api/enterprise/users/bulk-import"
    headers = {
        "X-API-Key": API_KEY,
        "Content-Type": "application/json"
    }
    
    payload = {
        "mode": "create_or_update",
        "send_invitations": False,
        "users": users_data
    }
    
    response = requests.post(url, headers=headers, json=payload)
    
    if response.status_code == 200:
        result = response.json()
        print(f"✅ Success: {result['created']} created, {result['updated']} updated")
        if result['failed'] > 0:
            print(f"⚠️  {result['failed']} failed:")
            for error in result['errors']:
                print(f"  - {error['email']}: {error['error']}")
    else:
        print(f"❌ Error {response.status_code}: {response.text}")
    
    return response.json()

# Exemple d'utilisation
users = [
    {
        "email": "manager1@acme.com",
        "name": "Marie Martin",
        "role": "manager",
        "store_id": "store-123",
        "external_id": "SAP-001"
    }
]

result = bulk_import_users(users)
```

### Node.js

```javascript
const axios = require('axios');

const API_BASE_URL = 'https://your-domain.com';
const API_KEY = 'ent_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';

async function bulkImportUsers(usersData) {
    try {
        const response = await axios.post(
            `${API_BASE_URL}/api/enterprise/users/bulk-import`,
            {
                mode: 'create_or_update',
                send_invitations: false,
                users: usersData
            },
            {
                headers: {
                    'X-API-Key': API_KEY,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        const result = response.data;
        console.log(`✅ Success: ${result.created} created, ${result.updated} updated`);
        
        if (result.failed > 0) {
            console.log(`⚠️  ${result.failed} failed:`);
            result.errors.forEach(error => {
                console.log(`  - ${error.email}: ${error.error}`);
            });
        }
        
        return result;
    } catch (error) {
        console.error('❌ Error:', error.response?.data || error.message);
        throw error;
    }
}

// Exemple d'utilisation
const users = [
    {
        email: 'manager1@acme.com',
        name: 'Marie Martin',
        role: 'manager',
        store_id: 'store-123',
        external_id: 'SAP-001'
    }
];

bulkImportUsers(users);
```

---

## ❓ FAQ

### Comment gérer les mots de passe des utilisateurs importés ?
Les utilisateurs créés via l'API reçoivent un mot de passe temporaire. Pour activer leur compte, ils doivent utiliser la fonction "Mot de passe oublié" pour définir leur propre mot de passe.

### Puis-je modifier un utilisateur créé en mode manuel ?
Oui, mais une fois qu'un utilisateur a `sync_mode: "api_sync"`, il ne peut plus être modifié via l'interface manuelle. Toutes les modifications doivent passer par l'API.

### Que se passe-t-il si j'importe un utilisateur qui existe déjà ?
Avec `mode: "create_or_update"`, l'utilisateur existant sera mis à jour. Avec `mode: "create_only"`, une erreur sera retournée.

### Comment supprimer un utilisateur ?
Pour "supprimer" un utilisateur synchronisé, changez son statut à `"inactive"` dans votre ERP. Lors de la prochaine synchronisation, l'utilisateur sera désactivé dans Retail Performer.

---

## 📞 Support

Pour toute question ou assistance :
- Email : support@retailperformer.com
- Documentation : https://docs.retailperformer.com
- Status API : https://status.retailperformer.com

---

**Version** : 1.0.0  
**Dernière mise à jour** : Décembre 2025
