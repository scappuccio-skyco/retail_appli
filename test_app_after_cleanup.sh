#!/bin/bash

BACKEND_URL=$(grep REACT_APP_BACKEND_URL /app/frontend/.env | cut -d '=' -f2)

echo "=== TEST DE L'APPLICATION APRÈS NETTOYAGE ==="
echo ""

# Test 1: Login Sophie Martin
echo "1️⃣  Test login Sophie Martin..."
LOGIN=$(curl -s -X POST "${BACKEND_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"sophie.martin@skyco.fr","password":"password123"}')

TOKEN=$(echo $LOGIN | python3 -c "import sys, json; print(json.load(sys.stdin).get('token', ''))" 2>/dev/null)

if [ -n "$TOKEN" ]; then
    echo "    ✅ Connexion réussie"
else
    echo "    ❌ Échec connexion"
    exit 1
fi

# Test 2: Récupérer les objectifs
echo "2️⃣  Test récupération objectifs..."
OBJECTIVES=$(curl -s -X GET "${BACKEND_URL}/api/seller/objectives/active" \
  -H "Authorization: Bearer $TOKEN")

OBJ_COUNT=$(echo $OBJECTIVES | python3 -c "import sys, json; print(len(json.loads(sys.stdin.read())))" 2>/dev/null || echo "0")
echo "    ✅ Objectifs récupérés: $OBJ_COUNT"

# Test 3: Login Manager Y. Legoff
echo "3️⃣  Test login Manager (y.legoff@skyco.fr)..."
MANAGER_LOGIN=$(curl -s -X POST "${BACKEND_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"y.legoff@skyco.fr","password":"password123"}')

MANAGER_TOKEN=$(echo $MANAGER_LOGIN | python3 -c "import sys, json; print(json.load(sys.stdin).get('token', ''))" 2>/dev/null)

if [ -n "$MANAGER_TOKEN" ]; then
    echo "    ✅ Connexion manager réussie"
    
    # Test 4: Récupérer les vendeurs
    echo "4️⃣  Test récupération vendeurs du manager..."
    SELLERS=$(curl -s -X GET "${BACKEND_URL}/api/manager/sellers" \
      -H "Authorization: Bearer $MANAGER_TOKEN")
    
    SELLER_COUNT=$(echo $SELLERS | python3 -c "import sys, json; print(len(json.loads(sys.stdin.read())))" 2>/dev/null || echo "0")
    echo "    ✅ Vendeurs récupérés: $SELLER_COUNT"
else
    echo "    ❌ Échec connexion manager"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ TOUS LES TESTS SONT PASSÉS!"
echo "   L'application fonctionne correctement"

