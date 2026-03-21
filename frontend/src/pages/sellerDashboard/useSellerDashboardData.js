import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { api } from '../../lib/apiClient';
import { logger } from '../../utils/logger';
import { getSubscriptionErrorMessage } from '../../utils/apiHelpers';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';

// ── Week/KPI helpers ────────────────────────────────────────────────────────

function getWeekDates(offset) {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset + offset * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (d) =>
    `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(-2)}`;
  return {
    start: monday,
    end: sunday,
    startFormatted: fmt(monday),
    endFormatted: fmt(sunday),
    periode: `Semaine du ${fmt(monday)} au ${fmt(sunday)}`,
    startISO: monday.toISOString().split('T')[0],
    endISO: sunday.toISOString().split('T')[0],
  };
}

function calculateWeeklyKPI(startDate, endDate, allEntries) {
  const list = Array.isArray(allEntries) ? allEntries : [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  const week = list.filter(e => {
    const d = new Date(e.date);
    return d >= start && d <= end;
  });
  const kpi = {
    ca_total: 0, ventes: 0, articles: 0, prospects: 0,
    panier_moyen: 0, taux_transformation: 0, indice_vente: 0,
  };
  week.forEach(e => {
    kpi.ca_total += e.ca_journalier || 0;
    kpi.ventes += e.nb_ventes || 0;
    kpi.articles += e.nb_articles || 0;
    kpi.prospects += e.nb_prospects || 0;
  });
  if (kpi.ventes > 0) kpi.panier_moyen = kpi.ca_total / kpi.ventes;
  if (kpi.ventes > 0) kpi.indice_vente = kpi.articles / kpi.ventes;
  if (kpi.prospects > 0) kpi.taux_transformation = (kpi.ventes / kpi.prospects) * 100;
  return kpi;
}

// ── Hook ────────────────────────────────────────────────────────────────────

export function useSellerDashboardData({ user, initialDiagnostic, isReadOnly, isSubscriptionExpired }) {
  // ── Data state ────────────────────────────────────────────────────────────
  const [evaluations, setEvaluations] = useState([]);
  const [sales, setSales] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [debriefs, setDebriefs] = useState([]);
  const [competencesHistory, setCompetencesHistory] = useState([]);
  const [kpiEntries, setKpiEntries] = useState([]);
  const [kpiEntriesPage, setKpiEntriesPage] = useState(1);
  const [kpiEntriesTotal, setKpiEntriesTotal] = useState(0);
  const [kpiConfig, setKpiConfig] = useState(null);
  const [diagnostic, setDiagnostic] = useState(initialDiagnostic);
  const [dailyChallenge, setDailyChallenge] = useState(null);
  const [bilanIndividuel, setBilanIndividuel] = useState(null);
  const [activeObjectives, setActiveObjectives] = useState([]);
  const [storeName, setStoreName] = useState('');
  const [managerName, setManagerName] = useState('');

  // ── UI state ──────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [accessDenied403, setAccessDenied403] = useState(false);
  const [accessDeniedBlockCode, setAccessDeniedBlockCode] = useState(null);
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);
  const [generatingBilan, setGeneratingBilan] = useState(false);

  // ── Auto-add challenge task when dailyChallenge changes ───────────────────
  useEffect(() => {
    if (!dailyChallenge) return;
    setTasks(prev => {
      const withoutChallenge = prev.filter(t => t.id !== 'daily-challenge');
      if (dailyChallenge.completed) return withoutChallenge;
      return [{
        id: 'daily-challenge',
        type: 'challenge',
        icon: '🎯',
        title: '💪 Défi du jour : ' + dailyChallenge.title,
        description: 'Clique pour relever ton défi quotidien et améliorer tes compétences !',
        priority: 'important',
      }, ...withoutChallenge];
    });
  }, [dailyChallenge]);

  // ── Auto-refresh bilan when KPI entries update ────────────────────────────
  useEffect(() => {
    if (kpiEntries.length > 0 && currentWeekOffset === 0) {
      fetchBilanIndividuel(0); // eslint-disable-line react-hooks/exhaustive-deps
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kpiEntries]);

  // ── Initial data load ─────────────────────────────────────────────────────
  useEffect(() => {
    fetchData();
    fetchKpiConfig();
    fetchBilanIndividuel(0);
    fetchActiveObjectives();
    fetchDailyChallenge();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Fetch functions ───────────────────────────────────────────────────────

  const fetchData = async () => {
    try {
      const [evalsRes, salesRes, tasksRes, debriefsRes] = await Promise.all([
        api.get('/evaluations'),
        api.get('/sales'),
        api.get('/seller/tasks'),
        api.get('/debriefs'),
      ]);
      setEvaluations(evalsRes.data);
      setSales(salesRes.data);
      setDebriefs(debriefsRes.data);

      try {
        const liveRes = await api.get('/seller/diagnostic/me/live-scores');
        if (liveRes.data?.live_scores) {
          const { live_scores, diagnostic_age_days } = liveRes.data;
          setCompetencesHistory([{
            date: new Date().toISOString(),
            score_accueil: live_scores.score_accueil,
            score_decouverte: live_scores.score_decouverte,
            score_argumentation: live_scores.score_argumentation,
            score_closing: live_scores.score_closing,
            score_fidelisation: live_scores.score_fidelisation,
            days_since_diagnostic: diagnostic_age_days,
          }]);
        }
      } catch {
        setCompetencesHistory([]);
      }

      try {
        const diagRes = await api.get('/seller/diagnostic/me');
        if (diagRes.data?.status === 'completed' && diagRes.data?.diagnostic) {
          setDiagnostic(diagRes.data.diagnostic);
        }
      } catch { /* no diagnostic yet */ }

      if (user?.store_id) {
        try {
          const storeRes = await api.get(`/stores/${user.store_id}/info`);
          if (storeRes.data?.name) setStoreName(storeRes.data.name);
        } catch (err) {
          logger.error('Could not fetch store name:', err);
        }
      }

      if (user?.manager_name) {
        setManagerName(user.manager_name);
      } else if (user?.manager_id) {
        try {
          const meRes = await api.get('/auth/me');
          if (meRes.data?.manager_name) setManagerName(meRes.data.manager_name);
        } catch (err) {
          logger.error('Could not fetch manager name:', err);
        }
      }

      try {
        const _now = new Date();
        const today = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}-${String(_now.getDate()).padStart(2, '0')}`;

        const [kpiRes, datesRes] = await Promise.all([
          api.get('/seller/kpi-entries'),
          api.get(`/seller/dates-with-data?year=${_now.getFullYear()}&month=${_now.getMonth() + 1}`),
        ]);
        const rawKpi = kpiRes.data;
        const entries = Array.isArray(rawKpi) ? rawKpi : (rawKpi?.items ?? []);
        setKpiEntries(entries);
        setKpiEntriesPage(1);
        setKpiEntriesTotal(rawKpi?.total ?? entries.length);

        const kpiDates = datesRes.data?.dates ?? [];
        const hasTodayKPI = kpiDates.includes(today);

        let newTasks = [...tasksRes.data];
        if (!hasTodayKPI && !tasksRes.data.find(t => t.id === 'daily-kpi')) {
          newTasks = [{
            id: 'daily-kpi',
            type: 'kpi',
            icon: '📊',
            title: 'Saisir mes chiffres du jour',
            description: "Renseigne ton chiffre d'affaires, nombre de ventes et clients du jour",
            priority: 'normal',
          }, ...newTasks];
        }
        setTasks(newTasks);
      } catch {
        setKpiEntries([]);
        setTasks(tasksRes.data);
      }
    } catch (err) {
      logger.error('Error loading data:', err);
      if (err.response?.status === 403) {
        setAccessDenied403(true);
        const code = err.response?.data?.error_code;
        setAccessDeniedBlockCode(code || 'SUBSCRIPTION_INACTIVE');
      } else {
        toast.error('Erreur de chargement des données');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchDebriefs = async () => {
    try {
      const res = await api.get('/debriefs');
      setDebriefs(res.data);
    } catch (err) {
      logger.error('Error fetching debriefs:', err);
    }
  };

  const fetchKpiConfig = async () => {
    try {
      const storeParam = user?.store_id ? `?store_id=${user.store_id}` : '';
      const res = await api.get(`/seller/kpi-config${storeParam}`);
      setKpiConfig(res.data);
    } catch (err) {
      logger.error('Error fetching KPI config:', err);
    }
  };

  const lightRefresh = useCallback(async () => {
    if (loading) return;
    try {
      const [tasksRes, objectivesRes] = await Promise.all([
        api.get('/seller/tasks'),
        api.get('/seller/objectives/active'),
      ]);
      const today = new Date().toISOString().split('T')[0];
      try {
        const datesRes = await api.get('/seller/kpi-dates-with-data');
        const kpiDates = datesRes.data?.dates ?? [];
        const hasTodayKPI = kpiDates.includes(today);
        let newTasks = [...tasksRes.data];
        if (!hasTodayKPI && !tasksRes.data.find(t => t.id === 'daily-kpi')) {
          newTasks = [{
            id: 'daily-kpi', type: 'kpi', icon: '📊',
            title: 'Saisir mes chiffres du jour',
            description: "Renseigne ton chiffre d'affaires, nombre de ventes et clients du jour",
            priority: 'normal',
          }, ...newTasks];
        }
        setTasks(newTasks);
        setKpiEntries(prev => prev);
      } catch {
        setTasks(tasksRes.data);
      }
      setActiveObjectives(objectivesRes.data);
    } catch (err) {
      logger.error('Light refresh error:', err);
    }
  }, [loading]);

  useAutoRefresh(lightRefresh, 30_000, !loading);

  const fetchActiveObjectives = async () => {
    try {
      const res = await api.get('/seller/objectives/active');
      setActiveObjectives(res.data);
    } catch (err) {
      logger.error('Error fetching active objectives:', err);
    }
  };

  const fetchDailyChallenge = async () => {
    try {
      const res = await api.get('/seller/daily-challenge');
      setDailyChallenge(res.data);
    } catch (err) {
      logger.error('Error fetching daily challenge:', err);
    }
  };

  const fetchBilanForWeek = async (startDate, endDate, periode) => {
    try {
      const kpiRes = await api.get(`/seller/kpi-entries?start_date=${startDate}&end_date=${endDate}`);
      const raw = kpiRes.data;
      const allEntries = Array.isArray(raw) ? raw : (raw?.items ?? []);
      const kpi_resume = calculateWeeklyKPI(startDate, endDate, allEntries);

      const res = await api.get('/seller/bilan-individuel/all');
      const bilans = Array.isArray(res.data?.bilans) ? res.data.bilans : [];
      const existing = bilans.find(b => b.period_start === startDate && b.period_end === endDate);

      setBilanIndividuel(existing
        ? { ...existing, kpi_resume, periode }
        : { periode, kpi_resume, synthese: '', points_forts: [], points_attention: [], recommandations: [], competences_cles: [] }
      );
    } catch (err) {
      logger.error('Error fetching bilan for week:', err);
    }
  };

  const fetchBilanIndividuel = async (offset = 0) => {
    try {
      const { startISO, endISO, periode } = getWeekDates(offset);
      await fetchBilanForWeek(startISO, endISO, periode);
    } catch (err) {
      logger.error('Error fetching individual bilan:', err);
    }
  };

  const regenerateBilan = async () => {
    setGeneratingBilan(true);
    try {
      const { startISO, endISO } = getWeekDates(currentWeekOffset);
      await api.post(`/seller/bilan-individuel?start_date=${startISO}&end_date=${endISO}`, {});
      await fetchBilanIndividuel(currentWeekOffset);
      toast.success('✨ Bravo ! Bilan régénéré avec succès');
    } catch (err) {
      logger.error('Error regenerating bilan:', err);
      toast.error(getSubscriptionErrorMessage(err, user?.role) || 'Erreur lors de la régénération du bilan');
    } finally {
      setGeneratingBilan(false);
    }
  };

  const loadMoreKpiEntries = async () => {
    try {
      const nextPage = kpiEntriesPage + 1;
      const res = await api.get(`/seller/kpi-entries?page=${nextPage}`);
      const raw = res.data;
      const newEntries = Array.isArray(raw) ? raw : (raw?.items ?? []);
      setKpiEntries(prev => [...prev, ...newEntries]);
      setKpiEntriesPage(nextPage);
    } catch (err) {
      logger.error('Error loading more KPI entries:', err);
    }
  };

  const refreshCompetenceScores = async () => {
    try {
      const res = await api.get('/seller/diagnostic/me/live-scores');
      if (res.data?.live_scores) {
        const { live_scores, diagnostic_age_days } = res.data;
        setCompetencesHistory([{
          date: new Date().toISOString(),
          score_accueil: live_scores.score_accueil,
          score_decouverte: live_scores.score_decouverte,
          score_argumentation: live_scores.score_argumentation,
          score_closing: live_scores.score_closing,
          score_fidelisation: live_scores.score_fidelisation,
          days_since_diagnostic: diagnostic_age_days,
        }]);
        toast.success('✨ Tes compétences ont été mises à jour !');
      }
    } catch { /* no diagnostic yet */ }
  };

  return {
    // Data
    evaluations,
    sales,
    tasks,
    debriefs,
    competencesHistory,
    kpiEntries,
    kpiEntriesTotal,
    kpiConfig,
    diagnostic,
    dailyChallenge,
    bilanIndividuel,
    activeObjectives,
    storeName,
    managerName,
    // UI state
    loading,
    accessDenied403,
    accessDeniedBlockCode,
    currentWeekOffset,
    setCurrentWeekOffset,
    generatingBilan,
    // Setters needed by modals
    setDailyChallenge,
    // Actions
    fetchData,
    fetchDebriefs,
    fetchActiveObjectives,
    fetchDailyChallenge,
    fetchBilanIndividuel,
    refreshCompetenceScores,
    regenerateBilan,
    loadMoreKpiEntries,
  };
}
