import React from 'react';
import { X } from 'lucide-react';
import VenteConclueFormSection from './debriefHistory/VenteConclueFormSection';
import OpportuniteManqueeFormSection from './debriefHistory/OpportuniteManqueeFormSection';
import DebriefHistoryList from './debriefHistory/DebriefHistoryList';
import useDebriefHistoryModal from './debriefHistory/useDebriefHistoryModal';

export default function DebriefHistoryModal({ onClose, onSuccess, autoExpandDebriefId }) {
  const {
    debriefs, filtreHistorique, setFiltreHistorique,
    expandedDebriefs, displayLimit, setDisplayLimit, loading,
    showVenteConclueForm, setShowVenteConclueForm,
    showOpportuniteManqueeForm, setShowOpportuniteManqueeForm,
    formConclue, setFormConclue, formManquee, setFormManquee,
    sortedAndLimitedDebriefs, hasMore, remainingCount,
    toggleDebrief, toggleCheckbox,
    handleSubmitConclue, handleSubmitManquee, handleToggleVisibility,
  } = useDebriefHistoryModal({ onSuccess, autoExpandDebriefId });

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget && !loading) onClose(); }}
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
    >
      <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-[#1E40AF] to-[#1E3A8A] p-6 rounded-t-2xl">
          <button onClick={onClose} disabled={loading} className="absolute top-4 right-4 text-white hover:text-gray-200 transition-colors z-10 disabled:opacity-50 disabled:cursor-not-allowed">
            <X className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-3">
            <span className="text-3xl">📊</span>
            <div>
              <h2 className="text-2xl font-bold text-white">Analyse de vente</h2>
              {debriefs.length > 0 && (
                <p className="text-blue-100 text-sm mt-1">
                  {debriefs.length} analyse{debriefs.length > 1 ? 's' : ''} enregistrée{debriefs.length > 1 ? 's' : ''}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {showVenteConclueForm && (
            <VenteConclueFormSection
              formConclue={formConclue}
              setFormConclue={setFormConclue}
              loading={loading}
              onSubmit={handleSubmitConclue}
              onBack={() => setShowVenteConclueForm(false)}
              toggleCheckbox={toggleCheckbox}
            />
          )}
          {showOpportuniteManqueeForm && (
            <OpportuniteManqueeFormSection
              formManquee={formManquee}
              setFormManquee={setFormManquee}
              loading={loading}
              onSubmit={handleSubmitManquee}
              onBack={() => setShowOpportuniteManqueeForm(false)}
              toggleCheckbox={toggleCheckbox}
            />
          )}
          {!showVenteConclueForm && !showOpportuniteManqueeForm && (
            <DebriefHistoryList
              debriefs={debriefs}
              sortedAndLimitedDebriefs={sortedAndLimitedDebriefs}
              filtreHistorique={filtreHistorique}
              setFiltreHistorique={setFiltreHistorique}
              expandedDebriefs={expandedDebriefs}
              toggleDebrief={toggleDebrief}
              hasMore={hasMore}
              remainingCount={remainingCount}
              onLoadMore={() => setDisplayLimit(prev => prev + 20)}
              onShowVenteConclue={() => setShowVenteConclueForm(true)}
              onShowOpportuniteManquee={() => setShowOpportuniteManqueeForm(true)}
              onToggleVisibility={handleToggleVisibility}
            />
          )}
        </div>
      </div>
    </div>
  );
}
