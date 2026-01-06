# Mode Debug Performance - Compteur d'Opérations DB

**Date** : 2025-01-XX  
**Objectif** : Prouver factuellement que les endpoints `GET /manager/objectives` et `GET /manager/challenges` font un nombre **fixe** de requêtes DB (indépendant de N).

---

## 🎯 Activation du Mode Debug

### Variable d'Environnement

Le mode debug est activé via la variable d'environnement `PERF_DEBUG` :

```bash
# Activer le mode debug
export PERF_DEBUG=true

# Désactiver le mode debug (par défaut)
export PERF_DEBUG=false
# ou simplement ne pas définir la variable
```

### Dans Docker / Production

```bash
# Activer temporairement pour tests
docker run -e PERF_DEBUG=true ...

# Ou dans docker-compose.yml
environment:
  - PERF_DEBUG=true
```

---

## 📊 Ce qui est Compté

Le compteur `db_ops_count` incrémente **avant chaque opération DB** :

### GET /manager/objectives

1. ✅ `db.objectives.find()` - Récupération de tous les objectifs
2. ✅ `db.users.find()` - Récupération de tous les sellers (dans `calculate_objectives_progress_batch`)
3. ✅ `db.kpi_entries.find()` - Récupération de toutes les KPI entries (batch)
4. ✅ `db.manager_kpis.find()` - Récupération de tous les manager KPIs (batch)
5. ✅ `db.manager_objectives.bulk_write()` - Mise à jour bulk de tous les objectifs

**Total attendu** : **5 opérations DB** (fixe, indépendant du nombre d'objectifs N)

### GET /manager/challenges

1. ✅ `db.challenges.find()` - Récupération de tous les challenges
2. ✅ `db.users.find()` - Récupération de tous les sellers (dans `calculate_challenges_progress_batch`)
3. ✅ `db.kpi_entries.find()` - Récupération de toutes les KPI entries (batch)
4. ✅ `db.manager_kpis.find()` - Récupération de tous les manager KPIs (batch)
5. ✅ `db.challenges.bulk_write()` - Mise à jour bulk de tous les challenges

**Total attendu** : **5 opérations DB** (fixe, indépendant du nombre de challenges N)

---

## 📝 Exemple de Log Attendu

### GET /manager/objectives (avec 10 objectifs)

```json
{
  "timestamp": "2025-01-XX 10:30:45,123",
  "level": "INFO",
  "logger": "api.routes.manager",
  "message": "get_all_objectives completed",
  "request_id": "a1b2c3d4",
  "endpoint": "/api/manager/objectives",
  "objectives_count": 10,
  "duration_ms": 125.5,
  "store_id": "store_123",
  "manager_id": "manager_456",
  "db_ops_count": 5
}
```

**Vérification** : `db_ops_count = 5` (fixe) même avec `objectives_count = 10` ✅

### GET /manager/challenges (avec 8 challenges)

```json
{
  "timestamp": "2025-01-XX 10:31:12,456",
  "level": "INFO",
  "logger": "api.routes.manager",
  "message": "get_all_challenges completed",
  "request_id": "e5f6g7h8",
  "endpoint": "/api/manager/challenges",
  "challenges_count": 8,
  "duration_ms": 98.3,
  "store_id": "store_123",
  "manager_id": "manager_456",
  "db_ops_count": 5
}
```

**Vérification** : `db_ops_count = 5` (fixe) même avec `challenges_count = 8` ✅

### GET /manager/objectives (avec 100 objectifs)

```json
{
  "timestamp": "2025-01-XX 10:32:00,789",
  "level": "INFO",
  "logger": "api.routes.manager",
  "message": "get_all_objectives completed",
  "request_id": "i9j0k1l2",
  "endpoint": "/api/manager/objectives",
  "objectives_count": 100,
  "duration_ms": 145.2,
  "store_id": "store_123",
  "manager_id": "manager_456",
  "db_ops_count": 5
}
```

**Vérification** : `db_ops_count = 5` (fixe) même avec `objectives_count = 100` ✅

**Conclusion** : Le nombre d'opérations DB (`db_ops_count`) reste **constant** (5) quel que soit le nombre d'objectifs/challenges, prouvant que le nombre de requêtes DB est **fixe** et **indépendant de N**.

---

## ✅ Vérification

### Test avec N=1

```bash
# Créer 1 objectif, puis appeler GET /manager/objectives
# Résultat attendu : db_ops_count = 5
```

### Test avec N=10

```bash
# Créer 10 objectifs, puis appeler GET /manager/objectives
# Résultat attendu : db_ops_count = 5 (identique à N=1)
```

### Test avec N=100

```bash
# Créer 100 objectifs, puis appeler GET /manager/objectives
# Résultat attendu : db_ops_count = 5 (identique à N=1 et N=10)
```

**Conclusion** : Si `db_ops_count` reste **constant** (5) quel que soit N, cela prouve que le nombre de requêtes DB est **fixe** et **indépendant de N**. ✅

---

## 🔍 Fichiers Modifiés

### 1. `backend/utils/db_counter.py` (NOUVEAU)
- Helper pour compter les opérations DB
- Utilise `contextvars` pour thread-safety
- Activé uniquement si `PERF_DEBUG=true`

### 2. `backend/api/routes/manager.py`
- `get_all_objectives()` : Initialise le compteur et incrémente avant `db.objectives.find()`
- `get_all_challenges()` : Initialise le compteur et incrémente avant `db.challenges.find()`
- Log final inclut `db_ops_count` et `request_id` si PERF_DEBUG activé

### 3. `backend/services/seller_service.py`
- `calculate_objectives_progress_batch()` : Incrémente le compteur avant chaque opération DB
- `calculate_challenges_progress_batch()` : Incrémente le compteur avant chaque opération DB

---

## 🚨 Important

**Ce mode debug est TEMPORAIRE** et doit être :
- ✅ Activé uniquement pour tests/validation
- ❌ Désactivé en production (impact performance minimal mais évitable)
- 🗑️ Supprimé après validation (ou gardé pour monitoring optionnel)

---

## 📋 Checklist de Validation

- [ ] Activer `PERF_DEBUG=true`
- [ ] Tester avec N=1 objectif/challenge → vérifier `db_ops_count = 5`
- [ ] Tester avec N=10 objectifs/challenges → vérifier `db_ops_count = 5`
- [ ] Tester avec N=100 objectifs/challenges → vérifier `db_ops_count = 5`
- [ ] Vérifier que `db_ops_count` ne dépend **pas** de `objectives_count` / `challenges_count`
- [ ] Désactiver `PERF_DEBUG=false` après validation

---

**Fin du document**

