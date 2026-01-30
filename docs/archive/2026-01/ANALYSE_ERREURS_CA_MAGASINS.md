# Analyse des Erreurs Potentielles dans le Calcul des CA Magasins

## 🔍 Problèmes Identifiés

### 1. **INCOHÉRENCE DE COLLECTION MongoDB** ⚠️ CRITIQUE ✅ CORRIGÉ

**Problème identifié** : Le code utilisait **deux noms de collection différents** pour les KPIs managers :

- `manager_kpis` (pluriel) - utilisé dans `get_store_stats()` lignes 403, 461, 481
- `manager_kpi` (singulier) - utilisé dans `get_store_kpi_overview()` lignes 950, 1051, 1349

**Impact** : Si la collection réelle est `manager_kpis` (pluriel, comme défini dans `ManagerKPIRepository`), alors les requêtes avec `manager_kpi` (singulier) ne retournaient aucune donnée, ce qui faisait que le CA des managers n'était jamais compté dans certaines vues !

**✅ Correction appliquée** :
- Toutes les occurrences de `db.manager_kpi` ont été remplacées par `db.manager_kpis` dans :
  - `backend/services/gerant_service.py` (3 occurrences)
  - `backend/api/routes/manager.py` (8 occurrences)

**Collection standard** : `manager_kpis` (pluriel) - conforme au `ManagerKPIRepository`

### 2. **DOUBLE COMPTAGE POTENTIEL**

Si un manager saisit des KPIs :
- Dans `kpi_entries` (en tant que seller_id = manager_id)
- ET dans `manager_kpis` (en tant que manager_id)

Alors son CA sera compté **deux fois** dans le total du magasin.

**Code problématique** (lignes 470-471 de `gerant_service.py`) :
```python
period_ca = (period_sellers[0].get("total_ca", 0) if period_sellers else 0) + \
            (period_managers[0].get("total_ca", 0) if period_managers else 0)
```

Cette addition ne vérifie pas si un manager a aussi des entrées dans `kpi_entries`.

### 3. **CALCUL DE PÉRIODE - MOIS EN COURS vs MOIS COMPLET**

Pour `period_offset = 0` (mois actuel), le code calcule :
- `period_start` = 1er jour du mois actuel
- `period_end` = dernier jour du mois actuel

**Problème** : Si on est le 15 janvier, le calcul inclut les 15 premiers jours de janvier, pas le mois complet. Cela peut créer des incohérences si l'utilisateur s'attend à voir le mois complet.

### 4. **CHAMPS CA INCOHÉRENTS**

Dans `kpi_entries` :
- Les sellers utilisent `seller_ca` (nouveau standard)
- Fallback sur `ca_journalier` (legacy)

Dans `manager_kpis` :
- Les managers utilisent uniquement `ca_journalier`

**Risque** : Si un manager a des entrées dans `kpi_entries` avec `ca_journalier` au lieu de `seller_ca`, le calcul pourrait être incorrect.

## 🔧 Corrections Recommandées

### Correction 1 : Unifier le nom de collection

**Fichier** : `backend/services/gerant_service.py`

**Lignes à corriger** : 403, 461, 481

**Action** : Vérifier quelle collection existe réellement et utiliser le même nom partout.

```python
# Option A : Si la collection est "manager_kpi" (singulier)
managers_today = await self.db.manager_kpi.aggregate([...])

# Option B : Si la collection est "manager_kpis" (pluriel)  
managers_today = await self.db.manager_kpis.aggregate([...])
```

### Correction 2 : Éviter le double comptage

**Fichier** : `backend/services/gerant_service.py`

**Ligne** : ~470

**Solution** : Exclure les managers de `kpi_entries` si ils ont des entrées dans `manager_kpis` :

```python
# Récupérer les IDs des managers qui ont des KPIs dans manager_kpis
managers_with_kpis = await self.db.manager_kpis.distinct("manager_id", {
    "store_id": store_id,
    "date": {"$gte": period_start, "$lte": period_end}
})

# Exclure ces managers de kpi_entries pour éviter double comptage
period_sellers = await self.db.kpi_entries.aggregate([
    {
        "$match": {
            "store_id": store_id,
            "date": {"$gte": period_start, "$lte": period_end},
            "seller_id": {"$nin": managers_with_kpis}  # Exclure les managers
        }
    },
    {"$group": {
        "_id": None,
        "total_ca": {"$sum": {"$ifNull": ["$seller_ca", {"$ifNull": ["$ca_journalier", 0]}]}},
        "total_ventes": {"$sum": {"$ifNull": ["$nb_ventes", 0]}}
    }}
]).to_list(1)
```

### Correction 3 : Clarifier la période "mois actuel"

**Option A** : Toujours afficher le mois complet (même si on est au milieu)
**Option B** : Afficher "mois en cours" (du 1er au jour actuel) avec un label clair

## 📊 Script d'Analyse

Un script d'analyse a été créé : `backend/scripts/analyze_store_ca.py`

**Utilisation** :
```bash
# Analyser tous les magasins pour le mois actuel
python backend/scripts/analyze_store_ca.py --period month --offset 0

# Analyser un magasin spécifique
python backend/scripts/analyze_store_ca.py --store-id "store-uuid" --period month

# Analyser la semaine précédente
python backend/scripts/analyze_store_ca.py --period week --offset -1
```

**Ce que le script vérifie** :
1. ✅ Doublons potentiels (manager dans kpi_entries ET manager_kpis)
2. ✅ Incohérences de calcul
3. ✅ Données manquantes
4. ✅ Valeurs négatives ou invalides
5. ✅ Comparaison calcul manuel vs aggregation MongoDB

## 🎯 Actions Immédiates

1. **Vérifier la collection MongoDB** : `manager_kpi` ou `manager_kpis` ?
2. **Exécuter le script d'analyse** pour identifier les problèmes réels
3. **Corriger l'incohérence de collection** dans `gerant_service.py`
4. **Implémenter la protection contre double comptage**

## 📝 Notes

- Les sommes affichées dans le dashboard proviennent de `get_store_stats()` qui utilise `manager_kpis` (pluriel)
- Si la collection réelle est `manager_kpi` (singulier), les managers ne sont jamais comptés
- Cela expliquerait pourquoi certains magasins ont des CA anormalement bas
