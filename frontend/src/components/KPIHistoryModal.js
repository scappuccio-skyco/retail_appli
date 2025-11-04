import React, { useState } from 'react';
import { X, BarChart3, Plus } from 'lucide-react';

export default function KPIHistoryModal({ kpiEntries, kpiConfig, onClose, onNewKPI, onEditKPI }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-500 to-blue-600 p-6 flex justify-between items-center border-b border-gray-200 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-white" />
            <h2 className="text-3xl font-bold text-white">📊 Historique de mes KPI</h2>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-colors"
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
                  className="w-full bg-gradient-to-r from-[#ffd871] to-yellow-300 text-gray-800 font-bold py-4 px-6 rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  ✨ Saisir un nouveau KPI
                </button>
              </div>

              {/* Liste des KPI */}
              <div className="space-y-4">
                {kpiEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="bg-white rounded-xl p-4 border-2 border-gray-200 hover:shadow-md transition-all"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="text-sm text-gray-500 mb-1">
                          🗓️ {new Date(entry.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                      </div>
                      <button
                        onClick={() => onEditKPI(entry)}
                        className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Modifier
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {kpiConfig?.track_ca && (
                        <div className="bg-blue-50 rounded-lg p-3">
                          <p className="text-xs text-blue-600 mb-1">💰 CA</p>
                          <p className="text-lg font-bold text-blue-900">{entry.ca_journalier?.toFixed(2)}€</p>
                        </div>
                      )}
                      {kpiConfig?.track_ventes && (
                        <div className="bg-green-50 rounded-lg p-3">
                          <p className="text-xs text-green-600 mb-1">🛒 Ventes</p>
                          <p className="text-lg font-bold text-green-900">{entry.nb_ventes}</p>
                        </div>
                      )}
                      {kpiConfig?.track_clients && (
                        <div className="bg-purple-50 rounded-lg p-3">
                          <p className="text-xs text-purple-600 mb-1">👥 Clients</p>
                          <p className="text-lg font-bold text-purple-900">{entry.nb_clients}</p>
                        </div>
                      )}
                      {kpiConfig?.track_articles && (
                        <div className="bg-orange-50 rounded-lg p-3">
                          <p className="text-xs text-orange-600 mb-1">📦 Articles</p>
                          <p className="text-lg font-bold text-orange-900">{entry.nb_articles || 0}</p>
                        </div>
                      )}
                    </div>

                    {/* KPI Calculés */}
                    {((kpiConfig?.track_ca && kpiConfig?.track_ventes) || 
                      (kpiConfig?.track_ventes && kpiConfig?.track_clients) || 
                      (kpiConfig?.track_articles && kpiConfig?.track_clients)) && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <p className="text-xs text-gray-500 mb-2 font-semibold">KPI Calculés :</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {kpiConfig?.track_ca && kpiConfig?.track_ventes && (
                            <div className="bg-indigo-50 rounded-lg p-2">
                              <p className="text-xs text-indigo-600 mb-0.5">🧮 Panier Moyen</p>
                              <p className="text-sm font-bold text-indigo-900">{entry.panier_moyen?.toFixed(2)}€</p>
                            </div>
                          )}
                          {kpiConfig?.track_ventes && kpiConfig?.track_clients && (
                            <div className="bg-pink-50 rounded-lg p-2">
                              <p className="text-xs text-pink-600 mb-0.5">📊 Taux Transfo</p>
                              <p className="text-sm font-bold text-pink-900">{entry.taux_transformation?.toFixed(2)}%</p>
                            </div>
                          )}
                          {kpiConfig?.track_articles && kpiConfig?.track_clients && (
                            <div className="bg-teal-50 rounded-lg p-2">
                              <p className="text-xs text-teal-600 mb-0.5">🎯 Indice Vente</p>
                              <p className="text-sm font-bold text-teal-900">{entry.indice_vente?.toFixed(2)}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📊</div>
              <p className="text-gray-500 font-medium mb-4">Aucun KPI enregistré pour le moment</p>
              <p className="text-gray-400 text-sm mb-6">Commencez à suivre vos performances !</p>
              <button
                onClick={onNewKPI}
                className="btn-primary inline-flex items-center gap-2"
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
