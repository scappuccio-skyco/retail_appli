# Bloc 1 – Nettoyage des exceptions et middleware

## Réalisé

### 1. Gestion des erreurs unifiée (FastAPI handlers uniquement)
- **`main.py`** : 
  - Handlers FastAPI pour `AppException` et `Exception` (log + 500 pour les inattendues).
  - **Suppression** de l’enregistrement de `ErrorHandlerMiddleware`.
- **`api/middleware/error_handler.py`** : Marqué **DEPRECATED** (plus utilisé). Conservé pour référence.

### 2. KPI – « logiciel de caisse » et exceptions
- **`services/kpi_service.py`** : En cas de KPI verrouillé (API), levée de `ForbiddenError` au lieu de `Exception`.
- **`api/routes/kpis.py`** : 
  - Suppression de tous les `try` / `except Exception` et du test `"logiciel de caisse" in str(e)`.
  - Les routes laissent remonter les exceptions (dont `ForbiddenError`).

### 3. Routes sans `except Exception` générique
- **`auth.py`** : `register_gerant`, `register_with_invitation`, `reset_password` – plus de catch générique. Email de bienvenue reste dans un `try` / `except` dédié (log uniquement).
- **`stores.py`** : `create_store`, `get_my_stores`, `get_store_hierarchy`, `get_store_info` – idem.
- **`onboarding.py`** : `get_progress`, `save_progress`, `mark_complete` – idem.
- **`ai.py`** : `generate_diagnostic`, `generate_daily_challenge`, `generate_seller_bilan` – idem.
- **`diagnostics.py`** : `create_manager_diagnostic`, `get_my_diagnostic` – idem.
- **`debriefs.py`** : `create_debrief`, `toggle_debrief_visibility` – idem. Conservation du `except ValueError → BusinessLogicError` pour `create_debrief`, et du `except Exception` (log) pour l’IA.
- **`gerant.py`** : `get_store_sellers`, `get_store_kpi_overview` – idem. Checkout : on garde un `except` pour les `AppException` puis `except Exception` log + raise.

### 4. Manager – API keys et autres routes
- **API keys** : `create_api_key`, `list_api_keys` sans try/except. `deactivate` / `regenerate` gardent `except ValueError → NotFoundError`. `delete_permanent` garde `ValueError` et `PermissionError`, suppression du `except Exception`.
- **Autres routes manager** : suppression du `try` orphelin pour `store-kpi-overview`, `get_invitations`, `get_team_bilans`, `store-kpi/stats`, `objectives/active`, `challenges/active`, `get_all_objectives`. Pour `create_objective`, ajout d’un `except Exception: raise` pour corriger la syntaxe (try sans except).

## Reste à faire (suite du Bloc 1)

### `manager.py` – try sans except
Plusieurs routes ont encore un `try` sans `except` ni `finally`, ce qui provoque des `SyntaxError` (ex. vers 1700 avant `@router.post("/challenges")`, et d’autres).

**Action recommandée** : pour chaque route concernée, soit :
1. **Supprimer** le `try` et désindenter le corps (comme pour `get_all_objectives`), **ou**
2. **Ajouter** `except Exception: raise` pour rétablir la syntaxe, puis prévoir un refactor ultérieur pour supprimer ces blocs.

Pour les trouver rapidement :
```bash
cd backend
python -m py_compile api/routes/manager.py
# Corriger la route indiquée (avant le @router qui apparaît dans l’erreur), puis relancer.
```

### Autres routes non traitées dans ce bloc
- **`enterprise.py`**, **`integrations.py`**, **`support.py`**, **`docs.py`**, **`early_access.py`**, **`legacy.py`** : il reste des `except Exception as e: raise ...`. À traiter au même titre que les autres routes (suppression du catch générique, remontée des exceptions métier).

## Vérifications

- **Syntaxe** : `python -m py_compile` sur les fichiers modifiés (hors `manager.py` complet tant que les try orphelins restent).
- **Lancement** : démarrer l’app (ex. `uvicorn` depuis `backend`) et enchaîner des requêtes (auth, KPI, stores, etc.) pour valider le comportement.
- **Logs** : en cas d’erreur inattendue, vérifier que le handler `Exception` log bien traceback + contexte et renvoie 500 propre.

## Fichiers modifiés

- `backend/main.py`
- `backend/api/middleware/error_handler.py`
- `backend/services/kpi_service.py`
- `backend/api/routes/kpis.py`
- `backend/api/routes/auth.py`
- `backend/api/routes/stores.py`
- `backend/api/routes/onboarding.py`
- `backend/api/routes/ai.py`
- `backend/api/routes/diagnostics.py`
- `backend/api/routes/debriefs.py`
- `backend/api/routes/gerant.py`
- `backend/api/routes/manager.py` (partiel – voir ci‑dessus)
