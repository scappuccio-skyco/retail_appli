# Rapport d’audit critique – Refactorisation Backend

**Rôle :** Développeur Senior / Architecte Logiciel  
**Périmètre :** Backend FastAPI (repositories, services, routes, core)  
**Objectif :** Identifier anti-patterns, redondances et risques de scalabilité (ex. 1000 utilisateurs), sans ajout de fonctionnalités.

---

## 1. Anti-patterns identifiés

### 1.1 Classes définies dans une factory (dependencies.py)

**Fichier :** `backend/api/dependencies.py` (lignes 318–336)

Dans `get_admin_service()`, cinq classes de repository sont **définies à l’intérieur de la fonction** :

- `PaymentTransactionRepository`
- `StripeEventRepository`
- `AIConversationRepository`
- `AIMessageRepository`
- `AIUsageLogRepository`

**Problèmes :**

- Impossible à unit-tester ou à réutiliser ailleurs.
- Recréées à chaque résolution de dépendance (à chaque requête admin).
- Violation du principe Open/Closed et de la séparation des responsabilités.

**Recommandation :** Extraire ces classes dans des modules dédiés sous `repositories/` (ex. `payment_transaction_repository.py`, etc.) et les injecter via des factories `get_*_repository` comme pour les autres repositories.

---

### 1.2 Repository sans héritage de BaseRepository (AdminRepository)

**Fichier :** `backend/repositories/admin_repository.py`

`AdminRepository` n’hérite pas de `BaseRepository` et accède directement à `self.db` avec des appels du type :

- `self.db.workspaces.find(...).to_list(1000)`
- `self.db.users.find(...).to_list(100)`

**Problèmes :**

- Pas de limite centralisée (BaseRepository impose limit ≤ 1000 et pagination).
- Pas d’invalidation de cache (BaseRepository gère users/stores/workspaces).
- Duplication de la logique CRUD et incohérence avec le reste du data layer.

**Recommandation :** Faire hériter `AdminRepository` de `BaseRepository` pour les opérations sur une collection, ou déléguer à des repositories par collection (WorkspaceRepository, UserRepository, etc.) et n’utiliser que des méthodes paginées pour les listes.

---

### 1.3 Gestion d’erreurs incohérente (HTTPException 500 dans les routes)

**Constat :** Environ **287** occurrences de `raise HTTPException(status_code=500, detail=...)` dans les routes (gerant, manager, admin, integrations, etc.), alors que :

- Un **ErrorHandlerMiddleware** existe et gère déjà `AppException` et les exceptions non gérées.
- Des exceptions métier existent : `NotFoundError`, `ValidationError`, `UnauthorizedError`, etc.

**Problèmes :**

- Double mécanisme (HTTPException dans les routes vs middleware).
- Messages d’erreur souvent construits à la main (`str(e)`), risque de fuite d’infos.
- Logging et format de réponse non uniformes.

**Recommandation :** Dans les routes et services, remplacer systématiquement `raise HTTPException(500, ...)` par des exceptions métier (`NotFoundError`, `ValidationError`, etc.) et laisser le middleware les convertir en HTTP. Ne garder HTTPException que pour des cas très ponctuels et documentés.

---

### 1.4 Capture trop large : `except Exception`

**Constat :** Plus de **532** occurrences de `except Exception` dans le backend.

**Problèmes :**

- Capture d’erreurs de programmation (KeyError, AttributeError, etc.) et conversion en message générique ou 500.
- Empêche le middleware de voir l’exception réelle et de la logger correctement.
- Dans beaucoup de routes : `except Exception as e: raise HTTPException(500, str(e))` → doublon avec le middleware et message potentiellement exposé.

**Recommandation :**  
- Capturer uniquement les exceptions métier attendues.  
- Pour les erreurs inattendues : ne pas les attraper dans les routes ; laisser remonter jusqu’au ErrorHandlerMiddleware.  
- Dans les services, lever des `AppException` (ou sous-classes) au lieu de retourner None ou de logger puis re-raise.

---

### 1.5 Couplage fort BaseRepository ↔ Cache

**Fichier :** `backend/repositories/base_repository.py`

Les méthodes `update_one`, `update_many`, `delete_one` appellent `_invalidate_cache_for_update` / `_invalidate_cache_for_update_many`, qui contiennent une **liste en dur** de noms de collections :

- `users` → `invalidate_user_cache`
- `stores` → `invalidate_store_cache`
- `workspaces` → `invalidate_workspace_cache`

**Problèmes :**

- Toute nouvelle collection à invalider impose de modifier BaseRepository (violation Open/Closed).
- Le repository connaît le détail du cache (responsabilité mélangée).
- En cas d’échec d’invalidation, l’exception est avalée (logging uniquement) → risque de cache stale.

**Recommandation :**  
- Soit : stratégie d’invalidation par type (interface ou callback injecté par collection).  
- Soit : déplacer l’invalidation dans une couche au-dessus (services ou “domain events”) après un update/delete, sans que BaseRepository ne dépende du cache.

---

### 1.6 Print de debug en production

**Fichiers concernés :**

- `backend/core/database.py` : `print("[DATABASE_MODULE] Loading...")`, `print("[DATABASE] Connecting...")`, etc.
- `backend/api/routes/manager.py` : `print(f"[MANAGER ROUTER] Router initialized...")`
- `backend/api/routes/__init__.py` : plusieurs `print` sur le chargement des routers

**Problèmes :**

- En production, les logs devraient passer par `logging` (niveaux, handlers, format).
- Les `print` ne sont pas filtrés par niveau et encombrent stdout.

**Recommandation :** Remplacer tous ces `print` par `logger.info` / `logger.debug` et supprimer les prints de démarrage non essentiels.

---

### 1.7 Duplication fonctionnelle : IntegrationService vs APIKeyService

**Constat :**

- **IntegrationService** (routes `integrations.py`) : clés API, sync KPI, stores, etc.
- **APIKeyService** (dans `manager_service.py`, routes `manager.py`) : création / liste / suppression de clés API pour les managers.

Deux chemins pour des concepts proches (clés API / intégrations), avec possible chevauchement et divergence de règles métier.

**Recommandation :** Clarifier le périmètre (entreprise vs manager) et, si les modèles et règles sont les mêmes, unifier derrière un seul service + routes différenciées par rôle. Sinon, documenter explicitement la séparation (ex. “API keys entreprise” vs “API keys manager”).

---

## 2. Redondances

### 2.1 Vérifications RBAC dupliquées dans les routes

**Fichier :** `backend/api/routes/manager.py`

- `verify_manager`, `verify_manager_or_gerant`, `verify_manager_gerant_or_seller` sont définis localement.
- D’autres routes (gerant, sellers, etc.) ont des vérifications de rôle similaires.

**Recommandation :** Centraliser dans `core/security.py` (comme `get_current_user`, `get_current_manager`, etc.) et réutiliser via `Depends(...)` pour éviter la duplication et les écarts de logique.

---

### 2.2 Pattern “try / except Exception / HTTPException(500)” répété

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
- Le middleware gère tout le reste (logging + 500 propre).  
- Réduire les blocs try/except aux seuls cas où une conversion explicite en erreur métier est nécessaire.

---

### 2.3 Listes sans pagination

**Exemples :**

- `AdminRepository.get_all_workspaces()` : `.to_list(1000)` en dur.
- `AdminRepository.get_stores_by_gerant`, `get_sellers_for_store` : `.to_list(100)`.

D’autres endroits (hors legacy) utilisent encore des `.to_list(N)` fixes au lieu de `paginate()` / `paginate_with_params()`.

**Recommandation :** Pour toute liste “admin” ou liste potentiellement longue, utiliser `utils.pagination.paginate` ou `paginate_with_params` avec `PaginationParams` en query, et exposer `total` / `page` / `pages` comme déjà fait ailleurs.

---

### 2.4 Imports tardifs dans get_admin_service

**Fichier :** `backend/api/dependencies.py`

`get_admin_service()` fait des `from repositories.xxx import ...` **à l’intérieur** de la fonction. À chaque requête utilisant AdminService, ces imports sont réévalués (même si Python met en cache les modules).

**Recommandation :** Déplacer tous ces imports en tête du module `dependencies.py`, comme pour les autres services, pour clarté et cohérence.

---

## 3. Problèmes de scalabilité (ex. 1000 utilisateurs)

### 3.1 Admin : listes non paginées et limites fixes

- `get_all_workspaces()` : plafond 1000 documents. Au-delà, données tronquées sans que l’appelant le sache.
- Aucun curseur ni token de pagination : impossible de parcourir toute la base côté admin.

**Risque :** Avec un grand nombre de workspaces/stores/users, les écrans admin seront incomplets ou trompeurs.

**Recommandation :** Pagination obligatoire pour toutes les listes admin (workspaces, users, stores, etc.) avec une taille de page raisonnable (ex. 50–100) et métadonnées `total` / `pages`.

---

### 3.2 Pool MongoDB et durée des requêtes

- Pool configuré (ex. 50 connexions) et timeouts présents : bon.
- Si certaines routes ou services enchaînent beaucoup de requêtes (N+1, boucles sur des ids), le nombre de connexions utilisées et le temps de réponse peuvent exploser avec 1000 utilisateurs concurrents.

**Recommandation :**  
- Vérifier les endpoints les plus utilisés (dashboard, listes, exports) pour éviter les N+1 (agrégations, `find({ "_id": { "$in": ids } })`, etc.).  
- Considérer des indices dédiés pour les requêtes lourdes (voir `ensure_indexes` / scripts existants).

---

### 3.3 Cache Redis optionnel

- Si Redis est désactivé ou indisponible, tout passe par MongoDB.
- Avec 1000 utilisateurs, les accès répétés (user, workspace, store) peuvent fortement charger la base.

**Recommandation :** Pour la production à grande échelle, traiter Redis comme partie du design (sessions, cache user/workspace/store). Documenter les conséquences si Redis est down (latence, charge DB) et prévoir monitoring + alertes.

---

### 3.4 Instances de services et repositories par requête

- Chaque requête qui utilise un service (ex. `get_gerant_service`, `get_admin_service`) crée une **nouvelle** instance du service et de ses repositories.
- Pas de connexion DB par requête (get_db retourne la même instance de DB), donc pas de surcoût connexion, mais allocation d’objets répétée.

**Impact :** Faible à moyen. Pour 1000 req/s, réduire les allocations peut aider ; ce n’est pas le premier goulot.

**Recommandation :** À long terme, envisager des singletons ou des scopes “request” pour les services lourds si les profils montrent un coût CPU/mémoire. Pas prioritaire avant d’avoir des métriques.

---

### 3.5 Rate limiting et synchronisation du limiter

**Fichier :** `backend/main.py`

Le rate limiter est synchronisé vers les modules `ai`, `briefs`, `manager` via `setattr(mod, name, app.state.limiter)` après la création de l’app. Si un module est importé avant cette étape et garde une référence à l’ancien limiter (ex. dummy), le rate limiting peut être incohérent.

**Recommandation :** S’assurer que les routes utilisent toujours `request.state.limiter` ou une dépendance qui lit `app.state.limiter` à chaque requête, plutôt qu’une variable de module figée au premier import.

---

### 3.6 Agrégations et limite 10000 (BaseRepository)

**Fichier :** `backend/repositories/base_repository.py`

`aggregate(pipeline, max_results=10000)` limite à 10 000 documents. Pour des rapports ou des exports sur de gros volumes, les résultats seront tronqués sans pagination.

**Recommandation :** Pour les agrégations qui peuvent renvoyer beaucoup de lignes, exposer une API paginée (skip/limit ou cursor) et documenter la limite. Éviter d’utiliser `max_results=None` sans contrôle explicite.

---

## 4. Plan de refactorisation proposé

### Phase 1 – Quick wins (1–2 semaines)

| Priorité | Action | Fichiers / zones |
|----------|--------|-------------------|
| P0 | Remplacer les `print` par `logging` | `core/database.py`, `api/routes/manager.py`, `api/routes/__init__.py` |
| P0 | Extraire les 5 classes repository de `get_admin_service` vers `repositories/` | `api/dependencies.py`, nouveaux fichiers sous `repositories/` |
| P1 | Faire hériter `AdminRepository` de `BaseRepository` ou déléguer aux repos existants ; introduire pagination pour `get_all_workspaces` et autres listes | `repositories/admin_repository.py`, routes admin |
| P1 | Déplacer les imports de `get_admin_service` en tête de `dependencies.py` | `api/dependencies.py` |

### Phase 2 – Gestion d’erreurs (2–3 semaines)

| Priorité | Action | Fichiers / zones |
|----------|--------|-------------------|
| P0 | Remplacer `raise HTTPException(500, ...)` par des `AppException` (ou sous-classes) dans les routes et services | Toutes les routes (gerant, manager, admin, integrations, etc.) |
| P1 | Réduire les `except Exception` : ne capturer que les exceptions métier ; laisser le reste au middleware | Routes + services (auth, payment, ai, conflict, relationship, etc.) |
| P2 | Documenter dans `.cursorrules` ou un “Error handling” : quand utiliser quelle exception et ne plus utiliser HTTPException 500 dans les handlers | Documentation projet |

### Phase 3 – Réduction des redondances (2 semaines)

| Priorité | Action | Fichiers / zones |
|----------|--------|-------------------|
| P1 | Centraliser `verify_manager`, `verify_manager_or_gerant`, `verify_manager_gerant_or_seller` (et variantes) dans `core/security.py` | `api/routes/manager.py`, `core/security.py`, autres routes |
| P2 | Imposer la pagination pour toutes les listes admin (workspaces, users par workspace, etc.) | `repositories/admin_repository.py`, routes admin |
| P2 | Clarifier ou unifier IntegrationService vs APIKeyService (documentation + éventuellement fusion partielle) | `services/`, `api/routes/integrations.py`, `api/routes/manager.py` |

### Phase 4 – Découplage et scalabilité (3–4 semaines)

| Priorité | Action | Fichiers / zones |
|----------|--------|-------------------|
| P1 | Découpler l’invalidation de cache de `BaseRepository` (stratégie injectée ou invalidation dans la couche service) | `repositories/base_repository.py`, `core/cache.py`, services concernés |
| P2 | Vérifier les endpoints à fort trafic (dashboard, listes, sync) pour N+1 et ajouter indices si besoin | Services (gerant, manager, seller), scripts `ensure_indexes` |
| P2 | S’assurer que le rate limiter est bien utilisé via `app.state` à chaque requête | `main.py`, `api/dependencies_rate_limiting.py`, routes décorées |
| P3 | Documenter le rôle de Redis pour la prod (scalabilité, comportement si indisponible) | Documentation, `core/cache.py` |

### Phase 5 – Qualité et dette technique (continu)

| Priorité | Action |
|----------|--------|
| P2 | Étendre la pagination à toutes les listes qui dépassent une taille raisonnable (ex. 100 items). |
| P3 | Introduire des tests unitaires pour les nouveaux repositories extraits et pour les exceptions métier. |
| P3 | Réviser les agrégations qui peuvent dépasser 10k documents : soit pagination, soit limite documentée et assumée. |

---

## 5. Synthèse

- **Anti-patterns les plus bloquants :** classes dans `get_admin_service`, gestion d’erreurs mélangeant HTTPException 500 et middleware, couplage cache dans BaseRepository, `AdminRepository` hors pattern commun.
- **Redondances les plus coûteuses :** vérifications RBAC dupliquées, pattern try/except/500 répété, listes sans pagination.
- **Scalabilité :** le point le plus risqué pour “1000 utilisateurs” est la combinaison **listes admin non paginées + limites fixes (.to_list(1000))** et, à moindre degré, **absence de cache Redis** et **N+1** dans quelques parcours.

En priorisant les phases 1 et 2, tu corriges les anti-patterns les plus visibles et tu poses une base saine pour la suite (erreurs, pagination, cache). Les phases 3 à 5 peuvent être étalées en fonction de la charge réelle et des objectifs de montée en charge.
