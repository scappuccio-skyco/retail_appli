import React, { useState } from 'react';
import { X, TrendingUp, BarChart3 } from 'lucide-react';

export default function PerformanceModal({ 
  isOpen, 
  onClose,
  bilanData,
  kpiEntries,
  user,
  onDataUpdate,
  onRegenerate,
  generatingBilan
}) {
  const [activeTab, setActiveTab] = useState('bilan'); // 'bilan' or 'kpi'

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header avec onglets */}
        <div className="border-b border-gray-200">
          <div className="flex items-center justify-between p-4 border-b border-gray-100">
            <h2 className="text-2xl font-bold text-gray-800">📊 Mes Performances</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          
          {/* Onglets */}
          <div className="flex">
            <button
              onClick={() => setActiveTab('bilan')}
              className={`flex-1 px-6 py-4 font-semibold transition-all border-b-2 ${
                activeTab === 'bilan'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-transparent text-gray-600 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <TrendingUp className="w-5 h-5" />
                <span>Mon Bilan</span>
              </div>
              <p className="text-xs mt-1 opacity-75">KPI hebdomadaires</p>
            </button>
            <button
              onClick={() => setActiveTab('kpi')}
              className={`flex-1 px-6 py-4 font-semibold transition-all border-b-2 ${
                activeTab === 'kpi'
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                  : 'border-transparent text-gray-600 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <BarChart3 className="w-5 h-5" />
                <span>Mes KPI</span>
              </div>
              <p className="text-xs mt-1 opacity-75">
                {kpiEntries?.length || 0} enregistré{kpiEntries?.length > 1 ? 's' : ''}
              </p>
            </button>
          </div>
        </div>

        {/* Contenu du modal selon l'onglet actif */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'bilan' && bilanData && (
            <div className="prose max-w-none">
              <h3 className="text-xl font-bold mb-4">Mon Bilan Hebdomadaire</h3>
              <div className="bg-blue-50 p-4 rounded-lg mb-4">
                <p className="text-gray-700">{bilanData.bilan_text || "Aucun bilan disponible"}</p>
              </div>
              {generatingBilan && (
                <div className="text-center text-gray-500">
                  <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                  Génération en cours...
                </div>
              )}
              {onRegenerate && (
                <button
                  onClick={onRegenerate}
                  disabled={generatingBilan}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  Régénérer le bilan
                </button>
              )}
            </div>
          )}
          
          {activeTab === 'kpi' && (
            <div>
              <h3 className="text-xl font-bold mb-4">Historique de mes KPI</h3>
              {kpiEntries && kpiEntries.length > 0 ? (
                <div className="space-y-4">
                  {kpiEntries.slice(0, 10).map((entry, index) => (
                    <div key={index} className="bg-white border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-semibold text-gray-800">{entry.date}</span>
                        <span className="text-sm text-gray-500">il y a {Math.floor(Math.random() * 30)} jours</span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>💰 CA: {entry.ca_journalier || 0}€</div>
                        <div>🛒 Ventes: {entry.nb_ventes || 0}</div>
                        <div>📦 Articles: {entry.nb_articles || 0}</div>
                        <div>🚶 Prospects: {entry.nb_prospects || 0}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">Aucun KPI enregistré pour le moment.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
