/**
 * SellerPerformanceModalVariant — STAGING UNIQUEMENT
 *
 * Dupliqué depuis PerformanceModal.js — mêmes fonctionnalités, présentation différente.
 *
 * variant='A' → Style actuel (redirige vers PerformanceModal)
 * variant='B' → Navigation Latérale : sidebar gauche avec nav verticale, contenu à droite
 * variant='C' → Vue Double : Bilan + Saisie côte à côte simultanément (pas d'onglets)
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
   STYLE B — Navigation Latérale
   Sidebar gauche (nav verticale) + contenu à droite
══════════════════════════════════════ */
function ModalVariantB(props) {
  const { isOpen, onClose, isReadOnly = false } = props;
  const pm = usepm(props);
  if (!isOpen) return null;

  const navItems = [
    { id: 'bilan', label: 'Mon Bilan', icon: TrendingUp, locked: false },
    { id: 'saisie', label: 'Saisir mes chiffres', icon: isReadOnly ? Lock : Edit3, locked: isReadOnly },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-gray-200">

        {/* Header compact */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 flex-shrink-0 bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-orange-600" />
            </div>
            <h2 className="text-base font-bold text-gray-900">Mes Performances</h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 font-semibold border border-orange-100">Style B</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corps : sidebar gauche + contenu droit */}
        <div className="flex-1 flex overflow-hidden min-h-0">

          {/* Sidebar navigation verticale */}
          <div className="w-52 flex-shrink-0 border-r border-gray-100 bg-gray-50 flex flex-col py-4 px-3 gap-1">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-2 mb-2">Navigation</p>
            {navItems.map(({ id, label, icon: Icon, locked }) => (
              <button
                key={id}
                onClick={() => {
                  if (locked) { toast.error('Abonnement suspendu.', { icon: '🔒' }); return; }
                  pm.setActiveTab(id);
                }}
                disabled={locked}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left ${
                  pm.activeTab === id
                    ? 'bg-orange-500 text-white shadow-md shadow-orange-200'
                    : locked
                    ? 'text-gray-300 cursor-not-allowed'
                    : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900'
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="leading-tight">{label}</span>
              </button>
            ))}

            {/* Séparateur + info rapide */}
            <div className="mt-auto pt-4 border-t border-gray-200">
              <div className="px-2">
                <p className="text-[10px] text-gray-400 leading-relaxed">
                  Consulte ton bilan par période ou saisis tes chiffres du jour.
                </p>
              </div>
            </div>
          </div>

          {/* Contenu principal */}
          <div className="flex-1 overflow-y-auto min-h-0">
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
   STYLE C — Vue Double
   Bilan (gauche) + Saisie (droite) visibles simultanément
   Sur mobile : onglets classiques
══════════════════════════════════════ */
function ModalVariantC(props) {
  const { isOpen, onClose, isReadOnly = false } = props;
  const pm = usepm(props);
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-gray-50 rounded-2xl shadow-2xl max-w-7xl w-full max-h-[94vh] sm:max-h-[90vh] overflow-hidden flex flex-col border border-gray-200">

        {/* Header */}
        <div className="bg-white px-5 py-3 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-orange-600" />
            </div>
            <h2 className="text-base font-bold text-gray-900">Mes Performances</h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 font-semibold border border-orange-100">Style C</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Tabs visibles sur mobile seulement */}
            <div className="flex sm:hidden gap-1">
              <button onClick={() => pm.setActiveTab('bilan')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${pm.activeTab === 'bilan' ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                Bilan
              </button>
              <button
                onClick={() => { if (isReadOnly) { toast.error('Abonnement suspendu.', { icon: '🔒' }); return; } pm.setActiveTab('saisie'); }}
                disabled={isReadOnly}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${isReadOnly ? 'bg-gray-100 text-gray-300 cursor-not-allowed' : pm.activeTab === 'saisie' ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                Saisie
              </button>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Corps : côte à côte sur lg, onglets sur mobile */}

        {/* Mobile : onglet actif seulement */}
        <div className="flex-1 sm:hidden overflow-y-auto min-h-0">
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

        {/* Desktop : les 2 panneaux côte à côte */}
        <div className="hidden sm:flex flex-1 overflow-hidden min-h-0 gap-px bg-gray-200">
          {/* Panneau gauche — Bilan */}
          <div className="flex-1 flex flex-col overflow-hidden bg-white min-w-0">
            <div className="px-4 py-2 border-b border-gray-100 bg-gray-50 flex-shrink-0">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-orange-500" />
                <span className="text-sm font-semibold text-gray-700">Mon Bilan</span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto min-h-0">
              <BilanTab {...bilanTabProps(pm, props)} />
            </div>
          </div>

          {/* Panneau droit — Saisie */}
          <div className="w-80 xl:w-96 flex-shrink-0 flex flex-col overflow-hidden bg-white">
            <div className="px-4 py-2 border-b border-gray-100 bg-gray-50 flex-shrink-0">
              <div className="flex items-center gap-2">
                {isReadOnly ? <Lock className="w-4 h-4 text-gray-400" /> : <Edit3 className="w-4 h-4 text-orange-500" />}
                <span className={`text-sm font-semibold ${isReadOnly ? 'text-gray-400' : 'text-gray-700'}`}>
                  Saisir mes chiffres {isReadOnly && '🔒'}
                </span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto min-h-0">
              <SaisieTab
                editingEntry={pm.editingEntry} savingKPI={pm.savingKPI}
                saveMessage={pm.saveMessage} kpiConfig={props.kpiConfig}
                isReadOnly={isReadOnly} handleDirectSaveKPI={pm.handleDirectSaveKPI}
                setEditingEntry={pm.setEditingEntry} setActiveTab={pm.setActiveTab}
              />
            </div>
          </div>
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
