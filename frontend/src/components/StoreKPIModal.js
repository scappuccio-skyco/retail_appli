import React from 'react';
import { X, TrendingUp } from 'lucide-react';
import StoreKPIAIAnalysisModal from './StoreKPIAIAnalysisModal';
import { useStoreKPIModal } from './storeKPI/useStoreKPIModal';
import StoreKPIModalDailyTab from './storeKPI/StoreKPIModalDailyTab';
import StoreKPIModalOverviewTab from './storeKPI/StoreKPIModalOverviewTab';
import StoreKPIModalConfigTab from './storeKPI/StoreKPIModalConfigTab';
import StoreKPIModalProspectsTab from './storeKPI/StoreKPIModalProspectsTab';

const TABS = [
  { id: 'daily', label: '📅 Quotidien' },
  { id: 'overview', label: '📊 Historique' },
  { id: 'config', label: '⚙️ Config des données' },
  { id: 'prospects', label: '👨‍💼 Saisie des données' }
];

export default function StoreKPIModal({ onClose, onSuccess, initialDate = null, hideCloseButton = false, storeId = null, storeName = null, isManager = false }) {
  const state = useStoreKPIModal({ onClose, onSuccess, initialDate, storeId });

  const tabClass = (id) =>
    state.activeTab === id
      ? 'bg-orange-300 text-gray-800 shadow-md border-b-4 border-orange-500'
      : 'text-gray-600 hover:text-orange-600 hover:bg-gray-100';

  return (
    <div
      onClick={hideCloseButton ? undefined : (e) => { if (e.target === e.currentTarget) onClose(); }}
      className={hideCloseButton ? 'w-full' : 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4'}
    >
      <div className={hideCloseButton ? 'bg-white rounded-2xl w-full shadow-lg max-h-[90vh] flex flex-col' : 'bg-white rounded-2xl w-full max-w-4xl shadow-2xl max-h-[90vh] flex flex-col'}>
        {!hideCloseButton && (
          <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-6 flex justify-between items-center rounded-t-2xl flex-shrink-0">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-7 h-7 text-white" />
              <h2 className="text-2xl font-bold text-white">🏪 {storeName || 'Mon Magasin'}</h2>
            </div>
            <button type="button" onClick={onClose} className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>
        )}

        <div className="border-b border-gray-200 bg-gray-50 pt-2 flex-shrink-0">
          <div className="flex gap-0.5 px-1 md:px-6 overflow-x-auto">
            {TABS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => state.setActiveTab(id)}
                className={`px-1.5 md:px-4 py-2 text-xs md:text-sm font-semibold transition-all rounded-t-lg whitespace-nowrap flex-shrink-0 ${tabClass(id)}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6 overflow-y-auto overflow-x-visible flex-1 min-h-0">
          {state.activeTab === 'daily' && (
            <StoreKPIModalDailyTab
              overviewData={state.overviewData}
              overviewDate={state.overviewDate}
              onOverviewDateChange={state.setOverviewDate}
              datesWithData={state.datesWithData}
              lockedDates={state.lockedDates}
              onShowAIModal={state.setShowDailyAIModal}
              storeId={storeId}
            />
          )}

          {state.activeTab === 'overview' && (
            <StoreKPIModalOverviewTab
              viewMode={state.viewMode}
              setViewMode={state.setViewMode}
              selectedWeek={state.selectedWeek}
              setSelectedWeek={state.setSelectedWeek}
              selectedMonth={state.selectedMonth}
              setSelectedMonth={state.setSelectedMonth}
              selectedYear={state.selectedYear}
              setSelectedYear={state.setSelectedYear}
              availableYears={state.availableYears}
              getCurrentWeek={state.getCurrentWeek}
              displayMode={state.displayMode}
              setDisplayMode={state.setDisplayMode}
              displayedListItems={state.displayedListItems}
              setDisplayedListItems={state.setDisplayedListItems}
              visibleCharts={state.visibleCharts}
              toggleChart={state.toggleChart}
              setVisibleCharts={state.setVisibleCharts}
              historicalData={state.historicalData}
              loadingHistorical={state.loadingHistorical}
              onShowOverviewAIModal={state.setShowOverviewAIModal}
            />
          )}

          {state.activeTab === 'config' && (
            <StoreKPIModalConfigTab kpiConfig={state.kpiConfig} onKPIUpdate={state.handleKPIUpdate} />
          )}

          {state.activeTab === 'prospects' && (
            <StoreKPIModalProspectsTab
              kpiConfig={state.kpiConfig}
              isManagerDateLocked={state.isManagerDateLocked}
              managerKPIData={state.managerKPIData}
              setManagerKPIData={state.setManagerKPIData}
              sellers={state.sellers}
              sellersKPIData={state.sellersKPIData}
              setSellersKPIData={state.setSellersKPIData}
              loading={state.loading}
              loadingSellers={state.loadingSellers}
              onManagerKPISubmit={state.handleManagerKPISubmit}
              onClose={onClose}
              setActiveTab={state.setActiveTab}
            />
          )}
        </div>
      </div>

      {state.showDailyAIModal && state.overviewData && (
        <StoreKPIAIAnalysisModal
          kpiData={state.overviewData}
          analysisType="daily"
          storeId={storeId}
          onClose={() => state.setShowDailyAIModal(false)}
        />
      )}

      {state.showOverviewAIModal && state.historicalData.length > 0 && (
        <StoreKPIAIAnalysisModal
          analysisType="overview"
          storeId={storeId}
          viewContext={{
            viewMode: state.viewMode,
            period: state.viewMode === 'week' ? `Semaine ${state.selectedWeek}` : state.viewMode === 'month' ? `Mois ${state.selectedMonth}` : state.viewMode === 'year' ? `Année ${state.selectedYear}` : 'Période inconnue',
            historicalData: state.historicalData
          }}
          onClose={() => state.setShowOverviewAIModal(false)}
        />
      )}
    </div>
  );
}
