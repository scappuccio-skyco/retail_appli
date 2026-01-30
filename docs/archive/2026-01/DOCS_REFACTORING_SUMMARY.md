# 📋 Résumé de la Refactorisation de la Documentation API

**Date** : Janvier 2025  
**Version** : 2.0.0  
**Base URL** : `https://api.retailperformerai.com`

---

## ✅ Fichiers Créés

### 1. Guides API Dédiés

- **`GUIDE_API_STORES.md`** : Guide complet pour la gestion des boutiques (magasins)
  - Endpoints : `POST /api/stores/`, `GET /api/stores/my-stores`, `GET /api/stores/{store_id}/info`
  - Exemples cURL, Postman, n8n
  - Authentification JWT

- **`GUIDE_API_MANAGER.md`** : Guide complet pour les endpoints Manager
  - Endpoints : `GET /api/manager/subscription-status`, `GET /api/manager/store-kpi-overview`, `GET /api/manager/dates-with-data`, `GET /api/manager/available-years`
  - Exemples cURL, Postman, n8n
  - Authentification JWT

- **`GUIDE_API_SELLER.md`** : Guide complet pour les endpoints Vendeur
  - Endpoints : `GET /api/seller/subscription-status`, `GET /api/seller/kpi-enabled`, `GET /api/seller/tasks`, `GET /api/seller/objectives/active`, `GET /api/seller/objectives/all`
  - Exemples cURL, Postman, n8n
  - Authentification JWT

### 2. Outils et Rapports

- **`DOCS_URL_INVENTORY_REPORT.md`** : Rapport d'inventaire des URLs obsolètes
  - Liste complète des fichiers contenant des URLs obsolètes
  - Guide de migration

- **`scripts/lint-docs-urls.js`** : Script de lint pour prévenir les régressions
  - Détecte automatiquement les URLs obsolètes
  - Usage : `node scripts/lint-docs-urls.js`

- **`CHANGELOG.md`** : Changelog du projet
  - Entrée pour la version 2.0.0
  - Liste des changements, ajouts, modifications, dépréciations

---

## 📝 Fichiers Modifiés

### 1. `API_README.md`

**Changements** :
- Base URL mise à jour : `https://api.retailperformerai.com`
- Liens vers les nouveaux guides dédiés (Stores, Manager, Seller)
- Section endpoints dépréciés ajoutée
- Exemples mis à jour avec les nouveaux chemins
- Information CORS ajoutée
- Lien vers OpenAPI/Swagger ajouté
- Version mise à jour : 2.0.0

**Diff principal** :
```diff
- **Endpoints disponibles :**
- - `POST /v1/integrations/sync-kpi` - Synchroniser les KPI
- - `POST /v1/integrations/stores` - Créer des magasins
+ **Endpoints disponibles :**
+ - `POST /api/integrations/kpi/sync` - Synchroniser les KPI
+ - `GET /api/integrations/my-stores` - Lister magasins et personnel
+ - `GET /api/integrations/my-stats` - Récupérer statistiques
+ 
+ > ⚠️ **Note** : Les endpoints `/api/integrations/stores/*` sont dépréciés. Pour créer des magasins via API Key, utilisez les endpoints Enterprise. Pour l'authentification JWT, consultez les guides ci-dessous.

- ### 👤 API Utilisateur (Interface Web)
- **→ Consultez : [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)**
+ ### 👤 API Utilisateur (Interface Web) - Authentification JWT
+ **→ Consultez les guides dédiés :**
+ 
+ - 📘 **[GUIDE_API_STORES.md](./GUIDE_API_STORES.md)** - Gestion des boutiques (magasins)
+ - 📘 **[GUIDE_API_MANAGER.md](./GUIDE_API_MANAGER.md)** - Endpoints Manager
+ - 📘 **[GUIDE_API_SELLER.md](./GUIDE_API_SELLER.md)** - Endpoints Vendeur
+ 
+ **Base URL** : `https://api.retailperformerai.com`

- ```bash
- # Créer un magasin
- curl -X POST https://retailperformerai.com/api/v1/integrations/stores \
+ ```bash
+ # Synchroniser des KPI
+ curl -X POST https://api.retailperformerai.com/api/integrations/kpi/sync \
+   -H "X-API-Key: rp_live_votre_cle" \
+   -H "Content-Type: application/json" \
+   -d '{
+     "date": "2025-01-15",
+     "kpi_entries": [...]
+   }'
+ ```
+ 
+ ### Exemple rapide (JWT - Stores) :
+ 
+ ```bash
+ # Créer un magasin (authentification JWT)
+ curl -X POST https://api.retailperformerai.com/api/stores/ \
   -H "Authorization: Bearer YOUR_JWT_TOKEN" \
   -H "Content-Type: application/json" \
   -d '{
     "name": "Boutique Paris",
-     "location": "75001 Paris"
+     "location": "75001 Paris",
+     "address": "123 Rue de Rivoli"
   }'
 ```

+ ## 🌐 Base URL
+ 
+ **Base URL unique** : `https://api.retailperformerai.com`
+ 
+ **CORS** : Les origines suivantes sont autorisées :
+ - `https://retailperformerai.com`
+ - `https://www.retailperformerai.com`
+ 
+ ## 📚 Documentation OpenAPI
+ 
+ - **Swagger UI** : `https://api.retailperformerai.com/docs` (si activé en développement)
+ - **OpenAPI JSON** : `https://api.retailperformerai.com/openapi.json`
+ 
+ ## ⚠️ Endpoints Dépréciés
+ 
+ Les endpoints suivants sont dépréciés :
+ - `POST /api/integrations/stores` → Utiliser `POST /api/stores/` (JWT) ou endpoints Enterprise (API Key)
+ - `POST /api/v1/integrations/stores` → Déprécié
+ - `GET /api/v1/integrations/my-stores` → Utiliser `GET /api/integrations/my-stores` (API Key) ou `GET /api/stores/my-stores` (JWT)
```

---

## 📦 Commits Suggérés

### Commit 1 : Inventaire et Rapport
```
chore(docs): inventory and report outdated API URLs

- Création de DOCS_URL_INVENTORY_REPORT.md
- Liste complète des fichiers contenant des URLs obsolètes
- Guide de migration pour les nouveaux chemins
```

**Fichiers** :
- `DOCS_URL_INVENTORY_REPORT.md` (nouveau)

---

### Commit 2 : Guides API Dédiés
```
docs(api): add dedicated guides for Stores, Manager, and Seller endpoints

- Création de GUIDE_API_STORES.md (endpoints /api/stores/*)
- Création de GUIDE_API_MANAGER.md (endpoints /api/manager/*)
- Création de GUIDE_API_SELLER.md (endpoints /api/seller/*)
- Chaque guide inclut :
  - Base URL: https://api.retailperformerai.com
  - Authentification JWT
  - Exemples cURL, Postman, n8n
  - Codes de réponse détaillés
```

**Fichiers** :
- `GUIDE_API_STORES.md` (nouveau)
- `GUIDE_API_MANAGER.md` (nouveau)
- `GUIDE_API_SELLER.md` (nouveau)

---

### Commit 3 : Mise à Jour API_README
```
docs(readme): update base URL and link key endpoints

- Base URL mise à jour: https://api.retailperformerai.com
- Liens vers les nouveaux guides dédiés
- Section endpoints dépréciés ajoutée
- Exemples mis à jour avec les nouveaux chemins
- Information CORS et OpenAPI ajoutées
- Version: 2.0.0
```

**Fichiers** :
- `API_README.md` (modifié)

---

### Commit 4 : Script de Lint
```
chore(ci): add docs URL lint to prevent regressions

- Création de scripts/lint-docs-urls.js
- Détecte automatiquement les URLs obsolètes dans la documentation
- Patterns: /api/v1/integrations, retailappli-production.up.railway.app, etc.
- Usage: node scripts/lint-docs-urls.js
```

**Fichiers** :
- `scripts/lint-docs-urls.js` (nouveau)

---

### Commit 5 : CHANGELOG
```
docs(changelog): align API docs for stores/manager/seller

- Création de CHANGELOG.md
- Entrée pour la version 2.0.0
- Liste complète des changements, ajouts, modifications, dépréciations
- Routes API confirmées (Stores, Manager, Seller)
- Notes de migration
```

**Fichiers** :
- `CHANGELOG.md` (nouveau)

---

## ⚠️ Fichiers Restants à Mettre à Jour

Les fichiers suivants contiennent encore des URLs obsolètes et doivent être mis à jour dans des commits séparés :

1. **`API_INTEGRATION_GUIDE.md`** :
   - Remplacer `/api/v1/integrations/*` par `/api/integrations/*`
   - Remplacer `https://retailperformerai.com/api` par `https://api.retailperformerai.com`
   - Mettre à jour les exemples BASE_URL

2. **`API_DOCUMENTATION.md`** :
   - Vérifier et aligner avec les routes réelles
   - Mettre à jour la base URL si nécessaire

3. **`RATE_LIMIT_UPDATE.md`** :
   - Mettre à jour `https://retailperformerai.com/api/v1/integrations/stores`

4. **`DEPLOYMENT_GUIDE.md`** :
   - Mettre à jour `https://retailperformerai.com/api/v1/admin/reset-superadmin`

5. **`CORS_FIX_DOCUMENTATION.md`** :
   - Mettre à jour `https://retailperformerai.com/api/*`

6. **`ADMIN_RESET_INSTRUCTIONS.md`** :
   - Mettre à jour `https://retailperformerai.com/api/v1/admin/reset-superadmin`

**Commit suggéré pour ces fichiers** :
```
docs(fix): update remaining docs with new base URL and paths

- API_INTEGRATION_GUIDE.md: /api/v1/integrations → /api/integrations
- Base URL: https://api.retailperformerai.com
- Mise à jour des exemples et configurations
```

---

## ✅ Critères d'Acceptation

- [x] Aucune occurrence `/api/integrations/` dans les nouveaux guides (sauf bloc Deprecated)
- [x] Tous les exemples utilisent `https://api.retailperformerai.com`
- [x] Pages dédiées "Stores", "Manager", "Seller" complètes (cURL, Postman, n8n)
- [x] Script lint créé (détecte les URLs obsolètes)
- [x] CHANGELOG créé avec entrée complète
- [x] API_README.md mis à jour avec nouveaux guides et base URL
- [ ] OpenAPI/Swagger vérifié (à faire si fichier versionné présent)
- [ ] Fichiers restants mis à jour (API_INTEGRATION_GUIDE.md, etc.)

---

## 🚀 Prochaines Étapes

1. **Vérifier OpenAPI/Swagger** (si fichier versionné présent) :
   - Mettre à jour `servers.url = https://api.retailperformerai.com`
   - Aligner les paths avec les routes réelles
   - Marquer les endpoints dépréciés

2. **Mettre à jour les fichiers restants** :
   - `API_INTEGRATION_GUIDE.md` (prioritaire)
   - `API_DOCUMENTATION.md`
   - `RATE_LIMIT_UPDATE.md`
   - `DEPLOYMENT_GUIDE.md`
   - `CORS_FIX_DOCUMENTATION.md`
   - `ADMIN_RESET_INSTRUCTIONS.md`

3. **Tester le script de lint** :
   - Exécuter `node scripts/lint-docs-urls.js`
   - Vérifier qu'il détecte les URLs obsolètes
   - Corriger les faux positifs si nécessaire

4. **Intégrer dans CI/CD** (optionnel) :
   - Ajouter le script de lint dans le pipeline
   - Bloquer les commits contenant des URLs obsolètes

---

**Version** : 2.0.0  
**Date** : Janvier 2025

