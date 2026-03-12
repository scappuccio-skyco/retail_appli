import React from 'react';
import { Lock } from 'lucide-react';

/**
 * Bannière mode lecture seule du dashboard gérant.
 */
export default function GerantReadOnlyBanner({ isReadOnly, onOpenSubscription }) {
  if (!isReadOnly) return null;

  return (
    <div className="mb-4 sm:mb-6 bg-amber-50 border-2 border-amber-300 rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
      <div className="p-2 bg-amber-100 rounded-lg flex-shrink-0">
        <Lock className="w-5 h-5 sm:w-6 sm:h-6 text-amber-600" />
      </div>
      <div className="flex-1">
        <h3 className="font-semibold text-amber-800">Mode lecture seule</h3>
        <p className="text-amber-700 text-sm">
          Votre période d'essai est terminée. Souscrivez à un abonnement pour débloquer toutes les fonctionnalités.
        </p>
      </div>
      <button
        onClick={onOpenSubscription}
        className="px-4 py-2 bg-amber-500 text-white font-semibold rounded-lg hover:bg-amber-600 transition-colors"
      >
        Voir les offres
      </button>
    </div>
  );
}
