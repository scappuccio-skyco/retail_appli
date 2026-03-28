/**
 * StoreKPIModalVariant — STAGING UNIQUEMENT
 *
 * 3 variantes de présentation pour la modale Mon Magasin.
 * La logique (données, IA) est identique — seule la présentation change.
 *
 * variant='A' → Style actuel (redirige vers StoreKPIModal)
 * variant='B' → Dashboard View : gros CA hero, vendeurs en cartes, IA amber inline
 * variant='C' → Analytics View : graphiques en premier plan, insight IA épinglé, filtres chips
 */
import React, { useState, useEffect, useRef } from 'react';
import { X, TrendingUp, Settings, Users, BarChart3, ChevronDown } from 'lucide-react';
import { api } from '../lib/apiClient';
import { logger } from '../utils/logger';
import { toast } from 'sonner';
import { getSubscriptionErrorMessage } from '../utils/apiHelpers';
import { useAuth } from '../contexts';
import { useStoreKPIModal } from './storeKPI/useStoreKPIModal';
import { getWeekStartEnd, getMonthStartEnd, getYearStartEnd } from './storeKPI/storeKPIUtils';
import { WeekPicker } from './storeKPI/WeekPicker';
import KPICalendar from './KPICalendar';
import StoreKPIModalConfigTab from './storeKPI/StoreKPIModalConfigTab';
import StoreKPIModalProspectsTab from './storeKPI/StoreKPIModalProspectsTab';
import StoreKPIVariantBContent from './storeKPI/StoreKPIVariantBContent';
import StoreKPIVariantCContent from './storeKPI/StoreKPIVariantCContent';

/* ─── Helpers ─── */
function getStartEndForView(viewMode, state) {
  const fmt = (d) => (d instanceof Date ? d.toISOString().split('T')[0] : String(d));
  if (viewMode === 'day') return { start: state.overviewDate, end: state.overviewDate };
  if (viewMode === 'week' && state.selectedWeek) { const r = getWeekStartEnd(state.selectedWeek); return { start: fmt(r.startDate), end: fmt(r.endDate) }; }
  if (viewMode === 'month' && state.selectedMonth) { const r = getMonthStartEnd(state.selectedMonth); return { start: fmt(r.startDate), end: fmt(r.endDate) }; }
  if (viewMode === 'year' && state.selectedYear) { const r = getYearStartEnd(state.selectedYear); return { start: fmt(r.startDate), end: fmt(r.endDate) }; }
  const end = new Date().toISOString().split('T')[0];
  const startDt = new Date(); startDt.setDate(startDt.getDate() - 30);
  return { start: startDt.toISOString().split('T')[0], end };
}

/* ─── Sélecteur de période partagé ─── */
function PeriodSelector({ viewMode, setViewMode, overviewDate, setOverviewDate, selectedWeek, setSelectedWeek, selectedMonth, setSelectedMonth, selectedYear, setSelectedYear, availableYears, datesWithData, lockedDates, partiallyLockedDates, variant }) {
  const currentYear = new Date().getFullYear();
  const yearOptions = availableYears.length > 0 ? availableYears : [currentYear, currentYear - 1];
  const periods = [
    { id: 'day', label: 'Jour' },
    { id: 'week', label: 'Semaine' },
    { id: 'month', label: 'Mois' },
    { id: 'year', label: 'Année' },
  ];

  const btnBase = variant === 'B'
    ? 'px-3 py-1.5 text-sm font-medium rounded-lg transition-all'
    : 'px-3 py-1.5 text-sm font-medium rounded-lg transition-all';
  const btnActive = variant === 'B'
    ? `${btnBase} bg-blue-600 text-white shadow`
    : `${btnBase} bg-gray-900 text-white shadow`;
  const btnInactive = variant === 'B'
    ? `${btnBase} text-gray-600 hover:bg-gray-100`
    : `${btnBase} text-gray-500 hover:bg-gray-100`;

  return (
    <div className="space-y-3">
      <div className="flex gap-1.5 flex-wrap">
        {periods.map(({ id, label }) => (
          <button key={id} type="button" onClick={() => setViewMode(id)} className={viewMode === id ? btnActive : btnInactive}>
            {label}
          </button>
        ))}
      </div>
      <div>
        {viewMode === 'day' && (
          <KPICalendar selectedDate={overviewDate} onDateChange={setOverviewDate} datesWithData={datesWithData} lockedDates={lockedDates} partiallyLockedDates={partiallyLockedDates} />
        )}
        {viewMode === 'week' && (
          <WeekPicker value={selectedWeek} onChange={setSelectedWeek} datesWithData={datesWithData} />
        )}
        {viewMode === 'month' && (
          <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg bg-white cursor-pointer text-sm" />
        )}
        {viewMode === 'year' && (
          <select value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))} className="px-3 py-2 border border-gray-200 rounded-lg bg-white cursor-pointer text-sm">
            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   VARIANT B — Dashboard View
   Header blanc épuré + onglets Config/Saisie
   + contenu Performance revu (StoreKPIVariantBContent)
══════════════════════════════════════════════ */
function ModalVariantB({ onClose, storeId, storeName, isManager, onSuccess }) {
  const { user } = useAuth();
  const state = useStoreKPIModal({ onClose, onSuccess, storeId, isManager });
  const [activeTab, setActiveTab] = useState('perf');
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [aiGenerating, setAiGenerating] = useState(false);
  const aiSectionRef = useRef(null);

  const canLaunchAI = state.viewMode === 'day'
    ? Boolean(state.overviewData) && !(state.overviewData?.totals?.ca === 0 && state.overviewData?.totals?.ventes === 0)
    : state.historicalData.length > 0 && !state.historicalData.every(d => d.total_ca === 0 && d.total_ventes === 0);

  const lsKey = `mgr_kpi_B_${storeId || 'default'}_${state.viewMode}_${state.overviewDate || state.selectedWeek || state.selectedMonth || state.selectedYear}`;
  useEffect(() => {
    try { const s = localStorage.getItem(lsKey); setAiAnalysis(s ? JSON.parse(s) : null); } catch { setAiAnalysis(null); }
  }, [lsKey]);

  const generateAnalysis = async () => {
    setAiGenerating(true);
    try {
      const { start, end } = getStartEndForView(state.viewMode, state);
      const endpoint = storeId ? `/gerant/stores/${storeId}/analyze-store-kpis` : '/manager/analyze-store-kpis';
      const res = await api.post(endpoint, { start_date: start, end_date: end });
      const analysis = res.data.analysis;
      setAiAnalysis(analysis);
      try { localStorage.setItem(lsKey, JSON.stringify(analysis)); } catch {}
      toast.success('Analyse IA générée !');
    } catch (err) {
      logger.error('Error generating AI analysis:', err);
      toast.error(getSubscriptionErrorMessage(err, user?.role) || "Erreur lors de l'analyse IA");
    } finally { setAiGenerating(false); }
  };

  const tabs = [
    { id: 'perf', label: 'Performance' },
    { id: 'config', label: 'Configuration' },
    { id: 'saisie', label: 'Saisie' },
  ];

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-50 rounded-2xl w-full max-w-4xl shadow-2xl max-h-[90vh] flex flex-col border border-gray-200">

        {/* Header */}
        <div className="bg-white rounded-t-2xl px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">{storeName || 'Mon Magasin'}</h2>
                <p className="text-xs text-gray-400">Tableau de bord des performances</p>
              </div>
              <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-semibold border border-blue-100">Style B</span>
            </div>
            <button type="button" onClick={onClose} className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1">
            {tabs.map(({ id, label }) => (
              <button key={id} type="button" onClick={() => setActiveTab(id)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === id ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto min-h-0 p-6">
          {activeTab === 'perf' && (
            <div className="space-y-5">
              {/* Sélecteur période */}
              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <PeriodSelector
                  variant="B"
                  viewMode={state.viewMode} setViewMode={state.setViewMode}
                  overviewDate={state.overviewDate} setOverviewDate={state.setOverviewDate}
                  selectedWeek={state.selectedWeek} setSelectedWeek={state.setSelectedWeek}
                  selectedMonth={state.selectedMonth} setSelectedMonth={state.setSelectedMonth}
                  selectedYear={state.selectedYear} setSelectedYear={state.setSelectedYear}
                  availableYears={state.availableYears}
                  datesWithData={state.datesWithData}
                  lockedDates={state.lockedDates}
                  partiallyLockedDates={state.partiallyLockedDates}
                />
              </div>
              {/* Contenu B */}
              <StoreKPIVariantBContent
                viewMode={state.viewMode}
                overviewData={state.overviewData}
                historicalData={state.historicalData}
                loadingHistorical={state.loadingHistorical}
                aiAnalysis={aiAnalysis}
                aiGenerating={aiGenerating}
                canLaunchAI={canLaunchAI}
                generateAnalysis={generateAnalysis}
                aiSectionRef={aiSectionRef}
                state={state}
              />
            </div>
          )}
          {activeTab === 'config' && (
            <StoreKPIModalConfigTab kpiConfig={state.kpiConfig} onKPIUpdate={state.handleKPIUpdate} />
          )}
          {activeTab === 'saisie' && (
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
              setActiveTab={setActiveTab}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   VARIANT C — Analytics View
   Header minimaliste gris sombre + graphiques en premier
══════════════════════════════════════════════ */
function ModalVariantC({ onClose, storeId, storeName, isManager, onSuccess }) {
  const { user } = useAuth();
  const state = useStoreKPIModal({ onClose, onSuccess, storeId, isManager });
  const [activeTab, setActiveTab] = useState('perf');
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [aiGenerating, setAiGenerating] = useState(false);
  const aiSectionRef = useRef(null);

  const canLaunchAI = state.viewMode === 'day'
    ? Boolean(state.overviewData) && !(state.overviewData?.totals?.ca === 0 && state.overviewData?.totals?.ventes === 0)
    : state.historicalData.length > 0 && !state.historicalData.every(d => d.total_ca === 0 && d.total_ventes === 0);

  const lsKey = `mgr_kpi_C_${storeId || 'default'}_${state.viewMode}_${state.overviewDate || state.selectedWeek || state.selectedMonth || state.selectedYear}`;
  useEffect(() => {
    try { const s = localStorage.getItem(lsKey); setAiAnalysis(s ? JSON.parse(s) : null); } catch { setAiAnalysis(null); }
  }, [lsKey]);

  const generateAnalysis = async () => {
    setAiGenerating(true);
    try {
      const { start, end } = getStartEndForView(state.viewMode, state);
      const endpoint = storeId ? `/gerant/stores/${storeId}/analyze-store-kpis` : '/manager/analyze-store-kpis';
      const res = await api.post(endpoint, { start_date: start, end_date: end });
      const analysis = res.data.analysis;
      setAiAnalysis(analysis);
      try { localStorage.setItem(lsKey, JSON.stringify(analysis)); } catch {}
      toast.success('Analyse IA générée !');
    } catch (err) {
      logger.error('Error generating AI analysis:', err);
      toast.error(getSubscriptionErrorMessage(err, user?.role) || "Erreur lors de l'analyse IA");
    } finally { setAiGenerating(false); }
  };

  const tabs = [
    { id: 'perf', label: '📊 Analyses' },
    { id: 'config', label: '⚙️ Config' },
    { id: 'saisie', label: '✏️ Saisie' },
  ];

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header minimaliste */}
        <div className="px-6 py-4 border-b border-gray-100 flex-shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-base font-semibold text-gray-900">{storeName || 'Mon Magasin'}</h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium border border-gray-200">Style C</span>
            {/* Tabs inline dans le header */}
            <div className="flex items-center gap-1 ml-4">
              {tabs.map(({ id, label }) => (
                <button key={id} type="button" onClick={() => setActiveTab(id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${activeTab === id ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Barre période — toujours visible pour la vue perf */}
        {activeTab === 'perf' && (
          <div className="px-6 py-3 border-b border-gray-100 bg-gray-50 flex-shrink-0">
            <PeriodSelector
              variant="C"
              viewMode={state.viewMode} setViewMode={state.setViewMode}
              overviewDate={state.overviewDate} setOverviewDate={state.setOverviewDate}
              selectedWeek={state.selectedWeek} setSelectedWeek={state.setSelectedWeek}
              selectedMonth={state.selectedMonth} setSelectedMonth={state.setSelectedMonth}
              selectedYear={state.selectedYear} setSelectedYear={state.setSelectedYear}
              availableYears={state.availableYears}
              datesWithData={state.datesWithData}
              lockedDates={state.lockedDates}
              partiallyLockedDates={state.partiallyLockedDates}
            />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto min-h-0 p-6">
          {activeTab === 'perf' && (
            <StoreKPIVariantCContent
              viewMode={state.viewMode}
              overviewData={state.overviewData}
              historicalData={state.historicalData}
              loadingHistorical={state.loadingHistorical}
              aiAnalysis={aiAnalysis}
              aiGenerating={aiGenerating}
              canLaunchAI={canLaunchAI}
              generateAnalysis={generateAnalysis}
              aiSectionRef={aiSectionRef}
            />
          )}
          {activeTab === 'config' && (
            <StoreKPIModalConfigTab kpiConfig={state.kpiConfig} onKPIUpdate={state.handleKPIUpdate} />
          )}
          {activeTab === 'saisie' && (
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
              setActiveTab={setActiveTab}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Export principal ── */
export default function StoreKPIModalVariant({ variant = 'B', onClose, onSuccess, storeId, storeName, isManager }) {
  if (variant === 'C') return <ModalVariantC onClose={onClose} onSuccess={onSuccess} storeId={storeId} storeName={storeName} isManager={isManager} />;
  return <ModalVariantB onClose={onClose} onSuccess={onSuccess} storeId={storeId} storeName={storeName} isManager={isManager} />;
}
