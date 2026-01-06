# Correction Bug : Formulaire "Saisir mes chiffres" - Résumé

**Date** : 2026-01-06  
**Statut** : ✅ **Corrigé**

---

## 🐛 Problème Identifié

Le vendeur voyait **CA + Ventes + Prospects** alors que la config manager indiquait **Ventes + Articles** uniquement.

### Cause Racine
1. Le frontend utilisait `kpiConfig?.seller_track_ca || kpiConfig?.track_ca` mais `seller_track_ca` n'existe pas dans la réponse de `/seller/kpi-config`
2. Le fallback sur `track_ca` pouvait être `True` même si `seller_track_ca = False` (problème de fallback backend)
3. **Le champ Articles était complètement absent** du formulaire dans `PerformanceModal.js`

---

## ✅ Corrections Appliquées

### 1. Frontend - PerformanceModal.js

#### Fichier : `frontend/src/components/PerformanceModal.js`

**Changements** :
- ✅ Utilisation de `track_*` uniquement (déjà mappé depuis `seller_track_*` par le backend)
- ✅ Ajout du champ **Articles** manquant
- ✅ Correction de l'envoi des données pour inclure `nb_articles`
- ✅ Ajout de la vérification d'anomalies pour Articles
- ✅ Ajout de logs de validation

**Diff principal** :
```diff
- {(kpiConfig?.seller_track_ca || kpiConfig?.track_ca) && (
+ {kpiConfig?.track_ca && (
    // Affiche CA uniquement si seller_track_ca = true
  )}

+ {/* Articles - Ajouté */}
+ {kpiConfig?.track_articles && (
+   <div className="bg-blue-50 rounded-lg p-4 border-2 border-blue-200">
+     <label>📦 Nombre d'Articles</label>
+     <input type="number" name="nb_articles" ... />
+   </div>
+ )}
```

### 2. Backend - sellers.py

#### Fichier : `backend/api/routes/sellers.py`

**Changement** : Amélioration du fallback pour éviter que `track_ca` (legacy) override `seller_track_ca = False`

**Diff** :
```diff
- "track_ca": config.get('seller_track_ca', config.get('track_ca', True)),
+ "track_ca": config.get('seller_track_ca') if 'seller_track_ca' in config else config.get('track_ca', True),
```

**Avantage** : Si `seller_track_ca` existe (même si `False`), on l'utilise. Sinon, fallback sur `track_ca` (legacy).

---

## 📋 Exemple de Réponse API

### GET /api/seller/kpi-config

**Config Manager** :
```json
{
  "seller_track_ca": false,
  "seller_track_ventes": true,
  "seller_track_articles": true,
  "seller_track_prospects": false
}
```

**Réponse API Seller** (après correction) :
```json
{
  "track_ca": false,
  "track_ventes": true,
  "track_articles": true,
  "track_prospects": false
}
```

**Résultat Frontend** : Le vendeur voit uniquement "Ventes" et "Articles" ✅

---

## ✅ Checklist de Validation

### Test Manuel
1. ✅ Manager configure : `seller_track_ventes = true`, `seller_track_articles = true`, autres = false
2. ✅ Vendeur ouvre "Mes performances > Saisir mes chiffres"
3. ✅ Vérifier que seuls "Ventes" et "Articles" sont affichés
4. ✅ Vérifier que CA, Prospects, Clients ne sont PAS affichés
5. ✅ Saisir des valeurs et vérifier l'enregistrement
6. ✅ Vérifier les logs console : `📋 KPI Config reçue:` et `✅ Champs à afficher`

### Test Backend
```bash
# GET /api/seller/kpi-config
# Réponse attendue :
{
  "track_ca": false,
  "track_ventes": true,
  "track_articles": true,
  "track_prospects": false
}
```

---

## 📝 Fichiers Modifiés

1. ✅ `frontend/src/components/PerformanceModal.js` - Correction du formulaire de saisie
2. ✅ `backend/api/routes/sellers.py` - Amélioration du fallback
3. ✅ `docs/AUDIT_BUG_KPI_SAISIE_VENDEUR.md` - Documentation de l'audit
4. ✅ `docs/CORRECTION_BUG_KPI_SAISIE_VENDEUR.md` - Ce document

---

## 🔍 Logs de Validation

Les logs suivants sont ajoutés pour faciliter le débogage :

```javascript
logger.log('📋 KPI Config reçue:', kpiConfig);
logger.log('✅ Champs à afficher - CA:', kpiConfig?.track_ca, 'Ventes:', kpiConfig?.track_ventes, 'Articles:', kpiConfig?.track_articles, 'Prospects:', kpiConfig?.track_prospects);
```

Ces logs apparaissent dans la console du navigateur lors de la saisie des KPI.

---

**Correction terminée** ✅

