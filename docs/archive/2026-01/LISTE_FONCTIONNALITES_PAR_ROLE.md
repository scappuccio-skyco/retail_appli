# 📋 LISTE COMPLÈTE DES FONCTIONNALITÉS PAR RÔLE

**Date** : 26 Janvier 2026  
**Version** : Production  
**Objectif** : Documentation exhaustive des fonctionnalités disponibles pour chaque rôle utilisateur

---

## 🎯 Vue d'ensemble

L'application Retail Performer AI propose **3 espaces utilisateurs principaux** :
- **Gérant** : Propriétaire de l'entreprise, gestion multi-magasins
- **Manager** : Responsable d'un magasin et de son équipe
- **Vendeur** : Membre de l'équipe, saisie KPI et coaching

---

# 1️⃣ ESPACE GÉRANT

## 📊 Rubrique 1 : Dashboard (Vue d'ensemble)

### Statistiques globales
- ✅ **KPIs globaux en temps réel**
  - Chiffre d'affaires total (aujourd'hui, semaine, mois, année)
  - Nombre total de ventes
  - Panier moyen global
  - Taux de conversion entreprise
  - Évolution vs période précédente (%)

### Classement des magasins
- ✅ **Classement par période** (semaine, mois, année)
  - Navigation temporelle (précédent/suivant)
  - Top magasins par CA
  - Badges de performance (Excellent, Bon, Moyen, À améliorer)
  - Évolution par magasin (%)
  - Icônes de rang (🥇🥈🥉⭐✨)

### Cartes de performance par magasin
- ✅ **Indicateurs clés** (semaine passée)
  - CA de la semaine
  - Nombre de ventes
  - Évolution vs période précédente
  - Accès rapide aux détails du magasin

### Graphiques de performance
- ✅ **Évolution CA** sur 7/30/365 jours
- ✅ **Comparaison inter-magasins**
- ✅ **Tendances par période** (jour/semaine/mois/année)

---

## 🏪 Rubrique 2 : Gestion des Magasins

### Création et configuration
- ✅ **Créer un magasin** (`CreateStoreModal`)
  - Nom du magasin
  - Adresse complète
  - Configuration initiale
  - Affectation automatique au workspace

### Consultation et détails
- ✅ **Vue détaillée magasin** (`StoreDetailModal`)
  - KPIs spécifiques (CA, ventes, panier moyen)
  - Liste des managers assignés
  - Liste des vendeurs actifs
  - Statistiques d'équipe
  - Graphiques de performance
  - Historique KPI
  - Années disponibles avec données

### Modifications
- ✅ **Modifier un magasin**
  - Nom, adresse
  - Informations générales

### Suppression
- ✅ **Supprimer un magasin** (`DeleteStoreConfirmation`)
  - Confirmation obligatoire
  - Suppression en cascade du personnel (suspension automatique)

### Import en masse
- ✅ **Import bulk de magasins** (`BulkStoreImportModal`)
  - Import CSV/Excel
  - Création multiple de magasins

---

## 👥 Rubrique 3 : Gestion du Personnel

### Invitations
- ✅ **Inviter du personnel** (`InviteStaffModal`)
  - **Managers** : assignation à un magasin
  - **Vendeurs** : assignation à un magasin + optionnel manager
  - Génération de lien d'invitation
  - Envoi automatique d'email via Brevo
  - Gestion des invitations en attente

### Gestion des invitations
- ✅ **Consulter les invitations**
  - Liste des invitations (managers et vendeurs)
  - Statuts (pending, accepted, expired)
  - Actions : Resend, Supprimer

### Transfers
- ✅ **Transférer un manager** (`ManagerTransferModal`)
  - D'un magasin à un autre
  - Mise à jour automatique de l'équipe
  - Avertissement si vendeurs orphelins

- ✅ **Transférer un vendeur** (`SellerTransferModal`)
  - Changement de magasin
  - Changement de manager
  - Mise à jour automatique des affectations

### Vue d'ensemble du personnel
- ✅ **Staff Overview** (`StaffOverview`)
  - Liste complète managers et vendeurs
  - Statuts (actif, suspendu)
  - Performances individuelles
  - Actions rapides (suspendre, réactiver, supprimer)

### Actions sur le personnel
- ✅ **Suspendre un manager/vendeur**
  - Suspension temporaire
  - Accès désactivé

- ✅ **Réactiver un manager/vendeur**
  - Réactivation du compte
  - Restauration des accès

- ✅ **Supprimer un manager/vendeur**
  - Suppression définitive
  - Confirmation obligatoire

---

## 💳 Rubrique 4 : Abonnement et Facturation

### Consultation de l'abonnement
- ✅ **Subscription Modal** (`SubscriptionModal`)
  - Plan actuel (Starter, Professional, Enterprise)
  - Nombre de sièges utilisés/disponibles
  - Consommation IA (crédits utilisés/restants)
  - Historique de facturation
  - Date de renouvellement

### Modification de l'abonnement
- ✅ **Modifier le nombre de sièges**
  - Ajout/suppression de sièges
  - Preview du coût (proratisation)
  - Gestion via Stripe

- ✅ **Changer de plan**
  - Upgrade/downgrade
  - Preview des changements
  - Proratisation automatique

- ✅ **Changer d'intervalle** (mensuel/annuel)
  - Switch mensuel ↔ annuel
  - Calcul des économies annuelles

### Gestion de l'abonnement
- ✅ **Annuler l'abonnement**
  - Annulation à la fin de la période
  - Accès maintenu jusqu'à la fin

- ✅ **Réactiver l'abonnement**
  - Réactivation après annulation
  - Reprise immédiate

### Profil de facturation
- ✅ **Billing Profile** (`BillingProfileModal`)
  - Informations de facturation
  - Adresse de facturation
  - Modification des données

### Historique
- ✅ **Historique des abonnements**
  - Liste des abonnements passés
  - Audit des changements

---

## 🔌 Rubrique 5 : API et Intégrations (Vue Enterprise)

### Gestion des clés API
- ✅ **API Keys Management** (`APIKeysManagement`)
  - Génération de clés API
  - Révocation de clés
  - Limites de taux (rate limiting)
  - Logs d'utilisation
  - Documentation API intégrée

### Documentation API
- ✅ **API Documentation** (`APIDocModal`)
  - Endpoints disponibles
  - Authentification
  - Exemples de requêtes
  - Synchronisation KPI
  - CRUD Stores, Managers, Sellers

### Import en masse via API
- ✅ **Import managers via API**
  - Création multiple de managers
  - Synchronisation de données

- ✅ **Import vendeurs via API**
  - Création multiple de vendeurs
  - Synchronisation de données

---

## 👤 Rubrique 6 : Profil et Paramètres

### Profil utilisateur
- ✅ **Gerant Profile** (`GerantProfile`)
  - Nom, email, téléphone
  - Nom de l'entreprise
  - Modification des informations

### Changement de mot de passe
- ✅ **Modifier le mot de passe**
  - Ancien mot de passe requis
  - Validation de sécurité

### Support
- ✅ **Support Modal** (`SupportModal`)
  - Contact support
  - Questions et assistance
  - Envoi de messages

---

# 2️⃣ ESPACE MANAGER

## 📊 Rubrique 1 : Dashboard (Vue d'ensemble)

### Vue d'ensemble de l'équipe
- ✅ **Team Modal** (`TeamModal`)
  - Liste des vendeurs
  - Statuts (actif, suspendu, en attente)
  - Performances individuelles
  - Accès rapide aux détails

### Statistiques du magasin
- ✅ **Store KPI Stats**
  - CA du magasin
  - Nombre de ventes
  - Panier moyen
  - Taux de conversion
  - Évolution vs période précédente

### Graphiques de performance
- ✅ **Graphiques configurables**
  - CA journalier
  - Nombre de ventes
  - Panier moyen
  - Taux de transformation
  - Indice de vente
  - Filtres par période (7j, 30j, 90j, 365j, custom)

---

## 👥 Rubrique 2 : Gestion de l'Équipe

### Détails vendeur
- ✅ **Seller Detail View** (`SellerDetailView`)
  - **Onglet Compétences** :
    - Diagnostic de compétences (scores)
    - Évolution des compétences
    - Graphiques de progression
  - **Onglet Performance** :
    - KPI détaillés
    - Historique de performances
    - Graphiques temporels
  - **Onglet Coaching** :
    - Recommandations IA
    - Bilan individuel
    - Débriefs

### Consultation des vendeurs
- ✅ **Liste des vendeurs**
  - Vendeurs actifs
  - Vendeurs suspendus
  - Vendeurs archivés
  - Performances individuelles

### Invitations
- ✅ **Consulter les invitations**
  - Invitations en attente
  - Statuts (pending, accepted, expired)
  - Note : Le manager ne peut pas inviter (réservé au gérant)

---

## 📈 Rubrique 3 : KPI et Performances

### Configuration des KPI
- ✅ **KPI Config Modal** (`KPIConfigModal`)
  - Définir les KPI suivis :
    - CA journalier
    - Nombre de ventes
    - Nombre de clients
    - Nombre d'articles
    - Nombre de prospects
  - Objectifs personnalisés par KPI
  - Poids et priorités
  - Activation/désactivation par KPI

### Saisie KPI magasin
- ✅ **Store KPI Modal** (`StoreKPIModal`)
  - KPI quotidiens du magasin
  - Comparaison avec objectifs
  - Historique des saisies

### Analyse IA des KPI
- ✅ **Store KPI AI Analysis** (`StoreKPIAIAnalysisModal`)
  - Analyse automatique des KPI
  - Recommandations personnalisées
  - Points d'attention

### Historique KPI
- ✅ **KPI History Modal** (`KPIHistoryModal`)
  - Évolutions temporelles
  - Graphiques et tendances
  - Filtres par période
  - Export des données

### Vue d'ensemble KPI
- ✅ **Store KPI Overview**
  - Résumé des KPI
  - Dates avec données
  - Années disponibles

---

## 🤖 Rubrique 4 : Coaching et IA

### Bilan d'équipe IA
- ✅ **Team Bilan IA** (`TeamBilanModal`)
  - Analyse globale de l'équipe
  - Points forts et axes d'amélioration
  - Recommandations personnalisées par vendeur
  - Régénération du bilan
  - Navigation par semaine

### Analyse d'équipe
- ✅ **Team Analysis** (`TeamAIAnalysisModal`)
  - Analyse approfondie de l'équipe
  - Dynamique de groupe
  - Recommandations stratégiques
  - Historique des analyses

### Bilan individuel
- ✅ **Bilan Individuel** (`BilanIndividuelModal`)
  - Consultation des bilans IA passés
  - Historique des analyses
  - Navigation par période

### Relations interpersonnelles
- ✅ **Relationship Management** (`RelationshipManagementModal`)
  - Dynamique d'équipe
  - Conflits potentiels
  - Suggestions de team building
  - Historique des consultations

### Résolution de conflits
- ✅ **Conflict Resolution**
  - Création de plans de résolution
  - Suivi des conflits
  - Historique des résolutions

### Conseils relationnels
- ✅ **Relationship Advice**
  - Conseils pour améliorer les relations
  - Historique des conseils

---

## 🎯 Rubrique 5 : Objectifs et Challenges

### Gestion des objectifs
- ✅ **Objectives Modal** (`ObjectivesAndChallengesModal`)
  - **Créer un objectif** :
    - Titre, description
    - Type (CA, ventes, conversion, etc.)
    - Cible et deadline
    - Assignation à un vendeur
  - **Consulter les objectifs actifs**
  - **Modifier un objectif**
  - **Supprimer un objectif**
  - **Suivi de progression**
  - **Marquer les accomplissements comme vus**

### Gestion des challenges
- ✅ **Challenges Modal** (`ObjectivesAndChallengesModal`)
  - **Créer un challenge** :
    - Titre, description
    - Type et règles
    - Récompenses
    - Assignation
  - **Consulter les challenges actifs**
  - **Modifier un challenge**
  - **Supprimer un challenge**
  - **Suivi de progression**
  - **Marquer les accomplissements comme vus**

### Historique
- ✅ **Historique des objectifs**
  - Objectifs complétés
  - Objectifs annulés
  - Statistiques

- ✅ **Historique des challenges**
  - Challenges complétés
  - Statistiques

---

## 📋 Rubrique 6 : Diagnostic et Profil

### Diagnostic manager
- ✅ **Manager Diagnostic Form** (`DiagnosticFormModal`)
  - Auto-évaluation de compétences
  - Identification des forces/faiblesses
  - Profil de management
  - Recommandations initiales

### Profil manager
- ✅ **Manager Profile Modal** (`ManagerProfileModal`)
  - Informations personnelles
  - Préférences
  - Historique
  - Modification du profil

---

## ⚙️ Rubrique 7 : Paramètres

### Paramètres magasin
- ✅ **Manager Settings Modal** (`ManagerSettingsModal`)
  - **Gestion des objectifs** :
    - Créer, modifier, supprimer des objectifs
    - Assignation aux vendeurs
    - Suivi de progression
  - **Gestion des challenges** :
    - Créer, modifier, supprimer des challenges
    - Règles et récompenses
    - Suivi de progression
  - Notifications
  - Préférences d'affichage
  - Configuration IA
  - Mode de synchronisation

### Mode de synchronisation
- ✅ **Sync Mode Badge** (`SyncModeBadge`)
  - Indique si données en mode API ou manuel
  - Lecture seule si sync API
  - Badge visuel

### Brief matinal
- ✅ **Morning Brief Modal** (`MorningBriefModal`)
  - Résumé quotidien généré par IA
  - Points clés de la journée
  - Recommandations
  - Actions prioritaires

---

# 3️⃣ ESPACE VENDEUR

## 📊 Rubrique 1 : Dashboard (Vue d'ensemble)

### Vue d'ensemble personnelle
- ✅ **Statistiques personnelles**
  - CA personnel
  - Nombre de ventes
  - Panier moyen
  - Taux de conversion
  - Évolution vs période précédente

### Tâches quotidiennes
- ✅ **Tasks List**
  - Saisir mes chiffres du jour (KPI)
  - Challenge quotidien
  - Objectifs en cours
  - Débriefs à compléter

---

## 📈 Rubrique 2 : Saisie et Suivi KPI

### Saisie KPI quotidienne
- ✅ **KPI Entry Modal** (`KPIEntryModal`)
  - CA journalier
  - Nombre de ventes
  - Nombre de clients
  - Nombre d'articles
  - Nombre de prospects
  - Modification des KPI du jour (si autorisé)

### Historique KPI
- ✅ **KPI History Modal** (`KPIHistoryModal`)
  - Historique complet des saisies
  - Graphiques de progression
  - Filtres par période
  - Comparaison avec objectifs

### Configuration KPI
- ✅ **KPI Config** (lecture seule)
  - KPI activés par le manager
  - Objectifs définis
  - Poids des KPI

---

## 🎯 Rubrique 3 : Objectifs et Challenges

### Objectifs personnels
- ✅ **Objectives Modal** (`ObjectivesAndChallengesModal`)
  - **Consulter les objectifs actifs**
  - **Consulter tous les objectifs** (actifs + complétés)
  - **Historique des objectifs**
  - **Mettre à jour la progression**
  - **Marquer les accomplissements comme vus**

### Challenges
- ✅ **Challenges Modal** (`ObjectivesAndChallengesModal`)
  - **Consulter les challenges actifs**
  - **Historique des challenges**
  - **Mettre à jour la progression**
  - **Marquer les accomplissements comme vus**

### Challenge quotidien
- ✅ **Daily Challenge Modal** (`DailyChallengeModal`)
  - Challenge généré quotidiennement par IA
  - Complétion du challenge
  - Statistiques de complétion
  - Historique des challenges
  - Régénération d'un nouveau challenge

---

## 🤖 Rubrique 4 : Coaching et IA

### Bilan individuel
- ✅ **Bilan Individuel Modal** (`BilanIndividuelModal`)
  - Analyse hebdomadaire par IA
  - Points forts et axes d'amélioration
  - Recommandations personnalisées
  - Navigation par semaine
  - KPI de la semaine (calculés automatiquement)

### Débriefs
- ✅ **Debrief Modal** (`DebriefModal`)
  - Création de débriefs
  - Analyse de situations vécues
  - Recommandations IA
  - Historique des débriefs (`DebriefHistoryModal`)

### Coaching
- ✅ **Coaching Modal** (`CoachingModal`)
  - Conseils personnalisés
  - Recommandations basées sur les performances
  - Historique des coachings

### Relations interpersonnelles
- ✅ **Relationship Advice**
  - Conseils pour améliorer les relations avec l'équipe
  - Historique des conseils

### Résolution de conflits
- ✅ **Conflict Resolution**
  - Création de plans de résolution
  - Suivi des conflits
  - Historique des résolutions

---

## 🧠 Rubrique 5 : Diagnostic de Compétences

### Formulaire diagnostic
- ✅ **Diagnostic Form** (`DiagnosticFormModal`)
  - Questions sur compétences retail :
    - Accueil client
    - Découverte des besoins
    - Argumentation
    - Closing
    - Fidélisation
  - Identification profil vendeur
  - Recommandations initiales
  - Scores par compétence

### Consultation diagnostic
- ✅ **Diagnostic Modal** (`DiagnosticFormModal`)
  - Résultats détaillés
  - Profil de compétences
  - Graphiques de scores
  - Évolution des compétences (live scores)
  - Recommandations personnalisées

### Guide des profils
- ✅ **Guide Profils Modal** (`GuideProfilsModal`)
  - Explication des différents profils
  - Caractéristiques de chaque profil
  - Points forts et axes d'amélioration

### Explication des compétences
- ✅ **Compétences Explication Modal** (`CompetencesExplicationModal`)
  - Définition de chaque compétence
  - Comment améliorer chaque compétence
  - Exemples concrets

---

## 📊 Rubrique 6 : Performance et Statistiques

### Performance personnelle
- ✅ **Performance Modal** (`PerformanceModal`)
  - Graphiques de performance
  - Évolution temporelle
  - Comparaison avec objectifs
  - Tendances
  - Accès rapide à l'historique KPI
  - Édition des KPI depuis le modal

### Évaluations
- ✅ **Evaluation Modal** (`EvaluationModal`)
  - Évaluations reçues
  - Feedback du manager
  - Historique des évaluations
  - **Génération d'évaluation annuelle** (Entretien Annuel)
    - Création d'évaluation complète
    - Feedback structuré
    - Plan de développement

### Ventes
- ✅ **Sales List**
  - Liste des ventes
  - Détails des transactions
  - Historique

### Tâches
- ✅ **Tasks List**
  - Tâches assignées par le manager
  - Tâches automatiques (KPI quotidien, challenge)
  - Réponses aux demandes du manager
  - Suivi des tâches complétées

---

## 👤 Rubrique 7 : Profil

### Profil vendeur
- ✅ **Seller Profile Modal** (`SellerProfileModal`)
  - Informations personnelles
  - Modification du profil
  - Préférences

---

## 📱 Rubrique 8 : Informations Magasin

### Informations du magasin
- ✅ **Store Info**
  - Nom du magasin
  - Adresse
  - Informations générales

---

# 📊 MATRICE DE COMPARAISON DES FONCTIONNALITÉS

| Fonctionnalité | Gérant | Manager | Vendeur |
|---------------|--------|---------|---------|
| **Créer un magasin** | ✅ | ❌ | ❌ |
| **Modifier un magasin** | ✅ | ❌ | ❌ |
| **Supprimer un magasin** | ✅ | ❌ | ❌ |
| **Inviter du personnel** | ✅ | ❌ | ❌ |
| **Transférer un manager** | ✅ | ❌ | ❌ |
| **Transférer un vendeur** | ✅ | ❌ | ❌ |
| **Suspendre/Réactiver personnel** | ✅ | ❌ | ❌ |
| **Saisir KPI magasin** | ❌ | ✅ | ❌ |
| **Saisir KPI personnel** | ❌ | ❌ | ✅ |
| **Configurer les KPI** | ❌ | ✅ | ❌ (lecture) |
| **Voir stats globales** | ✅ | ✅ (équipe) | ✅ (perso) |
| **Voir stats magasin** | ✅ | ✅ | ❌ |
| **Coaching IA équipe** | ❌ | ✅ | ❌ |
| **Coaching IA personnel** | ❌ | ❌ | ✅ |
| **Gestion abonnement** | ✅ | ❌ | ❌ |
| **API/Intégrations** | ✅ | ❌ | ❌ |
| **Diagnostic compétences** | ❌ | ✅ (manager) | ✅ (vendeur) |
| **Objectifs et challenges** | ❌ | ✅ (créer) | ✅ (suivre) |
| **Bilan d'équipe IA** | ❌ | ✅ | ❌ |
| **Bilan individuel IA** | ❌ | ✅ (voir) | ✅ (voir) |
| **Débriefs** | ❌ | ✅ (voir) | ✅ (créer) |
| **Relations interpersonnelles** | ❌ | ✅ | ✅ |
| **Résolution conflits** | ❌ | ✅ | ✅ |

---

# 🔐 PERMISSIONS ET ACCÈS

## Gérant
- ✅ Accès complet à tous les magasins
- ✅ Gestion complète du personnel
- ✅ Gestion de l'abonnement
- ✅ Accès API (plan Enterprise)
- ✅ Vue en mode manager (pour consulter un magasin spécifique)

## Manager
- ✅ Accès uniquement à son magasin assigné
- ✅ Gestion de son équipe de vendeurs
- ✅ Saisie KPI magasin
- ✅ Configuration KPI
- ✅ Coaching et analyses IA
- ❌ Ne peut pas inviter de personnel
- ❌ Ne peut pas modifier la structure du magasin

## Vendeur
- ✅ Accès uniquement à ses propres données
- ✅ Saisie KPI personnel
- ✅ Consultation de ses performances
- ✅ Coaching IA personnel
- ✅ Objectifs et challenges assignés
- ❌ Ne peut pas voir les données des autres vendeurs
- ❌ Ne peut pas modifier les KPI des autres

---

# 📊 RÉCAPITULATIF PAR RUBRIQUE

## Gérant - 6 Rubriques principales
1. **Dashboard** : Statistiques globales, classement magasins, graphiques
2. **Gestion des Magasins** : CRUD complet, import bulk
3. **Gestion du Personnel** : Invitations, transfers, suspensions
4. **Abonnement et Facturation** : Gestion complète via Stripe
5. **API et Intégrations** : Clés API, documentation, synchronisation
6. **Profil et Paramètres** : Profil, mot de passe, support

## Manager - 7 Rubriques principales
1. **Dashboard** : Vue équipe, stats magasin, graphiques
2. **Gestion de l'Équipe** : Détails vendeurs, invitations (lecture)
3. **KPI et Performances** : Configuration, saisie, historique, analyse IA
4. **Coaching et IA** : Bilan équipe, analyse, relations, conflits
5. **Objectifs et Challenges** : CRUD complet, suivi progression
6. **Diagnostic et Profil** : Diagnostic manager, profil
7. **Paramètres** : Settings, sync mode, brief matinal

## Vendeur - 8 Rubriques principales
1. **Dashboard** : Stats personnelles, tâches quotidiennes
2. **Saisie et Suivi KPI** : Saisie quotidienne, historique, config (lecture)
3. **Objectifs et Challenges** : Consultation, progression, challenge quotidien
4. **Coaching et IA** : Bilan individuel, débriefs, coaching, relations
5. **Diagnostic de Compétences** : Formulaire, consultation, guides
6. **Performance et Statistiques** : Performance, évaluations, ventes, tâches
7. **Profil** : Profil vendeur
8. **Informations Magasin** : Infos du magasin

---

# 🔢 STATISTIQUES GLOBALES

## Nombre de fonctionnalités par rôle
- **Gérant** : ~45 fonctionnalités réparties en 6 rubriques
- **Manager** : ~50 fonctionnalités réparties en 7 rubriques
- **Vendeur** : ~40 fonctionnalités réparties en 8 rubriques

## Types de fonctionnalités
- **Modals** : 40+ modals différents
- **Endpoints API** : 130+ endpoints REST
- **Intégrations** : Stripe, OpenAI, Brevo
- **Fonctionnalités IA** : Coaching, diagnostics, bilans, briefs matinaux

---

*Document généré le 26 Janvier 2026*
