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
          <p className="text-blue-600 font-semibold">Vous êtes vendeur dans votre entreprise.</p>
          <p className="mt-3 font-semibold">Ce tutoriel va vous guider pour :</p>
          <ul className="list-disc list-inside space-y-1 mt-2 text-left mx-auto max-w-md">
            <li>Découvrir votre espace personnel</li>
            <li>Comprendre les fonctionnalités</li>
            <li>Booster vos performances</li>
          </ul>
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
          <p className="text-orange-600 font-semibold">Débloquez toutes les fonctionnalités !</p>
          <p className="mt-3 font-semibold">Comment faire :</p>
          <ul className="list-disc list-inside space-y-1 mt-2 text-left mx-auto max-w-md">
            <li>Dans "Mes tâches à faire" → <strong>"Complète ton diagnostic"</strong></li>
            <li>OU cliquez sur <strong>Profil</strong> (en haut) → <strong>"Diagnostic"</strong></li>
          </ul>
          <p className="mt-3">Cela personnalise votre coaching IA et vos conseils.</p>
        </>
      ),
      tips: 'Soyez honnête dans vos réponses, personne ne vous jugera !'
    },

    // Étape 3 : Saisie KPI (ADAPTATIF selon le mode)
    getSellerKpiStep(kpiMode),

    // Étape 4 : Coaching IA
    {
      icon: '🤖',
      title: 'Obtenez du coaching IA',
      description: (
        <>
          <p className="text-blue-600 font-semibold">Recevez des conseils personnalisés.</p>
          <p className="mt-3 font-semibold">Votre coach IA vous aide à :</p>
          <ul className="list-disc list-inside space-y-1 mt-2 text-left mx-auto max-w-md">
            <li>Cliquez sur la carte violette <strong>"Mon coach IA"</strong></li>
            <li>Identifier vos points forts</li>
            <li>Améliorer votre accueil client</li>
            <li>Augmenter votre panier moyen</li>
          </ul>
        </>
      ),
      tips: 'Plus vous avez de données enregistrées, meilleurs sont les conseils !'
    },

    // Étape 5 : Challenges
    {
      icon: '🎖️',
      title: 'Relevez les challenges',
      description: (
        <>
          <p className="text-green-600 font-semibold">Rendez votre travail plus fun !</p>
          <p className="mt-3 font-semibold">Les challenges vous permettent de :</p>
          <ul className="list-disc list-inside space-y-1 mt-2 text-left mx-auto max-w-md">
            <li>Cliquez sur la carte verte <strong>"Objectifs et Challenges"</strong></li>
            <li>Recevoir des objectifs quotidiens personnalisés</li>
            <li>Gagner des badges et récompenses</li>
            <li>Participer aux compétitions d'équipe</li>
          </ul>
        </>
      ),
      tips: 'Les challenges rendent le travail plus motivant !'
    },

    // Étape 6 : Finir (ADAPTATIF)
    getSellerFinalStep(kpiMode)
  ];

  return steps;
};

/**
 * Étape KPI adaptée selon le mode de saisie
 */
function getSellerKpiStep(mode) {
  switch (mode) {
    case 'MANAGER_SAISIT':
      return {
        icon: '📊',
        title: 'Suivez vos performances',
        description: (
          <>
            <p className="text-purple-600 font-semibold">Votre manager saisit les chiffres pour vous.</p>
            <p className="mt-3 font-semibold">Consultez vos KPIs :</p>
            <ul className="list-disc list-inside space-y-1 mt-2 text-left mx-auto max-w-md">
              <li><strong>Panier Moyen</strong> : montant moyen par vente</li>
              <li><strong>Indice de Vente</strong> : articles par transaction</li>
              <li><strong>Taux de Transformation</strong> : visiteurs → acheteurs</li>
            </ul>
            <p className="mt-3">Analysez vos résultats et progressez !</p>
          </>
        ),
        tips: 'Utilisez les graphiques pour identifier vos points forts !'
      };

    case 'API_SYNC':
      return {
        icon: '🔄',
        title: 'Vos données sont synchronisées',
        description: (
          <>
            <p className="text-blue-600 font-semibold">Vos KPI sont mis à jour automatiquement.</p>
            <p className="mt-3 font-semibold">Consultez vos indicateurs en temps réel :</p>
            <ul className="list-disc list-inside space-y-1 mt-2 text-left mx-auto max-w-md">
              <li><strong>Panier Moyen</strong> : montant moyen par vente</li>
              <li><strong>Indice de Vente</strong> : articles par transaction</li>
              <li><strong>Taux de Transformation</strong> : visiteurs → acheteurs</li>
            </ul>
            <p className="mt-3">Pas de saisie manuelle — concentrez-vous sur la performance !</p>
          </>
        ),
        tips: 'Vos données se mettent à jour automatiquement depuis votre caisse.'
      };

    case 'VENDEUR_SAISIT':
    default:
      return {
        icon: '📊',
        title: 'Suivez vos performances terrain',
        description: (
          <>
            <p className="text-purple-600 font-semibold">Saisissez vos chiffres chaque jour.</p>
            <p className="mt-3 font-semibold">Consultez et saisissez vos KPIs :</p>
            <ul className="list-disc list-inside space-y-1 mt-2 text-left mx-auto max-w-md">
              <li><strong>Panier Moyen</strong> : montant moyen par vente</li>
              <li><strong>Indice de Vente</strong> : articles par transaction</li>
              <li><strong>Taux de Transformation</strong> : visiteurs → acheteurs</li>
            </ul>
            <p className="mt-3">La régularité de saisie garantit des analyses IA précises !</p>
          </>
        ),
        tips: 'Saisissez vos chiffres chaque jour pour un suivi optimal !'
      };
  }
}

/**
 * Étape finale adaptée selon le mode de saisie
 */
function getSellerFinalStep(mode) {
  const kpiAction = mode === 'VENDEUR_SAISIT'
    ? <li><strong>2.</strong> Saisissez vos chiffres du jour</li>
    : <li><strong>2.</strong> Consultez vos performances</li>;

  return {
    icon: '🎉',
    title: "C'est parti !",
    description: (
      <>
        <p className="text-green-600 font-semibold">Vous êtes prêt à utiliser Retail Performer AI !</p>
        <p className="mt-3 font-semibold">À faire maintenant :</p>
        <ul className="list-disc list-inside space-y-1 mt-2 text-left mx-auto max-w-md">
          <li><strong>1.</strong> Complétez votre diagnostic vendeur</li>
          {kpiAction}
          <li><strong>3.</strong> Découvrez vos conseils IA</li>
        </ul>
        <p className="mt-3">Relancez ce tutoriel via le bouton <strong>Tutoriel</strong> en haut.</p>
      </>
    ),
    tips: 'Bon courage et excellentes ventes ! 💪'
  };
}
