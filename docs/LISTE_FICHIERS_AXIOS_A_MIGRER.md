# Liste des Fichiers avec axios. >= 2 Occurrences

**Date** : 2025-01-XX  
**Objectif** : Réduire axios. de 87 à <20

---

## 📊 Fichiers avec >= 2 Occurrences (à migrer)

| Fichier | Occurrences | Statut | Priorité |
|---------|-------------|--------|----------|
| `components/SubscriptionModal.js` | 2 | ✅ À migrer | HAUTE |
| `components/ConflictResolutionForm.js` | 2 | ✅ À migrer | MOYENNE |
| `components/RelationshipManagementModal.js` | 2 | ✅ À migrer | MOYENNE |
| `components/superadmin/StripeSubscriptionsView.js` | 2 | ✅ À migrer | MOYENNE |
| `components/gerant/StoresManagement.js` | 2 | ✅ À migrer | MOYENNE |
| `pages/InvitationPage.js` | 2 | ✅ À migrer | HAUTE |
| `pages/ResetPassword.js` | 2 | ✅ À migrer | MOYENNE |
| `pages/RegisterManager.js` | 2 | ✅ À migrer | MOYENNE |
| `pages/RegisterGerant.js` | 2 | ✅ À migrer | MOYENNE |
| `hooks/useSyncMode.js` | 2 | ✅ À migrer | MOYENNE |
| `components/TeamBilanIA.js` | 2 | ✅ À migrer | MOYENNE |
| `components/TeamAIAnalysisModal.js` | 3 | ✅ À migrer | MOYENNE |
| `components/superadmin/TrialManagement.js` | 2 | ✅ À migrer | MOYENNE |
| `components/superadmin/AdminManagement.js` | 3 | ✅ À migrer | MOYENNE |
| `components/KPIConfigModal.js` | 2 | ✅ À migrer | MOYENNE |
| `components/EvaluationModal.js` | 2 | ✅ À migrer | MOYENNE |
| `components/DebriefModal.js` | 2 | ✅ À migrer | MOYENNE |
| `components/DailyChallengeModal.js` | 3 | ✅ À migrer | MOYENNE |

**Total à migrer** : **18 fichiers** (33 occurrences)

---

## ⏸️ Fichiers à Exclure

| Fichier | Occurrences | Raison |
|---------|-------------|--------|
| `pages/_DEPRECATED_ITAdminDashboard.js` | 6 | ⏸️ Déprécié (non importé dans App.js) |
| `components/SubscriptionModal.backup.js` | 7 | ⏸️ Backup |
| `components/StoreKPIModal_BACKUP_MULTI_CHARTS.js` | 7 | ⏸️ Backup |
| `components/DebriefHistoryModal.old.js` | 3 | ⏸️ Backup |
| `components/DebriefHistoryModal.backup.js` | 3 | ⏸️ Backup |
| `lib/apiClient.js` | 1 | ⏸️ Fichier apiClient lui-même |
| `lib/http.js` | 1 | ⏸️ Wrapper legacy (à vérifier) |
| `utils/pdfTest.js` | ? | ⏸️ Fichier de test (à déplacer/supprimer) |

---

## 📋 Fichiers avec 1 Occurrence (à migrer plus tard)

- `App.js` (1)
- `components/EvaluationGenerator.js` (1)
- `components/VenteConclueForm.js` (1)
- `components/OpportuniteManqueeForm.js` (1)
- `components/SubscriptionBanner.js` (1)
- `components/StoreKPIAIAnalysisModal.js` (1)
- `components/PerformanceModal.js` (1)
- `components/ObjectivesAndChallengesModal.js` (1)
- `components/ManagerDiagnosticForm.js` (1)
- `components/InviteModal.js` (1)
- `components/gerant/BulkStoreImportModal.js` (1)
- `components/DiagnosticFormStepsCss.js` (1)
- `components/DiagnosticFormSimple.js` (1)
- `components/DiagnosticFormScrollable.js` (1)
- `components/DiagnosticFormModal.js` (1)
- `components/DiagnosticFormClass.js` (1)
- `components/DiagnosticForm.js` (1)
- `components/ChallengeHistoryModal.js` (1)
- `pages/ForgotPassword.js` (1)
- `components/SupportModal.js` (1)

**Total** : 20 fichiers avec 1 occurrence

---

## 🎯 Plan de Migration

### Phase 1 : Migrer les fichiers avec >= 2 occurrences (18 fichiers)

**Objectif** : Réduire de 87 à ~54 occurrences (33 occurrences supprimées)

### Phase 2 : Migrer les fichiers avec 1 occurrence (optionnel)

**Objectif** : Réduire de 54 à ~34 occurrences (20 occurrences supprimées)

---

**Fin du document**

