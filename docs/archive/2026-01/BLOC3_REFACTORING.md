# Bloc 3 – Scalabilité et Performance

## 1. Centralisation des index (Audit 2.6 & 3.1)

- **`core/indexes.py`** créé :
  - Structure `INDEXES: Dict[str, List[IndexSpec]]` par collection.
  - Chaque entrée : `{"keys": str | List, "kwargs": {...}}` (background, unique, sparse, name, etc.).
  - **Index ajoutés** : `users.id` (unique), `workspaces.id` (unique), `workspaces.gerant_id`.
  - Fonction `apply_indexes(db, *, logger)` qui applique tous les index et retourne `(created, skipped, errors)`.

## 2. Unification lifespan + ensure_indexes (Audit 2.6)

- **`core/lifespan.py`** : supprime les définitions d’index en dur. Appelle `core.indexes.apply_indexes` dans `_create_indexes_background`.
- **`scripts/ensure_indexes.py`** : réécrit pour utiliser `core.indexes.apply_indexes` et afficher le résumé (créés / ignorés / erreurs). Suppression des définitions dupliquées.

## 3. Async init_database (Audit 1.7)

- Dans `_create_indexes_background`, `init_database` est exécutée via **`asyncio.to_thread(init_database)`** pour ne pas bloquer l’event loop.

## 4. Rate limiting global avec Redis (Audit 1.6 & 3.3)

- **`main.py`** : le `Limiter` slowapi est configuré avec `storage_uri=settings.REDIS_URL` lorsque `REDIS_URL` est défini. Le rate limiting est ainsi partagé entre workers en production.

## 5. Nettoyage Limiter (Audit 2.1)

- **`core/rate_limiting.py`** :
  - Import slowapi (ou fallbacks Limiter, `get_remote_address`, `RateLimitExceeded`, `SlowAPIMiddleware`).
  - `get_remote_address` (réel ou `"unknown"` si slowapi absent).
  - `get_dummy_limiter()` (no-op).
  - `rate_limit_exceeded_handler`, `init_rate_limiter`, `init_global_limiter`, `get_rate_limiter`.
- **`api/dependencies_rate_limiting.py`** : importe tout depuis `core.rate_limiting` (plus de doublon).
- **`core/startup_helpers.py`** : importe `get_remote_address`, `get_dummy_limiter`, etc. depuis `core.rate_limiting` ; conserve uniquement `get_allowed_origins` en propre.

## Fichiers modifiés / créés

- **Créé** : `backend/core/indexes.py`
- **Modifié** : `backend/core/lifespan.py`, `backend/scripts/ensure_indexes.py`, `backend/main.py`, `backend/core/rate_limiting.py`, `backend/core/startup_helpers.py`, `backend/api/dependencies_rate_limiting.py`

## Notes

- `ensure_indexes` : exécuter avec `python -m backend.scripts.ensure_indexes` ou `python backend/scripts/ensure_indexes.py` (environnement backend avec dépendances installées).
- Redis : si `REDIS_URL` n’est pas configuré, le limiter reste en stockage mémoire (comportement par défaut slowapi).
