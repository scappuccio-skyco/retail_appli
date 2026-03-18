import React from 'react';
import { Lock, AlertTriangle } from 'lucide-react';

const BLOCK_MESSAGES = {
  TRIAL_EXPIRED: {
    title: 'Période d\'essai terminée',
    body: 'Votre équipe n\'a plus accès à l\'application. Souscrivez maintenant pour rétablir l\'accès.',
    cta: 'Souscrire',
  },
  SUBSCRIPTION_INACTIVE: {
    title: 'Abonnement expiré',
    body: 'Votre équipe n\'a plus accès à l\'application. Renouvelez votre abonnement pour rétablir l\'accès.',
    cta: 'Renouveler',
  },
};

/**
 * Bannière du dashboard gérant.
 * - isPastDue : paiement échoué, accès non bloqué, avertissement urgent
 * - isReadOnly : abonnement expiré ou trial terminé, accès bloqué
 */
export default function GerantReadOnlyBanner({
  isReadOnly,
  subscriptionBlockCode,
  onOpenSubscription,
  isPastDue,
  onOpenBillingPortal,
}) {
  if (isPastDue) {
    return (
      <div className="mb-4 sm:mb-6 bg-red-50 border-2 border-red-300 rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="p-2 bg-red-100 rounded-lg flex-shrink-0">
          <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-red-600" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-red-800">Échec de paiement</h3>
          <p className="text-red-700 text-sm">
            Le renouvellement de votre abonnement a échoué. Votre accès reste actif pendant que Stripe retente le prélèvement.
            Mettez à jour votre moyen de paiement pour éviter toute interruption de service.
          </p>
        </div>
        <button
          onClick={onOpenBillingPortal}
          className="px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors whitespace-nowrap"
        >
          Mettre à jour ma CB
        </button>
      </div>
    );
  }

  if (!isReadOnly) return null;

  const msg = BLOCK_MESSAGES[subscriptionBlockCode] || BLOCK_MESSAGES.SUBSCRIPTION_INACTIVE;

  return (
    <div className="mb-4 sm:mb-6 bg-amber-50 border-2 border-amber-300 rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
      <div className="p-2 bg-amber-100 rounded-lg flex-shrink-0">
        <Lock className="w-5 h-5 sm:w-6 sm:h-6 text-amber-600" />
      </div>
      <div className="flex-1">
        <h3 className="font-semibold text-amber-800">{msg.title}</h3>
        <p className="text-amber-700 text-sm">{msg.body}</p>
      </div>
      <button
        onClick={onOpenSubscription}
        className="px-4 py-2 bg-amber-500 text-white font-semibold rounded-lg hover:bg-amber-600 transition-colors whitespace-nowrap"
      >
        {msg.cta}
      </button>
    </div>
  );
}
