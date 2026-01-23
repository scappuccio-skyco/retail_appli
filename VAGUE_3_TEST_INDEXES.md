# ✅ VAGUE 3 : TEST D'UTILISATION DES INDEXES

**Date**: 23 Janvier 2026  
**Objectif**: Vérifier que les indexes créés sont bien utilisés par les requêtes batch

---

## 🧪 SCRIPT DE TEST CRÉÉ

### `backend/scripts/test_index_usage.py`

**Fonctionnalités**:
- ✅ Exécute une requête de test sur `manager_kpis` avec `.explain('executionStats')`
- ✅ Vérifie que `winningPlan.stage` = `IXSCAN` (et non `COLLSCAN`)
- ✅ Vérifie que `totalDocsExamined` ≈ `nReturned` (ratio ≥ 80%)
- ✅ Test supplémentaire avec `manager_id` + `store_id` pour requête complète
- ✅ Affiche toutes les métriques de performance

---

## 🚀 UTILISATION

### Exécuter le test:

```bash
# Depuis la racine du projet
cd "c:\Users\cappu\OneDrive\Bureau\Retail performer AI\retail_appli"
python backend/scripts/test_index_usage.py
```

**Prérequis**:
- MongoDB doit être accessible (variable `MONGO_URL` configurée)
- Les indexes doivent avoir été créés (exécuter `init_db_indexes.py` d'abord)

---

## ✅ VALIDATIONS EFFECTUÉES

### Check 1: Stage = IXSCAN
- ✅ **Succès si**: `winningPlan.stage` = `"IXSCAN"`
- ❌ **Échec si**: `winningPlan.stage` = `"COLLSCAN"` (Collection Scan)

**Signification**:
- `IXSCAN`: MongoDB utilise l'index → **Performance optimale**
- `COLLSCAN`: MongoDB scanne toute la collection → **Performance dégradée**

### Check 2: Ratio documents examinés/retournés ≥ 80%
- ✅ **Succès si**: `nReturned / totalDocsExamined ≥ 0.8`
- ⚠️ **Attention si**: Ratio entre 50-80%
- ❌ **Échec si**: Ratio < 50%

**Signification**:
- Ratio élevé (≥80%): Index très efficace, peu de documents inutiles examinés
- Ratio faible (<50%): Beaucoup de documents examinés inutilement (index à optimiser)

---

## 📊 EXEMPLE DE SORTIE ATTENDUE

```
================================================================================
🧪 TEST D'UTILISATION DES INDEXES - manager_kpis
================================================================================
✅ Connexion MongoDB établie (via core.database)

📝 Requête de test:
   Collection: manager_kpis
   Query: {'date': {'$gte': '2025-12-24', '$lte': '2026-01-23'}}

================================================================================
📊 RÉSULTATS DE L'EXPLAIN
================================================================================

🔍 PLAN D'EXÉCUTION:
   Stage: IXSCAN
   Index utilisé: manager_date_store_idx
   Clés de l'index: {'manager_id': 1, 'date': -1, 'store_id': 1}

📈 STATISTIQUES D'EXÉCUTION:
   Documents examinés: 150
   Documents retournés: 145
   Clés d'index examinées: 150
   Temps d'exécution: 2ms
   Ratio efficacité: 96.67% (documents retournés / examinés)

================================================================================
✅ VALIDATION
================================================================================
✅ CHECK 1: Stage = IXSCAN (Index Scan) - Index utilisé correctement!
✅ CHECK 2: Ratio documents retournés/examinés = 96.67% (≥80%)
   ✅ Index très efficace - Peu de documents inutiles examinés!

================================================================================
📊 RÉSUMÉ
================================================================================
✅ Checks réussis: 2/2

🎉 SUCCÈS: L'index est utilisé correctement et efficacement!
   ✅ Les requêtes batch de la Vague 2 bénéficieront de cette optimisation.
```

---

## 🔍 INTERPRÉTATION DES RÉSULTATS

### ✅ **SUCCÈS COMPLET** (2/2 checks)
- L'index est utilisé (`IXSCAN`)
- Ratio ≥ 80% (index très efficace)
- **Conclusion**: Les requêtes batch bénéficient de l'optimisation

### ⚠️ **SUCCÈS PARTIEL** (1/2 checks)
- L'index est utilisé mais ratio < 80%
- **Action**: Vérifier si l'index peut être optimisé (ordre des champs, etc.)

### ❌ **ÉCHEC** (0/2 checks)
- Collection scan détecté (`COLLSCAN`)
- **Action**: Vérifier que l'index a bien été créé
- **Solution**: Exécuter `python backend/scripts/init_db_indexes.py`

---

## 📋 CHECKLIST DE VALIDATION

Avant de considérer la Vague 3 comme terminée:

- [ ] Exécuter `init_db_indexes.py` pour créer les indexes
- [ ] Exécuter `test_index_usage.py` pour vérifier l'utilisation
- [ ] Vérifier que les 2 checks passent (2/2)
- [ ] Vérifier que le temps d'exécution est < 10ms
- [ ] Vérifier que le ratio efficacité est ≥ 80%

---

## 🎯 PROCHAINES ÉTAPES

Une fois les indexes validés:

1. ✅ **VAGUE 1 TERMINÉE** - Protection mémoire
2. ✅ **VAGUE 2 TERMINÉE** - Éradication N+1
3. ✅ **VAGUE 3 TERMINÉE** - Indexes MongoDB
4. 🔄 **VAGUE 4** - Implémentation pagination complète (optionnel)

---

*Script créé le 23 Janvier 2026*
