import React, { useState, useEffect, useRef, startTransition } from 'react';
import { api } from '../lib/apiClient';
import { LABEL_DECOUVERTE } from '../lib/constants';
import { logger } from '../utils/logger';
import { getSubscriptionErrorMessage } from '../utils/apiHelpers';
import { useAuth } from '../contexts';
import { X, Users, TrendingUp, Target, Award, AlertCircle, Info, Archive, RefreshCw, FileText, Coffee } from 'lucide-react';
import { toast } from 'sonner';
import ManagerAIAnalysisDisplay from './ManagerAIAnalysisDisplay';
import EvaluationGenerator from './EvaluationGenerator';
import MorningBriefModal from './MorningBriefModal';
import SellersTableSection from './teamModal/SellersTableSection';
import ChartsSection from './teamModal/ChartsSection';

// Utility function to format numbers with spaces for thousands
const formatNumber = (num) => {
  if (!num && num !== 0) return '0';
  return Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};

// Custom compact tooltip
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/95 backdrop-blur-sm border border-gray-300 rounded-lg shadow-lg p-2 text-xs">
        <p className="font-semibold text-gray-800 mb-1">{label}</p>
        {payload.map((entry, index) => (
          <p key={`tooltip-${entry.name}-${entry.value}-${index}`} style={{ color: entry.color }} className="font-medium">
            {entry.name}: {formatNumber(entry.value)}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function TeamModal({ sellers, storeIdParam, onClose, onViewSellerDetail, onDataUpdate, storeName, managerName, userRole }) {
  const { user } = useAuth();
  const [teamData, setTeamData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showMorningBriefModal, setShowMorningBriefModal] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [aiGenerating, setAiGenerating] = useState(false);
  const aiSectionRef = useRef(null);
  const [periodFilter, setPeriodFilter] = useState('30'); // '7', '30', '90', 'all', 'custom'
  const [showNiveauTooltip, setShowNiveauTooltip] = useState(false);
  const [customDateRange, setCustomDateRange] = useState({ start: '', end: '' });
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  const [chartData, setChartData] = useState([]);
  const [visibleMetrics, setVisibleMetrics] = useState({
    ca: true,
    ventes: true,
    panierMoyen: true
  });
  const [visibleSellers, setVisibleSellers] = useState({});
  const [isUpdatingCharts, setIsUpdatingCharts] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [displayedSellerCount, setDisplayedSellerCount] = useState(5);
  const [hiddenSellerIds, setHiddenSellerIds] = useState([]); // IDs des vendeurs à masquer temporairement
  const [showEvaluationModal, setShowEvaluationModal] = useState(false);
  const [selectedSellerForEval, setSelectedSellerForEval] = useState(null);
  /** Entrées KPI brutes par vendeur (réutilisées pour les graphiques pour éviter double appel API → 429) */
  const [teamKpiEntriesBySeller, setTeamKpiEntriesBySeller] = useState({});
  const isGerantWithoutStore = ['gerant', 'gérant'].includes(userRole) && !storeIdParam;

  // Initialize visible sellers only once when sellers change
  useEffect(() => {
    const initialVisibleSellers = {};
    sellers.forEach((seller, index) => {
      initialVisibleSellers[seller.id] = index < 5; // Only first 5 are visible
    });
    setVisibleSellers(initialVisibleSellers);
  }, [sellers]);

  // Fetch team data when sellers or period changes
  useEffect(() => {
    // Only fetch if:
    // - Period is not custom, OR
    // - Period is custom AND both dates are set
    if (periodFilter !== 'custom' || (periodFilter === 'custom' && customDateRange.start && customDateRange.end)) {
      fetchTeamData();
    }
  }, [sellers, periodFilter, customDateRange.start, customDateRange.end]);

  // Prepare chart data when period or cached KPI data changes (réutilise teamKpiEntriesBySeller pour éviter 429)
  useEffect(() => {
    if (Object.keys(visibleSellers).length > 0) {
      prepareChartData();
    }
  }, [periodFilter, visibleSellers, customDateRange, teamKpiEntriesBySeller]);

  const fetchTeamData = async (sellersToUse = sellers) => {
    // Only set loading on initial fetch
    if (teamData.length === 0) {
      setLoading(true);
    }
    
    try {
      const daysParam = periodFilter === 'all' ? 365 : (periodFilter === 'custom' ? 0 : parseInt(periodFilter, 10));
      const storeParam = storeIdParam ? `&store_id=${storeIdParam}` : '';
      const storeQueryParam = storeIdParam ? `?store_id=${storeIdParam}` : '';

      // 1 seul appel pour toutes les métriques équipe (N → 1)
      const teamMetricsPayload = {
        seller_ids: sellersToUse.map(s => s.id),
        days: daysParam,
        ...(periodFilter === 'custom' && customDateRange.start && customDateRange.end
          ? { start_date: customDateRange.start, end_date: customDateRange.end }
          : {}),
      };
      const teamMetricsUrl = `/manager/team/kpi-metrics${storeIdParam ? `?store_id=${storeIdParam}` : ''}`;
      const teamMetricsMap = await api.post(teamMetricsUrl, teamMetricsPayload)
        .then(r => r.data)
        .catch(err => { logger.error('team/kpi-metrics failed:', err?.response?.data || err.message); return {}; });

      // Fetch data for each seller
      const sellersDataPromises = sellersToUse.map(async (seller) => {
        try {
          // Build store_id param for gerant viewing as manager
          const storeParamFirst = storeQueryParam;

          // Build API params
          let apiParams = { _t: Date.now() };
          if (storeIdParam) {
            apiParams.store_id = storeIdParam;
          }

          let kpiUrl = `/manager/kpi-entries/${seller.id}?days=${daysParam}${storeParam}`;
          if (periodFilter === 'custom' && customDateRange.start && customDateRange.end) {
            kpiUrl = `/manager/kpi-entries/${seller.id}?start_date=${customDateRange.start}&end_date=${customDateRange.end}${storeParam}`;
          }

          const [statsRes, kpiRes, diagRes] = await Promise.all([
            api.get(`/manager/seller/${seller.id}/stats${storeParamFirst}`, {
              params: apiParams
            }),
            api.get(kpiUrl, {
              params: { _t: Date.now() }
            }),
            api.get(`/manager/seller/${seller.id}/diagnostic${storeParamFirst}`, {
              params: { _t: Date.now(), ...(storeIdParam ? { store_id: storeIdParam } : {}) }
            }).catch(() => ({ data: null })),
          ]);

          const stats = statsRes.data;
          // API manager/kpi-entries renvoie { items: [...], total, page, size, pages }
          const kpiEntries = Array.isArray(kpiRes.data?.items) ? kpiRes.data.items : (Array.isArray(kpiRes.data) ? kpiRes.data : []);
          const diagnostic = diagRes.data;
          const metricsData = teamMetricsMap[seller.id] ?? null;

          // Utilise les agrégats serveur (source de vérité) — évite la troncature de pagination
          const monthlyCA = metricsData?.ca ?? kpiEntries.reduce((sum, entry) => {
            const ca = entry.ca_journalier || entry.seller_ca || entry.ca || 0;
            return sum + (typeof ca === 'number' ? ca : 0);
          }, 0);
          const monthlyVentes = metricsData?.ventes ?? kpiEntries.reduce((sum, entry) => sum + (entry.nb_ventes || 0), 0);
          const panierMoyen = metricsData?.panier_moyen ?? (monthlyVentes > 0 ? monthlyCA / monthlyVentes : 0);
          const articles = metricsData?.articles ?? kpiEntries.reduce((sum, e) => sum + (e.nb_articles || 0), 0);
          const indice_vente = metricsData?.indice_vente ?? (monthlyVentes > 0 ? articles / monthlyVentes : 0);

          // Get competences scores
          const competences = stats.avg_radar_scores || {};
          const competencesList = [
            { name: 'Accueil', value: competences.accueil || 0 },
            { name: LABEL_DECOUVERTE, value: competences.decouverte || 0 },
            { name: 'Argumentation', value: competences.argumentation || 0 },
            { name: 'Closing', value: competences.closing || 0 },
            { name: 'Fidélisation', value: competences.fidelisation || 0 }
          ];

          const avgCompetence = competencesList.reduce((sum, c) => sum + c.value, 0) / 5;
          
          // Check if all competences have the same value
          const allSameValue = competencesList.every(c => c.value === competencesList[0].value);
          const allZero = competencesList.every(c => c.value === 0);
          
          let bestCompetence, worstCompetence;
          
          if (allZero) {
            // If all scores are 0 (no diagnostic), indicate this
            bestCompetence = { name: 'Non évalué', value: 0 };
            worstCompetence = { name: 'Non évalué', value: 0 };
          } else if (allSameValue) {
            // If all competences are equal (initial questionnaire), indicate balanced profile
            bestCompetence = { name: 'Profil équilibré', value: competencesList[0].value };
            worstCompetence = { name: 'Profil équilibré', value: competencesList[0].value };
          } else {
            // Find actual best and worst
            bestCompetence = competencesList.reduce((max, c) => c.value > max.value ? c : max);
            worstCompetence = competencesList.reduce((min, c) => c.value < min.value ? c : min);
          }

          // Determine score source for transparency
          let scoreSource = 'none';
          if (diagnostic) {
            scoreSource = 'diagnostic'; // Basé sur questionnaire initial
          }
          // Note: In future, we could check if debriefs exist to show 'diagnostic+debriefs'

          return {
            ...seller,
            monthlyCA,
            monthlyVentes,
            panierMoyen,
            articles,
            indice_vente,
            avgCompetence,
            bestCompetence,
            worstCompetence,
            lastKpiDate: kpiEntries.length > 0 ? kpiEntries[0].date : null,
            hasKpiToday: kpiEntries.some(e => e.date === new Date().toISOString().split('T')[0]),
            scoreSource,
            hasDiagnostic: !!diagnostic,
            niveau: diagnostic?.level || seller.niveau || 'Non défini',
            _kpiEntries: kpiEntries
          };
        } catch (err) {
          logger.error(`Error fetching data for seller ${seller.id}:`, err);
          return {
            ...seller,
            monthlyCA: 0,
            monthlyVentes: 0,
            panierMoyen: 0,
            avgCompetence: 0,
            bestCompetence: { name: 'N/A', value: 0 },
            worstCompetence: { name: 'N/A', value: 0 },
            lastKpiDate: null,
            hasKpiToday: false
          };
        }
      });

      const sellersData = await Promise.all(sellersDataPromises);
      const kpiBySeller = {};
      sellersData.forEach((row) => {
        if (row._kpiEntries) kpiBySeller[row.id] = row._kpiEntries;
      });
      setTeamKpiEntriesBySeller(kpiBySeller);
      setTeamData(sellersData.map(({ _kpiEntries, ...rest }) => rest));
      
      // Also refresh chart data after team data is updated
      if (Object.keys(visibleSellers).length > 0) {
        prepareChartData();
      }
    } catch (err) {
      logger.error('Error fetching team data:', err);
      toast.error('Erreur lors du chargement des données d\'équipe');
    } finally {
      setLoading(false);
    }
  };

  // Prepare chart data with aggregation

  // Fonction pour rafraîchir les données sans recharger la page
  const refreshSellersData = async () => {
    try {
      // Build store param for gerant
      const storeParam = storeIdParam ? `?store_id=${storeIdParam}` : '';
      
      // Re-fetch la liste des vendeurs actifs
      const response = await api.get(`/manager/sellers${storeParam}`);
      
      // Re-fetch les vendeurs archivés
      const archivedResponse = await api.get(`/manager/sellers/archived${storeParam}`);
      setArchivedSellers(archivedResponse.data);
      
      // IMPORTANT: Re-calculer teamData avec les nouvelles données
      await fetchTeamData(response.data);
      
      // Nettoyer visibleSellers pour ne garder que les vendeurs actifs
      const activeSellerIds = response.data.map(s => s.id);
      setVisibleSellers(prev => {
        const cleaned = {};
        Object.keys(prev).forEach(sellerId => {
          if (activeSellerIds.includes(sellerId)) {
            cleaned[sellerId] = prev[sellerId];
          }
        });
        return cleaned;
      });
    } catch (error) {
      logger.error('Erreur lors du rafraîchissement:', error);
    }
  };

  // Gérer la désactivation d'un vendeur
  // FONCTIONS RETIRÉES - Actions de suspension/suppression/réactivation RÉSERVÉES EXCLUSIVEMENT AU GÉRANT
  // handleDeactivate, handleDelete et handleReactivate ont été supprimées
  // Un Manager ne peut pas modifier le statut d'un vendeur

  const prepareChartData = async () => {
    try {
      // Réutiliser les entrées KPI déjà chargées par fetchTeamData pour éviter double appel API (429)
      const hasCachedForAll = sellers.length > 0 && sellers.every((s) => Array.isArray(teamKpiEntriesBySeller[s.id]));
      if (hasCachedForAll) {
        const dateMap = new Map();
        sellers.forEach((seller) => {
          const entries = teamKpiEntriesBySeller[seller.id] || [];
          entries.forEach((entry) => {
            const date = entry.date;
            if (!dateMap.has(date)) dateMap.set(date, { date });
            const dayData = dateMap.get(date);
            dayData[`ca_${seller.id}`] = entry.ca_journalier ?? entry.seller_ca ?? entry.ca ?? 0;
            dayData[`ventes_${seller.id}`] = entry.nb_ventes ?? 0;
            dayData[`panier_${seller.id}`] = (entry.nb_ventes > 0 && (entry.ca_journalier ?? entry.seller_ca ?? entry.ca)) ? (entry.ca_journalier ?? entry.seller_ca ?? entry.ca) / entry.nb_ventes : 0;
            dayData[`name_${seller.id}`] = seller.name;
          });
        });
        let chartArray = Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));
        if (periodFilter === '30') chartArray = aggregateByWeek(chartArray, sellers);
        else if (periodFilter === '90') chartArray = aggregateByBiWeek(chartArray, sellers);
        else if (periodFilter === 'all') chartArray = aggregateByMonth(chartArray, sellers);
        else if (periodFilter === 'custom' && customDateRange.start && customDateRange.end) {
          const start = new Date(customDateRange.start);
          const end = new Date(customDateRange.end);
          const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
          if (daysDiff > 90) chartArray = aggregateByMonth(chartArray, sellers);
          else if (daysDiff > 30) chartArray = aggregateByBiWeek(chartArray, sellers);
          else if (daysDiff > 14) chartArray = aggregateByWeek(chartArray, sellers);
        }
        setChartData(chartArray);
        return;
      }
      // Pas de cache : ne pas refaire d'appels API (fetchTeamData va remplir teamKpiEntriesBySeller)
      if (teamData.length === 0) {
        setChartData([]);
        return;
      }

      const daysParam = periodFilter === 'all' ? 365 : (periodFilter === 'custom' ? 0 : periodFilter);
      const storeParam = storeIdParam ? `&store_id=${storeIdParam}` : '';
      const chartDataPromises = sellers.map(async (seller) => {
        try {
          let url = `/manager/kpi-entries/${seller.id}?days=${daysParam}${storeParam}`;
          if (periodFilter === 'custom' && customDateRange.start && customDateRange.end) {
            url = `/manager/kpi-entries/${seller.id}?start_date=${customDateRange.start}&end_date=${customDateRange.end}${storeParam}`;
          }
          const res = await api.get(url);
          return { sellerId: seller.id, sellerName: seller.name, data: res.data };
        } catch (err) {
          return { sellerId: seller.id, sellerName: seller.name, data: [] };
        }
      });
      const sellersKpiData = await Promise.all(chartDataPromises);
      const dateMap = new Map();
      sellersKpiData.forEach(({ sellerId, sellerName, data }) => {
        const entries = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
        entries.forEach(entry => {
          const date = entry.date;
          if (!dateMap.has(date)) {
            dateMap.set(date, { date });
          }
          const dayData = dateMap.get(date);
          dayData[`ca_${sellerId}`] = entry.ca_journalier || 0;
          dayData[`ventes_${sellerId}`] = entry.nb_ventes || 0;
          dayData[`panier_${sellerId}`] = entry.nb_ventes > 0 ? (entry.ca_journalier / entry.nb_ventes) : 0;
          dayData[`name_${sellerId}`] = sellerName;
        });
      });

      // Sort by date
      let chartArray = Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));
      
      // Aggregate data based on period for better readability
      if (periodFilter === '30') {
        // Weekly aggregation for 30 days
        chartArray = aggregateByWeek(chartArray, sellers);
      } else if (periodFilter === '90') {
        // Bi-weekly aggregation for 3 months
        chartArray = aggregateByBiWeek(chartArray, sellers);
      } else if (periodFilter === 'all') {
        // Monthly aggregation for year
        chartArray = aggregateByMonth(chartArray, sellers);
      } else if (periodFilter === 'custom') {
        // Determine aggregation based on date range length
        if (customDateRange.start && customDateRange.end) {
          const start = new Date(customDateRange.start);
          const end = new Date(customDateRange.end);
          const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
          
          if (daysDiff > 90) {
            // Monthly aggregation for long periods
            chartArray = aggregateByMonth(chartArray, sellers);
          } else if (daysDiff > 30) {
            // Bi-weekly aggregation for medium periods
            chartArray = aggregateByBiWeek(chartArray, sellers);
          } else if (daysDiff > 14) {
            // Weekly aggregation for ~month periods
            chartArray = aggregateByWeek(chartArray, sellers);
          }
          // Else keep daily data for short periods
        }
      }
      
      setChartData(chartArray);
    } catch (err) {
      logger.error('Error preparing chart data:', err);
    }
  };

  // Aggregation functions
  const aggregateByWeek = (data, sellers) => {
    const weeks = new Map();
    data.forEach(day => {
      const date = new Date(day.date);
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay()); // Start of week (Sunday)
      const weekKey = weekStart.toISOString().split('T')[0];
      
      if (!weeks.has(weekKey)) {
        weeks.set(weekKey, { date: weekKey, count: 0 });
        sellers.forEach(seller => {
          weeks.get(weekKey)[`ca_${seller.id}`] = 0;
          weeks.get(weekKey)[`ventes_${seller.id}`] = 0;
          weeks.get(weekKey)[`panier_${seller.id}`] = 0;
          weeks.get(weekKey)[`name_${seller.id}`] = seller.name;
        });
      }
      
      const week = weeks.get(weekKey);
      sellers.forEach(seller => {
        week[`ca_${seller.id}`] += day[`ca_${seller.id}`] || 0;
        week[`ventes_${seller.id}`] += day[`ventes_${seller.id}`] || 0;
      });
      week.count++;
    });
    
    // Calculate average panier moyen
    weeks.forEach(week => {
      sellers.forEach(seller => {
        if (week[`ventes_${seller.id}`] > 0) {
          week[`panier_${seller.id}`] = week[`ca_${seller.id}`] / week[`ventes_${seller.id}`];
        }
      });
    });
    
    return Array.from(weeks.values()).sort((a, b) => a.date.localeCompare(b.date));
  };

  const aggregateByBiWeek = (data, sellers) => {
    const biWeeks = new Map();
    data.forEach(day => {
      const date = new Date(day.date);
      const dayOfYear = Math.floor((date - new Date(date.getFullYear(), 0, 0)) / 86400000);
      const biWeekNum = Math.floor(dayOfYear / 14);
      const biWeekKey = `${date.getFullYear()}-BW${biWeekNum}`;
      
      if (!biWeeks.has(biWeekKey)) {
        biWeeks.set(biWeekKey, { date: day.date, count: 0 });
        sellers.forEach(seller => {
          biWeeks.get(biWeekKey)[`ca_${seller.id}`] = 0;
          biWeeks.get(biWeekKey)[`ventes_${seller.id}`] = 0;
          biWeeks.get(biWeekKey)[`panier_${seller.id}`] = 0;
          biWeeks.get(biWeekKey)[`name_${seller.id}`] = seller.name;
        });
      }
      
      const biWeek = biWeeks.get(biWeekKey);
      sellers.forEach(seller => {
        biWeek[`ca_${seller.id}`] += day[`ca_${seller.id}`] || 0;
        biWeek[`ventes_${seller.id}`] += day[`ventes_${seller.id}`] || 0;
      });
      biWeek.count++;
    });
    
    // Calculate average panier moyen
    biWeeks.forEach(biWeek => {
      sellers.forEach(seller => {
        if (biWeek[`ventes_${seller.id}`] > 0) {
          biWeek[`panier_${seller.id}`] = biWeek[`ca_${seller.id}`] / biWeek[`ventes_${seller.id}`];
        }
      });
    });
    
    return Array.from(biWeeks.values()).sort((a, b) => a.date.localeCompare(b.date));
  };

  const aggregateByMonth = (data, sellers) => {
    const months = new Map();
    data.forEach(day => {
      const date = new Date(day.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!months.has(monthKey)) {
        months.set(monthKey, { date: `${monthKey}-01`, count: 0 });
        sellers.forEach(seller => {
          months.get(monthKey)[`ca_${seller.id}`] = 0;
          months.get(monthKey)[`ventes_${seller.id}`] = 0;
          months.get(monthKey)[`panier_${seller.id}`] = 0;
          months.get(monthKey)[`name_${seller.id}`] = seller.name;
        });
      }
      
      const month = months.get(monthKey);
      sellers.forEach(seller => {
        month[`ca_${seller.id}`] += day[`ca_${seller.id}`] || 0;
        month[`ventes_${seller.id}`] += day[`ventes_${seller.id}`] || 0;
      });
      month.count++;
    });
    
    // Calculate average panier moyen
    months.forEach(month => {
      sellers.forEach(seller => {
        if (month[`ventes_${seller.id}`] > 0) {
          month[`panier_${seller.id}`] = month[`ca_${seller.id}`] / month[`ventes_${seller.id}`];
        }
      });
    });
    
    return Array.from(months.values()).sort((a, b) => a.date.localeCompare(b.date));
  };


  // Calculate team totals
  const teamTotalCA = teamData.reduce((sum, s) => sum + (s.monthlyCA || 0), 0);
  const teamTotalVentes = teamData.reduce((sum, s) => sum + (s.monthlyVentes || 0), 0);
  const sellersWithKPI = teamData.filter(s => s.hasKpiToday).length;

  // Build localStorage key for AI analysis persistence
  const teamAnalysisLsKey = `mgr_team_analysis_${storeIdParam || 'default'}_${periodFilter}_${
    periodFilter === 'custom' ? `${customDateRange.start}_${customDateRange.end}` : ''
  }`;

  // Load persisted AI analysis when period changes
  useEffect(() => {
    try {
      const saved = localStorage.getItem(teamAnalysisLsKey);
      if (saved) {
        setAiAnalysis(JSON.parse(saved));
      } else {
        setAiAnalysis(null);
      }
    } catch {
      setAiAnalysis(null);
    }
  }, [teamAnalysisLsKey]);

  // Auto-scroll to analysis section when it appears
  useEffect(() => {
    if (aiAnalysis && aiSectionRef.current) {
      aiSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [aiAnalysis]);

  const generateTeamAnalysis = async () => {
    setAiGenerating(true);
    try {
      const storeParam = storeIdParam ? `?store_id=${storeIdParam}` : '';
      const teamContext = {
        total_sellers: teamData.length,
        sellers_with_kpi: teamData.filter(s => s.hasKpiToday).length,
        team_total_ca: teamTotalCA,
        team_total_ventes: teamTotalVentes,
        sellers_details: teamData.map(s => ({
          name: s.name,
          ca: s.monthlyCA,
          ventes: s.monthlyVentes,
          panier_moyen: s.panierMoyen,
          avg_competence: s.avgCompetence,
          best_skill: s.bestCompetence?.name,
          worst_skill: s.worstCompetence?.name,
          disc_style: s.disc_style || null,
        })),
      };
      const requestBody = {
        team_data: teamContext,
        period_filter: periodFilter || '30',
      };
      if (periodFilter === 'custom' && customDateRange?.start && customDateRange?.end) {
        requestBody.start_date = customDateRange.start;
        requestBody.end_date = customDateRange.end;
      }
      const res = await api.post(`/manager/analyze-team${storeParam}`, requestBody);
      const analysis = res.data.analysis;
      setAiAnalysis(analysis);
      try {
        localStorage.setItem(teamAnalysisLsKey, JSON.stringify(analysis));
      } catch {
        // localStorage might be full
      }
      toast.success('Analyse IA générée !');
    } catch (err) {
      logger.error('Error generating team AI analysis:', err);
      toast.error(getSubscriptionErrorMessage(err, user?.role) || 'Erreur lors de l\'analyse IA');
    } finally {
      setAiGenerating(false);
    }
  };

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) { onClose(); } }} className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-cyan-600 to-blue-600 p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users className="w-8 h-8" />
              <div>
                <h2 className="text-2xl font-bold">Mon Équipe</h2>
                <p className="text-sm opacity-90">Vue d'ensemble managériale</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600"></div>
              <p className="text-gray-600 mt-4">Chargement des données...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Header avec Bouton Rafraîchir */}
              <div className="flex justify-between items-center border-b border-gray-200 mb-6">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-cyan-600" />
                  <h3 className="text-lg font-semibold text-gray-800">Vendeurs actifs</h3>
                </div>
                <button
                  onClick={async () => {
                    setIsUpdating(true);
                    await fetchTeamData(sellers);
                    setIsUpdating(false);
                    toast.success('Données actualisées !');
                  }}
                  disabled={isUpdating}
                  className="px-3 py-1.5 text-sm bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${isUpdating ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">Actualiser</span>
                </button>
              </div>

              {/* Period Filter */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex flex-col gap-3 w-full">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-700">
                      📅 <span className="hidden md:inline">Période :</span>
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { value: '7', label: '7 jours' },
                        { value: '30', label: '30 jours' },
                        { value: '90', label: '3 mois' },
                        { value: 'all', label: 'Année' }
                      ].map(option => (
                        <button
                          key={option.value}
                          onClick={() => {
                            setPeriodFilter(option.value);
                            setShowCustomDatePicker(false);
                          }}
                          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                            periodFilter === option.value
                              ? 'bg-[#1E40AF] text-white shadow-md'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                      <button
                        onClick={() => {
                          setShowCustomDatePicker(!showCustomDatePicker);
                          if (!showCustomDatePicker) {
                            // Only set to custom when opening the picker
                            setPeriodFilter('custom');
                          }
                        }}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                          periodFilter === 'custom'
                            ? 'bg-purple-600 text-white shadow-md'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        📆 Personnalisée
                      </button>
                    </div>
                  </div>
                  
                  {/* Custom Date Picker */}
                  {showCustomDatePicker && (
                    <div className="bg-purple-50 rounded-lg p-4 border-2 border-purple-200">
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                        <div className="flex-1">
                          <label className="block text-xs font-semibold text-gray-700 mb-1">Date de début</label>
                          <input
                            type="date"
                            value={customDateRange.start}
                            onChange={(e) => {
                              const newStart = e.target.value;
                              setCustomDateRange(prev => ({ ...prev, start: newStart }));
                              
                              // Set to custom mode if both dates will be set
                              if (newStart && customDateRange.end) {
                                setPeriodFilter('custom');
                              }
                            }}
                            onFocus={(e) => {
                              // Ouvrir le calendrier au focus
                              try {
                                if (typeof e.target.showPicker === 'function') {
                                  e.target.showPicker();
                                }
                              } catch (error) {
                                // showPicker n'est pas supporté par ce navigateur
                              }
                            }}
                            className="w-full px-3 py-2 text-sm border-2 border-purple-300 rounded-lg focus:border-purple-500 focus:outline-none cursor-pointer"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="block text-xs font-semibold text-gray-700 mb-1">Date de fin</label>
                          <input
                            type="date"
                            value={customDateRange.end}
                            onChange={(e) => {
                              const newEnd = e.target.value;
                              setCustomDateRange(prev => ({ ...prev, end: newEnd }));
                              
                              // Set to custom mode if both dates are now set
                              if (customDateRange.start && newEnd) {
                                setPeriodFilter('custom');
                              }
                            }}
                            onFocus={(e) => {
                              // Ouvrir le calendrier au focus
                              try {
                                if (typeof e.target.showPicker === 'function') {
                                  e.target.showPicker();
                                }
                              } catch (error) {
                                // showPicker n'est pas supporté par ce navigateur
                              }
                            }}
                            className="w-full px-3 py-2 text-sm border-2 border-purple-300 rounded-lg focus:border-purple-500 focus:outline-none cursor-pointer"
                          />
                        </div>
                      </div>
                      {periodFilter === 'custom' && customDateRange.start && customDateRange.end && (
                        <p className="text-xs text-purple-700 mt-2">
                          ✅ Période active : du {new Date(customDateRange.start).toLocaleDateString('fr-FR')} au {new Date(customDateRange.end).toLocaleDateString('fr-FR')}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Summary Cards */}
              <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg p-4 border border-blue-200">
                  <div className="flex items-center gap-3 mb-2">
                    <Users className="w-5 h-5 text-blue-600" />
                    <span className="text-sm font-semibold text-gray-700">Équipe</span>
                  </div>
                  <div className="text-2xl font-bold text-blue-900">
                    {teamData.filter(seller => !hiddenSellerIds.includes(seller.id) && (!seller.status || seller.status === 'active')).length}
                  </div>
                  <div className="text-xs text-blue-600 mt-1">
                    vendeur{teamData.filter(seller => !hiddenSellerIds.includes(seller.id) && (!seller.status || seller.status === 'active')).length > 1 ? 's' : ''} actif{teamData.filter(seller => !hiddenSellerIds.includes(seller.id) && (!seller.status || seller.status === 'active')).length > 1 ? 's' : ''}
                  </div>
                </div>

                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200">
                  <div className="flex items-center gap-3 mb-2">
                    <TrendingUp className="w-5 h-5 text-[#10B981]" />
                    <span className="text-sm font-semibold text-gray-700">Performance Globale</span>
                  </div>
                  <div className="text-2xl font-bold text-green-900">{formatNumber(teamTotalCA)} €</div>
                  <div className="text-xs text-[#10B981] mt-1">
                    {formatNumber(teamTotalVentes)} ventes sur {
                      periodFilter === '7' ? '7 jours' :
                      periodFilter === '30' ? '30 jours' :
                      periodFilter === '90' ? '3 mois' :
                      periodFilter === 'custom' && customDateRange.start && customDateRange.end ? 
                        'période personnalisée' :
                      periodFilter === 'all' ? 'l\'année' :
                      'la période sélectionnée'
                    }
                  </div>
                </div>

                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg p-4 border border-indigo-200 flex flex-col items-center justify-center gap-3">
                  <div className="flex flex-wrap gap-2 justify-center">
                    <button
                      onClick={() => setShowMorningBriefModal(true)}
                      className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold rounded-lg hover:shadow-lg hover:shadow-orange-500/30 transition-all flex items-center gap-2"
                    >
                      <Coffee className="w-4 h-4" />
                      ☕ Brief du Matin
                    </button>
                    <button
                      onClick={generateTeamAnalysis}
                      disabled={aiGenerating || teamData.length === 0}
                      className="px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {aiGenerating ? '⏳ Analyse en cours...' : '🤖 Analyse IA de l\'équipe'}
                    </button>
                  </div>
                </div>

              </div>

              <SellersTableSection
                teamData={teamData}
                sellers={sellers}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                displayedSellerCount={displayedSellerCount}
                setDisplayedSellerCount={setDisplayedSellerCount}
                hiddenSellerIds={hiddenSellerIds}
                setHiddenSellerIds={setHiddenSellerIds}
                isUpdating={isUpdating}
                periodFilter={periodFilter}
                customDateRange={customDateRange}
                userRole={userRole}
                storeIdParam={storeIdParam}
                user={user}
                showNiveauTooltip={showNiveauTooltip}
                setShowNiveauTooltip={setShowNiveauTooltip}
                onViewSellerDetail={onViewSellerDetail}
                setShowEvaluationModal={setShowEvaluationModal}
                setSelectedSellerForEval={setSelectedSellerForEval}
                refreshSellersData={refreshSellersData}
                fetchTeamData={fetchTeamData}
                isGerantWithoutStore={isGerantWithoutStore}
              />
              </>

              <ChartsSection
                chartData={chartData}
                visibleMetrics={visibleMetrics}
                setVisibleMetrics={setVisibleMetrics}
                visibleSellers={visibleSellers}
                setVisibleSellers={setVisibleSellers}
                sellers={sellers}
                teamData={teamData}
                isUpdatingCharts={isUpdatingCharts}
                setIsUpdatingCharts={setIsUpdatingCharts}
                periodFilter={periodFilter}
                setPeriodFilter={setPeriodFilter}
                customDateRange={customDateRange}
                setCustomDateRange={setCustomDateRange}
                showCustomDatePicker={showCustomDatePicker}
                setShowCustomDatePicker={setShowCustomDatePicker}
                hiddenSellerIds={hiddenSellerIds}
                prepareChartData={prepareChartData}
              />

              {/* IA Analysis Section */}
              <div ref={aiSectionRef} className="mt-6">
                {!aiAnalysis && !aiGenerating && (
                  <div className="text-center py-8 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                    <span className="text-4xl mb-3 block">🤖</span>
                    <p className="text-gray-600 mb-4">Aucune analyse IA pour cette période</p>
                    <button
                      onClick={generateTeamAnalysis}
                      disabled={teamData.length === 0}
                      className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      ✨ Générer l'analyse IA
                    </button>
                  </div>
                )}
                {aiGenerating && (
                  <div className="bg-white rounded-2xl p-8 text-center shadow border-2 border-blue-200">
                    <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center animate-pulse">
                      <span className="text-2xl">✨</span>
                    </div>
                    <h3 className="text-xl font-bold text-gray-800 mb-2">Analyse en cours...</h3>
                    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mt-4">
                      <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 animate-pulse rounded-full" style={{ width: '60%' }} />
                    </div>
                  </div>
                )}
                {aiAnalysis && !aiGenerating && (
                  <ManagerAIAnalysisDisplay
                    analysis={aiAnalysis}
                    onRegenerate={generateTeamAnalysis}
                    title="Analyse IA — Équipe"
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Evaluation Generator Modal (Entretien Annuel Manager) */}
      {showEvaluationModal && selectedSellerForEval && (
        <EvaluationGenerator
          isOpen={showEvaluationModal}
          onClose={() => {
            setShowEvaluationModal(false);
            setSelectedSellerForEval(null);
          }}
          employeeId={selectedSellerForEval.id}
          employeeName={selectedSellerForEval.name}
          role="manager"
        />
      )}

      {/* Morning Brief Modal */}
      <MorningBriefModal
        isOpen={showMorningBriefModal}
        onClose={() => setShowMorningBriefModal(false)}
        storeName={storeName}
        managerName={managerName}
        storeId={storeIdParam}
      />

      {/* Modal de confirmation - RETIRÉ - Actions de gestion des vendeurs réservées exclusivement au Gérant */}
    </div>
  );
}
