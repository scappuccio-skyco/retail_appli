import React from 'react';
import { MessageSquare } from 'lucide-react';
import { LABEL_DECOUVERTE } from '../../lib/constants';

export default function DebriefsTab({
  debriefs,
  debriefFilter,
  setDebriefFilter,
  expandedDebriefs,
  toggleDebrief,
  showAllDebriefs,
  setShowAllDebriefs,
}) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-center gap-2 mb-4">
        <MessageSquare className="w-4 h-4 text-blue-500" />
        <h2 className="text-sm font-bold text-gray-800">Dernières analyses des ventes</h2>
      </div>

      {debriefs.length > 0 ? (
        <>
          <div className="flex gap-1.5 mb-4">
            {[
              { id: 'all',     label: `Toutes (${debriefs.length})`,                                     cls: 'bg-slate-700 text-white' },
              { id: 'success', label: `✅ Réussies (${debriefs.filter(d => d.vente_conclue === true).length})`,  cls: 'bg-green-600 text-white'  },
              { id: 'missed',  label: `❌ Manquées (${debriefs.filter(d => d.vente_conclue === false).length})`, cls: 'bg-orange-600 text-white'  },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setDebriefFilter(f.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                  debriefFilter === f.id ? f.cls : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {debriefs
              .filter(d => debriefFilter === 'success' ? d.vente_conclue === true : debriefFilter === 'missed' ? d.vente_conclue === false : true)
              .slice(0, showAllDebriefs ? debriefs.length : 3)
              .map(debrief => {
                const isConclue = debrief.vente_conclue === true;
                return (
                  <div
                    key={debrief.id}
                    className={`rounded-xl border border-gray-100 bg-gray-50 overflow-hidden border-l-4 ${isConclue ? 'border-l-green-400' : 'border-l-orange-400'}`}
                  >
                    <button
                      onClick={() => toggleDebrief(debrief.id)}
                      className="w-full p-3 text-left hover:bg-gray-100/80 transition-colors"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${isConclue ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                              {isConclue ? '✅ Réussi' : '❌ Manqué'}
                            </span>
                            <span className="text-[11px] text-gray-400">
                              {new Date(debrief.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-xs text-gray-600 truncate">
                            {debrief.produit || debrief.context || 'N/A'} · {debrief.type_client || debrief.customer_profile || 'N/A'}
                          </p>
                          {!expandedDebriefs[debrief.id] && (
                            <p className="text-xs text-gray-400 truncate mt-0.5">
                              {debrief.description_vente || debrief.demarche_commerciale || ''}
                            </p>
                          )}
                        </div>
                        <span className="ml-2 text-gray-400 text-base flex-shrink-0">{expandedDebriefs[debrief.id] ? '−' : '+'}</span>
                      </div>
                    </button>

                    {expandedDebriefs[debrief.id] && (
                      <div className="px-3 pb-3 space-y-2 border-t border-gray-100 pt-2">
                        {debrief.ai_recommendation && (
                          <div className="bg-blue-50 rounded-xl p-2.5">
                            <p className="text-[10px] font-semibold text-blue-700 mb-1">💡 Recommandation IA</p>
                            <p className="text-xs text-blue-800 leading-relaxed">{debrief.ai_recommendation}</p>
                          </div>
                        )}
                        <div className="grid grid-cols-5 gap-1.5">
                          <div className="bg-purple-50 rounded-lg p-1.5 text-center">
                            <p className="text-[10px] text-purple-600">Accueil</p>
                            <p className="text-sm font-bold text-purple-900">{debrief.score_accueil ?? 0}/10</p>
                          </div>
                          <div className="bg-green-50 rounded-lg p-1.5 text-center">
                            <p className="text-[10px] text-green-600">{LABEL_DECOUVERTE}</p>
                            <p className="text-sm font-bold text-green-900">{debrief.score_decouverte ?? 0}/10</p>
                          </div>
                          <div className="bg-orange-50 rounded-lg p-1.5 text-center">
                            <p className="text-[10px] text-orange-600">Argum.</p>
                            <p className="text-sm font-bold text-orange-900">{debrief.score_argumentation ?? 0}/10</p>
                          </div>
                          <div className="bg-red-50 rounded-lg p-1.5 text-center">
                            <p className="text-[10px] text-red-600">Closing</p>
                            <p className="text-sm font-bold text-red-900">{debrief.score_closing ?? 0}/10</p>
                          </div>
                          <div className="bg-blue-50 rounded-lg p-1.5 text-center">
                            <p className="text-[10px] text-blue-600">Fidél.</p>
                            <p className="text-sm font-bold text-blue-900">{debrief.score_fidelisation ?? 0}/10</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>

          {debriefs.length > 3 && (
            <div className="mt-4 text-center">
              <button
                onClick={() => setShowAllDebriefs(!showAllDebriefs)}
                className="px-4 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-xs font-medium transition-colors"
              >
                {showAllDebriefs ? '↑ Voir moins' : `↓ Charger plus (${debriefs.length - 3} autres)`}
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 gap-2">
          <MessageSquare className="w-8 h-8 text-gray-200" />
          <p className="text-sm text-gray-400">Aucune analyse de vente pour le moment</p>
        </div>
      )}
    </div>
  );
}
