# 📊 Rapport d'Inventaire - URLs API Obsolètes dans la Documentation

**Date** : $(date)
**Base URL actuelle** : `https://api.retailperformerai.com`
**Base URL obsolète** : `https://retailperformerai.com/api`, `https://retailperformerai.com/api/v1/integrations`, `retailappli-production.up.railway.app`

---

## 🔍 Fichiers Contenant des URLs Obsolètes

### 1. API_README.md
- **Ligne 67** : `https://retailperformerai.com/api/v1/integrations/stores`
- **Lignes 19-25** : Références à `/v1/integrations/*` endpoints
- **Action requise** : Mettre à jour vers `/api/stores/` et supprimer références `/v1/integrations/`

### 2. API_INTEGRATION_GUIDE.md
- **Ligne 106** : `https://retailperformerai.com/api/v1/integrations/my-stores`
- **Ligne 184** : `https://retailperformerai.com/api/v1/integrations/my-stats`
- **Ligne 203** : `BASE_URL = "https://retailperformerai.com/api"`
- **Ligne 232** : `const BASE_URL = 'https://retailperformerai.com/api';`
- **Ligne 344** : `BASE_URL = "https://retailperformerai.com/api"`
- **Ligne 390** : `const BASE_URL = 'https://retailperformerai.com/api';`
- **Ligne 733** : `const API_BASE_URL = 'https://retailperformerai.com/api/v1/integrations';`
- **Action requise** : Remplacer toutes les occurrences par `https://api.retailperformerai.com`

### 3. API_DOCUMENTATION.md
- **Ligne 25** : `POST /api/gerant/stores` (à vérifier si correct ou à changer vers `/api/stores/`)
- **Action requise** : Vérifier et aligner avec les routes réelles

### 4. RATE_LIMIT_UPDATE.md
- **Ligne 102** : `https://retailperformerai.com/api/v1/integrations/stores`
- **Action requise** : Mettre à jour vers `/api/stores/`

### 5. DEPLOYMENT_GUIDE.md
- **Ligne 191** : `https://retailperformerai.com/api/v1/admin/reset-superadmin?secret=...`
- **Action requise** : Mettre à jour vers `https://api.retailperformerai.com/api/admin/...`

### 6. CORS_FIX_DOCUMENTATION.md
- **Ligne 49** : `https://retailperformerai.com/api/*`
- **Ligne 65** : `https://retailperformerai.com/api/auth/login`
- **Action requise** : Mettre à jour vers `https://api.retailperformerai.com/api/*`

### 7. ADMIN_RESET_INSTRUCTIONS.md
- **Ligne 19** : `https://retailperformerai.com/api/v1/admin/reset-superadmin?secret=...`
- **Action requise** : Mettre à jour vers `https://api.retailperformerai.com/api/admin/...`

### 8. frontend/src/components/gerant/APIDocModal.js
- **Statut** : ✅ Déjà corrigé (contenu dans `/api/integrations/` - mais devrait être vérifié si ces endpoints existent réellement)

---

## 📋 Endpoints à Documenter

### Stores (Boutiques)
- ✅ `POST /api/stores/` - Créer un magasin
- ✅ `GET /api/stores/my-stores` - Liste des magasins du gérant
- ✅ `GET /api/stores/{store_id}/info` - Informations d'un magasin

### Manager
- ✅ `GET /api/manager/subscription-status` - Statut d'abonnement
- ✅ `GET /api/manager/store-kpi-overview` - Vue d'ensemble KPI
- ✅ `GET /api/manager/dates-with-data` - Dates avec données
- ✅ `GET /api/manager/available-years` - Années disponibles

### Seller (Vendeur)
- ✅ `GET /api/seller/subscription-status` - Statut d'abonnement
- ✅ `GET /api/seller/kpi-enabled` - KPI activés
- ✅ `GET /api/seller/tasks` - Tâches
- ✅ `GET /api/seller/objectives/active` - Objectifs actifs
- ✅ `GET /api/seller/objectives/all` - Tous les objectifs

---

## ⚠️ Endpoints Dépréciés

- ❌ `POST /api/integrations/stores` → Remplacer par `POST /api/stores/`
- ❌ `GET /api/integrations/my-stores` → Remplacer par `GET /api/stores/my-stores`
- ❌ `GET /api/integrations/my-stats` → À vérifier (peut-être dans `/api/gerant/` ou autre)
- ❌ `/api/v1/integrations/*` → Tous dépréciés, utiliser les nouveaux chemins

---

## ✅ Actions Prioritaires

1. **Créer/mettre à jour 3 guides séparés** :
   - `GUIDE_API_STORES.md`
   - `GUIDE_API_MANAGER.md`
   - `GUIDE_API_SELLER.md`

2. **Mettre à jour API_README.md** avec les nouveaux chemins

3. **Mettre à jour API_INTEGRATION_GUIDE.md** (pour l'intégration système externe - API Key)

4. **Mettre à jour API_DOCUMENTATION.md** (pour l'API utilisateur - JWT)

5. **Corriger les fichiers de configuration/déploiement**

6. **Ajouter script de lint pour prévenir les régressions**

---

## 📝 Notes

- Les endpoints `/api/integrations/` sont conservés uniquement pour l'authentification par API Key (intégration système externe)
- Les endpoints `/api/stores/`, `/api/manager/`, `/api/seller/` utilisent l'authentification JWT (interface web)
- La base URL unique est : `https://api.retailperformerai.com`

