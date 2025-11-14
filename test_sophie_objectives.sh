#!/bin/bash

BACKEND_URL=$(grep REACT_APP_BACKEND_URL /app/frontend/.env | cut -d '=' -f2)

echo "=== Test des objectifs de Sophie Martin ==="
echo ""

# 1. Login as Sophie Martin  
echo "1. Connexion en tant que Sophie Martin (sophie.martin@skyco.fr)..."
LOGIN_RESPONSE=$(curl -s -X POST "${BACKEND_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"sophie.martin@skyco.fr","password":"password123"}')

TOKEN=$(echo $LOGIN_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin).get('token', ''))" 2>/dev/null)

if [ -z "$TOKEN" ]; then
    echo "❌ Échec de connexion"
    echo "Réponse: $LOGIN_RESPONSE"
    exit 1
fi

echo "✅ Connexion réussie"
USER_ID=$(echo $LOGIN_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin).get('user', {}).get('id', ''))" 2>/dev/null)
MANAGER_ID=$(echo $LOGIN_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin).get('user', {}).get('manager_id', ''))" 2>/dev/null)
FIRST_NAME=$(echo $LOGIN_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin).get('user', {}).get('first_name', ''))" 2>/dev/null)
LAST_NAME=$(echo $LOGIN_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin).get('user', {}).get('last_name', ''))" 2>/dev/null)
echo "Nom: $FIRST_NAME $LAST_NAME"
echo "User ID: $USER_ID"
echo "Manager ID: $MANAGER_ID"
echo ""

# 2. Get active objectives
echo "2. Récupération des objectifs actifs via API..."
OBJECTIVES_RESPONSE=$(curl -s -X GET "${BACKEND_URL}/api/seller/objectives/active" \
  -H "Authorization: Bearer $TOKEN")

echo "Réponse brute: $OBJECTIVES_RESPONSE"
echo ""

# Parse response
OBJECTIVES_COUNT=$(echo $OBJECTIVES_RESPONSE | python3 -c "import sys, json; data=json.load(sys.stdin); print(len(data) if isinstance(data, list) else 0)" 2>/dev/null)

echo "📊 Nombre d'objectifs actifs retournés par l'API: $OBJECTIVES_COUNT"
echo ""

if [ "$OBJECTIVES_COUNT" -gt 0 ]; then
    echo "✅ Objectifs trouvés! Détails:"
    echo $OBJECTIVES_RESPONSE | python3 -c "
import sys, json
data = json.load(sys.stdin)
for i, obj in enumerate(data, 1):
    print(f'  Objectif {i}:')
    print(f'    - Titre: {obj.get(\"title\", \"N/A\")}')
    print(f'    - Type: {obj.get(\"type\", \"N/A\")}')
    print(f'    - Période: {obj.get(\"period_start\", \"N/A\")} → {obj.get(\"period_end\", \"N/A\")}')
    print(f'    - Visible: {obj.get(\"visible\", \"N/A\")}')
    if obj.get('type') == 'individual':
        print(f'    - Seller ID: {obj.get(\"seller_id\", \"N/A\")}')
    print()
" 2>/dev/null
else
    echo "❌ Aucun objectif retourné par l'API"
    echo ""
    echo "3. Vérification directe dans la base de données..."
    TODAY=$(date -u +"%Y-%m-%d")
    echo "Date d'aujourd'hui (UTC): $TODAY"
    echo ""
    
    mongosh retail_performer --quiet --eval "
    const managerId = '$MANAGER_ID';
    const sellerId = '$USER_ID';
    const today = '$TODAY';
    
    print('=== TOUS LES OBJECTIFS DU MANAGER ===');
    const allObjectives = db.manager_objectives.find({manager_id: managerId}).toArray();
    print('Nombre total d\'objectifs du manager: ' + allObjectives.length);
    allObjectives.forEach(obj => {
        print('');
        print('Objectif: ' + obj.title);
        print('  - Type: ' + obj.type);
        print('  - Period end: ' + obj.period_end + ' (Comparé à aujourd\'hui: ' + today + ')');
        print('  - Visible: ' + obj.visible);
        print('  - Condition period_end > today: ' + (obj.period_end > today));
        if (obj.type === 'individual') {
            print('  - Seller ID: ' + obj.seller_id);
            print('  - Match seller: ' + (obj.seller_id === sellerId));
        }
        if (obj.visible_to_sellers) {
            print('  - Visible to sellers: ' + JSON.stringify(obj.visible_to_sellers));
        }
    });
    "
fi

