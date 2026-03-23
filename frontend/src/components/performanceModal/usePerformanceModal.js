import { useState, useMemo, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { api } from '../../lib/apiClient';
import { logger } from '../../utils/logger';
import { getSubscriptionErrorMessage } from '../../utils/apiHelpers';
import { getCurrentWeek, getWeekStartEnd, getMonthStartEnd } from '../storeKPI/storeKPIUtils';
import { exportToPDF as _exportToPDF } from './performancePdfExport';

export default function usePerformanceModal({
  isOpen, bilanData, kpiEntries, user, onDataUpdate,
  generatingBilan, kpiConfig, currentWeekOffset, onWeekChange,
  initialTab, isReadOnly, onLoadMoreKpi,
}) {
  const [activeTab, setActiveTab] = useState(initialTab || 'bilan');
  const [displayedKpiCount, setDisplayedKpiCount] = useState(20);
  const contentRef = useRef(null);
  const bilanSectionRef = useRef(null);
  const [exportingPDF, setExportingPDF] = useState(false);
  const [wasGenerating, setWasGenerating] = useState(false);
  const [savingKPI, setSavingKPI] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [warnings, setWarnings] = useState([]);
  const [pendingKPIData, setPendingKPIData] = useState(null);
  const [editingEntry, setEditingEntry] = useState(null);
  const [viewMode, setViewMode] = useState('semaine');
  const [selectedWeek, setSelectedWeek] = useState(getCurrentWeek);
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [selectedDay, setSelectedDay] = useState(new Date().toISOString().split('T')[0]);
  const [periodEntries, setPeriodEntries] = useState([]);
  const [periodLoading, setPeriodLoading] = useState(false);
  const [periodBilan, setPeriodBilan] = useState(null);
  const [periodGenerating, setPeriodGenerating] = useState(false);
  const [datesWithData, setDatesWithData] = useState([]);
  const [periodAggregates, setPeriodAggregates] = useState(null);

  // Sync active tab with initialTab prop
  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  // Calculate KPI averages for anomaly detection
  const calculateAverages = () => {
    if (!kpiEntries || kpiEntries.length === 0) return null;
    const totals = kpiEntries.reduce((acc, entry) => ({
      ca: acc.ca + (entry.ca_journalier || 0),
      ventes: acc.ventes + (entry.nb_ventes || 0),
      articles: acc.articles + (entry.nb_articles || 0),
      prospects: acc.prospects + (entry.nb_prospects || 0),
    }), { ca: 0, ventes: 0, articles: 0, prospects: 0 });
    return {
      avgCA: totals.ca / kpiEntries.length,
      avgVentes: totals.ventes / kpiEntries.length,
      avgArticles: totals.articles / kpiEntries.length,
      avgProspects: totals.prospects / kpiEntries.length,
    };
  };

  const checkAnomalies = (data) => {
    const averages = calculateAverages();
    if (!averages || !kpiEntries || kpiEntries.length < 5) return [];

    const detectedWarnings = [];
    const THRESHOLD_HIGH = 1.5;
    const THRESHOLD_LOW = 0.5;

    const check = (key, kpiLabel, value, avg) => {
      if (value > 0 && avg > 0) {
        if (value > avg * THRESHOLD_HIGH || value < avg * THRESHOLD_LOW) {
          detectedWarnings.push({
            kpi: kpiLabel,
            value: key === 'ca' ? `${value.toFixed(2)}€` : value,
            average: key === 'ca' ? `${avg.toFixed(2)}€` : Math.round(avg),
            percentage: ((value / avg - 1) * 100).toFixed(0),
          });
        }
      }
    };

    check('ca', "Chiffre d'affaires", data.ca_journalier, averages.avgCA);
    check('ventes', 'Nombre de ventes', data.nb_ventes, averages.avgVentes);
    check('articles', "Nombre d'articles", data.nb_articles, averages.avgArticles);
    check('prospects', 'Nombre de prospects', data.nb_prospects, averages.avgProspects);

    return detectedWarnings;
  };

  const saveKPIData = async (data) => {
    setSavingKPI(true);
    setSaveMessage(null);
    try {
      logger.log('📤 Envoi des données à l\'API:', '/seller/kpi-entry');
      await api.post('/seller/kpi-entry', data);
      setSaveMessage({ type: 'success', text: editingEntry ? '✅ Modifications enregistrées avec succès !' : '✅ Vos chiffres ont été enregistrés avec succès !' });
      if (onDataUpdate) await onDataUpdate();
      setTimeout(() => {
        setActiveTab('bilan');
        setSaveMessage(null);
        setEditingEntry(null);
      }, 1500);
    } catch (error) {
      logger.error('❌ Erreur complète:', error);
      setSaveMessage({ type: 'error', text: `❌ Erreur: ${error.response?.data?.detail || error.message || 'Veuillez réessayer.'}` });
    } finally {
      setSavingKPI(false);
    }
  };

  const handleDirectSaveKPI = async (data) => {
    logger.log('🚀 handleDirectSaveKPI appelé avec:', data);
    const detectedWarnings = checkAnomalies(data);
    if (detectedWarnings.length > 0) {
      setWarnings(detectedWarnings);
      setPendingKPIData(data);
      setShowWarningModal(true);
      return;
    }
    await saveKPIData(data);
  };

  // ISO week number
  const getWeekNumber = (date) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  };

  const weekInfo = useMemo(() => {
    if (!bilanData?.periode) {
      const now = new Date();
      return { weekNumber: getWeekNumber(now), dateRange: null };
    }
    const match = bilanData.periode.match(/(\d+)[\/\s]+(\w+)[\.\s]+au\s+(\d+)[\/\s]+(\w+)[\.]?/i);
    if (!match) return { weekNumber: getWeekNumber(new Date()), dateRange: bilanData.periode };
    const [_, startDay, startMonth, endDay, endMonth] = match;
    const monthMap = { 'janv': 0, 'févr': 1, 'mars': 2, 'avr': 3, 'mai': 4, 'juin': 5, 'juil': 6, 'août': 7, 'sept': 8, 'oct': 9, 'nov': 10, 'déc': 11 };
    const monthIndex = monthMap[startMonth] !== undefined ? monthMap[startMonth] : Number.parseInt(startMonth) - 1;
    const startDate = new Date(new Date().getFullYear(), monthIndex, parseInt(startDay));
    return { weekNumber: getWeekNumber(startDate), dateRange: `${startDay} au ${endDay} ${endMonth}.` };
  }, [bilanData?.periode]);

  const toDateStr = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const periodRange = useMemo(() => {
    if (viewMode === 'jour') {
      const d = new Date(selectedDay + 'T12:00:00');
      return {
        start_date: selectedDay,
        end_date: selectedDay,
        label: d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
      };
    }
    if (viewMode === 'semaine') {
      const { startDate: monday, endDate: sunday } = getWeekStartEnd(selectedWeek);
      return { start_date: toDateStr(monday), end_date: toDateStr(sunday), label: bilanData?.periode || selectedWeek };
    }
    if (viewMode === 'mois') {
      const { startDate, endDate } = getMonthStartEnd(selectedMonth);
      const raw = startDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
      return { start_date: toDateStr(startDate), end_date: toDateStr(endDate), label: raw.charAt(0).toUpperCase() + raw.slice(1) };
    }
    if (viewMode === 'annee') {
      return { start_date: `${selectedYear}-01-01`, end_date: `${selectedYear}-12-31`, label: `Année ${selectedYear}` };
    }
    return null;
  }, [viewMode, selectedWeek, selectedMonth, selectedYear, selectedDay, bilanData?.periode]);

  const sellerAvailableYears = useMemo(() => {
    const cur = new Date().getFullYear();
    if (!kpiEntries || kpiEntries.length === 0) return [cur, cur - 1];
    const years = [...new Set(kpiEntries.map(e => parseInt(e.date?.split('-')[0])).filter(Boolean))].sort((a, b) => b - a);
    return years.length > 0 ? years : [cur, cur - 1];
  }, [kpiEntries]);

  // Fetch period data
  useEffect(() => {
    if (!isOpen || !periodRange) return;
    let cancelled = false;
    setPeriodLoading(true);
    setPeriodEntries([]);
    if (viewMode !== 'semaine') {
      setPeriodBilan(null);
      setPeriodAggregates(null);
    }
    const needsBilan = viewMode === 'jour' || viewMode === 'mois' || viewMode === 'annee';

    const fetchEntries = async (start_date, end_date) => {
      if (viewMode === 'annee') {
        const all = [];
        for (let page = 1; page <= 4; page++) {
          const res = await api.get('/seller/kpi-entries', { params: { start_date, end_date, size: 100, page } });
          const d = res.data;
          const items = Array.isArray(d) ? d : (d?.items ?? []);
          all.push(...items);
          if (items.length < 100) break;
        }
        return all;
      }
      const size = viewMode === 'mois' ? 31 : 7;
      const res = await api.get('/seller/kpi-entries', { params: { start_date, end_date, size } });
      const d = res.data;
      return Array.isArray(d) ? d : (d?.items ?? []);
    };

    Promise.all([
      fetchEntries(periodRange.start_date, periodRange.end_date),
      api.get('/seller/kpi-metrics', { params: { start_date: periodRange.start_date, end_date: periodRange.end_date } }),
      ...(needsBilan ? [api.get('/seller/bilan-individuel/all')] : []),
    ]).then(([entries, metricsRes, bilansRes]) => {
      if (cancelled) return;
      setPeriodEntries(entries.sort((a, b) => new Date(a.date) - new Date(b.date)));
      if (viewMode !== 'semaine') setPeriodAggregates(metricsRes.data);
      if (needsBilan && bilansRes) {
        const bilans = Array.isArray(bilansRes.data?.bilans) ? bilansRes.data.bilans : [];
        const existing = bilans.find(b => b.period_start === periodRange.start_date && b.period_end === periodRange.end_date);
        setPeriodBilan(existing
          ? { ...existing, periode: periodRange.label }
          : { periode: periodRange.label, synthese: '', points_forts: [], points_attention: [], recommandations: [] }
        );
      }
    }).catch(err => {
      logger.error('Error fetching period data:', err);
    }).finally(() => {
      if (!cancelled) setPeriodLoading(false);
    });
    return () => { cancelled = true; };
  }, [isOpen, viewMode, periodRange?.start_date, periodRange?.end_date]);

  // Chart data for period views
  const periodChartData = useMemo(() => {
    if (!periodEntries.length) return [];
    return periodEntries.map(entry => ({
      date: new Date(entry.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
      CA: entry.ca_journalier || 0,
      Ventes: entry.nb_ventes || 0,
      Articles: entry.nb_articles || 0,
      Prospects: entry.nb_prospects || 0,
    }));
  }, [periodEntries]);

  // Monthly aggregation for year view
  const yearMonthlyData = useMemo(() => {
    if (viewMode !== 'annee' || !periodEntries.length) return [];
    const months = {};
    periodEntries.forEach(e => {
      const key = e.date.substring(0, 7);
      if (!months[key]) months[key] = { month: key, ca: 0, ventes: 0, articles: 0, prospects: 0 };
      months[key].ca += e.ca_journalier || 0;
      months[key].ventes += e.nb_ventes || 0;
      months[key].articles += e.nb_articles || 0;
      months[key].prospects += e.nb_prospects || 0;
    });
    return Object.values(months).sort((a, b) => a.month.localeCompare(b.month));
  }, [viewMode, periodEntries]);

  // Generate AI bilan for non-semaine views
  const generatePeriodBilan = async () => {
    if (!periodRange) return;
    setPeriodGenerating(true);
    try {
      const postRes = await api.post(`/seller/bilan-individuel?start_date=${periodRange.start_date}&end_date=${periodRange.end_date}`, {});
      setPeriodBilan({ ...postRes.data, periode: periodRange.label });
      toast.success('✨ Bilan généré avec succès');
    } catch (err) {
      logger.error('Error generating period bilan:', err);
      toast.error(getSubscriptionErrorMessage(err, user?.role) || 'Erreur lors de la génération du bilan');
    } finally {
      setPeriodGenerating(false);
    }
  };

  // Auto-scroll when bilan generation completes
  useEffect(() => {
    if (wasGenerating && !generatingBilan && bilanData?.synthese && bilanSectionRef.current) {
      setTimeout(() => { bilanSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 300);
    }
    if (generatingBilan) {
      setWasGenerating(true);
    } else if (wasGenerating) {
      setWasGenerating(false);
    }
  }, [generatingBilan, bilanData?.synthese]);

  // Fetch dates with data for calendar
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    api.get('/seller/dates-with-data')
      .then(res => { if (!cancelled) setDatesWithData(res.data?.dates ?? []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isOpen]);

  // Chart data for current week (semaine view)
  const chartData = useMemo(() => {
    if (!kpiEntries || kpiEntries.length === 0) return [];
    const now = new Date();
    const offsetDays = (currentWeekOffset || 0) * 7;
    const monday = new Date(now);
    monday.setDate(monday.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1) + offsetDays);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    const weekEntries = kpiEntries.filter(e => {
      const d = new Date(e.date);
      return d >= monday && d <= sunday;
    });
    return weekEntries.sort((a, b) => new Date(a.date) - new Date(b.date)).map(entry => ({
      date: new Date(entry.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' }),
      CA: entry.ca_journalier || 0,
      Ventes: entry.nb_ventes || 0,
      Articles: entry.nb_articles || 0,
      Prospects: entry.nb_prospects || 0,
      'Panier Moyen': entry.ca_journalier && entry.nb_ventes ? (entry.ca_journalier / entry.nb_ventes).toFixed(2) : 0,
    }));
  }, [kpiEntries, currentWeekOffset]);

  const exportToPDF = () => {
    const fmt = (d) =>
      `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(-2)}`;
    let effectivePeriode = bilanData?.periode;
    if (viewMode === 'semaine' && selectedWeek) {
      const { startDate, endDate } = getWeekStartEnd(selectedWeek);
      effectivePeriode = `Semaine du ${fmt(startDate)} au ${fmt(endDate)}`;
    } else if (viewMode === 'jour' && selectedDay) {
      effectivePeriode = selectedDay;
    } else if (viewMode === 'mois' && selectedMonth) {
      effectivePeriode = selectedMonth;
    } else if (viewMode === 'annee' && selectedYear) {
      effectivePeriode = String(selectedYear);
    }
    _exportToPDF(contentRef, { ...bilanData, periode: effectivePeriode }, setExportingPDF);
  };

  return {
    // Tabs
    activeTab, setActiveTab,
    // Refs
    contentRef, bilanSectionRef,
    // PDF
    exportingPDF, setExportingPDF, exportToPDF,
    // Generating state
    wasGenerating,
    // KPI save
    savingKPI, saveMessage, handleDirectSaveKPI, saveKPIData,
    // Warning modal
    showWarningModal, setShowWarningModal,
    warnings, setWarnings,
    pendingKPIData, setPendingKPIData,
    // Editing
    editingEntry, setEditingEntry,
    // View mode + period selectors
    viewMode, setViewMode,
    selectedWeek, setSelectedWeek,
    selectedMonth, setSelectedMonth,
    selectedYear, setSelectedYear,
    selectedDay, setSelectedDay,
    // Period data
    periodEntries, periodLoading,
    periodBilan, periodGenerating,
    periodAggregates,
    datesWithData,
    // Computed
    weekInfo, periodRange,
    sellerAvailableYears,
    periodChartData, yearMonthlyData, chartData,
    // Actions
    generatePeriodBilan,
    // Display
    displayedKpiCount, setDisplayedKpiCount,
  };
}
