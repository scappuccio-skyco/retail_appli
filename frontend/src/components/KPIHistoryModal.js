import React, { useState, useMemo } from 'react';
import { X, BarChart3, Plus } from 'lucide-react';

export default function KPIHistoryModal({ kpiEntries, kpiConfig, onClose, onNewKPI, onEditKPI }) {
  const [displayLimit, setDisplayLimit] = useState(20); // Afficher 20 KPI à la fois

  // Trier les KPI par date (plus récents en premier) et limiter l'affichage
  const sortedAndLimitedKPIs = useMemo(() => {
    const sorted = [...kpiEntries].sort((a, b) => new Date(b.date) - new Date(a.date));
    return sorted.slice(0, displayLimit);
  }, [kpiEntries, displayLimit]);

  const hasMore = displayLimit < kpiEntries.length;
  const remainingCount = kpiEntries.length - displayLimit;

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) { onClose(); } }} className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-6 flex justify-between items-center rounded-t-2xl flex-shrink-0">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-7 h-7 text-white" />
            <div>
              <h2 className="text-2xl font-bold text-white">📊 Historique de mes KPI</h2>
              <p className="text-sm text-white/80 mt-0.5">
                {displayLimit >= kpiEntries.length
                  ? `${kpiEntries.length} entrée${kpiEntries.length > 1 ? 's' : ''} affichée${kpiEntries.length > 1 ? 's' : ''}`
                  : `Affichage de ${displayLimit} sur ${kpiEntries.length} entrées`
                }
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {kpiEntries.length > 0 ? (
            <>
              {/* Bouton Nouveau KPI en haut */}
              <div className="mb-6">
                <button
                  onClick={onNewKPI}
                  className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold py-3 px-6 rounded-xl hover:from-orange-600 hover:to-orange-700 hover:shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  ✨ Saisir un nouveau KPI
                </button>
              </div>

              {/* Liste des KPI */}
              <div className="space-y-4">
                {sortedAndLimitedKPIs.map((entry) => (
                  <div
                    key={entry.id}
                    className="bg-white rounded-xl p-4 border-2 border-gray-200 hover:shadow-md hover:border-orange-200 transition-all"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-700">
                          🗓️ {new Date(entry.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                      </div>
                      <button
                        onClick={() => onEditKPI(entry)}
                        className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Modifier
                      </button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {kpiConfig?.track_ca && (
                        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-3 border border-blue-200">
                          <p className="text-xs text-blue-700 font-semibold mb-1">💰 CA</p>
                          <p className="text-lg font-bold text-blue-900">{entry.ca_journalier?.toFixed(2)}€</p>
                        </div>
                      )}
                      {kpiConfig?.track_ventes && (
                        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-3 border border-green-200">
                          <p className="text-xs text-green-700 font-semibold mb-1">🛒 Ventes</p>
                          <p className="text-lg font-bold text-green-900">{entry.nb_ventes}</p>
                        </div>
                      )}
                      {kpiConfig?.track_articles && (
                        <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-3 border border-orange-200">
                          <p className="text-xs text-orange-700 font-semibold mb-1">📦 Articles</p>
                          <p className="text-lg font-bold text-orange-900">{entry.nb_articles || 0}</p>
                        </div>
                      )}
                    </div>

                    {/* KPI Calculés */}
                    {((kpiConfig?.track_ca && kpiConfig?.track_ventes) ||
                      (kpiConfig?.track_articles && kpiConfig?.track_ventes)) && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <p className="text-xs text-gray-500 mb-2 font-semibold">KPI Calculés :</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {kpiConfig?.track_ca && kpiConfig?.track_ventes && (
                            <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-lg p-2 border border-indigo-200">
                              <p className="text-xs text-indigo-700 font-semibold mb-0.5">🧮 Panier Moyen</p>
                              <p className="text-sm font-bold text-indigo-900">{entry.panier_moyen?.toFixed(2)}€</p>
                            </div>
                          )}
                          {kpiConfig?.track_articles && kpiConfig?.track_ventes && (
                            <div className="bg-gradient-to-br from-teal-50 to-teal-100 rounded-lg p-2 border border-teal-200">
                              <p className="text-xs text-teal-700 font-semibold mb-0.5">🎯 Indice Vente</p>
                              <p className="text-sm font-bold text-teal-900">{entry.indice_vente?.toFixed(2)}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Bouton Charger plus */}
              {hasMore && (
                <div className="mt-6 text-center">
                  <button
                    onClick={() => setDisplayLimit(prev => prev + 20)}
                    className="px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold rounded-xl transition-all shadow-md hover:shadow-lg inline-flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                    Charger plus ({remainingCount} KPI restant{remainingCount > 1 ? 's' : ''})
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📊</div>
              <p className="text-gray-500 font-medium mb-4">Aucun KPI enregistré pour le moment</p>
              <p className="text-gray-400 text-sm mb-6">Commencez à suivre vos performances !</p>
              <button
                onClick={onNewKPI}
                className="bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold px-6 py-3 rounded-xl hover:from-orange-600 hover:to-orange-700 transition-all shadow-md inline-flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Saisir mon premier KPI
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
