import React from 'react';

export default function SeatsConfirmModal({
  showConfirmModal,
  confirmData,
  setShowConfirmModal,
  setConfirmData,
  adjustingSeats,
  handleChangeSeats,
}) {
  if (!showConfirmModal || !confirmData) return null;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setShowConfirmModal(false);
          setConfirmData(null);
        }
      }}
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] backdrop-blur-sm"
    >
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header - Compact */}
        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-4 text-white">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <span>📊</span>
            Confirmer la modification
          </h3>
        </div>

        {/* Content - Compact */}
        <div className="p-4 space-y-3">
          {/* Action Type */}
          <div className={`rounded-lg p-3 text-center border-2 ${
            confirmData.isIncrease ? 'bg-green-50 border-green-300' : 'bg-orange-50 border-orange-300'
          }`}>
            <p className="text-xl font-black">
              {confirmData.action} de {confirmData.diff} siège{confirmData.diff > 1 ? 's' : ''}
            </p>
          </div>

          {/* Comparison - Compact */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-100 rounded-lg p-3 text-center border border-gray-300">
              <p className="text-xs text-gray-600 font-semibold">Actuellement</p>
              <p className="text-3xl font-black text-gray-800">{confirmData.currentSeats}</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 text-center border border-blue-400">
              <p className="text-xs text-blue-700 font-semibold">Nouveau</p>
              <p className="text-3xl font-black text-blue-900">{confirmData.newSeats}</p>
            </div>
          </div>

          {/* Pricing Details */}
          <div className={`rounded-lg p-3 border ${
            confirmData.isIncrease ? 'bg-blue-50 border-blue-200' : 'bg-purple-50 border-purple-200'
          }`}>
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-semibold">
                {confirmData.isIncrease ? '💳 Montant facturé' : '💰 Crédit appliqué'}
              </p>
              <p className="text-lg font-black">
                {confirmData.isIncrease ? '+' : '-'}{confirmData.estimatedAmount.toFixed(2)}€
              </p>
            </div>
            <p className="text-xs text-gray-600">
              Prorata {confirmData.isIncrease ? 'ajouté à' : 'déduit de'} votre prochaine facture
            </p>
          </div>

          {/* Warning - Compact */}
          <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-2">
            <p className="text-xs text-yellow-800 flex items-center gap-1">
              <span>⚠️</span>
              La page se rechargera après validation
            </p>
          </div>
        </div>

        {/* Footer - Compact */}
        <div className="bg-gray-50 p-3 border-t flex gap-2">
          <button
            onClick={() => {
              setShowConfirmModal(false);
              setConfirmData(null);
            }}
            className="flex-1 py-2 bg-white border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-100 transition-all text-sm"
          >
            Annuler
          </button>
          <button
            onClick={() => {
              setShowConfirmModal(false);
              handleChangeSeats(confirmData.newSeats);
            }}
            className="flex-1 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all shadow-md text-sm"
          >
            Confirmer
          </button>
        </div>
      </div>
    </div>
  );
}
