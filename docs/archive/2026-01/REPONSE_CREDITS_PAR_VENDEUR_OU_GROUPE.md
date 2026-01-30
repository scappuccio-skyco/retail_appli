# 🎯 RÉPONSE : Crédits par Vendeur ou par Groupe ?

## ✅ RÉPONSE DIRECTE

D'après votre code actuel (fichier `server.py`, lignes 40-63), les crédits sont définis **PAR PLAN** :

```python
STRIPE_PLANS = {
    "starter": {
        "ai_credits_monthly": 500    # ← PAR PLAN, pas par vendeur
    },
    "professional": {
        "ai_credits_monthly": 1500   # ← PAR PLAN, pas par vendeur
    }
}
```

**Conclusion :** Les 500 et 1500 crédits sont **POUR TOUT LE WORKSPACE** (groupe = manager + tous les vendeurs), **PAS par vendeur individuel**.

---

## 🔍 IMPACT SUR LES CALCULS

### Si c'est par GROUPE (comme actuellement configuré) :

#### Plan Starter (500 crédits pour 1-5 vendeurs)
```
Manager actif         : 65 crédits/mois
5 Vendeurs moyens     : 150 crédits/mois (30 chacun)
────────────────────────────────────────
TOTAL                 : 215 crédits/mois
Reste                 : 285 crédits
Marge                 : 57% ✅ SUFFISANT
```

#### Plan Professional (1500 crédits pour 6-15 vendeurs)
```
Manager actif         : 80 crédits/mois
15 Vendeurs moyens    : 525 crédits/mois (35 chacun)
────────────────────────────────────────
TOTAL                 : 605 crédits/mois
Reste                 : 895 crédits
Marge                 : 60% ✅ TRÈS SUFFISANT
```

---

### ❌ Si c'était par VENDEUR (hypothèse alternative) :

#### Plan Starter (500 crédits × 5 vendeurs = 2500 crédits totaux)
```
Manager actif         : 65 crédits/mois
5 Vendeurs moyens     : 150 crédits/mois (30 chacun)
────────────────────────────────────────
TOTAL                 : 215 crédits/mois
Budget disponible     : 2500 crédits
Taux d'utilisation    : 8.6% 🤯 SURDIMENSIONNÉ !
```

Ce serait excessivement généreux et coûterait plus cher (mais toujours < 1.50€/mois/client).

---

## ⚠️ PROBLÈME IDENTIFIÉ DANS VOTRE CODE

### Incohérence architecturale

Votre code a **DEUX endroits** où les crédits IA sont stockés :

1. **`Workspace`** (ligne 134-136) - ✅ CORRECT selon l'architecture
```python
class Workspace(BaseModel):
    ai_credits_remaining: int = 100
    ai_credits_used_this_month: int = 0
    last_credit_reset: Optional[datetime] = None
```

2. **`Subscription`** (ligne 160-162) - ❌ ANCIEN MODÈLE (avant refactoring)
```python
class Subscription(BaseModel):
    ai_credits_remaining: int = 0
    ai_credits_used_this_month: int = 0
    last_credit_reset: Optional[datetime] = None
```

### Le problème

La fonction `check_and_consume_ai_credits()` (ligne 5217) cherche dans **`db.subscriptions`** :
```python
sub = await db.subscriptions.find_one({"user_id": user_id})
credits_remaining = sub.get('ai_credits_remaining', 0)
```

**Mais ça devrait chercher dans `db.workspaces` !**

---

## 🛠️ CORRECTION NÉCESSAIRE

Pour être cohérent avec votre architecture Workspace, vous devez modifier la logique des crédits :

### Option 1 : Crédits au niveau Workspace (RECOMMANDÉ)

**Principe :** Un seul pool de crédits partagé par tout le workspace (manager + vendeurs)

**Avantages :**
- Cohérent avec votre modèle "1 workspace = 1 customer Stripe"
- Plus simple à gérer
- Correspond aux forfaits actuels (500/1500 par plan)
- Permet une mutualisation intelligente (si un vendeur n'utilise pas, un autre peut)

**Modifications nécessaires :**

```python
# Modifier check_and_consume_ai_credits()
async def check_and_consume_ai_credits(workspace_id: str, action_type: str, metadata: Optional[dict] = None) -> dict:
    """
    Check if workspace has enough AI credits and consume them
    """
    await check_and_reset_monthly_credits_workspace(workspace_id)
    
    credits_needed = AI_COSTS.get(action_type, 1)
    
    # ✅ Chercher dans workspaces, pas subscriptions
    workspace = await db.workspaces.find_one({"id": workspace_id})
    
    if not workspace:
        return {"success": False, "message": "Workspace non trouvé", "credits_remaining": 0}
    
    credits_remaining = workspace.get('ai_credits_remaining', 0)
    
    if credits_remaining < credits_needed:
        return {
            "success": False, 
            "message": f"Crédits IA insuffisants pour votre équipe. Il reste {credits_remaining} crédits, {credits_needed} nécessaires.",
            "credits_remaining": credits_remaining
        }
    
    # Consommer les crédits au niveau workspace
    new_remaining = credits_remaining - credits_needed
    new_used = workspace.get('ai_credits_used_this_month', 0) + credits_needed
    
    await db.workspaces.update_one(
        {"id": workspace_id},
        {"$set": {
            "ai_credits_remaining": new_remaining,
            "ai_credits_used_this_month": new_used,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Log usage avec workspace_id
    usage_log = AIUsageLog(
        workspace_id=workspace_id,  # ✅ Au niveau workspace
        user_id=metadata.get('user_id') if metadata else None,
        action_type=action_type,
        credits_consumed=credits_needed,
        metadata=metadata
    )
    
    await db.ai_usage_logs.insert_one(usage_log.dict())
    
    return {
        "success": True,
        "message": f"{credits_needed} crédits consommés",
        "credits_remaining": new_remaining
    }
```

**Puis dans tous vos endpoints IA :**

```python
# Exemple : create_debrief
async def create_debrief(debrief_data: DebriefCreate, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'seller':
        raise HTTPException(status_code=403, detail="Only sellers can create debriefs")
    
    # ✅ Récupérer le workspace_id du vendeur
    seller = await db.users.find_one({"id": current_user['id']})
    workspace_id = seller.get('workspace_id')
    
    if not workspace_id:
        raise HTTPException(status_code=400, detail="Vendeur non associé à un workspace")
    
    # ✅ Vérifier les crédits du WORKSPACE
    credit_check = await check_and_consume_ai_credits(
        workspace_id, 
        "debrief",
        {"user_id": current_user['id'], "user_name": current_user.get('name')}
    )
    
    if not credit_check['success']:
        raise HTTPException(status_code=402, detail=credit_check['message'])
    
    # ... reste du code ...
```

---

### Option 2 : Crédits individuels par utilisateur

**Principe :** Chaque utilisateur (manager ET chaque vendeur) a son propre quota

**Exemple :**
- Plan Starter : Manager a 200 crédits + chaque vendeur a 100 crédits
- Plan Professional : Manager a 500 crédits + chaque vendeur a 150 crédits

**Avantages :**
- Limitation par utilisateur (évite qu'un vendeur consomme tout)
- Granularité fine

**Inconvénients :**
- Plus complexe à gérer
- Moins flexible (un vendeur inactif "gaspille" ses crédits)
- Ne correspond pas aux forfaits actuels (500/1500 par plan)
- Nécessite de définir la répartition (combien pour le manager vs vendeurs ?)

❌ **Non recommandé** car cela complique inutilement la gestion.

---

## 🎯 MA RECOMMANDATION FINALE

### 1. **Clarifiez votre intention commerciale**

**Question :** Que voulez-vous proposer à vos clients ?

**Option A : Pool partagé par équipe** (RECOMMANDÉ)
- "500 crédits IA/mois inclus pour toute votre équipe"
- Manager + tous les vendeurs puisent dans le même pot
- Simple et flexible

**Option B : Quota par personne**
- "500 crédits IA/mois par utilisateur"
- Chaque personne a son quota individuel
- Plus complexe

---

### 2. **Selon votre choix actuel (Pool partagé)**

✅ **Gardez vos forfaits :** 500 (Starter) / 1500 (Professional) par workspace

✅ **Corrigez le code** pour utiliser `workspaces` au lieu de `subscriptions`

✅ **Vos calculs précédents sont CORRECTS** :
- Starter (1-5 vendeurs) : Usage ~215 crédits → **Suffisant à 57%**
- Professional (6-15 vendeurs) : Usage ~605 crédits → **Suffisant à 60%**

---

### 3. **Si vous préférez un quota par vendeur**

Pour rendre l'offre **encore plus généreuse**, vous pourriez faire :

**Plan Starter :**
- 500 crédits pour le manager
- 300 crédits par vendeur (×5 max = 1500 crédits)
- **Total max : 2000 crédits** pour une équipe de 5

**Plan Professional :**
- 750 crédits pour le manager
- 400 crédits par vendeur (×15 max = 6000 crédits)
- **Total max : 6750 crédits** pour une équipe de 15

**Coût réel pour vous :**
- Starter max (2000 crédits) : ~1.20€/mois
- Professional max (6750 crédits) : ~3.50€/mois

Toujours < 1% de votre CA, donc **très rentable** !

---

## 📊 TABLEAU COMPARATIF

| Approche | Forfait Starter | Forfait Pro | Complexité | Recommandation |
|----------|----------------|-------------|------------|----------------|
| **Pool partagé (actuel)** | 500 crédits | 1500 crédits | ⭐ Simple | ✅ OPTIMAL |
| **Par vendeur (×5 / ×15)** | 2500 crédits | 22500 crédits | ⭐⭐ Moyen | ⚠️ Surdimensionné |
| **Mixte (Manager + Vendeurs)** | 2000 crédits | 6750 crédits | ⭐⭐⭐ Complexe | 🔶 Généreux mais ok |

---

## 🎬 ACTION IMMÉDIATE REQUISE

**Question pour vous :**

**Voulez-vous :**

**A.** Crédits partagés par tout le workspace (500/1500 totaux) 👈 ACTUEL
- ✅ Simple
- ✅ Correspond à votre config actuelle
- ✅ Suffisant selon mes calculs

**B.** Crédits par vendeur (500/1500 PAR vendeur)
- ⚠️ Nécessite recalcul complet
- ⚠️ Beaucoup plus généreux
- ⚠️ Coût légèrement plus élevé (mais toujours < 1% CA)

**Répondez A ou B et je vous donnerai :**
1. Les calculs mis à jour
2. Le code corrigé si nécessaire
3. La communication marketing adaptée

---

📧 **En attente de votre décision pour finaliser l'analyse !**
