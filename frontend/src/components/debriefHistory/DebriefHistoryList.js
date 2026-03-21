import React from 'react';
import { Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react';
import { renderMarkdownBold } from '../../utils/markdownRenderer';

export default function DebriefHistoryList({
  debriefs,
  sortedAndLimitedDebriefs,
  filtreHistorique,
  setFiltreHistorique,
  expandedDebriefs,
  toggleDebrief,
  hasMore,
  remainingCount,
  onLoadMore,
  onShowVenteConclue,
  onShowOpportuniteManquee,
  onToggleVisibility,
}) {
  return (
    <>
      {/* Boutons d'action - TOUJOURS VISIBLES */}
      <div className="mb-6">
        <p className="text-sm text-gray-600 mb-3 font-medium">Créer une nouvelle analyse :</p>
        <div className="flex gap-3">
          <button
            onClick={onShowVenteConclue}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition-all shadow-md hover:shadow-lg"
          >
            <CheckCircle className="w-5 h-5" />
            Vente conclue
          </button>
          <button
            onClick={onShowOpportuniteManquee}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-xl transition-all shadow-md hover:shadow-lg"
          >
            <XCircle className="w-5 h-5" />
            Opportunité manquée
          </button>
        </div>
      </div>

      {debriefs.length > 0 ? (
        <>
          {/* Séparateur */}
          <div className="border-t border-gray-200 my-6"></div>

          {/* Filtres */}
          <div className="mb-6 flex gap-2">
            <button
              onClick={() => setFiltreHistorique('all')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                filtreHistorique === 'all'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Toutes ({debriefs.length})
            </button>
            <button
              onClick={() => setFiltreHistorique('conclue')}
              className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
                filtreHistorique === 'conclue'
                  ? 'bg-green-600 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <CheckCircle className="w-4 h-4" />
              Réussies ({debriefs.filter(d => d.vente_conclue).length})
            </button>
            <button
              onClick={() => setFiltreHistorique('manquee')}
              className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
                filtreHistorique === 'manquee'
                  ? 'bg-orange-600 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <XCircle className="w-4 h-4" />
              Manquées ({debriefs.filter(d => !d.vente_conclue).length})
            </button>
          </div>

          {/* Liste des analyses de vente */}
          <div className="space-y-4">
            {sortedAndLimitedDebriefs.map((debrief) => {
              const isConclue = debrief.vente_conclue === true;
              return (
                <div
                  key={`debrief-${debrief.id}`}
                  data-debrief-id={debrief.id}
                  className={`rounded-2xl border-2 hover:shadow-lg transition-all overflow-hidden ${
                    isConclue
                      ? 'bg-gradient-to-r from-white to-green-50 border-green-200'
                      : 'bg-gradient-to-r from-white to-orange-50 border-orange-200'
                  }`}
                >
                  {/* Header */}
                  <div
                    onClick={() => toggleDebrief(debrief.id)}
                    className="w-full p-5 cursor-pointer hover:bg-white hover:bg-opacity-50 transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-3 flex-wrap">
                          <span className={`px-3 py-1 text-white text-xs font-bold rounded-full ${
                            isConclue ? 'bg-green-500' : 'bg-orange-500'
                          }`}>
                            {new Date(debrief.created_at).toLocaleDateString('fr-FR', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                          <span className={`px-3 py-1 text-xs font-bold rounded-full ${
                            isConclue
                              ? 'bg-green-100 text-green-700'
                              : 'bg-orange-100 text-orange-700'
                          }`}>
                            {isConclue ? '✅ Réussie' : '❌ Manquée'}
                          </span>
                          <span className="text-sm font-semibold text-gray-800">
                            {debrief.produit}
                          </span>
                          <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded">
                            {debrief.type_client}
                          </span>
                        </div>

                        {/* Bouton toggle visibilité */}
                        <div className="mt-2 flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleVisibility(debrief.id, debrief.shared_with_manager);
                            }}
                            className={`px-3 py-1.5 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-all ${
                              debrief.shared_with_manager
                                ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                            title={debrief.shared_with_manager ? 'Masquer cette analyse au manager' : 'Partager cette analyse avec le manager'}
                          >
                            {debrief.shared_with_manager ? (
                              <><Eye className="w-3.5 h-3.5" /> Visible par le Manager</>
                            ) : (
                              <><EyeOff className="w-3.5 h-3.5" /> Privé</>
                            )}
                          </button>
                          <span className="text-xs text-gray-500">
                            {debrief.shared_with_manager
                              ? 'Le manager peut voir cette analyse'
                              : 'Seul vous pouvez voir cette analyse'}
                          </span>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-start gap-2">
                            <span className="text-gray-400 text-sm mt-0.5">💬</span>
                            <p className="text-sm text-gray-700 line-clamp-2">{debrief.description_vente}</p>
                          </div>
                        </div>
                      </div>
                      <div className="ml-4 flex-shrink-0">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg transition-all ${
                          expandedDebriefs[debrief.id]
                            ? isConclue ? 'bg-green-500 text-white' : 'bg-orange-500 text-white'
                            : isConclue ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'
                        }`}>
                          {expandedDebriefs[debrief.id] ? '−' : '+'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* AI Analysis - Expandable */}
                  {expandedDebriefs[debrief.id] && (
                    <div
                      className="px-5 pb-5 space-y-3 bg-white border-t-2 pt-4 animate-fadeIn"
                      style={{ borderTopColor: isConclue ? 'rgb(34, 197, 94)' : 'rgb(251, 146, 60)' }}
                    >
                      {/* Analyse */}
                      <div className={`rounded-xl p-4 border-l-4 ${
                        isConclue
                          ? 'bg-gradient-to-r from-green-50 to-green-100 border-green-500'
                          : 'bg-gradient-to-r from-blue-50 to-blue-100 border-blue-500'
                      }`}>
                        <p className={`text-sm font-bold mb-2 flex items-center gap-2 ${
                          isConclue ? 'text-green-900' : 'text-blue-900'
                        }`}>
                          <span className="text-lg">💬</span> Analyse
                        </p>
                        <p className={`text-sm whitespace-pre-line leading-relaxed ${
                          isConclue ? 'text-green-800' : 'text-blue-800'
                        }`}>{renderMarkdownBold(debrief.ai_analyse)}</p>
                      </div>

                      {/* Points à travailler / Points forts */}
                      <div className={`rounded-xl p-4 border-l-4 ${
                        isConclue
                          ? 'bg-gradient-to-r from-blue-50 to-blue-100 border-blue-500'
                          : 'bg-gradient-to-r from-orange-50 to-orange-100 border-orange-500'
                      }`}>
                        <p className={`text-sm font-bold mb-2 flex items-center gap-2 ${
                          isConclue ? 'text-blue-900' : 'text-orange-900'
                        }`}>
                          <span className="text-lg">{isConclue ? '⭐' : '🎯'}</span>
                          {isConclue ? 'Points forts' : 'Points à travailler'}
                        </p>
                        <p className={`text-sm whitespace-pre-line leading-relaxed ${
                          isConclue ? 'text-blue-800' : 'text-orange-800'
                        }`}>{renderMarkdownBold(debrief.ai_points_travailler)}</p>
                      </div>

                      {/* Recommandation */}
                      <div className={`rounded-xl p-4 border-l-4 ${
                        isConclue
                          ? 'bg-gradient-to-r from-yellow-50 to-yellow-100 border-yellow-500'
                          : 'bg-gradient-to-r from-green-50 to-green-100 border-green-500'
                      }`}>
                        <p className={`text-sm font-bold mb-2 flex items-center gap-2 ${
                          isConclue ? 'text-yellow-900' : 'text-green-900'
                        }`}>
                          <span className="text-lg">🚀</span> Recommandation
                        </p>
                        <p className={`text-sm whitespace-pre-line leading-relaxed ${
                          isConclue ? 'text-yellow-800' : 'text-green-800'
                        }`}>{renderMarkdownBold(debrief.ai_recommandation)}</p>
                      </div>

                      {/* Exemple concret */}
                      <div className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-xl p-4 border-l-4 border-purple-500">
                        <p className="text-sm font-bold text-purple-900 mb-2 flex items-center gap-2">
                          <span className="text-lg">{isConclue ? '✨' : '💡'}</span>
                          {isConclue ? 'Ce qui a fait la différence' : 'Exemple concret'}
                        </p>
                        <p className="text-sm text-purple-800 italic whitespace-pre-line leading-relaxed">
                          {renderMarkdownBold(debrief.ai_exemple_concret)}
                        </p>
                      </div>

                      {debrief.ai_action_immediate && (
                        <div className="bg-yellow-50 rounded-xl p-4 border-l-4 border-yellow-400">
                          <p className="text-sm font-bold text-yellow-900 mb-2 flex items-center gap-2">
                            <span className="text-lg">⚡</span> À faire maintenant
                          </p>
                          <p className="text-sm text-yellow-800 font-semibold whitespace-pre-line leading-relaxed">
                            {renderMarkdownBold(debrief.ai_action_immediate)}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Charger plus */}
          {hasMore && (
            <div className="mt-6 text-center">
              <button
                onClick={onLoadMore}
                className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-all"
              >
                Charger plus ({remainingCount} restante{remainingCount > 1 ? 's' : ''})
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">💬</div>
          <p className="text-gray-500 font-medium mb-4">Aucune analyse pour le moment</p>
          <p className="text-gray-400 text-sm">Utilisez les boutons ci-dessus pour créer votre première analyse !</p>
        </div>
      )}
    </>
  );
}
