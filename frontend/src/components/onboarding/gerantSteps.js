import React from 'react';

/**
 * Contenu des étapes d'onboarding pour le GÉRANT
 */

export const getGerantSteps = () => [
  // Étape 1 : Bienvenue (vrai accueil, pas une tâche)
  {
    icon: '👋',
    title: 'Bienvenue dans votre espace Gérant',
    description: (
      <>
        <p className="text-blue-600 font-semibold">Vous pilotez votre entreprise depuis cet espace.</p>
        <p className="mt-3 font-semibold">En tant que gérant, vous pouvez :</p>
        <ul className="list-disc list-inside space-y-1 mt-2 text-left mx-auto max-w-md">
          <li>Créer et gérer vos magasins</li>
          <li>Inviter et gérer votre équipe</li>
          <li>Suivre les performances globales</li>
          <li>Gérer votre abonnement</li>
        </ul>
      </>
    ),
    tips: 'Ce tutoriel vous guide étape par étape. Vous pourrez le relancer à tout moment.'
  },

  // Étape 2 : Créer et gérer les magasins
  {
    icon: '🏪',
    title: 'Créez vos magasins',
    description: (
      <>
        <p className="text-orange-600 font-semibold">Première étape : créez vos magasins.</p>
        <p className="mt-3 font-semibold">Pour chaque magasin :</p>
        <ul className="list-disc list-inside space-y-1 mt-2 text-left mx-auto max-w-md">
          <li>Nom de votre boutique</li>
          <li>Adresse</li>
          <li>Téléphone</li>
          <li>Horaires d'ouverture</li>
        </ul>
      </>
    ),
    tips: 'Vous pourrez ajouter, modifier ou supprimer des magasins à tout moment.'
  },

  // Étape 3 : Accéder à l'espace manager
  {
    icon: '🎯',
    title: 'Gérez vos magasins au quotidien',
    description: (
      <>
        <p className="text-blue-600 font-semibold">Deuxième étape : accédez à l'espace manager de vos magasins.</p>
        <p className="mt-3 font-semibold">En tant que manager d'un magasin, vous pouvez :</p>
        <ul className="list-disc list-inside space-y-1 mt-2 text-left mx-auto max-w-md">
          <li>Saisir les KPI quotidiens</li>
          <li>Fixer des objectifs et challenges</li>
          <li>Faire des états des lieux avec vos équipes</li>
          <li>Gérer les vendeurs du magasin</li>
        </ul>
      </>
    ),
    tips: "Vous pouvez être à la fois gérant ET manager d'un ou plusieurs magasins. Cliquez sur \"Accéder à l'espace Manager\" dans le détail du magasin."
  },

  // Étape 4 : Inviter du personnel
  {
    icon: '👥',
    title: 'Invitez et gérez votre équipe',
    description: (
      <>
        <p className="text-blue-600 font-semibold">Troisième étape : constituez votre équipe.</p>
        <p className="mt-3 font-semibold">Vos actions en tant que gérant :</p>
        <ul className="list-disc list-inside space-y-1 mt-2 text-left mx-auto max-w-md">
          <li><strong>Inviter</strong> des managers et vendeurs par email</li>
          <li><strong>Placer</strong> les utilisateurs dans les magasins</li>
          <li><strong>Suspendre ou réactiver</strong> (mettre en veille) le personnel</li>
          <li><strong>Valider ou supprimer</strong> les comptes utilisateurs</li>
        </ul>
      </>
    ),
    tips: "Chaque invitation génère un lien unique envoyé par email. Seul le gérant peut inviter et gérer le statut du personnel."
  },

  // Étape 5 : Statistiques globales
  {
    icon: '📊',
    title: 'Suivez vos performances',
    description: (
      <>
        <p className="text-purple-600 font-semibold">Quatrième étape : analysez les performances de votre entreprise.</p>
        <p className="mt-3 font-semibold">Consultez les statistiques de toute votre entreprise :</p>
        <ul className="list-disc list-inside space-y-1 mt-2 text-left mx-auto max-w-md">
          <li>CA global et par magasin</li>
          <li>Classement des magasins</li>
          <li>Évolution temporelle</li>
          <li>Comparaisons de performances</li>
        </ul>
      </>
    ),
    tips: 'Utilisez les filtres par période pour analyser les tendances. Les KPI sont saisis par les managers de chaque magasin.'
  },

  // Étape 6 : Abonnement
  {
    icon: '💳',
    title: 'Gérez votre abonnement',
    description: (
      <>
        <p className="text-green-600 font-semibold">Dernière étape : maîtrisez votre abonnement et facturation.</p>
        <p className="mt-3 font-semibold">Consultez et gérez votre formule d'abonnement :</p>
        <ul className="list-disc list-inside space-y-1 mt-2 text-left mx-auto max-w-md">
          <li>Plan actuel et nombre de sièges</li>
          <li>Historique de facturation</li>
          <li>Upgrade/downgrade</li>
        </ul>
      </>
    ),
    tips: 'Les sièges s\'ajustent automatiquement selon la taille de votre équipe.'
  }
];
