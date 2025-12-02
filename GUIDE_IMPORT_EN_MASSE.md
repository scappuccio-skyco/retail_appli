# 📦 Guide d'import en masse - Utilisateurs & Magasins

## Prérequis

1. Un compte IT Admin actif
2. Une clé API générée depuis le dashboard

---

## 🔑 Étape 1 : Obtenir votre clé API

### Via le Dashboard (Recommandé)

1. Connectez-vous : `http://localhost:3000/login`
   - Email : `admin@demo-enterprise.com`
   - Mot de passe : `DemoPassword123!`

2. Allez sur l'onglet **"Clés API"**

3. Cliquez sur **"Générer une clé"**

4. Remplissez le formulaire :
   - **Nom** : "Import Production"
   - **Expiration** : 365 jours
   - **Permissions** : Cochez toutes les cases
     - ✅ users:read
     - ✅ users:write
     - ✅ stores:read
     - ✅ stores:write

5. Cliquez sur **"Générer la clé"**

6. **IMPORTANT** : Copiez la clé affichée (elle ne sera plus jamais visible)
   - Format : `ent_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

### Via l'API (Alternative)

```bash
# 1. Login pour obtenir le token JWT
TOKEN=$(curl -s -X POST http://localhost:8001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@demo-enterprise.com",
    "password": "DemoPassword123!"
  }' | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")

# 2. Générer une clé API
curl -X POST http://localhost:8001/api/enterprise/api-keys/generate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Import Production",
    "scopes": ["users:read", "users:write", "stores:read", "stores:write"],
    "expires_in_days": 365
  }'
```

---

## 🏢 Étape 2 : Importer des magasins

Les magasins doivent être créés **avant** les utilisateurs (pour pouvoir assigner les utilisateurs à un magasin).

### Format JSON

```json
{
  "mode": "create_or_update",
  "stores": [
    {
      "name": "Magasin Paris Centre",
      "location": "75001 Paris",
      "external_id": "SAP-STORE-001",
      "address": "123 Rue de Rivoli",
      "phone": "+33123456789"
    },
    {
      "name": "Magasin Lyon Bellecour",
      "location": "69002 Lyon",
      "external_id": "SAP-STORE-002",
      "address": "45 Place Bellecour",
      "phone": "+33423456789"
    },
    {
      "name": "Magasin Marseille Vieux-Port",
      "location": "13001 Marseille",
      "external_id": "SAP-STORE-003",
      "address": "78 Quai du Port"
    }
  ]
}
```

### Commande cURL

```bash
API_KEY="ent_VOTRE_CLE_API_ICI"

curl -X POST http://localhost:8001/api/enterprise/stores/bulk-import \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "create_or_update",
    "stores": [
      {
        "name": "Magasin Paris Centre",
        "location": "75001 Paris",
        "external_id": "SAP-STORE-001",
        "address": "123 Rue de Rivoli",
        "phone": "+33123456789"
      },
      {
        "name": "Magasin Lyon Bellecour",
        "location": "69002 Lyon",
        "external_id": "SAP-STORE-002",
        "address": "45 Place Bellecour",
        "phone": "+33423456789"
      },
      {
        "name": "Magasin Marseille Vieux-Port",
        "location": "13001 Marseille",
        "external_id": "SAP-STORE-003",
        "address": "78 Quai du Port"
      }
    ]
  }'
```

### Réponse attendue

```json
{
  "success": true,
  "total_processed": 3,
  "created": 3,
  "updated": 0,
  "failed": 0,
  "errors": []
}
```

---

## 👥 Étape 3 : Importer des utilisateurs

### Important : Récupérer les IDs des magasins

Avant d'importer les utilisateurs, vous devez connaître les `store_id` des magasins créés.

```bash
# Récupérer la liste des magasins
curl -X GET "http://localhost:8001/api/enterprise/sync-status" \
  -H "Authorization: Bearer $TOKEN"
```

Ou via MongoDB :

```bash
python3 << 'EOF'
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv('/app/backend/.env')
client = AsyncIOMotorClient(os.environ['MONGO_URL'])
db = client[os.environ['DB_NAME']]

async def get_stores():
    stores = await db.stores.find(
        {'enterprise_account_id': 'dfa021bc-37f4-40f6-8e49-7037baab7980'},
        {'_id': 0, 'id': 1, 'name': 1, 'external_id': 1}
    ).to_list(100)
    
    print("\n📍 Magasins disponibles :")
    for store in stores:
        print(f"  - {store['name']}")
        print(f"    ID: {store['id']}")
        print(f"    External ID: {store.get('external_id', 'N/A')}")
        print()

asyncio.run(get_stores())
EOF
```

### Format JSON - Utilisateurs

```json
{
  "mode": "create_or_update",
  "send_invitations": false,
  "users": [
    {
      "email": "manager.paris@demo-enterprise.com",
      "name": "Marie Dupont",
      "role": "manager",
      "store_id": "REMPLACER_PAR_STORE_ID_PARIS",
      "external_id": "SAP-MGR-001"
    },
    {
      "email": "seller1.paris@demo-enterprise.com",
      "name": "Jean Martin",
      "role": "seller",
      "store_id": "REMPLACER_PAR_STORE_ID_PARIS",
      "manager_id": "OPTIONNEL_ID_DU_MANAGER",
      "external_id": "SAP-SELLER-001"
    },
    {
      "email": "seller2.paris@demo-enterprise.com",
      "name": "Sophie Bernard",
      "role": "seller",
      "store_id": "REMPLACER_PAR_STORE_ID_PARIS",
      "external_id": "SAP-SELLER-002"
    }
  ]
}
```

### Commande cURL

```bash
API_KEY="ent_VOTRE_CLE_API_ICI"

curl -X POST http://localhost:8001/api/enterprise/users/bulk-import \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "create_or_update",
    "send_invitations": false,
    "users": [
      {
        "email": "manager.paris@demo-enterprise.com",
        "name": "Marie Dupont",
        "role": "manager",
        "external_id": "SAP-MGR-001"
      },
      {
        "email": "seller1.paris@demo-enterprise.com",
        "name": "Jean Martin",
        "role": "seller",
        "external_id": "SAP-SELLER-001"
      },
      {
        "email": "seller2.paris@demo-enterprise.com",
        "name": "Sophie Bernard",
        "role": "seller",
        "external_id": "SAP-SELLER-002"
      }
    ]
  }'
```

### Réponse attendue

```json
{
  "success": true,
  "total_processed": 3,
  "created": 3,
  "updated": 0,
  "failed": 0,
  "errors": []
}
```

---

## 📊 Étape 4 : Vérifier l'import

### Via le Dashboard IT Admin

1. Allez dans l'onglet **"Vue d'ensemble"**
   - Vérifiez que le compteur "Utilisateurs" a augmenté
   - Vérifiez que le compteur "Magasins" a augmenté

2. Allez dans l'onglet **"Logs de synchronisation"**
   - Vous devriez voir les logs :
     - ✅ `bulk_store_import` - Succès
     - ✅ `bulk_user_import` - Succès

### Via MongoDB

```bash
python3 << 'EOF'
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv('/app/backend/.env')
client = AsyncIOMotorClient(os.environ['MONGO_URL'])
db = client[os.environ['DB_NAME']]

async def verify_import():
    # Compter les magasins
    stores_count = await db.stores.count_documents({
        'enterprise_account_id': 'dfa021bc-37f4-40f6-8e49-7037baab7980'
    })
    
    # Compter les utilisateurs
    users_count = await db.users.count_documents({
        'enterprise_account_id': 'dfa021bc-37f4-40f6-8e49-7037baab7980'
    })
    
    print(f"\n✅ Import vérifié :")
    print(f"  📍 Magasins : {stores_count}")
    print(f"  👥 Utilisateurs : {users_count}")
    
    # Afficher les utilisateurs
    users = await db.users.find(
        {'enterprise_account_id': 'dfa021bc-37f4-40f6-8e49-7037baab7980'},
        {'_id': 0, 'name': 1, 'email': 1, 'role': 1, 'sync_mode': 1}
    ).to_list(100)
    
    print(f"\n👥 Utilisateurs importés :")
    for user in users:
        print(f"  - {user['name']} ({user['role']})")
        print(f"    Email: {user['email']}")
        print(f"    Sync Mode: {user.get('sync_mode', 'N/A')}")
        print()

asyncio.run(verify_import())
EOF
```

---

## 🧪 Étape 5 : Tester la lecture seule des KPI

### Connexion avec un utilisateur importé

**IMPORTANT** : Les utilisateurs importés ont un mot de passe temporaire généré aléatoirement. Ils doivent utiliser "Mot de passe oublié" pour définir leur propre mot de passe.

**Alternative pour les tests** : Modifier le mot de passe en base :

```bash
python3 << 'EOF'
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
import bcrypt

load_dotenv('/app/backend/.env')
client = AsyncIOMotorClient(os.environ['MONGO_URL'])
db = client[os.environ['DB_NAME']]

async def reset_password():
    email = "manager.paris@demo-enterprise.com"
    new_password = "TestPassword123!"
    
    hashed = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt())
    
    result = await db.users.update_one(
        {"email": email},
        {"$set": {"password": hashed.decode('utf-8')}}
    )
    
    if result.modified_count > 0:
        print(f"✅ Mot de passe réinitialisé pour {email}")
        print(f"   Nouveau mot de passe : {new_password}")
    else:
        print(f"❌ Utilisateur {email} non trouvé")

asyncio.run(reset_password())
EOF
```

### Test de la lecture seule

1. Déconnectez-vous du compte IT Admin
2. Connectez-vous avec le manager importé :
   - Email : `manager.paris@demo-enterprise.com`
   - Mot de passe : `TestPassword123!` (après reset)

3. Vérifiez :
   - ✅ Un badge bleu "🔒 Données synchronisées automatiquement" apparaît en haut
   - ✅ Les champs de saisie KPI sont grisés et non modifiables
   - ✅ Le bouton "Enregistrer" est masqué dans les formulaires KPI

---

## 📋 Modes d'import disponibles

### `create_only`
- Crée uniquement les nouveaux éléments
- Échoue si l'élément existe déjà (email pour users, name pour stores)
- Utile pour s'assurer de ne pas écraser des données existantes

### `update_only`
- Met à jour uniquement les éléments existants
- Échoue si l'élément n'existe pas
- Utile pour synchroniser des modifications

### `create_or_update` (Recommandé)
- Crée si n'existe pas, sinon met à jour
- Le plus flexible pour la synchronisation continue

---

## 🔄 Script complet d'import

Voici un script bash complet pour tout importer d'un coup :

```bash
#!/bin/bash

# Configuration
API_KEY="ent_REMPLACER_PAR_VOTRE_CLE"
API_URL="http://localhost:8001"

echo "🚀 Import en masse - Retail Performer"
echo ""

# 1. Import des magasins
echo "📍 Étape 1/3 : Import des magasins..."
STORES_RESPONSE=$(curl -s -X POST "$API_URL/api/enterprise/stores/bulk-import" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "create_or_update",
    "stores": [
      {
        "name": "Magasin Paris Centre",
        "location": "75001 Paris",
        "external_id": "SAP-STORE-001",
        "address": "123 Rue de Rivoli",
        "phone": "+33123456789"
      },
      {
        "name": "Magasin Lyon Bellecour",
        "location": "69002 Lyon",
        "external_id": "SAP-STORE-002",
        "address": "45 Place Bellecour"
      },
      {
        "name": "Magasin Marseille Vieux-Port",
        "location": "13001 Marseille",
        "external_id": "SAP-STORE-003"
      }
    ]
  }')

echo "$STORES_RESPONSE" | python3 -m json.tool
echo ""

# 2. Import des utilisateurs
echo "👥 Étape 2/3 : Import des utilisateurs..."
USERS_RESPONSE=$(curl -s -X POST "$API_URL/api/enterprise/users/bulk-import" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "create_or_update",
    "send_invitations": false,
    "users": [
      {
        "email": "manager1@demo-enterprise.com",
        "name": "Marie Dupont",
        "role": "manager",
        "external_id": "SAP-MGR-001"
      },
      {
        "email": "manager2@demo-enterprise.com",
        "name": "Pierre Bernard",
        "role": "manager",
        "external_id": "SAP-MGR-002"
      },
      {
        "email": "seller1@demo-enterprise.com",
        "name": "Sophie Martin",
        "role": "seller",
        "external_id": "SAP-SELLER-001"
      },
      {
        "email": "seller2@demo-enterprise.com",
        "name": "Thomas Dubois",
        "role": "seller",
        "external_id": "SAP-SELLER-002"
      },
      {
        "email": "seller3@demo-enterprise.com",
        "name": "Julie Petit",
        "role": "seller",
        "external_id": "SAP-SELLER-003"
      }
    ]
  }')

echo "$USERS_RESPONSE" | python3 -m json.tool
echo ""

# 3. Vérification
echo "✅ Étape 3/3 : Vérification..."
echo "Consultez le Dashboard IT Admin pour voir les résultats :"
echo "  http://localhost:3000/it-admin"
echo ""
echo "✅ Import terminé !"
```

**Utilisation :**
```bash
chmod +x import.sh
./import.sh
```

---

## 🔍 Dépannage

### Erreur 401 : Invalid API key
- Vérifiez que la clé API est correcte
- Vérifiez que la clé n'a pas expiré
- Vérifiez que la clé est active (pas révoquée)

### Erreur 429 : Rate limit exceeded
- Vous avez dépassé 100 requêtes par minute
- Attendez 1 minute et réessayez

### Erreur : User already exists
- Changez le mode en `"update_only"` ou `"create_or_update"`
- Ou changez l'email de l'utilisateur

### Erreur : Store not found
- Assurez-vous d'importer les magasins AVANT les utilisateurs
- Vérifiez que les `store_id` sont corrects

---

## 📞 Support

Guide complet disponible dans :
- `/app/ENTERPRISE_API_DOCUMENTATION.md`
- `/app/GUIDE_TEST_IT_ADMIN_DASHBOARD.md`
