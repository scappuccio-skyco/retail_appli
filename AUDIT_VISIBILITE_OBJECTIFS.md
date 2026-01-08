# Audit de la visibilité des objectifs et challenges

## Problème identifié

**Symptôme** : Un objectif créé par un gérant n'apparaît pas dans l'espace vendeur, alors qu'il devrait être visible.

**Cause racine** : La logique de récupération des objectifs côté vendeur filtre par `manager_id` au lieu de `store_id`, ce qui exclut les objectifs créés par le gérant.

## Analyse détaillée

### 1. Création d'objectifs

**Fichier** : `backend/api/routes/manager.py` (lignes 1036-1114)

Quand un objectif est créé :
- Par un **manager** : `manager_id` = ID du manager
- Par un **gérant** : `manager_id` = ID du gérant (ligne 1048 : `manager_id = context.get('id')`)

Dans les deux cas, l'objectif est sauvegardé avec :
- `store_id` : ID de la boutique
- `manager_id` : ID du créateur (manager ou gérant)

### 2. Récupération côté Manager/Gérant

**Fichier** : `backend/api/routes/manager.py` (lignes 909-1021)

Les objectifs sont récupérés par **`store_id` uniquement** :
```python
objectives = await db.objectives.find(
    {"store_id": resolved_store_id},
    {"_id": 0}
).sort("created_at", -1).to_list(100)
```

✅ **Correct** : Tous les objectifs de la boutique sont visibles, peu importe qui les a créés.

### 3. Récupération côté Vendeur

**Fichier** : `backend/services/seller_service.py` (lignes 70-145)

**PROBLÈME** : Les objectifs sont filtrés par `manager_id` :
```python
query = {
    "manager_id": manager_id,  # ❌ Filtre par manager_id du vendeur
    "period_end": {"$gte": today},
    "visible": True
}
if seller_store_id:
    query["store_id"] = seller_store_id  # Ajouté mais pas utilisé comme filtre principal
```

**Conséquence** :
- Si un objectif est créé par le gérant, son `manager_id` = ID du gérant
- Le vendeur cherche les objectifs avec `manager_id` = ID de son manager direct
- ❌ L'objectif créé par le gérant n'est pas trouvé

### 4. Même problème pour les challenges

**Fichier** : `backend/services/seller_service.py` (lignes 264-382)

Les challenges ont le même problème :
```python
query = {
    "manager_id": manager_id,  # ❌ Même problème
    "visible": True,
    ...
}
```

## Solution proposée

### Principe

Les objectifs et challenges doivent être attachés à la **boutique** (`store_id`) et aux **vendeurs** (`seller_id` ou `visible_to_sellers`), **pas au manager**.

Le `manager_id` peut être conservé pour :
- Traçabilité (qui a créé l'objectif)
- Calculs de progression (si nécessaire)

Mais **ne doit pas être utilisé comme filtre de visibilité**.

### Modifications nécessaires

#### 1. Récupération des objectifs actifs (vendeur)

**Fichier** : `backend/services/seller_service.py` - `get_seller_objectives_active()`

**Avant** :
```python
query = {
    "manager_id": manager_id,  # ❌
    "period_end": {"$gte": today},
    "visible": True
}
if seller_store_id:
    query["store_id"] = seller_store_id
```

**Après** :
```python
query = {
    "store_id": seller_store_id,  # ✅ Filtre principal par boutique
    "period_end": {"$gte": today},
    "visible": True
}
# manager_id retiré du filtre - utilisé uniquement pour le calcul de progression
```

#### 2. Récupération de tous les objectifs (vendeur)

**Fichier** : `backend/services/seller_service.py` - `get_seller_objectives_all()`

Même correction : remplacer le filtre `manager_id` par `store_id`.

#### 3. Récupération de l'historique (vendeur)

**Fichier** : `backend/services/seller_service.py` - `get_seller_objectives_history()`

Même correction.

#### 4. Récupération des challenges (vendeur)

**Fichier** : `backend/services/seller_service.py` - Toutes les fonctions de challenges

Même correction pour :
- `get_seller_challenges()`
- `get_seller_challenges_active()`
- `get_seller_challenges_history()`

### Points d'attention

1. **Calcul de progression** : Le `manager_id` est toujours nécessaire pour le calcul de progression (agrégation des KPI). Il doit être passé en paramètre mais ne doit pas filtrer les objectifs.

2. **Rétrocompatibilité** : Les objectifs existants avec `manager_id` continueront de fonctionner car on filtre maintenant par `store_id`.

3. **Sécurité** : Vérifier que le vendeur ne peut voir que les objectifs de sa propre boutique (déjà géré par `store_id`).

## Impact

### Avant correction
- ❌ Objectifs créés par gérant : **non visibles** pour les vendeurs
- ✅ Objectifs créés par manager : **visibles** pour les vendeurs
- ❌ Incohérence selon le créateur

### Après correction
- ✅ Objectifs créés par gérant : **visibles** pour les vendeurs de la boutique
- ✅ Objectifs créés par manager : **visibles** pour les vendeurs de la boutique
- ✅ Cohérence : tous les objectifs de la boutique sont visibles selon les règles de visibilité (`seller_id`, `visible_to_sellers`)

## Tests à effectuer

1. Créer un objectif en tant que gérant pour une boutique
2. Se connecter en tant que vendeur de cette boutique
3. Vérifier que l'objectif est visible dans l'espace vendeur
4. Vérifier que les règles de visibilité fonctionnent toujours (objectifs individuels vs collectifs)
5. Répéter pour les challenges

## Corrections appliquées

✅ **Date** : 2025-01-08

### Fichiers modifiés

1. **`backend/services/seller_service.py`**

   **Fonctions corrigées** :
   - `get_seller_objectives_active()` : Filtre maintenant par `store_id` au lieu de `manager_id`
   - `get_seller_objectives_all()` : Filtre maintenant par `store_id` au lieu de `manager_id`
   - `get_seller_objectives_history()` : Filtre maintenant par `store_id` au lieu de `manager_id`
   - `get_seller_challenges()` : Filtre maintenant par `store_id` au lieu de `manager_id`
   - `get_seller_challenges_active()` : Filtre maintenant par `store_id` au lieu de `manager_id`
   - `get_seller_challenges_history()` : Filtre maintenant par `store_id` au lieu de `manager_id`

   **Changements** :
   - Remplacement du filtre `"manager_id": manager_id` par `"store_id": seller_store_id`
   - Ajout de vérification que `seller_store_id` existe avant de construire la requête
   - Le paramètre `manager_id` est toujours utilisé pour le calcul de progression, mais n'est plus utilisé comme filtre de visibilité
   - Ajout de commentaires explicatifs dans chaque fonction

### Résultat attendu

Après ces corrections :
- ✅ Les objectifs créés par un gérant seront visibles pour tous les vendeurs de la boutique
- ✅ Les objectifs créés par un manager seront toujours visibles pour les vendeurs de la boutique
- ✅ Les règles de visibilité (`seller_id`, `visible_to_sellers`) continuent de fonctionner correctement
- ✅ Même comportement pour les challenges

### Notes importantes

- Le champ `manager_id` est toujours présent dans les documents d'objectifs/challenges pour la traçabilité
- Le `manager_id` est toujours nécessaire pour le calcul de progression (agrégation des KPI)
- La sécurité est maintenue : les vendeurs ne peuvent voir que les objectifs de leur propre boutique (via `store_id`)
