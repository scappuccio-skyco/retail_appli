# 🔗 Guide d'Intégration SAP ↔️ Retail Performer AI

**Version** : 1.0  
**Date** : 1er Décembre 2024  
**Objectif** : Connecter votre système SAP à Retail Performer AI pour synchroniser automatiquement vos données de vente

---

## 📋 Vue d'ensemble

Ce guide vous explique comment connecter **SAP** (ERP) à **Retail Performer AI** pour :
- ✅ Synchroniser automatiquement les données de vente (CA, nombre de ventes, articles vendus)
- ✅ Enrichir vos données SAP avec l'analyse IA de Retail Performer AI
- ✅ Centraliser le pilotage de vos performances retail

---

## 🏗️ Architecture de l'intégration

```
┌─────────────────┐         ┌──────────────────┐         ┌──────────────────────┐
│                 │         │                  │         │                      │
│   SAP ERP       │────────▶│  Middleware      │────────▶│ Retail Performer AI  │
│   (Source)      │         │  (Connecteur)    │         │  (API REST)          │
│                 │         │                  │         │                      │
└─────────────────┘         └──────────────────┘         └──────────────────────┘
```

**2 options d'intégration** :
1. **Directe** : SAP appelle directement l'API Retail Performer AI
2. **Via Middleware** : Utilisation d'un connecteur (SAP PI/PO, Dell Boomi, MuleSoft, etc.)

---

## 🔑 Étape 1 : Obtenir vos identifiants API

### 1.1 Créer une clé API dans Retail Performer AI

1. Connectez-vous à **Retail Performer AI** en tant que **Gérant**
2. Accédez à l'onglet **"Intégrations API"**
3. Cliquez sur **"Créer une nouvelle clé API"**
4. Configurez la clé :
   - **Nom** : `SAP Integration - Production`
   - **Permissions** : Cochez `write:kpi` (écriture des KPI)
   - **Expiration** : Laissez vide (pas d'expiration) ou 365 jours
5. Cliquez sur **"Créer la clé"**
6. ⚠️ **IMPORTANT** : Copiez immédiatement la clé générée (format : `rp_live_xxxxxxxxxxxxx`)

**Exemple de clé** :
```
rp_live_sk_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

### 1.2 Récupérer vos identifiants (Store IDs et Seller IDs)

**Via l'API** :
```bash
curl -X GET "https://data-bridge-36.preview.emergentagent.com/api/v1/integrations/my-stores" \
  -H "X-API-Key: rp_live_votre_cle_api_ici"
```

**Réponse** :
```json
{
  "stores": [
    {
      "id": "store-123-abc",
      "name": "Magasin Paris Centre",
      "location": "Paris 75001",
      "manager": {
        "id": "mgr-456-def",
        "name": "Jean Dupont"
      },
      "sellers": [
        {
          "id": "seller-789-ghi",
          "name": "Marie Martin"
        },
        {
          "id": "seller-012-jkl",
          "name": "Paul Durand"
        }
      ]
    }
  ]
}
```

📝 **Notez ces IDs** : Vous en aurez besoin pour la synchronisation

---

## 🔌 Étape 2 : Configuration SAP

### 2.1 Modules SAP concernés

L'intégration touche généralement ces modules SAP :
- **SAP SD (Sales & Distribution)** : Données de vente
- **SAP MM (Materials Management)** : Gestion des articles
- **SAP FI (Financial)** : Chiffre d'affaires
- **SAP Retail** : Si vous utilisez SAP for Retail

### 2.2 Tables SAP sources

**Tables principales à extraire** :
```sql
-- Tickets de caisse / Ventes
VBRK (Sales Documents: Header Data)
VBRP (Sales Documents: Item Data)

-- Articles vendus
MARA (General Material Data)
MARC (Plant Data for Material)

-- Clients
KNA1 (General Customer Master Data)
KNVV (Customer Master Sales Data)
```

### 2.3 Créer un programme ABAP (Option 1 - Direct)

Si vous avez accès à la programmation ABAP, voici un exemple de routine :

```abap
*&---------------------------------------------------------------------*
*& Report  Z_RETAIL_PERFORMER_SYNC
*&---------------------------------------------------------------------*
*& Synchronisation des ventes vers Retail Performer AI
*&---------------------------------------------------------------------*
REPORT z_retail_performer_sync.

PARAMETERS: p_date TYPE sy-datum DEFAULT sy-datum.

DATA: lv_api_key TYPE string VALUE 'rp_live_votre_cle_api_ici',
      lv_url     TYPE string VALUE 'https://data-bridge-36.preview.emergentagent.com/api/v1/integrations/kpi/sync',
      lv_json    TYPE string,
      lo_http    TYPE REF TO if_http_client.

* Récupérer les ventes du jour
SELECT vbrk~vbeln, vbrk~fkdat, vbrk~netwr, vbrp~arktx, vbrp~vrkme
  FROM vbrk
  INNER JOIN vbrp ON vbrk~vbeln = vbrp~vbeln
  WHERE vbrk~fkdat = @p_date
  INTO TABLE @DATA(lt_sales).

* Construire le JSON
lv_json = |{{ "store_id": "store-123-abc", "date": "{ p_date }", "kpis": [ |.

LOOP AT lt_sales INTO DATA(ls_sale).
  lv_json = lv_json && |{{ "seller_id": "seller-789-ghi", |.
  lv_json = lv_json && |"revenue": { ls_sale-netwr }, |.
  lv_json = lv_json && |"sales_count": 1, |.
  lv_json = lv_json && |"items_sold": 1 }},|.
ENDLOOP.

lv_json = lv_json && |] }}|.

* Appel HTTP vers Retail Performer AI
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
WRITE: / 'Response:', lv_response.
```

### 2.4 Utiliser SAP PI/PO (Option 2 - Middleware)

**SAP Process Integration / Process Orchestration** :

1. **Créer un Sender Channel** :
   - Type : File ou RFC
   - Source : Tables VBRK/VBRP
   - Format : XML ou JSON

2. **Créer un Receiver Channel** :
   - Type : HTTP
   - URL : `https://data-bridge-36.preview.emergentagent.com/api/v1/integrations/kpi/sync`
   - Méthode : POST
   - Headers :
     ```
     X-API-Key: rp_live_votre_cle_api_ici
     Content-Type: application/json
     ```

3. **Mapping** :
   - Mapper les champs SAP vers le format Retail Performer AI
   - Transformation XSLT ou Graphical Mapping

---

## 📤 Étape 3 : Format des données à envoyer

### 3.1 Endpoint de synchronisation

**URL** : `POST https://data-bridge-36.preview.emergentagent.com/api/v1/integrations/kpi/sync`

**Headers** :
```
X-API-Key: rp_live_votre_cle_api_ici
Content-Type: application/json
```

### 3.2 Structure JSON attendue

```json
{
  "store_id": "store-123-abc",
  "date": "2024-12-01",
  "kpis": [
    {
      "seller_id": "seller-789-ghi",
      "revenue": 1250.50,
      "sales_count": 15,
      "items_sold": 42
    },
    {
      "seller_id": "seller-012-jkl",
      "revenue": 980.75,
      "sales_count": 12,
      "items_sold": 35
    }
  ]
}
```

### 3.3 Mapping SAP → Retail Performer AI

| Champ SAP | Table SAP | Champ Retail Performer | Description |
|-----------|-----------|------------------------|-------------|
| `NETWR` | VBRK | `revenue` | Chiffre d'affaires HT |
| `COUNT(VBELN)` | VBRK | `sales_count` | Nombre de tickets |
| `SUM(FKIMG)` | VBRP | `items_sold` | Nombre d'articles vendus |
| `FKDAT` | VBRK | `date` | Date de facturation |
| `VKORG` | VBRK | `store_id` (mapping) | Organisation commerciale → Store ID |
| `PERNR` ou Custom | - | `seller_id` (mapping) | Matricule vendeur → Seller ID |

### 3.4 Exemple de mapping avec plusieurs vendeurs

**Données SAP** :
```
Ticket 1 : Vendeur A, CA 120€, 3 articles
Ticket 2 : Vendeur A, CA 80€, 2 articles
Ticket 3 : Vendeur B, CA 200€, 5 articles
```

**JSON envoyé** :
```json
{
  "store_id": "store-paris-01",
  "date": "2024-12-01",
  "kpis": [
    {
      "seller_id": "seller-vendeur-a",
      "revenue": 200.00,
      "sales_count": 2,
      "items_sold": 5
    },
    {
      "seller_id": "seller-vendeur-b",
      "revenue": 200.00,
      "sales_count": 1,
      "items_sold": 5
    }
  ]
}
```

---

## 🔄 Étape 4 : Automatisation

### 4.1 Job SAP planifié

**Créer un job SAP** pour synchroniser automatiquement :

1. Transaction **SM36** (Define Background Job)
2. Nom du job : `Z_RETAIL_PERF_DAILY_SYNC`
3. Programme : `Z_RETAIL_PERFORMER_SYNC`
4. Fréquence : 
   - **Option 1** : Toutes les heures (temps réel)
   - **Option 2** : 1x par jour à 23h00 (batch de fin de journée)
   - **Option 3** : À la fermeture de chaque magasin

**Variantes recommandées** :
- **Temps réel** : Job toutes les heures pour mise à jour continue
- **Batch quotidien** : Job à 23h pour consolider la journée

### 4.2 Gestion des erreurs

**En cas d'échec de l'appel API** :
```abap
IF lo_http->response->get_status( ) <> 200.
  " Logger l'erreur dans SAP
  CALL FUNCTION 'BAL_LOG_CREATE'
    EXPORTING
      i_log_handle = lv_log_handle.
  
  " Envoi email d'alerte
  CALL FUNCTION 'SO_NEW_DOCUMENT_ATT_SEND_API1'
    ...
  
  " Ou stocker dans une table de retry
  INSERT INTO z_retail_sync_errors VALUES ...
ENDIF.
```

**Stratégie de retry** :
- 1er échec : Retry après 5 minutes
- 2ème échec : Retry après 30 minutes
- 3ème échec : Alerte email + ticket support

---

## ✅ Étape 5 : Tests & Validation

### 5.1 Test unitaire avec cURL

**Tester manuellement l'envoi depuis votre machine** :

```bash
curl -X POST "https://data-bridge-36.preview.emergentagent.com/api/v1/integrations/kpi/sync" \
  -H "X-API-Key: rp_live_votre_cle_api_ici" \
  -H "Content-Type: application/json" \
  -d '{
    "store_id": "store-123-abc",
    "date": "2024-12-01",
    "kpis": [
      {
        "seller_id": "seller-789-ghi",
        "revenue": 1250.50,
        "sales_count": 15,
        "items_sold": 42
      }
    ]
  }'
```

**Réponse attendue (200 OK)** :
```json
{
  "success": true,
  "message": "KPIs synchronized successfully",
  "synced": {
    "store_id": "store-123-abc",
    "sellers_updated": 1,
    "date": "2024-12-01"
  }
}
```

### 5.2 Vérifier dans Retail Performer AI

1. Connectez-vous à **Retail Performer AI**
2. Allez sur le **Dashboard Manager** ou **Dashboard Gérant**
3. Vérifiez que les KPIs sont bien affichés :
   - CA du jour
   - Nombre de ventes
   - Articles vendus
4. Vérifiez la **dernière synchronisation** (timestamp)

### 5.3 Checklist de validation

- [ ] Les IDs (store_id, seller_id) correspondent bien
- [ ] Les montants sont corrects (attention aux décimales)
- [ ] La date est au bon format (YYYY-MM-DD)
- [ ] L'API retourne 200 OK
- [ ] Les données apparaissent dans Retail Performer AI
- [ ] Les graphiques se mettent à jour
- [ ] Pas d'erreurs dans les logs SAP

---

## 🔒 Sécurité

### Bonnes pratiques

1. **Stockage de la clé API** :
   - ⚠️ Ne jamais hardcoder la clé dans le code ABAP
   - ✅ Utiliser une table Z_CONFIG sécurisée
   - ✅ Ou utiliser SAP Secure Storage (SSF)

2. **HTTPS uniquement** :
   - ✅ L'API Retail Performer AI est en HTTPS
   - ⚠️ Ne jamais utiliser HTTP (non sécurisé)

3. **Rate Limiting** :
   - Limite : **100 requêtes par minute**
   - Respecter cette limite pour éviter le blocage

4. **Logs** :
   - Logger tous les appels API (succès + erreurs)
   - Conserver les logs 90 jours minimum

---

## 📊 Monitoring & Maintenance

### Indicateurs à surveiller

1. **Taux de succès** : 
   - Objectif : >99% de réussite
   - Alerte si <95%

2. **Latence** :
   - Temps moyen de réponse API : <500ms
   - Alerte si >2s

3. **Volume de données** :
   - Nombre de KPIs synchronisés par jour
   - Tendance d'évolution

### Dashboard de monitoring (optionnel)

Créer un rapport SAP pour suivre l'intégration :
```sql
SELECT 
  sync_date,
  COUNT(*) as nb_syncs,
  SUM(CASE WHEN status = 'SUCCESS' THEN 1 ELSE 0 END) as nb_success,
  SUM(CASE WHEN status = 'ERROR' THEN 1 ELSE 0 END) as nb_errors
FROM z_retail_sync_log
GROUP BY sync_date
ORDER BY sync_date DESC
```

---

## 🆘 Troubleshooting

### Erreur 401 - Unauthorized

**Cause** : Clé API invalide ou expirée  
**Solution** :
1. Vérifier que la clé est bien copiée (pas d'espace)
2. Vérifier que la clé n'a pas expiré
3. Régénérer une nouvelle clé si nécessaire

### Erreur 400 - Bad Request

**Cause** : Format JSON incorrect ou données invalides  
**Solution** :
1. Vérifier le format JSON (virgules, accolades)
2. Vérifier que les IDs (store_id, seller_id) existent
3. Vérifier le format de la date (YYYY-MM-DD)

### Erreur 404 - Not Found

**Cause** : Mauvaise URL  
**Solution** :
1. Vérifier l'URL : `/api/v1/integrations/kpi/sync` (avec `/sync` à la fin)
2. Vérifier le domaine

### Erreur 429 - Too Many Requests

**Cause** : Rate limit dépassé (>100 req/min)  
**Solution** :
1. Réduire la fréquence des appels
2. Grouper les données (batch)
3. Attendre 1 minute avant de retry

### Données non affichées

**Vérifications** :
1. L'API a bien retourné 200 OK ?
2. Les seller_id correspondent bien aux vendeurs dans Retail Performer AI ?
3. La date est-elle correcte ?
4. Attendre 1-2 minutes (cache)

---

## 📞 Support

### Contact Retail Performer AI

- **Email** : support@retailperformer.com
- **Documentation** : [API Guide complet](/app/API_INTEGRATION_GUIDE.md)
- **Statut API** : https://status.retailperformer.com (à créer)

### Contact SAP

- **SAP Support Portal** : https://support.sap.com
- **SAP Community** : https://community.sap.com

---

## 📚 Ressources complémentaires

### Documentation Retail Performer AI
- [Guide API complet](/app/API_INTEGRATION_GUIDE.md)
- [Postman Collection](#) (à créer)
- [Webhook documentation](#) (à venir)

### Documentation SAP
- [ABAP HTTP Client](https://help.sap.com/doc/abapdocu_751_index_htm/7.51/en-US/abenhttp_client.htm)
- [SAP PI/PO Integration](https://help.sap.com/viewer/product/SAP_NETWEAVER_PROCESS_INTEGRATION)

---

## ✨ Cas d'usage avancés

### 1. Synchronisation bidirectionnelle

**SAP → Retail Performer AI** : Données de vente (actuel)  
**Retail Performer AI → SAP** : Recommandations IA (à venir)

### 2. Enrichissement avec IA

Une fois les données dans Retail Performer AI :
- 🤖 Diagnostics IA automatiques
- 📊 Analyse de performance
- 🎯 Recommandations personnalisées
- 🏆 Gamification pour motiver les équipes

### 3. Reporting consolidé

Utiliser Retail Performer AI comme **hub de reporting** :
- Données SAP + données terrain
- KPIs enrichis par IA
- Export vers Power BI / Tableau

---

## 🎯 Feuille de route

### Phase 1 (Actuel) ✅
- [x] Synchronisation manuelle via API
- [x] Format JSON simple

### Phase 2 (3 mois)
- [ ] Webhook entrant (SAP push en temps réel)
- [ ] Support XML en plus de JSON
- [ ] Retry automatique en cas d'échec

### Phase 3 (6 mois)
- [ ] Connecteur SAP préconfiguré
- [ ] Dashboard SAP Fiori intégré
- [ ] Synchronisation bidirectionnelle

---

**🎉 Félicitations !** Vous êtes maintenant prêt à connecter SAP à Retail Performer AI.

**Besoin d'aide ?** Contactez notre équipe support : support@retailperformer.com

