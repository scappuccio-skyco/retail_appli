# 📋 Liste complète des endpoints Stripe

## 🔐 Configuration requise

### Variables d'environnement
- `STRIPE_API_KEY` : Clé API Stripe (sk_live_... ou sk_test_...)
- `STRIPE_WEBHOOK_SECRET` : Secret pour valider les webhooks Stripe (whsec_...)

### Price IDs Stripe (dans `backend/core/config.py`)
⚠️ **SECURITÉ** : Aucun calcul de prix côté serveur/client. Seuls les Price IDs Stripe sont utilisés.

- `STRIPE_PRICE_ID_MONTHLY` : Price ID pour facturation mensuelle (tarification par paliers)
- `STRIPE_PRICE_ID_YEARLY` : Price ID pour facturation annuelle (tarification par paliers)

**Note** : La tarification par paliers est configurée directement dans Stripe. Le backend transmet uniquement la `quantity` et le `price_id` approprié.

---

## 🔄 Webhooks Stripe

### `POST /webhooks/stripe`
**Fichier** : `backend/api/routes/stripe_webhooks.py`

**Description** : Endpoint pour recevoir les événements Stripe

**Sécurité** :
- Validation de la signature avec `STRIPE_WEBHOOK_SECRET`
- Retourne 400 si signature invalide
- Retourne 200 rapidement pour éviter les timeouts Stripe

**Événements gérés** :
- `invoice.payment_succeeded` : Paiement réussi
- `invoice.payment_failed` : Échec de paiement
- `customer.subscription.created` : Abonnement créé
- `customer.subscription.updated` : Abonnement mis à jour
- `customer.subscription.deleted` : Abonnement supprimé
- `checkout.session.completed` : Session de checkout complétée

**Réponse** :
```json
{
  "received": true,
  "type": "customer.subscription.created",
  "result": { "status": "processed" }
}
```

---

### `GET /webhooks/stripe/health`
**Fichier** : `backend/api/routes/stripe_webhooks.py`

**Description** : Health check pour vérifier la configuration des webhooks

**Réponse** :
```json
{
  "status": "ok",
  "webhook_secret_configured": true,
  "stripe_key_configured": true
}
```

---

## 💳 Gestion des abonnements (Gérant)

### `GET /gerant/subscription/status`
**Fichier** : `backend/api/routes/gerant.py`

**Description** : Récupère le statut de l'abonnement du gérant

**Authentification** : Requiert `get_current_gerant`

**Réponse** :
```json
{
  "status": "active|trialing|expired|no_subscription",
  "plan": "tiered",
  "subscription": {
    "seats": 5,
    "billing_interval": "month|year",
    "current_period_start": "2024-01-01T00:00:00Z",
    "current_period_end": "2024-02-01T00:00:00Z",
    "cancel_at_period_end": false
  },
  "trial_end": "2024-01-25T00:00:00Z",
  "days_left": 10,
  "used_seats": 3,
  "active_sellers_count": 3
}
```

---

### `POST /gerant/stripe/checkout`
**Fichier** : `backend/api/routes/gerant.py`

**Description** : Crée une session de checkout Stripe pour un nouveau abonnement

**Authentification** : Requiert `get_current_gerant`

**Body** :
```json
{
  "quantity": 5,
  "billing_period": "monthly|yearly",
  "origin_url": "https://retailperformerai.com"
}
```

**Validations** :
- ✅ Profil de facturation B2B complet (obligatoire)
- ✅ Champs requis : `company_name`, `billing_email`, `address_line1`, `postal_code`, `city`, `country`, `country_code`
- ✅ VAT number validé si pays UE hors FR
- ❌ Bloque si abonnement actif existe déjà (409 Conflict)
- ❌ Bloque si `quantity > 15` (400 Bad Request : "Au-delà de 15 vendeurs, veuillez nous contacter pour un devis personnalisé")

**Tarification** :
- ⚠️ **SECURITÉ** : Aucun calcul de prix côté serveur
- La tarification par paliers est configurée dans Stripe (tiered pricing)
- Le backend transmet uniquement `quantity` et `price_id` à Stripe
- Stripe calcule automatiquement le montant selon les paliers configurés

**Réponse** :
```json
{
  "checkout_url": "https://checkout.stripe.com/...",
  "session_id": "cs_test_...",
  "quantity": 5,
  "active_sellers_count": 3
}
```

---

### `POST /gerant/subscription/update-seats`
**Fichier** : `backend/api/routes/gerant.py`

**Description** : Met à jour le nombre de sièges dans l'abonnement

**Authentification** : Requiert `get_current_gerant`

**Body** :
```json
{
  "seats": 10,
  "stripe_subscription_id": "sub_xxx" // Optionnel, requis si abonnements multiples
}
```

**Comportement** :
- **Essai** : Met à jour uniquement la base de données (pas d'appel Stripe)
- **Actif** : Appelle Stripe API avec proration automatique
- **Proration** : Calculée automatiquement par Stripe

**Réponse** :
```json
{
  "success": true,
  "previous_seats": 5,
  "new_seats": 10,
  "proration_amount": 72.50,
  "message": "Sièges mis à jour avec succès"
}
```

**Erreurs possibles** :
- `409 Conflict` : Abonnements multiples actifs (spécifier `stripe_subscription_id`)

---

### `POST /gerant/seats/preview`
**Fichier** : `backend/api/routes/gerant.py`

**Description** : Prévisualise le coût d'un changement de nombre de sièges (uniquement sièges)

**Authentification** : Requiert `get_current_gerant`

**Body** :
```json
{
  "new_seats": 10
}
```

**Comportement** :
- ⚠️ **SECURITÉ** : Utilise uniquement l'API Stripe `Invoice.create_preview` pour obtenir les montants réels
- Ne modifie rien, uniquement informatif
- Les montants sont récupérés depuis Stripe (pas de calcul côté serveur)

**Réponse** :
```json
{
  "current_seats": 5,
  "new_seats": 10,
  "current_plan": "tiered",
  "new_plan": "tiered",
  "current_monthly_cost": 0.0,
  "new_monthly_cost": 0.0,
  "price_difference": 0.0
}
```

**Note** : Les montants sont récupérés depuis Stripe via `Invoice.create_preview` si l'abonnement existe. Sinon, ils sont à 0.0.

**Note** : Les montants (`current_monthly_cost`, `new_monthly_cost`, etc.) sont récupérés depuis Stripe si l'abonnement existe. Sinon, ils sont à 0.0 et Stripe calculera le montant exact lors de la modification.

---

### `POST /gerant/subscription/preview`
**Fichier** : `backend/api/routes/gerant.py`

**Description** : Prévisualise les changements d'abonnement (sièges et/ou intervalle)

**Authentification** : Requiert `get_current_gerant`

**Body** :
```json
{
  "new_seats": 10,        // Optionnel
  "new_interval": "year"  // Optionnel ('month' ou 'year')
}
```

**Réponse** :
```json
{
  "current_seats": 5,
  "new_seats": 10,
  "current_plan": "tiered",
  "new_plan": "tiered",
  "current_interval": "month",
  "new_interval": "month",
  "interval_changing": false,
  "current_monthly_cost": 0.0,
  "new_monthly_cost": 0.0,
  "current_yearly_cost": 0.0,
  "new_yearly_cost": 0.0,
  "price_difference_monthly": 0.0,
  "price_difference_yearly": 0.0,
  "proration_estimate": 0.0,
  "proration_description": "Montant calculé par Stripe selon la tarification par paliers",
  "is_upgrade": true,
  "is_trial": false,
  "annual_savings_percent": 0.0
}
```

**Note** : Les montants sont récupérés depuis Stripe via `Invoice.create_preview` si l'abonnement existe. Sinon, ils sont à 0.0 et Stripe calculera le montant exact lors de la modification.

---

### `POST /gerant/subscription/switch-interval`
**Fichier** : `backend/api/routes/gerant.py`

**Description** : Change l'intervalle de facturation (mensuel ↔ annuel)

**Authentification** : Requiert `get_current_gerant`

**Règles** :
- ✅ Mensuel → Annuel : Autorisé (20% de réduction)
- ❌ Annuel → Mensuel : **BLOQUÉ** (doit annuler et réabonner)

**Body** :
```json
{
  "interval": "year"  // 'month' ou 'year'
}
```

**Réponse** :
```json
{
  "success": true,
  "message": "🎉 Passage à l'abonnement annuel réussi ! Vous bénéficiez d'une réduction avec l'abonnement annuel.",
  "previous_interval": "month",
  "new_interval": "year",
  "new_monthly_cost": 0.0,
  "new_yearly_cost": 0.0,
  "proration_amount": 0.0,
  "next_billing_date": "2025-01-01T00:00:00Z"
}
```

**Note** : Les montants (`new_monthly_cost`, `new_yearly_cost`, `proration_amount`) sont récupérés depuis Stripe si disponibles. Sinon, ils sont à 0.0 et Stripe calculera le montant exact lors de la modification.

---

### `POST /gerant/subscription/cancel`
**Fichier** : `backend/api/routes/gerant.py`

**Description** : Annule l'abonnement actif

**Authentification** : Requiert `get_current_gerant`

**Body** :
```json
{
  "cancel_immediately": false,  // true = annule maintenant, false = à la fin de période
  "stripe_subscription_id": "sub_xxx",  // Optionnel, requis si abonnements multiples
  "support_mode": false  // Si true, sélection automatique en cas de multiples
}
```

**Options** :
- `cancel_immediately=true` : Annule immédiatement (remboursement prorata possible)
- `cancel_immediately=false` : Annule à la fin de période (accès jusqu'à la fin, pas de remboursement)

**Réponse** :
```json
{
  "success": true,
  "message": "Abonnement programmé pour annulation. Vous conservez l'accès jusqu'au 2024-02-01.",
  "canceled_at": "2024-01-15T10:00:00Z",
  "cancel_at_period_end": true,
  "period_end": "2024-02-01T00:00:00Z"
}
```

**Erreurs possibles** :
- `409 Conflict` : Abonnements multiples actifs (spécifier `stripe_subscription_id`)

---

### `POST /gerant/subscription/reactivate`
**Fichier** : `backend/api/routes/gerant.py`

**Description** : Réactive un abonnement programmé pour annulation (si `cancel_at_period_end=true`)

**Authentification** : Requiert `get_current_gerant`

**Body** :
```json
{
  "stripe_subscription_id": "sub_xxx",  // Optionnel, requis si abonnements multiples
  "support_mode": false  // Si true, permet la sélection automatique même avec multiples
}
```

**Conditions** :
- L'abonnement doit avoir `cancel_at_period_end=true`
- L'abonnement doit être actif (`status='active'` ou `'trialing'`)

**Comportement** :
- Vérifie que l'abonnement est programmé pour annulation
- **Essai** : Met à jour uniquement la base de données (pas d'appel Stripe)
- **Actif** : Appelle `stripe.Subscription.modify(subscription_id, cancel_at_period_end=False)`
- Met à jour MongoDB et le workspace
- Retourne le statut mis à jour

**Réponse** :
```json
{
  "success": true,
  "message": "Abonnement réactivé avec succès. L'annulation programmée a été annulée.",
  "subscription": {
    "id": "sub_xxx",
    "status": "active",
    "cancel_at_period_end": false,
    "canceled_at": null,
    "current_period_end": "2024-02-01T00:00:00Z",
    ...
  },
  "reactivated_at": "2024-01-15T10:00:00Z"
}
```

**Erreurs possibles** :
- `404` : Aucun abonnement actif trouvé
- `400` : Aucun abonnement programmé pour annulation trouvé
- `409 Conflict` : Abonnements multiples programmés (spécifier `stripe_subscription_id`)

---

### `GET /gerant/subscriptions`
**Fichier** : `backend/api/routes/gerant.py`

**Description** : Liste tous les abonnements du gérant (actifs, annulés, expirés)

**Authentification** : Requiert `get_current_gerant`

**Utilité** :
- Détecter les abonnements multiples
- Voir l'historique des abonnements
- Déboguer les problèmes d'abonnement

**Réponse** :
```json
{
  "success": true,
  "total_subscriptions": 3,
  "active_subscriptions": 1,
  "subscriptions": [
    {
      "id": "sub_xxx",
      "status": "active",
      "plan": "tiered",
      "seats": 10,
      "billing_interval": "month",
      "stripe_subscription_id": "sub_xxx",
      "created_at": "2024-01-01T00:00:00Z",
      "cancel_at_period_end": false,
      "current_period_end": "2024-02-01T00:00:00Z"
    }
  ],
  "warning": "⚠️ 1 abonnement(s) actif(s) détecté(s)"
}
```

---

### `GET /gerant/subscription/audit`
**Fichier** : `backend/api/routes/gerant.py`

**Description** : Audit complet de l'abonnement (synchronisation Stripe ↔ DB)

**Authentification** : Requiert `get_current_gerant`

**Réponse** :
```json
{
  "local_subscription": { ... },
  "stripe_subscription": { ... },
  "sync_status": "synced|mismatch|missing",
  "warnings": [],
  "recommendations": []
}
```

---

## 🔧 Endpoints Admin/Support

### `POST /superadmin/subscription/resolve-duplicates`
**Fichier** : `backend/api/routes/admin.py`

**Description** : Résout les abonnements multiples (support uniquement)

**Authentification** : Requiert `get_super_admin`

**Query Parameters** :
- `gerant_id` : ID du gérant
- `apply` : `true` pour appliquer, `false` pour dry-run (défaut)

**Règles de résolution** :
- Garde le plus récent (par `current_period_end`)
- Annule les autres à la fin de période
- Vérifie les métadonnées pour corrélation

**Réponse (dry-run)** :
```json
{
  "success": true,
  "mode": "dry-run",
  "message": "Plan de résolution pour 2 abonnements actifs",
  "active_subscriptions_count": 2,
  "plan": {
    "keep": { "stripe_subscription_id": "sub_xxx", ... },
    "cancel": [ { "stripe_subscription_id": "sub_yyy", ... } ]
  },
  "instructions": "Passez apply=true pour appliquer ce plan"
}
```

---

## 📊 Endpoints Manager/Seller

### `GET /manager/subscription-status`
**Fichier** : `backend/api/routes/manager.py`

**Description** : Statut de l'abonnement pour un manager (lecture seule)

**Authentification** : Requiert `get_current_manager`

---

### `GET /manager/subscription-history`
**Fichier** : `backend/api/routes/manager.py` (à vérifier)

**Description** : Historique des paiements pour un manager

---

### `GET /sellers/subscription-status`
**Fichier** : `backend/api/routes/sellers.py`

**Description** : Statut de l'abonnement pour un vendeur (lecture seule)

**Authentification** : Requiert `get_current_seller`

---

## 🔍 Endpoints Checkout (Legacy - à vérifier)

### `GET /checkout/status/{session_id}`
**Fichier** : Potentiellement supprimé (présent dans `_archived_legacy`)

**Description** : Vérifie le statut d'une session de checkout

**Note** : Cet endpoint semble avoir été remplacé par les webhooks Stripe. Vérifier si encore utilisé dans le frontend.

---

## 📝 Notes importantes

### Gestion des abonnements multiples
L'application détecte et gère les abonnements multiples :
- **Détection** : Vérifie dans DB et Stripe
- **Blocage** : Empêche la création d'un nouvel abonnement si un actif existe
- **Résolution** : Endpoint admin pour résoudre les doublons

### Proration
- Calculée automatiquement par Stripe lors des changements
- Appliquée lors de :
  - Changement de sièges
  - Changement d'intervalle (mensuel → annuel)
  - Annulation immédiate

### Profil de facturation B2B
- **Obligatoire** avant tout checkout
- Champs requis : `company_name`, `billing_email`, `address_line1`, `postal_code`, `city`, `country`, `country_code`
- VAT number obligatoire pour pays UE hors FR
- Validation du VAT number requise

### Tarification
⚠️ **SECURITÉ** : Aucun calcul de prix côté serveur ou client.

- **Tarification par paliers** : Configurée directement dans Stripe (tiered pricing)
- **Limite** : Maximum 15 vendeurs via l'application (>15 nécessite un devis personnalisé)
- **Réduction annuelle** : Gérée par Stripe selon la configuration des Price IDs
- **Source de vérité** : Stripe calcule tous les montants automatiquement selon les paliers configurés
- **Backend** : Transmet uniquement `quantity` et `price_id` (mensuel ou annuel)
- **Frontend** : Envoie uniquement `quantity` et `billing_period` au backend

---

## 🚀 Configuration Stripe Dashboard

### Webhooks à configurer
URL : `https://api.retailperformerai.com/webhooks/stripe`

**Événements à écouter** :
- `invoice.payment_succeeded`
- `invoice.payment_failed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `checkout.session.completed`

### Products & Prices
⚠️ **NOUVEAU** : Configuration simplifiée avec tarification par paliers.

**Créer 1 produit avec 2 Price IDs dans Stripe** :
1. **Produit unique** avec tarification par paliers (tiered pricing)
2. **Price ID Mensuel** : `STRIPE_PRICE_ID_MONTHLY` (facturation mensuelle)
3. **Price ID Annuel** : `STRIPE_PRICE_ID_YEARLY` (facturation annuelle)

**Configuration des paliers dans Stripe** :
- Les paliers de tarification sont configurés directement dans le dashboard Stripe
- Exemple : 1-5 sièges = X€/siège, 6-15 sièges = Y€/siège, etc.
- Stripe calcule automatiquement le montant total selon la quantité

**Configuration dans `backend/core/config.py`** :
```python
STRIPE_PRICE_ID_MONTHLY: str = Field(..., description="Stripe Price ID for monthly billing (tiered product)")
STRIPE_PRICE_ID_YEARLY: str = Field(..., description="Stripe Price ID for yearly billing (tiered product)")
```

---

## ✅ Checklist de configuration

- [ ] `STRIPE_API_KEY` configuré (sk_live_... ou sk_test_...)
- [ ] `STRIPE_WEBHOOK_SECRET` configuré (whsec_...)
- [ ] 1 produit créé dans Stripe Dashboard avec tarification par paliers (tiered pricing)
- [ ] 2 Price IDs créés (mensuel et annuel) pour ce produit
- [ ] Paliers de tarification configurés dans Stripe (ex: 1-5 sièges, 6-15 sièges)
- [ ] Price IDs configurés dans `backend/core/config.py` (`STRIPE_PRICE_ID_MONTHLY` et `STRIPE_PRICE_ID_YEARLY`)
- [ ] Webhook endpoint configuré dans Stripe Dashboard
- [ ] 6 événements webhook sélectionnés
- [ ] Test des webhooks avec Stripe CLI ou Dashboard
- [ ] Vérification qu'aucun calcul de prix n'est effectué côté serveur/client

---

## 🔒 Sécurité et bonnes pratiques

### ⚠️ Règles de sécurité strictes
1. **Aucun calcul de prix côté serveur** : Le backend transmet uniquement `quantity` et `price_id` à Stripe
2. **Aucun calcul de prix côté client** : Le frontend envoie uniquement `quantity` et `billing_period`
3. **Source de vérité unique** : Stripe calcule tous les montants selon la configuration des paliers
4. **Aucune valeur monétaire en dur** : Pas de prix hardcodés (29, 25, 22, etc.) dans le code
5. **Logs sécurisés** : Les logs ne contiennent pas de montants monétaires sensibles

### Validation des montants
- Les montants affichés dans les previews proviennent de l'API Stripe (`Invoice.create_preview`)
- Si l'API Stripe n'est pas disponible, les montants sont à 0.0 et Stripe calculera lors de la transaction
- Les montants finaux sont toujours calculés par Stripe lors de la création de la session de checkout

---

**Dernière mise à jour** : 2024-12-XX (Migration vers tarification par paliers)
