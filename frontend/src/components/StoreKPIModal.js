import React, { useState, useEffect, useRef } from 'react';
import { X, TrendingUp } from 'lucide-react';
import { api } from '../lib/apiClient';
import { logger } from '../utils/logger';
import { toast } from 'sonner';
import { getSubscriptionErrorMessage } from '../utils/apiHelpers';
import { useAuth } from '../contexts';
import { useStoreKPIModal } from './storeKPI/useStoreKPIModal';
import { getWeekStartEnd, getMonthStartEnd, getYearStartEnd } from './storeKPI/storeKPIUtils';
import StoreKPIModalDailyTab from './storeKPI/StoreKPIModalDailyTab';
import StoreKPIModalOverviewTab from './storeKPI/StoreKPIModalOverviewTab';
import { WeekPicker } from './storeKPI/WeekPicker';
import StoreKPIModalConfigTab from './storeKPI/StoreKPIModalConfigTab';
import StoreKPIModalProspectsTab from './storeKPI/StoreKPIModalProspectsTab';
import KPICalendar from './KPICalendar';
import ManagerAIAnalysisDisplay from './ManagerAIAnalysisDisplay';

const TABS = [
  { id: 'daily', label: '📊 Performance' },
  { id: 'config', label: '⚙️ Config des données' },
  { id: 'prospects', label: '👨‍💼 Saisie des données' }
];

function getOverviewPeriodLabel(viewMode, state) {
  if (viewMode === 'week') return `Semaine ${state.selectedWeek}`;
  if (viewMode === 'month') return `Mois ${state.selectedMonth}`;
  if (viewMode === 'year') return `Année ${state.selectedYear}`;
  return 'Période inconnue';
}

/**
 * Compute start_date/end_date strings for the current view mode.
 */
function getStartEndForView(viewMode, state) {
  if (viewMode === 'day') {
    return { start: state.overviewDate, end: state.overviewDate };
  }
  if (viewMode === 'week' && state.selectedWeek) {
    const r = getWeekStartEnd(state.selectedWeek);
    const fmt = (d) => (d instanceof Date ? d.toISOString().split('T')[0] : String(d));
    return { start: fmt(r.startDate), end: fmt(r.endDate) };
  }
  if (viewMode === 'month' && state.selectedMonth) {
    const r = getMonthStartEnd(state.selectedMonth);
    const fmt = (d) => (d instanceof Date ? d.toISOString().split('T')[0] : String(d));
    return { start: fmt(r.startDate), end: fmt(r.endDate) };
  }
  if (viewMode === 'year' && state.selectedYear) {
    const r = getYearStartEnd(state.selectedYear);
    const fmt = (d) => (d instanceof Date ? d.toISOString().split('T')[0] : String(d));
    return { start: fmt(r.startDate), end: fmt(r.endDate) };
  }
  // fallback: last 30 days
  const end = new Date().toISOString().split('T')[0];
  const startDt = new Date();
  startDt.setDate(startDt.getDate() - 30);
  return { start: startDt.toISOString().split('T')[0], end };
}

export default function StoreKPIModal({ onClose, onSuccess, initialDate = null, hideCloseButton = false, storeId = null, storeName = null, isManager = false }) {
  const { user } = useAuth();
  const state = useStoreKPIModal({ onClose, onSuccess, initialDate, storeId, isManager });

  // AI Analysis state
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [aiGenerating, setAiGenerating] = useState(false);
  const aiSectionRef = useRef(null);
  const aiJustGenerated = useRef(false);

  const tabClass = (id) =>
    state.activeTab === id
      ? 'bg-orange-300 text-gray-800 shadow-md border-b-4 border-orange-500'
      : 'text-gray-600 hover:text-orange-600 hover:bg-gray-100';

  const overviewPeriodLabel = getOverviewPeriodLabel(state.viewMode, state);

  const hasDataForDate = state.overviewData && !(state.overviewData?.totals?.ca === 0 && state.overviewData?.totals?.ventes === 0);
  const canLaunchDailyAI = Boolean(state.overviewData) && hasDataForDate;
  const hasHistData = state.historicalData.length > 0;
  const allHistZero = hasHistData && state.historicalData.every(d => d.total_ca === 0 && d.total_ventes === 0);
  const canLaunchOverviewAI = hasHistData && !allHistZero;

  const currentYear = new Date().getFullYear();
  const yearOptions = state.availableYears.length > 0 ? state.availableYears : [currentYear, currentYear - 1];

  // Build a localStorage key for the current period
  const currentPeriodKey = `${state.viewMode}_${
    state.viewMode === 'day' ? state.overviewDate :
    state.viewMode === 'week' ? state.selectedWeek :
    state.viewMode === 'month' ? state.selectedMonth :
    state.selectedYear
  }`;
  const lsKey = `mgr_kpi_analysis_${storeId || 'default'}_${currentPeriodKey}`;

  // Load persisted analysis when period changes
  useEffect(() => {
    try {
      const saved = localStorage.getItem(lsKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        setAiAnalysis(parsed);
      } else {
        setAiAnalysis(null);
      }
    } catch {
      setAiAnalysis(null);
    }
  }, [lsKey]);

  // Auto-scroll uniquement lors d'une génération fraîche (pas au chargement depuis localStorage)
  useEffect(() => {
    if (aiAnalysis && aiSectionRef.current && aiJustGenerated.current) {
      aiJustGenerated.current = false;
      aiSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [aiAnalysis]);

  const canLaunchAI = state.viewMode === 'day' ? canLaunchDailyAI : canLaunchOverviewAI;

  const generateAnalysis = async () => {
    if (!canLaunchAI && !aiAnalysis) return;
    setAiGenerating(true);

    try {
      const { start, end } = getStartEndForView(state.viewMode, state);
      const isGerantContext = !isManager && Boolean(storeId);
      const storeParam = storeId ? `?store_id=${storeId}` : '';
      const endpoint = isGerantContext
        ? `/gerant/stores/${storeId}/analyze-store-kpis`
        : `/manager/analyze-store-kpis${storeParam}`;

      const payload = { start_date: start, end_date: end };

      const res = await api.post(endpoint, payload);
      const analysis = res.data.analysis;
      aiJustGenerated.current = true;
      setAiAnalysis(analysis);
      try {
        localStorage.setItem(lsKey, JSON.stringify(analysis));
      } catch {
        // localStorage might be full
      }
      toast.success('Analyse IA générée !');
    } catch (err) {
      logger.error('Error generating store KPI AI analysis:', err);
      toast.error(getSubscriptionErrorMessage(err, user?.role) || 'Erreur lors de l\'analyse IA');
    } finally {
      setAiGenerating(false);
    }
  };

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
            <div>
              {/* Barre d'action : sélecteur de période */}
              <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl mb-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex gap-1.5">
                    {[
                      { id: 'day', label: '📅 Jour' },
                      { id: 'week', label: '📅 Semaine' },
                      { id: 'month', label: '🗓️ Mois' },
                      { id: 'year', label: '📆 Année' },
                    ].map(({ id, label }) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => state.setViewMode(id)}
                        className={`px-3 py-1.5 text-sm font-semibold rounded-lg transition-all border-2 ${
                          state.viewMode === id
                            ? 'border-orange-500 bg-orange-500 text-white shadow-md'
                            : 'border-gray-300 text-gray-700 hover:border-orange-400 hover:text-orange-600 hover:bg-orange-50'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Navigation */}
                <div>
                  {state.viewMode === 'day' && (
                    <KPICalendar
                      selectedDate={state.overviewDate}
                      onDateChange={state.setOverviewDate}
                      datesWithData={state.datesWithData}
                      lockedDates={state.lockedDates}
                      partiallyLockedDates={state.partiallyLockedDates}
                    />
                  )}
                  {state.viewMode === 'week' && (
                    <WeekPicker
                      value={state.selectedWeek}
                      onChange={state.setSelectedWeek}
                      datesWithData={state.datesWithData}
                    />
                  )}
                  {state.viewMode === 'month' && (
                    <input
                      type="month"
                      value={state.selectedMonth}
                      onChange={(e) => state.setSelectedMonth(e.target.value)}
                      onClick={(e) => { try { if (typeof e.target.showPicker === 'function') e.target.showPicker(); } catch (_) {} }}
                      className="flex-1 max-w-md px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-orange-400 focus:outline-none cursor-pointer bg-white"
                    />
                  )}
                  {state.viewMode === 'year' && (
                    <select
                      value={state.selectedYear}
                      onChange={(e) => state.setSelectedYear(parseInt(e.target.value, 10))}
                      className="flex-1 max-w-md px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-orange-400 focus:outline-none bg-white cursor-pointer"
                    >
                      {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  )}
                </div>
              </div>

              {/* IA Analysis Section — au-dessus des données */}
              <div ref={aiSectionRef} className="mb-4">
                {!aiAnalysis && !aiGenerating && (
                  <div className="text-center py-4 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                    <button
                      onClick={generateAnalysis}
                      disabled={!canLaunchAI}
                      className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                    >
                      ✨ Générer l'analyse IA
                    </button>
                    {!canLaunchAI && (
                      <p className="text-xs text-gray-400 mt-2">Aucune donnée disponible pour cette période</p>
                    )}
                  </div>
                )}
                {aiGenerating && (
                  <div className="bg-white rounded-2xl p-6 text-center shadow border-2 border-blue-200">
                    <div className="w-12 h-12 mx-auto mb-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center animate-pulse">
                      <span className="text-xl">✨</span>
                    </div>
                    <h3 className="text-lg font-bold text-gray-800 mb-2">Analyse en cours...</h3>
                    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mt-3">
                      <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 animate-pulse rounded-full" style={{ width: '60%' }} />
                    </div>
                  </div>
                )}
                {aiAnalysis && !aiGenerating && (
                  <ManagerAIAnalysisDisplay
                    analysis={aiAnalysis}
                    onRegenerate={generateAnalysis}
                    title="Analyse IA — KPIs Magasin"
                    sources={['CA du jour', 'Ventes', 'Clients', 'Panier moyen', 'Taux de transformation', 'Indice de vente']}
                  />
                )}
              </div>

              {/* Contenu */}
              {state.viewMode === 'day' ? (
                <StoreKPIModalDailyTab overviewData={state.overviewData} storeId={storeId} />
              ) : (
                <StoreKPIModalOverviewTab
                  viewMode={state.viewMode}
                  displayMode={state.displayMode}
                  setDisplayMode={state.setDisplayMode}
                  displayedListItems={state.displayedListItems}
                  setDisplayedListItems={state.setDisplayedListItems}
                  visibleCharts={state.visibleCharts}
                  toggleChart={state.toggleChart}
                  setVisibleCharts={state.setVisibleCharts}
                  historicalData={state.historicalData}
                  loadingHistorical={state.loadingHistorical}
                />
              )}
            </div>
          )}

          {state.activeTab === 'config' && (
            <StoreKPIModalConfigTab kpiConfig={state.kpiConfig} onKPIUpdate={state.handleKPIUpdate} />
          )}

          {state.activeTab === 'prospects' && (
            <StoreKPIModalProspectsTab
              kpiConfig={state.kpiConfig}
              isManagerDateLocked={state.isManagerDateLocked}
              isSellerLocked={(sellerId) => state.isSellerLocked(state.managerKPIData.date, sellerId)}
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
    </div>
  );
}
