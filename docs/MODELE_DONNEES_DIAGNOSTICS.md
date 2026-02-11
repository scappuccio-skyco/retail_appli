# Modèles de données – Réponses aux diagnostics (Vendeur & Manager)

Le projet utilise **Pydantic** pour la validation des données. La persistance est **MongoDB** (pas de SQLAlchemy). Ce document décrit les modèles et comment **questions**, **options** et **scores** sont liés.

---

## 1. Modèles Pydantic (diagnostics)

**Fichier :** `backend/models/diagnostics.py`

### Diagnostic Vendeur

| Modèle | Rôle |
|--------|------|
| **DiagnosticResponse** | Une réponse individuelle : `question_id` (int), `answer` (str), `question` (optionnel). |
| **DiagnosticCreate** | Payload de création : `responses: dict` (compatibilité ancien format). |
| **DiagnosticResult** | Document diagnostic complet après traitement (stocké en base). |

**Structure de `DiagnosticResult` (vendeur) :**

```python
class DiagnosticResult(BaseModel):
    id: str
    seller_id: str
    responses: dict                    # { "1": 0, "2": 1, ... "23": 2 }  (question_id -> index d'option)
    ai_profile_summary: str
    style: str                         # Convivial, Explorateur, Dynamique, Discret, Stratège
    level: str                         # Nouveau Talent, Challenger, Ambassadeur, Maître du Jeu
    motivation: str                    # Relation, Reconnaissance, Performance, Découverte
    score_accueil: float = 0           # sur 10 (une décimale)
    score_decouverte: float = 0
    score_argumentation: float = 0
    score_closing: float = 0
    score_fidelisation: float = 0
    disc_dominant: str = None          # D, I, S, C
    disc_percentages: dict = None      # {'D': 30, 'I': 40, 'S': 20, 'C': 10}
    created_at: datetime
```

### Diagnostic Manager

| Modèle | Rôle |
|--------|------|
| **ManagerDiagnosticCreate** | Payload de création : `responses: Dict[str, Any]` (clé = numéro/question, valeur = réponse texte). |
| **ManagerDiagnosticResult** | Document diagnostic manager après analyse IA. |

**Structure de `ManagerDiagnosticResult` :**

```python
class ManagerDiagnosticResult(BaseModel):
    id: str
    manager_id: str
    responses: dict                    # { "1": "réponse texte", "2": "...", ... }
    profil_nom: str                    # Le Pilote, Le Coach, Le Dynamiseur, Le Stratège, L'Inspire
    profil_description: str
    force_1: str
    force_2: str
    axe_progression: str
    recommandation: str
    exemple_concret: str
    disc_dominant: str = None
    disc_percentages: dict = None
    created_at: datetime
```

Les réponses manager sont **texte libre** par question ; il n’y a pas de grille question → options numérotées comme pour le vendeur. Les **scores** ne sont pas calculés côté backend : l’IA produit directement les champs de profil (profil_nom, force_1, etc.).

---

## 2. Liaison Questions ↔ Options ↔ Scores (Vendeur)

**Fichier :** `backend/api/routes/sellers.py`

### Format des réponses reçues

- **Clé** : `question_id` en string (`"1"` à `"23"`).
- **Valeur** : **index de l’option choisie** (0, 1, 2, …), en int ou string converti en int.

Exemple : `responses = { "1": 0, "2": 2, "3": 1, ... }` signifie « question 1 → option 0 », « question 2 → option 2 », etc.

### Compétences (questions 1–15)

Les **questions 1 à 15** sont regroupées par compétence (3 questions par compétence). Chaque question a une grille de **scores par option** (`question_scores`).

- **Compétences** : accueil (Q1–3), decouverte (Q4–6), argumentation (Q7–9), closing (Q10–12), fidelisation (Q13–15).
- **Règle** : pour une question `q_id`, la valeur envoyée est l’**index d’option** ; le score utilisé est `question_scores[q_id][option_idx]` (ex. option 0 → premier nombre de la liste).

Extrait du mapping :

```python
competence_mapping = {
    'accueil': [1, 2, 3],
    'decouverte': [4, 5, 6],
    'argumentation': [7, 8, 9],
    'closing': [10, 11, 12],
    'fidelisation': [13, 14, 15]
}
question_scores = {
    1: [5, 3, 4],    # question 1 : option 0→5, option 1→3, option 2→4
    2: [5, 4, 3, 2],
    ...
    15: [5, 3, 5, 4]
}
```

Le **score final** d’une compétence est la **moyenne** des scores des 3 questions de cette compétence, arrondie à 1 décimale (ex. `score_accueil`).

### DISC (questions 16–23)

Les **questions 16 à 23** servent uniquement au profil DISC.

- **Valeur** : index d’option (0, 1, 2, 3).
- **Mapping** : option 0 → D, 1 → I, 2 → S, 3 → C (pour toutes les questions 16–23 dans le code actuel).
- On compte les D, I, S, C puis on calcule les **pourcentages** et le **dominant** (D/I/S/C avec le plus grand %).

Résumé du lien :

- **Réponse** = `responses["16"]` … `responses["23"]` (index 0–3).
- **Scores** = `disc_percentages` et `disc_dominant` (pas de score par compétence pour le DISC).

---

## 3. Flux de données

### Vendeur

1. **Frontend** envoie une liste ou un dict de réponses (ex. `[{ question_id: 1, answer: "0" }, ...]` ou `{ "1": 0, "2": 1, ... }`).
2. **API** normalise en `dict` : clés = `question_id` en string, valeur = index d’option (int).
3. **Scores compétences** : `calculate_competence_scores_from_questionnaire(responses)` → `score_accueil`, `score_decouverte`, etc. (via `competence_mapping` + `question_scores`).
4. **DISC** : `calculate_disc_profile(responses)` sur les clés 16–23 → `disc_dominant`, `disc_percentages`.
5. **IA** (optionnelle) : peut enrichir `style`, `level`, `motivation`, `ai_profile_summary` à partir des mêmes réponses.
6. **Document** final = structure `DiagnosticResult` (avec `responses`, tous les scores, DISC, champs IA) → enregistré en base (collection `diagnostics`).

### Manager

1. **Frontend** envoie `responses: { "1": "texte", "2": "texte", ... }` (réponses libres).
2. **API** passe ce dict à **analyse IA** ; l’IA retourne `profil_nom`, `profil_description`, `force_1`, `force_2`, `axe_progression`, `recommandation`, `exemple_concret`.
3. Aucun calcul de scores par question/option : pas de `question_scores` ni de mapping option → note.
4. **Document** = structure `ManagerDiagnosticResult` (avec `responses` brutes + champs IA) → enregistré (collection `manager_diagnostics`).

---

## 4. Où sont définies les questions et options ?

- **Vendeur** : les **textes** des questions et des options sont définis côté **frontend** (ex. `DiagnosticFormScrollable.js`, `DiagnosticFormModal.js`). Le backend ne stocke que les **IDs de question** et les **index d’option** ; la grille `question_scores` dans `sellers.py` fait le lien option → score.
- **Manager** : les questions sont également côté **frontend** (`ManagerDiagnosticForm.js`) ; les réponses sont du texte libre, pas d’options numérotées ni de scores calculés côté backend.

---

## 5. Schéma récapitulatif

```
VENDEUR
  réponses: { "1": 0, "2": 1, ... "15": 2, "16": 0, ... "23": 3 }
       │
       ├─► questions 1–15  → competence_mapping + question_scores
       │                    → score_accueil, score_decouverte, score_argumentation,
       │                       score_closing, score_fidelisation (moyenne sur 10)
       │
       └─► questions 16–23 → disc_mapping (option 0→D, 1→I, 2→S, 3→C)
                             → disc_dominant, disc_percentages

MANAGER
  réponses: { "1": "texte", "2": "texte", ... }
       │
       └─► analyse IA (prompt avec toutes les réponses)
           → profil_nom, profil_description, force_1, force_2, axe_progression,
             recommandation, exemple_concret
           (pas de scores numériques par question/option)
```

---

*Document généré à partir du code (models/diagnostics.py, api/routes/sellers.py, api/routes/diagnostics.py, api/routes/ai.py).*
