# Correction Bug 422 - Validation Profil Vendeur

## Problème
Erreur Pydantic: "Input should be a valid list" (loc=["body"]).
Le frontend envoyait un objet `{ "responses": { "1": "...", "16": 0, ... } }` alors que le backend attend une liste.

## Analyse

### Backend
- **Endpoint**: `POST /api/ai/diagnostic`
- **Fichier**: `backend/api/routes/ai.py` (ligne 12-36)
- **Type attendu**: `responses: List[Dict]` directement dans le body
- **Format attendu**: Chaque élément de la liste doit avoir `question` et `answer`
  ```python
  [
    { "question": "...", "answer": "..." },
    { "question": "...", "answer": "..." }
  ]
  ```

### Frontend (avant correction)
- **Format envoyé**: `{ responses: { "1": "...", "16": 0, ... } }`
- **Problème**: Objet au lieu de liste, et format incorrect

## Corrections apportées

### 1. DiagnosticFormScrollable.js
- ✅ Conversion de l'objet `responses` en liste avec `question` et `answer`
- ✅ Envoi direct de la liste (pas de wrapper `{ responses: [...] }`)
- ✅ Migration vers `apiClient` (remplacement de `axios`)
- ✅ Migration vers `logger` (remplacement de `console.log/error`)
- ✅ Amélioration des logs d'erreur avec status et data

### 2. DiagnosticFormModal.js
- ✅ Même correction que DiagnosticFormScrollable.js
- ✅ Migration vers `apiClient` et `logger`

### 3. DiagnosticFormSimple.js
- ✅ Conversion de l'objet `responses` en liste
- ✅ Migration vers `apiClient` et `logger`
- ✅ Amélioration des logs d'erreur

### 4. DiagnosticForm.js
- ✅ Conversion de l'objet `responses` en liste
- ✅ Migration vers `apiClient` et `logger`
- ✅ Amélioration des logs d'erreur

## Format de conversion

### Avant
```javascript
const responses = {
  "1": "Je lui fais un signe...",
  "16": 0,
  "17": 2
};

await axios.post('/api/ai/diagnostic', { responses });
```

### Après
```javascript
const responses = {
  "1": "Je lui fais un signe...",
  "16": 0,
  "17": 2
};

// Conversion en liste
const responsesList = [];
questions.forEach(section => {
  section.items.forEach(question => {
    const questionId = question.id;
    const answer = responses[questionId];
    if (answer !== undefined && answer !== null) {
      responsesList.push({
        question: question.text,
        answer: typeof answer === 'number' ? answer.toString() : answer.toString()
      });
    }
  });
});

// Envoi direct de la liste
await api.post('/ai/diagnostic', responsesList);
```

## Logs d'erreur améliorés

### Avant
```javascript
catch (err) {
  console.error('Error submitting diagnostic:', err);
  toast.error('Erreur lors de l\'analyse du profil');
}
```

### Après
```javascript
catch (err) {
  logger.error('Error submitting diagnostic:', err);
  logger.error('Error status:', err.response?.status);
  logger.error('Error data:', err.response?.data);
  toast.error(err.response?.data?.detail || 'Erreur lors de l\'analyse du profil');
}
```

## Fichiers modifiés

1. `frontend/src/components/DiagnosticFormScrollable.js`
2. `frontend/src/components/DiagnosticFormModal.js`
3. `frontend/src/components/DiagnosticFormSimple.js`
4. `frontend/src/components/DiagnosticForm.js`

## Validation

- ✅ Tous les composants convertissent correctement l'objet en liste
- ✅ Le format correspond au schéma Pydantic attendu
- ✅ Migration vers `apiClient` et `logger` effectuée
- ✅ Logs d'erreur améliorés avec status et data
- ✅ Pas d'erreurs de lint

## Test manuel recommandé

1. Ouvrir l'écran de diagnostic vendeur
2. Remplir toutes les questions
3. Soumettre le formulaire
4. Vérifier que la requête POST `/api/ai/diagnostic` envoie bien une liste
5. Vérifier qu'il n'y a plus d'erreur 422
6. Vérifier que le diagnostic est créé avec succès

