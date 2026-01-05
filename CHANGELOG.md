# Changelog

Tous les changements notables de ce projet seront documentés dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/),
et ce projet adhère au [Semantic Versioning](https://semver.org/lang/fr/).

## [2.0.0] - 2025-01-XX

### 🎯 Documentation API - Refactorisation Complète

#### Ajouté
- **Nouveaux guides API dédiés** :
  - `GUIDE_API_STORES.md` - Guide complet pour la gestion des boutiques (magasins)
  - `GUIDE_API_MANAGER.md` - Guide complet pour les endpoints Manager
  - `GUIDE_API_SELLER.md` - Guide complet pour les endpoints Vendeur
- **Script de lint pour la documentation** : `scripts/lint-docs-urls.js`
  - Détecte automatiquement les URLs obsolètes dans les fichiers de documentation
  - Prévention des régressions
- **Rapport d'inventaire** : `DOCS_URL_INVENTORY_REPORT.md`
  - Liste complète des fichiers contenant des URLs obsolètes
  - Guide de migration

#### Modifié
- **API_README.md** :
  - Base URL mise à jour : `https://api.retailperformerai.com`
  - Liens vers les nouveaux guides dédiés (Stores, Manager, Seller)
  - Section endpoints dépréciés ajoutée
  - Exemples mis à jour avec les nouveaux chemins
  - Information CORS ajoutée
  - Lien vers OpenAPI/Swagger ajouté

#### Déprécié
- `POST /api/integrations/stores` → Utiliser `POST /api/stores/` (JWT) ou endpoints Enterprise (API Key)
- `POST /api/v1/integrations/stores` → Déprécié
- `GET /api/v1/integrations/my-stores` → Utiliser `GET /api/integrations/my-stores` (API Key) ou `GET /api/stores/my-stores` (JWT)

#### Routes API Confirmées

**Stores (Boutiques)** :
- `POST /api/stores/` - Créer un magasin (JWT, gérant uniquement)
- `GET /api/stores/my-stores` - Lister les magasins du gérant (JWT)
- `GET /api/stores/{store_id}/info` - Informations d'un magasin (JWT)

**Manager** :
- `GET /api/manager/subscription-status` - Statut d'abonnement
- `GET /api/manager/store-kpi-overview` - Vue d'ensemble KPI
- `GET /api/manager/dates-with-data` - Dates avec données
- `GET /api/manager/available-years` - Années disponibles

**Seller (Vendeur)** :
- `GET /api/seller/subscription-status` - Statut d'abonnement
- `GET /api/seller/kpi-enabled` - Vérifier si les KPI sont activés
- `GET /api/seller/tasks` - Tâches du vendeur
- `GET /api/seller/objectives/active` - Objectifs actifs
- `GET /api/seller/objectives/all` - Tous les objectifs

### 📝 Notes de Migration

- **Base URL unique** : `https://api.retailperformerai.com`
- **CORS** : Origines autorisées : `https://retailperformerai.com`, `https://www.retailperformerai.com`
- **Authentification** :
  - **JWT (Token Bearer)** : Pour les endpoints `/api/stores/`, `/api/manager/`, `/api/seller/`
  - **API Key (Header X-API-Key)** : Pour les endpoints `/api/integrations/*` (systèmes externes)
- **Exemples** : Tous les guides incluent des exemples cURL, Postman et n8n

### 🔧 Scripts

- `node scripts/lint-docs-urls.js` : Vérifier l'absence d'URLs obsolètes dans la documentation

---

## [1.2.0] - 2024-12-08

### Documentation API
- Version initiale de la documentation API
- Guides d'intégration système externe
- Documentation Enterprise API

---

[2.0.0]: https://github.com/your-org/retail_appli/compare/v1.2.0...v2.0.0
[1.2.0]: https://github.com/your-org/retail_appli/releases/tag/v1.2.0

