# Audit : Mécanisme de Blocage et Agrégation des KPIs

**Date** : 2024  
**Objectif** : Analyser le mécanisme de blocage entre manager/vendeurs, l'attribution des données globales, et la cohérence mathématique des agrégations

---

## 1. AUDIT SUR LE MÉCANISME DE BLOCAGE

### 1.1 Analyse du Code de Verrouillage

#### 1.1.1 Vérification du Verrouillage API (Données Importées)

**Source** : `backend/api/routes/sellers.py` (lignes 1583-1608), `backend/api/routes/manager.py` (lignes 715-742)

**Pour les Vendeurs** (`sellers.py`) :
```python
# Ligne 1583-1595 : Vérification si date verrouillée (API)
locked_entry = await db.kpis.find_one({
    "store_id": store_id,
    "date": date,
    "$or": [
        {"locked": True},
        {"source": "api"}
    ]
}, {"_id": 0, "locked": 1})

if locked_entry:
    raise HTTPException(
        status_code=403, 
        detail="🔒 Cette date est verrouillée. Les données proviennent de l'API/ERP..."
    )

# Ligne 1604-1608 : Vérification si entrée existante verrouillée
if existing and existing.get('locked'):
    raise HTTPException(
        status_code=403,
        detail="🔒 Cette entrée est verrouillée (données API). Impossible de modifier."
    )
```

**Pour les Managers** (`manager.py`) :
```python
# Ligne 715-729 : Vérification si date verrouillée (API)
locked_entry = await db.kpis.find_one({
    "store_id": resolved_store_id,
    "date": date,
    "$or": [
        {"locked": True},
        {"source": "api"}
    ]
}, {"_id": 0, "locked": 1})

if locked_entry:
    raise HTTPException(
        status_code=403,
        detail="🔒 Cette date est verrouillée. Les données proviennent de l'API/ERP."
    )

# Ligne 737-742 : Vérification si entrée existante verrouillée
if existing and existing.get('locked'):
    raise HTTPException(
        status_code=403,
        detail="🔒 Cette entrée est verrouillée (données API)."
    )
```

**Conclusion** : Le système vérifie uniquement le verrouillage des **données API** (importées depuis un logiciel de caisse). Il n'y a **AUCUN mécanisme de blocage mutuel** entre manager et vendeurs pour la saisie manuelle.

---

### 1.2 Détermination du Droit de Saisie

#### 1.2.1 Configuration KPI (`kpi_configs`)

**Source** : `backend/api/routes/manager.py` (lignes 489-556), `backend/models/kpis.py` (lignes 58-99)

Le système utilise une configuration `kpi_configs` avec des flags `seller_track_*` et `manager_track_*` :

```python
# Modèle KPIConfiguration (models/kpis.py)
{
    "seller_track_ca": Optional[bool] = True,
    "manager_track_ca": Optional[bool] = False,
    "seller_track_ventes": Optional[bool] = True,
    "manager_track_ventes": Optional[bool] = False,
    "seller_track_prospects": Optional[bool] = True,
    "manager_track_prospects": Optional[bool] = False,
    # ...
}
```

**⚠️ PROBLÈME IDENTIFIÉ** :
- Ces flags sont **informatifs** (pour le frontend) mais **ne bloquent pas** la saisie côté backend
- Le code de sauvegarde (`save_manager_kpi` et `save_seller_kpi`) **ne vérifie pas** ces flags avant d'enregistrer
- **Résultat** : Manager et vendeurs peuvent saisir simultanément, même si la config indique l'exclusivité

---

### 1.3 Création d'Entrées Vides pour les Vendeurs

**Question** : Si le manager verrouille la saisie pour entrer les données 'Magasin', est-ce que le système crée automatiquement des entrées vides pour les vendeurs ?

**Réponse** : ❌ **NON**

**Analyse du Code** :

1. **Sauvegarde Manager** (`manager.py`, ligne 744-771) :
   - Le manager sauvegarde uniquement dans `manager_kpis`
   - **Aucune création** d'entrées dans `kpi_entries` pour les vendeurs
   - **Aucun mécanisme** de propagation ou de création automatique

2. **Sauvegarde Vendeur** (`sellers.py`, ligne 1610-1642) :
   - Le vendeur sauvegarde uniquement dans `kpi_entries`
   - **Aucune vérification** si le manager a déjà saisi des données
   - **Aucun blocage** si `manager_kpis` existe pour cette date

**Résultat** :
- Si le manager saisit des données globales → **Aucune entrée vendeur n'est créée**
- Les données vendeurs sont **simplement absentes** pour cette journée
- **Trous dans les données** : Les vendeurs n'ont pas d'entrées pour les jours où le manager a saisi

**Exemple Concret** :
```
Jour J :
- Manager saisit dans manager_kpis : CA = 5000€, Prospects = 100
- Vendeur A : Aucune entrée dans kpi_entries
- Vendeur B : Aucune entrée dans kpi_entries

Résultat :
- get_store_kpi_overview() retourne :
  - sellers_data.ca_journalier = 0 (aucune entrée vendeur)
  - managers_data.ca_journalier = 5000€
  - totals.ca = 5000€ (correct)
  - Mais sellers_reported = 0 (aucun vendeur n'a saisi)
```

---

## 2. AUDIT SUR L'ATTRIBUTION DES DONNÉES (GRANULARITÉ)

### 2.1 Logique de Répartition des Données Globales

**Question** : Quand un manager saisit un `nb_prospects` global dans `manager_kpis`, existe-t-il un mécanisme qui divise ce nombre par le nombre de vendeurs actifs pour calculer un taux de transformation individuel ?

**Réponse** : ❌ **NON**

**Analyse du Code** :

#### 2.1.1 Fonction `get_store_kpi_overview` (`gerant_service.py`)

**Source** : `backend/services/gerant_service.py` (lignes 1363-1490)

```python
# Ligne 1427-1431 : Récupération manager_kpis
manager_kpis_list = await self.db.manager_kpis.find({
    "store_id": store_id,
    "date": date
}, {"_id": 0}).to_list(100)

# Ligne 1434-1440 : Agrégation managers (SOMME directe, pas de répartition)
managers_total = {
    "ca_journalier": sum((kpi.get("ca_journalier") or 0) for kpi in manager_kpis_list),
    "nb_ventes": sum((kpi.get("nb_ventes") or 0) for kpi in manager_kpis_list),
    "nb_clients": sum((kpi.get("nb_clients") or 0) for kpi in manager_kpis_list),
    "nb_articles": sum((kpi.get("nb_articles") or 0) for kpi in manager_kpis_list),
    "nb_prospects": sum((kpi.get("nb_prospects") or 0) for kpi in manager_kpis_list)  # ⚠️ SOMME directe
}

# Ligne 1442-1450 : Agrégation vendeurs
sellers_total = {
    "ca_journalier": sum((entry.get("seller_ca") or entry.get("ca_journalier") or 0) for entry in seller_entries),
    "nb_ventes": sum((entry.get("nb_ventes") or 0) for entry in seller_entries),
    "nb_clients": sum((entry.get("nb_clients") or 0) for entry in seller_entries),
    "nb_articles": sum((entry.get("nb_articles") or 0) for entry in seller_entries),
    "nb_prospects": sum((entry.get("nb_prospects") or 0) for entry in seller_entries),  # ⚠️ SOMME directe
    "nb_sellers_reported": len(seller_entries)
}

# Ligne 1452-1457 : Totaux magasin (ADDITION directe)
total_ca = managers_total["ca_journalier"] + sellers_total["ca_journalier"]
total_ventes = managers_total["nb_ventes"] + sellers_total["nb_ventes"]
total_clients = managers_total["nb_clients"] + sellers_total["nb_clients"]
total_articles = managers_total["nb_articles"] + sellers_total["nb_articles"]
total_prospects = managers_total["nb_prospects"] + sellers_total["nb_prospects"]  # ⚠️ ADDITION

# Ligne 1460-1464 : Calcul KPIs dérivés
calculated_kpis = {
    "panier_moyen": round(total_ca / total_ventes, 2) if total_ventes > 0 else None,
    "taux_transformation": round((total_ventes / total_prospects) * 100, 2) if total_prospects > 0 else None,  # ⚠️ Utilise total_prospects global
    "indice_vente": round(total_articles / total_ventes, 2) if total_ventes > 0 else None
}
```

**Conclusion** :
- ❌ **Aucune logique de répartition** : Les prospects globaux du manager ne sont **jamais divisés** par le nombre de vendeurs
- ❌ **Aucune attribution individuelle** : Les données manager restent **globales** et ne sont pas "ventilées" vers les vendeurs
- ⚠️ **Utilisation directe du total global** : Le taux de transformation utilise `total_prospects` (manager + vendeurs) sans distinction

---

### 2.2 Impact sur le Calcul Individuel

**Scénario** :
```
Jour J :
- Manager saisit : nb_prospects = 100 (trafic magasin global)
- Vendeur A saisit : nb_ventes = 10, nb_prospects = 0 (ne saisit pas les prospects)
- Vendeur B saisit : nb_ventes = 15, nb_prospects = 0

Calcul actuel :
- total_prospects = 100 (manager) + 0 (A) + 0 (B) = 100
- total_ventes = 0 (manager) + 10 (A) + 15 (B) = 25
- taux_transformation = (25 / 100) * 100 = 25%

Pour Vendeur A individuellement :
- Si on calcule : taux_A = (10 / 100) * 100 = 10% ❌
- Mais Vendeur A n'a peut-être vu que 20 prospects → Taux réel = 50%
```

**Problème** : Le système utilise le **total global** (100 prospects) pour calculer le taux de transformation de **chaque vendeur individuellement**, ce qui est **mathématiquement faux**.

---

## 3. AUDIT SUR LA COHÉRENCE MATHÉMATIQUE DES AGRÉGATIONS

### 3.1 Scénario de Test : Blocage Mutuel

**Scénario** :
- Le manager a saisi les prospects (bloquant les vendeurs) → `manager_kpis.nb_prospects = 100`
- Les vendeurs ont saisi leur CA et Ventes (bloquant le manager) → `kpi_entries` avec CA et ventes individuelles

**Question** : Est-ce que le calcul final du Taux de Transformation et du Panier Moyen mélange ces deux sources ?

**Réponse** : ✅ **OUI, le système mélange les deux sources**

---

### 3.2 Analyse Ligne par Ligne de `get_store_kpi_overview`

**Source** : `backend/services/gerant_service.py` (lignes 1363-1490)

#### 3.2.1 Récupération des Données

```python
# Ligne 1414-1417 : Récupération kpi_entries (vendeurs)
seller_entries = await self.db.kpi_entries.find({
    "store_id": store_id,
    "date": date
}, {"_id": 0}).to_list(100)

# Ligne 1428-1431 : Récupération manager_kpis (managers)
manager_kpis_list = await self.db.manager_kpis.find({
    "store_id": store_id,
    "date": date
}, {"_id": 0}).to_list(100)
```

**✅ Les deux sources sont récupérées indépendamment**

---

#### 3.2.2 Agrégation Managers

```python
# Ligne 1434-1440 : Agrégation managers (SOMME)
managers_total = {
    "ca_journalier": sum((kpi.get("ca_journalier") or 0) for kpi in manager_kpis_list),
    "nb_ventes": sum((kpi.get("nb_ventes") or 0) for kpi in manager_kpis_list),
    "nb_clients": sum((kpi.get("nb_clients") or 0) for kpi in manager_kpis_list),
    "nb_articles": sum((kpi.get("nb_articles") or 0) for kpi in manager_kpis_list),
    "nb_prospects": sum((kpi.get("nb_prospects") or 0) for kpi in manager_kpis_list)  # ⚠️ LIGNE 1439
}
```

**Ligne 1439** : `managers_total["nb_prospects"]` = Somme des prospects saisis par le manager

---

#### 3.2.3 Agrégation Vendeurs

```python
# Ligne 1442-1450 : Agrégation vendeurs (SOMME)
sellers_total = {
    "ca_journalier": sum((entry.get("seller_ca") or entry.get("ca_journalier") or 0) for entry in seller_entries),  # ⚠️ LIGNE 1444
    "nb_ventes": sum((entry.get("nb_ventes") or 0) for entry in seller_entries),  # ⚠️ LIGNE 1445
    "nb_clients": sum((entry.get("nb_clients") or 0) for entry in seller_entries),
    "nb_articles": sum((entry.get("nb_articles") or 0) for entry in seller_entries),
    "nb_prospects": sum((entry.get("nb_prospects") or 0) for entry in seller_entries),  # ⚠️ LIGNE 1448
    "nb_sellers_reported": len(seller_entries)
}
```

**Lignes 1444, 1445, 1448** : Agrégation des données vendeurs (CA, ventes, prospects)

---

#### 3.2.4 Calcul des Totaux Magasin (MÉLANGE)

```python
# Ligne 1452-1457 : Totaux magasin (ADDITION des deux sources)
total_ca = managers_total["ca_journalier"] + sellers_total["ca_journalier"]  # ⚠️ LIGNE 1453
total_ventes = managers_total["nb_ventes"] + sellers_total["nb_ventes"]  # ⚠️ LIGNE 1454
total_clients = managers_total["nb_clients"] + sellers_total["nb_clients"]
total_articles = managers_total["nb_articles"] + sellers_total["nb_articles"]
total_prospects = managers_total["nb_prospects"] + sellers_total["nb_prospects"]  # ⚠️ LIGNE 1457
```

**⚠️ PROBLÈME IDENTIFIÉ** :
- **Ligne 1453** : `total_ca` = CA manager + CA vendeurs → **Mélange global/individuel**
- **Ligne 1454** : `total_ventes` = Ventes manager + Ventes vendeurs → **Mélange global/individuel**
- **Ligne 1457** : `total_prospects` = Prospects manager + Prospects vendeurs → **Mélange global/individuel**

---

#### 3.2.5 Calcul des KPIs Dérivés (UTILISATION DU MÉLANGE)

```python
# Ligne 1460-1464 : Calcul KPIs dérivés
calculated_kpis = {
    "panier_moyen": round(total_ca / total_ventes, 2) if total_ventes > 0 else None,  # ⚠️ LIGNE 1461
    "taux_transformation": round((total_ventes / total_prospects) * 100, 2) if total_prospects > 0 else None,  # ⚠️ LIGNE 1462
    "indice_vente": round(total_articles / total_ventes, 2) if total_ventes > 0 else None  #NE 1463
}
```

**⚠️ PROBLÈMES IDENTIFIÉS** :

1. **Ligne 1461 - Panier Moyen** :
   ```python
   panier_moyen = total_ca / total_ventes
   ```
   - Si manager saisit CA total magasin (5000€) + Ventes totales (50)
   - Et vendeurs saisissent CA individuels (3000€) + Ventes individuelles (30)
   - **Calcul** : (5000 + 3000) / (50 + 30) = 8000 / 80 = 100€
   - **Problème** : Double comptage si le manager a déjà compté les ventes des vendeurs

2. **Ligne 1462 - Taux de Transformation** :
   ```python
   taux_transformation = (total_ventes / total_prospects) * 100
   ```
   - Si manager saisit prospects globaux (100)
   - Et vendeurs saisissent ventes individuelles (25)
   - **Calcul** : (25 / 100) * 100 = 25%
   - **Problème** : On divise les ventes individuelles par les prospects globaux → **Mathématiquement faux**

3. **Ligne 1463 - Indice de Vente** :
   ```python
   indice_vente = total_articles / total_ventes
   ```
   - Même problème de mélange si manager saisit articles totaux + vendeurs saisissent articles individuels

---

### 3.3 Tableau Récapitulatif des Lignes de Code

| Variable | Ligne | Source | Opération | Problème |
|----------|-------|--------|-----------|----------|
| `managers_total["nb_prospects"]` | 1439 | `manager_kpis` | SOMME | Prospects globaux (non répartis) |
| `sellers_total["ca_journalier"]` | 1444 | `kpi_entries` | SOMME | CA individuels |
| `sellers_total["nb_ventes"]` | 1445 | `kpi_entries` | SOMME | Ventes individuelles |
| `sellers_total["nb_prospects"]` | 1448 | `kpi_entries` | SOMME | Prospects individuels (souvent 0) |
| `total_ca` | 1453 | managers + sellers | **ADDITION** | ⚠️ Mélange global/individuel |
| `total_ventes` | 1454 | managers + sellers | **ADDITION** | ⚠️ Mélange global/individuel |
| `total_prospects` | 1457 | managers + sellers | **ADDITION** | ⚠️ Mélange global/individuel |
| `panier_moyen` | 1461 | `total_ca / total_ventes` | **DIVISION** | ⚠️ Utilise le mélange |
| `taux_transformation` | 1462 | `total_ventes / total_prospects` | **DIVISION** | ⚠️ Utilise le mélange (FAUX) |
| `indice_vente` | 1463 | `total_articles / total_ventes` | **DIVISION** | ⚠️ Utilise le mélange |

---

### 3.4 Exemple Concret de Calcul Incorrect

**Scénario** :
```
Jour J :
- Manager saisit dans manager_kpis :
  - nb_prospects = 100 (trafic magasin global)
  - ca_journalier = 0 (ne saisit pas le CA)
  - nb_ventes = 0 (ne saisit pas les ventes)

- Vendeur A saisit dans kpi_entries :
  - ca_journalier = 2000€
  - nb_ventes = 20
  - nb_prospects = 0 (ne saisit pas)

- Vendeur B saisit dans kpi_entries :
  - ca_journalier = 3000€
  - nb_ventes = 15
  - nb_prospects = 0 (ne saisit pas)
```

**Calcul Actuel** (`get_store_kpi_overview`) :

```python
# Étape 1 : Agrégation managers
managers_total = {
    "ca_journalier": 0,
    "nb_ventes": 0,
    "nb_prospects": 100  # ⚠️ Global
}

# Étape 2 : Agrégation vendeurs
sellers_total = {
    "ca_journalier": 2000 + 3000 = 5000,
    "nb_ventes": 20 + 15 = 35,
    "nb_prospects": 0 + 0 = 0  # ⚠️ Aucun prospect saisi par vendeurs
}

# Étape 3 : Totaux magasin (MÉLANGE)
total_ca = 0 + 5000 = 5000€  # ✅ Correct
total_ventes = 0 + 35 = 35  # ✅ Correct
total_prospects = 100 + 0 = 100  # ⚠️ Prospects globaux uniquement

# Étape 4 : Calcul KPIs dérivés
panier_moyen = 5000 / 35 = 142.86€  # ✅ Correct (basé sur vendeurs uniquement)
taux_transformation = (35 / 100) * 100 = 35%  # ❌ FAUX : On divise ventes individuelles par prospects globaux
```

**Problème** :
- Le taux de transformation (35%) est **mathématiquement faux** car :
  - On divise les **ventes individuelles** (35) par les **prospects globaux** (100)
  - En réalité, chaque vendeur n'a peut-être vu qu'une partie des 100 prospects
  - Le taux réel par vendeur est **impossible à calculer** sans répartition

---

## 4. CONCLUSION

### 4.1 Résumé des Problèmes Identifiés

| Problème | Impact | Gravité |
|----------|--------|---------|
| **Aucun blocage mutuel** entre manager et vendeurs | Double saisie possible | ⚠️ Moyenne |
| **Aucune création d'entrées vides** pour vendeurs quand manager saisit | Trous dans les données | ⚠️ Moyenne |
| **Aucune répartition** des données globales manager vers vendeurs | Impossible de calculer KPIs individuels corrects | 🔴 Critique |
| **Mélange mathématique** des données globales et individuelles | KPIs calculés incorrectement | 🔴 Critique |
| **Taux de transformation faux** : Ventes individuelles / Prospects globaux | Analyse de performance faussée | 🔴 Critique |

### 4.2 Scénarios Problématiques Confirmés

1. ✅ **Manager saisit CA total magasin + Vendeurs saisissent CA individuels** → Double comptage
2. ✅ **Manager saisit prospects globaux + Vendeurs saisissent ventes individuelles** → Taux de transformation mathématiquement faux
3. ✅ **Manager saisit données globales** → Aucune entrée vendeur créée → Trous dans les données

### 4.3 Recommandations

1. **Implémenter un mécanisme de blocage mutuel** :
   - Si `manager_kpis` existe pour une date → Bloquer la saisie vendeurs (ou vice versa)
   - Ou créer automatiquement des entrées vides pour les vendeurs

2. **Séparer les calculs** :
   - Calculer les KPIs magasin basés sur `manager_kpis` (référentiel)
   - Calculer les KPIs individuels basés sur `kpi_entries` (analyse)
   - Ne pas mélanger les deux sources dans un même calcul

3. **Répartition des données globales** :
   - Si manager saisit prospects globaux → Répartir proportionnellement aux ventes
   - Ou ne pas calculer le taux de transformation individuel si prospects globaux uniquement

---

**Rapport généré le** : 2024  
**Fichiers analysés** :
- `backend/api/routes/sellers.py` (lignes 1583-1642)
- `backend/api/routes/manager.py` (lignes 715-771, 285-359)
- `backend/services/gerant_service.py` (lignes 1363-1490)
- `backend/services/kpi_service.py` (lignes 155-224)
- `backend/models/kpis.py` (lignes 58-99)
