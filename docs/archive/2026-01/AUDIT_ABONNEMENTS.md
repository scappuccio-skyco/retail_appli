# 🔍 AUDIT COMPLET - PROCESSUS D'ABONNEMENT

**Date:** 2026-01-07  
**Objectif:** Identifier les problèmes dans le processus d'abonnement et vérifier la présence de tous les endpoints nécessaires

---

## 📋 RÉSUMÉ EXÉCUTIF

### Problème Principal Identifié
**Les abonnements multiples ne sont pas gérés correctement.** Lorsqu'un client change d'abonnement (mensuel → annuel), l'ancien abonnement n'est **PAS annulé**, ce qui crée des abonnements multiples actifs pour le même client.

### Impact
- **Double facturation** : Le client est facturé pour deux abonnements simultanément
- **Confusion dans l'UI** : L'application peut afficher des informations incohérentes
- **Problèmes de synchronisation** : Les webhooks Stripe peuvent mettre à jour le mauvais abonnement

---

## 🔎 ANALYSE DÉTAILLÉE

### 1. ENDPOINTS EXISTANTS

#### ✅ Endpoints Présents et Fonctionnels

| Endpoint | Méthode | Route | Description | Statut |
|----------|---------|-------|-------------|--------|
| **Statut abonnement** | GET | `/gerant/subscription/status` | Récupère le statut de l'abonnement actif | ✅ OK |
| **Mise à jour sièges** | POST | `/gerant/subscription/update-seats` | Augmente/diminue le nombre de sièges | ✅ OK |
| **Prévisualisation** | POST | `/gerant/subscription/preview` | Aperçu des changements (sièges + intervalle) | ✅ OK |
| **Changement intervalle** | POST | `/gerant/subscription/switch-interval` | Mensuel ↔ Annuel (avec restrictions) | ⚠️ PARTIEL |
| **Création checkout** | POST | `/gerant/stripe/checkout` | Crée une session Stripe Checkout | ⚠️ PROBLÈME |

#### ❌ Endpoints Manquants

| Endpoint | Méthode | Route | Description | Priorité |
|----------|---------|-------|-------------|----------|
| **Annulation abonnement** | POST | `/gerant/subscription/cancel` | Annule un abonnement actif | 🔴 CRITIQUE |
| **Réactivation abonnement** | POST | `/gerant/subscription/reactivate` | Réactive un abonnement annulé | 🟡 MOYENNE |
| **Liste abonnements** | GET | `/gerant/subscriptions` | Liste tous les abonnements (actifs + annulés) | 🟡 MOYENNE |
| **Historique abonnements** | GET | `/gerant/subscription/history` | Historique des changements d'abonnement | 🟢 BASSE |

---

### 2. PROBLÈMES IDENTIFIÉS

#### 🔴 CRITIQUE : Création d'abonnements multiples

**Fichier:** `backend/api/routes/gerant.py` (ligne 1107-1231)  
**Fichier:** `backend/services/payment_service.py` (ligne 331-398)

**Problème:**
Lors de la création d'un nouveau checkout Stripe, le code ne vérifie **PAS** s'il existe déjà un abonnement actif. Il crée simplement un nouveau checkout qui génère un **nouvel abonnement Stripe** sans annuler l'ancien.

**Code problématique:**
```python
# backend/api/routes/gerant.py:1107
@router.post("/stripe/checkout")
async def create_gerant_checkout_session(...):
    # ❌ AUCUNE VÉRIFICATION d'abonnement existant
    # ❌ AUCUNE ANNULATION d'abonnement précédent
    
    session = stripe.checkout.Session.create(
        customer=stripe_customer_id,
        mode='subscription',  # Crée TOUJOURS un nouvel abonnement
        ...
    )
```

**Webhook handler:**
```python
# backend/services/payment_service.py:331
async def _handle_checkout_completed(self, session: Dict):
    # ❌ Utilise upsert=True qui MET À JOUR ou CRÉE
    # ❌ Ne vérifie pas les abonnements existants
    await self.db.subscriptions.update_one(
        {"user_id": gerant['id']},
        {"$set": update_data},
        upsert=True  # ⚠️ Peut créer un DUPLICAT si user_id existe déjà
    )
```

**Impact:**
- Un client peut avoir **plusieurs abonnements actifs** dans Stripe
- Chaque abonnement génère des factures séparées
- Les webhooks peuvent mettre à jour le mauvais abonnement

---

#### 🟡 MOYENNE : Récupération d'abonnement unique

**Fichier:** `backend/services/gerant_service.py` (ligne 602-766)

**Problème:**
La fonction `get_subscription_status()` utilise `find_one()` qui ne retourne **qu'un seul abonnement**, même si plusieurs existent. Elle ne détecte pas les abonnements multiples.

**Code:**
```python
# backend/services/gerant_service.py:745
db_subscription = await self.db.subscriptions.find_one(
    {"user_id": gerant_id, "status": {"$in": ["active", "trialing"]}},
    {"_id": 0}
)
# ❌ Retourne seulement le PREMIER abonnement trouvé
# ❌ Ignore les autres abonnements actifs
```

**Impact:**
- L'application peut afficher des informations incorrectes
- Les mises à jour peuvent cibler le mauvais abonnement

---

#### 🟡 MOYENNE : Gestion du changement d'intervalle

**Fichier:** `backend/api/routes/gerant.py` (ligne 1521-1670)

**Statut:** ✅ **Partiellement fonctionnel**

**Points positifs:**
- ✅ Bloque correctement le passage annuel → mensuel (ligne 1569-1573)
- ✅ Permet le passage mensuel → annuel (ligne 1568)
- ✅ Utilise `stripe.Subscription.modify()` pour modifier l'abonnement existant

**Points à améliorer:**
- ⚠️ Ne vérifie pas s'il existe d'autres abonnements actifs avant la modification
- ⚠️ Ne gère pas le cas où plusieurs abonnements existent (mensuel + annuel)

---

#### 🟢 BASSE : Gestion des webhooks

**Fichier:** `backend/services/payment_service.py`

**Statut:** ✅ **Fonctionnel mais incomplet**

**Points positifs:**
- ✅ Gère `subscription.created`, `subscription.updated`, `subscription.deleted`
- ✅ Gère `checkout.session.completed`
- ✅ Utilise `upsert=True` pour éviter les doublons (mais ne résout pas le problème des multiples abonnements Stripe)

**Points à améliorer:**
- ⚠️ `_handle_subscription_created()` ne vérifie pas les abonnements existants
- ⚠️ `_handle_subscription_updated()` met à jour seulement le premier abonnement trouvé

---

### 3. RÈGLES MÉTIER VÉRIFIÉES

#### ✅ Règles Implémentées Correctement

| Règle | Statut | Fichier | Ligne |
|-------|--------|---------|-------|
| **Augmenter sièges** | ✅ OK | `backend/api/routes/gerant.py` | 109-179 |
| **Diminuer sièges** | ✅ OK | `backend/api/routes/gerant.py` | 109-179 |
| **Mensuel → Annuel** | ✅ OK | `backend/api/routes/gerant.py` | 1521-1670 |
| **Annuel → Mensuel** | ✅ BLOQUÉ | `backend/api/routes/gerant.py` | 1569-1573 |

#### ❌ Règles Manquantes ou Incorrectes

| Règle | Statut | Problème |
|-------|--------|----------|
| **Annulation abonnement** | ❌ MANQUANT | Aucun endpoint pour annuler |
| **Prévention doublons** | ❌ MANQUANT | Pas de vérification avant création |
| **Gestion multi-abonnements** | ❌ MANQUANT | Pas de logique pour gérer plusieurs abonnements |

---

### 4. STRUCTURE DE DONNÉES

#### Modèle Subscription (`backend/models/subscriptions.py`)

**Champs pertinents:**
```python
class Subscription(BaseModel):
    id: str
    user_id: str  # ⚠️ Permet plusieurs abonnements pour le même user_id
    status: str  # active, trialing, canceled, etc.
    stripe_subscription_id: Optional[str]  # ⚠️ Unique dans Stripe mais pas dans DB
    billing_interval: Optional[str]  # 'month' ou 'year'
    seats: int
    ...
```

**Problème:**
- ❌ Pas de contrainte d'unicité sur `(user_id, status='active')`
- ❌ Permet plusieurs abonnements actifs pour le même `user_id`
- ❌ Pas de champ `replaced_by` ou `replaces` pour tracer les changements

---

### 5. FLUX DE CRÉATION D'ABONNEMENT

#### Flux Actuel (PROBLÉMATIQUE)

```
1. Client clique "S'abonner" → Frontend appelle `/gerant/stripe/checkout`
2. Backend crée un checkout Stripe SANS vérifier les abonnements existants
3. Client paie sur Stripe
4. Webhook `checkout.session.completed` → Met à jour DB avec upsert=True
5. Webhook `subscription.created` → Met à jour DB avec upsert=True
6. ❌ L'ancien abonnement reste ACTIF dans Stripe
7. ❌ Le client a maintenant 2 abonnements actifs
```

#### Flux Attendu (CORRECT)

```
1. Client clique "S'abonner" → Frontend appelle `/gerant/stripe/checkout`
2. Backend VÉRIFIE les abonnements existants
3. Si abonnement actif existe:
   a. Si changement d'intervalle (mensuel → annuel):
      → Utilise `/gerant/subscription/switch-interval` (modifie l'existant)
   b. Si changement de sièges uniquement:
      → Utilise `/gerant/subscription/update-seats` (modifie l'existant)
   c. Si nouvel abonnement différent:
      → ANNULE l'ancien abonnement dans Stripe
      → Crée le nouveau checkout
4. Si aucun abonnement actif:
   → Crée le checkout normalement
5. Webhooks mettent à jour le BON abonnement
```

---

## 🎯 RECOMMANDATIONS

### Priorité 🔴 CRITIQUE

#### 1. Ajouter la vérification d'abonnements existants dans `/gerant/stripe/checkout`

**Action:**
- Avant de créer un checkout, vérifier s'il existe un abonnement actif
- Si oui, proposer de modifier l'existant ou annuler avant de créer un nouveau

**Code à ajouter:**
```python
# Dans create_gerant_checkout_session()
# Vérifier les abonnements existants
existing_subscription = await db.subscriptions.find_one(
    {"user_id": current_user['id'], "status": {"$in": ["active", "trialing"]}}
)

if existing_subscription:
    stripe_sub_id = existing_subscription.get('stripe_subscription_id')
    if stripe_sub_id:
        # Vérifier dans Stripe si l'abonnement existe encore
        try:
            stripe_sub = stripe.Subscription.retrieve(stripe_sub_id)
            if stripe_sub.status in ['active', 'trialing']:
                # ❌ ERREUR: Abonnement actif existe déjà
                raise HTTPException(
                    status_code=400,
                    detail="Vous avez déjà un abonnement actif. Utilisez 'Modifier mon abonnement' pour changer."
                )
        except stripe.error.InvalidRequestError:
            # Abonnement n'existe plus dans Stripe, OK pour créer
            pass
```

#### 2. Créer l'endpoint `/gerant/subscription/cancel`

**Fonctionnalité:**
- Annule un abonnement actif dans Stripe
- Met à jour le statut dans la DB
- Permet l'annulation immédiate ou à la fin de période

**Signature:**
```python
@router.post("/subscription/cancel")
async def cancel_subscription(
    cancel_immediately: bool = False,  # True = annule maintenant, False = à la fin de période
    current_user: dict = Depends(get_current_gerant),
    db = Depends(get_db)
):
    """
    Annule l'abonnement actif du gérant.
    
    - Si cancel_immediately=True: Annule immédiatement (remboursement prorata)
    - Si cancel_immediately=False: Annule à la fin de la période (pas de remboursement)
    """
```

#### 3. Modifier les webhooks pour gérer les abonnements multiples

**Action:**
- Dans `_handle_subscription_created()`, vérifier les abonnements existants
- Si un abonnement actif existe avec un `stripe_subscription_id` différent, l'annuler
- Utiliser `find()` au lieu de `find_one()` pour détecter les doublons

---

### Priorité 🟡 MOYENNE

#### 4. Créer l'endpoint `/gerant/subscriptions` (liste)

**Fonctionnalité:**
- Liste tous les abonnements (actifs, annulés, expirés)
- Permet de détecter les abonnements multiples
- Aide au debugging

#### 5. Améliorer `get_subscription_status()` pour détecter les doublons

**Action:**
- Utiliser `find()` au lieu de `find_one()`
- Retourner une liste d'abonnements actifs
- Afficher un warning si plusieurs abonnements sont détectés

#### 6. Ajouter un champ `replaced_by` dans le modèle Subscription

**Action:**
- Lorsqu'un nouvel abonnement remplace un ancien, marquer l'ancien avec `replaced_by: new_subscription_id`
- Permet de tracer l'historique des changements

---

### Priorité 🟢 BASSE

#### 7. Créer l'endpoint `/gerant/subscription/reactivate`

**Fonctionnalité:**
- Réactive un abonnement annulé (si `cancel_at_period_end=True`)
- Utile si le client change d'avis

#### 8. Ajouter un endpoint d'historique

**Fonctionnalité:**
- Retrace tous les changements d'abonnement
- Utile pour le support client

---

## 📊 CHECKLIST DES ENDPOINTS NÉCESSAIRES

| Endpoint | Statut | Priorité | Fichier Cible |
|----------|--------|----------|---------------|
| `GET /gerant/subscription/status` | ✅ Existe | - | `backend/api/routes/gerant.py:81` |
| `POST /gerant/subscription/update-seats` | ✅ Existe | - | `backend/api/routes/gerant.py:109` |
| `POST /gerant/subscription/preview` | ✅ Existe | - | `backend/api/routes/gerant.py:241` |
| `POST /gerant/subscription/switch-interval` | ✅ Existe | - | `backend/api/routes/gerant.py:1521` |
| `POST /gerant/stripe/checkout` | ⚠️ Problème | 🔴 | `backend/api/routes/gerant.py:1107` |
| `POST /gerant/subscription/cancel` | ❌ Manquant | 🔴 | À créer |
| `POST /gerant/subscription/reactivate` | ❌ Manquant | 🟡 | À créer |
| `GET /gerant/subscriptions` | ❌ Manquant | 🟡 | À créer |
| `GET /gerant/subscription/history` | ❌ Manquant | 🟢 | À créer |

---

## 🔧 ACTIONS IMMÉDIATES REQUISES

### 1. Correction du flux de création d'abonnement

**Fichier:** `backend/api/routes/gerant.py` (ligne 1107)

**Modification:**
- Ajouter une vérification des abonnements existants AVANT de créer le checkout
- Si un abonnement actif existe, rediriger vers la modification ou proposer l'annulation

### 2. Création de l'endpoint d'annulation

**Nouveau fichier:** `backend/api/routes/gerant.py` (nouvelle fonction)

**Fonctionnalité:**
- Annule l'abonnement actif dans Stripe
- Met à jour le statut dans la DB
- Gère l'annulation immédiate vs fin de période

### 3. Amélioration des webhooks

**Fichier:** `backend/services/payment_service.py`

**Modification:**
- Dans `_handle_subscription_created()`, vérifier et annuler les abonnements existants
- Dans `_handle_checkout_completed()`, vérifier les doublons

### 4. Amélioration de la récupération d'abonnement

**Fichier:** `backend/services/gerant_service.py` (ligne 745)

**Modification:**
- Utiliser `find()` pour détecter les abonnements multiples
- Retourner une liste et choisir le plus récent ou le plus approprié
- Logger un warning si plusieurs abonnements sont détectés

---

## 📝 NOTES TECHNIQUES

### Contraintes Stripe

- **Un client peut avoir plusieurs abonnements actifs** dans Stripe
- Chaque abonnement génère des factures séparées
- Les webhooks peuvent arriver dans n'importe quel ordre
- `cancel_at_period_end=True` permet d'annuler à la fin de période sans remboursement

### Contraintes Base de Données

- **Pas de contrainte d'unicité** sur `(user_id, status='active')`
- Plusieurs documents peuvent exister avec le même `user_id` et `status='active'`
- `upsert=True` met à jour le premier document trouvé ou crée un nouveau

### Recommandations d'Architecture

1. **Principe d'unicité:** Un seul abonnement actif par gérant à tout moment
2. **Atomicité:** Les opérations Stripe + DB doivent être atomiques (rollback si échec)
3. **Idempotence:** Les webhooks doivent être idempotents (gérer les doublons)
4. **Traçabilité:** Tracer tous les changements d'abonnement dans un historique

---

## ✅ CONCLUSION

### Problèmes Critiques Identifiés

1. ❌ **Création d'abonnements multiples** - Le problème principal signalé par l'utilisateur
2. ❌ **Pas d'endpoint d'annulation** - Impossible d'annuler un abonnement via l'API
3. ❌ **Pas de vérification avant création** - Les doublons ne sont pas détectés

### Endpoints Manquants

1. 🔴 `POST /gerant/subscription/cancel` - **CRITIQUE**
2. 🟡 `GET /gerant/subscriptions` - **MOYENNE**
3. 🟡 `POST /gerant/subscription/reactivate` - **MOYENNE**

### Prochaines Étapes

1. **Corriger** `/gerant/stripe/checkout` pour vérifier les abonnements existants
2. **Créer** `/gerant/subscription/cancel` pour permettre l'annulation
3. **Améliorer** les webhooks pour gérer les abonnements multiples
4. **Tester** le flux complet avec un client ayant plusieurs abonnements

---

**Fin du rapport d'audit**
