# 🚀 Intégration SAP Avancée - Provisioning Automatique

**Version** : 2.0  
**Date** : 1er Décembre 2024  
**Objectif** : Synchroniser automatiquement l'organigramme complet (magasins + équipes) depuis SAP

---

## 🎯 Problème résolu

**Avant** : Création manuelle de chaque utilisateur (40-80h pour 200 vendeurs)  
**Après** : Import automatique en 1 clic (5 minutes)

---

## 📋 Nouveau endpoint : Provisioning en masse

### Endpoint d'import

**URL** : `POST /api/v1/integrations/bulk-provisioning`

**Headers** :
```
X-API-Key: rp_live_votre_cle_api_ici
Content-Type: application/json
```

**Body** :
```json
{
  "gerant_id": "auto-generated-or-existing",
  "company_name": "Ma Chaîne de Magasins SAS",
  "stores": [
    {
      "external_id": "SAP-STORE-001",
      "name": "Magasin Paris Centre",
      "location": "Paris 75001",
      "address": "123 Rue de Rivoli, 75001 Paris",
      "managers": [
        {
          "external_id": "SAP-MGR-001",
          "email": "jean.dupont@company.com",
          "first_name": "Jean",
          "last_name": "Dupont",
          "phone": "+33612345678"
        }
      ],
      "sellers": [
        {
          "external_id": "SAP-SELLER-001",
          "email": "marie.martin@company.com",
          "first_name": "Marie",
          "last_name": "Martin",
          "phone": "+33687654321",
          "employee_number": "EMP-2024-001"
        },
        {
          "external_id": "SAP-SELLER-002",
          "email": "paul.durand@company.com",
          "first_name": "Paul",
          "last_name": "Durand",
          "phone": "+33698765432",
          "employee_number": "EMP-2024-002"
        }
      ]
    },
    {
      "external_id": "SAP-STORE-002",
      "name": "Magasin Lyon Part-Dieu",
      "location": "Lyon 69003",
      "address": "17 Rue de la République, 69003 Lyon",
      "managers": [
        {
          "external_id": "SAP-MGR-002",
          "email": "sophie.bernard@company.com",
          "first_name": "Sophie",
          "last_name": "Bernard"
        }
      ],
      "sellers": [...]
    }
  ],
  "options": {
    "send_welcome_emails": false,
    "auto_generate_passwords": true,
    "create_if_not_exists": true,
    "update_if_exists": true
  }
}
```

### Réponse

**Success (200 OK)** :
```json
{
  "success": true,
  "message": "Provisioning completed successfully",
  "summary": {
    "stores_created": 2,
    "stores_updated": 0,
    "managers_created": 2,
    "managers_updated": 0,
    "sellers_created": 4,
    "sellers_updated": 0,
    "total_users_created": 6,
    "errors": []
  },
  "mapping": {
    "stores": {
      "SAP-STORE-001": "store-uuid-123",
      "SAP-STORE-002": "store-uuid-456"
    },
    "users": {
      "SAP-MGR-001": "user-uuid-789",
      "SAP-SELLER-001": "user-uuid-012",
      ...
    }
  },
  "credentials": [
    {
      "email": "jean.dupont@company.com",
      "temporary_password": "TempPass123!",
      "role": "manager"
    },
    ...
  ]
}
```

---

## 🔄 Workflow de provisioning

### 1. Extraction depuis SAP

**Tables SAP à extraire** :

```sql
-- Magasins (Organisation commerciale)
SELECT 
  vkorg AS external_id,
  vtext AS name,
  ort01 AS location,
  stras AS address
FROM tvkot
WHERE spras = 'FR';

-- Managers / Responsables
SELECT 
  pernr AS external_id,
  usrid_long AS email,
  vorna AS first_name,
  nachn AS last_name,
  telnr AS phone,
  orgeh AS organization_unit
FROM pa0105
WHERE subty = '0010' -- Email professionnel
AND ...;

-- Vendeurs
SELECT 
  pernr AS employee_number,
  usrid_long AS email,
  vorna AS first_name,
  nachn AS last_name,
  telnr AS phone,
  orgeh AS store_id
FROM pa0105
WHERE plans = 'VENDEUR' -- Poste de vendeur
AND stat2 = '3'; -- Actif
```

### 2. Programme ABAP de synchronisation

```abap
*&---------------------------------------------------------------------*
*& Report  Z_RETAIL_PERFORMER_BULK_SYNC
*&---------------------------------------------------------------------*
*& Synchronisation complète organigramme vers Retail Performer AI
*&---------------------------------------------------------------------*
REPORT z_retail_performer_bulk_sync.

DATA: lv_api_key TYPE string VALUE 'rp_live_votre_cle_api_ici',
      lv_url     TYPE string VALUE 'https://monolith-to-clean.preview.emergentagent.com/api/v1/integrations/bulk-provisioning',
      lv_json    TYPE string,
      lo_http    TYPE REF TO if_http_client.

* 1. Extraire les magasins
SELECT vkorg, vtext, ort01
  FROM tvkot
  WHERE spras = 'FR'
  INTO TABLE @DATA(lt_stores).

* 2. Pour chaque magasin, extraire managers et vendeurs
LOOP AT lt_stores INTO DATA(ls_store).
  
  " Extraire managers de ce magasin
  SELECT pernr, usrid_long, vorna, nachn
    FROM pa0105
    WHERE orgeh = @ls_store-vkorg
    AND ...
    INTO TABLE @DATA(lt_managers).
  
  " Extraire vendeurs de ce magasin
  SELECT pernr, usrid_long, vorna, nachn
    FROM pa0105
    WHERE orgeh = @ls_store-vkorg
    AND plans = 'VENDEUR'
    INTO TABLE @DATA(lt_sellers).
  
  " Construire le JSON pour ce magasin
  " ...
  
ENDLOOP.

* 3. Construire le JSON complet
lv_json = build_json_payload( lt_stores ).

* 4. Appel API
cl_http_client=>create_by_url(
  EXPORTING url = lv_url
  IMPORTING client = lo_http ).

lo_http->request->set_method( 'POST' ).
lo_http->request->set_header_field( name = 'X-API-Key' value = lv_api_key ).
lo_http->request->set_header_field( name = 'Content-Type' value = 'application/json' ).
lo_http->request->set_cdata( lv_json ).

lo_http->send( ).
lo_http->receive( ).

DATA(lv_response) = lo_http->response->get_cdata( ).
DATA(lv_status) = lo_http->response->get_status( ).

IF lv_status = 200.
  WRITE: / '✅ Provisioning réussi!'.
  
  " Parser la réponse pour récupérer le mapping
  " Stocker dans une table Z_RETAIL_MAPPING pour synchronisation future
  
ELSE.
  WRITE: / '❌ Erreur:', lv_status, lv_response.
ENDIF.
```

### 3. Stockage du mapping

Créer une table custom SAP pour stocker le mapping :

```abap
" Table Z_RETAIL_MAPPING
@EndUserText.label : 'Retail Performer ID Mapping'
@AbapCatalog.enhancement.category : #NOT_EXTENSIBLE
define table z_retail_mapping {
  key mandt         : mandt not null;
  key external_id   : char20 not null;  " ID SAP (PERNR, VKORG, etc.)
  key object_type   : char10 not null;  " 'STORE', 'MANAGER', 'SELLER'
  retail_id         : char36 not null;  " UUID Retail Performer AI
  last_sync         : timestampl;
  sync_status       : char10;           " 'SUCCESS', 'ERROR'
}
```

Utiliser cette table pour :
- Retrouver les IDs Retail Performer lors de la sync KPI
- Éviter de recréer des utilisateurs déjà provisionnés
- Tracer la synchronisation

---

## 🔐 Gestion des mots de passe

### Option 1 : Mots de passe temporaires (Simple)

**Workflow** :
1. API génère un mot de passe temporaire pour chaque utilisateur
2. Vous récupérez la liste dans la réponse
3. Vous envoyez les identifiants par email (depuis SAP ou manuellement)
4. Utilisateurs se connectent et changent leur mot de passe

**Avantage** : Simple, pas de config supplémentaire  
**Inconvénient** : Utilisateurs doivent se connecter une première fois

### Option 2 : SSO / SAML (Avancé) ⭐ RECOMMANDÉ

**Workflow** :
1. Utilisateurs se connectent avec leurs identifiants SAP (ou AD)
2. SAP authentifie l'utilisateur
3. Token SAML envoyé à Retail Performer AI
4. Connexion automatique

**Avantage** : Zéro friction, expérience fluide  
**Inconvénient** : Configuration SAML nécessaire

### Option 3 : Lien magique par email

**Workflow** :
1. API génère un lien magique (token unique) pour chaque utilisateur
2. Email automatique envoyé par Retail Performer AI
3. Utilisateur clique sur le lien → Connexion directe
4. Définit son mot de passe

**Avantage** : Pas besoin de communiquer les mots de passe  
**Inconvénient** : Nécessite email valide

---

## 🔄 Synchronisation continue

### Mise à jour automatique

**Scénario 1 : Nouveau vendeur embauché dans SAP**

```abap
" Event handler SAP HR
WHEN 'NEW_EMPLOYEE'.
  " Appeler l'API pour créer le vendeur
  CALL FUNCTION 'Z_RETAIL_CREATE_USER'
    EXPORTING
      iv_employee = ls_employee
      iv_store_id = ls_employee-orgeh.
```

**Scénario 2 : Vendeur change de magasin**

```abap
" Event handler SAP HR
WHEN 'TRANSFER_EMPLOYEE'.
  " Appeler l'API pour transférer le vendeur
  POST /api/gerant/sellers/{seller_id}/transfer
  Body: { "new_store_id": "store-uuid-new" }
```

**Scénario 3 : Vendeur quitte l'entreprise**

```abap
" Event handler SAP HR
WHEN 'TERMINATE_EMPLOYEE'.
  " Appeler l'API pour suspendre/supprimer
  PATCH /api/gerant/sellers/{seller_id}/suspend
  ou
  DELETE /api/gerant/sellers/{seller_id}
```

### Job de réconciliation quotidien

**Objectif** : S'assurer que SAP et Retail Performer AI sont synchronisés

```abap
REPORT z_retail_reconciliation.

" 1. Lister tous les employés actifs dans SAP
SELECT * FROM pa0000 WHERE stat2 = '3' INTO TABLE @DATA(lt_sap_users).

" 2. Lister tous les users dans Retail Performer AI
GET /api/v1/integrations/all-users

" 3. Comparer et identifier les différences
LOOP AT lt_sap_users INTO DATA(ls_sap_user).
  READ TABLE lt_retail_users WITH KEY external_id = ls_sap_user-pernr.
  IF sy-subrc <> 0.
    " Utilisateur existe dans SAP mais pas dans Retail Performer
    " → Créer
    APPEND ls_sap_user TO lt_to_create.
  ENDIF.
ENDLOOP.

" 4. Appliquer les corrections
" ...
```

---

## 📊 Endpoint de réconciliation (à créer)

### Liste des utilisateurs

**URL** : `GET /api/v1/integrations/all-users`

**Query params** :
- `include_inactive` : true/false
- `external_ids_only` : true (retourne juste les external_id pour comparaison)

**Réponse** :
```json
{
  "users": [
    {
      "retail_id": "user-uuid-123",
      "external_id": "SAP-SELLER-001",
      "email": "marie.martin@company.com",
      "role": "seller",
      "status": "active",
      "store_external_id": "SAP-STORE-001"
    },
    ...
  ]
}
```

### Rapport de différences

**URL** : `POST /api/v1/integrations/reconciliation-report`

**Body** :
```json
{
  "sap_users": [
    {"external_id": "SAP-SELLER-001", "status": "active"},
    {"external_id": "SAP-SELLER-002", "status": "active"},
    ...
  ]
}
```

**Réponse** :
```json
{
  "summary": {
    "sap_count": 200,
    "retail_count": 198,
    "differences": 2
  },
  "missing_in_retail": [
    {"external_id": "SAP-SELLER-150", "action": "create"}
  ],
  "missing_in_sap": [
    {"external_id": "SAP-SELLER-099", "action": "suspend_or_delete"}
  ],
  "status_mismatch": []
}
```

---

## 🎯 Workflow complet d'onboarding

### Première mise en place (Day 1)

```
1. Client SAP contacte votre support
2. Vous créez le compte Gérant manuellement
3. Vous générez une clé API avec permission "admin"
4. Client extrait son organigramme SAP
5. Client appelle POST /bulk-provisioning
6. En 5 minutes : 50 magasins + 200 vendeurs créés ✅
7. Vous envoyez les identifiants ou configurez SSO
8. Utilisateurs se connectent immédiatement
```

### Au quotidien

```
- SAP sync KPI toutes les heures (comme avant)
- SAP sync organigramme 1x par jour (réconciliation)
- Events SAP → API en temps réel (nouveau vendeur, transfert, etc.)
```

---

## 💡 Avantages du provisioning automatique

| Avant (Manuel) | Après (Auto) |
|----------------|--------------|
| 40-80h de saisie | 5 min d'import |
| Risque d'erreurs | 0 erreur |
| Emails d'invitation | Accès immédiat |
| Friction importante | Onboarding fluide |
| 1-2 semaines de setup | 1 jour de setup |

---

## 🚀 Roadmap d'implémentation

### Phase 1 : Provisioning en masse (4 semaines)
- [ ] Endpoint `/bulk-provisioning`
- [ ] Validation des données
- [ ] Génération mots de passe temporaires
- [ ] Mapping external_id ↔ internal_id

### Phase 2 : Synchronisation continue (2 semaines)
- [ ] Endpoint `/all-users` pour réconciliation
- [ ] Endpoint `/reconciliation-report`
- [ ] Webhooks SAP → Retail Performer AI

### Phase 3 : SSO / SAML (4 semaines)
- [ ] Configuration SAML
- [ ] Support AD / Azure AD
- [ ] Tests d'authentification

### Phase 4 : Interface d'admin (2 semaines)
- [ ] Dashboard mapping SAP ↔ Retail
- [ ] Logs de synchronisation
- [ ] Résolution manuelle des conflits

---

## 📞 Support

Pour implémenter le provisioning automatique, contactez :
- **Email** : enterprise@retailperformer.com
- **Planning** : Délai de mise en place 4-6 semaines

---

**Ce guide résout le problème #1 d'adoption pour les clients SAP** 🎯

