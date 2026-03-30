import React from 'react';

/**
 * Contenu des étapes d'onboarding pour le VENDEUR
 * Adaptatif selon le mode de saisie KPI
 */

export const getSellerSteps = (kpiMode = 'VENDEUR_SAISIT', callbacks = {}) => {
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
      tips: 'Soyez honnête dans vos réponses, personne ne vous jugera !',
      ...(callbacks.openDiagnostic && { actionLabel: 'Ouvrir mon diagnostic', onAction: callbacks.openDiagnostic }),
    },

    // Étape 3 : Saisie KPI — explication des 4 cas possibles
    {
      icon: '📊',
      title: 'Suivez vos performances',
      description: (
        <>
          <p className="text-purple-600 font-semibold">Comment fonctionnent vos KPIs ?</p>
          <p className="mt-3 font-semibold">Cela dépend de votre configuration — 4 cas possibles :</p>
          <ul className="list-disc list-inside space-y-2 mt-2 text-left mx-auto max-w-md">
            <li><strong>Vous saisissez</strong> : vous entrez vos chiffres chaque jour dans la carte <strong>"Mes Performances"</strong></li>
            <li><strong>Votre manager saisit</strong> : vos KPIs sont renseignés par votre responsable, consultez-les dans <strong>"Mes Performances"</strong></li>
            <li><strong>Les deux</strong> : vous et votre manager contribuez à la saisie</li>
            <li><strong>Automatique</strong> : vos données sont synchronisées depuis votre caisse ou logiciel de vente</li>
          </ul>
          <p className="mt-3 text-orange-600 font-medium">👉 En cas de doute, demandez à votre manager quel mode est activé pour vous.</p>
        </>
      ),
      tips: 'Peu importe le mode, retrouvez toujours vos performances dans la carte orange "Mes Performances".',
      ...(callbacks.openKPI && { actionLabel: 'Saisir mes chiffres du jour', onAction: callbacks.openKPI }),
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
      tips: 'Plus vous avez de données enregistrées, meilleurs sont les conseils !'
    },

    // Étape 5 : Challenges
    {
      icon: '🎖️',
      title: 'Relevez les challenges',
      description: (
        <>
          <p className="text-purple-600 font-semibold">Rendez votre travail plus fun !</p>
          <p className="mt-3 font-semibold">Comment accéder aux défis :</p>
          <ul className="list-disc list-inside space-y-1 mt-2 text-left mx-auto max-w-md">
            <li>Cliquez sur la carte violette <strong>"Mon coach IA"</strong></li>
            <li>Onglet <strong>"Mon défi du jour"</strong></li>
            <li>Recevez un défi quotidien personnalisé selon vos compétences</li>
            <li>Validez vos défis pour suivre votre progression</li>
          </ul>
        </>
      ),
      tips: 'Les défis quotidiens rendent le travail plus motivant !'
    },

    // Étape 6 : Finir (ADAPTATIF)
    getSellerFinalStep(kpiMode)
  ];

  return steps;
};

/**
 * Étape KPI adaptée selon le mode de saisie
 */
function getSellerKpiStep(mode, callbacks = {}) {
  switch (mode) {
    case 'MANAGER_SAISIT':
      return {
        icon: '📊',
        title: 'Suivez vos performances',
        description: (
          <>
            <p className="text-purple-600 font-semibold">Votre manager saisit les chiffres pour vous.</p>
            <p className="mt-3 font-semibold">Comment consulter vos KPIs :</p>
            <ul className="list-disc list-inside space-y-1 mt-2 text-left mx-auto max-w-md">
              <li>Cliquez sur la carte orange <strong>"Mes Performances"</strong></li>
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
              <li>Cliquez sur la carte orange <strong>"Mes Performances"</strong></li>
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
            <p className="mt-3 font-semibold">Comment faire :</p>
            <ul className="list-disc list-inside space-y-1 mt-2 text-left mx-auto max-w-md">
              <li>Cliquez sur la carte orange <strong>"Mes Performances"</strong></li>
              <li>Onglet <strong>"Saisir mes KPIs"</strong> pour entrer vos chiffres</li>
              <li><strong>Panier Moyen</strong>, <strong>Indice de Vente</strong>, <strong>Taux de Transformation</strong></li>
            </ul>
            <p className="mt-3">La régularité de saisie garantit des analyses IA précises !</p>
          </>
        ),
        tips: 'Saisissez vos chiffres chaque jour pour un suivi optimal !',
        ...(callbacks.openKPI && { actionLabel: 'Saisir mes chiffres du jour', onAction: callbacks.openKPI }),
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
