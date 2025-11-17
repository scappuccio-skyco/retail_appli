# 📋 Explications des Prompts IA - Gestion Relationnelle & Conflits

Ce document explique exactement ce qui est envoyé à l'IA pour générer les recommandations de management.

---

## 🤝 GESTION RELATIONNELLE (RelationshipManagementModal)

### Modèle utilisé : **GPT-5** (OpenAI)

### 1️⃣ Message Système
```
Tu es un expert en management d'équipe retail et en gestion relationnelle/de conflit.
Tu dois fournir des conseils personnalisés basés sur les profils de personnalité et les performances.
```

### 2️⃣ Prompt Utilisateur (ce qui est envoyé)

```markdown
# Situation RELATIONNELLE/DE CONFLIT

**Type de situation :** [Ex: "Augmentation de salaire demandée", "Conflit avec un collègue", etc.]
**Description :** [Description fournie par le manager dans le formulaire]

## Contexte Manager
**Nom :** [Prénom] [Nom]
**Profil de personnalité :** [JSON avec le profil DISC/compétences du manager]
  Exemple : {
    "profil_nom": "Leader Inspirant",
    "force_1": "Vision stratégique",
    "force_2": "Capacité à motiver",
    "axe_progression": "Gestion des détails"
  }

## Contexte Vendeur
**Nom :** [Prénom] [Nom]
**Statut :** [active/archived/invited]
**Profil de personnalité :** [JSON avec le profil DISC du vendeur]
  Exemple : {
    "style": "Dominant",
    "level": "Expert",
    "motivation": "Challenge et reconnaissance",
    "ai_profile_summary": "Vendeur orienté résultats..."
  }

## Performances
KPIs sur les 30 derniers jours : [X] entrées
- CA total : [montant]€
- Ventes totales : [nombre]

## Debriefs récents
[X] debriefs récents :
- [Date] : [Résumé du debrief]
- [Date] : [Résumé du debrief]
...

# Ta mission
Fournis une recommandation CONCISE et ACTIONNABLE (maximum 400 mots) structurée avec :

## Analyse de la situation (2-3 phrases max)
- Diagnostic rapide en tenant compte des profils de personnalité

## Conseils pratiques (3 actions concrètes max)
- Actions spécifiques et immédiatement applicables
- Adaptées aux profils de personnalité

## Phrases clés (2-3 phrases max)
- Formulations précises adaptées au profil du vendeur

## Points de vigilance (2 points max)
- Ce qu'il faut éviter compte tenu des profils

IMPORTANT : Sois CONCIS, DIRECT et PRATIQUE. Évite les longues explications théoriques.
```

### 3️⃣ Données collectées automatiquement

L'IA reçoit automatiquement :
- ✅ **Profil DISC du manager** (issu du diagnostic manager)
- ✅ **Profil DISC du vendeur** (issu du diagnostic vendeur)
- ✅ **KPIs du vendeur** (30 derniers jours : CA, nombre de ventes)
- ✅ **5 derniers debriefs** partagés avec le manager
- ✅ **Type de situation** choisi dans le formulaire
- ✅ **Description libre** du manager

---

## ⚡ GESTION DE CONFLIT (ConflictResolutionForm)

### Modèle utilisé : **GPT-4o-mini** (OpenAI)

### 1️⃣ Message Système
```
Tu es un expert en management retail et en gestion de conflits. 
Tu réponds UNIQUEMENT en JSON valide.
```

### 2️⃣ Prompt Utilisateur (ce qui est envoyé)

```markdown
Tu es un coach professionnel spécialisé en management retail et en gestion de conflits.

Tu t'adresses directement au manager qui te consulte. Ton rôle est de fournir une analyse personnalisée et des recommandations concrètes en tenant compte de son profil et de celui de son vendeur.

### VOTRE PROFIL DE MANAGER
Profil Manager :
- Type : [Ex: "Leader Inspirant"]
- Description : [Description du profil]
- Forces : [Force 1], [Force 2]
- Axe de progression : [Axe à travailler]

### PROFIL DE VOTRE VENDEUR ([Nom du vendeur])
Profil Vendeur :
- Style : [Ex: "Dominant"]
- Niveau : [Ex: "Expert"]
- Motivation : [Ex: "Challenge et reconnaissance"]
- Profil IA : [Résumé IA du profil]

### COMPÉTENCES ACTUELLES
Compétences actuelles (sur 5) :
- Accueil : [score]/5
- Découverte : [score]/5
- Argumentation : [score]/5
- Closing : [score]/5
- Fidélisation : [score]/5

### PERFORMANCES RÉCENTES
Performance récente (7 derniers jours) :
- CA total : [montant]€
- Nombre de ventes : [nombre]
- Panier moyen : [montant]€

Nombre de débriefs récents du vendeur : [nombre]

### LA SITUATION QUE VOUS DÉCRIVEZ

**Contexte :** [Contexte général du conflit]

**Comportement observé :** [Comportement problématique constaté]

**Impact :** [Impact sur l'équipe/le magasin]

**Tentatives précédentes :** [Ce qui a déjà été essayé]

**Détails supplémentaires :** [Informations complémentaires]

### OBJECTIF
Fournis une analyse et des recommandations PERSONNALISÉES qui tiennent compte :
1. Du style de management du manager (utilise "vous" et "votre/vos" pour vous adresser directement à lui)
2. Du profil du vendeur
3. Des compétences et performances actuelles du vendeur
4. De la situation conflictuelle spécifique

### FORMAT DE SORTIE (JSON uniquement)
Réponds UNIQUEMENT avec un objet JSON valide :
{
  "analyse_situation": "[3-4 phrases d'analyse. IMPORTANT: Vouvoie le manager directement en utilisant 'vous', 'votre', 'vos'. Identifie les causes probables du conflit. Ton professionnel et empathique.]",
  "approche_communication": "[4-5 phrases décrivant comment VOUS devriez aborder la conversation. Utilise 'vous', 'votre', 'vos' en permanence. Adapte le style au profil du manager ET du vendeur. Inclus des phrases d'accroche concrètes.]",
  "actions_concretes": [
    "[Action 1 - Commence par un verbe à l'infinitif ou utilise 'vous'. Ex: 'Organisez une réunion...' ou 'Vous devez organiser...']",
    "[Action 2 - spécifique et adaptée au contexte]",
    "[Action 3 - spécifique et adaptée au contexte]"
  ],
  "points_vigilance": [
    "[Point de vigilance 1 - en lien avec VOTRE style et VOS forces. Ex: 'Veillez à ne pas...', 'Faites attention à...']",
    "[Point de vigilance 2 - en lien avec les profils]"
  ]
}

### STYLE ATTENDU
- VOUVOIEMENT OBLIGATOIRE : utilise "vous", "votre", "vos" pour vous adresser directement au manager
- Professionnel, empathique et constructif
- Personnalisé (mentionne explicitement les profils manager/vendeur)
- Orienté solution et action
- Langage managérial retail
- Maximum 15 lignes au total
```

### 3️⃣ Données collectées automatiquement

L'IA reçoit automatiquement :
- ✅ **Profil complet du manager** (type, forces, axes de progression)
- ✅ **Profil DISC complet du vendeur** (style, niveau, motivation)
- ✅ **Scores de compétences** du vendeur sur les 5 dimensions
- ✅ **KPIs récents** (7 derniers jours : CA, ventes, panier moyen)
- ✅ **Nombre de debriefs** récents du vendeur
- ✅ **Contexte détaillé du conflit** (4 champs structurés + description libre)

---

## 🔑 Différences clés entre les deux prompts

| Critère | Gestion Relationnelle | Gestion de Conflit |
|---------|----------------------|-------------------|
| **Modèle IA** | GPT-5 | GPT-4o-mini |
| **Format de sortie** | Texte libre Markdown | JSON structuré |
| **Période KPI** | 30 derniers jours | 7 derniers jours |
| **Données vendeur** | KPIs + 5 debriefs récents | KPIs + scores compétences + debriefs count |
| **Style** | Recommandations générales | Vouvoiement obligatoire + approche communication |
| **Structure** | 4 sections libres | 4 champs JSON fixes |
| **Longueur max** | 400 mots | 15 lignes |

---

## 💡 Points importants

### Ce que l'IA reçoit TOUJOURS :
1. ✅ **Profil complet du manager** (si diagnostic complété)
2. ✅ **Profil complet du vendeur** (si diagnostic complété)
3. ✅ **Performances récentes** (KPIs si disponibles)
4. ✅ **Historique d'activité** (debriefs récents)

### Ce que l'IA NE reçoit PAS :
- ❌ Informations personnelles sensibles (salaire, adresse, etc.)
- ❌ Données d'autres vendeurs
- ❌ Informations du workspace/entreprise
- ❌ Historique complet (seulement les X derniers jours)

### Personnalisation de l'IA :
L'IA adapte ses recommandations en fonction de :
- 🎯 **Profil DISC** du manager et du vendeur
- 📊 **Performances récentes** du vendeur
- 📝 **Historique de coaching** (debriefs)
- 🎨 **Type de situation** spécifique

---

## 🛠️ Pour modifier les prompts

Les prompts se trouvent dans `/app/backend/server.py` :

- **Gestion Relationnelle** : lignes 6904-6943
- **Gestion de Conflit** : lignes 3709-3770

Vous pouvez modifier :
- La structure demandée
- Le ton (formel/informel)
- Le niveau de détail
- Les sections à inclure
- La longueur maximale

---

## 📊 Exemple de données réelles envoyées

### Manager :
```json
{
  "profil_nom": "Leader Inspirant",
  "profil_description": "Manager charismatique qui sait motiver ses équipes",
  "force_1": "Vision stratégique",
  "force_2": "Capacité à motiver",
  "axe_progression": "Gestion des détails opérationnels"
}
```

### Vendeur :
```json
{
  "style": "Dominant",
  "level": "Expert",
  "motivation": "Challenge et reconnaissance",
  "ai_profile_summary": "Vendeur performant, orienté résultats, aime les défis et la compétition. Nécessite de l'autonomie et de la reconnaissance régulière."
}
```

### KPIs (30j) :
```
- CA total : 45 230€
- Ventes totales : 127
- Panier moyen : 356€
```

### Debriefs récents :
```
1. 15/11/2024 : Vente conclue - iPhone 16 Pro - Excellente découverte client
2. 12/11/2024 : Opportunité manquée - MacBook Air - Objection prix non traitée
3. 10/11/2024 : Vente conclue - AirPods Pro - Bon closing
```

---

**Date de création :** 17 novembre 2024
**Dernière mise à jour :** 17 novembre 2024
