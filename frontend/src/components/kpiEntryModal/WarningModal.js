import React from 'react';
import { AlertTriangle } from 'lucide-react';

export default function WarningModal({ warnings, saving, onDismiss, onConfirm }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-[60]">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-orange-100 rounded-full">
            <AlertTriangle className="w-6 h-6 text-[#F97316]" />
          </div>
          <h3 className="text-xl font-bold text-gray-800">Valeurs inhabituelles détectées</h3>
        </div>

        <p className="text-gray-600 mb-4">
          Les données suivantes diffèrent significativement de votre moyenne sur 30 jours :
        </p>

        <div className="space-y-3 mb-6">
          {warnings.map((warning, index) => (
            <div key={`warning-${warning.kpi}-${warning.value}-${index}`} className="bg-orange-50 border border-orange-200 rounded-xl p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="font-semibold text-gray-800">{warning.kpi}</p>
                  <p className="text-sm text-gray-600 mt-1">
                    Valeur saisie : <span className="font-bold text-[#F97316]">{warning.value}</span>
                  </p>
                  <p className="text-sm text-gray-600">
                    Moyenne habituelle : <span className="font-medium">{warning.average}</span>
                  </p>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                  Number.parseFloat(warning.percentage) > 0 ? 'bg-orange-200 text-orange-800' : 'bg-blue-200 text-blue-800'
                }`}>
                  {warning.percentage > 0 ? '+' : ''}{warning.percentage}%
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <p className="text-sm text-blue-800">
            💡 Vérifiez que les valeurs sont correctes avant de confirmer.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onDismiss}
            className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-full hover:bg-gray-50 font-medium"
          >
            Corriger
          </button>
          <button
            onClick={onConfirm}
            disabled={saving}
            className="flex-1 py-3 bg-[#F97316] text-white rounded-full font-semibold hover:bg-[#F97316] disabled:opacity-50"
          >
            {saving ? 'Enregistrement...' : 'Confirmer'}
          </button>
        </div>
      </div>
    </div>
  );
}
