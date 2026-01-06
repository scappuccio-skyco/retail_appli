# Correction des erreurs 405 - Mise à jour de progression Objectifs/Challenges

## Problème identifié

**Erreur 405 (Method Not Allowed)** lors de la mise à jour de progression :
- Frontend utilisait `POST /api/manager/objectives/{id}/progress` ✅
- Backend avait `PUT /api/manager/objectives/{id}/progress` ❌
- **Incompatibilité méthode HTTP** → 405

## Solution implémentée (OPTION B)

### Architecture choisie : POST /{id}/progress

**Routes Manager :**
- `POST /api/manager/objectives/{objective_id}/progress`
- `POST /api/manager/challenges/{challenge_id}/progress`

**Routes Seller (nouveau) :**
- `POST /api/seller/objectives/{objective_id}/progress`
- `POST /api/seller/challenges/{challenge_id}/progress`

### Payload standardisé

```json
{
  "value": number,           // ou "current_value" pour compatibilité
  "date": "YYYY-MM-DD",      // optionnel
  "comment": "string"         // optionnel
}
```

### Effets automatiques

1. **Mise à jour `current_value`**
2. **Recalcul `progress_percentage`** : `(current_value / target_value) * 100`
3. **Mise à jour `status`** via `compute_status()` :
   - `"active"` : si `current_value < target_value` ET `date <= end_date`
   - `"achieved"` : si `current_value >= target_value`
   - `"failed"` : si `date > end_date` ET non atteint

## Contrôles d'accès implémentés

### Manager
- ✅ Peut toujours mettre à jour les objectifs/challenges de son store
- ✅ Peut mettre à jour un objectif individuel si `seller_id` appartient au store
- ✅ Peut mettre à jour un collectif

### Seller
- ✅ Ne peut mettre à jour **QUE** si :
  1. `data_entry_responsible == "seller"` (source de vérité)
  2. `visible == true`
  3. **Pour individual** : `seller_id == current_user.id`
  4. **Pour collective** : `seller_id IN visible_to_sellers` OU `visible_to_sellers == null/[]`
- ❌ Sinon → **403 Forbidden**

## Routes AVANT / APRÈS

### AVANT

**Manager :**
- `PUT /api/manager/objectives/{id}/progress` ❌ (frontend utilisait POST)
- `PUT /api/manager/challenges/{id}/progress` ❌ (frontend utilisait POST)

**Seller :**
- ❌ Aucune route pour mise à jour progression

### APRÈS

**Manager :**
- ✅ `POST /api/manager/objectives/{id}/progress`
- ✅ `POST /api/manager/challenges/{id}/progress`

**Seller :**
- ✅ `POST /api/seller/objectives/{id}/progress` (nouveau)
- ✅ `POST /api/seller/challenges/{id}/progress` (nouveau)

## Fichiers modifiés

### Backend

1. **`backend/api/routes/manager.py`**
   - Changé `@router.put` → `@router.post` pour `/objectives/{id}/progress`
   - Changé `@router.put` → `@router.post` pour `/challenges/{id}/progress`
   - Ajouté recalcul `progress_percentage` et `status` via `compute_status()`
   - Ajouté contrôle d'accès manager

2. **`backend/api/routes/sellers.py`** (nouveau)
   - Ajouté `POST /objectives/{id}/progress` avec contrôles d'accès seller
   - Ajouté `POST /challenges/{id}/progress` avec contrôles d'accès seller
   - Vérifications : `data_entry_responsible`, `visible`, `seller_id`, `visible_to_sellers`

### Frontend

**`frontend/src/components/ManagerSettingsModal.js`**
- ✅ Déjà correct : utilise `axios.post` sur `/progress`
- Aucune modification nécessaire

## Exemples de requêtes HTTP

### Manager - Mise à jour progression objectif

```bash
curl -X POST "https://api.example.com/api/manager/objectives/abc123/progress?store_id=store456" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "value": 1500,
    "date": "2025-01-15",
    "comment": "Progression manuelle"
  }'
```

**Réponse :**
```json
{
  "success": true,
  "current_value": 1500,
  "progress_percentage": 75.0,
  "status": "active"
}
```

### Seller - Mise à jour progression objectif

```bash
curl -X POST "https://api.example.com/api/seller/objectives/abc123/progress" \
  -H "Authorization: Bearer <seller_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "value": 1200
  }'
```

**Réponse si autorisé :**
```json
{
  "success": true,
  "current_value": 1200,
  "progress_percentage": 60.0,
  "status": "active"
}
```

**Réponse si non autorisé (403) :**
```json
{
  "detail": "Vous n'êtes pas autorisé à mettre à jour cet objectif. Seul le manager peut le faire."
}
```

## Tests de validation

### Test 1 : Manager peut toujours mettre à jour
- ✅ Manager met à jour objectif collectif → 200 OK
- ✅ Manager met à jour objectif individuel → 200 OK

### Test 2 : Seller avec data_entry_responsible="seller"
- ✅ Seller met à jour objectif individuel (seller_id match) → 200 OK
- ✅ Seller met à jour objectif collectif (visible_to_sellers contient seller_id) → 200 OK
- ❌ Seller met à jour objectif individuel (seller_id ne match pas) → 403 Forbidden
- ❌ Seller met à jour objectif collectif (visible_to_sellers ne contient pas seller_id) → 403 Forbidden

### Test 3 : Seller avec data_entry_responsible="manager"
- ❌ Seller tente de mettre à jour → 403 Forbidden

### Test 4 : Calcul automatique status
- ✅ `current_value=0, target=100, end_date=future` → `status="active"`
- ✅ `current_value=100, target=100, end_date=future` → `status="achieved"`
- ✅ `current_value=50, target=100, end_date=past` → `status="failed"`

## Cause racine du 405

**Le frontend utilisait `POST` mais le backend attendait `PUT`.**

FastAPI retourne 405 (Method Not Allowed) quand :
- La route existe mais la méthode HTTP ne correspond pas
- Exemple : route définie avec `@router.put()` mais appelée avec `POST`

**Solution :** Aligner backend et frontend sur `POST /progress` (OPTION B recommandée).

## Prochaines étapes (optionnel)

1. Ajouter historique de progression (table `progress_history`)
2. Ajouter validation : `value >= 0`
3. Ajouter webhook/notification lors changement de status
4. Ajouter métriques de progression (taux de complétion, etc.)

