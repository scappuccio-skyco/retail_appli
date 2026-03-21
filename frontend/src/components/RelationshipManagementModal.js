import React from 'react';
import { X, MessageCircle, AlertTriangle, Users, Calendar } from 'lucide-react';
import useRelationshipManagementModal from './relationshipModal/useRelationshipManagementModal';
import FormTab from './relationshipModal/FormTab';
import HistoryTab from './relationshipModal/HistoryTab';

export default function RelationshipManagementModal({ onClose, onSuccess, sellers = [], autoShowResult = false, storeId = null }) {
  const s = useRelationshipManagementModal({ sellers, autoShowResult, storeId, onSuccess });

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-500 to-indigo-600 p-6 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Users className="w-6 h-6" />
              Gestion relationnelle & Conflit
            </h2>
            <p className="text-purple-100 text-sm mt-1">
              Recommandations IA personnalisées pour votre équipe
            </p>
          </div>
          <button onClick={onClose} className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Main Tabs */}
        <div className="border-b border-gray-200 bg-gray-50">
          <div className="flex flex-wrap gap-2 px-3 sm:px-6 pt-2">
            <button
              onClick={() => { s.setActiveMainTab('form'); s.setActiveFormTab('relationnel'); s.resetForm(); }}
              className={`px-3 sm:px-6 py-2 sm:py-3 text-sm sm:text-base font-semibold transition-all rounded-t-lg ${
                s.activeMainTab === 'form' && s.activeFormTab === 'relationnel'
                  ? 'bg-purple-300 text-gray-800 shadow-md border-b-4 border-purple-500'
                  : 'text-gray-600 hover:text-purple-600 hover:bg-gray-100'
              }`}
            >
              <MessageCircle className="w-4 h-4 inline mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Gestion relationnelle</span>
              <span className="sm:hidden">Relationnel</span>
            </button>
            <button
              onClick={() => { s.setActiveMainTab('form'); s.setActiveFormTab('conflit'); s.resetForm(); }}
              className={`px-3 sm:px-6 py-2 sm:py-3 text-sm sm:text-base font-semibold transition-all rounded-t-lg ${
                s.activeMainTab === 'form' && s.activeFormTab === 'conflit'
                  ? 'bg-purple-300 text-gray-800 shadow-md border-b-4 border-purple-500'
                  : 'text-gray-600 hover:text-purple-600 hover:bg-gray-100'
              }`}
            >
              <AlertTriangle className="w-4 h-4 inline mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Gestion de conflit</span>
              <span className="sm:hidden">Conflit</span>
            </button>
            <button
              onClick={() => s.setActiveMainTab('history')}
              className={`px-3 sm:px-6 py-2 sm:py-3 text-sm sm:text-base font-semibold transition-all rounded-t-lg ${
                s.activeMainTab === 'history'
                  ? 'bg-purple-300 text-gray-800 shadow-md border-b-4 border-purple-500'
                  : 'text-gray-600 hover:text-purple-600 hover:bg-gray-100'
              }`}
            >
              <Calendar className="w-4 h-4 inline mr-1 sm:mr-2" />
              Historique
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {s.activeMainTab === 'form' ? (
            <FormTab
              activeFormTab={s.activeFormTab}
              activeSellers={s.activeSellers}
              selectedSeller={s.selectedSeller}
              setSelectedSeller={s.setSelectedSeller}
              isSellerDropdownOpen={s.isSellerDropdownOpen}
              setIsSellerDropdownOpen={s.setIsSellerDropdownOpen}
              sellerDropdownRef={s.sellerDropdownRef}
              situationType={s.situationType}
              setSituationType={s.setSituationType}
              situationTypes={s.situationTypes}
              description={s.description}
              setDescription={s.setDescription}
              conflictContexte={s.conflictContexte}
              setConflictContexte={s.setConflictContexte}
              conflictComportement={s.conflictComportement}
              setConflictComportement={s.setConflictComportement}
              conflictImpact={s.conflictImpact}
              setConflictImpact={s.setConflictImpact}
              conflictTentatives={s.conflictTentatives}
              setConflictTentatives={s.setConflictTentatives}
              onSubmit={s.handleGenerateAdvice}
            />
          ) : (
            <HistoryTab
              history={s.history}
              filteredHistory={s.filteredHistory}
              activeHistoryTab={s.activeHistoryTab}
              setActiveHistoryTab={s.setActiveHistoryTab}
              historyFilter={s.historyFilter}
              setHistoryFilter={s.setHistoryFilter}
              loadHistory={s.loadHistory}
              isFilterDropdownOpen={s.isFilterDropdownOpen}
              setIsFilterDropdownOpen={s.setIsFilterDropdownOpen}
              filterDropdownRef={s.filterDropdownRef}
              sellers={sellers}
              expandedItems={s.expandedItems}
              setExpandedItems={s.setExpandedItems}
              resolvingItem={s.resolvingItem}
              onToggleResolved={s.handleToggleResolved}
              onDelete={s.handleDeleteConsultation}
              situationTypes={s.situationTypes}
            />
          )}
        </div>
      </div>
    </div>
  );
}
