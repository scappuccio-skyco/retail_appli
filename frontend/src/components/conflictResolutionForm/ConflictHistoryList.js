import React from 'react';
import { Loader, ChevronDown, ChevronUp } from 'lucide-react';
import { renderMarkdownBold } from '../../utils/markdownRenderer';

export default function ConflictHistoryList({ conflictHistory, loadingHistory, expandedHistoryItems, onToggle }) {
  if (loadingHistory) {
    return (
      <div className="text-center py-8">
        <Loader className="w-8 h-8 animate-spin mx-auto text-gray-400" />
        <p className="text-gray-500 mt-2">Chargement...</p>
      </div>
    );
  }

  if (conflictHistory.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        Aucune consultation pour le moment
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {conflictHistory.map((conflict) => (
        <div
          key={conflict.id}
          className="bg-white rounded-xl border border-gray-200 hover:shadow-md transition-all overflow-hidden"
        >
          <button
            onClick={() => onToggle(conflict.id)}
            className="w-full p-4 text-left hover:bg-gray-50 transition-colors flex justify-between items-start"
          >
            <div className="flex-1">
              <p className="text-sm text-gray-500 mb-2">
                🗓️ {new Date(conflict.created_at).toLocaleDateString('fr-FR', {
                  year: 'numeric', month: 'long', day: 'numeric',
                })} — Statut : <span className="font-semibold">{conflict.statut}</span>
              </p>
              <p className="text-gray-700 font-medium line-clamp-2">{conflict.contexte}</p>
            </div>
            <div className="ml-4 text-gray-600">
              {expandedHistoryItems[conflict.id] ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </div>
          </button>

          {expandedHistoryItems[conflict.id] && (
            <div className="px-4 pb-4 space-y-4 border-t border-gray-100 pt-4 animate-fadeIn">
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-semibold text-gray-600 mb-1">Comportement observé :</p>
                  <p className="text-sm text-gray-700">{conflict.comportement_observe}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-600 mb-1">Impact :</p>
                  <p className="text-sm text-gray-700">{conflict.impact}</p>
                </div>
                {conflict.tentatives_precedentes && (
                  <div>
                    <p className="text-xs font-semibold text-gray-600 mb-1">Tentatives précédentes :</p>
                    <p className="text-sm text-gray-700">{conflict.tentatives_precedentes}</p>
                  </div>
                )}
              </div>

              <div className="space-y-3 mt-4 pt-4 border-t border-gray-200">
                <div className="bg-blue-50 rounded-lg p-3">
                  <p className="text-xs font-semibold text-blue-900 mb-1">💡 Analyse IA :</p>
                  <p className="text-sm text-blue-800 whitespace-pre-line">{renderMarkdownBold(conflict.ai_analyse_situation)}</p>
                </div>
                <div className="bg-purple-50 rounded-lg p-3">
                  <p className="text-xs font-semibold text-purple-900 mb-1">💬 Approche de communication :</p>
                  <p className="text-sm text-purple-800 whitespace-pre-line">{renderMarkdownBold(conflict.ai_approche_communication)}</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3">
                  <p className="text-xs font-semibold text-green-900 mb-2">✅ Actions concrètes :</p>
                  <ul className="space-y-1">
                    {conflict.ai_actions_concretes.map((action, idx) => (
                      <li key={`${conflict.id}-action-${idx}`} className="text-sm text-green-800 flex items-start gap-2">
                        <span className="text-[#10B981]">•</span>
                        <span>{renderMarkdownBold(action)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="bg-orange-50 rounded-lg p-3">
                  <p className="text-xs font-semibold text-orange-900 mb-2">⚠️ Points de vigilance :</p>
                  <ul className="space-y-1">
                    {conflict.ai_points_vigilance.map((point, idx) => (
                      <li key={`${conflict.id}-vigilance-${idx}`} className="text-sm text-orange-800 flex items-start gap-2">
                        <span className="text-[#F97316]">•</span>
                        <span>{renderMarkdownBold(point)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
