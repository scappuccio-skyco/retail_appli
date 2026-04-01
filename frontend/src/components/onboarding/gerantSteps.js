import React from 'react';

/**
 * Contenu des étapes d'onboarding pour le GÉRANT
 */

export const getGerantSteps = () => [
  // Étape 1 : Bienvenue
  {
    icon: '👋',
    title: 'Bienvenue dans votre espace Gérant',
    description: (
      <>
        <p className="text-blue-600 font-semibold">Vous pilotez l'ensemble de votre entreprise depuis cet espace.</p>
        <p className="mt-3 font-semibold">5 onglets à votre disposition :</p>
        <ul className="list-disc list-inside space-y-1 mt-2 text-left mx-auto max-w-md">
          <li><strong>Vue d'ensemble</strong> — tableau de bord multi-magasins</li>
          <li><strong>Magasins</strong> — créer et gérer chaque boutique</li>
          <li><strong>Personnel</strong> — inviter, gérer et transférer votre équipe</li>
          <li><strong>API</strong> — connecter vos outils externes</li>
          <li><strong>Profil</strong> — vos informations personnelles</li>
        </ul>
      </>
    ),
    tips: 'Ce tutoriel vous guide étape par étape. Vous pourrez le relancer à tout moment via le bouton "Tutoriel".'
  },

  // Étape 2 : Créer les magasins
  {
    icon: '🏪',
    title: 'Créez vos magasins',
    description: (
      <>
        <p className="text-orange-600 font-semibold">Commencez par créer vos boutiques dans l'onglet "Magasins".</p>
        <p className="mt-3 font-semibold">Pour chaque magasin vous renseignez :</p>
        <ul className="list-disc list-inside space-y-1 mt-2 text-left mx-auto max-w-md">
          <li>Nom, adresse, téléphone</li>
          <li>Horaires d'ouverture</li>
        </ul>
        <p className="mt-3 font-semibold">Depuis le détail d'un magasin vous pouvez :</p>
        <ul className="list-disc list-inside space-y-1 mt-1 text-left mx-auto max-w-md">
          <li>Voir les performances du magasin</li>
          <li>Voir l'équipe rattachée (managers et vendeurs)</li>
          <li>Définir le contexte métier de la boutique</li>
        </ul>
      </>
    ),
    tips: 'Vous pouvez modifier ou supprimer un magasin à tout moment depuis l\'onglet "Magasins".'
  },

  // Étape 3 : Contexte métier IA
  {
    icon: '🤖',
    title: 'Configurez le contexte métier de chaque boutique',
    description: (
      <>
        <p className="text-purple-600 font-semibold">C'est la fonctionnalité la plus puissante : elle personnalise toute l'IA.</p>
        <p className="mt-3">Depuis le tableau de bord, cliquez sur ⚙️ à côté d'un magasin pour renseigner :</p>
        <ul className="list-disc list-inside space-y-1 mt-2 text-left mx-auto max-w-md">
          <li>Type de commerce, positionnement prix, format</li>
          <li>Clientèle cible, durée moyenne d'une vente</li>
          <li>KPI prioritaires de la boutique</li>
          <li>Saisonnalité et contexte libre</li>
        </ul>
        <p className="mt-3 text-sm text-gray-600">Vous pouvez aussi appliquer un contexte à <strong>plusieurs magasins en même temps</strong> via la sélection multiple.</p>
      </>
    ),
    tips: 'Plus le contexte est précis, plus les analyses IA (briefs, bilans, recommandations) seront pertinentes pour chaque boutique.'
  },

  // Étape 4 : Tableau de bord & performances
  {
    icon: '📊',
    title: 'Pilotez vos performances multi-magasins',
    description: (
      <>
        <p className="text-blue-600 font-semibold">La Vue d'ensemble vous donne une lecture globale en temps réel.</p>
        <p className="mt-3 font-semibold">Ce que vous voyez :</p>
        <ul className="list-disc list-inside space-y-1 mt-2 text-left mx-auto max-w-md">
          <li>CA total, classement des magasins, évolution</li>
          <li>Panier moyen, taux de transformation, prospects</li>
          <li>Nombre de managers et vendeurs par boutique</li>
        </ul>
        <p className="mt-3 font-semibold">Ce que vous pouvez faire :</p>
        <ul className="list-disc list-inside space-y-1 mt-1 text-left mx-auto max-w-md">
          <li>Filtrer par <strong>semaine, mois ou année</strong> avec navigation dans le temps</li>
          <li>Sélectionner plusieurs magasins et agir en masse</li>
          <li><strong>Exporter le tableau en PDF</strong></li>
        </ul>
      </>
    ),
    tips: 'Les données sont saisies par les managers de chaque magasin. Utilisez les filtres de période pour comparer des semaines ou des mois passés.'
  },

  // Étape 5 : Gérer l'équipe
  {
    icon: '👥',
    title: 'Gérez votre équipe',
    description: (
      <>
        <p className="text-blue-600 font-semibold">L'onglet "Personnel" centralise toute la gestion RH.</p>
        <p className="mt-3 font-semibold">Vos actions :</p>
        <ul className="list-disc list-inside space-y-1 mt-2 text-left mx-auto max-w-md">
          <li><strong>Inviter</strong> un manager ou un vendeur par email</li>
          <li><strong>Transférer</strong> un membre vers un autre magasin</li>
          <li><strong>Suspendre / réactiver</strong> un compte</li>
          <li><strong>Modifier</strong> les informations d'un utilisateur</li>
          <li><strong>Supprimer</strong> un compte définitivement</li>
          <li>Annuler une invitation en attente</li>
        </ul>
      </>
    ),
    tips: "Chaque invitation génère un lien unique envoyé par email. Un manager peut être assigné à plusieurs magasins."
  },

  // Étape 6 : API
  {
    icon: '🔑',
    title: 'Connectez vos outils via l\'API',
    description: (
      <>
        <p className="text-indigo-600 font-semibold">L'onglet "API" vous permet d'intégrer Retail Performer AI à vos propres outils.</p>
        <p className="mt-3 font-semibold">Vous pouvez :</p>
        <ul className="list-disc list-inside space-y-1 mt-2 text-left mx-auto max-w-md">
          <li>Créer des <strong>clés API</strong> avec permissions et date d'expiration</li>
          <li>Désactiver ou réactiver une clé</li>
          <li>Consulter la <strong>documentation complète</strong> (endpoints, exemples JS/Node)</li>
        </ul>
        <p className="mt-3 text-sm text-gray-600">Idéal pour envoyer des données depuis votre logiciel de caisse ou votre CRM.</p>
      </>
    ),
    tips: 'Chaque clé API est liée à votre espace. Ne la partagez pas publiquement — vous pouvez la désactiver à tout moment.'
  },

  // Étape 7 : Abonnement & Facturation
  {
    icon: '💳',
    title: 'Gérez votre abonnement et votre facturation',
    description: (
      <>
        <p className="text-green-600 font-semibold">Les boutons "Mon abonnement" et "Facturation" en haut de page centralisent tout.</p>
        <p className="mt-3 font-semibold">Abonnement :</p>
        <ul className="list-disc list-inside space-y-1 mt-1 text-left mx-auto max-w-md">
          <li>Plan actuel, nombre de sièges utilisés</li>
          <li>Changer de formule (upgrade / downgrade)</li>
        </ul>
        <p className="mt-3 font-semibold">Facturation :</p>
        <ul className="list-disc list-inside space-y-1 mt-1 text-left mx-auto max-w-md">
          <li>Profil B2B (raison sociale, TVA, adresse de facturation)</li>
          <li>Historique des factures téléchargeables</li>
        </ul>
      </>
    ),
    tips: 'Les sièges s\'ajustent en fonction de votre équipe active (managers + vendeurs). Les comptes suspendus ne comptent pas.'
  },
];
