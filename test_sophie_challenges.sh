#!/bin/bash

BACKEND_URL=$(grep REACT_APP_BACKEND_URL /app/frontend/.env | cut -d '=' -f2)

echo "=== TEST CHALLENGES SOPHIE MARTIN ==="
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

# Get challenges
echo "2. Récupération des challenges actifs..."
CHALLENGES=$(curl -s -X GET "${BACKEND_URL}/api/seller/challenges/active" \
  -H "Authorization: Bearer $TOKEN")

echo "Réponse brute: $CHALLENGES"
echo ""

COUNT=$(echo $CHALLENGES | python3 -c "
import sys, json
try:
    data = json.loads(sys.stdin.read())
    print(len(data) if isinstance(data, list) else 0)
except:
    print(0)
" 2>/dev/null)

echo "📊 Nombre de challenges: $COUNT"

if [ "$COUNT" -gt 0 ]; then
    echo ""
    echo "✅ Challenges trouvés!"
    echo ""
    echo "Détails:"
    echo $CHALLENGES | python3 -c "
import sys, json
try:
    data = json.loads(sys.stdin.read())
    for ch in data:
        print(f'  - Titre: {ch.get(\"title\")}')
        print(f'  - Type: {ch.get(\"type\")}')
        print(f'  - Période: {ch.get(\"start_date\")} → {ch.get(\"end_date\")}')
        print(f'  - Status: {ch.get(\"status\")}')
        print()
except Exception as e:
    print(f'Erreur: {e}')
" 2>/dev/null
else
    echo ""
    echo "❌ Aucun challenge retourné par l'API"
fi

