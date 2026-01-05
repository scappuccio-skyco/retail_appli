# 📘 Guide de la Documentation API

Bienvenue ! Retail Performer AI propose plusieurs APIs selon vos besoins d'intégration.

---

## 🎯 Quelle documentation utiliser ?

### 🔑 Intégration Système Externe (Caisse, ERP, etc.)
**→ Consultez : [API_INTEGRATION_GUIDE.md](./API_INTEGRATION_GUIDE.md)**

**Idéal pour :**
- Synchroniser les données de vente (KPI) depuis votre caisse
- Créer des magasins, managers et vendeurs via API
- Intégration avec SAP, ERP, systèmes de paie
- Authentification simple par **API Key**

**Endpoints disponibles :**
- `POST /api/integrations/kpi/sync` - Synchroniser les KPI
- `GET /api/integrations/my-stores` - Lister magasins et personnel
- `GET /api/integrations/my-stats` - Récupérer statistiques

> ⚠️ **Note** : Les endpoints `/api/integrations/stores/*` sont dépréciés. Pour créer des magasins via API Key, utilisez les endpoints Enterprise. Pour l'authentification JWT, consultez les guides ci-dessous.

---

### 🏢 API Enterprise (Grandes Entreprises)
**→ Consultez : [ENTERPRISE_API_DOCUMENTATION.md](./ENTERPRISE_API_DOCUMENTATION.md)**

**Idéal pour :**
- Grandes entreprises avec provisionnement automatique
- Synchronisation avec Azure AD, Okta, SAP
- Gestion centralisée de centaines de magasins
- Mode SCIM 2.0

---

### 👤 API Utilisateur (Interface Web) - Authentification JWT
**→ Consultez les guides dédiés :**

- 📘 **[GUIDE_API_STORES.md](./GUIDE_API_STORES.md)** - Gestion des boutiques (magasins)
- 📘 **[GUIDE_API_MANAGER.md](./GUIDE_API_MANAGER.md)** - Endpoints Manager
- 📘 **[GUIDE_API_SELLER.md](./GUIDE_API_SELLER.md)** - Endpoints Vendeur

**Idéal pour :**
- Développement d'une application web/mobile custom
- Authentification JWT (token)
- Accès aux fonctionnalités de l'interface web
- Gestion des magasins, KPI, objectifs, tâches

**Base URL** : `https://api.retailperformerai.com`

---

## 🚀 Démarrage Rapide

### Pour une intégration simple (recommandé) :

1. **Connectez-vous en tant que Gérant**
2. **Créez une clé API** dans "Intégrations API"
3. **Sélectionnez les permissions** nécessaires :
   - `write:kpi` - Envoyer des données de vente
   - `read:stats` - Lire les statistiques
   - `write:stores` - Créer des magasins
   - `write:users` - Gérer les utilisateurs
4. **Suivez les exemples** dans [API_INTEGRATION_GUIDE.md](./API_INTEGRATION_GUIDE.md)

### Exemple rapide (API Key) :

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
        "nb_articles": 28
      }
    ]
  }'
```

### Exemple rapide (JWT - Stores) :

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
| **API Key** | Intégration systèmes externes | [API_INTEGRATION_GUIDE.md](./API_INTEGRATION_GUIDE.md) | ✅ Simple<br>✅ Pas d'expiration<br>✅ Permissions granulaires |
| **JWT Token** | Application web/mobile | [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) | ✅ Sécurisé<br>✅ Session utilisateur<br>✅ Expire automatiquement |
| **IT Admin** | Provisionnement enterprise | [ENTERPRISE_API_DOCUMENTATION.md](./ENTERPRISE_API_DOCUMENTATION.md) | ✅ Gestion centralisée<br>✅ SCIM 2.0<br>✅ Multi-tenancy |

---

**Version de la documentation : 2.0.0 (Janvier 2025)**

## ⚠️ Endpoints Dépréciés

Les endpoints suivants sont dépréciés :
- `POST /api/integrations/stores` → Utiliser `POST /api/stores/` (JWT) ou endpoints Enterprise (API Key)
- `POST /api/v1/integrations/stores` → Déprécié
- `GET /api/v1/integrations/my-stores` → Utiliser `GET /api/integrations/my-stores` (API Key) ou `GET /api/stores/my-stores` (JWT)

Consultez les guides dédiés pour les nouveaux chemins recommandés.
