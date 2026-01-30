# 🚀 Guide de Déploiement - Retail Performer AI

## Configuration Automatique de la Base de Données

### Compte Admin Automatique

L'application crée **automatiquement** un compte super admin au premier démarrage si aucun utilisateur n'existe dans la base de données.

#### Credentials par Défaut

**Email :** `s.cappuccio@retailperformerai.com`  
**Mot de passe :** `RetailPerformer2025!`

⚠️ **IMPORTANT** : Changez ce mot de passe immédiatement après la première connexion !

---

## Configuration Personnalisée

Vous pouvez personnaliser les credentials de l'admin par défaut via les variables d'environnement :

### Dans `/app/backend/.env` :

```env
# Admin par défaut (créé automatiquement si aucun utilisateur n'existe)
DEFAULT_ADMIN_EMAIL=votre-email@exemple.com
DEFAULT_ADMIN_PASSWORD=VotreMotDePasseSecurise123!
DEFAULT_ADMIN_NAME=Votre Nom
```

---

## Script d'Initialisation

Le script `/app/backend/init_db.py` s'exécute automatiquement au démarrage du backend via l'événement `@app.on_event("startup")`.

### Fonctionnement

1. ✅ Vérifie si des utilisateurs existent dans la base de données
2. ✅ Si aucun utilisateur : crée un compte super admin avec les credentials par défaut
3. ✅ Si des utilisateurs existent : ne fait rien (évite de créer des doublons)

### Logs de Démarrage

Au démarrage, vous verrez dans les logs :

**Si la DB est vide :**
```
INFO - 🔍 Aucun utilisateur trouvé dans la base de données
INFO - 🚀 Création du compte super admin par défaut...
INFO - ✅ Compte super admin créé avec succès !
INFO -    📧 Email: s.cappuccio@retailperformerai.com
INFO -    🔑 Mot de passe: RetailPerformer2025!
INFO -    ⚠️  IMPORTANT: Changez ce mot de passe après la première connexion !
```

**Si la DB contient déjà des utilisateurs :**
```
INFO - ✅ Base de données déjà initialisée (X utilisateur(s) trouvé(s))
```

---

## Variables d'Environnement Requises

### Backend (`/app/backend/.env`)

```env
# MongoDB
MONGO_URL=mongodb://localhost:27017
DB_NAME=retail_performer

# URLs
FRONTEND_URL=https://retailperformerai.com
BACKEND_URL=https://retailperformerai.com

# JWT Secret
JWT_SECRET=your-super-secret-jwt-key-change-this

# Email (Brevo)
BREVO_API_KEY=your-brevo-api-key
SENDER_EMAIL=contact@retailperformerai.com
SENDER_NAME=Retail Performer AI

# Stripe
STRIPE_API_KEY=your-stripe-secret-key
STRIPE_WEBHOOK_SECRET=your-stripe-webhook-secret

# Emergent LLM
EMERGENT_LLM_KEY=your-emergent-llm-key

# API Rate Limiting
API_RATE_LIMIT=600

# Admin par défaut
DEFAULT_ADMIN_EMAIL=s.cappuccio@retailperformerai.com
DEFAULT_ADMIN_PASSWORD=RetailPerformer2025!
DEFAULT_ADMIN_NAME=Super Admin
```

### Frontend (`/app/frontend/.env`)

```env
REACT_APP_BACKEND_URL=https://retailperformerai.com
WDS_SOCKET_PORT=443
REACT_APP_ENABLE_VISUAL_EDITS=false
ENABLE_HEALTH_CHECK=false
```

⚠️ **CRITIQUE** : Ne JAMAIS utiliser d'URLs Emergent (`*.emergent.host` ou `*.emergentagent.com`) dans `REACT_APP_BACKEND_URL` en production. Cela causera des erreurs CORS et empêchera l'application de fonctionner.

---

## Checklist de Déploiement

### Avant le Déploiement

- [ ] Configurer les variables d'environnement dans `.env`
- [ ] Vérifier que `MONGO_URL` pointe vers la bonne base de données
- [ ] **CRITIQUE** : Vérifier que `REACT_APP_BACKEND_URL` = `https://retailperformerai.com` (pas d'URL Emergent !)
- [ ] **CRITIQUE** : Vérifier que `FRONTEND_URL` = `https://retailperformerai.com`
- [ ] (Optionnel) Personnaliser `DEFAULT_ADMIN_EMAIL` et `DEFAULT_ADMIN_PASSWORD`

### Après le Déploiement

- [ ] Vérifier les logs de démarrage pour confirmer la création du compte admin
- [ ] Vider le cache du navigateur et recharger la page
- [ ] Vérifier dans la console (F12) qu'il n'y a pas d'erreurs CORS
- [ ] Se connecter avec les credentials par défaut
- [ ] **Changer immédiatement le mot de passe** dans les paramètres du profil
- [ ] Créer des magasins et inviter des managers/vendeurs
- [ ] Tester l'API d'intégration avec une clé API

---

## Sécurité

### Mots de Passe

Le mot de passe par défaut est hashé avec **bcrypt** avant d'être stocké dans la base de données. Même en cas de fuite de la base de données, les mots de passe restent protégés.

### JWT Secret

⚠️ **Changez absolument** la valeur de `JWT_SECRET` en production. Utilisez une clé aléatoire longue et complexe :

```bash
# Générer une clé JWT sécurisée
openssl rand -base64 32
```

---

## Dépannage

### Erreurs CORS : "Access to XMLHttpRequest has been blocked by CORS policy"

**Cause** : L'URL du backend dans `/app/frontend/.env` est incorrecte.

**Solution** :
1. Ouvrir `/app/frontend/.env`
2. Vérifier que `REACT_APP_BACKEND_URL=https://retailperformerai.com`
3. Redémarrer le frontend : `sudo supervisorctl restart frontend`
4. Vider le cache du navigateur (Ctrl + Shift + Delete)
5. Recharger la page

**Documentation complète** : Voir `/app/CORS_FIX_DOCUMENTATION.md`

### Le compte admin n'a pas été créé

1. Vérifiez les logs du backend : `tail -f /var/log/supervisor/backend.err.log`
2. Vérifiez que la base de données est accessible
3. Vérifiez que `MONGO_URL` et `DB_NAME` sont corrects
4. Redémarrez le backend : `sudo supervisorctl restart backend`

### Mot de passe ne fonctionne pas

1. Vérifiez que vous utilisez le bon mot de passe (défini dans `DEFAULT_ADMIN_PASSWORD`)
2. Vérifiez que le compte existe : 
   ```bash
   python3 /app/backend/init_db.py
   ```
3. Utilisez l'endpoint de réinitialisation si nécessaire (voir `/app/ADMIN_RESET_INSTRUCTIONS.md`)

### Impossible de se connecter au super admin existant

Si vous avez un compte super admin mais ne pouvez pas vous y connecter :

1. Déployez le code le plus récent
2. Utilisez l'endpoint de réinitialisation : 
   ```bash
   curl -X POST "https://retailperformerai.com/api/v1/admin/reset-superadmin?secret=Ogou56iACE-LK8rxQ_mjeOasxlk2uZ8b5ldMQMDz2_8"
   ```
3. Connectez-vous avec les nouvelles credentials

**Documentation complète** : Voir `/app/ADMIN_RESET_INSTRUCTIONS.md`

---

## Support

Pour toute question : **contact@retailperformerai.com**
