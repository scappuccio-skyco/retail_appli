# 📊 Analyse des Coûts OpenAI - Retail Performer AI

**Date :** Janvier 2025  
**Rôle :** CTO & Analyste Cloud Cost  
**Objectif :** Estimer le coût d'exploitation par utilisateur (Manager et Vendeur)

---

## 💰 Tarifs OpenAI (Janvier 2025)

| Modèle | Input (par 1M tokens) | Output (par 1M tokens) |
|--------|----------------------|----------------------|
| **gpt-4o** | $2.50 | $10.00 |
| **gpt-4o-mini** | $0.15 | $0.60 |

*Source : https://openai.com/api/pricing/*

---

## 📋 Inventaire des Appels OpenAI

### 🔍 Méthodologie d'Estimation

Pour chaque fonctionnalité, j'ai estimé :
- **Tokens Input** : Basé sur la longueur des prompts système + prompts utilisateur + données contextuelles
- **Tokens Output** : Basé sur la longueur typique des réponses générées
- **Fréquence** : Estimation réaliste de l'utilisation par type d'utilisateur
- **Coût par Appel** : Calculé avec les tarifs OpenAI
- **Coût Mensuel** : Fréquence × Coût par Appel

---

## 🎯 FONCTIONNALITÉS VENDEUR

### 1. **Diagnostic DISC Initial** (`generate_diagnostic`)
- **Modèle :** `gpt-4o` ⚠️ **PREMIUM**
- **Route :** `/api/ai/diagnostic` (sellers.py)
- **Fréquence :** 1 fois par vendeur (à l'onboarding)
- **Tokens Input Est. :** 
  - System prompt : ~500 tokens
  - User prompt (30 réponses) : ~800 tokens
  - **Total Input : ~1,300 tokens**
- **Tokens Output Est. :** ~400 tokens (JSON avec style, level, strengths, axes)
- **Coût par Appel :** 
  - Input : 1,300 × $2.50 / 1,000,000 = **$0.00325**
  - Output : 400 × $10.00 / 1,000,000 = **$0.00400**
  - **Total : $0.00725**
- **Coût Mensuel par Vendeur :** $0.00725 (une seule fois, donc ~$0.01/mois si étalé sur 12 mois)

---

### 2. **Défi Quotidien IA** (`generate_daily_challenge`)
- **Modèle :** `gpt-4o-mini` ✅
- **Route :** `/api/seller/daily-challenge` (sellers.py)
- **Fréquence :** 1 fois par jour (généré automatiquement)
- **Tokens Input Est. :**
  - System prompt : ~300 tokens
  - User prompt (profil DISC + KPIs récents) : ~400 tokens
  - **Total Input : ~700 tokens**
- **Tokens Output Est. :** ~150 tokens (JSON avec title, description, competence)
- **Coût par Appel :**
  - Input : 700 × $0.15 / 1,000,000 = **$0.000105**
  - Output : 150 × $0.60 / 1,000,000 = **$0.00009**
  - **Total : $0.000195**
- **Coût Mensuel par Vendeur :** 30 jours × $0.000195 = **$0.00585** (~$0.01)

---

### 3. **Debrief Vente** (`generate_debrief`)
- **Modèle :** `gpt-4o-mini` ✅
- **Route :** `/api/debriefs` (debriefs.py)
- **Fréquence :** 2-5 fois par semaine (selon activité vendeur)
- **Estimation :** 3 fois/semaine = 12 fois/mois
- **Tokens Input Est. :**
  - System prompt : ~400 tokens
  - User prompt (détails vente + KPIs + scores compétences) : ~600 tokens
  - **Total Input : ~1,000 tokens**
- **Tokens Output Est. :** ~300 tokens (JSON avec analyse, points_travailler, recommandation, scores)
- **Coût par Appel :**
  - Input : 1,000 × $0.15 / 1,000,000 = **$0.00015**
  - Output : 300 × $0.60 / 1,000,000 = **$0.00018**
  - **Total : $0.00033**
- **Coût Mensuel par Vendeur :** 12 × $0.00033 = **$0.00396** (~$0.004)

---

### 4. **Bilan Individuel** (`generate_seller_bilan`)
- **Modèle :** `gpt-4o-mini` ✅
- **Route :** `/api/seller/bilan-individuel` (sellers.py)
- **Fréquence :** 1 fois par mois (bilan mensuel)
- **Tokens Input Est. :**
  - System prompt : ~200 tokens
  - User prompt (KPIs 30 jours) : ~500 tokens
  - **Total Input : ~700 tokens**
- **Tokens Output Est. :** ~200 tokens (bilan motivant)
- **Coût par Appel :**
  - Input : 700 × $0.15 / 1,000,000 = **$0.000105**
  - Output : 200 × $0.60 / 1,000,000 = **$0.00012**
  - **Total : $0.000225**
- **Coût Mensuel par Vendeur :** 1 × $0.000225 = **$0.000225** (~$0.0002)

---

### 5. **Feedback Auto-Évaluation** (`generate_feedback`)
- **Modèle :** `gpt-4o-mini` ✅
- **Route :** `/api/evaluations` (evaluations.py)
- **Fréquence :** 1 fois par mois (auto-évaluation mensuelle)
- **Tokens Input Est. :**
  - System prompt : ~200 tokens
  - User prompt (scores + commentaire) : ~300 tokens
  - **Total Input : ~500 tokens**
- **Tokens Output Est. :** ~150 tokens (feedback court)
- **Coût par Appel :**
  - Input : 500 × $0.15 / 1,000,000 = **$0.000075**
  - Output : 150 × $0.60 / 1,000,000 = **$0.00009**
  - **Total : $0.000165**
- **Coût Mensuel par Vendeur :** 1 × $0.000165 = **$0.000165** (~$0.0002)

---

### 6. **Conseil Conflit (Vendeur)** (`generate_conflict_advice`)
- **Modèle :** `gpt-4o` ⚠️ **PREMIUM**
- **Route :** `/api/seller/conflict-advice` (sellers.py)
- **Fréquence :** 0.5 fois par mois (conflit rare)
- **Tokens Input Est. :**
  - System prompt : ~200 tokens
  - User prompt (contexte + profils DISC) : ~800 tokens
  - **Total Input : ~1,000 tokens**
- **Tokens Output Est. :** ~500 tokens (analyse structurée)
- **Coût par Appel :**
  - Input : 1,000 × $2.50 / 1,000,000 = **$0.0025**
  - Output : 500 × $10.00 / 1,000,000 = **$0.005**
  - **Total : $0.0075**
- **Coût Mensuel par Vendeur :** 0.5 × $0.0075 = **$0.00375** (~$0.004)

---

## 👔 FONCTIONNALITÉS MANAGER

### 7. **Analyse d'Équipe** (`generate_team_analysis`)
- **Modèle :** `gpt-4o` ⚠️ **PREMIUM**
- **Route :** `/api/manager/team-analysis` (manager.py)
- **Fréquence :** 2 fois par mois (bimensuel)
- **Tokens Input Est. :**
  - System prompt : ~600 tokens
  - User prompt (données équipe 3-10 vendeurs) : ~2,000 tokens
  - **Total Input : ~2,600 tokens**
- **Tokens Output Est. :** ~1,200 tokens (analyse markdown détaillée)
- **Coût par Appel :**
  - Input : 2,600 × $2.50 / 1,000,000 = **$0.0065**
  - Output : 1,200 × $10.00 / 1,000,000 = **$0.012**
  - **Total : $0.0185**
- **Coût Mensuel par Manager :** 2 × $0.0185 = **$0.037** (~$0.04)

---

### 8. **Brief Matinal** (`generate_morning_brief`)
- **Modèle :** `gpt-4o` ⚠️ **PREMIUM**
- **Route :** `/api/briefs/morning` (briefs.py)
- **Fréquence :** 1 fois par jour ouvré = 22 jours/mois
- **Tokens Input Est. :**
  - System prompt : ~500 tokens
  - User prompt (stats magasin + contexte manager) : ~600 tokens
  - **Total Input : ~1,100 tokens**
- **Tokens Output Est. :** ~600 tokens (brief markdown structuré)
- **Coût par Appel :**
  - Input : 1,100 × $2.50 / 1,000,000 = **$0.00275**
  - Output : 600 × $10.00 / 1,000,000 = **$0.006**
  - **Total : $0.00875**
- **Coût Mensuel par Manager :** 22 × $0.00875 = **$0.1925** (~$0.19) ⚠️ **COÛT FIXE IMPORTANT**

---

### 9. **Analyse KPIs Magasin** (`analyze_store_kpis`)
- **Modèle :** `gpt-4o` ⚠️ **PREMIUM**
- **Route :** `/api/manager/analyze-store-kpis` (manager.py)
- **Fréquence :** 1 fois par semaine = 4 fois/mois
- **Tokens Input Est. :**
  - System prompt : ~300 tokens
  - User prompt (KPIs magasin période) : ~1,200 tokens
  - **Total Input : ~1,500 tokens**
- **Tokens Output Est. :** ~500 tokens (analyse concise)
- **Coût par Appel :**
  - Input : 1,500 × $2.50 / 1,000,000 = **$0.00375**
  - Output : 500 × $10.00 / 1,000,000 = **$0.005**
  - **Total : $0.00875**
- **Coût Mensuel par Manager :** 4 × $0.00875 = **$0.035** (~$0.04)

---

### 10. **Bilan Équipe (JSON)** (`generate_team_bilan`)
- **Modèle :** `gpt-4o-mini` ✅
- **Route :** `/api/manager/team-bilan` (manager.py)
- **Fréquence :** 1 fois par semaine = 4 fois/mois
- **Tokens Input Est. :**
  - System prompt : ~300 tokens
  - User prompt (données équipe) : ~1,500 tokens
  - **Total Input : ~1,800 tokens**
- **Tokens Output Est. :** ~400 tokens (JSON structuré)
- **Coût par Appel :**
  - Input : 1,800 × $0.15 / 1,000,000 = **$0.00027**
  - Output : 400 × $0.60 / 1,000,000 = **$0.00024**
  - **Total : $0.00051**
- **Coût Mensuel par Manager :** 4 × $0.00051 = **$0.00204** (~$0.002)

---

### 11. **Conseil Relation Manager-Vendeur** (`generate_recommendation`)
- **Modèle :** `gpt-4o` ⚠️ **PREMIUM**
- **Route :** `/api/manager/relationship-consultation` (manager.py)
- **Fréquence :** 1 fois par mois (consultation ponctuelle)
- **Tokens Input Est. :**
  - System prompt : ~300 tokens
  - User prompt (contexte + profils DISC) : ~1,000 tokens
  - **Total Input : ~1,300 tokens**
- **Tokens Output Est. :** ~600 tokens (recommandations)
- **Coût par Appel :**
  - Input : 1,300 × $2.50 / 1,000,000 = **$0.00325**
  - Output : 600 × $10.00 / 1,000,000 = **$0.006**
  - **Total : $0.00925**
- **Coût Mensuel par Manager :** 1 × $0.00925 = **$0.00925** (~$0.01)

---

### 12. **Conseil Conflit (Manager)** (`generate_conflict_advice`)
- **Modèle :** `gpt-4o` ⚠️ **PREMIUM**
- **Route :** `/api/manager/conflict-advice` (manager.py)
- **Fréquence :** 0.5 fois par mois (conflit rare)
- **Tokens Input Est. :**
  - System prompt : ~200 tokens
  - User prompt (contexte + profils DISC manager + vendeur) : ~1,200 tokens
  - **Total Input : ~1,400 tokens**
- **Tokens Output Est. :** ~600 tokens (analyse structurée)
- **Coût par Appel :**
  - Input : 1,400 × $2.50 / 1,000,000 = **$0.0035**
  - Output : 600 × $10.00 / 1,000,000 = **$0.006**
  - **Total : $0.0095**
- **Coût Mensuel par Manager :** 0.5 × $0.0095 = **$0.00475** (~$0.005)

---

### 13. **Guide Évaluation Annuelle** (`generate_evaluation_guide`)
- **Modèle :** `gpt-4o` ⚠️ **PREMIUM**
- **Route :** `/api/evaluations/generate-guide` (evaluations.py)
- **Fréquence :** 0.1 fois par mois (1 fois par an = 1/12)
- **Tokens Input Est. :**
  - System prompt : ~400 tokens
  - User prompt (stats + profil DISC) : ~1,500 tokens
  - **Total Input : ~1,900 tokens**
- **Tokens Output Est. :** ~800 tokens (JSON guide structuré)
- **Coût par Appel :**
  - Input : 1,900 × $2.50 / 1,000,000 = **$0.00475**
  - Output : 800 × $10.00 / 1,000,000 = **$0.008**
  - **Total : $0.01275**
- **Coût Mensuel par Manager :** 0.1 × $0.01275 = **$0.001275** (~$0.001)

---

### 14. **Diagnostic Manager** (`analyze_manager_diagnostic_with_ai`)
- **Modèle :** `gpt-4o-mini` ✅
- **Route :** `/api/diagnostics/manager` (diagnostics.py)
- **Fréquence :** 1 fois par manager (à l'onboarding)
- **Tokens Input Est. :**
  - System prompt : ~200 tokens
  - User prompt (réponses questionnaire) : ~600 tokens
  - **Total Input : ~800 tokens**
- **Tokens Output Est. :** ~200 tokens (JSON profil)
- **Coût par Appel :**
  - Input : 800 × $0.15 / 1,000,000 = **$0.00012**
  - Output : 200 × $0.60 / 1,000,000 = **$0.00012**
  - **Total : $0.00024**
- **Coût Mensuel par Manager :** $0.00024 (une seule fois, donc ~$0.0002/mois si étalé)

---

## 📊 RÉCAPITULATIF PAR UTILISATEUR

### 💼 **Coût Mensuel par VENDEUR**

| Fonctionnalité | Modèle | Coût Mensuel |
|----------------|--------|--------------|
| Diagnostic DISC Initial | gpt-4o | $0.01 |
| Défi Quotidien IA | gpt-4o-mini | $0.01 |
| Debrief Vente | gpt-4o-mini | $0.004 |
| Bilan Individuel | gpt-4o-mini | $0.0002 |
| Feedback Auto-Évaluation | gpt-4o-mini | $0.0002 |
| Conseil Conflit | gpt-4o | $0.004 |
| **TOTAL VENDEUR** | | **~$0.03/mois** |

---

### 👔 **Coût Mensuel par MANAGER**

| Fonctionnalité | Modèle | Coût Mensuel |
|----------------|--------|--------------|
| Analyse d'Équipe | gpt-4o | $0.04 |
| **Brief Matinal** | **gpt-4o** | **$0.19** ⚠️ |
| Analyse KPIs Magasin | gpt-4o | $0.04 |
| Bilan Équipe (JSON) | gpt-4o-mini | $0.002 |
| Conseil Relation | gpt-4o | $0.01 |
| Conseil Conflit | gpt-4o | $0.005 |
| Guide Évaluation | gpt-4o | $0.001 |
| Diagnostic Manager | gpt-4o-mini | $0.0002 |
| **TOTAL MANAGER** | | **~$0.29/mois** |

---

## 🎯 ANALYSE CRITIQUE

### ⚠️ **Points d'Attention**

1. **Brief Matinal (Manager) : $0.19/mois**
   - **Impact :** Représente 65% du coût mensuel manager
   - **Problème :** Utilise `gpt-4o` (premium) alors que la tâche est simple
   - **Recommandation :** Migrer vers `gpt-4o-mini` → Économie : **$0.15/mois** (78% de réduction)

2. **Diagnostic DISC Initial (Vendeur) : $0.00725/appel**
   - **Impact :** Coût unique mais élevé (gpt-4o)
   - **Recommandation :** Tester avec `gpt-4o-mini` → Économie : **$0.006/appel** (83% de réduction)

3. **Analyse d'Équipe (Manager) : $0.0185/appel**
   - **Impact :** Utilise beaucoup de tokens (2,600 input + 1,200 output)
   - **Justification :** Analyse complexe, gpt-4o justifié ✅

---

## 💡 RECOMMANDATIONS D'OPTIMISATION

### 🎯 **Actions Prioritaires**

1. **Migrer Brief Matinal vers gpt-4o-mini**
   - **Économie :** $0.15/mois/manager
   - **Risque :** Faible (brief simple, pas d'analyse complexe)
   - **Impact :** Réduction de 52% du coût manager

2. **Tester Diagnostic DISC avec gpt-4o-mini**
   - **Économie :** $0.006/diagnostic
   - **Risque :** Moyen (nécessite validation qualité)
   - **Impact :** Réduction de 83% du coût diagnostic

3. **Optimiser Prompts (Réduire tokens)**
   - **Cible :** Brief Matinal, Analyse KPIs
   - **Économie estimée :** 10-20% de réduction tokens
   - **Impact :** $0.02-0.04/mois/manager

---

## 📈 SCÉNARIOS DE COÛT

### **Scénario 1 : Actuel (Sans Optimisation)**
- **100 Vendeurs :** 100 × $0.03 = **$3.00/mois**
- **20 Managers :** 20 × $0.29 = **$5.80/mois**
- **TOTAL : $8.80/mois**

### **Scénario 2 : Optimisé (Brief + Diagnostic en mini)**
- **100 Vendeurs :** 100 × $0.024 = **$2.40/mois** (-20%)
- **20 Managers :** 20 × $0.14 = **$2.80/mois** (-52%)
- **TOTAL : $5.20/mois** (-41%)

### **Scénario 3 : Ultra-Optimisé (+ Prompts optimisés)**
- **100 Vendeurs :** 100 × $0.02 = **$2.00/mois**
- **20 Managers :** 20 × $0.12 = **$2.40/mois**
- **TOTAL : $4.40/mois** (-50%)

---

## ✅ VALIDATION RENTABILITÉ

### **Hypothèses Tarification**
- **Vendeur :** €9.99/mois
- **Manager :** €29.99/mois

### **Marge après Coûts OpenAI**

| Scénario | Coût OpenAI | Marge Vendeur | Marge Manager |
|----------|-------------|---------------|---------------|
| **Actuel** | $8.80 | €9.99 - $0.03 = **€9.96** | €29.99 - $0.29 = **€29.70** |
| **Optimisé** | $5.20 | €9.99 - $0.024 = **€9.97** | €29.99 - $0.14 = **€29.85** |
| **Ultra-Optimisé** | $4.40 | €9.99 - $0.02 = **€9.97** | €29.99 - $0.12 = **€29.87** |

**✅ Conclusion : Les coûts OpenAI sont négligeables (< 1% du prix de vente). La rentabilité est excellente.**

---

## 🚨 ALERTES & SEUILS

### **Seuils Recommandés**
- **Alerte Jaune :** > $50/mois (surveillance)
- **Alerte Orange :** > $100/mois (investigation)
- **Alerte Rouge :** > $200/mois (action immédiate)

### **Monitoring**
- Implémenter un dashboard de suivi des tokens par fonctionnalité
- Alertes automatiques si dépassement de seuil
- Rapport mensuel de coûts par utilisateur

---

**Rapport généré le :** 2025-01-09  
**Prochaine révision :** Trimestrielle
