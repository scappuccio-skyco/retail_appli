# ✅ CORRECTIF : AUTORISER GESTION PERSONNEL EN FIN D'ESSAI

**Date**: 23 Janvier 2026  
**Objectif**: Permettre au gérant de suspendre/réactiver/supprimer des vendeurs même si `trial_expired`

---

## 🎯 SOLUTION IMPLÉMENTÉE

### Principe
Ajouter un paramètre `allow_user_management: bool = False` à `check_gerant_active_access()` pour autoriser uniquement les actions de gestion de personnel (suspend/reactivate/delete) même si le trial est expiré.

---

## 📝 MODIFICATIONS À APPLIQUER

### 1. Modifier `backend/services/gerant_service.py` - `check_gerant_active_access()`

**Ligne**: 25-102

**Avant**:
```python
async def check_gerant_active_access(self, gerant_id: str) -> bool:
    """
    Check if gérant has active subscription or valid trial.
    Raises HTTPException 403 if trial expired or no active subscription.
    """
    # ... code existant ...
```

**Après**:
```python
async def check_gerant_active_access(
    self, 
    gerant_id: str, 
    allow_user_management: bool = False
) -> bool:
    """
    Check if gérant has active subscription or valid trial.
    
    Args:
        gerant_id: Gérant ID
        allow_user_management: If True, allows suspend/reactivate/delete even if trial_expired.
                              ⚠️ SECURITY: Only bypasses subscription check, still verifies gérant exists.
    
    Raises HTTPException 403 if trial expired or no active subscription (unless allow_user_management=True).
    """
    # ✅ EXCEPTION: Si allow_user_management=True, on autorise même si trial_expired
    # Mais on vérifie toujours que le gérant existe et n'est pas supprimé
    if allow_user_management:
        gerant = await self.user_repo.find_one(
            {"id": gerant_id, "role": "gerant"},
            {"_id": 0, "status": 1}
        )
        if not gerant:
            raise HTTPException(status_code=404, detail="Gérant non trouvé")
        if gerant.get('status') == 'deleted':
            raise HTTPException(status_code=403, detail="Gérant supprimé")
        # ✅ Autorise l'action même si trial_expired
        return True
    
    # Logique normale pour les autres actions (création, modification, fonctions premium)
    workspace_id = gerant.get('workspace_id')
    # ... reste du code existant inchangé ...
```

---

### 2. Modifier `backend/services/gerant_service.py` - `suspend_user()`

**Ligne**: 2031-2068

**Avant**:
```python
async def suspend_user(self, user_id: str, gerant_id: str, role: str) -> Dict:
    """
    Suspend a manager or seller
    """
    # === GUARD CLAUSE: Check subscription access ===
    await self.check_gerant_active_access(gerant_id)  # ❌ Bloque si trial_expired
    # ... reste du code ...
```

**Après**:
```python
async def suspend_user(self, user_id: str, gerant_id: str, role: str) -> Dict:
    """
    Suspend a manager or seller
    
    ✅ AUTORISÉ même si trial_expired pour permettre l'ajustement d'abonnement.
    Le calcul d'abonnement exclut automatiquement les vendeurs suspendus.
    """
    # === GUARD CLAUSE: Check subscription access ===
    # ✅ Exception: allow_user_management=True pour bypasser le blocage trial_expired
    await self.check_gerant_active_access(gerant_id, allow_user_management=True)
    # ... reste du code inchangé ...
```

---

### 3. Modifier `backend/services/gerant_service.py` - `reactivate_user()`

**Ligne**: 2070-2110

**Avant**:
```python
async def reactivate_user(self, user_id: str, gerant_id: str, role: str) -> Dict:
    """
    Reactivate a suspended manager or seller
    """
    # === GUARD CLAUSE: Check subscription access ===
    await self.check_gerant_active_access(gerant_id)  # ❌ Bloque si trial_expired
    # ... reste du code ...
```

**Après**:
```python
async def reactivate_user(self, user_id: str, gerant_id: str, role: str) -> Dict:
    """
    Reactivate a suspended manager or seller
    
    ✅ AUTORISÉ même si trial_expired pour permettre l'ajustement d'abonnement.
    """
    # === GUARD CLAUSE: Check subscription access ===
    # ✅ Exception: allow_user_management=True pour bypasser le blocage trial_expired
    await self.check_gerant_active_access(gerant_id, allow_user_management=True)
    # ... reste du code inchangé ...
```

---

### 4. Modifier `backend/services/gerant_service.py` - `delete_user()`

**Ligne**: 2112-2145

**Avant**:
```python
async def delete_user(self, user_id: str, gerant_id: str, role: str) -> Dict:
    """
    Soft delete a manager or seller (set status to 'deleted')
    """
    # === GUARD CLAUSE: Check subscription access ===
    await self.check_gerant_active_access(gerant_id)  # ❌ Bloque si trial_expired
    # ... reste du code ...
```

**Après**:
```python
async def delete_user(self, user_id: str, gerant_id: str, role: str) -> Dict:
    """
    Soft delete a manager or seller (set status to 'deleted')
    
    ✅ AUTORISÉ même si trial_expired pour permettre l'ajustement d'abonnement.
    """
    # === GUARD CLAUSE: Check subscription access ===
    # ✅ Exception: allow_user_management=True pour bypasser le blocage trial_expired
    await self.check_gerant_active_access(gerant_id, allow_user_management=True)
    # ... reste du code inchangé ...
```

---

## 🔒 SÉCURITÉ - VÉRIFICATIONS MAINTENUES

### ✅ Toujours vérifiées (même avec `allow_user_management=True`)

1. **Existence du gérant**:
   ```python
   gerant = await self.user_repo.find_one(
       {"id": gerant_id, "role": "gerant"},
       {"_id": 0, "status": 1}
   )
   if not gerant:
       raise HTTPException(status_code=404, detail="Gérant non trouvé")
   ```

2. **Gérant non supprimé**:
   ```python
   if gerant.get('status') == 'deleted':
       raise HTTPException(status_code=403, detail="Gérant supprimé")
   ```

3. **Propriété du vendeur** (dans `suspend_user()`, `reactivate_user()`, `delete_user()`):
   ```python
   user = await self.user_repo.find_one({
       "id": user_id,
       "gerant_id": gerant_id,  # ✅ Vérifie la propriété
       "role": role
   })
   if not user:
       raise ValueError(f"{role.capitalize()} non trouvé")
   ```

### ❌ Toujours bloquées (même avec correctif)

1. **Création de vendeurs/managers**:
   - Routes utilisent `require_active_space()` ou `check_gerant_active_access()` sans `allow_user_management=True`
   - Exemple: `POST /sellers` reste bloqué si `trial_expired`

2. **Fonctions premium (IA, Briefs)**:
   - Routes utilisent `require_active_space()` qui reste bloqué si `trial_expired`
   - Exemple: `POST /ai/generate-diagnostic` reste bloqué

3. **Modification de données sensibles**:
   - Les méthodes `suspend_user()`, `reactivate_user()`, `delete_user()` ne modifient que le champ `status`
   - Les autres champs (email, name, etc.) ne peuvent pas être modifiés via ces méthodes

---

## 📊 VALIDATION MÉTIER

### Calcul d'abonnement automatique

**Fichier**: `backend/api/routes/gerant.py` - `create_gerant_checkout_session()`  
**Ligne**: 1652-1656

```python
# Compter les vendeurs ACTIFS uniquement
active_sellers_count = await db.users.count_documents({
    "gerant_id": current_user['id'],
    "role": "seller", 
    "status": "active"  # ✅ Seuls les vendeurs actifs sont comptés
})
```

**Conclusion**: ✅ **Pas besoin de recalcul manuel** - Le calcul d'abonnement exclut automatiquement les vendeurs avec `status: "suspended"` ou `status: "deleted"`.

**Workflow**:
1. Gérant suspend un vendeur → `status: "suspended"`
2. Gérant crée un checkout → Seuls les vendeurs `status: "active"` sont comptés
3. Prix ajusté automatiquement ✅

---

## 🧪 TESTS À EFFECTUER

### Test 1 : Suspension en fin d'essai
```python
# Setup: Gérant avec trial_expired
workspace = {"subscription_status": "trial_expired"}

# Action: Suspendre un vendeur
response = await client.patch(
    f"/api/gerant/sellers/{seller_id}/suspend",
    headers={"Authorization": f"Bearer {gerant_token}"}
)

# Expected: ✅ 200 OK - Vendeur suspendu
assert response.status_code == 200
assert response.json()["status"] == "suspended"
```

### Test 2 : Création bloquée en fin d'essai
```python
# Setup: Gérant avec trial_expired
workspace = {"subscription_status": "trial_expired"}

# Action: Créer un nouveau vendeur
response = await client.post(
    "/api/gerant/sellers",
    json={"name": "Nouveau Vendeur", "email": "new@seller.com"},
    headers={"Authorization": f"Bearer {gerant_token}"}
)

# Expected: ❌ 403 Forbidden - Création bloquée
assert response.status_code == 403
assert "essai terminé" in response.json()["detail"].lower()
```

### Test 3 : Calcul d'abonnement exclut suspendus
```python
# Setup: 5 vendeurs actifs, 2 suspendus
active_sellers = 5
suspended_sellers = 2

# Action: Créer checkout
response = await client.post(
    "/api/gerant/stripe/checkout",
    json={"billing_period": "monthly", "origin_url": "https://..."},
    headers={"Authorization": f"Bearer {gerant_token}"}
)

# Expected: ✅ quantity = 5 (seuls les actifs comptés)
assert response.json()["quantity"] == 5
assert response.json()["active_sellers_count"] == 5
```

---

## 📋 CHECKLIST D'IMPLÉMENTATION

- [ ] Modifier `check_gerant_active_access()` avec paramètre `allow_user_management`
- [ ] Modifier `suspend_user()` pour passer `allow_user_management=True`
- [ ] Modifier `reactivate_user()` pour passer `allow_user_management=True`
- [ ] Modifier `delete_user()` pour passer `allow_user_management=True`
- [ ] Vérifier que les routes de création utilisent toujours `check_gerant_active_access()` sans `allow_user_management=True`
- [ ] Vérifier que les routes IA/Briefs utilisent toujours `require_active_space()`
- [ ] Tests unitaires pour chaque méthode modifiée
- [ ] Tests d'intégration avec `trial_expired`
- [ ] Tests de sécurité (vérifier que création est toujours bloquée)

---

## 🎯 IMPACT ATTENDU

### Avant
- ❌ Gérant en fin d'essai = **Aucune action possible**
- ❌ Impossible d'ajuster le nombre de licences
- ❌ Doit contacter le support

### Après
- ✅ Gérant en fin d'essai = **Peut gérer son personnel**
- ✅ Peut suspendre des vendeurs pour réduire les coûts
- ✅ Calcul d'abonnement automatique
- ✅ Peut souscrire à une offre moins chère immédiatement

---

*Correctif prêt à implémenter - 23 Janvier 2026*
