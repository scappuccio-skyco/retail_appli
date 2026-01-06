# Correction : Visibilité des objectifs et mise à jour de progression

## Problèmes identifiés

1. **Visibilité pour un vendeur spécifique ne fonctionne pas** : Quand un manager crée un objectif et souhaite qu'il soit visible pour un vendeur spécifique, cela ne fonctionne pas.

2. **Mise à jour de progression ne s'enregistre pas** : Quand on met à jour un objectif en rentrant des valeurs de progression, cela ne s'enregistre pas. On devrait voir la date de mise à jour, la nouvelle valeur restante avec un calcul du restant de l'objectif.

## Causes identifiées

### 1. Incohérence de collection MongoDB

**Problème** : Les objectifs étaient créés dans la collection `objectives` mais lus depuis `manager_objectives` dans `seller_service.py`, causant une incohérence.

**Fichiers affectés** :
- `backend/services/seller_service.py` : Utilisait `db.manager_objectives` au lieu de `db.objectives`

**Correction** : Toutes les références à `manager_objectives` ont été remplacées par `objectives` dans `seller_service.py` :
- `get_seller_objectives_active()` : ligne 89
- `get_seller_objectives_all()` : ligne 141
- `get_seller_objectives_history()` : ligne 198
- `calculate_objective_progress()` : ligne 500
- `calculate_objectives_progress_batch()` : ligne 726

### 2. Logique de visibilité `visible_to_sellers` ambiguë

**Problème** : La logique de filtrage des objectifs collectifs était ambiguë concernant le traitement de `visible_to_sellers`.

**Correction** : Clarification de la logique dans `backend/services/seller_service.py` :
- Si `visible_to_sellers` est `None` ou `[]` (vide) → objectif visible pour **TOUS** les vendeurs
- Si `visible_to_sellers` est `[id1, id2]` → objectif visible **UNIQUEMENT** pour ces vendeurs

```python
visible_to = objective.get('visible_to_sellers')
if visible_to is None or (isinstance(visible_to, list) and len(visible_to) == 0):
    # Visible to all sellers (no restriction)
    filtered_objectives.append(objective)
elif isinstance(visible_to, list) and seller_id in visible_to:
    # Visible only to specific sellers, and this seller is in the list
    filtered_objectives.append(objective)
```

### 3. Endpoint de mise à jour ne retourne pas l'objectif complet

**Problème** : Les endpoints `/manager/objectives/{id}/progress` et `/seller/objectives/{id}/progress` retournaient seulement un objet partiel `{success, current_value, progress_percentage, status}` au lieu de l'objectif complet avec `updated_at`.

**Correction** : Les endpoints retournent maintenant l'objectif complet mis à jour :

```python
# Fetch and return the complete updated objective
updated_objective = await db.objectives.find_one(
    {"id": objective_id},
    {"_id": 0}
)

if updated_objective:
    return updated_objective
```

### 4. Affichage du restant manquant

**Problème** : Le frontend n'affichait pas la valeur restante (target_value - current_value).

**Correction** : Ajout de l'affichage du restant dans `frontend/src/components/ManagerSettingsModal.js` :

```javascript
<span className="text-xs sm:text-sm font-semibold text-blue-600">
  ⏳ Restant: {Math.max(0, (objective.target_value || 0) - (objective.current_value || 0))?.toLocaleString('fr-FR')} {objective.unit || ''}
</span>
```

### 5. Sauvegarde de `visible_to_sellers`

**Problème** : `visible_to_sellers` pouvait être mal sauvegardé si `visible=false`.

**Correction** : Clarification dans `backend/api/routes/manager.py` :

```python
# CRITICAL: Ensure visible_to_sellers is properly saved
# If visible=True and visible_to_sellers is [], it means visible to all sellers
# If visible=True and visible_to_sellers is [id1, id2], it means visible only to these sellers
# If visible=False, visible_to_sellers should be None
"visible_to_sellers": objective_data.get("visible_to_sellers") if objective_data.get("visible", True) else None,
```

## Fichiers modifiés

### Backend
- `backend/services/seller_service.py` : 
  - Remplacement de `manager_objectives` par `objectives` (5 occurrences)
  - Clarification de la logique de visibilité (3 occurrences)
- `backend/api/routes/manager.py` :
  - Endpoint `/objectives/{id}/progress` retourne maintenant l'objectif complet
  - Clarification de la sauvegarde de `visible_to_sellers`
- `backend/api/routes/sellers.py` :
  - Endpoint `/objectives/{id}/progress` retourne maintenant l'objectif complet

### Frontend
- `frontend/src/components/ManagerSettingsModal.js` :
  - Ajout de l'affichage du restant (target_value - current_value)
  - Amélioration du logging après mise à jour de progression

## Résultat attendu

1. **Visibilité pour un vendeur spécifique** :
   - Quand un manager crée un objectif collectif et sélectionne un vendeur spécifique dans "Visible pour", cet objectif est visible uniquement pour ce vendeur
   - Les autres vendeurs ne voient pas cet objectif

2. **Mise à jour de progression** :
   - Quand on met à jour la progression d'un objectif, la date de mise à jour (`updated_at`) est affichée
   - La valeur actuelle (`current_value`) est mise à jour
   - Le restant (target_value - current_value) est calculé et affiché
   - Le pourcentage de progression est recalculé
   - Le statut (active/achieved/failed) est recalculé

## Test manuel recommandé

### Test 1 : Visibilité pour un vendeur spécifique

1. **Créer un objectif collectif** :
   - Se connecter en tant que manager
   - Créer un nouvel objectif collectif
   - Dans "Visible pour", sélectionner un vendeur spécifique (ex: "Vendeur 1")
   - Sauvegarder

2. **Vérifier côté vendeur** :
   - Se connecter en tant que "Vendeur 1"
   - Aller dans "Objectifs"
   - **Vérifier** : L'objectif est visible
   - Se connecter en tant qu'un autre vendeur
   - **Vérifier** : L'objectif n'est PAS visible

### Test 2 : Mise à jour de progression

1. **Mettre à jour la progression** :
   - Se connecter en tant que manager
   - Aller dans "Objectifs > En cours"
   - Cliquer sur "Mettre à jour la progression" pour un objectif
   - Entrer une nouvelle valeur (ex: 1500)
   - Valider

2. **Vérifier l'affichage** :
   - **Vérifier** : La date de mise à jour est affichée avec l'heure
   - **Vérifier** : La valeur actuelle est mise à jour (1500)
   - **Vérifier** : Le restant est calculé et affiché (target_value - 1500)
   - **Vérifier** : Le pourcentage de progression est recalculé
   - **Vérifier** : La barre de progression est mise à jour

## Notes techniques

- La collection MongoDB utilisée est maintenant **uniquement** `objectives` (plus de `manager_objectives`)
- La logique de visibilité est maintenant explicite et documentée
- Les endpoints de mise à jour retournent l'objectif complet pour permettre au frontend de rafraîchir l'affichage sans recharger toutes les données

