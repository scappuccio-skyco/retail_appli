import { useState, useEffect, useMemo, useCallback } from 'react';
import { unstable_batchedUpdates } from 'react-dom';
import { toast } from 'sonner';
import { api } from '../../lib/apiClient';
import { logger } from '../../utils/logger';
import { useSyncMode } from '../../hooks/useSyncMode';
import { useOnboarding } from '../../hooks/useOnboarding';
import { getManagerSteps } from '../../components/onboarding/managerSteps';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';

export default function useManagerDashboard({ user }) {
  // ── URL params (gerant-as-manager mode) ────────────────────
  const urlParams = new URLSearchParams(globalThis.location.search);
  const urlStoreId = urlParams.get('store_id');
  const effectiveStoreId = urlStoreId || user?.store_id;
  const apiStoreIdParam = urlStoreId ? `?store_id=${urlStoreId}` : '';

  const { canEditKPIConfig, isReadOnly, isSubscriptionExpired, subscriptionBlockCode } = useSyncMode(urlStoreId);

  // ── Onboarding ─────────────────────────────────────────────
  const [kpiMode, setKpiMode] = useState('VENDEUR_SAISIT');
  const managerSteps = useMemo(() => getManagerSteps(kpiMode), [kpiMode]);
  const onboarding = useOnboarding(managerSteps.length);

  // ── Data state ─────────────────────────────────────────────
  const [sellers, setSellers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [managerDiagnostic, setManagerDiagnostic] = useState(null);
  const [teamBilan, setTeamBilan] = useState(null);
  const [kpiConfig, setKpiConfig] = useState(null);
  const [activeObjectives, setActiveObjectives] = useState([]);
  const [storeKPIStats, setStoreKPIStats] = useState(null);
  const [storeName, setStoreName] = useState('');
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);
  const [managerTasks, setManagerTasks] = useState([]);

  // ── UI state ───────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [processingStripeReturn, setProcessingStripeReturn] = useState(false);
  const [generatingTeamBilan, setGeneratingTeamBilan] = useState(false);
  const [generatingAIAdvice, setGeneratingAIAdvice] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // ── Modal state ────────────────────────────────────────────
  const [showKPIConfigModal, setShowKPIConfigModal] = useState(false);
  const [showManagerDiagnostic, setShowManagerDiagnostic] = useState(false);
  const [showManagerProfileModal, setShowManagerProfileModal] = useState(false);
  const [showTeamBilanModal, setShowTeamBilanModal] = useState(false);
  const [showDetailView, setShowDetailView] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsModalType, setSettingsModalType] = useState('objectives');
  const [initialObjectiveId, setInitialObjectiveId] = useState(null);
  const [showStoreKPIModal, setShowStoreKPIModal] = useState(false);
  const [kpiModalVariant, setKpiModalVariant] = useState('A');
  const [teamModalVariant, setTeamModalVariant] = useState('A');
  const [settingsVariant, setSettingsVariant] = useState('A');
  const [relationshipVariant, setRelationshipVariant] = useState('A');
  const [showRelationshipModal, setShowRelationshipModal] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [showMorningBriefModal, setShowMorningBriefModal] = useState(false);
  const [selectedSeller, setSelectedSeller] = useState(null);
  const [autoShowRelationshipResult, setAutoShowRelationshipResult] = useState(false);

  // ── Dashboard personalization ──────────────────────────────
  const [dashboardFilters, setDashboardFilters] = useState(() => {
    const saved = localStorage.getItem('manager_dashboard_filters');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.showRelationship === undefined) return { ...parsed, showRelationship: true };
      return parsed;
    }
    return { showKPI: true, showTeam: true, showObjectives: true, showRelationship: true };
  });

  const [sectionOrder, setSectionOrder] = useState(() => {
    const saved = localStorage.getItem('manager_section_order');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (!parsed.includes('relationship')) return [...parsed, 'relationship'];
      return parsed;
    }
    return ['kpi', 'team', 'objectives', 'relationship'];
  });

  // ── Derived ────────────────────────────────────────────────
  const spaceLabel = (user?.role === 'gerant' || user?.role === 'gérant') ? 'Espace Gérant' : 'Espace Manager';
  const isGerantSpace = (user?.role === 'gerant' || user?.role === 'gérant');

  // ── Persistence ────────────────────────────────────────────
  useEffect(() => {
    localStorage.setItem('manager_dashboard_filters', JSON.stringify(dashboardFilters));
  }, [dashboardFilters]);

  useEffect(() => {
    localStorage.setItem('manager_section_order', JSON.stringify(sectionOrder));
  }, [sectionOrder]);

  // ── Detect KPI mode ────────────────────────────────────────
  useEffect(() => {
    const detectKpiMode = async () => {
      try {
        const res = await api.get(`/seller/kpi-enabled${apiStoreIdParam}`);
        if (isReadOnly) setKpiMode('API_SYNC');
        else if (!res.data.enabled) setKpiMode('MANAGER_SAISIT');
        else setKpiMode('VENDEUR_SAISIT');
      } catch (error) {
        logger.error('Error detecting KPI mode:', error);
      }
    };
    detectKpiMode();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReadOnly]);

  // ── Initial load ───────────────────────────────────────────
  useEffect(() => {
    const sessionId = new URLSearchParams(globalThis.location.search).get('session_id');
    if (sessionId) {
      handleStripeCheckoutReturn(sessionId);
    } else {
      loadAll();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadAll = () => {
    fetchData();
    fetchManagerDiagnostic();
    fetchTeamBilan();
    fetchKpiConfig();
    fetchActiveObjectives();
    fetchStoreKPIStats();
    fetchManagerTasks();
  };

  const fetchManagerTasks = async () => {
    try {
      const res = await api.get(`/manager/tasks${apiStoreIdParam}`);
      setManagerTasks(res.data || []);
    } catch (err) {
      logger.error('Error fetching manager tasks:', err);
    }
  };

  // ── Light refresh (polling) ────────────────────────────────
  const lightRefresh = useCallback(async () => {
    if (loading) return;
    try {
      const [tasksRes, sellersRes] = await Promise.all([
        api.get(`/manager/tasks${apiStoreIdParam}`),
        api.get(`/manager/sellers${apiStoreIdParam}`),
      ]);
      setManagerTasks(tasksRes.data || []);
      const sellersList = sellersRes.data?.sellers ?? sellersRes.data;
      setSellers(Array.isArray(sellersList) ? sellersList : []);
    } catch (err) {
      logger.error('Light refresh error:', err);
    }
  }, [loading, apiStoreIdParam]);

  useAutoRefresh(lightRefresh, 30_000, !loading);

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

  // ── Stripe checkout return ─────────────────────────────────
  const handleStripeCheckoutReturn = async (sessionId) => {
    unstable_batchedUpdates(() => {
      setProcessingStripeReturn(true);
      setLoading(true);
    });
    try {
      globalThis.history.replaceState({}, document.title, '/dashboard');
      const loadingToast = toast.loading('🔄 Vérification du paiement en cours...');
      const response = await api.get(`/checkout/status/${sessionId}`);
      toast.dismiss(loadingToast);

      if (response.data.status === 'paid') {
        toast.success('🎉 Paiement réussi ! Votre abonnement est maintenant actif.', { duration: 5000 });
        unstable_batchedUpdates(() => { setLoading(false); setProcessingStripeReturn(false); });
        setTimeout(() => globalThis.location.reload(), 2000);
      } else {
        if (response.data.status === 'pending') {
          toast.info('⏳ Paiement en cours de traitement...', { duration: 5000 });
        } else {
          toast.error("❌ Le paiement n'a pas pu être confirmé. Contactez le support si le problème persiste.", { duration: 6000 });
        }
        unstable_batchedUpdates(() => setProcessingStripeReturn(false));
        loadAll();
      }
    } catch (error) {
      logger.error('Error checking payment status:', error);
      toast.error('Erreur lors de la vérification du paiement. Veuillez rafraîchir la page.', { duration: 5000 });
      unstable_batchedUpdates(() => setProcessingStripeReturn(false));
      loadAll();
    }
  };

  // ── Data fetch functions ───────────────────────────────────
  const fetchData = async () => {
    try {
      const [sellersRes, invitesRes] = await Promise.all([
        api.get(`/manager/sellers${apiStoreIdParam}`),
        api.get(`/manager/invitations${apiStoreIdParam}`),
      ]);
      const sellersList = sellersRes.data?.sellers ?? sellersRes.data;
      setSellers(Array.isArray(sellersList) ? sellersList : []);
      setInvitations(Array.isArray(invitesRes.data) ? invitesRes.data : []);

      if (effectiveStoreId) {
        try {
          const storeRes = await api.get(`/stores/${effectiveStoreId}/info`);
          if (storeRes.data?.name) setStoreName(storeRes.data.name);
        } catch (err) {
          logger.error('Could not fetch store name:', err);
        }
      }
    } catch {
      toast.error('Erreur de chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const fetchManagerDiagnostic = async () => {
    try {
      const res = await api.get(`/manager-diagnostic/me${apiStoreIdParam}`);
      if (res.data.status === 'completed') setManagerDiagnostic(res.data.diagnostic);
    } catch (err) {
      logger.error('Error fetching manager diagnostic:', err);
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
      startISO: monday.toISOString().split('T')[0],
      endISO: sunday.toISOString().split('T')[0],
      periode: `Semaine du ${fmt(monday)} au ${fmt(sunday)}`,
    };
  };

  const fetchBilanForWeek = async (startDate, endDate, periode) => {
    try {
      const res = await api.get(`/manager/team-bilans/all${apiStoreIdParam}`);
      if (res.data.status === 'success' && res.data.bilans) {
        const bilan = res.data.bilans.find(b => b.periode === periode);
        setTeamBilan(bilan ?? { periode, synthese: '', kpi_resume: {}, points_forts: [], points_attention: [], recommandations: [] });
      }
    } catch (err) {
      logger.error('Error fetching bilan for week:', err);
    }
  };

  const fetchTeamBilan = async () => {
    try {
      const { startISO, endISO, periode } = getWeekDates(0);
      await fetchBilanForWeek(startISO, endISO, periode);
    } catch (err) {
      logger.error('Error fetching team bilan:', err);
    }
  };

  const fetchKpiConfig = async () => {
    try {
      const res = await api.get(`/manager/kpi-config${apiStoreIdParam}`);
      setKpiConfig(res.data);
    } catch (err) {
      logger.error('Error fetching KPI config:', err);
    }
  };

  const fetchActiveObjectives = async () => {
    try {
      const res = await api.get(`/manager/objectives/active${apiStoreIdParam}`);
      setActiveObjectives(res.data);
    } catch (err) {
      logger.error('Error fetching active objectives:', err);
    }
  };

  const fetchStoreKPIStats = async () => {
    try {
      const res = await api.get(`/manager/store-kpi/stats${apiStoreIdParam}`);
      setStoreKPIStats(res.data);
    } catch (err) {
      logger.error('Error fetching store KPI stats:', err);
    }
  };

  return {
    // URL/store
    urlStoreId, effectiveStoreId, apiStoreIdParam,
    // Sync mode
    canEditKPIConfig, isReadOnly, isSubscriptionExpired, subscriptionBlockCode,
    // Onboarding
    kpiMode, onboarding, managerSteps,
    // Data
    sellers, invitations, managerDiagnostic, teamBilan, kpiConfig,
    activeObjectives, storeKPIStats, storeName, managerTasks,
    // UI
    loading, processingStripeReturn, generatingTeamBilan, generatingAIAdvice, setGeneratingAIAdvice,
    showFilters, setShowFilters,
    // Modals
    showKPIConfigModal, setShowKPIConfigModal,
    showManagerDiagnostic, setShowManagerDiagnostic,
    showManagerProfileModal, setShowManagerProfileModal,
    showTeamBilanModal, setShowTeamBilanModal,
    showDetailView, setShowDetailView,
    showTeamModal, setShowTeamModal,
    showSettingsModal, setShowSettingsModal,
    settingsModalType, setSettingsModalType,
    initialObjectiveId, setInitialObjectiveId,
    showStoreKPIModal, setShowStoreKPIModal,
    kpiModalVariant, setKpiModalVariant,
    teamModalVariant, setTeamModalVariant,
    settingsVariant, setSettingsVariant,
    relationshipVariant, setRelationshipVariant,
    showRelationshipModal, setShowRelationshipModal,
    showSupportModal, setShowSupportModal,
    showMorningBriefModal, setShowMorningBriefModal,
    selectedSeller, setSelectedSeller,
    autoShowRelationshipResult, setAutoShowRelationshipResult,
    // Personalization
    dashboardFilters, sectionOrder, toggleFilter, moveSectionUp, moveSectionDown,
    // Derived
    spaceLabel, isGerantSpace,
    // Actions
    fetchData, fetchManagerDiagnostic, fetchActiveObjectives, fetchKpiConfig, fetchStoreKPIStats,
  };
}
