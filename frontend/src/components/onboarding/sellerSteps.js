import React from 'react';

/**
 * Contenu des étapes d'onboarding pour le VENDEUR
 * Présentation alignée avec le tutoriel Gérant
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

    // Étape 3 : Performances
    {
      icon: '📊',
      title: 'Suivez vos performances terrain',
      description: (
        <>
          <p className="text-purple-600 font-semibold">Analysez vos indicateurs clés chaque jour.</p>
          <p className="mt-3 font-semibold">Consultez vos KPIs :</p>
          <ul className="list-disc list-inside space-y-1 mt-2 text-left mx-auto max-w-md">
            <li><strong>Panier Moyen</strong> : montant moyen par vente</li>
            <li><strong>Indice de Vente</strong> : articles par transaction</li>
            <li><strong>Taux de Transformation</strong> : visiteurs → acheteurs</li>
          </ul>
          <p className="mt-3">Progressez jour après jour en analysant vos résultats !</p>
        </>
      ),
      tips: 'Utilisez les graphiques pour identifier vos points forts !'
    },

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
      tips: 'Plus vous avez de données saisies, meilleurs sont les conseils !'
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

    // Étape 6 : Finir
    {
      icon: '🎉',
      title: 'C\'est parti !',
      description: (
        <>
          <p className="text-green-600 font-semibold">Vous êtes prêt à utiliser Retail Performer AI !</p>
          <p className="mt-3 font-semibold">À faire maintenant :</p>
          <ul className="list-disc list-inside space-y-1 mt-2 text-left mx-auto max-w-md">
            <li><strong>1.</strong> Complétez votre diagnostic vendeur</li>
            <li><strong>2.</strong> Consultez vos performances</li>
            <li><strong>3.</strong> Découvrez vos conseils IA</li>
          </ul>
          <p className="mt-3">Relancez ce tutoriel via le bouton <strong>Tutoriel</strong> en haut.</p>
        </>
      ),
      tips: 'Bon courage et excellentes ventes ! 💪'
    }
  ];

  return steps;
};
