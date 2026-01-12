# Audit Complet : Saisie de Données KPI et Logique de Calcul

**Date** : 2024  
**Objectif** : Analyser les différences entre les formulaires de saisie vendeur/manager et identifier les incohérences dans les calculs de KPIs

---

## 1. AUDIT DES FORMULAIRES DE SAISIE

### 1.1 Collection `kpi_entries` (Vendeurs)

**Source** : `backend/models/kpis.py` (lignes 14-43), `backend/api/routes/sellers.py` (lignes 1610-1642)

#### Champs saisis par le vendeur :
```python
{
    "seller_id": str,              # ID du vendeur (obligatoire)
    "date": str,                   # Format YYYY-MM-DD
    "ca_journalier": float,        # CA individuel du vendeur
    "seller_ca": float,            # Alias de ca_journalier (pour compatibilité)
    "nb_ventes": int,              # Nombre de ventes individuelles
    "nb_clients": int,             # Nombre de clients servis individuellement
    "nb_articles": int,            # Nombre d'articles vendus individuellement
    "nb_prospects": int,           # Prospects individuels (optionnel)
    "comment": str,                # Commentaire libre
    "source": "manual",            # "manual" ou "api"
    "locked": bool,                # True si source="api"
    "store_id": str,               # ID du magasin
    "manager_id": str              # ID du manager
}
```

**Caractéristiques** :
- ✅ Données **individuelles** (rattachées à un `seller_id`)
- ✅ Chaque vendeur saisit **ses propres performances**
- ✅ Permet l'analyse de performance **par vendeur**

---

### 1.2 Collection `manager_kpis` (Managers)

**Source** : `backend/models/kpis.py` (lignes 104-117), `backend/api/routes/manager.py` (lignes 744-755)

#### Champs saisis par le manager :
```python
{
    "manager_id": str,             # ID du manager (obligatoire)
    "store_id": str,               # ID du magasin
    "date": str,                   # Format YYYY-MM-DD
    "ca_journalier": Optional[float],  # ⚠️ CA TOTAL MAGASIN (peut être saisi)
    "nb_ventes": Optional[int],    # ⚠️ Ventes totales magasin (peut être saisi)
    "nb_clients": Optional[int],    # Clients totaux magasin
    "nb_articles": Optional[int],  # Articles totaux magasin
    "nb_prospects": Optional[int], # Prospects totaux magasin (souvent saisi)
    "source": "manual",            # "manual" ou "api"
    "locked": bool                 # True si source="api"
}
```

**Caractéristiques** :
- ⚠️ Données **globales magasin** (rattachées à un `store_id`, pas à un vendeur)
- ⚠️ Le manager peut saisir le **CA total du magasin**
- ⚠️ Le manager peut saisir les **ventes totales du magasin**
- ⚠️ Les prospects sont souvent saisis **globalement** (trafic magasin)

---

### 1.3 Différences Critiques

| Aspect | `kpi_entries` (Vendeurs) | `manager_kpis` (Managers) |
|--------|--------------------------|---------------------------|
| **Granularité** | Individuelle (par vendeur) | Globale (par magasin) |
| **CA** | CA individuel vendeur | ⚠️ **CA total magasin possible** |
| **Ventes** | Ventes individuelles | ⚠️ **Ventes totales magasin possibles** |
| **Prospects** | Prospects individuels (rare) | ⚠️ **Prospects totaux magasin (fréquent)** |
| **Rattachement** | `seller_id` + `store_id` | `manager_id` + `store_id` (pas de seller_id) |
| **Usage prévu** | Analyse performance individuelle | ⚠️ **Saisie globale magasin** |

---

## 2. AUDIT DE LA LOGIQUE DE CALCUL (Backend)

### 2.1 Fonction `get_store_stats` (`gerant_service.py`)

**Source** : `backend/services/gerant_service.py` (lignes 348-548)

#### Calcul du CA Total :

```python
# Étape 1 : Exclusion anti-doublon
managers_with_kpis = await self.db.manager_kpis.distinct(
    "manager_id",
    {"store_id": store_id, "date": {"$gte": period_start, "$lte": period_end}}
)

# Étape 2 : Agrégation vendeurs (EXCLUANT les managers qui ont des entrées manager_kpis)
seller_match = {
    "store_id": store_id,
    "date": {"$gte": period_start, "$lte": period_end}
}
if managers_with_kpis:
    seller_match["seller_id"] = {"$nin": managers_with_kpis}  # Exclusion

period_sellers = await self.db.kpi_entries.aggregate([
    {"$match": seller_match},
    {"$group": {
        "_id": None,
        "total_ca": {"$sum": {"$ifNull": ["$seller_ca", {"$ifNull": ["$ca_journalier", 0]}]}},
        "total_ventes": {"$sum": {"$ifNull": ["$nb_ventes", 0]}}
    }}
]).to_list(1)

# Étape 3 : Agrégation managers
period_managers = await self.db.manager_kpis.aggregate([
    {"$match": {"store_id": store_id, "date": {"$gte": period_start, "$lte": period_end}}},
    {"$group": {
        "_id": None,
        "total_ca": {"$sum": {"$ifNull": ["$ca_journalier", 0]}},
        "total_ventes": {"$sum": {"$ifNull": ["$nb_ventes", 0]}}
    }}
]).to_list(1)

# Étape 4 : SOMME FINALE
period_ca = (period_sellers[0].get("total_ca", 0) if period_sellers else 0) + \
            (period_managers[0].get("total_ca", 0) if period_managers else 0)
```

**Formule mathématique** :
```
CA_Total = Σ(CA_vendeurs) + Σ(CA_manager)

Où :
- CA_vendeurs = somme des ca_journalier de tous les vendeurs (sauf ceux qui sont aussi managers avec entrées manager_kpis)
- CA_manager = somme des ca_journalier saisis par le manager dans manager_kpis
```

**⚠️ PROBLÈME IDENTIFIÉ** :
- Si le manager saisit un **CA total magasin** dans `manager_kpis`, ce CA est **ajouté** aux CA individuels des vendeurs
- **Résultat** : Double comptage ou CA gonflé si les vendeurs ont aussi saisi leurs données

---

### 2.2 Fonction `get_store_kpi_overview` (`gerant_service.py`)

**Source** : `backend/services/gerant_service.py` (lignes 1363-1490)

#### Calcul du Panier Moyen :

```python
# Agrégation managers
managers_total = {
    "ca_journalier": sum((kpi.get("ca_journalier") or 0) for kpi in manager_kpis_list),
    "nb_ventes": sum((kpi.get("nb_ventes") or 0) for kpi in manager_kpis_list),
    # ...
}

# Agrégation vendeurs
sellers_total = {
    "ca_journalier": sum((entry.get("seller_ca") or entry.get("ca_journalier") or 0) for entry in seller_entries),
    "nb_ventes": sum((entry.get("nb_ventes") or 0) for entry in seller_entries),
    # ...
}

# Totaux magasin
total_ca = managers_total["ca_journalier"] + sellers_total["ca_journalier"]
total_ventes = managers_total["nb_ventes"] + sellers_total["nb_ventes"]

# Calcul panier moyen
calculated_kpis = {
    "panier_moyen": round(total_ca / total_ventes, 2) if total_ventes > 0 else None,
    # ...
}
```

**Formule mathématique** :
```
Panier_Moyen = (CA_Total_Magasin) / (Ventes_Total_Magasin)

Où :
- CA_Total_Magasin = Σ(CA_vendeurs) + Σ(CA_manager)
- Ventes_Total_Magasin = Σ(Ventes_vendeurs) + Σ(Ventes_manager)
```

**⚠️ PROBLÈME IDENTIFIÉ** :
- Si le manager saisit des **ventes totales magasin** dans `manager_kpis`, elles sont **ajoutées** aux ventes individuelles des vendeurs
- Le panier moyen devient **dilué** : on divise un CA mixte (individuel + global) par des ventes mixtes
- **Résultat** : Panier moyen mathématiquement incorrect

---

### 2.3 Calcul du Taux de Transformation

**Source** : `backend/services/gerant_service.py` (ligne 1462)

```python
taux_transformation = round((total_ventes / total_prospects) * 100, 2) if total_prospects > 0 else None
```

**Formule mathématique** :
```
Taux_Transformation = (Ventes_Total_Magasin / Prospects_Total_Magasin) * 100

Où :
- Ventes_Total_Magasin = Σ(Ventes_vendeurs) + Σ(Ventes_manager)
- Prospects_Total_Magasin = Σ(Prospects_vendeurs) + Σ(Prospects_manager)
```

**⚠️ PROBLÈME IDENTIFIÉ** :
- Les **prospects sont souvent saisis globalement** par le manager (trafic magasin)
- Les **ventes sont individuelles** (chaque vendeur saisit ses ventes)
- **Résultat** : On divise les ventes individuelles par les prospects globaux → Taux de transformation **mathématiquement faux** pour l'analyse par vendeur

---

### 2.4 Filtrage par `seller_id` pour Analyse Individuelle

**Question** : Le calcul actuel permet-il de filtrer uniquement sur `seller_id` pour obtenir une analyse purement individuelle ?

**Réponse** : ✅ **OUI, mais avec limitations**

#### Analyse Individuelle Possible :

```python
# Exemple : CA d'un vendeur spécifique
seller_ca = await self.db.kpi_entries.aggregate([
    {"$match": {
        "seller_id": "seller_123",
        "store_id": store_id,
        "date": {"$gte": start_date, "$lte": end_date}
    }},
    {"$group": {
        "_id": None,
        "total_ca": {"$sum": {"$ifNull": ["$ca_journalier", 0]}}
    }}
]).to_list(1)
```

**✅ Avantages** :
- Les données vendeur dans `kpi_entries` sont **individuelles** et filtrables par `seller_id`
- Permet l'analyse de performance **pure par vendeur**

**⚠️ Limitations** :
- Si le manager a saisi des données globales dans `manager_kpis`, ces données **ne sont pas rattachées aux vendeurs**
- Les **prospects globaux** du manager ne peuvent pas être répartis par vendeur
- Le **taux de transformation individuel** est faussé si on utilise les prospects globaux

---

## 3. ANALYSE DES INCOHÉRENCES DE KPI

### 3.1 Tableau des Risques Identifiés

| KPI | Risque Identifié | Impact sur l'Analyse Vendeur | Exemple Concret |
|-----|------------------|------------------------------|-----------------|
| **CA / Vendeur** | Si le manager saisit le CA total magasin dans `manager_kpis`, ce CA "flotte" sans être rattaché aux vendeurs. | ⚠️ **Impossible de savoir qui a vendu quoi** si les vendeurs ne saisissent rien ou si le total manager fait foi. | Manager saisit 5000€ CA magasin. Vendeur A a vendu 2000€, Vendeur B a vendu 3000€. Le système affiche 5000€ (manager) + 5000€ (vendeurs) = **10000€ (DOUBLE COMPTAGE)** |
| **Taux de Transformation** | Les prospects sont souvent saisis globalement (magasin) alors que les ventes sont individuelles. | ⚠️ Le taux par vendeur est **mathématiquement faux** car on divise ses ventes par les entrées de tout le magasin. | Manager saisit 100 prospects (trafic magasin). Vendeur A fait 10 ventes. Taux = 10/100 = 10%. Mais en réalité, Vendeur A n'a peut-être vu que 20 prospects → Taux réel = 50% |
| **Panier Moyen** | Mélange de ventes individuelles et de CA global. | ⚠️ La moyenne est **diluée** par la saisie "magasin" du manager. | Manager saisit CA total 5000€ + 50 ventes. Vendeurs : 3000€ + 30 ventes. Panier = 8000€ / 80 ventes = 100€. Mais si le manager a déjà compté les ventes des vendeurs, c'est un **double comptage** |

---

### 3.2 Scénarios de Conflit

#### Scénario 1 : Manager saisit CA total magasin
```
Jour J :
- Manager saisit dans manager_kpis : CA = 5000€, Ventes = 50
- Vendeur A saisit dans kpi_entries : CA = 2000€, Ventes = 20
- Vendeur B saisit dans kpi_entries : CA = 3000€, Ventes = 30

Calcul actuel :
- CA Total = 5000€ (manager) + 2000€ (A) + 3000€ (B) = 10000€ ❌
- Ventes Total = 50 (manager) + 20 (A) + 30 (B) = 100 ❌
- Panier Moyen = 10000€ / 100 = 100€ ❌

Réalité :
- CA réel = 5000€ (déjà compté par le manager)
- Ventes réelles = 50 (déjà comptées par le manager)
- Panier Moyen réel = 5000€ / 50 = 100€ ✅
```

#### Scénario 2 : Prospects globaux vs Ventes individuelles
```
Jour J :
- Manager saisit dans manager_kpis : Prospects = 100 (trafic magasin)
- Vendeur A saisit dans kpi_entries : Ventes = 10
- Vendeur B saisit dans kpi_entries : Ventes = 15

Calcul actuel :
- Prospects Total = 100 (manager uniquement)
- Ventes Total = 10 (A) + 15 (B) = 25
- Taux Transformation = 25 / 100 = 25% ❌

Réalité (si on pouvait répartir) :
- Vendeur A a peut-être vu 40 prospects → Taux A = 10/40 = 25%
- Vendeur B a peut-être vu 60 prospects → Taux B = 15/60 = 25%
- Mais on ne peut pas le savoir car les prospects sont globaux
```

---

## 4. VISUALISATION DU CONFLIT DE FLUX

### 4.1 Flux Actuel (Problématique)

```
┌─────────────────────────────────────────────────────────────┐
│                    SAISIE DE DONNÉES                         │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┴───────────────────┐
        │                                           │
        ▼                                           ▼
┌───────────────┐                          ┌───────────────┐
│   VENDEURS    │                          │   MANAGERS    │
│ kpi_entries   │                          │ manager_kpis  │
└───────────────┘                          └───────────────┘
        │                                           │
        │ Données INDIVIDUELLES                     │ Données GLOBALES
        │ - CA individuel                          │ - CA total magasin ⚠️
        │ - Ventes individuelles                    │ - Ventes totales ⚠️
        │ - Prospects individuels (rare)           │ - Prospects totaux ⚠️
        │                                           │
        └───────────────────┬───────────────────┘
                            │
                            ▼
                ┌───────────────────────┐
                │   AGRÉGATION BACKEND   │
                │  get_store_stats()    │
                └───────────────────────┘
                            │
                            ▼
                ┌───────────────────────┐
                │   CALCUL KPIs          │
                │                        │
                │ CA = Σ(vendeurs) +     │
                │      Σ(manager)        │ ⚠️ DOUBLE COMPTAGE
                │                        │
                │ PM = CA_total /        │
                │      Ventes_total      │ ⚠️ DILUTION
                │                        │
                │ TT = Ventes_total /   │
                │      Prospects_total  │ ⚠️ INCOHÉRENCE
                └───────────────────────┘
                            │
                            ▼
                ┌───────────────────────┐
                │   AFFICHAGE GÉRANT     │
                │   KPIs "GÂCHÉS"       │
                └───────────────────────┘
```

---

## 5. ÉTAT ACTUEL vs BESOIN GÉRANT

### 5.1 Besoin du Gérant

Le gérant a besoin de :
1. ✅ **Vue d'ensemble magasin** : CA total, ventes totales, panier moyen magasin
2. ✅ **Analyse par vendeur** : Performance individuelle, CA par vendeur, taux de transformation individuel
3. ✅ **Référentiel de contrôle** : Données "officielles" du magasin (ex: CA caisse) pour valider les saisies vendeurs
4. ✅ **Traçabilité** : Savoir d'où viennent les données (saisie vendeur vs saisie manager vs API)

### 5.2 Problème Actuel

**Pourquoi la saisie de "données magasin" par le manager empêche l'analyse par vendeur ?**

1. **Double Comptage** :
   - Si le manager saisit le CA total magasin ET que les vendeurs saisissent leurs CA individuels, le système **additionne** les deux
   - Résultat : CA gonflé, impossible de savoir le vrai CA

2. **Dilution des KPIs** :
   - Le panier moyen devient un mélange de données individuelles et globales
   - Impossible de calculer un panier moyen "pur" par vendeur si les données manager sont mélangées

3. **Incohérence Taux de Transformation** :
   - Prospects globaux (manager) vs Ventes individuelles (vendeurs)
   - Le taux de transformation par vendeur est **mathématiquement faux**

4. **Impossibilité de Répartition** :
   - Si le manager saisit 5000€ CA magasin, on ne peut pas savoir comment répartir ce CA entre les vendeurs
   - Les données "flottent" sans attribution

---

## 6. STRUCTURE RECOMMANDÉE : Top-Down vs Bottom-Up

### 6.1 Architecture Proposée

```
┌─────────────────────────────────────────────────────────────┐
│              DONNÉES MANAGER (Top-Down)                     │
│              = Référentiel de Contrôle                      │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ Données GLOBALES MAGASIN
                            │ - CA total caisse (référentiel)
                            │ - Prospects totaux (trafic magasin)
                            │ - Utilisé pour VALIDATION
                            │
                            ▼
                ┌───────────────────────┐
                │   VALIDATION & CONTRÔLE  │
                │   Manager vs Vendeurs   │
                └───────────────────────┘
                            │
                            │
┌─────────────────────────────────────────────────────────────┐
│              DONNÉES VENDEURS (Bottom-Up)                   │
│              = Analyse de Performance                       │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ Données INDIVIDUELLES
                            │ - CA individuel
                            │ - Ventes individuelles
                            │ - Utilisé pour ANALYSE
                            │
                            ▼
                ┌───────────────────────┐
                │   CALCUL KPIs INDIVIDUELS│
                │   - CA par vendeur      │
                │   - PM par vendeur      │
                │   - TT par vendeur      │
                └───────────────────────┘
                            │
                            ▼
                ┌───────────────────────┐
                │   AGRÉGATION MAGASIN   │
                │   Σ(vendeurs)          │
                │   = CA réel magasin    │
                └───────────────────────┘
                            │
                            ▼
                ┌───────────────────────┐
                │   COMPARAISON          │
                │   CA vendeurs vs       │
                │   CA manager (caisse)  │
                │   → Écart détectable   │
                └───────────────────────┘
```

### 6.2 Règles Métier Recommandées

#### Règle 1 : Exclusion Mutuelle
- Si `manager_kpis.ca_journalier > 0` pour une date donnée, alors :
  - Les données manager sont considérées comme **référentiel de contrôle**
  - Les données vendeurs sont utilisées pour l'**analyse individuelle**
  - Le CA total magasin = `manager_kpis.ca_journalier` (pas de somme avec vendeurs)
  - Le CA par vendeur reste calculable individuellement

#### Règle 2 : Validation Top-Down
- Le manager saisit le **CA total caisse** (référentiel)
- Le système calcule `Σ(CA_vendeurs)` (bottom-up)
- **Écart détectable** : `CA_manager - Σ(CA_vendeurs)`
- Si écart > seuil → Alerte pour le gérant

#### Règle 3 : Prospects Globaux
- Les prospects sont **toujours saisis globalement** par le manager (trafic magasin)
- Pour le taux de transformation par vendeur :
  - Option A : Utiliser les prospects individuels si saisis par le vendeur
  - Option B : Répartir les prospects globaux proportionnellement aux ventes
  - Option C : Ne pas calculer le taux de transformation individuel si prospects globaux uniquement

#### Règle 4 : Mode de Saisie Exclusif
- **Mode 1** : Saisie vendeurs uniquement → Analyse individuelle + agrégation magasin
- **Mode 2** : Saisie manager uniquement → Référentiel de contrôle, pas d'analyse individuelle
- **Mode 3** : Saisie mixte → Manager = contrôle, Vendeurs = analyse individuelle (pas de somme)

---

## 7. RECOMMANDATIONS TECHNIQUES

### 7.1 Modifications Backend Recommandées

#### 7.1.1 Ajouter un Flag de Mode de Saisie

```python
# Dans kpi_configs
{
    "saisie_mode": "sellers_only" | "manager_only" | "mixed",
    "manager_as_reference": bool,  # Si True, manager_kpis = référentiel, pas additionné
    "validation_threshold": float  # Seuil d'écart acceptable (ex: 5%)
}
```

#### 7.1.2 Modifier `get_store_stats` pour Respecter le Mode

```python
# Pseudo-code
if saisie_mode == "manager_only":
    # Utiliser uniquement manager_kpis
    total_ca = manager_ca
    # Pas d'analyse individuelle possible
    
elif saisie_mode == "sellers_only":
    # Utiliser uniquement kpi_entries
    total_ca = sum(seller_ca)
    # Analyse individuelle possible
    
elif saisie_mode == "mixed":
    if manager_as_reference:
        # Manager = référentiel de contrôle
        total_ca = manager_ca  # Pas de somme
        # Calculer écart : manager_ca - sum(seller_ca)
        # Analyse individuelle basée sur seller_ca uniquement
    else:
        # Mode actuel (addition)
        total_ca = manager_ca + sum(seller_ca)
        # ⚠️ Risque de double comptage
```

#### 7.1.3 Calculer l'Écart de Validation

```python
# Nouvelle fonction
async def validate_store_ca(
    store_id: str,
    date: str
) -> Dict:
    """
    Compare manager CA (référentiel) vs sum(sellers CA)
    Returns validation status and gap
    """
    manager_ca = await get_manager_ca(store_id, date)
    sellers_ca_sum = await get_sellers_ca_sum(store_id, date)
    
    gap = manager_ca - sellers_ca_sum
    gap_percentage = (gap / manager_ca * 100) if manager_ca > 0 else 0
    
    return {
        "manager_ca": manager_ca,
        "sellers_ca_sum": sellers_ca_sum,
        "gap": gap,
        "gap_percentage": gap_percentage,
        "is_valid": abs(gap_percentage) <= VALIDATION_THRESHOLD,
        "status": "valid" if abs(gap_percentage) <= VALIDATION_THRESHOLD else "warning"
    }
```

### 7.2 Modifications Frontend Recommandées

#### 7.2.1 Afficher le Mode de Saisie Actif
- Indicateur visuel : "Mode : Saisie vendeurs" / "Mode : Saisie manager" / "Mode : Mixte"
- Avertissement si mode mixte avec risque de double comptage

#### 7.2.2 Afficher l'Écart de Validation
- Si mode mixte : Afficher `CA Manager (caisse)` vs `Σ(CA Vendeurs)`
- Afficher l'écart et un indicateur de validation (✅ / ⚠️)

#### 7.2.3 Séparer les Vues
- **Vue "Référentiel"** : Données manager (caisse) pour contrôle
- **Vue "Performance"** : Données vendeurs pour analyse individuelle
- **Vue "Validation"** : Comparaison et écarts

---

## 8. CONCLUSION

### 8.1 Problèmes Identifiés

1. ✅ **Double comptage** : Addition de CA manager + CA vendeurs
2. ✅ **Dilution des KPIs** : Mélange de données individuelles et globales
3. ✅ **Incohérence taux de transformation** : Prospects globaux vs ventes individuelles
4. ✅ **Impossibilité de répartition** : CA manager "flotte" sans attribution vendeur

### 8.2 Solution Recommandée

**Architecture Top-Down / Bottom-Up** :
- **Manager (Top-Down)** : Référentiel de contrôle (CA caisse, prospects globaux)
- **Vendeurs (Bottom-Up)** : Analyse de performance individuelle
- **Validation** : Comparaison manager vs Σ(vendeurs) pour détecter les écarts
- **Exclusion mutuelle** : Pas d'addition si manager = référentiel

### 8.3 Prochaines Étapes

1. ✅ Implémenter le flag `saisie_mode` dans `kpi_configs`
2. ✅ Modifier `get_store_stats` pour respecter le mode
3. ✅ Ajouter la fonction `validate_store_ca` pour calculer les écarts
4. ✅ Modifier le frontend pour afficher le mode et les écarts
5. ✅ Documenter les règles métier pour les gérants

---

**Rapport généré le** : 2024  
**Fichiers analysés** :
- `backend/models/kpis.py`
- `backend/api/routes/sellers.py`
- `backend/api/routes/manager.py`
- `backend/services/gerant_service.py`
- `backend/services/manager_service.py`
