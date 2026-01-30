# 🔧 FIX : ModuleNotFoundError slowapi en production

**Date**: 23 Janvier 2026  
**Problème**: L'application ne démarre pas en production car `slowapi` n'est pas installé

---

## ❌ PROBLÈME IDENTIFIÉ

```
ModuleNotFoundError: No module named 'slowapi'
File "/app/backend/main.py", line 14, in <module>
    from slowapi import Limiter, _rate_limit_exceeded_handler
```

**Cause**:
- `slowapi==0.1.9` était dans `backend/requirements.txt` mais pas dans `requirements.txt` à la racine
- Vercel utilise probablement `requirements.txt` à la racine pour installer les dépendances
- L'import de `slowapi` dans `main.py` était obligatoire, faisant planter l'application

---

## ✅ CORRECTIONS APPLIQUÉES

### 1. Ajout de slowapi dans requirements.txt racine

**Fichier**: `requirements.txt`
```diff
+ slowapi==0.1.9
```

### 2. Import optionnel de slowapi dans main.py

**Fichier**: `backend/main.py`

**Avant** (❌ Crash si slowapi non installé):
```python
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
```

**Après** (✅ Graceful degradation):
```python
# Optional: slowapi for rate limiting (graceful degradation if not installed)
try:
    from slowapi import Limiter, _rate_limit_exceeded_handler
    from slowapi.util import get_remote_address
    from slowapi.errors import RateLimitExceeded
    SLOWAPI_AVAILABLE = True
    print("[STARTUP] 2.1/10 - slowapi imported (rate limiting enabled)", flush=True)
except ImportError:
    SLOWAPI_AVAILABLE = False
    print("[STARTUP] 2.1/10 - WARNING: slowapi not available (rate limiting disabled)", flush=True)
    # Create dummy classes for graceful degradation
    class Limiter:
        def __init__(self, *args, **kwargs):
            pass
        def limit(self, *args, **kwargs):
            def decorator(func):
                return func
            return decorator
    
    class RateLimitExceeded(Exception):
        pass
    
    def _rate_limit_exceeded_handler(*args, **kwargs):
        pass
    
    def get_remote_address(*args, **kwargs):
        return "unknown"
```

### 3. Initialisation conditionnelle du rate limiter

**Fichier**: `backend/main.py`

**Avant** (❌ Crash si slowapi non installé):
```python
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
```

**Après** (✅ Skip si slowapi non disponible):
```python
limiter = None
if SLOWAPI_AVAILABLE:
    try:
        limiter = Limiter(key_func=get_remote_address)
        app.state.limiter = limiter
        app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
        # ... initialization ...
    except Exception as e:
        logger.warning(f"Failed to initialize rate limiter: {e}")
        limiter = None
else:
    logger.warning("Rate limiting disabled: slowapi not installed")
    # Initialize dummy limiter for routes
    from api.dependencies_rate_limiting import init_global_limiter
    init_global_limiter(Limiter(key_func=get_remote_address))
```

### 4. Import optionnel dans dependencies_rate_limiting.py

**Fichier**: `backend/api/dependencies_rate_limiting.py`

**Avant** (❌ Crash si slowapi non installé):
```python
from slowapi import Limiter
from slowapi.util import get_remote_address
```

**Après** (✅ Graceful degradation):
```python
# Optional: slowapi for rate limiting
try:
    from slowapi import Limiter
    from slowapi.util import get_remote_address
    SLOWAPI_AVAILABLE = True
except ImportError:
    SLOWAPI_AVAILABLE = False
    # Create dummy classes for graceful degradation
    class Limiter:
        def __init__(self, *args, **kwargs):
            pass
        def limit(self, *args, **kwargs):
            def decorator(func):
                return func
            return decorator
    
    def get_remote_address(*args, **kwargs):
        return "unknown"
```

### 5. Suppression imports directs dans routes

**Fichiers**: `backend/api/routes/ai.py`, `backend/api/routes/briefs.py`, `backend/api/routes/manager.py`

**Avant** (❌ Import direct):
```python
from slowapi import Limiter
from slowapi.util import get_remote_address
limiter = Limiter(key_func=get_remote_address)
```

**Après** (✅ Utilise get_rate_limiter() qui gère le fallback):
```python
from api.dependencies_rate_limiting import get_rate_limiter
limiter = get_rate_limiter()  # Returns dummy limiter if slowapi not available
```

---

## 📊 COMPORTEMENT

### Avec slowapi installé (Production normale)
- ✅ Rate limiting **ACTIF** (10 req/min IA, 100 req/min lecture)
- ✅ Protection coût OpenAI
- ✅ Protection scraping

### Sans slowapi (Fallback)
- ⚠️ Rate limiting **DÉSACTIVÉ** (pas de protection)
- ✅ Application **DÉMARRE** normalement
- ✅ Tous les endpoints fonctionnent
- ⚠️ Logs d'avertissement dans les logs

---

## 🎯 VALIDATION

### Tests à effectuer

1. **Vérifier que l'application démarre**:
   ```bash
   # Devrait démarrer même sans slowapi
   python -m uvicorn backend.main:app
   ```

2. **Vérifier les logs au démarrage**:
   ```
   [STARTUP] 2.1/10 - slowapi imported (rate limiting enabled)
   # OU
   [STARTUP] 2.1/10 - WARNING: slowapi not available (rate limiting disabled)
   ```

3. **Vérifier que slowapi est dans requirements.txt**:
   ```bash
   grep slowapi requirements.txt
   # Devrait afficher: slowapi==0.1.9
   ```

---

## 📝 FICHIERS MODIFIÉS

1. ✅ `requirements.txt` - Ajout slowapi==0.1.9
2. ✅ `backend/main.py` - Import optionnel + graceful degradation
3. ✅ `backend/api/dependencies_rate_limiting.py` - Import optionnel + dummy classes
4. ✅ `backend/api/routes/ai.py` - Suppression import direct
5. ✅ `backend/api/routes/briefs.py` - Déjà utilise get_rate_limiter()
6. ✅ `backend/api/routes/manager.py` - Déjà utilise get_rate_limiter()

---

## ⚠️ IMPORTANT

**Après le déploiement**, vérifier que slowapi est bien installé en production:

```bash
# Dans les logs Vercel, chercher:
[STARTUP] 2.1/10 - slowapi imported (rate limiting enabled)
```

Si vous voyez le warning, cela signifie que slowapi n'est toujours pas installé. Dans ce cas:
1. Vérifier que `requirements.txt` à la racine contient `slowapi==0.1.9`
2. Forcer un rebuild complet sur Vercel
3. Vérifier que Vercel utilise bien `requirements.txt` pour installer les dépendances Python

---

*Fix appliqué le 23 Janvier 2026*
