# 💡 FORMULE : Crédits IA en fonction du nombre de vendeurs

## 🎯 PRINCIPE

**Idée :** Les crédits IA augmentent proportionnellement au nombre de vendeurs achetés

**Pourquoi c'est mieux ?**
- ✅ Plus juste : Une équipe de 15 vendeurs utilise plus l'IA qu'une équipe de 3
- ✅ Scalable : Grandit naturellement avec l'équipe
- ✅ Simple à comprendre pour les clients
- ✅ Cohérent avec le pricing "par vendeur"

---

## 📊 FORMULES PROPOSÉES

### OPTION 1 : Crédits fixes par vendeur (SIMPLE)

**Formule :** `Crédits totaux = Nombre de vendeurs × Crédits par vendeur`

#### Variante 1A : 100 crédits/vendeur

| Plan | Vendeurs | Calcul | Crédits totaux |
|------|----------|--------|----------------|
| Starter | 1 | 1 × 100 | 100 |
| Starter | 5 | 5 × 100 | 500 |
| Professional | 6 | 6 × 100 | 600 |
| Professional | 15 | 15 × 100 | 1500 |

**Avantages :**
- ✅ Ultra simple : "100 crédits par vendeur"
- ✅ Parfaitement proportionnel
- ✅ Facile à communiquer

**Inconvénients :**
- ⚠️ Pas de bonus pour le manager
- ⚠️ Une équipe de 1 vendeur n'a que 100 crédits (peut être juste)

---

#### Variante 1B : 150 crédits/vendeur (PLUS GÉNÉREUX)

| Plan | Vendeurs | Calcul | Crédits totaux |
|------|----------|--------|----------------|
| Starter | 1 | 1 × 150 | 150 |
| Starter | 5 | 5 × 150 | 750 |
| Professional | 6 | 6 × 150 | 900 |
| Professional | 15 | 15 × 150 | 2250 |

**Avantages :**
- ✅ Plus confortable pour les petites équipes
- ✅ Marge de sécurité importante

**Inconvénients :**
- ⚠️ Peut être trop généreux (mais coût reste < 1€/client)

---

### OPTION 2 : Crédits de base + par vendeur (HYBRIDE) ⭐ RECOMMANDÉ

**Formule :** `Crédits totaux = Crédits de base (manager) + (Nombre de vendeurs × Crédits par vendeur)`

#### Variante 2A : Base 200 + 80 par vendeur

| Plan | Vendeurs | Calcul | Crédits totaux | Usage réel estimé | Marge |
|------|----------|--------|----------------|-------------------|-------|
| Starter | 1 | 200 + (1×80) | **280** | ~110 | 61% ✅ |
| Starter | 3 | 200 + (3×80) | **440** | ~170 | 61% ✅ |
| Starter | 5 | 200 + (5×80) | **600** | ~230 | 62% ✅ |
| Professional | 6 | 200 + (6×80) | **680** | ~280 | 59% ✅ |
| Professional | 10 | 200 + (10×80) | **1000** | ~430 | 57% ✅ |
| Professional | 15 | 200 + (15×80) | **1400** | ~605 | 57% ✅ |

**Avantages :**
- ✅ Juste pour toutes les tailles d'équipe
- ✅ Le manager a toujours 200 crédits garantis
- ✅ Chaque vendeur apporte 80 crédits
- ✅ Marge de ~60% constante
- ✅ Simple à expliquer : "200 pour vous + 80 par vendeur"

**Communication client :**
> "Chaque vendeur bénéficie de son propre quota de coaching IA (80 crédits), 
> et vous disposez en plus de 200 crédits dédiés à vos analyses d'équipe."

---

#### Variante 2B : Base 250 + 100 par vendeur (GÉNÉREUX)

| Plan | Vendeurs | Calcul | Crédits totaux | Usage réel estimé | Marge |
|------|----------|--------|----------------|-------------------|-------|
| Starter | 1 | 250 + (1×100) | **350** | ~110 | 69% ✅ |
| Starter | 5 | 250 + (5×100) | **750** | ~230 | 69% ✅ |
| Professional | 15 | 250 + (15×100) | **1750** | ~605 | 65% ✅ |

**Avantages :**
- ✅ Très confortable pour tous
- ✅ Excellent argument marketing

**Inconvénients :**
- ⚠️ Peut-être trop généreux (mais toujours rentable)

---

#### Variante 2C : Base 150 + 70 par vendeur (ÉCONOMIQUE)

| Plan | Vendeurs | Calcul | Crédits totaux | Usage réel estimé | Marge |
|------|----------|--------|----------------|-------------------|-------|
| Starter | 1 | 150 + (1×70) | **220** | ~110 | 50% ⚠️ |
| Starter | 5 | 150 + (5×70) | **500** | ~230 | 54% ✅ |
| Professional | 15 | 150 + (15×70) | **1200** | ~605 | 50% ⚠️ |

**Avantages :**
- ✅ Plus économique
- ✅ Marge raisonnable

**Inconvénients :**
- ⚠️ Marge un peu juste (~50%)
- ⚠️ Petites équipes moins avantagées

---

### OPTION 3 : Paliers progressifs (MARKETING)

**Formule :** Plus vous avez de vendeurs, plus le bonus par vendeur augmente

| Taille équipe | Crédits de base | Crédits par vendeur | Total (max) |
|---------------|-----------------|---------------------|-------------|
| 1-2 vendeurs | 200 | 100 | 200 + (2×100) = **400** |
| 3-5 vendeurs | 200 | 90 | 200 + (5×90) = **650** |
| 6-10 vendeurs | 250 | 85 | 250 + (10×85) = **1100** |
| 11-15 vendeurs | 300 | 80 | 300 + (15×80) = **1500** |

**Avantages :**
- ✅ Favorise les petites équipes (démarrage)
- ✅ Reste attractif pour les grandes équipes
- ✅ Différenciation marketing

**Inconvénients :**
- ⚠️ Plus complexe à expliquer
- ⚠️ Calcul plus compliqué

---

## 🏆 MA RECOMMANDATION : Variante 2A

### Formule finale recommandée

```
Crédits IA mensuels = 200 + (Nombre de sièges achetés × 80)
```

### Exemples concrets

**Manager avec 3 vendeurs (Starter) :**
- 200 crédits pour le manager (analyses équipe, KPI, conflits)
- 3 × 80 = 240 crédits pour les vendeurs (débriefs, évaluations, challenges)
- **Total : 440 crédits/mois**

**Manager avec 12 vendeurs (Professional) :**
- 200 crédits pour le manager
- 12 × 80 = 960 crédits pour les vendeurs
- **Total : 1160 crédits/mois**

---

## 💰 ANALYSE DES COÛTS RÉELS

### Scénarios avec la formule recommandée (200 + 80×sièges)

| Sièges | Crédits totaux | Usage réaliste | Coût réel € | Revenu € | Ratio |
|--------|----------------|----------------|-------------|----------|-------|
| 1 | 280 | ~110 | 0.05€ | 29€ | 0.17% |
| 3 | 440 | ~170 | 0.10€ | 87€ | 0.11% |
| 5 | 600 | ~230 | 0.15€ | 145€ | 0.10% |
| 10 | 1000 | ~430 | 0.30€ | 250€ | 0.12% |
| 15 | 1400 | ~605 | 0.45€ | 375€ | 0.12% |

**Conclusion :** Coût IA reste **< 0.20% du CA** → ✅ **Excellent**

---

## 🎨 COMMUNICATION MARKETING

### Version 1 : Simple et directe

**Plan Starter**
> ✨ **Coaching IA inclus**
> - 200 crédits manager + 80 crédits par vendeur/mois
> - Débriefs IA illimités pour votre équipe
> - Analyses personnalisées automatiques

**Plan Professional**
> ✨ **Coaching IA avancé**
> - 200 crédits manager + 80 crédits par vendeur/mois
> - Bilans d'équipe IA mensuels
> - Résolution de conflits assistée par IA
> - Analyses KPI magasin en temps réel

---

### Version 2 : Focus bénéfice (sans mentionner "crédits")

**Plan Starter**
> ✨ **IA illimitée pour votre équipe**
> - Chaque vendeur bénéficie d'un coaching IA personnalisé
> - Débriefs de vente analysés automatiquement
> - Challenges quotidiens adaptés au profil
> - Dashboard manager avec insights IA

---

### Version 3 : Valeur perçue

**Plan Starter**
> ✨ **+ de 400 analyses IA incluses/mois**
> - Coaching IA pour chaque membre de l'équipe
> - Débriefs, évaluations, défis quotidiens
> - Analyses d'équipe et KPI magasin
> 
> *Crédits proportionnels à la taille de votre équipe*

---

## 💻 IMPLÉMENTATION TECHNIQUE

### 1. Fonction de calcul des crédits

```python
# Dans server.py

def calculate_monthly_ai_credits(seats: int, plan: str = None) -> int:
    """
    Calcule les crédits IA mensuels selon le nombre de sièges
    Formule : 200 (base manager) + (80 × nombre de sièges)
    """
    BASE_CREDITS = 200  # Pour les analyses manager
    CREDITS_PER_SEAT = 80  # Pour chaque vendeur
    
    total_credits = BASE_CREDITS + (seats * CREDITS_PER_SEAT)
    
    return total_credits

# Exemple d'utilisation
# 5 sièges → 200 + (5 × 80) = 600 crédits
```

### 2. Lors de l'activation de l'abonnement

```python
# Dans le webhook Stripe ou lors de la création d'abonnement

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    # ... votre code existant ...
    
    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        workspace_id = session['metadata'].get('workspace_id')
        
        # Récupérer le nombre de sièges achetés
        line_items = stripe.checkout.Session.list_line_items(session.id)
        seats = line_items.data[0].quantity if line_items.data else 1
        
        # Calculer les crédits selon la formule
        monthly_credits = calculate_monthly_ai_credits(seats)
        
        # Mettre à jour le workspace
        await db.workspaces.update_one(
            {"id": workspace_id},
            {"$set": {
                "ai_credits_remaining": monthly_credits,
                "ai_credits_used_this_month": 0,
                "stripe_quantity": seats,
                "last_credit_reset": datetime.now(timezone.utc).isoformat()
            }}
        )
```

### 3. Lors du changement de sièges

```python
# Endpoint de modification des sièges

@api_router.post("/subscription/change-seats")
async def change_seats(
    request_data: dict,
    current_user: dict = Depends(get_current_user)
):
    # ... votre code existant ...
    
    new_seats = request_data.get('new_seats')
    
    # Modifier sur Stripe
    stripe.Subscription.modify(
        subscription_id,
        items=[{
            'id': subscription_item_id,
            'quantity': new_seats,
        }]
    )
    
    # Recalculer les crédits pour le nouveau nombre de sièges
    new_credits_limit = calculate_monthly_ai_credits(new_seats)
    
    # Ajuster les crédits restants proportionnellement
    workspace = await db.workspaces.find_one({"id": workspace_id})
    old_credits_limit = 200 + (workspace['stripe_quantity'] * 80)
    old_credits_remaining = workspace.get('ai_credits_remaining', 0)
    
    # Proportion : si 50% restaient, on garde 50% du nouveau forfait
    usage_ratio = old_credits_remaining / old_credits_limit if old_credits_limit > 0 else 1
    new_credits_remaining = int(new_credits_limit * usage_ratio)
    
    await db.workspaces.update_one(
        {"id": workspace_id},
        {"$set": {
            "stripe_quantity": new_seats,
            "ai_credits_remaining": new_credits_remaining
        }}
    )
```

### 4. Réinitialisation mensuelle

```python
# Fonction de reset mensuel

async def check_and_reset_monthly_credits_workspace(workspace_id: str):
    """
    Vérifie si le mois a changé et réinitialise les crédits si besoin
    """
    workspace = await db.workspaces.find_one({"id": workspace_id})
    
    if not workspace:
        return
    
    last_reset = workspace.get('last_credit_reset')
    if not last_reset:
        return
    
    last_reset_date = datetime.fromisoformat(last_reset)
    now = datetime.now(timezone.utc)
    
    # Si on est dans un nouveau mois
    if now.year > last_reset_date.year or now.month > last_reset_date.month:
        # Recalculer les crédits selon le nombre de sièges actuel
        seats = workspace.get('stripe_quantity', 1)
        monthly_credits = calculate_monthly_ai_credits(seats)
        
        await db.workspaces.update_one(
            {"id": workspace_id},
            {"$set": {
                "ai_credits_remaining": monthly_credits,
                "ai_credits_used_this_month": 0,
                "last_credit_reset": now.isoformat()
            }}
        )
```

---

## 📊 COMPARAISON : AVANT vs APRÈS

### AVANT (forfaits fixes)

| Plan | Crédits | Pour qui | Problème |
|------|---------|----------|----------|
| Starter | 500 | 1-5 vendeurs | ⚠️ 1 vendeur a trop, 5 ont juste assez |
| Professional | 1500 | 6-15 vendeurs | ⚠️ 6 vendeurs ont trop, 15 ont pile |

### APRÈS (proportionnel)

| Sièges | Crédits (200+80×) | Répartition | Résultat |
|--------|-------------------|-------------|----------|
| 1 | 280 | Manager: 200, Vendeur: 80 | ✅ Équilibré |
| 5 | 600 | Manager: 200, Vendeurs: 400 | ✅ Équilibré |
| 15 | 1400 | Manager: 200, Vendeurs: 1200 | ✅ Équilibré |

**Bénéfice :** Marge de ~60% constante, quelle que soit la taille de l'équipe !

---

## ✅ PROCHAINES ÉTAPES

1. **Validez la formule :** 200 + (80 × sièges) ou une autre variante ?
2. **Je modifie le code** pour implémenter le calcul dynamique
3. **Je mets à jour** tous les documents (simulations, recommandations)
4. **Je prépare** le texte marketing pour vos pages de pricing

**Quelle formule préférez-vous ?**
- A) 200 + (80 × sièges) - ⭐ **Recommandé**
- B) 250 + (100 × sièges) - Plus généreux
- C) 150 + (70 × sièges) - Plus économique
- D) Autre formule ? (précisez)

En attente de votre validation ! 🚀
