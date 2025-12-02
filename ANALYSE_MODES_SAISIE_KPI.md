# 🔍 ANALYSE COMPLÈTE - MODES DE SAISIE KPI
## Retail Performer AI - Compréhension fine du système

**Date**: 2 Décembre 2024  
**Auteur**: Agent E1  
**Objectif**: Comprendre en profondeur les différents modes de saisie KPI pour créer un onboarding adaptatif

---

## 📊 RÉSUMÉ EXÉCUTIF

Le système de saisie KPI dans Retail Performer AI fonctionne selon **2 dimensions indépendantes** :

### Dimension 1 : Mode de synchronisation (`sync_mode`)
- **manual** : Saisie manuelle (par défaut PME)
- **api_sync** : Synchronisation automatique via API (clients enterprise)
- **scim_sync** : Synchronisation SCIM (clients enterprise avancés)

### Dimension 2 : Qui saisit les KPI ? (`enabled` dans kpi_configs)
- **Manager saisit** : `enabled = false` (vendeurs ne peuvent PAS saisir)
- **Vendeur saisit** : `enabled = true` (vendeurs peuvent saisir)

---

## 🎯 LES 3 MODES EFFECTIFS

En combinant les deux dimensions, on obtient **3 modes pratiques** :

### Mode 1️⃣ : VENDEUR SAISIT (Mode PME classique)
**Configuration** :
- `user.sync_mode` = `"manual"` OU `null`
- `kpi_config.enabled` = `true`

**Comportement** :
- ✅ **Vendeur** : Peut saisir ses KPI quotidiens
- 👁️ **Manager** : Consulte les KPI saisis, peut demander bilan IA
- 🔓 Champs d'input : **ACTIFS** (éditables)

**Interface Vendeur** :
```javascript
<input 
  type="number" 
  disabled={false}  // ← ÉDITABLE
  placeholder="Entrez votre CA"
/>
<button>Enregistrer mes KPI</button>
```

**Message onboarding** :
> "Chaque jour, saisissez vos résultats (CA, nb ventes, etc.). 
> C'est essentiel pour recevoir du coaching IA personnalisé !"

---

### Mode 2️⃣ : MANAGER SAISIT (Mode PME avec contrôle)
**Configuration** :
- `user.sync_mode` = `"manual"` OU `null`
- `kpi_config.enabled` = `false`

**Comportement** :
- 👁️ **Vendeur** : LECTURE SEULE (ne peut PAS saisir)
- ✅ **Manager** : Saisit les KPI pour tous ses vendeurs
- 🔒 Champs d'input vendeur : **DÉSACTIVÉS**

**Interface Vendeur** :
```javascript
<input 
  type="number" 
  disabled={true}  // ← LECTURE SEULE
  value={kpi.ca_journalier}
  className="bg-gray-100 cursor-not-allowed"
/>
<Lock className="text-gray-500" />
```

**Message onboarding** :
> "Votre manager saisit vos KPI quotidiens. 
> Vous pouvez les consulter ici pour suivre vos performances."

---

### Mode 3️⃣ : API/AUTOMATISÉ (Mode Enterprise)
**Configuration** :
- `user.sync_mode` = `"api_sync"` OU `"scim_sync"`
- `user.enterprise_account_id` != `null`
- `kpi_config.enabled` = N/A (ignoré)

**Comportement** :
- 👁️ **Vendeur** : LECTURE SEULE (données externes)
- 👁️ **Manager** : LECTURE SEULE (données externes)
- 🔄 Synchronisation automatique depuis ERP/Caisse
- 🔒 **TOUS** les champs : **DÉSACTIVÉS**

**Interface (Vendeur ET Manager)** :
```javascript
const { isReadOnly, isEnterprise, companyName } = useSyncMode();

// isReadOnly = true si sync_mode != "manual"

<div className="bg-blue-50 border border-blue-200 p-3 rounded mb-4">
  <Lock className="text-blue-600" />
  <span>🔄 Données synchronisées automatiquement</span>
  {companyName && <span>depuis {companyName}</span>}
</div>

<input 
  type="number" 
  disabled={true}  // ← LECTURE SEULE
  value={kpi.ca_journalier}
  className="bg-gray-100 cursor-not-allowed"
/>
```

**Message onboarding** :
> "Vos données sont automatiquement synchronisées depuis votre système.
> Consultez-les ici en temps réel."

---

## 🔧 ARCHITECTURE TECHNIQUE

### A. Base de données

#### Collection `users`
```javascript
{
  id: "user-123",
  role: "seller",
  manager_id: "manager-456",
  enterprise_account_id: null,  // null = PME | "ent-789" = Enterprise
  sync_mode: "manual",  // "manual" | "api_sync" | "scim_sync"
  external_id: null  // ID dans système externe
}
```

#### Collection `kpi_configs`
```javascript
{
  manager_id: "manager-456",
  enabled: true,  // true = vendeurs peuvent saisir | false = manager saisit
  track_ca: true,
  track_ventes: true,
  track_articles: true,
  // ... autres configs
}
```

#### Collection `enterprise_accounts`
```javascript
{
  id: "ent-789",
  name: "Grande Entreprise SA",
  owner_id: "itadmin-001",
  sync_mode: "api_sync",  // Mode de sync de l'entreprise
  last_sync_at: "2024-12-02T10:30:00Z"
}
```

### B. Backend - Endpoint clé

#### `/api/manager/sync-mode`
```python
@api_router.get("/manager/sync-mode")
async def get_manager_sync_mode(current_user: dict = Depends(get_current_user)):
    """
    Retourne les infos de synchronisation pour l'utilisateur.
    Utilisé par le hook useSyncMode() côté frontend.
    """
    user = await db.users.find_one({"id": current_user['id']})
    
    # Mode Enterprise
    if user.get('enterprise_account_id'):
        return {
            "sync_mode": user.get('sync_mode', 'manual'),
            "is_enterprise": True,
            "can_edit_kpi": False,  # ← LECTURE SEULE
            "can_edit_objectives": True
        }
    
    # Mode PME
    return {
        "sync_mode": user.get('sync_mode', 'manual'),
        "is_enterprise": False,
        "can_edit_kpi": True,  # ← ÉDITABLE (sauf si config.enabled = false)
        "can_edit_objectives": True
    }
```

#### `/api/seller/kpi-enabled`
```python
@api_router.get("/seller/kpi-enabled")
async def check_kpi_enabled(current_user: dict):
    """
    Vérifie si le vendeur peut saisir ses KPI.
    Dépend de la config du manager.
    """
    config = await db.kpi_configs.find_one({"manager_id": current_user['manager_id']})
    
    return {
        "enabled": config.get('enabled', True)  # true = vendeur peut saisir
    }
```

### C. Frontend - Hook React

#### `useSyncMode.js`
```javascript
export const useSyncMode = () => {
  const [syncMode, setSyncMode] = useState('manual');
  const [isEnterprise, setIsEnterprise] = useState(false);
  const [canEditKPI, setCanEditKPI] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSyncMode = async () => {
      const response = await axios.get(`${API}/manager/sync-mode`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setSyncMode(response.data.sync_mode || 'manual');
      setIsEnterprise(response.data.is_enterprise || false);
      setCanEditKPI(response.data.can_edit_kpi !== false);
    };

    fetchSyncMode();
  }, []);

  const isReadOnly = syncMode !== 'manual';  // ← CLÉ !

  return {
    syncMode,      // "manual" | "api_sync" | "scim_sync"
    isEnterprise,  // true si enterprise_account_id != null
    isReadOnly,    // true si sync_mode != "manual"
    canEditKPI,    // false si enterprise
    loading
  };
};
```

#### Utilisation dans `KPIEntryModal.js`
```javascript
export default function KPIEntryModal({ onClose, onSuccess }) {
  const { isReadOnly } = useSyncMode();
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    // Vérifier si vendeur peut saisir (Mode 2 check)
    const response = await axios.get(`${API}/seller/kpi-enabled`);
    setEnabled(response.data.enabled);
  }, []);

  // Désactivé si :
  // 1. Mode Enterprise (isReadOnly = true)
  // 2. OU Manager saisit (enabled = false)
  const canEdit = !isReadOnly && enabled;

  return (
    <input 
      type="number"
      disabled={!canEdit}  // ← Condition combinée
      className={!canEdit ? 'bg-gray-100 cursor-not-allowed' : ''}
    />
  );
}
```

---

## 📋 TABLEAU DE DÉCISION

| sync_mode | enterprise_account_id | kpi_config.enabled | Vendeur peut saisir ? | Manager peut saisir ? | Interface vendeur |
|-----------|----------------------|-------------------|---------------------|---------------------|------------------|
| `manual` ou `null` | `null` | `true` | ✅ OUI | ❌ NON | **Mode 1** : Éditable |
| `manual` ou `null` | `null` | `false` | ❌ NON | ✅ OUI | **Mode 2** : Lecture seule |
| `api_sync` | `"ent-123"` | N/A | ❌ NON | ❌ NON | **Mode 3** : Lecture seule + Badge |
| `scim_sync` | `"ent-123"` | N/A | ❌ NON | ❌ NON | **Mode 3** : Lecture seule + Badge |

---

## 🎨 IMPACT SUR L'ONBOARDING

### Onboarding VENDEUR - Adaptatif selon le mode

#### Étape 3 : "KPI Quotidiens"

**Si Mode 1 (Vendeur saisit)** :
```
📝 Saisissez vos KPI
────────────────────────────────────────
Chaque jour, enregistrez vos résultats :
• CA réalisé
• Nombre de ventes
• Panier moyen
...

C'est essentiel pour recevoir du coaching 
IA personnalisé basé sur vos performances !

[Bouton : Saisir mes KPI] ← ACTION
```

**Si Mode 2 (Manager saisit)** :
```
👁️ Consultez vos KPI
────────────────────────────────────────
Votre manager saisit vos résultats 
quotidiens. Vous pouvez les consulter 
ici à tout moment.

Les données sont utilisées pour :
• Vos analyses de performances
• Votre coaching IA personnalisé
• Votre classement dans l'équipe

[Bouton : Voir mes KPI] ← CONSULTATION
```

**Si Mode 3 (API/Automatisé)** :
```
🔄 KPI Synchronisés
────────────────────────────────────────
Vos données sont automatiquement 
synchronisées depuis votre système 
d'entreprise en temps réel.

✓ Pas de saisie manuelle nécessaire
✓ Données toujours à jour
✓ Coaching IA basé sur vos vraies perf

[Badge : 🔄 Sync API]
[Bouton : Voir mes KPI] ← CONSULTATION
```

### Onboarding MANAGER - Adaptatif selon le mode

#### Étape 4 : "Gestion des KPI"

**Si Mode 1 (Vendeur saisit)** :
```
📊 Suivez les KPI de votre équipe
────────────────────────────────────────
Vos vendeurs saisissent leurs KPI 
quotidiens. Vous pouvez :

• Consulter les performances
• Valider les saisies
• Demander des bilans IA
• Identifier les tendances

[Bouton : Voir l'équipe] ← SUPERVISION
```

**Si Mode 2 (Manager saisit)** :
```
📝 Saisissez les KPI de votre équipe
────────────────────────────────────────
Vous êtes responsable de la saisie des 
KPI pour tous vos vendeurs.

💡 Conseil : Saisissez chaque jour pour 
des analyses IA précises !

[Bouton : Saisir les KPI] ← ACTION
```

**Si Mode 3 (API/Automatisé)** :
```
🔄 KPI Synchronisés automatiquement
────────────────────────────────────────
Les données de votre équipe sont 
synchronisées depuis votre système.

Vous pouvez :
• Consulter en temps réel
• Générer des bilans IA
• Suivre l'évolution

[Badge : 🔄 Sync API]
[Bouton : Dashboard équipe]
```

---

## 🔍 COMMENT DÉTECTER LE MODE ?

### Côté Frontend (React)

```javascript
import { useSyncMode } from '../hooks/useSyncMode';

function MyComponent() {
  const { 
    syncMode,      // "manual" | "api_sync" | "scim_sync"
    isReadOnly,    // true si sync_mode != "manual"
    isEnterprise,  // true si compte enterprise
    canEditKPI     // false si enterprise
  } = useSyncMode();

  // Déterminer le mode effectif
  const [kpiEnabled, setKpiEnabled] = useState(true);
  
  useEffect(() => {
    // Pour les vendeurs, vérifier si enabled
    if (user.role === 'seller') {
      const res = await axios.get('/api/seller/kpi-enabled');
      setKpiEnabled(res.data.enabled);
    }
  }, []);

  let mode;
  if (isReadOnly) {
    mode = 'API_SYNC';  // Mode 3
  } else if (!kpiEnabled) {
    mode = 'MANAGER_SAISIT';  // Mode 2
  } else {
    mode = 'VENDEUR_SAISIT';  // Mode 1
  }

  return (
    <div>
      {mode === 'VENDEUR_SAISIT' && <OnboardingVendeurSaisit />}
      {mode === 'MANAGER_SAISIT' && <OnboardingManagerSaisit />}
      {mode === 'API_SYNC' && <OnboardingApiSync />}
    </div>
  );
}
```

---

## 📚 RÉFÉRENCES DANS LE CODE

### Fichiers clés à consulter

**Backend** :
- `/app/backend/server.py` ligne 4680 : `get_manager_sync_mode()`
- `/app/backend/server.py` ligne 3226 : `check_kpi_enabled()`
- `/app/backend/enterprise_routes.py` : Gestion mode enterprise

**Frontend** :
- `/app/frontend/src/hooks/useSyncMode.js` : Hook de détection
- `/app/frontend/src/components/KPIEntryModal.js` ligne 11 : Utilisation
- `/app/frontend/src/components/SyncModeBadge.js` : Badge visuel

**Modèles** :
- `/app/backend/server.py` ligne 372 : `User.sync_mode`
- `/app/backend/enterprise_models.py` : Modèles enterprise

---

## ✅ CHECKLIST POUR L'ONBOARDING

Avant d'afficher une étape d'onboarding liée aux KPI :

- [ ] Récupérer `syncMode` via `useSyncMode()`
- [ ] Si rôle = seller, récupérer `enabled` via `/api/seller/kpi-enabled`
- [ ] Déterminer le mode effectif (1, 2 ou 3)
- [ ] Adapter le texte de l'onboarding
- [ ] Adapter l'icône (📝, 👁️, ou 🔄)
- [ ] Adapter le bouton d'action (Saisir, Voir, ou Dashboard)
- [ ] Afficher le badge si mode API

---

**Document créé par**: Agent E1  
**Dernière mise à jour**: 2024-12-02  
**Version**: 1.0  
**Status**: ✅ Complet et validé
