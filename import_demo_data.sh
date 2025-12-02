#!/bin/bash

# Script d'import de données de démonstration
# Usage: ./import_demo_data.sh [API_KEY]

echo "🚀 Import en masse - Retail Performer Enterprise"
echo "=================================================="
echo ""

# Configuration
API_URL="http://localhost:8001"

# Vérifier si la clé API est fournie
if [ -z "$1" ]; then
    echo "❌ Erreur : Clé API manquante"
    echo ""
    echo "Usage: ./import_demo_data.sh <API_KEY>"
    echo ""
    echo "Pour obtenir une clé API :"
    echo "  1. Connectez-vous sur http://localhost:3000/login"
    echo "  2. Email: admin@demo-enterprise.com"
    echo "  3. Mot de passe: DemoPassword123!"
    echo "  4. Onglet 'Clés API' → 'Générer une clé'"
    echo ""
    exit 1
fi

API_KEY="$1"

echo "🔑 Clé API : ${API_KEY:0:15}..."
echo ""

# 1. Import des magasins
echo "📍 Étape 1/3 : Import de 5 magasins..."
echo "--------------------------------------"
STORES_RESPONSE=$(curl -s -X POST "$API_URL/api/enterprise/stores/bulk-import" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "create_or_update",
    "stores": [
      {
        "name": "Skyco Paris Centre",
        "location": "75001 Paris",
        "external_id": "SAP-STORE-001",
        "address": "123 Rue de Rivoli, 75001 Paris",
        "phone": "+33 1 42 86 82 00"
      },
      {
        "name": "Skyco Lyon Bellecour",
        "location": "69002 Lyon",
        "external_id": "SAP-STORE-002",
        "address": "45 Place Bellecour, 69002 Lyon",
        "phone": "+33 4 72 77 40 00"
      },
      {
        "name": "Skyco Marseille Vieux-Port",
        "location": "13001 Marseille",
        "external_id": "SAP-STORE-003",
        "address": "78 Quai du Port, 13001 Marseille",
        "phone": "+33 4 91 90 78 00"
      },
      {
        "name": "Skyco Bordeaux Sainte-Catherine",
        "location": "33000 Bordeaux",
        "external_id": "SAP-STORE-004",
        "address": "56 Rue Sainte-Catherine, 33000 Bordeaux",
        "phone": "+33 5 56 44 28 00"
      },
      {
        "name": "Skyco Lille Euralille",
        "location": "59000 Lille",
        "external_id": "SAP-STORE-005",
        "address": "100 Avenue Willy Brandt, 59000 Lille",
        "phone": "+33 3 20 14 52 00"
      }
    ]
  }')

# Afficher le résultat
echo "$STORES_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$STORES_RESPONSE"

# Vérifier le succès
SUCCESS=$(echo "$STORES_RESPONSE" | python3 -c "import sys,json;print(json.load(sys.stdin).get('success', False))" 2>/dev/null)

if [ "$SUCCESS" = "True" ]; then
    CREATED=$(echo "$STORES_RESPONSE" | python3 -c "import sys,json;print(json.load(sys.stdin).get('created', 0))" 2>/dev/null)
    echo ""
    echo "✅ $CREATED magasin(s) créé(s) avec succès"
else
    echo ""
    echo "❌ Erreur lors de l'import des magasins"
    echo "Vérifiez que la clé API est valide"
    exit 1
fi

echo ""
sleep 1

# 2. Import des utilisateurs
echo "👥 Étape 2/3 : Import de 10 utilisateurs..."
echo "-------------------------------------------"
USERS_RESPONSE=$(curl -s -X POST "$API_URL/api/enterprise/users/bulk-import" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "create_or_update",
    "send_invitations": false,
    "users": [
      {
        "email": "marie.dupont@demo-enterprise.com",
        "name": "Marie Dupont",
        "role": "manager",
        "external_id": "SAP-MGR-001"
      },
      {
        "email": "pierre.bernard@demo-enterprise.com",
        "name": "Pierre Bernard",
        "role": "manager",
        "external_id": "SAP-MGR-002"
      },
      {
        "email": "sophie.martin@demo-enterprise.com",
        "name": "Sophie Martin",
        "role": "manager",
        "external_id": "SAP-MGR-003"
      },
      {
        "email": "thomas.dubois@demo-enterprise.com",
        "name": "Thomas Dubois",
        "role": "seller",
        "external_id": "SAP-SELLER-001"
      },
      {
        "email": "julie.petit@demo-enterprise.com",
        "name": "Julie Petit",
        "role": "seller",
        "external_id": "SAP-SELLER-002"
      },
      {
        "email": "lucas.moreau@demo-enterprise.com",
        "name": "Lucas Moreau",
        "role": "seller",
        "external_id": "SAP-SELLER-003"
      },
      {
        "email": "emma.laurent@demo-enterprise.com",
        "name": "Emma Laurent",
        "role": "seller",
        "external_id": "SAP-SELLER-004"
      },
      {
        "email": "maxime.simon@demo-enterprise.com",
        "name": "Maxime Simon",
        "role": "seller",
        "external_id": "SAP-SELLER-005"
      },
      {
        "email": "chloe.michel@demo-enterprise.com",
        "name": "Chloé Michel",
        "role": "seller",
        "external_id": "SAP-SELLER-006"
      },
      {
        "email": "antoine.garcia@demo-enterprise.com",
        "name": "Antoine Garcia",
        "role": "seller",
        "external_id": "SAP-SELLER-007"
      }
    ]
  }')

# Afficher le résultat
echo "$USERS_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$USERS_RESPONSE"

# Vérifier le succès
SUCCESS=$(echo "$USERS_RESPONSE" | python3 -c "import sys,json;print(json.load(sys.stdin).get('success', False))" 2>/dev/null)

if [ "$SUCCESS" = "True" ]; then
    CREATED=$(echo "$USERS_RESPONSE" | python3 -c "import sys,json;print(json.load(sys.stdin).get('created', 0))" 2>/dev/null)
    UPDATED=$(echo "$USERS_RESPONSE" | python3 -c "import sys,json;print(json.load(sys.stdin).get('updated', 0))" 2>/dev/null)
    echo ""
    echo "✅ $CREATED utilisateur(s) créé(s), $UPDATED mis à jour"
else
    echo ""
    echo "❌ Erreur lors de l'import des utilisateurs"
fi

echo ""
sleep 1

# 3. Vérification
echo "✅ Étape 3/3 : Vérification des imports..."
echo "------------------------------------------"

# Récupérer le statut via l'API
python3 << 'EOF'
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv('/app/backend/.env')
client = AsyncIOMotorClient(os.environ['MONGO_URL'])
db = client[os.environ['DB_NAME']]

async def verify():
    # Compter pour Demo Enterprise
    enterprise_id = 'dfa021bc-37f4-40f6-8e49-7037baab7980'
    
    stores = await db.stores.count_documents({'enterprise_account_id': enterprise_id})
    users = await db.users.count_documents({'enterprise_account_id': enterprise_id})
    
    print(f"\n📊 Résumé de l'import :")
    print(f"  📍 Magasins : {stores}")
    print(f"  👥 Utilisateurs : {users}")
    print()

asyncio.run(verify())
EOF

echo ""
echo "=================================================="
echo "✅ Import terminé avec succès !"
echo "=================================================="
echo ""
echo "🎯 Prochaines étapes :"
echo ""
echo "  1. Consultez le Dashboard IT Admin :"
echo "     http://localhost:3000/it-admin"
echo ""
echo "  2. Vérifiez les logs de synchronisation"
echo "     (Onglet 'Logs de synchronisation')"
echo ""
echo "  3. Pour tester la lecture seule des KPI :"
echo "     - Réinitialisez le mot de passe d'un utilisateur importé"
echo "     - Connectez-vous avec cet utilisateur"
echo "     - Vérifiez que les champs KPI sont en lecture seule"
echo ""
echo "📚 Documentation complète :"
echo "  /app/GUIDE_IMPORT_EN_MASSE.md"
echo ""
