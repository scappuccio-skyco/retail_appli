import React from 'react';
import useGerantDashboard from './gerantDashboard/useGerantDashboard';

import APIKeysManagement from '../components/gerant/APIKeysManagement';
import StaffOverview from '../components/gerant/StaffOverview';
import StoresManagement from '../components/gerant/StoresManagement';
import GerantProfile from '../components/gerant/GerantProfile';

import GerantHeader from '../components/sections/gerant/GerantHeader';
import GerantReadOnlyBanner from '../components/sections/gerant/GerantReadOnlyBanner';
import GerantDashboardView from '../components/sections/gerant/GerantDashboardView';
import GerantModalsLayer from '../components/sections/gerant/GerantModalsLayer';

const GerantDashboard = ({ user, onLogout }) => {
  const s = useGerantDashboard({ user, onLogout });

  if (s.loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-orange-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-orange-600 mx-auto mb-4" />
          <p className="text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-orange-50 to-white">
      <style>{`
        @keyframes slideIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-slideIn { animation: slideIn 0.5s ease-out; }
        .ranking-item { transition: all 0.6s cubic-bezier(0.4, 0, 0.2, 1); }
        .ranking-item:hover { transform: translateX(4px); }
      `}</style>

      <GerantHeader
        user={user}
        subscriptionInfo={s.subscriptionInfo}
        activeView={s.activeView}
        setActiveView={s.setActiveView}
        onLogout={s.handleLogoutClick}
        onboarding={s.onboarding}
        onOpenSubscription={() => s.setShowSubscriptionModal(true)}
        onOpenSupport={() => s.setShowSupportModal(true)}
        onOpenBillingProfile={() => s.setShowBillingProfileModal(true)}
        onOpenInvoices={() => s.setShowInvoicesModal(true)}
      />

      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
        <GerantReadOnlyBanner
          isReadOnly={s.isReadOnly}
          subscriptionBlockCode={s.gerantBlockCode}
          isPastDue={s.isPastDue}
          onOpenSubscription={() => s.setShowSubscriptionModal(true)}
          onOpenBillingPortal={s.handleOpenBillingPortal}
        />

        {s.activeView === 'api' ? (
          <APIKeysManagement isReadOnly={s.isReadOnly} />
        ) : s.activeView === 'stores' ? (
          <StoresManagement
            onRefresh={s.fetchDashboardData}
            onOpenCreateStoreModal={() => !s.isReadOnly && s.setShowCreateStoreModal(true)}
            isReadOnly={s.isReadOnly}
          />
        ) : s.activeView === 'staff' ? (
          <StaffOverview
            onRefresh={s.fetchDashboardData}
            onOpenInviteModal={() => !s.isReadOnly && s.setShowInviteStaffModal(true)}
            onOpenCreateStoreModal={() => !s.isReadOnly && s.setShowCreateStoreModal(true)}
            isReadOnly={s.isReadOnly}
            canManageStaff={true}
          />
        ) : s.activeView === 'profile' ? (
          <GerantProfile />
        ) : (
          <GerantDashboardView
            globalStats={s.globalStats}
            stores={s.stores}
            storesStats={s.storesStats}
            rankingStats={s.rankingStats}
            pendingInvitations={s.pendingInvitations}
            periodType={s.periodType}
            periodOffset={s.periodOffset}
            setPeriodType={s.setPeriodType}
            setPeriodOffset={s.setPeriodOffset}
            isReadOnly={s.isReadOnly}
            onOpenCreateStore={() => s.setShowCreateStoreModal(true)}
            onOpenInviteStaff={() => s.setShowInviteStaffModal(true)}
            onStoreClick={(store, idx) => {
              s.setSelectedStore(store);
              s.setSelectedStoreColorIndex(idx);
              s.setShowStoreDetailModal(true);
            }}
          />
        )}
      </div>

      <GerantModalsLayer
        stores={s.stores}
        subscriptionInfo={s.subscriptionInfo}
        selectedStore={s.selectedStore}
        selectedStoreColorIndex={s.selectedStoreColorIndex}
        selectedManager={s.selectedManager}
        selectedSeller={s.selectedSeller}
        isReadOnly={s.isReadOnly}
        showCreateStoreModal={s.showCreateStoreModal}
        showStoreDetailModal={s.showStoreDetailModal}
        showManagerTransferModal={s.showManagerTransferModal}
        showSellerTransferModal={s.showSellerTransferModal}
        showDeleteConfirmation={s.showDeleteConfirmation}
        showInviteStaffModal={s.showInviteStaffModal}
        showSubscriptionModal={s.showSubscriptionModal}
        showSupportModal={s.showSupportModal}
        showBillingProfileModal={s.showBillingProfileModal}
        showInvoicesModal={s.showInvoicesModal}
        setShowCreateStoreModal={s.setShowCreateStoreModal}
        setShowStoreDetailModal={s.setShowStoreDetailModal}
        setShowManagerTransferModal={s.setShowManagerTransferModal}
        setShowSellerTransferModal={s.setShowSellerTransferModal}
        setShowDeleteConfirmation={s.setShowDeleteConfirmation}
        setShowInviteStaffModal={s.setShowInviteStaffModal}
        setShowSubscriptionModal={s.setShowSubscriptionModal}
        setShowSupportModal={s.setShowSupportModal}
        setShowBillingProfileModal={s.setShowBillingProfileModal}
        setShowInvoicesModal={s.setShowInvoicesModal}
        setSelectedStore={s.setSelectedStore}
        setSelectedManager={s.setSelectedManager}
        setSelectedSeller={s.setSelectedSeller}
        handleCreateStore={s.handleCreateStore}
        handleTransferManager={s.handleTransferManager}
        handleTransferSeller={s.handleTransferSeller}
        handleDeleteStore={s.handleDeleteStore}
        handleInviteStaff={s.handleInviteStaff}
        fetchDashboardData={s.fetchDashboardData}
        fetchSubscriptionInfo={s.fetchSubscriptionInfo}
        onboarding={s.onboarding}
      />
    </div>
  );
};

export default GerantDashboard;
