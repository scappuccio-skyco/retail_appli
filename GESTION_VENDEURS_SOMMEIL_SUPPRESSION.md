# 👥 GESTION DES VENDEURS - Sommeil & Suppression

## ✅ Fonctionnalités implémentées

Vous pouvez maintenant gérer vos vendeurs avec 3 actions :

1. **🟠 Mettre en sommeil** (réversible)
2. **🟢 Réactiver** (depuis le sommeil)
3. **🔴 Supprimer** (définitif, soft delete)

---

## 🎯 FONCTIONNEMENT

### 1. Mettre un vendeur en sommeil 🟠

**Quand l'utiliser ?**
- Vendeur en congé longue durée
- Vendeur temporairement transféré
- Période creuse (besoin de réduire les coûts)

**Ce qui se passe :**
- ✅ Le vendeur passe en statut `inactive`
- ✅ Libère **1 siège** immédiatement
- ✅ Le vendeur ne peut plus se connecter
- ✅ Son historique est conservé (débriefs, évaluations, KPI)
- ✅ Peut être réactivé plus tard

**Impact sur les crédits IA :**
- Si vous avez 5 vendeurs actifs → 750 crédits IA (250 + 5×100)
- Après mise en sommeil de 1 vendeur → 650 crédits IA (250 + 4×100)
- Le mois suivant : recalcul automatique

---

### 2. Réactiver un vendeur 🟢

**Quand l'utiliser ?**
- Le vendeur revient de congé
- Reprise d'activité
- Nouvelle saison

**Ce qui se passe :**
- ✅ Le vendeur repasse en statut `active`
- ✅ Consomme **1 siège**
- ✅ Le vendeur peut se reconnecter
- ✅ Tout son historique est intact

**Vérification automatique :**
- ❌ Impossible de réactiver si tous vos sièges sont utilisés
- 💡 Message : "Augmentez votre nombre de sièges pour réactiver ce vendeur"

**Impact sur les crédits IA :**
- Avant : 4 vendeurs actifs → 650 crédits IA
- Après réactivation : 5 vendeurs actifs → 750 crédits IA

---

### 3. Supprimer un vendeur 🔴

**Quand l'utiliser ?**
- Vendeur qui a quitté définitivement l'entreprise
- Fin de contrat
- Licenciement

**Ce qui se passe :**
- ✅ Le vendeur passe en statut `deleted`
- ✅ Libère **1 siège** définitivement
- ✅ Le vendeur ne peut plus se connecter
- ✅ Son historique est conservé en base (soft delete)
- ❌ **Ne peut PAS être réactivé**

**Pourquoi un "soft delete" ?**
- Conserve l'historique des ventes et performances
- Utile pour les statistiques historiques
- Peut être restauré manuellement par support si erreur

---

## 💻 INTERFACE MANAGER

### Où trouver ces fonctionnalités ?

1. **Se connecter** en tant que Manager
2. **Cliquer sur "Mon Équipe"** dans le dashboard
3. **Dans la liste des vendeurs**, chaque ligne a des boutons :

```
┌─────────────────────────────────────────────────────────┐
│ Sophie Durand                                           │
│ sophie.durand@test.com                                  │
│                                                         │
│ [Voir détail] [⏸️ Sommeil] [🗑️ Supprimer]             │
└─────────────────────────────────────────────────────────┘
```

### Boutons disponibles

| Statut vendeur | Boutons disponibles |
|----------------|---------------------|
| **Actif** | ✅ Voir détail<br>🟠 Mettre en sommeil<br>🔴 Supprimer |
| **En sommeil** | ✅ Voir détail<br>🟢 Réactiver |
| **Supprimé** | ℹ️ Visible dans la base mais pas dans l'interface |

---

## 🎨 BADGES VISUELS

Les vendeurs ont maintenant un badge de statut visible :

- **Actif** : Pas de badge (normal)
- **En sommeil** : Badge orange "En sommeil"
- **Supprimé** : Badge rouge "Supprimé" (masqué de la liste par défaut)

---

## 🔧 TECHNIQUE - Backend

### Nouveaux endpoints créés

#### 1. Désactiver un vendeur
```
PUT /api/manager/seller/{seller_id}/deactivate
```

**Réponse :**
```json
{
  "success": true,
  "message": "Vendeur Sophie Durand désactivé avec succès",
  "seller_id": "abc-123",
  "status": "inactive"
}
```

---

#### 2. Réactiver un vendeur
```
PUT /api/manager/seller/{seller_id}/reactivate
```

**Vérifications :**
- Vendeur existe ?
- Vendeur est bien "inactive" ?
- Manager a des sièges disponibles ?

**Erreurs possibles :**
```json
{
  "detail": "Tous vos sièges sont utilisés (5/5). Augmentez votre nombre de sièges pour réactiver ce vendeur."
}
```

---

#### 3. Supprimer un vendeur
```
DELETE /api/manager/seller/{seller_id}
```

**Réponse :**
```json
{
  "success": true,
  "message": "Vendeur Sophie Durand supprimé avec succès",
  "seller_id": "abc-123",
  "status": "deleted"
}
```

---

## 📊 MODÈLE DE DONNÉES

### Champs ajoutés au modèle `User`

```python
class User(BaseModel):
    # ... champs existants ...
    status: str = "active"  # active, inactive, deleted
    deactivated_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None
```

### Statuts possibles

| Statut | Description | Peut se connecter ? | Compte dans sièges ? |
|--------|-------------|---------------------|----------------------|
| `active` | Vendeur actif | ✅ Oui | ✅ Oui |
| `inactive` | En sommeil | ❌ Non | ❌ Non |
| `deleted` | Supprimé | ❌ Non | ❌ Non |

---

## 🔄 IMPACT SUR LES SIÈGES

### Exemple concret

**Situation initiale :**
- Plan Starter : 5 sièges achetés
- 5 vendeurs actifs
- Crédits IA : 250 + (5 × 100) = **750 crédits**

**Action : Mise en sommeil de 2 vendeurs**
- Sièges achetés : 5 (inchangé sur Stripe)
- Vendeurs actifs : 3
- Crédits IA : 250 + (3 × 100) = **550 crédits** (recalculé le mois suivant)
- 💰 Vous continuez à payer pour 5 sièges (Stripe)

**💡 Recommandation :**
Si vous mettez plusieurs vendeurs en sommeil **longue durée**, pensez à **réduire le nombre de sièges** dans votre abonnement pour économiser.

---

## ⚠️ POINTS IMPORTANTS

### 1. Différence entre Sommeil et Suppression

| Critère | Sommeil | Suppression |
|---------|---------|-------------|
| **Réversible** | ✅ Oui | ❌ Non (sauf par support) |
| **Historique** | ✅ Conservé | ✅ Conservé |
| **Connexion** | ❌ Bloquée | ❌ Bloquée |
| **Usage** | Temporaire | Définitif |

### 2. Impact sur la facturation Stripe

⚠️ **IMPORTANT :** Cette fonctionnalité ne modifie PAS automatiquement votre abonnement Stripe.

- **Vous continuez à payer** pour les sièges achetés
- Pour économiser, vous devez manuellement **réduire le nombre de sièges** dans "Mon Abonnement"

**Workflow recommandé :**
1. Mettre les vendeurs en sommeil/supprimer
2. Aller dans "Mon Abonnement"
3. Ajuster le nombre de sièges à la baisse
4. Confirmer la modification

### 3. Confirmations utilisateur

Chaque action demande confirmation avec un message explicite :

**Sommeil :**
```
Mettre Sophie Durand en sommeil ?

Cela libérera un siège mais vous pourrez 
réactiver ce vendeur plus tard.
```

**Suppression :**
```
Supprimer définitivement Sophie Durand ?

Cette action libérera un siège. L'historique 
sera conservé mais le vendeur ne pourra plus 
se connecter.
```

**Réactivation :**
```
Réactiver Sophie Durand ?

Cela consommera un siège disponible.
```

---

## 🧪 POUR TESTER

### Test 1 : Mettre un vendeur en sommeil

1. Connectez-vous : Manager12@test.com
2. Cliquez sur "Mon Équipe"
3. Trouvez "Sophie Durand"
4. Cliquez sur l'icône "⏸️ Pause" (orange)
5. Confirmez
6. ✅ Sophie apparaît avec le badge "En sommeil"
7. ✅ Elle ne peut plus se connecter

### Test 2 : Réactiver un vendeur

1. Dans "Mon Équipe"
2. Trouvez Sophie (badge "En sommeil")
3. Cliquez sur l'icône "▶️ Play" (vert)
4. Confirmez
5. ✅ Sophie redevient active
6. ✅ Elle peut se reconnecter

### Test 3 : Supprimer un vendeur

1. Dans "Mon Équipe"
2. Trouvez un vendeur actif
3. Cliquez sur l'icône "🗑️ Trash" (rouge)
4. Confirmez
5. ✅ Le vendeur disparaît de la liste
6. ✅ Il ne peut plus se connecter

---

## 📋 CHECKLIST DE VALIDATION

- [x] Endpoint `/deactivate` créé
- [x] Endpoint `/reactivate` créé
- [x] Endpoint `/delete` créé
- [x] Champ `status` ajouté au modèle User
- [x] Interface TeamModal mise à jour
- [x] Boutons d'action ajoutés
- [x] Badges de statut visibles
- [x] Confirmations avant actions
- [x] Messages toast de succès/erreur
- [x] Vérification des sièges disponibles
- [x] Exclusion des vendeurs supprimés de la liste
- [x] Backend et frontend compilent sans erreurs

---

## 🚀 PROCHAINES ÉTAPES (optionnel)

### Améliorations futures possibles

1. **Ajustement automatique Stripe**
   - Réduire automatiquement les sièges Stripe lors de suppressions
   - Proposer au manager : "Voulez-vous aussi réduire votre abonnement ?"

2. **Tableau de bord des vendeurs inactifs**
   - Section séparée "Vendeurs en sommeil"
   - Statistiques : "2 vendeurs en sommeil = 200 crédits IA non utilisés"

3. **Notifications**
   - Email au vendeur mis en sommeil
   - Email au vendeur réactivé
   - Alerte manager : "Vendeur X inactif depuis 90 jours, le supprimer ?"

4. **Historique des actions**
   - Log des mises en sommeil/réactivations
   - Qui a fait l'action et quand

---

## ✅ RÉSUMÉ

**Vous pouvez maintenant :**
- 🟠 Mettre vos vendeurs en sommeil temporairement
- 🟢 Les réactiver quand vous voulez
- 🔴 Les supprimer définitivement s'ils partent
- 💰 Libérer des sièges et optimiser vos coûts
- 📊 Garder tout l'historique intact

**Impact sur les crédits IA :**
- Recalculés automatiquement selon les vendeurs actifs
- Formule : 250 + (nombre de vendeurs actifs × 100)

**C'est opérationnel !** 🎉

---

📅 **Date d'implémentation :** 12 janvier 2025  
✅ **Statut :** Production-ready  
🔄 **Version :** 1.0
