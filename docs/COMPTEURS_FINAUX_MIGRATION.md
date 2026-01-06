# Compteurs Finaux - Migration API Client

**Date** : 2025-01-XX  
**Après migration de 11 fichiers prioritaires**

---

## 📊 Compteurs Globaux (EXCLUANT `logger.js` et `apiClient.js`)

| Type | Total | Dans `logger.js` | Dans `apiClient.js` | **Hors fichiers système** |
|------|-------|------------------|---------------------|---------------------------|
| `axios.` | 129 | 0 | 1 | **128** |
| `console.log(` | 69 | 1 | 0 | **68** |
| `console.warn(` | 13 | 1 | 0 | **12** |
| `console.error(` | 118 | 1 | 0 | **117** |
| `console.debug(` | 0 | 1 | 0 | **0** |
| **TOTAL `console.*`** | **200** | **4** | **0** | **197** |
| `localStorage.getItem('token')` | 80 | 0 | 1 | **79** |

---

## 📋 Top 10 Fichiers les Plus Concernés par `localStorage.getItem('token')`

| Rang | Fichier | Occurrences | Statut |
|------|---------|-------------|--------|
| 1 | `components/superadmin/AIAssistant.js` | 5 | ⚠️ À migrer |
| 2 | `components/superadmin/AdminManagement.js` | 3 | ⚠️ À migrer |
| 3 | `components/superadmin/InvitationsManagement.js` | 4 | ⚠️ À migrer |
| 4 | `components/gerant/StoreDetailModal.js` | 4 | ⚠️ À migrer |
| 5 | `components/ConflictResolutionForm.js` | 3 | ⚠️ À migrer |
| 6 | `components/RelationshipManagementModal.js` | 3 | ⚠️ À migrer |
| 7 | `hooks/useOnboarding.js` | 3 | ⚠️ À migrer |
| 8 | `components/TeamAIAnalysisModal.js` | 3 | ⚠️ À migrer |
| 9 | `components/SubscriptionModal.js` | 2 | ⚠️ À migrer |
| 10 | `components/gerant/StoresManagement.js` | 2 | ⚠️ À migrer |

---

## 📋 Top 10 Fichiers les Plus Concernés par `console.*` (HORS `logger.js`)

| Rang | Fichier | `console.log` | `console.warn` | `console.error` | **Total** |
|------|---------|---------------|----------------|-----------------|-----------|
| 1 | `utils/pdfTest.js` | 11 | 0 | 1 | **12** |
| 2 | `components/DiagnosticFormClass.js` | 7 | 0 | 0 | **7** |
| 3 | `App.js` | 7 | 0 | 1 | **8** |
| 4 | `components/EvaluationGenerator.js` | 5 | 1 | 1 | **7** |
| 5 | `components/GuideProfilsModal.js` | 5 | 0 | 1 | **6** |
| 6 | `components/gerant/StoreDetailModal.js` | 5 | 0 | 5 | **10** |
| 7 | `components/BilanIndividuelModal.js` | 5 | 0 | 0 | **5** |
| 8 | `components/RelationshipManagementModal.js` | 4 | 0 | 2 | **6** |
| 9 | `hooks/useSyncMode.js` | 4 | 0 | 0 | **4** |
| 10 | `components/CoachingModal.js` | 2 | 0 | 5 | **7** |

---

## 📋 Top 10 Fichiers les Plus Concernés par `axios.` (HORS `apiClient.js`)

| Rang | Fichier | Occurrences | Statut |
|------|---------|-------------|--------|
| 1 | `pages/_DEPRECATED_ITAdminDashboard.js` | 6 | ⚠️ Déprécié |
| 2 | `pages/ManagerSettings.js` | 6 | ⚠️ À migrer |
| 3 | `components/superadmin/AdminManagement.js` | 3 | ⚠️ À migrer |
| 4 | `components/GuideProfilsModal.js` | 3 | ⚠️ À migrer |
| 5 | `components/superadmin/InvitationsManagement.js` | 4 | ⚠️ À migrer |
| 6 | `components/gerant/APIKeysManagement.js` | 5 | ⚠️ À migrer |
| 7 | `components/DebriefHistoryModal.js` | 4 | ⚠️ À migrer |
| 8 | `components/superadmin/StripeSubscriptionsView.js` | 2 | ⚠️ À migrer |
| 9 | `components/CoachingModal.js` | 5 | ⚠️ À migrer |
| 10 | `components/ConflictResolutionForm.js` | 2 | ⚠️ À migrer |

---

## ✅ Fichiers Migrés (11 fichiers)

1. ✅ `StoreKPIModal.js`
2. ✅ `SuperAdminDashboard.js`
3. ✅ `SubscriptionModal.js`
4. ✅ `StaffOverview.js`
5. ✅ `ObjectivesModal.js`
6. ✅ `TeamModal.js`
7. ✅ `ManagerSettingsModal.js`
8. ✅ `SellerDetailView.js`
9. ✅ `KPIEntryModal.js`
10. ✅ `MorningBriefModal.js`
11. ✅ `GerantDashboard.js`

---

## 🎯 Prochaines Étapes Recommandées

### Priorité HAUTE
1. Migrer `pages/ManagerSettings.js` (6 axios)
2. Migrer `components/gerant/APIKeysManagement.js` (5 axios)
3. Migrer `components/CoachingModal.js` (5 axios)

### Priorité MOYENNE
4. Migrer `components/superadmin/AdminManagement.js` (3 axios, 3 localStorage)
5. Migrer `components/superadmin/InvitationsManagement.js` (4 axios, 4 localStorage)
6. Migrer `components/gerant/StoreDetailModal.js` (4 localStorage, 10 console.*)

### Priorité BASSE
7. Migrer les fichiers restants progressivement

---

**Fin du document**

