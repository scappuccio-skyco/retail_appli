#!/bin/bash

# Script d'initialisation de la base de données de production
# Ce script crée tous les comptes de test nécessaires

echo "======================================"
echo "🚀 Initialisation de la production"
echo "======================================"
echo ""

PROD_URL="https://retail-coach-1.emergent.host"
SECRET_TOKEN="Ogou56iACE-LK8rxQ_mjeOasxlk2uZ8b5ldMQMDz2_8"

echo "📡 Connexion à : $PROD_URL"
echo ""

# Appel de l'endpoint de seed
echo "⏳ Création des comptes..."
response=$(curl -s -X POST "$PROD_URL/api/auth/seed-database" \
  -H "Content-Type: application/json" \
  -d "{\"secret_token\": \"$SECRET_TOKEN\"}")

# Vérifier si la requête a réussi
if echo "$response" | grep -q "message"; then
    echo "✅ Succès !"
    echo ""
    echo "$response" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(data.get('message'))
print('\n📋 IDENTIFIANTS CRÉÉS :')
print('=' * 50)
for acc in data.get('accounts', []):
    print(f\"  🔐 {acc['role'].upper()}: {acc['email']}\")
    if 'workspace' in acc:
        print(f\"      Workspace: {acc['workspace']}\")
    elif 'enterprise' in acc:
        print(f\"      Enterprise: {acc['enterprise']}\")
    elif 'store' in acc:
        print(f\"      Store: {acc['store']}\")
print('\n🔑 Mot de passe pour tous : TestPassword123!')
print('=' * 50)
print('\n🌐 Connectez-vous sur : $PROD_URL')
print('\n⚠️  N\'oubliez pas de changer les mots de passe après la première connexion !')
" PROD_URL="$PROD_URL"
else
    echo "❌ Erreur lors de l'initialisation"
    echo ""
    echo "Réponse du serveur :"
    echo "$response"
    echo ""
    echo "💡 Vérifiez que :"
    echo "   - Le backend est bien démarré"
    echo "   - L'URL est correcte : $PROD_URL"
    echo "   - Le token secret est valide"
fi

echo ""
