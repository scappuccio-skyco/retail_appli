# 🚀 GO/NO-GO CHECKLIST - DÉPLOIEMENT STRIPE SUBSCRIPTIONS

**Date:** 2026-01-07  
**Status:** ⏳ **EN ATTENTE DE VALIDATION**

---

## ✅ CRITÈRES D'ACCEPTATION

### 1. ✅ Vérification Propagation Metadata Stripe

**Test à effectuer en Stripe Test Mode:**

1. Créer un checkout via `/gerant/stripe/checkout`
2. Terminer le paiement
3. Dans le Dashboard Stripe → Ouvrir la Subscription générée
4. **Vérifier que `metadata` est bien présente sur la Subscription** (pas seulement sur la Session)

**Critère d'acceptation:**
- ✅ Dans `subscription.created` webhook, `subscription.metadata.checkout_session_id` est présent
- ✅ Dans `subscription.created` webhook, `subscription.metadata.correlation_id` est présent
- ✅ Dans `subscription.created` webhook, `subscription.metadata.source` = "app_checkout"

**Code de vérification:**
```python
# Dans _handle_subscription_created()
subscription_metadata = subscription.get('metadata', {})
checkout_session_id = subscription_metadata.get('checkout_session_id')
correlation_id = subscription_metadata.get('correlation_id')

# ✅ VALIDATION ajoutée: Log warning si metadata manquante
if not checkout_session_id and source == 'app_checkout':
    logger.warning(f"⚠️ WARNING: Subscription {subscription_id} from app_checkout but no checkout_session_id in metadata")
```

**Status:** ✅ Code prêt, **À TESTER EN STRIPE TEST MODE**

---

### 2. ✅ Vérification Index Unique (MongoDB)

**Test à effectuer AVANT déploiement:**

1. Exécuter le script de vérification:
   ```bash
   python backend/scripts/check_subscription_duplicates.py
   ```

2. Vérifier les résultats:
   - ❌ Si doublons trouvés → **NO-GO** (nettoyer d'abord)
   - ✅ Si pas de doublons → **GO**

**Index créé:**
```python
# Index unique avec partialFilterExpression (gère les nulls)
await db.subscriptions.create_index(
    "stripe_subscription_id",
    unique=True,
    partialFilterExpression={
        "stripe_subscription_id": {"$exists": True, "$type": "string", "$ne": ""}
    },
    background=True,
    name="unique_stripe_subscription_id"
)
```

**Protection:**
- ✅ Index `sparse=True` (ignore les nulls)
- ✅ `partialFilterExpression` (uniquement si existe et est string)
- ✅ Gestion d'erreur avec détection de doublons

**Status:** ✅ Code prêt avec gestion d'erreur, **À VÉRIFIER AVEC SCRIPT**

---

### 3. ✅ Webhook Idempotence avec event.id

**Amélioration appliquée:**

```python
# ✅ ULTRA-SAFE: Check event.id first (true unique key)
if event_id and last_event_id and event_id == last_event_id:
    return {"status": "skipped", "reason": "duplicate_event_id"}

# ✅ Check event.created (with fallback to event.id if equal)
if event_created == last_event_created and event_id and last_event_id:
    if event_id <= last_event_id:
        return {"status": "skipped", "reason": "out_of_order_event_same_timestamp"}
```

**Critère d'acceptation:**
- ✅ Webhook replay (resend) ne modifie pas l'état
- ✅ Events avec même `created` mais `id` différent sont gérés
- ✅ Events avec même `id` sont ignorés (idempotence)

**Status:** ✅ Code implémenté

---

## 🚀 GO/NO-GO DÉCISION

### ✅ GO si:

- [ ] **Metadata confirmée sur subscription en test Stripe**
  - [ ] `subscription.metadata.checkout_session_id` présent
  - [ ] `subscription.metadata.correlation_id` présent
  - [ ] `subscription.metadata.source` = "app_checkout"

- [ ] **Index unique créé sans erreur en staging**
  - [ ] Script `check_subscription_duplicates.py` passe
  - [ ] Pas de doublons détectés
  - [ ] Index créé avec succès au startup

- [ ] **Webhook replay (resend) ne modifie pas l'état**
  - [ ] Replay même event.id → ignoré
  - [ ] Replay event plus ancien → ignoré
  - [ ] Replay event plus récent → appliqué

### ❌ NO-GO si:

- [ ] **Metadata absent sur subscription**
  - [ ] `checkout_session_id` manquant dans `subscription.metadata`
  - [ ] `correlation_id` manquant
  - **Action:** Vérifier `subscription_data.metadata` dans checkout

- [ ] **Index unique échoue (données legacy à nettoyer)**
  - [ ] Doublons détectés par script
  - [ ] Erreur à la création d'index
  - **Action:** Nettoyer doublons avant déploiement

- [ ] **Un vieux webhook peut "désactiver" un statut plus récent**
  - [ ] Event plus ancien écrase un plus récent
  - [ ] `last_event_created` non stocké correctement
  - **Action:** Vérifier logique d'ordering

---

## 🔍 TESTS À EFFECTUER

### Test 1: Metadata Propagation
```bash
# 1. Créer checkout
POST /gerant/stripe/checkout
{
  "quantity": 5,
  "billing_period": "monthly",
  "origin_url": "http://localhost:3000"
}

# 2. Compléter paiement dans Stripe Test Mode

# 3. Vérifier dans Stripe Dashboard:
#    - Subscription → Metadata → Doit contenir:
#      * checkout_session_id
#      * correlation_id
#      * user_id
#      * workspace_id
#      * source: "app_checkout"
#      * price_id
```

### Test 2: Index Unique
```bash
# Exécuter script de vérification
python backend/scripts/check_subscription_duplicates.py

# Vérifier output:
# ✅ No duplicates found. Safe to create unique index.
# OU
# ❌ Found X duplicate stripe_subscription_id values
```

### Test 3: Webhook Idempotence
```bash
# 1. Recevoir webhook subscription.created (event_id: evt_123)
# 2. Replay même webhook (event_id: evt_123)
# 3. Vérifier logs: "⏭️ IDEMPOTENT: Ignoring duplicate event evt_123"
# 4. Vérifier DB: Pas de modification
```

---

## 📊 ENDPOINT D'AUDIT

**Endpoint créé:** `GET /gerant/subscription/audit`

**Retourne:**
- `active_subscriptions_count`
- Liste des `stripe_subscription_id` actifs
- `has_multiple_active`
- `last_event_created` / `last_event_id` pour chaque abonnement
- Metadata clés (`workspace_id`, `price_id`, `correlation_id`)
- Liste des `issues` détectés

**Utilisation:**
```bash
GET /gerant/subscription/audit

# Réponse:
{
  "active_subscriptions_count": 2,
  "has_multiple_active": true,
  "active_subscriptions": [
    {
      "stripe_subscription_id": "sub_123",
      "workspace_id": "workspace-A",
      "price_id": "price_starter_monthly",
      "correlation_id": "corr_abc",
      "last_event_created": 1704067200,
      "last_event_id": "evt_xyz"
    }
  ],
  "issues": [
    {
      "severity": "warning",
      "type": "MULTIPLE_ACTIVE_SUBSCRIPTIONS",
      "message": "2 abonnements actifs détectés"
    }
  ]
}
```

---

## ✅ CORRECTIONS APPLIQUÉES

### 1. ✅ Metadata Propagation
- ✅ `subscription_data.metadata` configuré avec tous les champs
- ✅ `client_reference_id` ajouté
- ✅ Validation dans webhook avec warning si metadata manquante

### 2. ✅ Index Unique Partial
- ✅ `partialFilterExpression` pour gérer nulls
- ✅ Gestion d'erreur avec détection de doublons
- ✅ Script de vérification créé

### 3. ✅ Webhook Idempotence Ultra-Safe
- ✅ Check `event.id` en premier (true unique key)
- ✅ Check `event.created` avec fallback `event.id` si égal
- ✅ Stockage `last_event_id` et `last_event_created`

### 4. ✅ Endpoint Audit
- ✅ `GET /gerant/subscription/audit` créé
- ✅ Retourne toutes les infos de diagnostic
- ✅ Détecte automatiquement les issues

---

## 📝 PROCHAINES ÉTAPES

1. **Tester en Stripe Test Mode:**
   - Créer checkout → Vérifier metadata sur subscription
   - Confirmer que `subscription.metadata.checkout_session_id` est présent

2. **Vérifier index:**
   - Exécuter `check_subscription_duplicates.py`
   - Si doublons → nettoyer avant déploiement

3. **Tester webhook replay:**
   - Replay même event → doit être ignoré
   - Vérifier logs et DB

4. **Déployer en staging:**
   - Vérifier que index se crée sans erreur
   - Tester endpoint audit
   - Monitorer logs

5. **Déployer en production:**
   - Une fois tous les tests passés

---

**Status Final:** ⏳ **EN ATTENTE DE TESTS STRIPE**
