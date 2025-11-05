import React from 'react';
import { Award, TrendingUp, Heart, Sparkles } from 'lucide-react';

const STYLE_EMOJIS = {
  'Convivial': '🤝',
  'Explorateur': '🔍',
  'Dynamique': '⚡',
  'Discret': '🎯',
  'Stratège': '♟️'
};

const MOTIVATION_ICONS = {
  'Relation': Heart,
  'Reconnaissance': Award,
  'Performance': TrendingUp,
  'Découverte': Sparkles
};

export default function DiagnosticResult({ diagnostic, onContinue }) {
  const StyleIcon = MOTIVATION_ICONS[diagnostic.motivation] || Heart;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-[#fffef9] to-[#fff9e6]">
      <div className="w-full max-w-3xl">
        <div className="glass-morphism rounded-3xl shadow-2xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <img src="/logo-icon.png" alt="Retail Performer" className="w-20 h-20 mx-auto mb-4 rounded-xl shadow-md object-contain bg-white p-2" />
            <div className="text-6xl mb-4">🎉</div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Ton profil vendeur est prêt !</h1>
            <p className="text-gray-600">Découvre ton style unique et tes forces</p>
          </div>

          {/* Profile Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {/* Style */}
            <div className="bg-white rounded-2xl p-6 text-center border-2 border-[#ffd871]">
              <div className="text-5xl mb-3">{STYLE_EMOJIS[diagnostic.style]}</div>
              <p className="text-sm text-gray-600 mb-1">Ton style</p>
              <p className="text-xl font-bold text-gray-800">{diagnostic.style}</p>
            </div>

            {/* Level */}
            <div className="bg-white rounded-2xl p-6 text-center border-2 border-gray-200">
              <div className="text-5xl mb-3">🎓</div>
              <p className="text-sm text-gray-600 mb-1">Ton niveau</p>
              <p className="text-xl font-bold text-gray-800">{diagnostic.level}</p>
            </div>

            {/* Motivation */}
            <div className="bg-white rounded-2xl p-6 text-center border-2 border-gray-200">
              <div className="mb-3">
                <StyleIcon className="w-12 h-12 mx-auto text-[#ffd871]" />
              </div>
              <p className="text-sm text-gray-600 mb-1">Ta motivation</p>
              <p className="text-xl font-bold text-gray-800">{diagnostic.motivation}</p>
            </div>
          </div>

          {/* AI Summary */}
          <div className="bg-[#ffd871] bg-opacity-10 rounded-2xl p-6 mb-8 border-l-4 border-[#ffd871]">
            <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#ffd871]" />
              Analyse de ton profil
            </h3>
            <div className="text-gray-700 whitespace-pre-line leading-relaxed">
              {diagnostic.ai_profile_summary}
            </div>
          </div>

          {/* Action Button */}
          <div className="text-center">
            <button
              onClick={onContinue}
              className="btn-primary inline-flex items-center gap-2"
            >
              Accéder à mon tableau de bord
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
