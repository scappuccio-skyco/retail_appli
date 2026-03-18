import React from 'react';

const BLOCK_MESSAGES = {
  TRIAL_EXPIRED: {
    title: 'Accès suspendu',
    body: "La période d'essai de votre espace a expiré.",
    hint: 'Contactez votre gérant pour souscrire à un abonnement.',
  },
  SUBSCRIPTION_INACTIVE: {
    title: 'Accès suspendu',
    body: "L'abonnement de votre espace a expiré.",
    hint: 'Contactez votre gérant pour renouveler l\'abonnement.',
  },
};

/**
 * Bannières d'état du dashboard vendeur.
 * - Rouge (accessDenied403 / subscriptionBlockCode) : accès totalement bloqué
 * - Ambre (isSubscriptionExpired uniquement) : abonnement suspendu, saisie désactivée
 */
export default function SellerStatusBanners({ accessDenied403, subscriptionBlockCode, isSubscriptionExpired }) {
  if (!accessDenied403 && !isSubscriptionExpired) return null;

  if (accessDenied403) {
    const msg = BLOCK_MESSAGES[subscriptionBlockCode] || BLOCK_MESSAGES.SUBSCRIPTION_INACTIVE;
    return (
      <div className="max-w-7xl mx-auto mb-4 space-y-3">
        <div className="bg-red-50 border border-red-300 rounded-xl p-4 flex items-start gap-3">
          <div className="p-2 bg-red-100 rounded-lg flex-shrink-0">
            <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-red-800 font-semibold">{msg.title}</p>
            <p className="text-red-700 text-sm mt-0.5">{msg.body}</p>
            <p className="text-red-600 text-xs mt-2">{msg.hint}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto mb-4 space-y-3">
      <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 flex items-center gap-3">
        <div className="p-1.5 bg-amber-100 rounded-lg">
          <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <p className="text-amber-800 text-sm flex-1">
          <strong>Abonnement suspendu</strong> — La saisie des KPIs est temporairement désactivée. Contactez votre gérant.
        </p>
      </div>
    </div>
  );
}
