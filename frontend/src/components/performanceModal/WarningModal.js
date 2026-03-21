import React from 'react';
import { AlertTriangle } from 'lucide-react';

export default function WarningModal({ warnings, onCancel, onConfirm }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <div className="flex items-start gap-3 mb-4">
          <AlertTriangle className="w-6 h-6 text-amber-500 flex-shrink-0 mt-1" />
          <div>
            <h3 className="text-lg font-bold text-gray-800 mb-2">⚠️ Valeurs inhabituelles détectées</h3>
            <p className="text-sm text-gray-600 mb-4">
              Les données saisies sont significativement différentes de votre moyenne habituelle :
            </p>
          </div>
        </div>

        <div className="space-y-3 mb-6">
          {warnings.map((warning, index) => (
            <div key={index} className="bg-amber-50 rounded-lg p-3 border-l-4 border-amber-400">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-gray-800">{warning.kpi}</span>
                <span className={`text-sm font-bold ${
                  Number.parseFloat(warning.percentage) > 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {warning.percentage > 0 ? '+' : ''}{warning.percentage}%
                </span>
              </div>
              <div className="text-sm text-gray-600 mt-1">
                <div>Valeur saisie : <span className="font-semibold">{warning.value}</span></div>
                <div>Moyenne habituelle : <span className="font-semibold">{warning.average}</span></div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-all"
          >
            ❌ Annuler
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2 bg-orange-600 text-white font-semibold rounded-lg hover:bg-orange-700 transition-all"
          >
            ✅ Confirmer quand même
          </button>
        </div>
      </div>
    </div>
  );
}
