import React from 'react';
import { Sparkles } from 'lucide-react';
import { useAuth } from '../../../contexts';
import { toast } from 'sonner';
import { api } from '../../../lib/apiClient';
import { logger } from '../../../utils/logger';
import { getSubscriptionErrorMessage } from '../../../utils/apiHelpers';
import KPIConfigModal from '../../KPIConfigModal';
import ManagerDiagnosticForm from '../../ManagerDiagnosticForm';
import ManagerProfileModal from '../../ManagerProfileModal';
import TeamBilanModal from '../../TeamBilanModal';
import ManagerSettingsModal from '../../ManagerSettingsModal';
import StoreKPIModal from '../../StoreKPIModal';
import RelationshipManagementModal from '../../RelationshipManagementModal';
import TeamModal from '../../TeamModal';
import SellerDetailView from '../../SellerDetailView';
import SupportModal from '../../SupportModal';
import MorningBriefModal from '../../MorningBriefModal';
import OnboardingModal from '../../onboarding/OnboardingModal';

/**
 * Couche de tous les modals du dashboard manager.
 */
export default function ManagerModalsLayer({
  // Data
  sellers,
  storeName,
  teamBilan,
  kpiConfig,
  effectiveStoreId,
  urlStoreId,
  apiStoreIdParam,
  managerDiagnostic,
  selectedSeller,
  settingsModalType,
  autoShowRelationshipResult,
  generatingAIAdvice,

  // Modal visibility
  showKPIConfigModal,
  showManagerDiagnostic,
  showManagerProfileModal,
  showTeamBilanModal,
  showSettingsModal,
  showStoreKPIModal,
  showRelationshipModal,
  showTeamModal,
  showDetailView,
  showSupportModal,
  showMorningBriefModal,

  // Modal setters
  setShowKPIConfigModal,
  setShowManagerDiagnostic,
  setShowManagerProfileModal,
  setShowTeamBilanModal,
  setShowSettingsModal,
  setShowStoreKPIModal,
  setShowRelationshipModal,
  setShowTeamModal,
  setShowDetailView,
  setShowSupportModal,
  setShowMorningBriefModal,

  // Data setters
  setSelectedSeller,
  setAutoShowRelationshipResult,
  setGeneratingAIAdvice,

  // Actions
  fetchData,
  fetchManagerDiagnostic,
  fetchActiveChallenges,
  fetchActiveObjectives,
  fetchKpiConfig,
  fetchStoreKPIStats,

  // Onboarding
  onboarding,
  managerSteps,
}) {
  const { user } = useAuth();

  return (
    <>
      {showKPIConfigModal && (
        <KPIConfigModal
          onClose={() => setShowKPIConfigModal(false)}
          onSuccess={() => {
            setShowKPIConfigModal(false);
            fetchData();
          }}
        />
      )}

      {showManagerDiagnostic && (
        <ManagerDiagnosticForm
          onClose={() => setShowManagerDiagnostic(false)}
          onSuccess={async () => {
            setShowManagerDiagnostic(false);
            await fetchManagerDiagnostic();
            setShowManagerProfileModal(true);
          }}
        />
      )}

      {showManagerProfileModal && (
        <ManagerProfileModal
          diagnostic={managerDiagnostic}
          onClose={() => setShowManagerProfileModal(false)}
          onRedo={() => {
            setShowManagerProfileModal(false);
            setShowManagerDiagnostic(true);
          }}
        />
      )}

      {showTeamBilanModal && (
        <TeamBilanModal
          bilan={teamBilan}
          kpiConfig={kpiConfig}
          onClose={() => setShowTeamBilanModal(false)}
        />
      )}

      {showSettingsModal && (
        <ManagerSettingsModal
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
          modalType={settingsModalType}
          storeIdParam={urlStoreId}
          onUpdate={() => {
            fetchActiveChallenges();
            fetchActiveObjectives();
            fetchKpiConfig();
          }}
        />
      )}

      {showStoreKPIModal && (
        <StoreKPIModal
          storeId={effectiveStoreId}
          isManager
          onClose={() => setShowStoreKPIModal(false)}
          onSuccess={() => fetchStoreKPIStats()}
        />
      )}

      {showRelationshipModal && (
        <RelationshipManagementModal
          onClose={() => {
            setShowRelationshipModal(false);
            setAutoShowRelationshipResult(false);
          }}
          onSuccess={async (formData) => {
            setShowRelationshipModal(false);
            setGeneratingAIAdvice(true);
            try {
              await api.post(`/manager/relationship-advice${apiStoreIdParam}`, formData);
              setGeneratingAIAdvice(false);
              toast.success('Recommandation générée avec succès !');
              await fetchData();
              setTimeout(() => {
                setAutoShowRelationshipResult(true);
                setShowRelationshipModal(true);
              }, 500);
            } catch (error) {
              setGeneratingAIAdvice(false);
              logger.error('Error generating advice:', error);
              toast.error(getSubscriptionErrorMessage(error, user?.role) || 'Erreur lors de la génération des recommandations');
            }
          }}
          sellers={sellers}
          autoShowResult={autoShowRelationshipResult}
          storeId={urlStoreId}
        />
      )}

      {showTeamModal && (
        <TeamModal
          sellers={sellers}
          storeIdParam={urlStoreId}
          onClose={() => setShowTeamModal(false)}
          onViewSellerDetail={(seller) => {
            setSelectedSeller(seller);
            setShowDetailView(true);
            setShowTeamModal(false);
          }}
          onDataUpdate={async () => { await fetchData(); }}
          storeName={storeName}
          managerName={user?.name}
          userRole={user?.role}
        />
      )}

      {/* Seller Detail Modal */}
      {showDetailView && selectedSeller && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowDetailView(false);
              setSelectedSeller(null);
            }
          }}
        >
          <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[95vh] shadow-2xl flex flex-col my-4">
            <SellerDetailView
              seller={selectedSeller}
              storeIdParam={urlStoreId}
              onBack={() => {
                setShowDetailView(false);
                setSelectedSeller(null);
                setShowTeamModal(true);
              }}
              onClose={() => {
                setShowDetailView(false);
                setSelectedSeller(null);
              }}
            />
          </div>
        </div>
      )}

      {/* AI generation loading overlay */}
      {generatingAIAdvice && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
            <div className="text-center mb-6">
              <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center animate-pulse">
                <Sparkles className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-800 mb-2">Génération en cours...</h3>
              <p className="text-gray-600">
                L'IA analyse la situation et prépare des recommandations personnalisées
              </p>
            </div>
            <div className="relative w-full h-3 bg-gray-200 rounded-full overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500 via-indigo-500 to-purple-500 animate-progress-slide" />
            </div>
            <div className="mt-4 text-center text-sm text-gray-500">
              <p>⏱️ Temps estimé : 30-60 secondes</p>
            </div>
          </div>
        </div>
      )}

      <OnboardingModal
        isOpen={onboarding.isOpen}
        onClose={onboarding.close}
        currentStep={onboarding.currentStep}
        totalSteps={managerSteps.length}
        steps={managerSteps}
        onNext={onboarding.next}
        onPrev={onboarding.prev}
        onGoTo={onboarding.goTo}
        onSkip={onboarding.skip}
        completedSteps={onboarding.completedSteps}
      />

      <SupportModal
        isOpen={showSupportModal}
        onClose={() => setShowSupportModal(false)}
      />

      <MorningBriefModal
        isOpen={showMorningBriefModal}
        onClose={() => setShowMorningBriefModal(false)}
        storeName={storeName}
        managerName={user?.name}
      />
    </>
  );
}
