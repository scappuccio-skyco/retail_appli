# Audit de Cohérence des Champs de Données

## Problème Identifié
Incohérence dans les noms de champs pour le CA (Chiffre d'Affaires) entre sellers et managers.

## Standard Défini

### Collections MongoDB
1. **kpi_entries** (données sellers)
   - Champ CA : `seller_ca` (standard principal - 7284 entrées)
   - Champ legacy : `ca_journalier` (1746 entrées anciennes)

2. **manager_kpi** (données managers)
   - Champ CA : `ca_journalier` (0 entrées actuellement)

### Règles d'Architecture
- **Principe** : Toutes les données KPI sont rattachées au `store_id`, PAS aux `seller_id` ou `manager_id`
- **Raison** : Persistance des données même si les utilisateurs changent
- **Sellers** : utilisent `seller_ca`
- **Managers** : utilisent `ca_journalier`

## Pipelines MongoDB à Vérifier

Tous les pipelines doivent utiliser :
```javascript
// Pour aggreger les sellers
{"$sum": {"$ifNull": ["$seller_ca", {"$ifNull": ["$ca_journalier", 0]}]}}

// Pour aggreger les managers  
{"$sum": {"$ifNull": ["$ca_journalier", 0]}}
```

## Endpoints Corrigés
- ✅ `/api/gerant/stores/{store_id}/kpi-history` - Utilise maintenant `store_id` directement
- ✅ Helper function `get_ca_value()` créée pour cohérence

## Endpoints à Vérifier
- [ ] `/api/gerant/dashboard/stats`
- [ ] `/api/gerant/stores/{store_id}/stats`
- [ ] `/api/manager/dashboard/stats`
- [ ] Tous les endpoints d'agrégation KPI

## Champs Additionnels à Standardiser
- `nb_ventes` - ✅ Cohérent partout
- `nb_clients` - ✅ Cohérent partout  
- `nb_articles` - ✅ Cohérent partout
- `nb_prospects` - ✅ Cohérent partout
