import React from 'react';
import useManagerDashboard from './managerDashboard/useManagerDashboard';

import ManagerStatusBanner from '../components/sections/manager/ManagerStatusBanner';
import ManagerHeader from '../components/sections/manager/ManagerHeader';
import ManagerPersonalizationBar from '../components/sections/manager/ManagerPersonalizationBar';
import ManagerDashboardGrid from '../components/sections/manager/ManagerDashboardGrid';
import ManagerModalsLayer from '../components/sections/manager/ManagerModalsLayer';
import ManagerTaskList from '../components/ManagerTaskList';

export default function ManagerDashboard({ user, onLogout }) {
  const s = useManagerDashboard({ user });

  if (s.loading) {
    return (
      <div data-testid="manager-loading" className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-white">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-b-4 border-[#1E40AF] mb-4" />
          <div className="text-xl font-medium text-gray-700">
            {s.processingStripeReturn ? '🔄 Vérification du paiement...' : 'Chargement...'}
          </div>
          {s.processingStripeReturn && (
            <div className="text-sm text-gray-500 mt-2">
              Merci de patienter, nous finalisons votre abonnement.
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div data-testid="manager-dashboard" className="min-h-screen p-4 md:p-8">
      <ManagerStatusBanner subscriptionBlockCode={s.subscriptionBlockCode} />

      <ManagerHeader
        user={user}
        storeName={s.storeName}
        managerDiagnostic={s.managerDiagnostic}
        onLogout={onLogout}
        onboarding={s.onboarding}
        onOpenProfile={() => s.setShowManagerProfileModal(true)}
        onOpenDiagnostic={() => s.setShowManagerDiagnostic(true)}
        showFilters={s.showFilters}
        onToggleFilters={() => s.setShowFilters(f => !f)}
        onOpenSupport={() => s.setShowSupportModal(true)}
        spaceLabel={s.spaceLabel}
        isGerantSpace={s.isGerantSpace}
      />

      <ManagerPersonalizationBar
        show={s.showFilters}
        dashboardFilters={s.dashboardFilters}
        toggleFilter={s.toggleFilter}
        sectionOrder={s.sectionOrder}
        moveSectionUp={s.moveSectionUp}
        moveSectionDown={s.moveSectionDown}
        onClose={() => s.setShowFilters(false)}
      />

      <div className={`glass-morphism rounded-2xl ${s.managerTasks.length > 0 ? 'p-3 mb-6' : 'p-1 mb-2'} border border-[#1E40AF]`}>
        {s.managerTasks.length > 0 && (
          <p className="text-xs font-semibold text-[#1E40AF] mb-2 px-1">📋 Mes tâches à faire</p>
        )}
        <ManagerTaskList
          tasks={s.managerTasks}
          onOpenDiagnostic={() => s.setShowManagerDiagnostic(true)}
          onViewSellerNotes={(sellerId) => {
            const seller = s.sellers.find(sel => sel.id === sellerId);
            if (seller) { s.setSelectedSeller({ ...seller, _openTab: 'notes' }); s.setShowDetailView(true); }
          }}
          onViewSellerDetail={(sellerId) => {
            const seller = s.sellers.find(sel => sel.id === sellerId);
            if (seller) { s.setSelectedSeller(seller); s.setShowDetailView(true); }
          }}
          onCreateGoal={(objectiveId) => {
            s.setSettingsModalType('objectives');
            s.setInitialObjectiveId(objectiveId || null);
            s.setShowSettingsModal(true);
          }}
          onSendReminder={(sellerId) => {
            const seller = s.sellers.find(sel => sel.id === sellerId);
            if (seller) { s.setSelectedSeller({ ...seller, _openTab: 'reminder' }); s.setShowDetailView(true); }
          }}
        />
      </div>

      <ManagerDashboardGrid
        sectionOrder={s.sectionOrder}
        dashboardFilters={s.dashboardFilters}
        sellers={s.sellers}
        isSubscriptionExpired={s.isSubscriptionExpired}
        onOpenKPI={(variant = 'A') => { s.setKpiModalVariant(variant); s.setShowStoreKPIModal(true); }}
        onOpenTeam={(variant = 'A') => { s.setTeamModalVariant(variant); s.setShowTeamModal(true); }}
        onOpenObjectives={(variant = 'A') => { s.setSettingsVariant(variant); s.setSettingsModalType('objectives'); s.setShowSettingsModal(true); }}
        onOpenRelationship={(variant = 'A') => { s.setRelationshipVariant(variant); s.setShowRelationshipModal(true); }}
      />

      <ManagerModalsLayer
        sellers={s.sellers}
        storeName={s.storeName}
        teamBilan={s.teamBilan}
        kpiConfig={s.kpiConfig}
        effectiveStoreId={s.effectiveStoreId}
        urlStoreId={s.urlStoreId}
        apiStoreIdParam={s.apiStoreIdParam}
        managerDiagnostic={s.managerDiagnostic}
        setManagerDiagnostic={s.setManagerDiagnostic}
        selectedSeller={s.selectedSeller}
        settingsModalType={s.settingsModalType}
        initialObjectiveId={s.initialObjectiveId}
        autoShowRelationshipResult={s.autoShowRelationshipResult}
        generatingAIAdvice={s.generatingAIAdvice}
        showKPIConfigModal={s.showKPIConfigModal}
        showManagerDiagnostic={s.showManagerDiagnostic}
        showManagerProfileModal={s.showManagerProfileModal}
        showTeamBilanModal={s.showTeamBilanModal}
        showSettingsModal={s.showSettingsModal}
        showStoreKPIModal={s.showStoreKPIModal}
        kpiModalVariant={s.kpiModalVariant}
        teamModalVariant={s.teamModalVariant}
        settingsVariant={s.settingsVariant}
        relationshipVariant={s.relationshipVariant}
        showRelationshipModal={s.showRelationshipModal}
        showTeamModal={s.showTeamModal}
        showDetailView={s.showDetailView}
        showSupportModal={s.showSupportModal}
        showMorningBriefModal={s.showMorningBriefModal}
        setShowKPIConfigModal={s.setShowKPIConfigModal}
        setShowManagerDiagnostic={s.setShowManagerDiagnostic}
        setShowManagerProfileModal={s.setShowManagerProfileModal}
        setShowTeamBilanModal={s.setShowTeamBilanModal}
        setShowSettingsModal={s.setShowSettingsModal}
        setShowStoreKPIModal={s.setShowStoreKPIModal}
        setKpiModalVariant={s.setKpiModalVariant}
        setTeamModalVariant={s.setTeamModalVariant}
        setSettingsVariant={s.setSettingsVariant}
        setRelationshipVariant={s.setRelationshipVariant}
        setShowRelationshipModal={s.setShowRelationshipModal}
        setShowTeamModal={s.setShowTeamModal}
        setShowDetailView={s.setShowDetailView}
        setShowSupportModal={s.setShowSupportModal}
        setShowMorningBriefModal={s.setShowMorningBriefModal}
        setSelectedSeller={s.setSelectedSeller}
        setInitialObjectiveId={s.setInitialObjectiveId}
        setAutoShowRelationshipResult={s.setAutoShowRelationshipResult}
        setGeneratingAIAdvice={s.setGeneratingAIAdvice}
        fetchData={s.fetchData}
        fetchManagerDiagnostic={s.fetchManagerDiagnostic}
        fetchActiveObjectives={s.fetchActiveObjectives}
        fetchKpiConfig={s.fetchKpiConfig}
        fetchStoreKPIStats={s.fetchStoreKPIStats}
        onboarding={s.onboarding}
        managerSteps={s.managerSteps}
      />
    </div>
  );
}
