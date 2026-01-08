# 🚀 RUN STAGING - EXÉCUTION RÉELLE

**Date:** 2026-01-07  
**Status:** ⏳ **EN ATTENTE D'EXÉCUTION**

---

## ⚠️ LIMITATIONS

Les tests suivants nécessitent un environnement réel :
- ✅ Script doublons : Nécessite MongoDB connecté
- ✅ Checkout Stripe : Nécessite Stripe Test Mode + compte test
- ✅ Webhook replay : Nécessite Stripe Dashboard + webhook configuré

**Ces tests doivent être exécutés manuellement dans l'environnement staging.**

---

## 📋 COMMANDES À EXÉCUTER

### 1. Script Anti-Doublons

**Commande:**
```bash
# Activer l'environnement virtuel
source venv/bin/activate  # Linux/Mac
# ou
venv\Scripts\activate  # Windows

# Exécuter le script
python backend/scripts/check_subscription_duplicates.py
```

**Sortie attendue (à copier-coller):**
```
🔍 Checking for duplicate stripe_subscription_id values...

✅ No duplicates found. Safe to create unique index.

🔍 Checking for null/missing stripe_subscription_id...

ℹ️  Found X subscriptions without stripe_subscription_id (legacy data)
   ✅ This is OK - index will be partial (sparse=True + partialFilterExpression)

✅ All checks passed.
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
   ```json
   {
     "quantity": 5,
     "billing_period": "monthly",
     "origin_url": "http://localhost:3000"
   }
   ```

2. Compléter paiement dans Stripe Test Mode (carte test: 4242 4242 4242 4242)

3. Vérifier dans Stripe Dashboard → Subscriptions → Ouvrir la subscription → Metadata

**Vérifier que metadata contient:**
- `correlation_id`
- `checkout_session_id`
- `user_id`
- `workspace_id`
- `source: "app_checkout"`
- `price_id`

---

### 4. 2e Checkout → 409

**Action:**
1. Avec l'abonnement actif créé à l'étape 3
2. Tenter `POST /gerant/stripe/checkout` (même payload)

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
1. Stripe Dashboard → Webhooks → Events
2. Sélectionner un event `customer.subscription.created` récent
3. Cliquer "Resend event"
4. Vérifier logs backend

**Log attendu (à copier-coller):**
```
[2024-01-07 12:00:00] INFO: 📥 Processing Stripe webhook: customer.subscription.created (id=evt_test_xyz789, created=1704067200)
[2024-01-07 12:00:00] INFO: ⏭️ IDEMPOTENT: Ignoring duplicate event evt_test_xyz789 for sub_test_abc123
```

**Ou si JSON retourné:**
```json
{
  "status": "skipped",
  "reason": "duplicate_event_id",
  "event_id": "evt_test_xyz789"
}
```

---

### 6. GET /gerant/subscription/audit

**Requête:**
```bash
GET /api/gerant/subscription/audit
Authorization: Bearer <token>
```

**Réponse attendue (à copier-coller en JSON brut):**
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
      "created_at": "2024-01-07T12:00:00Z",
      "current_period_end": "2024-02-07T12:00:00Z",
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

---

## 📊 LIVRABLES POUR GO PROD

**Fournir ces 3 sorties (copier-coller brut):**

### 1. Sortie de check_subscription_duplicates.py

```
[COLLER ICI LA SORTIE BRUTE DU SCRIPT]
```

---

### 2. Réponse JSON de GET /gerant/subscription/audit

```json
[COLLER ICI LA RÉPONSE JSON BRUTE]
```

---

### 3. Trace de replay webhook

```
[COLLER ICI LE LOG BRUT]
```

**Ou JSON:**
```json
[COLLER ICI LE JSON DE RÉPONSE]
```

---

## ✅ CORRECTIONS FINALES APPLIQUÉES

### Priorité IP Corrigée

**Nouvelle priorité:**
1. `cf-connecting-ip` (Cloudflare - most trusted)
2. `x-real-ip` (Nginx/Proxy standard)
3. `x-forwarded-for` (Standard proxy - première IP)
4. `x-vercel-forwarded-for` / `x-railway-client-ip` (Platform-specific)
5. `client.host` (Direct connection - fallback)

**Code:**
```python
if cf_connecting_ip:  # Cloudflare (most trusted)
    client_ip = cf_connecting_ip.split(",")[0].strip()
elif x_real_ip:  # Nginx/Proxy standard
    client_ip = x_real_ip.split(",")[0].strip()
elif x_forwarded_for:  # Standard proxy header (first IP)
    client_ip = x_forwarded_for.split(",")[0].strip()
# ... platform headers ...
```

---

**Status:** ✅ **PRÊT POUR EXÉCUTION MANUELLE**

Une fois les 3 sorties fournies → **GO PRODUCTION** ou **NO-GO** avec cause exacte.
