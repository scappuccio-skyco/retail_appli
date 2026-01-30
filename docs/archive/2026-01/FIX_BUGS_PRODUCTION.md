# 🐛 FIX - Bugs de production

**Date**: 2 Décembre 2024  
**Bugs identifiés par l'utilisateur**

---

## Bug 1 : Inscription redirige vers Manager au lieu de Gérant

### Problème
Lors de la création d'un compte, l'utilisateur arrivait sur le dashboard Manager au lieu du dashboard Gérant.

### Cause
Le champ `role` était **required** dans le modèle `UserCreate` (Pydantic), mais le frontend ne l'envoyait plus après nos modifications.

Le backend essayait de forcer `user_data.role = "gérant"`, mais la validation Pydantic échouait avant avec une erreur "Field required".

### Solution
Rendu le champ `role` **optionnel** dans le modèle `UserCreate` :

```python
class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: Optional[str] = None  # ← OPTIONNEL maintenant
    manager_id: Optional[str] = None
    workspace_name: Optional[str] = None
```

### Fichier modifié
- `/app/backend/server.py` ligne 386

### Test
```bash
curl -X POST "http://localhost:8001/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPass123!",
    "name": "Test User",
    "workspace_name": "Test Company"
  }'

# Response: { "user": { "role": "gérant", ... } }
```

---

## Bug 2 : Bouton "Invitateur" toujours visible dans Manager Dashboard

### Problème
Le bouton "Invitateur" était toujours présent dans le dashboard Manager, alors qu'on l'avait supprimé.

### Cause probable
- Cache du navigateur
- OU déploiement pas encore effectué avec les modifications
- OU fichier non sauvegardé correctement

### Solution déjà appliquée (à vérifier en production)
Le bouton a été supprimé dans :
- `/app/frontend/src/pages/ManagerDashboard.js` ligne ~795

Code actuel :
```javascript
// REMOVED: Only gerant can invite - managers cannot invite sellers
<button /* Le bouton n'existe plus */
```

### Vérification à faire après redéploiement
1. Vider le cache (Ctrl+Shift+R)
2. Se connecter en tant que Manager
3. Le bouton "Invitateur" ne doit PAS être visible

---

## Bug 3 : Workspaces supprimés toujours visibles dans SuperAdmin

### Problème
Dans le dashboard SuperAdmin, les workspaces supprimés restaient visibles dans la liste, rendant difficile la gestion.

### Solution
Ajout d'un **filtre toggle** pour masquer/afficher les workspaces supprimés.

### Modifications
**Fichier** : `/app/frontend/src/pages/SuperAdminDashboard.js`

#### 1. Ajout d'un état pour le filtre
```javascript
const [showDeletedWorkspaces, setShowDeletedWorkspaces] = useState(false);
```

#### 2. Ajout d'une checkbox de contrôle
```javascript
<div className="flex items-center justify-between mb-6">
  <h2 className="text-2xl font-bold text-white">Gestion des Workspaces</h2>
  <label className="flex items-center gap-2 text-purple-200 cursor-pointer">
    <input
      type="checkbox"
      checked={showDeletedWorkspaces}
      onChange={(e) => setShowDeletedWorkspaces(e.target.checked)}
      className="w-4 h-4 rounded border-purple-300"
    />
    <span>Afficher les workspaces supprimés</span>
  </label>
</div>
```

#### 3. Filtrage de la liste
```javascript
{workspaces
  .filter(workspace => showDeletedWorkspaces || workspace.subscription?.status !== 'deleted')
  .map((workspace) => (
    // Affichage du workspace
  ))
}
```

### Comportement
- **Par défaut** : Les workspaces supprimés sont **masqués**
- **Avec checkbox cochée** : Tous les workspaces sont visibles (y compris supprimés)

### Test
1. Aller dans SuperAdmin → Workspaces
2. Par défaut, les workspaces supprimés ne sont pas affichés
3. Cocher "Afficher les workspaces supprimés"
4. Les workspaces avec status "deleted" apparaissent

---

## 🚀 Déploiement

Pour appliquer ces corrections en production :

1. **Redéployer l'application**
   ```bash
   # Via Emergent platform
   ```

2. **Vider le cache du navigateur**
   ```
   Ctrl + Shift + R (Windows/Linux)
   Cmd + Shift + R (Mac)
   ```

3. **Tester les corrections**
   - Créer un nouveau compte → Doit arriver sur Gérant Dashboard
   - Se connecter en tant que Manager → Pas de bouton "Invitateur"
   - SuperAdmin → Workspaces supprimés masqués par défaut

---

## ✅ Checklist de validation

Après redéploiement :

- [ ] Inscription → Redirige vers Gérant Dashboard
- [ ] Manager Dashboard → Pas de bouton "Invitateur"
- [ ] SuperAdmin → Filtre workspaces supprimés fonctionne
- [ ] Cache navigateur vidé
- [ ] Tests avec compte fraîchement créé

---

**Status** : ✅ Corrections appliquées en local  
**À faire** : Redéployer en production
