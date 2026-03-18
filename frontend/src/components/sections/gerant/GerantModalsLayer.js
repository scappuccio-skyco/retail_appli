import React from 'react';
import { toast } from 'sonner';
import { useAuth } from '../../../contexts';
import CreateStoreModal from '../../gerant/CreateStoreModal';
import StoreDetailModal from '../../gerant/StoreDetailModal';
import ManagerTransferModal from '../../gerant/ManagerTransferModal';
import SellerTransferModal from '../../gerant/SellerTransferModal';
import DeleteStoreConfirmation from '../../gerant/DeleteStoreConfirmation';
import InviteStaffModal from '../../gerant/InviteStaffModal';
import SubscriptionModal from '../../SubscriptionModal';
import SupportModal from '../../SupportModal';
import BillingProfileModal from '../../gerant/BillingProfileModal';
import InvoicesModal from '../../gerant/InvoicesModal';
import OnboardingModal from '../../onboarding/OnboardingModal';
import { gerantSteps } from '../../onboarding/gerantSteps';

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
  showStoreDetailModal,
  showManagerTransferModal,
  showSellerTransferModal,
  showDeleteConfirmation,
  showInviteStaffModal,
  showSubscriptionModal,
  showSupportModal,
  showBillingProfileModal,
  showInvoicesModal,

  // Modal setters
  setShowCreateStoreModal,
  setShowStoreDetailModal,
  setShowManagerTransferModal,
  setShowSellerTransferModal,
  setShowDeleteConfirmation,
  setShowInviteStaffModal,
  setShowSubscriptionModal,
  setShowSupportModal,
  setShowBillingProfileModal,
  setShowInvoicesModal,

  // Data setters
  setSelectedStore,
  setSelectedManager,
  setSelectedSeller,

  // Actions
  handleCreateStore,
  handleTransferManager,
  handleTransferSeller,
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

      {showStoreDetailModal && selectedStore && (
        <StoreDetailModal
          store={selectedStore}
          colorIndex={selectedStoreColorIndex}
          isReadOnly={isReadOnly}
          onClose={() => {
            setShowStoreDetailModal(false);
            setSelectedStore(null);
          }}
          onTransferManager={(manager) => {
            if (!isReadOnly) {
              setSelectedManager(manager);
              setShowManagerTransferModal(true);
            }
          }}
          onTransferSeller={(seller) => {
            if (!isReadOnly) {
              setSelectedSeller(seller);
              setShowSellerTransferModal(true);
            }
          }}
          onDeleteStore={(store) => {
            if (!isReadOnly) {
              setSelectedStore(store);
              setShowDeleteConfirmation(true);
            }
          }}
          onRefresh={fetchDashboardData}
        />
      )}

      {showManagerTransferModal && selectedManager && (
        <ManagerTransferModal
          manager={selectedManager}
          stores={stores}
          currentStoreId={selectedStore?.id}
          onClose={() => {
            setShowManagerTransferModal(false);
            setSelectedManager(null);
          }}
          onTransfer={handleTransferManager}
        />
      )}

      {showSellerTransferModal && selectedSeller && (
        <SellerTransferModal
          seller={selectedSeller}
          stores={stores}
          currentStoreId={selectedStore?.id}
          onClose={() => {
            setShowSellerTransferModal(false);
            setSelectedSeller(null);
          }}
          onTransfer={handleTransferSeller}
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
          setShowInvoicesModal(true);
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
      />

      <InvoicesModal
        isOpen={showInvoicesModal}
        onClose={() => setShowInvoicesModal(false)}
        onOpenBillingPortal={() => {
          setShowInvoicesModal(false);
          // handleOpenBillingPortal is called from GerantDashboard
        }}
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
