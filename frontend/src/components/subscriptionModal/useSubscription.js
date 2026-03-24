import { useState, useEffect } from 'react';
import { unstable_batchedUpdates } from 'react-dom';
import { api } from '../../lib/apiClient';
import { logger } from '../../utils/logger';
import { isSafeUrl, safeRedirect } from '../../utils/safeRedirect';
import { toast } from 'sonner';
import { PLANS } from './plans';

export function useSubscription({ isOpen, onClose, propSubscriptionInfo, userRole, onOpenBillingProfile, onOpenInvoices }) {
  const [subscriptionInfo, setSubscriptionInfo] = useState(propSubscriptionInfo || null);
  const [loading, setLoading] = useState(true);
  const [processingPlan, setProcessingPlan] = useState(null);
  const [sellerCount, setSellerCount] = useState(0);
  const [isMounted, setIsMounted] = useState(true);

  // Quantity modal states
  const [showQuantityModal, setShowQuantityModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [selectedQuantity, setSelectedQuantity] = useState(1);

  // Seat management states
  const [adjustingSeats, setAdjustingSeats] = useState(false);
  const [newSeatsCount, setNewSeatsCount] = useState(1);
  const [subscriptionHistory, setSubscriptionHistory] = useState([]);

  // Seat preview state (from API call)
  const [seatsPreview, setSeatsPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Confirmation modal state (for seats change)
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmData, setConfirmData] = useState(null);

  // Confirmation modal state (for plan change)
  const [showPlanConfirmModal, setShowPlanConfirmModal] = useState(false);
  const [planConfirmData, setPlanConfirmData] = useState(null);

  // Confirmation modal state (for subscription actions)
  const [showSubscriptionActionModal, setShowSubscriptionActionModal] = useState(false);
  const [subscriptionAction, setSubscriptionAction] = useState(null);

  // Billing period state
  const [isAnnual, setIsAnnual] = useState(false);

  // Promo code state
  const [promoCode, setPromoCode] = useState('');
  const [promoStatus, setPromoStatus] = useState(null); // null | 'valid' | 'invalid' | 'checking'

  const handleValidatePromo = async () => {
    if (!promoCode.trim()) return;
    setPromoStatus('checking');
    try {
      const res = await api.post('/gerant/stripe/validate-promo', { promo_code: promoCode });
      setPromoStatus(res.data.valid ? 'valid' : 'invalid');
    } catch {
      setPromoStatus('invalid');
    }
  };

  // Interval switch modal state
  const [showIntervalSwitchModal, setShowIntervalSwitchModal] = useState(false);
  const [intervalSwitchPreview, setIntervalSwitchPreview] = useState(null);
  const [loadingIntervalSwitch, setLoadingIntervalSwitch] = useState(false);
  const [switchingInterval, setSwitchingInterval] = useState(false);

  // Fetch preview when seats count changes (debounced)
  useEffect(() => {
    const currentSeats = subscriptionInfo?.subscription?.seats || 1;

    // Skip if no change or not role gerant
    if (newSeatsCount === currentSeats || userRole !== 'gerant') {
      setSeatsPreview(null);
      return;
    }

    // Debounce API call
    const timeoutId = setTimeout(async () => {
      if (!isMounted) return;

      setLoadingPreview(true);
      try {
        const response = await api.post(
          `/gerant/seats/preview`,
          { new_seats: newSeatsCount }
        );

        if (isMounted) {
          setSeatsPreview(response.data);
        }
      } catch (error) {
        if (error.response?.status === 404) {
          // Pas d'abonnement actif : prévisualisation non disponible (normal)
          if (isMounted) setSeatsPreview(null);
          return;
        }
        logger.error('Error fetching seats preview:', error);
        if (isMounted) setSeatsPreview(null);
      } finally {
        if (isMounted) {
          setLoadingPreview(false);
        }
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [newSeatsCount, subscriptionInfo?.subscription?.seats, userRole, isMounted]);

  // ⚠️ SECURITY: No price calculations on client side
  // All pricing is handled by Stripe via tiered pricing
  // This function is kept for compatibility but returns 0
  const calculateEstimatedAmount = (currentSeats, newSeats) => {
    // Stripe will calculate the exact amount
    return 0;
  };

  useEffect(() => {
    // Cleanup function to prevent setState on unmounted component
    return () => {
      setIsMounted(false);
    };
  }, []);

  // Fetch data whenever modal opens
  useEffect(() => {
    if (isOpen) {
      // If subscription info is provided as prop (from GerantDashboard), use it
      if (propSubscriptionInfo) {
        setSubscriptionInfo(propSubscriptionInfo);
        setLoading(false);
      } else {
        // Otherwise fetch from API (ManagerDashboard)
        fetchSubscriptionStatus();
      }

      // TOUJOURS fetcher le seller count pour avoir le bon nombre pour la validation
      fetchSellerCount();
      fetchSubscriptionHistory();
    }
  }, [isOpen, propSubscriptionInfo]);

  // Removed complex summary modal logic - using simple alert instead

  // Initialize newSeatsCount when subscription info is loaded
  useEffect(() => {
    if (subscriptionInfo && subscriptionInfo.subscription) {
      setNewSeatsCount(subscriptionInfo.subscription.seats || 1);
    }
  }, [subscriptionInfo]);

  const fetchSubscriptionStatus = async () => {
    try {
      // Use different endpoint based on user role
      const endpoint = userRole === 'gerant'
        ? `/gerant/subscription/status`
        : `/manager/subscription-status`;

      const response = await api.get(endpoint);
      if (isMounted) {
        setSubscriptionInfo(response.data);
      }
    } catch (error) {
      logger.error('Error fetching subscription:', error);
    } finally {
      if (isMounted) {
        setLoading(false);
      }
    }
  };

  const fetchSellerCount = async () => {
    try {
      // Use different endpoint based on user role
      const endpoint = userRole === 'gerant'
        ? `/gerant/dashboard/stats`
        : `/manager/sellers`;

      logger.log('🔍 Fetching seller count from:', endpoint, 'for role:', userRole);
      const response = await api.get(endpoint);
      logger.log('📦 Response data:', response.data);

      if (isMounted) {
        // Extract seller count based on response structure
        // Pour les gérants, on utilise total_sellers (qui compte déjà seulement les actifs)
        const count = userRole === 'gerant'
          ? (response.data.total_sellers || 0)
          : (response.data.length || 0);
        setSellerCount(count);
        logger.log('✅ Seller count set to:', count);
      }
    } catch (error) {
      logger.error('❌ Error fetching sellers:', error);
    }
  };

  const fetchSubscriptionHistory = async () => {
    // L'historique n'est disponible que pour les managers, pas pour les gérants
    if (userRole === 'gerant') {
      return; // Skip pour les gérants
    }

    try {
      const response = await api.get('/manager/subscription-history');
      if (isMounted) {
        setSubscriptionHistory(response.data.history || []);
      }
    } catch (error) {
      logger.error('Error fetching subscription history:', error);
    }
  };

  const handleChangeSeats = async (newSeats) => {
    if (!subscriptionInfo) return;

    try {
      logger.log('📡 Making API call to change seats...');

      const response = await api.post(
        `/gerant/subscription/update-seats?new_seats=${newSeats}`,
        {}
      );

      logger.log('✅ API response:', response.data);

      if (response.data.success) {
        toast.success('Nombre de sièges modifié avec succès !');
        // Close modal and reload
        onClose();
        await new Promise(resolve => setTimeout(resolve, 500));
        globalThis.location.reload();
      }
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Erreur lors du changement de sièges';
      logger.error('❌ API Error:', errorMsg);
      // Show error with toast - modal stays open
      toast.error(errorMsg, { duration: 6000 });
    }
  };

  // ==========================================
  // INTERVAL SWITCH HANDLERS
  // ==========================================

  const handleIntervalToggleClick = async () => {
    // Get current subscription interval
    const currentInterval = subscriptionInfo?.subscription?.billing_interval || 'month';
    const isCurrentlyActive = subscriptionInfo?.status === 'active';
    const isCurrentlyTrial = subscriptionInfo?.status === 'trialing';

    // If no active subscription, just toggle the UI state (for new subscriptions)
    if (!isCurrentlyActive && !isCurrentlyTrial) {
      setIsAnnual(!isAnnual);
      return;
    }

    // If currently on annual and trying to switch to monthly -> blocked
    if (currentInterval === 'year' && isAnnual) {
      // User is trying to uncheck annual (go back to monthly)
      toast.error(
        '❌ Impossible de passer de l\'annuel au mensuel. Pour changer, annulez votre abonnement actuel.',
        { duration: 5000 }
      );
      return;
    }

    // If currently monthly and wanting to go annual -> show confirmation modal (ou basculer si pas d'abonnement)
    if (currentInterval === 'month' && !isAnnual) {
      setLoadingIntervalSwitch(true);
      try {
        const response = await api.post(
          `/gerant/subscription/preview`,
          { new_interval: 'year' }
        );

        setIntervalSwitchPreview(response.data);
        setShowIntervalSwitchModal(true);
      } catch (error) {
        logger.error('Error fetching interval preview:', error);
        // 404 = aucun abonnement actif (choix de plan initial) : on affiche simplement l'option Annuel sans erreur
        if (error.response?.status === 404) {
          setIsAnnual(true);
        } else {
          const detail = error.response?.data?.detail;
          toast.error(detail || 'Erreur lors du calcul du changement');
        }
      } finally {
        setLoadingIntervalSwitch(false);
      }
      return;
    }

    // Otherwise just toggle (for display purposes in plan selection)
    setIsAnnual(!isAnnual);
  };

  const handleConfirmIntervalSwitch = async () => {
    setSwitchingInterval(true);
    try {
      const response = await api.post(
        `/gerant/subscription/switch-interval`,
        { interval: 'year' }
      );

      // Success!
      toast.success(response.data.message, { duration: 5000 });

      // Update local state
      setIsAnnual(true);
      setShowIntervalSwitchModal(false);
      setIntervalSwitchPreview(null);

      // Refresh subscription info
      if (typeof fetchSubscriptionStatus === 'function') {
        await fetchSubscriptionStatus();
      }

    } catch (error) {
      logger.error('Error switching interval:', error);
      toast.error(error.response?.data?.detail || 'Erreur lors du changement d\'intervalle');
    } finally {
      setSwitchingInterval(false);
    }
  };

  const handleSelectPlan = (plan) => {
    // Check if trying to downgrade from annual to monthly (NOT ALLOWED)
    const currentBillingPeriod = subscriptionInfo?.subscription?.billing_interval || 'month';
    const selectedBillingPeriod = isAnnual ? 'year' : 'month';
    const currentPlan = subscriptionInfo?.plan || 'starter';

    if (currentBillingPeriod === 'year' && selectedBillingPeriod === 'month' && plan === currentPlan) {
      toast.error(
        '❌ Impossible de passer d\'un abonnement annuel à mensuel. Pour changer, vous devez annuler votre abonnement actuel.',
        { duration: 6000 }
      );
      return;
    }

    // Check if user has too many sellers for Small Team plan
    const planInfo = PLANS[plan];
    if (sellerCount > planInfo.maxSellers) {
      toast.error(
        `Vous avez ${sellerCount} vendeur(s). Le plan ${planInfo.name} est limité à ${planInfo.maxSellers}. Veuillez mettre en sommeil des vendeurs ou choisir le plan Medium Team.`,
        { duration: 5000 }
      );
      return;
    }

    // Calculate suggested quantity
    const suggestedQuantity = Math.max(sellerCount, planInfo.minSellers);
    const isUpgrade = (plan === 'professional' && currentPlan === 'starter');

    // ⚠️ SECURITY: No price calculations - Stripe handles all pricing
    // Show plan confirmation modal (without price data)
    setPlanConfirmData({
      planKey: plan,
      planName: planInfo.name,
      quantity: suggestedQuantity,
      currentPlan,
      isUpgrade,
      isAnnual: isAnnual
    });
    setShowPlanConfirmModal(true);
  };

  const handleProceedToPayment = async () => {
    if (!selectedPlan) return;

    // OPTION 1: Close ALL modals FIRST to avoid DOM conflicts
    logger.log('🔄 Closing modals before checkout...');
    setShowQuantityModal(false);
    onClose(); // Close main modal

    // Delay to let modals close
    await new Promise(resolve => setTimeout(resolve, 300));

    try {
      const originUrl = globalThis.location.origin;

      logger.log('📡 Creating checkout session for role:', userRole);

      // Use different endpoint based on user role
      const endpoint = userRole === 'gerant'
        ? `/gerant/stripe/checkout`
        : `/manager/stripe/checkout`;

      const requestData = userRole === 'gerant'
        ? {
            origin_url: originUrl,
            quantity: selectedQuantity,
            billing_period: isAnnual ? 'annual' : 'monthly',
            promo_code: promoStatus === 'valid' ? promoCode : undefined
          }
        : {
            plan: selectedPlan,
            origin_url: originUrl,
            quantity: selectedQuantity,
            billing_period: isAnnual ? 'annual' : 'monthly'
          };

      const response = await api.post(endpoint, requestData);

      logger.log('✅ Checkout response:', response.data);

      // If there's a checkout_url (for gerant) or url (for manager), redirect to Stripe
      const checkoutUrl = response.data.checkout_url || response.data.url;
      if (checkoutUrl) {
        if (!isSafeUrl(checkoutUrl)) {
          logger.error('Open redirect blocked: URL not in allowlist', { url: checkoutUrl });
          toast.error('Redirection non autorisée. Veuillez réessayer.');
          return;
        }
        const finalTarget = checkoutUrl.startsWith('/') ? checkoutUrl : (isSafeUrl(checkoutUrl) ? checkoutUrl : '/');
        logger.log('🔄 Redirecting to Stripe...');
        safeRedirect(finalTarget, 'replace');
      } else if (response.data.success) {
        // If no URL (subscription updated directly), reload
        logger.log('✅ Subscription updated, reloading...');
        globalThis.location.reload();
      }
    } catch (error) {
      logger.error('❌ Checkout error COMPLET:', {
        message: error.message,
        response: error.response,
        responseData: error.response?.data,
        responseStatus: error.response?.status,
        stack: error.stack
      });

      const detail = error.response?.data?.detail || '';
      const isBillingProfileError = error.response?.status === 400 && (
        detail.toLowerCase().includes('facturation') ||
        detail.toLowerCase().includes('billing') ||
        detail.toLowerCase().includes('profil') ||
        detail.toLowerCase().includes('vat') ||
        detail.toLowerCase().includes('tva')
      );

      if (isBillingProfileError && onOpenBillingProfile) {
        toast.error('Profil de facturation incomplet', {
          description: 'Veuillez compléter vos informations de facturation avant de souscrire.',
          duration: 6000,
          action: { label: 'Compléter', onClick: onOpenBillingProfile },
        });
        onOpenBillingProfile();
      } else {
        const errorMessage = detail || error.message || 'Erreur lors de la création de la session de paiement';
        toast.error(`Erreur: ${errorMessage}`, {
          duration: 8000,
          description: error.response?.status ? `Code HTTP: ${error.response.status}` : undefined,
        });
      }
    }
  };

  const handleQuantityChange = (delta) => {
    const planInfo = PLANS[selectedPlan];
    // Minimum is either the plan's minimum or the current seller count (whichever is higher)
    const minQuantity = Math.max(sellerCount, planInfo.minSellers);
    const newQuantity = selectedQuantity + delta;

    if (newQuantity >= minQuantity && newQuantity <= planInfo.maxSellers) {
      setSelectedQuantity(newQuantity);
    }
  };

  const handleCancelSubscription = () => {
    // Show custom confirmation modal
    setSubscriptionAction('cancel_subscription');
    setShowSubscriptionActionModal(true);
  };

  const confirmCancelSubscription = async () => {
    try {
      const response = await api.post(
        `/gerant/subscription/cancel`,
        {}
      );

      toast.success(response.data.message);

      // Refresh subscription status
      fetchSubscriptionStatus();
    } catch (error) {
      logger.error('Error canceling subscription:', error);
      const errorMessage = error.response?.data?.detail || 'Erreur lors de l\'annulation de l\'abonnement';
      toast.error(errorMessage);
    }
  };

  const handleReactivateSubscription = () => {
    // Show custom confirmation modal
    setSubscriptionAction('reactivate_subscription');
    setShowSubscriptionActionModal(true);
  };

  const confirmReactivateSubscription = async () => {
    try {
      const response = await api.post(
        `/gerant/subscription/reactivate`,
        {}
      );

      toast.success('✅ ' + response.data.message);

      // Refresh subscription status to update UI
      fetchSubscriptionStatus();
    } catch (error) {
      logger.error('Error reactivating subscription:', error);
      const errorMessage = error.response?.data?.detail || 'Erreur lors de la réactivation de l\'abonnement';
      toast.error('❌ ' + errorMessage);
    }
  };

  const currentPlan = subscriptionInfo?.plan || 'starter';
  const isActive = subscriptionInfo?.status === 'active';

  const handleClose = () => {
    // Prevent closing while processing
    if (processingPlan) return;
    onClose();
  };

  return {
    subscriptionInfo,
    setSubscriptionInfo,
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
    setIsAnnual,
    promoCode,
    setPromoCode,
    promoStatus,
    setPromoStatus,
    handleValidatePromo,
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
  };
}
