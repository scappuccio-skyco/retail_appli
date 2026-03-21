import React from 'react';
import { X, TrendingUp, Edit3, Lock } from 'lucide-react';
import { toast } from 'sonner';
import BilanTab from './performanceModal/BilanTab';
import SaisieTab from './performanceModal/SaisieTab';
import WarningModal from './performanceModal/WarningModal';
import usePerformanceModal from './performanceModal/usePerformanceModal';

export default function PerformanceModal({
  isOpen,
  onClose,
  bilanData,
  kpiEntries,
  user,
  onDataUpdate,
  onRegenerate,
  generatingBilan,
  onEditKPI,
  kpiConfig,
  currentWeekOffset,
  onWeekChange,
  initialTab = 'bilan',
  isReadOnly = false,
  onLoadMoreKpi,
  kpiEntriesTotal,
}) {
  const pm = usePerformanceModal({
    isOpen, bilanData, kpiEntries, user, onDataUpdate,
    generatingBilan, kpiConfig, currentWeekOffset, onWeekChange,
    initialTab, isReadOnly, onLoadMoreKpi,
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">

        {/* Header avec onglets */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-600">
          <div className="flex items-center justify-between p-4">
            <h2 className="text-2xl font-bold text-white">📊 Mes Performances</h2>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors">
              <X className="w-6 h-6 text-white" />
            </button>
          </div>

          <div className="border-b border-gray-200 bg-gray-50 pt-2">
            <div className="flex gap-1 px-6">
              <button
                onClick={() => pm.setActiveTab('bilan')}
                className={`px-4 py-2 text-sm font-semibold transition-all rounded-t-lg ${
                  pm.activeTab === 'bilan'
                    ? 'bg-orange-300 text-gray-800 shadow-md border-b-4 border-orange-500'
                    : 'text-gray-600 hover:text-orange-600 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center justify-center gap-1.5">
                  <TrendingUp className="w-4 h-4" />
                  <span>Mon bilan</span>
                </div>
              </button>
              <button
                onClick={() => {
                  if (isReadOnly) {
                    toast.error('Abonnement magasin suspendu. Saisie désactivée.', { duration: 4000, icon: '🔒' });
                    return;
                  }
                  pm.setActiveTab('saisie');
                }}
                disabled={isReadOnly}
                className={`px-4 py-2 text-sm font-semibold transition-all rounded-t-lg ${
                  isReadOnly
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : pm.activeTab === 'saisie'
                    ? 'bg-orange-300 text-gray-800 shadow-md border-b-4 border-orange-500'
                    : 'text-gray-600 hover:text-orange-600 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center justify-center gap-1.5">
                  {isReadOnly ? <Lock className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
                  <span>Saisir mes chiffres</span>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {pm.activeTab === 'bilan' && (
            <BilanTab
              viewMode={pm.viewMode} setViewMode={pm.setViewMode}
              selectedDay={pm.selectedDay} setSelectedDay={pm.setSelectedDay}
              selectedWeek={pm.selectedWeek} setSelectedWeek={pm.setSelectedWeek}
              selectedMonth={pm.selectedMonth} setSelectedMonth={pm.setSelectedMonth}
              selectedYear={pm.selectedYear} setSelectedYear={pm.setSelectedYear}
              periodLoading={pm.periodLoading} periodEntries={pm.periodEntries}
              periodBilan={pm.periodBilan} periodGenerating={pm.periodGenerating}
              periodAggregates={pm.periodAggregates} periodChartData={pm.periodChartData}
              yearMonthlyData={pm.yearMonthlyData} datesWithData={pm.datesWithData}
              bilanData={bilanData} kpiEntries={kpiEntries}
              displayedKpiCount={pm.displayedKpiCount} setDisplayedKpiCount={pm.setDisplayedKpiCount}
              exportingPDF={pm.exportingPDF} setExportingPDF={pm.setExportingPDF}
              wasGenerating={pm.wasGenerating}
              weekInfo={pm.weekInfo} periodRange={pm.periodRange}
              kpiConfig={kpiConfig} user={user} isReadOnly={isReadOnly}
              generatingBilan={generatingBilan} currentWeekOffset={currentWeekOffset}
              contentRef={pm.contentRef} bilanSectionRef={pm.bilanSectionRef}
              setEditingEntry={pm.setEditingEntry} setActiveTab={pm.setActiveTab}
              generatePeriodBilan={pm.generatePeriodBilan}
              onRegenerate={onRegenerate} onLoadMoreKpi={onLoadMoreKpi} onWeekChange={onWeekChange}
              chartData={pm.chartData} sellerAvailableYears={pm.sellerAvailableYears}
              exportToPDF={pm.exportToPDF}
            />
          )}

          {pm.activeTab === 'saisie' && (
            <SaisieTab
              editingEntry={pm.editingEntry}
              savingKPI={pm.savingKPI}
              saveMessage={pm.saveMessage}
              kpiConfig={kpiConfig}
              isReadOnly={isReadOnly}
              handleDirectSaveKPI={pm.handleDirectSaveKPI}
              setEditingEntry={pm.setEditingEntry}
              setActiveTab={pm.setActiveTab}
            />
          )}
        </div>
      </div>

      {pm.showWarningModal && (
        <WarningModal
          warnings={pm.warnings}
          onCancel={() => { pm.setShowWarningModal(false); pm.setWarnings([]); pm.setPendingKPIData(null); }}
          onConfirm={() => { pm.setShowWarningModal(false); pm.saveKPIData(pm.pendingKPIData); pm.setPendingKPIData(null); pm.setWarnings([]); }}
        />
      )}
    </div>
  );
}
