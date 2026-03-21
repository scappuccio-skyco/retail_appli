import React from 'react';

// Palette de couleurs
export const colorPalette = [
  { badge: 'bg-amber-100 text-amber-800', card: 'bg-amber-50 border-amber-200', gradient: 'from-amber-500 to-orange-500' },
  { badge: 'bg-indigo-100 text-indigo-800', card: 'bg-indigo-50 border-indigo-200', gradient: 'from-indigo-500 to-purple-600' },
  { badge: 'bg-green-100 text-green-800', card: 'bg-green-50 border-green-200', gradient: 'from-green-500 to-emerald-600' },
  { badge: 'bg-purple-100 text-purple-800', card: 'bg-purple-50 border-purple-200', gradient: 'from-purple-500 to-indigo-600' },
  { badge: 'bg-pink-100 text-pink-800', card: 'bg-pink-50 border-pink-200', gradient: 'from-pink-500 to-rose-600' }
];

// Helper function to parse Markdown bold text
export const parseBoldText = (text) => {
  if (!text) return [<span key="empty"></span>];

  const parts = [];
  let lastIndex = 0;
  const regex = /\*\*([^*]+)\*\*/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const beforeText = text.substring(lastIndex, match.index);
      if (beforeText) {
        parts.push(beforeText);
      }
    }
    parts.push({ type: 'bold', text: match[1] });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    const remainingText = text.substring(lastIndex);
    if (remainingText) {
      parts.push(remainingText);
    }
  }

  if (parts.length === 0) {
    parts.push(text);
  }

  return parts.map((part, i) => {
    if (typeof part === 'object' && part.type === 'bold') {
      return <strong key={i} className="font-semibold text-gray-900">{part.text}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
};

// Helper function to render content with Markdown support
export const renderContentWithMarkdown = (content) => {
  if (!content) return null;

  // Split by lines to handle lists
  const lines = content.split('\n');

  return (
    <div className="space-y-2">
      {lines.map((line, lineIdx) => {
        const cleaned = line.trim();
        if (!cleaned) return null;

        // Handle list items (lines starting with -)
        if (cleaned.match(/^[-•]\s*/)) {
          const text = cleaned.replace(/^[-•]\s*/, '');
          return (
            <div key={lineIdx} className="flex gap-3 items-start pl-2 mb-1">
              <span className="w-2 h-2 rounded-full mt-2 flex-shrink-0 bg-indigo-500"></span>
              <div className="flex-1 text-gray-700 leading-relaxed">
                {parseBoldText(text)}
              </div>
            </div>
          );
        }

        // Regular text with bold support
        return (
          <p key={lineIdx} className="text-gray-700 leading-relaxed">
            {parseBoldText(cleaned)}
          </p>
        );
      })}
    </div>
  );
};

// Render structured brief (nouveau format V2)
export const renderStructuredBrief = (structured) => {
  if (!structured) return null;

  return (
    <div className="space-y-4">
      {/* 🌤️ Humeur du Jour - AFFICHÉ EN PREMIER */}
      {structured.humeur && (
        <div className={`rounded-xl p-5 shadow-sm border-2 ${colorPalette[0].card}`}>
          <div className="mb-3">
            <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm ${colorPalette[0].badge}`}>
              ⛅ L'Humeur du Jour
            </span>
          </div>
          {renderContentWithMarkdown(structured.humeur)}
        </div>
      )}

      {/* 📊 Flashback */}
      {structured.flashback && (
        <div className={`rounded-xl p-5 shadow-sm border-2 ${colorPalette[1].card}`}>
          <div className="mb-3">
            <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm ${colorPalette[1].badge}`}>
              📊 Flash-Back
            </span>
          </div>
          {renderContentWithMarkdown(structured.flashback)}
        </div>
      )}

      {/* 🌟 Coup de projecteur */}
      {structured.spotlight && (
        <div className="rounded-xl p-5 shadow-sm border-2 border-amber-200 bg-amber-50">
          <div className="mb-3">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm bg-amber-100 text-amber-800 border border-amber-300">
              🌟 Coup de Projecteur
            </span>
          </div>
          {renderContentWithMarkdown(structured.spotlight)}
        </div>
      )}

      {/* 🎯 Focus/Mission */}
      {structured.focus && (
        <div className={`rounded-xl p-5 shadow-sm border-2 ${colorPalette[2].card}`}>
          <div className="mb-3">
            <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm ${colorPalette[2].badge}`}>
              🎯 Mission du Jour
            </span>
          </div>
          {renderContentWithMarkdown(structured.focus)}
        </div>
      )}

      {/* 💡 Méthodes/Exemples */}
      {structured.examples && structured.examples.length > 0 && (
        <div className={`rounded-xl p-5 shadow-sm border-2 ${colorPalette[0].card}`}>
          <div className="mb-3">
            <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm ${colorPalette[0].badge}`}>
              💡 Méthode
            </span>
          </div>
          <ul className="space-y-2">
            {structured.examples.map((example, idx) => (
              <li key={idx} className="flex gap-3 items-start">
                <span className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 bg-gradient-to-br ${colorPalette[0].gradient}`}></span>
                <div className="text-gray-700">
                  {parseBoldText(example)}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 💥 Le Défi */}
      {structured.team_question && (
        <div className={`rounded-xl p-5 shadow-sm border-2 ${colorPalette[3].card}`}>
          <div className="mb-3">
            <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm ${colorPalette[3].badge}`}>
              💥 Le Défi
            </span>
          </div>
          {renderContentWithMarkdown(structured.team_question)}
        </div>
      )}

      {/* 🚀 On y va ! */}
      {structured.booster && (
        <div className={`rounded-xl p-5 shadow-sm border-2 ${colorPalette[4].card}`}>
          <div className="mb-3">
            <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm ${colorPalette[4].badge}`}>
              🚀 On y va !
            </span>
          </div>
          {renderContentWithMarkdown(structured.booster)}
        </div>
      )}
    </div>
  );
};

// Parse et affiche le brief avec le style des sections colorées (legacy format)
export const renderBriefContent = (briefData) => {
  // ⭐ TOUJOURS utiliser le markdown complet pour l'affichage
  // Le format structuré peut manquer certaines sections, le markdown est plus complet
  const briefText = typeof briefData === 'string' ? briefData : briefData.brief;
  if (!briefText) return null;

  const sections = briefText.split(/(?=###\s)/).filter(s => s.trim() && s.trim().startsWith('###'));

  return sections.map((section, sectionIdx) => {
    const lines = section.trim().split('\n');
    let rawTitle = lines[0].replace(/^#+\s*/, '').trim();
    const title = rawTitle.replace(/\*\*/g, '');
    const content = lines.slice(1).join('\n').trim();

    let colorScheme;
    const titleLower = title.toLowerCase();

    if (titleLower.includes('humeur') || titleLower.includes('bonjour') || titleLower.includes('matin')) {
      colorScheme = colorPalette[0];
    } else if (titleLower.includes('flash') || titleLower.includes('bilan') || titleLower.includes('performance') || titleLower.includes('hier')) {
      colorScheme = colorPalette[1];
    } else if (titleLower.includes('mission') || titleLower.includes('objectif') || titleLower.includes('focus')) {
      colorScheme = colorPalette[2];
    } else if (titleLower.includes('challenge') || titleLower.includes('défi') || titleLower.includes('café')) {
      colorScheme = colorPalette[3];
    } else if (titleLower.includes('mot') || titleLower.includes('fin') || titleLower.includes('conclusion')) {
      colorScheme = colorPalette[4];
    } else {
      colorScheme = colorPalette[sectionIdx % colorPalette.length];
    }

    return (
      <div key={sectionIdx} className={`rounded-xl p-5 shadow-sm border-2 ${colorScheme.card}`}>
        <div className="mb-4">
          <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm ${colorScheme.badge}`}>
            {title}
          </span>
        </div>

        <div className="space-y-2">
          {content.split('\n').map((line, lineIdx) => {
            const cleaned = line.trim();
            if (!cleaned || cleaned === '---' || cleaned === '***' || cleaned.startsWith('*Brief généré')) return null;

            // Titre de sous-section (ligne entière en gras)
            if (cleaned.startsWith('**') && cleaned.endsWith('**') && !cleaned.includes(':') && cleaned.split('**').length === 3) {
              const subtitle = cleaned.replace(/\*\*/g, '');
              return (
                <h5 key={lineIdx} className="text-base font-bold text-gray-900 mt-3 mb-2 flex items-center gap-2 first:mt-0">
                  <span className={`w-2 h-2 rounded-full bg-gradient-to-br ${colorScheme.gradient}`}></span>
                  {subtitle}
                </h5>
              );
            }

            // Liste avec tiret
            if (cleaned.match(/^[-•]\s*/)) {
              const text = cleaned.replace(/^[-•]\s*/, '');
              return (
                <div key={lineIdx} className="flex gap-3 items-start pl-2 mb-2">
                  <span className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 bg-gradient-to-br ${colorScheme.gradient}`}></span>
                  <div className="flex-1 text-gray-700 leading-relaxed">
                    {parseBoldText(text)}
                  </div>
                </div>
              );
            }

            // Texte normal avec support du gras
            return (
              <p key={lineIdx} className="text-gray-700 leading-relaxed">
                {parseBoldText(cleaned)}
              </p>
            );
          })}
        </div>
      </div>
    );
  });
};
