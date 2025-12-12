import React from 'react';

/**
 * Contenu des étapes d'onboarding pour le MANAGER
 * Présentation alignée avec le tutoriel Gérant
 * Adaptatif selon le mode de saisie KPI
 */

export const getManagerSteps = (kpiMode = 'VENDEUR_SAISIT') => {
  const steps = [
    // Étape 1 : Bienvenue
    {
      icon: '👋',
      title: 'Bienvenue dans votre espace Manager',
      description: (
        <>
          <p className="text-blue-600 font-semibold">Vous gérez un magasin et son équipe de vendeurs.</p>
          <p className="mt-3 font-semibold">En tant que manager, vous pouvez :</p>
          <ul className="list-disc list-inside space-y-1 mt-2 text-left mx-auto max-w-md">
            <li>Suivre les performances de votre équipe</li>
            <li>Définir des objectifs et challenges</li>
            <li>Obtenir des analyses IA détaillées</li>
            <li>Coacher vos vendeurs individuellement</li>
          </ul>
        </>
      ),
      tips: 'Vous êtes le lien entre le gérant et les vendeurs.'
    },

    // Étape 2 : Diagnostic
    {
      icon: '🎯',
      title: 'Complétez votre diagnostic manager',
      description: (
        <>
          <p className="text-orange-600 font-semibold">Première étape : identifiez votre style de management.</p>
          <p className="mt-3 font-semibold">Le diagnostic vous permet de :</p>
          <ul className="list-disc list-inside space-y-1 mt-2 text-left mx-auto max-w-md">
            <li>Identifier votre style de management</li>
            <li>Personnaliser vos analyses IA</li>
            <li>Recevoir des conseils adaptés à votre profil</li>
            <li>Mieux comprendre votre équipe</li>
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
          <p className="text-purple-600 font-semibold">Deuxième étape : consultez les profils de vos vendeurs.</p>
          <p className="mt-3 font-semibold">Pour chaque vendeur, accédez à :</p>
          <ul className="list-disc list-inside space-y-1 mt-2 text-left mx-auto max-w-md">
            <li>Performances individuelles (CA, ventes, PM)</li>
            <li>Diagnostic de compétences vendeur</li>
            <li>Historique et statistiques</li>
            <li>Conseils IA personnalisés</li>
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
      title: 'Analysez votre équipe avec l\'IA',
      description: (
        <>
          <p className="text-blue-600 font-semibold">Troisième étape : obtenez des analyses IA complètes.</p>
          <p className="mt-3 font-semibold">Les bilans IA vous donnent :</p>
          <ul className="list-disc list-inside space-y-1 mt-2 text-left mx-auto max-w-md">
            <li>Points forts collectifs de l'équipe</li>
            <li>Axes d'amélioration identifiés</li>
            <li>Recommandations personnalisées par vendeur</li>
            <li>Stratégies d'optimisation des ventes</li>
          </ul>
        </>
      ),
      tips: 'Les bilans IA sont plus précis avec des données régulières.'
    },

    // Étape 6 : Configuration
    {
      icon: '⚙️',
      title: 'Configurez vos objectifs',
      description: (
        <>
          <p className="text-green-600 font-semibold">Dernière étape : personnalisez les KPI de votre magasin.</p>
          <p className="mt-3 font-semibold">Vous pouvez définir :</p>
          <ul className="list-disc list-inside space-y-1 mt-2 text-left mx-auto max-w-md">
            <li>Les métriques importantes à suivre</li>
            <li>Les objectifs CA et ventes</li>
            <li>Les challenges pour motiver l'équipe</li>
            <li>Les alertes de performance</li>
          </ul>
        </>
      ),
      tips: 'Adaptez les objectifs à votre type de commerce et à votre équipe.'
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
        title: 'Saisissez les KPI quotidiens',
        description: (
          <>
            <p className="text-green-600 font-semibold">Vous êtes responsable de la saisie des KPI.</p>
            <p className="mt-3 font-semibold">Chaque jour, saisissez :</p>
            <ul className="list-disc list-inside space-y-1 mt-2 text-left mx-auto max-w-md">
              <li>KPI du magasin (CA global, entrées)</li>
              <li>KPI de chaque vendeur (CA, ventes)</li>
            </ul>
            <p className="mt-3">💡 La régularité de saisie garantit des analyses IA précises !</p>
          </>
        ),
        tips: 'Saisissez les données chaque jour pour un suivi optimal.'
      };

    case 'VENDEUR_SAISIT':
      return {
        icon: '📊',
        title: 'Suivez les KPI de votre équipe',
        description: (
          <>
            <p className="text-blue-600 font-semibold">Vos vendeurs saisissent leurs KPI quotidiens.</p>
            <p className="mt-3 font-semibold">Votre rôle :</p>
            <ul className="list-disc list-inside space-y-1 mt-2 text-left mx-auto max-w-md">
              <li>Consulter les performances en temps réel</li>
              <li>Valider les saisies de l'équipe</li>
              <li>Identifier les tendances et écarts</li>
              <li>Coacher les vendeurs en difficulté</li>
            </ul>
          </>
        ),
        tips: 'Surveillez la régularité de saisie de votre équipe.'
      };

    case 'API_SYNC':
      return {
        icon: '🔄',
        title: 'KPI Synchronisés automatiquement',
        description: (
          <>
            <p className="text-blue-600 font-semibold">Les données sont synchronisées en temps réel.</p>
            <p className="mt-3 font-semibold">Avantages du mode Sync :</p>
            <ul className="list-disc list-inside space-y-1 mt-2 text-left mx-auto max-w-md">
              <li>Pas de saisie manuelle nécessaire</li>
              <li>Données toujours à jour</li>
              <li>Décisions basées sur des chiffres réels</li>
            </ul>
          </>
        ),
        tips: 'Consultez les données en temps réel pour prendre les bonnes décisions.'
      };

    default:
      return getManagerKpiStep('VENDEUR_SAISIT');
  }
}
