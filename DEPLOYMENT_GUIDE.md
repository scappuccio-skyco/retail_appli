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

# Admin par défaut
DEFAULT_ADMIN_EMAIL=s.cappuccio@retailperformerai.com
DEFAULT_ADMIN_PASSWORD=RetailPerformer2025!
DEFAULT_ADMIN_NAME=Super Admin
```

### Frontend (`/app/frontend/.env`)

```env
REACT_APP_BACKEND_URL=https://retailperformerai.com
```

---

## Checklist de Déploiement

### Avant le Déploiement

- [ ] Configurer les variables d'environnement dans `.env`
- [ ] Vérifier que `MONGO_URL` pointe vers la bonne base de données
- [ ] Configurer `FRONTEND_URL` et `REACT_APP_BACKEND_URL` avec le bon domaine
- [ ] (Optionnel) Personnaliser `DEFAULT_ADMIN_EMAIL` et `DEFAULT_ADMIN_PASSWORD`

### Après le Déploiement

- [ ] Vérifier les logs de démarrage pour confirmer la création du compte admin
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
3. Réinitialisez le mot de passe manuellement si nécessaire

---

## Support

Pour toute question : **contact@retailperformerai.com**
