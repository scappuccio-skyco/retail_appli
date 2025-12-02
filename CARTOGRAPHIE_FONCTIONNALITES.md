# 📊 CARTOGRAPHIE COMPLÈTE DES FONCTIONNALITÉS
## Retail Performer AI - Audit Complet

**Date**: 2 Décembre 2024  
**Version**: 1.0  
**Objectif**: Documentation exhaustive pour création d'onboarding personnalisé

---

## 🎯 RÉSUMÉ EXÉCUTIF

L'application Retail Performer AI est une plateforme SaaS complexe avec **5 rôles utilisateurs distincts**, chacun ayant son propre dashboard et ensemble de fonctionnalités.

### Statistiques globales
- **5 dashboards** principaux
- **56+ modals** différents
- **20+ handlers** de fonctions métier
- **Intégrations**: Stripe, OpenAI, Brevo (emails)

---

# 1️⃣ GÉRANT DASHBOARD

## 🎭 Rôle et responsabilités
Le **Gérant** est le pilote central de l'entreprise. Il a un contrôle total sur la structure organisationnelle.

## 📋 Fonctionnalités principales

### A. Gestion des magasins
- ✅ **Créer un magasin** (CreateStoreModal)
  - Nom, adresse, configuration
  - Affectation automatique au workspace
- ✅ **Consulter détails magasin** (StoreDetailModal)
  - Performances, équipe, KPI
  - Historique
- ✅ **Supprimer un magasin** (DeleteStoreConfirmation)
  - Avec confirmation
  - Suppression en cascade du personnel

### B. Gestion du personnel
- ✅ **Inviter du personnel** (InviteStaffModal)
  - Managers : assignation à un magasin
  - Vendeurs : assignation à un magasin + optionnel manager
  - Génération de lien d'invitation
  - Envoi automatique d'email
- ✅ **Transférer un manager** (ManagerTransferModal)
  - D'un magasin à un autre
  - Mise à jour automatique de l'équipe
- ✅ **Transférer un vendeur** (SellerTransferModal)
  - Changement de magasin
  - Changement de manager
- ✅ **Vue d'ensemble du personnel** (StaffOverview)
  - Liste complète managers et vendeurs
  - Statuts, performances
  - Actions rapides

### C. Statistiques et analyses
- ✅ **Statistiques globales**
  - Nombre total de magasins
  - Nombre total de managers
  - Nombre total de vendeurs
  - CA total, taux de conversion global
- ✅ **Classement des magasins**
  - Par période (semaine, mois, année)
  - Navigation temporelle (précédent/suivant)
  - Métriques : CA, conversions, paniers moyens
- ✅ **Cartes de performance par magasin**
  - Indicateurs clés (semaine passée)
  - Évolution vs période précédente
  - Accès rapide aux détails

### D. Gestion d'abonnement
- ✅ **Consulter l'abonnement** (SubscriptionModal)
  - Plan actuel, nombre de sièges
  - Consommation IA
  - Historique de facturation
- ✅ **Modifier l'abonnement**
  - Upgrade/downgrade
  - Ajout de sièges
  - Gestion via Stripe

### E. API et intégrations (Vue Enterprise)
- ✅ **Gestion des clés API** (APIKeysManagement)
  - Génération de clés
  - Révocation
  - Limites de taux
  - Logs d'utilisation
- ✅ **Import en masse**
  - Managers via API
  - Vendeurs via API
  - Synchronisation de données

### F. Navigation et vues
- **Vue Dashboard** : Vue d'ensemble + stats
- **Vue Personnel** : Gestion complète du staff
- **Vue API** : Pour clients enterprise

---

# 2️⃣ MANAGER DASHBOARD

## 🎭 Rôle et responsabilités
Le **Manager** gère son magasin et son équipe de vendeurs. Il consulte, analyse et optimise les performances.

## 📋 Fonctionnalités principales

### A. Gestion de l'équipe
- ✅ **Vue d'ensemble de l'équipe** (TeamModal)
  - Liste des vendeurs
  - Statuts (actif, suspendu)
  - Performances individuelles
- ✅ **Détails vendeur** (SellerDetailView)
  - KPI détaillés
  - Historique de performances
  - Diagnostic de compétences
  - Coaching et recommandations IA

### B. KPI et performances
- ✅ **Configuration des KPI** (KPIConfigModal)
  - Définir les KPI suivis
  - Objectifs personnalisés
  - Poids et priorités
- ✅ **Saisie KPI magasin** (StoreKPIModal)
  - KPI quotidiens du magasin
  - Comparaison avec objectifs
- ✅ **Historique KPI**
  - Évolutions temporelles
  - Graphiques et tendances

### C. Coaching et IA
- ✅ **Bilan d'équipe IA** (TeamBilanIA)
  - Analyse globale de l'équipe
  - Points forts et axes d'amélioration
  - Recommandations personnalisées par vendeur
- ✅ **Bilan individuel** (TeamBilanModal)
  - Consultation des bilans IA passés
  - Historique des analyses

### D. Diagnostic et profil
- ✅ **Diagnostic manager** (ManagerDiagnosticForm)
  - Auto-évaluation de compétences
  - Identification des forces/faiblesses
- ✅ **Profil manager** (ManagerProfileModal)
  - Informations personnelles
  - Préférences
  - Historique

### E. Objectifs et challenges
- ✅ **Gestion des objectifs**
  - Définir objectifs d'équipe
  - Suivi de progression
  - Alertes
- ✅ **Challenges actifs**
  - Challenges en cours
  - Classements
  - Récompenses

### F. Gestion des relations
- ✅ **Relations interpersonnelles** (RelationshipManagementModal)
  - Dynamique d'équipe
  - Conflits potentiels
  - Suggestions de team building

### G. Paramètres
- ✅ **Paramètres magasin** (ManagerSettingsModal)
  - Notifications
  - Préférences d'affichage
  - Configuration IA

### H. Mode de synchronisation
- ✅ **Badge Sync Mode** (SyncModeBadge)
  - Indique si données en mode API ou manuel
  - Lecture seule si sync API

---

# 3️⃣ VENDEUR DASHBOARD

## 🎭 Rôle et responsabilités
Le **Vendeur** saisit ses KPI quotidiens, consulte ses performances et reçoit du coaching IA.

## 📋 Fonctionnalités principales

### A. Diagnostic de compétences
- ✅ **Formulaire diagnostic** (DiagnosticFormScrollable)
  - Questions sur compétences retail
  - Identification profil vendeur
  - Recommandations initiales
- ✅ **Consultation diagnostic** (showDiagnosticModal)
  - Résultats détaillés
  - Profil de compétences
  - Comparaison avec équipe

### B. Saisie quotidienne
- ✅ **Saisie KPI** (KPIEntryModal)
  - KPI quotidiens (CA, nb ventes, panier moyen, etc.)
  - Validation automatique
  - Sauvegarde
- ✅ **Historique KPI** (KPIHistoryModal)
  - Consultation des saisies passées
  - Modification si autorisé
  - Graphiques d'évolution

### C. Performances et analyses
- ✅ **Dashboard de performances** (PerformanceModal)
  - Indicateurs clés
  - Évolution temporelle
  - Comparaison avec objectifs
  - Classement dans l'équipe
- ✅ **Bilan individuel IA** (BilanIndividuelModal)
  - Analyse IA personnalisée
  - Points forts
  - Axes d'amélioration
  - Plan d'action

### D. Coaching et feedback
- ✅ **Coaching IA** (CoachingModal)
  - Recommandations personnalisées
  - Conseils tactiques
  - Ressources de formation
- ✅ **Débriefing** (DebriefModal)
  - Compte-rendu de journée
  - Réflexion guidée
  - Apprentissages
- ✅ **Historique débriefs** (DebriefHistoryModal)
  - Consultation des débriefs passés
  - Progression dans le temps

### E. Objectifs et challenges
- ✅ **Mes objectifs** (ObjectivesModal)
  - Objectifs personnels
  - Objectifs d'équipe
  - Progression
- ✅ **Challenge quotidien** (DailyChallengeModal)
  - Challenge du jour
  - Règles et récompenses
  - Participation
- ✅ **Historique challenges** (ChallengeHistoryModal)
  - Challenges passés
  - Performances
  - Récompenses gagnées

### F. Évaluations
- ✅ **Évaluation manager** (EvaluationModal)
  - Feedback du manager
  - Notes sur critères
  - Commentaires
- ✅ **Historique évaluations**
  - Évolution des évaluations
  - Tendances

### G. Profil et paramètres
- ✅ **Profil vendeur** (SellerProfileModal)
  - Informations personnelles
  - Photo
  - Préférences
- ✅ **Explications compétences** (CompetencesExplicationModal)
  - Aide contextuelle
  - Définitions
  - Exemples

---

# 4️⃣ IT ADMIN DASHBOARD

## 🎭 Rôle et responsabilités
L'**IT Admin** gère le compte enterprise, les intégrations API et la synchronisation de données.

## 📋 Fonctionnalités principales

### A. Gestion des clés API
- ✅ **Génération de clés**
  - Créer nouvelle clé API
  - Définir permissions
  - Configurer rate limits
- ✅ **Gestion des clés existantes**
  - Liste de toutes les clés
  - Statut (active, révoquée)
  - Date d'expiration
  - Dernière utilisation
- ✅ **Révocation de clés**
  - Désactivation immédiate
  - Raison de révocation

### B. Synchronisation de données
- ✅ **Vue d'ensemble sync**
  - Statut de synchronisation
  - Dernière sync
  - Erreurs éventuelles
- ✅ **Logs de synchronisation**
  - Historique des syncs
  - Détails des opérations
  - Erreurs et résolutions

### C. Import en masse
- ✅ **API REST pour imports**
  - Endpoint utilisateurs
  - Endpoint magasins
  - Validation des données
- ✅ **Statut des imports**
  - Imports en cours
  - Succès/échecs
  - Rapports détaillés

### D. Configuration enterprise
- ✅ **Paramètres du compte**
  - Nom de l'entreprise
  - Mode de synchronisation (API/manuel)
  - Préférences globales

---

# 5️⃣ SUPER ADMIN DASHBOARD

## 🎭 Rôle et responsabilités
Le **Super Admin** a une vue globale sur tous les workspaces et gère la plateforme.

## 📋 Fonctionnalités principales

### A. Gestion des workspaces
- ✅ **Liste de tous les workspaces**
  - Nom, propriétaire
  - Plan d'abonnement
  - Statut (actif, trial, suspendu)
  - Nombre d'utilisateurs
- ✅ **Modification de statut**
  - Activer/suspendre workspace
  - Prolonger trial
  - Forcer upgrade

### B. Gestion des abonnements
- ✅ **Vue Stripe** (StripeSubscriptionsView)
  - Tous les abonnements Stripe
  - Statuts de paiement
  - Revenus
- ✅ **Modification de plans**
  - Changer le plan d'un workspace
  - Ajuster le nombre de sièges
  - Remboursements

### C. Gestion des utilisateurs
- ✅ **Gestion des admins** (AdminManagement)
  - Liste de tous les super admins
  - Créer/supprimer admin
  - Permissions
- ✅ **Gestion des trials** (TrialManagement)
  - Workspaces en trial
  - Extensions
  - Conversions

### D. Gestion des invitations
- ✅ **Vue globale** (InvitationsManagement)
  - Toutes les invitations
  - Statuts
  - Resend

### E. Assistant IA
- ✅ **AI Assistant**
  - Support automatisé
  - Réponses aux questions
  - Aide contextuelle

---

# 📊 MATRICE DES FONCTIONNALITÉS PAR RÔLE

| Fonctionnalité | Gérant | Manager | Vendeur | IT Admin | Super Admin |
|---------------|--------|---------|---------|----------|-------------|
| **Gestion magasins** | ✅ Complète | ❌ | ❌ | ❌ | ✅ Vue |
| **Inviter personnel** | ✅ Tous | ❌ | ❌ | ❌ | ❌ |
| **Saisir KPI** | ❌ | ✅ Magasin | ✅ Perso | ❌ | ❌ |
| **Voir stats globales** | ✅ | ✅ Équipe | ✅ Perso | ✅ Sync | ✅ Tous |
| **Coaching IA** | ❌ | ✅ Équipe | ✅ Perso | ❌ | ❌ |
| **Gestion abonnement** | ✅ | ❌ | ❌ | ❌ | ✅ Tous |
| **API/Intégrations** | ✅ | ❌ | ❌ | ✅ | ❌ |
| **Diagnostic compétences** | ❌ | ✅ Manager | ✅ Vendeur | ❌ | ❌ |

---

# 🔄 FLUX UTILISATEURS TYPIQUES

## Parcours Gérant (First Use)
1. **Connexion** → Dashboard gérant
2. **Créer premier magasin** → Modal création
3. **Inviter un manager** → Modal invitation
4. **Consulter abonnement** → Modal Stripe
5. **Voir statistiques** → Dashboard mis à jour

## Parcours Manager (First Use)
1. **Accepter invitation** → Création compte
2. **Compléter diagnostic** → Modal diagnostic
3. **Découvrir dashboard** → Vue d'ensemble
4. **Voir son équipe** → Team modal
5. **Saisir KPI magasin** → KPI modal

## Parcours Vendeur (First Use)
1. **Accepter invitation** → Création compte
2. **Compléter diagnostic** ⚠️ **OBLIGATOIRE** → Identification profil
3. **Découvrir dashboard** → Vue performances
4. **Saisir premiers KPI** → KPI modal
5. **Recevoir premier coaching IA** → Coaching modal

---

# 🎯 PRIORITÉS POUR ONBOARDING

## Gérant - Onboarding en 5 étapes
1. 🏪 **Créer votre premier magasin**
2. 👥 **Inviter votre premier manager**
3. 📊 **Découvrir les statistiques**
4. 💳 **Comprendre votre abonnement**
5. ⚙️ **Explorer les paramètres avancés**

## Manager - Onboarding en 6 étapes
1. 🎯 **Compléter votre diagnostic**
2. 👁️ **Vue d'ensemble de votre magasin**
3. 👥 **Découvrir votre équipe**
4. 📈 **Saisir les KPI du magasin**
5. 🤖 **Demander un bilan IA de l'équipe**
6. ⚙️ **Configurer vos KPI**

## Vendeur - Onboarding en 7 étapes
1. 🎯 **Compléter le diagnostic (CRITIQUE)**
2. 👁️ **Vue d'ensemble de vos performances**
3. 📝 **Saisir vos premiers KPI**
4. 📊 **Consulter vos statistiques**
5. 🤖 **Recevoir du coaching IA**
6. 🎖️ **Découvrir les challenges**
7. 🎯 **Voir vos objectifs**

## IT Admin - Onboarding en 4 étapes
1. 🔑 **Générer votre première clé API**
2. 📚 **Consulter la documentation API**
3. 🔄 **Configurer la synchronisation**
4. 📊 **Voir les logs de sync**

---

# 🚨 ÉLÉMENTS CRITIQUES À ONBOARDER

## Pour TOUS
- ❗ **Comprendre son rôle et ses permissions**
- ❗ **Savoir où trouver l'aide**
- ❗ **Comprendre le système de crédits IA**

## Spécifique Gérant
- ❗ **Différence entre Manager et Vendeur**
- ❗ **Impact de l'abonnement sur les fonctionnalités**
- ❗ **Mode API vs Mode Manuel**

## Spécifique Manager
- ❗ **Importance de la saisie quotidienne des KPI**
- ❗ **Comment interpréter les analyses IA**
- ❗ **Relation avec le gérant**

## Spécifique Vendeur
- ❗❗❗ **DIAGNOSTIC OBLIGATOIRE** (bloque certaines fonctionnalités)
- ❗ **Saisie quotidienne = clé de la réussite**
- ❗ **Coaching IA personnalisé basé sur le diagnostic**

---

# 📱 COMPOSANTS RÉUTILISABLES

Ces composants sont partagés entre plusieurs dashboards :

- **SubscriptionModal** : Gérant, Manager (lecture seule)
- **SyncModeBadge** : Manager, Vendeur (si en mode API)
- **KPI Components** : Manager, Vendeur
- **Modals de statistiques** : Tous les rôles

---

# 🔗 INTÉGRATIONS EXTERNES

## Stripe
- Checkout
- Gestion abonnements
- Webhooks
- Facturation automatique

## OpenAI (via Emergent LLM Key)
- Coaching IA
- Bilans d'équipe
- Diagnostic de compétences
- Recommandations personnalisées

## Brevo (Emails)
- Invitations
- Notifications
- Rappels
- Confirmations

---

# 📈 MÉTRIQUES & KPI SUIVIS

## Niveau Entreprise (Gérant)
- CA total
- Nombre de ventes
- Taux de conversion
- Panier moyen
- Performance par magasin

## Niveau Magasin (Manager)
- CA magasin
- Taux de conversion magasin
- Performance équipe
- Classement vendeurs

## Niveau Individuel (Vendeur)
- CA personnel
- Nombre de ventes
- Panier moyen
- Taux de conversion
- Score de compétences

---

**Document maintenu par**: Agent E1  
**Dernière mise à jour**: 2024-12-02  
**Version**: 1.0
