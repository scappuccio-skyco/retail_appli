import React from 'react';
import { Calendar, Clock } from 'lucide-react';

const COLOR_PALETTE = [
  {
    badge: 'bg-indigo-100 text-indigo-800',
    card: 'bg-indigo-50 border-indigo-200',
    icon: '📊',
    gradient: 'from-indigo-500 to-purple-600'
  },
  {
    badge: 'bg-green-100 text-green-800',
    card: 'bg-green-50 border-green-200',
    icon: '✅',
    gradient: 'from-green-500 to-emerald-600'
  },
  {
    badge: 'bg-orange-100 text-orange-800',
    card: 'bg-orange-50 border-orange-200',
    icon: '⚠️',
    gradient: 'from-orange-500 to-red-500'
  },
  {
    badge: 'bg-purple-100 text-purple-800',
    card: 'bg-purple-50 border-purple-200',
    icon: '🎯',
    gradient: 'from-purple-500 to-indigo-600'
  },
  {
    badge: 'bg-teal-100 text-teal-800',
    card: 'bg-teal-50 border-teal-200',
    icon: '💡',
    gradient: 'from-teal-500 to-cyan-600'
  },
  {
    badge: 'bg-pink-100 text-pink-800',
    card: 'bg-pink-50 border-pink-200',
    icon: '🌟',
    gradient: 'from-pink-500 to-rose-600'
  }
];

function getColorScheme(title, sectionIdx) {
  const t = title.toLowerCase();
  if (t.includes('force') || t.includes('positif') || t.includes('réussite')) return COLOR_PALETTE[1];
  if (t.includes('attention') || t.includes('faible') || t.includes('améliorer') || t.includes('difficulté')) return COLOR_PALETTE[2];
  if (t.includes('recommandation') || t.includes('action') || t.includes('priorité')) return COLOR_PALETTE[3];
  if (t.includes('analyse') || t.includes('synthèse') || t.includes('résumé')) return COLOR_PALETTE[0];
  if (t.includes('opportunité') || t.includes('potentiel') || t.includes('développement')) return COLOR_PALETTE[4];
  return COLOR_PALETTE[sectionIdx % COLOR_PALETTE.length];
}

function renderInlineMarkdown(text, keyPrefix) {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={`${keyPrefix}-${i}`} className="font-bold text-gray-900">{part.slice(2, -2)}</strong>;
    }
    return <span key={`${keyPrefix}-${i}`}>{part}</span>;
  });
}

function AnalysisSection({ section, sectionIdx }) {
  const lines = section.trim().split('\n');
  const title = lines[0].trim().replace(/\*\*/g, '');
  const content = lines.slice(1).join('\n').trim();
  const colorScheme = getColorScheme(title, sectionIdx);

  return (
    <div className={`rounded-xl p-5 shadow-sm border-2 ${colorScheme.card}`}>
      <div className="mb-4">
        <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full font-bold text-sm ${colorScheme.badge}`}>
          <span>{colorScheme.icon}</span>
          {title}
        </span>
      </div>
      <div className="space-y-3">
        {content.split('\n').map((line, lineIdx) => {
          const cleaned = line.trim();
          if (!cleaned) return null;

          if (cleaned.startsWith('**') && cleaned.endsWith('**') && !cleaned.includes('-')) {
            const subtitle = cleaned.replace(/\*\*/g, '');
            return (
              <h5 key={lineIdx} className="text-base font-bold text-gray-900 mt-4 mb-2 flex items-center gap-2 first:mt-0">
                <span className={`w-2 h-2 rounded-full bg-gradient-to-br ${colorScheme.gradient}`}></span>
                {subtitle}
              </h5>
            );
          }

          if (cleaned.startsWith('-')) {
            const text = cleaned.replace(/^[-•]\s*/, '');
            return (
              <div key={lineIdx} className="flex gap-3 items-start">
                <span className="text-gray-400 font-bold text-lg mt-0.5">•</span>
                <p className="flex-1 text-gray-700 leading-relaxed">
                  {renderInlineMarkdown(text, `${sectionIdx}-${lineIdx}`)}
                </p>
              </div>
            );
          }

          return (
            <p key={lineIdx} className="text-gray-700 leading-relaxed">
              {renderInlineMarkdown(cleaned, `${sectionIdx}-${lineIdx}`)}
            </p>
          );
        })}
      </div>
    </div>
  );
}

export default function AnalysisContent({ analysisText, metadata }) {
  const sections = analysisText.split('##').filter(s => s.trim());

  return (
    <div className="space-y-4">
      {metadata && (
        <div className="bg-white rounded-xl p-4 shadow-sm border-2 border-gray-200">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Calendar className="w-4 h-4" />
              <span className="font-semibold">Période :</span>
              <span>
                {new Date(metadata.period_start).toLocaleDateString('fr-FR')}
                {' → '}
                {new Date(metadata.period_end).toLocaleDateString('fr-FR')}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Clock className="w-4 h-4" />
              <span className="font-semibold">Générée le :</span>
              <span>
                {new Date(metadata.generated_at).toLocaleDateString('fr-FR')} à{' '}
                {new Date(metadata.generated_at).toLocaleTimeString('fr-FR', {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="bg-gradient-to-br from-orange-50 to-yellow-50 rounded-xl p-6 space-y-4">
        {sections.map((section, idx) => (
          <AnalysisSection key={idx} section={section} sectionIdx={idx} />
        ))}
      </div>
    </div>
  );
}
