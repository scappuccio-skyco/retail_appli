import React from 'react';

/**
 * Contenu des étapes d'onboarding pour l'IT ADMIN
 */

export const itAdminSteps = [
  // Étape 1 : Bienvenue
  {
    icon: '👋',
    title: 'Espace IT Admin',
    description: (
      <>
        <p>Vous gérez le compte enterprise de votre organisation.</p>
        <p className="mt-2">Ce tutoriel vous guide dans la gestion des intégrations API.</p>
      </>
    ),
    tips: 'Les intégrations API permettent d\'automatiser la synchronisation des données.'
  },

  // Étape 2 : Clés API
  {
    icon: '🔑',
    title: 'Générez vos clés API',
    description: (
      <>
        <p>Créez des clés API pour intégrer Retail Performer à vos systèmes :</p>
        <ul className="list-disc list-inside space-y-1 mt-2 text-left mx-auto max-w-md">
          <li>Définir les permissions</li>
          <li>Configurer les rate limits</li>
          <li>Révoquer si nécessaire</li>
        </ul>
      </>
    ),
    tips: 'Conservez vos clés API en sécurité, ne les partagez jamais publiquement.'
  },

  // Étape 3 : Documentation
  {
    icon: '📚',
    title: 'Documentation API',
    description: (
      <>
        <p>Consultez la documentation complète pour :</p>
        <ul className="list-disc list-inside space-y-1 mt-2 text-left mx-auto max-w-md">
          <li>Importer des utilisateurs en masse</li>
          <li>Synchroniser les magasins</li>
          <li>Récupérer les données</li>
        </ul>
      </>
    ),
    tips: 'La documentation inclut des exemples de code pour chaque endpoint.'
  },

  // Étape 4 : Synchronisation
  {
    icon: '🔄',
    title: 'Logs de synchronisation',
    description: (
      <>
        <p>Suivez l'état de vos synchronisations :</p>
        <ul className="list-disc list-inside space-y-1 mt-2 text-left mx-auto max-w-md">
          <li>Statut en temps réel</li>
          <li>Historique des syncs</li>
          <li>Erreurs et résolutions</li>
        </ul>
      </>
    ),
    tips: 'Surveillez régulièrement les logs pour détecter d\'éventuels problèmes.'
  }
];
