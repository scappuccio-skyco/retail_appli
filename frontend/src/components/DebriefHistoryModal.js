import React, { useState, useMemo } from 'react';
import { X, MessageSquare } from 'lucide-react';

export default function DebriefHistoryModal({ debriefs, onClose, onNewDebrief }) {
  const [expandedDebriefs, setExpandedDebriefs] = useState({});
  const [displayLimit, setDisplayLimit] = useState(20); // Afficher 20 débriefs à la fois

  const toggleDebrief = (debriefId) => {
    setExpandedDebriefs(prev => ({
      ...prev,
      [debriefId]: !prev[debriefId]
    }));
  };

  // Trier les débriefs par date (plus récents en premier) et limiter l'affichage
  const sortedAndLimitedDebriefs = useMemo(() => {
    const sorted = [...debriefs].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return sorted.slice(0, displayLimit);
  }, [debriefs, displayLimit]);

  const hasMore = displayLimit < debriefs.length;
  const remainingCount = debriefs.length - displayLimit;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-500 to-blue-600 p-6 flex justify-between items-center border-b border-gray-200 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <MessageSquare className="w-8 h-8 text-white" />
            <div>
              <h2 className="text-3xl font-bold text-white">📝 Historique de mes Débriefs</h2>
              <p className="text-sm text-white opacity-90 mt-1">
                {displayLimit >= debriefs.length 
                  ? `${debriefs.length} débrief${debriefs.length > 1 ? 's' : ''} affiché${debriefs.length > 1 ? 's' : ''}`
                  : `Affichage de ${displayLimit} sur ${debriefs.length} débriefs`
                }
              </p>
            </div>
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
          {debriefs.length > 0 ? (
            <>
              {/* Bouton Nouveau Debrief en haut */}
              <div className="mb-6">
                <button
                  onClick={onNewDebrief}
                  className="w-full bg-gradient-to-r from-[#ffd871] to-yellow-300 text-gray-800 font-bold py-4 px-6 rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  <MessageSquare className="w-5 h-5" />
                  ✨ Débriefer une nouvelle vente
                </button>
              </div>

              {/* Liste des débriefs */}
              <div className="space-y-4">
                {sortedAndLimitedDebriefs.map((debrief) => (
                  <div
                    key={debrief.id}
                    className="bg-gradient-to-r from-white to-blue-50 rounded-2xl border-2 border-blue-100 hover:shadow-lg transition-all overflow-hidden"
                  >
                    {/* Compact Header - Always Visible */}
                    <button
                      onClick={() => toggleDebrief(debrief.id)}
                      className="w-full p-5 text-left hover:bg-white hover:bg-opacity-50 transition-colors"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-3">
                            <span className="px-3 py-1 bg-blue-500 text-white text-xs font-bold rounded-full">
                              {new Date(debrief.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </span>
                            <span className="text-sm font-semibold text-gray-800">
                              {debrief.produit}
                            </span>
                            <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded">
                              {debrief.type_client}
                            </span>
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-start gap-2">
                              <span className="text-gray-400 text-sm mt-0.5">💬</span>
                              <p className="text-sm text-gray-700 line-clamp-2">{debrief.description_vente}</p>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-gray-600">
                              <span className="flex items-center gap-1">
                                <span>📍</span> {debrief.moment_perte_client}
                              </span>
                              <span className="flex items-center gap-1">
                                <span>❌</span> {debrief.raisons_echec}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="ml-4 flex-shrink-0">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg transition-all ${
                            expandedDebriefs[debrief.id] 
                              ? 'bg-blue-500 text-white' 
                              : 'bg-blue-100 text-blue-600'
                          }`}>
                            {expandedDebriefs[debrief.id] ? '−' : '+'}
                          </div>
                        </div>
                      </div>
                    </button>

                    {/* AI Analysis - Expandable */}
                    {expandedDebriefs[debrief.id] && (
                      <div className="px-5 pb-5 space-y-3 bg-white border-t-2 border-blue-100 pt-4 animate-fadeIn">
                        {/* Analyse */}
                        <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl p-4 border-l-4 border-blue-500">
                          <p className="text-sm font-bold text-blue-900 mb-2 flex items-center gap-2">
                            <span className="text-lg">💬</span> Analyse
                          </p>
                          <p className="text-sm text-blue-800 whitespace-pre-line leading-relaxed">{debrief.ai_analyse}</p>
                        </div>

                        {/* Points à travailler */}
                        <div className="bg-gradient-to-r from-orange-50 to-orange-100 rounded-xl p-4 border-l-4 border-orange-500">
                          <p className="text-sm font-bold text-orange-900 mb-2 flex items-center gap-2">
                            <span className="text-lg">🎯</span> Points à travailler
                          </p>
                          <p className="text-sm text-orange-800 whitespace-pre-line leading-relaxed">{debrief.ai_points_travailler}</p>
                        </div>

                        {/* Recommandation */}
                        <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-xl p-4 border-l-4 border-green-500">
                          <p className="text-sm font-bold text-green-900 mb-2 flex items-center gap-2">
                            <span className="text-lg">🚀</span> Recommandation
                          </p>
                          <p className="text-sm text-green-800 whitespace-pre-line leading-relaxed">{debrief.ai_recommandation}</p>
                        </div>

                        {/* Exemple concret */}
                        <div className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-xl p-4 border-l-4 border-purple-500">
                          <p className="text-sm font-bold text-purple-900 mb-2 flex items-center gap-2">
                            <span className="text-lg">💡</span> Exemple concret
                          </p>
                          <p className="text-sm text-purple-800 italic whitespace-pre-line leading-relaxed">{debrief.ai_exemple_concret}</p>
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
                    className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-all inline-flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                    Charger plus ({remainingCount} débrief{remainingCount > 1 ? 's' : ''} restant{remainingCount > 1 ? 's' : ''})
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">💬</div>
              <p className="text-gray-500 font-medium mb-4">Aucun débrief pour le moment</p>
              <p className="text-gray-400 text-sm mb-6">Analysez votre première vente non conclue !</p>
              <button
                onClick={onNewDebrief}
                className="btn-primary inline-flex items-center gap-2"
              >
                <MessageSquare className="w-5 h-5" />
                Débriefer ma première vente
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
