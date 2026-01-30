# 🔍 DIAGNOSTIC : ERREUR 500 LORS DU CHECKOUT STRIPE

**Date**: 23 Janvier 2026  
**Problème**: Erreur 500 lors de la création d'une session de checkout Stripe (`POST /api/gerant/stripe/checkout`)

---

## ✅ CORRECTIFS APPLIQUÉS

### Amélioration de la gestion d'erreurs (commit `ecf9c385`)

**Validations ajoutées**:
1. ✅ Vérification que `STRIPE_PRICE_ID_MONTHLY` ou `STRIPE_PRICE_ID_YEARLY` est configuré
2. ✅ Vérification que `origin_url` est fourni et non vide
3. ✅ Vérification que le gérant existe dans la base de données
4. ✅ Gestion spécifique des erreurs Stripe (`InvalidRequestError` vs `StripeError`)
5. ✅ Logging amélioré avec `exc_info=True` pour stack trace complète

---

## 🔍 CAUSES POSSIBLES DE L'ERREUR 500

### 1. Variables d'environnement manquantes

**Symptôme**: Message d'erreur "Configuration Stripe incomplète: Price ID manquant"

**Vérification**:
```bash
# Vérifier dans Vercel Dashboard → Settings → Environment Variables
STRIPE_PRICE_ID_MONTHLY=price_xxxxx
STRIPE_PRICE_ID_YEARLY=price_xxxxx
```

**Solution**: Ajouter les variables d'environnement manquantes dans Vercel

---

### 2. Profil de facturation incomplet

**Symptôme**: Message d'erreur 400 "Profil de facturation incomplet"

**Vérification**:
- Le profil de facturation B2B doit être complété avant de créer un checkout
- Champs obligatoires: `company_name`, `billing_email`, `address_line1`, `postal_code`, `city`, `country`, `country_code`
- Si pays UE hors FR: `vat_number` obligatoire et validé

**Solution**: Compléter le profil de facturation via `/api/gerant/billing-profile`

---

### 3. Abonnement actif existant

**Symptôme**: Message d'erreur 409 "Un abonnement actif existe déjà"

**Vérification**:
- Vérifier dans la base de données: `db.subscriptions.find({"user_id": gerant_id, "status": {"$in": ["active", "trialing"]}})`
- Vérifier dans Stripe Dashboard si l'abonnement existe encore

**Solution**: 
- Annuler l'abonnement existant via `/api/gerant/subscription/cancel`
- Ou utiliser "Modifier mon abonnement" au lieu de créer un nouveau

---

### 4. Erreur Stripe API

**Symptôme**: Message d'erreur "Erreur Stripe: [détails]"

**Causes possibles**:
- `price_id` invalide (n'existe pas dans Stripe)
- `customer_id` invalide
- Problème de connexion à l'API Stripe
- Clé API Stripe invalide ou expirée

**Vérification**:
1. Vérifier dans Stripe Dashboard que le `price_id` existe
2. Vérifier que `STRIPE_API_KEY` est correcte (mode test vs production)
3. Vérifier les logs Stripe Dashboard pour les erreurs API

---

### 5. Gérant non trouvé

**Symptôme**: Message d'erreur 404 "Gérant non trouvé"

**Vérification**:
- Vérifier que `current_user['id']` existe dans `db.users`
- Vérifier que le token JWT est valide

**Solution**: Vérifier l'authentification et la session utilisateur

---

## 📋 CHECKLIST DE DIAGNOSTIC

### Étape 1 : Vérifier les logs Vercel

1. Aller sur https://vercel.com
2. Ouvrir le projet → "Deployments" → Dernier déploiement
3. Cliquer sur "Functions" → Chercher les logs de `/api/gerant/stripe/checkout`
4. Chercher les messages d'erreur avec `❌` ou `ERROR`

**Messages à chercher**:
- `❌ STRIPE_PRICE_ID_MONTHLY/YEARLY non configuré`
- `❌ origin_url manquant`
- `❌ Gérant {id} non trouvé`
- `❌ Erreur Stripe InvalidRequestError`
- `❌ Erreur Stripe`

---

### Étape 2 : Vérifier les variables d'environnement

**Dans Vercel Dashboard**:
1. Settings → Environment Variables
2. Vérifier que ces variables existent:
   - `STRIPE_API_KEY` (commence par `sk_test_` ou `sk_live_`)
   - `STRIPE_PRICE_ID_MONTHLY` (commence par `price_`)
   - `STRIPE_PRICE_ID_YEARLY` (commence par `price_`)

**Si manquantes**:
- Ajouter les variables dans Vercel
- Redéployer l'application

---

### Étape 3 : Vérifier le profil de facturation

**Endpoint de vérification**:
```bash
GET /api/gerant/billing-profile
Authorization: Bearer {token}
```

**Vérifier**:
- `billing_profile_completed: true`
- Tous les champs obligatoires présents
- Si pays UE hors FR: `vat_number_validated: true`

---

### Étape 4 : Vérifier les abonnements existants

**Endpoint de vérification**:
```bash
GET /api/gerant/subscriptions
Authorization: Bearer {token}
```

**Vérifier**:
- `active_subscriptions: 0` (ou annuler l'abonnement existant)
- Pas d'abonnement avec `status: "active"` ou `"trialing"`

---

### Étape 5 : Tester avec curl

**Commande de test**:
```bash
curl -X POST https://api.retailperformerai.com/api/gerant/stripe/checkout \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "origin_url": "https://retailperformerai.com",
    "billing_period": "monthly"
  }'
```

**Analyser la réponse**:
- Si 400: Vérifier le message d'erreur (profil facturation, abonnement existant)
- Si 500: Vérifier les logs Vercel pour la stack trace complète

---

## 🛠️ SOLUTIONS PAR TYPE D'ERREUR

### Erreur: "Configuration Stripe incomplète: Price ID manquant"

**Solution**:
1. Aller dans Vercel Dashboard → Settings → Environment Variables
2. Ajouter `STRIPE_PRICE_ID_MONTHLY` et `STRIPE_PRICE_ID_YEARLY`
3. Obtenir les Price IDs depuis Stripe Dashboard:
   - Products → Sélectionner le produit
   - Copier le Price ID (commence par `price_`)
4. Redéployer l'application

---

### Erreur: "Profil de facturation incomplet"

**Solution**:
1. Compléter le profil via l'interface ou l'API:
   ```bash
   POST /api/gerant/billing-profile
   {
     "company_name": "...",
     "billing_email": "...",
     "address_line1": "...",
     "postal_code": "...",
     "city": "...",
     "country": "FR",
     "country_code": "FR"
   }
   ```
2. Si pays UE hors FR: Ajouter et valider `vat_number`
3. Réessayer le checkout

---

### Erreur: "Un abonnement actif existe déjà"

**Solution**:
1. Option 1: Annuler l'abonnement existant
   ```bash
   POST /api/gerant/subscription/cancel
   {"cancel_immediately": false}
   ```
2. Option 2: Utiliser "Modifier mon abonnement" au lieu de créer un nouveau

---

### Erreur Stripe: "No such price: price_xxxxx"

**Solution**:
1. Vérifier dans Stripe Dashboard que le Price ID existe
2. Vérifier que vous utilisez le bon Price ID (test vs production)
3. Si le Price ID a changé, mettre à jour les variables d'environnement

---

### Erreur Stripe: "Invalid API Key"

**Solution**:
1. Vérifier que `STRIPE_API_KEY` est correcte
2. Vérifier que vous utilisez la bonne clé (test vs production)
3. Vérifier que la clé n'a pas expiré ou été révoquée

---

## 📊 LOGS À ANALYSER

### Logs Vercel (Functions)

**Chercher**:
```
❌ Erreur création session checkout: ...
```

**Informations importantes**:
- Stack trace complète (avec `exc_info=True`)
- Type d'erreur (AttributeError, ValueError, StripeError, etc.)
- Ligne de code exacte où l'erreur se produit

---

### Logs Stripe Dashboard

**Chercher**:
1. Aller sur https://dashboard.stripe.com
2. "Logs" → Chercher les erreurs récentes
3. Vérifier les erreurs liées à `checkout.Session.create`

**Informations importantes**:
- Type d'erreur Stripe
- Message d'erreur détaillé
- Paramètres de la requête qui a échoué

---

## 🎯 PROCHAINES ÉTAPES

1. **Après le déploiement** (Job ID: `mhEPCh0LOVRYLKcQiit0`):
   - Attendre 2-3 minutes
   - Réessayer de créer un checkout
   - Vérifier les logs Vercel pour le message d'erreur exact

2. **Si l'erreur persiste**:
   - Copier le message d'erreur exact depuis les logs
   - Vérifier les variables d'environnement dans Vercel
   - Vérifier le profil de facturation
   - Vérifier les abonnements existants

3. **Si besoin d'aide**:
   - Fournir le message d'erreur exact
   - Fournir les logs Vercel (stack trace)
   - Indiquer les variables d'environnement configurées (sans les valeurs)

---

*Document créé le 23 Janvier 2026*
