import React, { useState, useMemo, useRef, useEffect } from 'react';
import { X, TrendingUp, BarChart3, ChevronLeft, ChevronRight, Download, Sparkles, AlertTriangle, Target, Edit3, Lock } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { unstable_batchedUpdates } from 'react-dom';
import { toast } from 'sonner';
import { api } from '../lib/apiClient';
import { logger } from '../utils/logger';

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
  const [viewMode, setViewMode] = useState('semaine'); // 'semaine' | '30j' | 'mois'
  const [monthOffset, setMonthOffset] = useState(0);
  const [periodEntries, setPeriodEntries] = useState([]);
  const [periodLoading, setPeriodLoading] = useState(false);
  const [periodBilan, setPeriodBilan] = useState(null);
  const [periodGenerating, setPeriodGenerating] = useState(false);

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
      
      // Basculer vers l'onglet historique après 1 seconde
      setTimeout(() => {
        setActiveTab('kpi');
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

  // Period date range for 30j / mois views
  const periodRange = useMemo(() => {
    const now = new Date();
    if (viewMode === '30j') {
      const end = new Date(now);
      const start = new Date(now);
      start.setDate(start.getDate() - 29);
      return {
        start_date: start.toISOString().split('T')[0],
        end_date: end.toISOString().split('T')[0],
        label: '30 derniers jours',
      };
    }
    if (viewMode === 'mois') {
      const d = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      const raw = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
      return {
        start_date: start.toISOString().split('T')[0],
        end_date: end.toISOString().split('T')[0],
        label: raw.charAt(0).toUpperCase() + raw.slice(1),
      };
    }
    return null;
  }, [viewMode, monthOffset]);

  // Fetch KPI entries + existing bilan for period views
  useEffect(() => {
    if (!isOpen || viewMode === 'semaine' || !periodRange) return;
    let cancelled = false;
    setPeriodLoading(true);
    setPeriodEntries([]);
    setPeriodBilan(null);
    Promise.all([
      api.get('/seller/kpi-entries', {
        params: { start_date: periodRange.start_date, end_date: periodRange.end_date },
      }),
      api.get('/seller/bilan-individuel/all'),
    ]).then(([entriesRes, bilansRes]) => {
      if (cancelled) return;
      const data = entriesRes.data;
      const entries = Array.isArray(data) ? data : (data?.items ?? []);
      setPeriodEntries(entries.sort((a, b) => new Date(a.date) - new Date(b.date)));
      const bilans = Array.isArray(bilansRes.data?.bilans) ? bilansRes.data.bilans : [];
      const existing = bilans.find(b =>
        b.period_start === periodRange.start_date && b.period_end === periodRange.end_date
      );
      setPeriodBilan(existing
        ? { ...existing, periode: periodRange.label }
        : { periode: periodRange.label, synthese: '', points_forts: [], points_attention: [], recommandations: [] }
      );
    }).catch(err => {
      logger.error('Error fetching period data:', err);
    }).finally(() => {
      if (!cancelled) setPeriodLoading(false);
    });
    return () => { cancelled = true; };
  }, [isOpen, viewMode, periodRange?.start_date, periodRange?.end_date]);

  // Aggregated KPIs for period view
  const periodAggregates = useMemo(() => {
    if (!periodEntries.length) return null;
    let ca = 0, ventes = 0, articles = 0, prospects = 0;
    for (const e of periodEntries) {
      ca += e.ca_journalier || 0;
      ventes += e.nb_ventes || 0;
      articles += e.nb_articles || 0;
      prospects += e.nb_prospects || 0;
    }
    return {
      ca, ventes, articles, prospects,
      days: periodEntries.length,
      panier_moyen: ventes > 0 ? ca / ventes : 0,
      taux_transfo: prospects > 0 ? (ventes / prospects) * 100 : 0,
      indice_vente: ventes > 0 ? articles / ventes : 0,
    };
  }, [periodEntries]);

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

  // Generate AI bilan for 30j / mois views
  const generatePeriodBilan = async () => {
    if (!periodRange) return;
    setPeriodGenerating(true);
    try {
      await api.post(`/seller/bilan-individuel?start_date=${periodRange.start_date}&end_date=${periodRange.end_date}`, {});
      const res = await api.get('/seller/bilan-individuel/all');
      const bilans = Array.isArray(res.data?.bilans) ? res.data.bilans : [];
      const existing = bilans.find(b =>
        b.period_start === periodRange.start_date && b.period_end === periodRange.end_date
      );
      setPeriodBilan(existing
        ? { ...existing, periode: periodRange.label }
        : { periode: periodRange.label, synthese: '', points_forts: [], points_attention: [], recommandations: [] }
      );
      toast.success('✨ Bilan généré avec succès');
    } catch (err) {
      logger.error('Error generating period bilan:', err);
      toast.error('Erreur lors de la génération du bilan');
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

  if (!isOpen) return null;

  // Prepare chart data from KPI entries for current week
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
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import('jspdf'),
        import('html2canvas'),
      ]);

      await new Promise(resolve => setTimeout(resolve, 150));

      const canvas = await html2canvas(contentRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
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
          
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = imgWidth;
          tempCanvas.height = sh;
          const tempCtx = tempCanvas.getContext('2d');
          tempCtx.drawImage(canvas, 0, sy, imgWidth, sh, 0, 0, imgWidth, sh);
          
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
                onClick={() => setActiveTab('kpi')}
                className={`px-4 py-2 text-sm font-semibold transition-all rounded-t-lg ${
                  activeTab === 'kpi'
                    ? 'bg-orange-300 text-gray-800 shadow-md border-b-4 border-orange-500'
                    : 'text-gray-600 hover:text-orange-600 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center justify-center gap-1.5">
                  <BarChart3 className="w-4 h-4" />
                  <span>Historique ({kpiEntries?.length || 0})</span>
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
            <div>
              {/* Barre d'action */}
              <div className="px-4 py-3 bg-gray-50 border-b space-y-3">
                {/* Ligne 1 : sélecteur de vue + boutons */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  {/* Sélecteur de période */}
                  <div className="flex gap-1 bg-gray-200 rounded-lg p-1">
                    {[
                      { id: 'semaine', label: '📅 Semaine' },
                      { id: '30j', label: '📆 30 jours' },
                      { id: 'mois', label: '🗓️ Mois' },
                    ].map(({ id, label }) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setViewMode(id)}
                        className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-all ${
                          viewMode === id
                            ? 'bg-white text-gray-800 shadow'
                            : 'text-gray-600 hover:text-gray-800'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {/* Boutons IA + PDF */}
                  <div className="flex flex-wrap gap-2">
                    {viewMode === 'semaine' && onRegenerate && (
                      <button
                        onClick={onRegenerate}
                        disabled={generatingBilan}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition flex items-center gap-2 disabled:opacity-50"
                      >
                        <TrendingUp className={`w-4 h-4 ${generatingBilan ? 'animate-spin' : ''}`} />
                        <span>{generatingBilan ? 'Génération...' : (bilanData?.synthese ? 'Regénérer' : 'Générer')}</span>
                      </button>
                    )}
                    {viewMode !== 'semaine' && (
                      <button
                        onClick={generatePeriodBilan}
                        disabled={periodGenerating || periodLoading}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition flex items-center gap-2 disabled:opacity-50"
                      >
                        <TrendingUp className={`w-4 h-4 ${periodGenerating ? 'animate-spin' : ''}`} />
                        <span>{periodGenerating ? 'Génération...' : (periodBilan?.synthese ? 'Regénérer' : 'Générer IA')}</span>
                      </button>
                    )}
                    <button
                      onClick={exportToPDF}
                      disabled={exportingPDF}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition flex items-center gap-2 disabled:opacity-50"
                    >
                      <Download className={`w-4 h-4 ${exportingPDF ? 'animate-bounce' : ''}`} />
                      <span>{exportingPDF ? 'Export...' : 'PDF'}</span>
                    </button>
                  </div>
                </div>

                {/* Ligne 2 : navigation temporelle */}
                {viewMode === 'semaine' && onWeekChange && (
                  <div className="flex items-center gap-1 bg-gray-200 rounded-lg px-2 py-2 w-full md:w-auto justify-center">
                    <button
                      onClick={() => onWeekChange(currentWeekOffset - 1)}
                      className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded transition flex-shrink-0"
                      title="Semaine précédente"
                    >
                      <ChevronLeft className="w-4 h-4 text-white" />
                    </button>
                    <span className="text-xs font-semibold text-gray-700 px-1 min-w-0 text-center flex-1 truncate">
                      {bilanData?.periode || (currentWeekOffset === 0 ? 'Sem. actuelle' : 'Semaines')}
                    </span>
                    <button
                      onClick={() => onWeekChange(currentWeekOffset + 1)}
                      disabled={currentWeekOffset === 0}
                      className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded transition disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
                      title="Semaine suivante"
                    >
                      <ChevronRight className="w-4 h-4 text-white" />
                    </button>
                  </div>
                )}
                {viewMode === 'mois' && (
                  <div className="flex items-center gap-1 bg-gray-200 rounded-lg px-2 py-2 w-full md:w-auto justify-center">
                    <button
                      onClick={() => setMonthOffset(o => o - 1)}
                      className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded transition flex-shrink-0"
                      title="Mois précédent"
                    >
                      <ChevronLeft className="w-4 h-4 text-white" />
                    </button>
                    <span className="text-xs font-semibold text-gray-700 px-2 text-center min-w-[120px]">
                      {periodRange?.label}
                    </span>
                    <button
                      onClick={() => setMonthOffset(o => o + 1)}
                      disabled={monthOffset === 0}
                      className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded transition disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
                      title="Mois suivant"
                    >
                      <ChevronRight className="w-4 h-4 text-white" />
                    </button>
                  </div>
                )}
                {viewMode === '30j' && (
                  <div className="text-xs text-gray-500 font-medium">
                    📆 Du {periodRange?.start_date} au {periodRange?.end_date}
                  </div>
                )}
              </div>

              {/* Contenu scrollable */}
              <div ref={contentRef} data-pdf-content className="p-6">

                {/* === VUES 30 JOURS ET MOIS === */}
                {viewMode !== 'semaine' && (
                  periodLoading ? (
                    <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                      <div className="w-10 h-10 border-4 border-orange-400 border-t-transparent rounded-full animate-spin mb-4" />
                      <p>Chargement des données...</p>
                    </div>
                  ) : periodAggregates ? (
                    <>
                      {/* Titre période */}
                      <div className="flex items-center gap-2 mb-4">
                        <BarChart3 className="w-5 h-5 text-orange-600" />
                        <h3 className="font-bold text-gray-800">{periodRange?.label} — {periodAggregates.days} jour{periodAggregates.days > 1 ? 's' : ''} avec données</h3>
                      </div>

                      {/* KPI Agrégés */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                        {kpiConfig?.track_ca && (
                          <div className="bg-blue-50 rounded-lg p-3">
                            <p className="text-xs text-blue-600 mb-1">💰 CA total</p>
                            <p className="text-lg font-bold text-blue-900">{periodAggregates.ca.toFixed(0)}€</p>
                          </div>
                        )}
                        {kpiConfig?.track_ventes && (
                          <div className="bg-green-50 rounded-lg p-3">
                            <p className="text-xs text-green-600 mb-1">🛒 Ventes</p>
                            <p className="text-lg font-bold text-green-900">{periodAggregates.ventes}</p>
                          </div>
                        )}
                        {kpiConfig?.track_articles && (
                          <div className="bg-orange-50 rounded-lg p-3">
                            <p className="text-xs text-orange-600 mb-1">📦 Articles</p>
                            <p className="text-lg font-bold text-orange-900">{periodAggregates.articles}</p>
                          </div>
                        )}
                        {kpiConfig?.track_prospects && (
                          <div className="bg-purple-50 rounded-lg p-3">
                            <p className="text-xs text-purple-600 mb-1">🚶 Prospects</p>
                            <p className="text-lg font-bold text-purple-900">{periodAggregates.prospects}</p>
                          </div>
                        )}
                        {kpiConfig?.track_ca && kpiConfig?.track_ventes && periodAggregates.panier_moyen > 0 && (
                          <div className="bg-indigo-50 rounded-lg p-3">
                            <p className="text-xs text-indigo-600 mb-1">💳 Panier moyen</p>
                            <p className="text-lg font-bold text-indigo-900">{periodAggregates.panier_moyen.toFixed(0)}€</p>
                          </div>
                        )}
                        {kpiConfig?.track_ventes && kpiConfig?.track_prospects && periodAggregates.taux_transfo > 0 && (
                          <div className="bg-pink-50 rounded-lg p-3">
                            <p className="text-xs text-pink-600 mb-1">📈 Taux transfo</p>
                            <p className="text-lg font-bold text-pink-900">{periodAggregates.taux_transfo.toFixed(1)}%</p>
                          </div>
                        )}
                        {kpiConfig?.track_articles && kpiConfig?.track_ventes && periodAggregates.indice_vente > 0 && (
                          <div className="bg-teal-50 rounded-lg p-3">
                            <p className="text-xs text-teal-600 mb-1">🎯 Indice vente</p>
                            <p className="text-lg font-bold text-teal-900">{periodAggregates.indice_vente.toFixed(2)}</p>
                          </div>
                        )}
                      </div>

                      {/* Graphiques période */}
                      {periodChartData.length > 0 && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          {kpiConfig?.track_ca && (
                            <div className="bg-blue-50 rounded-xl p-4">
                              <h4 className="text-sm font-semibold text-blue-900 mb-3">💰 Évolution du CA</h4>
                              <ResponsiveContainer width="100%" height={180}>
                                <LineChart data={periodChartData}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" />
                                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#1e40af' }} stroke="#3b82f6" />
                                  <YAxis tick={{ fontSize: 10, fill: '#1e40af' }} stroke="#3b82f6" />
                                  <Tooltip contentStyle={{ backgroundColor: '#eff6ff', border: '2px solid #3b82f6', borderRadius: '8px' }} />
                                  <Line type="monotone" dataKey="CA" stroke="#3b82f6" strokeWidth={2} dot={false} />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          )}
                          {kpiConfig?.track_ventes && (
                            <div className="bg-green-50 rounded-xl p-4">
                              <h4 className="text-sm font-semibold text-green-900 mb-3">🛒 Évolution des Ventes</h4>
                              <ResponsiveContainer width="100%" height={180}>
                                <BarChart data={periodChartData}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#d1fae5" />
                                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#065f46' }} stroke="#10b981" />
                                  <YAxis tick={{ fontSize: 10, fill: '#065f46' }} stroke="#10b981" />
                                  <Tooltip contentStyle={{ backgroundColor: '#d1fae5', border: '2px solid #10b981', borderRadius: '8px' }} />
                                  <Bar dataKey="Ventes" fill="#10b981" radius={[4, 4, 0, 0]} />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          )}
                          {kpiConfig?.track_articles && (
                            <div className="bg-orange-50 rounded-xl p-4">
                              <h4 className="text-sm font-semibold text-orange-900 mb-3">📦 Évolution des Articles</h4>
                              <ResponsiveContainer width="100%" height={180}>
                                <BarChart data={periodChartData}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#fed7aa" />
                                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9a3412' }} stroke="#f97316" />
                                  <YAxis tick={{ fontSize: 10, fill: '#9a3412' }} stroke="#f97316" />
                                  <Tooltip contentStyle={{ backgroundColor: '#ffedd5', border: '2px solid #f97316', borderRadius: '8px' }} />
                                  <Bar dataKey="Articles" fill="#f97316" radius={[4, 4, 0, 0]} />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          )}
                          {kpiConfig?.track_prospects && (
                            <div className="bg-purple-50 rounded-xl p-4">
                              <h4 className="text-sm font-semibold text-purple-900 mb-3">🚶 Évolution des Prospects</h4>
                              <ResponsiveContainer width="100%" height={180}>
                                <LineChart data={periodChartData}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#e9d5ff" />
                                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#581c87' }} stroke="#a855f7" />
                                  <YAxis tick={{ fontSize: 10, fill: '#581c87' }} stroke="#a855f7" />
                                  <Tooltip contentStyle={{ backgroundColor: '#f3e8ff', border: '2px solid #a855f7', borderRadius: '8px' }} />
                                  <Line type="monotone" dataKey="Prospects" stroke="#a855f7" strokeWidth={2} dot={false} />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Section IA pour la période */}
                      <div className="mt-6">
                        {periodGenerating && (
                          <div className="bg-white rounded-2xl p-8 max-w-md mx-auto shadow-2xl border-2 border-blue-200">
                            <div className="text-center mb-6">
                              <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center animate-pulse">
                                <Sparkles className="w-8 h-8 text-white" />
                              </div>
                              <h3 className="text-xl font-bold text-gray-800 mb-2">Analyse en cours...</h3>
                              <p className="text-gray-600 text-sm">L'IA analyse vos performances sur {periodRange?.label}</p>
                            </div>
                            <div className="relative w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-500" style={{ animation: 'progress-slide 2s ease-in-out infinite', backgroundSize: '200% 100%' }} />
                            </div>
                          </div>
                        )}

                        {periodBilan?.synthese && !periodGenerating && (
                          <div className="space-y-4">
                            <div className="bg-blue-50 rounded-xl p-4 border-l-4 border-blue-500">
                              <div className="flex items-start gap-2 mb-2">
                                <Sparkles className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                                <h3 className="font-bold text-blue-900">💡 Synthèse — {periodBilan.periode}</h3>
                              </div>
                              <p className="text-gray-700 leading-relaxed">{periodBilan.synthese}</p>
                            </div>
                            {periodBilan.points_forts?.length > 0 && (
                              <div className="bg-green-50 rounded-xl p-4 border-l-4 border-green-500">
                                <div className="flex items-center gap-2 mb-3">
                                  <TrendingUp className="w-5 h-5 text-green-600" />
                                  <h3 className="font-bold text-green-900">👍 Points forts</h3>
                                </div>
                                <ul className="space-y-2">
                                  {periodBilan.points_forts.map((p, i) => (
                                    <li key={i} className="flex items-start gap-2">
                                      <span className="text-green-600 mt-1">✓</span>
                                      <span className="text-gray-700">{p}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {periodBilan.points_attention?.length > 0 && (
                              <div className="bg-orange-50 rounded-xl p-4 border-l-4 border-orange-500">
                                <div className="flex items-center gap-2 mb-3">
                                  <AlertTriangle className="w-5 h-5 text-orange-600" />
                                  <h3 className="font-bold text-orange-900">⚠️ Points à améliorer</h3>
                                </div>
                                <ul className="space-y-2">
                                  {periodBilan.points_attention.map((p, i) => (
                                    <li key={i} className="flex items-start gap-2">
                                      <span className="text-orange-600 mt-1">!</span>
                                      <span className="text-gray-700">{p}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {periodBilan.recommandations?.length > 0 && (
                              <div className="bg-indigo-50 rounded-xl p-4 border-l-4 border-indigo-500">
                                <div className="flex items-center gap-2 mb-3">
                                  <Target className="w-5 h-5 text-indigo-600" />
                                  <h3 className="font-bold text-indigo-900">🎯 Recommandations</h3>
                                </div>
                                <ol className="space-y-2 list-decimal list-inside">
                                  {periodBilan.recommandations.map((r, i) => (
                                    <li key={i} className="text-gray-700">{r}</li>
                                  ))}
                                </ol>
                              </div>
                            )}
                          </div>
                        )}

                        {!periodBilan?.synthese && !periodGenerating && (
                          <div className="text-center py-8 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                            <Sparkles className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                            <p className="text-gray-600 mb-4">Aucune analyse IA pour cette période</p>
                            <button
                              onClick={generatePeriodBilan}
                              disabled={periodLoading}
                              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50"
                            >
                              ✨ Générer l'analyse IA
                            </button>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                      <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-600">Aucune donnée saisie pour cette période</p>
                    </div>
                  )
                )}

                {/* === VUE SEMAINE (comportement actuel) === */}
                {viewMode === 'semaine' && bilanData ? (
                  <>
                    {/* KPI Summary */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                      {bilanData.kpi_resume?.ca_total !== undefined && (
                        <div className="bg-blue-50 rounded-lg p-3">
                          <p className="text-xs text-blue-600 mb-1">💰 CA</p>
                          <p className="text-lg font-bold text-blue-900">{bilanData.kpi_resume.ca_total.toFixed(0)}€</p>
                        </div>
                      )}
                      {bilanData.kpi_resume?.ventes !== undefined && (
                        <div className="bg-green-50 rounded-lg p-3">
                          <p className="text-xs text-green-600 mb-1">🛒 Ventes</p>
                          <p className="text-lg font-bold text-green-900">{bilanData.kpi_resume.ventes}</p>
                        </div>
                      )}
                      {bilanData.kpi_resume?.articles !== undefined && (
                        <div className="bg-orange-50 rounded-lg p-3">
                          <p className="text-xs text-orange-600 mb-1">📦 Articles</p>
                          <p className="text-lg font-bold text-orange-900">{bilanData.kpi_resume.articles}</p>
                        </div>
                      )}
                      {bilanData.kpi_resume?.panier_moyen !== undefined && (
                        <div className="bg-indigo-50 rounded-lg p-3">
                          <p className="text-xs text-indigo-600 mb-1">💳 P. Moyen</p>
                          <p className="text-lg font-bold text-indigo-900">{bilanData.kpi_resume.panier_moyen.toFixed(0)}€</p>
                        </div>
                      )}
                    </div>

                    {/* Charts */}
                    {chartData && chartData.length > 0 && (
                      <div className="mb-6">
                        <div className="flex items-center gap-2 mb-4">
                          <BarChart3 className="w-5 h-5 text-blue-600" />
                          <h3 className="font-bold text-gray-800">📊 Évolution de la semaine</h3>
                        </div>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          {chartData.some(d => d.CA !== undefined) && (
                            <div className="bg-blue-50 rounded-xl p-4">
                              <h4 className="text-sm font-semibold text-blue-900 mb-3">💰 Évolution du CA</h4>
                              <ResponsiveContainer width="100%" height={180}>
                                <LineChart data={chartData}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" />
                                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#1e40af' }} stroke="#3b82f6" />
                                  <YAxis tick={{ fontSize: 11, fill: '#1e40af' }} stroke="#3b82f6" />
                                  <Tooltip contentStyle={{ backgroundColor: '#eff6ff', border: '2px solid #3b82f6', borderRadius: '8px' }} />
                                  <Line type="monotone" dataKey="CA" stroke="#3b82f6" strokeWidth={3} dot={{ fill: '#1e40af', r: 4 }} />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          )}
                          
                          {chartData.some(d => d.Ventes !== undefined) && (
                            <div className="bg-green-50 rounded-xl p-4">
                              <h4 className="text-sm font-semibold text-green-900 mb-3">🛒 Évolution des Ventes</h4>
                              <ResponsiveContainer width="100%" height={180}>
                                <BarChart data={chartData}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#d1fae5" />
                                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#065f46' }} stroke="#10b981" />
                                  <YAxis tick={{ fontSize: 11, fill: '#065f46' }} stroke="#10b981" />
                                  <Tooltip contentStyle={{ backgroundColor: '#d1fae5', border: '2px solid #10b981', borderRadius: '8px' }} />
                                  <Bar dataKey="Ventes" fill="#10b981" radius={[8, 8, 0, 0]} />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          )}
                          
                          {chartData.some(d => d.Articles !== undefined) && (
                            <div className="bg-orange-50 rounded-xl p-4">
                              <h4 className="text-sm font-semibold text-orange-900 mb-3">📦 Évolution des Articles</h4>
                              <ResponsiveContainer width="100%" height={180}>
                                <BarChart data={chartData}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#fed7aa" />
                                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9a3412' }} stroke="#f97316" />
                                  <YAxis tick={{ fontSize: 11, fill: '#9a3412' }} stroke="#f97316" />
                                  <Tooltip contentStyle={{ backgroundColor: '#ffedd5', border: '2px solid #f97316', borderRadius: '8px' }} />
                                  <Bar dataKey="Articles" fill="#f97316" radius={[8, 8, 0, 0]} />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          )}
                          
                          {chartData.some(d => d.Prospects !== undefined) && (
                            <div className="bg-purple-50 rounded-xl p-4">
                              <h4 className="text-sm font-semibold text-purple-900 mb-3">🚶 Évolution des Prospects</h4>
                              <ResponsiveContainer width="100%" height={180}>
                                <LineChart data={chartData}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#e9d5ff" />
                                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#581c87' }} stroke="#a855f7" />
                                  <YAxis tick={{ fontSize: 11, fill: '#581c87' }} stroke="#a855f7" />
                                  <Tooltip contentStyle={{ backgroundColor: '#f3e8ff', border: '2px solid #a855f7', borderRadius: '8px' }} />
                                  <Line type="monotone" dataKey="Prospects" stroke="#a855f7" strokeWidth={3} dot={{ fill: '#7c3aed', r: 4 }} />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Animation de génération élaborée */}
                    {generatingBilan && (
                      <div className="bg-white rounded-2xl p-8 max-w-md mx-auto shadow-2xl border-2 border-blue-200">
                        <div className="text-center mb-6">
                          <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center animate-pulse">
                            <Sparkles className="w-10 h-10 text-white" />
                          </div>
                          <h3 className="text-2xl font-bold text-gray-800 mb-2">
                            Analyse en cours...
                          </h3>
                          <p className="text-gray-600">
                            L'IA analyse vos performances de la semaine et prépare votre bilan personnalisé
                          </p>
                        </div>
                        
                        {/* Progress Bar */}
                        <div className="relative w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className="absolute inset-0 bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-500" 
                            style={{
                              animation: 'progress-slide 2s ease-in-out infinite',
                              backgroundSize: '200% 100%'
                            }}
                          ></div>
                        </div>
                        
                        <div className="mt-4 text-center text-sm text-gray-500">
                          <p>⏱️ Temps estimé : 30-60 secondes</p>
                        </div>
                      </div>
                    )}

                    {/* Analyse IA */}
                    {bilanData.synthese && !generatingBilan && (
                      <div ref={bilanSectionRef} className="space-y-4">
                        <div className="bg-blue-50 rounded-xl p-4 border-l-4 border-blue-500">
                          <div className="flex items-start gap-2 mb-2">
                            <Sparkles className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                            <h3 className="font-bold text-blue-900">💡 Synthèse de la semaine</h3>
                          </div>
                          <p className="text-gray-700 leading-relaxed">{bilanData.synthese}</p>
                        </div>

                        {bilanData.points_forts && bilanData.points_forts.length > 0 && (
                          <div className="bg-green-50 rounded-xl p-4 border-l-4 border-green-500">
                            <div className="flex items-center gap-2 mb-3">
                              <TrendingUp className="w-5 h-5 text-green-600" />
                              <h3 className="font-bold text-green-900">👍 Tes points forts</h3>
                            </div>
                            <ul className="space-y-2">
                              {bilanData.points_forts.map((point, idx) => (
                                <li key={idx} className="flex items-start gap-2">
                                  <span className="text-green-600 mt-1">✓</span>
                                  <span className="text-gray-700">{point}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {bilanData.points_attention && bilanData.points_attention.length > 0 && (
                          <div className="bg-orange-50 rounded-xl p-4 border-l-4 border-orange-500">
                            <div className="flex items-center gap-2 mb-3">
                              <AlertTriangle className="w-5 h-5 text-orange-600" />
                              <h3 className="font-bold text-orange-900">⚠️ Points à améliorer</h3>
                            </div>
                            <ul className="space-y-2">
                              {bilanData.points_attention.map((point, idx) => (
                                <li key={idx} className="flex items-start gap-2">
                                  <span className="text-orange-600 mt-1">!</span>
                                  <span className="text-gray-700">{point}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {bilanData.recommandations && bilanData.recommandations.length > 0 && (
                          <div className="bg-indigo-50 rounded-xl p-4 border-l-4 border-indigo-500">
                            <div className="flex items-center gap-2 mb-3">
                              <Target className="w-5 h-5 text-indigo-600" />
                              <h3 className="font-bold text-indigo-900">🎯 Recommandations personnalisées</h3>
                            </div>
                            <ol className="space-y-2 list-decimal list-inside">
                              {bilanData.recommandations.map((reco, idx) => (
                                <li key={idx} className="text-gray-700">{reco}</li>
                              ))}
                            </ol>
                          </div>
                        )}
                      </div>
                    )}

                    {!bilanData.synthese && !generatingBilan && (
                      <div className="text-center py-8 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                        <Sparkles className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                        <p className="text-gray-600 mb-4">Aucune analyse IA disponible pour cette semaine</p>
                        {onRegenerate && (
                          <button
                            onClick={onRegenerate}
                            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-md hover:shadow-lg"
                          >
                            ✨ Générer l'analyse IA
                          </button>
                        )}
                      </div>
                    )}
                  </>
                ) : viewMode === 'semaine' ? (
                  <div className="text-center py-8 text-gray-500">
                    <p>Aucun bilan disponible</p>
                  </div>
                ) : null}
              </div>
            </div>
          )}
          
          {activeTab === 'kpi' && (
            <div>
              {/* Contenu avec padding */}
              {kpiEntries && kpiEntries.length > 0 ? (
                <div className="px-6">
                  <div className="space-y-4">
                    {kpiEntries.slice(0, displayedKpiCount).map((entry, index) => {
                      // Calculate days difference
                      const entryDate = new Date(entry.date);
                      const today = new Date();
                      const diffTime = today - entryDate;
                      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                      
                      // Format date to DD/MM/YYYY
                      const formatDate = (dateString) => {
                        const date = new Date(dateString);
                        const day = String(date.getDate()).padStart(2, '0');
                        const month = String(date.getMonth() + 1).padStart(2, '0');
                        const year = date.getFullYear();
                        return `${day}/${month}/${year}`;
                      };
                      
                      return (
                        <div 
                          key={index} 
                          onClick={() => {
                            // Charger les données dans le formulaire de saisie
                            setEditingEntry(entry);
                            setActiveTab('saisie');
                          }}
                          className="bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer"
                        >
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-semibold text-gray-800">{formatDate(entry.date)}</span>
                            <span className="text-xs text-blue-600 font-medium">
                              ✏️ Cliquer pour modifier
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            {/* Affichage dynamique selon les données effectivement saisies */}
                            {entry.ca_journalier !== undefined && entry.ca_journalier !== null && (
                              <div>💰 CA: {entry.ca_journalier}€</div>
                            )}
                            {entry.nb_ventes !== undefined && entry.nb_ventes !== null && (
                              <div>🛒 Ventes: {entry.nb_ventes}</div>
                            )}
                            {entry.nb_articles !== undefined && entry.nb_articles !== null && (
                              <div>📦 Articles: {entry.nb_articles}</div>
                            )}
                            {entry.nb_prospects !== undefined && entry.nb_prospects !== null && (
                              <div>🚶 Prospects: {entry.nb_prospects}</div>
                            )}
                            {/* Message si aucune donnée */}
                            {!entry.ca_journalier && !entry.nb_ventes && !entry.nb_articles && !entry.nb_prospects && (
                              <div className="col-span-2 text-gray-500 italic">Aucune donnée saisie</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Bouton Charger plus */}
                  {(displayedKpiCount < kpiEntries.length || kpiEntries.length < (kpiEntriesTotal ?? kpiEntries.length)) && (
                    <div className="mt-6 text-center">
                      <button
                        onClick={async () => {
                          if (displayedKpiCount < kpiEntries.length) {
                            setDisplayedKpiCount(prev => prev + 20);
                          } else if (onLoadMoreKpi) {
                            await onLoadMoreKpi();
                            setDisplayedKpiCount(prev => prev + 20);
                          }
                        }}
                        className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
                      >
                        Charger plus
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="px-6">
                  <p className="text-gray-500">Aucun KPI enregistré pour le moment.</p>
                </div>
              )}
            </div>
          )}

          {/* Onglet Saisie KPI */}
          {activeTab === 'saisie' && (
            <div className="px-6 py-6">
              <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl p-6 border-2 border-orange-200 mb-6">
                <h3 className="text-xl font-bold text-gray-800 mb-2 flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-orange-600" />
                  {editingEntry ? 'Modifier mes chiffres' : 'Saisir mes chiffres du jour'}
                </h3>
                <p className="text-sm text-gray-600">
                  {editingEntry 
                    ? `Modification des données du ${formatDate(editingEntry.date)}`
                    : 'Renseignez vos données quotidiennes. Vous pourrez les corriger à tout moment depuis l\'onglet "Historique".'
                  }
                </p>
              </div>

              {/* Message de feedback */}
              {saveMessage && (
                <div className={`mb-4 p-4 rounded-lg border-2 ${
                  saveMessage.type === 'success' 
                    ? 'bg-green-50 border-green-400 text-green-800' 
                    : 'bg-red-50 border-red-400 text-red-800'
                }`}>
                  <p className="font-semibold">{saveMessage.text}</p>
                </div>
              )}

              {/* Formulaire de saisie */}
              <div className="bg-white rounded-xl p-6 border-2 border-gray-200 shadow-sm">
                <form onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.target);
                  const data = {
                    date: formData.get('date'),
                    ca_journalier: kpiConfig?.track_ca ? (Number.parseFloat(formData.get('ca_journalier')) || 0) : 0,
                    nb_ventes: kpiConfig?.track_ventes ? (parseInt(formData.get('nb_ventes')) || 0) : 0,
                    nb_articles: kpiConfig?.track_articles ? (parseInt(formData.get('nb_articles')) || 0) : 0,
                    nb_prospects: kpiConfig?.track_prospects ? (parseInt(formData.get('nb_prospects')) || 0) : 0
                  };
                  
                  // Sauvegarde directe sans ouvrir de modal
                  handleDirectSaveKPI(data);
                }} className="space-y-6">
                  {/* Sélecteur de date */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      📅 Date
                    </label>
                    <input
                      type="date"
                      name="date"
                      defaultValue={editingEntry?.date || new Date().toISOString().split('T')[0]}
                      max={new Date().toISOString().split('T')[0]}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-gray-800 font-medium"
                      required
                      readOnly={!!editingEntry}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {editingEntry 
                        ? 'La date ne peut pas être modifiée'
                        : 'Sélectionnez le jour pour lequel vous souhaitez saisir vos données'
                      }
                    </p>
                  </div>

                  {/* KPIs en grille - Affichage basé sur track_* (déjà mappé depuis seller_track_* par le backend) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* CA - Affiché uniquement si seller_track_ca = true */}
                    {kpiConfig?.track_ca && (
                      <div className="bg-orange-50 rounded-lg p-4 border-2 border-orange-200">
                        <label className="block text-sm font-semibold text-orange-900 mb-2">
                          💰 Chiffre d'Affaires (€)
                        </label>
                        <input
                          type="number"
                          name="ca_journalier"
                          step="0.01"
                          min="0"
                          defaultValue={editingEntry?.ca_journalier || ''}
                          placeholder="Ex: 1250.50"
                          className="w-full px-4 py-2 border-2 border-orange-300 rounded-lg focus:border-orange-500 focus:outline-none"
                        />
                      </div>
                    )}

                    {/* Ventes - Affiché uniquement si seller_track_ventes = true */}
                    {kpiConfig?.track_ventes && (
                      <div className="bg-green-50 rounded-lg p-4 border-2 border-green-200">
                        <label className="block text-sm font-semibold text-green-900 mb-2">
                          🛒 Nombre de Ventes
                        </label>
                        <input
                          type="number"
                          name="nb_ventes"
                          min="0"
                          defaultValue={editingEntry?.nb_ventes || ''}
                          placeholder="Ex: 15"
                          className="w-full px-4 py-2 border-2 border-green-300 rounded-lg focus:border-green-500 focus:outline-none"
                        />
                      </div>
                    )}

                    {/* Articles - Affiché uniquement si seller_track_articles = true */}
                    {kpiConfig?.track_articles && (
                      <div className="bg-blue-50 rounded-lg p-4 border-2 border-blue-200">
                        <label className="block text-sm font-semibold text-blue-900 mb-2">
                          📦 Nombre d'Articles
                        </label>
                        <input
                          type="number"
                          name="nb_articles"
                          min="0"
                          defaultValue={editingEntry?.nb_articles || ''}
                          placeholder="Ex: 20"
                          className="w-full px-4 py-2 border-2 border-blue-300 rounded-lg focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                    )}

                    {/* Prospects - Affiché uniquement si seller_track_prospects = true */}
                    {kpiConfig?.track_prospects && (
                      <div className="bg-purple-50 rounded-lg p-4 border-2 border-purple-200">
                        <label className="block text-sm font-semibold text-purple-900 mb-2">
                          🚶 Nombre de Prospects
                        </label>
                        <input
                          type="number"
                          name="nb_prospects"
                          min="0"
                          defaultValue={editingEntry?.nb_prospects || ''}
                          placeholder="Ex: 30"
                          className="w-full px-4 py-2 border-2 border-purple-300 rounded-lg focus:border-purple-500 focus:outline-none"
                        />
                      </div>
                    )}
                  </div>

                  {/* Boutons d'action */}
                  <div className="flex gap-3 pt-4">
                    {editingEntry && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingEntry(null);
                          setActiveTab('kpi');
                        }}
                        className="px-6 py-3 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-all"
                      >
                        ❌ Annuler
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={savingKPI}
                      className={`flex-1 px-6 py-3 bg-gradient-to-r from-orange-600 to-amber-600 text-white font-semibold rounded-lg transition-all shadow-md hover:shadow-lg ${
                        savingKPI 
                          ? 'opacity-50 cursor-not-allowed' 
                          : 'hover:from-orange-700 hover:to-amber-700'
                      }`}
                    >
                      {savingKPI 
                        ? '⏳ Enregistrement...' 
                        : editingEntry 
                        ? '💾 Enregistrer les modifications' 
                        : '💾 Enregistrer mes chiffres'
                      }
                    </button>
                    {!editingEntry && (
                      <button
                        type="button"
                        onClick={() => setActiveTab('kpi')}
                        className="px-6 py-3 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-all"
                      >
                        📊 Voir l'historique
                      </button>
                    )}
                  </div>
                </form>
              </div>

              {/* Aide et conseils */}
              <div className="mt-6 bg-orange-50 rounded-lg p-4 border-l-4 border-orange-400">
                <div className="flex items-start gap-3">
                  <Sparkles className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-orange-900 mb-1">💡 Astuce</p>
                    <p className="text-sm text-orange-800">
                      Saisissez vos chiffres chaque jour pour suivre vos progrès ! 
                      Pour corriger une saisie, allez dans l'onglet "Historique" et cliquez sur la journée à modifier.
                    </p>
                  </div>
                </div>
              </div>
            </div>
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
