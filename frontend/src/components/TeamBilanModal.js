import React, { useState } from 'react';
import { Sparkles, X, TrendingUp, AlertTriangle, Target, MessageSquare } from 'lucide-react';

export default function TeamBilanModal({ bilan, onClose }) {
  if (!bilan) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl my-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#ffd871] to-yellow-300 p-6 rounded-t-2xl relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-700 hover:text-gray-900 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-gray-800" />
            <div>
              <h2 className="text-2xl font-bold text-gray-800">🤖 Bilan IA de l'équipe</h2>
              <p className="text-sm text-gray-700">{bilan.periode}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {/* KPI Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {bilan.kpi_resume.ca_total !== undefined && (
              <div className="bg-blue-50 rounded-lg p-3">
                <p className="text-xs text-blue-600 mb-1">💰 CA</p>
                <p className="text-lg font-bold text-blue-900">{bilan.kpi_resume.ca_total.toFixed(0)}€</p>
              </div>
            )}
            {bilan.kpi_resume.ventes !== undefined && (
              <div className="bg-green-50 rounded-lg p-3">
                <p className="text-xs text-green-600 mb-1">🛒 Ventes</p>
                <p className="text-lg font-bold text-green-900">{bilan.kpi_resume.ventes}</p>
              </div>
            )}
            {bilan.kpi_resume.clients !== undefined && (
              <div className="bg-purple-50 rounded-lg p-3">
                <p className="text-xs text-purple-600 mb-1">👥 Clients</p>
                <p className="text-lg font-bold text-purple-900">{bilan.kpi_resume.clients}</p>
              </div>
            )}
            {bilan.kpi_resume.articles !== undefined && (
              <div className="bg-orange-50 rounded-lg p-3">
                <p className="text-xs text-orange-600 mb-1">📦 Articles</p>
                <p className="text-lg font-bold text-orange-900">{bilan.kpi_resume.articles}</p>
              </div>
            )}
            {bilan.kpi_resume.panier_moyen !== undefined && (
              <div className="bg-indigo-50 rounded-lg p-3">
                <p className="text-xs text-indigo-600 mb-1">💳 P. Moyen</p>
                <p className="text-lg font-bold text-indigo-900">{bilan.kpi_resume.panier_moyen.toFixed(0)}€</p>
              </div>
            )}
            {bilan.kpi_resume.taux_transformation !== undefined && (
              <div className="bg-pink-50 rounded-lg p-3">
                <p className="text-xs text-pink-600 mb-1">📈 Taux Transfo</p>
                <p className="text-lg font-bold text-pink-900">{bilan.kpi_resume.taux_transformation.toFixed(0)}%</p>
              </div>
            )}
            {bilan.kpi_resume.indice_vente !== undefined && (
              <div className="bg-teal-50 rounded-lg p-3">
                <p className="text-xs text-teal-600 mb-1">🎯 Indice</p>
                <p className="text-lg font-bold text-teal-900">{bilan.kpi_resume.indice_vente.toFixed(1)}</p>
              </div>
            )}
          </div>
              <p className="text-lg font-bold text-pink-900">{bilan.kpi_resume.taux_transformation.toFixed(1)}%</p>
            </div>
          </div>

          {/* Synthèse */}
          <div className="bg-gradient-to-r from-[#ffd871] to-yellow-200 rounded-xl p-4 mb-4">
            <p className="text-gray-800 font-medium">{bilan.synthese}</p>
          </div>

          {/* Points forts */}
          <div className="bg-green-50 rounded-xl p-4 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-5 h-5 text-green-600" />
              <h3 className="font-bold text-green-900">💪 Points forts</h3>
            </div>
            <ul className="space-y-2">
              {bilan.points_forts.map((point, idx) => (
                <li key={idx} className="flex items-start gap-2 text-green-800">
                  <span className="text-green-600 mt-1">✓</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Points d'attention */}
          <div className="bg-orange-50 rounded-xl p-4 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
              <h3 className="font-bold text-orange-900">⚠️ Points d'attention</h3>
            </div>
            <ul className="space-y-2">
              {bilan.points_attention.map((point, idx) => (
                <li key={idx} className="flex items-start gap-2 text-orange-800">
                  <span className="text-orange-600 mt-1">!</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Actions prioritaires / Recommandations */}
          <div className="bg-blue-50 rounded-xl p-4 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-5 h-5 text-blue-600" />
              <h3 className="font-bold text-blue-900">🎯 Recommandations</h3>
            </div>
            <ul className="space-y-2">
              {bilan.recommandations && bilan.recommandations.map((action, idx) => (
                <li key={idx} className="flex items-start gap-2 text-blue-800">
                  <span className="text-blue-600 font-bold mt-1">{idx + 1}.</span>
                  <span>{action}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Compétences moyennes */}
          {bilan.competences_moyenne && Object.keys(bilan.competences_moyenne).length > 0 && (
            <div className="bg-gray-50 rounded-xl p-4 mb-4">
              <h3 className="font-bold text-gray-900 mb-3">📊 Compétences moyennes de l'équipe</h3>
              <div className="grid grid-cols-5 gap-2">
                {Object.entries(bilan.competences_moyenne).map(([comp, score]) => (
                  <div key={comp} className="text-center">
                    <p className="text-xs text-gray-600 mb-1 capitalize">{comp}</p>
                    <p className="text-lg font-bold text-gray-800">{score}/5</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Données sources */}
          <div>
            <button
              onClick={() => setShowDataSources(!showDataSources)}
              className="btn-secondary w-full mb-3"
            >
              {showDataSources ? 'Masquer' : 'Voir'} les données sources 📊
            </button>
            
            {showDataSources && bilan.donnees_sources && (
              <div className="bg-white border-2 border-blue-300 rounded-xl p-4 animate-fadeIn">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2 border-blue-200">
                        <th className="text-left py-2 px-3 text-blue-900">Vendeur</th>
                        <th className="text-right py-2 px-3 text-blue-900">CA</th>
                        <th className="text-right py-2 px-3 text-blue-900">Ventes</th>
                        <th className="text-right py-2 px-3 text-blue-900">Panier Moyen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bilan.donnees_sources.map((seller, idx) => (
                        <tr key={idx} className="border-b border-blue-100 hover:bg-blue-50">
                          <td className="py-2 px-3 font-medium text-gray-800">{seller.name}</td>
                          <td className="text-right py-2 px-3 text-gray-700">{seller.ca.toFixed(2)}€</td>
                          <td className="text-right py-2 px-3 text-gray-700">{seller.ventes}</td>
                          <td className="text-right py-2 px-3 text-gray-700">{seller.panier_moyen.toFixed(2)}€</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
