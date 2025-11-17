# 📚 Documentation État Actuel - Composants IA

**Date de documentation:** ${new Date().toISOString()}
**But:** Sauvegarder le fonctionnement exact AVANT unification

---

## 1️⃣ **DebriefHistoryModal** (Analyse de vente - Vendeur)

### 📍 Localisation
`/app/frontend/src/components/DebriefHistoryModal.js`

### 🎯 Fonctionnalités
- Analyse de vente conclue ✅
- Analyse de vente manquée ❌
- Historique des analyses avec filtres
- Toggle visibilité manager
- Refresh automatique après soumission

### 🔌 Endpoints API

**Vente Conclue:**
```javascript
POST ${API}/api/debriefs
Body: {
  type_vente: 'vente_conclue',
  produits_vendus: array,
  techniques_utilisees: array,
  defis_rencontres: array,
  points_amelioration: array,
  ressenti: string,
  visible_to_manager: boolean,
  produit: string
}
```

**Vente Manquée:**
```javascript
POST ${API}/api/debriefs
Body: {
  type_vente: 'opportunite_manquee',
  raisons: array,
  contexte_client: string,
  tentatives: array,
  ressenti: string,
  visible_to_manager: boolean,
  produit: string
}
```

**Historique:**
```javascript
GET ${API}/api/debriefs
```

### 📦 Données Reçues (Response)
```javascript
{
  id: string,
  coaching_ia: string,  // Texte markdown du coaching
  created_at: string,
  type_vente: string,
  visible_to_manager: boolean,
  // ... autres champs du debrief
}
```

### 🎨 Affichage
- Modal avec tabs : "Nouvelle Analyse" / "Historique"
- Formulaire multi-sélection avec checkboxes
- Coaching IA affiché en markdown formaté
- Badge de visibilité (œil)
- Filtres historique : Tous / Succès / Manquées

### ⚙️ États et Pattern Actuel
```javascript
const [formConclue, setFormConclue] = useState({...});
const [formManquee, setFormManquee] = useState({...});
const [pendingSuccess, setPendingSuccess] = useState(null);
const [loading, setLoading] = useState(false);
const [debriefs, setDebriefs] = useState([]);

// Pattern: Callback parent via onSuccess()
useEffect(() => {
  if (pendingSuccess) {
    onSuccess(pendingSuccess);
    setPendingSuccess(null);
  }
}, [pendingSuccess]);
```

### 🔄 Comportement Spécifique
1. Après soumission → appelle `onSuccess(data)` → parent refresh le dashboard
2. Reset automatique du formulaire après succès
3. Ouvre automatiquement le dernier debrief créé si prop fournie
4. Toggle visibilité avec PATCH sur chaque debrief

---

## 2️⃣ **RelationshipManagementModal** (Gestion relationnelle - Manager)

### 📍 Localisation
`/app/frontend/src/components/RelationshipManagementModal.js`

### 🎯 Fonctionnalités
- Conseils relationnels pour gérer un vendeur
- Gestion de conflit entre vendeurs
- Historique des interventions
- Filtres par type et vendeur
- Multi-tabs : Relationnel / Conflit

### 🔌 Endpoints API

**Génération conseil:**
```javascript
POST ${API}/api/manager/relationship-advice
Body: {
  seller_id: string,
  advice_type: 'relationnel' | 'conflit',
  situation_type: string,
  description: string
}
```

**Historique:**
```javascript
GET ${API}/api/manager/relationship-history?advice_type=XXX
```

### 📦 Données Reçues
```javascript
{
  recommendation: string,  // Texte markdown des recommandations
  seller_id: string,
  advice_type: string,
  situation_type: string,
  created_at: string
}
```

### 🎨 Affichage
- Modal avec 2 onglets principaux : "Formulaire" / "Historique"
- Sous-tabs dans formulaire : "Relationnel" / "Conflit"
- Dropdown sélection vendeur
- Types de situations prédéfinis
- Recommandations IA en markdown formaté avec design vert
- Historique avec expand/collapse
- Filtres : All / Relationnel / Conflit
- Filtres vendeur dans historique

### ⚙️ États et Pattern Actuel
```javascript
const [recommendation, setRecommendation] = useState('');
const [isGenerating, setIsGenerating] = useState(false);
const [pendingRecommendation, setPendingRecommendation] = useState(null);
const [selectedSeller, setSelectedSeller] = useState(null);
const [situationType, setSituationType] = useState('');
const [description, setDescription] = useState('');

// Pattern: Multi-state avec pending
useEffect(() => {
  if (pendingRecommendation) {
    setRecommendation(pendingRecommendation);
    setPendingRecommendation(null);
    setIsGenerating(false);
    toast.success('Recommandation générée avec succès !');
  }
}, [pendingRecommendation]);
```

### 🔄 Comportement Spécifique
1. Refresh automatique de l'historique après génération
2. Filtres en temps réel sur l'historique
3. Expand/collapse des items historique
4. Liste vendeurs dynamique depuis props
5. Reset formulaire après génération

---

## 3️⃣ **ConflictResolutionForm** (Gestion de conflit - Manager)

### 📍 Localisation
`/app/frontend/src/components/ConflictResolutionForm.js`

### 🎯 Fonctionnalités
- Résolution de conflit pour UN vendeur spécifique
- Vue d'ensemble (overview) avec stats
- Formulaire détaillé avec contexte SCI (Situation-Comportement-Impact)
- Historique des résolutions de conflit
- Display des résultats IA

### 🔌 Endpoints API

**Génération résolution:**
```javascript
POST ${API}/manager/conflict-resolution
Body: {
  seller_id: string,
  contexte: string,
  comportement_observe: string,
  impact: string,
  tentatives_precedentes: string,
  description_libre: string
}
```

**Historique:**
```javascript
GET ${API}/manager/conflict-resolution/${sellerId}
```

### 📦 Données Reçues
```javascript
{
  analyse: string,
  recommandations: string,
  phrases_cles: string,
  plan_action: string,
  seller_id: string,
  created_at: string
}
```

### 🎨 Affichage
- 3 vues : Overview / Formulaire / Résultats
- Overview : Stats + bouton "Nouvelle résolution"
- Formulaire : Champs détaillés avec labels explicatifs
- Résultats : Sections markdown (Analyse, Recommandations, Phrases clés, Plan d'action)
- Historique avec expand/collapse
- Bouton "Nouvelle analyse" après résultats

### ⚙️ États et Pattern Actuel
```javascript
const [state, dispatch] = useReducer(conflictReducer, {
  formData: {...},
  loading: false,
  aiRecommendations: null,
  conflictHistory: [],
  expandedHistoryItems: {},
  loadingHistory: true,
  showForm: false,
  pendingRecommendation: null
});

// Pattern: Reducer avec action atomique
useEffect(() => {
  if (state.pendingRecommendation) {
    dispatch({ type: 'APPLY_RECOMMENDATIONS', payload: state.pendingRecommendation });
    toast.success('Recommandations générées avec succès');
  }
}, [state.pendingRecommendation]);
```

### 🔄 Comportement Spécifique
1. **Affichage conditionnel complexe:**
   - `!showForm && !aiRecommendations` → Overview
   - `showForm && !aiRecommendations` → Formulaire
   - `aiRecommendations` → Résultats
2. Refresh automatique historique après génération
3. Reset formulaire après soumission
4. Toggle expand/collapse historique
5. Bouton "Retour à la vue d'ensemble" depuis résultats

### ⚠️ Problème Actuel
❌ **Crash insertBefore** car l'action `APPLY_RECOMMENDATIONS` change à la fois :
- Les données (`aiRecommendations`)
- L'affichage (`showForm: false`)
→ React démonte Form et monte Results simultanément

---

## 4️⃣ **TeamAIAnalysisModal** (Analyse d'équipe - Manager)

### 📍 Localisation
`/app/frontend/src/components/TeamAIAnalysisModal.js`

### 🎯 Fonctionnalités
- Analyse globale de l'équipe
- Génération à la demande
- Affichage du résultat IA

### 🔌 Endpoints API

**Génération analyse:**
```javascript
POST ${API}/api/manager/analyze-team
Body: {
  team_data: {
    total_sellers: number,
    sellers_with_kpi: number,
    team_total_ca: number,
    team_total_ventes: number,
    sellers_details: [
      {
        name: string,
        ca: number,
        ventes: number,
        panier_moyen: number,
        avg_competence: number,
        best_skill: string,
        worst_skill: string
      }
    ]
  }
}
```

### 📦 Données Reçues
```javascript
{
  analysis: string  // Texte markdown de l'analyse
}
```

### 🎨 Affichage
- Modal simple
- État initial : Bouton "Générer l'analyse"
- État généré : Texte markdown formaté
- Header avec gradient indigo-purple
- Loading spinner pendant génération

### ⚙️ États et Pattern Actuel
```javascript
const [aiAnalysis, setAiAnalysis] = useState(null);
const [loading, setLoading] = useState(false);

// Pattern: Ultra simple direct
const handleGenerateAnalysis = async () => {
  setLoading(true);
  try {
    const res = await axios.post(endpoint, data);
    setAiAnalysis(res.data.analysis);
    toast.success('Analyse IA générée !');
  } catch (err) {
    toast.error('Erreur');
  } finally {
    setLoading(false);
  }
};

// Affichage direct
{aiAnalysis && <div>{aiAnalysis}</div>}
```

### 🔄 Comportement Spécifique
1. Pas d'historique (génération à la demande)
2. Pas de formulaire (données viennent des props)
3. Une seule génération par ouverture du modal
4. Props `teamData` préparées par le parent

---

## 5️⃣ **StoreKPIAIAnalysisModal** (Analyse KPI magasin - Manager)

### 📍 Localisation
`/app/frontend/src/components/StoreKPIAIAnalysisModal.js`

### 🎯 Fonctionnalités
- Analyse des KPI du magasin
- Génération à la demande
- Affichage du résultat IA

### 🔌 Endpoints API

**Génération analyse:**
```javascript
POST ${API}/api/manager/analyze-store-kpi
Body: {
  kpi_data: {
    // Données KPI du magasin
  }
}
```

### 📦 Données Reçues
```javascript
{
  analysis: string  // Texte markdown de l'analyse
}
```

### 🎨 Affichage
- Modal simple
- Design similaire à TeamAIAnalysisModal
- Affichage markdown

### ⚙️ États et Pattern Actuel
```javascript
const [aiAnalysis, setAiAnalysis] = useState(null);
const [loading, setLoading] = useState(false);

// Pattern: Ultra simple (identique à TeamAIAnalysisModal)
```

### 🔄 Comportement Spécifique
- Identique à TeamAIAnalysisModal
- Données KPI passées en props

---

## 6️⃣ **DailyChallengeModal** (Défis quotidiens - Vendeur)

### 📍 Localisation
`/app/frontend/src/components/DailyChallengeModal.js`

### 🎯 Fonctionnalités
- Génération de défis quotidiens personnalisés
- Affichage des défis actifs
- Complétion des défis

### 🔌 Endpoints API

**Génération défis:**
```javascript
POST ${API}/api/daily-challenge/generate
```

**Complétion défi:**
```javascript
POST ${API}/api/daily-challenge/complete
Body: {
  challenge_id: string
}
```

### 📦 Données Reçues
```javascript
{
  challenges: [
    {
      id: string,
      title: string,
      description: string,
      difficulty: string,
      points: number,
      completed: boolean
    }
  ]
}
```

### 🎨 Affichage
- Modal avec liste de défis
- Cards pour chaque défi
- Badge de difficulté
- Bouton complétion
- Points visibles

### ⚙️ États et Pattern Actuel
```javascript
const [challenges, setChallenges] = useState([]);
const [loading, setLoading] = useState(false);

// Pattern: Ultra simple
```

### 🔄 Comportement Spécifique
1. Génération automatique au chargement
2. Refresh après complétion d'un défi
3. Affichage état complété/non complété

---

## 📊 RÉSUMÉ DES PATTERNS ACTUELS

| Composant | Pattern | Complexité | Historique | Filtres | Multi-forms |
|-----------|---------|------------|------------|---------|-------------|
| DebriefHistoryModal | Callback parent | Élevée | ✅ | ✅ | ✅ (2 types) |
| RelationshipManagementModal | Multi-state pending | Élevée | ✅ | ✅ | ✅ (2 tabs) |
| ConflictResolutionForm | Reducer | Très élevée | ✅ | ❌ | ❌ |
| TeamAIAnalysisModal | Ultra simple | Faible | ❌ | ❌ | ❌ |
| StoreKPIAIAnalysisModal | Ultra simple | Faible | ❌ | ❌ | ❌ |
| DailyChallengeModal | Ultra simple | Faible | ❌ | ❌ | ❌ |

---

## 🎯 POINTS CRITIQUES À PRÉSERVER

### 1. **DebriefHistoryModal**
- ✅ Le callback `onSuccess()` pour refresh parent
- ✅ L'ouverture automatique du dernier debrief (`openLatestDebrief`)
- ✅ Le toggle visibilité avec PATCH
- ✅ Les 2 formulaires distincts (conclue/manquée)

### 2. **RelationshipManagementModal**
- ✅ Les 2 tabs (Relationnel / Conflit)
- ✅ Le dropdown de sélection vendeur
- ✅ Les filtres historique
- ✅ Le design vert pour les recommandations

### 3. **ConflictResolutionForm**
- ✅ Les 3 vues (Overview / Form / Results)
- ✅ Le formulaire SCI détaillé
- ✅ Les 4 sections de résultats (Analyse, Recommandations, Phrases clés, Plan)
- ⚠️ À CORRIGER : Le pattern Reducer qui cause le crash

### 4. **Autres composants**
- ✅ Pattern simple à conserver
- ✅ Génération à la demande

---

## 🔒 ENDPOINTS À NE PAS MODIFIER

Tous les endpoints backend sont stables et fonctionnent. L'unification ne concernera QUE le frontend.

---

**Documentation complétée le:** ${new Date().toISOString()}
**Prête pour l'unification sans perte de fonctionnalité**
