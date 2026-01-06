# Correction : Configuration KPI liée au magasin (store_id)

## Problème identifié

Le manager a configuré que les vendeurs doivent entrer seulement 2 données (Nombre de Ventes + Nombre d'Articles), mais les vendeurs pouvaient toujours en entrer 4 (CA + Nombre de Ventes + Nombre d'Articles + Prospects).

**Cause racine** : L'endpoint `/seller/kpi-config` cherchait la configuration KPI par `manager_id` au lieu de `store_id`. Comme les managers et vendeurs peuvent changer de magasin en magasin dans l'application, la configuration doit être liée au `store_id` et non au `manager_id`.

## Corrections apportées

### 1. Backend : Endpoint `/seller/kpi-config` (backend/api/routes/sellers.py)

**Avant** :
- Cherchait d'abord le manager du store
- Puis cherchait la config par `manager_id`
- Ne fonctionnait pas correctement si le manager changeait de magasin

**Après** :
- Cherche directement la config par `store_id`
- Accepte un paramètre optionnel `store_id` dans la query string
- Utilise le `store_id` du vendeur si non fourni
- Garantit que la config est toujours liée au magasin actuel

```python
@router.get("/kpi-config")
async def get_seller_kpi_config(
    store_id: Optional[str] = Query(None, description="Store ID (optionnel, utilise celui du vendeur si non fourni)"),
    current_user: Dict = Depends(get_current_seller),
    db = Depends(get_db)
):
    # ...
    effective_store_id = store_id or (user.get('store_id') if user else None)
    
    # Get KPI config for this store (CRITICAL: search by store_id, not manager_id)
    config = await db.kpi_configs.find_one({"store_id": effective_store_id}, {"_id": 0})
```

### 2. Frontend : Passage explicite du `store_id` (frontend/src/pages/SellerDashboard.js)

**Avant** :
```javascript
const res = await api.get('/seller/kpi-config');
```

**Après** :
```javascript
// Passer explicitement le store_id pour s'assurer que la config est liée au magasin
const storeParam = user?.store_id ? `?store_id=${user.store_id}` : '';
const res = await api.get(`/seller/kpi-config${storeParam}`);
```

## Vérifications effectuées

✅ L'endpoint `/manager/kpi-config` (PUT) sauvegarde déjà la config avec `store_id` en priorité  
✅ Le frontend passe déjà le `store_id` lors de la mise à jour de la config par le manager  
✅ La config KPI est maintenant toujours liée au `store_id` et non au `manager_id`

## Résultat attendu

Maintenant, quand un manager configure les KPIs pour un magasin :
1. La configuration est sauvegardée avec le `store_id` du magasin
2. Quand un vendeur de ce magasin ouvre le formulaire de saisie, il voit uniquement les champs configurés pour ce magasin
3. Si le vendeur change de magasin, il verra la configuration du nouveau magasin
4. Si le manager change de magasin, il pourra configurer les KPIs pour chaque magasin indépendamment

## Test manuel recommandé

1. **Configurer les KPIs pour un magasin** :
   - Se connecter en tant que manager
   - Aller dans les paramètres du magasin
   - Configurer : Vendeur saisit "Nombre de Ventes" + "Nombre d'Articles" uniquement

2. **Vérifier côté vendeur** :
   - Se connecter en tant que vendeur du même magasin
   - Aller dans "Mes Performances > Saisir mes chiffres"
   - **Vérifier** : Seuls les champs "Nombre de Ventes" et "Nombre d'Articles" sont affichés
   - **Vérifier** : Les champs "CA" et "Prospects" ne sont PAS affichés

3. **Tester le changement de magasin** :
   - Si le vendeur a accès à plusieurs magasins, changer de magasin
   - Vérifier que la configuration affichée correspond au magasin actuel

## Fichiers modifiés

- `backend/api/routes/sellers.py` : Endpoint `/seller/kpi-config` modifié pour utiliser `store_id`
- `frontend/src/pages/SellerDashboard.js` : Passage explicite du `store_id` lors de l'appel

## Notes techniques

- La configuration KPI est stockée dans la collection `kpi_configs` avec les champs :
  - `store_id` : ID du magasin (prioritaire)
  - `manager_id` : ID du manager (pour compatibilité)
  - `seller_track_*` : Indique si le vendeur doit saisir ce KPI
  - `manager_track_*` : Indique si le manager doit saisir ce KPI

- L'exclusivité mutuelle entre `seller_track_*` et `manager_track_*` est gérée côté frontend lors de la configuration.

