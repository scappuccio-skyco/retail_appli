# ✅ CHECKLIST FINALE STAGING → PROD

**Date:** 2026-01-07  
**Version:** 1.0

---

## 🧪 STAGING - Tests Obligatoires

### 1. Script Anti-Doublons

**Commande:**
```bash
python backend/scripts/check_subscription_duplicates.py
```

**Sortie attendue:**
```
🔍 Checking for duplicate stripe_subscription_id values...

✅ No duplicates found. Safe to create unique index.

🔍 Checking for null/missing stripe_subscription_id...

ℹ️  Found 0 subscriptions without stripe_subscription_id (legacy data)
✅ All subscriptions have stripe_subscription_id
```

**Si doublons détectés:**
```
❌ Found 2 duplicate stripe_subscription_id values:

  stripe_subscription_id: sub_abc123
  Count: 2
  Documents:
    - id: sub1, user_id: gerant-123, status: active, created: 2024-01-01T00:00:00Z
    - id: sub2, user_id: gerant-123, status: active, created: 2024-01-02T00:00:00Z

⚠️  ACTION REQUIRED: Clean up duplicates before creating unique index!
```

**Status:** ❌ **NO-GO PROD** si doublons détectés

---

### 2. Index Créé Sans Erreur au Boot

**Logs startup attendus:**
```
[STARTUP] ✅ Created unique index on stripe_subscription_id (partial filter)
```

**Si erreur:**
```
[STARTUP] ❌ Failed to create unique index on stripe_subscription_id: E11000 duplicate key error
[STARTUP] ❌ Found 2 duplicate stripe_subscription_id values. Please clean up before creating index.
```

**Status:** ❌ **NO-GO PROD** si erreur

---

### 3. Checkout Test → Metadata sur Subscription OK

**Action:**
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

**Status:** ❌ **NO-GO PROD** si metadata absente

---

### 4. 2e Checkout avec Active → 409

**Action:**
1. Avec un abonnement actif existant
2. Tenter `POST /gerant/stripe/checkout`

**Réponse attendue:**
```json
{
  "detail": "Vous avez déjà un abonnement actif. Utilisez les options 'Modifier mon abonnement' ou 'Changer d'intervalle' pour ajuster votre plan."
}
```

**Status Code:** `409 Conflict`

**Status:** ❌ **NO-GO PROD** si 200 OK ou autre code

---

### 5. Webhook Resend → Skipped

**Action:**
1. Dans Stripe Dashboard → Webhooks → Sélectionner event `customer.subscription.created`
2. Cliquer "Resend event"
3. Vérifier logs backend

**Log attendu:**
```
📥 Processing Stripe webhook: customer.subscription.created (id=evt_test_xyz789, created=1704067200)
⏭️ IDEMPOTENT: Ignoring duplicate event evt_test_xyz789 for sub_test_abc123
```

**Vérification DB:**
- `updated_at` ne change pas
- Aucune modification

**Status:** ❌ **NO-GO PROD** si webhook appliqué

---

### 6. Update-Seats en Cas de Multiples → 409 + Demande stripe_subscription_id

**Action:**
1. Créer 2 abonnements actifs (ou simuler)
2. Tenter `POST /gerant/subscription/update-seats` sans `stripe_subscription_id`

**Réponse attendue:**
```json
{
  "detail": {
    "error": "MULTIPLE_ACTIVE_SUBSCRIPTIONS",
    "message": "2 abonnements actifs détectés. Vous devez spécifier 'stripe_subscription_id' pour cibler l'abonnement à modifier.",
    "active_subscriptions": [
      {
        "stripe_subscription_id": "sub_abc123",
        "workspace_id": "workspace-456",
        "price_id": "price_starter_monthly",
        "status": "active",
        "seats": 5,
        "created_at": "2024-01-01T00:00:00Z"
      },
      {
        "stripe_subscription_id": "sub_def456",
        "workspace_id": "workspace-789",
        "price_id": "price_pro_monthly",
        "status": "active",
        "seats": 10,
        "created_at": "2024-01-02T00:00:00Z"
      }
    ],
    "recommended_action": "USE_STRIPE_SUBSCRIPTION_ID",
    "hint": "Spécifiez 'stripe_subscription_id' dans la requête pour cibler un abonnement spécifique."
  }
}
```

**Status Code:** `409 Conflict`

**Status:** ❌ **NO-GO PROD** si 500 ou message non exploitable

---

## 📊 EXEMPLES DE SORTIES ATTENDUES

### Exemple 1: Script Anti-Doublons

**Sortie OK:**
```
🔍 Checking for duplicate stripe_subscription_id values...

✅ No duplicates found. Safe to create unique index.

🔍 Checking for null/missing stripe_subscription_id...

ℹ️  Found 3 subscriptions without stripe_subscription_id (legacy data)
   ✅ This is OK - index will be partial (sparse=True + partialFilterExpression)

✅ All checks passed.
```

---

### Exemple 2: Audit Endpoint Après Checkout Test

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
      "plan": "starter",
      "seats": 5,
      "billing_interval": "month",
      "workspace_id": "workspace-456",
      "price_id": "price_starter_monthly",
      "correlation_id": "550e8400-e29b-41d4-a716-446655440000",
      "checkout_session_id": "cs_test_abc123",
      "source": "app_checkout",
      "has_multiple_active": false,
      "last_event_created": 1704067200,
      "last_event_id": "evt_test_xyz789",
      "created_at": "2024-01-01T00:00:00Z",
      "current_period_end": "2024-02-01T00:00:00Z",
      "cancel_at_period_end": false
    }
  ],
  "status_counts": {
    "active": 1
  },
  "total_subscriptions": 1,
  "detected_issues": [],
  "recommended_action": "OK",
  "recommended_action_details": "No issues detected. Subscription status is healthy.",
  "audit_timestamp": "2024-01-07T12:00:00Z"
}
```

**Si multiples actifs:**
```json
{
  "success": true,
  "gerant_id": "gerant-123",
  "active_subscriptions_count": 2,
  "has_multiple_active": true,
  "active_subscriptions": [
    {
      "stripe_subscription_id": "sub_abc123",
      "workspace_id": "workspace-456",
      "price_id": "price_starter_monthly",
      "status": "active"
    },
    {
      "stripe_subscription_id": "sub_def456",
      "workspace_id": "workspace-789",
      "price_id": "price_pro_monthly",
      "status": "active"
    }
  ],
  "detected_issues": [
    {
      "severity": "warning",
      "type": "MULTIPLE_ACTIVE_SUBSCRIPTIONS",
      "message": "2 abonnements actifs détectés",
      "stripe_subscription_ids": ["sub_abc123", "sub_def456"]
    }
  ],
  "recommended_action": "CLEANUP_REQUIRED",
  "recommended_action_details": "Multiple active subscriptions detected but all have required metadata. Webhook cancellation logic can safely identify duplicates. Manual review recommended to verify which subscription should remain active."
}
```

---

### Exemple 3: Log Webhook Resend Ignoré

**Log attendu:**
```
[2024-01-07 12:00:00] INFO: 📥 Processing Stripe webhook: customer.subscription.created (id=evt_test_xyz789, created=1704067200)
[2024-01-07 12:00:00] INFO: ⏭️ IDEMPOTENT: Ignoring duplicate event evt_test_xyz789 for sub_test_abc123
```

**Vérification DB (avant et après):**
```json
// Avant resend
{
  "stripe_subscription_id": "sub_test_abc123",
  "last_event_id": "evt_test_xyz789",
  "last_event_created": 1704067200,
  "updated_at": "2024-01-07T11:00:00Z"
}

// Après resend (identique)
{
  "stripe_subscription_id": "sub_test_abc123",
  "last_event_id": "evt_test_xyz789",
  "last_event_created": 1704067200,
  "updated_at": "2024-01-07T11:00:00Z"  // ✅ Pas de changement
}
```

---

## 🚀 PROD - Si Tout Vert

### Déploiement

1. ✅ Déployer en production
2. ✅ Vérifier logs startup (index créé)
3. ✅ Monitorer logs 48h (patterns critiques)

### Monitoring Logs 48h

**Patterns à surveiller:**
- `MULTIPLE_ACTIVE_SUBSCRIPTIONS` → Comprendre pourquoi
- `MISSING_METADATA` → ❌ **ALERTE** si sur flux `app_checkout`
- `OUT-OF-ORDER EVENT` → ✅ OK (protection fonctionne)
- `duplicate_event_id` → ✅ OK (idempotence fonctionne)

### Audit sur 3-5 Comptes Réels

**Commandes:**
```bash
# Pour chaque compte test
GET /gerant/subscription/audit
```

**Vérifier:**
- `recommended_action` = "OK" (idéalement)
- `has_multiple_active` = false (idéalement)
- `detected_issues` = [] (idéalement)

---

## ✅ GO PRODUCTION - Critères

### ✅ GO PROD si:

- [x] Script doublons OK (sortie ci-dessus)
- [x] Index créé sans erreur (log ci-dessus)
- [x] Metadata présente sur subscription (vérifié dans Stripe Dashboard)
- [x] Replay webhook ignoré (log ci-dessus)
- [x] Checkout double bloqué (409)
- [x] Update-seats multiples → 409 avec payload propre

### ❌ NO-GO si:

- [ ] Script doublons détecte des doublons
- [ ] Index échoue à la création
- [ ] Metadata absente sur subscription
- [ ] Replay webhook modifie l'état
- [ ] Checkout double retourne 200 OK
- [ ] Update-seats multiples → 500 ou message non exploitable

---

## 📝 LIVRABLES POUR GO PROD

Pour obtenir un **GO PRODUCTION** immédiat, fournir:

1. **Sortie du script `check_subscription_duplicates.py`**
   - Même si c'est 2 lignes
   - Exemple: `✅ No duplicates found. Safe to create unique index.`

2. **Exemple de réponse `/gerant/subscription/audit` en staging**
   - Après un checkout test
   - Montrer que metadata est présente

3. **Log d'un webhook "resend" ignoré**
   - Montrer `duplicate_event_id` dans les logs
   - Montrer que DB n'a pas changé

---

**Fin de la checklist**
