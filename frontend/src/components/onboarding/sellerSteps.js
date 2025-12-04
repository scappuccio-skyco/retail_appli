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
          <p>Première étape importante pour débloquer toutes les fonctionnalités !</p>
          
          <div className="bg-yellow-50 border border-yellow-300 rounded p-2 mt-2 mb-2" data-emergent-ignore="true">
            <p className="font-semibold mb-1">📍 Comment faire :</p>
            <p>1. Dans "Mes tâches à faire", cliquez sur "Complète ton diagnostic vendeur"</p>
            <p className="mt-1">OU</p>
            <p>2. Cliquez sur Profil (en haut à droite) puis "Diagnostic"</p>
          </div>
          
          <p className="mt-2">Cela permet de personnaliser votre coaching IA et débloquer toutes les fonctionnalités.</p>
        </>
      ),
      tips: 'Soyez honnête, personne ne jugera vos réponses !'
    },

    // Étape 3 : KPI (ADAPTATIF)
    getKpiStep(kpiMode),

    // Étape 4 : Performances
    {
      icon: '📊',
      title: 'Consultez vos performances',
      description: (
        <>
          <div className="bg-orange-50 border border-orange-300 rounded p-2 mt-2 mb-2" data-emergent-ignore="true">
            <p className="font-semibold mb-1">📍 Où trouver :</p>
            <p>Cliquez sur la carte orange "Mes Performances" sur votre dashboard</p>
          </div>
          
          <p>Consultez vos stats en temps réel : évolution du CA, taux de conversion, comparaison avec objectifs, classement équipe.</p>
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
          <div className="bg-purple-50 border border-purple-300 rounded p-3 mt-3 mb-3" data-emergent-ignore="true">
            <p className="font-semibold text-sm mb-2">📍 Accédez au Coach IA :</p>
            <p className="text-sm">👉 <strong>Option 1 :</strong> Dans le menu latéral, cherchez l'icône 🤖 et cliquez sur "Mon Coach IA"</p>
            <p className="text-sm">👉 <strong>Option 2 :</strong> Sur le dashboard, trouvez la carte ou section "Coaching" ou "Conseils IA"</p>
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
        title: 'Saisissez vos chiffres quotidiens',
        description: (
          <>
            <div className="bg-green-50 border border-green-300 rounded p-2 mt-2 mb-2" data-emergent-ignore="true">
              <p className="font-semibold mb-1">📍 Comment faire :</p>
              <p>Dans "Mes tâches à faire", cliquez sur "Saisir mes chiffres du jour"</p>
            </div>
            
            <p>Enregistrez quotidiennement : CA réalisé, Nombre de ventes, Panier moyen</p>
            <p className="mt-2">Essential pour recevoir du coaching IA personnalisé !</p>
          </>
        ),
        tips: 'Plus vous êtes régulier, meilleurs seront les conseils IA.'
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
