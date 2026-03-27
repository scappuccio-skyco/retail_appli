/**
 * StoreKPIModalVariant — STAGING UNIQUEMENT
 *
 * Même contenu que StoreKPIModal, 3 styles visuels différents (variant B et C).
 * Permet de comparer les directions design sans dupliquer la logique.
 *
 * variant='B' → Modern Light : header blanc épuré, tabs en pills
 * variant='C' → Dark Premium : header sombre, tabs blancs sur fond noir
 */
import React, { useState, useEffect, useRef } from 'react';
import { X, TrendingUp, BarChart3, Settings, Users } from 'lucide-react';
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
  { id: 'daily', label: '📊 Performance', icon: BarChart3 },
  { id: 'config', label: '⚙️ Config', icon: Settings },
  { id: 'prospects', label: '👨‍💼 Saisie', icon: Users },
];

function getStartEndForView(viewMode, state) {
  if (viewMode === 'day') return { start: state.overviewDate, end: state.overviewDate };
  const fmt = (d) => (d instanceof Date ? d.toISOString().split('T')[0] : String(d));
  if (viewMode === 'week' && state.selectedWeek) { const r = getWeekStartEnd(state.selectedWeek); return { start: fmt(r.startDate), end: fmt(r.endDate) }; }
  if (viewMode === 'month' && state.selectedMonth) { const r = getMonthStartEnd(state.selectedMonth); return { start: fmt(r.startDate), end: fmt(r.endDate) }; }
  if (viewMode === 'year' && state.selectedYear) { const r = getYearStartEnd(state.selectedYear); return { start: fmt(r.startDate), end: fmt(r.endDate) }; }
  const end = new Date().toISOString().split('T')[0];
  const startDt = new Date(); startDt.setDate(startDt.getDate() - 30);
  return { start: startDt.toISOString().split('T')[0], end };
}

/* ── Thèmes ───────────────────────────────────────── */
const THEMES = {
  B: {
    overlay: 'fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4',
    modal: 'bg-white rounded-2xl w-full max-w-4xl shadow-2xl max-h-[90vh] flex flex-col border border-gray-200',
    header: 'bg-white border-b border-gray-100 px-6 py-4 flex justify-between items-center rounded-t-2xl flex-shrink-0',
    headerTitle: 'text-gray-900 text-xl font-bold flex items-center gap-3',
    headerIcon: 'w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center',
    headerIconColor: 'text-orange-500',
    closeBtn: 'text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl p-2 transition-colors',
    tabBar: 'border-b border-gray-100 bg-white px-6 pt-3 pb-0 flex gap-2 flex-shrink-0 overflow-x-auto',
    tabActive: 'px-4 py-2 text-sm font-semibold rounded-t-xl border-b-2 border-blue-600 text-blue-600 bg-blue-50 whitespace-nowrap',
    tabInactive: 'px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-50 rounded-t-xl whitespace-nowrap transition-colors',
    content: 'p-6 overflow-y-auto flex-1 min-h-0 bg-white',
    periodBtn: (active) => active
      ? 'px-3 py-1.5 text-sm font-semibold rounded-lg bg-blue-600 text-white shadow'
      : 'px-3 py-1.5 text-sm font-medium rounded-lg text-gray-600 hover:bg-gray-100 transition-colors',
    periodBar: 'px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl mb-4 space-y-3',
    aiBtn: 'px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow font-medium disabled:opacity-50 disabled:cursor-not-allowed',
    badge: 'text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-600 font-medium ml-2',
    variantLabel: 'Style B — Modern Light',
  },
  C: {
    overlay: 'fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4',
    modal: 'rounded-2xl w-full max-w-4xl shadow-2xl max-h-[90vh] flex flex-col',
    header: 'px-6 py-4 flex justify-between items-center rounded-t-2xl flex-shrink-0',
    headerTitle: 'text-white text-xl font-bold flex items-center gap-3',
    headerIcon: 'w-9 h-9 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center',
    headerIconColor: 'text-orange-400',
    closeBtn: 'text-white/60 hover:text-white hover:bg-white/10 rounded-xl p-2 transition-colors',
    tabBar: 'px-6 pt-3 pb-0 flex gap-2 flex-shrink-0 overflow-x-auto border-b border-white/10',
    tabActive: 'px-4 py-2 text-sm font-semibold rounded-t-xl border-b-2 border-orange-400 text-orange-300 whitespace-nowrap',
    tabInactive: 'px-4 py-2 text-sm font-medium text-white/40 hover:text-white/70 rounded-t-xl whitespace-nowrap transition-colors',
    content: 'p-6 overflow-y-auto flex-1 min-h-0',
    periodBtn: (active) => active
      ? 'px-3 py-1.5 text-sm font-semibold rounded-lg bg-orange-500 text-white shadow'
      : 'px-3 py-1.5 text-sm font-medium rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors border border-white/10',
    periodBar: 'px-4 py-3 bg-white/5 border border-white/10 rounded-xl mb-4 space-y-3',
    aiBtn: 'px-6 py-3 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-all shadow font-medium disabled:opacity-50 disabled:cursor-not-allowed',
    badge: 'text-xs px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300 font-medium ml-2 border border-orange-500/30',
    variantLabel: 'Style C — Dark Premium',
  },
};

const MODAL_BG = {
  B: 'bg-white',
  C: 'bg-[#0F172A]',
};

export default function StoreKPIModalVariant({
  variant = 'B',
  onClose, onSuccess, initialDate = null, storeId = null, storeName = null, isManager = false,
}) {
  const { user } = useAuth();
  const state = useStoreKPIModal({ onClose, onSuccess, initialDate, storeId, isManager });
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [aiGenerating, setAiGenerating] = useState(false);
  const aiSectionRef = useRef(null);

  const t = THEMES[variant] || THEMES.B;
  const bg = MODAL_BG[variant] || 'bg-white';

  const currentYear = new Date().getFullYear();
  const yearOptions = state.availableYears.length > 0 ? state.availableYears : [currentYear, currentYear - 1];

  const hasDataForDate = state.overviewData && !(state.overviewData?.totals?.ca === 0 && state.overviewData?.totals?.ventes === 0);
  const canLaunchDailyAI = Boolean(state.overviewData) && hasDataForDate;
  const hasHistData = state.historicalData.length > 0;
  const allHistZero = hasHistData && state.historicalData.every(d => d.total_ca === 0 && d.total_ventes === 0);
  const canLaunchOverviewAI = hasHistData && !allHistZero;
  const canLaunchAI = state.viewMode === 'day' ? canLaunchDailyAI : canLaunchOverviewAI;

  const currentPeriodKey = `${state.viewMode}_${state.viewMode === 'day' ? state.overviewDate : state.viewMode === 'week' ? state.selectedWeek : state.viewMode === 'month' ? state.selectedMonth : state.selectedYear}`;
  const lsKey = `mgr_kpi_analysis_${variant}_${storeId || 'default'}_${currentPeriodKey}`;

  useEffect(() => {
    try {
      const saved = localStorage.getItem(lsKey);
      setAiAnalysis(saved ? JSON.parse(saved) : null);
    } catch { setAiAnalysis(null); }
  }, [lsKey]);

  useEffect(() => {
    if (aiAnalysis && aiSectionRef.current) {
      aiSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [aiAnalysis]);

  const generateAnalysis = async () => {
    if (!canLaunchAI && !aiAnalysis) return;
    setAiGenerating(true);
    try {
      const { start, end } = getStartEndForView(state.viewMode, state);
      const isGerantContext = !isManager && Boolean(storeId);
      const storeParam = storeId ? `?store_id=${storeId}` : '';
      const endpoint = isGerantContext ? `/gerant/stores/${storeId}/analyze-store-kpis` : `/manager/analyze-store-kpis${storeParam}`;
      const res = await api.post(endpoint, { start_date: start, end_date: end });
      const analysis = res.data.analysis;
      setAiAnalysis(analysis);
      try { localStorage.setItem(lsKey, JSON.stringify(analysis)); } catch {}
      toast.success('Analyse IA générée !');
    } catch (err) {
      logger.error('Error generating store KPI AI analysis:', err);
      toast.error(getSubscriptionErrorMessage(err, user?.role) || "Erreur lors de l'analyse IA");
    } finally { setAiGenerating(false); }
  };

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} className={t.overlay}>
      <div className={`${bg} ${t.modal}`}>

        {/* Header */}
        <div className={t.header}>
          <div className={t.headerTitle}>
            <div className={t.headerIcon}>
              <TrendingUp className={`w-5 h-5 ${t.headerIconColor}`} />
            </div>
            <span>🏪 {storeName || 'Mon Magasin'}</span>
            <span className={t.badge}>{t.variantLabel}</span>
          </div>
          <button type="button" onClick={onClose} className={t.closeBtn}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className={t.tabBar}>
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => state.setActiveTab(id)}
              className={state.activeTab === id ? t.tabActive : t.tabInactive}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className={t.content}>
          {state.activeTab === 'daily' && (
            <div>
              {/* Sélecteur de période */}
              <div className={t.periodBar}>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex gap-1.5 flex-wrap">
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
                        className={t.periodBtn(state.viewMode === id)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
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
                    <WeekPicker value={state.selectedWeek} onChange={state.setSelectedWeek} datesWithData={state.datesWithData} />
                  )}
                  {state.viewMode === 'month' && (
                    <input
                      type="month"
                      value={state.selectedMonth}
                      onChange={(e) => state.setSelectedMonth(e.target.value)}
                      className="px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none bg-white cursor-pointer"
                    />
                  )}
                  {state.viewMode === 'year' && (
                    <select value={state.selectedYear} onChange={(e) => state.setSelectedYear(parseInt(e.target.value, 10))} className="px-3 py-2 border-2 border-gray-300 rounded-lg bg-white cursor-pointer">
                      {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  )}
                </div>
              </div>

              {/* Données */}
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

              {/* IA */}
              <div ref={aiSectionRef} className="mt-6">
                {!aiAnalysis && !aiGenerating && (
                  <div className={`text-center py-8 rounded-xl border-2 border-dashed ${variant === 'C' ? 'bg-white/5 border-white/20' : 'bg-gray-50 border-gray-300'}`}>
                    <span className="text-4xl mb-3 block">🤖</span>
                    <p className={`mb-4 ${variant === 'C' ? 'text-white/60' : 'text-gray-600'}`}>Aucune analyse IA pour cette période</p>
                    <button onClick={generateAnalysis} disabled={!canLaunchAI} className={t.aiBtn}>
                      ✨ Générer l'analyse IA
                    </button>
                    {!canLaunchAI && <p className={`text-xs mt-2 ${variant === 'C' ? 'text-white/30' : 'text-gray-400'}`}>Aucune donnée disponible pour cette période</p>}
                  </div>
                )}
                {aiGenerating && (
                  <div className={`rounded-2xl p-8 text-center ${variant === 'C' ? 'bg-white/5 border border-white/10' : 'bg-white border-2 border-blue-200 shadow'}`}>
                    <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center animate-pulse">
                      <span className="text-2xl">✨</span>
                    </div>
                    <h3 className={`text-xl font-bold mb-2 ${variant === 'C' ? 'text-white' : 'text-gray-800'}`}>Analyse en cours...</h3>
                    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mt-4">
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
