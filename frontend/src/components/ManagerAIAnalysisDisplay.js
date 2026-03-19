import React from 'react';

/**
 * Displays a structured AI analysis for manager (team or store KPI).
 * Expects analysis: { synthese, action_prioritaire, points_forts[], points_attention[], recommandations[] }
 */
export default function ManagerAIAnalysisDisplay({ analysis, onRegenerate, title = "Analyse IA" }) {
  if (!analysis) return null;

  // Backward compatibility: old string analyses
  if (typeof analysis === 'string') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
            <span>🤖</span> {title}
          </h3>
          {onRegenerate && (
            <button
              onClick={onRegenerate}
              className="text-xs px-3 py-1.5 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition-colors font-medium"
            >
              🔄 Régénérer (nouvelle version)
            </button>
          )}
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm text-amber-700 mb-2 font-medium">
            ⚠️ Analyse au format ancien — cliquez sur "Régénérer" pour obtenir la nouvelle présentation structurée.
          </p>
        </div>
      </div>
    );
  }

  if (!analysis.synthese) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
          <span>🤖</span> {title}
        </h3>
        {onRegenerate && (
          <button
            onClick={onRegenerate}
            className="text-xs px-3 py-1.5 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition-colors font-medium"
          >
            🔄 Régénérer
          </button>
        )}
      </div>

      {/* Synthèse */}
      <div className="bg-blue-50 rounded-xl p-4 border-l-4 border-blue-500">
        <div className="flex items-start gap-2 mb-2">
          <span className="text-blue-600 text-lg">✨</span>
          <h4 className="font-bold text-blue-900">💡 Synthèse</h4>
        </div>
        <p className="text-gray-700 leading-relaxed">{analysis.synthese}</p>
      </div>

      {/* Action prioritaire */}
      {analysis.action_prioritaire && (
        <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-xl p-4 text-white shadow-lg">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">🎯</span>
            <h4 className="font-bold text-sm uppercase tracking-wide">Action prioritaire</h4>
          </div>
          <p className="text-lg font-semibold leading-snug">{analysis.action_prioritaire}</p>
        </div>
      )}

      {/* Points forts */}
      {analysis.points_forts?.length > 0 && (
        <div className="bg-green-50 rounded-xl p-4 border-l-4 border-green-500">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-green-600 text-lg">📈</span>
            <h4 className="font-bold text-green-900">👍 Points forts</h4>
          </div>
          <ul className="space-y-2">
            {analysis.points_forts.map((p, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-green-600 mt-1 font-bold">✓</span>
                <span className="text-gray-700">{p}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Points à améliorer */}
      {analysis.points_attention?.length > 0 && (
        <div className="bg-orange-50 rounded-xl p-4 border-l-4 border-orange-500">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-orange-600 text-lg">⚠️</span>
            <h4 className="font-bold text-orange-900">⚠️ Points à améliorer</h4>
          </div>
          <ul className="space-y-2">
            {analysis.points_attention.map((p, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-orange-600 mt-1 font-bold">!</span>
                <span className="text-gray-700">{p}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommandations */}
      {analysis.recommandations?.length > 0 && (
        <div className="bg-indigo-50 rounded-xl p-4 border-l-4 border-indigo-500">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-indigo-600 text-lg">💡</span>
            <h4 className="font-bold text-indigo-900">🎯 Recommandations</h4>
          </div>
          <ol className="space-y-2 list-decimal list-inside">
            {analysis.recommandations.map((r, i) => (
              <li key={i} className="text-gray-700">{r}</li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
