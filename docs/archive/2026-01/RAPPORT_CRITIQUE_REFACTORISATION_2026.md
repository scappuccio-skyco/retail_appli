# Rapport critique – Refactorisation Backend (Janvier 2026)

**Rôle :** Développeur Senior / Architecte Logiciel  
**Périmètre :** Backend FastAPI (repositories, services, routes, core)  
**Objectif :** Identifier anti-patterns, redondances et risques de scalabilité (ex. 1000 utilisateurs), sans ajout de fonctionnalités.

---

## Synthèse exécutive

| Catégorie | Constat | Risque |
|-----------|---------|--------|
| **Anti-patterns** | HTTPException(500) massif (~180 en routes actives), `except Exception` partout (418), **routes qui instancient des repositories** (187 occurrences), **services qui gardent `self.db`** et créent des repos en interne, AdminRepository accès direct à `self.db` pour plusieurs collections | Dette technique, couplage fort, maintenance difficile |
| **Redondances** | Pattern try/except/500 répété, listes sans pagination (admin, integration_repository), vérifications d’accès dupliquées selon les routes | Code dupliqué ~30 %, évolution coûteuse |
| **Scalabilité** | Peu de routes avec rate limit (~5 avec `rate_limit` ou `@limiter.limit`) ; listes `.to_list(1000)` en admin ; Redis optionnel ; agrégations limit 10000 (et `max_results=None` possible dans BaseRepository) | À 1000 users : charge DB, troncature données, pas de protection DDoS par route |

**Points positifs déjà en place :** Services n’accèdent pas à `self.db` (architecture respectée). Repositories admin sont importés en tête de `dependencies.py`. `BaseRepository` n’invalide plus le cache (délégation au service). Pool MongoDB 50, timeouts configurés. Exceptions métier et middleware d’erreur existants.

---

## 1. Anti-patterns identifiés

### 1.1 Gestion d’erreurs incohérente : HTTPException(500) dans les routes

**Constat :** **~180** occurrences de `raise HTTPException(status_code=500, ...)` dans les routes actives (17 fichiers, hors `_archived_legacy`). Vérification code : sellers.py (28), gerant.py (12), enterprise.py (10), etc.

Fichiers les plus impactés :
- `api/routes/sellers.py` : 38
- `api/routes/manager.py` : 14
- `api/routes/admin.py` : 18
- `api/routes/gerant.py` : 13
- `api/routes/enterprise.py` : 10

**Problèmes :**
- Double mécanisme : HTTPException dans les routes **et** ErrorHandlerMiddleware.
- Messages souvent construits à la main (`str(e)`) → risque de fuite d’informations.
- Logging et format de réponse non uniformes.

**Recommandation :** Remplacer systématiquement par des exceptions métier (`NotFoundError`, `ValidationError`, `ForbiddenError`, etc.) et laisser le middleware les convertir en HTTP. Ne garder HTTPException que pour des cas très ponctuels et documentés.

---

### 1.2 Capture trop large : `except Exception`

**Constat :** **418** occurrences de `except Exception` dans le backend (54 fichiers, hors scripts/tests).

**Problèmes :**
- Capture d’erreurs de programmation (KeyError, AttributeError, etc.) et conversion en 500 générique.
- Le middleware ne voit pas l’exception réelle → logging et débogage dégradés.
- Pattern typique : `except Exception as e: logger.error(...); raise HTTPException(500, str(e))` → doublon avec le middleware.

**Recommandation :**
- Capturer **uniquement** les exceptions métier attendues.
- Pour les erreurs inattendues : ne pas les attraper dans les routes ; laisser remonter jusqu’au ErrorHandlerMiddleware.
- Dans les services : lever des `AppException` (ou sous-classes) au lieu de retourner None ou de re-raise après log.

---

### 1.3 Print en production (routes et services)

**Constat :** Des `print()` subsistent dans du code exécuté en requêtes :

- `api/routes/evaluations.py` : `print(f"⚠️ Erreur récupération profil DISC pour {user_id}: {e}")`
- `api/routes/diagnostics.py` : `print(f"Error in AI analysis: {str(e)}")`
- `api/routes/debriefs.py` : `print(f"AI debrief error: {e}")`
- `api/routes/sellers.py` : `print(f"AI bilan error: {e}")`, `print(f"AI diagnostic error: {e}")`

**Problèmes :**
- En production, les logs doivent passer par `logging` (niveaux, handlers, format).
- Les `print` encombrent stdout et ne sont pas filtrables.

**Recommandation :** Remplacer tous ces `print` par `logger.warning` / `logger.error` avec le contexte approprié. Les scripts CLI (`ensure_indexes.py`, etc.) peuvent garder des `print` si documentés comme tels.

---

### 1.4 AdminRepository hors pattern BaseRepository

**Fichier :** `repositories/admin_repository.py`

- N’hérite pas de `BaseRepository`.
- Accès direct à `self.db` avec `.to_list(1000)` / `.to_list(100)` en dur.
- Méthodes comme `get_all_workspaces()`, `get_stores_by_gerant()`, `get_sellers_for_store()` sans pagination (sauf `get_all_workspaces_paginated`).

**Problèmes :**
- Pas de limite centralisée ni cohérence avec le reste du data layer.
- Avec 1000+ workspaces/stores/sellers, données tronquées sans que l’appelant le sache.

**Recommandation :** Soit faire déléguer AdminRepository à des repositories par collection (WorkspaceRepository, UserRepository, StoreRepository) avec méthodes paginées ; soit faire hériter d’une base multi-collection documentée et n’exposer que des API paginées pour les listes.

---

### 1.5 Listes sans pagination et limites fixes

**Fichiers concernés (hors legacy / scripts) :**

- `admin_repository.py` : `get_all_workspaces()` → `.to_list(1000)` ; `get_stores_by_gerant`, `get_sellers_for_store` → `.to_list(100)`.
- `core/database.py` : `users = await db.users.find().to_list(100)` (contexte à vérifier).
- `repositories/integration_repository.py` : `.to_list(100)` et `.to_list(10)`.

**Recommandation :** Pour toute liste potentiellement longue (admin, intégrations), utiliser `utils.pagination.paginate` ou `paginate_with_params` avec `PaginationParams` en query, et exposer `total` / `page` / `pages`.

---

### 1.6 Duplication fonctionnelle : IntegrationService vs APIKeyService

- **IntegrationService** (routes `integrations.py`) : clés API, sync KPI, stores, etc.
- **APIKeyService** (dans `manager_service.py`, routes `manager.py`) : création / liste / suppression de clés API pour les managers.

Deux chemins pour des concepts proches (clés API / intégrations), avec risque de divergence des règles métier.

**Recommandation :** Clarifier le périmètre (entreprise vs manager) dans la doc ; si les modèles et règles sont les mêmes, unifier derrière un seul service avec routes différenciées par rôle. Sinon, documenter explicitement la séparation (ex. « API keys entreprise » vs « API keys manager »).

---

### 1.7 Routes qui instancient des repositories (violation de l’architecture)

**Constat :** **187** occurrences de `Repository(db)` ou équivalent dans les routes (13 fichiers : sellers.py, gerant.py, manager.py, briefs.py, evaluations.py, integrations.py, debriefs.py, diagnostics.py, etc.).

**Problèmes :**
- L’architecture cible est Routes → Services → Repositories. Les routes ne devraient pas créer de repositories ; elles doivent utiliser des services injectés via `Depends(get_xxx_service)`.
- Logique métier et accès données se retrouvent dans les handlers (ex. `get_seller_subscription_status` dans sellers.py construit UserRepository, WorkspaceRepository, et enchaîne les appels).
- Testabilité et cohérence dégradées : chaque route recrée des dépendances au lieu de les recevoir.

**Recommandation :** Déplacer toute logique métier et accès données vers les services. Exposer des méthodes de service (ex. `get_seller_subscription_status(gerant_id)`) et injecter les services dans les routes. Les routes ne doivent garder que validation des entrées, appel au service, et retour de la réponse.

---

### 1.8 Services qui gardent `self.db` et créent des repos en interne

**Constat :** Plusieurs services conservent `self.db` et instancient des repositories à la volée au lieu de les recevoir par injection :

- `gerant_service.py` : `self.db` + création de `KPIRepository(self.db)`, `ManagerKPIRepository(self.db)` dans une méthode.
- `seller_service.py` : `self.db` + création de `KPIRepository(self.db)`, `ManagerKPIRepository(self.db)`.
- `manager_service.py` : `self.db` + création de `NotificationService(self.db)`.
- `store_service.py`, `enterprise_service.py`, `integration_service.py`, `competence_service.py` : gardent `self.db`.

**Problèmes :**
- Couplage fort à la base et aux implémentations concrètes des repos.
- Difficile de mocker les repositories dans les tests unitaires.
- Incohérence avec la règle « Services ne doivent jamais accéder à self.db » (`.cursorrules`).

**Recommandation :** Injecter tous les repositories (et services métier utilisés) dans le constructeur des services via `dependencies.py`. Supprimer `self.db` des services ; les repositories reçoivent `db` via leur propre injection.

---

### 1.9 AdminRepository : accès direct à `self.db` et `except` nus

**Constat :** Dans `admin_repository.py`, les méthodes `count_diagnostics`, `count_relationship_consultations`, `get_system_logs`, `get_admin_logs`, `get_admin_actions`, `get_admins_from_logs` utilisent directement `self.db.<collection>` (diagnostics, relationship_consultations, system_logs, logs, admin_logs). Les blocs `except:` sans type (lignes ~166, ~184) avalent toute exception.

**Problèmes :** Incohérence avec le pattern BaseRepository pour les collections sans repo dédié ; risque de masquer des erreurs (KeyError, AttributeError, etc.).

**Recommandation :** Soit créer des repositories légers pour ces collections (avec héritage BaseRepository), soit documenter l’exception et utiliser `except Exception` avec log et re-raise ou retour contrôlé. Éviter `except:` nu.

---

### 1.10 Bug critique : StoreService mal assemblé dans dependencies.py

**Constat :** Dans `api/dependencies.py`, `get_store_service(db)` retourne `StoreService(db)`. Or `StoreService.__init__` attend **trois** arguments : `(store_repo, workspace_repo, user_repo)` — et non une instance de base de données. Passer `db` provoque un `TypeError: StoreService.__init__() missing 2 required positional arguments` dès qu'une route utilise `Depends(get_store_service)` (ex. stores, briefs, evaluations, integrations, support).

**Recommandation :** Corriger immédiatement dans `dependencies.py` en assemblant les repos : `return StoreService(store_repo=StoreRepository(db), workspace_repo=WorkspaceRepository(db), user_repo=UserRepository(db))`.

---

### 1.11 core/security.py : HTTPException au lieu d'exceptions métier

**Constat :** Dans `core/security.py`, `decode_token()` et les dépendances d'auth lèvent `HTTPException(401)` / `HTTPException(403)` au lieu de `UnauthorizedError` et `ForbiddenError`. Le projet impose d'utiliser les exceptions custom et de laisser le middleware les convertir en HTTP.

**Recommandation :** Remplacer dans `core/security.py` les `raise HTTPException(status_code=401, ...)` par `raise UnauthorizedError(...)` et les `raise HTTPException(status_code=403, ...)` par `raise ForbiddenError(...)`.

---

## 2. Redondances

### 2.1 Pattern « try / except Exception / HTTPException(500) » répété

La même séquence apparaît dans de nombreuses routes :

```python
try:
    result = await service.do_something(...)
    return result
except Exception as e:
    logger.error(...)
    raise HTTPException(status_code=500, detail=str(e))
```

**Recommandation :**
- Ne pas attraper `Exception` dans les routes.
- Les services doivent lever des `AppException` (ou sous-classes).
- Le middleware gère le reste (logging + 500 propre).
- Réduire les blocs try/except aux seuls cas où une conversion explicite en erreur métier est nécessaire.

---

### 2.2 Vérifications d’accès et RBAC éparpillées

- `core/security.py` : `verify_seller_store_access`, `verify_resource_store_access`, `verify_store_ownership` (centralisés).
- Routes : `verify_invitation_token`, `verify_reset_token` (auth), `verify_api_key`, `verify_store_access` (integrations), `verify_api_key_header`, `verify_it_admin` (enterprise), `verify_gerant_invitation_legacy` (legacy), `verify_access` (evaluations).

**Recommandation :** Centraliser dans `core/security.py` tout ce qui est réutilisable (ex. `verify_api_key`, `verify_store_access`) et les exposer via `Depends(...)` pour éviter la duplication et les écarts de logique. Documenter les cas legacy spécifiques.

---

### 2.3 Listes sans pagination (déjà cité en 1.5)

- Admin : `get_all_workspaces()`, `get_stores_by_gerant`, `get_sellers_for_store`, etc.
- Autres endroits utilisent encore des `.to_list(N)` fixes au lieu de `paginate()` / `paginate_with_params()`.

**Recommandation :** Étendre la pagination à toutes les listes « admin » ou potentiellement longues (workspaces, users par workspace, stores, sellers), avec taille de page raisonnable (50–100) et métadonnées `total` / `pages`.

---

### 2.4 Duplication des dépendances d’auth (core/security.py)

**Constat :** `get_current_gerant`, `get_current_manager`, `get_current_seller`, `get_super_admin`, `get_gerant_or_manager` répètent le même flux : extraction du token → `user_id` → `db.users.find_one` → vérification du rôle → `_attach_space_context`. Seul le rôle autorisé change. De plus, `get_current_user` utilise le cache ; les autres refont systématiquement un `db.users.find_one` sans cache.

**Problèmes :** ~150 lignes dupliquées, maintenance coûteuse, risque d’écart de logique (ex. cache pour `get_current_user` mais pas pour les autres). En montée en charge, chaque requête protégée par rôle refait un accès DB.

**Recommandation :** Factoriser en une dépendance interne `_get_current_user_by_id(user_id, db)` (ou réutiliser le cache) puis une factory `require_roles(*allowed_roles)` qui appelle `get_current_user` et vérifie `current_user["role"] in allowed_roles`. Réutiliser le cache utilisateur pour toutes les dépendances d’auth.

---

## 3. Problèmes de scalabilité (ex. 1000 utilisateurs)

### 3.1 Rate limiting très partiel

- Nombreux handlers de routes ; seulement **~5** usages de rate limiter (`rate_limit(...)` ou `@limiter.limit`) : `ai.py` (diagnostic, seller-bilan), `briefs.py` (morning), `manager.py` (kpi-entries, seller stats, et un décorateur @limiter.limit).

**Risque :** Sans rate limit sur la majorité des routes, un acteur malveillant ou un client bugué peut saturer l’API et la base.

**Recommandation :** Appliquer un rate limit par défaut (ex. 100/min lecture, 20/min écriture) au niveau de l’app ou du routeur, et des limites plus strictes sur les endpoints coûteux (IA, exports, admin).

---

### 3.2 Admin : listes non paginées et limites fixes

- `get_all_workspaces()` : plafond 1000 documents. Au-delà, données tronquées sans que l’appelant le sache.
- Aucun curseur ni token de pagination pour parcourir toute la base côté admin.

**Risque :** Avec un grand nombre de workspaces/stores/users, les écrans admin seront incomplets ou trompeurs.

**Recommandation :** Pagination obligatoire pour toutes les listes admin (workspaces, users, stores, etc.) avec taille de page 50–100 et métadonnées `total` / `pages`. Privilégier `get_all_workspaces_paginated` et équivalents pour les nouveaux usages.

---

### 3.3 Pool MongoDB et N+1

- Pool configuré (50), timeouts présents : **bon**.
- Si des routes ou services enchaînent beaucoup de requêtes (N+1, boucles sur des ids), le nombre de connexions et le temps de réponse peuvent exploser avec 1000 utilisateurs concurrents.

**Recommandation :** Vérifier les endpoints les plus utilisés (dashboard, listes, exports) pour éviter les N+1 (agrégations, `find({ "id": { "$in": ids } })`, etc.). S’appuyer sur les scripts `ensure_indexes` / `verify_indexes` pour les index.

---

### 3.4 Cache Redis optionnel

- Si Redis est désactivé ou indisponible, tout passe par MongoDB.
- Avec 1000 utilisateurs, les accès répétés (user, workspace, store) peuvent fortement charger la base.

**Recommandation :** Pour la production à grande échelle, traiter Redis comme partie du design (sessions, cache user/workspace/store). Documenter le comportement si Redis est down (latence, charge DB) et prévoir monitoring + alertes.

---

### 3.5 Agrégations et limite 10000 (BaseRepository)

- `BaseRepository.aggregate(pipeline, max_results=10000)` limite à 10 000 documents.
- Pour des rapports ou exports sur de gros volumes, les résultats seront tronqués sans pagination.

**Recommandation :** Pour les agrégations qui peuvent renvoyer beaucoup de lignes, exposer une API paginée (skip/limit ou cursor) et documenter la limite. Éviter `max_results=None` sans contrôle explicite.

---

## 4. Plan de refactorisation proposé

### Phase 0 – Architecture (2–3 semaines)

| Priorité | Action | Fichiers / zones |
|----------|--------|-------------------|
| **P0** | **Corriger le bug StoreService** : `get_store_service` doit assembler `StoreRepository`, `WorkspaceRepository`, `UserRepository` et les passer à `StoreService` (et non `StoreService(db)`). | `api/dependencies.py` |
| **P0** | Routes : ne plus instancier de repositories dans les handlers ; déplacer la logique vers les services et injecter les services via `Depends(get_xxx_service)` | Toutes les routes (sellers, gerant, manager, briefs, evaluations, integrations, debriefs, diagnostics, etc.) |
| **P0** | Services : supprimer `self.db` ; injecter tous les repositories (et services utilisés) dans le constructeur via `dependencies.py` | `gerant_service.py`, `seller_service.py`, `manager_service.py`, `store_service.py`, `enterprise_service.py`, `integration_service.py`, `competence_service.py` |
| **P1** | Remplacer `HTTPException(401/403)` par `UnauthorizedError` / `ForbiddenError` dans `core/security.py` | `core/security.py` |
| **P2** | Factoriser les dépendances d’auth (`get_current_gerant`, `get_current_manager`, etc.) autour de `get_current_user` + `require_roles(*)` et réutiliser le cache | `core/security.py` |

### Phase 1 – Quick wins (1–2 semaines)

| Priorité | Action | Fichiers / zones |
|----------|--------|-------------------|
| **P0** | Remplacer les `print` par `logging` dans services/scripts si restants (vérification : aucun `print` dans les routes actuellement) | Services, scripts CLI |
| **P0** | Aligner AdminRepository : pagination pour toutes les listes, remplacer `except:` nu par `except Exception` avec log, et/ou créer des repos pour diagnostics/admin_logs | `admin_repository.py`, routes admin |
| **P1** | Étendre la pagination aux listes admin et integration (workspaces, stores, sellers, etc.) | `admin_repository.py`, `integration_repository.py`, routes concernées |

### Phase 2 – Gestion d’erreurs (2–3 semaines)

| Priorité | Action | Fichiers / zones |
|----------|--------|-------------------|
| **P0** | Remplacer `raise HTTPException(500, ...)` par des exceptions métier (`NotFoundError`, `ValidationError`, etc.) dans les routes et services | Toutes les routes (sellers, manager, admin, gerant, enterprise, etc.) |
| **P1** | Réduire les `except Exception` : ne capturer que les exceptions métier ; laisser le reste au middleware | Routes + services |
| **P2** | Documenter dans `.cursorrules` ou un doc « Error handling » : quand utiliser quelle exception, ne plus utiliser HTTPException 500 dans les handlers | Documentation projet |

### Phase 3 – Réduction des redondances (2 semaines)

| Priorité | Action | Fichiers / zones |
|----------|--------|-------------------|
| **P1** | Centraliser les `verify_*` réutilisables dans `core/security.py` (ex. `verify_api_key`, `verify_store_access`) et les exposer via `Depends` | `core/security.py`, `integrations.py`, `enterprise.py`, `evaluations.py` |
| **P2** | Clarifier ou unifier IntegrationService vs APIKeyService (documentation + éventuellement fusion partielle) | `services/`, `api/routes/integrations.py`, `api/routes/manager.py` |

### Phase 4 – Scalabilité et résilience (3–4 semaines)

| Priorité | Action | Fichiers / zones |
|----------|--------|-------------------|
| **P1** | Étendre le rate limiting à tous les routeurs (défaut global ou par routeur) + limites renforcées sur IA / admin / exports | `main.py`, `api/dependencies_rate_limiting.py`, routes |
| **P2** | Vérifier les endpoints à fort trafic (dashboard, listes, sync) pour N+1 et ajouter index si besoin | Services (gerant, manager, seller), scripts `ensure_indexes` |
| **P2** | Documenter le rôle de Redis pour la prod (scalabilité, comportement si indisponible) | Documentation, `core/cache.py` |
| **P3** | Pour les agrégations à gros volume : API paginée ou limite documentée | `BaseRepository.aggregate`, services qui l’utilisent |

### Phase 5 – Qualité et dette technique (continu)

| Priorité | Action |
|----------|--------|
| P2 | Étendre la pagination à toutes les listes qui dépassent une taille raisonnable (ex. 100 items). |
| P3 | Tests unitaires pour les exceptions métier et les repositories critiques. |
| P3 | Réviser les agrégations qui peuvent dépasser 10k documents : soit pagination, soit limite documentée et assumée. |

---

## 5. Synthèse

- **Anti-patterns les plus bloquants :** **bug StoreService** (get_store_service(db) → StoreService(db) alors que le service attend 3 repos — corrigé dans dependencies.py), gestion d’erreurs mélangeant HTTPException 500 et middleware, capture `except Exception` généralisée, routes qui instancient des repositories (187), services qui gardent `self.db`, AdminRepository accès direct à `self.db` et `except:` nus, listes non paginées, HTTPException dans core/security au lieu d’exceptions métier.
- **Redondances les plus coûteuses :** pattern try/except/500 répété, vérifications d’accès éparpillées, listes sans pagination, **duplication des dépendances d’auth** (get_current_gerant, get_current_manager, etc. ~150 lignes, sans réutilisation du cache).
- **Scalabilité :** les risques principaux pour « 1000 utilisateurs » sont la **quasi-absence de rate limiting** (~5 routes protégées), les **listes admin non paginées / limites fixes (.to_list(1000))** et, à moindre degré, l’**absence de cache Redis** et les **N+1** et **BaseRepository.aggregate(max_results=None)** (risque OOM).

En priorisant la **Phase 0 (architecture)** — dont la correction StoreService est déjà appliquée — puis les **Phases 1 et 2**, vous rétablissez Routes → Services → Repositories et corrigez les anti-patterns les plus bloquants (erreurs, pagination, logging). Les phases 3 à 5 peuvent être étalées en fonction de la charge réelle et des objectifs de montée en charge.

---

*Rapport généré le 28 Janvier 2026 – Analyse du code actuel (backend), sans ajout de fonctionnalités.*
