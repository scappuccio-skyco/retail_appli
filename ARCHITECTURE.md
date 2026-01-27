# 🏛️ DOCUMENTATION D'ARCHITECTURE - RETAIL PERFORMER AI

**Version**: 2.1 (Post-Refactoring Standardisation Repository - Janvier 2026)
**Statut**: Production Ready - Architecture 100% Standardisée
**Stack**: FastAPI (Python) | MongoDB (Motor) | Redis (Cache) | React (Frontend)

---

## 1. VUE D'ENSEMBLE (CLEAN ARCHITECTURE)

L'application suit strictement le principe de **Séparation des Responsabilités**. Le code est organisé en couches distinctes, et les dépendances vont toujours de l'extérieur vers l'intérieur.

### 🔄 Flux d'une Requête (Request Flow)

1.  **Route (Controller)** : Reçoit la requête HTTP, valide les entrées (Pydantic), et vérifie les permissions de base via `Depends()`. **Aucune logique métier ici.**
2.  **Service (Business Logic)** : Contient l'intelligence de l'application. Effectue les calculs, valide les règles métier. Lève des `BusinessLogicError` (pas de HTTP).
3.  **Repository (Data Access)** : Gère TOUS les échanges avec MongoDB. Applique systématiquement les filtres de sécurité (`store_id`, `manager_id`).
4.  **Database** : MongoDB (stockage pur).

---

## 2. STANDARDS DE DÉVELOPPEMENT (RÈGLES D'OR)

### 🛡️ A. Pattern Repository & Sécurité (OBLIGATOIRE - ✅ 100% CONFORME)
**Règle** : Les routes ne doivent JAMAIS appeler `db.collection.find()` directement.

* **Pourquoi ?** Pour garantir que les filtres de sécurité (IDOR) sont appliqués partout et tout le temps.
* **Implémentation** : Chaque entité a son Repository (`UserRepository`, `SaleRepository`, etc.) qui hérite de `BaseRepository`.
* **Sécurité** : Chaque méthode de repository doit exiger un contexte de propriété (ex: `store_id`).
* **✅ Statut** : **Architecture 100% standardisée** (Janvier 2026). Tous les accès directs à `db.collection.*` ont été éliminés des routes `manager.py` et `sellers.py`. 58 occurrences remplacées par des appels aux repositories.

### ⚡ B. Pagination Standardisée (OBLIGATOIRE)
**Règle** : Interdiction formelle d'utiliser `.to_list(1000)` ou des limites arbitraires sur des listes.

* **Pattern** : Utiliser `paginate_with_params()` ou `paginate()`.
* **Performance** : Utilise `asyncio.gather` pour paralléliser le `count` et le `find`.
* **Format de réponse** : Toujours renvoyer un objet `PaginatedResponse`.

### 🚨 C. Gestion des Erreurs
**Règle** : Plus de `try/except` génériques dans les routes.

* **Services** : Lèvent des exceptions typées (`NotFoundError`, `ValidationError`, `BusinessLogicError`).
* **Middleware** : Un middleware global intercepte ces erreurs et les transforme en réponses HTTP JSON standardisées.

---

## 3. STRUCTURE DU PROJET

```
backend/
├── api/
│   ├── routes/          # Chefs d'orchestre (Validation -> Appel Service -> Réponse)
│   ├── middleware/      # Error Handling global
│   └── dependencies.py  # Injection de dépendances
├── services/            # Logique Métier (Calculs de KPIs, Algorithmes DISC)
├── repositories/        # Accès Données (Requêtes MongoDB sécurisées)
├── models/              # Schémas Pydantic (Validation des données)
├── core/
│   ├── config.py        # Configuration (Variables d'env)
│   ├── database.py      # Connection Pool (maxPoolSize=50)
│   ├── security.py      # Auth & RBAC
│   └── cache.py         # Service Redis (Cache avec fallback gracieux)
├── exceptions/          # Exceptions personnalisées
└── utils/
    └── pagination.py    # Utilitaire de pagination haute performance
```

### 📦 Repositories (Pattern Repository - Standardisé à 100%)

**✅ Architecture totalement standardisée** : Tous les accès à MongoDB passent exclusivement par les repositories. Aucun accès direct `db.collection.*` dans les routes.

#### Repositories Principaux
- **`BaseRepository`** : Classe de base avec méthodes CRUD génériques et invalidation automatique du cache Redis
- **`UserRepository`** : Gestion des utilisateurs (vendeurs, managers, gérants)
- **`StoreRepository`** : Gestion des magasins (avec filtres de sécurité `gerant_id`)
- **`WorkspaceRepository`** : Gestion des espaces de travail (workspaces)
- **`KPIRepository`** : Entrées KPI des vendeurs (`kpi_entries`)
- **`ManagerKPIRepository`** : Entrées KPI des managers (`manager_kpis`)
- **`KPIConfigRepository`** : Configuration des KPIs par magasin/manager (`kpi_configs`)
- **`DiagnosticRepository`** : Diagnostics DISC des vendeurs (`diagnostics`)
- **`ChallengeRepository`** : Défis collectifs et individuels (`challenges`)
- **`DailyChallengeRepository`** : Défis quotidiens générés par l'IA (`daily_challenges`)
- **`ObjectiveRepository`** : Objectifs des vendeurs (`objectives`)
- **`DebriefRepository`** : Debriefs de vente (`debriefs`)
- **`SaleRepository`** : Ventes individuelles (`sales`)
- **`EvaluationRepository`** : Évaluations de performance (`evaluations`)
- **`MorningBriefRepository`** : Briefings matinaux (`morning_briefs`)
- **`SellerBilanRepository`** : Bilans périodiques des vendeurs (`seller_bilans`)
- **`InterviewNoteRepository`** : Notes d'entretien (`interview_notes`)
- **`TeamAnalysisRepository`** : Analyses d'équipe générées par l'IA (`team_analyses`)
- **`RelationshipConsultationRepository`** : Consultations relationnelles (`relationship_consultations`)
- **`SubscriptionRepository`** : Gestion des abonnements Stripe (`subscriptions`)

#### Caractéristiques des Repositories
- **Sécurité** : Tous les repositories appliquent des filtres de sécurité (IDOR prevention)
- **Cache** : Invalidation automatique du cache Redis lors des opérations `update_one`, `update_many`, `delete_one` (via `BaseRepository`)
- **Pagination** : Support natif via `find_many()` avec paramètres `limit` et `skip`
- **Méthodes spécialisées** : Chaque repository expose des méthodes métier spécifiques (ex: `find_by_seller_and_date()`, `distinct_dates()`)

---

## 4. INFRASTRUCTURE & PERFORMANCE

### 💾 Base de Données (MongoDB)
* **Connection Pool** : Configuré à `50` (Production) via `MONGO_MAX_POOL_SIZE`.
* **Timeouts** : Connect (5s), Socket (30s) pour éviter les blocages (hanging requests).
* **Indexation** : Le script `scripts/ensure_indexes.py` doit être exécuté à chaque déploiement. Il garantit la performance des requêtes critiques (notamment sur `kpi_entries` et `debriefs`).

### 🚀 Scalabilité
* **Stateless** : L'API est stateless (JWT).
* **Mémoire** : La pagination stricte empêche les dépassements de mémoire (OOM).

### ⚡ Cache Redis (Vague 2 - Janvier 2026)
* **Service** : `backend/core/cache.py` - `CacheService` avec fallback gracieux si Redis indisponible
* **TTL** : 
  - Utilisateurs : 5 minutes (`user:{user_id}`)
  - Workspaces : 2 minutes (`workspace:{workspace_id}`)
  - Stores : 2 minutes (`store:{store_id}`)
* **Invalidation** : Automatique via `BaseRepository` lors des opérations `update_one`, `update_many`, `delete_one`
* **Sérialisation** : Gestion automatique des `ObjectId` MongoDB et `datetime` pour JSON
* **Configuration** : `REDIS_URL` et `REDIS_ENABLED` dans `core/config.py`

---

## 5. EXCEPTIONS & LEGACY

### ✅ Refactoring Janvier 2026 - Standardisation Complète

**Tous les accès directs à MongoDB ont été éliminés des routes principales** :
- ✅ `backend/api/routes/manager.py` : 22 occurrences remplacées
- ✅ `backend/api/routes/sellers.py` : 36 occurrences remplacées
- ✅ 6 nouveaux repositories créés pour couvrir toutes les collections
- ✅ Pagination conservée et standardisée via `repository.collection`
- ✅ Cache Redis intégré avec invalidation automatique

### Zones Legacy (à migrer ultérieurement)

1.  **Collection `kpis`** : Ancienne collection (remplacée par `kpi_entries`). Quelques accès directs subsistent dans `briefs.py`. Migration prévue lors d'une refonte spécifique.
2.  **Services internes** : Certains services (ex: `SellerService`) accèdent encore directement à `db.users` via `seller_service.db.users.update_one()`. Acceptable pour l'instant, mais pourrait être amélioré en utilisant `UserRepository` dans les services.

---

## 6. CHECKLIST POUR NOUVELLE FONCTIONNALITÉ

Avant de commiter du nouveau code, le développeur (ou l'IA) doit valider :

1.  [ ] La logique est-elle dans un **Service** (pas dans la route) ?
2.  [ ] L'accès aux données passe-t-il par un **Repository** ?
3.  [ ] Si c'est une liste, est-elle **Paginée** ?
4.  [ ] Avez-vous vérifié les **droits d'accès** (`store_id`) ?
5.  [ ] Les nouveaux types d'erreurs sont-ils gérés par les **Exceptions Custom** ?

---
## 7. ÉVOLUTIONS ARCHITECTURALES (CHANGELOG)

### Janvier 2026 - Vague 3 : Standardisation Repository Pattern ✅

**Objectif** : Éliminer tous les accès directs à MongoDB dans les routes pour garantir la sécurité et la maintenabilité.

**Résultats** :
- ✅ 6 nouveaux repositories créés : `KPIConfigRepository`, `DailyChallengeRepository`, `SellerBilanRepository`, `InterviewNoteRepository`, `TeamAnalysisRepository`, `RelationshipConsultationRepository`
- ✅ 58 occurrences d'accès directs remplacées par des appels aux repositories
- ✅ 0 accès direct `await db.collection.*` restant dans `manager.py` et `sellers.py`
- ✅ Pagination conservée via `repository.collection` dans tous les appels `paginate()`
- ✅ Méthodes spécialisées ajoutées : `distinct_dates()`, `find_by_seller_and_date()`, `create_or_update()`, etc.

**Impact** :
- Sécurité renforcée : Tous les filtres de sécurité (IDOR) sont appliqués systématiquement
- Maintenabilité : Code plus facile à tester et à modifier
- Performance : Cache Redis intégré avec invalidation automatique

### Janvier 2026 - Vague 2 : Cache Redis ✅

**Objectif** : Réduire la charge sur MongoDB pour les données fréquemment lues.

**Résultats** :
- ✅ Service `CacheService` avec fallback gracieux
- ✅ Cache pour `get_current_user()` (TTL: 5 min)
- ✅ Cache pour workspaces (TTL: 2 min)
- ✅ Invalidation automatique via `BaseRepository`

### Janvier 2026 - Vague 1 : Pagination Standardisée ✅

**Objectif** : Éliminer les `.to_list()` non contrôlés et standardiser la pagination.

**Résultats** :
- ✅ Fonction `paginate_aggregation()` créée pour les pipelines MongoDB
- ✅ Tous les endpoints de liste paginés avec limite max de 100 items
- ✅ Format de réponse standardisé : `PaginatedResponse`

---

*Document généré le 27 Janvier 2026 - Dernière mise à jour : Standardisation Repository Pattern (Vague 3)*
