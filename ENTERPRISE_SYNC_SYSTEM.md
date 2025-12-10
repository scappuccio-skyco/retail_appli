# 🏢 SYSTÈME DE SYNCHRONISATION GRAND COMPTE (ENTERPRISE)

## 📊 Vue d'Ensemble

Le système Enterprise permet aux **grandes organisations** de synchroniser automatiquement leurs données (utilisateurs et magasins) depuis leur système RH/ERP vers Retail Performer AI.

---

## 🎯 Architecture Enterprise

### Statut Actuel : ⚠️ **NON INTÉGRÉ À LA CLEAN ARCHITECTURE**

Les fichiers Enterprise existent mais sont **isolés** de la nouvelle architecture :
- `/app/backend/enterprise_routes.py` (753 lignes)
- `/app/backend/enterprise_models.py` (208 lignes)

**Ces modules utilisent l'ancienne architecture (server.py) et doivent être migrés.**

---

## 🔄 Modes de Synchronisation

### 1. **Mode API REST** (Recommandé)

Le client Enterprise fait des appels HTTP directs à nos endpoints pour créer/mettre à jour des données.

```
┌─────────────────────────────────────────────────────────────┐
│              SYSTÈME CLIENT (SAP, Workday, etc.)            │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTP REST API
                     ↓
┌─────────────────────────────────────────────────────────────┐
│           RETAIL PERFORMER API (Enterprise Endpoints)       │
│                                                             │
│  POST /api/enterprise/users/bulk-import                     │
│    → Crée ou met à jour des utilisateurs en masse          │
│                                                             │
│  POST /api/enterprise/stores/bulk-import                    │
│    → Crée ou met à jour des magasins en masse              │
│                                                             │
│  GET /api/enterprise/sync-status                            │
│    → Consulte le statut de synchronisation                 │
└─────────────────────────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────────┐
│                    MONGODB (retail_coach)                   │
│  Collections:                                               │
│  - enterprise_accounts                                      │
│  - users (avec enterprise_account_id)                       │
│  - stores (avec enterprise_account_id)                      │
│  - sync_logs (traçabilité)                                  │
└─────────────────────────────────────────────────────────────┘
```

### 2. **Mode SCIM 2.0** (Future)

Standard d'automatisation pour le provisionnement d'identités (utilisé par Okta, Azure AD, Google Workspace).

**Status** : 🚧 Prévu mais non implémenté

---

## 🔑 Authentification : API Keys

### Génération d'une Clé API

```http
POST /api/enterprise/api-keys/generate
Authorization: Bearer {jwt_token_it_admin}
Content-Type: application/json

{
  "name": "SAP Production Key",
  "scopes": ["users:read", "users:write", "stores:read", "stores:write"],
  "expires_in_days": 365
}
```

**Réponse** :
```json
{
  "id": "api_key_uuid",
  "key": "ent_xYz123AbC456DeF789...",
  "name": "SAP Production Key",
  "scopes": ["users:read", "users:write", "stores:read", "stores:write"],
  "created_at": "2025-12-10T10:00:00Z",
  "expires_at": "2026-12-10T10:00:00Z",
  "warning": "⚠️ Sauvegardez cette clé maintenant, elle ne sera plus affichée"
}
```

### Utilisation de la Clé API

Toutes les requêtes Enterprise doivent inclure le header :

```http
X-API-Key: ent_xYz123AbC456DeF789...
```

**Rate Limiting** : 100 requêtes/minute par clé API

---

## 📤 Import en Masse d'Utilisateurs

### Endpoint : `POST /api/enterprise/users/bulk-import`

**Headers** :
```http
X-API-Key: ent_xYz123AbC456DeF789...
Content-Type: application/json
```

**Body** :
```json
{
  "users": [
    {
      "email": "manager1@enterprise.com",
      "name": "Jean Dupont",
      "role": "manager",
      "store_id": "store-uuid-001",
      "external_id": "SAP-EMP-12345"
    },
    {
      "email": "seller1@enterprise.com",
      "name": "Marie Martin",
      "role": "seller",
      "store_id": "store-uuid-001",
      "manager_id": "manager-uuid",
      "external_id": "SAP-EMP-67890"
    }
  ],
  "mode": "create_or_update",
  "send_invitations": false
}
```

**Modes disponibles** :
- `create_only` : Crée uniquement (erreur si existe)
- `update_only` : Met à jour uniquement (erreur si n'existe pas)
- `create_or_update` : Crée ou met à jour (recommandé)

**Réponse** :
```json
{
  "success": true,
  "total_processed": 2,
  "created": 1,
  "updated": 1,
  "failed": 0,
  "errors": []
}
```

---

## 🏪 Import en Masse de Magasins

### Endpoint : `POST /api/enterprise/stores/bulk-import`

**Headers** :
```http
X-API-Key: ent_xYz123AbC456DeF789...
Content-Type: application/json
```

**Body** :
```json
{
  "stores": [
    {
      "name": "Magasin Paris Centre",
      "location": "Paris 75001",
      "address": "123 rue de Rivoli",
      "phone": "+33123456789",
      "external_id": "SAP-STORE-001"
    },
    {
      "name": "Magasin Lyon Part-Dieu",
      "location": "Lyon 69003",
      "address": "456 rue de la Part-Dieu",
      "phone": "+33456789012",
      "external_id": "SAP-STORE-002"
    }
  ],
  "mode": "create_or_update"
}
```

**Réponse** :
```json
{
  "success": true,
  "total_processed": 2,
  "created": 2,
  "updated": 0,
  "failed": 0,
  "errors": []
}
```

---

## 📊 Monitoring & Logs

### Statut de Synchronisation

```http
GET /api/enterprise/sync-status
Authorization: Bearer {jwt_token_it_admin}
```

**Réponse** :
```json
{
  "enterprise_account_id": "ent-uuid",
  "company_name": "ACME Corp",
  "sync_mode": "api",
  "total_users": 150,
  "total_stores": 25,
  "active_users": 145,
  "last_sync_at": "2025-12-10T09:30:00Z",
  "last_sync_status": "success",
  "last_sync_details": null,
  "scim_enabled": false,
  "recent_logs": [
    {
      "operation": "bulk_user_import",
      "status": "success",
      "timestamp": "2025-12-10T09:30:00Z",
      "details": {
        "created": 5,
        "updated": 10
      }
    }
  ]
}
```

### Logs Détaillés

```http
GET /api/enterprise/sync-logs?limit=50&operation=user_created&status=success
Authorization: Bearer {jwt_token_it_admin}
```

---

## 👥 Rôles & Permissions

### IT Admin

**Rôle** : Administrateur technique du compte Enterprise

**Permissions** :
- ✅ Gérer la configuration du compte entreprise
- ✅ Générer/révoquer les clés API
- ✅ Consulter les logs de synchronisation
- ✅ Consulter les statistiques globales
- ❌ Accéder aux données métier (KPI, ventes)

**Création** :
```http
POST /api/enterprise/register
Content-Type: application/json

{
  "company_name": "ACME Corp",
  "company_email": "it@acmecorp.com",
  "sync_mode": "api",
  "it_admin_name": "Admin IT",
  "it_admin_email": "admin.it@acmecorp.com",
  "it_admin_password": "SecureP@ssw0rd!"
}
```

---

## 🗄️ Schéma de Données

### Collection : `enterprise_accounts`

```javascript
{
  "id": "ent-uuid",
  "company_name": "ACME Corp",
  "company_email": "it@acmecorp.com",
  "sync_mode": "api",  // "api" ou "scim"
  
  // Configuration SCIM (si applicable)
  "scim_enabled": false,
  "scim_base_url": null,
  "scim_bearer_token": null,
  "scim_last_sync": null,
  "scim_sync_status": "never",
  
  // Facturation
  "billing_type": "enterprise",
  "stripe_customer_id": "cus_...",
  "stripe_subscription_id": "sub_...",
  "seats_purchased": 200,
  "seats_used": 150,
  
  // Dates
  "created_at": "2025-01-01T00:00:00Z",
  "updated_at": "2025-12-10T10:00:00Z"
}
```

### Collection : `api_keys`

```javascript
{
  "id": "key-uuid",
  "key": "ent_xYz123AbC456DeF789...",  // Haché en production
  "enterprise_account_id": "ent-uuid",
  "name": "SAP Production Key",
  
  // Permissions
  "scopes": ["users:read", "users:write", "stores:read", "stores:write"],
  
  // Status
  "is_active": true,
  "last_used_at": "2025-12-10T09:30:00Z",
  "request_count": 1523,
  
  // Expiration
  "created_at": "2025-01-01T00:00:00Z",
  "created_by": "it-admin-uuid",
  "expires_at": "2026-01-01T00:00:00Z"
}
```

### Collection : `sync_logs`

```javascript
{
  "id": "log-uuid",
  "enterprise_account_id": "ent-uuid",
  "sync_type": "api",
  "operation": "bulk_user_import",
  "status": "success",
  
  // Détails
  "resource_type": "bulk",
  "resource_id": null,
  "details": {
    "total_processed": 15,
    "created": 5,
    "updated": 10,
    "failed": 0
  },
  "error_message": null,
  
  // Métadonnées
  "initiated_by": "api_key:key-uuid",
  "timestamp": "2025-12-10T09:30:00Z"
}
```

### Extension des Collections Existantes

**`users` (ajout de champs Enterprise)** :
```javascript
{
  "id": "user-uuid",
  "email": "manager@enterprise.com",
  "name": "Jean Dupont",
  "role": "manager",
  
  // NOUVEAU : Champs Enterprise
  "enterprise_account_id": "ent-uuid",  // Lien vers le compte
  "external_id": "SAP-EMP-12345",       // ID dans le système source
  "sync_mode": "api_sync",              // Source de création
  
  // ... autres champs standards
}
```

**`stores` (ajout de champs Enterprise)** :
```javascript
{
  "id": "store-uuid",
  "name": "Magasin Paris Centre",
  
  // NOUVEAU : Champs Enterprise
  "enterprise_account_id": "ent-uuid",
  "external_id": "SAP-STORE-001",
  "sync_mode": "api_sync",
  "gerant_id": null,  // null pour les comptes enterprise
  
  // ... autres champs standards
}
```

---

## ⚠️ État Actuel & Migration Nécessaire

### ❌ Non Intégré à la Clean Architecture

**Problème** : Les fichiers `enterprise_routes.py` et `enterprise_models.py` :
- Utilisent l'ancienne architecture (server.py)
- Ne sont pas enregistrés dans `main.py`
- Ne suivent pas le pattern Clean Architecture
- Ne bénéficient pas des tests RBAC

### ✅ Migration Recommandée

Pour intégrer le système Enterprise dans la nouvelle architecture :

1. **Créer les modèles Pydantic propres**
   - Déplacer `enterprise_models.py` → `/app/backend/models/enterprise.py`
   - Nettoyer et standardiser avec les autres modèles

2. **Créer le repository**
   - `/app/backend/repositories/enterprise_repository.py`
   - Gérer `enterprise_accounts`, `api_keys`, `sync_logs`

3. **Créer le service**
   - `/app/backend/services/enterprise_service.py`
   - Logique métier : bulk import, sync status, API key management

4. **Créer les routes**
   - `/app/backend/api/routes/enterprise.py`
   - Thin controllers utilisant le service

5. **Enregistrer dans main.py**
   ```python
   from api.routes.enterprise import router as enterprise_router
   
   app.include_router(enterprise_router)
   ```

6. **Ajouter les tests RBAC**
   - Tests IT Admin access
   - Tests API Key authentication
   - Tests bulk import

---

## 🚀 Exemple de Workflow Complet

### Scénario : Synchronisation quotidienne depuis SAP

```
1. SETUP (Une fois)
   ├─ IT Admin crée un compte Enterprise via /api/enterprise/register
   ├─ IT Admin génère une API key via /api/enterprise/api-keys/generate
   └─ IT Admin configure un job cron dans SAP

2. SYNCHRONISATION QUOTIDIENNE (Automatique)
   ├─ 01:00 - SAP exporte la liste des magasins
   ├─ 01:05 - SAP appelle POST /api/enterprise/stores/bulk-import
   │           → Crée/met à jour 25 magasins
   ├─ 01:10 - SAP exporte la liste des employés
   ├─ 01:15 - SAP appelle POST /api/enterprise/users/bulk-import
   │           → Crée/met à jour 150 utilisateurs (managers + sellers)
   └─ 01:20 - SAP enregistre le statut de synchronisation

3. MONITORING (Manuel)
   ├─ IT Admin consulte GET /api/enterprise/sync-status
   ├─ Vérifie que last_sync_status = "success"
   ├─ Consulte GET /api/enterprise/sync-logs si problème
   └─ Reçoit des alertes email si sync_status = "failed"

4. UTILISATION (Continue)
   ├─ Les managers/sellers créés se connectent via /api/auth/login
   ├─ Ils accèdent à leurs espaces respectifs (Manager, Seller)
   └─ Les données KPI sont saisies normalement
```

---

## 📈 Bénéfices Business

### Pour le Client Enterprise

✅ **Automatisation complète** : Pas de saisie manuelle  
✅ **Synchronisation temps réel** : Données toujours à jour  
✅ **Traçabilité** : Logs détaillés de toutes les opérations  
✅ **Scalabilité** : Gère des milliers d'utilisateurs  
✅ **Sécurité** : API Keys avec rate limiting, RBAC strict  

### Pour Retail Performer

✅ **Revenus récurrents** : Facturation basée sur les sièges  
✅ **Réduction du support** : Pas de gestion manuelle  
✅ **Upsell** : Plus de sièges = plus de revenus  
✅ **Positionnement premium** : Cible les grandes entreprises  

---

## 🔮 Roadmap Future

### Phase 1 : Migration Clean Architecture (Prioritaire)
- [ ] Migrer les modèles vers `models/enterprise.py`
- [ ] Créer `EnterpriseRepository`
- [ ] Créer `EnterpriseService`
- [ ] Créer routes `/api/enterprise/*`
- [ ] Tests RBAC IT Admin (100%)

### Phase 2 : SCIM 2.0 Support
- [ ] Implémenter protocole SCIM 2.0
- [ ] Support Okta, Azure AD, Google Workspace
- [ ] Webhooks pour sync bidirectionnelle

### Phase 3 : Features Avancées
- [ ] Dashboard IT Admin dédié
- [ ] Alertes email automatiques (sync failed)
- [ ] Audit trail complet (compliance)
- [ ] API rate limiting par entreprise

---

## 📝 Conclusion

Le système Enterprise existe mais **doit être migré** vers la Clean Architecture pour bénéficier de :
- ✅ Testabilité (RBAC)
- ✅ Maintenabilité (séparation des couches)
- ✅ Performance (optimisations DB)
- ✅ Sécurité (audits réguliers)

**Prochaine étape** : Planifier et exécuter la migration Enterprise dans la nouvelle architecture.

---

**Dernière mise à jour** : Décembre 2025  
**Status** : ⚠️ **Migration Requise**  
**Priorité** : 🔴 Haute (si clients Enterprise actifs)
