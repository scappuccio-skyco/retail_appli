import React, { useState } from 'react';
import { Sparkles, X, RefreshCw, BookOpen } from 'lucide-react';
import { LABEL_DECOUVERTE } from '../lib/constants';
import GuideProfilsModal from './GuideProfilsModal';
import { renderMarkdownBold } from '../utils/markdownRenderer';

const styleDescriptions = {
  'Dynamique':   'Tu vas droit au but, tu challenges et tu convaincs avec énergie. Résultats et action sont tes moteurs.',
  'Convivial':   'Tu crées du lien et tu fidélises par la relation. La confiance que tu inspires est ton principal atout.',
  'Discret':     'Tu écoutes, tu observes et tu construis une confiance durable. Tu vends mieux que tu ne le montres.',
  'Stratège':    'Tu analyses, tu argumentes avec précision et tu gères les objections. Tes conseils sont toujours fondés.',
  'Explorateur': "Tu es curieux, adaptable et à l'aise dans l'imprévu. Tu sais trouver l'angle qui fait mouche.",
};

const competences = [
  { key: 'score_accueil',       label: 'Accueil' },
  { key: 'score_decouverte',    label: LABEL_DECOUVERTE },
  { key: 'score_argumentation', label: 'Argumentation' },
  { key: 'score_closing',       label: 'Closing' },
  { key: 'score_fidelisation',  label: 'Fidélisation' },
];

function ScoreBar({ label, score }) {
  const pct = Math.round((score / 10) * 100);
  const color = score >= 7 ? 'bg-green-500' : score >= 5 ? 'bg-yellow-400' : 'bg-orange-500';
  const textColor = score >= 7 ? 'text-green-700' : score >= 5 ? 'text-yellow-700' : 'text-orange-600';
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-sm text-gray-700">{label}</span>
        <span className={`text-sm font-bold ${textColor}`}>{score}/10</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2">
        <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function SellerProfileModal({ diagnostic, onClose, onRedoDiagnostic }) {
  const [showGuide, setShowGuide] = useState(false);

  if (!diagnostic) return null;

  const styleDesc = styleDescriptions[diagnostic.style] || '';
  const allScoresZero = competences.every(c => !diagnostic[c.key]);

  const handleRedo = () => {
    onClose();
    if (onRedoDiagnostic) onRedoDiagnostic();
  };

  return (
    <>
      <div
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
      >
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[85vh] overflow-y-auto">

          {/* Header */}
          <div className="bg-gradient-to-r from-[#1E40AF] to-[#1E3A8A] p-6 rounded-t-2xl relative">
            <button onClick={onClose} className="absolute top-4 right-4 text-white hover:text-gray-200 transition-colors">
              <X className="w-6 h-6" />
            </button>
            <div className="flex items-center gap-3">
              <Sparkles className="w-8 h-8 text-white" />
              <h2 className="text-2xl font-bold text-white">🎯 Mon Profil de Vente</h2>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-4">

            {/* Nom du profil + description */}
            <div>
              <div className="flex items-center gap-3 mb-1 flex-wrap">
                <h3 className="text-2xl font-bold text-gray-800">🎨 {diagnostic.style || 'Profil en cours'}</h3>
                <div className="flex gap-2 flex-wrap">
                  {diagnostic.level && (
                    <span className="bg-green-100 text-green-800 text-xs font-semibold px-3 py-1 rounded-full">
                      ⭐ {diagnostic.level}
                    </span>
                  )}
                  {diagnostic.motivation && (
                    <span className="bg-orange-100 text-orange-800 text-xs font-semibold px-3 py-1 rounded-full">
                      ⚡ {diagnostic.motivation}
                    </span>
                  )}
                </div>
              </div>
              {styleDesc && <p className="text-gray-600 text-base">{styleDesc}</p>}
            </div>

            {/* Forces */}
            {diagnostic.strengths?.length > 0 && (
              <div className="bg-green-50 rounded-xl p-5">
                <p className="text-sm font-semibold text-green-700 mb-3">💪 Tes forces :</p>
                <ul className="space-y-2">
                  {diagnostic.strengths.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-green-800">
                      <span className="text-green-500 mt-0.5 flex-shrink-0">✓</span>
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Axes de développement */}
            {diagnostic.axes_de_developpement?.length > 0 && (
              <div className="bg-orange-50 rounded-xl p-5">
                <p className="text-sm font-semibold text-orange-700 mb-3">🎯 Axes à développer :</p>
                <ul className="space-y-2">
                  {diagnostic.axes_de_developpement.map((a, i) => (
                    <li key={i} className="flex items-start gap-2 text-orange-800">
                      <span className="text-orange-500 mt-0.5 flex-shrink-0">→</span>
                      {a}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Analyse IA */}
            {diagnostic.ai_profile_summary && (
              <div className="bg-blue-50 rounded-xl p-5">
                <p className="text-sm font-semibold text-blue-900 mb-2">🚀 Recommandation :</p>
                <p className="text-blue-800">{renderMarkdownBold(diagnostic.ai_profile_summary)}</p>
              </div>
            )}

            {/* Compétences avec barres */}
            <div className="bg-gray-50 rounded-xl p-5">
              <p className="text-sm font-semibold text-gray-800 mb-4">📊 Tes compétences :</p>
              {allScoresZero ? (
                <p className="text-sm text-yellow-700 bg-yellow-50 rounded-lg p-3 border border-yellow-200">
                  ⚠️ Scores non disponibles. Refais le diagnostic pour les obtenir.
                </p>
              ) : (
                <div className="space-y-3">
                  {competences.map(c => (
                    <ScoreBar key={c.key} label={c.label} score={diagnostic[c.key] ?? 0} />
                  ))}
                </div>
              )}
            </div>

            {/* DISC */}
            {diagnostic.disc_dominant && diagnostic.disc_percentages &&
              Object.values(diagnostic.disc_percentages).some(p => p > 0) && (
              <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-5 border-2 border-purple-200">
                <p className="text-lg font-bold text-purple-800 mb-3">
                  🎭 Profil DISC : <span className="text-indigo-700">
                    {{ D: 'Dominant', I: 'Influent', S: 'Stable', C: 'Consciencieux' }[diagnostic.disc_dominant] || diagnostic.disc_dominant}
                  </span>
                </p>
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { key: 'D', label: 'Dominant',      color: 'text-red-600' },
                    { key: 'I', label: 'Influent',       color: 'text-yellow-600' },
                    { key: 'S', label: 'Stable',         color: 'text-green-600' },
                    { key: 'C', label: 'Consciencieux',  color: 'text-blue-600' },
                  ].map(({ key, label, color }) => (
                    <div key={key} className="bg-white rounded-lg p-3 text-center shadow-sm">
                      <p className="text-xs text-gray-500 mb-1">{label}</p>
                      <p className={`text-2xl font-bold ${color}`}>{diagnostic.disc_percentages?.[key] || 0}%</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Guide des Profils */}
            <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl p-4 border-2 border-blue-200">
              <p className="text-sm text-gray-700 mb-3 text-center">
                💡 Envie de mieux comprendre les différents profils de vente ?
              </p>
              <button
                onClick={() => setShowGuide(true)}
                className="w-full btn-primary bg-gradient-to-r from-[#1E40AF] to-[#1E3A8A] text-white hover:shadow-xl flex items-center justify-center gap-2 py-3"
              >
                <BookOpen className="w-5 h-5" />
                📚 Consulter le Guide des Profils
              </button>
            </div>

            {/* Refaire */}
            <div className="text-center pt-1">
              <button onClick={handleRedo} className="btn-secondary px-6 py-3 flex items-center justify-center gap-2 mx-auto">
                <RefreshCw className="w-5 h-5" />
                Refaire mon diagnostic
              </button>
              <p className="text-xs text-gray-400 mt-2">Ton profil peut évoluer avec le temps</p>
            </div>

          </div>
        </div>
      </div>

      {showGuide && (
        <GuideProfilsModal
          onClose={() => setShowGuide(false)}
          userRole="seller"
          userProfileName={diagnostic.style}
        />
      )}
    </>
  );
}
