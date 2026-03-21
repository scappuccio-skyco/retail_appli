import React from 'react';
import { Calendar, Clock, ChevronDown, Trash2, Copy, Download } from 'lucide-react';
import { renderBriefContent } from './briefRenderers';

const HistoryTab = ({
  // History state
  history,
  loadingHistory,
  expandedItems,
  setExpandedItems,
  // Actions
  setActiveTab,
  handleDeleteBrief,
  handleCopy,
  exportBriefToPDF,
}) => {
  return (
    <div className="space-y-4">
      {loadingHistory && (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-amber-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement de l&apos;historique...</p>
        </div>
      )}

      {!loadingHistory && history.length === 0 && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📋</div>
          <p className="text-gray-600">Aucun brief dans l&apos;historique</p>
          <button
            onClick={() => setActiveTab('new')}
            className="mt-4 px-6 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600"
          >
            Créer un brief
          </button>
        </div>
      )}

      {!loadingHistory && history.length > 0 && (
        <div className="space-y-4">
          {history.map((item, index) => {
            const isExpanded = expandedItems[item.brief_id];
            const isLatest = index === 0;

            return (
              <div
                key={item.brief_id}
                className={`border-2 rounded-xl overflow-hidden transition-all ${
                  isLatest
                    ? 'border-amber-400 bg-gradient-to-br from-amber-50 to-orange-50 shadow-lg'
                    : 'border-gray-200 bg-white hover:shadow-md'
                }`}
              >
                {/* Header */}
                <div
                  className="p-4 cursor-pointer hover:bg-white/50 transition-colors"
                  onClick={() => setExpandedItems(prev => ({ ...prev, [item.brief_id]: !prev[item.brief_id] }))}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {isLatest && (
                          <span className="px-2 py-0.5 bg-amber-500 text-white text-xs font-bold rounded-full">DERNIER</span>
                        )}
                        <span className="text-sm font-semibold text-gray-800">Brief du {item.date}</span>
                      </div>
                      <div className="flex items-center gap-4 flex-wrap text-sm text-gray-600">
                        {item.data_date && (
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            <span>Données: {item.data_date}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          <span>{new Date(item.generated_at).toLocaleString('fr-FR')}</span>
                        </div>
                        {item.has_context && (
                          <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-xs">Avec consigne</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <ChevronDown className={`w-5 h-5 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteBrief(item.brief_id); }}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t-2 border-gray-200 bg-gradient-to-br from-orange-50 to-yellow-50 p-6">
                    <div className="space-y-4">
                      {renderBriefContent(item)}
                    </div>
                    <div className="mt-4 flex justify-end gap-2">
                      <button
                        onClick={() => handleCopy(item.brief)}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 flex items-center gap-2 text-sm"
                      >
                        <Copy className="w-4 h-4" /> Copier
                      </button>
                      <button
                        onClick={() => exportBriefToPDF(item)}
                        className="px-4 py-2 bg-[#1E40AF] text-white rounded-lg hover:bg-[#1E3A8A] flex items-center gap-2 text-sm"
                      >
                        <Download className="w-4 h-4" /> PDF
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default HistoryTab;
