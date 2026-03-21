import React from 'react';
import { ChevronDown, Loader, Trash2 } from 'lucide-react';
import { renderMarkdownBold } from '../../utils/markdownRenderer';

export default function HistoryItem({
  item,
  index,
  isExpanded,
  onToggleExpand,
  resolvingItem,
  onToggleResolved,
  onDelete,
  situationTypes,
}) {
  const isLatest = index === 0;

  return (
    <div
      className={`border-2 rounded-xl overflow-hidden transition-all ${
        isLatest
          ? 'border-purple-400 bg-gradient-to-br from-purple-50 to-indigo-50 shadow-lg'
          : 'border-gray-200 bg-white hover:shadow-md'
      }`}
    >
      {/* Header — clickable to expand/collapse */}
      <div
        className="p-4 cursor-pointer hover:bg-white/50 transition-colors"
        onClick={() => onToggleExpand(item.id)}
      >
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              {isLatest && (
                <span className="px-2 py-0.5 bg-purple-500 text-white text-xs font-bold rounded-full">
                  NOUVEAU
                </span>
              )}
              <h4 className="font-bold text-gray-800">
                {item.seller_name}
                {item.seller_status !== 'active' && (
                  <span className="text-xs text-gray-500 ml-2">({item.seller_status})</span>
                )}
              </h4>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`px-3 py-1 rounded-full text-sm font-semibold ${
                  item.advice_type === 'relationnel'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-red-100 text-red-700'
                }`}
              >
                {item.advice_type === 'relationnel' ? '🤝 Relationnel' : '⚡ Conflit'}
              </span>
              <span className="text-sm text-gray-600 font-medium">
                {situationTypes[item.advice_type]?.find(t => t.value === item.situation_type)?.label ||
                  item.situation_type}
              </span>
              {item.resolved && (
                <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-bold rounded-full">
                  ✓ Résolu
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end gap-2">
              <span className="text-xs text-gray-500 font-medium">
                {new Date(item.created_at).toLocaleDateString('fr-FR', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
              <ChevronDown
                className={`w-5 h-5 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              />
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleResolved(item);
              }}
              disabled={resolvingItem === item.id}
              className={`p-2 rounded-lg transition-colors text-sm font-medium flex items-center gap-1 ${
                item.resolved
                  ? 'text-green-600 hover:bg-green-50'
                  : 'text-gray-400 hover:bg-green-50 hover:text-green-600'
              }`}
              title={item.resolved ? 'Marquer comme non résolu' : 'Marquer comme résolu'}
            >
              {resolvingItem === item.id ? (
                <Loader className="w-4 h-4 animate-spin" />
              ) : (
                <span>{item.resolved ? '✓' : '○'}</span>
              )}
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(item.id);
              }}
              className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              title="Supprimer cette consultation"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Situation preview when collapsed */}
        {!isExpanded && (
          <p className="text-sm text-gray-600 mt-2 line-clamp-2">
            <strong>Situation :</strong> {item.description}
          </p>
        )}
      </div>

      {/* Expanded detail */}
      {isExpanded && (
        <div className="border-t-2 border-gray-200 bg-gradient-to-br from-orange-50 to-yellow-50">
          <div className="p-6">
            {/* Full situation */}
            <div className="bg-white rounded-xl p-5 shadow-sm border-l-4 border-orange-400 mb-6">
              <h5 className="font-bold text-gray-800 mb-3 flex items-center gap-2 text-base">
                📋 Situation décrite
              </h5>
              <p className="text-gray-700 leading-relaxed">{item.description}</p>
            </div>

            {/* Recommendations */}
            <div className="space-y-4">
              {item.recommendation
                .split('##')
                .filter(s => s.trim())
                .map((section, idx) => {
                  const lines = section.trim().split('\n');
                  const title = lines[0].trim();
                  const content = lines.slice(1).join('\n').trim();

                  let colorScheme = {
                    badge: 'bg-purple-100 text-purple-800',
                    card: 'bg-purple-50 border-purple-200',
                    icon: '💡',
                  };
                  if (title.toLowerCase().includes('analyse')) {
                    colorScheme = { badge: 'bg-blue-100 text-blue-800', card: 'bg-blue-50 border-blue-200', icon: '🔍' };
                  } else if (title.toLowerCase().includes('conseil') || title.toLowerCase().includes('pratique')) {
                    colorScheme = { badge: 'bg-green-100 text-green-800', card: 'bg-green-50 border-green-200', icon: '✅' };
                  } else if (title.toLowerCase().includes('phrase') || title.toLowerCase().includes('communication')) {
                    colorScheme = { badge: 'bg-amber-100 text-amber-800', card: 'bg-amber-50 border-amber-200', icon: '💬' };
                  } else if (title.toLowerCase().includes('vigilance')) {
                    colorScheme = { badge: 'bg-red-100 text-red-800', card: 'bg-red-50 border-red-200', icon: '⚠️' };
                  }

                  return (
                    <div key={idx} className={`rounded-xl p-5 shadow-sm border-2 ${colorScheme.card}`}>
                      <div className="mb-4">
                        <span
                          className={`inline-flex items-center gap-2 px-3 py-1 rounded-full font-bold text-sm ${colorScheme.badge}`}
                        >
                          <span>{colorScheme.icon}</span>
                          {title}
                        </span>
                      </div>

                      <div className="space-y-3">
                        {content.split('\n').map((line, lineIdx) => {
                          const cleaned = line.trim();
                          if (!cleaned) return null;

                          if (cleaned.match(/^\d+[.)]/)) {
                            const number = cleaned.match(/^(\d+)[.)]/)[1];
                            const text = cleaned.replace(/^\d+[.)]\s*/, '');
                            return (
                              <div key={lineIdx} className="flex gap-3 items-start bg-white rounded-lg p-3 shadow-sm">
                                <span className="flex-shrink-0 w-7 h-7 bg-gradient-to-br from-purple-500 to-indigo-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                                  {number}
                                </span>
                                <p className="flex-1 text-gray-800">{renderMarkdownBold(text)}</p>
                              </div>
                            );
                          }

                          if (cleaned.startsWith('-') || cleaned.startsWith('•')) {
                            const text = cleaned.replace(/^[-•]\s*/, '');
                            return (
                              <div key={lineIdx} className="flex gap-3 items-start">
                                <span className="text-purple-600 font-bold text-lg mt-0.5">•</span>
                                <p className="flex-1 text-gray-700">{renderMarkdownBold(text)}</p>
                              </div>
                            );
                          }

                          return (
                            <p key={lineIdx} className="text-gray-700 leading-relaxed">
                              {cleaned}
                            </p>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
