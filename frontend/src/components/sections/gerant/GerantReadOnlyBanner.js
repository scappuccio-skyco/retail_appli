import React from 'react';
import { Lock } from 'lucide-react';

const MESSAGES = {
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
 * Bannière mode lecture seule du dashboard gérant.
 * Différencie la fin de trial (jamais souscrit) et l'abo non renouvelé.
 */
export default function GerantReadOnlyBanner({ isReadOnly, subscriptionBlockCode, onOpenSubscription }) {
  if (!isReadOnly) return null;

  const msg = MESSAGES[subscriptionBlockCode] || MESSAGES.SUBSCRIPTION_INACTIVE;

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
