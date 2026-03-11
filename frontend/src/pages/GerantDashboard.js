import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '../lib/apiClient';
import { logger } from '../utils/logger';
import { isSafeUrl } from '../utils/safeRedirect';
import { useOnboarding } from '../hooks/useOnboarding';
import { gerantSteps } from '../components/onboarding/gerantSteps';
import APIKeysManagement from '../components/gerant/APIKeysManagement';
import StaffOverview from '../components/gerant/StaffOverview';
import StoresManagement from '../components/gerant/StoresManagement';
import GerantProfile from '../components/gerant/GerantProfile';

// Section components
import GerantHeader from '../components/sections/gerant/GerantHeader';
import GerantReadOnlyBanner from '../components/sections/gerant/GerantReadOnlyBanner';
import GerantDashboardView from '../components/sections/gerant/GerantDashboardView';
import GerantModalsLayer from '../components/sections/gerant/GerantModalsLayer';

const GerantDashboard = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const onboarding = useOnboarding(gerantSteps.length);

  // ── Data state ─────────────────────────────────────────────
  const [stores, setStores] = useState([]);
  const [globalStats, setGlobalStats] = useState(null);
  const [storesStats, setStoresStats] = useState({});
  const [rankingStats, setRankingStats] = useState({});
  const [pendingInvitations, setPendingInvitations] = useState({ managers: 0, sellers: 0 });
  const [subscriptionInfo, setSubscriptionInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  // ── UI state ───────────────────────────────────────────────
  const [activeView, setActiveView] = useState('dashboard');
  const [periodType, setPeriodType] = useState('week');
  const [periodOffset, setPeriodOffset] = useState(-1);

  // ── Modal state ────────────────────────────────────────────
  const [showCreateStoreModal, setShowCreateStoreModal] = useState(false);
  const [showStoreDetailModal, setShowStoreDetailModal] = useState(false);
  const [showManagerTransferModal, setShowManagerTransferModal] = useState(false);
  const [showSellerTransferModal, setShowSellerTransferModal] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [showInviteStaffModal, setShowInviteStaffModal] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [showBillingProfileModal, setShowBillingProfileModal] = useState(false);
  const [selectedStore, setSelectedStore] = useState(null);
  const [selectedStoreColorIndex, setSelectedStoreColorIndex] = useState(0);
  const [selectedManager, setSelectedManager] = useState(null);
  const [selectedSeller, setSelectedSeller] = useState(null);

  // ── Derived: read-only based on subscription ───────────────
  const isReadOnly = (() => {
    if (!subscriptionInfo) return false;
    const { status, trial_end } = subscriptionInfo;
    if (status === 'active') return false;
    if (status === 'trialing') {
      if (trial_end && new Date(trial_end) >= new Date()) return false;
      return true;
    }
    return true;
  })();

  // ── Side effects ───────────────────────────────────────────
  useEffect(() => {
    const message = location.state?.message;
    if (message) {
      toast.info(message, { duration: 4000 });
      const target = location.pathname;
      const safe = target.startsWith('/') ? target : '/';
      if (isSafeUrl(safe)) navigate(safe, { replace: true, state: {} });
    }
  }, [location.state?.message, location.pathname, navigate]);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
      fetchSubscriptionInfo();
    }
    // eslint-disable-next-line
  }, [user]);

  useEffect(() => {
    if (user && stores.length > 0) {
      fetchRankingData(stores);
    }
    // eslint-disable-next-line
  }, [periodType, periodOffset]);

  // ── Fetch functions ────────────────────────────────────────
  const fetchStoreCardsData = async (storesList) => {
    try {
      const [yearStatsArray, weekStatsArray] = await Promise.all([
        Promise.all(storesList.map(s => api.get(`/gerant/stores/${s.id}/stats?period_type=year&period_offset=0`))),
        Promise.all(storesList.map(s => api.get(`/gerant/stores/${s.id}/stats?period_type=week&period_offset=-2`))),
      ]);
      const statsMap = {};
      storesList.forEach((store, i) => {
        const y = yearStatsArray[i].data;
        const w = weekStatsArray[i].data;
        statsMap[store.id] = {
          managers_count: y.managers_count || 0,
          sellers_count: y.sellers_count || 0,
          month_ca: y.period?.ca || 0,
          month_ventes: y.period?.ventes || 0,
          period_ca: w.period?.ca || 0,
          period_ventes: w.period?.ventes || 0,
          prev_period_ca: w.previous_period?.ca || 0,
          week_ca: w.period?.ca || 0,
          today_ca: y.today?.total_ca || 0,
          today_ventes: y.today?.total_ventes || 0,
        };
      });
      setStoresStats(statsMap);
    } catch (err) {
      logger.error('Error fetching store cards data:', err);
    }
  };

  const fetchRankingData = async (storesList) => {
    try {
      const results = await Promise.all(
        storesList.map(s => api.get(`/gerant/stores/${s.id}/stats?period_type=${periodType}&period_offset=${periodOffset}`))
      );
      const statsMap = {};
      results.forEach((res, i) => {
        const d = res.data;
        statsMap[storesList[i].id] = {
          period_ca: d.period?.ca || 0,
          period_ventes: d.period?.ventes || 0,
          prev_period_ca: d.previous_period?.ca || 0,
          ca_evolution: d.period?.ca_evolution || 0,
        };
      });
      setRankingStats(statsMap);
    } catch (err) {
      logger.error('Error fetching ranking data:', err);
    }
  };

  const fetchDashboardData = async () => {
    try {
      const statsResponse = await api.get('/gerant/dashboard/stats');
      if (statsResponse.data) {
        const data = statsResponse.data;
        setGlobalStats(data);
        setStores(data.stores || []);
        if (data.stores?.length > 0) {
          await fetchStoreCardsData(data.stores);
          await fetchRankingData(data.stores);
        }
      }
      try {
        const invRes = await api.get('/gerant/invitations');
        const invitations = invRes.data;
        setPendingInvitations({
          managers: invitations.filter(i => i.status === 'pending' && i.role === 'manager').length,
          sellers:  invitations.filter(i => i.status === 'pending' && i.role === 'seller').length,
        });
      } catch (err) {
        logger.warn('Failed to fetch invitations:', err);
      }
    } catch (error) {
      logger.error('Erreur chargement données:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSubscriptionInfo = async () => {
    try {
      const res = await api.get('/gerant/subscription/status');
      setSubscriptionInfo(res.data);
    } catch (err) {
      logger.error('Error fetching subscription:', err);
    }
  };

  // ── Action handlers ────────────────────────────────────────
  const handleLogoutClick = () => {
    if (onLogout) {
      onLogout();
    } else {
      if (isSafeUrl('/login')) navigate('/login');
    }
  };

  const handleCreateStore = async (formData) => {
    try {
      await api.post('/gerant/stores', formData);
      toast.success('Magasin créé avec succès ! 🎉');
      await fetchDashboardData();
    } catch (error) {
      logger.error('Erreur création magasin:', error);
      throw new Error(error.response?.data?.detail || 'Erreur lors de la création');
    }
  };

  const handleTransferManager = async (managerId, newStoreId) => {
    try {
      const res = await api.post(`/gerant/managers/${managerId}/transfer`, { new_store_id: newStoreId });
      if (res.data.warning) toast.warning(res.data.warning);
      else toast.success('Manager transféré avec succès ! 🎉');
      await fetchDashboardData();
    } catch (error) {
      logger.error('Erreur transfert manager:', error);
      throw error;
    }
  };

  const handleTransferSeller = async (sellerId, newStoreId, newManagerId) => {
    try {
      await api.post(`/gerant/sellers/${sellerId}/transfer`, { new_store_id: newStoreId, new_manager_id: newManagerId });
      toast.success('Vendeur transféré avec succès ! 🎉');
      await fetchDashboardData();
    } catch (error) {
      logger.error('Erreur transfert vendeur:', error);
      throw new Error(error.response?.data?.detail || 'Erreur lors du transfert');
    }
  };

  const handleDeleteStore = async (storeId) => {
    try {
      await api.delete(`/gerant/stores/${storeId}`);
      toast.success("Magasin supprimé avec succès ! L'équipe a été suspendue automatiquement.");
      await fetchDashboardData();
    } catch (error) {
      logger.error('Erreur suppression magasin:', error);
      throw new Error(error.response?.data?.detail || 'Erreur lors de la suppression');
    }
  };

  const handleInviteStaff = async (inviteData) => {
    try {
      await api.post('/gerant/invitations', inviteData);
      const roleText = inviteData.role === 'manager' ? 'Manager' : 'Vendeur';
      toast.success(`Invitation envoyée avec succès ! 📨 Le ${roleText} recevra un email pour rejoindre votre équipe.`);
      await fetchDashboardData();
    } catch (error) {
      logger.error('Erreur invitation:', error);
      throw new Error(error.response?.data?.detail || "Erreur lors de l'invitation");
    }
  };

  if (loading) {
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
        subscriptionInfo={subscriptionInfo}
        activeView={activeView}
        setActiveView={setActiveView}
        onLogout={handleLogoutClick}
        onboarding={onboarding}
        onOpenSubscription={() => setShowSubscriptionModal(true)}
        onOpenSupport={() => setShowSupportModal(true)}
        onOpenBillingProfile={() => setShowBillingProfileModal(true)}
      />

      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
        <GerantReadOnlyBanner
          isReadOnly={isReadOnly}
          onOpenSubscription={() => setShowSubscriptionModal(true)}
        />

        {activeView === 'api' ? (
          <APIKeysManagement isReadOnly={isReadOnly} />
        ) : activeView === 'stores' ? (
          <StoresManagement
            onRefresh={fetchDashboardData}
            onOpenCreateStoreModal={() => !isReadOnly && setShowCreateStoreModal(true)}
            isReadOnly={isReadOnly}
          />
        ) : activeView === 'staff' ? (
          <StaffOverview
            onRefresh={fetchDashboardData}
            onOpenInviteModal={() => !isReadOnly && setShowInviteStaffModal(true)}
            onOpenCreateStoreModal={() => !isReadOnly && setShowCreateStoreModal(true)}
            isReadOnly={isReadOnly}
            canManageStaff={true}
          />
        ) : activeView === 'profile' ? (
          <GerantProfile />
        ) : (
          <GerantDashboardView
            globalStats={globalStats}
            stores={stores}
            storesStats={storesStats}
            rankingStats={rankingStats}
            pendingInvitations={pendingInvitations}
            periodType={periodType}
            periodOffset={periodOffset}
            setPeriodType={setPeriodType}
            setPeriodOffset={setPeriodOffset}
            isReadOnly={isReadOnly}
            onOpenCreateStore={() => setShowCreateStoreModal(true)}
            onOpenInviteStaff={() => setShowInviteStaffModal(true)}
            onStoreClick={(store, idx) => {
              setSelectedStore(store);
              setSelectedStoreColorIndex(idx);
              setShowStoreDetailModal(true);
            }}
          />
        )}
      </div>

      <GerantModalsLayer
        stores={stores}
        subscriptionInfo={subscriptionInfo}
        selectedStore={selectedStore}
        selectedStoreColorIndex={selectedStoreColorIndex}
        selectedManager={selectedManager}
        selectedSeller={selectedSeller}
        isReadOnly={isReadOnly}
        showCreateStoreModal={showCreateStoreModal}
        showStoreDetailModal={showStoreDetailModal}
        showManagerTransferModal={showManagerTransferModal}
        showSellerTransferModal={showSellerTransferModal}
        showDeleteConfirmation={showDeleteConfirmation}
        showInviteStaffModal={showInviteStaffModal}
        showSubscriptionModal={showSubscriptionModal}
        showSupportModal={showSupportModal}
        showBillingProfileModal={showBillingProfileModal}
        setShowCreateStoreModal={setShowCreateStoreModal}
        setShowStoreDetailModal={setShowStoreDetailModal}
        setShowManagerTransferModal={setShowManagerTransferModal}
        setShowSellerTransferModal={setShowSellerTransferModal}
        setShowDeleteConfirmation={setShowDeleteConfirmation}
        setShowInviteStaffModal={setShowInviteStaffModal}
        setShowSubscriptionModal={setShowSubscriptionModal}
        setShowSupportModal={setShowSupportModal}
        setShowBillingProfileModal={setShowBillingProfileModal}
        setSelectedStore={setSelectedStore}
        setSelectedManager={setSelectedManager}
        setSelectedSeller={setSelectedSeller}
        handleCreateStore={handleCreateStore}
        handleTransferManager={handleTransferManager}
        handleTransferSeller={handleTransferSeller}
        handleDeleteStore={handleDeleteStore}
        handleInviteStaff={handleInviteStaff}
        fetchDashboardData={fetchDashboardData}
        fetchSubscriptionInfo={fetchSubscriptionInfo}
        onboarding={onboarding}
      />
    </div>
  );
};

export default GerantDashboard;
