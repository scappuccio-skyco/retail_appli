import React from 'react';
import { X, Sparkles } from 'lucide-react';
import { renderMarkdownBold } from '../../utils/markdownRenderer';
import AIDataSources from '../shared/AIDataSources';

const DEBRIEF_SOURCES = ['Fiche de vente', 'Type de vente', 'Compétences évaluées (5 axes)', 'Contexte du magasin'];

export default function DebriefResultView({ aiAnalysis, onClose, onDismiss }) {
  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) { onClose(); } }}
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50"
    >
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
        <div className="border-b border-gray-200 p-4 sm:p-6 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Sparkles className="w-6 h-6 text-[#ffd871]" />
            <h2 className="text-2xl font-bold text-gray-800">Ton coaching personnalisé</h2>
          </div>
          <button
            onClick={onDismiss}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Analyse */}
          <div className="bg-blue-50 border-l-4 border-blue-500 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">💬</span>
              <div>
                <h3 className="font-bold text-blue-900 mb-2">Analyse</h3>
                <p className="text-blue-800 whitespace-pre-line">{renderMarkdownBold(aiAnalysis.ai_analyse)}</p>
              </div>
            </div>
          </div>

          {/* Points à travailler */}
          <div className="bg-orange-50 border-l-4 border-[#F97316] rounded-lg p-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">🎯</span>
              <div className="flex-1">
                <h3 className="font-bold text-orange-900 mb-2">Points à travailler</h3>
                <p className="text-orange-800 whitespace-pre-line">{renderMarkdownBold(aiAnalysis.ai_points_travailler)}</p>
              </div>
            </div>
          </div>

          {/* Recommandation */}
          <div className="bg-green-50 border-l-4 border-[#10B981] rounded-lg p-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">🚀</span>
              <div>
                <h3 className="font-bold text-green-900 mb-2">Recommandation</h3>
                <p className="text-green-800 font-medium whitespace-pre-line">{renderMarkdownBold(aiAnalysis.ai_recommandation)}</p>
              </div>
            </div>
          </div>

          {/* Exemple concret */}
          <div className="bg-purple-50 border-l-4 border-purple-500 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">💡</span>
              <div>
                <h3 className="font-bold text-purple-900 mb-2">Exemple concret</h3>
                <p className="text-purple-800 italic whitespace-pre-line">{renderMarkdownBold(aiAnalysis.ai_exemple_concret)}</p>
              </div>
            </div>
          </div>

          {/* Action immédiate */}
          {aiAnalysis.ai_action_immediate && (
            <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl">⚡</span>
                <div>
                  <h3 className="font-bold text-yellow-900 mb-2">À faire maintenant</h3>
                  <p className="text-yellow-800 font-semibold whitespace-pre-line">{renderMarkdownBold(aiAnalysis.ai_action_immediate)}</p>
                </div>
              </div>
            </div>
          )}

          <AIDataSources sources={DEBRIEF_SOURCES} />

          <button
            onClick={onDismiss}
            className="w-full py-3 bg-[#ffd871] text-gray-800 rounded-full font-semibold hover:shadow-lg transition-all"
          >
            Retour au tableau de bord
          </button>
        </div>
      </div>
    </div>
  );
}
