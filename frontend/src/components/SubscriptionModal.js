import React from 'react';
import { X, Crown } from 'lucide-react';
import QuantityModal from './QuantityModal';
import ConfirmActionModal from './ConfirmActionModal';
import { useSubscription } from './subscriptionModal/useSubscription';
import CurrentStatusSection from './subscriptionModal/CurrentStatusSection';
import SeatManagementSection from './subscriptionModal/SeatManagementSection';
import PlansSection from './subscriptionModal/PlansSection';
import PlanConfirmModal from './subscriptionModal/PlanConfirmModal';
import SeatsConfirmModal from './subscriptionModal/SeatsConfirmModal';
import IntervalSwitchModal from './subscriptionModal/IntervalSwitchModal';

export default function SubscriptionModal({ isOpen, onClose, subscriptionInfo: propSubscriptionInfo, userRole, onOpenBillingProfile, onOpenInvoices }) {
  const {
    subscriptionInfo,
    loading,
    processingPlan,
    sellerCount,
    showQuantityModal,
    setShowQuantityModal,
    selectedPlan,
    setSelectedPlan,
    selectedQuantity,
    setSelectedQuantity,
    adjustingSeats,
    setAdjustingSeats,
    newSeatsCount,
    setNewSeatsCount,
    subscriptionHistory,
    seatsPreview,
    loadingPreview,
    showConfirmModal,
    setShowConfirmModal,
    confirmData,
    setConfirmData,
    showPlanConfirmModal,
    setShowPlanConfirmModal,
    planConfirmData,
    setPlanConfirmData,
    showSubscriptionActionModal,
    setShowSubscriptionActionModal,
    subscriptionAction,
    setSubscriptionAction,
    isAnnual,
    showIntervalSwitchModal,
    setShowIntervalSwitchModal,
    intervalSwitchPreview,
    setIntervalSwitchPreview,
    loadingIntervalSwitch,
    switchingInterval,
    currentPlan,
    isActive,
    handleClose,
    handleChangeSeats,
    handleIntervalToggleClick,
    handleConfirmIntervalSwitch,
    handleSelectPlan,
    handleProceedToPayment,
    handleQuantityChange,
    handleCancelSubscription,
    confirmCancelSubscription,
    handleReactivateSubscription,
    confirmReactivateSubscription,
    fetchSubscriptionStatus,
  } = useSubscription({ isOpen, onClose, propSubscriptionInfo, userRole, onOpenBillingProfile, onOpenInvoices });

  // Don't render anything if not open
  if (!isOpen) {
    return null;
  }

  // Loading screen
  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-8 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#1E40AF] mb-4"></div>
          <p className="text-gray-700">Chargement...</p>
        </div>
      </div>
    );
  }

  // If subscriptionInfo is still null after loading (fetch error), show a fallback
  if (!subscriptionInfo) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-8 text-center">
          <div className="text-red-500 text-lg font-semibold mb-4">
            Impossible de charger les informations d'abonnement
          </div>
          <p className="text-gray-600 mb-4">Veuillez réessayer dans quelques instants.</p>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
    {/* Main Subscription Modal - hide when quantity modal is open */}
    {!showQuantityModal && (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) { handleClose(); } }}
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#1E40AF] to-[#1E3A8A] p-6 rounded-t-2xl relative">
          <button
            onClick={handleClose}
            disabled={processingPlan !== null}
            className="absolute top-4 right-4 text-white hover:text-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X className="w-6 h-6" />
          </button>
          <h2 className="text-3xl font-bold text-white flex items-center gap-3">
            <Crown className="w-8 h-8" />
            Mon Abonnement
          </h2>
        </div>

        {/* Content */}
        <div className="p-8">
          <CurrentStatusSection
            subscriptionInfo={subscriptionInfo}
            sellerCount={sellerCount}
            subscriptionHistory={subscriptionHistory}
            currentPlan={currentPlan}
            onOpenInvoices={onOpenInvoices}
            handleCancelSubscription={handleCancelSubscription}
            handleReactivateSubscription={handleReactivateSubscription}
          />

          {/* Seat Management - For active subscriptions ONLY (not during trial) */}
          {subscriptionInfo && subscriptionInfo.status === 'active' && subscriptionInfo.subscription && (
            <SeatManagementSection
              subscriptionInfo={subscriptionInfo}
              sellerCount={sellerCount}
              newSeatsCount={newSeatsCount}
              setNewSeatsCount={setNewSeatsCount}
              adjustingSeats={adjustingSeats}
              setAdjustingSeats={setAdjustingSeats}
              seatsPreview={seatsPreview}
              loadingPreview={loadingPreview}
              handleChangeSeats={handleChangeSeats}
              subscriptionHistory={subscriptionHistory}
              fetchSubscriptionStatus={fetchSubscriptionStatus}
            />
          )}

          <PlansSection
            subscriptionInfo={subscriptionInfo}
            currentPlan={currentPlan}
            isActive={isActive}
            isAnnual={isAnnual}
            sellerCount={sellerCount}
            processingPlan={processingPlan}
            loadingIntervalSwitch={loadingIntervalSwitch}
            handleIntervalToggleClick={handleIntervalToggleClick}
            handleSelectPlan={handleSelectPlan}
          />
        </div>
      </div>
    </div>
    )}

      {/* QuantityModal rendered separately to prevent DOM conflicts */}
      {showQuantityModal && (
        <QuantityModal
          isOpen={showQuantityModal}
          selectedPlan={selectedPlan}
          selectedQuantity={selectedQuantity}
          sellerCount={sellerCount}
          processingPlan={processingPlan}
          onQuantityChange={handleQuantityChange}
          onBack={() => setShowQuantityModal(false)}
          onProceedToPayment={handleProceedToPayment}
        />
      )}

      {/* Plan Change Confirmation Modal */}
      <PlanConfirmModal
        showPlanConfirmModal={showPlanConfirmModal}
        planConfirmData={planConfirmData}
        setPlanConfirmData={setPlanConfirmData}
        sellerCount={sellerCount}
        subscriptionInfo={subscriptionInfo}
        handleProceedToPayment={handleProceedToPayment}
        processingPlan={processingPlan}
        handleQuantityChange={handleQuantityChange}
        setShowPlanConfirmModal={setShowPlanConfirmModal}
        setSelectedPlan={setSelectedPlan}
        setSelectedQuantity={setSelectedQuantity}
        isAnnual={isAnnual}
        userRole={userRole}
        onClose={onClose}
      />

      {/* Confirmation Modal - Compact version with pricing details */}
      <SeatsConfirmModal
        showConfirmModal={showConfirmModal}
        confirmData={confirmData}
        setShowConfirmModal={setShowConfirmModal}
        setConfirmData={setConfirmData}
        adjustingSeats={adjustingSeats}
        handleChangeSeats={handleChangeSeats}
      />

      {/* Subscription Action Confirmation Modal */}
      {showSubscriptionActionModal && (
        <ConfirmActionModal
          isOpen={showSubscriptionActionModal}
          onClose={() => {
            setShowSubscriptionActionModal(false);
            setSubscriptionAction(null);
          }}
          onConfirm={() => {
            if (subscriptionAction === 'cancel_subscription') {
              confirmCancelSubscription();
            } else if (subscriptionAction === 'reactivate_subscription') {
              confirmReactivateSubscription();
            }
          }}
          action={subscriptionAction}
          subscriptionEndDate={
            subscriptionInfo?.subscription?.current_period_end
              ? new Date(subscriptionInfo.subscription.current_period_end).toLocaleDateString('fr-FR')
              : subscriptionInfo?.period_end
              ? new Date(subscriptionInfo.period_end).toLocaleDateString('fr-FR')
              : ''
          }
        />
      )}

      {/* Interval Switch Confirmation Modal */}
      <IntervalSwitchModal
        showIntervalSwitchModal={showIntervalSwitchModal}
        intervalSwitchPreview={intervalSwitchPreview}
        switchingInterval={switchingInterval}
        setShowIntervalSwitchModal={setShowIntervalSwitchModal}
        setIntervalSwitchPreview={setIntervalSwitchPreview}
        handleConfirmIntervalSwitch={handleConfirmIntervalSwitch}
      />
    </>
  );
}
