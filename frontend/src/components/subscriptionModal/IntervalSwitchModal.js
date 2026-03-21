import React from 'react';
import { Loader, Star, Check } from 'lucide-react';

export default function IntervalSwitchModal({
  showIntervalSwitchModal,
  intervalSwitchPreview,
  switchingInterval,
  setShowIntervalSwitchModal,
  setIntervalSwitchPreview,
  handleConfirmIntervalSwitch,
}) {
  if (!showIntervalSwitchModal || !intervalSwitchPreview) return null;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget && !switchingInterval) {
          setShowIntervalSwitchModal(false);
          setIntervalSwitchPreview(null);
        }
      }}
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] backdrop-blur-sm"
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-green-500 to-emerald-600 text-white">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Star className="w-6 h-6" />
            Passer à l'abonnement annuel ?
          </h3>
          <p className="text-green-100 text-sm mt-1">Économisez 20% sur votre abonnement</p>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Current vs New */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-100 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500 mb-1">Actuellement</p>
              <p className="text-lg font-bold text-gray-700">
                {intervalSwitchPreview.current_monthly_cost}€/mois
              </p>
              <p className="text-xs text-gray-500">
                {intervalSwitchPreview.current_monthly_cost * 12}€/an
              </p>
            </div>
            <div className="bg-green-100 rounded-lg p-3 text-center border-2 border-green-400">
              <p className="text-xs text-green-600 mb-1">🎉 Annuel</p>
              <p className="text-lg font-bold text-green-700">
                {Math.round(intervalSwitchPreview.new_yearly_cost / 12)}€/mois
              </p>
              <p className="text-xs text-green-600 font-semibold">
                {intervalSwitchPreview.new_yearly_cost}€/an
              </p>
            </div>
          </div>

          {/* Savings highlight */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-700">💰 Vos économies</span>
              <span className="text-xl font-black text-green-600">
                {Math.round((intervalSwitchPreview.current_monthly_cost * 12) - intervalSwitchPreview.new_yearly_cost)}€/an
              </span>
            </div>
            <p className="text-xs text-gray-600">
              Soit {Math.round(((intervalSwitchPreview.current_monthly_cost * 12) - intervalSwitchPreview.new_yearly_cost) / 12)}€/mois économisés
            </p>
          </div>

          {/* Proration Info */}
          {intervalSwitchPreview.proration_estimate > 0 && !intervalSwitchPreview.is_trial && (
            <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
              <p className="text-sm font-semibold text-blue-800 mb-1">💳 Paiement immédiat</p>
              <p className="text-2xl font-black text-blue-600">
                {intervalSwitchPreview.proration_estimate.toFixed(2)}€
              </p>
              <p className="text-xs text-blue-600 mt-1">
                {intervalSwitchPreview.proration_description}
              </p>
            </div>
          )}

          {intervalSwitchPreview.is_trial && (
            <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
              <p className="text-sm text-amber-800">
                💡 Vous êtes en période d'essai. Le paiement sera effectué à la fin de l'essai.
              </p>
            </div>
          )}

          {/* Features */}
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs font-semibold text-gray-600 mb-2">✨ Inclus avec l'annuel :</p>
            <ul className="text-xs text-gray-600 space-y-1">
              <li className="flex items-center gap-2">
                <Check className="w-3 h-3 text-green-500" />
                20% d'économie garantie
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3 h-3 text-green-500" />
                Prix bloqué pendant 1 an
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3 h-3 text-green-500" />
                Support prioritaire
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 flex gap-3">
          <button
            onClick={() => {
              setShowIntervalSwitchModal(false);
              setIntervalSwitchPreview(null);
            }}
            disabled={switchingInterval}
            className="flex-1 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-all disabled:opacity-50"
          >
            Rester en mensuel
          </button>
          <button
            onClick={handleConfirmIntervalSwitch}
            disabled={switchingInterval}
            className="flex-1 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {switchingInterval ? (
              <>
                <Loader className="w-5 h-5 animate-spin" />
                Traitement...
              </>
            ) : (
              <>
                <Star className="w-5 h-5" />
                Passer à l'annuel
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
