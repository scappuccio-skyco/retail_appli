# 🔍 ANALYSE DE DÉCOUPLAGE DES SERVICES - PRÉPARATION MICRO-SERVICES

**Date**: 23 Janvier 2026  
**Objectif**: Identifier les couplages forts entre services et proposer des solutions pour faciliter l'extraction en micro-services

---

## 📊 RÉSUMÉ EXÉCUTIF

### Score de Découplage Actuel: **4/10** ⚠️

**Problèmes identifiés**:
- ❌ **3 services** avec couplage direct (imports inline)
- ❌ **6+ routes** instancient directement des services
- ❌ **2 services** instancient d'autres services dans `__init__`
- ✅ **Architecture Clean** partiellement respectée (repositories utilisés)

**Recommandation**: Refactoring nécessaire avant extraction micro-services

---

## 🔴 COUPLAGES FORTS IDENTIFIÉS

### 1. **manager_service.py** → **seller_service.py** (CRITIQUE)

**Localisation**: `backend/services/manager_service.py` lignes 197-198, 219-220

**Problème**:
```python
async def get_active_objectives(self, manager_id: str, store_id: str) -> List[Dict]:
    from services.seller_service import SellerService  # ❌ Import inline
    seller_service = SellerService(self.db)  # ❌ Instanciation directe
    
    # Utilise seller_service.add_achievement_notification_flag()
    await seller_service.add_achievement_notification_flag(objectives, manager_id, "objective")
```

**Impact**:
- ⚠️ Couplage fort : `ManagerService` dépend directement de `SellerService`
- ⚠️ Impossible d'extraire `SellerService` en micro-service sans casser `ManagerService`
- ⚠️ Violation du principe de dépendance inversée

**Solution recommandée**:
```python
# ✅ Option 1: Interface/Protocol (Python 3.8+)
from typing import Protocol

class AchievementNotifier(Protocol):
    async def add_achievement_notification_flag(
        self, items: List[Dict], user_id: str, item_type: str
    ) -> None:
        ...

class ManagerService:
    def __init__(self, db, achievement_notifier: Optional[AchievementNotifier] = None):
        self.db = db
        self.achievement_notifier = achievement_notifier or SellerService(db)
    
    async def get_active_objectives(self, manager_id: str, store_id: str) -> List[Dict]:
        # ✅ Utilise l'interface injectée
        if self.achievement_notifier:
            await self.achievement_notifier.add_achievement_notification_flag(
                objectives, manager_id, "objective"
            )
```

**Alternative (plus simple)**:
```python
# ✅ Option 2: Extraire la logique dans un service partagé
# Créer backend/services/notification_service.py
class NotificationService:
    async def add_achievement_flags(self, items: List[Dict], user_id: str, item_type: str):
        # Logique extraite de SellerService
        ...

# ManagerService utilise NotificationService
class ManagerService:
    def __init__(self, db, notification_service: Optional[NotificationService] = None):
        self.db = db
        self.notification_service = notification_service or NotificationService(db)
```

---

### 2. **conflict_service.py** → **ai_service.py** (CRITIQUE)

**Localisation**: `backend/services/conflict_service.py` lignes 12, 22

**Problème**:
```python
from services.ai_service import AIService  # ❌ Import direct

class ConflictService:
    def __init__(self, db):
        self.db = db
        self.ai_service = AIService()  # ❌ Instanciation directe dans __init__
```

**Impact**:
- ⚠️ Couplage fort : `ConflictService` dépend directement de `AIService`
- ⚠️ Impossible de mocker `AIService` pour les tests
- ⚠️ Impossible d'extraire `AIService` en micro-service

**Solution recommandée**:
```python
# ✅ Injection de dépendance
class ConflictService:
    def __init__(self, db, ai_service: Optional[AIService] = None):
        self.db = db
        self.ai_service = ai_service or AIService()  # ✅ Fallback mais injection possible
```

**Dans les routes**:
```python
# ✅ backend/api/dependencies.py
def get_conflict_service(
    db = Depends(get_db),
    ai_service: AIService = Depends(get_ai_service)  # ✅ Injection
) -> ConflictService:
    return ConflictService(db, ai_service)
```

---

### 3. **relationship_service.py** → **ai_service.py** (CRITIQUE)

**Localisation**: `backend/services/relationship_service.py` lignes 12, 23

**Problème**: Identique à `conflict_service.py`

**Solution**: Identique (injection de dépendance)

---

### 4. **Routes** → **Services** (Instanciation directe) (MOYEN)

**Localisation**: Plusieurs routes instancient directement des services

**Exemples**:

#### a) `backend/api/routes/debriefs.py` ligne 79
```python
# ❌ Instanciation directe dans la route
from services.ai_service import AIService
ai_service = AIService()
```

#### b) `backend/api/routes/manager.py` lignes 1283, 1444, 1700, 1761, 1818
```python
# ❌ Instanciation directe dans les routes
from services.seller_service import SellerService
seller_service = SellerService(db)
```

**Impact**:
- ⚠️ Violation de l'injection de dépendance
- ⚠️ Impossible de mocker pour les tests
- ⚠️ Duplication de code

**Solution recommandée**:
```python
# ✅ Utiliser les dépendances FastAPI
# backend/api/dependencies.py
def get_seller_service(db = Depends(get_db)) -> SellerService:
    return SellerService(db)

# Dans les routes
@router.get("/endpoint")
async def endpoint(
    seller_service: SellerService = Depends(get_seller_service)  # ✅ Injection
):
    ...
```

---

## ✅ BONNES PRATIQUES IDENTIFIÉES

### 1. **Architecture Clean partiellement respectée**

**Services utilisent des repositories**:
- ✅ `ManagerService` utilise `UserRepository`, `StoreRepository`
- ✅ `GerantService` utilise `UserRepository`, `StoreRepository`
- ✅ `StoreService` utilise `StoreRepository`, `WorkspaceRepository`
- ✅ `KPIService` utilise `KPIRepository`, `ManagerKPIRepository`

**Impact positif**: Les services ne dépendent pas directement de MongoDB, facilitant l'extraction

### 2. **Injection de dépendance dans certaines routes**

**Exemples**:
```python
# ✅ backend/api/routes/manager.py
@router.get("/sellers")
async def get_sellers(
    manager_service: ManagerService = Depends(get_manager_service)  # ✅ Bon
):
    ...
```

---

## 📋 PLAN DE REFACTORING RECOMMANDÉ

### Phase 1: Découplage des Services (Priorité HAUTE)

#### 1.1 Créer `NotificationService`
- ✅ Extraire `add_achievement_notification_flag()` de `SellerService`
- ✅ Créer `backend/services/notification_service.py`
- ✅ `ManagerService` utilise `NotificationService` (injection)

#### 1.2 Injection de dépendance pour `AIService`
- ✅ Modifier `ConflictService.__init__()` pour accepter `ai_service: Optional[AIService]`
- ✅ Modifier `RelationshipService.__init__()` pour accepter `ai_service: Optional[AIService]`
- ✅ Créer dépendances FastAPI dans `api/dependencies.py`

#### 1.3 Éliminer imports inline dans `ManagerService`
- ✅ Remplacer imports inline par injection de dépendance
- ✅ Utiliser `NotificationService` au lieu de `SellerService`

**Estimation**: 2-3 heures

---

### Phase 2: Découplage des Routes (Priorité MOYENNE)

#### 2.1 Créer toutes les dépendances manquantes
- ✅ `get_seller_service()` dans `api/dependencies.py`
- ✅ `get_conflict_service()` avec injection `AIService`
- ✅ `get_relationship_service()` avec injection `AIService`

#### 2.2 Remplacer instanciations directes dans routes
- ✅ `backend/api/routes/debriefs.py` ligne 79
- ✅ `backend/api/routes/manager.py` lignes 1283, 1444, 1700, 1761, 1818

**Estimation**: 1-2 heures

---

### Phase 3: Interfaces/Protocols (Priorité BASSE - Optionnel)

#### 3.1 Créer interfaces pour services partagés
```python
# backend/services/interfaces.py
from typing import Protocol

class IAIService(Protocol):
    async def generate_diagnostic(self, ...) -> Dict:
        ...
    
    async def _send_message(self, ...) -> str:
        ...

class INotificationService(Protocol):
    async def add_achievement_flags(self, ...) -> None:
        ...
```

**Estimation**: 1 heure

---

## 🎯 ARCHITECTURE CIBLE (Micro-Services Ready)

### Structure recommandée

```
backend/
├── services/
│   ├── interfaces.py          # ✅ Protocols/Interfaces
│   ├── notification_service.py  # ✅ Service partagé
│   ├── manager_service.py    # ✅ Utilise NotificationService (injection)
│   ├── seller_service.py     # ✅ Indépendant
│   ├── conflict_service.py   # ✅ Utilise AIService (injection)
│   └── relationship_service.py # ✅ Utilise AIService (injection)
│
├── api/
│   ├── dependencies.py       # ✅ Toutes les dépendances centralisées
│   └── routes/
│       ├── manager.py        # ✅ Utilise Depends() uniquement
│       └── debriefs.py       # ✅ Utilise Depends() uniquement
```

### Communication entre services (futur micro-services)

**Option 1: Message Queue (RabbitMQ/Kafka)**
```python
# Service A publie un événement
await event_bus.publish("achievement.notified", {
    "user_id": user_id,
    "item_type": "objective",
    "item_id": item_id
})

# Service B écoute l'événement
@event_bus.subscribe("achievement.notified")
async def handle_achievement(data):
    ...
```

**Option 2: API REST (Service Mesh)**
```python
# Service A appelle Service B via HTTP
async def notify_achievement(user_id: str, item_type: str, item_id: str):
    async with httpx.AsyncClient() as client:
        await client.post(
            f"{NOTIFICATION_SERVICE_URL}/achievements",
            json={"user_id": user_id, "item_type": item_type, "item_id": item_id}
        )
```

**Option 3: gRPC (Performance)**
```python
# Service A appelle Service B via gRPC
stub = NotificationServiceStub(channel)
await stub.NotifyAchievement(AchievementRequest(...))
```

---

## 📊 MÉTRIQUES DE DÉCOUPLAGE

| Métrique | Avant | Après Phase 1 | Après Phase 2 | Cible |
|----------|-------|---------------|----------------|-------|
| **Couplages directs** | 5 | 2 | 0 | 0 |
| **Imports inline** | 3 | 0 | 0 | 0 |
| **Instanciations routes** | 6+ | 6+ | 0 | 0 |
| **Injection dépendances** | 60% | 80% | 100% | 100% |
| **Score découplage** | 4/10 | 7/10 | 9/10 | 10/10 |

---

## ✅ CHECKLIST DE VALIDATION

### Après Phase 1
- [ ] `ManagerService` n'importe plus `SellerService`
- [ ] `ConflictService` accepte `AIService` en injection
- [ ] `RelationshipService` accepte `AIService` en injection
- [ ] `NotificationService` créé et utilisé

### Après Phase 2
- [ ] Toutes les routes utilisent `Depends()` pour les services
- [ ] Aucune instanciation directe dans les routes
- [ ] Tous les tests passent

### Après Phase 3 (Optionnel)
- [ ] Interfaces/Protocols définis
- [ ] Services implémentent les interfaces
- [ ] Documentation des contrats

---

## 🚀 PROCHAINES ÉTAPES

1. **Immédiat**: Implémenter Phase 1 (découplage services)
2. **Court terme**: Implémenter Phase 2 (découplage routes)
3. **Moyen terme**: Implémenter Phase 3 (interfaces)
4. **Long terme**: Extraire services en micro-services avec message queue/API REST

---

## 📝 NOTES TECHNIQUES

### Pourquoi éviter les imports inline ?

**Problème**:
```python
async def method(self):
    from services.other_service import OtherService  # ❌
    service = OtherService(self.db)
```

**Raisons**:
1. **Couplage fort**: Impossible de mocker pour tests
2. **Performance**: Import à chaque appel de méthode
3. **Dépendances circulaires**: Risque de deadlock
4. **Extraction impossible**: Micro-service ne peut pas être extrait

### Pourquoi utiliser l'injection de dépendance ?

**Avantages**:
1. **Testabilité**: Facile de mocker les dépendances
2. **Flexibilité**: Peut changer l'implémentation sans modifier le code
3. **Découplage**: Services indépendants
4. **Extraction**: Facile d'extraire en micro-service (remplacer par HTTP/gRPC)

---

*Analyse effectuée le 23 Janvier 2026*
