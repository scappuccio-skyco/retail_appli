import { useState, useEffect, useRef } from 'react';
import { api } from '../../lib/apiClient';
import { LABEL_DECOUVERTE } from '../../lib/constants';
import { logger } from '../../utils/logger';
import { getSubscriptionErrorMessage } from '../../utils/apiHelpers';
import { useAuth } from '../../contexts';
import { toast } from 'sonner';

export default function useTeamModal({ sellers, storeIdParam, userRole, storeName, managerName, onClose, user }) {
  const [teamData, setTeamData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [archivedSellers, setArchivedSellers] = useState([]);
  const [showMorningBriefModal, setShowMorningBriefModal] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [aiGenerating, setAiGenerating] = useState(false);
  const aiSectionRef = useRef(null);
  const aiJustGenerated = useRef(false);
  const [periodFilter, setPeriodFilter] = useState('30');
  const [showNiveauTooltip, setShowNiveauTooltip] = useState(false);
  const [customDateRange, setCustomDateRange] = useState({ start: '', end: '' });
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  const [chartData, setChartData] = useState([]);
  const [visibleMetrics, setVisibleMetrics] = useState({ ca: true, ventes: true, panierMoyen: true });
  const [visibleSellers, setVisibleSellers] = useState({});
  const [isUpdatingCharts, setIsUpdatingCharts] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [displayedSellerCount, setDisplayedSellerCount] = useState(5);
  const [hiddenSellerIds, setHiddenSellerIds] = useState([]);
  const [showEvaluationModal, setShowEvaluationModal] = useState(false);
  const [selectedSellerForEval, setSelectedSellerForEval] = useState(null);
  const [teamKpiEntriesBySeller, setTeamKpiEntriesBySeller] = useState({});

  const isGerantWithoutStore = userRole === 'gerant' && !storeIdParam;

  useEffect(() => {
    const initialVisibleSellers = {};
    sellers.forEach((seller, index) => { initialVisibleSellers[seller.id] = index < 5; });
    setVisibleSellers(initialVisibleSellers);
  }, [sellers]);

  useEffect(() => {
    if (periodFilter !== 'custom' || (periodFilter === 'custom' && customDateRange.start && customDateRange.end)) {
      fetchTeamData();
    }
  }, [sellers, periodFilter, customDateRange.start, customDateRange.end]);

  useEffect(() => {
    if (Object.keys(visibleSellers).length > 0) prepareChartData();
  }, [periodFilter, visibleSellers, customDateRange.start, customDateRange.end, teamKpiEntriesBySeller]);

  const teamAnalysisLsKey = `mgr_team_analysis_${storeIdParam || 'default'}_${periodFilter}_${
    periodFilter === 'custom' ? `${customDateRange.start}_${customDateRange.end}` : ''
  }`;

  useEffect(() => {
    try {
      const saved = localStorage.getItem(teamAnalysisLsKey);
      setAiAnalysis(saved ? JSON.parse(saved) : null);
    } catch {
      setAiAnalysis(null);
    }
  }, [teamAnalysisLsKey]);

  useEffect(() => {
    if (aiAnalysis && aiSectionRef.current && aiJustGenerated.current) {
      aiJustGenerated.current = false;
      aiSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [aiAnalysis]);

  const fetchTeamData = async (sellersToUse = sellers) => {
    if (teamData.length === 0) setLoading(true);
    try {
      const daysParam = periodFilter === 'all' ? 365 : (periodFilter === 'custom' ? 0 : parseInt(periodFilter, 10));
      const storeParam = storeIdParam ? `&store_id=${storeIdParam}` : '';
      const storeQueryParam = storeIdParam ? `?store_id=${storeIdParam}` : '';

      const sellerIds = sellersToUse.map(s => s.id);
      const storeQs = storeIdParam ? `?store_id=${storeIdParam}` : '';

      // Batch 1: KPI metrics agrégés (CA, ventes, panier, articles, indice)
      const chunkSize = 200;
      const metricsChunks = [];
      for (let i = 0; i < sellerIds.length; i += chunkSize) {
        metricsChunks.push(sellerIds.slice(i, i + chunkSize));
      }
      const metricsResults = await Promise.all(metricsChunks.map(chunk =>
        api.post(`/manager/team/kpi-metrics${storeQs}`, {
          seller_ids: chunk, days: daysParam,
          ...(periodFilter === 'custom' && customDateRange.start && customDateRange.end
            ? { start_date: customDateRange.start, end_date: customDateRange.end } : {}),
        }).then(r => r.data).catch(err => { logger.error('kpi-metrics chunk failed:', err?.response?.data || err.message); return {}; })
      ));
      const teamMetricsMap = Object.assign({}, ...metricsResults);

      // Batch 2: Profils vendeurs (radar scores + niveau) — remplace N×2 appels /stats + /diagnostic
      const profileChunks = [];
      for (let i = 0; i < sellerIds.length; i += 100) {
        profileChunks.push(sellerIds.slice(i, i + 100));
      }
      const profileResults = await Promise.all(profileChunks.map(chunk =>
        api.post(`/manager/team/seller-profiles${storeQs}`, { seller_ids: chunk })
          .then(r => r.data).catch(err => { logger.error('seller-profiles chunk failed:', err?.response?.data || err.message); return {}; })
      ));
      const profilesMap = Object.assign({}, ...profileResults);

      const sellersDataPromises = sellersToUse.map(async (seller) => {
        try {
          let kpiUrl = `/manager/kpi-entries/${seller.id}?days=${daysParam}&size=366${storeParam}`;
          if (periodFilter === 'custom' && customDateRange.start && customDateRange.end) {
            kpiUrl = `/manager/kpi-entries/${seller.id}?start_date=${customDateRange.start}&end_date=${customDateRange.end}&size=366${storeParam}`;
          }
          const kpiRes = await api.get(kpiUrl, { params: { _t: Date.now() } });

          const kpiEntries = Array.isArray(kpiRes.data?.items) ? kpiRes.data.items : (Array.isArray(kpiRes.data) ? kpiRes.data : []);
          const metricsData = teamMetricsMap[seller.id] ?? null;
          const profileData = profilesMap[seller.id] ?? {};

          const monthlyCA = metricsData?.ca ?? kpiEntries.reduce((sum, e) => {
            const ca = e.ca_journalier || e.seller_ca || e.ca || 0;
            return sum + (typeof ca === 'number' ? ca : 0);
          }, 0);
          const monthlyVentes = metricsData?.ventes ?? kpiEntries.reduce((sum, e) => sum + (e.nb_ventes || 0), 0);
          const panierMoyen = metricsData?.panier_moyen ?? (monthlyVentes > 0 ? monthlyCA / monthlyVentes : 0);
          const articles = metricsData?.articles ?? kpiEntries.reduce((sum, e) => sum + (e.nb_articles || 0), 0);
          const indice_vente = metricsData?.indice_vente ?? (monthlyVentes > 0 ? articles / monthlyVentes : 0);

          const competences = profileData.avg_radar_scores || {};
          const competencesList = [
            { name: 'Accueil', value: competences.accueil || 0 },
            { name: LABEL_DECOUVERTE, value: competences.decouverte || 0 },
            { name: 'Argumentation', value: competences.argumentation || 0 },
            { name: 'Closing', value: competences.closing || 0 },
            { name: 'Fidélisation', value: competences.fidelisation || 0 },
          ];
          const avgCompetence = competencesList.reduce((sum, c) => sum + c.value, 0) / 5;
          const allSameValue = competencesList.every(c => c.value === competencesList[0].value);
          const allZero = competencesList.every(c => c.value === 0);

          let bestCompetence, worstCompetence;
          if (allZero) {
            bestCompetence = { name: 'Non évalué', value: 0 };
            worstCompetence = { name: 'Non évalué', value: 0 };
          } else if (allSameValue) {
            bestCompetence = { name: 'Profil équilibré', value: competencesList[0].value };
            worstCompetence = { name: 'Profil équilibré', value: competencesList[0].value };
          } else {
            bestCompetence = competencesList.reduce((max, c) => c.value > max.value ? c : max);
            worstCompetence = competencesList.reduce((min, c) => c.value < min.value ? c : min);
          }

          return {
            ...seller, monthlyCA, monthlyVentes, panierMoyen, articles, indice_vente,
            avgCompetence, bestCompetence, worstCompetence,
            lastKpiDate: kpiEntries.length > 0 ? kpiEntries[0].date : null,
            hasKpiToday: kpiEntries.some(e => e.date === new Date().toISOString().split('T')[0]),
            scoreSource: profileData.has_diagnostic ? 'diagnostic' : 'none',
            hasDiagnostic: profileData.has_diagnostic ?? false,
            niveau: profileData.niveau || seller.niveau || 'Non défini',
            style_vente: profileData.style || null,
            _kpiEntries: kpiEntries,
          };
        } catch (err) {
          logger.error(`Error fetching data for seller ${seller.id}:`, err);
          return { ...seller, monthlyCA: 0, monthlyVentes: 0, panierMoyen: 0, avgCompetence: 0, bestCompetence: { name: 'N/A', value: 0 }, worstCompetence: { name: 'N/A', value: 0 }, lastKpiDate: null, hasKpiToday: false };
        }
      });

      const sellersData = await Promise.all(sellersDataPromises);
      const kpiBySeller = {};
      sellersData.forEach((row) => { if (row._kpiEntries) kpiBySeller[row.id] = row._kpiEntries; });
      setTeamKpiEntriesBySeller(kpiBySeller);
      setTeamData(sellersData.map(({ _kpiEntries, ...rest }) => rest));
    } catch (err) {
      logger.error('Error fetching team data:', err);
      toast.error("Erreur lors du chargement des données d'équipe");
    } finally {
      setLoading(false);
    }
  };

  const refreshSellersData = async () => {
    try {
      const storeQueryParam = storeIdParam ? `?store_id=${storeIdParam}` : '';
      const response = await api.get(`/manager/sellers${storeQueryParam}`);
      const archivedResponse = await api.get(`/manager/sellers/archived${storeQueryParam}`);
      setArchivedSellers(archivedResponse.data);
      await fetchTeamData(response.data);
      const activeSellerIds = response.data.map(s => s.id);
      setVisibleSellers(prev => {
        const cleaned = {};
        Object.keys(prev).forEach(sellerId => { if (activeSellerIds.includes(sellerId)) cleaned[sellerId] = prev[sellerId]; });
        return cleaned;
      });
    } catch (error) {
      logger.error('Erreur lors du rafraîchissement:', error);
    }
  };

  const aggregateByWeek = (data, sellersList) => {
    const weeks = new Map();
    data.forEach(day => {
      const date = new Date(day.date);
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      const weekKey = weekStart.toISOString().split('T')[0];
      if (!weeks.has(weekKey)) {
        weeks.set(weekKey, { date: weekKey, count: 0 });
        sellersList.forEach(s => { weeks.get(weekKey)[`ca_${s.id}`] = 0; weeks.get(weekKey)[`ventes_${s.id}`] = 0; weeks.get(weekKey)[`panier_${s.id}`] = 0; weeks.get(weekKey)[`name_${s.id}`] = s.name; });
      }
      const week = weeks.get(weekKey);
      sellersList.forEach(s => { week[`ca_${s.id}`] += day[`ca_${s.id}`] || 0; week[`ventes_${s.id}`] += day[`ventes_${s.id}`] || 0; });
      week.count++;
    });
    weeks.forEach(week => { sellersList.forEach(s => { if (week[`ventes_${s.id}`] > 0) week[`panier_${s.id}`] = week[`ca_${s.id}`] / week[`ventes_${s.id}`]; }); });
    return Array.from(weeks.values()).sort((a, b) => a.date.localeCompare(b.date));
  };

  const aggregateByBiWeek = (data, sellersList) => {
    const biWeeks = new Map();
    data.forEach(day => {
      const date = new Date(day.date);
      const dayOfYear = Math.floor((date - new Date(date.getFullYear(), 0, 0)) / 86400000);
      const biWeekKey = `${date.getFullYear()}-BW${Math.floor(dayOfYear / 14)}`;
      if (!biWeeks.has(biWeekKey)) {
        biWeeks.set(biWeekKey, { date: day.date, count: 0 });
        sellersList.forEach(s => { biWeeks.get(biWeekKey)[`ca_${s.id}`] = 0; biWeeks.get(biWeekKey)[`ventes_${s.id}`] = 0; biWeeks.get(biWeekKey)[`panier_${s.id}`] = 0; biWeeks.get(biWeekKey)[`name_${s.id}`] = s.name; });
      }
      const bw = biWeeks.get(biWeekKey);
      sellersList.forEach(s => { bw[`ca_${s.id}`] += day[`ca_${s.id}`] || 0; bw[`ventes_${s.id}`] += day[`ventes_${s.id}`] || 0; });
      bw.count++;
    });
    biWeeks.forEach(bw => { sellersList.forEach(s => { if (bw[`ventes_${s.id}`] > 0) bw[`panier_${s.id}`] = bw[`ca_${s.id}`] / bw[`ventes_${s.id}`]; }); });
    return Array.from(biWeeks.values()).sort((a, b) => a.date.localeCompare(b.date));
  };

  const aggregateByMonth = (data, sellersList) => {
    const months = new Map();
    data.forEach(day => {
      const date = new Date(day.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!months.has(monthKey)) {
        months.set(monthKey, { date: `${monthKey}-01`, count: 0 });
        sellersList.forEach(s => { months.get(monthKey)[`ca_${s.id}`] = 0; months.get(monthKey)[`ventes_${s.id}`] = 0; months.get(monthKey)[`panier_${s.id}`] = 0; months.get(monthKey)[`name_${s.id}`] = s.name; });
      }
      const month = months.get(monthKey);
      sellersList.forEach(s => { month[`ca_${s.id}`] += day[`ca_${s.id}`] || 0; month[`ventes_${s.id}`] += day[`ventes_${s.id}`] || 0; });
      month.count++;
    });
    months.forEach(month => { sellersList.forEach(s => { if (month[`ventes_${s.id}`] > 0) month[`panier_${s.id}`] = month[`ca_${s.id}`] / month[`ventes_${s.id}`]; }); });
    return Array.from(months.values()).sort((a, b) => a.date.localeCompare(b.date));
  };

  const prepareChartData = async () => {
    try {
      const hasCachedForAll = sellers.length > 0 && sellers.every(s => Array.isArray(teamKpiEntriesBySeller[s.id]));
      if (hasCachedForAll) {
        const dateMap = new Map();
        sellers.forEach(seller => {
          (teamKpiEntriesBySeller[seller.id] || []).forEach(entry => {
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
          const daysDiff = Math.ceil((new Date(customDateRange.end) - new Date(customDateRange.start)) / (1000 * 60 * 60 * 24));
          if (daysDiff > 90) chartArray = aggregateByMonth(chartArray, sellers);
          else if (daysDiff > 30) chartArray = aggregateByBiWeek(chartArray, sellers);
          else if (daysDiff > 14) chartArray = aggregateByWeek(chartArray, sellers);
        }
        setChartData(chartArray);
        return;
      }
      if (teamData.length === 0) { setChartData([]); return; }

      const daysParam = periodFilter === 'all' ? 365 : (periodFilter === 'custom' ? 0 : periodFilter);
      const storeParam = storeIdParam ? `&store_id=${storeIdParam}` : '';
      const chartDataPromises = sellers.map(async (seller) => {
        try {
          let url = `/manager/kpi-entries/${seller.id}?days=${daysParam}&size=366${storeParam}`;
          if (periodFilter === 'custom' && customDateRange.start && customDateRange.end) {
            url = `/manager/kpi-entries/${seller.id}?start_date=${customDateRange.start}&end_date=${customDateRange.end}&size=366${storeParam}`;
          }
          const res = await api.get(url);
          return { sellerId: seller.id, sellerName: seller.name, data: res.data };
        } catch {
          return { sellerId: seller.id, sellerName: seller.name, data: [] };
        }
      });
      const sellersKpiData = await Promise.all(chartDataPromises);
      const dateMap = new Map();
      sellersKpiData.forEach(({ sellerId, sellerName, data }) => {
        const entries = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
        entries.forEach(entry => {
          const date = entry.date;
          if (!dateMap.has(date)) dateMap.set(date, { date });
          const dayData = dateMap.get(date);
          dayData[`ca_${sellerId}`] = entry.ca_journalier || 0;
          dayData[`ventes_${sellerId}`] = entry.nb_ventes || 0;
          dayData[`panier_${sellerId}`] = entry.nb_ventes > 0 ? (entry.ca_journalier / entry.nb_ventes) : 0;
          dayData[`name_${sellerId}`] = sellerName;
        });
      });
      let chartArray = Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));
      if (periodFilter === '30') chartArray = aggregateByWeek(chartArray, sellers);
      else if (periodFilter === '90') chartArray = aggregateByBiWeek(chartArray, sellers);
      else if (periodFilter === 'all') chartArray = aggregateByMonth(chartArray, sellers);
      else if (periodFilter === 'custom' && customDateRange.start && customDateRange.end) {
        const daysDiff = Math.ceil((new Date(customDateRange.end) - new Date(customDateRange.start)) / (1000 * 60 * 60 * 24));
        if (daysDiff > 90) chartArray = aggregateByMonth(chartArray, sellers);
        else if (daysDiff > 30) chartArray = aggregateByBiWeek(chartArray, sellers);
        else if (daysDiff > 14) chartArray = aggregateByWeek(chartArray, sellers);
      }
      setChartData(chartArray);
    } catch (err) {
      logger.error('Error preparing chart data:', err);
    }
  };

  const generateTeamAnalysis = async () => {
    setAiGenerating(true);
    try {
      const storeQueryParam = storeIdParam ? `?store_id=${storeIdParam}` : '';
      const teamContext = {
        total_sellers: teamData.length,
        sellers_with_kpi: teamData.filter(s => s.hasKpiToday).length,
        team_total_ca: teamData.reduce((sum, s) => sum + (s.monthlyCA || 0), 0),
        team_total_ventes: teamData.reduce((sum, s) => sum + (s.monthlyVentes || 0), 0),
        sellers_details: teamData.map(s => ({
          name: s.name, ca: s.monthlyCA, ventes: s.monthlyVentes,
          panier_moyen: s.panierMoyen, avg_competence: s.avgCompetence,
          best_skill: s.bestCompetence?.name, worst_skill: s.worstCompetence?.name,
          disc_style: s.disc_style || null,
        })),
      };
      const requestBody = { team_data: teamContext, period_filter: periodFilter || '30' };
      if (periodFilter === 'custom' && customDateRange?.start && customDateRange?.end) {
        requestBody.start_date = customDateRange.start;
        requestBody.end_date = customDateRange.end;
      }
      const res = await api.post(`/manager/analyze-team${storeQueryParam}`, requestBody);
      const analysis = res.data.analysis;
      aiJustGenerated.current = true;
      setAiAnalysis(analysis);
      try { localStorage.setItem(teamAnalysisLsKey, JSON.stringify(analysis)); } catch { /* localStorage full */ }
      toast.success('Analyse IA générée !');
    } catch (err) {
      logger.error('Error generating team AI analysis:', err);
      toast.error(getSubscriptionErrorMessage(err, user?.role) || "Erreur lors de l'analyse IA");
    } finally {
      setAiGenerating(false);
    }
  };

  const teamTotalCA = teamData.reduce((sum, s) => sum + (s.monthlyCA || 0), 0);
  const teamTotalVentes = teamData.reduce((sum, s) => sum + (s.monthlyVentes || 0), 0);

  return {
    teamData, loading, archivedSellers,
    showMorningBriefModal, setShowMorningBriefModal,
    aiAnalysis, aiGenerating, aiSectionRef,
    periodFilter, setPeriodFilter,
    showNiveauTooltip, setShowNiveauTooltip,
    customDateRange, setCustomDateRange,
    showCustomDatePicker, setShowCustomDatePicker,
    chartData,
    visibleMetrics, setVisibleMetrics,
    visibleSellers, setVisibleSellers,
    isUpdatingCharts, setIsUpdatingCharts,
    isUpdating, setIsUpdating,
    searchQuery, setSearchQuery,
    displayedSellerCount, setDisplayedSellerCount,
    hiddenSellerIds, setHiddenSellerIds,
    showEvaluationModal, setShowEvaluationModal,
    selectedSellerForEval, setSelectedSellerForEval,
    isGerantWithoutStore,
    teamTotalCA, teamTotalVentes,
    fetchTeamData, refreshSellersData, prepareChartData, generateTeamAnalysis,
  };
}
