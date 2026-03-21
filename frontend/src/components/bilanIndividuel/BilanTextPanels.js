import React from 'react';
import { TrendingUp, AlertTriangle, Target } from 'lucide-react';
import { renderMarkdownBold } from '../../utils/markdownRenderer';

export default function BilanTextPanels({ bilan }) {
  return (
    <>
      {/* Synthèse */}
      <div className="bg-gradient-to-r from-[#1E40AF] to-[#1E3A8A] rounded-xl p-4 mb-4">
        <p className="text-white font-medium">{renderMarkdownBold(bilan.synthese)}</p>
      </div>

      {/* Action prioritaire */}
      {bilan.action_prioritaire && (
        <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-xl p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-white font-bold text-sm">⚡ Action prioritaire</span>
          </div>
          <p className="text-white font-semibold">{renderMarkdownBold(bilan.action_prioritaire)}</p>
        </div>
      )}

      {/* Points forts */}
      <div className="bg-green-50 rounded-xl p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-5 h-5 text-[#10B981]" />
          <h3 className="font-bold text-green-900">💪 Tes points forts</h3>
        </div>
        <ul className="space-y-2">
          {bilan.points_forts && bilan.points_forts.map((point, idx) => (
            <li
              key={`bilan-${bilan.periode}-forts-${idx}-${point.substring(0, 20)}`}
              className="flex items-start gap-2 text-green-800"
            >
              <span className="text-[#10B981] mt-1">✓</span>
              <span>{renderMarkdownBold(point)}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Points d'attention */}
      <div className="bg-orange-50 rounded-xl p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-5 h-5 text-[#F97316]" />
          <h3 className="font-bold text-orange-900">⚠️ Points à améliorer</h3>
        </div>
        <ul className="space-y-2">
          {bilan.points_attention && bilan.points_attention.map((point, idx) => (
            <li
              key={`bilan-${bilan.periode}-attention-${idx}-${point.substring(0, 20)}`}
              className="flex items-start gap-2 text-orange-800"
            >
              <span className="text-[#F97316] mt-1">!</span>
              <span>{renderMarkdownBold(point)}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Recommandations personnalisées */}
      <div className="bg-blue-50 rounded-xl p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Target className="w-5 h-5 text-blue-600" />
          <h3 className="font-bold text-blue-900">🎯 Recommandations personnalisées</h3>
        </div>
        <ul className="space-y-2">
          {bilan.recommandations && bilan.recommandations.map((action, idx) => (
            <li
              key={`bilan-${bilan.periode}-recommandations-${idx}-${action.substring(0, 20)}`}
              className="flex items-start gap-2 text-blue-800"
            >
              <span className="text-blue-600 font-bold mt-1">{idx + 1}.</span>
              <span>{renderMarkdownBold(action)}</span>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
