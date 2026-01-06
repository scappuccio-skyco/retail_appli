# Audit Bug : Formulaire "Saisir mes chiffres" - Mauvais champs affichés

**Date** : 2026-01-06  
**Problème** : Le vendeur voit CA + Ventes + Prospects alors que la config indique Ventes + Articles uniquement

---

## 1. Composant Frontend Identifié

### Composant Principal
- **Fichier** : `frontend/src/components/PerformanceModal.js`
- **Ligne** : 814-925 (onglet "Saisir mes chiffres")
- **Fonction** : `PerformanceModal` - onglet `activeTab === 'saisie'`

### Composant Secondaire
- **Fichier** : `frontend/src/components/KPIEntryModal.js`
- **Ligne** : 302-404 (formulaire de saisie KPI)
- **Fonction** : `KPIEntryModal` - formulaire complet

---

## 2. Endpoint Backend Utilisé

### Endpoint Seller
- **URL** : `/api/seller/kpi-config`
- **Fichier** : `backend/api/routes/sellers.py` (ligne 861-923)
- **Méthode** : GET
- **Authentification** : Seller token

### Structure de Réponse Actuelle
```json
{
  "track_ca": true,           // Mappé depuis seller_track_ca
  "track_ventes": true,       // Mappé depuis seller_track_ventes
  "track_clients": true,       // Mappé depuis seller_track_clients
  "track_articles": true,     // Mappé depuis seller_track_articles
  "track_prospects": true     // Mappé depuis seller_track_prospects
}
```

**Note** : Le backend fait un fallback : `config.get('seller_track_ca', config.get('track_ca', True))`

### Endpoint Manager (Source de Vérité)
- **URL** : `/api/manager/kpi-config`
- **Fichier** : `backend/api/routes/manager.py` (ligne 453-483)
- **Méthode** : GET
- **Authentification** : Manager token

### Structure de Réponse Manager
```json
{
  "enabled": true,
  "saisie_enabled": true,
  "seller_track_ca": false,
  "seller_track_ventes": true,
  "seller_track_articles": true,
  "seller_track_prospects": false,
  "manager_track_ca": true,
  "manager_track_ventes": false,
  "manager_track_articles": false,
  "manager_track_prospects": false
}
```

---

## 3. Comparaison Backend vs Frontend

### Backend (`/api/seller/kpi-config`)
```python
# backend/api/routes/sellers.py ligne 914-918
return {
    "track_ca": config.get('seller_track_ca', config.get('track_ca', True)),
    "track_ventes": config.get('seller_track_ventes', config.get('track_ventes', True)),
    "track_articles": config.get('seller_track_articles', config.get('track_articles', True)),
    "track_prospects": config.get('seller_track_prospects', config.get('track_prospects', True))
}
```

**Problème** : Le fallback `config.get('track_ca', True)` peut retourner `True` même si `seller_track_ca = False` si `track_ca` (legacy) existe et est `True`.

### Frontend (`PerformanceModal.js`)
```javascript
// Ligne 875 - CA
{(kpiConfig?.seller_track_ca || kpiConfig?.track_ca) && (
  // Affiche CA
)}

// Ligne 893 - Ventes
{(kpiConfig?.seller_track_ventes || kpiConfig?.track_ventes) && (
  // Affiche Ventes
)}

// Ligne 910 - Prospects
{(kpiConfig?.seller_track_prospects || kpiConfig?.track_prospects) && (
  // Affiche Prospects
)}
```

**Problème** : 
1. Le code vérifie `seller_track_ca` qui n'existe pas dans la réponse de `/seller/kpi-config`
2. Il fait un fallback sur `track_ca` qui peut être `True` même si le vendeur ne doit pas le remplir
3. **Le champ Articles est manquant** dans PerformanceModal.js !

---

## 4. Cause du Bug

### Cause Racine
Le frontend utilise une logique de fallback incorrecte :
- Il vérifie `seller_track_ca` (qui n'existe pas dans la réponse)
- Puis fait un fallback sur `track_ca` (qui peut être `True` même si `seller_track_ca = False`)

### Scénario de Bug
1. Manager configure : `seller_track_ca = False`, `seller_track_ventes = True`, `seller_track_articles = True`
2. Backend retourne : `track_ca = False` (correct), `track_ventes = True`, `track_articles = True`
3. Frontend vérifie : `seller_track_ca || track_ca` → `undefined || False` → `False` ✅
4. **MAIS** si `track_ca` (legacy) existe et est `True` dans la DB, le backend retourne `track_ca = True`
5. Frontend affiche CA alors qu'il ne devrait pas ❌

### Problème Additionnel
Le champ **Articles** est complètement absent de `PerformanceModal.js` alors qu'il existe dans `KPIEntryModal.js` !

---

## 5. Correction Requise

### Frontend - PerformanceModal.js
1. Utiliser uniquement `track_*` (déjà mappé depuis `seller_track_*` par le backend)
2. Ajouter le champ Articles manquant
3. Supprimer les références à `seller_track_*` qui n'existent pas dans la réponse

### Backend - sellers.py (optionnel)
Améliorer le fallback pour éviter les cas où `track_ca` (legacy) override `seller_track_ca` :
```python
# Au lieu de :
"track_ca": config.get('seller_track_ca', config.get('track_ca', True))

# Utiliser :
"track_ca": config.get('seller_track_ca') if 'seller_track_ca' in config else config.get('track_ca', True)
```

---

## 6. Checklist de Validation

### Test Manuel
1. ✅ Config manager : `seller_track_ventes = True`, `seller_track_articles = True`, autres = False
2. ✅ Vendeur ouvre "Mes performances > Saisir mes chiffres"
3. ✅ Vérifier que seuls "Ventes" et "Articles" sont affichés
4. ✅ Vérifier que CA, Prospects, Clients ne sont PAS affichés

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

## 7. Corrections Appliquées

### Frontend - PerformanceModal.js

#### Correction 1 : Utilisation correcte de `track_*`
**Avant** :
```javascript
{(kpiConfig?.seller_track_ca || kpiConfig?.track_ca) && (
  // Affiche CA
)}
```

**Après** :
```javascript
{kpiConfig?.track_ca && (
  // Affiche CA uniquement si seller_track_ca = true
)}
```

#### Correction 2 : Ajout du champ Articles manquant
**Avant** : Le champ Articles était complètement absent du formulaire.

**Après** :
```javascript
{kpiConfig?.track_articles && (
  <div className="bg-blue-50 rounded-lg p-4 border-2 border-blue-200">
    <label>📦 Nombre d'Articles</label>
    <input type="number" name="nb_articles" ... />
  </div>
)}
```

#### Correction 3 : Envoi correct des données
**Avant** :
```javascript
const data = {
  date: formData.get('date'),
  ca_journalier: parseFloat(formData.get('ca_journalier')) || 0,
  nb_ventes: parseInt(formData.get('nb_ventes')) || 0,
  nb_prospects: parseInt(formData.get('nb_prospects')) || 0
};
```

**Après** :
```javascript
const data = {
  date: formData.get('date'),
  ca_journalier: kpiConfig?.track_ca ? (parseFloat(formData.get('ca_journalier')) || 0) : 0,
  nb_ventes: kpiConfig?.track_ventes ? (parseInt(formData.get('nb_ventes')) || 0) : 0,
  nb_articles: kpiConfig?.track_articles ? (parseInt(formData.get('nb_articles')) || 0) : 0,
  nb_prospects: kpiConfig?.track_prospects ? (parseInt(formData.get('nb_prospects')) || 0) : 0
};
```

#### Correction 4 : Ajout de la vérification d'anomalies pour Articles
Ajout de la vérification dans `checkAnomalies()` pour le champ Articles.

#### Correction 5 : Ajout de logs de validation
```javascript
logger.log('📋 KPI Config reçue:', kpiConfig);
logger.log('✅ Champs à afficher - CA:', kpiConfig?.track_ca, 'Ventes:', kpiConfig?.track_ventes, 'Articles:', kpiConfig?.track_articles, 'Prospects:', kpiConfig?.track_prospects);
```

### Backend - sellers.py

#### Correction : Amélioration du fallback
**Avant** :
```python
"track_ca": config.get('seller_track_ca', config.get('track_ca', True))
```

**Problème** : Si `seller_track_ca = False` mais `track_ca = True` (legacy), le fallback retourne `True`.

**Après** :
```python
"track_ca": config.get('seller_track_ca') if 'seller_track_ca' in config else config.get('track_ca', True)
```

**Avantage** : Si `seller_track_ca` existe (même si `False`), on l'utilise. Sinon, fallback sur `track_ca` (legacy).

---

## 8. Exemple de Réponse API Attendue

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

**Réponse API Seller** :
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

## 9. Checklist de Validation Manuelle

### Test 1 : Config Ventes + Articles uniquement
1. ✅ Manager configure : `seller_track_ventes = true`, `seller_track_articles = true`, autres = false
2. ✅ Vendeur ouvre "Mes performances > Saisir mes chiffres"
3. ✅ Vérifier que seuls "Ventes" et "Articles" sont affichés
4. ✅ Vérifier que CA, Prospects, Clients ne sont PAS affichés
5. ✅ Saisir des valeurs et vérifier l'enregistrement

### Test 2 : Config avec CA
1. ✅ Manager configure : `seller_track_ca = true`, `seller_track_ventes = true`, autres = false
2. ✅ Vendeur ouvre le formulaire
3. ✅ Vérifier que CA et Ventes sont affichés
4. ✅ Vérifier que Articles, Prospects ne sont PAS affichés

### Test 3 : Logs de validation
1. ✅ Ouvrir la console du navigateur
2. ✅ Vérifier les logs : `📋 KPI Config reçue:` et `✅ Champs à afficher`
3. ✅ Confirmer que les valeurs correspondent à la config manager

---

**Fin de l'audit et corrections**

