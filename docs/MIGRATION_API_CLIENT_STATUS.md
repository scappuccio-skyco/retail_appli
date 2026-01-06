# Migration API Client - Statut Actuel

**Date** : 2025-01-XX  
**Dernière mise à jour** : Après migration des 11 fichiers prioritaires (incluant MorningBriefModal.js et GerantDashboard.js)

---

## 📊 Statistiques Globales

| Métrique | Avant | Après Migration 11 Fichiers | Après Migration 10 Fichiers Supplémentaires | Objectif Final |
|----------|-------|------------------------------|---------------------------------------------|----------------|
| **Occurrences `axios.`** | 207 | 129 (128 hors apiClient.js) | **88 (87 hors apiClient.js)** | 0 |
| **Occurrences `console.log(`** | 74 | 69 (68 hors logger.js) | **61 (60 hors logger.js)** | 0 |
| **Occurrences `console.warn(`** | 15 | 13 (12 hors logger.js) | **13 (12 hors logger.js)** | 0 |
| **Occurrences `console.error(`** | 132 | 118 (117 hors logger.js) | **93 (92 hors logger.js)** | 0 |
| **Occurrences `console.debug(`** | - | - | **1 (0 hors logger.js)** | 0 |
| **Occurrences `localStorage.getItem('token')`** | 136 | 80 (79 hors apiClient.js) | **65 (64 hors apiClient.js)** | <20 |
| **Occurrences `/api/api/`** | 0 | 5 (dans apiClient.js uniquement) ✅ | **1 (dans apiClient.js uniquement) ✅** | 0 ✅ |
| **Fichiers avec axios** | 65 | 56 | **46** | 0 |

---

## ✅ Fichiers Migrés (9 fichiers prioritaires)

### 1. ✅ `StoreKPIModal.js` (13 occurrences)
- ✅ Import `api` depuis `apiClient`
- ✅ Import `logger` depuis `utils/logger`
- ✅ 13 appels `axios.*` → `api.*`
- ✅ 8 `localStorage.getItem('token')` supprimés
- ✅ 15 `console.*` → `logger.*`
- ✅ URLs corrigées (suppression `/api` et `${API}`)
- ✅ 0 occurrence `/api/api/` ✅

### 2. ✅ `SuperAdminDashboard.js` (12 occurrences)
- ✅ Import `api` depuis `apiClient`
- ✅ Import `logger` depuis `utils/logger`
- ✅ 12 appels `axios.*` → `api.*`
- ✅ 6 `localStorage.getItem('token')` supprimés
- ✅ 3 `console.*` → `logger.*`
- ✅ URLs corrigées (suppression `/api` et `${API}`)
- ✅ 0 occurrence `/api/api/` ✅

### 3. ✅ `SubscriptionModal.js` (12 occurrences)
- ✅ Import `api` depuis `apiClient`
- ✅ Import `logger` depuis `utils/logger`
- ✅ 12 appels `axios.*` → `api.*`
- ✅ 8 `localStorage.getItem('token')` supprimés
- ✅ 8 `console.*` → `logger.*`
- ✅ URLs corrigées (suppression `/api` et `${API}`)
- ✅ 0 occurrence `/api/api/` ✅

### 4. ✅ `StaffOverview.js` (11 occurrences)
- ✅ Import `api` depuis `apiClient`
- ✅ Import `logger` depuis `utils/logger`
- ✅ 11 appels `axios.*` → `api.*`
- ✅ 6 `localStorage.getItem('token')` supprimés
- ✅ URLs corrigées (suppression `/api` et `${API}`)
- ✅ 0 occurrence `/api/api/` ✅

### 5. ✅ `ObjectivesModal.js` (7 occurrences)
- ✅ Import `api` depuis `apiClient`
- ✅ Import `logger` depuis `utils/logger`
- ✅ 7 appels `axios.*` → `api.*`
- ✅ 3 `localStorage.getItem('token')` supprimés
- ✅ 3 `console.*` → `logger.*`
- ✅ URLs corrigées (suppression `/api` et `${API}`)
- ✅ 0 occurrence `/api/api/` ✅

### 6. ✅ `TeamModal.js` (7 occurrences)
- ✅ Import `api` depuis `apiClient`
- ✅ Import `logger` depuis `utils/logger`
- ✅ 7 appels `axios.*` → `api.*`
- ✅ 3 `localStorage.getItem('token')` supprimés
- ✅ 15+ `console.*` → `logger.*`
- ✅ URLs corrigées (suppression `/api` et `${API}`)
- ✅ 0 occurrence `/api/api/` ✅

### 7. ✅ `ManagerSettingsModal.js` (déjà migré)
- ✅ Déjà migré avant cette session
- ✅ Utilise `api` et `logger`

### 8. ✅ `SellerDetailView.js` (6 occurrences)
- ✅ Import `api` depuis `apiClient`
- ✅ Import `logger` depuis `utils/logger`
- ✅ 6 appels `axios.*` → `api.*`
- ✅ 1 `localStorage.getItem('token')` supprimé
- ✅ 1 `console.*` → `logger.*`
- ✅ URLs corrigées (suppression `/api` et `${API}`)
- ✅ 0 occurrence `/api/api/` ✅

### 9. ✅ `KPIEntryModal.js` (5 occurrences)
- ✅ Import `api` depuis `apiClient`
- ✅ Import `logger` depuis `utils/logger`
- ✅ 5 appels `axios.*` → `api.*`
- ✅ 2 `localStorage.getItem('token')` supprimés
- ✅ 2 `console.*` → `logger.*`
- ✅ URLs corrigées (suppression `/api` et `${API}`)
- ✅ 0 occurrence `/api/api/` ✅

### 10. ✅ `MorningBriefModal.js` (3 occurrences)
- ✅ Import `api` depuis `apiClient`
- ✅ Import `logger` depuis `utils/logger`
- ✅ 3 appels `axios.*` → `api.*`
- ✅ 3 `localStorage.getItem('token')` supprimés
- ✅ 10 `console.*` → `logger.*` (5 log, 2 warn, 3 error)
- ✅ URLs corrigées (suppression `/api` et `${API_URL}`)
- ✅ 0 occurrence `/api/api/` ✅

### 11. ✅ `GerantDashboard.js` (9 occurrences)
- ✅ Import `api` depuis `apiClient`
- ✅ Import `logger` depuis `utils/logger`
- ✅ 0 `axios.*` (déjà migré)
- ✅ 9 `fetch` + `axios` → `api.*`
- ✅ 9 `localStorage.getItem('token')` supprimés (tous utilisés pour appels API)
- ✅ 9 `console.error` → `logger.error`
- ✅ URLs corrigées (suppression `/api` et `${backendUrl}`)
- ✅ 0 occurrence `/api/api/` ✅

### 12. ✅ `ManagerSettings.js` (6 occurrences)
- ✅ Import `api` depuis `apiClient`
- ✅ Import `logger` depuis `utils/logger`
- ✅ 6 appels `axios.*` → `api.*`
- ✅ 1 `localStorage.getItem('token')` supprimé
- ✅ 3 `console.*` → `logger.*`
- ✅ URLs corrigées (suppression `/api` et `${API}`)
- ✅ 0 occurrence `/api/api/` ✅

### 13. ✅ `APIKeysManagement.js` (5 occurrences)
- ✅ Import `api` depuis `apiClient`
- ✅ Import `logger` depuis `utils/logger`
- ✅ 5 appels `axios.*` → `api.*`
- ✅ 0 `localStorage.getItem('token')` (déjà géré par apiClient)
- ✅ 1 `console.error` → `logger.error`
- ✅ URLs corrigées (suppression `/api` et `${API_BASE}`)
- ✅ 0 occurrence `/api/api/` ✅

### 14. ✅ `AIAssistant.js` (5 occurrences)
- ✅ Import `api` depuis `apiClient`
- ✅ Import `logger` depuis `utils/logger`
- ✅ 5 appels `axios.*` → `api.*`
- ✅ 5 `localStorage.getItem('token')` supprimés
- ✅ 5 `console.error` → `logger.error`
- ✅ URLs corrigées (suppression `/api` et `${API}`)
- ✅ 0 occurrence `/api/api/` ✅

### 15. ✅ `CoachingModal.js` (5 occurrences)
- ✅ Import `api` depuis `apiClient`
- ✅ Import `logger` depuis `utils/logger`
- ✅ 5 appels `axios.*` → `api.*`
- ✅ 1 `localStorage.getItem('token')` supprimé (via prop token)
- ✅ 4 `console.*` → `logger.*`
- ✅ URLs corrigées (suppression `/api` et `${API}`)
- ✅ 0 occurrence `/api/api/` ✅

### 16. ✅ `DebriefHistoryModal.js` (4 occurrences)
- ✅ Import `api` depuis `apiClient`
- ✅ Import `logger` depuis `utils/logger`
- ✅ 4 appels `axios.*` → `api.*`
- ✅ 1 `localStorage.getItem('token')` supprimé (via prop token)
- ✅ 4 `console.error` → `logger.error`
- ✅ URLs corrigées (suppression `/api/api/` et `${API}`)
- ✅ 0 occurrence `/api/api/` ✅

### 17. ✅ `InvitationsManagement.js` (4 occurrences)
- ✅ Import `api` depuis `apiClient`
- ✅ Import `logger` depuis `utils/logger`
- ✅ 4 appels `axios.*` → `api.*`
- ✅ 4 `localStorage.getItem('token')` supprimés
- ✅ 1 `console.error` → `logger.error`
- ✅ URLs corrigées (suppression `/api` et `${backendUrl}`)
- ✅ 0 occurrence `/api/api/` ✅

### 18. ✅ `GuideProfilsModal.js` (3 occurrences)
- ✅ Import `api` depuis `apiClient`
- ✅ Import `logger` depuis `utils/logger`
- ✅ 3 appels `axios.*` → `api.*`
- ✅ 1 `localStorage.getItem('token')` supprimé
- ✅ 5 `console.*` → `logger.*`
- ✅ URLs corrigées (suppression `/api` et `${API}`)
- ✅ 0 occurrence `/api/api/` ✅

### 19. ✅ `useOnboarding.js` (3 occurrences)
- ✅ Import `api` depuis `apiClient`
- ✅ Import `logger` depuis `utils/logger`
- ✅ 3 appels `axios.*` → `api.*`
- ✅ 3 `localStorage.getItem('token')` supprimés
- ✅ 3 `console.error` → `logger.error`
- ✅ URLs corrigées (suppression `/api/api/` et `${API}`)
- ✅ 0 occurrence `/api/api/` ✅

### 20. ✅ `RegisterSeller.js` (3 occurrences)
- ✅ Import `api` depuis `apiClient`
- ✅ Import `logger` depuis `utils/logger`
- ✅ 3 appels `axios.*` → `api.*`
- ✅ 0 `localStorage.getItem('token')` (pas d'auth nécessaire pour inscription)
- ✅ 1 `console.error` → `logger.error`
- ✅ URLs corrigées (suppression `/api` et `${API}`)
- ✅ 0 occurrence `/api/api/` ✅

### 21. ✅ `KPIReporting.js` (3 occurrences)
- ✅ Import `api` depuis `apiClient`
- ✅ Import `logger` depuis `utils/logger`
- ✅ 3 appels `axios.*` → `api.*`
- ✅ 1 `localStorage.getItem('token')` supprimé
- ✅ 1 `console.error` → `logger.error`
- ✅ URLs corrigées (suppression `/api` et `${API}`)
- ✅ 0 occurrence `/api/api/` ✅

### 22. ⏸️ `_DEPRECATED_ITAdminDashboard.js` (optionnel)
- ⏸️ Non migré (fichier déprécié, à vérifier si encore utilisé)

---

## 📋 Pattern de Migration Appliqué

Pour chaque fichier migré :

1. **Remplacement imports** :
   ```javascript
   // AVANT
   import axios from 'axios';
   
   // APRÈS
   import { api } from '../lib/apiClient';
   import { logger } from '../utils/logger';
   ```

2. **Remplacement appels API** :
   ```javascript
   // AVANT
   const token = localStorage.getItem('token');
   const res = await axios.get(`${API}/api/manager/objectives`, {
     headers: { Authorization: `Bearer ${token}` }
   });
   
   // APRÈS
   const res = await api.get('/manager/objectives');
   ```

3. **Remplacement console** :
   ```javascript
   // AVANT
   console.log('Debug info');
   console.error('Error:', err);
   
   // APRÈS
   logger.log('Debug info');
   logger.error('Error:', err);
   ```

4. **Cas spéciaux** :
   - **Blob** : `axios.get(url, { responseType: 'blob' })` → `api.getBlob(url)`
   - **FormData** : `axios.post(url, formData, { headers: { 'Content-Type': 'multipart/form-data' } })` → `api.postFormData(url, formData)`

---

## ⚠️ Fichiers Restants (46 fichiers)

### Priorité HAUTE (Pages principales)
- `pages/_DEPRECATED_ITAdminDashboard.js` - 6 appels axios (déprécié)

### Priorité MOYENNE (Composants critiques)
- `components/superadmin/AdminManagement.js` - 3 appels axios
- `components/TeamAIAnalysisModal.js` - 3 appels axios
- `components/gerant/StoresManagement.js` - 2 appels axios
- `components/ConflictResolutionForm.js` - 2 appels axios
- `components/RelationshipManagementModal.js` - 2 appels axios

### Priorité BASSE (Autres composants)
- ~40 autres fichiers avec 1-2 appels axios chacun

---

## ✅ Vérifications Effectuées

### 1. Vérification `/api/api/`
```bash
# Résultat : 0 occurrence ✅
grep -r "/api/api/" frontend/src
```

### 2. Vérification Build
- ✅ Aucune erreur d'import
- ✅ Tous les chemins relatifs corrects
- ✅ Exports corrects

### 3. Vérification Protections
- ✅ `cleanUrl()` fonctionne dans `apiClient.js`
- ✅ Interceptor corrige les URLs automatiquement
- ✅ Warnings en DEV activés

---

## 🎯 Prochaines Étapes

### Phase 1 - Migration Manuelle (✅ TERMINÉE - 21 fichiers)
- [x] Migrer `StoreKPIModal.js` ✅
- [x] Migrer `SuperAdminDashboard.js` ✅
- [x] Migrer `SubscriptionModal.js` ✅
- [x] Migrer `StaffOverview.js` ✅
- [x] Migrer `ObjectivesModal.js` ✅
- [x] Migrer `TeamModal.js` ✅
- [x] Migrer `ManagerSettingsModal.js` ✅ (déjà migré)
- [x] Migrer `SellerDetailView.js` ✅
- [x] Migrer `KPIEntryModal.js` ✅
- [x] Migrer `MorningBriefModal.js` ✅
- [x] Migrer `GerantDashboard.js` ✅
- [x] Migrer `ManagerSettings.js` ✅
- [x] Migrer `APIKeysManagement.js` ✅
- [x] Migrer `AIAssistant.js` ✅
- [x] Migrer `CoachingModal.js` ✅
- [x] Migrer `DebriefHistoryModal.js` ✅
- [x] Migrer `InvitationsManagement.js` ✅
- [x] Migrer `GuideProfilsModal.js` ✅
- [x] Migrer `useOnboarding.js` ✅
- [x] Migrer `RegisterSeller.js` ✅
- [x] Migrer `KPIReporting.js` ✅

### Phase 2 - Migration Automatique (Optionnel)
Créer un script de migration pour les fichiers restants (attention aux cas particuliers)

### Phase 3 - Vérification Finale
- [ ] Vérifier qu'il n'y a plus d'appels axios
- [ ] Vérifier qu'il n'y a plus de console.log
- [ ] Tests complets en staging

---

## 📝 Notes Techniques

### Fichiers Exclus de la Migration
- `frontend/src/lib/apiClient.js` : Utilise axios (normal, c'est le client)
- `frontend/src/lib/http.js` : Wrapper legacy (à vérifier si encore utilisé)

### Fichiers Dépréciés
- `frontend/src/pages/_DEPRECATED_ITAdminDashboard.js` : Peut être ignoré si non utilisé

---

**Fin du document**
