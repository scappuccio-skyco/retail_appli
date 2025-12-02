# Instructions pour créer un compte Super Admin en Production

## 🎯 Objectif
Ce guide vous permet de créer un compte **super_admin** sur votre application en production.

## 📋 Prérequis
- Accès à un terminal ou un outil comme Postman/curl
- Le token secret: `Ogou56iACE-LK8rxQ_mjeOasxlk2uZ8b5ldMQMDz2_8`

## 🚀 Méthode 1 : Via curl (Recommandé)

### Créer le compte super admin

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

**Remplacez :**
- `votre-email@exemple.fr` par votre email réel
- `VotreMotDePasse123!` par un mot de passe sécurisé
- `Votre Nom` par votre nom complet

### Exemple de réponse réussie

```json
{
  "message": "Super admin créé avec succès",
  "user": {
    "id": "abc-123-xyz",
    "email": "votre-email@exemple.fr",
    "name": "Votre Nom",
    "role": "super_admin"
  },
  "token": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}
```

## 🚀 Méthode 2 : Via Postman

1. **Créer une nouvelle requête POST**
2. **URL :** `https://retail-coach-1.emergent.host/api/auth/create-super-admin`
3. **Headers :**
   - `Content-Type: application/json`
4. **Body (raw JSON) :**
   ```json
   {
     "secret_token": "Ogou56iACE-LK8rxQ_mjeOasxlk2uZ8b5ldMQMDz2_8",
     "email": "votre-email@exemple.fr",
     "password": "VotreMotDePasse123!",
     "name": "Votre Nom"
   }
   ```

## ✅ Connexion après création

Une fois le compte créé, vous pouvez vous connecter via :

**URL :** `https://retail-coach-1.emergent.host/`

**Identifiants :**
- Email : celui que vous avez utilisé
- Mot de passe : celui que vous avez choisi

## 🔒 Sécurité

⚠️ **IMPORTANT :**
- Ne partagez JAMAIS le `secret_token` publiquement
- Ce token est stocké dans la variable d'environnement `ADMIN_CREATION_SECRET`
- Une fois que vous avez créé votre compte admin, vous pouvez désactiver cet endpoint en supprimant le code correspondant du fichier `server.py`

## 🆘 En cas de problème

### Erreur : "Un utilisateur avec cet email existe déjà"
➡️ L'email est déjà utilisé. Choisissez un autre email.

### Erreur : "Token secret invalide"
➡️ Vérifiez que vous avez bien copié le token complet et correct.

### Erreur 404 ou 502
➡️ Vérifiez que l'application backend est bien démarrée en production.

## 📝 Notes
- Cet endpoint est **temporaire** et sécurisé
- Il n'est accessible qu'avec le token secret
- Vous pouvez l'utiliser autant de fois que nécessaire pour créer plusieurs comptes admin
- Après avoir créé votre/vos compte(s) admin, considérez supprimer cet endpoint pour plus de sécurité
