# Correction : Visibilité des challenges et mise à jour de progression

## Problèmes identifiés

Mêmes problèmes que pour les objectifs, mais appliqués aux challenges :

1. **Visibilité pour un vendeur spécifique ne fonctionne pas** : Quand un manager crée un challenge et souhaite qu'il soit visible pour un vendeur spécifique, cela ne fonctionne pas.

2. **Mise à jour de progression ne s'enregistre pas** : Quand on met à jour un challenge en rentrant des valeurs de progression, cela ne s'enregistre pas. On devrait voir la date de mise à jour, la nouvelle valeur restante avec un calcul du restant du challenge.

## Causes identifiées

### 1. Logique de visibilité `visible_to_sellers` ambiguë

**Problème** : La logique de filtrage des challenges collectifs était ambiguë concernant le traitement de `visible_to_sellers`, identique au problème des objectifs.

**Correction** : Clarification de la logique dans `backend/services/seller_service.py` (3 occurrences) :
- Si `visible_to_sellers` est `None` ou `[]` (vide) → challenge visible pour **TOUS** les vendeurs
- Si `visible_to_sellers` est `[id1, id2]` → challenge visible **UNIQUEMENT** pour ces vendeurs

```python
visible_to = challenge.get('visible_to_sellers')
if visible_to is None or (isinstance(visible_to, list) and len(visible_to) == 0):
    # Visible to all sellers (no restriction)
    filtered_challenges.append(challenge)
elif isinstance(visible_to, list) and seller_id in visible_to:
    # Visible only to specific sellers, and this seller is in the list
    filtered_challenges.append(challenge)
```

### 2. Endpoint de mise à jour ne retourne pas le challenge complet

**Problème** : Les endpoints `/manager/challenges/{id}/progress` et `/seller/challenges/{id}/progress` retournaient seulement un objet partiel `{success, current_value, progress_percentage, status}` au lieu du challenge complet avec `updated_at`.

**Correction** : Les endpoints retournent maintenant le challenge complet mis à jour :

```python
# Fetch and return the complete updated challenge
updated_challenge = await db.challenges.find_one(
    {"id": challenge_id},
    {"_id": 0}
)

if updated_challenge:
    return updated_challenge
```

### 3. Affichage du restant manquant

**Problème** : Le frontend n'affichait pas la valeur restante (target_value - current_value) pour les challenges.

**Correction** : Ajout de l'affichage du restant dans `frontend/src/components/ManagerSettingsModal.js` pour les challenges de type `kpi_standard`, `product_focus`, et `custom` :

```javascript
<span className="text-blue-600 font-semibold">
  ⏳ Restant: {Math.max(0, (challenge.target_value || 0) - (challenge.current_value || 0))?.toLocaleString('fr-FR')} {challenge.unit || ''}
</span>
```

### 4. Sauvegarde de `visible_to_sellers`

**Problème** : `visible_to_sellers` pouvait être mal sauvegardé si `visible=false`.

**Correction** : Clarification dans `backend/api/routes/manager.py` :

```python
# CRITICAL: Ensure visible_to_sellers is properly saved
# If visible=True and visible_to_sellers is [], it means visible to all sellers
# If visible=True and visible_to_sellers is [id1, id2], it means visible only to these sellers
# If visible=False, visible_to_sellers should be None
"visible_to_sellers": challenge_data.get("visible_to_sellers") if challenge_data.get("visible", True) else None,
```

## Fichiers modifiés

### Backend
- `backend/services/seller_service.py` : 
  - Clarification de la logique de visibilité pour les challenges (3 occurrences)
- `backend/api/routes/manager.py` :
  - Endpoint `/challenges/{id}/progress` retourne maintenant le challenge complet
  - Clarification de la sauvegarde de `visible_to_sellers`
- `backend/api/routes/sellers.py` :
  - Endpoint `/challenges/{id}/progress` retourne maintenant le challenge complet

### Frontend
- `frontend/src/components/ManagerSettingsModal.js` :
  - Ajout de l'affichage du restant pour les challenges (target_value - current_value)
  - Amélioration du logging après mise à jour de progression

## Résultat attendu

1. **Visibilité pour un vendeur spécifique** :
   - Quand un manager crée un challenge collectif et sélectionne un vendeur spécifique dans "Visible pour", ce challenge est visible uniquement pour ce vendeur
   - Les autres vendeurs ne voient pas ce challenge

2. **Mise à jour de progression** :
   - Quand on met à jour la progression d'un challenge, la date de mise à jour (`updated_at`) est affichée
   - La valeur actuelle (`current_value`) est mise à jour
   - Le restant (target_value - current_value) est calculé et affiché
   - Le pourcentage de progression est recalculé
   - Le statut (active/achieved/failed) est recalculé

## Test manuel recommandé

### Test 1 : Visibilité pour un vendeur spécifique

1. **Créer un challenge collectif** :
   - Se connecter en tant que manager
   - Créer un nouvel challenge collectif
   - Dans "Visible pour", sélectionner un vendeur spécifique (ex: "Vendeur 1")
   - Sauvegarder

2. **Vérifier côté vendeur** :
   - Se connecter en tant que "Vendeur 1"
   - Aller dans "Challenges"
   - **Vérifier** : Le challenge est visible
   - Se connecter en tant qu'un autre vendeur
   - **Vérifier** : Le challenge n'est PAS visible

### Test 2 : Mise à jour de progression

1. **Mettre à jour la progression** :
   - Se connecter en tant que manager
   - Aller dans "Challenges > En cours"
   - Cliquer sur "Mettre à jour la progression" pour un challenge
   - Entrer une nouvelle valeur (ex: 1500)
   - Valider

2. **Vérifier l'affichage** :
   - **Vérifier** : La date de mise à jour est affichée avec l'heure
   - **Vérifier** : La valeur actuelle est mise à jour (1500)
   - **Vérifier** : Le restant est calculé et affiché (target_value - 1500)
   - **Vérifier** : Le pourcentage de progression est recalculé
   - **Vérifier** : La barre de progression est mise à jour

## Notes techniques

- La collection MongoDB utilisée est `challenges` (pas de problème d'incohérence comme pour objectives)
- La logique de visibilité est maintenant explicite et documentée, identique à celle des objectifs
- Les endpoints de mise à jour retournent le challenge complet pour permettre au frontend de rafraîchir l'affichage sans recharger toutes les données
- Les challenges utilisent le même système flexible que les objectifs (kpi_standard, product_focus, custom)

