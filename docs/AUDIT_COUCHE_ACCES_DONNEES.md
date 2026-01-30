# Audit – Couche d'accès aux données

**Date :** 30 janvier 2025  
**Périmètre :** Connexions / pool, index MongoDB, protection contre les injections.  
**Stack :** MongoDB + Motor (async), FastAPI, `Depends(get_db)`.

---

## 1. Connexions : fermeture et réutilisation (pooling)

### Statut : **Validé**

- **Pool MongoDB (Motor)**  
  - `core/database.py` : un seul `AsyncIOMotorClient` (singleton) avec :
    - `maxPoolSize` / `minPoolSize` (config : 50 / 1),
    - `connectTimeoutMS`, `socketTimeoutMS`, `serverSelectionTimeoutMS`,
    - `retryWrites=True`, `retryReads=True`.
  - Les requêtes réutilisent ce client ; le driver gère le pool. Aucune ouverture/fermeture de connexion par requête.

- **Cycle de vie**  
  - `core/lifespan.py` : `database.connect()` au startup (avec retry), `database.disconnect()` au shutdown.  
  - `get_db()` retourne toujours la même instance `database.get_database()` (pas de fuite de connexions).

- **Fermeture**  
  - À l’arrêt de l’appli, `database.disconnect()` appelle `self.client.close()`, ce qui ferme correctement le client et le pool Motor.

**Conclusion :** Les connexions sont bien réutilisées via le pool et correctement fermées au shutdown.

---

## 2. Index manquants pour les recherches fréquentes

### Statut : **À compléter (recommandations)**

Source d’index analysée : `core/indexes.py` (utilisée par le lifespan et `scripts/ensure_indexes.py`).

#### Déjà bien couvert

- **users :** `id`, `(store_id, role, status)`, `(store_id, role)`, `stripe_customer_id`
- **workspaces :** `id`, `gerant_id`, `stripe_customer_id`
- **subscriptions, kpi_entries, objectives, challenges, sales, debriefs, diagnostics, manager_kpis** : index cohérents avec les usages (store_id, seller_id, date, status, etc.)

#### Index recommandés (recherches fréquentes)

| Collection | Champ(s) | Usage | Recommandation |
|------------|----------|--------|----------------|
| **users** | `email` | `find_by_email()` (auth à chaque login) | Index simple, idéalement **unique** (contrainte + performance). |
| **users** | `gerant_id` | `find_by_gerant()`, `count_by_gerant()`, `find_by_role(gerant_id=...)` | Index simple pour éviter les scans complets. |
| **users** | `manager_id` | `find_by_manager()` (vendeurs sous un manager) | Index simple si volume important. |
| **stores** | (collection absente de `INDEXES`) | `find_by_gerant(gerant_id)`, `find_by_id` | Ajouter la collection **stores** avec au moins un index sur `gerant_id` (recherche fréquente). |

- **objectives :** Dans `core/indexes.py` il n’y a que `(store_id, status)` et `(seller_id, status)`. Le script `init_db_indexes.py` crée en plus `(manager_id, period_start)` et `(store_id, period_start, period_end)`. Pour une seule source de vérité, il serait préférable de centraliser ces index dans `core/indexes.py`.

**Conclusion :** La persistance reste stable sans ces index, mais pour des recherches fréquentes (auth, listes par gérant/manager, magasins par gérant), ajouter les index ci‑dessus améliore les perfs et évite des scans complets. Aucun changement de logique métier requis.

---

## 3. Protection contre les injections (type “SQL”)

### Statut : **Validé**

- **Pas de SQL :** Persistance MongoDB uniquement ; pas de requêtes SQL brutes, donc pas d’injection SQL classique.

- **Requêtes MongoDB :**  
  - Tous les usages vus passent par des **dictionnaires** (filtres, `$set`, pipelines d’aggregation) construits en code (p.ex. `{"id": user_id}`, `{"email": email}`, `{"gerant_id": gerant_id}`).  
  - Aucune concaténation de chaînes utilisateur dans des filtres (pas de `f"..."` ou `%` pour construire des requêtes).  
  - Aucun usage de `$where` / `eval` avec entrée utilisateur repéré dans les repositories.

- **Couche Repository :**  
  - `BaseRepository` : `find_one(filters)`, `find_many(filters, ...)`, `aggregate(pipeline)` avec des `Dict` ; les services injectent des valeurs, pas des fragments de requête.

**Conclusion :** Les requêtes sont protégées contre les injections (BSON + filtres paramétrés par structure, pas par chaîne). Aucune modification de logique métier nécessaire pour la sécurité.

---

## Synthèse

| Critère | Statut | Commentaire |
|--------|--------|-------------|
| Connexions fermées / réutilisées (pooling) | OK | Pool Motor, singleton, connect/disconnect dans le lifespan. |
| Index pour recherches fréquentes | À compléter | Recommandations : `users.email`, `users.gerant_id` (et évent. `manager_id`), `stores.gerant_id` ; centraliser objectifs dans `core/indexes.py` si souhaité. |
| Requêtes protégées contre les injections | OK | MongoDB + filtres en dictionnaires, pas de concaténation ni `$where`/eval. |

**Verdict :**  
- **Connexions** et **sécurité des requêtes** sont validées ; la persistance des données peut être considérée **stable** sur ces deux points.  
- La **stabilité fonctionnelle** n’est pas remise en cause par l’absence des index recommandés ; leur ajout relève de l’optimisation (performance et scalabilité) sans toucher à la logique métier.

---

## Mise à jour post-audit (index production)

Modifications appliquées dans `core/indexes.py` et nettoyage de `init_db_indexes.py` :

- **Contrainte d’unicité** : `users.email` → index **UNIQUE** (`email_unique`), critique pour éviter les doublons de comptes.
- **Optimisation** : index simples `users.gerant_id` (`gerant_id_idx`), collection **stores** ajoutée avec `id` (unique) et `gerant_id` (`gerant_id_idx`).
- **Centralisation** : index **objectives** `manager_period_start_idx` et `store_period_idx` centralisés dans `core/indexes.py` ; doublons retirés de `init_db_indexes.py`.

**Structure prête pour la production** : une seule source de vérité (`core/indexes.py`), appliquée au démarrage via le lifespan et via `python -m backend.scripts.ensure_indexes`.
