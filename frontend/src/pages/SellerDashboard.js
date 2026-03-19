import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '../lib/apiClient';
import { logger } from '../utils/logger';
import { getSubscriptionErrorMessage } from '../utils/apiHelpers';
import { useSyncMode } from '../hooks/useSyncMode';
import { useOnboarding } from '../hooks/useOnboarding';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { getSellerSteps } from '../components/onboarding/sellerSteps';

// Section components
import SellerStatusBanners from '../components/sections/seller/SellerStatusBanners';
import SellerHeader from '../components/sections/seller/SellerHeader';
import SellerPersonalizationBar from '../components/sections/seller/SellerPersonalizationBar';
import SellerTaskList from '../components/sections/seller/SellerTaskList';
import SellerDashboardGrid from '../components/sections/seller/SellerDashboardGrid';
import SellerModalsLayer from '../components/sections/seller/SellerModalsLayer';

export default function SellerDashboard({ user, diagnostic: initialDiagnostic, onLogout }) {
  const navigate = useNavigate();
  const { isReadOnly, isSubscriptionExpired, subscriptionBlockCode } = useSyncMode();

  // ── Data state ─────────────────────────────────────────────
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

  // ── UI state ───────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [accessDenied403, setAccessDenied403] = useState(false);
  const [accessDeniedBlockCode, setAccessDeniedBlockCode] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);
  const [generatingBilan, setGeneratingBilan] = useState(false);
  const [initialTab, setInitialTab] = useState('bilan');

  // ── Modal state ────────────────────────────────────────────
  const [showEvalModal, setShowEvalModal] = useState(false);
  const [showDebriefModal, setShowDebriefModal] = useState(false);
  const [showDebriefHistoryModal, setShowDebriefHistoryModal] = useState(false);
  const [autoExpandDebriefId, setAutoExpandDebriefId] = useState(null);
  const [showKPIModal, setShowKPIModal] = useState(false);
  const [showKPIHistoryModal, setShowKPIHistoryModal] = useState(false);
  const [editingKPI, setEditingKPI] = useState(null);
  const [showKPIReporting, setShowKPIReporting] = useState(false);
  const [showChallengeHistoryModal, setShowChallengeHistoryModal] = useState(false);
  const [showDailyChallengeModal, setShowDailyChallengeModal] = useState(false);
  const [showDiagnosticModal, setShowDiagnosticModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [taskResponse, setTaskResponse] = useState('');
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showPerformanceModal, setShowPerformanceModal] = useState(false);
  const [showObjectivesModal, setShowObjectivesModal] = useState(false);
  const [showBilanModal, setShowBilanModal] = useState(false);
  const [showDiagnosticFormModal, setShowDiagnosticFormModal] = useState(false);
  const [showCompetencesModal, setShowCompetencesModal] = useState(false);
  const [showCoachingModal, setShowCoachingModal] = useState(false);
  const [showNotesNotebook, setShowNotesNotebook] = useState(false);
  const [showEvaluationModal, setShowEvaluationModal] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);

  // ── Onboarding ─────────────────────────────────────────────
  const [kpiMode, setKpiMode] = useState('VENDEUR_SAISIT');
  const sellerSteps = useMemo(() => getSellerSteps(kpiMode), [kpiMode]);
  const onboarding = useOnboarding(sellerSteps.length);

  // ── Dashboard personalization ──────────────────────────────
  const [dashboardFilters, setDashboardFilters] = useState(() => {
    const saved = localStorage.getItem('seller_dashboard_filters');
    return saved ? JSON.parse(saved) : {
      showPerformances: true,
      showObjectives: true,
      showCoaching: true,
      showPreparation: true,
      periodFilter: 'all',
    };
  });
  const [sectionOrder, setSectionOrder] = useState(() => {
    const saved = localStorage.getItem('seller_section_order');
    return saved ? JSON.parse(saved) : ['performances', 'objectives', 'coaching', 'preparation'];
  });

  const sectionNames = {
    performances: '📈 Mes Performances',
    objectives: '🎯 Objectifs & Challenges',
    coaching: '🤖 Mon coach IA',
    preparation: '📝 Préparer mon Entretien',
  };
  const availableSections = Object.keys(sectionNames);

  const finalOrder = useMemo(() => {
    const validOrder = sectionOrder.filter(id => availableSections.includes(id) && id !== 'profile');
    const missing = availableSections.filter(id => !validOrder.includes(id));
    return [...validOrder, ...missing];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionOrder]);

  // ── Persistence ────────────────────────────────────────────
  useEffect(() => {
    localStorage.setItem('seller_dashboard_filters', JSON.stringify(dashboardFilters));
  }, [dashboardFilters]);

  useEffect(() => {
    localStorage.setItem('seller_section_order', JSON.stringify(sectionOrder));
  }, [sectionOrder]);

  // ── Detect KPI mode for adaptive onboarding ────────────────
  useEffect(() => {
    const detectKpiMode = async () => {
      try {
        const res = await api.get('/seller/kpi-enabled');
        if (isReadOnly) setKpiMode('API_SYNC');
        else if (!res.data.enabled) setKpiMode('MANAGER_SAISIT');
        else setKpiMode('VENDEUR_SAISIT');
      } catch (error) {
        logger.error('Error detecting KPI mode:', error);
      }
    };
    detectKpiMode();
  }, [isReadOnly]);

  // ── Auto-add challenge task when dailyChallenge changes ────
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

  // ── Auto-refresh bilan when KPI entries update ─────────────
  useEffect(() => {
    if (kpiEntries.length > 0 && currentWeekOffset === 0) {
      fetchBilanIndividuel(0);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kpiEntries]);

  // ── Initial data load ──────────────────────────────────────
  useEffect(() => {
    fetchData();
    fetchKpiConfig();
    fetchBilanIndividuel(0);
    fetchActiveObjectives();
    fetchDailyChallenge();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Personalization helpers ────────────────────────────────
  const toggleFilter = (filterName) => {
    setDashboardFilters(prev => ({ ...prev, [filterName]: !prev[filterName] }));
  };

  const moveSectionUp = (sectionId) => {
    const idx = sectionOrder.indexOf(sectionId);
    if (idx > 0) {
      const next = [...sectionOrder];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      setSectionOrder(next);
    }
  };

  const moveSectionDown = (sectionId) => {
    const idx = sectionOrder.indexOf(sectionId);
    if (idx < sectionOrder.length - 1) {
      const next = [...sectionOrder];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      setSectionOrder(next);
    }
  };

  // ── KPI modal guard ────────────────────────────────────────
  const handleOpenKPIModal = (entry = null) => {
    if (isSubscriptionExpired) {
      toast.error('Abonnement magasin suspendu. Contactez votre gérant.', { duration: 4000, icon: '🔒' });
      return;
    }
    if (isReadOnly) {
      toast.info('Mode lecture seule - Saisie KPI désactivée', { duration: 3000 });
      return;
    }
    if (entry) setEditingKPI(entry);
    setShowKPIModal(true);
  };

  // ── Data fetch functions ───────────────────────────────────
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
        const today = `${_now.getFullYear()}-${String(_now.getMonth()+1).padStart(2,'0')}-${String(_now.getDate()).padStart(2,'0')}`;

        const [kpiRes, datesRes] = await Promise.all([
          api.get('/seller/kpi-entries'),
          api.get(`/seller/dates-with-data?year=${_now.getFullYear()}&month=${_now.getMonth() + 1}`),
        ]);
        const rawKpi = kpiRes.data;
        const entries = Array.isArray(rawKpi) ? rawKpi : (rawKpi?.items ?? []);
        setKpiEntries(entries);
        setKpiEntriesPage(1);
        setKpiEntriesTotal(rawKpi?.total ?? entries.length);

        // Use dates-with-data (same source as the calendar) so the task check
        // stays in sync even when KPI data is pushed via external API after page load.
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

  // ── Light refresh (polling collaborateurs) ─────────────────
  // Rafraîchit uniquement les données qui changent quand un collaborateur agit :
  // - Tâches   : manager crée objectif/challenge/rappel
  // - Objectifs: manager crée/modifie un objectif
  // - KPI dates: manager saisit les KPI (mode manager_saisit)
  const lightRefresh = useCallback(async () => {
    if (loading) return;
    try {
      const [tasksRes, objectivesRes] = await Promise.all([
        api.get('/seller/tasks'),
        api.get('/seller/objectives/active'),
      ]);
      // Réutiliser la logique tâche KPI du jour
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
        setKpiEntries(prev => prev); // pas de rechargement lourd
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

  const getWeekDates = (offset) => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(today);
    monday.setDate(today.getDate() + mondayOffset + offset * 7);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const fmt = (d) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(-2)}`;
    return {
      start: monday,
      end: sunday,
      startFormatted: fmt(monday),
      endFormatted: fmt(sunday),
      periode: `Semaine du ${fmt(monday)} au ${fmt(sunday)}`,
      startISO: monday.toISOString().split('T')[0],
      endISO: sunday.toISOString().split('T')[0],
    };
  };

  const calculateWeeklyKPI = (startDate, endDate, allEntries) => {
    const list = Array.isArray(allEntries) ? allEntries : [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    const week = list.filter(e => {
      const d = new Date(e.date);
      return d >= start && d <= end;
    });
    const kpi = { ca_total: 0, ventes: 0, articles: 0, prospects: 0, panier_moyen: 0, taux_transformation: 0, indice_vente: 0 };
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
  };

  const fetchBilanForWeek = async (startDate, endDate, periode) => {
    try {
      const kpiRes = await api.get(`/seller/kpi-entries?start_date=${startDate}&end_date=${endDate}`);
      const raw = kpiRes.data;
      const allEntries = Array.isArray(raw) ? raw : (raw?.items ?? []);
      const kpi_resume = calculateWeeklyKPI(startDate, endDate, allEntries);

      const res = await api.get('/seller/bilan-individuel/all');
      const bilans = Array.isArray(res.data?.bilans) ? res.data.bilans : [];
      // Match on ISO dates (period_start/period_end) — the stored `periode` string
      // uses "YYYY-MM-DD - YYYY-MM-DD" format while our local `periode` variable
      // uses "Semaine du DD/MM/YY au DD/MM/YY", so string equality always fails.
      const existing = bilans.find(b =>
        b.period_start === startDate && b.period_end === endDate
      );

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
      // Reload the full enriched bilan: kpi_resume calculé + periode au bon format
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

  // ── Task click handler ─────────────────────────────────────
  const handleSelectTask = (task) => {
    setSelectedTask(task);
    setShowTaskModal(true);
  };

  const handleOpenKpi = () => {
    setInitialTab('saisie');
    setShowPerformanceModal(true);
  };

  const handleOpenDiagnostic = (forceForm = false) => {
    if (forceForm || !diagnostic) {
      setShowDiagnosticFormModal(true);
    } else {
      setShowDiagnosticModal(true);
    }
  };

  if (loading) {
    return (
      <div data-testid="seller-loading" className="flex items-center justify-center min-h-screen">
        <div className="text-xl font-medium text-gray-600">Chargement...</div>
      </div>
    );
  }

  return (
    <div data-testid="seller-dashboard" className="min-h-screen p-4 md:p-8">
      <SellerStatusBanners
        accessDenied403={accessDenied403}
        subscriptionBlockCode={subscriptionBlockCode || accessDeniedBlockCode}
        isSubscriptionExpired={isSubscriptionExpired}
      />

      <SellerHeader
        user={user}
        storeName={storeName}
        managerName={managerName}
        diagnostic={diagnostic}
        onLogout={onLogout}
        onboarding={onboarding}
        onOpenProfile={() => setShowProfileModal(true)}
        onOpenDiagnosticForm={() => setShowDiagnosticFormModal(true)}
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters(f => !f)}
        onOpenSupport={() => setShowSupportModal(true)}
      />

      <SellerPersonalizationBar
        show={showFilters}
        dashboardFilters={dashboardFilters}
        toggleFilter={toggleFilter}
        finalOrder={finalOrder}
        sectionNames={sectionNames}
        moveSectionUp={moveSectionUp}
        moveSectionDown={moveSectionDown}
        onClose={() => setShowFilters(false)}
      />

      <div className="max-w-7xl mx-auto flex flex-col">
        {/* Tasks section */}
        <div className={`glass-morphism rounded-2xl ${tasks.length > 0 ? 'p-3 mb-6' : 'p-1 mb-2'} border border-[#1E40AF]`}>
          {tasks.length > 0 && (
            <h2 className="text-lg font-bold text-gray-800 mb-2">Mes tâches à faire</h2>
          )}
          <SellerTaskList
            tasks={tasks}
            diagnostic={diagnostic}
            onOpenDiagnostic={handleOpenDiagnostic}
            onOpenKpi={handleOpenKpi}
            onOpenCoaching={() => setShowCoachingModal(true)}
            onOpenDebrief={() => setShowDebriefModal(true)}
            onOpenBilan={() => { setInitialTab('bilan'); setShowPerformanceModal(true); }}
            onOpenObjectives={() => setShowObjectivesModal(true)}
            onSelectTask={handleSelectTask}
          />
        </div>

        <SellerDashboardGrid
          finalOrder={finalOrder}
          dashboardFilters={dashboardFilters}
          activeObjectives={activeObjectives}
          onOpenPerformance={() => setShowPerformanceModal(true)}
          onOpenObjectives={() => setShowObjectivesModal(true)}
          onOpenCoaching={() => setShowCoachingModal(true)}
          onOpenNotes={() => setShowNotesNotebook(true)}
        />
      </div>

      <SellerModalsLayer
        // Data
        sales={sales}
        debriefs={debriefs}
        kpiEntries={kpiEntries}
        kpiConfig={kpiConfig}
        activeObjectives={activeObjectives}
        dailyChallenge={dailyChallenge}
        bilanIndividuel={bilanIndividuel}
        currentWeekOffset={currentWeekOffset}
        generatingBilan={generatingBilan}
        initialTab={initialTab}
        // Modal visibility
        showEvalModal={showEvalModal}
        showDebriefModal={showDebriefModal}
        showDebriefHistoryModal={showDebriefHistoryModal}
        showKPIModal={showKPIModal}
        showKPIHistoryModal={showKPIHistoryModal}
        showChallengeHistoryModal={showChallengeHistoryModal}
        showDailyChallengeModal={showDailyChallengeModal}
        showDiagnosticModal={showDiagnosticModal}
        showTaskModal={showTaskModal}
        showProfileModal={showProfileModal}
        showPerformanceModal={showPerformanceModal}
        showObjectivesModal={showObjectivesModal}
        showBilanModal={showBilanModal}
        showDiagnosticFormModal={showDiagnosticFormModal}
        showCompetencesModal={showCompetencesModal}
        showKPIReporting={showKPIReporting}
        showCoachingModal={showCoachingModal}
        showNotesNotebook={showNotesNotebook}
        showEvaluationModal={showEvaluationModal}
        showSupportModal={showSupportModal}
        // Modal setters
        setShowEvalModal={setShowEvalModal}
        setShowDebriefModal={setShowDebriefModal}
        setShowDebriefHistoryModal={setShowDebriefHistoryModal}
        setShowKPIModal={setShowKPIModal}
        setShowKPIHistoryModal={setShowKPIHistoryModal}
        setShowChallengeHistoryModal={setShowChallengeHistoryModal}
        setShowDailyChallengeModal={setShowDailyChallengeModal}
        setShowDiagnosticModal={setShowDiagnosticModal}
        setShowTaskModal={setShowTaskModal}
        setShowProfileModal={setShowProfileModal}
        setShowPerformanceModal={setShowPerformanceModal}
        setShowObjectivesModal={setShowObjectivesModal}
        setShowBilanModal={setShowBilanModal}
        setShowDiagnosticFormModal={setShowDiagnosticFormModal}
        setShowCompetencesModal={setShowCompetencesModal}
        setShowKPIReporting={setShowKPIReporting}
        setShowCoachingModal={setShowCoachingModal}
        setShowNotesNotebook={setShowNotesNotebook}
        setShowEvaluationModal={setShowEvaluationModal}
        setShowSupportModal={setShowSupportModal}
        // Task modal
        selectedTask={selectedTask}
        taskResponse={taskResponse}
        setTaskResponse={setTaskResponse}
        // KPI edit
        editingKPI={editingKPI}
        setEditingKPI={setEditingKPI}
        // Auto-expand debrief
        autoExpandDebriefId={autoExpandDebriefId}
        setAutoExpandDebriefId={setAutoExpandDebriefId}
        // Week navigation
        setCurrentWeekOffset={setCurrentWeekOffset}
        setInitialTab={setInitialTab}
        // Data setters
        setDailyChallenge={setDailyChallenge}
        // Actions
        fetchData={fetchData}
        fetchDebriefs={fetchDebriefs}
        fetchActiveObjectives={fetchActiveObjectives}
        fetchDailyChallenge={fetchDailyChallenge}
        fetchBilanIndividuel={fetchBilanIndividuel}
        refreshCompetenceScores={refreshCompetenceScores}
        regenerateBilan={regenerateBilan}
        loadMoreKpiEntries={loadMoreKpiEntries}
        kpiEntriesTotal={kpiEntriesTotal}
        handleOpenKPIModal={handleOpenKPIModal}
        // Onboarding
        onboarding={onboarding}
        sellerSteps={sellerSteps}
      />
    </div>
  );
}
