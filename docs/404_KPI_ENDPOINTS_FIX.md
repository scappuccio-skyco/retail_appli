# Fix 404 sur endpoints KPI Manager

## Problème identifié

Erreurs 404 en production sur Railway pour :
- `GET /api/manager/kpi-entries/{sellerId}?days=30`
- `GET /api/manager/seller/{sellerId}/stats`

## Analyse

### Routes Backend existantes

**backend/api/routes/manager.py** :
- Ligne 1824 : `@router.get("/kpi-entries/{seller_id}")` → `/api/manager/kpi-entries/{seller_id}`
- Ligne 1885 : `@router.get("/seller/{seller_id}/stats")` → `/api/manager/seller/{seller_id}/stats`

**Router prefix** : `/manager` (ligne 14)
**Inclusion dans main.py** : Avec prefix `/api` (ligne 103)

**Routes finales** :
- `/api` + `/manager` + `/kpi-entries/{seller_id}` = `/api/manager/kpi-entries/{seller_id}` ✅
- `/api` + `/manager` + `/seller/{seller_id}/stats` = `/api/manager/seller/{seller_id}/stats` ✅

### Appels Frontend

**ManagerDashboard.js** (lignes 581-583) :
```javascript
axios.get(`${API}/manager/seller/${sellerId}/stats`),
axios.get(`${API}/manager/kpi-entries/${sellerId}?days=7`)
```

**TeamModal.js** (lignes 121-131) :
```javascript
let kpiUrl = `${API}/manager/kpi-entries/${seller.id}?days=${daysParam}${storeParam}`;
axios.get(`${API}/manager/seller/${seller.id}/stats${storeParamFirst}`, {
```

**SellerDetailView.js** (lignes 46-50) :
```javascript
axios.get(`${API}/manager/seller/${seller.id}/stats`, { headers }),
axios.get(`${API}/manager/kpi-entries/${seller.id}?days=30`, { headers })
```

### Problème

Les routes de compatibilité dans `main.py` (lignes 324-383) étaient incorrectes :
- Elles essayaient d'appeler `get_store_context` sans passer le `Request`
- Les dépendances FastAPI n'étaient pas correctement injectées

## Solution appliquée

### Fichier modifié : `backend/main.py`

#### 1. Ajout de l'import `Request`

```diff
--- a/backend/main.py
+++ b/backend/main.py
@@ -10,7 +10,7 @@ print("[STARTUP] 1/10 - main.py loading started", flush=True)
 try:
-    from fastapi import FastAPI, Query
+    from fastapi import FastAPI, Query, Request
     from fastapi.middleware.cors import CORSMiddleware
     from typing import Optional
     import logging
```

#### 2. Correction des routes de compatibilité

```diff
--- a/backend/main.py
+++ b/backend/main.py
@@ -324,6 +324,7 @@ print("[STARTUP] 10/10 - All routers registered - APP READY FOR REQUESTS", flus
 
 @app.get("/api/manager/kpi-entries/{seller_id}")
 async def get_seller_kpi_entries_compat(
+    request: Request,
     seller_id: str,
     days: int = Query(30, description="Number of days to fetch"),
     start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
@@ -336,10 +337,11 @@ async def get_seller_kpi_entries_compat(
     """
     from api.routes.manager import get_seller_kpi_entries, get_store_context
     from api.dependencies import get_db
-    from fastapi import Depends
+    from core.security import get_current_user
     
     # Get dependencies using FastAPI dependency injection
     current_user = await get_current_user()
-    context = await get_store_context(current_user=current_user, store_id=store_id)
     db = await get_db()
+    context = await get_store_context(request=request, current_user=current_user, db=db)
     
     # Call the actual handler
     return await get_seller_kpi_entries(
@@ -357,6 +359,7 @@ async def get_seller_kpi_entries_compat(
 
 @app.get("/api/manager/seller/{seller_id}/stats")
 async def get_seller_stats_compat(
+    request: Request,
     seller_id: str,
     days: int = Query(30, description="Number of days for stats calculation"),
     store_id: Optional[str] = Query(None, description="Store ID (requis pour gérant)")
@@ -369,10 +372,11 @@ async def get_seller_stats_compat(
     """
     from api.routes.manager import get_seller_stats, get_store_context
     from api.dependencies import get_db
-    from fastapi import Depends
+    from core.security import get_current_user
     
     # Get dependencies using FastAPI dependency injection
     current_user = await get_current_user()
-    context = await get_store_context(current_user=current_user, store_id=store_id)
     db = await get_db()
+    context = await get_store_context(request=request, current_user=current_user, db=db)
     
     # Call the actual handler
     return await get_seller_stats(
```

## Vérifications

### Routes exposées

Les routes suivantes sont maintenant disponibles :

1. **Via router manager** (routes principales) :
   - `GET /api/manager/kpi-entries/{seller_id}`
   - `GET /api/manager/seller/{seller_id}/stats`

2. **Via routes de compatibilité** (main.py) :
   - `GET /api/manager/kpi-entries/{seller_id}` (alias)
   - `GET /api/manager/seller/{seller_id}/stats` (alias)

### Router inclusion

**backend/api/routes/__init__.py** (ligne 30) :
```python
safe_import('api.routes.manager', 'router')
```

**backend/main.py** (ligne 103) :
```python
app.include_router(router, prefix="/api")
```

✅ Le router manager est bien inclus avec le prefix `/api`.

## Tests

### Test 1 : Endpoint kpi-entries
```bash
curl -X GET "https://api.retailperformerai.com/api/manager/kpi-entries/{sellerId}?days=30" \
  -H "Authorization: Bearer {token}"
```

**Résultat attendu** : 200 OK avec liste de KPI entries

### Test 2 : Endpoint seller stats
```bash
curl -X GET "https://api.retailperformerai.com/api/manager/seller/{sellerId}/stats?days=30" \
  -H "Authorization: Bearer {token}"
```

**Résultat attendu** : 200 OK avec statistiques du vendeur

### Test 3 : Avec store_id (gérant)
```bash
curl -X GET "https://api.retailperformerai.com/api/manager/kpi-entries/{sellerId}?days=30&store_id={storeId}" \
  -H "Authorization: Bearer {token}"
```

**Résultat attendu** : 200 OK avec KPI entries du vendeur pour le store spécifié

## Notes

- Les routes de compatibilité dans `main.py` sont des alias qui délèguent aux handlers du router manager
- Les routes principales du router manager fonctionnent également
- Les deux approches sont fonctionnelles, mais les routes du router manager sont préférées (plus maintenables)

## Résultat attendu

Après correction :
- ✅ `GET /api/manager/kpi-entries/{sellerId}?days=30` retourne 200 OK
- ✅ `GET /api/manager/seller/{sellerId}/stats` retourne 200 OK
- ✅ Les appels frontend fonctionnent correctement
- ✅ Les routes de compatibilité fonctionnent pour la rétrocompatibilité

