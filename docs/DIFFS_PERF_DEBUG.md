# Diffs Complets - Mode Debug Performance

**Date** : 2025-01-XX  
**Objectif** : Ajouter un compteur d'opérations DB pour prouver que le nombre est fixe

---

## 📝 Fichiers Modifiés

### 1. `backend/utils/db_counter.py` (NOUVEAU)

**Fichier créé** : Helper pour compter les opérations DB

```python
"""
DB Operations Counter - Debug Mode
Temporaire: activé uniquement si PERF_DEBUG=true
Compte les opérations DB pour prouver que le nombre est fixe (indépendant de N)
"""
import os
from contextvars import ContextVar
from typing import Optional
from core.logging import request_id_var

# Context variable pour stocker le compteur par requête (thread-safe)
_db_ops_counter: ContextVar[Optional[int]] = ContextVar('db_ops_counter', default=None)

PERF_DEBUG_ENABLED = os.getenv('PERF_DEBUG', 'false').lower() == 'true'


def init_counter():
    """Initialise le compteur pour une nouvelle requête"""
    if PERF_DEBUG_ENABLED:
        _db_ops_counter.set(0)


def increment_db_op(operation: str = "unknown"):
    """Incrémente le compteur d'opérations DB"""
    if PERF_DEBUG_ENABLED:
        counter = _db_ops_counter.get()
        if counter is not None:
            _db_ops_counter.set(counter + 1)


def get_db_ops_count() -> int:
    """Retourne le nombre d'opérations DB pour la requête actuelle"""
    if PERF_DEBUG_ENABLED:
        counter = _db_ops_counter.get()
        return counter if counter is not None else 0
    return 0


def get_request_id() -> Optional[str]:
    """Retourne le request_id de la requête actuelle"""
    if PERF_DEBUG_ENABLED:
        return request_id_var.get()
    return None


def reset_counter():
    """Réinitialise le compteur (pour nettoyage)"""
    if PERF_DEBUG_ENABLED:
        _db_ops_counter.set(0)
```

---

### 2. `backend/api/routes/manager.py`

#### Modification 1 : `get_all_objectives()`

**Avant** :
```python
@router.get("/objectives")
async def get_all_objectives(...):
    import time
    start_time = time.time()
    
    try:
        resolved_store_id = context.get('resolved_store_id')
        manager_id = context.get('id')
        
        objectives = await db.objectives.find(...).to_list(100)
```

**Après** :
```python
@router.get("/objectives")
async def get_all_objectives(...):
    import time
    from utils.db_counter import init_counter, increment_db_op, get_db_ops_count, get_request_id
    
    start_time = time.time()
    
    # Initialize DB operations counter (PERF_DEBUG mode)
    init_counter()
    
    try:
        resolved_store_id = context.get('resolved_store_id')
        manager_id = context.get('id')
        
        increment_db_op("db.objectives.find")
        objectives = await db.objectives.find(...).to_list(100)
```

#### Modification 2 : Log final de `get_all_objectives()`

**Avant** :
```python
        logger.info(
            f"get_all_objectives completed",
            extra={
                'endpoint': '/api/manager/objectives',
                'objectives_count': len(objectives),
                'duration_ms': round(duration_ms, 2),
                'store_id': resolved_store_id,
                'manager_id': manager_id
            }
        )
```

**Après** :
```python
        duration_ms = (time.time() - start_time) * 1000
        db_ops_count = get_db_ops_count()
        request_id = get_request_id()
        
        log_extra = {
            'endpoint': '/api/manager/objectives',
            'objectives_count': len(objectives),
            'duration_ms': round(duration_ms, 2),
            'store_id': resolved_store_id,
            'manager_id': manager_id
        }
        
        # Add PERF_DEBUG metrics if enabled
        if db_ops_count > 0:
            log_extra['db_ops_count'] = db_ops_count
            if request_id:
                log_extra['request_id'] = request_id
        
        logger.info(
            f"get_all_objectives completed",
            extra=log_extra
        )
```

#### Modification 3 : `get_all_challenges()`

**Avant** :
```python
@router.get("/challenges")
async def get_all_challenges(...):
    import time
    start_time = time.time()
    
    try:
        resolved_store_id = context.get('resolved_store_id')
        manager_id = context.get('id')
        
        challenges = await db.challenges.find(...).to_list(100)
```

**Après** :
```python
@router.get("/challenges")
async def get_all_challenges(...):
    import time
    from utils.db_counter import init_counter, increment_db_op, get_db_ops_count, get_request_id
    
    start_time = time.time()
    
    # Initialize DB operations counter (PERF_DEBUG mode)
    init_counter()
    
    try:
        resolved_store_id = context.get('resolved_store_id')
        manager_id = context.get('id')
        
        increment_db_op("db.challenges.find")
        challenges = await db.challenges.find(...).to_list(100)
```

#### Modification 4 : Log final de `get_all_challenges()`

**Avant** :
```python
        logger.info(
            f"get_all_challenges completed",
            extra={
                'endpoint': '/api/manager/challenges',
                'challenges_count': len(enriched_challenges),
                'duration_ms': round(duration_ms, 2),
                'store_id': resolved_store_id,
                'manager_id': manager_id
            }
        )
```

**Après** :
```python
        duration_ms = (time.time() - start_time) * 1000
        db_ops_count = get_db_ops_count()
        request_id = get_request_id()
        
        log_extra = {
            'endpoint': '/api/manager/challenges',
            'challenges_count': len(enriched_challenges),
            'duration_ms': round(duration_ms, 2),
            'store_id': resolved_store_id,
            'manager_id': manager_id
        }
        
        # Add PERF_DEBUG metrics if enabled
        if db_ops_count > 0:
            log_extra['db_ops_count'] = db_ops_count
            if request_id:
                log_extra['request_id'] = request_id
        
        logger.info(
            f"get_all_challenges completed",
            extra=log_extra
        )
```

---

### 3. `backend/services/seller_service.py`

#### Modification 1 : `calculate_objectives_progress_batch()`

**Ajout de `increment_db_op()` avant chaque opération DB** :

```python
        # Get all sellers for this store/manager (1 query)
        from utils.db_counter import increment_db_op
        
        seller_query = {"role": "seller"}
        ...
        
        increment_db_op("db.users.find (sellers - objectives)")
        sellers = await self.db.users.find(...).to_list(1000)
        
        ...
        
        increment_db_op("db.kpi_entries.find (batch - objectives)")
        all_kpi_entries = await self.db.kpi_entries.find(...).to_list(100000)
        
        ...
        
        increment_db_op("db.manager_kpis.find (batch - objectives)")
        all_manager_kpis = await self.db.manager_kpis.find(...).to_list(100000)
        
        ...
        
        if bulk_ops:
            increment_db_op("db.manager_objectives.bulk_write")
            await self.db.manager_objectives.bulk_write(bulk_ops)
```

#### Modification 2 : `calculate_challenges_progress_batch()`

**Ajout de `increment_db_op()` avant chaque opération DB** :

```python
        # Get all sellers for this store/manager (1 query)
        from utils.db_counter import increment_db_op
        
        seller_query = {"role": "seller"}
        ...
        
        increment_db_op("db.users.find (sellers - challenges)")
        sellers = await self.db.users.find(...).to_list(1000)
        
        ...
        
        increment_db_op("db.kpi_entries.find (batch - challenges)")
        all_kpi_entries = await self.db.kpi_entries.find(...).to_list(100000)
        
        ...
        
        increment_db_op("db.manager_kpis.find (batch - challenges)")
        all_manager_kpis = await self.db.manager_kpis.find(...).to_list(100000)
        
        ...
        
        if bulk_ops:
            increment_db_op("db.challenges.bulk_write")
            await self.db.challenges.bulk_write(bulk_ops)
```

---

## ✅ Résumé des Modifications

### Fichiers Créés
- ✅ `backend/utils/db_counter.py` (nouveau fichier)

### Fichiers Modifiés
- ✅ `backend/api/routes/manager.py` (2 endpoints modifiés)
- ✅ `backend/services/seller_service.py` (2 fonctions batch modifiées)

### Lignes Ajoutées
- ~150 lignes de code (principalement imports et appels `increment_db_op()`)

### Impact Performance
- **Aucun impact si `PERF_DEBUG=false`** (vérification conditionnelle)
- **Impact minimal si `PERF_DEBUG=true`** (incrémentation d'un compteur en mémoire)

---

**Fin du document**

