# 🚀 Guide d'initialisation de la base de données de production

## 📋 Objectif

Ce guide vous permet d'initialiser automatiquement votre base de données de production avec tous les types de comptes dont vous avez besoin pour piloter votre application.

## ✨ Ce qui sera créé

L'initialisation va créer automatiquement :

| Rôle | Email | Mot de passe | Description |
|------|-------|--------------|-------------|
| **Super Admin** | `admin@retail-coach.fr` | `TestPassword123!` | Accès complet à l'application |
| **Gérant** | `gerant@retail-coach.fr` | `TestPassword123!` | Gestion d'une entreprise avec workspace |
| **IT Admin** | `itadmin@retail-coach.fr` | `TestPassword123!` | Gestion d'un compte enterprise |
| **Manager** | `manager@retail-coach.fr` | `TestPassword123!` | Gestion d'un magasin |
| **Vendeur** | `vendeur@retail-coach.fr` | `TestPassword123!` | Compte vendeur attaché au manager |

## 🎯 Méthode 1 : Initialisation automatique (RECOMMANDÉ)

### Une seule commande pour tout créer :

```bash
curl -X POST "https://retail-coach-1.emergent.host/api/auth/seed-database" \
  -H "Content-Type: application/json" \
  -d '{"secret_token": "Ogou56iACE-LK8rxQ_mjeOasxlk2uZ8b5ldMQMDz2_8"}'
```

### Réponse attendue :

```json
{
  "message": "Base de données initialisée avec succès ! 5 comptes créés.",
  "accounts": [
    {"email": "admin@retail-coach.fr", "role": "super_admin", "password": "TestPassword123!"},
    {"email": "gerant@retail-coach.fr", "role": "gérant", "password": "TestPassword123!"},
    {"email": "itadmin@retail-coach.fr", "role": "it_admin", "password": "TestPassword123!"},
    {"email": "manager@retail-coach.fr", "role": "manager", "password": "TestPassword123!"},
    {"email": "vendeur@retail-coach.fr", "role": "seller", "password": "TestPassword123!"}
  ]
}
```

## 🎯 Méthode 2 : Création manuelle d'un compte spécifique

Si vous voulez créer un compte super admin avec un email personnalisé :

```bash
curl -X POST "https://retail-coach-1.emergent.host/api/auth/create-super-admin" \
  -H "Content-Type: application/json" \
  -d '{
    "secret_token": "Ogou56iACE-LK8rxQ_mjeOasxlk2uZ8b5ldMQMDz2_8",
    "email": "votre-email@exemple.fr",
    "password": "VotreMotDePasse123!",
    "name": "Votre Nom"
  }'
```

## ✅ Connexion après initialisation

1. **Allez sur :** `https://retail-coach-1.emergent.host/`
2. **Choisissez un compte** parmi ceux créés ci-dessus
3. **Connectez-vous** avec l'email et le mot de passe

## 🔐 Sécurité

### Important :
- ⚠️ **Changez les mots de passe** après votre première connexion
- 🔒 Ne partagez JAMAIS le `secret_token`
- 🗑️ Une fois l'initialisation terminée, vous pouvez supprimer ces endpoints du code pour plus de sécurité

### Pour supprimer les endpoints après utilisation :

1. Ouvrez `/app/backend/server.py`
2. Supprimez la section "TEMPORARY ADMIN CREATION ENDPOINT"
3. Redéployez l'application

## 🆘 Dépannage

### ❌ Erreur : "Un utilisateur avec cet email existe déjà"

➡️ **Solution** : Les comptes existent déjà ! Essayez de vous connecter directement.

Si vous avez oublié le mot de passe, vous pouvez réinitialiser en base de données :

```bash
curl -X POST "https://retail-coach-1.emergent.host/api/auth/seed-database" \
  -H "Content-Type: application/json" \
  -d '{"secret_token": "Ogou56iACE-LK8rxQ_mjeOasxlk2uZ8b5ldMQMDz2_8"}'
```

Cela ne créera que les comptes manquants.

### ❌ Erreur : "Token secret invalide"

➡️ **Solution** : Vérifiez que vous avez bien copié le token complet.

### ❌ Erreur 404 ou 502

➡️ **Solution** : Le backend n'est pas démarré. Vérifiez les logs de votre application.

## 📝 Après l'initialisation

Une fois connecté, vous pourrez :

- **Super Admin** : Voir tous les workspaces, gérer toutes les données
- **Gérant** : Gérer votre entreprise, créer des managers et magasins
- **IT Admin** : Gérer votre compte enterprise, utiliser les API d'import en masse
- **Manager** : Gérer votre magasin, ajouter des vendeurs, saisir des KPI
- **Vendeur** : Voir vos performances, recevoir des feedbacks

## 🎨 Créer d'autres types de comptes

### Via l'interface (après connexion) :

- **Gérant** peut créer des **Managers** et leurs magasins
- **Manager** peut inviter des **Vendeurs**
- **IT Admin** peut importer des utilisateurs via API

### Via l'API d'inscription classique :

Pour créer un nouveau compte gérant ou manager :

```bash
curl -X POST "https://retail-coach-1.emergent.host/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "nouveau@exemple.fr",
    "password": "MotDePasse123!",
    "name": "Nouveau Manager",
    "role": "manager",
    "workspace_name": "Ma Nouvelle Entreprise"
  }'
```

## 🔗 URLs importantes

- **Application** : `https://retail-coach-1.emergent.host/`
- **API Documentation** : `/app/ENTERPRISE_API_DOCUMENTATION.md` (pour IT Admin)
- **Guide Import en Masse** : `/app/GUIDE_IMPORT_EN_MASSE.md`

---

✨ **C'est prêt !** Vous pouvez maintenant piloter votre application avec tous les types de comptes.
