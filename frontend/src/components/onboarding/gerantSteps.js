import React from 'react';

/**
 * Contenu des étapes d'onboarding pour le GÉRANT
 */

export const gerantSteps = [
  // Étape 1 : Bienvenue
  {
    icon: '👋',
    title: 'Bienvenue dans votre espace Gérant',
    description: (
      <>
        <p>Vous êtes le pilote de votre entreprise.</p>
        <p className="mt-2">Ce tutoriel vous guide dans la gestion de votre structure.</p>
      </>
    ),
    tips: 'Vous contrôlez toute l\'organisation de votre entreprise.'
  },

  // Étape 2 : Créer un magasin
  {
    icon: '🏪',
    title: 'Créez vos magasins',
    description: (
      <>
        <p>Première étape : structurez votre entreprise en créant vos magasins.</p>
        <p className="mt-3">Pour chaque magasin :</p>
        <ul className="list-disc list-inside space-y-1 mt-2 text-left mx-auto max-w-md">
          <li>Nom et adresse</li>
          <li>Configuration des KPI</li>
          <li>Attribution d'un manager</li>
        </ul>
      </>
    ),
    tips: 'Vous pourrez ajouter, modifier ou supprimer des magasins à tout moment.'
  },

  // Étape 3 : Inviter du personnel
  {
    icon: '👥',
    title: 'Invitez votre équipe',
    description: (
      <>
        <p>Vous êtes le seul à pouvoir inviter du personnel :</p>
        <ul className="list-disc list-inside space-y-1 mt-2 text-left mx-auto max-w-md">
          <li><strong>Managers</strong> : Géreront un magasin</li>
          <li><strong>Vendeurs</strong> : Travailleront dans un magasin</li>
        </ul>
        <p className="mt-3">Chaque invitation génère un lien unique envoyé par email.</p>
      </>
    ),
    tips: 'Assignez toujours les utilisateurs au bon magasin dès l\'invitation.'
  },

  // Étape 4 : Statistiques globales
  {
    icon: '📊',
    title: 'Suivez vos performances',
    description: (
      <>
        <p>Consultez les statistiques de toute votre entreprise :</p>
        <ul className="list-disc list-inside space-y-1 mt-2 text-left mx-auto max-w-md">
          <li>CA global et par magasin</li>
          <li>Classement des magasins</li>
          <li>Évolution temporelle</li>
          <li>Comparaisons de performances</li>
        </ul>
      </>
    ),
    tips: 'Utilisez les filtres par période pour analyser les tendances.'
  },

  // Étape 5 : Abonnement
  {
    icon: '💳',
    title: 'Gérez votre abonnement',
    description: (
      <>
        <p>Consultez et gérez votre formule d'abonnement :</p>
        <ul className="list-disc list-inside space-y-1 mt-2 text-left mx-auto max-w-md">
          <li>Plan actuel et nombre de sièges</li>
          <li>Crédits IA restants</li>
          <li>Historique de facturation</li>
          <li>Upgrade/downgrade</li>
        </ul>
      </>
    ),
    tips: 'Les sièges s\'ajustent automatiquement selon votre équipe.'
  }
];
