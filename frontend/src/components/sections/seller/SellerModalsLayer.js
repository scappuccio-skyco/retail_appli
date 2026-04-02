import React from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '../../../lib/apiClient';
import { useAuth } from '../../../contexts';
import { useSubscription } from '../../../contexts';
import EvaluationModal from '../../EvaluationModal';
import DebriefModal from '../../DebriefModal';
import DebriefHistoryModal from '../../DebriefHistoryModal';
import KPIEntryModal from '../../KPIEntryModal';
import KPIHistoryModal from '../../KPIHistoryModal';
import KPIReporting from '../../../pages/KPIReporting';
import SellerProfileModal from '../../SellerProfileModal';
import BilanIndividuelModal from '../../BilanIndividuelModal';
import PerformanceModal from '../../PerformanceModal';
import DiagnosticFormScrollable from '../../DiagnosticFormScrollable';
import CompetencesExplicationModal from '../../CompetencesExplicationModal';
import ChallengeHistoryModal from '../../ChallengeHistoryModal';
import DailyChallengeModal from '../../DailyChallengeModal';
import CoachingModal from '../../CoachingModal';
import SupportModal from '../../SupportModal';
import SellerManagerCompatibiliteModal from '../../SellerManagerCompatibiliteModal';
import EvaluationGenerator from '../../EvaluationGenerator';
import EvaluationNotesNotebook from '../../EvaluationNotesNotebook';
import OnboardingModal from '../../onboarding/OnboardingModal';
import SellerObjectivesModalVariant from '../../SellerObjectivesModalVariant';

/**
 * Couche de tous les modals du dashboard vendeur.
 * Reçoit un registre `modals` (objet) + `setModal(name, value)` du parent SellerDashboard.
 */
export default function SellerModalsLayer({
  // Data
  sales,
  debriefs,
  kpiEntries,
  kpiConfig,
  activeObjectives,
  dailyChallenge,
  bilanIndividuel,
  currentWeekOffset,
  generatingBilan,
  initialTab,

  // Modal registry
  modals,
  setModal,

  // Modal-adjacent state (carry data, not just open/close)
  initialObjectiveId,
  setInitialObjectiveId,
  editingKPI,
  setEditingKPI,
  autoExpandDebriefId,
  setAutoExpandDebriefId,

  // Week / tab navigation
  setCurrentWeekOffset,
  setInitialTab,

  // Data setters
  setDailyChallenge,

  // Actions / refresh functions
  fetchData,
  fetchDebriefs,
  fetchActiveObjectives,
  fetchDailyChallenge,
  fetchBilanIndividuel,
  refreshCompetenceScores,
  regenerateBilan,
  loadMoreKpiEntries,
  kpiEntriesTotal,
  handleOpenKPIModal,

  // Onboarding
  onboarding,
  sellerSteps,
}) {
  const navigate = useNavigate();
  const { user, diagnostic } = useAuth();
  const { isSubscriptionExpired } = useSubscription();

  return (
    <>
      {modals.eval && (
        <EvaluationModal
          sales={sales}
          onClose={() => setModal('eval', false)}
          onSuccess={() => {
            fetchData();
            setModal('eval', false);
          }}
        />
      )}

      {modals.debrief && (
        <DebriefModal
          onClose={() => setModal('debrief', false)}
          onSuccess={() => {
            fetchData();
            setModal('debrief', false);
          }}
        />
      )}

      {modals.debriefHistory && (
        <DebriefHistoryModal
          onClose={() => {
            setModal('debriefHistory', false);
            setAutoExpandDebriefId(null);
          }}
          onSuccess={(newDebrief) => {
            setAutoExpandDebriefId(newDebrief.id);
            setModal('debriefHistory', false);
            fetchDebriefs();
            setTimeout(() => setModal('debriefHistory', true), 500);
          }}
          autoExpandDebriefId={autoExpandDebriefId}
        />
      )}

      {modals.kpi && (
        <KPIEntryModal
          onClose={() => {
            setModal('kpi', false);
            setEditingKPI(null);
          }}
          onSuccess={async () => {
            setModal('kpi', false);
            setEditingKPI(null);
            await fetchData();
            refreshCompetenceScores();
            fetchBilanIndividuel(0);
            toast.success('📊 KPI enregistré ! Les totaux hebdomadaires sont mis à jour.');
          }}
          editEntry={editingKPI}
        />
      )}

      {modals.kpiHistory && (
        <KPIHistoryModal
          kpiEntries={kpiEntries}
          kpiConfig={kpiConfig}
          onClose={() => setModal('kpiHistory', false)}
          onNewKPI={() => {
            setModal('kpiHistory', false);
            handleOpenKPIModal();
          }}
          onEditKPI={(entry) => {
            setModal('kpiHistory', false);
            handleOpenKPIModal(entry);
          }}
        />
      )}

      {modals.challengeHistory && (
        <ChallengeHistoryModal
          onClose={() => setModal('challengeHistory', false)}
        />
      )}

      {modals.dailyChallenge && dailyChallenge && (
        <DailyChallengeModal
          challenge={dailyChallenge}
          onClose={() => setModal('dailyChallenge', false)}
          onOpenHistory={() => {
            setModal('dailyChallenge', false);
            setModal('challengeHistory', true);
          }}
          onRefresh={(newChallenge) => setDailyChallenge(newChallenge)}
          onComplete={(updatedChallenge) => {
            setDailyChallenge(updatedChallenge);
            fetchData();
          }}
        />
      )}

      {/* Diagnostic invitation modal */}
      {modals.diagnostic && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Diagnostic vendeur</h2>
            <p className="text-gray-600 mb-6">
              Complète ton diagnostic pour découvrir ton profil unique de vendeur. Ça prend moins de 10 minutes !
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setModal('diagnostic', false);
                  navigate('/diagnostic');
                }}
                className="flex-1 btn-primary"
              >
                Commencer
              </button>
              <button
                onClick={() => setModal('diagnostic', false)}
                className="flex-1 btn-secondary"
              >
                Plus tard
              </button>
            </div>
          </div>
        </div>
      )}

      {modals.profile && (
        <SellerProfileModal
          diagnostic={diagnostic}
          onClose={() => setModal('profile', false)}
          onRedoDiagnostic={() => setModal('diagnosticForm', true)}
        />
      )}

      {modals.performance && (
        <PerformanceModal
          isOpen={modals.performance}
          onClose={() => { setModal('performance', false); setInitialTab('bilan'); }}
          bilanData={bilanIndividuel} kpiEntries={kpiEntries} user={user}
          kpiConfig={kpiConfig} currentWeekOffset={currentWeekOffset}
          onWeekChange={(offset) => { setCurrentWeekOffset(offset); fetchBilanIndividuel(offset); }}
          onDataUpdate={fetchData} onRegenerate={regenerateBilan}
          generatingBilan={generatingBilan} initialTab={initialTab}
          isReadOnly={isSubscriptionExpired} onLoadMoreKpi={loadMoreKpiEntries}
          kpiEntriesTotal={kpiEntriesTotal}
          onEditKPI={(entry) => { handleOpenKPIModal(entry); setModal('performance', false); }}
        />
      )}

      {modals.objectives && (
        <SellerObjectivesModalVariant
          isOpen={modals.objectives}
          onClose={() => { setModal('objectives', false); setInitialObjectiveId?.(null); }}
          activeObjectives={activeObjectives} initialObjectiveId={initialObjectiveId}
          onUpdate={async () => { await fetchActiveObjectives(); }}
        />
      )}

      {modals.bilan && bilanIndividuel && (
        <BilanIndividuelModal
          bilan={bilanIndividuel}
          kpiConfig={kpiConfig}
          kpiEntries={kpiEntries}
          currentWeekOffset={currentWeekOffset}
          onWeekChange={(offset) => {
            setCurrentWeekOffset(offset);
            fetchBilanIndividuel(offset);
          }}
          onRegenerate={regenerateBilan}
          generatingBilan={generatingBilan}
          onClose={() => setModal('bilan', false)}
        />
      )}

      {modals.diagnosticForm && (
        <DiagnosticFormScrollable
          isModal={true}
          onClose={() => setModal('diagnosticForm', false)}
          onComplete={async () => {
            setModal('diagnosticForm', false);
            await fetchData();
            setModal('profile', true);
          }}
        />
      )}

      {modals.competences && (
        <CompetencesExplicationModal
          onClose={() => setModal('competences', false)}
        />
      )}

      {modals.kpiReporting && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setModal('kpiReporting', false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-7xl max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <KPIReporting user={user} onBack={() => setModal('kpiReporting', false)} />
          </div>
        </div>
      )}

      <CoachingModal
        key={dailyChallenge?.id || 'no-challenge'}
        isOpen={modals.coaching}
        onClose={() => setModal('coaching', false)}
        dailyChallenge={dailyChallenge}
        onRefreshChallenge={(newChallenge) => { if (newChallenge) setDailyChallenge(newChallenge); else fetchDailyChallenge(); }}
        onCompleteChallenge={async () => { await fetchDailyChallenge(); }}
        onOpenChallengeHistory={() => { setModal('coaching', false); setModal('challengeHistory', true); }}
        debriefs={debriefs}
        onCreateDebrief={async () => { await fetchDebriefs(); }}
      />

      <OnboardingModal
        isOpen={onboarding.isOpen}
        onClose={onboarding.close}
        currentStep={onboarding.currentStep}
        totalSteps={sellerSteps.length}
        steps={sellerSteps}
        onNext={onboarding.next}
        onPrev={onboarding.prev}
        onGoTo={onboarding.goTo}
        onSkip={onboarding.skip}
        completedSteps={onboarding.completedSteps}
      />

      <EvaluationNotesNotebook
        isOpen={modals.notesNotebook}
        onClose={() => setModal('notesNotebook', false)}
        onGenerateSynthesis={() => { setModal('notesNotebook', false); setModal('evaluation', true); }}
      />

      <EvaluationGenerator
        isOpen={modals.evaluation}
        onClose={() => setModal('evaluation', false)}
        employeeId={user?.id}
        employeeName={user?.name}
        role="seller"
      />

      <SupportModal
        isOpen={modals.support}
        onClose={() => setModal('support', false)}
      />

      {modals.managerCompat && (
        <SellerManagerCompatibiliteModal
          diagnostic={diagnostic}
          onClose={() => setModal('managerCompat', false)}
        />
      )}
    </>
  );
}
