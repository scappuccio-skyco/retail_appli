import React from 'react';

/**
 * Bannière abonnement suspendu du dashboard manager.
 */
export default function ManagerStatusBanner({ isSubscriptionExpired }) {
  if (!isSubscriptionExpired) return null;

  return (
    <div className="max-w-7xl mx-auto mb-4">
      <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 flex items-center gap-3">
        <div className="p-1.5 bg-amber-100 rounded-lg">
          <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <p className="text-amber-800 text-sm flex-1">
          <strong>Abonnement magasin suspendu</strong> - La saisie des KPIs et les modifications d'équipe sont temporairement désactivées. Contactez votre gérant.
        </p>
      </div>
    </div>
  );
}
