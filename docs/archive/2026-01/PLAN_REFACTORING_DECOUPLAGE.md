# 🛠️ PLAN D'ACTION : DÉCOUPLAGE DES SERVICES

**Date**: 23 Janvier 2026  
**Objectif**: Éliminer les couplages forts pour préparer l'extraction en micro-services

---

## 🎯 ACTIONS IMMÉDIATES

### ✅ Action 1 : Créer `NotificationService` (30 min)

**Fichier à créer**: `backend/services/notification_service.py`

```python
"""
Notification Service
Centralized service for achievement notifications
Extracted from SellerService to enable decoupling
"""
from typing import List, Dict
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)


class NotificationService:
    """Service for achievement notifications"""
    
    def __init__(self, db):
        self.db = db
    
    async def add_achievement_notification_flag(
        self, items: List[Dict], user_id: str, item_type: str
    ) -> None:
        """
        Add achievement notification flags to items.
        
        Args:
            items: List of objectives or challenges
            user_id: User ID to check notifications for
            item_type: "objective" or "challenge"
        """
        if not items:
            return
        
        # Get all item IDs
        item_ids = [item.get('id') for item in items if item.get('id')]
        if not item_ids:
            return
        
        # Check which notifications have been seen
        seen_notifications = await self.db.achievement_notifications.find(
            {
                "user_id": user_id,
                "item_type": item_type,
                "item_id": {"$in": item_ids}
            },
            {"_id": 0, "item_id": 1}
        ).to_list(100)
        
        seen_ids = {n.get('item_id') for n in seen_notifications}
        
        # Add flags to items
        for item in items:
            item_id = item.get('id')
            if item_id:
                item['achievement_notification_seen'] = item_id in seen_ids
            else:
                item['achievement_notification_seen'] = False
```

**Fichier à modifier**: `backend/api/dependencies.py`

```python
# Ajouter après les autres dépendances
from services.notification_service import NotificationService

def get_notification_service(
    db: AsyncIOMotorDatabase = Depends(get_db)
) -> NotificationService:
    """Get NotificationService instance"""
    return NotificationService(db)
```

---

### ✅ Action 2 : Modifier `ManagerService` (15 min)

**Fichier à modifier**: `backend/services/manager_service.py`

**Lignes 195-215** - Remplacer:
```python
# ❌ AVANT
async def get_active_objectives(self, manager_id: str, store_id: str) -> List[Dict]:
    from services.seller_service import SellerService
    seller_service = SellerService(self.db)
    
    # ... code ...
    await seller_service.add_achievement_notification_flag(objectives, manager_id, "objective")
```

**Par**:
```python
# ✅ APRÈS
async def get_active_objectives(
    self, 
    manager_id: str, 
    store_id: str,
    notification_service: Optional['NotificationService'] = None
) -> List[Dict]:
    from services.notification_service import NotificationService
    
    # Injection de dépendance avec fallback
    if notification_service is None:
        notification_service = NotificationService(self.db)
    
    # ... code ...
    await notification_service.add_achievement_notification_flag(
        objectives, manager_id, "objective"
    )
```

**Lignes 217-234** - Même modification pour `get_active_challenges()`

**Modifier `__init__`**:
```python
# ✅ Optionnel: Accepter notification_service en injection
def __init__(self, db, notification_service: Optional['NotificationService'] = None):
    self.db = db
    self.user_repo = UserRepository(db)
    self.store_repo = StoreRepository(db)
    self.notification_service = notification_service
```

---

### ✅ Action 3 : Injection de dépendance pour `ConflictService` (10 min)

**Fichier à modifier**: `backend/services/conflict_service.py`

**Ligne 20-22** - Remplacer:
```python
# ❌ AVANT
def __init__(self, db):
    self.db = db
    self.ai_service = AIService()
```

**Par**:
```python
# ✅ APRÈS
def __init__(self, db, ai_service: Optional[AIService] = None):
    self.db = db
    self.ai_service = ai_service or AIService()  # Fallback mais injection possible
```

**Fichier à modifier**: `backend/api/dependencies.py`

```python
# Ajouter après get_ai_service()
from services.conflict_service import ConflictService

def get_conflict_service(
    db: AsyncIOMotorDatabase = Depends(get_db),
    ai_service: AIService = Depends(get_ai_service)
) -> ConflictService:
    """Get ConflictService with injected AIService"""
    return ConflictService(db, ai_service)
```

---

### ✅ Action 4 : Injection de dépendance pour `RelationshipService` (10 min)

**Même modification que `ConflictService`**

**Fichier à modifier**: `backend/services/relationship_service.py`

**Ligne 21-23** - Remplacer:
```python
# ❌ AVANT
def __init__(self, db):
    self.db = db
    self.ai_service = AIService()
```

**Par**:
```python
# ✅ APRÈS
def __init__(self, db, ai_service: Optional[AIService] = None):
    self.db = db
    self.ai_service = ai_service or AIService()
```

**Fichier à modifier**: `backend/api/dependencies.py`

```python
from services.relationship_service import RelationshipService

def get_relationship_service(
    db: AsyncIOMotorDatabase = Depends(get_db),
    ai_service: AIService = Depends(get_ai_service)
) -> RelationshipService:
    """Get RelationshipService with injected AIService"""
    return RelationshipService(db, ai_service)
```

---

### ✅ Action 5 : Remplacer instanciations directes dans routes (30 min)

#### 5.1 `backend/api/routes/debriefs.py` ligne 79

**Remplacer**:
```python
# ❌ AVANT
from services.ai_service import AIService
ai_service = AIService()
```

**Par**:
```python
# ✅ APRÈS
from api.dependencies import get_ai_service

@router.post("/debriefs")
async def create_debrief(
    debrief_data: DebriefCreate,
    current_user: Dict = Depends(get_current_user),
    ai_service: AIService = Depends(get_ai_service),  # ✅ Injection
    db = Depends(get_db)
):
```

#### 5.2 `backend/api/routes/manager.py` lignes 1283, 1444, 1700, 1761, 1818

**Remplacer tous les**:
```python
# ❌ AVANT
from services.seller_service import SellerService
seller_service = SellerService(db)
```

**Par**:
```python
# ✅ APRÈS
# Utiliser la dépendance existante
seller_service: SellerService = Depends(get_seller_service)
```

**Exemple complet**:
```python
# ❌ AVANT
async def some_endpoint(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    from services.seller_service import SellerService
    seller_service = SellerService(db)
    # ...

# ✅ APRÈS
async def some_endpoint(
    current_user: dict = Depends(get_current_user),
    seller_service: SellerService = Depends(get_seller_service),  # ✅
    db = Depends(get_db)
):
    # ...
```

---

## 📋 CHECKLIST DE VALIDATION

### Après chaque action

- [ ] **Action 1**: `NotificationService` créé et testé
- [ ] **Action 2**: `ManagerService` n'importe plus `SellerService`
- [ ] **Action 3**: `ConflictService` accepte `AIService` en injection
- [ ] **Action 4**: `RelationshipService` accepte `AIService` en injection
- [ ] **Action 5**: Toutes les routes utilisent `Depends()`

### Tests à effectuer

```bash
# Vérifier qu'il n'y a plus d'imports inline
grep -r "from services.*import.*Service" backend/services/ --include="*.py" | grep -v "__init__"

# Vérifier qu'il n'y a plus d'instanciations directes dans routes
grep -r "Service()" backend/api/routes/ --include="*.py"

# Vérifier que les dépendances sont utilisées
grep -r "Depends(get_.*_service)" backend/api/routes/ --include="*.py"
```

---

## 🎯 RÉSULTAT ATTENDU

### Avant (Couplage fort)
```
ManagerService → SellerService (import inline)
ConflictService → AIService (instanciation directe)
RelationshipService → AIService (instanciation directe)
Routes → Services (instanciation directe)
```

### Après (Découplage)
```
ManagerService → NotificationService (injection)
ConflictService → AIService (injection)
RelationshipService → AIService (injection)
Routes → Services (Depends())
```

### Score de découplage
- **Avant**: 4/10 ⚠️
- **Après**: 9/10 ✅

---

## ⏱️ ESTIMATION TEMPS TOTAL

- **Action 1**: 30 min
- **Action 2**: 15 min
- **Action 3**: 10 min
- **Action 4**: 10 min
- **Action 5**: 30 min
- **Tests**: 15 min

**Total**: ~2 heures

---

## 🚀 PROCHAINES ÉTAPES (Optionnel)

Une fois le découplage terminé:

1. **Créer interfaces/Protocols** (1h)
2. **Documenter les contrats de service** (30 min)
3. **Préparer l'extraction micro-services** (message queue/API REST)

---

*Plan créé le 23 Janvier 2026*
