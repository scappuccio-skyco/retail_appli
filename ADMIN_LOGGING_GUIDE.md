# Guide des Logs d'Audit - SuperAdmin

**Date**: 27 Novembre 2025  
**Version**: 2.0 (Enrichie)

---

## 📋 Vue d'ensemble

En tant que seul responsable de l'application, vous avez besoin d'une **traçabilité complète** de tout ce qui se passe. Ce document liste TOUTES les actions loguées dans `admin_logs`.

---

## 🔍 Structure d'un Log d'Audit

Chaque log contient maintenant :

```json
{
  "timestamp": "2025-11-27T15:45:23.123Z",
  "admin_id": "abc-123",
  "admin_email": "admin@retailperformer.com",
  "admin_name": "Super Admin",
  "action": "workspace_status_change",
  "workspace_id": "workspace-xyz",
  "details": {
    "workspace_name": "Skyco",
    "old_status": "active",
    "new_status": "suspended"
  }
}
```

---

## 📊 Toutes les Actions Loguées

### **1. Accès & Consultation** 👁️

| Action | Quand ? | Détails inclus |
|--------|---------|----------------|
| `access_superadmin_dashboard` | Accès à l'onglet "Vue d'ensemble" | `view: "stats"` |
| `access_workspaces_list` | Accès à l'onglet "Gestion Workspaces" | `view: "workspaces"` |
| `access_system_logs` | Accès à l'onglet "Logs Système" | `level`, `type`, `hours` (filtres) |
| `access_audit_logs` | Accès à l'onglet "Logs d'audit" | `limit` |

**Pourquoi ?** Tracer qui consulte quoi, quand. Important pour la sécurité.

---

### **2. Gestion des Workspaces** 🏢

| Action | Quand ? | Détails inclus |
|--------|---------|----------------|
| `workspace_status_change` | Suspension/Activation d'un workspace | `workspace_name`, `old_status`, `new_status` |
| `workspace_plan_change` | Changement de plan (trial → starter, etc.) | `workspace_name`, `old_plan`, `new_plan` |
| `workspace_deletion` | Suppression d'un workspace ⚠️ CRITIQUE | `workspace_name`, `workspace_id` |

**Pourquoi ?** Tracer toutes les modifications impactant les clients.

---

### **3. Gestion des Super Admins** 👑

| Action | Quand ? | Détails inclus |
|--------|---------|----------------|
| `add_super_admin` | Ajout d'un nouveau super admin | `new_admin_email`, `new_admin_name`, `temp_password_generated: true` |
| `remove_super_admin` | Retrait d'un super admin | `removed_admin_email`, `removed_admin_name`, `removed_admin_id` |

**Pourquoi ?** Sécurité maximale - qui a accès aux pouvoirs d'admin.

---

### **4. Actions Sensibles (À venir si besoin)** ⚠️

Ces actions DEVRAIENT être loguées (vous pouvez me demander de les ajouter) :

| Action | Pourquoi c'est important |
|--------|--------------------------|
| `view_workspace_data` | Consulter les données d'un workspace |
| `modify_workspace_credits` | Changer les crédits IA |
| `export_data` | Export de données (RGPD) |
| `reset_password` | Réinitialisation mot de passe utilisateur |
| `impersonate_user` | Se connecter en tant qu'utilisateur |

---

## 🎯 Comment Utiliser Ces Logs

### **1. Audit de Sécurité Mensuel** 🔐

Vérifiez chaque mois :
- Qui a accédé au SuperAdmin ?
- Combien de workspaces ont été modifiés ?
- Y a-t-il des actions suspectes (ex: 10 suppressions d'affilée) ?

**Requête MongoDB** :
```javascript
db.admin_logs.find({
  timestamp: { $gte: "2025-11-01" },
  action: { $in: ["workspace_deletion", "remove_super_admin"] }
})
```

---

### **2. Support Client** 💬

Client : "Mon compte a été suspendu sans raison"

**Recherche** :
```javascript
db.admin_logs.find({
  workspace_id: "workspace-xyz",
  action: "workspace_status_change"
}).sort({ timestamp: -1 })
```

**Résultat** : "Suspendu le 15/11 à 14:32 par admin@retailperformer.com pour non-paiement"

---

### **3. Conformité RGPD** ⚖️

Si un utilisateur demande : "Qui a accédé à mes données ?"

**Recherche** :
```javascript
db.admin_logs.find({
  workspace_id: "workspace-xyz",
  action: { $regex: "access|view" }
})
```

---

### **4. Analyse d'Activité** 📊

**Questions que vous pouvez répondre** :
- Combien de workspaces j'ai suspendus ce mois-ci ?
- Combien de fois j'ai changé des plans ?
- Y a-t-il des patterns (ex: suspensions le vendredi) ?

---

## 📈 Métriques Automatiques (Déjà implémentées)

Dans l'onglet "Logs d'audit" du SuperAdmin, vous voyez :
- ✅ Les 100 dernières actions
- ✅ Timestamp précis (à la seconde)
- ✅ Email de l'admin
- ✅ Type d'action
- ✅ Détails complets

---

## 🔔 Alertes Recommandées (Optionnel)

Si vous voulez être notifié en temps réel :

| Alerte | Condition | Email ? |
|--------|-----------|---------|
| Suppression de workspace | `action = workspace_deletion` | ✅ Oui |
| Ajout de super admin | `action = add_super_admin` | ✅ Oui |
| > 10 actions en 5 min | Suspect (bot ?) | ✅ Oui |

**Voulez-vous que j'implémente un système d'alertes par email ?**

---

## 🗂️ Rétention des Données

**Actuellement** : Les logs restent indéfiniment dans MongoDB.

**Recommandation** :
- **Logs d'audit** : Garder 2 ans (conformité)
- **Logs système** : Garder 30 jours (debug)

**Nettoyage automatique à implémenter ?** Dites-moi si vous voulez un script de cleanup.

---

## 📝 Actions NON Loguées (par design)

Ces actions ne sont PAS loguées car peu critiques :
- Rafraîchir la page
- Navigation entre onglets (sauf premier accès)
- Lecture de statistiques anonymisées

---

## 🔧 Comment Ajouter Plus de Logs ?

Si vous voulez logger une nouvelle action, utilisez la fonction helper :

```python
await log_admin_action(
    admin=current_admin,
    action="nom_de_l_action",
    workspace_id="workspace-123",  # Optionnel
    details={
        "key": "value",
        "other_info": "something"
    }
)
```

---

## 🎯 Résumé pour Vous

**En tant que seul gestionnaire, vous avez maintenant** :

✅ **Traçabilité complète** de qui fait quoi  
✅ **Preuve légale** en cas de litige  
✅ **Détection d'abus** (actions suspectes)  
✅ **Support client facilité** (historique clair)  
✅ **Conformité RGPD** (accès aux données tracé)  

**Tous les logs sont consultables** dans l'onglet "Logs d'audit" du SuperAdmin Dashboard.

---

## 📞 Questions Fréquentes

**Q: Puis-je supprimer des logs ?**  
R: Oui, via MongoDB directement, mais déconseillé (conformité)

**Q: Les logs sont-ils chiffrés ?**  
R: Non, mais stockés dans MongoDB avec accès restreint

**Q: Quelle taille occupent les logs ?**  
R: ~1KB par log. 10,000 logs = 10MB (négligeable)

**Q: Puis-je exporter les logs ?**  
R: Oui, via une requête MongoDB ou un script Python

---

**Document créé le** : 27 Novembre 2025  
**Dernière mise à jour** : 27 Novembre 2025  
**Contact** : Agent E1
