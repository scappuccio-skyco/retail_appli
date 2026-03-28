/**
 * SellerPerformanceModalVariant — STAGING UNIQUEMENT
 *
 * B — "Dark Performance" : header sombre (slate-900 + orange accent),
 *     onglets en pills oranges sur fond sombre, même contenu BilanTab/SaisieTab.
 *
 * C — "Focus Épuré" : header blanc minimaliste, icône colorée,
 *     onglets en underline subtil, layout plus aéré.
 */
import React from 'react';
import { X, TrendingUp, Edit3, Lock, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';
import BilanTab from './performanceModal/BilanTab';
import SaisieTab from './performanceModal/SaisieTab';
import WarningModal from './performanceModal/WarningModal';
import usePerformanceModal from './performanceModal/usePerformanceModal';

function usepm(props) {
  const { isOpen, bilanData, kpiEntries, user, onDataUpdate, generatingBilan,
    kpiConfig, currentWeekOffset, onWeekChange, initialTab = 'bilan',
    isReadOnly = false, onLoadMoreKpi } = props;
  return usePerformanceModal({
    isOpen, bilanData, kpiEntries, user, onDataUpdate,
    generatingBilan, kpiConfig, currentWeekOffset, onWeekChange,
    initialTab, isReadOnly, onLoadMoreKpi,
  });
}

function bilanTabProps(pm, p) {
  return {
    viewMode: pm.viewMode, setViewMode: pm.setViewMode,
    selectedDay: pm.selectedDay, setSelectedDay: pm.setSelectedDay,
    selectedWeek: pm.selectedWeek, setSelectedWeek: pm.setSelectedWeek,
    selectedMonth: pm.selectedMonth, setSelectedMonth: pm.setSelectedMonth,
    selectedYear: pm.selectedYear, setSelectedYear: pm.setSelectedYear,
    periodLoading: pm.periodLoading, periodEntries: pm.periodEntries,
    periodBilan: pm.periodBilan, periodGenerating: pm.periodGenerating,
    periodAggregates: pm.periodAggregates, periodChartData: pm.periodChartData,
    yearMonthlyData: pm.yearMonthlyData, datesWithData: pm.datesWithData,
    bilanData: p.bilanData, kpiEntries: p.kpiEntries,
    displayedKpiCount: pm.displayedKpiCount, setDisplayedKpiCount: pm.setDisplayedKpiCount,
    exportingPDF: pm.exportingPDF, setExportingPDF: pm.setExportingPDF,
    wasGenerating: pm.wasGenerating,
    weekInfo: pm.weekInfo, periodRange: pm.periodRange,
    kpiConfig: p.kpiConfig, user: p.user, isReadOnly: p.isReadOnly,
    generatingBilan: p.generatingBilan, currentWeekOffset: p.currentWeekOffset,
    contentRef: pm.contentRef, bilanSectionRef: pm.bilanSectionRef,
    setEditingEntry: pm.setEditingEntry, setActiveTab: pm.setActiveTab,
    generatePeriodBilan: pm.generatePeriodBilan,
    onRegenerate: p.onRegenerate, onLoadMoreKpi: p.onLoadMoreKpi, onWeekChange: p.onWeekChange,
    chartData: pm.chartData, sellerAvailableYears: pm.sellerAvailableYears,
    exportToPDF: pm.exportToPDF,
  };
}

/* ══════════════════════════════════════
   STYLE B — Dark Performance
══════════════════════════════════════ */
function ModalVariantB(props) {
  const { isOpen, onClose, isReadOnly = false } = props;
  const pm = usepm(props);
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-950 rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-slate-800">

        {/* Header sombre */}
        <div className="bg-slate-900 border-b border-slate-700 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center border border-orange-500/30">
              <BarChart3 className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Mes Performances</h2>
              <p className="text-xs text-slate-400">Bilan · KPI · Historique</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors">
            <X className="w-4 h-4 text-slate-300" />
          </button>
        </div>

        {/* Tabs en pills */}
        <div className="bg-slate-900 px-6 pb-3 flex gap-2 flex-shrink-0">
          <button
            onClick={() => pm.setActiveTab('bilan')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-full transition-all ${
              pm.activeTab === 'bilan'
                ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            Mon bilan
          </button>
          <button
            onClick={() => {
              if (isReadOnly) { toast.error('Abonnement suspendu.', { icon: '🔒' }); return; }
              pm.setActiveTab('saisie');
            }}
            disabled={isReadOnly}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-full transition-all ${
              isReadOnly
                ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                : pm.activeTab === 'saisie'
                ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
            }`}
          >
            {isReadOnly ? <Lock className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
            Saisir mes chiffres
          </button>
        </div>

        {/* Content — fond légèrement moins sombre pour lisibilité */}
        <div className="flex-1 overflow-y-auto bg-slate-50">
          {pm.activeTab === 'bilan' && <BilanTab {...bilanTabProps(pm, props)} />}
          {pm.activeTab === 'saisie' && (
            <SaisieTab
              editingEntry={pm.editingEntry} savingKPI={pm.savingKPI}
              saveMessage={pm.saveMessage} kpiConfig={props.kpiConfig}
              isReadOnly={isReadOnly} handleDirectSaveKPI={pm.handleDirectSaveKPI}
              setEditingEntry={pm.setEditingEntry} setActiveTab={pm.setActiveTab}
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

/* ══════════════════════════════════════
   STYLE C — Focus Épuré
══════════════════════════════════════ */
function ModalVariantC(props) {
  const { isOpen, onClose, isReadOnly = false } = props;
  const pm = usepm(props);
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-gray-100">

        {/* Header blanc épuré */}
        <div className="px-8 pt-6 pb-0 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-orange-100 flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-orange-500" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Mes Performances</h2>
              <p className="text-sm text-gray-400">Analyse · KPI · Bilan individuel</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Tabs underline */}
        <div className="px-8 pt-4 flex gap-6 border-b border-gray-100 flex-shrink-0">
          {[
            { id: 'bilan', label: 'Mon bilan', icon: TrendingUp },
            { id: 'saisie', label: 'Saisir mes chiffres', icon: isReadOnly ? Lock : Edit3 },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => {
                if (id === 'saisie' && isReadOnly) { toast.error('Abonnement suspendu.', { icon: '🔒' }); return; }
                pm.setActiveTab(id);
              }}
              disabled={id === 'saisie' && isReadOnly}
              className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 transition-all ${
                pm.activeTab === id
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-200'
              } ${id === 'saisie' && isReadOnly ? 'cursor-not-allowed opacity-50' : ''}`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {pm.activeTab === 'bilan' && <BilanTab {...bilanTabProps(pm, props)} />}
          {pm.activeTab === 'saisie' && (
            <SaisieTab
              editingEntry={pm.editingEntry} savingKPI={pm.savingKPI}
              saveMessage={pm.saveMessage} kpiConfig={props.kpiConfig}
              isReadOnly={isReadOnly} handleDirectSaveKPI={pm.handleDirectSaveKPI}
              setEditingEntry={pm.setEditingEntry} setActiveTab={pm.setActiveTab}
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

export default function SellerPerformanceModalVariant({ variant, ...props }) {
  if (variant === 'C') return <ModalVariantC {...props} />;
  return <ModalVariantB {...props} />;
}
