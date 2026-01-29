# Rapport d'audit architectural et plan de refactorisation

**Date :** 29 janvier 2025  
**Contexte :** Analyse en tant que Développeur Senior / Architecte Logiciel. Objectif : identifier anti-patterns, redondances et risques de scalabilité **sans** ajout de fonctionnalités.

---

## 1. Anti-patterns identifiés

### 1.1 Gestion des erreurs dans les routes

**Problème :** Usage massif de `except Exception as e: raise ValidationError(str(e))` ou `raise ForbiddenError(str(e))` dans les routes (auth, kpis, manager, gerant, stores, enterprise, etc.). On transforme *toute* exception en 400/403, ce qui :

- **Masque les bugs** : une `KeyError`, un `TypeError` ou une erreur réseau deviennent un message générique "validation error".
- **Rend le debugging difficile** : la stack trace est perdue, la cause réelle obscure.
- **Couple la logique métier aux messages** : ex. `if "logiciel de caisse" in str(e)` dans `kpis.py` pour décider ForbiddenError → extrêmement fragile.

**Exemples :**
- `backend/api/routes/kpis.py` (l.82–85) : `except Exception` + test sur le contenu de `str(e)`.
- `backend/api/routes/manager.py` : nombreux `except Exception` puis `raise ValidationError(str(e))`.
- `backend/api/routes/gerant.py`, `enterprise.py`, etc. : même schéma.

**Recommandation :** Les services doivent lever des exceptions métier typées (`ValidationError`, `ForbiddenError`, `NotFoundError`). Les routes ne doivent **pas** attraper `Exception` pour les convertir. Laisser remonter ; le middleware / handler FastAPI gère déjà `AppException`.

---

### 1.2 Double gestion des `AppException`

**Problème :** Les `AppException` sont gérées à **deux endroits** :

1. **`ErrorHandlerMiddleware`** (`api/middleware/error_handler.py`) : intercepte toutes les exceptions, convertit `AppException` en JSON.
2. **`main.py`** : `app.add_exception_handler(AppException, _app_exception_handler)` fait la même chose.

Avec `BaseHTTPMiddleware`, les exceptions levées dans les routes remontent dans `dispatch` → le middleware les attrape. Le handler FastAPI pour `AppException` ne voit jamais ces exceptions. On a donc une **redondance** et une **source de confusion** (deux logiques qui font la même chose).

**Recommandation :** Choisir **une** stratégie : soit middleware global, soit handlers FastAPI. Supprimer l’autre pour éviter la duplication.

---

### 1.3 Mutation du dictionnaire `update` dans `BaseRepository.update_one`

**Problème :** Dans `base_repository.py`, `update_one` fait :

```python
if "$set" in update:
    update["$set"]["updated_at"] = datetime.now(timezone.utc)
else:
    update["$set"] = {"updated_at": datetime.now(timezone.utc)}
```

On **modifie le dictionnaire passé par l’appelant**. Si le même `update` est réutilisé (ex. en boucle ou en retry), on ajoute plusieurs fois `updated_at` ou on écrase des clés. Comportement imprévisible et effets de bord.

**Recommandation :** Construire un **nouveau** dict pour l’`update` (copie de `$set`, ajout de `updated_at`), sans toucher à l’argument.

---

### 1.4 Accès direct à la base dans la couche sécurité

**Problème :** `core/security.py` utilise **directement** `db.users`, `db.workspaces`, `db.stores` (ex. `_get_current_user_from_token`, `_resolve_workspace`, `require_active_space`, `verify_store_ownership`, `verify_seller_store_access`), alors que le reste de l’appli suit une architecture **Repository + Service**.

- Contournement de l’abstraction (repos).
- Duplication de logique (ex. résolution workspace, vérification store) déjà présente dans les services.
- Accès direct dans `require_active_space` pour `db.workspaces.update_one` (trial_expired) au lieu de passer par un repository / service.

**Recommandation :** Introduire des repos (ou services) pour auth/workspace/store et les utiliser dans les dépendances d’auth. Supprimer les accès directs à `db` dans `security.py`.

---

### 1.5 Code mort dans `require_active_space`

**Problème :** À la fin de `require_active_space` :

```python
    raise ForbiddenError(
        "Abonnement inactif ou paiement en échec : accès aux fonctionnalités bloqué"
    )
    return current_user  # ← jamais exécuté
```

Le `return current_user` est **inaccessible** (toujours après un `raise`).

**Recommandation :** Supprimer cette ligne.

---

### 1.6 Rate limiting : stockage en mémoire par défaut

**Problème :** Le `Limiter` slowapi est créé **sans** `storage_uri` (ex. Redis). Donc stockage **in-memory** par worker. Avec plusieurs workers (ex. uvicorn `--workers 4`) :

- Chaque worker a son propre compteur.
- Une limite "100/minute" est en pratique "100 × N/minute" (N = nombre de workers).
- Risque d’abus (coûts API, scraping) et fausse sensation de sécurité.

**Recommandation :** Utiliser un backend **partagé** (ex. Redis) pour slowapi :  
`Limiter(..., storage_uri=settings.REDIS_URL)` lorsque Redis est configuré.

---

### 1.7 `init_database` bloquant dans une tâche async

**Problème :** Dans `lifespan.py`, `_create_indexes_background` (async) appelle **sans await** `init_database()` de `init_db.py`. `init_database` utilise **PyMongo synchrone** (`MongoClient`) et fait des opérations bloquantes. Appelée depuis une coroutine, elle **bloque l’event loop** pendant toute la durée des opérations.

**Recommandation :** Soit rendre `init_database` async et utiliser Motor, soit l’exécuter dans `run_in_executor` pour ne pas bloquer la boucle. À terme, privilégier Motor pour rester cohérent avec le reste de l’appli.

---

### 1.8 Global mutable pour le rate limiter

**Problème :** `dependencies_rate_limiting.py` et `rate_limiting.py` utilisent une variable **globale** (`_global_limiter` / `limiter`) initialisée au démarrage. Tests unitaires ou scénarios multi-app (ex. tests d’intégration) qui créent plusieurs applications FastAPI peuvent se marcher sur les pieds ou avoir un limiter non initialisé.

**Recommandation :** S’appuyer uniquement sur `request.app.state.limiter` (instance par app) et supprimer les globaux, ou les réserver à un usage très limité et documenté (ex. fallback), avec une stratégie claire pour les tests.

---

## 2. Redondances

### 2.1 Triple implémentation "Limiter / dummy / get_remote_address"

**Problème :** La logique "si slowapi absent, dummy limiter + get_remote_address" est dupliquée dans :

- `core/startup_helpers.py`
- `core/rate_limiting.py`
- `api/dependencies_rate_limiting.py`

Classes factices, `get_remote_address` de fallback, etc. répétés.

**Recommandation :** Un seul module (ex. `startup_helpers` ou `rate_limiting`) qui définit limiter, dummy et helpers. Les autres importent depuis ce module.

---

### 2.2 Exceptions : `core.exceptions` vs `exceptions.custom_exceptions`

**Problème :** `exceptions/custom_exceptions.py` ne fait que réexporter `core.exceptions`. Deux points d’entrée pour les mêmes exceptions, maintenance et usages divergents possibles.

**Recommandation :** Conserver une seule source (`core.exceptions`). Si la réexport existe pour compatibilité, documenter clairement et migrer progressivement les imports vers `core.exceptions`, puis déprécier `custom_exceptions`.

---

### 2.3 `verify_resource_store_access` et `verify_seller_store_access`

**Problème :** Ces fonctions acceptent **plusieurs modes** : `db` seul, `(objective_repo, challenge_repo)`, `manager_service`, ou `(user_repo, store_repo)`. Chaque branche réimplémente une logique équivalente (vérification objectif, challenge, vendeur, store). Beaucoup de duplication et de chemins à maintenir.

**Recommandation :** Un seul chemin : **toujours** passer par des services (ex. `ManagerService`, `StoreService`). Les routes injectent ces services via DI. Supprimer les branches `db` / repos directs et factoriser la logique dans les services.

---

### 2.4 Vérifications d’accès au magasin dupliquées

**Problème :** Dans `briefs.py`, `manager.py`, etc., on retrouve des blocs du type :

```python
if store.get("manager_id") != user_id and store.get("id") != user_store_id:
    raise ForbiddenError("Accès refusé à ce magasin")
```

Répété à plusieurs endroits avec de légères variations.

**Recommandation :** Centraliser dans une dépendance ou une fonction réutilisable (ex. `verify_store_access_for_user(store, user)`) et l’utiliser partout.

---

### 2.5 Double fetch du vendeur dans `verify_seller_store_access`

**Problème :** Pour le rôle gérant, avec `user_repo` + `store_repo`, on fait :

```python
seller = await user_repo.find_one({"id": seller_id, "role": "seller"}, proj)
# ... vérifs ...
seller = await user_repo.find_one({"id": seller_id, "role": "seller"}, proj)  # doublon
return seller
```

La deuxième requête est **inutile**.

**Recommandation :** Supprimer le second `find_one` et réutiliser le `seller` déjà chargé.

---

### 2.6 Index MongoDB : lifespan vs script `ensure_indexes`

**Problème :** Les index sont créés à la fois dans :

- `core/lifespan.py` (`_create_indexes_background`),
- `scripts/ensure_indexes.py`,

avec recouvrement (ex. `kpi_entries`, `users`, `objectives`, `challenges`, …). Logique dupliquée, risque de divergence (nouveaux index dans un seul des deux), et d’oubli lors des déploiements.

**Recommandation :** Une **seule** source de vérité (ex. module `core.indexes` ou script réutilisable) qui définit la liste des index. Le lifespan et le script d’init appellent cette même liste. Éviter de dupliquer les définitions.

---

## 3. Problèmes de scalabilité (ex. 1000 utilisateurs)

### 3.1 Absence d’index sur `users.id` et `workspaces.id`

**Problème :** L’auth fait systématiquement :

- `db.users.find_one({"id": user_id})`
- `db.workspaces.find_one({"id": workspace_id})` ou `{"gerant_id": ...}`

Ni `ensure_indexes`, ni le lifespan ne créent d’index sur `users.id` ou `workspaces.id`. En production, ces requêtes peuvent entraîner des **scans complets** de collection. Avec des milliers d’utilisateurs et de workspaces, latence et charge MongoDB augmentent fortement.

**Recommandation :** Créer des index dédiés, par ex. :

- `users` : `{"id": 1}` (unique si pertinent),
- `workspaces` : `{"id": 1}`, `{"gerant_id": 1}`,

et les ajouter à la définition centralisée des index.

---

### 3.2 Cache Redis désactivé ou indisponible

**Problème :** Si Redis est absent ou désactivé, le cache est ignoré. Chaque requête authentifiée entraîne au minimum :

- 1 lookup user (MongoDB),
- 1 lookup workspace (MongoDB),

sans compter les autres données. À 1000 utilisateurs actifs, le volume de requêtes MongoDB explose (auth + workspace à chaque appel).

**Recommandation :** En production, **toujours** déployer Redis et activer le cache. Documenter Redis comme dépendance de prod et prévoir des alertes si le cache est down. Optionnel : mécanisme de fallback dégradé (ex. cache mémoire local limité) uniquement si vraiment nécessaire, sans masquer la dépendance Redis.

---

### 3.3 Rate limiting in-memory multi-workers

**Problème :** Déjà cité en 1.6. En multi-workers, les limites ne sont pas partagées → risque d’abus et de coûts.

**Recommandation :** Backend Redis (ou équivalent) pour le rate limiting en production.

---

### 3.4 Connexions MongoDB et pool

**Point positif :** La config (pool size, timeouts) est centralisée et parametrable. Reste à **vérifier** en charge réelle (monitoring, métriques de pool) que le pool ne s’épuise pas sous pic (ex. 1000 utilisateurs avec beaucoup de requêtes simultanées).

**Recommandation :** Conserver une limite par connexion (ex. pool size), surveiller les métriques (utilisation du pool, file d’attente), et ajuster selon la charge. Si nécessaire, prévoir du connection pooling côté infra (ex. MongoDB Atlas, proxy).

---

### 3.5 Limites `find_many` et `aggregate`

**Point positif :** `BaseRepository` borne `find_many` (limit 1000 par défaut, `allow_over_limit` explicite) et `aggregate` (`max_results`). Ça limite le risque de chargements massifs en mémoire.

**Recommandation :** Garder ces garde-fous. S’assurer que les APIs exposées utilisent une pagination (offset/cursor) pour les listes potentiellement grosses (ex. KPIs, users, etc.) et n’augmentent `limit` qu’avec parcimonie.

---

## 4. Bug identifié

### 4.1 `ConflictConsultationRepository` non importé dans `dependencies.py`

**Problème :** `get_conflict_service` utilise `ConflictConsultationRepository(db)`, mais `ConflictConsultationRepository` n’est **pas** importé dans `api/dependencies.py`. `RelationshipConsultationRepository` l’est, pas `ConflictConsultationRepository`.  
Résultat : **`NameError`** dès qu’une route injecte `get_conflict_service` (ex. routes conflict / diagnostic).

**Recommandation :** Ajouter :

```python
from repositories.conflict_consultation_repository import ConflictConsultationRepository
```

dans `dependencies.py` (à côté des autres imports de repositories).

---

## 5. Plan de refactorisation priorisé

### Priorité 1 – Correctifs immédiats (bugs / stabilité)

| # | Action | Fichiers principaux |
|---|--------|---------------------|
| 1 | Ajouter l’import manquant `ConflictConsultationRepository` dans `dependencies.py` | `api/dependencies.py` |
| 2 | Supprimer le `return current_user` mort dans `require_active_space` | `core/security.py` |
| 3 | Créer les index `users.id`, `workspaces.id`, `workspaces.gerant_id` et les intégrer à la définition centralisée des index | `ensure_indexes`, `lifespan` ou module d’index |

### Priorité 2 – Scalabilité courte échéance

| # | Action | Fichiers principaux |
|---|--------|---------------------|
| 4 | Configurer slowapi avec `storage_uri=REDIS_URL` pour le rate limiting en prod | `main.py`, config |
| 5 | Exécuter `init_database` dans un executor ou la rendre async (Motor) pour ne pas bloquer l’event loop | `core/lifespan.py`, `init_db.py` |
| 6 | Ne plus modifier le dict `update` en place dans `BaseRepository.update_one` ; utiliser une copie | `repositories/base_repository.py` |

### Priorité 3 – Réduction des redondances et clarté

| # | Action | Fichiers principaux |
|---|--------|---------------------|
| 7 | Centraliser Limiter / dummy / `get_remote_address` dans un seul module ; les autres importent | `startup_helpers`, `rate_limiting`, `dependencies_rate_limiting` |
| 8 | Unifier la gestion des `AppException` : soit middleware, soit handlers FastAPI, pas les deux | `main.py`, `api/middleware/error_handler.py` |
| 9 | Unifier la création des index (un seul module / script) ; lifespan et script appellent cette source | `core/lifespan.py`, `scripts/ensure_indexes.py`, nouveau module si utile |

### Priorité 4 – Architecture et maintenabilité

| # | Action | Fichiers principaux |
|---|--------|---------------------|
| 10 | Supprimer les `except Exception` + `raise ValidationError/ForbiddenError` dans les routes ; faire lever des exceptions métier dans les services | Routes concernées, services |
| 11 | Factoriser `verify_resource_store_access` et `verify_seller_store_access` sur les services uniquement ; supprimer les branches `db` / repos directs | `core/security.py`, routes |
| 12 | Introduire des repos / services pour auth+workspace+store et les utiliser dans `security.py` ; supprimer les accès directs à `db` | `core/security.py`, repos, `dependencies` |
| 13 | Extraire une fonction ou dépendance `verify_store_access_for_user` et l’utiliser dans briefs, manager, etc. | `core/security.py` ou module dédié, routes |
| 14 | Supprimer le double `user_repo.find_one` pour le vendeur dans `verify_seller_store_access` (branche gérant) | `core/security.py` |

### Priorité 5 – Optionnel / long terme

| # | Action |
|---|--------|
| 15 | Migrer tous les imports d’exceptions vers `core.exceptions` et déprécier `exceptions.custom_exceptions` |
| 16 | Réduire ou supprimer les globaux pour le rate limiter ; privilégier `request.app.state` |

---

## 6. Synthèse

- **Anti-patterns principaux :** gestion d’erreurs par `except Exception` dans les routes, double gestion des `AppException`, mutation du dict `update` dans le repository, accès direct à `db` dans la couche sécurité, rate limiting en mémoire, `init_database` bloquant dans une tâche async.
- **Redondances :** triple implémentation Limiter/dummy, `verify_*` multi-modes, duplication des index, double fetch vendeur, checks d’accès magasin répétés.
- **Scalabilité :** manque d’index sur `users.id` / `workspaces.id`, dépendance au cache Redis pour l’auth, rate limiting non partagé entre workers.

En appliquant les actions par priorité (1 → 5), vous corrigez les bugs, améliorez la scalabilité et simplifiez l’architecture sans ajouter de nouvelles fonctionnalités.
