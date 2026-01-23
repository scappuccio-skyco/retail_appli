# 🔍 AUDIT : LOGIQUE DE BLOCAGE APRÈS EXPIRATION DE L'ESSAI

**Date**: 23 Janvier 2026  
**Objectif**: Analyser la logique de blocage et proposer un correctif pour autoriser la suspension/désactivation de vendeurs même en fin d'essai

---

## 📍 1. LOCALISATION DU VERROU

### Points de blocage identifiés

#### a) `backend/core/security.py` - `require_active_space()`
**Ligne**: 424-478  
**Fonction**: Middleware de dépendance FastAPI  
**Blocage**: Lève `HTTPException 403` si `subscription_status == 'trial_expired'`

```python
async def require_active_space(
    current_user: dict = Depends(get_current_user)
) -> dict:
    """
    Dependency to enforce active subscription for business routes.
    Returns current_user if subscription is active or trialing (not expired).
    """
    subscription_status = space.get('subscription_status') or 'inactive'
    if subscription_status == 'active':
        return current_user
    
    if subscription_status == 'trialing':
        # Vérifie trial_end...
        if now > trial_end_dt:
            # Trial expired: update workspace status
            await db.workspaces.update_one(
                {"id": workspace_id},
                {"$set": {"subscription_status": "trial_expired"}}
            )
            raise HTTPException(status_code=403, detail="Période d'essai terminée...")
    
    raise HTTPException(status_code=403, detail="Abonnement inactif...")
```

**Impact**: Bloque toutes les routes utilisant `Depends(require_active_space)`

---

#### b) `backend/services/kpi_service.py` - `check_user_write_access()`
**Ligne**: 18-102  
**Fonction**: Vérifie l'accès en écriture pour les KPIs  
**Blocage**: Lève `HTTPException 403` si `trial_expired`

```python
async def check_user_write_access(self, user_id: str) -> bool:
    """
    Guard clause for Sellers/Managers: Get parent Gérant and check subscription access.
    """
    # ... récupère workspace ...
    subscription_status = workspace.get('subscription_status', 'inactive')
    
    if subscription_status == 'active':
        return True
    
    if subscription_status == 'trialing':
        # Vérifie trial_end...
        if now > trial_end_dt:
            await self.db.workspaces.update_one(
                {"id": workspace_id},
                {"$set": {"subscription_status": "trial_expired"}}
            )
    
    # Trial expired or other inactive status
    raise HTTPException(
        status_code=403, 
        detail="Période d'essai terminée. Veuillez contacter votre administrateur."
    )
```

**Impact**: Bloque toutes les opérations d'écriture de KPIs

---

#### c) `backend/services/gerant_service.py` - `check_gerant_active_access()`
**Ligne**: 25-102  
**Fonction**: Vérifie l'accès actif pour les gérants  
**Blocage**: Lève `HTTPException 403` si `trial_expired`

```python
async def check_gerant_active_access(self, gerant_id: str) -> bool:
    """
    Check if gérant has active subscription or valid trial.
    Raises HTTPException 403 if trial expired or no active subscription.
    """
    # ... récupère workspace ...
    subscription_status = workspace.get('subscription_status', 'inactive')
    
    if subscription_status == 'active':
        return True
    
    if subscription_status == 'trialing':
        # Vérifie trial_end...
        if now > trial_end_dt:
            await self.db.workspaces.update_one(
                {"id": workspace_id},
                {"$set": {"subscription_status": "trial_expired"}}
            )
            raise HTTPException(status_code=403, detail="Votre période d'essai est terminée...")
    
    raise HTTPException(status_code=403, detail="Votre période d'essai est terminée...")
```

**Impact**: ⚠️ **CRITIQUE** - Bloque `suspend_user()` et `reactivate_user()` (lignes 2041, 2080)

---

## 🚨 2. PROBLÈME IDENTIFIÉ

### Routes de suspension bloquées

**Fichier**: `backend/api/routes/gerant.py`  
**Routes**:
- `PATCH /sellers/{seller_id}/suspend` (ligne 1505)
- `PATCH /sellers/{seller_id}/reactivate` (ligne 1520)
- `DELETE /sellers/{seller_id}` (ligne 1535)

**Fichier**: `backend/services/gerant_service.py`  
**Méthodes**:
- `suspend_user()` (ligne 2031) - **Appelle `check_gerant_active_access()` ligne 2041** ❌
- `reactivate_user()` (ligne 2070) - **Appelle `check_gerant_active_access()` ligne 2080** ❌
- `delete_user()` (ligne 2112) - **Appelle `check_gerant_active_access()` ligne 2122** ❌

**Conséquence**: Un gérant en fin d'essai **ne peut pas suspendre/réactiver/supprimer** ses vendeurs pour ajuster son abonnement.

---

## 💰 3. RISQUE MÉTIER - RECALCUL D'ABONNEMENT

### Analyse du calcul d'abonnement

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

**Conclusion**: ✅ **Le calcul est automatique** - Seuls les vendeurs avec `status: "active"` sont comptés. Si un vendeur est suspendu (`status: "suspended"`), il n'est **pas compté** dans le calcul du prix.

**Problème**: Le gérant ne peut pas suspendre ses vendeurs en fin d'essai pour réduire le nombre de licences nécessaires.

---

## 🔒 4. SÉCURITÉ - VÉRIFICATIONS NÉCESSAIRES

### Actions autorisées (même en fin d'essai)

✅ **Autoriser**:
- `PATCH /sellers/{seller_id}/suspend` - Suspendre un vendeur
- `PATCH /sellers/{seller_id}/reactivate` - Réactiver un vendeur suspendu
- `DELETE /sellers/{seller_id}` - Supprimer un vendeur (soft delete)

### Actions interdites (même avec correctif)

❌ **Bloquer**:
- `POST /sellers` - Créer un nouveau vendeur
- `POST /managers` - Créer un nouveau manager
- `POST /ai/*` - Générer des diagnostics/briefs (fonctions premium)
- `POST /briefs/*` - Générer des briefs matinaux (fonctions premium)
- `POST /objectives` - Créer des objectifs
- `POST /challenges` - Créer des défis
- `PUT /sellers/{seller_id}` - Modifier les données d'un vendeur (sauf status)

---

## ✅ 5. SOLUTION PROPOSÉE

### Option 1 : Exception dans `check_gerant_active_access()` (Recommandé)

**Modifier**: `backend/services/gerant_service.py`

```python
async def check_gerant_active_access(
    self, 
    gerant_id: str, 
    allow_user_management: bool = False  # ✅ Nouveau paramètre
) -> bool:
    """
    Check if gérant has active subscription or valid trial.
    
    Args:
        gerant_id: Gérant ID
        allow_user_management: If True, allows suspend/reactivate/delete even if trial_expired
    
    Raises HTTPException 403 if trial expired or no active subscription.
    """
    # Si allow_user_management=True, on skip la vérification pour les actions de gestion
    if allow_user_management:
        # Vérifier seulement que le gérant existe et n'est pas supprimé
        gerant = await self.user_repo.find_one(
            {"id": gerant_id, "role": "gerant"},
            {"_id": 0, "status": 1}
        )
        if not gerant:
            raise HTTPException(status_code=404, detail="Gérant non trouvé")
        if gerant.get('status') == 'deleted':
            raise HTTPException(status_code=403, detail="Gérant supprimé")
        return True  # ✅ Autorise l'action même si trial_expired
    
    # Logique normale pour les autres actions
    # ... reste du code existant ...
```

**Modifier**: `backend/services/gerant_service.py` - `suspend_user()`, `reactivate_user()`, `delete_user()`

```python
async def suspend_user(self, user_id: str, gerant_id: str, role: str) -> Dict:
    """
    Suspend a manager or seller
    ✅ AUTORISÉ même si trial_expired pour permettre l'ajustement d'abonnement
    """
    # ✅ Exception: allow_user_management=True pour bypasser le blocage trial_expired
    await self.check_gerant_active_access(gerant_id, allow_user_management=True)
    
    # ... reste du code existant ...
```

**Avantages**:
- ✅ Solution centralisée
- ✅ Facile à maintenir
- ✅ Sécurisé (vérifie toujours que le gérant existe)

---

### Option 2 : Route dédiée sans vérification d'abonnement

**Créer**: `backend/api/routes/gerant.py` - Routes spéciales

```python
@router.patch("/sellers/{seller_id}/suspend-trial-expired")
async def suspend_seller_trial_expired(
    seller_id: str,
    current_user: Dict = Depends(get_current_gerant),  # ✅ Pas de require_active_space
    gerant_service: GerantService = Depends(get_gerant_service)
):
    """
    Suspend a seller - ALLOWED even if trial expired.
    ⚠️ SECURITY: Only allows status changes, not creation/modification of other fields.
    """
    # Vérifier que le gérant existe (sans vérifier l'abonnement)
    gerant = await db.users.find_one(
        {"id": current_user['id'], "role": "gerant"},
        {"_id": 0, "status": 1}
    )
    if not gerant or gerant.get('status') == 'deleted':
        raise HTTPException(status_code=403, detail="Gérant non trouvé ou supprimé")
    
    # Appeler suspend_user avec bypass
    return await gerant_service.suspend_user(seller_id, current_user['id'], 'seller')
```

**Inconvénients**:
- ❌ Duplication de routes
- ❌ Plus complexe à maintenir

---

## 🎯 6. RECOMMANDATION FINALE

### Solution recommandée : Option 1

**Modifications à apporter**:

1. **`backend/services/gerant_service.py`**:
   - Modifier `check_gerant_active_access()` pour accepter `allow_user_management: bool = False`
   - Modifier `suspend_user()` pour passer `allow_user_management=True`
   - Modifier `reactivate_user()` pour passer `allow_user_management=True`
   - Modifier `delete_user()` pour passer `allow_user_management=True`

2. **Sécurité supplémentaire**:
   - Vérifier que seuls les champs `status`, `suspended_at`, `suspended_by`, `suspended_reason` peuvent être modifiés
   - Bloquer toute modification d'autres champs (email, name, etc.) si `trial_expired`

3. **Validation métier**:
   - ✅ Le calcul d'abonnement est déjà automatique (compte uniquement `status: "active"`)
   - ✅ Pas besoin de recalcul manuel après suspension

---

## 📋 7. CHECKLIST DE VALIDATION

### Tests à effectuer après correctif

- [ ] **Test 1**: Gérant en fin d'essai peut suspendre un vendeur
- [ ] **Test 2**: Gérant en fin d'essai peut réactiver un vendeur suspendu
- [ ] **Test 3**: Gérant en fin d'essai peut supprimer un vendeur
- [ ] **Test 4**: Gérant en fin d'essai **ne peut pas** créer un nouveau vendeur
- [ ] **Test 5**: Gérant en fin d'essai **ne peut pas** utiliser les fonctions IA
- [ ] **Test 6**: Le calcul d'abonnement exclut bien les vendeurs suspendus
- [ ] **Test 7**: Un vendeur suspendu ne peut pas se connecter
- [ ] **Test 8**: Un gérant supprimé ne peut pas suspendre (même avec allow_user_management)

---

## 🔐 8. SÉCURITÉ - GARANTIES

### Vérifications maintenues

✅ **Toujours vérifiées** (même avec `allow_user_management=True`):
- Le gérant existe dans la base de données
- Le gérant n'est pas supprimé (`status != 'deleted'`)
- Le vendeur appartient au gérant (`gerant_id` match)
- Le vendeur a le bon rôle (`role == 'seller'`)

❌ **Toujours bloquées** (même avec correctif):
- Création de nouveaux utilisateurs
- Accès aux fonctions premium (IA, Briefs)
- Modification de champs sensibles (email, password, etc.)
- Accès aux données d'autres gérants (IDOR)

---

## 📊 9. IMPACT BUSINESS

### Avant (Blocage total)
- ❌ Gérant en fin d'essai = **Aucune action possible**
- ❌ Impossible d'ajuster le nombre de licences
- ❌ Doit contacter le support pour suspendre des vendeurs

### Après (Correctif)
- ✅ Gérant en fin d'essai = **Peut gérer son personnel**
- ✅ Peut suspendre des vendeurs pour réduire les coûts
- ✅ Le calcul d'abonnement se met à jour automatiquement
- ✅ Peut souscrire à une offre moins chère immédiatement

---

## 🛠️ 10. PLAN D'IMPLÉMENTATION

### Étape 1 : Modifier `check_gerant_active_access()`
- Ajouter paramètre `allow_user_management: bool = False`
- Implémenter la logique de bypass si `True`

### Étape 2 : Modifier les méthodes de gestion
- `suspend_user()` → `allow_user_management=True`
- `reactivate_user()` → `allow_user_management=True`
- `delete_user()` → `allow_user_management=True`

### Étape 3 : Tests
- Tests unitaires pour chaque méthode
- Tests d'intégration avec `trial_expired`
- Tests de sécurité (vérifier que création est toujours bloquée)

### Étape 4 : Documentation
- Documenter le comportement dans les docstrings
- Ajouter des commentaires de sécurité

---

## ⚠️ 11. RISQUES ET MITIGATION

### Risque 1 : Abus (création de vendeurs)
**Mitigation**: Les routes de création utilisent toujours `require_active_space()` ou `check_gerant_active_access()` sans `allow_user_management=True`

### Risque 2 : Modification de données sensibles
**Mitigation**: Limiter les modifications aux champs `status`, `suspended_at`, `suspended_by`, `suspended_reason` uniquement

### Risque 3 : Accès aux fonctions premium
**Mitigation**: Les routes IA/Briefs utilisent `require_active_space()` qui reste bloqué si `trial_expired`

---

*Audit complété le 23 Janvier 2026*
