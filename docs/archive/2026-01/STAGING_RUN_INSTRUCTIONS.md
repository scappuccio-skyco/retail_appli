# 🚀 INSTRUCTIONS RUN STAGING - POUR GO PROD

**Date:** 2026-01-07  
**Status:** ✅ **PRÊT POUR EXÉCUTION**

---

## ✅ CORRECTIONS APPLIQUÉES

### 1. IP Detection Améliorée

**Correction:**
- ✅ Priorité: `x-real-ip` > `x-forwarded-for` > `client.host` > platform headers
- ✅ Support des headers platform: `cf-connecting-ip`, `x-vercel-forwarded-for`, `x-railway-client-ip`
- ✅ Stockage de `x_forwarded_for` et `x_real_ip` dans admin_logs

**Code:**
```python
# Priority: x-real-ip > x-forwarded-for > client.host > platform headers
x_forwarded_for = request.headers.get("x-forwarded-for")
x_real_ip = request.headers.get("x-real-ip")

if x_real_ip:
    client_ip = x_real_ip.split(",")[0].strip()
elif x_forwarded_for:
    client_ip = x_forwarded_for.split(",")[0].strip()
# ... platform headers fallback
```

---

### 2. Logs Fallback user_id Améliorés

**Correction:**
- ✅ Ajout de `workspace_id` dans les logs de fallback
- ✅ Ajout de `subscription_id` / `event_id` quand disponible
- ✅ Messages de warning plus détaillés pour diagnostic

**Exemples:**
```python
logger.warning(
    f"⚠️ Payment succeeded but no subscription_id for customer {customer_id}. "
    f"Using fallback update by user_id. "
    f"workspace_id: {gerant.get('workspace_id')}, "
    f"gerant_id: {gerant['id']}"
)
```

---

## 📋 RUN STAGING - COMMANDES À EXÉCUTER

### 1. Script Anti-Doublons (BLOQUANT)

**Commande:**
```bash
# Dans l'environnement virtuel du projet
python backend/scripts/check_subscription_duplicates.py
```

**Sortie attendue:**
```
🔍 Checking for duplicate stripe_subscription_id values...

✅ No duplicates found. Safe to create unique index.

🔍 Checking for null/missing stripe_subscription_id...

ℹ️  Found X subscriptions without stripe_subscription_id (legacy data)
   ✅ This is OK - index will be partial (sparse=True + partialFilterExpression)

✅ All checks passed.
```

**Si doublons:**
```
❌ Found N duplicate stripe_subscription_id values:
  ...
⚠️  ACTION REQUIRED: Clean up duplicates before creating unique index!
```

---

### 2. Boot Staging → Vérifier Index

**Action:**
1. Démarrer staging
2. Vérifier logs startup

**Log attendu:**
```
[STARTUP] ✅ Created unique index on stripe_subscription_id (partial filter)
```

---

### 3. Stripe Test Mode - Checkout + Metadata

**Actions:**
1. Créer checkout via `POST /gerant/stripe/checkout`
2. Compléter paiement dans Stripe Test Mode
3. Vérifier dans Stripe Dashboard → Subscription → Metadata

**Metadata attendue:**
```json
{
  "correlation_id": "550e8400-e29b-41d4-a716-446655440000",
  "checkout_session_id": "cs_test_abc123",
  "user_id": "gerant-123",
  "workspace_id": "workspace-456",
  "source": "app_checkout",
  "price_id": "price_starter_monthly",
  "plan": "starter",
  "billing_interval": "month",
  "quantity": "5"
}
```

---

### 4. 2e Checkout → 409

**Action:**
1. Avec l'abonnement actif créé
2. Tenter `POST /gerant/stripe/checkout`

**Réponse attendue:**
```json
{
  "detail": "Vous avez déjà un abonnement actif. Utilisez les options 'Modifier mon abonnement' ou 'Changer d'intervalle' pour ajuster votre plan."
}
```

**Status:** `409 Conflict`

---

### 5. Resend Webhook → Skipped

**Action:**
1. Stripe Dashboard → Webhooks → Sélectionner event `customer.subscription.created`
2. Cliquer "Resend event"
3. Vérifier logs backend

**Log attendu:**
```
[2024-01-07 12:00:00] INFO: 📥 Processing Stripe webhook: customer.subscription.created (id=evt_test_xyz789, created=1704067200)
[2024-01-07 12:00:00] INFO: ⏭️ IDEMPOTENT: Ignoring duplicate event evt_test_xyz789 for sub_test_abc123
```

**Vérification DB:**
- `updated_at` ne change pas

---

### 6. /gerant/subscription/audit

**Requête:**
```bash
GET /gerant/subscription/audit
```

**Réponse attendue:**
```json
{
  "success": true,
  "gerant_id": "gerant-123",
  "active_subscriptions_count": 1,
  "has_multiple_active": false,
  "active_subscriptions": [
    {
      "stripe_subscription_id": "sub_test_abc123",
      "status": "active",
      "workspace_id": "workspace-456",
      "price_id": "price_starter_monthly",
      "correlation_id": "550e8400-e29b-41d4-a716-446655440000",
      "checkout_session_id": "cs_test_abc123",
      "source": "app_checkout",
      "last_event_id": "evt_test_xyz789",
      "last_event_created": 1704067200
    }
  ],
  "detected_issues": [],
  "recommended_action": "OK",
  "recommended_action_details": "No issues detected. Subscription status is healthy."
}
```

---

## 📊 LIVRABLES POUR GO PROD

Pour obtenir **GO PRODUCTION**, fournir ces 3 sorties (copier-coller brut):

### 1. Résultat de check_subscription_duplicates.py

```
🔍 Checking for duplicate stripe_subscription_id values...

✅ No duplicates found. Safe to create unique index.

🔍 Checking for null/missing stripe_subscription_id...

ℹ️  Found X subscriptions without stripe_subscription_id (legacy data)
   ✅ This is OK - index will be partial (sparse=True + partialFilterExpression)

✅ All checks passed.
```

---

### 2. Un exemple JSON de /gerant/subscription/audit

```json
{
  "success": true,
  "gerant_id": "gerant-123",
  "active_subscriptions_count": 1,
  "has_multiple_active": false,
  "active_subscriptions": [
    {
      "stripe_subscription_id": "sub_test_abc123",
      "status": "active",
      "workspace_id": "workspace-456",
      "price_id": "price_starter_monthly",
      "correlation_id": "550e8400-e29b-41d4-a716-446655440000",
      "checkout_session_id": "cs_test_abc123",
      "source": "app_checkout",
      "last_event_id": "evt_test_xyz789",
      "last_event_created": 1704067200
    }
  ],
  "detected_issues": [],
  "recommended_action": "OK",
  "recommended_action_details": "No issues detected. Subscription status is healthy."
}
```

---

### 3. Le log du webhook resend (duplicate_event_id ignoré)

```
[2024-01-07 12:00:00] INFO: 📥 Processing Stripe webhook: customer.subscription.created (id=evt_test_xyz789, created=1704067200)
[2024-01-07 12:00:00] INFO: ⏭️ IDEMPOTENT: Ignoring duplicate event evt_test_xyz789 for sub_test_abc123
```

**Ou format JSON si disponible:**
```json
{
  "status": "skipped",
  "reason": "duplicate_event_id",
  "event_id": "evt_test_xyz789"
}
```

---

## ✅ RÉSUMÉ DES CORRECTIONS

| Correction | Status | Détails |
|------------|--------|---------|
| IP Detection | ✅ | x-real-ip > x-forwarded-for > client.host > platform |
| Logs Fallback user_id | ✅ | workspace_id + subscription_id/event_id ajoutés |
| Admin Logs | ✅ | x_forwarded_for + x_real_ip stockés |

---

**Status:** ✅ **PRÊT POUR RUN STAGING**

Une fois les 3 sorties fournies → **GO PRODUCTION** ou **NO-GO** avec cause exacte.
