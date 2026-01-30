# Rapport d'audit – Anti-patterns, redondances et scalabilité

**Contexte :** Analyse du code actuel (backend FastAPI) en tant que Développeur Senior / Architecte Logiciel.  
**Objectif :** Identifier les mauvaises pratiques, le code redondant et les risques de scalabilité, puis proposer un plan de refactorisation (sans ajout de fonctionnalités).

---

## 1. Anti-patterns identifiés

### 1.1 God Object / Fichiers surdimensionnés

| Fichier | Problème |
|--------|----------|
| `backend/api/routes/manager.py` | **~2915 lignes** – Routeur monolithique. Mélange endpoints manager, gérant, objectifs, défis, KPIs, diagnostics, debriefs, abonnements, conflits, relations, etc. Un seul fichier concentre trop de responsabilités. |
| `backend/api/dependencies.py` | **~390 lignes** – Tous les services et repos sont assemblés ici. Chaque nouveau service ajoute une fonction `get_*` et des imports. Le fichier devient le point unique de couplage. |
| `backend/services/manager_service.py` | **~700+ lignes** – Service qui agrège store, sellers, KPI, objectifs, défis, briefs, diagnostics, debriefs, etc. Violation du principe de responsabilité unique (partiellement atténuée par les sous-services ManagerStoreService, ManagerKpiService, etc., mais le facade reste énorme). |

**Impact :** Maintenance difficile, tests lourds, risque de conflits Git, onboarding compliqué.

---

### 1.2 Code mort : package `api/routes/manager/` orphelin

- **`api/routes/__init__.py`** charge `safe_import('api.routes.manager', 'router')`. En Python, en présence de **`manager.py`** (fichier) et **`manager/`** (répertoire), l’import `api.routes.manager` résout vers le **module** `manager.py`, pas vers le package `manager/`.
- Le package **`api/routes/manager/`** (avec `store.py`, `sellers.py`, `objectives.py`, `challenges.py`, `analytics.py`, `evaluations.py`) n’est **jamais monté** dans l’application. Aucun `include_router` ne référence ce package.
- **Conséquence :** Tout le code dans `api/routes/manager/*.py` est mort. Soit on bascule le routage vers ce package (et on allège `manager.py`), soit on supprime ce répertoire pour éviter la confusion.

**Impact :** Confusion (deux « implémentations » manager), dette technique, risque de modifier le mauvais fichier.

---

### 1.3 Incohérence d’injection de dépendances

- **Style 1 (majoritaire) :** Les services reçoivent des **repositories** injectés dans `api/dependencies.py` (ex. `AuthService`, `ManagerService`, `SellerService`).
- **Style 2 :** Certains reçoivent **la base de données** et créent eux-mêmes leurs repos :
  - `PaymentService(db)` → crée des repos dans `__init__`
  - `AIDataService(db)` reçoit `db` directement
  - `get_ai_service()` retourne **une nouvelle instance** `AIService()` à chaque requête (pas de singleton) ; acceptable si AIService est sans état, mais incohérent avec le reste.

**Impact :** Deux façons de faire coexistent, tests et remplacement de dépendances plus complexes.

---

### 1.4 Duplication de logique métier dans les routes

- **Résolution de contexte :** Déjà centralisée dans `api/context_resolvers.py` (`get_store_context`, `get_store_context_with_seller`). Les routes de `manager.py` appellent correctement ces dépendances (~45 usages), mais le **dictionnaire de config KPI par défaut** est dupliqué **au moins 6 fois** :
  - `manager.py` : lignes ~366–377, ~385–396, ~405–416 (GET et PUT kpi-config, fallback Exception)
  - `api/routes/manager/store.py` : lignes ~140–143, ~147–150, ~158–161 (GET kpi-config, pas de config, fallback Exception)
- **Vérification d’accès vendeur :** Déjà factorisée dans `get_verified_seller` (context_resolvers). Utilisée correctement pour debriefs et competences-history.

**Impact :** Toute évolution de la config KPI par défaut impose des modifications à 6+ endroits ; risque d’oubli et d’incohérence.

---

### 1.5 Gestion d’erreurs incohérente dans les routes

- **Exception avalée :** Dans `manager.py`, l’endpoint `get_subscription_status` (l.148–151) attrape `Exception` et retourne `{"isReadOnly": True, "status": "error", "message": str(e)}` au lieu de laisser remonter une `AppException` ou de logger et renvoyer 500. Le client reçoit un 200 avec un détail d’erreur potentiellement sensible.
- **Handlers trop larges :** Env. **84 occurrences** de `except Exception`, `except:` ou `pass` dans les routes (backend/api/routes). Certains endpoints (ex. `get_manager_kpis`) retournent une `PaginatedResponse` vide en cas d’exception au lieu de propager l’erreur.
- **Redondance de handlers :** Ex. `manager.py` lignes 2798–2803 : `except AppException: raise` et `except (AppException,): raise` consécutifs.

**Impact :** Erreurs masquées, réponses HTTP incorrectes (200 au lieu de 4xx/5xx), debugging difficile.

---

### 1.6 Requête inefficace (fetch puis filtre en Python)

- **`GET /api/manager/relationship-history`** (manager.py ~2712–2726) :  
  Appel à `get_relationship_consultations_paginated(resolved_store_id, page=1, size=50)` puis **filtrage en Python** par `seller_id` si le paramètre est fourni :  
  `consultations_result = type(consultations_result)(items=[c for c in consultations_result.items if c.get("seller_id") == seller_id], ...)`.  
  On charge 50 enregistrements puis on en garde un sous-ensemble au lieu de passer `seller_id` au service et de faire une seule requête MongoDB filtrée.

**Impact :** Requêtes inutiles, réponses potentiellement incomplètes (si les 50 premiers ne contiennent pas le seller_id demandé), mauvaise utilisation de la pagination.

---

### 1.7 Singleton manuel et état global

- **`core/config.py` :** `get_settings()` utilise un singleton global `_settings`. Pas de FallbackSettings visible dans la version actuelle ; la config est en fail-fast.
- **`core/database.py` :** Instance globale `database = Database()` + `init_legacy_db_global()` qui assigne `global db` pour « compatibilité legacy ». La base est accessible soit via `Depends(get_db)`, soit via une variable globale.

**Impact :** Comportement différent selon l’ordre d’import ; risque de bugs si du code legacy utilise encore `db` global.

---

### 1.8 Ordre des imports dans `dependencies.py`

- `get_seller_service` utilise `SaleRepository` et `EvaluationRepository`, qui ne sont importés qu’aux lignes 412–413. En Python le corps de la fonction n’est exécuté qu’à l’appel, donc pas de bug à l’exécution, mais **anti-pattern** : les dépendances d’un service ne sont pas visibles en tête de fichier.

**Impact :** Lisibilité et maintenance difficiles ; risque d’erreur si on déplace du code.

---

## 2. Redondances

### 2.1 Config KPI par défaut dupliquée (6+ fois)

- Même dictionnaire (enabled, saisie_enabled, seller_track_*, manager_track_*) répété dans :
  - `api/routes/manager.py` (3 branches : pas de store_id, pas de config, Exception)
  - `api/routes/manager/store.py` (3 branches : pas de store_id, pas de config, Exception)
- **Action :** Une constante ou une fonction dans un module partagé (ex. `models` ou `core/constants.py`), utilisée par toutes les routes et par le service si besoin.

---

### 2.2 Logique de résolution store_id / rôle

- Déjà factorisée dans `api/context_resolvers.py` avec `resolve_store_context(..., include_seller=...)` et les dépendances FastAPI `get_store_context` / `get_store_context_with_seller`. Pas de duplication restante à signaler sur ce point.

---

### 2.3 Vérification d’accès « vendeur pour ce store »

- Déjà factorisée dans `get_verified_seller` (context_resolvers). Les routes debriefs et competences-history l’utilisent correctement.

---

### 2.4 Fichier middleware déprécié

- **`backend/api/middleware/error_handler.py`** : Supprimé (présent en D dans le git status). La gestion d’erreurs est faite par les exception handlers FastAPI dans `main.py`. S’il reste une référence dans la doc (`core/exceptions.py`), la mettre à jour.

---

## 3. Problèmes de scalabilité

### 3.1 Routes retournant des listes non paginées ou à limite fixe

- **`GET /api/manager/sellers`** : `manager_service.get_sellers` → `find_many(..., limit=100)`. Au-delà de 100 vendeurs par magasin, la réponse est tronquée sans indication au client.
- **`GET /api/manager/debriefs/{seller_id}`** : `get_debriefs_by_seller(seller_id, limit=1000)`. Réponse potentiellement très grosse ; pas de pagination.
- **`GET /api/manager/competences-history/{seller_id}`** : Charge jusqu’à 1000 debriefs + 1 diagnostic, puis construit la liste en mémoire. Avec 1000 utilisateurs actifs, pics de charge et latence.

**Recommandation :** Pagination pour sellers et debriefs ; pour competences-history, fenêtre temporelle ou pagination.

---

### 3.2 Requêtes potentiellement lourdes

- **`get_store_kpi_overview`** (GerantService) : Agrège les KPIs de tous les vendeurs du magasin pour une date. Avec beaucoup de vendeurs, la charge augmente. Les index `kpi_entries` (store_id, date) sont définis dans `core/indexes.py`, ce qui est bien.
- **BaseRepository.aggregate** : Si `max_results=None`, `cursor.to_list(None)` charge tout le curseur en mémoire. Risque OOM sur de grosses agrégations.
- **Admin / gerant** : Utilisation de `limit=1000` ou `2000` avec `allow_over_limit=True` (ex. gerant_service delete_store, get_all_stores). Pour 1000+ workspaces/magasins, ces listes restent en mémoire.

**Recommandation :** Pagination systématique pour les listes admin/gerant ; éviter `max_results=None` sauf cas documentés.

---

### 3.3 Pool de connexions et concurrence

- **MongoDB :** `MONGO_MAX_POOL_SIZE=50` (config). Avec 1000 utilisateurs simultanés, 50 connexions peuvent être saturées si les handlers gardent la connexion longtemps (agrégations lourdes).
- **Redis :** Optionnel ; en cas d’indisponibilité, le cache est désactivé et toute la charge retombe sur MongoDB.
- **Instances par requête :** Chaque requête crée de nouveaux repositories et services via `Depends(get_*)`. Pas de cache d’instances (volontaire avec FastAPI). Coût CPU/mémoire acceptable tant que les services sont légers.

**Recommandation :** Garder les requêtes courtes ; monitoring (connexions MongoDB, latence des routes les plus appelées).

---

### 3.4 Cache Redis et invalidation

- Cache centralisé (`core/cache.py`), invalidation par clé/pattern. Si un code path oublie d’invalider après écriture, données obsolètes jusqu’au TTL.

**Recommandation :** Documenter quelles clés sont invalidées où ; TTL courts pour les données critiques.

---

## 4. Plan de refactorisation proposé

### Phase 1 – Nettoyage et cohérence (priorité haute, risque faible)

1. **Clarifier ou supprimer le package `api/routes/manager/`**  
   - Soit basculer le routage : dans `api/routes/__init__.py`, importer le router depuis `api.routes.manager` **package** (en renommant ou déplaçant l’actuel `manager.py` en `manager_legacy.py` ou en sous-module) et monter les sous-routeurs store, sellers, objectives, challenges, analytics, evaluations.  
   - Soit supprimer le répertoire `api/routes/manager/` s’il n’est pas retenu, pour éviter le code mort.

2. **Factoriser la config KPI par défaut**  
   - Créer une constante ou une fonction (ex. dans `core/constants.py` ou `models/kpi_config.py`) retournant le dictionnaire de config par défaut.  
   - Remplacer toutes les occurrences dans `manager.py` et `manager/store.py` par un appel à cette source unique.

3. **Corriger la gestion d’erreurs des endpoints sensibles**  
   - `get_subscription_status` : ne pas attraper `Exception` pour retourner 200 ; logger et soit propager une `AppException`, soit laisser le handler global 500.  
   - Supprimer les blocs redondants du type `except AppException: raise` / `except (AppException,): raise`.  
   - Pour `get_manager_kpis` (et similaires), ne pas retourner une liste vide en cas d’exception ; propager l’erreur ou lever une `AppException` explicite.

4. **Ordre des imports dans `dependencies.py`**  
   - Déplacer les imports de `SaleRepository` et `EvaluationRepository` en tête de fichier avec les autres repositories.

---

### Phase 2 – Réduction des duplications et des requêtes inefficaces

5. **Corriger l’endpoint relationship-history**  
   - Passer `seller_id` (optionnel) au service et adapter `get_relationship_consultations_for_manager_paginated` (ou équivalent) pour filtrer en base par `seller_id` quand il est fourni.  
   - Supprimer le filtrage Python post-fetch sur les 50 premiers résultats.

6. **Harmoniser l’injection de dépendances**  
   - À moyen terme : faire en sorte que `PaymentService` et `AIDataService` reçoivent des repositories (ou services) injectés depuis `dependencies.py`, sans recevoir `db`. Migration progressive (un service à la fois).

---

### Phase 3 – Découpage des God Objects (priorité moyenne)

7. **Découper `api/routes/manager.py`**  
   - Si le package `manager/` est conservé : y déplacer les routes par domaine (store, sellers, kpis, objectives, challenges, diagnostics, debriefs, subscription, conflict, relationship) et ne garder dans `manager.py` qu’un agrégateur qui inclut ces sous-routeurs.  
   - Sinon : extraire des sous-routeurs dans le même répertoire que `manager.py` (ex. `manager_store.py`, `manager_kpis.py`, …) et les inclure sous le préfixe `/manager`. Objectif : fichiers de l’ordre de 200–400 lignes max.

8. **Alléger `api/dependencies.py`**  
   - Introduire des modules par domaine (ex. `api/dependencies_manager.py`, `api/dependencies_auth.py`) et un `dependencies/__init__.py` qui expose les `get_*` nécessaires. Éviter un seul fichier de 500+ lignes.

---

### Phase 4 – Scalabilité (priorité moyenne à basse)

9. **Pagination des listes critiques**  
   - **Sellers :** Exposer `GET /api/manager/sellers?page=1&size=50` et documenter la limite de l’endpoint « all » (ex. max 100) ou le déprécier.  
   - **Debriefs / competences-history :** Proposer une pagination (page/size) ou une limite explicite (ex. 100 derniers) avec paramètre `limit` ou `since_date`.

10. **Index MongoDB**  
    - Les index sont centralisés dans `core/indexes.py`. Vérifier qu’ils couvrent les filtres les plus utilisés (store_id, role, date, seller_id, etc.) et documenter les index critiques pour la prod.

11. **Limites et monitoring**  
    - Garder les limites `limit=1000` et `allow_over_limit` dans BaseRepository. Éviter `aggregate(..., max_results=None)` sauf cas documentés. Ajouter des métriques ou logs sur les routes les plus coûteuses (temps de réponse, taille de réponse).

---

### Phase 5 – Optionnel (long terme)

12. **Supprimer `init_legacy_db_global` et variable globale `db`**  
    - Si plus aucun code ne s’appuie sur `db` global, supprimer `init_legacy_db_global` et ne garder que `Depends(get_db)`.

---

## 5. Synthèse

| Catégorie | Nombre de points | Priorité suggérée |
|-----------|------------------|-------------------|
| Anti-patterns | 8 | Phase 1–3 |
| Redondances | 2 (config KPI, middleware) | Phase 1 |
| Scalabilité | 4 | Phase 4 |
| Plan de refactorisation | 12 actions | Phases 1 à 5 |

En suivant ce plan par phases, vous réduisez la dette technique, les duplications et les risques de blocage à 1000 utilisateurs, sans ajouter de nouvelles fonctionnalités. Il est recommandé de commencer par la Phase 1 (nettoyage, config KPI, gestion d’erreurs, imports), puis la Phase 2 (relationship-history, DI), avant le découpage des gros fichiers (Phase 3) et les évolutions scalabilité (Phase 4).
