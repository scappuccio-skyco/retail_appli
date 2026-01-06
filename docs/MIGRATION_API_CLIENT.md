# Migration Frontend vers API Client Unifié

**Date** : 2025-01-XX  
**Statut** : En cours

## ✅ Fichiers Migrés (Complets)

1. ✅ `frontend/src/lib/apiClient.js` - Protections ajoutées
2. ✅ `frontend/src/App.js` - Migré vers api + logger
3. ✅ `frontend/src/pages/Login.js` - Migré vers api + logger
4. ✅ `frontend/src/utils/pdfDownload.js` - Migré vers api.getBlob + logger

## 🔄 Fichiers à Migrer (Priorité Haute)

### Pages Principales
- [ ] `frontend/src/pages/ManagerDashboard.js` (16 appels axios)
- [ ] `frontend/src/pages/SellerDashboard.js` (22 appels axios)
- [ ] `frontend/src/pages/GerantDashboard.js` (4 appels axios)
- [ ] `frontend/src/pages/SuperAdminDashboard.js` (12 appels axios)

### Composants Critiques
- [ ] `frontend/src/components/ManagerSettingsModal.js` (18 appels axios)
- [ ] `frontend/src/components/StoreKPIModal.js` (13 appels axios)
- [ ] `frontend/src/components/MorningBriefModal.js` (3 appels axios)
- [ ] `frontend/src/components/RelationshipManagementModal.js` (2 appels axios)
- [ ] `frontend/src/components/ConflictResolutionForm.js` (2 appels axios)

## 📋 Pattern de Migration

### 1. Imports
```javascript
// AVANT
import axios from 'axios';
import { API_BASE } from '../lib/api';
const API = `${API_BASE}/api`;

// APRÈS
import { api } from '../lib/apiClient';
import { logger } from '../utils/logger';
```

### 2. Appels API
```javascript
// AVANT
const token = localStorage.getItem('token');
const res = await axios.get(`${API}/manager/objectives`, {
  headers: { Authorization: `Bearer ${token}` }
});

// APRÈS
const res = await api.get('/manager/objectives');
```

### 3. URLs
- `${API}/manager/objectives` → `/manager/objectives`
- `/api/manager/objectives` → `/manager/objectives` (le /api/ est retiré automatiquement)
- `manager/objectives` → `/manager/objectives` (ajouter le / au début)

### 4. Console.log
```javascript
// AVANT
console.log('Debug info');
console.error('Error');

// APRÈS
logger.log('Debug info');
logger.error('Error');
```

### 5. Blob/PDF
```javascript
// AVANT
const blob = await axios.get(url, { responseType: 'blob', headers: {...} });

// APRÈS
const blob = await api.getBlob(url);
```

## ⚠️ Points d'Attention

1. **Ne jamais mettre `/api/` dans l'URL** - apiClient l'ajoute automatiquement
2. **Les protections dans apiClient corrigent automatiquement** les erreurs `/api/api/`
3. **Toujours utiliser des URLs relatives** commençant par `/`
4. **Supprimer les headers Authorization manuels** - géré par l'interceptor

## 🔍 Vérifications Post-Migration

```bash
# Vérifier qu'il n'y a plus de /api/api/
grep -r "/api/api/" frontend/src

# Vérifier les appels axios restants (doit être 0 sauf cas justifiés)
grep -r "axios\.(get|post|put|patch|delete)" frontend/src

# Vérifier les console.log restants (doit être 0)
grep -r "console\.log" frontend/src
```

## 📊 Statistiques

- **Fichiers avec axios** : 70 fichiers
- **Appels axios** : ~265 occurrences
- **Fichiers migrés** : 4 fichiers
- **Fichiers restants** : ~66 fichiers

