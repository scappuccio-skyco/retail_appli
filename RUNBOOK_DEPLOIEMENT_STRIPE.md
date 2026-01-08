# 🚀 RUNBOOK DÉPLOIEMENT STRIPE SUBSCRIPTIONS

**Date:** 2026-01-07  
**Version:** 1.0  
**Status:** ✅ GO STAGING

---

## 📋 ACTIONS IMMÉDIATES EN STAGING (ORDRE STRICT)

### A. 🔴 BLOQUANT - Script Anti-Doublons

```bash
python backend/scripts/check_subscription_duplicates.py
```

**Attendu:**
- ✅ `0 doublon de stripe_subscription_id`
- ✅ `0 "suspects" vides` (idéalement)

**Si doublons détectés:**
- ❌ **NO-GO PROD** tant que non nettoyé
- Action: Nettoyer manuellement les doublons avant de continuer

---

### B. Démarrage API + Création Index

**Actions:**
1. Démarrer staging
2. Vérifier logs startup

**Attendu dans les logs:**
```
✅ Created unique index on stripe_subscription_id (partial filter)
```

**Si erreur:**
- ❌ **NO-GO PROD**
- Vérifier les doublons avec le script
- Nettoyer si nécessaire

---

### C. Test Stripe (Test Mode) - 3 Scénarios

#### Scénario 1: Premier Checkout (Mensuel)

**Actions:**
1. Créer checkout via `/gerant/stripe/checkout`
2. Compléter paiement dans Stripe Test Mode
3. Vérifier dans Stripe Dashboard → Subscription → Metadata

**Attendu dans `subscription.metadata`:**
- ✅ `checkout_session_id` présent
- ✅ `correlation_id` présent
- ✅ `workspace_id` présent
- ✅ `price_id` présent
- ✅ `source` = "app_checkout"
- ✅ `user_id` présent

**Si metadata absente:**
- ❌ **NO-GO PROD**
- Vérifier configuration Stripe `subscription_data.metadata`

---

#### Scénario 2: Re-tenter Checkout avec Abonnement Actif

**Actions:**
1. Avec un abonnement actif existant
2. Tenter de créer un nouveau checkout

**Attendu:**
- ✅ HTTP 409 `ACTIVE_SUBSCRIPTION_EXISTS`
- ✅ Message explicite: "Vous avez déjà un abonnement actif..."

**Si 200 OK ou autre code:**
- ❌ **NO-GO PROD**
- Vérifier la logique de blocage dans `create_gerant_checkout_session`

---

#### Scénario 3: Replay Webhook

**Actions:**
1. Dans Stripe Dashboard → Webhooks → Sélectionner un event `customer.subscription.created`
2. Cliquer "Resend event"
3. Vérifier logs backend

**Attendu dans les logs:**
```
⏭️ IDEMPOTENT: Ignoring duplicate event evt_xxx for sub_xxx
```

**Attendu en DB:**
- ✅ Aucune modification (même `updated_at`)

**Si webhook appliqué:**
- ❌ **NO-GO PROD**
- Vérifier la logique d'idempotence avec `event.id`

---

### D. Test Multi-Workspace / Multi-Product (Si Applicable)

**Actions:**
1. Créer 2 subscriptions (2 workspaces différents OU 2 price_id différents)
2. Appeler `GET /gerant/subscription/status`

**Attendu:**
- ✅ Retourne la subscription du bon workspace (si applicable)
- ✅ `has_multiple_active: true`
- ✅ `active_subscriptions_count: 2`

**Si sélection incorrecte:**
- ❌ **NO-GO PROD**
- Vérifier la logique de sélection dans `get_subscription_status`

---

## 🔍 SURVEILLANCE LOGS STAGING

### Patterns à Chercher

| Pattern | Signification | Action |
|---------|---------------|--------|
| `MULTIPLE_ACTIVE_SUBSCRIPTIONS` | Plusieurs abonnements actifs détectés | ✅ OK si logique de sélection fonctionne |
| `MISSING_METADATA` | Metadata manquante sur subscription | ❌ **NO-GO PROD** si sur flux `app_checkout` |
| `MISSING_CORRELATION_ID` | `correlation_id` absent | ❌ **NO-GO PROD** si sur flux `app_checkout` |
| `MISSING_PRICE_ID` | `price_id` absent | ❌ **NO-GO PROD** si sur flux `app_checkout` |
| `OUT-OF-ORDER EVENT` | Event plus ancien ignoré | ✅ OK (protection fonctionne) |
| `duplicate_event_id` | Event rejoué ignoré | ✅ OK (idempotence fonctionne) |

### Commandes de Monitoring

```bash
# Chercher les patterns critiques
grep -i "MULTIPLE_ACTIVE_SUBSCRIPTIONS" logs/backend.log
grep -i "MISSING_METADATA\|MISSING_CORRELATION_ID\|MISSING_PRICE_ID" logs/backend.log
grep -i "OUT-OF-ORDER EVENT\|duplicate_event_id" logs/backend.log
```

**Objectif:** En staging, tu peux voir ces patterns, mais tu dois comprendre pourquoi.

**Si `MISSING_METADATA` sur flux `app_checkout`:**
- ❌ **NO-GO PROD**
- Corrélation pas fiable
- Vérifier propagation metadata Stripe

---

## ✅ GO PRODUCTION - Critères Ultra Clairs

### ✅ GO PROD si:

- [x] Script doublons OK (0 doublon)
- [x] Index OK (créé sans erreur)
- [x] Metadata présente sur subscription Stripe
- [x] Replay webhook ignoré (pas de modification DB)
- [x] Checkout double bloqué (409)

### ❌ NO-GO si:

- [ ] L'index unique échoue à la création
- [ ] Metadata absente sur subscription
- [ ] Un replay webhook modifie l'état
- [ ] Annulation webhook déclenchée sans toutes les conditions (source + corrélation + workspace + price)

---

## 📊 POST-DÉPLOIEMENT PROD (48h)

### 1. Log Level Suffisant

**Configurer:**
```python
# Dans settings ou config
LOG_LEVEL = "INFO"  # Ou "DEBUG" pour subscription events
```

**Patterns à monitorer:**
- `MULTIPLE_ACTIVE_SUBSCRIPTIONS`
- `MISSING_METADATA`
- `OUT-OF-ORDER EVENT`
- `duplicate_event_id`

### 2. Utiliser Endpoint Audit

**Sur comptes test:**
```bash
GET /gerant/subscription/audit
```

**Vérifier:**
- `recommended_action` = "OK" (idéalement)
- `detected_issues` = [] (idéalement)
- `has_multiple_active` = false (idéalement)

**Sur quelques vrais gérants:**
- Vérifier qu'aucun `MULTIPLE_ACTIVE_SUBSCRIPTIONS` non résolu
- Vérifier que `recommended_action` est approprié

### 3. Script de Vérification Régulier

**Exécuter quotidiennement (premiers jours):**
```bash
python backend/scripts/check_subscription_duplicates.py
```

**Si doublons détectés:**
- Analyser la cause
- Nettoyer si nécessaire
- Documenter l'incident

---

## 🔴 POINTS CRITIQUES À NE PAS OUBLIER

### 1. Update Seats - Protection Multiples

**Correction appliquée:**
- ✅ `update_seats` refuse si `has_multiple_active=true` sans `stripe_subscription_id`
- ✅ Force un `stripe_subscription_id` explicite si multiples actifs

**Code:**
```python
if len(active_subscriptions) > 1:
    if not stripe_subscription_id:
        raise ValueError("MULTIPLE_ACTIVE_SUBSCRIPTIONS: stripe_subscription_id requis")
```

**Test:**
1. Créer 2 abonnements actifs
2. Tenter `update_seats` sans `stripe_subscription_id`
3. Attendu: Erreur avec message explicite

---

## 📝 CHECKLIST DÉPLOIEMENT

### Pre-Déploiement

- [ ] Script doublons exécuté → 0 doublon
- [ ] Index créé sans erreur en staging
- [ ] Metadata Stripe testée → présente
- [ ] Replay webhook testé → ignoré
- [ ] Checkout double testé → 409
- [ ] Update seats testé avec multiples → erreur si pas de `stripe_subscription_id`

### Déploiement

- [ ] Déployer en staging
- [ ] Vérifier logs startup
- [ ] Exécuter tests Stripe
- [ ] Monitorer logs 24h

### Post-Déploiement

- [ ] Activer log level suffisant
- [ ] Utiliser `/gerant/subscription/audit` sur comptes test
- [ ] Monitorer patterns critiques
- [ ] Exécuter script doublons quotidiennement (premiers jours)

---

## 🚨 PIÈGES À ÉVITER

### ❌ Ne PAS:

1. **Ignorer les doublons détectés par le script**
   - → Index unique échouera
   - → Service ne démarrera pas

2. **Déployer si metadata absente sur subscription**
   - → Corrélation impossible
   - → Annulation automatique ne fonctionnera pas

3. **Accepter un replay webhook qui modifie l'état**
   - → Idempotence cassée
   - → Doublons possibles

4. **Permettre update_seats sans stripe_subscription_id si multiples**
   - → Modification du mauvais abonnement
   - → Data corruption

5. **Déployer sans tester replay webhook**
   - → Risque de régression en prod

---

## ✅ CONCLUSION

**STATUS:** ✅ **GO STAGING**

**Prochaines étapes:**
1. Exécuter script doublons
2. Déployer en staging
3. Exécuter tests Stripe
4. Monitorer logs 24h
5. Si tout OK → **GO PROD**

**Durée estimée:** 2-4h (staging) + 24h monitoring → GO PROD

---

**Fin du runbook**
