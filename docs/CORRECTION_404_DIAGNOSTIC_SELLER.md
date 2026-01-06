# Correction : 404 sur /api/seller/diagnostic/me et /api/seller/diagnostic/me/live-scores

## Problème identifié

**Erreurs en production** :
- `GET https://api.retailperformerai.com/api/seller/diagnostic/me` → 404
- `GET https://api.retailperformerai.com/api/seller/diagnostic/me/live-scores` → 404

**Constats** :
- Le serveur répond bien (DNS/SSL OK) mais renvoie 404 → la route n'est pas enregistrée côté backend
- Les appels viennent du frontend (Seller flow) : `App.js` et `SellerDashboard.js`

## Analyse

### Routes existantes

1. **Route `/api/seller/diagnostic/me`** :
   - ✅ Existe dans `backend/api/routes/sellers.py` ligne 1140
   - ✅ Router principal : `router = APIRouter(prefix="/seller")`
   - ✅ Monté dans `main.py` avec prefix `/api` → chemin final : `/api/seller/diagnostic/me`
   - ⚠️ **Problème** : Retournait `HTTPException(404)` si diagnostic non trouvé au lieu d'un payload JSON

2. **Route `/api/seller/diagnostic/me/live-scores`** :
   - ❌ **N'existe PAS** dans le router principal `/seller`
   - ✅ Existe dans `diagnostic_router` (prefix `/diagnostic`) → chemin final : `/api/diagnostic/me/live-scores`
   - ⚠️ Le frontend appelle `/api/seller/diagnostic/me/live-scores` (avec `/seller`)

### Diagnostic

**Cause racine** : 
- La route `/api/seller/diagnostic/me/live-scores` n'existe pas dans le router principal `/seller`
- Le frontend appelle `/api/seller/diagnostic/me/live-scores` mais cette route n'est pas définie
- Il existe un `diagnostic_router` avec prefix `/diagnostic` qui a cette route, mais il est monté à `/api/diagnostic/me/live-scores` (sans `/seller`)

## Corrections apportées

### 1. Ajout de la route `/diagnostic/me/live-scores` dans le router principal

**Fichier** : `backend/api/routes/sellers.py`

**Ajout** : Route `/diagnostic/me/live-scores` dans le router principal (après `/diagnostic/me`)

```python
@router.get("/diagnostic/me/live-scores")
async def get_my_diagnostic_live_scores(
    current_user: Dict = Depends(get_current_seller),
    db = Depends(get_db)
):
    """Get seller's live competence scores (updated after debriefs)."""
    # ... implémentation identique à diagnostic_router ...
```

### 2. Harmonisation de la réponse `/diagnostic/me`

**Fichier** : `backend/api/routes/sellers.py`

**Modification** : La route `/diagnostic/me` retourne maintenant un payload JSON au lieu de `HTTPException(404)` si le diagnostic n'existe pas, pour être cohérente avec `diagnostic_router` :

```python
if not diagnostic:
    # Return empty response instead of 404 to avoid console errors
    return {
        "status": "not_started",
        "has_diagnostic": False,
        "message": "Diagnostic DISC non encore complété"
    }

# Return with status 'completed' for frontend compatibility
return {
    "status": "completed",
    "has_diagnostic": True,
    "diagnostic": diagnostic
}
```

## Routes finales disponibles

Après correction, les routes suivantes sont disponibles :

1. **`GET /api/seller/diagnostic/me`** ✅
   - Router : `/seller` (router principal)
   - Auth : `get_current_seller`
   - Retour : `{ status, has_diagnostic, diagnostic?, message? }`

2. **`GET /api/seller/diagnostic/me/live-scores`** ✅ (NOUVELLE)
   - Router : `/seller` (router principal)
   - Auth : `get_current_seller`
   - Retour : `{ has_diagnostic, seller_id, scores, updated_at?, message? }`

3. **`GET /api/diagnostic/me`** ✅ (alias legacy)
   - Router : `/diagnostic` (diagnostic_router)
   - Auth : `get_current_seller`
   - Retour : Identique à `/api/seller/diagnostic/me`

4. **`GET /api/diagnostic/me/live-scores`** ✅ (alias legacy)
   - Router : `/diagnostic` (diagnostic_router)
   - Auth : `get_current_seller`
   - Retour : Identique à `/api/seller/diagnostic/me/live-scores`

## Validation

### Test manuel recommandé

1. **Test `/api/seller/diagnostic/me`** :
   ```bash
   curl -H "Authorization: Bearer <seller_token>" \
        https://api.retailperformerai.com/api/seller/diagnostic/me
   ```
   - **Attendu** : `200 OK` avec payload `{ status, has_diagnostic, ... }`
   - **Si diagnostic existe** : `status: "completed"`, `has_diagnostic: true`, `diagnostic: {...}`
   - **Si diagnostic n'existe pas** : `status: "not_started"`, `has_diagnostic: false`, `message: "..."`

2. **Test `/api/seller/diagnostic/me/live-scores`** :
   ```bash
   curl -H "Authorization: Bearer <seller_token>" \
        https://api.retailperformerai.com/api/seller/diagnostic/me/live-scores
   ```
   - **Attendu** : `200 OK` avec payload `{ has_diagnostic, seller_id, scores, ... }`
   - **Si diagnostic existe** : `has_diagnostic: true`, `scores: { accueil, decouverte, ... }`
   - **Si diagnostic n'existe pas** : `has_diagnostic: false`, `scores: { accueil: 3.0, ... }` (valeurs par défaut)

3. **Vérification OpenAPI** :
   ```bash
   curl -s https://api.retailperformerai.com/openapi.json | jq '.paths | keys | .[] | select(contains("diagnostic"))'
   ```
   - **Attendu** : Les chemins suivants doivent apparaître :
     - `/api/seller/diagnostic/me`
     - `/api/seller/diagnostic/me/live-scores`
     - `/api/diagnostic/me`
     - `/api/diagnostic/me/live-scores`

### Test frontend

1. **Se connecter en tant que vendeur**
2. **Vérifier la console** :
   - Plus d'erreur 404 sur `/api/seller/diagnostic/me`
   - Plus d'erreur 404 sur `/api/seller/diagnostic/me/live-scores`
3. **Vérifier le comportement** :
   - Si diagnostic non complété : affichage correct (pas d'erreur console)
   - Si diagnostic complété : données affichées correctement

## Fichiers modifiés

- `backend/api/routes/sellers.py` :
  - Modification de `/diagnostic/me` pour retourner un payload JSON au lieu de 404
  - Ajout de `/diagnostic/me/live-scores` dans le router principal

## Notes techniques

- Les deux routes (`/api/seller/diagnostic/me` et `/api/diagnostic/me`) sont maintenant disponibles pour compatibilité rétroactive
- Les réponses sont harmonisées entre les deux routers pour éviter les incohérences
- Les routes retournent toujours `200 OK` avec un payload JSON, même si le diagnostic n'existe pas (évite les erreurs console frontend)

