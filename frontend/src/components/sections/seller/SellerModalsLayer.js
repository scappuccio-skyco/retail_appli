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
import ObjectivesModal from '../../ObjectivesModal';
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

/**
 * Couche de tous les modals du dashboard vendeur.
 * Reçoit les états et handlers du parent SellerDashboard.
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

  // Modal visibility
  showEvalModal,
  showDebriefModal,
  showDebriefHistoryModal,
  showKPIModal,
  showKPIHistoryModal,
  showChallengeHistoryModal,
  showDailyChallengeModal,
  showDiagnosticModal,
  showProfileModal,
  showPerformanceModal,
  showObjectivesModal,
  initialObjectiveId,
  showBilanModal,
  showDiagnosticFormModal,
  showCompetencesModal,
  showKPIReporting,
  showCoachingModal,
  showNotesNotebook,
  showEvaluationModal,
  showSupportModal,
  showManagerCompatModal,

  // Modal setters
  setShowEvalModal,
  setShowDebriefModal,
  setShowDebriefHistoryModal,
  setShowKPIModal,
  setShowKPIHistoryModal,
  setShowChallengeHistoryModal,
  setShowDailyChallengeModal,
  setShowDiagnosticModal,
  setShowProfileModal,
  setShowPerformanceModal,
  setShowObjectivesModal,
  setInitialObjectiveId,
  setShowBilanModal,
  setShowDiagnosticFormModal,
  setShowCompetencesModal,
  setShowKPIReporting,
  setShowCoachingModal,
  setShowNotesNotebook,
  setShowEvaluationModal,
  setShowSupportModal,
  setShowManagerCompatModal,

  // KPI edit state
  editingKPI,
  setEditingKPI,

  // Auto-expand debrief
  autoExpandDebriefId,
  setAutoExpandDebriefId,

  // Week navigation
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
      {showEvalModal && (
        <EvaluationModal
          sales={sales}
          onClose={() => setShowEvalModal(false)}
          onSuccess={() => {
            fetchData();
            setShowEvalModal(false);
          }}
        />
      )}

      {showDebriefModal && (
        <DebriefModal
          onClose={() => setShowDebriefModal(false)}
          onSuccess={() => {
            fetchData();
            setShowDebriefModal(false);
          }}
        />
      )}

      {showDebriefHistoryModal && (
        <DebriefHistoryModal
          onClose={() => {
            setShowDebriefHistoryModal(false);
            setAutoExpandDebriefId(null);
          }}
          onSuccess={(newDebrief) => {
            setAutoExpandDebriefId(newDebrief.id);
            setShowDebriefHistoryModal(false);
            fetchDebriefs();
            setTimeout(() => setShowDebriefHistoryModal(true), 500);
          }}
          autoExpandDebriefId={autoExpandDebriefId}
        />
      )}

      {showKPIModal && (
        <KPIEntryModal
          onClose={() => {
            setShowKPIModal(false);
            setEditingKPI(null);
          }}
          onSuccess={async () => {
            setShowKPIModal(false);
            setEditingKPI(null);
            await fetchData();
            refreshCompetenceScores();
            fetchBilanIndividuel(0);
            toast.success('📊 KPI enregistré ! Les totaux hebdomadaires sont mis à jour.');
          }}
          editEntry={editingKPI}
        />
      )}

      {showKPIHistoryModal && (
        <KPIHistoryModal
          kpiEntries={kpiEntries}
          kpiConfig={kpiConfig}
          onClose={() => setShowKPIHistoryModal(false)}
          onNewKPI={() => {
            setShowKPIHistoryModal(false);
            handleOpenKPIModal();
          }}
          onEditKPI={(entry) => {
            setShowKPIHistoryModal(false);
            handleOpenKPIModal(entry);
          }}
        />
      )}

      {showChallengeHistoryModal && (
        <ChallengeHistoryModal
          onClose={() => setShowChallengeHistoryModal(false)}
        />
      )}

      {showDailyChallengeModal && dailyChallenge && (
        <DailyChallengeModal
          challenge={dailyChallenge}
          onClose={() => setShowDailyChallengeModal(false)}
          onOpenHistory={() => {
            setShowDailyChallengeModal(false);
            setShowChallengeHistoryModal(true);
          }}
          onRefresh={(newChallenge) => setDailyChallenge(newChallenge)}
          onComplete={(updatedChallenge) => {
            setDailyChallenge(updatedChallenge);
            fetchData();
          }}
        />
      )}

      {/* Diagnostic invitation modal */}
      {showDiagnosticModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Diagnostic vendeur</h2>
            <p className="text-gray-600 mb-6">
              Complète ton diagnostic pour découvrir ton profil unique de vendeur. Ça prend moins de 10 minutes !
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDiagnosticModal(false);
                  navigate('/diagnostic');
                }}
                className="flex-1 btn-primary"
              >
                Commencer
              </button>
              <button
                onClick={() => setShowDiagnosticModal(false)}
                className="flex-1 btn-secondary"
              >
                Plus tard
              </button>
            </div>
          </div>
        </div>
      )}

      {showProfileModal && (
        <SellerProfileModal
          diagnostic={diagnostic}
          onClose={() => setShowProfileModal(false)}
          onRedoDiagnostic={() => setShowDiagnosticFormModal(true)}
        />
      )}

      {showPerformanceModal && (
        <PerformanceModal
          isOpen={showPerformanceModal}
          onClose={() => {
            setShowPerformanceModal(false);
            setInitialTab('bilan');
          }}
          bilanData={bilanIndividuel}
          kpiEntries={kpiEntries}
          user={user}
          kpiConfig={kpiConfig}
          currentWeekOffset={currentWeekOffset}
          onWeekChange={(offset) => {
            setCurrentWeekOffset(offset);
            fetchBilanIndividuel(offset);
          }}
          onDataUpdate={fetchData}
          onRegenerate={regenerateBilan}
          generatingBilan={generatingBilan}
          initialTab={initialTab}
          isReadOnly={isSubscriptionExpired}
          onLoadMoreKpi={loadMoreKpiEntries}
          kpiEntriesTotal={kpiEntriesTotal}
          onEditKPI={(entry) => {
            handleOpenKPIModal(entry);
            setShowPerformanceModal(false);
          }}
        />
      )}

      {showObjectivesModal && (
        <ObjectivesModal
          isOpen={showObjectivesModal}
          onClose={() => { setShowObjectivesModal(false); setInitialObjectiveId?.(null); }}
          activeObjectives={activeObjectives}
          initialObjectiveId={initialObjectiveId}
          onUpdate={async () => {
            await fetchActiveObjectives();
          }}
        />
      )}

      {showBilanModal && bilanIndividuel && (
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
          onClose={() => setShowBilanModal(false)}
        />
      )}

      {showDiagnosticFormModal && (
        <DiagnosticFormScrollable
          isModal={true}
          onClose={() => setShowDiagnosticFormModal(false)}
          onComplete={async () => {
            setShowDiagnosticFormModal(false);
            await fetchData();
            setShowProfileModal(true);
          }}
        />
      )}

      {showCompetencesModal && (
        <CompetencesExplicationModal
          onClose={() => setShowCompetencesModal(false)}
        />
      )}

      {showKPIReporting && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowKPIReporting(false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-7xl max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <KPIReporting user={user} onBack={() => setShowKPIReporting(false)} />
          </div>
        </div>
      )}

      <CoachingModal
        key={dailyChallenge?.id || 'no-challenge'}
        isOpen={showCoachingModal}
        onClose={() => setShowCoachingModal(false)}
        dailyChallenge={dailyChallenge}
        onRefreshChallenge={(newChallenge) => {
          if (newChallenge) {
            setDailyChallenge(newChallenge);
          } else {
            fetchDailyChallenge();
          }
        }}
        onCompleteChallenge={async () => {
          await fetchDailyChallenge();
        }}
        onOpenChallengeHistory={() => {
          setShowCoachingModal(false);
          setShowChallengeHistoryModal(true);
        }}
        debriefs={debriefs}
        onCreateDebrief={async () => {
          await fetchDebriefs();
        }}
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
        isOpen={showNotesNotebook}
        onClose={() => setShowNotesNotebook(false)}
        onGenerateSynthesis={() => {
          setShowNotesNotebook(false);
          setShowEvaluationModal(true);
        }}
      />

      <EvaluationGenerator
        isOpen={showEvaluationModal}
        onClose={() => setShowEvaluationModal(false)}
        employeeId={user?.id}
        employeeName={user?.name}
        role="seller"
      />

      <SupportModal
        isOpen={showSupportModal}
        onClose={() => setShowSupportModal(false)}
      />

      {showManagerCompatModal && (
        <SellerManagerCompatibiliteModal
          diagnostic={diagnostic}
          onClose={() => setShowManagerCompatModal(false)}
        />
      )}
    </>
  );
}
