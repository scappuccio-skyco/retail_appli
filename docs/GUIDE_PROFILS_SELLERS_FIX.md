# Fix "0 vendeur" dans Guide des Profils > Compatibilité

## Problème identifié

Le Guide des Profils affiche "0 vendeur" dans l'onglet Compatibilité alors que les vendeurs sont visibles dans "Mon Équipe".

## Analyse

### 1. Appels Frontend

**GuideProfilsModal.js** (ligne 62, AVANT correction) :
```javascript
const sellersRes = await axios.get(`${API}/api/manager/sellers`, {
  headers: { Authorization: `Bearer ${token}` }
});
setTeamSellers(sellersRes.data);
```

**Problèmes identifiés** :
1. ❌ Double `/api` : `${API}/api/manager/sellers` où `API = API_BASE` contient déjà `/api`
2. ❌ Pas de `storeIdParam` : L'API attend `?store_id=XXX` pour les gérants
3. ❌ Pas de normalisation de réponse : Si l'API retourne `{sellers: []}` au lieu d'un array direct

**TeamModal.js** (ligne 269, CORRECT) :
```javascript
const storeParam = storeIdParam ? `?store_id=${storeIdParam}` : '';
const response = await axios.get(`${API}/manager/sellers${storeParam}`, {
  headers: { Authorization: `Bearer ${token}` }
});
```

**ManagerSettingsModal.js** (ligne 105, CORRECT) :
```javascript
axios.get(`${API}/manager/sellers${storeParam}`, { headers })
```

### 2. Backend API

**backend/api/routes/manager.py** (ligne 396) :
```python
@router.get("/sellers")
async def get_sellers(
    store_id: Optional[str] = Query(None, description="Store ID (requis pour gérant)"),
    context: dict = Depends(get_store_context),
    manager_service: ManagerService = Depends(get_manager_service)
):
    resolved_store_id = context.get('resolved_store_id')
    manager_id = context.get('id')
    
    sellers = await manager_service.get_sellers(
        manager_id=manager_id,
        store_id=resolved_store_id
    )
    return sellers  # Retourne un array direct
```

**backend/services/manager_service.py** (ligne 23) :
```python
async def get_sellers(self, manager_id: str, store_id: str) -> List[Dict]:
    sellers = await self.user_repo.find_many(
        {
            "store_id": store_id,
            "role": "seller",
            "status": {"$ne": "deleted"}  # Inclut actifs ET suspendus
        },
        {"_id": 0, "password": 0}
    )
    return sellers  # Array direct
```

✅ **Backend retourne un array direct** (pas de wrapper `{sellers: []}`)

### 3. Filtrage Frontend

**GuideProfilsModal.js** (ligne 1861) :
```javascript
const rawSellingStyle = seller.style_vente || 'Dynamique';  // Fallback OK
```

✅ **Pas de filtrage strict** : Les vendeurs sans `style_vente` ont un fallback `'Dynamique'`
✅ **Pas de filtrage par DISC** : Tous les vendeurs sont affichés, même sans profil DISC

## Solution appliquée

### Modifications dans GuideProfilsModal.js

1. **Ajout du support `storeIdParam`** :
   - Récupération depuis les props OU depuis l'URL (`?store_id=XXX`)
   - Construction de `storeParam` comme dans TeamModal

2. **Correction de l'URL** :
   - AVANT : `${API}/api/manager/sellers` (double `/api`)
   - APRÈS : `${API}/manager/sellers${storeParam}`

3. **Normalisation de la réponse** :
   - Gestion des cas `array`, `{sellers: []}`, ou autre format

4. **Logs de debug** :
   - `storeId`, `storeParam`, `sellersCount`, `responseKeys`, `firstSeller`

### Diff exact

```diff
--- a/frontend/src/components/GuideProfilsModal.js
+++ b/frontend/src/components/GuideProfilsModal.js
@@ -3,10 +3,17 @@ import { X, ChevronLeft, ChevronRight } from 'lucide-react';
 import axios from 'axios';
 import { API_BASE } from '../lib/api';
 
-export default function GuideProfilsModal({ onClose, userRole = 'manager' }) {
+export default function GuideProfilsModal({ onClose, userRole = 'manager', storeIdParam = null }) {
   // ... sections ...
   
+  // Get store_id from URL if not provided as prop (for gerant accessing as manager)
+  const urlParams = new URLSearchParams(window.location.search);
+  const urlStoreId = urlParams.get('store_id');
+  const effectiveStoreId = storeIdParam || urlStoreId;
+  const storeParam = effectiveStoreId ? `?store_id=${effectiveStoreId}` : '';
+  
   const API = API_BASE || '';
 
   // ...
@@ -40,9 +47,9 @@ export default function GuideProfilsModal({ onClose, userRole = 'manager' }) {
       const token = localStorage.getItem('token');
       
       // Get manager info
-      const managerRes = await axios.get(`${API}/api/auth/me`, {
+      const managerRes = await axios.get(`${API}/auth/me`, {
         headers: { Authorization: `Bearer ${token}` }
       });
-      console.log('Manager data:', managerRes.data);
+      console.log('[GuideProfils] Manager data:', managerRes.data);
       
       // Get manager diagnostic to have profil_nom
-      const diagnosticRes = await axios.get(`${API}/api/manager-diagnostic/me`, {
+      const diagnosticRes = await axios.get(`${API}/manager-diagnostic/me`, {
         headers: { Authorization: `Bearer ${token}` }
       });
-      console.log('Manager diagnostic:', diagnosticRes.data);
+      console.log('[GuideProfils] Manager diagnostic:', diagnosticRes.data);
       
       // ...
-      console.log('Manager with profile:', managerWithProfile);
+      console.log('[GuideProfils] Manager with profile:', managerWithProfile);
       setManagerProfile(managerWithProfile);
       
       // Get sellers
-      const sellersRes = await axios.get(`${API}/api/manager/sellers`, {
+      const sellersUrl = `${API}/manager/sellers${storeParam}`;
+      console.log('[GuideProfils] 🔍 Fetching sellers:', {
+        url: sellersUrl,
+        storeId: effectiveStoreId,
+        storeParam: storeParam
+      });
+      
+      const sellersRes = await axios.get(sellersUrl, {
         headers: { Authorization: `Bearer ${token}` }
       });
       
-      console.log('Sellers data:', sellersRes.data);
-      setTeamSellers(sellersRes.data);
+      // Normalize response (handles both array and {sellers: []} formats)
+      const sellersData = Array.isArray(sellersRes.data) 
+        ? sellersRes.data 
+        : (sellersRes.data?.sellers || sellersRes.data || []);
+      
+      console.log('[GuideProfils] ✅ Sellers response:', {
+        rawResponse: sellersRes.data,
+        normalizedSellers: sellersData,
+        sellersCount: sellersData.length,
+        responseKeys: Object.keys(sellersRes.data || {}),
+        firstSeller: sellersData[0] || null
+      });
+      
+      setTeamSellers(sellersData);
```

## Vérifications

### Filtrage Backend

Le backend filtre par :
- ✅ `store_id` : Vendeurs du store sélectionné
- ✅ `role: "seller"` : Uniquement les vendeurs
- ✅ `status: {"$ne": "deleted"}` : Inclut actifs ET suspendus (pas de filtrage strict)

**Pas de filtrage par** :
- ❌ `status: "active"` (les suspendus sont inclus)
- ❌ `disc_profile` (pas requis)
- ❌ `style_vente` (pas requis)
- ❌ `diagnostic` (pas requis)

### Filtrage Frontend

Le frontend n'exclut **aucun vendeur** :
- ✅ Fallback `'Dynamique'` si `seller.style_vente` manquant
- ✅ Tous les vendeurs sont affichés, même sans profil DISC
- ✅ Badge "profil manquant" non nécessaire (le fallback gère)

## Résultat attendu

Après correction :
1. ✅ URL correcte : `/api/manager/sellers?store_id=XXX` (si gérant)
2. ✅ URL correcte : `/api/manager/sellers` (si manager normal)
3. ✅ Réponse normalisée : Gère array direct ou wrapper
4. ✅ Logs de debug : Permet de diagnostiquer les problèmes restants

## Tests

1. **Manager normal** : Devrait voir ses vendeurs
2. **Gérant avec `?store_id=XXX`** : Devrait voir les vendeurs du store sélectionné
3. **Vendeurs sans profil DISC** : Devraient apparaître avec fallback `'Dynamique'`

## Logs de debug ajoutés

Les logs suivants apparaîtront dans la console :
```
[GuideProfils] 🔍 Fetching sellers: { url: "...", storeId: "...", storeParam: "..." }
[GuideProfils] ✅ Sellers response: { rawResponse: [...], normalizedSellers: [...], sellersCount: N, responseKeys: [...], firstSeller: {...} }
```

Ces logs permettent de diagnostiquer :
- Si `storeId` est bien récupéré
- Si l'URL est correcte
- Si la réponse est un array ou un wrapper
- Combien de vendeurs sont retournés
- La structure du premier vendeur

