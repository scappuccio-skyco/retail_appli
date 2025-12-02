# 🔧 Guide de résolution - Stripe Auto-Upgrade

## Problème identifié

La fonction `auto_update_stripe_subscription_quantity` dans `/app/backend/server.py` ne peut pas fonctionner correctement pour le gérant test `gerant@skyco.fr` car :

1. Le gérant a un `stripe_customer_id` dans MongoDB
2. Mais ce customer n'existe pas ou n'est plus valide dans Stripe (erreur API Key invalide)
3. Cela empêche la mise à jour automatique des quantités d'abonnement

## Solution recommandée

### Option 1 : Créer une vraie session de checkout (Recommandé)

```bash
# 1. Se connecter en tant que gérant
curl -X POST http://localhost:8001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "gerant@skyco.fr",
    "password": "gerant123"
  }'

# 2. Créer une session de checkout
TOKEN="<token_from_login>"
curl -X POST http://localhost:8001/api/gerant/stripe/checkout \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "origin_url": "http://localhost:3000",
    "quantity": 11,
    "billing_period": "monthly"
  }'

# 3. Visiter l'URL retournée et compléter le paiement (mode test Stripe)
```

### Option 2 : Créer manuellement un customer Stripe

```python
import stripe
from motor.motor_asyncio import AsyncIOMotorClient
import asyncio

stripe.api_key = "sk_test_VOTRE_CLE_STRIPE_VALIDE"

async def fix_stripe():
    # Connecter à MongoDB
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client["retail_coach"]
    
    # Récupérer le gérant
    gerant = await db.users.find_one({"email": "gerant@skyco.fr"})
    
    # Créer un customer Stripe
    customer = stripe.Customer.create(
        email=gerant["email"],
        name=gerant["name"],
        metadata={"gerant_id": gerant["id"]}
    )
    
    # Mettre à jour MongoDB
    await db.users.update_one(
        {"id": gerant["id"]},
        {"$set": {"stripe_customer_id": customer.id}}
    )
    
    print(f"✅ Customer créé: {customer.id}")

asyncio.run(fix_stripe())
```

### Option 3 : Mettre à jour la clé API Stripe

Si la clé Stripe actuelle est invalide :

1. Se connecter à votre compte Stripe Dashboard
2. Aller dans **Developers > API Keys**
3. Copier la nouvelle clé de test `sk_test_...`
4. Mettre à jour `/app/backend/.env`:
   ```
   STRIPE_API_KEY=sk_test_NOUVELLE_CLE
   ```
5. Redémarrer le backend:
   ```bash
   sudo supervisorctl restart backend
   ```

## Test de la fonction auto-upgrade

Une fois le customer Stripe créé correctement :

```python
from server import auto_update_stripe_subscription_quantity
import asyncio

async def test_auto_upgrade():
    result = await auto_update_stripe_subscription_quantity(
        gerant_id="580eb001-a1a5-4c40-af4a-4fe19109c543",
        reason="test_manual"
    )
    print(result)

asyncio.run(test_auto_upgrade())
```

## Fonction auto-upgrade

La fonction `auto_update_stripe_subscription_quantity` est appelée automatiquement :
- Quand un vendeur est ajouté (status = active)
- Quand un vendeur est supprimé (status = inactive/deleted)
- Quand un vendeur est réactivé

Elle ajuste automatiquement la quantité de l'abonnement Stripe en fonction du nombre de vendeurs actifs.

## Vérification

Pour vérifier que tout fonctionne :

```bash
# 1. Compter les vendeurs actifs
python3 -c "
from motor.motor_asyncio import AsyncIOMotorClient
import asyncio

async def count():
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    db = client['retail_coach']
    count = await db.users.count_documents({
        'gerant_id': '580eb001-a1a5-4c40-af4a-4fe19109c543',
        'role': 'seller',
        'status': 'active'
    })
    print(f'Vendeurs actifs: {count}')

asyncio.run(count())
"

# 2. Vérifier la subscription Stripe via API
curl https://api.stripe.com/v1/subscriptions/sub_XXXXX \
  -u sk_test_VOTRE_CLE:
```

## Note

Le problème Stripe n'affecte **PAS** :
- L'architecture Enterprise qui vient d'être implémentée
- Les comptes IT Admin
- Les imports en masse via API
- Les autres fonctionnalités de l'application

C'est un problème isolé au système de facturation gérant/PME.
