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
- `POST /v1/integrations/sync-kpi` - Synchroniser les KPI
- `POST /v1/integrations/stores` - Créer des magasins
- `POST /v1/integrations/stores/{id}/managers` - Créer des managers
- `POST /v1/integrations/stores/{id}/sellers` - Créer des vendeurs
- `PUT /v1/integrations/users/{id}` - Mettre à jour des utilisateurs
- `GET /v1/integrations/my-stores` - Lister magasins et personnel
- `GET /v1/integrations/my-stats` - Récupérer statistiques

---

### 🏢 API Enterprise (Grandes Entreprises)
**→ Consultez : [ENTERPRISE_API_DOCUMENTATION.md](./ENTERPRISE_API_DOCUMENTATION.md)**

**Idéal pour :**
- Grandes entreprises avec provisionnement automatique
- Synchronisation avec Azure AD, Okta, SAP
- Gestion centralisée de centaines de magasins
- Mode SCIM 2.0

---

### 👤 API Utilisateur (Interface Web)
**→ Consultez : [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)**

**Idéal pour :**
- Développement d'une application web/mobile custom
- Authentification JWT (token)
- Accès aux fonctionnalités de l'interface web

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

### Exemple rapide :

```bash
# Créer un magasin
curl -X POST https://votre-domaine.com/api/v1/integrations/stores \
  -H "X-API-Key: rp_live_votre_cle" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Boutique Paris",
    "location": "75001 Paris"
  }'
```

---

## 📞 Support

- **Email** : contact@retailperformerai.com
- **Documentation** : Consultez les fichiers ci-dessus
- **Rate Limiting** : 100 requêtes par minute par API key

---

## 📊 Comparaison des Méthodes d'Authentification

| Méthode | Cas d'usage | Documentation | Avantages |
|---------|-------------|---------------|-----------|
| **API Key** | Intégration systèmes externes | [API_INTEGRATION_GUIDE.md](./API_INTEGRATION_GUIDE.md) | ✅ Simple<br>✅ Pas d'expiration<br>✅ Permissions granulaires |
| **JWT Token** | Application web/mobile | [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) | ✅ Sécurisé<br>✅ Session utilisateur<br>✅ Expire automatiquement |
| **IT Admin** | Provisionnement enterprise | [ENTERPRISE_API_DOCUMENTATION.md](./ENTERPRISE_API_DOCUMENTATION.md) | ✅ Gestion centralisée<br>✅ SCIM 2.0<br>✅ Multi-tenancy |

---

**Version de la documentation : 1.2 (8 Décembre 2025)**
