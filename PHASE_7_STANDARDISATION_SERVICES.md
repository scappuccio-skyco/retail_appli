# Phase 7 : Standardisation des Services

## Objectif
Éliminer tous les accès directs à `self.db.collection` dans les services et les remplacer par des appels aux repositories.

## État d'Avancement

### ✅ Repositories Créés
- ✅ `ManagerRequestRepository` - pour `manager_requests`
- ✅ `ManagerDiagnosticRepository` - pour `manager_diagnostics`

### ⏳ Repositories à Créer
- ⏳ `GerantInvitationRepository` - pour `gerant_invitations`
- ⏳ `InvitationRepository` - pour `invitations` (manager invitations)
- ⏳ `AchievementNotificationRepository` - pour `achievement_notifications`

### 📊 Analyse des Services

#### `seller_service.py` - 31 accès directs
- `self.db.achievement_notifications` → `AchievementNotificationRepository`
- `self.db.diagnostics` → `DiagnosticRepository` (existe déjà)
- `self.db.manager_requests` → `ManagerRequestRepository` (créé)
- `self.db.objectives` → `ObjectiveRepository` (existe déjà)
- `self.db.challenges` → `ChallengeRepository` (existe déjà)
- `self.db.users` → `UserRepository` (existe déjà)
- `self.db.kpi_entries` → `KPIRepository` (existe déjà)
- `self.db.manager_kpis` → `ManagerKPIRepository` (existe déjà)

#### `manager_service.py` - 17 accès directs
- `self.db.invitations` → `InvitationRepository` (à créer)
- `self.db.kpi_configs` → `KPIConfigRepository` (existe déjà)
- `self.db.team_bilans` → `TeamAnalysisRepository` (existe déjà)
- `self.db.kpi_entries` → `KPIRepository` (existe déjà)
- `self.db.manager_kpis` → `ManagerKPIRepository` (existe déjà)
- `self.db.objectives` → `ObjectiveRepository` (existe déjà)
- `self.db.challenges` → `ChallengeRepository` (existe déjà)
- `self.db.manager_diagnostics` → `ManagerDiagnosticRepository` (créé)
- `self.db.api_keys` → `APIKeyRepository` (existe dans enterprise_repository)

#### `gerant_service.py` - 54 accès directs
- `self.db.workspaces` → `WorkspaceRepository` (existe déjà)
- `self.db.users` → `UserRepository` (existe déjà)
- `self.db.stores` → `StoreRepository` (existe déjà)
- `self.db.manager_kpis` → `ManagerKPIRepository` (existe déjà)
- `self.db.kpi_entries` → `KPIRepository` (existe déjà)
- `self.db.gerant_invitations` → `GerantInvitationRepository` (à créer)
- `self.db.subscriptions` → `SubscriptionRepository` (existe déjà)

### 🔧 `.to_list(1000)` à Remplacer

1. `gerant_service.py` ligne 1456
2. `seller_service.py` ligne 720
3. `seller_service.py` ligne 861
4. `seller_service.py` ligne 1110
5. `seller_service.py` ligne 1247

## Plan d'Action

1. ✅ Créer `ManagerRequestRepository` et `ManagerDiagnosticRepository`
2. ⏳ Créer les 3 repositories manquants
3. ⏳ Mettre à jour `repositories/__init__.py`
4. ⏳ Refactorer `seller_service.py` (31 accès)
5. ⏳ Refactorer `manager_service.py` (17 accès)
6. ⏳ Refactorer `gerant_service.py` (54 accès)
7. ⏳ Remplacer les 5 `.to_list(1000)` par itérateurs/agrégations
8. ⏳ Corriger les 2 violations dans `sellers.py` (lignes 203 et 399)

## Notes Techniques

- Les repositories doivent hériter de `BaseRepository`
- Tous les repositories doivent avoir des filtres de sécurité (store_id, gerant_id, manager_id, seller_id)
- Utiliser `async for doc in cursor` au lieu de `.to_list(1000)` pour les grandes collections
- Utiliser des agrégations MongoDB pour les calculs de totaux
