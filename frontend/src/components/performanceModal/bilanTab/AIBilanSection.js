import React from 'react';
import { TrendingUp, Target, AlertTriangle, Sparkles } from 'lucide-react';

/**
 * Reusable AI bilan display for all period views.
 * size='lg' for semaine (larger animation), 'md' for jour/mois/annee.
 * onGenerate: if provided, shows empty state button; otherwise no empty state.
 */
export default function AIBilanSection({ bilan, generating, onGenerate, periodLabel, bilanSectionRef, size = 'md' }) {
  const iconWrap = size === 'lg' ? 'w-20 h-20' : 'w-16 h-16';
  const sparkleSize = size === 'lg' ? 'w-10 h-10' : 'w-8 h-8';
  const title = bilan?.periode ? `💡 Synthèse — ${bilan.periode}` : '💡 Synthèse de la semaine';
  const fortLabel = bilan?.periode ? '👍 Points forts' : '👍 Tes points forts';
  const recoLabel = bilan?.periode ? '🎯 Recommandations' : '🎯 Recommandations personnalisées';

  if (generating) {
    return (
      <div className="bg-white rounded-2xl p-8 max-w-md mx-auto shadow-2xl border-2 border-blue-200">
        <div className="text-center mb-6">
          <div className={`${iconWrap} mx-auto mb-4 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center animate-pulse`}>
            <Sparkles className={`${sparkleSize} text-white`} />
          </div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">Analyse en cours...</h3>
          {size === 'lg' ? (
            <p className="text-gray-600">L'IA analyse vos performances de la semaine et prépare votre bilan personnalisé</p>
          ) : (
            <p className="text-gray-600 text-sm">L'IA analyse vos performances sur {periodLabel}</p>
          )}
        </div>
        <div className={`relative w-full bg-gray-200 rounded-full overflow-hidden ${size === 'lg' ? 'h-3' : 'h-2'}`}>
          <div
            className="absolute inset-0 bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-500"
            style={{ animation: 'progress-slide 2s ease-in-out infinite', backgroundSize: '200% 100%' }}
          />
        </div>
        {size === 'lg' && (
          <div className="mt-4 text-center text-sm text-gray-500">
            <p>⏱️ Temps estimé : 30-60 secondes</p>
          </div>
        )}
      </div>
    );
  }

  if (bilan?.synthese) {
    return (
      <div ref={bilanSectionRef} className="space-y-4">
        <div className="bg-blue-50 rounded-xl p-4 border-l-4 border-blue-500">
          <div className="flex items-start gap-2 mb-2">
            <Sparkles className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <h3 className="font-bold text-blue-900">{title}</h3>
          </div>
          <p className="text-gray-700 leading-relaxed">{bilan.synthese}</p>
        </div>

        {bilan.action_prioritaire && (
          <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-xl p-4 text-white shadow-lg">
            <div className="flex items-center gap-2 mb-1">
              <Target className="w-5 h-5 flex-shrink-0" />
              <h3 className="font-bold text-sm uppercase tracking-wide">🎯 Action prioritaire</h3>
            </div>
            <p className="text-lg font-semibold leading-snug">{bilan.action_prioritaire}</p>
          </div>
        )}

        {bilan.points_forts?.length > 0 && (
          <div className="bg-green-50 rounded-xl p-4 border-l-4 border-green-500">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-5 h-5 text-green-600" />
              <h3 className="font-bold text-green-900">{fortLabel}</h3>
            </div>
            <ul className="space-y-2">
              {bilan.points_forts.map((p, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-green-600 mt-1">✓</span>
                  <span className="text-gray-700">{p}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {bilan.points_attention?.length > 0 && (
          <div className="bg-orange-50 rounded-xl p-4 border-l-4 border-orange-500">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
              <h3 className="font-bold text-orange-900">⚠️ Points à améliorer</h3>
            </div>
            <ul className="space-y-2">
              {bilan.points_attention.map((p, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-orange-600 mt-1">!</span>
                  <span className="text-gray-700">{p}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {bilan.recommandations?.length > 0 && (
          <div className="bg-indigo-50 rounded-xl p-4 border-l-4 border-indigo-500">
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-5 h-5 text-indigo-600" />
              <h3 className="font-bold text-indigo-900">{recoLabel}</h3>
            </div>
            <ol className="space-y-2 list-decimal list-inside">
              {bilan.recommandations.map((r, i) => (
                <li key={i} className="text-gray-700">{r}</li>
              ))}
            </ol>
          </div>
        )}
      </div>
    );
  }

  if (onGenerate) {
    return (
      <div className="text-center py-8 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
        <Sparkles className="w-10 h-10 text-gray-400 mx-auto mb-3" />
        <p className="text-gray-600 mb-4">Aucune analyse IA pour cette période</p>
        <button
          onClick={onGenerate}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-md hover:shadow-lg"
        >
          ✨ Générer l'analyse IA
        </button>
      </div>
    );
  }

  return null;
}
