import React from 'react';

/**
 * Contenu des étapes d'onboarding pour le MANAGER
 * Adaptatif selon le mode de saisie KPI
 */

export const getManagerSteps = (kpiMode = 'VENDEUR_SAISIT') => {
  const steps = [
    // Étape 1 : Bienvenue
    {
      icon: '👋',
      title: 'Bienvenue Manager',
      description: (
        <>
          <p>Vous gérez un magasin et son équipe.</p>
          <p className="mt-2">Ce tutoriel vous guide dans la gestion de votre équipe.</p>
        </>
      ),
      tips: 'Vous êtes le lien entre le gérant et les vendeurs.'
    },

    // Étape 2 : Diagnostic
    {
      icon: '🎯',
      title: 'Votre diagnostic manager',
      description: (
        <>
          <p>Complétez votre diagnostic de compétences managériales.</p>
          <p className="mt-3">Cela permet de :</p>
          <ul className="list-disc list-inside space-y-1 mt-2 text-left mx-auto max-w-md">
            <li>Identifier votre style de management</li>
            <li>Personnaliser vos analyses IA</li>
            <li>Recevoir des conseils adaptés</li>
          </ul>
        </>
      ),
      tips: 'Un bon manager connaît ses forces et ses axes de progression.'
    },

    // Étape 3 : Votre équipe
    {
      icon: '👥',
      title: 'Découvrez votre équipe',
      description: (
        <>
          <p>Consultez la liste de vos vendeurs :</p>
          <ul className="list-disc list-inside space-y-1 mt-2 text-left mx-auto max-w-md">
            <li>Performances individuelles</li>
            <li>Diagnostic de compétences</li>
            <li>Historique et statistiques</li>
          </ul>
        </>
      ),
      tips: 'Cliquez sur un vendeur pour voir ses détails complets.'
    },

    // Étape 4 : KPI magasin (ADAPTATIF)
    getManagerKpiStep(kpiMode),

    // Étape 5 : Coaching IA d'équipe
    {
      icon: '🤖',
      title: 'Bilans IA de votre équipe',
      description: (
        <>
          <p>Demandez une analyse IA complète de votre équipe :</p>
          <ul className="list-disc list-inside space-y-1 mt-2 text-left mx-auto max-w-md">
            <li>Points forts collectifs</li>
            <li>Axes d'amélioration</li>
            <li>Recommandations par vendeur</li>
            <li>Stratégies d'optimisation</li>
          </ul>
        </>
      ),
      tips: 'Les bilans IA sont plus précis avec des données régulières.'
    },

    // Étape 6 : Configuration
    {
      icon: '⚙️',
      title: 'Configurez vos KPI',
      description: (
        <>
          <p>Personnalisez les KPI suivis pour votre magasin :</p>
          <ul className="list-disc list-inside space-y-1 mt-2 text-left mx-auto max-w-md">
            <li>Choisir les métriques importantes</li>
            <li>Définir les objectifs</li>
            <li>Configurer les alertes</li>
          </ul>
        </>
      ),
      tips: 'Adaptez les KPI à votre type de commerce.'
    }
  ];

  return steps;
};

/**
 * Génère l'étape KPI manager selon le mode
 */
function getManagerKpiStep(mode) {
  switch (mode) {
    case 'MANAGER_SAISIT':
      return {
        icon: '📝',
        title: 'Saisissez les KPI',
        description: (
          <>
            <p>Vous êtes responsable de la saisie des KPI :</p>
            <ul className="list-disc list-inside space-y-1 mt-2 text-left mx-auto max-w-md">
              <li>KPI du magasin (global)</li>
              <li>KPI de chaque vendeur</li>
            </ul>
            <p className="mt-3">💡 Saisissez chaque jour pour des analyses IA précises !</p>
          </>
        ),
        tips: 'La régularité de saisie impacte la qualité des analyses.'
      };

    case 'VENDEUR_SAISIT':
      return {
        icon: '📊',
        title: 'Consultez les KPI',
        description: (
          <>
            <p>Vos vendeurs saisissent leurs KPI quotidiens.</p>
            <p className="mt-2">Vous pouvez :</p>
            <ul className="list-disc list-inside space-y-1 mt-2 text-left mx-auto max-w-md">
              <li>Consulter les performances</li>
              <li>Valider les saisies</li>
              <li>Identifier les tendances</li>
            </ul>
          </>
        ),
        tips: 'Surveillez la régularité de saisie de votre équipe.'
      };

    case 'API_SYNC':
      return {
        icon: '🔄',
        title: 'KPI Synchronisés',
        description: (
          <>
            <p>Les données de votre équipe sont synchronisées automatiquement.</p>
            <div className="inline-flex items-center gap-2 bg-blue-100 px-3 py-1 rounded-full mt-3">
              <span>🔄</span>
              <span className="text-sm font-medium">Sync API</span>
            </div>
            <p className="mt-3">Consultez-les en temps réel pour prendre les bonnes décisions.</p>
          </>
        )
      };

    default:
      return getManagerKpiStep('VENDEUR_SAISIT');
  }
}
