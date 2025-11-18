# 🏪 Plan d'Implémentation - Architecture Multi-Magasins

## 📅 Date de sauvegarde : 2025-11-18
## 📦 Backup : `/app/backups/pre-multi-store-20251118_164850/`

---

## 🎯 Objectifs

1. Ajouter un rôle "Gérant" qui peut gérer plusieurs magasins
2. Un gérant peut AUSSI être manager d'un magasin spécifique (double rôle)
3. Permettre au gérant de créer/supprimer des magasins (avec validation stricte)
4. Migrer les données actuelles vers plusieurs magasins fictifs

---

## 🗄️ Modifications du Modèle de Données

### 1. Nouvelle Collection : `stores`

```python
class Store(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str  # ex: "Skyco Paris Centre"
    location: str  # ex: "75001 Paris"
    gerant_id: str  # ID du gérant propriétaire
    active: bool = True
    address: Optional[str] = None
    phone: Optional[str] = None
    opening_hours: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
```

### 2. Modification Collection `users`

**Nouveaux champs :**
- `role`: Ajouter "gerant" aux valeurs possibles
- `store_id`: ID du magasin (obligatoire pour manager/seller)
- `gerant_id`: ID du gérant (null si role = gerant)
- `is_also_manager`: Boolean - True si le gérant gère aussi directement un magasin
- `managed_store_id`: ID du magasin qu'il manage (si is_also_manager = True)

**Structure :**
```python
class User(BaseModel):
    id: str
    email: str
    password: str
    name: str
    role: str  # "gerant" | "manager" | "seller"
    
    # Hiérarchie
    gerant_id: Optional[str] = None  # null si role = gerant
    store_id: Optional[str] = None   # Magasin d'affectation
    manager_id: Optional[str] = None # null si role != seller
    
    # Double rôle pour gérant
    is_also_manager: bool = False
    managed_store_id: Optional[str] = None
    
    # Métadonnées
    created_at: str
    customer_id: Optional[str] = None
```

### 3. Modification Collections KPIs

**Ajouter à :**
- `kpi_entries`
- `kpis`
- `objectives`
- `challenges`

**Nouveaux champs :**
```python
store_id: str  # ID du magasin
gerant_id: str # ID du gérant
```

---

## 🚀 Phase 1 : Backend - Création du Modèle

### Étape 1.1 : Modèles Pydantic

**Fichier :** `backend/server.py`

```python
# Nouveau modèle Store
class Store(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    location: str
    gerant_id: str
    active: bool = True
    address: Optional[str] = None
    phone: Optional[str] = None
    opening_hours: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    
    model_config = ConfigDict(populate_by_name=True)

class StoreCreate(BaseModel):
    name: str
    location: str
    address: Optional[str] = None
    phone: Optional[str] = None
    opening_hours: Optional[str] = None

class StoreUpdate(BaseModel):
    name: Optional[str] = None
    location: Optional[str] = None
    active: Optional[bool] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    opening_hours: Optional[str] = None
```

### Étape 1.2 : Endpoints API Gérant

**Routes à créer :**

```python
# --- STORES MANAGEMENT ---
@api_router.post("/gerant/stores")
async def create_store(store: StoreCreate, current_user: dict = Depends(get_current_user))

@api_router.get("/gerant/stores")
async def get_gerant_stores(current_user: dict = Depends(get_current_user))

@api_router.get("/gerant/stores/{store_id}")
async def get_store_details(store_id: str, current_user: dict = Depends(get_current_user))

@api_router.put("/gerant/stores/{store_id}")
async def update_store(store_id: str, store_update: StoreUpdate, current_user: dict = Depends(get_current_user))

@api_router.delete("/gerant/stores/{store_id}")
async def delete_store(store_id: str, current_user: dict = Depends(get_current_user))

# --- DASHBOARD GERANT ---
@api_router.get("/gerant/dashboard/stats")
async def get_gerant_dashboard_stats(current_user: dict = Depends(get_current_user))

@api_router.get("/gerant/stores/{store_id}/stats")
async def get_store_stats(store_id: str, current_user: dict = Depends(get_current_user))

@api_router.get("/gerant/stores/{store_id}/managers")
async def get_store_managers(store_id: str, current_user: dict = Depends(get_current_user))

@api_router.get("/gerant/stores/{store_id}/sellers")
async def get_store_sellers(store_id: str, current_user: dict = Depends(get_current_user))

# --- MANAGERS ASSIGNMENT & TRANSFER ---
@api_router.post("/gerant/stores/{store_id}/assign-manager")
async def assign_manager_to_store(store_id: str, manager_email: str, current_user: dict = Depends(get_current_user))

@api_router.post("/gerant/stores/{store_id}/remove-manager")
async def remove_manager_from_store(store_id: str, manager_id: str, current_user: dict = Depends(get_current_user))

@api_router.post("/gerant/managers/{manager_id}/transfer")
async def transfer_manager_to_store(
    manager_id: str, 
    new_store_id: str, 
    transfer_sellers: bool,  # True = vendeurs suivent, False = vendeurs restent
    current_user: dict = Depends(get_current_user)
)

@api_router.get("/gerant/managers")
async def get_all_managers(current_user: dict = Depends(get_current_user))

@api_router.get("/gerant/managers/{manager_id}/sellers")
async def get_manager_sellers(manager_id: str, current_user: dict = Depends(get_current_user))
```

---

## 🎨 Phase 2 : Frontend - Interface Gérant

### Étape 2.1 : Nouveau Dashboard Gérant

**Fichier :** `frontend/src/pages/GerantDashboard.js`

**Composants principaux :**
1. Header avec switch "Vue Gérant" / "Vue Manager" (si is_also_manager = true)
2. Carte KPIs globaux (tous magasins)
3. Liste des magasins (StoreCard)
4. Bouton "Créer un nouveau magasin"
5. Graphiques de comparaison inter-magasins

### Étape 2.2 : Composants à créer

**`frontend/src/components/gerant/`**
- `StoreCard.js` - Carte d'un magasin
- `StoreDetailModal.js` - Vue détaillée d'un magasin
- `CreateStoreModal.js` - Formulaire création magasin
- `DeleteStoreConfirmation.js` - Validation stricte pour suppression
- `StoreComparisonChart.js` - Comparaison inter-magasins
- `RoleSwitcher.js` - Bouton pour switch Gérant/Manager

---

## 🔄 Phase 3 : Migration des Données

### Script de Migration : `backend/migrate_to_multi_store.py`

**Étapes :**
1. Créer 3 magasins fictifs
2. Répartir les managers actuels entre ces magasins
3. Assigner les vendeurs aux magasins de leurs managers
4. Ajouter `store_id` et `gerant_id` à tous les KPIs
5. Créer un utilisateur gérant par défaut

**Magasins fictifs proposés :**
```python
stores = [
    {
        "name": "Skyco Paris Centre",
        "location": "75001 Paris",
        "address": "123 Rue de Rivoli, 75001 Paris"
    },
    {
        "name": "Skyco Lyon Part-Dieu",
        "location": "69003 Lyon",
        "address": "45 Rue de la République, 69003 Lyon"
    },
    {
        "name": "Skyco Bordeaux Mériadeck",
        "location": "33000 Bordeaux",
        "address": "78 Cours de l'Intendance, 33000 Bordeaux"
    }
]
```

---

## 🔐 Phase 4 : Authentification & Routing

### Modification du Login

**Fichier :** `frontend/src/pages/Login.js`

```javascript
const handleLogin = async () => {
  const response = await fetch(`${backendUrl}/api/auth/login`, {...});
  const data = await response.json();
  
  // Redirection selon le rôle
  if (data.user.role === 'gerant') {
    navigate('/gerant-dashboard');
  } else if (data.user.role === 'manager') {
    navigate('/manager-dashboard');
  } else {
    navigate('/seller-dashboard');
  }
};
```

### Nouvelles Routes

**Fichier :** `frontend/src/App.js`

```javascript
<Route path="/gerant-dashboard" element={<GerantDashboard />} />
```

---

## ✅ Checklist d'Implémentation

### Backend
- [ ] Créer modèles Pydantic (Store, StoreCreate, StoreUpdate)
- [ ] Ajouter nouveaux champs aux modèles User
- [ ] Créer endpoints CRUD magasins
- [ ] Créer endpoints dashboard gérant
- [ ] Créer endpoints assignment managers
- [ ] Modifier endpoints existants pour filtrer par store_id
- [ ] Créer script de migration

### Frontend
- [ ] Créer GerantDashboard.js
- [ ] Créer composants gerant/ (StoreCard, etc.)
- [ ] Ajouter route /gerant-dashboard
- [ ] Modifier Login.js pour redirection gérant
- [ ] Créer RoleSwitcher pour double rôle
- [ ] Modifier ManagerDashboard pour afficher nom magasin

### Migration
- [ ] Exécuter script de migration
- [ ] Créer gérant par défaut
- [ ] Vérifier intégrité des données
- [ ] Tester tous les dashboards

### Tests
- [ ] Tester création magasin
- [ ] Tester suppression magasin (avec validation)
- [ ] Tester assignment manager
- [ ] Tester switch gérant/manager
- [ ] Tester agrégation KPIs par magasin
- [ ] Tester comparaison inter-magasins

---

## 🚨 Points d'Attention

1. **Suppression de magasin** : 
   - Vérifier qu'il n'y a pas de managers/vendeurs assignés
   - Vérifier qu'il n'y a pas de KPIs historiques
   - Afficher 3 alertes successives
   - Option de "désactiver" au lieu de supprimer

2. **Double rôle gérant/manager** :
   - Switch visible uniquement si `is_also_manager = true`
   - Vue Manager = magasin spécifique (managed_store_id)
   - Vue Gérant = tous les magasins

3. **Performance** :
   - Indexer store_id dans toutes les collections
   - Agrégation efficace pour stats globales

4. **Permissions** :
   - Gérant voit TOUS les magasins
   - Manager voit SON magasin uniquement
   - Vendeur voit SES données uniquement

---

## 📊 Ordre d'Exécution

1. ✅ **Sauvegarde** (FAIT)
2. **Backend** - Modèles + Endpoints (2-3h)
3. **Migration** - Script + Exécution (1h)
4. **Frontend** - Interface Gérant (3-4h)
5. **Tests** - Validation complète (1h)

**Total estimé : 7-9 heures**

---

## 🎯 Prochaine Étape

**Voulez-vous que je commence par :**
- A) Backend complet (modèles + endpoints)
- B) Migration des données d'abord
- C) Interface gérant d'abord pour visualiser

**Je recommande l'ordre : A → B → C**
