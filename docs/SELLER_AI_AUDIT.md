# AUDIT IA — ESPACE VENDEUR

## Date : 2025-01-XX
## Objectif : Vérifier si les mêmes bugs IA côté manager existent côté seller

---

## 1️⃣ INVENTAIRE FRONTEND SELLER

### Recherche des appels IA côté seller

**Résultat : AUCUN appel IA spécifique seller trouvé**

Les composants suivants utilisent des routes `/api/manager/...` :

#### A. ConflictResolutionForm.js
- **Composant** : `ConflictResolutionForm`
- **Fonction** : `fetchConflictHistory`, `handleSubmit`
- **URLs appelées** :
  - `GET /api/manager/conflict-history/${sellerId}` (ligne 38)
  - `POST /api/manager/conflict-resolution` (ligne 76)
- **Méthode HTTP** : GET, POST
- **Params** : `sellerId` (dans URL pour GET)
- **Headers** : `Authorization: Bearer ${token}`
- **Body** :
  ```json
  {
    "seller_id": "...",
    "contexte": "...",
    "comportement_observe": "...",
    "impact": "...",
    "tentatives_precedentes": "...",
    "description_libre": "..."
  }
  ```
- **⚠️ PROBLÈME** : Utilise `/api/manager/...` mais peut être appelé depuis SellerDashboard

#### B. RelationshipManagementModal.js
- **Composant** : `RelationshipManagementModal`
- **Fonction** : `loadHistory`, `handleGenerateAdvice` (via `onSuccess` callback)
- **URLs appelées** :
  - `GET /api/manager/relationship-advice/history?store_id=...` (ligne 68)
  - `DELETE /api/manager/relationship-consultation/${consultationId}?store_id=...` (ligne 100)
- **Méthode HTTP** : GET, DELETE
- **Params** : `store_id` (query param), `seller_id` (query param optionnel)
- **Headers** : `Authorization: Bearer ${token}`
- **⚠️ PROBLÈME** : Utilise `/api/manager/...` - pas de route seller

#### C. MorningBriefModal.js
- **Composant** : `MorningBriefModal`
- **URLs appelées** :
  - `POST /api/briefs/morning?store_id=...` (ligne ~XX)
  - `GET /api/briefs/morning/history?store_id=...` (ligne ~XX)
- **⚠️ PROBLÈME** : Route `/api/briefs/...` mais vérifie `role in ["manager", "gerant"]` côté backend

### SellerDashboard.js
- **Aucun appel IA direct trouvé**
- Utilise des composants qui appellent `/api/manager/...` ou `/api/briefs/...`

---

## 2️⃣ INVENTAIRE BACKEND ROUTES SELLER

### Routes IA disponibles pour seller

#### A. Briefs (Morning Brief)
- **Route** : `/api/briefs/morning`
- **Méthode** : POST
- **Fichier** : `backend/api/routes/briefs.py`
- **Permissions** : `role in ["manager", "gerant", "super_admin"]` (ligne 113)
- **Query params** : `store_id` (optionnel)
- **Request** : `MorningBriefRequest` (comments, stats optionnels)
- **Response** : `MorningBriefResponse`
- **⚠️ PROBLÈME** : **Seller n'a PAS accès** (403 si seller tente d'accéder)

- **Route** : `/api/briefs/morning/history`
- **Méthode** : GET
- **Permissions** : `role in ["manager", "gerant", "super_admin"]` (ligne 441)
- **Query params** : `store_id` (optionnel)
- **Response** : `{"briefs": [...], "total": N}`
- **⚠️ PROBLÈME** : **Seller n'a PAS accès**

#### B. Relationship Advice
- **Route** : `/api/manager/relationship-advice`
- **Méthode** : POST
- **Fichier** : `backend/api/routes/manager.py` (ligne 2344)
- **Permissions** : `get_store_context` (manager/gerant uniquement)
- **Query params** : `store_id` (optionnel)
- **Request** : `RelationshipAdviceRequest` (seller_id, advice_type, situation_type, description)
- **Response** : `{"recommendation": "...", "advice_type": "...", ...}`
- **⚠️ PROBLÈME** : **Route `/api/manager/...` - seller n'a PAS accès direct**

- **Route** : `/api/manager/relationship-advice/history`
- **Méthode** : GET
- **Fichier** : `backend/api/routes/manager.py` (ligne 2548)
- **Permissions** : `get_store_context` (manager/gerant uniquement)
- **Query params** : `store_id`, `seller_id` (optionnel)
- **Response** : `{"consultations": [...]}`
- **⚠️ PROBLÈME** : **Route `/api/manager/...` - seller n'a PAS accès direct**

#### C. Conflict Resolution
- **Route** : `/api/manager/conflict-resolution`
- **Méthode** : POST
- **Fichier** : **❌ N'EXISTE PAS dans backend**
- **⚠️ PROBLÈME CRITIQUE** : Frontend appelle une route qui n'existe pas !

- **Route** : `/api/manager/conflict-history/{seller_id}`
- **Méthode** : GET
- **Fichier** : **❌ N'EXISTE PAS dans backend**
- **⚠️ PROBLÈME CRITIQUE** : Frontend appelle une route qui n'existe pas !

### Routes seller existantes (non-IA)
- `/api/seller/objectives/...` ✅
- `/api/seller/challenges/...` ✅
- `/api/seller/kpi-entry` ✅
- `/api/ai/diagnostic` ✅ (pour diagnostic DISC)
- `/api/ai/daily-challenge` ✅ (pour défis quotidiens)

---

## 3️⃣ MATRICE "MANAGER vs SELLER" (cohérence)

| Feature | Manager | Seller | Incohérence |
|---------|---------|--------|-------------|
| **Morning Brief** | ✅ `/api/briefs/morning` | ❌ Pas d'accès (403) | Seller n'a pas besoin de brief matinal (normal) |
| **Relationship Advice** | ✅ `/api/manager/relationship-advice` | ❌ Pas de route seller | **BUG** : ConflictResolutionForm utilise `/api/manager/...` |
| **Conflict Resolution** | ❌ Route n'existe pas | ❌ Route n'existe pas | **BUG CRITIQUE** : Frontend appelle route inexistante |
| **History Relationship** | ✅ `/api/manager/relationship-advice/history` | ❌ Pas de route seller | **BUG** : Pas d'accès seller |
| **History Conflict** | ❌ Route n'existe pas | ❌ Route n'existe pas | **BUG CRITIQUE** : Frontend appelle route inexistante |

### Décision architecture

**OPTION A (recommandée)** : Routes séparées
- Manager : `/api/manager/relationship-advice`, `/api/manager/conflict-resolution`
- Seller : `/api/seller/relationship-advice`, `/api/seller/conflict-resolution`
- Avantages : Séparation claire, permissions distinctes, évite confusion

**OPTION B** : Route commune avec RBAC
- `/api/relationship-advice` (vérifie role dans handler)
- Avantages : Code partagé
- Inconvénients : Plus complexe, risque d'erreurs

**👉 On choisit OPTION A** (routes séparées)

---

## 4️⃣ AUDIT DES HISTORIQUES (BUG probable)

### Relationship Advice History

**Backend** (`/api/manager/relationship-advice/history`) :
- Collection : `relationship_consultations`
- Clés utilisées : `manager_id`, `store_id`, `seller_id` (optionnel)
- Réponse : `{"consultations": [...]}`

**Frontend** (`RelationshipManagementModal.js`) :
- Mapping : `response.data?.consultations ?? []` ✅ (CORRECT)
- Filtre : `store_id` dans query param ✅

**✅ PAS DE BUG** : Le mapping est correct

### Conflict History

**Backend** :
- ❌ Route n'existe pas

**Frontend** (`ConflictResolutionForm.js`) :
- Mapping : `response.data` (ligne 41)
- Attendu : Array `[...]` ou `{conflicts: [...]}` ?

**⚠️ BUG PROBABLE** : Si backend renvoie `{conflicts: [...]}`, frontend attend un array

### Morning Brief History

**Backend** (`/api/briefs/morning/history`) :
- Collection : `morning_briefs`
- Clés utilisées : `store_id`, `manager_id`
- Réponse : `{"briefs": [...], "total": N}`

**Frontend** (`MorningBriefModal.js`) :
- Mapping : À vérifier (fichier non lu complètement)

---

## 5️⃣ ROBUSTESSE — ERREURS SILENCIEUSES

### Backend - Relationship Advice

**Fichier** : `backend/api/routes/manager.py` (ligne 2344)

**État actuel** :
```python
@router.post("/relationship-advice")
async def get_relationship_advice(...):
    try:
        # ... code ...
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(...)
        raise HTTPException(status_code=500, detail=...)
```

**✅ DÉJÀ ROBUSTE** : try/except avec logger.exception

### Backend - Conflict Resolution

**Fichier** : **❌ N'EXISTE PAS**

**⚠️ À CRÉER** avec try/except + logger.exception

### Frontend - Gestion d'erreurs

**ConflictResolutionForm.js** :
```javascript
catch (err) {
  console.error('Error creating conflict resolution:', err);
  toast.error('Erreur lors de la génération des recommandations');
}
```

**⚠️ AMÉLIORATION** : Afficher `err.response?.data?.detail` si présent

---

## 6️⃣ TESTS RAPIDES (commandes curl)

### SELLER (actuellement ne fonctionne pas)

```bash
# ❌ POST génération relationnel (route n'existe pas pour seller)
curl -X POST "http://localhost:8001/api/seller/relationship-advice" \
  -H "Authorization: Bearer <seller_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "seller_id": "seller123",
    "advice_type": "relationnel",
    "situation_type": "motivation",
    "description": "Test"
  }'
# Attendu : 404 Not Found (route n'existe pas)

# ❌ GET historique relationnel (route n'existe pas pour seller)
curl -X GET "http://localhost:8001/api/seller/relationship-advice/history?seller_id=seller123" \
  -H "Authorization: Bearer <seller_token>"
# Attendu : 404 Not Found

# ❌ POST génération conflit (route n'existe pas)
curl -X POST "http://localhost:8001/api/seller/conflict-resolution" \
  -H "Authorization: Bearer <seller_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "seller_id": "seller123",
    "contexte": "Test",
    "comportement_observe": "Test",
    "impact": "Test"
  }'
# Attendu : 404 Not Found

# ❌ GET historique conflit (route n'existe pas)
curl -X GET "http://localhost:8001/api/seller/conflict-history/seller123" \
  -H "Authorization: Bearer <seller_token>"
# Attendu : 404 Not Found
```

### MANAGER (pour comparaison)

```bash
# ✅ POST génération relationnel
curl -X POST "http://localhost:8001/api/manager/relationship-advice?store_id=store123" \
  -H "Authorization: Bearer <manager_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "seller_id": "seller123",
    "advice_type": "relationnel",
    "situation_type": "motivation",
    "description": "Test"
  }'
# Attendu : 200 OK avec {"recommendation": "...", ...}

# ✅ GET historique relationnel
curl -X GET "http://localhost:8001/api/manager/relationship-advice/history?store_id=store123" \
  -H "Authorization: Bearer <manager_token>"
# Attendu : 200 OK avec {"consultations": [...]}
```

---

## 7️⃣ PROBLÈMES IDENTIFIÉS

### 🔴 CRITIQUE

1. **Conflict Resolution routes n'existent pas**
   - Frontend appelle `POST /api/manager/conflict-resolution` → 404
   - Frontend appelle `GET /api/manager/conflict-history/{seller_id}` → 404
   - **Impact** : Feature complètement cassée

### 🟡 IMPORTANT

2. **Seller utilise routes manager pour relationship advice**
   - `ConflictResolutionForm` utilise `/api/manager/...` mais peut être appelé depuis SellerDashboard
   - **Impact** : 403 Forbidden si seller tente d'accéder

3. **Pas de routes seller pour relationship/conflict**
   - Seller n'a pas de moyen d'accéder à ces features
   - **Impact** : Feature inaccessible pour seller

### 🟢 MINEUR

4. **Morning Brief** : Seller n'a pas accès (normal, c'est pour manager)

---

## 8️⃣ CORRECTIONS PROPOSÉES

### A. Créer routes Conflict Resolution (manager)

**Fichier** : `backend/api/routes/manager.py`

```python
@router.post("/conflict-resolution")
async def create_conflict_resolution(
    conflict_data: dict,
    store_id: Optional[str] = Query(None),
    context: dict = Depends(get_store_context),
    db = Depends(get_db)
):
    """Create conflict resolution advice"""
    # ... implémentation similaire à relationship-advice ...
    
@router.get("/conflict-history/{seller_id}")
async def get_conflict_history(
    seller_id: str,
    store_id: Optional[str] = Query(None),
    context: dict = Depends(get_store_context),
    db = Depends(get_db)
):
    """Get conflict resolution history for a seller"""
    # ... implémentation ...
```

### B. Créer routes Seller (relationship + conflict)

**Fichier** : `backend/api/routes/sellers.py`

```python
@router.post("/relationship-advice")
async def create_seller_relationship_advice(
    advice_data: dict,
    current_user: Dict = Depends(get_current_seller),
    db = Depends(get_db)
):
    """Seller requests relationship advice (self or team)"""
    # Vérifier permissions (seller peut demander conseil sur lui-même ou collègues visibles)
    
@router.get("/relationship-advice/history")
async def get_seller_relationship_history(
    current_user: Dict = Depends(get_current_seller),
    db = Depends(get_db)
):
    """Get seller's relationship advice history"""
    
@router.post("/conflict-resolution")
async def create_seller_conflict_resolution(
    conflict_data: dict,
    current_user: Dict = Depends(get_current_seller),
    db = Depends(get_db)
):
    """Seller reports a conflict and gets AI advice"""
    
@router.get("/conflict-history")
async def get_seller_conflict_history(
    current_user: Dict = Depends(get_current_seller),
    db = Depends(get_db)
):
    """Get seller's conflict resolution history"""
```

### C. Corriger frontend

**ConflictResolutionForm.js** :
- Changer URL selon role (seller → `/api/seller/...`, manager → `/api/manager/...`)
- Ou créer composant séparé `SellerConflictResolutionForm.js`

**RelationshipManagementModal.js** :
- Même logique : adapter URL selon role

---

## 9️⃣ LIVRABLES

### Tableaux récapitulatifs

Voir sections 1, 2, 3 ci-dessus.

### Diff précis

À générer après implémentation des corrections.

### Commandes curl

Voir section 6 ci-dessus.

---

## 🔟 CONCLUSION

**Seller n'a actuellement AUCUN accès aux features IA relationship/conflict.**

Les routes n'existent pas ou sont réservées aux managers.

**Actions immédiates** :
1. Créer routes conflict-resolution pour manager
2. Créer routes seller pour relationship-advice et conflict-resolution
3. Adapter frontend pour utiliser les bonnes routes selon le role

