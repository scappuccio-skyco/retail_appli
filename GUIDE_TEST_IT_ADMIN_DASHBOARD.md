# 🧪 Guide de test - Dashboard IT Admin

## 📝 Credentials disponibles

### Compte 1 - Test Enterprise Corp
- **Email :** `itadmin@testenterprise.com`
- **Mot de passe :** `TestPassword123!`
- **Entreprise :** Test Enterprise Corp

### Compte 2 - Demo Enterprise (fraîchement créé)
- **Email :** `admin@demo-enterprise.com`
- **Mot de passe :** `DemoPassword123!`
- **Entreprise :** Demo Enterprise

---

## 🚀 Instructions de test

### Étape 1 : Se connecter

1. Ouvrez votre navigateur et allez sur : `http://localhost:3000/login`
2. Entrez l'email : `admin@demo-enterprise.com`
3. Entrez le mot de passe : `DemoPassword123!`
4. Cliquez sur "Se connecter"

**Note :** Après la connexion, vous serez redirigé vers `/dashboard`. C'est normal car le système ne détecte pas encore automatiquement le role IT Admin.

### Étape 2 : Accéder au Dashboard IT Admin

**Manuellement :** Allez directement sur `http://localhost:3000/it-admin`

Vous devriez voir le Dashboard IT Admin avec 4 onglets.

---

## 🧪 Scénarios de test

### Test 1 : Vue d'ensemble (Overview)

**Ce que vous devriez voir :**
- 📊 3 cards avec statistiques :
  - **Utilisateurs** : 1 utilisateur (Admin Demo)
  - **Magasins** : 2 magasins (importés via API)
  - **Synchronisation** : Status "success" ou "never"
- 📋 Configuration de synchronisation :
  - Mode : API
  - Entreprise : Demo Enterprise
  - SCIM activé : Non
- 📝 Activité récente (si des imports ont été faits)

**Actions à tester :**
- Vérifier que les compteurs affichent les bonnes valeurs
- Vérifier que la date de dernière sync est correcte

---

### Test 2 : Clés API

**Ce que vous devriez voir :**
- Si aucune clé : Message "Aucune clé API" avec bouton "Générer une clé"
- Si clés existantes : Liste des clés avec preview `ent_***abc123`

**Actions à tester :**

#### A. Générer une nouvelle clé
1. Cliquez sur "Générer une clé"
2. Remplissez le formulaire :
   - **Nom :** "Test API Key"
   - **Expiration :** 365 jours
   - **Permissions :** Cochez toutes les cases
3. Cliquez sur "Générer la clé"
4. **Attendu :**
   - Modal affiche la clé complète `ent_xxxxxxxxx...`
   - Bouton "Copier" pour copier la clé
   - Warning "⚠️ Sauvegardez cette clé maintenant"
5. Cliquez sur "Copier" puis "Fermer"
6. **Vérification :** La nouvelle clé apparaît dans la liste

#### B. Consulter une clé existante
- Vérifiez les informations :
  - Nom de la clé
  - Date de création
  - Dernière utilisation
  - Nombre de requêtes
  - Permissions (scopes)

#### C. Révoquer une clé
1. Cliquez sur l'icône 🗑️ (poubelle)
2. Confirmez la révocation
3. **Attendu :** La clé passe en status "Révoquée"

---

### Test 3 : Logs de synchronisation

**Ce que vous devriez voir :**
- Tableau avec colonnes : Statut, Opération, Type, Date
- Logs des imports effectués précédemment :
  - `user_created` avec status ✅ Succès
  - `store_created` avec status ✅ Succès
  - `bulk_user_import` avec status ✅ Succès

**Actions à tester :**
- Vérifier que les dates sont formatées correctement
- Vérifier que les statuts sont corrects (vert = succès, rouge = échec)

---

### Test 4 : Configuration

**Ce que vous devriez voir :**
- Nom de l'entreprise : "Demo Enterprise" (lecture seule)
- Email de contact : "contact@demo-enterprise.com" (lecture seule)
- Mode de synchronisation : "API" (lecture seule)
- Section bleue avec lien vers la documentation

**Actions à tester :**
- Vérifier que tous les champs sont grisés (non modifiables)
- Cliquer sur "Voir la documentation" (devrait ouvrir `/ENTERPRISE_API_DOCUMENTATION.md`)

---

## 🔧 Tests avancés avec API

### Test 5 : Import en masse via clé API

Une fois que vous avez généré une clé API, testez l'import :

```bash
API_KEY="ent_votre_cle_generee"

# Import d'un utilisateur
curl -X POST http://localhost:8001/api/enterprise/users/bulk-import \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "create_or_update",
    "send_invitations": false,
    "users": [
      {
        "email": "test.user@demo-enterprise.com",
        "name": "Test User",
        "role": "manager",
        "external_id": "ERP-USER-001"
      }
    ]
  }'
```

**Attendu :** 
- Réponse JSON avec `"success": true`
- Le log apparaît dans l'onglet "Logs de synchronisation"
- Le compteur "Utilisateurs" augmente dans l'onglet "Vue d'ensemble"

---

## ✅ Checklist de validation

- [ ] Login avec compte IT Admin fonctionne
- [ ] Redirection vers `/it-admin` (manuelle pour l'instant)
- [ ] **Onglet Overview** : Cards stats affichées correctement
- [ ] **Onglet Clés API** : Génération de clé fonctionne
- [ ] **Onglet Clés API** : Copie de clé dans presse-papiers fonctionne
- [ ] **Onglet Clés API** : Révocation de clé fonctionne
- [ ] **Onglet Logs** : Tableau des logs affiché
- [ ] **Onglet Config** : Champs entreprise affichés (readonly)
- [ ] **Modal génération** : Avertissement "sauvegarder la clé" visible
- [ ] **Import API** : Test avec clé générée fonctionne
- [ ] **Logs mis à jour** : Nouveau log apparaît après import

---

## 🐛 Problèmes connus

### 1. Redirection automatique après login
**Problème :** Après login, redirige vers `/dashboard` au lieu de `/it-admin`

**Solution temporaire :** Aller manuellement sur `http://localhost:3000/it-admin`

**Fix permanent (à faire) :** Le code de redirection dans `App.js` est correct, mais il semble que `window.location.href = '/dashboard'` soit exécuté après la vérification du rôle. Il faudrait remplacer par `navigate()` au lieu de `window.location.href`.

### 2. Données de test vides
**Problème :** Si le compte IT Admin n'a pas encore importé d'utilisateurs/magasins, les compteurs seront à 0.

**Solution :** Importer des données de test via les endpoints bulk-import (voir Test 5 ci-dessus).

---

## 📞 Support

Si vous rencontrez des problèmes :

1. Vérifiez les logs backend : `tail -f /var/log/supervisor/backend.err.log`
2. Vérifiez les logs frontend : `tail -f /var/log/supervisor/frontend.err.log`
3. Testez les endpoints directement avec curl pour valider le backend
4. Utilisez la console développeur du navigateur (F12) pour voir les erreurs JS

---

## 🎯 Résumé rapide

**Login rapide :**
```
Email: admin@demo-enterprise.com
Mot de passe: DemoPassword123!
URL: http://localhost:3000/login
Dashboard: http://localhost:3000/it-admin
```

**Test clé API :**
1. Onglet "Clés API" → "Générer une clé"
2. Copier la clé générée
3. Tester avec curl (voir Test 5)
4. Vérifier dans onglet "Logs"

Bon test ! 🚀
