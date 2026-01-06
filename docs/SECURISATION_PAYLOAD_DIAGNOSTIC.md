# Sécurisation du Payload Diagnostic

## Objectif
Sécuriser le payload du diagnostic en utilisant `question_id` (Number) comme référence principale au lieu du texte de la question.

## Changements

### Backend

#### 1. Modèle Pydantic (`backend/models/diagnostics.py`)
- ✅ Ajout de `DiagnosticResponse` avec :
  - `question_id: int` (requis)
  - `answer: str` (requis)
  - `question: Optional[str]` (optionnel, pour debug)

#### 2. Route API (`backend/api/routes/ai.py`)
- ✅ Accepte `List[Union[DiagnosticResponse, Dict]]` pour compatibilité rétroactive
- ✅ Normalise les réponses au format attendu par le service AI
- ✅ Supporte les formats :
  - Nouveau : `{ question_id: int, answer: str, question?: str }`
  - Ancien : `{ question: str, answer: str }` (pour compatibilité)

#### 3. Service AI (`backend/services/ai_service.py`)
- ✅ Utilise `question_id` comme référence principale
- ✅ Utilise `question` (si fourni) pour le prompt AI, sinon génère un placeholder
- ✅ Format du prompt : `Q{question_id}: {question}\nR: {answer}`

### Frontend

#### Format envoyé
```javascript
[
  {
    question_id: 1,
    question: "Un client entre alors que tu termines une vente. Que fais-tu ?", // Optionnel
    answer: "Je lui fais un signe..."
  },
  {
    question_id: 16,
    question: "...", // Optionnel
    answer: "0"
  }
]
```

#### Composants modifiés
1. ✅ `DiagnosticFormScrollable.js`
2. ✅ `DiagnosticFormModal.js`
3. ✅ `DiagnosticFormSimple.js`
4. ✅ `DiagnosticForm.js`

## Avantages

1. **Sécurité** : Le backend s'appuie sur `question_id` (Number) au lieu du texte, évitant les problèmes de manipulation
2. **Traçabilité** : Chaque réponse est liée à un ID unique
3. **Debug** : Le champ `question` (optionnel) permet de voir le texte dans les logs
4. **Compatibilité** : Le backend accepte toujours l'ancien format pour rétrocompatibilité

## Validation

- ✅ Modèle Pydantic créé et validé
- ✅ Route API accepte le nouveau format
- ✅ Service AI utilise `question_id` comme référence
- ✅ Tous les composants frontend envoient le nouveau format
- ✅ Pas d'erreurs de lint

## Exemple de payload

### Avant
```json
[
  {
    "question": "Un client entre alors que tu termines une vente. Que fais-tu ?",
    "answer": "Je lui fais un signe..."
  }
]
```

### Après
```json
[
  {
    "question_id": 1,
    "question": "Un client entre alors que tu termines une vente. Que fais-tu ?",
    "answer": "Je lui fais un signe..."
  }
]
```

## Test manuel recommandé

1. Ouvrir l'écran de diagnostic vendeur
2. Remplir toutes les questions
3. Soumettre le formulaire
4. Vérifier dans les logs backend que le payload contient `question_id`
5. Vérifier que le diagnostic est généré correctement
6. Vérifier que le service AI utilise bien `question_id` pour la logique métier

