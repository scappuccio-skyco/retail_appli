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

# --- MANAGERS MANAGEMENT ---
@api_router.post("/gerant/stores/{store_id}/assign-manager")
async def assign_manager_to_store(store_id: str, manager_email: str, current_user: dict = Depends(get_current_user))

@api_router.post("/gerant/managers/{manager_id}/transfer")
async def transfer_manager_to_store(
    manager_id: str, 
    new_store_id: str,
    current_user: dict = Depends(get_current_user)
)  # Les vendeurs RESTENT dans leur boutique actuelle

@api_router.get("/gerant/managers")
async def get_all_managers(current_user: dict = Depends(get_current_user))

@api_router.get("/gerant/managers/{manager_id}/sellers")
async def get_manager_sellers(manager_id: str, current_user: dict = Depends(get_current_user))

# --- SELLERS MANAGEMENT ---
@api_router.post("/gerant/sellers/{seller_id}/transfer")
async def transfer_seller_to_store(
    seller_id: str, 
    new_store_id: str,
    new_manager_id: str,  # Nouveau manager dans la nouvelle boutique
    current_user: dict = Depends(get_current_user)
)

@api_router.get("/gerant/sellers")
async def get_all_sellers(current_user: dict = Depends(get_current_user))

@api_router.get("/gerant/stores/{store_id}/sellers")
async def get_store_sellers_detailed(store_id: str, current_user: dict = Depends(get_current_user))
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
- `ManagerTransferModal.js` - **NOUVEAU** : Transfert de manager entre boutiques (INDÉPENDANT)
- `SellerTransferModal.js` - **NOUVEAU** : Transfert de vendeur entre boutiques (INDÉPENDANT)
- `ManagerListModal.js` - **NOUVEAU** : Liste de tous les managers avec actions (transfert, voir détails)
- `SellerListModal.js` - **NOUVEAU** : Liste de tous les vendeurs avec actions (transfert, voir détails)
- `TeamManagementView.js` - **NOUVEAU** : Vue globale équipes (managers + vendeurs) avec drag & drop entre boutiques

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
- [ ] Tester assignment manager initial
- [ ] **Tester transfert manager entre boutiques (vendeurs restent)**
- [ ] **Tester transfert vendeur entre boutiques (changement de manager)**
- [ ] **Tester transfert vendeur vers boutique avec plusieurs managers (choix du nouveau manager)**
- [ ] Tester qu'un vendeur transféré garde ses KPIs historiques
- [ ] Tester qu'un manager transféré garde ses objectifs/challenges
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

3. **Transferts indépendants** :
   - ⚠️ **IMPORTANT** : Manager et vendeurs bougent INDÉPENDAMMENT
   - Transfert manager → vendeurs RESTENT dans leur boutique actuelle
   - Transfert vendeur → doit choisir un nouveau manager dans la nouvelle boutique
   - Historique KPIs conservé avec l'ancien store_id (traçabilité)

4. **Gestion des vendeurs orphelins** :
   - Si tous les managers d'une boutique sont transférés → alerter le gérant
   - Proposer d'assigner les vendeurs restants à un manager d'une autre boutique
   - Ou créer un nouveau manager pour cette boutique

5. **Performance** :
   - Indexer store_id dans toutes les collections
   - Agrégation efficace pour stats globales
   - Cache pour les stats de magasins (rafraîchir toutes les heures)

6. **Permissions** :
   - Gérant voit TOUS les magasins et TOUS les utilisateurs
   - Manager voit SON magasin uniquement et SES vendeurs uniquement
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

---

## 📋 Cas d'Usage Exemples

### **Scénario 1 : Vue Gérant Classique**

**Contexte :** Jean Dupont est gérant de 3 magasins Skyco

1. **Connexion :** Jean se connecte avec `jean.dupont@skyco.fr`
2. **Dashboard Gérant :** Il voit :
   - Performance globale : CA total, nombre de ventes
   - Ses 3 magasins avec leurs KPIs
   - Classement des magasins
3. **Vue Magasin :** Il clique sur "Skyco Paris Centre"
   - Voit les 2 managers de ce magasin
   - Voit les 8 vendeurs
   - Voit les KPIs détaillés
4. **Gestion :** Il peut :
   - Créer un nouveau magasin
   - Affecter un manager à un magasin
   - Définir des objectifs par magasin

---

### **Scénario 2 : Transfert de Manager**

**Contexte :** Le manager "Sophie Martin" doit être transféré de Paris à Lyon

1. Jean (gérant) va dans "Gestion de l'équipe"
2. Il sélectionne "Sophie Martin" (actuellement à Paris Centre)
3. Il clique sur "Transférer vers une autre boutique"
4. Il choisit "Skyco Lyon Part-Dieu"
5. **Confirmation** :
   ```
   ⚠️ Transfert de Manager
   
   Sophie Martin sera transférée de :
   📍 Skyco Paris Centre → 📍 Skyco Lyon Part-Dieu
   
   Ses 4 vendeurs RESTERONT à Paris Centre.
   Vous devrez les réassigner à un autre manager.
   
   Continuer ?
   [Annuler] [Confirmer le transfert]
   ```
6. Après confirmation :
   - Sophie est transférée à Lyon
   - Ses 4 vendeurs restent à Paris (sans manager assigné)
   - Jean reçoit une alerte : "4 vendeurs à Paris sans manager"

---

### **Scénario 3 : Transfert de Vendeur**

**Contexte :** Le vendeur "Thomas Roux" doit être transféré de Paris à Bordeaux

1. Jean (gérant) va dans "Gestion de l'équipe"
2. Il sélectionne "Thomas Roux" (actuellement à Paris, manager: Sophie)
3. Il clique sur "Transférer vers une autre boutique"
4. Il choisit "Skyco Bordeaux Mériadeck"
5. **Choix du nouveau manager** :
   ```
   🔄 Transfert de Vendeur
   
   Thomas Roux sera transféré de :
   📍 Skyco Paris Centre → 📍 Skyco Bordeaux Mériadeck
   
   Choisissez un manager à Bordeaux :
   👤 Pierre Durand (6 vendeurs actuellement)
   👤 Marie Lambert (4 vendeurs actuellement)
   
   [Annuler] [Confirmer]
   ```
6. Après confirmation :
   - Thomas est transféré à Bordeaux
   - Son nouveau manager est Pierre Durand
   - Ses KPIs historiques restent visibles avec mention "Ex-Paris Centre"

---

### **Scénario 4 : Gérant avec Double Rôle**

**Contexte :** Jean est gérant ET manager du magasin de Paris

1. Jean se connecte
2. **Switch de rôle visible** en haut à droite :
   ```
   [Vue Gérant 🏢] / [Vue Manager Paris 📍]
   ```
3. En "Vue Gérant" : Il voit tous les magasins
4. En "Vue Manager Paris" : Il voit uniquement Paris (comme un manager normal)
5. Il peut passer d'une vue à l'autre instantanément