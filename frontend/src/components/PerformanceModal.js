import React, { useState, useMemo, useRef, useEffect } from 'react';
import { X, TrendingUp, AlertTriangle, Edit3, Lock } from 'lucide-react';
import { unstable_batchedUpdates } from 'react-dom';
import { toast } from 'sonner';
import { api } from '../lib/apiClient';
import { logger } from '../utils/logger';
import { getSubscriptionErrorMessage } from '../utils/apiHelpers';
import { getCurrentWeek, getWeekStartEnd, getMonthStartEnd, getYearStartEnd } from './storeKPI/storeKPIUtils';
import BilanTab from './performanceModal/BilanTab';
import SaisieTab from './performanceModal/SaisieTab';

// Fonction utilitaire pour formater les dates
const formatDate = (dateString) => {
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

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
  const [activeTab, setActiveTab] = useState(initialTab); // 'bilan', 'kpi', or 'saisie'
  const [displayedKpiCount, setDisplayedKpiCount] = useState(20); // Start with 20 entries
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
  const [viewMode, setViewMode] = useState('semaine'); // 'jour' | 'semaine' | 'mois' | 'annee'
  const [selectedWeek, setSelectedWeek] = useState(getCurrentWeek);
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [selectedDay, setSelectedDay] = useState(new Date().toISOString().split('T')[0]);
  const [periodEntries, setPeriodEntries] = useState([]);
  const [periodLoading, setPeriodLoading] = useState(false);
  const [periodBilan, setPeriodBilan] = useState(null);
  const [periodGenerating, setPeriodGenerating] = useState(false);
  const [datesWithData, setDatesWithData] = useState([]);

  // Synchroniser l'onglet actif avec initialTab quand il change
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Fonction pour calculer les moyennes des KPI historiques
  const calculateAverages = () => {
    if (!kpiEntries || kpiEntries.length === 0) return null;

    const totals = kpiEntries.reduce((acc, entry) => ({
      ca: acc.ca + (entry.ca_journalier || 0),
      ventes: acc.ventes + (entry.nb_ventes || 0),
      articles: acc.articles + (entry.nb_articles || 0),
      prospects: acc.prospects + (entry.nb_prospects || 0)
    }), { ca: 0, ventes: 0, articles: 0, prospects: 0 });

    return {
      avgCA: totals.ca / kpiEntries.length,
      avgVentes: totals.ventes / kpiEntries.length,
      avgArticles: totals.articles / kpiEntries.length,
      avgProspects: totals.prospects / kpiEntries.length
    };
  };

  // Fonction pour vérifier les anomalies
  const checkAnomalies = (data) => {
    const averages = calculateAverages();
    if (!averages || !kpiEntries || kpiEntries.length < 5) {
      // Pas assez de données pour comparer
      return [];
    }

    const detectedWarnings = [];
    const THRESHOLD_HIGH = 1.5; // 150% de la moyenne
    const THRESHOLD_LOW = 0.5;  // 50% de la moyenne

    // Vérifier CA
    if (data.ca_journalier > 0 && averages.avgCA > 0) {
      if (data.ca_journalier > averages.avgCA * THRESHOLD_HIGH) {
        detectedWarnings.push({
          kpi: 'Chiffre d\'affaires',
          value: `${data.ca_journalier.toFixed(2)}€`,
          average: `${averages.avgCA.toFixed(2)}€`,
          percentage: ((data.ca_journalier / averages.avgCA - 1) * 100).toFixed(0)
        });
      } else if (data.ca_journalier < averages.avgCA * THRESHOLD_LOW) {
        detectedWarnings.push({
          kpi: 'Chiffre d\'affaires',
          value: `${data.ca_journalier.toFixed(2)}€`,
          average: `${averages.avgCA.toFixed(2)}€`,
          percentage: ((data.ca_journalier / averages.avgCA - 1) * 100).toFixed(0)
        });
      }
    }

    // Vérifier Ventes
    if (data.nb_ventes > 0 && averages.avgVentes > 0) {
      if (data.nb_ventes > averages.avgVentes * THRESHOLD_HIGH) {
        detectedWarnings.push({
          kpi: 'Nombre de ventes',
          value: data.nb_ventes,
          average: Math.round(averages.avgVentes),
          percentage: ((data.nb_ventes / averages.avgVentes - 1) * 100).toFixed(0)
        });
      } else if (data.nb_ventes < averages.avgVentes * THRESHOLD_LOW) {
        detectedWarnings.push({
          kpi: 'Nombre de ventes',
          value: data.nb_ventes,
          average: Math.round(averages.avgVentes),
          percentage: ((data.nb_ventes / averages.avgVentes - 1) * 100).toFixed(0)
        });
      }
    }

    // Vérifier Articles
    if (data.nb_articles > 0 && averages.avgArticles > 0) {
      if (data.nb_articles > averages.avgArticles * THRESHOLD_HIGH) {
        detectedWarnings.push({
          kpi: 'Nombre d\'articles',
          value: data.nb_articles,
          average: Math.round(averages.avgArticles),
          percentage: ((data.nb_articles / averages.avgArticles - 1) * 100).toFixed(0)
        });
      } else if (data.nb_articles < averages.avgArticles * THRESHOLD_LOW) {
        detectedWarnings.push({
          kpi: 'Nombre d\'articles',
          value: data.nb_articles,
          average: Math.round(averages.avgArticles),
          percentage: ((data.nb_articles / averages.avgArticles - 1) * 100).toFixed(0)
        });
      }
    }

    // Vérifier Prospects
    if (data.nb_prospects > 0 && averages.avgProspects > 0) {
      if (data.nb_prospects > averages.avgProspects * THRESHOLD_HIGH) {
        detectedWarnings.push({
          kpi: 'Nombre de prospects',
          value: data.nb_prospects,
          average: Math.round(averages.avgProspects),
          percentage: ((data.nb_prospects / averages.avgProspects - 1) * 100).toFixed(0)
        });
      } else if (data.nb_prospects < averages.avgProspects * THRESHOLD_LOW) {
        detectedWarnings.push({
          kpi: 'Nombre de prospects',
          value: data.nb_prospects,
          average: Math.round(averages.avgProspects),
          percentage: ((data.nb_prospects / averages.avgProspects - 1) * 100).toFixed(0)
        });
      }
    }

    return detectedWarnings;
  };

  // Fonction pour sauvegarder directement les KPI sans ouvrir de modal
  const handleDirectSaveKPI = async (data) => {
    logger.log('🚀 handleDirectSaveKPI appelé avec:', data);
    logger.log('📋 KPI Config reçue:', kpiConfig);
    logger.log('✅ Champs à afficher - CA:', kpiConfig?.track_ca, 'Ventes:', kpiConfig?.track_ventes, 'Articles:', kpiConfig?.track_articles, 'Prospects:', kpiConfig?.track_prospects);

    // Vérifier les anomalies
    const detectedWarnings = checkAnomalies(data);
    if (detectedWarnings.length > 0) {
      // Afficher la modal d'avertissement
      setWarnings(detectedWarnings);
      setPendingKPIData(data);
      setShowWarningModal(true);
      return;
    }

    // Pas d'anomalie, sauvegarder directement
    await saveKPIData(data);
  };

  // Fonction pour sauvegarder les données (après validation ou confirmation)
  const saveKPIData = async (data) => {
    setSavingKPI(true);
    setSaveMessage(null);

    try {
      logger.log('📤 Envoi des données à l\'API:', '/seller/kpi-entry');

      // Envoyer les données à l'API
      const response = await api.post(
        '/seller/kpi-entry',
        data
      );

      logger.log('✅ Réponse API:', response.data);

      // Afficher le message de succès
      setSaveMessage({ type: 'success', text: editingEntry ? '✅ Modifications enregistrées avec succès !' : '✅ Vos chiffres ont été enregistrés avec succès !' });

      // Rafraîchir les données
      if (onDataUpdate) {
        await onDataUpdate();
      }

      // Basculer vers le bilan après 1 seconde
      setTimeout(() => {
        setActiveTab('bilan');
        setSaveMessage(null);
        setEditingEntry(null);
      }, 1500);

    } catch (error) {
      logger.error('❌ Erreur complète:', error);
      logger.error('❌ Réponse erreur:', error.response?.data);
      setSaveMessage({
        type: 'error',
        text: `❌ Erreur: ${error.response?.data?.detail || error.message || 'Veuillez réessayer.'}`
      });
    } finally {
      setSavingKPI(false);
    }
  };

  // Fonction pour calculer le numéro de semaine ISO
  const getWeekNumber = (date) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  };

  // Calculer le numéro de semaine et les dates pour le sélecteur
  const weekInfo = useMemo(() => {
    if (!bilanData?.periode) {
      // Si pas de période, calculer depuis la semaine actuelle
      const now = new Date();
      const weekNum = getWeekNumber(now);
      return { weekNumber: weekNum, dateRange: null };
    }

    // Parse la période - plusieurs formats possibles
    // Format 1: "17 nov. au 23 nov." ou "10/11/25 au 16/11/25"
    let match = bilanData.periode.match(/(\d+)[\/\s]+(\w+)[\.\s]+au\s+(\d+)[\/\s]+(\w+)[\.]?/i);

    if (!match) {
      const now = new Date();
      return { weekNumber: getWeekNumber(now), dateRange: bilanData.periode };
    }

    const [_, startDay, startMonth, endDay, endMonth] = match;
    const currentYear = new Date().getFullYear();

    // Créer une date approximative pour calculer le numéro de semaine
    const monthMap = {
      'janv': 0, 'févr': 1, 'mars': 2, 'avr': 3, 'mai': 4, 'juin': 5,
      'juil': 6, 'août': 7, 'sept': 8, 'oct': 9, 'nov': 10, 'déc': 11
    };

    const monthIndex = monthMap[startMonth] !== undefined ? monthMap[startMonth] : Number.parseInt(startMonth) - 1;
    const startDate = new Date(currentYear, monthIndex, parseInt(startDay));
    const weekNum = getWeekNumber(startDate);

    return {
      weekNumber: weekNum,
      dateRange: `${startDay} au ${endDay} ${endMonth}.`
    };
  }, [bilanData?.periode]);

  // Helper: build YYYY-MM-DD from a local Date without UTC shift
  const toDateStr = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  // Period date range for toutes les vues (semaine incluse)
  const periodRange = useMemo(() => {
    const now = new Date();
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
      return {
        start_date: toDateStr(monday),
        end_date: toDateStr(sunday),
        label: bilanData?.periode || selectedWeek,
      };
    }
    if (viewMode === 'mois') {
      const { startDate, endDate } = getMonthStartEnd(selectedMonth);
      const raw = startDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
      return {
        start_date: toDateStr(startDate),
        end_date: toDateStr(endDate),
        label: raw.charAt(0).toUpperCase() + raw.slice(1),
      };
    }
    if (viewMode === 'annee') {
      return {
        start_date: `${selectedYear}-01-01`,
        end_date: `${selectedYear}-12-31`,
        label: `Année ${selectedYear}`,
      };
    }
    return null;
  }, [viewMode, selectedWeek, selectedMonth, selectedYear, selectedDay, bilanData?.periode]);

  const sellerAvailableYears = useMemo(() => {
    const cur = new Date().getFullYear();
    if (!kpiEntries || kpiEntries.length === 0) return [cur, cur - 1];
    const years = [...new Set(kpiEntries.map(e => parseInt(e.date?.split('-')[0])).filter(Boolean))].sort((a, b) => b - a);
    return years.length > 0 ? years : [cur, cur - 1];
  }, [kpiEntries]);

  // Fetch KPI entries + métriques + bilan selon la vue active
  const [periodAggregates, setPeriodAggregates] = useState(null);
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

    // Fetch KPI entries — for année paginate in blocks of 100 (safe with old backend cap)
    const fetchEntries = async (start_date, end_date) => {
      if (viewMode === 'annee') {
        const all = [];
        for (let page = 1; page <= 4; page++) {
          const res = await api.get('/seller/kpi-entries', {
            params: { start_date, end_date, size: 100, page },
          });
          const d = res.data;
          const items = Array.isArray(d) ? d : (d?.items ?? []);
          all.push(...items);
          if (items.length < 100) break;
        }
        return all;
      }
      const size = viewMode === 'mois' ? 31 : 7;
      const res = await api.get('/seller/kpi-entries', {
        params: { start_date, end_date, size },
      });
      const d = res.data;
      return Array.isArray(d) ? d : (d?.items ?? []);
    };

    Promise.all([
      fetchEntries(periodRange.start_date, periodRange.end_date),
      api.get('/seller/kpi-metrics', {
        params: { start_date: periodRange.start_date, end_date: periodRange.end_date },
      }),
      ...(needsBilan ? [api.get('/seller/bilan-individuel/all')] : []),
    ]).then(([entries, metricsRes, bilansRes]) => {
      if (cancelled) return;
      setPeriodEntries(entries.sort((a, b) => new Date(a.date) - new Date(b.date)));
      if (viewMode !== 'semaine') {
        setPeriodAggregates(metricsRes.data);
      }
      if (needsBilan && bilansRes) {
        const bilans = Array.isArray(bilansRes.data?.bilans) ? bilansRes.data.bilans : [];
        const existing = bilans.find(b =>
          b.period_start === periodRange.start_date && b.period_end === periodRange.end_date
        );
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

  // Generate AI bilan for jour / mois / annee views
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

  // Auto-scroll to bilan section when generation completes
  useEffect(() => {
    // Detect when generation just finished
    if (wasGenerating && !generatingBilan && bilanData?.synthese && bilanSectionRef.current) {
      setTimeout(() => {
        bilanSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    }

    // Track generating state
    if (generatingBilan) {
      setWasGenerating(true);
    } else if (wasGenerating) {
      setWasGenerating(false);
    }
  }, [generatingBilan, bilanData?.synthese]);

  // Fetch all dates that have data — used by KPICalendar in jour view
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    api.get('/seller/dates-with-data')
      .then(res => {
        if (cancelled) return;
        setDatesWithData(res.data?.dates ?? []);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isOpen]);

  // Prepare chart data from KPI entries for current week
  // NOTE: must be defined BEFORE the early return to respect Rules of Hooks
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

    const weekEntries = kpiEntries.filter(entry => {
      const entryDate = new Date(entry.date);
      return entryDate >= monday && entryDate <= sunday;
    });

    const sortedEntries = weekEntries.sort((a, b) => new Date(a.date) - new Date(b.date));

    return sortedEntries.map(entry => ({
      date: new Date(entry.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' }),
      CA: entry.ca_journalier || 0,
      Ventes: entry.nb_ventes || 0,
      Articles: entry.nb_articles || 0,
      Prospects: entry.nb_prospects || 0,
      'Panier Moyen': entry.ca_journalier && entry.nb_ventes ? (entry.ca_journalier / entry.nb_ventes).toFixed(2) : 0
    }));
  }, [kpiEntries, currentWeekOffset]);

  if (!isOpen) return null;

  // Export to PDF function
  const exportToPDF = async () => {
    if (!contentRef.current || !document.body.contains(contentRef.current)) {
      logger.error('Content ref not available');
      return;
    }

    unstable_batchedUpdates(() => {
      setExportingPDF(true);
    });

    try {
      const [jspdfModule, { default: html2canvas }] = await Promise.all([
        import('jspdf'),
        import('html2canvas'),
      ]);
      const jsPDF = jspdfModule.jsPDF ?? jspdfModule.default;

      await new Promise(resolve => setTimeout(resolve, 150));

      const canvas = await html2canvas(contentRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        scrollY: -globalThis.scrollY,
        scrollX: -globalThis.scrollX,
        width: 1200,
        windowWidth: 1200,
        allowTaint: true,
        foreignObjectRendering: false,
      });

      const imgData = canvas.toDataURL('image/png', 0.95);
      const pdf = new jsPDF('p', 'mm', 'a4');

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const margin = 8;

      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const contentWidth = pdfWidth - (2 * margin);
      const ratio = contentWidth / imgWidth;
      const contentHeight = imgHeight * ratio;

      if (contentHeight <= pdfHeight - 20) {
        pdf.addImage(imgData, 'PNG', margin, margin, contentWidth, contentHeight);
      } else {
        let remainingHeight = contentHeight;
        let currentY = 0;
        let pageNum = 0;

        while (remainingHeight > 0) {
          if (pageNum > 0) pdf.addPage();

          const sliceHeight = Math.min(pdfHeight - 20, remainingHeight);
          const sy = (currentY / contentHeight) * imgHeight;
          const sh = (sliceHeight / contentHeight) * imgHeight;

          const shInt = Math.max(1, Math.round(sh));
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = imgWidth;
          tempCanvas.height = shInt;
          const tempCtx = tempCanvas.getContext('2d');
          tempCtx.drawImage(canvas, 0, sy, imgWidth, sh, 0, 0, imgWidth, shInt);

          const sliceImgData = tempCanvas.toDataURL('image/png', 1.0);
          pdf.addImage(sliceImgData, 'PNG', margin, margin, contentWidth, sliceHeight);

          currentY += sliceHeight;
          remainingHeight -= sliceHeight;
          pageNum++;
        }
      }

      const fileName = `bilan_${bilanData?.periode || 'actuel'}.pdf`.replace(/\s+/g, '_');
      pdf.save(fileName);

    } catch (error) {
      logger.error('Erreur export PDF:', error);
      toast.error('Erreur lors de l\'export PDF');
    } finally {
      unstable_batchedUpdates(() => {
        setExportingPDF(false);
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header avec onglets */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-600">
          <div className="flex items-center justify-between p-4">
            <h2 className="text-2xl font-bold text-white">📊 Mes Performances</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-full transition-colors"
            >
              <X className="w-6 h-6 text-white" />
            </button>
          </div>

          {/* Onglets */}
          <div className="border-b border-gray-200 bg-gray-50 pt-2">
            <div className="flex gap-1 px-6">
              <button
                onClick={() => setActiveTab('bilan')}
                className={`px-4 py-2 text-sm font-semibold transition-all rounded-t-lg ${
                  activeTab === 'bilan'
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
                    toast.error("Abonnement magasin suspendu. Saisie désactivée.", {
                      duration: 4000,
                      icon: '🔒'
                    });
                    return;
                  }
                  setActiveTab('saisie');
                }}
                disabled={isReadOnly}
                className={`px-4 py-2 text-sm font-semibold transition-all rounded-t-lg ${
                  isReadOnly
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : activeTab === 'saisie'
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

        {/* Contenu du modal selon l'onglet actif */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'bilan' && (
            <BilanTab
              viewMode={viewMode}
              setViewMode={setViewMode}
              selectedDay={selectedDay}
              setSelectedDay={setSelectedDay}
              selectedWeek={selectedWeek}
              setSelectedWeek={setSelectedWeek}
              selectedMonth={selectedMonth}
              setSelectedMonth={setSelectedMonth}
              selectedYear={selectedYear}
              setSelectedYear={setSelectedYear}
              periodLoading={periodLoading}
              periodEntries={periodEntries}
              periodBilan={periodBilan}
              periodGenerating={periodGenerating}
              periodAggregates={periodAggregates}
              periodChartData={periodChartData}
              yearMonthlyData={yearMonthlyData}
              datesWithData={datesWithData}
              bilanData={bilanData}
              kpiEntries={kpiEntries}
              displayedKpiCount={displayedKpiCount}
              setDisplayedKpiCount={setDisplayedKpiCount}
              exportingPDF={exportingPDF}
              setExportingPDF={setExportingPDF}
              wasGenerating={wasGenerating}
              weekInfo={weekInfo}
              periodRange={periodRange}
              kpiConfig={kpiConfig}
              user={user}
              isReadOnly={isReadOnly}
              generatingBilan={generatingBilan}
              currentWeekOffset={currentWeekOffset}
              contentRef={contentRef}
              bilanSectionRef={bilanSectionRef}
              setEditingEntry={setEditingEntry}
              setActiveTab={setActiveTab}
              generatePeriodBilan={generatePeriodBilan}
              onRegenerate={onRegenerate}
              onLoadMoreKpi={onLoadMoreKpi}
              onWeekChange={onWeekChange}
              chartData={chartData}
              sellerAvailableYears={sellerAvailableYears}
              exportToPDF={exportToPDF}
            />
          )}

          {activeTab === 'saisie' && (
            <SaisieTab
              editingEntry={editingEntry}
              savingKPI={savingKPI}
              saveMessage={saveMessage}
              kpiConfig={kpiConfig}
              isReadOnly={isReadOnly}
              handleDirectSaveKPI={handleDirectSaveKPI}
              setEditingEntry={setEditingEntry}
              setActiveTab={setActiveTab}
            />
          )}
        </div>
      </div>

      {/* Modal d'avertissement pour les anomalies */}
      {showWarningModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-amber-500 flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-lg font-bold text-gray-800 mb-2">
                  ⚠️ Valeurs inhabituelles détectées
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Les données saisies sont significativement différentes de votre moyenne habituelle :
                </p>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              {warnings.map((warning, index) => (
                <div key={index} className="bg-amber-50 rounded-lg p-3 border-l-4 border-amber-400">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-gray-800">{warning.kpi}</span>
                    <span className={`text-sm font-bold ${
                      Number.parseFloat(warning.percentage) > 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {warning.percentage > 0 ? '+' : ''}{warning.percentage}%
                    </span>
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    <div>Valeur saisie : <span className="font-semibold">{warning.value}</span></div>
                    <div>Moyenne habituelle : <span className="font-semibold">{warning.average}</span></div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowWarningModal(false);
                  setWarnings([]);
                  setPendingKPIData(null);
                }}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-all"
              >
                ❌ Annuler
              </button>
              <button
                onClick={() => {
                  setShowWarningModal(false);
                  saveKPIData(pendingKPIData);
                  setPendingKPIData(null);
                  setWarnings([]);
                }}
                className="flex-1 px-4 py-2 bg-orange-600 text-white font-semibold rounded-lg hover:bg-orange-700 transition-all"
              >
                ✅ Confirmer quand même
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
