# Phase 8 : Purification de l'architecture

**Objectif** : Le mot-clé `.collection` ne doit apparaître **que** dans `repositories/`, jamais dans `services/`.

## Réalisations

### 1. UserRepository (enrichi)

- **`find_ids_by_query(query)`**  
  Itérateur asynchrone des IDs uniquement. Sécurité : la requête doit contenir `store_id`, `manager_id` ou `gerant_id`.

- **`find_by_store_iter(store_id, role=None, status_exclude=None, projection=None)`**  
  Itérateur asynchrone des utilisateurs d’un magasin (pour `get_store_sellers` sans `.collection`).

- **`update_with_unset(filter, set_data, unset_data)`**  
  Mise à jour avec `$set` et `$unset` (ex. réactivation utilisateur). Invalidation du cache gérée.

### 2. BaseRepository

- **`find_iter(filters, projection, sort)`**  
  Itérateur asynchrone sur les documents (sans limite), utilisé par KPI / ManagerKPI.

- **`insert_many(documents, ordered=True)`**  
  Paramètre `ordered=False` ajouté pour les sync logs (continue en cas de doublon).

### 3. GerantInvitationRepository

- **`find_by_gerant_iter(gerant_id, status, projection)`**  
  Itérateur asynchrone des invitations par gérant (remplace `limit=1000`).

### 4. Services nettoyés

**seller_service.py**

- 4 accès `self.user_repo.collection.find` remplacés par `find_ids_by_query(seller_query)`.
- 4 usages `find_by_manager(..., limit=1000)` supprimés : tout passe par l’itérateur `find_ids_by_query`.

**gerant_service.py**

- `get_store_sellers` : `user_repo.collection.find` → `user_repo.find_by_store_iter(store_id, role="seller", status_exclude="deleted")`.
- `reactivate_user` : `user_repo.collection.update_one` → `user_repo.update_with_unset(filter, set_data, unset_data)`.
- `get_all_stores` : `find_by_gerant(..., limit=1000)` → `find_by_gerant_iter` + construction de `pending_by_store` en une passe.
- KPI / ManagerKPI : `kpi_repo.collection.find` et `manager_kpi_repo.collection.find` → `find_iter`.
- `manager_kpi_repo.collection.distinct` → `manager_kpi_repo.distinct(...)`.
- Sync magasins : `store_repo.collection.find` → `store_repo.find_many` ; `store_repo.collection.bulk_write` → `store_repo.bulk_write`.

**enterprise_service.py**

- `enterprise_repo.collection.update_one` → `enterprise_repo.update_one`.
- `user_repo.collection.find` → `user_repo.find_many(..., limit=MAX_USERS_SYNC)`.
- `user_repo.collection.bulk_write` → `user_repo.bulk_write`.
- `sync_log_repo.collection.insert_many` → `sync_log_repo.insert_many(..., ordered=False)`.
- `store_repo.collection.find` → `store_repo.find_many` ; `store_repo.collection.bulk_write` → `store_repo.bulk_write`.

### 5. Limites 1000 supprimées

- **seller_service.py** : plus de `limit=1000` ; collecte des IDs via `async for uid in self.user_repo.find_ids_by_query(seller_query)`.
- **gerant_service.py** : plus de `find_by_gerant(..., limit=1000)` ; utilisation de `find_by_gerant_iter` pour les invitations.

## Vérification

- **Services** : aucun appel du type `*_repo.collection.*` (uniquement des commentaires « no .collection »).
- **Repositories** : `.collection` reste utilisé uniquement dans `backend/repositories/` (base, user, gerant_invitation, enterprise, kpi).

## Fichiers modifiés

- `backend/repositories/user_repository.py` – ajout de `find_ids_by_query`, `find_by_store_iter`, `update_with_unset`.
- `backend/repositories/base_repository.py` – ajout de `find_iter`, paramètre `ordered` sur `insert_many`.
- `backend/repositories/gerant_invitation_repository.py` – ajout de `find_by_gerant_iter`.
- `backend/services/seller_service.py` – 4 blocs utilisant `user_repo` + suppression des `limit=1000`.
- `backend/services/gerant_service.py` – tous les accès `.collection` et `limit=1000` concernés.
- `backend/services/enterprise_service.py` – tous les accès `.collection` remplacés par des méthodes de repository.
