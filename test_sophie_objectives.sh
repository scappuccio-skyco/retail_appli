#!/bin/bash

BACKEND_URL=$(grep REACT_APP_BACKEND_URL /app/frontend/.env | cut -d '=' -f2)

echo "=== Test des objectifs de Sophie Durand ==="
echo ""

# 1. Login as Sophie Durand  
echo "1. Connexion en tant que Sophie Durand..."
LOGIN_RESPONSE=$(curl -s -X POST "${BACKEND_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"sophie.durand@test.com","password":"demo123"}')

TOKEN=$(echo $LOGIN_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin).get('token', ''))" 2>/dev/null)

if [ -z "$TOKEN" ]; then
    echo "❌ Échec de connexion"
    echo "Réponse: $LOGIN_RESPONSE"
    exit 1
fi

echo "✅ Connexion réussie"
USER_ID=$(echo $LOGIN_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin).get('user', {}).get('id', ''))" 2>/dev/null)
MANAGER_ID=$(echo $LOGIN_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin).get('user', {}).get('manager_id', ''))" 2>/dev/null)
echo "User ID: $USER_ID"
echo "Manager ID: $MANAGER_ID"
echo ""

# 2. Get active objectives
echo "2. Récupération des objectifs actifs..."
OBJECTIVES_RESPONSE=$(curl -s -X GET "${BACKEND_URL}/api/seller/objectives/active" \
  -H "Authorization: Bearer $TOKEN")

echo "Réponse brute: $OBJECTIVES_RESPONSE"
echo ""

# Parse response
OBJECTIVES_COUNT=$(echo $OBJECTIVES_RESPONSE | python3 -c "import sys, json; data=json.load(sys.stdin); print(len(data) if isinstance(data, list) else 0)" 2>/dev/null)

echo "📊 Nombre d'objectifs actifs: $OBJECTIVES_COUNT"

if [ "$OBJECTIVES_COUNT" -gt 0 ]; then
    echo ""
    echo "Détails des objectifs:"
    echo $OBJECTIVES_RESPONSE | python3 -c "
import sys, json
data = json.load(sys.stdin)
for i, obj in enumerate(data, 1):
    print(f'  Objectif {i}:')
    print(f'    - Titre: {obj.get(\"title\", \"N/A\")}')
    print(f'    - Type: {obj.get(\"type\", \"N/A\")}')
    print(f'    - Période: {obj.get(\"period_start\", \"N/A\")} → {obj.get(\"period_end\", \"N/A\")}')
    print(f'    - Visible: {obj.get(\"visible\", \"N/A\")}')
    print()
" 2>/dev/null
else
    echo ""
    echo "3. Vérification des objectifs du manager dans la base de données..."
    mongosh retail_performer --quiet --eval "
    db.manager_objectives.find(
        {manager_id: '$MANAGER_ID'}, 
        {title: 1, type: 1, period_start: 1, period_end: 1, visible: 1, seller_id: 1, visible_to_sellers: 1, _id: 0}
    ).toArray()
    "
fi

