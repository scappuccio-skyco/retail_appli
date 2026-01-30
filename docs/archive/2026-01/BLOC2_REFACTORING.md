# Bloc 2 – Refactorisation security, verify_* et mutualisation

## Réalisé

### 1. Bug fix (déjà fait en Bloc 1)
- **`api/dependencies.py`** : `ConflictConsultationRepository` importé depuis `repositories.conflict_consultation_repository`.

### 2. Refacto Security – plus d’accès DB direct dans `core/security.py`
- **Auth / workspace**  
  - `_get_current_user_from_token` : utilisation de `UserRepository(db)` pour le fetch user au lieu de `db.users.find_one`.  
  - `_resolve_workspace` : prend `workspace_repo` (plus `db`), utilise `WorkspaceRepository.find_by_id` / `find_by_gerant` au lieu de `db.workspaces.find_one`.  
  - `_attach_space_context` : prend `workspace_repo`, plus `db`.
- **`require_active_space`** : passage à `WorkspaceRepository(db)` et `update_by_id` pour `trial_expired`, plus de `db.workspaces.update_one`.
- **`verify_store_ownership`** : prend `store_repo` (optionnel), utilise `StoreRepository` au lieu de `db.stores.find_one`. Création de `StoreRepository` via `get_db` si non fourni.

### 3. Unification des verify_* sur les services
- **`verify_resource_store_access`** :  
  - Signature réduite à `resource_id`, `resource_type`, `user_store_id`, `manager_service` (tout en keyword-only).  
  - Utilisation exclusive de `ManagerService` (objectives/challenges).  
  - Suppression des branches `db`, `objective_repo`, `challenge_repo`.
- **`verify_seller_store_access`** :  
  - Signature réduite à `seller_id`, `user_store_id`, `user_role`, `user_id`, `manager_service` (keyword-only).  
  - Utilisation exclusive de `ManagerService`.  
  - Suppression des branches `db`, `user_repo`, `store_repo`.  
  - Suppression du second `user_repo.find_one` inutile dans la branche gérant.

### 4. Mutualisation – `verify_store_access_for_user(store, user)`
- Nouvelle fonction utilitaire dans `core/security.py`.  
- Centralise le contrôle d’accès au magasin :  
  - **Manager** : accès si `store.manager_id == user.id` ou `store.id == user.store_id`.  
  - **Gérant** : accès si `store.gerant_id == user.id`.  
- Lance `ForbiddenError("Accès refusé à ce magasin")` en cas de refus.

### 5. Utilisation de `verify_store_access_for_user`
- **`api/routes/briefs.py`** :  
  - Import de `verify_store_access_for_user`.  
  - Remplacement des vérifications inline (manager_id / gerant_id) par `verify_store_access_for_user(store, current_user)` dans les routes :  
    - génération du brief matinal,  
    - preview,  
    - history,  
    - delete.
- **`api/routes/manager.py`** :  
  - Import de `verify_store_access_for_user`.  
  - Utilisation dans `get_store_context` (branche gérant) et `get_store_context_with_seller` (branche gérant) lorsqu’un `store` est disponible après `get_store_by_id`.

### 6. Appels mis à jour
- **`api/routes/manager.py`** : tous les appels à `verify_resource_store_access` passent uniquement `resource_id`, `resource_type`, `user_store_id`, `manager_service` (plus `user_role` / `user_id`).  
- Les appels à `verify_seller_store_access` restent inchangés (`seller_id`, `user_store_id`, `user_role`, `user_id`, `manager_service`).

## Fichiers modifiés

- `backend/core/security.py`
- `backend/api/routes/briefs.py`
- `backend/api/routes/manager.py`

## À noter

- **`manager.py`** : des `try` sans `except` issus du Bloc 1 restent à corriger (la compilation échoue encore sur ce fichier). Les changements du Bloc 2 n’ajoutent pas de `try` / `except`.
- **`verify_store_ownership`** : paramètre `db` remplacé par `store_repo` (optionnel). Aucun appelant externe identifié.
- **`sellers.py`** : importe toujours `verify_resource_store_access` mais ne l’utilise pas.
