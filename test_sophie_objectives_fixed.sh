#!/bin/bash

BACKEND_URL=$(grep REACT_APP_BACKEND_URL /app/frontend/.env | cut -d '=' -f2)

echo "=== TEST OBJECTIF SOPHIE MARTIN (APRÈS CORRECTION) ==="
echo ""

# Login
echo "1. Connexion..."
LOGIN_RESPONSE=$(curl -s -X POST "${BACKEND_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"sophie.martin@skyco.fr","password":"password123"}')

TOKEN=$(echo $LOGIN_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin).get('token', ''))" 2>/dev/null)

if [ -z "$TOKEN" ]; then
    echo "❌ Échec connexion"
    exit 1
fi

echo "✅ Connexion réussie"
echo ""

# Get objectives
echo "2. Récupération des objectifs actifs..."
OBJECTIVES=$(curl -s -X GET "${BACKEND_URL}/api/seller/objectives/active" \
  -H "Authorization: Bearer $TOKEN")

echo "Réponse: $OBJECTIVES"
echo ""

COUNT=$(echo $OBJECTIVES | python3 -c "import sys, json; print(len(json.load(sys.stdin)) if isinstance(json.load(sys.stdin), list) else 0)" 2>/dev/null || echo "0")

echo "📊 Nombre d'objectifs: $COUNT"

if [ "$COUNT" -gt 0 ]; then
    echo ""
    echo "✅ SUCCÈS! L'objectif apparaît maintenant pour Sophie"
    echo ""
    echo "Détails:"
    echo $OBJECTIVES | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    for obj in data:
        print(f'  - Titre: {obj.get(\"title\")}')
        print(f'  - Type: {obj.get(\"type\")}')
        print(f'  - Période: {obj.get(\"period_start\")} → {obj.get(\"period_end\")}')
except:
    pass
" 2>/dev/null
else
    echo "❌ L'objectif n'apparaît toujours pas"
fi

