# Fix 405 Error - Progress Update Routes

## Problème identifié

En PROD, erreur 405 (Method Not Allowed) sur :
- `POST /api/manager/objectives/{id}`
- `POST /api/manager/challenges/{id}`

## Analyse

### 1. Appels Frontend

**ManagerSettingsModal.js** (lignes 586-590, 426-430) :
```javascript
// Objectif
await axios.post(
  `${API}/manager/objectives/${objectiveId}/progress${storeParam}`,
  { current_value: parseFloat(progressValue) },
  { headers }
);

// Challenge
await axios.post(
  `${API}/manager/challenges/${challengeId}/progress${storeParam}`,
  { current_value: parseFloat(challengeProgressValue) },
  { headers }
);
```

✅ **Frontend appelle correctement** : `/api/manager/objectives/{id}/progress`

### 2. Routes Backend

**backend/api/routes/manager.py** :
- ✅ `@router.post("/objectives/{objective_id}/progress")` (ligne 1180)
- ✅ `@router.post("/challenges/{challenge_id}/progress")` (ligne 1504)
- ✅ Router prefix: `/manager`
- ✅ App prefix: `/api`
- ✅ Route complète: `/api/manager/objectives/{id}/progress`

**Problème** : Si un appel frontend (ou cache) utilise `POST /api/manager/objectives/{id}` (sans `/progress`), FastAPI retourne 405 car cette route n'existe pas en POST (seulement PUT pour update).

## Solution : Alias de routes

Ajout d'alias pour accepter POST directement sur les chemins sans `/progress` :

```python
@router.post("/objectives/{objective_id}")
@router.post("/objectives/{objective_id}/progress")  # Alias
async def update_objective_progress(...):
    # Handler existant
```

## Modifications

### backend/api/routes/manager.py

**Ligne 1180** :
```python
@router.post("/objectives/{objective_id}")
@router.post("/objectives/{objective_id}/progress")  # Alias for explicit progress endpoint
async def update_objective_progress(...):
    """
    Update progress on an objective.
    
    Accepts both:
    - POST /api/manager/objectives/{id} (alias for compatibility)
    - POST /api/manager/objectives/{id}/progress (explicit endpoint)
    ...
    """
```

**Ligne 1504** :
```python
@router.post("/challenges/{challenge_id}")
@router.post("/challenges/{challenge_id}/progress")  # Alias for explicit progress endpoint
async def update_challenge_progress(...):
    """
    Update progress on a challenge.
    
    Accepts both:
    - POST /api/manager/challenges/{id} (alias for compatibility)
    - POST /api/manager/challenges/{id}/progress (explicit endpoint)
    ...
    """
```

## Vérification Seller Update Progress

### Contrôles d'accès existants (backend/api/routes/sellers.py)

**Ligne 556-628** (`update_seller_objective_progress`) :
1. ✅ `data_entry_responsible == "seller"` (sinon 403)
2. ✅ `visible == true` (sinon 403)
3. ✅ Pour individuel : `seller_id == current_user.id` (sinon 403)
4. ✅ Pour collectif : `seller_id in visible_to_sellers` OU `visible_to_sellers == null/[]` (sinon 403)

**Ligne 669-741** (`update_seller_challenge_progress`) : Même logique

### Champs DB utilisés

- `visible` : boolean (true = visible aux sellers)
- `visible_to_sellers` : array de seller_ids ou null/[] (null/[] = tous les sellers)
- `data_entry_responsible` : "seller" | "manager" | null
- `seller_id` : pour objectifs/challenges individuels
- `type` : "individual" | "collective"
- `participants` : (legacy, non utilisé dans les contrôles actuels)

## Tests curl

### 1. Manager - Update Objective Progress

```bash
curl -X POST "https://retailperformerai.com/api/manager/objectives/{objective_id}/progress?store_id={store_id}" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "current_value": 150.5,
    "date": "2025-01-15",
    "comment": "Progression validée"
  }'
```

**Attendu** : 200 OK avec `{"success": true, "message": "Progression mise à jour"}`

### 2. Manager - Update Challenge Progress

```bash
curl -X POST "https://retailperformerai.com/api/manager/challenges/{challenge_id}/progress?store_id={store_id}" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "current_value": 200.0,
    "date": "2025-01-15"
  }'
```

**Attendu** : 200 OK

### 3. Seller - Update Objective Progress (autorisé)

**Prérequis** :
- Objective avec `visible: true`
- Objective avec `data_entry_responsible: "seller"`
- Pour individuel : `seller_id == seller_id_du_token`
- Pour collectif : `visible_to_sellers == null/[]` OU `seller_id_du_token in visible_to_sellers`

```bash
curl -X POST "https://retailperformerai.com/api/seller/objectives/{objective_id}/progress" \
  -H "Authorization: Bearer {seller_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "current_value": 100.0
  }'
```

**Attendu** : 200 OK

### 4. Seller - Update Objective Progress (refusé -> 403)

**Cas 1** : `data_entry_responsible != "seller"`

```bash
curl -X POST "https://retailperformerai.com/api/seller/objectives/{objective_id}/progress" \
  -H "Authorization: Bearer {seller_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "current_value": 100.0
  }'
```

**Attendu** : 403 Forbidden
```json
{
  "detail": "Vous n'êtes pas autorisé à mettre à jour cet objectif. Seul le manager peut le faire."
}
```

**Cas 2** : `visible == false`

**Attendu** : 403 Forbidden
```json
{
  "detail": "Cet objectif n'est pas visible"
}
```

**Cas 3** : Objectif individuel avec `seller_id != current_user.id`

**Attendu** : 403 Forbidden
```json
{
  "detail": "Vous n'êtes pas autorisé à mettre à jour cet objectif individuel"
}
```

**Cas 4** : Objectif collectif avec `seller_id not in visible_to_sellers` (et `visible_to_sellers` non vide)

**Attendu** : 403 Forbidden
```json
{
  "detail": "Vous n'êtes pas autorisé à mettre à jour cet objectif collectif"
}
```

## Diff exact

```diff
--- a/backend/api/routes/manager.py
+++ b/backend/api/routes/manager.py
@@ -1177,9 +1177,20 @@ async def delete_objective(
     except Exception as e:
         raise HTTPException(status_code=500, detail=str(e))
 
+@router.post("/objectives/{objective_id}")
 @router.post("/objectives/{objective_id}/progress")
 async def update_objective_progress(
     objective_id: str,
     progress_data: dict,
     store_id: Optional[str] = Query(None, description="Store ID (requis pour gérant)"),
     context: dict = Depends(get_store_context),
     db = Depends(get_db)
 ):
     """
-    Update progress on an objective (OPTION B: POST /progress)
+    Update progress on an objective.
+    
+    Accepts both:
+    - POST /api/manager/objectives/{id} (alias for compatibility)
+    - POST /api/manager/objectives/{id}/progress (explicit endpoint)
     ...
     """
 
@@ -1501,9 +1512,20 @@ async def delete_challenge(
     except Exception as e:
         raise HTTPException(status_code=500, detail=str(e))
 
+@router.post("/challenges/{challenge_id}")
 @router.post("/challenges/{challenge_id}/progress")
 async def update_challenge_progress(
     challenge_id: str,
     progress_data: dict,
     store_id: Optional[str] = Query(None, description="Store ID (requis pour gérant)"),
     context: dict = Depends(get_store_context),
     db = Depends(get_db)
 ):
     """
-    Update progress on a challenge (OPTION B: POST /progress)
+    Update progress on a challenge.
+    
+    Accepts both:
+    - POST /api/manager/challenges/{id} (alias for compatibility)
+    - POST /api/manager/challenges/{id}/progress (explicit endpoint)
     ...
     """
```

## Validation

✅ Routes manager : Alias ajoutés pour POST sans `/progress`
✅ Routes seller : Contrôles d'accès déjà en place
✅ Frontend : Appelle déjà les bonnes routes avec `/progress`
✅ Compatibilité : Les deux formats sont acceptés (avec et sans `/progress`)

## Notes

- Les routes seller n'ont **pas besoin d'alias** car elles utilisent toujours `/progress`
- Le frontend appelle déjà les bonnes routes, mais l'alias garantit la compatibilité si un appel direct est fait
- Les contrôles d'accès seller sont complets et fonctionnels

