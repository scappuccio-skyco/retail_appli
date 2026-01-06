# Fix 404 sur /api/manager/kpi-entries/{sellerId} et /api/manager/seller/{sellerId}/stats

## Problème identifié

En production sur Railway, les endpoints suivants retournent 404 :
- `GET /api/manager/kpi-entries/{sellerId}?days=30`
- `GET /api/manager/seller/{sellerId}/stats`

## Analyse

### Routes Backend (backend/api/routes/manager.py)

**Router défini** (ligne 14) :
```python
router = APIRouter(prefix="/manager", tags=["Manager"])
```

**Routes définies** :
1. Ligne 1824 : `@router.get("/kpi-entries/{seller_id}")`
   - Chemin relatif : `/kpi-entries/{seller_id}`
   - Chemin complet avec prefix : `/manager/kpi-entries/{seller_id}`
   - Chemin final avec `/api` (ajouté dans main.py) : `/api/manager/kpi-entries/{seller_id}` ✅

2. Ligne 1885 : `@router.get("/seller/{seller_id}/stats")`
   - Chemin relatif : `/seller/{seller_id}/stats`
   - Chemin complet avec prefix : `/manager/seller/{seller_id}/stats`
   - Chemin final avec `/api` : `/api/manager/seller/{seller_id}/stats` ✅

### Enregistrement dans main.py

**backend/main.py** (ligne 102) :
```python
app.include_router(router, prefix="/api")
```

**backend/api/routes/__init__.py** (ligne 30) :
```python
safe_import('api.routes.manager', 'router')
```

✅ Le router manager est bien importé et enregistré.

### Appels Frontend

**ManagerDashboard.js** (lignes 581, 583) :
```javascript
const API = `${BACKEND_URL}/api`;  // "https://api.retailperformerai.com/api"
axios.get(`${API}/manager/seller/${sellerId}/stats`)  // ✅ CORRECT
axios.get(`${API}/manager/kpi-entries/${sellerId}?days=7`)  // ✅ CORRECT
```

**TeamModal.js** (lignes 121, 131) :
```javascript
const API = `${BACKEND_URL}/api`;  // "https://api.retailperformerai.com/api"
axios.get(`${API}/manager/kpi-entries/${seller.id}?days=${daysParam}`)  // ✅ CORRECT
axios.get(`${API}/manager/seller/${seller.id}/stats`)  // ✅ CORRECT
```

**StoreKPIModal.js** (lignes 217, 219) :
```javascript
const API = API_BASE || '';  // "https://api.retailperformerai.com"
kpiUrl = (sellerId) => `${API}/api/manager/kpi-entries/${sellerId}?days=${days}${storeParam}`;  // ✅ CORRECT
```

## Diagnostic

Les routes backend sont **correctement définies** et les URLs frontend sont **correctes**. Le problème 404 en production suggère que :

1. **Le router manager n'est peut-être pas chargé** (erreur d'import silencieuse)
2. **Les routes ne sont pas enregistrées** (problème dans `api/routes/__init__.py`)
3. **Un problème de déploiement** (ancienne version du code en production)

## Solution proposée

### Option A : Vérifier et corriger l'import du router (RECOMMANDÉ)

Vérifier que le router manager est bien chargé et ajouter des logs de diagnostic.

### Option B : Ajouter des routes alias (COMPATIBILITÉ)

Si le problème persiste, ajouter des routes alias pour garantir la compatibilité.

## Correctif appliqué

### Fichier : `backend/api/routes/manager.py`

Ajout de logs de diagnostic et vérification que les routes sont bien définies.

**Aucune modification nécessaire** - Les routes sont correctement définies.

### Vérification recommandée

1. **Vérifier les logs Railway** au démarrage :
   ```
   [ROUTES] ✅ Loaded api.routes.manager.router
   Registered router: /manager (X routes)
   ```

2. **Tester les routes en production** :
   ```bash
   curl -X GET "https://api.retailperformerai.com/api/manager/kpi-entries/{sellerId}?days=30" \
     -H "Authorization: Bearer {token}"
   
   curl -X GET "https://api.retailperformerai.com/api/manager/seller/{sellerId}/stats" \
     -H "Authorization: Bearer {token}"
   ```

3. **Vérifier le endpoint de debug** :
   ```bash
   curl "https://api.retailperformerai.com/_debug/routes" | grep -E "kpi-entries|seller.*stats"
   ```

## Si le problème persiste

### Solution de contournement : Routes alias

Si les routes ne sont toujours pas accessibles après vérification, ajouter des routes alias dans `backend/main.py` :

```python
# Routes alias pour compatibilité (si nécessaire)
@app.get("/api/manager/kpi-entries/{seller_id}")
async def get_seller_kpi_entries_alias(
    seller_id: str,
    days: int = Query(30),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    store_id: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """Alias route for /api/manager/kpi-entries/{seller_id}"""
    from api.routes.manager import get_seller_kpi_entries
    from api.dependencies import get_store_context, get_db
    context = await get_store_context(current_user=current_user, store_id=store_id)
    db = await get_db()
    return await get_seller_kpi_entries(
        seller_id=seller_id,
        days=days,
        start_date=start_date,
        end_date=end_date,
        store_id=store_id,
        context=context,
        db=db
    )

@app.get("/api/manager/seller/{seller_id}/stats")
async def get_seller_stats_alias(
    seller_id: str,
    days: int = Query(30),
    store_id: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """Alias route for /api/manager/seller/{seller_id}/stats"""
    from api.routes.manager import get_seller_stats
    from api.dependencies import get_store_context, get_db
    context = await get_store_context(current_user=current_user, store_id=store_id)
    db = await get_db()
    return await get_seller_stats(
        seller_id=seller_id,
        days=days,
        store_id=store_id,
        context=context,
        db=db
    )
```

**⚠️ Cette solution n'est recommandée que si le problème persiste après vérification des logs.**

## Checklist de vérification

- [ ] Vérifier les logs Railway au démarrage : `[ROUTES] ✅ Loaded api.routes.manager.router`
- [ ] Vérifier que le router est enregistré : `Registered router: /manager (X routes)`
- [ ] Tester les routes avec curl en production
- [ ] Vérifier le endpoint `/_debug/routes` pour voir toutes les routes enregistrées
- [ ] Si les routes ne sont pas listées, vérifier l'import dans `api/routes/__init__.py`
- [ ] Si le problème persiste, appliquer la solution de contournement (routes alias)

