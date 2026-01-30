# Phase 3 : Logique UI Conditionnelle

## Objectif

Adapter l'interface Manager et Vendeur pour que:
- Les champs KPI soient en **lecture seule** si `sync_mode != "manual"`
- L'onglet **"Choisir les KPI à valider"** soit **masqué** pour les managers en mode Enterprise
- Les Challenges/Objectifs restent **éditables** (car non synchronisés depuis l'ERP)

## Composants à modifier

### 1. Backend : Ajouter endpoint pour vérifier le sync_mode

**Fichier** : `/app/backend/server.py`

Ajouter un endpoint pour que le frontend puisse vérifier le mode de synchronisation :

```python
@api_router.get("/manager/sync-mode")
async def get_manager_sync_mode(current_user: dict = Depends(get_current_user)):
    """Vérifier si le manager est en mode sync automatique"""
    if current_user['role'] not in ['manager', 'seller']:
        return {"sync_mode": "manual"}
    
    user = await db.users.find_one({"id": current_user['id']}, {"_id": 0})
    
    # Si le user a un enterprise_account_id, vérifier le mode
    if user.get('enterprise_account_id'):
        enterprise = await db.enterprise_accounts.find_one(
            {"id": user['enterprise_account_id']},
            {"_id": 0}
        )
        return {
            "sync_mode": user.get('sync_mode', 'manual'),
            "is_enterprise": True,
            "company_name": enterprise.get('company_name') if enterprise else None
        }
    
    return {
        "sync_mode": user.get('sync_mode', 'manual'),
        "is_enterprise": False
    }
```

### 2. Frontend : Créer un hook React pour le sync mode

**Fichier** : `/app/frontend/src/hooks/useSyncMode.js` (à créer)

```javascript
import { useState, useEffect } from 'react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const useSyncMode = () => {
  const [syncMode, setSyncMode] = useState('manual');
  const [isEnterprise, setIsEnterprise] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSyncMode = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setLoading(false);
          return;
        }

        const response = await axios.get(`${API}/manager/sync-mode`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        setSyncMode(response.data.sync_mode || 'manual');
        setIsEnterprise(response.data.is_enterprise || false);
      } catch (error) {
        console.error('Error fetching sync mode:', error);
        // Par défaut, mode manuel
        setSyncMode('manual');
        setIsEnterprise(false);
      } finally {
        setLoading(false);
      }
    };

    fetchSyncMode();
  }, []);

  const isReadOnly = syncMode !== 'manual';
  const canEditKPIConfig = syncMode === 'manual';

  return {
    syncMode,
    isEnterprise,
    isReadOnly,
    canEditKPIConfig,
    loading
  };
};
```

### 3. Modifier ManagerDashboard pour utiliser le hook

**Fichier** : `/app/frontend/src/pages/ManagerDashboard.js`

```javascript
import { useSyncMode } from '../hooks/useSyncMode';

function ManagerDashboard() {
  const { canEditKPIConfig, isReadOnly } = useSyncMode();
  
  // ... reste du code

  return (
    <div>
      {/* Afficher un badge si mode synchronisé */}
      {isReadOnly && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <p className="text-blue-800 font-semibold">
            🔒 Données synchronisées automatiquement depuis votre ERP
          </p>
          <p className="text-blue-600 text-sm mt-1">
            Les modifications de KPI se font via votre système ERP.
            Les Challenges et Objectifs restent modifiables ici.
          </p>
        </div>
      )}

      {/* Masquer l'onglet Configuration KPI si mode entreprise */}
      {canEditKPIConfig && (
        <button onClick={() => setSettingsModalOpen(true)}>
          ⚙️ Configuration KPI
        </button>
      )}
    </div>
  );
}
```

### 4. Modifier les composants KPI pour lecture seule

**Fichier** : `/app/frontend/src/components/KPIEntryForm.js` (ou similaire)

```javascript
import { useSyncMode } from '../hooks/useSyncMode';

function KPIEntryForm() {
  const { isReadOnly } = useSyncMode();

  return (
    <form>
      <input
        type="number"
        disabled={isReadOnly}
        className={isReadOnly ? 'bg-gray-100 cursor-not-allowed' : ''}
        {...props}
      />
      
      {isReadOnly && (
        <p className="text-sm text-gray-500 mt-1">
          🔒 Ce champ est synchronisé automatiquement
        </p>
      )}
    </form>
  );
}
```

### 5. ManagerSettingsModal : Masquer onglet Configuration KPI

**Fichier** : `/app/frontend/src/components/ManagerSettingsModal.js`

Ajouter au début de la fonction :

```javascript
const { canEditKPIConfig } = useSyncMode();

// Dans le render, ne pas afficher l'onglet KPI Config si !canEditKPIConfig
const tabs = [
  { id: 'objectives', label: 'Objectifs' },
  { id: 'challenges', label: 'Challenges' },
  // Seulement si mode manuel
  ...(canEditKPIConfig ? [{ id: 'kpi_config', label: 'Configuration KPI' }] : [])
];
```

## Tests à effectuer

1. **Mode Manuel (PME)** :
   - ✅ Manager peut modifier les KPI
   - ✅ Manager peut configurer les KPI à suivre
   - ✅ Manager peut créer Challenges/Objectifs

2. **Mode Enterprise (API Sync)** :
   - ⏳ Manager NE PEUT PAS modifier les KPI (lecture seule)
   - ⏳ Onglet "Configuration KPI" masqué
   - ✅ Manager PEUT créer Challenges/Objectifs
   - ⏳ Badge informatif affiché

3. **Vendeur** :
   - ⏳ En mode sync : champs KPI en lecture seule
   - ✅ Peut toujours voir ses Challenges/Objectifs

## Implémentation (Étapes)

1. ✅ Créer l'endpoint `/api/manager/sync-mode` dans server.py
2. ⏳ Créer le hook `useSyncMode.js`
3. ⏳ Modifier `ManagerDashboard.js` pour afficher le badge
4. ⏳ Modifier `ManagerSettingsModal.js` pour masquer l'onglet
5. ⏳ Identifier et modifier les formulaires de saisie KPI
6. ⏳ Tester avec un compte Enterprise

## Fichiers concernés

- `/app/backend/server.py` - Endpoint sync-mode
- `/app/frontend/src/hooks/useSyncMode.js` - Hook React (à créer)
- `/app/frontend/src/pages/ManagerDashboard.js` - Badge et boutons
- `/app/frontend/src/components/ManagerSettingsModal.js` - Masquer onglet
- `/app/frontend/src/components/KPIEntryForm.js` - Champs lecture seule
- `/app/frontend/src/pages/SellerDashboard.js` - Champs lecture seule vendeur

## Estimation

**Temps nécessaire** : 2-3 heures
- Backend endpoint : 15 min
- Hook React : 30 min
- Modifications UI : 1-2h
- Tests : 30 min
