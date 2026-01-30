# 🚀 RUN STAGING - COMMANDES ET SORTIES ATTENDUES

**Date:** 2026-01-07  
**Objectif:** Valider le patch Stripe Subscriptions avant production

---

## 📋 ORDRE STRICT - COMMANDES À EXÉCUTER

### 1. Script Anti-Doublons (BLOQUANT)

**Commande:**
```bash
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

**Si doublons détectés:**
```
❌ Found N duplicate stripe_subscription_id values:

  stripe_subscription_id: sub_abc123
  Count: 2
  Documents:
    - id: sub1, user_id: gerant-123, status: active, created: 2024-01-01T00:00:00Z
    - id: sub2, user_id: gerant-123, status: active, created: 2024-01-02T00:00:00Z

⚠️  ACTION REQUIRED: Clean up duplicates before creating unique index!
```

**Action:** ❌ **NO-GO PROD** si doublons détectés

---

### 2. Boot Staging → Vérifier Création Index

**Action:**
1. Démarrer staging
2. Vérifier logs startup

**Log attendu:**
```
[STARTUP] ✅ Created unique index on stripe_subscription_id (partial filter)
```

**Si erreur:**
```
[STARTUP] ❌ Failed to create unique index on stripe_subscription_id: E11000 duplicate key error
[STARTUP] ❌ Found N duplicate stripe_subscription_id values. Please clean up before creating index.
```

**Action:** ❌ **NO-GO PROD** si erreur

---

### 3. Stripe Test Mode - Checkout OK + Metadata

**Actions:**
1. Créer checkout via `POST /gerant/stripe/checkout`
2. Compléter paiement dans Stripe Test Mode
3. Vérifier dans Stripe Dashboard → Subscription → Metadata

**Metadata attendue sur `subscription.metadata`:**
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

**Action:** ❌ **NO-GO PROD** si metadata absente

---

### 4. 2e Checkout → 409

**Action:**
1. Avec l'abonnement actif créé à l'étape 3
2. Tenter `POST /gerant/stripe/checkout`

**Réponse attendue:**
```json
{
  "detail": "Vous avez déjà un abonnement actif. Utilisez les options 'Modifier mon abonnement' ou 'Changer d'intervalle' pour ajuster votre plan."
}
```

**Status Code:** `409 Conflict`

**Action:** ❌ **NO-GO PROD** si 200 OK ou autre code

---

### 5. Resend Webhook → Skipped (duplicate_event_id)

**Action:**
1. Dans Stripe Dashboard → Webhooks → Sélectionner event `customer.subscription.created`
2. Cliquer "Resend event"
3. Vérifier logs backend

**Log attendu:**
```
[2024-01-07 12:00:00] INFO: 📥 Processing Stripe webhook: customer.subscription.created (id=evt_test_xyz789, created=1704067200)
[2024-01-07 12:00:00] INFO: ⏭️ IDEMPOTENT: Ignoring duplicate event evt_test_xyz789 for sub_test_abc123
```

**Vérification DB:**
- `updated_at` ne change pas
- Aucune modification

**Action:** ❌ **NO-GO PROD** si webhook appliqué

---

### 6. /gerant/subscription/audit → recommended_action Cohérent

**Requête:**
```bash
GET /gerant/subscription/audit
```

**Réponse attendue (après checkout test):**
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

**Action:** Vérifier que `recommended_action` est cohérent avec l'état réel

---

### 7. (Optionnel) /admin/subscription/resolve-duplicates?apply=false

**Requête:**
```bash
POST /admin/subscription/resolve-duplicates?gerant_id=gerant-123&apply=false
```

**Réponse attendue (dry-run):**
```json
{
  "success": true,
  "mode": "dry-run",
  "message": "Plan de résolution pour 1 abonnements actifs",
  "active_subscriptions_count": 1,
  "plan": null,
  "instructions": "Passez apply=true pour appliquer ce plan"
}
```

**Ou si multiples:**
```json
{
  "success": true,
  "mode": "dry-run",
  "message": "Plan de résolution pour 2 abonnements actifs",
  "active_subscriptions_count": 2,
  "plan": {
    "keep": {
      "stripe_subscription_id": "sub_abc123",
      "reason": "Most recent subscription"
    },
    "cancel": [
      {
        "stripe_subscription_id": "sub_def456",
        "action": "cancel_at_period_end"
      }
    ]
  }
}
```

---

## 📊 LIVRABLES POUR GO PROD

Pour obtenir **GO PRODUCTION**, fournir:

1. **Sortie du script doublons:**
   ```
   ✅ No duplicates found. Safe to create unique index.
   ```

2. **1 réponse audit (staging):**
   ```json
   {
     "active_subscriptions_count": 1,
     "has_multiple_active": false,
     "recommended_action": "OK",
     "active_subscriptions": [...]
   }
   ```

3. **1 log "duplicate_event_id skipped":**
   ```
   [2024-01-07 12:00:00] INFO: ⏭️ IDEMPOTENT: Ignoring duplicate event evt_test_xyz789 for sub_test_abc123
   ```

---

**Fin du run staging**
