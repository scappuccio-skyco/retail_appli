import React from 'react';
import { MessageCircle, AlertTriangle, Filter, Calendar, ChevronDown } from 'lucide-react';
import HistoryItem from './HistoryItem';

export default function HistoryTab({
  history,
  filteredHistory,
  activeHistoryTab,
  setActiveHistoryTab,
  historyFilter,
  setHistoryFilter,
  loadHistory,
  isFilterDropdownOpen,
  setIsFilterDropdownOpen,
  filterDropdownRef,
  sellers,
  expandedItems,
  setExpandedItems,
  resolvingItem,
  onToggleResolved,
  onDelete,
  situationTypes,
}) {
  return (
    <div className="space-y-4">
      {/* History sub-tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveHistoryTab('all')}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all border-2 ${
            activeHistoryTab === 'all'
              ? 'border-purple-500 bg-purple-500 text-white shadow-md'
              : 'border-gray-300 text-gray-700 hover:border-purple-400 hover:text-purple-600 hover:bg-purple-50'
          }`}
        >
          📊 Tout l'historique
        </button>
        <button
          onClick={() => setActiveHistoryTab('relationnel')}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all border-2 ${
            activeHistoryTab === 'relationnel'
              ? 'border-purple-500 bg-purple-500 text-white shadow-md'
              : 'border-gray-300 text-gray-700 hover:border-purple-400 hover:text-purple-600 hover:bg-purple-50'
          }`}
        >
          <MessageCircle className="w-4 h-4 inline mr-1" />
          Relationnel
        </button>
        <button
          onClick={() => setActiveHistoryTab('conflit')}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all border-2 ${
            activeHistoryTab === 'conflit'
              ? 'border-purple-500 bg-purple-500 text-white shadow-md'
              : 'border-gray-300 text-gray-700 hover:border-purple-400 hover:text-purple-600 hover:bg-purple-50'
          }`}
        >
          <AlertTriangle className="w-4 h-4 inline mr-1" />
          Conflit
        </button>
      </div>

      {/* Filter by seller — custom dropdown */}
      <div className="flex items-center gap-3">
        <Filter className="w-5 h-5 text-gray-600" />
        <label className="text-sm font-semibold text-gray-700 mr-2">Filtrer par vendeur :</label>
        <div className="relative" ref={filterDropdownRef}>
          <button
            onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
            className="px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none bg-white text-gray-900 flex items-center justify-between gap-3 min-w-[250px] hover:bg-gray-50 transition-colors"
          >
            <span>
              {historyFilter === 'all'
                ? 'Tous les vendeurs'
                : sellers.find(s => s.id === historyFilter)?.name || 'Sélectionner...'}
            </span>
            <ChevronDown
              className={`w-4 h-4 transition-transform ${isFilterDropdownOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {isFilterDropdownOpen && (
            <div className="absolute top-full left-0 mt-2 w-full bg-white border-2 border-gray-300 rounded-lg shadow-xl z-10 max-h-64 overflow-y-auto">
              <button
                onClick={() => {
                  setHistoryFilter('all');
                  loadHistory(null);
                  setIsFilterDropdownOpen(false);
                }}
                className={`w-full px-4 py-2 text-left hover:bg-purple-50 transition-colors ${
                  historyFilter === 'all' ? 'bg-purple-100 text-purple-700 font-semibold' : 'text-gray-900'
                }`}
              >
                Tous les vendeurs
              </button>
              {sellers.map(seller => (
                <button
                  key={seller.id}
                  onClick={() => {
                    setHistoryFilter(seller.id);
                    loadHistory(seller.id);
                    setIsFilterDropdownOpen(false);
                  }}
                  className={`w-full px-4 py-2 text-left hover:bg-purple-50 transition-colors ${
                    historyFilter === seller.id
                      ? 'bg-purple-100 text-purple-700 font-semibold'
                      : 'text-gray-900'
                  }`}
                >
                  {seller.name} {seller.status !== 'active' && `(${seller.status})`}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* History list */}
      {history.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Aucun historique</p>
        </div>
      ) : filteredHistory.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Aucune consultation correspondant aux filtres</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredHistory.map((item, index) => (
            <HistoryItem
              key={item.id}
              item={item}
              index={index}
              isExpanded={!!expandedItems[item.id]}
              onToggleExpand={id =>
                setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }))
              }
              resolvingItem={resolvingItem}
              onToggleResolved={onToggleResolved}
              onDelete={onDelete}
              situationTypes={situationTypes}
            />
          ))}
        </div>
      )}
    </div>
  );
}
