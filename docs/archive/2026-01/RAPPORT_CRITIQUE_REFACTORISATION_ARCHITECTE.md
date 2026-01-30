# Rapport critique – Analyse Architecte / Développeur Senior

**Rôle :** Développeur Senior & Architecte Logiciel  
**Périmètre :** Backend (API routes, services, repositories, core)  
**Objectif :** Anti-patterns, redondances, scalabilité — **sans ajout de fonctionnalités**.  
**Date :** 29 janvier 2026  

---

## Synthèse exécutive

| Catégorie | Constat | Impact |
|-----------|---------|--------|
| **Anti-patterns** | Routes appellent `service.xxx_repo` (~97 occurrences), HTTPException(500) massif (~135 en routes), `except Exception` partout (~400), routes qui instancient des repositories (workspaces, sales_evaluations, kpis, legacy), services qui gardent `self.db` (KPIService, ConflictService, RelationshipService, OnboardingService, AuthService, NotificationService), AdminRepository accès direct `self.db` + `except:` nus, `print()` en production (evaluations, diagnostics, debriefs, sellers) | Dette technique, couplage fort, maintenance difficile, fuites d’infos possibles |
| **Redondances** | Pattern try/except/500 répété, vérifications d’accès éparpillées, listes sans pagination (admin, integration_repository), dépendances d’auth dupliquées (get_current_gerant, get_current_manager, etc.) sans réutilisation du cache | ~30 % de code dupliqué, évolution coûteuse |
| **Scalabilité** | Peu de routes avec rate limit (~5), listes admin `.to_list(1000)`, Redis optionnel, `aggregate(max_results=None)` possible dans BaseRepository, risque N+1 sur endpoints dashboard/listes | À 1000 users : charge DB, troncature silencieuse, pas de protection DDoS |

**Points positifs :** ErrorHandlerMiddleware + AppException en place. StoreService, GerantService, SellerService, ManagerService, etc. sont correctement assemblés dans `dependencies.py` (repos injectés). BaseRepository avec limite find_many(1000) et aggregate(10000). Pool MongoDB et timeouts configurés.

---

## 1. Anti-patterns identifiés

### 1.1 Routes qui appellent directement les repositories via le service

**Constat :** **~97** occurrences où les routes font `await xxx_service.user_repo.find_by_id(...)`, `await seller_service.diagnostic_repo.find_by_seller(...)`, etc.

**Fichiers les plus impactés :**
- `api/routes/sellers.py` : accès à `seller_service.user_repo`, `seller_service.diagnostic_repo`, etc.
- `api/routes/gerant.py` : `gerant_service.user_repo`, `gerant_service.workspace_repo`
- `api/routes/manager.py` : `manager_service.store_repo`, `manager_service.user_repo`
- `api/routes/debriefs.py` : `seller_service.diagnostic_repo`, `seller_service.kpi_repo`, `seller_service.debrief_repo`, `seller_service.user_repo`
- `api/routes/evaluations.py`, `api/routes/diagnostics.py`, `api/routes/briefs.py`, `api/routes/integrations.py`, `api/routes/support.py`

**Problèmes :**
- La couche route connaît la structure interne des services (quel repo pour quelle donnée).
- Logique métier et accès données dans les handlers au lieu des services.
- Évolution coûteuse : changer un repo ou une règle métier impose de toucher aux routes.
- Testabilité dégradée : les routes deviennent difficiles à mocker.

**Recommandation :** Exposer des méthodes de service (ex. `seller_service.get_seller_with_manager_fix(user_id)`, `seller_service.get_debriefs_for_store(store_id, ...)`) et faire appeler ces méthodes par les routes. Les routes ne doivent pas accéder à `service.xxx_repo`.

---

### 1.2 Routes qui instancient des repositories (sans passer par les dépendances)

**Constat :** Les routes créent elles-mêmes des repositories avec `Repository(db)` ou `Repository(kpi_service.db)` :

- `api/routes/workspaces.py` : `WorkspaceRepository(db)` dans le handler.
- `api/routes/sales_evaluations.py` : `SaleRepository(db)`, `EvaluationRepository(db)`, `UserRepository(db)` à plusieurs endroits.
- `api/routes/kpis.py` : `StoreRepository(kpi_service.db)` — usage de la db du service pour créer un repo dans la route.
- `api/routes/legacy.py` : `UserRepository(db)`.

**Problèmes :**
- Violation de l’architecture Routes → Services → Repositories.
- Les dépendances `get_xxx_repository` existent dans `dependencies.py` mais ne sont pas utilisées partout.
- Incohérence : certaines routes passent par des services, d’autres par des repos créés à la volée.

**Recommandation :** Utiliser uniquement des services injectés via `Depends(get_xxx_service)`. Déplacer la logique des routes sales_evaluations, workspaces, kpis (liste stores gérant) dans des services et injecter ces services.

---

### 1.3 Gestion d’erreurs : HTTPException(500) dans les routes

**Constat :** **~135** occurrences de `raise HTTPException(status_code=500, ...)` dans les routes actives (18 fichiers).

**Problèmes :**
- Double mécanisme : les routes lèvent HTTPException(500) alors que l’ErrorHandlerMiddleware convertit déjà les exceptions en réponses HTTP.
- Messages souvent construits avec `str(e)` → risque de fuite d’informations internes.
- Logging et format de réponse non uniformes.

**Recommandation :** Remplacer par des exceptions métier (`NotFoundError`, `ValidationError`, `ForbiddenError`, `BusinessLogicError`) et laisser le middleware les convertir en HTTP. Ne garder HTTPException que pour des cas très ponctuels et documentés.

---

### 1.4 Capture trop large : `except Exception`

**Constat :** **~400** occurrences de `except Exception` dans le backend (hors scripts/tests).

**Problèmes :**
- Capture d’erreurs de programmation (KeyError, AttributeError, etc.) et conversion en 500 générique.
- Le middleware ne voit pas l’exception réelle → débogage plus difficile.
- Pattern typique : `except Exception as e: logger.error(...); raise HTTPException(500, str(e))` → doublon avec le middleware.

**Recommandation :** Capturer uniquement les exceptions métier attendues. Pour les erreurs inattendues, ne pas les attraper dans les routes ; laisser remonter jusqu’à l’ErrorHandlerMiddleware. Dans les services, lever des sous-classes de `AppException` au lieu de retourner None ou de re-raise après log.

---

### 1.5 Print en production

**Constat :** Des `print()` subsistent dans du code exécuté en requêtes :

- `api/routes/evaluations.py` : `print(f"⚠️ Erreur récupération profil DISC...")`
- `api/routes/diagnostics.py` : `print(f"Error in AI analysis: ...")`
- `api/routes/debriefs.py` : `print(f"AI debrief error: ...")`
- `api/routes/sellers.py` : `print(f"AI bilan error: ...")`, `print(f"AI diagnostic error: ...")`

**Recommandation :** Remplacer par `logger.warning` / `logger.error` avec le contexte approprié. Les scripts CLI peuvent garder des `print` si documentés comme tels.

---

### 1.6 Services qui gardent `self.db` et créent des repos en interne

**Constat :** Les services suivants reçoivent `db` et instancient des repositories dans leur constructeur au lieu de les recevoir par injection :

- `KPIService(db)` : crée KPIRepository, ManagerKPIRepository, UserRepository, WorkspaceRepository, StoreRepository, KPIConfigRepository.
- `ConflictService(db, ai_service)` : crée UserRepository, ManagerDiagnosticResultsRepository, etc.
- `RelationshipService(db, ai_service)` : idem.
- `OnboardingService(db)` : crée OnboardingProgressRepository.
- `AuthService(db)` : crée des repos en interne.
- `NotificationService(db)` : idem.

**Problèmes :**
- Couplage fort à la base et aux implémentations concrètes.
- Difficile de mocker les repositories dans les tests unitaires.
- Incohérence avec les services déjà « purs » (StoreService, GerantService, SellerService, ManagerService, etc.) qui ne reçoivent que des repos.

**Recommandation :** Injecter tous les repositories (et services métier utilisés) dans le constructeur des services via `dependencies.py`. Supprimer `self.db` de ces services.

---

### 1.7 KPIService : exposition de `kpi_service.db` et usage dans une route

**Constat :** Dans `api/routes/kpis.py` (ligne ~205) :  
`store_repo = StoreRepository(kpi_service.db)`  
La route utilise la connexion DB du service pour créer un repository. Cela cumule deux anti-patterns : route qui crée un repo, et service qui expose sa db.

**Recommandation :** Exposer une méthode de service du type `get_stores_kpi_summary_for_gerant(gerant_id, date)` (ou utiliser un GerantService/StoreService déjà injecté) et ne plus accéder à `kpi_service.db` depuis la route.

---

### 1.8 AdminRepository : hors pattern BaseRepository et `except:` nus

**Constat :**
- N’hérite pas de `BaseRepository` (choix documenté pour multi-collection) mais accède directement à `self.db` pour plusieurs collections : `diagnostics`, `relationship_consultations`, `system_logs`, `logs`, `admin_logs`.
- Méthodes comme `get_system_logs`, `count_relationship_consultations` utilisent des blocs `except:` sans type (lignes ~172–174, ~191–202), qui avalent toute exception.

**Problèmes :** Pas de limite centralisée pour les listes ; risque de troncature silencieuse ; exceptions masquées.

**Recommandation :** Remplacer `except:` par `except Exception` avec log et re-raise ou retour contrôlé. Pour les listes longues, utiliser pagination (déjà en place pour `get_all_workspaces_paginated`). À terme, créer des repositories dédiés pour les collections sans repo (admin_logs, system_logs, etc.) ou documenter clairement les limites.

---

### 1.9 Listes sans pagination et limites fixes

**Fichiers concernés :**
- `admin_repository.py` : `get_all_workspaces()` avec limite 1000 ; `get_stores_by_gerant`, `get_sellers_for_store` avec limites fixes.
- `repositories/integration_repository.py` : `.to_list(100)` et `.to_list(10)` sans pagination.

**Recommandation :** Pour toute liste potentiellement longue, utiliser `utils.pagination.paginate` ou `paginate_with_params` et exposer `total` / `page` / `pages`. Privilégier les méthodes `get_*_paginated` déjà présentes côté admin.

---

### 1.10 core/security.py : HTTPException au lieu d’exceptions métier

**Constat :** Les dépendances d’auth lèvent `HTTPException(401)` / `HTTPException(403)` au lieu de `UnauthorizedError` et `ForbiddenError`. Le projet impose d’utiliser les exceptions custom et de laisser le middleware les convertir en HTTP.

**Recommandation :** Remplacer dans `core/security.py` les `raise HTTPException(status_code=401, ...)` par `raise UnauthorizedError(...)` et les `raise HTTPException(status_code=403, ...)` par `raise ForbiddenError(...)`.

---

### 1.11 BaseRepository.aggregate(max_results=None)

**Constat :** Dans `base_repository.py`, `aggregate(..., max_results=None)` permet de désactiver la limite et d’appeler `cursor.to_list(None)`, ce qui peut provoquer une charge mémoire importante sur de gros volumes.

**Recommandation :** Éviter `max_results=None` sans contrôle explicite (ex. scripts batch documentés). Pour les agrégations à gros volume côté API, exposer une API paginée ou une limite documentée.

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

**Recommandation :** Ne pas attraper `Exception` dans les routes. Les services doivent lever des `AppException` (ou sous-classes). Le middleware gère le reste (logging + 500 propre). Réduire les blocs try/except aux seuls cas où une conversion explicite en erreur métier est nécessaire.

---

### 2.2 Vérifications d’accès et RBAC éparpillées

- Centralisées dans `core/security.py` : `verify_seller_store_access`, `verify_resource_store_access`, `verify_store_ownership`.
- Éparpillées dans les routes : `verify_invitation_token`, `verify_reset_token`, `verify_api_key`, `verify_store_access`, `verify_api_key_header`, `verify_it_admin`, `verify_gerant_invitation_legacy`, `verify_access` (evaluations).

**Recommandation :** Centraliser dans `core/security.py` tout ce qui est réutilisable et l’exposer via `Depends(...)` pour éviter la duplication et les écarts de logique. Documenter les cas legacy.

---

### 2.3 Dépendances d’auth dupliquées

**Constat :** `get_current_gerant`, `get_current_manager`, `get_current_seller`, `get_super_admin`, `get_gerant_or_manager` répètent le même flux : extraction du token → user_id → accès DB (ou cache) → vérification du rôle → attachement du contexte. Seul le rôle autorisé change. De plus, `get_current_user` utilise le cache ; les autres peuvent refaire un accès DB sans réutiliser ce cache.

**Recommandation :** Factoriser avec une dépendance interne (ex. `get_current_user`) puis une factory du type `require_roles(*allowed_roles)` qui vérifie `current_user["role"] in allowed_roles`. Réutiliser le cache utilisateur pour toutes les dépendances d’auth afin de limiter les accès DB en charge.

---

### 2.4 Duplication fonctionnelle : IntegrationService vs APIKeyService

- **IntegrationService** (routes `integrations.py`) : clés API, sync KPI, stores, etc.
- **APIKeyService** (dans `manager_service.py`, routes `manager.py`) : création / liste / suppression de clés API pour les managers.

**Recommandation :** Clarifier le périmètre (entreprise vs manager) dans la doc ; si les modèles et règles sont les mêmes, unifier derrière un seul service avec routes différenciées par rôle. Sinon, documenter explicitement la séparation (ex. « API keys entreprise » vs « API keys manager »).

---

## 3. Problèmes de scalabilité (ex. 1000 utilisateurs)

### 3.1 Rate limiting très partiel

- Seulement **~5** usages explicites de rate limit : `ai.py` (diagnostic, seller-bilan), `briefs.py` (morning), `manager.py` (kpi-entries, seller stats, et un décorateur `@limiter.limit`).
- La majorité des routes n’ont pas de limite.

**Risque :** Sans rate limit global ou par routeur, un acteur malveillant ou un client bugué peut saturer l’API et la base.

**Recommandation :** Appliquer un rate limit par défaut (ex. 100/min lecture, 20/min écriture) au niveau de l’app ou du routeur, et des limites plus strictes sur les endpoints coûteux (IA, exports, admin).

---

### 3.2 Admin : listes non paginées et limites fixes

- `get_all_workspaces()` : plafond 1000 documents. Au-delà, données tronquées sans que l’appelant le sache.
- Pas de pagination systématique pour toutes les listes admin.

**Risque :** Avec un grand nombre de workspaces/stores/users, les écrans admin seront incomplets ou trompeurs.

**Recommandation :** Pagination obligatoire pour toutes les listes admin (workspaces, users, stores, etc.) avec taille de page 50–100 et métadonnées `total` / `pages`. Privilégier `get_all_workspaces_paginated` et équivalents.

---

### 3.3 Pool MongoDB et N+1

- Pool configuré (50), timeouts présents : correct.
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
- `max_results=None` reste possible et risque OOM.

**Recommandation :** Pour les agrégations qui peuvent renvoyer beaucoup de lignes, exposer une API paginée (skip/limit ou cursor) et documenter la limite. Éviter `max_results=None` sans contrôle explicite.

---

## 4. Plan de refactorisation proposé

### Phase 0 – Architecture et couche route (2–3 semaines)

| Priorité | Action | Fichiers / zones |
|----------|--------|-------------------|
| **P0** | **Routes → services uniquement :** Ne plus appeler `service.xxx_repo` depuis les routes. Créer des méthodes de service (ex. `get_seller_with_manager_fix`, `get_debriefs_for_store`, `get_stores_kpi_summary_for_gerant`) et les appeler depuis les routes. | `api/routes/sellers.py`, `gerant.py`, `manager.py`, `debriefs.py`, `evaluations.py`, `diagnostics.py`, `briefs.py`, `integrations.py`, `support.py` |
| **P0** | **Routes sans instanciation de repositories :** Supprimer toute création de `Repository(db)` ou `Repository(service.db)` dans les routes. Utiliser uniquement des services injectés via `Depends(get_xxx_service)`. Déplacer la logique de `sales_evaluations.py`, `workspaces.py`, `kpis.py` (liste stores gérant) dans des services. | `api/routes/sales_evaluations.py`, `workspaces.py`, `kpis.py`, `legacy.py` |
| **P0** | **Services sans `self.db` :** Injecter tous les repositories dans KPIService, ConflictService, RelationshipService, OnboardingService, AuthService, NotificationService via `dependencies.py`. Supprimer `self.db` de ces services. | `api/dependencies.py`, `services/kpi_service.py`, `conflict_service.py`, `relationship_service.py`, `onboarding_service.py`, `auth_service.py`, `notification_service.py` |

### Phase 1 – Quick wins (1–2 semaines)

| Priorité | Action | Fichiers / zones |
|----------|--------|-------------------|
| **P0** | Remplacer les `print` par `logger.warning` / `logger.error` dans les routes (evaluations, diagnostics, debriefs, sellers). | `api/routes/evaluations.py`, `diagnostics.py`, `debriefs.py`, `sellers.py` |
| **P0** | AdminRepository : remplacer `except:` nu par `except Exception` avec log et re-raise ou retour contrôlé. | `repositories/admin_repository.py` |
| **P1** | Étendre la pagination aux listes admin et integration (workspaces, stores, sellers, API keys). | `admin_repository.py`, `integration_repository.py`, routes admin / integrations |

### Phase 2 – Gestion d’erreurs (2–3 semaines)

| Priorité | Action | Fichiers / zones |
|----------|--------|-------------------|
| **P0** | Remplacer `raise HTTPException(500, ...)` par des exceptions métier (`NotFoundError`, `ValidationError`, `ForbiddenError`, `BusinessLogicError`) dans les routes et services. | Toutes les routes concernées |
| **P1** | Remplacer `HTTPException(401/403)` par `UnauthorizedError` / `ForbiddenError` dans `core/security.py`. | `core/security.py` |
| **P1** | Réduire les `except Exception` dans les routes : ne capturer que les exceptions métier ; laisser le reste au middleware. | Routes + services |
| **P2** | Documenter dans `.cursorrules` ou un doc « Error handling » : quand utiliser quelle exception, ne plus utiliser HTTPException 500 dans les handlers. | Documentation projet |

### Phase 3 – Réduction des redondances (2 semaines)

| Priorité | Action | Fichiers / zones |
|----------|--------|-------------------|
| **P1** | Centraliser les `verify_*` réutilisables dans `core/security.py` et les exposer via `Depends`. | `core/security.py`, routes (integrations, enterprise, evaluations) |
| **P1** | Factoriser les dépendances d’auth autour de `get_current_user` + `require_roles(*)` et réutiliser le cache. | `core/security.py` |
| **P2** | Clarifier ou unifier IntegrationService vs APIKeyService (documentation + éventuellement fusion partielle). | `services/`, `api/routes/integrations.py`, `api/routes/manager.py` |

### Phase 4 – Scalabilité et résilience (3–4 semaines)

| Priorité | Action | Fichiers / zones |
|----------|--------|-------------------|
| **P1** | Étendre le rate limiting à tous les routeurs (défaut global ou par routeur) + limites renforcées sur IA / admin / exports. | `main.py`, `api/dependencies_rate_limiting.py`, routes |
| **P2** | Vérifier les endpoints à fort trafic (dashboard, listes, sync) pour N+1 et ajouter index si besoin. | Services (gerant, manager, seller), scripts `ensure_indexes` |
| **P2** | Documenter le rôle de Redis pour la prod (scalabilité, comportement si indisponible). | Documentation, `core/cache.py` |
| **P2** | Pour les agrégations à gros volume : API paginée ou limite documentée ; éviter `max_results=None` sans contrôle. | `BaseRepository.aggregate`, services qui l’utilisent |

### Phase 5 – Qualité et dette technique (continu)

| Priorité | Action |
|----------|--------|
| P2 | Étendre la pagination à toutes les listes qui dépassent une taille raisonnable (ex. 100 items). |
| P3 | Tests unitaires pour les exceptions métier et les repositories critiques. |
| P3 | Réviser les agrégations qui peuvent dépasser 10k documents : soit pagination, soit limite documentée et assumée. |

---

## 5. Synthèse

- **Anti-patterns les plus bloquants :** routes qui appellent `service.xxx_repo` (~97 occurrences), routes qui instancient des repositories, gestion d’erreurs mélangeant HTTPException 500 et middleware, capture `except Exception` généralisée, services qui gardent `self.db` (KPIService, ConflictService, RelationshipService, OnboardingService, AuthService, NotificationService), AdminRepository avec accès direct à `self.db` et `except:` nus, listes non paginées, HTTPException dans core/security au lieu d’exceptions métier, `print()` en production.
- **Redondances les plus coûteuses :** pattern try/except/500 répété, vérifications d’accès éparpillées, listes sans pagination, duplication des dépendances d’auth sans réutilisation du cache, double périmètre IntegrationService / APIKeyService.
- **Scalabilité :** risques principaux pour « 1000 utilisateurs » : quasi-absence de rate limiting, listes admin non paginées / limites fixes (.to_list(1000)), Redis optionnel, risque N+1, et `BaseRepository.aggregate(max_results=None)` (risque OOM).

En priorisant la **Phase 0 (architecture)** — arrêt des appels route → `service.xxx_repo`, suppression de l’instanciation de repositories dans les routes, et suppression de `self.db` dans les services restants — puis les **Phases 1 et 2**, vous rétablissez une architecture Routes → Services → Repositories cohérente et corrigez les anti-patterns les plus bloquants. Les phases 3 à 5 peuvent être étalées en fonction de la charge réelle et des objectifs de montée en charge.

---

*Rapport généré le 29 janvier 2026 – Analyse du code actuel (backend), sans ajout de fonctionnalités.*
