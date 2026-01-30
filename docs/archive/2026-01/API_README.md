# 📘 Guide de la Documentation API

Bienvenue ! Retail Performer AI propose plusieurs APIs selon vos besoins d'intégration.

**Base URL** : `https://api.retailperformerai.com`

---

## 🎯 Quelle documentation utiliser ?

### A) API App (Authentification JWT Bearer)

**→ Consultez les guides dédiés :**

- 📘 **[GUIDE_API_STORES.md](./GUIDE_API_STORES.md)** - Gestion des boutiques (magasins)
- 📘 **[GUIDE_API_MANAGER.md](./GUIDE_API_MANAGER.md)** - Endpoints Manager
- 📘 **[GUIDE_API_SELLER.md](./GUIDE_API_SELLER.md)** - Endpoints Vendeur

**Idéal pour :**
- Développement d'une application web/mobile custom
- Authentification JWT (token utilisateur)
- Accès aux fonctionnalités de l'interface web
- Gestion des magasins, KPI, objectifs, tâches

**Authentification** : `Authorization: Bearer <JWT_TOKEN>`

**Endpoints principaux** :
- `POST /api/stores/` - Créer un magasin
- `GET /api/stores/my-stores` - Lister mes magasins
- `GET /api/stores/{store_id}/info` - Informations d'un magasin
- `GET /api/manager/subscription-status` - Statut abonnement manager
- `GET /api/manager/store-kpi-overview` - Vue d'ensemble KPI
- `GET /api/seller/subscription-status` - Statut abonnement seller
- `GET /api/seller/tasks` - Tâches vendeur

---

### B) API Intégrations (Authentification X-API-Key)

**→ Consultez : [API_INTEGRATION_GUIDE.md](./API_INTEGRATION_GUIDE.md)**

**Idéal pour :**
- Synchroniser les données de vente (KPI) depuis votre caisse
- Intégration avec ERP, systèmes de paie
- Authentification simple par **API Key**

**Authentification** : `X-API-Key: <API_KEY>`

**Endpoints disponibles :**
- `POST /api/integrations/kpi/sync` - Synchroniser les KPI (endpoint officiel ERP)
- `POST /api/integrations/v1/kpi/sync` - Alias legacy (déprécié)

**Gestion des clés API** :
- `GET /api/integrations/api-keys` - Lister les clés API (nécessite JWT gérant)
- `POST /api/integrations/api-keys` - Créer une clé API (nécessite JWT gérant)

> ⚠️ **Important** : Les endpoints `/api/integrations/api-keys` nécessitent une authentification **JWT Bearer** (gérant), **PAS** une API Key. Ils sont utilisés depuis l'interface web pour gérer les clés API.

---

### 🏢 API Enterprise (Grandes Entreprises)

**→ Consultez : [ENTERPRISE_API_DOCUMENTATION.md](./ENTERPRISE_API_DOCUMENTATION.md)**

**Idéal pour :**
- Grandes entreprises avec provisionnement automatique
- Synchronisation avec Azure AD, Okta, SAP
- Gestion centralisée de centaines de magasins
- Mode SCIM 2.0

---

## 🚀 Démarrage Rapide

### Pour une intégration système (ERP, caisse) :

1. **Connectez-vous en tant que Gérant**
2. **Créez une clé API** dans "Intégrations API"
3. **Sélectionnez les permissions** nécessaires :
   - `write:kpi` - Envoyer des données de vente
   - `read:stats` - Lire les statistiques
4. **Suivez les exemples** dans [API_INTEGRATION_GUIDE.md](./API_INTEGRATION_GUIDE.md)

### Exemple rapide (API Key - Synchronisation KPI) :

```bash
# Synchroniser des KPI
curl -X POST https://api.retailperformerai.com/api/integrations/kpi/sync \
  -H "X-API-Key: rp_live_votre_cle" \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2025-01-15",
    "kpi_entries": [
      {
        "seller_id": "uuid-vendeur",
        "ca_journalier": 1250.50,
        "nb_ventes": 12,
        "nb_articles": 28,
        "prospects": 35
      }
    ]
  }'
```

### Exemple rapide (JWT - Créer un magasin) :

```bash
# Créer un magasin (authentification JWT)
curl -X POST https://api.retailperformerai.com/api/stores/ \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Boutique Paris",
    "location": "75001 Paris",
    "address": "123 Rue de Rivoli"
  }'
```

---

## ⚠️ Endpoints Non Disponibles

Les endpoints suivants sont **absents du runtime** et ne sont **pas disponibles** :

- ❌ `GET /api/integrations/my-stores` - **Non disponible**
- ❌ `GET /api/integrations/my-stats` - **Non disponible**
- ❌ `POST /api/integrations/stores` - **Non disponible**
- ❌ `POST /api/integrations/stores/{store_id}/managers` - **Non disponible**
- ❌ `POST /api/integrations/stores/{store_id}/sellers` - **Non disponible**
- ❌ `PUT /api/integrations/users/{user_id}` - **Non disponible**

**Alternatives** :
- Pour créer des magasins : Utilisez `POST /api/stores/` avec JWT (voir [GUIDE_API_STORES.md](./GUIDE_API_STORES.md))
- Pour lister les magasins : Utilisez `GET /api/stores/my-stores` avec JWT (voir [GUIDE_API_STORES.md](./GUIDE_API_STORES.md))
- Pour les intégrations Enterprise : Consultez [ENTERPRISE_API_DOCUMENTATION.md](./ENTERPRISE_API_DOCUMENTATION.md)

---

## 📞 Support

- **Email** : contact@retailperformerai.com
- **Documentation** : Consultez les fichiers ci-dessus
- **Rate Limiting** : 100 requêtes par minute par API key

## 🌐 Base URL

**Base URL unique** : `https://api.retailperformerai.com`

**CORS** : Les origines suivantes sont autorisées :
- `https://retailperformerai.com`
- `https://www.retailperformerai.com`

## 📚 Documentation OpenAPI

- **Swagger UI** : `https://api.retailperformerai.com/docs` (si activé en développement)
- **OpenAPI JSON** : `https://api.retailperformerai.com/openapi.json`

---

## 📊 Comparaison des Méthodes d'Authentification

| Méthode | Cas d'usage | Documentation | Avantages |
|---------|-------------|---------------|-----------|
| **JWT Token** | Application web/mobile | [GUIDE_API_STORES.md](./GUIDE_API_STORES.md), [GUIDE_API_MANAGER.md](./GUIDE_API_MANAGER.md), [GUIDE_API_SELLER.md](./GUIDE_API_SELLER.md) | ✅ Sécurisé<br>✅ Session utilisateur<br>✅ Expire automatiquement |
| **X-API-Key** | Intégration systèmes externes | [API_INTEGRATION_GUIDE.md](./API_INTEGRATION_GUIDE.md) | ✅ Simple<br>✅ Pas d'expiration<br>✅ Permissions granulaires |
| **IT Admin** | Provisionnement enterprise | [ENTERPRISE_API_DOCUMENTATION.md](./ENTERPRISE_API_DOCUMENTATION.md) | ✅ Gestion centralisée<br>✅ SCIM 2.0<br>✅ Multi-tenancy |

---

**Version de la documentation : 2.0.0 (Janvier 2025)**
