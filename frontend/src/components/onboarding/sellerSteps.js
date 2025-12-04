import React from 'react';

/**
 * Contenu des étapes d'onboarding pour le VENDEUR
 * Adaptatif selon le mode de saisie KPI
 */

export const getSellerSteps = (kpiMode = 'VENDEUR_SAISIT') => {
  const steps = [
    // Étape 1 : Bienvenue
    {
      icon: '👋',
      title: 'Bienvenue sur Retail Performer AI',
      description: (
        <>
          <p>Vous êtes vendeur dans votre entreprise.</p>
          <p className="mt-2">Ce tutoriel va vous guider dans la découverte de votre espace personnel.</p>
          <p className="mt-2">Vous pouvez passer ou revenir sur n'importe quelle étape.</p>
        </>
      ),
      tips: 'Prenez votre temps, vous pourrez relancer ce tutoriel à tout moment !'
    },

    // Étape 2 : Diagnostic (CRITIQUE)
    {
      icon: '🎯',
      title: 'Complétez votre diagnostic',
      description: (
        <>
          <p>Le diagnostic de compétences est votre <strong>première étape obligatoire</strong>.</p>
          
          <div className="bg-yellow-50 border border-yellow-300 rounded p-3 mt-3 mb-3" data-emergent-ignore="true">
            <p className="font-semibold text-sm mb-2">📍 Comment y accéder :</p>
            <p className="text-sm">1. Cliquez sur le bouton Profil en haut à droite</p>
            <p className="text-sm">2. Trouvez la section Diagnostic de compétences</p>
            <p className="text-sm">3. Cliquez sur Commencer le diagnostic</p>
          </div>
          
          <p className="mt-3">Il permet de :</p>
          <ul className="list-disc list-inside space-y-1 mt-2 text-left mx-auto max-w-md">
            <li>Identifier votre profil de vendeur</li>
            <li>Personnaliser votre coaching IA</li>
            <li>Débloquer toutes les fonctionnalités</li>
          </ul>
        </>
      ),
      tips: 'Soyez honnête dans vos réponses, personne ne les jugera !'
    },

    // Étape 3 : KPI (ADAPTATIF)
    getKpiStep(kpiMode),

    // Étape 4 : Performances
    {
      icon: '📊',
      title: 'Suivez vos performances',
      description: (
        <>
          <div className="bg-blue-50 border border-blue-300 rounded p-3 mt-3 mb-3" data-emergent-ignore="true">
            <p className="font-semibold text-sm mb-2">📍 Où trouver vos performances :</p>
            <p className="text-sm">1. Section Mes Performances sur le dashboard</p>
            <p className="text-sm">2. Ou cliquez sur Bilan dans le menu</p>
          </div>
          
          <p>Consultez vos statistiques en temps réel :</p>
          <ul className="list-disc list-inside space-y-1 mt-2 text-left mx-auto max-w-md">
            <li>Évolution de votre CA</li>
            <li>Taux de conversion</li>
            <li>Comparaison avec vos objectifs</li>
            <li>Classement dans l'équipe</li>
          </ul>
        </>
      ),
      tips: 'Utilisez les graphiques pour identifier vos points forts !'
    },

    // Étape 5 : Coaching IA
    {
      icon: '🤖',
      title: 'Recevez du coaching IA',
      description: (
        <>
          <div className="bg-purple-50 border-2 border-purple-400 rounded-lg p-4 mt-3 mb-4">
            <p className="font-bold text-purple-800 mb-2">📍 Accédez au Coach IA :</p>
            <ol className="list-decimal list-inside space-y-2 text-left text-purple-900">
              <li>Cliquez sur <strong className="bg-purple-200 px-2 py-1 rounded">🤖 Mon Coach IA</strong> dans le menu</li>
              <li>Ou trouvez la section <strong>"Coaching"</strong> sur votre dashboard</li>
            </ol>
          </div>
          
          <p>L'IA analyse vos performances et vous donne des conseils personnalisés :</p>
          <ul className="list-disc list-inside space-y-1 mt-2 text-left mx-auto max-w-md">
            <li>Points forts à maintenir</li>
            <li>Axes d'amélioration</li>
            <li>Tactiques adaptées à votre profil</li>
            <li>Plan d'action concret</li>
          </ul>
        </>
      ),
      tips: 'Le coaching s\'améliore avec le temps, plus vous avez de données !'
    },

    // Étape 6 : Challenges
    {
      icon: '🎖️',
      title: 'Participez aux challenges',
      description: (
        <>
          <p>Chaque jour, un nouveau challenge vous attend :</p>
          <ul className="list-disc list-inside space-y-1 mt-2 text-left mx-auto max-w-md">
            <li>Objectifs quotidiens personnalisés</li>
            <li>Récompenses et badges</li>
            <li>Compétition amicale avec l'équipe</li>
          </ul>
        </>
      ),
      tips: 'Les challenges rendent le travail plus fun et motivant !'
    },

    // Étape 7 : Finir
    {
      icon: '🎉',
      title: 'C\'est parti !',
      description: (
        <>
          <p>Vous êtes prêt à utiliser Retail Performer AI !</p>
          <p className="mt-3">N'oubliez pas :</p>
          <ul className="list-disc list-inside space-y-1 mt-2 text-left mx-auto max-w-md">
            <li>Complétez votre diagnostic dès maintenant</li>
            <li>Saisissez vos KPI tous les jours</li>
            <li>Consultez vos conseils IA régulièrement</li>
          </ul>
          <p className="mt-3">Vous pouvez relancer ce tutoriel à tout moment via le bouton <strong>🎓 Tutoriel</strong>.</p>
        </>
      ),
      tips: 'Bon courage et excellentes ventes ! 💪'
    }
  ];

  return steps;
};

/**
 * Génère l'étape KPI selon le mode
 */
function getKpiStep(mode) {
  switch (mode) {
    case 'VENDEUR_SAISIT':
      return {
        icon: '📝',
        title: 'Saisissez vos KPI quotidiens',
        description: (
          <>
            <div className="bg-green-50 border-2 border-green-400 rounded-lg p-4 mt-3 mb-4">
              <p className="font-bold text-green-800 mb-2">📍 Saisir mes KPI :</p>
              <ol className="list-decimal list-inside space-y-2 text-left text-green-900">
                <li>Trouvez la section <strong className="bg-green-200 px-2 py-1 rounded">"Mes KPI"</strong> sur votre dashboard</li>
                <li>Cliquez sur <strong>"➕ Saisir mes chiffres du jour"</strong></li>
                <li>Remplissez le formulaire et validez</li>
              </ol>
            </div>
            
            <p>Chaque jour, enregistrez vos résultats :</p>
            <ul className="list-disc list-inside space-y-1 mt-2 text-left mx-auto max-w-md">
              <li>CA réalisé</li>
              <li>Nombre de ventes</li>
              <li>Panier moyen</li>
            </ul>
            <p className="mt-3">C'est essentiel pour recevoir du coaching IA personnalisé !</p>
          </>
        ),
        tips: 'Plus vous êtes régulier, meilleurs seront vos insights IA.'
      };

    case 'MANAGER_SAISIT':
      return {
        icon: '👁️',
        title: 'Consultez vos KPI',
        description: (
          <>
            <p>Votre manager saisit vos résultats quotidiens.</p>
            <p className="mt-2">Vous pouvez les consulter ici à tout moment.</p>
            <p className="mt-3">Les données sont utilisées pour :</p>
            <ul className="list-disc list-inside space-y-1 mt-2 text-left mx-auto max-w-md">
              <li>Vos analyses de performances</li>
              <li>Votre coaching IA personnalisé</li>
              <li>Votre classement dans l'équipe</li>
            </ul>
          </>
        )
      };

    case 'API_SYNC':
      return {
        icon: '🔄',
        title: 'KPI Synchronisés',
        description: (
          <>
            <p>Vos données sont automatiquement synchronisées depuis votre système d'entreprise en temps réel.</p>
            <div className="inline-flex items-center gap-2 bg-blue-100 px-3 py-1 rounded-full mt-3">
              <span>🔄</span>
              <span className="text-sm font-medium">Sync API</span>
            </div>
            <p className="mt-3">Avantages :</p>
            <ul className="list-disc list-inside space-y-1 mt-2 text-left mx-auto max-w-md">
              <li>Pas de saisie manuelle nécessaire</li>
              <li>Données toujours à jour</li>
              <li>Coaching IA basé sur vos vraies performances</li>
            </ul>
          </>
        )
      };

    default:
      return getKpiStep('VENDEUR_SAISIT');
  }
}
