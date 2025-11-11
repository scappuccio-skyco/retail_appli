import React from 'react';
import { Sparkles, X, TrendingUp, AlertTriangle, Target } from 'lucide-react';

export default function TeamBilanModal({ bilan, kpiConfig, onClose }) {
  if (!bilan) return null;

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) { onClose(); } }} className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl my-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#1E40AF] to-[#1E3A8A] p-6 rounded-t-2xl relative">
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
            {kpiConfig?.track_ca && bilan.kpi_resume.ca_total !== undefined && (
              <div className="bg-blue-50 rounded-lg p-3">
                <p className="text-xs text-blue-600 mb-1">💰 CA</p>
                <p className="text-lg font-bold text-blue-900">{bilan.kpi_resume.ca_total.toFixed(0)}€</p>
              </div>
            )}
            {kpiConfig?.track_ventes && bilan.kpi_resume.ventes !== undefined && (
              <div className="bg-green-50 rounded-lg p-3">
                <p className="text-xs text-[#10B981] mb-1">🛒 Ventes</p>
                <p className="text-lg font-bold text-green-900">{bilan.kpi_resume.ventes}</p>
              </div>
            )}
            {kpiConfig?.track_clients && bilan.kpi_resume.clients !== undefined && (
              <div className="bg-purple-50 rounded-lg p-3">
                <p className="text-xs text-purple-600 mb-1">👥 Clients</p>
                <p className="text-lg font-bold text-purple-900">{bilan.kpi_resume.clients}</p>
              </div>
            )}
            {kpiConfig?.track_articles && bilan.kpi_resume.articles !== undefined && (
              <div className="bg-orange-50 rounded-lg p-3">
                <p className="text-xs text-[#F97316] mb-1">📦 Articles</p>
                <p className="text-lg font-bold text-orange-900">{bilan.kpi_resume.articles}</p>
              </div>
            )}
            {kpiConfig?.track_ca && kpiConfig?.track_ventes && bilan.kpi_resume.panier_moyen !== undefined && (
              <div className="bg-indigo-50 rounded-lg p-3">
                <p className="text-xs text-indigo-600 mb-1">💳 P. Moyen</p>
                <p className="text-lg font-bold text-indigo-900">{bilan.kpi_resume.panier_moyen.toFixed(0)}€</p>
              </div>
            )}
            {kpiConfig?.track_ventes && kpiConfig?.track_clients && bilan.kpi_resume.taux_transformation !== undefined && (
              <div className="bg-pink-50 rounded-lg p-3">
                <p className="text-xs text-pink-600 mb-1">📈 Taux Transfo</p>
                <p className="text-lg font-bold text-pink-900">{bilan.kpi_resume.taux_transformation.toFixed(0)}%</p>
              </div>
            )}
            {kpiConfig?.track_articles && kpiConfig?.track_clients && bilan.kpi_resume.indice_vente !== undefined && (
              <div className="bg-teal-50 rounded-lg p-3">
                <p className="text-xs text-teal-600 mb-1">🎯 Indice</p>
                <p className="text-lg font-bold text-teal-900">{bilan.kpi_resume.indice_vente.toFixed(1)}</p>
              </div>
            )}
          </div>

          {/* Synthèse */}
          <div className="bg-gradient-to-r from-[#1E40AF] to-[#1E3A8A] rounded-xl p-4 mb-4">
            <p className="text-gray-800 font-medium">{bilan.synthese}</p>
          </div>

          {/* Points forts */}
          <div className="bg-green-50 rounded-xl p-4 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-5 h-5 text-[#10B981]" />
              <h3 className="font-bold text-green-900">💪 Points forts</h3>
            </div>
            <ul className="space-y-2">
              {bilan.points_forts && bilan.points_forts.map((point, idx) => (
                <li key={`team-modal-forts-${idx}-${point.substring(0, 20)}`} className="flex items-start gap-2 text-green-800">
                  <span className="text-[#10B981] mt-1">✓</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Points d'attention */}
          <div className="bg-orange-50 rounded-xl p-4 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-5 h-5 text-[#F97316]" />
              <h3 className="font-bold text-orange-900">⚠️ Points d'attention</h3>
            </div>
            <ul className="space-y-2">
              {bilan.points_attention && bilan.points_attention.map((point, idx) => (
                <li key={`team-modal-attention-${idx}-${point.substring(0, 20)}`} className="flex items-start gap-2 text-orange-800">
                  <span className="text-[#F97316] mt-1">!</span>
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
                <li key={`team-modal-reco-${idx}-${action.substring(0, 20)}`} className="flex items-start gap-2 text-blue-800">
                  <span className="text-blue-600 font-bold mt-1">{idx + 1}.</span>
                  <span>{action}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Analyses détaillées par vendeur */}
          {bilan.analyses_vendeurs && bilan.analyses_vendeurs.length > 0 && (
            <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-4 mb-4 border-2 border-purple-200">
              <h3 className="font-bold text-purple-900 mb-4">👥 Analyse détaillée par vendeur</h3>
              <div className="space-y-4">
                {bilan.analyses_vendeurs.map((analyse, idx) => (
                  <div key={idx} className="bg-white rounded-lg p-4 shadow-sm">
                    <h4 className="text-lg font-bold text-purple-800 mb-2">
                      {analyse.vendeur}
                    </h4>
                    <p className="text-gray-700 mb-3 italic">{analyse.performance}</p>
                    
                    <div className="grid md:grid-cols-2 gap-3 mb-3">
                      {analyse.points_forts && analyse.points_forts.length > 0 && (
                        <div className="bg-green-50 rounded p-3">
                          <p className="text-xs font-semibold text-green-700 mb-2">✓ Points forts</p>
                          <ul className="text-sm text-green-800 space-y-1">
                            {analyse.points_forts.map((point, i) => (
                              <li key={i}>• {point}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {analyse.axes_progression && analyse.axes_progression.length > 0 && (
                        <div className="bg-orange-50 rounded p-3">
                          <p className="text-xs font-semibold text-orange-700 mb-2">📈 Axes de progression</p>
                          <ul className="text-sm text-orange-800 space-y-1">
                            {analyse.axes_progression.map((axe, i) => (
                              <li key={i}>• {axe}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                    
                    {analyse.recommandations && analyse.recommandations.length > 0 && (
                      <div className="bg-blue-50 rounded p-3">
                        <p className="text-xs font-semibold text-blue-700 mb-2">🎯 Recommandations personnalisées</p>
                        <ul className="text-sm text-blue-800 space-y-1">
                          {analyse.recommandations.map((reco, i) => (
                            <li key={i}>• {reco}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

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
        </div>
      </div>
    </div>
  );
}
