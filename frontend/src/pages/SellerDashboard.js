import React, { useState, useEffect, useMemo } from 'react';
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
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showPerformanceModal, setShowPerformanceModal] = useState(false);
  const [showObjectivesModal, setShowObjectivesModal] = useState(false);
  const [initialObjectiveId, setInitialObjectiveId] = useState(null);
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

  // ── Detect KPI mode for adaptive onboarding ────────────────
  useEffect(() => {
    const detectKpiMode = async () => {
      try {
        const { api } = await import('../lib/apiClient');
        const res = await api.get('/seller/kpi-enabled');
        if (isReadOnly) setKpiMode('API_SYNC');
        else if (!res.data.enabled) setKpiMode('MANAGER_SAISIT');
        else setKpiMode('VENDEUR_SAISIT');
      } catch { /* keep default */ }
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
    setShowKPIModal(true);
  };

  const handleOpenKpi = () => {
    setInitialTab('saisie');
    setShowPerformanceModal(true);
  };

  const handleOpenDiagnostic = (forceForm = false) => {
    if (forceForm || !data.diagnostic) {
      setShowDiagnosticFormModal(true);
    } else {
      setShowDiagnosticModal(true);
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
            onOpenCoaching={() => setShowCoachingModal(true)}
            onOpenDebrief={() => setShowDebriefModal(true)}
            onOpenBilan={() => { setInitialTab('bilan'); setShowPerformanceModal(true); }}
            onOpenObjectives={(objectiveId) => {
              setInitialObjectiveId(objectiveId || null);
              setShowObjectivesModal(true);
            }}
          />
        </div>

        <SellerDashboardGrid
          finalOrder={finalOrder}
          dashboardFilters={dashboardFilters}
          activeObjectives={data.activeObjectives}
          onOpenPerformance={() => setShowPerformanceModal(true)}
          onOpenObjectives={() => setShowObjectivesModal(true)}
          onOpenCoaching={() => setShowCoachingModal(true)}
          onOpenNotes={() => setShowNotesNotebook(true)}
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
        // Modal visibility
        showEvalModal={showEvalModal}
        showDebriefModal={showDebriefModal}
        showDebriefHistoryModal={showDebriefHistoryModal}
        showKPIModal={showKPIModal}
        showKPIHistoryModal={showKPIHistoryModal}
        showChallengeHistoryModal={showChallengeHistoryModal}
        showDailyChallengeModal={showDailyChallengeModal}
        showDiagnosticModal={showDiagnosticModal}
        showProfileModal={showProfileModal}
        showPerformanceModal={showPerformanceModal}
        showObjectivesModal={showObjectivesModal}
        initialObjectiveId={initialObjectiveId}
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
        setShowProfileModal={setShowProfileModal}
        setShowPerformanceModal={setShowPerformanceModal}
        setShowObjectivesModal={setShowObjectivesModal}
        setInitialObjectiveId={setInitialObjectiveId}
        setShowBilanModal={setShowBilanModal}
        setShowDiagnosticFormModal={setShowDiagnosticFormModal}
        setShowCompetencesModal={setShowCompetencesModal}
        setShowKPIReporting={setShowKPIReporting}
        setShowCoachingModal={setShowCoachingModal}
        setShowNotesNotebook={setShowNotesNotebook}
        setShowEvaluationModal={setShowEvaluationModal}
        setShowSupportModal={setShowSupportModal}
        // KPI edit
        editingKPI={editingKPI}
        setEditingKPI={setEditingKPI}
        // Auto-expand debrief
        autoExpandDebriefId={autoExpandDebriefId}
        setAutoExpandDebriefId={setAutoExpandDebriefId}
        // Week navigation
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
