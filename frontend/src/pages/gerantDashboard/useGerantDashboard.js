import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '../../lib/apiClient';
import { logger } from '../../utils/logger';
import { isSafeUrl } from '../../utils/safeRedirect';
import { useOnboarding } from '../../hooks/useOnboarding';
import { gerantSteps } from '../../components/onboarding/gerantSteps';

function deriveSubscriptionState(subscriptionInfo) {
  if (!subscriptionInfo) return { isReadOnly: false, subscriptionBlockCode: null, isPastDue: false };
  const { status, trial_end } = subscriptionInfo;
  if (status === 'active') return { isReadOnly: false, subscriptionBlockCode: null, isPastDue: false };
  if (status === 'past_due') return { isReadOnly: false, subscriptionBlockCode: null, isPastDue: true };
  if (status === 'trialing') {
    if (trial_end && new Date(trial_end) >= new Date()) return { isReadOnly: false, subscriptionBlockCode: null, isPastDue: false };
    return { isReadOnly: true, subscriptionBlockCode: 'TRIAL_EXPIRED', isPastDue: false };
  }
  return { isReadOnly: true, subscriptionBlockCode: 'SUBSCRIPTION_INACTIVE', isPastDue: false };
}

export default function useGerantDashboard({ user, onLogout }) {
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
  const [billingInitialTab, setBillingInitialTab] = useState('profile');
  const [showInvoicesModal, setShowInvoicesModal] = useState(false);
  const [selectedStore, setSelectedStore] = useState(null);
  const [selectedStoreColorIndex, setSelectedStoreColorIndex] = useState(0);
  const [selectedManager, setSelectedManager] = useState(null);
  const [selectedSeller, setSelectedSeller] = useState(null);

  // ── Derived ────────────────────────────────────────────────
  const { isReadOnly, subscriptionBlockCode: gerantBlockCode, isPastDue } = deriveSubscriptionState(subscriptionInfo);

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (user && stores.length > 0) fetchRankingData(stores);
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if (onLogout) onLogout();
    else if (isSafeUrl('/login')) navigate('/login');
  };

  const handleOpenBillingPortal = async () => {
    try {
      const returnUrl = `${window.location.origin}/dashboard`;
      const res = await api.post('/gerant/stripe/portal', { return_url: returnUrl });
      const portalUrl = res.data?.portal_url;
      if (portalUrl && isSafeUrl(portalUrl)) {
        window.location.href = portalUrl;
      } else {
        toast.error("Impossible d'ouvrir le portail de facturation.");
      }
    } catch (err) {
      logger.error('Billing portal error:', err);
      toast.error(err.response?.data?.detail || "Impossible d'ouvrir le portail de facturation.");
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

  return {
    onboarding,
    // Data
    stores, globalStats, storesStats, rankingStats, pendingInvitations, subscriptionInfo,
    // UI
    loading, activeView, setActiveView, periodType, setPeriodType, periodOffset, setPeriodOffset,
    // Derived
    isReadOnly, gerantBlockCode, isPastDue,
    // Modal state
    showCreateStoreModal, setShowCreateStoreModal,
    showStoreDetailModal, setShowStoreDetailModal,
    showManagerTransferModal, setShowManagerTransferModal,
    showSellerTransferModal, setShowSellerTransferModal,
    showDeleteConfirmation, setShowDeleteConfirmation,
    showInviteStaffModal, setShowInviteStaffModal,
    showSubscriptionModal, setShowSubscriptionModal,
    showSupportModal, setShowSupportModal,
    showBillingProfileModal, setShowBillingProfileModal,
    billingInitialTab,
    openBillingModal: (tab = 'profile') => { setBillingInitialTab(tab); setShowBillingProfileModal(true); },
    showInvoicesModal, setShowInvoicesModal,
    selectedStore, setSelectedStore,
    selectedStoreColorIndex, setSelectedStoreColorIndex,
    selectedManager, setSelectedManager,
    selectedSeller, setSelectedSeller,
    // Actions
    handleLogoutClick, handleOpenBillingPortal,
    handleCreateStore, handleTransferManager, handleTransferSeller,
    handleDeleteStore, handleInviteStaff,
    fetchDashboardData, fetchSubscriptionInfo,
  };
}
