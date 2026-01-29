# Bloc 4 – Harmonisation et Nettoyage final

## 1. Unification des exceptions (Audit 2.2)

- **`exceptions/custom_exceptions.py`** ne faisait que réexporter `core.exceptions`. Tous les imports ont été migrés vers `core.exceptions` dans :
  - `api/routes/admin.py`
  - `api/routes/sales_evaluations.py`
  - `api/routes/legacy.py`
  - `services/auth_service.py`
  - `services/seller_service.py`
  - `services/competence_service.py`
  - `utils/pagination.py`
- **Fichier supprimé** : `exceptions/custom_exceptions.py`

## 2. Vérification double fetch (Audit 2.5)

- Dans **`core/security.py`**, `verify_seller_store_access` (branche gérant) a été revue : un seul appel à `manager_service.get_user_by_id` pour le vendeur ; pas de second `find_one`. Le vendeur est réutilisé pour `store_id` et pour le `return`.

## 3. Code mort et commentaires debug (Audit 5)

- **`api/routes/manager.py`** : suppression des logs de debug (`# ⭐ LOG POUR DEBUG`, `# ⭐ LOG : Afficher le nom du magasin...`) et des `logger.info` associés dans `save_manager_kpi` ; conservation d’un `logger.error` en cas de magasin non trouvé.
- **`api/routes/sellers.py`** : suppression de « Log for debugging » et des `logger.info` correspondants sur les KPI entries ; suppression de « Log the responses for debugging » et du `logger.debug` dans la validation du diagnostic.
- **`api/routes/sellers.py`** : correction d’indentation et de structure (`update_seller_objective_progress`, `get_seller_kpi_config`, `get_my_diagnostic_live_scores`, `_create_diagnostic_impl`, `refresh_daily_challenge`) – try orphelins supprimés, blocs désindentés, `elif`/`else` alignés.

## 4. Vérification globale – services pour les droits, pas de db directe

- **Routes** : Aucun accès direct à `db.users`, `db.stores`, etc. dans `api/routes`. Aucun `Depends(get_db)` ni usage de `user_repo` / `store_repo` dans les handlers.
- **Droits** : Les routes utilisent `verify_resource_store_access`, `verify_seller_store_access`, `verify_store_access_for_user` avec **ManagerService** / **StoreService** (Bloc 2).  
- **Résidus** : Deux appels à `verify_resource_store_access` passaient encore `user_role` et `user_id` (delete objective, delete challenge) : supprimés.  
- **Import inutile** : `verify_resource_store_access` retiré de `api/routes/sellers.py` (non utilisé).

## Fichiers modifiés

- `api/routes/admin.py`, `api/routes/sales_evaluations.py`, `api/routes/legacy.py`
- `api/routes/manager.py`, `api/routes/sellers.py`
- `services/auth_service.py`, `services/seller_service.py`, `services/competence_service.py`
- `utils/pagination.py`

## Fichier supprimé

- `exceptions/custom_exceptions.py`
