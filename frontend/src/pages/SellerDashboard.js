import React, { useState, useEffect, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { useSyncMode } from '../hooks/useSyncMode';
import { useOnboarding } from '../hooks/useOnboarding';
import { getSellerSteps } from '../components/onboarding/sellerSteps';

// Section components
import SellerStatusBanners from '../components/sections/seller/SellerStatusBanners';
import SellerHeader from '../components/sections/seller/SellerHeader';
import SellerPersonalizationBar from '../components/sections/seller/SellerPersonalizationBar';
import SellerTaskList from '../components/sections/seller/SellerTaskList';
import SellerDashboardGrid from '../components/sections/seller/SellerDashboardGrid';
import SellerModalsLayer from '../components/sections/seller/SellerModalsLayer';
import SellerCompetencesRadar from '../components/sections/seller/SellerCompetencesRadar';

// Dashboard-scoped hooks
import { useSellerDashboardData } from './sellerDashboard/useSellerDashboardData';
import { useSellerPersonalization, SECTION_NAMES } from './sellerDashboard/useSellerPersonalization';

export default function SellerDashboard({ user, diagnostic: initialDiagnostic, onLogout }) {
  const { isReadOnly, isSubscriptionExpired, subscriptionBlockCode } = useSyncMode();

  // ── Data + data-fetch logic ────────────────────────────────
  const data = useSellerDashboardData({ user, initialDiagnostic, isReadOnly, isSubscriptionExpired });

  // ── Dashboard personalization ──────────────────────────────
  const { dashboardFilters, finalOrder, toggleFilter, moveSectionUp, moveSectionDown } =
    useSellerPersonalization();

  // ── UI state ───────────────────────────────────────────────
  const [showFilters, setShowFilters] = useState(false);
  const [initialTab, setInitialTab] = useState('bilan');

  // ── Modal registry ─────────────────────────────────────────
  const [modals, setModals] = useState({
    eval: false, debrief: false, debriefHistory: false, kpi: false, kpiHistory: false,
    challengeHistory: false, dailyChallenge: false, diagnostic: false, profile: false,
    performance: false, objectives: false, bilan: false, diagnosticForm: false,
    competences: false, kpiReporting: false, coaching: false, notesNotebook: false,
    evaluation: false, support: false, managerCompat: false,
  });
  const setModal = (name, value) => setModals(prev => ({ ...prev, [name]: value }));

  // ── Modal-adjacent state (carry data, not just open/close) ─
  const [editingKPI, setEditingKPI] = useState(null);
  const [autoExpandDebriefId, setAutoExpandDebriefId] = useState(null);
  const [initialObjectiveId, setInitialObjectiveId] = useState(null);

  // ── Onboarding ─────────────────────────────────────────────
  const [kpiMode, setKpiMode] = useState('VENDEUR_SAISIT');
  const [kpiModeReady, setKpiModeReady] = useState(false);
  const onboardingRef = useRef(null);
  const sellerSteps = useMemo(() => getSellerSteps(kpiMode, {
    openDiagnostic: () => { onboardingRef.current?.close(); setModal('diagnosticForm', true); },
    openKPI: () => { onboardingRef.current?.close(); handleOpenKPIModal(); },
  }), [kpiMode]); // eslint-disable-line react-hooks/exhaustive-deps
  const onboarding = useOnboarding(sellerSteps.length, { readyToAutoOpen: kpiModeReady });
  onboardingRef.current = onboarding;

  // ── Detect KPI mode for adaptive onboarding ────────────────
  useEffect(() => {
    const detectKpiMode = async () => {
      try {
        const { api } = await import('../lib/apiClient');
        const res = await api.get('/seller/kpi-enabled');
        if (isReadOnly) setKpiMode('API_SYNC');
        else if (!res.data.enabled) setKpiMode('MANAGER_SAISIT');
        else setKpiMode('VENDEUR_SAISIT');
      } catch { /* keep default VENDEUR_SAISIT */ }
      setKpiModeReady(true); // toujours signaler que le mode est résolu (succès ou erreur)
    };
    detectKpiMode();
  }, [isReadOnly]);

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
    setModal('kpi', true);
  };

  const handleOpenKpi = () => {
    setInitialTab('saisie');
    setModal('performance', true);
  };

  const handleOpenDiagnostic = (forceForm = false) => {
    if (forceForm || !data.diagnostic) {
      setModal('diagnosticForm', true);
    } else {
      setModal('profile', true);
    }
  };

  if (data.loading) {
    return (
      <div data-testid="seller-loading" className="flex items-center justify-center min-h-screen">
        <div className="text-xl font-medium text-gray-600">Chargement...</div>
      </div>
    );
  }

  return (
    <div data-testid="seller-dashboard" className="min-h-screen p-4 md:p-8">
      <SellerStatusBanners
        accessDenied403={data.accessDenied403}
        subscriptionBlockCode={subscriptionBlockCode || data.accessDeniedBlockCode}
        isSubscriptionExpired={isSubscriptionExpired}
      />

      <SellerHeader
        user={user}
        storeName={data.storeName}
        managerName={data.managerName}
        diagnostic={data.diagnostic}
        onLogout={onLogout}
        onboarding={onboarding}
        onOpenProfile={() => setModal('profile', true)}
        onOpenDiagnosticForm={() => setModal('diagnosticForm', true)}
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters(f => !f)}
        onOpenSupport={() => setModal('support', true)}
        onOpenManagerCompat={() => setModal('managerCompat', true)}
      />

      <SellerPersonalizationBar
        show={showFilters}
        dashboardFilters={dashboardFilters}
        toggleFilter={toggleFilter}
        finalOrder={finalOrder}
        sectionNames={SECTION_NAMES}
        moveSectionUp={moveSectionUp}
        moveSectionDown={moveSectionDown}
        onClose={() => setShowFilters(false)}
      />

      <div className="max-w-7xl mx-auto flex flex-col">
        {/* Tasks section */}
        <div className={`glass-morphism rounded-2xl ${data.tasks.length > 0 ? 'p-3 mb-6' : 'p-1 mb-2'} border border-[#1E40AF]`}>
          {data.tasks.length > 0 && (
            <h2 className="text-lg font-bold text-gray-800 mb-2">Mes tâches à faire</h2>
          )}
          <SellerTaskList
            tasks={data.tasks}
            diagnostic={data.diagnostic}
            onOpenDiagnostic={handleOpenDiagnostic}
            onOpenKpi={handleOpenKpi}
            onOpenCoaching={() => setModal('coaching', true)}
            onOpenDebrief={() => setModal('debrief', true)}
            onOpenBilan={() => { setInitialTab('bilan'); setModal('performance', true); }}
            onOpenObjectives={(objectiveId) => {
              setInitialObjectiveId(objectiveId || null);
              setModal('objectives', true);
            }}
          />
        </div>

        <SellerDashboardGrid
          finalOrder={finalOrder}
          dashboardFilters={dashboardFilters}
          activeObjectives={data.activeObjectives}
          onOpenPerformance={() => setModal('performance', true)}
          onOpenObjectives={() => setModal('objectives', true)}
          onOpenCoaching={() => setModal('coaching', true)}
          onOpenNotes={() => setModal('notesNotebook', true)}
        />

        <SellerCompetencesRadar competencesHistory={data.competencesHistory} />
      </div>

      <SellerModalsLayer
        // Data
        sales={data.sales}
        debriefs={data.debriefs}
        kpiEntries={data.kpiEntries}
        kpiConfig={data.kpiConfig}
        activeObjectives={data.activeObjectives}
        dailyChallenge={data.dailyChallenge}
        bilanIndividuel={data.bilanIndividuel}
        currentWeekOffset={data.currentWeekOffset}
        generatingBilan={data.generatingBilan}
        initialTab={initialTab}
        // Modal registry
        modals={modals}
        setModal={setModal}
        // Modal-adjacent state
        initialObjectiveId={initialObjectiveId}
        setInitialObjectiveId={setInitialObjectiveId}
        editingKPI={editingKPI}
        setEditingKPI={setEditingKPI}
        autoExpandDebriefId={autoExpandDebriefId}
        setAutoExpandDebriefId={setAutoExpandDebriefId}
        // Week / tab navigation
        setCurrentWeekOffset={data.setCurrentWeekOffset}
        setInitialTab={setInitialTab}
        // Data setters
        setDailyChallenge={data.setDailyChallenge}
        // Actions
        fetchData={data.fetchData}
        fetchDebriefs={data.fetchDebriefs}
        fetchActiveObjectives={data.fetchActiveObjectives}
        fetchDailyChallenge={data.fetchDailyChallenge}
        fetchBilanIndividuel={data.fetchBilanIndividuel}
        refreshCompetenceScores={data.refreshCompetenceScores}
        regenerateBilan={data.regenerateBilan}
        loadMoreKpiEntries={data.loadMoreKpiEntries}
        kpiEntriesTotal={data.kpiEntriesTotal}
        handleOpenKPIModal={handleOpenKPIModal}
        // Onboarding
        onboarding={onboarding}
        sellerSteps={sellerSteps}
      />
    </div>
  );
}
