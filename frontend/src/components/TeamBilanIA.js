import React from 'react';
import { Sparkles, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { renderMarkdownBold } from '../utils/markdownRenderer';
import useTeamBilanIA from './teamBilanIA/useTeamBilanIA';

export default function TeamBilanIA() {
  const { bilan, loading, expanded, setExpanded, showDataSources, setShowDataSources, generateNewBilan } = useTeamBilanIA();

  if (loading) {
    return (
      <>
        <div className="glass-morphism rounded-2xl p-6 mb-8 border-2 border-[#ffd871] opacity-50"></div>
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
            <div className="text-center mb-6">
              <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center animate-pulse">
                <Sparkles className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-800 mb-2">Analyse en cours...</h3>
              <p className="text-gray-600">L'IA analyse les performances de votre équipe et prépare le bilan hebdomadaire</p>
            </div>
            <div className="relative w-full h-3 bg-gray-200 rounded-full overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500 via-indigo-500 to-purple-500 animate-progress-slide"></div>
            </div>
            <div className="mt-4 text-center text-sm text-gray-500">
              <p>⏱️ Temps estimé : 30-60 secondes</p>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (!bilan) {
    return (
      <div className="glass-morphism rounded-2xl p-6 mb-8 border-2 border-[#ffd871]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-[#ffd871]" />
            <div>
              <h2 className="text-2xl font-bold text-gray-800">🤖 Bilan IA de l'équipe</h2>
              <p className="text-sm text-gray-600">Analyse intelligente de la performance hebdomadaire</p>
            </div>
          </div>
          <button onClick={generateNewBilan} disabled={loading} className="btn-primary flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            Générer le bilan
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-morphism rounded-2xl p-6 mb-8 border-2 border-[#ffd871]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Sparkles className="w-8 h-8 text-[#ffd871]" />
          <div>
            <h2 className="text-2xl font-bold text-gray-800">🤖 Bilan IA de l'équipe</h2>
            <p className="text-sm text-gray-600">{bilan.periode}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowDataSources(!showDataSources)} className="btn-secondary flex items-center gap-2 text-sm">
            📊 Données sources
          </button>
          <button onClick={generateNewBilan} disabled={loading} className="btn-secondary flex items-center gap-2 text-sm">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Régénérer
          </button>
          <button onClick={() => setExpanded(!expanded)} className="btn-secondary p-2">
            {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <div className="bg-blue-50 rounded-lg p-3"><p className="text-xs text-blue-600 mb-1">💰 CA</p><p className="text-lg font-bold text-blue-900">{bilan.kpi_resume.ca_total.toFixed(0)}€</p></div>
        <div className="bg-green-50 rounded-lg p-3"><p className="text-xs text-[#10B981] mb-1">🛒 Ventes</p><p className="text-lg font-bold text-green-900">{bilan.kpi_resume.ventes}</p></div>
        <div className="bg-purple-50 rounded-lg p-3"><p className="text-xs text-purple-600 mb-1">👥 Clients</p><p className="text-lg font-bold text-purple-900">{bilan.kpi_resume.clients}</p></div>
        <div className="bg-orange-50 rounded-lg p-3"><p className="text-xs text-[#F97316] mb-1">🧮 P. Moyen</p><p className="text-lg font-bold text-orange-900">{bilan.kpi_resume.panier_moyen.toFixed(0)}€</p></div>
        <div className="bg-pink-50 rounded-lg p-3"><p className="text-xs text-pink-600 mb-1">📈 Taux</p><p className="text-lg font-bold text-pink-900">{bilan.kpi_resume.taux_transformation.toFixed(1)}%</p></div>
      </div>

      {/* Synthèse */}
      <div className="bg-gradient-to-r from-[#1E40AF] to-[#1E3A8A] rounded-xl p-4 mb-4">
        <p className="text-gray-800 font-medium">{renderMarkdownBold(bilan.synthese)}</p>
      </div>

      {/* Données sources */}
      {showDataSources && bilan.donnees_sources && (
        <div className="bg-white border-2 border-blue-300 rounded-xl p-4 mb-4 animate-fadeIn">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">📊</span>
            <h3 className="font-bold text-blue-900">Données sources utilisées par l'IA</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-blue-200">
                  <th className="text-left py-2 px-3 text-blue-900">Vendeur</th>
                  <th className="text-right py-2 px-3 text-blue-900">CA</th>
                  <th className="text-right py-2 px-3 text-blue-900">Ventes</th>
                  <th className="text-right py-2 px-3 text-blue-900">Panier Moyen</th>
                  <th className="text-right py-2 px-3 text-blue-900">Scores</th>
                </tr>
              </thead>
              <tbody>
                {bilan.donnees_sources.map((seller, idx) => (
                  <tr key={`team-bilan-seller-${seller.seller_id || seller.name}-${idx}`} className="border-b border-blue-100 hover:bg-blue-50">
                    <td className="py-2 px-3 font-medium text-gray-800">{seller.name}</td>
                    <td className="text-right py-2 px-3 text-gray-700">{seller.ca.toFixed(2)}€</td>
                    <td className="text-right py-2 px-3 text-gray-700">{seller.ventes}</td>
                    <td className="text-right py-2 px-3 text-gray-700">{seller.panier_moyen.toFixed(2)}€</td>
                    <td className="text-right py-2 px-3 text-xs text-gray-600">
                      {seller.scores ? (
                        <span>A:{seller.scores.score_accueil} D:{seller.scores.score_decouverte} Ar:{seller.scores.score_argumentation} C:{seller.scores.score_closing} F:{seller.scores.score_fidelisation}</span>
                      ) : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 bg-blue-50 rounded-lg p-3 text-sm text-blue-800">
            <p className="font-semibold mb-1">💡 Pourquoi cette section ?</p>
            <p>Ces données brutes sont celles envoyées à l'IA. Elles te permettent de vérifier que l'analyse est basée sur des chiffres réels et non inventés.</p>
          </div>
        </div>
      )}

      {expanded && (
        <div className="bg-gradient-to-br from-orange-50 to-yellow-50 rounded-xl p-6 space-y-4 animate-fadeIn">
          {[
            { key: 'points_forts',        label: 'Points forts',         icon: '✅', bg: 'bg-green-50',  border: 'border-green-200',  badgeBg: 'bg-green-100',  badgeText: 'text-green-800',  dotBg: 'from-green-500 to-emerald-600',  numbered: true },
            { key: 'points_attention',    label: "Points d'attention",   icon: '⚠️', bg: 'bg-red-50',    border: 'border-red-200',    badgeBg: 'bg-red-100',    badgeText: 'text-red-800',    dotBg: 'from-red-500 to-orange-600',     numbered: false },
            { key: 'actions_prioritaires',label: 'Actions prioritaires', icon: '🎯', bg: 'bg-purple-50', border: 'border-purple-200', badgeBg: 'bg-purple-100', badgeText: 'text-purple-800', dotBg: 'from-purple-500 to-indigo-600',  numbered: true },
          ].map(({ key, label, icon, bg, border, badgeBg, badgeText, dotBg, numbered }) => (
            <div key={key} className={`rounded-xl p-5 shadow-sm border-2 ${bg} ${border}`}>
              <div className="mb-4">
                <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full font-bold text-sm ${badgeBg} ${badgeText}`}>
                  <span>{icon}</span>{label}
                </span>
              </div>
              <div className="space-y-3">
                {bilan[key].map((point, idx) => (
                  <div key={`${key}-${idx}-${point.substring(0, 20)}`} className="flex gap-3 items-start bg-white rounded-lg p-3 shadow-sm">
                    <span className={`flex-shrink-0 w-7 h-7 bg-gradient-to-br ${dotBg} text-white rounded-full flex items-center justify-center font-bold text-sm`}>
                      {numbered ? idx + 1 : '!'}
                    </span>
                    <p className="flex-1 text-gray-800">{renderMarkdownBold(point)}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Suggestion de brief */}
          <div className="rounded-xl p-5 shadow-sm border-2 bg-amber-50 border-amber-200">
            <div className="mb-4">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full font-bold text-sm bg-amber-100 text-amber-800">
                <span>💬</span>Suggestion de brief
              </span>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <p className="text-gray-800 italic leading-relaxed">"{renderMarkdownBold(bilan.suggestion_brief)}"</p>
            </div>
          </div>

          {/* Compétences moyennes */}
          {bilan.competences_moyenne && Object.keys(bilan.competences_moyenne).length > 0 && (
            <div className="bg-gray-50 rounded-xl p-4">
              <h3 className="font-bold text-gray-900 mb-3">📊 Compétences moyennes de l'équipe</h3>
              <div className="grid grid-cols-5 gap-2">
                {Object.entries(bilan.competences_moyenne).map(([comp, score]) => (
                  <div key={comp} className="text-center">
                    <p className="text-xs text-gray-600 mb-1 capitalize">{comp}</p>
                    <p className="text-lg font-bold text-gray-800">{score}/10</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
