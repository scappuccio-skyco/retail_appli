# 🔑 Instructions de Réinitialisation du Compte Super Admin

## Contexte
Vous avez un compte super_admin existant (`admin@retail-coach.fr`) mais vous n'avez pas le mot de passe et l'adresse email n'est pas valide.

## Solution Mise en Place
Un endpoint sécurisé temporaire a été créé pour mettre à jour les credentials du compte super_admin existant.

## 📋 Étapes à Suivre

### 1. Déployer le Code Mis à Jour
Assurez-vous que le code le plus récent est déployé sur votre environnement de production.

### 2. Exécuter la Commande de Réinitialisation

Exécutez cette commande curl pour mettre à jour votre compte super_admin :

```bash
curl -X POST "https://retailperformerai.com/api/v1/admin/reset-superadmin?secret=Ogou56iACE-LK8rxQ_mjeOasxlk2uZ8b5ldMQMDz2_8"
```

**Réponse attendue (succès) :**
```json
{
  "success": true,
  "message": "Super admin credentials updated successfully",
  "old_email": "admin@retail-coach.fr",
  "new_email": "s.cappuccio@retailperformerai.com",
  "new_password": "Check DEFAULT_ADMIN_PASSWORD in environment"
}
```

### 3. Se Connecter avec les Nouvelles Credentials

Après avoir exécuté la commande avec succès, connectez-vous à votre application avec :

**📧 Email :** `s.cappuccio@retailperformerai.com`  
**🔐 Mot de passe :** `RetailPerformer2025!`

## ⚠️ Important

- **Secret de Sécurité** : L'endpoint est protégé par le `ADMIN_CREATION_SECRET` de votre fichier `.env`
- **Usage Temporaire** : Cet endpoint est temporaire et peut être supprimé après utilisation
- **Une Seule Fois** : Vous n'avez besoin d'exécuter cette commande qu'une seule fois

## 🔍 En Cas de Problème

Si la commande échoue, vérifiez :

1. **Le déploiement est à jour** : Le code le plus récent doit être déployé
2. **L'URL est correcte** : `https://retailperformerai.com` (sans `/api` au début)
3. **Le secret est correct** : Le secret dans la commande doit correspondre à `ADMIN_CREATION_SECRET` dans `.env`

## 📊 Informations Techniques

- **Endpoint créé** : `POST /api/v1/admin/reset-superadmin`
- **Fichier modifié** : `/app/backend/server.py`
- **Ce qui est mis à jour** :
  - Email : `admin@retail-coach.fr` → `s.cappuccio@retailperformerai.com`
  - Mot de passe : Réinitialisé vers `RetailPerformer2025!`
  - Nom : Mis à jour vers `Super Admin`

## 📝 Prochaines Étapes Après Connexion Réussie

1. ✅ Vérifier que vous avez accès au dashboard super_admin
2. ✅ Vérifier que toutes les fonctionnalités admin sont accessibles
3. ✅ Optionnel : Changer votre mot de passe depuis les paramètres du profil
4. ✅ Informer l'agent que la connexion fonctionne pour continuer avec les autres tâches

---

**Date de création** : 9 décembre 2025  
**Agent** : E1 (Fork Agent)
