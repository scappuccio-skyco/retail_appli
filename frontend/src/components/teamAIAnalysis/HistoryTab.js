import React from 'react';
import { Calendar, Clock, ChevronDown, Trash2 } from 'lucide-react';
import AnalysisContent from './AnalysisContent';

export default function HistoryTab({
  history,
  loadingHistory,
  expandedItems,
  onToggleExpand,
  onDeleteAnalysis,
  onCreateAnalysis,
  isDemo = false,
}) {
  if (loadingHistory) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-indigo-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Chargement de l'historique...</p>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">📊</div>
        <p className="text-gray-600">Aucune analyse dans l'historique</p>
        <button
          onClick={onCreateAnalysis}
          className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          Créer une analyse
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isDemo && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          <span className="text-lg leading-none mt-0.5">🎭</span>
          <span>Ces analyses sont des <strong>exemples créés pour la démo</strong>. Vos vraies analyses s'adapteront aux données réelles de votre équipe et de vos périodes.</span>
        </div>
      )}
      {history.map((item, index) => {
        const isExpanded = expandedItems[item.analysis_id];
        const isLatest = index === 0;

        return (
          <div
            key={item.analysis_id}
            className={`border-2 rounded-xl overflow-hidden transition-all ${
              isLatest
                ? 'border-indigo-400 bg-gradient-to-br from-indigo-50 to-purple-50 shadow-lg'
                : 'border-gray-200 bg-white hover:shadow-md'
            }`}
          >
            {/* Clickable header */}
            <div
              className="p-4 cursor-pointer hover:bg-white/50 transition-colors"
              onClick={() => onToggleExpand(item.analysis_id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {isLatest && (
                      <span className="px-2 py-0.5 bg-indigo-500 text-white text-xs font-bold rounded-full">
                        DERNIER
                      </span>
                    )}
                    <span className="text-sm font-semibold text-gray-800">
                      Analyse d'équipe
                    </span>
                  </div>
                  <div className="flex items-center gap-4 flex-wrap text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      <span>
                        {new Date(item.period_start).toLocaleDateString('fr-FR')}
                        {' → '}
                        {new Date(item.period_end).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      <span>
                        {new Date(item.generated_at).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <ChevronDown
                    className={`w-5 h-5 text-gray-500 transition-transform ${
                      isExpanded ? 'rotate-180' : ''
                    }`}
                  />
                  {!isDemo && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteAnalysis(item.analysis_id);
                      }}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Supprimer cette analyse"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Expanded content */}
            {isExpanded && (
              <div className="border-t-2 border-gray-200 p-6">
                <AnalysisContent analysisText={item.analysis} metadata={null} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
