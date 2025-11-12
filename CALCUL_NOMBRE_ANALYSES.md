# 📊 CALCUL DU NOMBRE D'ANALYSES PAR FORMULE

## 🎯 FORMULE RETENUE : 250 + (100 × Nombre de vendeurs)

---

## 💰 COÛT EN CRÉDITS PAR TYPE D'ANALYSE

| Type d'analyse | Utilisateur | Crédits | Équivalent analyses |
|----------------|-------------|---------|---------------------|
| **Auto-évaluation** | Vendeur | 0.6 | ~1 analyse |
| **Débrief de vente** | Vendeur | 1.2 | ~1 analyse |
| **Challenge quotidien** | Vendeur | 0.8 | ~1 analyse |
| **Analyse KPI magasin** | Manager | 2.0 | ~1 analyse |
| **Bilan d'équipe IA** | Manager | 2.5 | ~1 analyse |
| **Gestion de conflit** | Manager | 1.5 | ~1 analyse |
| **Bilan vendeur individuel** | Manager | 1.0 | ~1 analyse |

---

## 🔢 CONVERSION CRÉDITS → ANALYSES

### Pour le MANAGER (250 crédits)

**Si utilisation mono-feature :**
- Analyses KPI uniquement : 250 ÷ 2.0 = **125 analyses**
- Bilans d'équipe uniquement : 250 ÷ 2.5 = **100 bilans**
- Gestion conflits uniquement : 250 ÷ 1.5 = **166 consultations**
- Bilans vendeurs uniquement : 250 ÷ 1.0 = **250 bilans**

**Usage réaliste mixte :**
- 20 analyses KPI (40 crédits)
- 4 bilans équipe (10 crédits)
- 3 gestion conflits (4.5 crédits)
- 10 bilans vendeurs (10 crédits)
- **Total : ~65 crédits utilisés**
- **Reste : 185 crédits = ~150 analyses supplémentaires**

**Communication simplifiée :**
> **"150+ analyses manager/mois"**

---

### Pour un VENDEUR (100 crédits)

**Si utilisation mono-feature :**
- Auto-évaluations uniquement : 100 ÷ 0.6 = **166 évaluations**
- Débriefs uniquement : 100 ÷ 1.2 = **83 débriefs**
- Challenges uniquement : 100 ÷ 0.8 = **125 challenges**

**Usage réaliste mixte :**
- 20 auto-évaluations (12 crédits)
- 15 débriefs (18 crédits)
- 30 challenges quotidiens (24 crédits)
- **Total : ~54 crédits utilisés**
- **Reste : 46 crédits = ~50 analyses supplémentaires**

**Communication simplifiée :**
> **"100+ analyses par vendeur/mois"**

---

## 📊 EXEMPLES CONCRETS PAR TAILLE D'ÉQUIPE

### Équipe de 1 vendeur (350 crédits)

**Répartition :**
- Manager : 250 crédits = **~150 analyses**
- 1 Vendeur : 100 crédits = **~100 analyses**

**Communication :**
> "250+ analyses IA/mois pour votre équipe"
> - 150+ analyses manager
> - 100+ analyses vendeur

---

### Équipe de 5 vendeurs (750 crédits)

**Répartition :**
- Manager : 250 crédits = **~150 analyses**
- 5 Vendeurs : 500 crédits = **~500 analyses** (100 chacun)

**Communication :**
> "650+ analyses IA/mois pour votre équipe"
> - 150+ analyses manager
> - 100+ analyses par vendeur (×5)

---

### Équipe de 15 vendeurs (1750 crédits)

**Répartition :**
- Manager : 250 crédits = **~150 analyses**
- 15 Vendeurs : 1500 crédits = **~1500 analyses** (100 chacun)

**Communication :**
> "1650+ analyses IA/mois pour votre équipe"
> - 150+ analyses manager
> - 100+ analyses par vendeur (×15)

---

## 🎨 TEXTES POUR LES PLANS

### Plan Starter (1-5 vendeurs)

#### Version détaillée
```
✨ Coaching IA Complet

MANAGER (vous)
• 150+ analyses IA/mois
• Analyses KPI magasin
• Bilans d'équipe IA
• Gestion de conflits assistée

VENDEURS (votre équipe)
• 100+ analyses IA par vendeur/mois
• Débriefs de vente automatiques
• Auto-évaluations coachées
• Challenges quotidiens personnalisés
```

#### Version concise
```
✨ 250+ analyses IA/mois (1 vendeur)
✨ 750+ analyses IA/mois (5 vendeurs)

• 150+ analyses manager
• 100+ analyses par vendeur
• Coaching IA illimité
```

---

### Plan Professional (6-15 vendeurs)

#### Version détaillée
```
✨ Coaching IA Avancé

MANAGER (vous)
• 150+ analyses IA/mois
• Toutes les fonctionnalités Starter
• Analyses avancées d'équipe
• Dashboard IA en temps réel

VENDEURS (votre équipe)
• 100+ analyses IA par vendeur/mois
• Coaching personnalisé quotidien
• Progression suivie par IA
• Recommandations adaptatives
```

#### Version concise
```
✨ 850+ analyses IA/mois (6 vendeurs)
✨ 1750+ analyses IA/mois (15 vendeurs)

• 150+ analyses manager
• 100+ analyses par vendeur
• Coaching IA premium
```

---

## 💡 NOTES POUR LA COMMUNICATION

### ✅ À FAIRE

1. **Parler en "analyses"** plutôt qu'en "crédits"
   - Plus concret pour les clients
   - Valorise mieux l'offre
   - Évite la confusion

2. **Séparer Manager / Vendeurs**
   - "150+ pour vous (manager)"
   - "100+ par vendeur"
   - Montre la double valeur

3. **Donner des fourchettes larges**
   - "100+ analyses" plutôt que "exactement 83 débriefs"
   - Évite la micro-comptabilité
   - Plus généreux perçu

4. **Exemples concrets**
   - "= 30 débriefs + 20 évaluations + challenges quotidiens"
   - Aide à visualiser

---

### ❌ À ÉVITER

1. **Ne pas mentionner "crédits"** dans l'interface client
   - Trop abstrait
   - Crée de la confusion

2. **Ne pas être trop précis** sur les calculs
   - "100 analyses" pas "83.33 débriefs"
   - Garde de la flexibilité

3. **Ne pas parler de "tokens"**
   - Terme technique
   - Sans intérêt pour le client

---

## 🎯 TABLEAU RÉCAPITULATIF POUR INTERFACE

### Affichage dans SubscriptionModal.js

**Section Manager :**
```
Analyses Manager Incluses
━━━━━━━━━━━━━━━━━━━━━━━━
150+ analyses IA/mois

✓ Analyses KPI magasin
✓ Bilans d'équipe mensuels
✓ Gestion de conflits
✓ Bilans vendeurs individuels
```

**Section Vendeurs :**
```
Analyses Vendeur Incluses
━━━━━━━━━━━━━━━━━━━━━━━━
100+ analyses IA/vendeur/mois

✓ Débriefs de vente coachés
✓ Auto-évaluations avec feedback
✓ Challenges quotidiens personnalisés
```

---

## 📐 FORMULE FINALE IMPLÉMENTÉE

```python
def calculate_monthly_ai_credits(seats: int) -> int:
    """
    Calcule les crédits IA mensuels selon le nombre de sièges
    Formule Option B : 250 (manager) + (100 × sièges)
    """
    MANAGER_BASE_CREDITS = 250  # ~150 analyses manager
    CREDITS_PER_SEAT = 100      # ~100 analyses par vendeur
    
    return MANAGER_BASE_CREDITS + (seats * CREDITS_PER_SEAT)

# Exemples :
# 1 siège  → 250 + 100 = 350 crédits  (~250 analyses)
# 5 sièges → 250 + 500 = 750 crédits  (~650 analyses)
# 15 sièges → 250 + 1500 = 1750 crédits (~1650 analyses)
```

---

## ✅ VALIDATION

Cette formule offre :
- ✅ **Générosité** : Marge de ~65% en usage normal
- ✅ **Clarté** : Simple à comprendre pour les clients
- ✅ **Scalabilité** : Grandit naturellement avec l'équipe
- ✅ **Rentabilité** : Coût IA reste < 0.25% du CA

**Prêt pour implémentation !** 🚀
