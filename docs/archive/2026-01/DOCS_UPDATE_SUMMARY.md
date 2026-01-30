# Résumé de la Mise à Jour de la Documentation API

**Date** : Janvier 2025  
**Source de vérité** : `routes.runtime.json`

---

## ✅ Modifications Effectuées

### 1. Correction des Attributs `deprecated` dans `routes.runtime.json`

- ✅ `/api/integrations/kpi/sync` : `deprecated: false` (endpoint officiel ERP)
- ✅ `/api/integrations/v1/kpi/sync` : `deprecated: true` (alias legacy)
- ✅ `/api/integrations/api-keys` (GET/POST) : `deprecated: false` (nécessite JWT gérant)

### 2. Réorganisation de la Documentation

#### A) API App (Authentification JWT Bearer)

**Section créée** dans `API_INTEGRATION_GUIDE.md` et `API_README.md` :

- Endpoints : `/api/stores/*`, `/api/manager/*`, `/api/seller/*`
- Authentification : `Authorization: Bearer <JWT_TOKEN>`
- Documentation : Guides dédiés (GUIDE_API_STORES.md, GUIDE_API_MANAGER.md, GUIDE_API_SELLER.md)

#### B) API Intégrations (Authentification X-API-Key)

**Section créée** dans `API_INTEGRATION_GUIDE.md` :

- Endpoints disponibles :
  - `POST /api/integrations/kpi/sync` - Endpoint officiel ERP
  - `POST /api/integrations/v1/kpi/sync` - Alias legacy (déprécié)
- Authentification : `X-API-Key: <API_KEY>`
- Gestion des clés : `/api/integrations/api-keys` (nécessite JWT gérant, pas API Key)

### 3. Suppression/Marquage des Endpoints Non Disponibles

Les endpoints suivants ont été **supprimés ou marqués comme "Non disponible"** dans la documentation :

- ❌ `GET /api/integrations/my-stores` - **Non disponible**
- ❌ `GET /api/integrations/my-stats` - **Non disponible**
- ❌ `POST /api/integrations/stores` - **Non disponible**
- ❌ `POST /api/integrations/stores/{store_id}/managers` - **Non disponible**
- ❌ `POST /api/integrations/stores/{store_id}/sellers` - **Non disponible**
- ❌ `PUT /api/integrations/users/{user_id}` - **Non disponible**

**Alternatives documentées** :
- Pour créer des magasins : `POST /api/stores/` avec JWT (voir GUIDE_API_STORES.md)
- Pour lister les magasins : `GET /api/stores/my-stores` avec JWT (voir GUIDE_API_STORES.md)

### 4. Mise à Jour des Exemples

Tous les exemples ont été mis à jour avec :

- ✅ Base URL : `https://api.retailperformerai.com`
- ✅ Headers corrects :
  - Stores/Manager/Seller : `Authorization: Bearer <JWT_TOKEN>`
  - KPI Sync : `X-API-Key: <API_KEY>`
- ✅ Exemples cURL, Python, JavaScript, n8n mis à jour

### 5. Fichiers Modifiés

- ✅ `routes.runtime.json` - Correction des attributs deprecated
- ✅ `API_INTEGRATION_GUIDE.md` - Réorganisation complète en 2 sections
- ✅ `API_README.md` - Réorganisation et mise à jour
- ✅ `API_EXAMPLES.md` - Mise à jour des exemples
- ✅ `frontend/src/components/gerant/APIDocModal.js` - Suppression des endpoints non disponibles
- ✅ `backend/scripts/lint_docs.py` - Script de validation créé

### 6. Script de Lint Documentation

**Créé** : `backend/scripts/lint_docs.py`

**Fonctionnalités** :
- Vérifie que tous les endpoints mentionnés dans la documentation existent dans `routes.runtime.json`
- Détecte les endpoints manquants
- Gère les paramètres de chemin (`{store_id}`, etc.)
- Échoue si un endpoint documenté n'existe pas dans le runtime

**Utilisation** :
```bash
python backend/scripts/lint_docs.py
```

---

## 📊 État Final de la Documentation

### Endpoints Disponibles (Runtime)

#### API App (JWT Bearer)
- `POST /api/stores/` - Créer un magasin
- `GET /api/stores/my-stores` - Lister mes magasins
- `GET /api/stores/{store_id}/info` - Informations d'un magasin
- `GET /api/manager/subscription-status` - Statut abonnement
- `GET /api/manager/store-kpi-overview` - Vue d'ensemble KPI
- `GET /api/seller/subscription-status` - Statut abonnement
- `GET /api/seller/tasks` - Tâches vendeur
- ... (voir routes.runtime.json pour la liste complète)

#### API Intégrations (X-API-Key)
- `POST /api/integrations/kpi/sync` - Synchroniser KPI (officiel)
- `POST /api/integrations/v1/kpi/sync` - Alias legacy (déprécié)

#### Gestion des Clés API (JWT Gérant)
- `GET /api/integrations/api-keys` - Lister les clés
- `POST /api/integrations/api-keys` - Créer une clé

### Endpoints Non Disponibles

Tous les endpoints `/api/integrations/my-stores`, `/api/integrations/my-stats`, `/api/integrations/stores/*`, `/api/integrations/users/*` sont **non disponibles** et ont été supprimés de la documentation active.

---

## 🎯 Prochaines Étapes Recommandées

1. **Déployer l'endpoint `/_debug/routes`** en production pour générer un `routes.runtime.json` complet
2. **Exécuter le script de lint** régulièrement dans le CI/CD pour détecter les écarts
3. **Mettre à jour les tests** pour refléter les endpoints disponibles
4. **Vérifier les intégrations existantes** qui pourraient utiliser les endpoints non disponibles

---

## 📝 Commits Atomiques Recommandés

1. `fix(docs): corriger deprecated dans routes.runtime.json`
2. `docs(api): réorganiser documentation en 2 sections (API App vs API Intégrations)`
3. `docs(api): supprimer endpoints non disponibles de la documentation`
4. `docs(api): mettre à jour tous les exemples avec base URL et headers corrects`
5. `feat(scripts): ajouter script lint_docs pour valider la documentation`
6. `fix(frontend): supprimer endpoints non disponibles du composant APIDocModal`

---

**Version de la documentation** : 2.0.0  
**Dernière mise à jour** : Janvier 2025

