import React from 'react';
import { toast } from 'sonner';
import { useAuth } from '../../../contexts';
import CreateStoreModal from '../../gerant/CreateStoreModal';
import DeleteStoreConfirmation from '../../gerant/DeleteStoreConfirmation';
import InviteStaffModal from '../../gerant/InviteStaffModal';
import SubscriptionModal from '../../SubscriptionModal';
import SupportModal from '../../SupportModal';
import BillingProfileModal from '../../gerant/BillingProfileModal';
import OnboardingModal from '../../onboarding/OnboardingModal';
import { getGerantSteps } from '../../onboarding/gerantSteps';

const gerantSteps = getGerantSteps();

/**
 * Couche de tous les modals du dashboard gérant.
 */
export default function GerantModalsLayer({
  // Data
  stores,
  subscriptionInfo,
  selectedStore,
  selectedStoreColorIndex,
  selectedManager,
  selectedSeller,
  isReadOnly,

  // Modal visibility
  showCreateStoreModal,
  showDeleteConfirmation,
  showInviteStaffModal,
  showSubscriptionModal,
  showSupportModal,
  showBillingProfileModal,
  billingInitialTab,
  openBillingModal,

  // Modal setters
  setShowCreateStoreModal,
  setShowDeleteConfirmation,
  setShowInviteStaffModal,
  setShowSubscriptionModal,
  setShowSupportModal,
  setShowBillingProfileModal,

  // Data setters
  setSelectedStore,

  // Actions
  handleCreateStore,
  handleDeleteStore,
  handleInviteStaff,
  fetchDashboardData,
  fetchSubscriptionInfo,

  // Onboarding
  onboarding,
}) {
  const { user } = useAuth();

  return (
    <>
      {showCreateStoreModal && (
        <CreateStoreModal
          onClose={() => setShowCreateStoreModal(false)}
          onCreate={handleCreateStore}
        />
      )}

      {showDeleteConfirmation && selectedStore && (
        <DeleteStoreConfirmation
          store={selectedStore}
          onClose={() => setShowDeleteConfirmation(false)}
          onDelete={handleDeleteStore}
        />
      )}

      {showInviteStaffModal && (
        <InviteStaffModal
          onClose={() => setShowInviteStaffModal(false)}
          onInvite={handleInviteStaff}
          stores={stores}
        />
      )}

      <SubscriptionModal
        isOpen={showSubscriptionModal}
        onClose={() => {
          setShowSubscriptionModal(false);
          fetchSubscriptionInfo();
        }}
        subscriptionInfo={subscriptionInfo}
        userRole={user?.role}
        onOpenBillingProfile={() => {
          setShowSubscriptionModal(false);
          setShowBillingProfileModal(true);
        }}
        onOpenInvoices={() => {
          setShowSubscriptionModal(false);
          openBillingModal('invoices');
        }}
      />

      <SupportModal
        isOpen={showSupportModal}
        onClose={() => setShowSupportModal(false)}
      />

      <BillingProfileModal
        isOpen={showBillingProfileModal}
        onClose={() => setShowBillingProfileModal(false)}
        onSuccess={() => toast.success('Profil de facturation enregistré avec succès !')}
        initialTab={billingInitialTab}
      />

      <OnboardingModal
        isOpen={onboarding.isOpen}
        onClose={onboarding.close}
        currentStep={onboarding.currentStep}
        totalSteps={gerantSteps.length}
        steps={gerantSteps}
        onNext={onboarding.next}
        onPrev={onboarding.prev}
        onGoTo={onboarding.goTo}
        onSkip={onboarding.skip}
        completedSteps={onboarding.completedSteps}
      />
    </>
  );
}
