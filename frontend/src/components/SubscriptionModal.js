import React, { useState, useEffect } from 'react';
import { unstable_batchedUpdates } from 'react-dom';
import { X, Crown, Check, Loader, Users, Star } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import QuantityModal from './QuantityModal';
import ConfirmActionModal from './ConfirmActionModal';

const API = process.env.REACT_APP_BACKEND_URL;

const PLANS = {
  starter: {
    name: 'Small Team',
    pricePerSeller: 29,
    minSellers: 1,
    maxSellers: 5,
    subtitle: 'Petites boutiques',
    mainFeatures: [
      'Dashboard Manager & Vendeur',
      'Diagnostic DISC complet',
      'Coaching IA personnalisé',
      'Suivi KPI en temps réel',
      'Objectifs & Challenges',
      'Analyses des ventes intelligentes',
      'Historique illimité'
    ],
    specs: [
      '1 à 5 vendeurs',
      '150 + (30 × vendeurs) analyses IA Manager/mois',
      '100+ analyses IA par vendeur/mois',
      'Support email sous 48h'
    ]
  },
  professional: {
    name: 'Medium Team',
    pricePerSeller: 25,
    minSellers: 6,
    maxSellers: 15,
    subtitle: 'Magasins moyens',
    isRecommended: true,
    mainFeatures: [
      'Dashboard Manager & Vendeur',
      'Diagnostic DISC complet',
      'Coaching IA personnalisé',
      'Suivi KPI en temps réel',
      'Objectifs & Challenges',
      'Analyses des ventes intelligentes',
      'Historique illimité'
    ],
    specs: [
      '6 à 15 vendeurs',
      '150 + (30 × vendeurs) analyses IA Manager/mois',
      '100+ analyses IA par vendeur/mois',
      'Support email sous 48h'
    ]
  },
  enterprise: {
    name: 'Large Team',
    pricePerSeller: null,
    minSellers: 16,
    maxSellers: null,
    subtitle: 'Pour réseaux & enseignes',
    isEnterprise: true,
    mainFeatures: [
      'Dashboard Manager & Vendeur',
      'Diagnostic DISC complet',
      'Coaching IA personnalisé',
      'Suivi KPI en temps réel',
      'Objectifs & Challenges',
      'Analyses des ventes intelligentes',
      'Historique illimité'
    ],
    specs: [
      '16+ vendeurs',
      '150 + (30 × vendeurs) analyses IA Manager/mois',
      '100+ analyses IA par vendeur/mois',
      'Support email sous 48h'
    ]
  }
};

export default function SubscriptionModal({ isOpen, onClose, subscriptionInfo: propSubscriptionInfo, userRole }) {
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

  // Calculate estimated amount for seat change
  const calculateEstimatedAmount = (currentSeats, newSeats) => {
    const diff = newSeats - currentSeats;
    if (diff === 0) return 0;
    
    // Price tiers: 1-5 seats = 29€, 6+ seats = 25€
    const pricePerSeat = newSeats <= 5 ? 29 : 25;
    
    // Simplified prorata calculation (assume mid-month)
    const monthlyChange = Math.abs(diff) * pricePerSeat;
    const prorataEstimate = monthlyChange * 0.5; // Rough estimate for mid-month
    
    return diff > 0 ? prorataEstimate : -prorataEstimate;
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
        // Still fetch seller count from API for used_seats
        if (propSubscriptionInfo.subscription) {
          setSellerCount(propSubscriptionInfo.subscription.used_seats || 0);
        }
      } else {
        // Otherwise fetch from API (ManagerDashboard)
        fetchSubscriptionStatus();
        fetchSellerCount();
      }
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
      const token = localStorage.getItem('token');
      // Use different endpoint based on user role
      const endpoint = userRole === 'gerant' 
        ? `${API}/api/gerant/subscription/status`
        : `${API}/api/subscription/status`;
      
      const response = await axios.get(endpoint, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (isMounted) {
        setSubscriptionInfo(response.data);
      }
    } catch (error) {
      console.error('Error fetching subscription:', error);
    } finally {
      if (isMounted) {
        setLoading(false);
      }
    }
  };

  const fetchSellerCount = async () => {
    try {
      const token = localStorage.getItem('token');
      // Use different endpoint based on user role
      const endpoint = userRole === 'gerant'
        ? `${API}/api/gerant/dashboard/stats`
        : `${API}/api/manager/sellers`;
      
      const response = await axios.get(endpoint, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (isMounted) {
        // Extract seller count based on response structure
        const count = userRole === 'gerant' 
          ? (response.data.total_sellers || 0)
          : (response.data.length || 0);
        setSellerCount(count);
      }
    } catch (error) {
      console.error('Error fetching sellers:', error);
    }
  };

  const fetchSubscriptionHistory = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/api/subscription/history`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (isMounted) {
        setSubscriptionHistory(response.data.history || []);
      }
    } catch (error) {
      console.error('Error fetching subscription history:', error);
    }
  };

  const handleChangeSeats = async (newSeats) => {
    if (!subscriptionInfo) return;
    
    try {
      const token = localStorage.getItem('token');
      console.log('📡 Making API call to change seats...');
      
      const response = await axios.post(
        `${API}/api/subscription/change-seats?new_seats=${newSeats}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      console.log('✅ API response:', response.data);
      
      if (response.data.success) {
        toast.success('Nombre de sièges modifié avec succès !');
        // Close modal and reload
        onClose();
        await new Promise(resolve => setTimeout(resolve, 500));
        window.location.reload();
      }
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Erreur lors du changement de sièges';
      console.error('❌ API Error:', errorMsg);
      // Show error with toast - modal stays open
      toast.error(errorMsg, { duration: 6000 });
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
    
    // Calculate price based on billing period
    const pricePerSeat = isAnnual 
      ? Math.round(planInfo.pricePerSeller * 12 * 0.8) 
      : planInfo.pricePerSeller;
    const totalAmount = suggestedQuantity * pricePerSeat;
    
    // Show plan confirmation modal
    setPlanConfirmData({
      planKey: plan,
      planName: planInfo.name,
      pricePerSeat: pricePerSeat,
      quantity: suggestedQuantity,
      currentPlan,
      isUpgrade,
      monthlyAmount: totalAmount,
      isAnnual: isAnnual,
      monthlyPrice: planInfo.pricePerSeller
    });
    setShowPlanConfirmModal(true);
  };

  const handleProceedToPayment = async () => {
    if (!selectedPlan) return;
    
    // OPTION 1: Close ALL modals FIRST to avoid DOM conflicts
    console.log('🔄 Closing modals before checkout...');
    setShowQuantityModal(false);
    onClose(); // Close main modal
    
    // Delay to let modals close
    await new Promise(resolve => setTimeout(resolve, 300));
    
    try {
      const token = localStorage.getItem('token');
      const originUrl = window.location.origin;
      
      console.log('📡 Creating checkout session...');
      const response = await axios.post(
        `${API}/api/checkout/create-session`,
        {
          plan: selectedPlan,
          origin_url: originUrl,
          quantity: selectedQuantity,
          billing_period: isAnnual ? 'annual' : 'monthly'
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      console.log('✅ Checkout response:', response.data);
      
      // If there's a URL, redirect to Stripe
      if (response.data.url) {
        console.log('🔄 Redirecting to Stripe...');
        window.location.replace(response.data.url);
      } else if (response.data.success) {
        // If no URL (subscription updated directly), reload
        console.log('✅ Subscription updated, reloading...');
        window.location.reload();
      }
    } catch (error) {
      console.error('❌ Checkout error COMPLET:', {
        message: error.message,
        response: error.response,
        responseData: error.response?.data,
        responseStatus: error.response?.status,
        stack: error.stack
      });
      
      const errorMessage = error.response?.data?.detail || error.message || 'Erreur lors de la création de la session de paiement';
      
      // Afficher l'erreur détaillée dans un toast plus long
      toast.error(`Erreur: ${errorMessage}`, { 
        duration: 8000,
        description: error.response?.status ? `Code HTTP: ${error.response.status}` : undefined
      });
      
      // Ne pas recharger automatiquement pour permettre de voir l'erreur
      // setTimeout(() => window.location.reload(), 2000);
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
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/api/subscription/cancel`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      toast.success(response.data.message);
      
      // Refresh subscription status
      fetchSubscriptionStatus();
    } catch (error) {
      console.error('Error canceling subscription:', error);
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
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/api/subscription/reactivate`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      toast.success('✅ ' + response.data.message);
      
      // Refresh subscription status to update UI
      fetchSubscriptionStatus();
    } catch (error) {
      console.error('Error reactivating subscription:', error);
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
          {/* Current Status */}
          {subscriptionInfo && (
            <div className="mb-8 p-6 bg-blue-50 rounded-xl border-2 border-blue-200">
              <h3 className="text-xl font-bold text-gray-800 mb-2">
                Statut actuel
              </h3>
              {subscriptionInfo.status === 'trialing' && (
                <div>
                  <p className="text-gray-700">
                    <span className="font-semibold">Essai gratuit</span> - {subscriptionInfo.days_left} jour{subscriptionInfo.days_left > 1 ? 's' : ''} restant{subscriptionInfo.days_left > 1 ? 's' : ''}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    Fin de l'essai le {new Date(subscriptionInfo.trial_end).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              )}
              {subscriptionInfo.status === 'active' && (
                <div>
                  <p className="text-gray-700">
                    <span className="font-semibold">Plan {PLANS[currentPlan].name}</span>
                    {subscriptionInfo.subscription?.billing_interval && (
                      <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-800 text-xs font-semibold rounded">
                        {subscriptionInfo.subscription.billing_interval === 'year' ? 'Annuel' : 'Mensuel'}
                      </span>
                    )}
                    <span className="ml-2 text-green-600 font-medium">- Actif</span>
                  </p>
                  
                  {/* Period information */}
                  <div className="mt-2 space-y-1">
                    {subscriptionInfo.subscription?.current_period_start && (
                      <p className="text-sm text-gray-600">
                        📅 Début: {new Date(subscriptionInfo.subscription.current_period_start).toLocaleDateString('fr-FR')}
                      </p>
                    )}
                    <p className="text-sm text-gray-600">
                      {subscriptionInfo.subscription?.cancel_at_period_end ? (
                        <>
                          ⚠️ Annulation programmée - Accès jusqu'au {subscriptionInfo.subscription?.current_period_end ? new Date(subscriptionInfo.subscription.current_period_end).toLocaleDateString('fr-FR') : subscriptionInfo.period_end ? new Date(subscriptionInfo.period_end).toLocaleDateString('fr-FR') : 'N/A'}
                        </>
                      ) : (
                        <>
                          🔄 Renouvellement: {subscriptionInfo.subscription?.current_period_end ? new Date(subscriptionInfo.subscription.current_period_end).toLocaleDateString('fr-FR') : subscriptionInfo.period_end ? new Date(subscriptionInfo.period_end).toLocaleDateString('fr-FR') : 'N/A'}
                        </>
                      )}
                    </p>
                  </div>
                  {/* Seats information */}
                  <div className="mt-3 p-3 bg-white rounded-lg border border-blue-300">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-blue-600" />
                        <span className="font-semibold text-gray-800">Sièges vendeurs</span>
                      </div>
                      <div className="text-right">
                        <span className="text-2xl font-bold text-blue-600">
                          {sellerCount}
                        </span>
                        <span className="text-gray-500 mx-1">/</span>
                        <span className="text-xl font-semibold text-gray-700">
                          {subscriptionInfo.subscription?.seats || PLANS[currentPlan].maxSellers}
                        </span>
                        <p className="text-xs text-gray-500 mt-0.5">actifs / achetés</p>
                      </div>
                    </div>
                  </div>
                  {!subscriptionInfo.subscription?.cancel_at_period_end ? (
                    <button
                      onClick={handleCancelSubscription}
                      className="mt-3 text-sm text-red-600 hover:text-red-700 underline"
                    >
                      Annuler l'abonnement
                    </button>
                  ) : (
                    <button
                      onClick={handleReactivateSubscription}
                      className="mt-3 px-4 py-2 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 transition-colors"
                    >
                      ✅ Réactiver l'abonnement
                    </button>
                  )}
                </div>
              )}
              {subscriptionInfo.status === 'trial_expired' && (
                <div>
                  <p className="text-orange-700 font-semibold">
                    Essai gratuit terminé
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    Choisissez un plan pour continuer à utiliser toutes les fonctionnalités
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Seat Management - Only for active subscriptions */}
          {subscriptionInfo && subscriptionInfo.status === 'active' && subscriptionInfo.subscription && (
            <div className="mb-8">
              <details className="bg-white rounded-xl border-2 border-green-200 overflow-hidden">
                <summary className="bg-gradient-to-r from-green-500 to-emerald-600 p-6 text-white cursor-pointer hover:from-green-600 hover:to-emerald-700 transition-all">
                  <h3 className="text-2xl font-bold flex items-center gap-3">
                    <Users className="w-7 h-7" />
                    Gérer mes sièges vendeurs
                    <span className="ml-auto text-sm font-normal opacity-75">▼ Cliquez pour développer</span>
                  </h3>
                  <p className="text-green-50 text-sm mt-1">Ajustez votre capacité en temps réel</p>
                </summary>
              
              <div className="bg-white p-6">
                {/* Stats Cards */}
                <div className="grid md:grid-cols-3 gap-3 mb-4">
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-3 rounded-lg border border-blue-200">
                    <p className="text-xs font-semibold text-blue-700 mb-1">Sièges achetés</p>
                    <p className="text-2xl font-black text-blue-900">{subscriptionInfo.subscription.seats || 1}</p>
                  </div>
                  
                  <div className="bg-gradient-to-br from-green-50 to-green-100 p-3 rounded-lg border border-green-200">
                    <p className="text-xs font-semibold text-green-700 mb-1">Vendeurs actifs</p>
                    <p className="text-2xl font-black text-green-900">{sellerCount}</p>
                  </div>
                  
                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-3 rounded-lg border border-purple-200">
                    <p className="text-xs font-semibold text-purple-700 mb-1">Sièges libres</p>
                    <p className="text-2xl font-black text-purple-900">
                      {(subscriptionInfo.subscription.seats || 1) - sellerCount}
                    </p>
                  </div>
                </div>

              {/* Adjustment Section */}
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-4 rounded-lg border border-gray-200">
                
                {/* Adjust buttons */}
                <div className="flex items-center gap-3 mb-4">
                  <button
                    onClick={() => setNewSeatsCount(Math.max(sellerCount, newSeatsCount - 1))}
                    disabled={adjustingSeats || newSeatsCount <= sellerCount}
                    className="flex-1 py-3 bg-red-500 text-white font-bold rounded-lg hover:bg-red-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
                  >
                    <span className="text-xl">−</span> Retirer 1
                  </button>
                  
                  <input
                    type="number"
                    min={sellerCount}
                    max={15}
                    value={newSeatsCount}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || sellerCount;
                      setNewSeatsCount(Math.max(sellerCount, Math.min(15, val)));
                    }}
                    disabled={adjustingSeats}
                    className="w-24 text-center text-2xl font-bold border-3 border-green-500 rounded-lg py-3 focus:ring-4 focus:ring-green-200 focus:outline-none disabled:bg-gray-100 shadow-md"
                  />
                  
                  <button
                    onClick={() => setNewSeatsCount(Math.min(15, newSeatsCount + 1))}
                    disabled={adjustingSeats || newSeatsCount >= 15}
                    className="flex-1 py-3 bg-green-500 text-white font-bold rounded-lg hover:bg-green-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
                  >
                    <span className="text-xl">+</span> Ajouter 1
                  </button>
                </div>

                {/* Warning when can't reduce */}
                {newSeatsCount <= sellerCount && (
                  <div className="mb-4 p-4 bg-orange-50 border-2 border-orange-300 rounded-lg">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center text-white font-bold text-xl">
                        !
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-orange-800 mb-1">
                          Impossible de réduire en dessous de {sellerCount} siège{sellerCount > 1 ? 's' : ''}
                        </p>
                        <p className="text-sm text-orange-700">
                          Vous avez actuellement <strong>{sellerCount} vendeur{sellerCount > 1 ? 's' : ''} actif{sellerCount > 1 ? 's' : ''}</strong>. 
                          Pour réduire votre abonnement, veuillez d'abord mettre en sommeil ou supprimer des vendeurs dans <strong>"Mon Équipe"</strong>.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Preview of change - Simplified */}
                {newSeatsCount !== (subscriptionInfo.subscription.seats || 1) && (
                  <div className="mb-3 p-3 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg text-white shadow">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs opacity-75">Changement prévu</p>
                        <p className="text-lg font-bold">
                          {(subscriptionInfo.subscription.seats || 1)} → {newSeatsCount} sièges
                        </p>
                      </div>
                      <div className={`px-3 py-1 rounded font-bold text-lg ${newSeatsCount > (subscriptionInfo.subscription.seats || 1) ? 'bg-green-400 text-green-900' : 'bg-orange-400 text-orange-900'}`}>
                        {newSeatsCount > (subscriptionInfo.subscription.seats || 1) ? '+' : ''}
                        {newSeatsCount - (subscriptionInfo.subscription.seats || 1)}
                      </div>
                    </div>
                  </div>
                )}

                <button
                  onClick={() => {
                    const currentSeats = subscriptionInfo.subscription.seats || 1;
                    const diff = newSeatsCount - currentSeats;
                    const action = diff > 0 ? 'Ajout' : 'Réduction';
                    const estimatedAmount = calculateEstimatedAmount(currentSeats, newSeatsCount);
                    
                    // Show custom confirmation modal with estimated amount
                    setConfirmData({
                      action,
                      diff: Math.abs(diff),
                      currentSeats,
                      newSeats: newSeatsCount,
                      isIncrease: diff > 0,
                      estimatedAmount: Math.abs(estimatedAmount)
                    });
                    setShowConfirmModal(true);
                  }}
                  disabled={adjustingSeats || newSeatsCount === (subscriptionInfo.subscription.seats || 1)}
                  className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-black text-lg rounded-xl hover:from-green-600 hover:to-emerald-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-xl hover:shadow-2xl transform hover:-translate-y-0.5"
                >
                  {adjustingSeats ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader className="w-5 h-5 animate-spin" />
                      Modification en cours...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <Check className="w-5 h-5" />
                      Valider le changement
                    </span>
                  )}
                </button>
              </div>

              {/* History */}
              {subscriptionHistory.length > 0 && (
                <div className="px-6 pb-6">
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <p className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      📊 Historique des modifications ({subscriptionHistory.length})
                    </p>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {subscriptionHistory.map((entry, idx) => (
                        <div key={entry.id || idx} className="text-sm p-2 bg-white rounded border-l-4 border-blue-400">
                          <p className="font-semibold text-gray-700">
                            {entry.action === 'created' && '🎉 Abonnement créé'}
                            {entry.action === 'seats_added' && '➕ Sièges ajoutés'}
                            {entry.action === 'seats_removed' && '➖ Sièges réduits'}
                            {entry.action === 'upgraded' && '⬆️ Mise à niveau'}
                            {entry.action === 'downgraded' && '⬇️ Réduction'}
                          </p>
                          <p className="text-gray-600">
                            {entry.previous_seats && entry.new_seats && (
                              <>{entry.previous_seats} → {entry.new_seats} siège(s)</>
                            )}
                            {entry.previous_plan !== entry.new_plan && entry.new_plan && (
                              <> • Plan: {entry.new_plan}</>
                            )}
                          </p>
                          {entry.amount_charged !== null && entry.amount_charged !== undefined && (
                            <p className={`text-xs ${entry.amount_charged >= 0 ? 'text-green-600' : 'text-orange-600'}`}>
                              {entry.amount_charged >= 0 ? 'Facturé' : 'Crédité'}: {Math.abs(entry.amount_charged).toFixed(2)}€
                            </p>
                          )}
                          <p className="text-xs text-gray-500">
                            {new Date(entry.timestamp).toLocaleString('fr-FR')}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              </div>
              </details>
            </div>
          )}

          {/* Plans */}
          <h3 className="text-2xl font-bold text-gray-800 mb-4 text-center">
            Choisissez votre plan
          </h3>
          
          {/* Billing Period Toggle */}
          <div className="flex justify-center items-center gap-4 mb-16">
            <span className={`text-lg font-semibold ${!isAnnual ? 'text-[#1E40AF]' : 'text-slate-400'}`}>
              Mensuel
            </span>
            <button
              onClick={() => setIsAnnual(!isAnnual)}
              className={`relative w-16 h-8 rounded-full transition-colors duration-300 ${
                isAnnual ? 'bg-gradient-to-r from-[#1E40AF] to-[#1E3A8A]' : 'bg-slate-300'
              }`}
            >
              <div
                className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-300 ${
                  isAnnual ? 'transform translate-x-8' : ''
                }`}
              />
            </button>
            <span className={`text-lg font-semibold ${isAnnual ? 'text-[#1E40AF]' : 'text-slate-400'}`}>
              Annuel
            </span>
            {isAnnual && (
              <span className="ml-2 px-3 py-1 bg-green-100 text-green-700 text-sm font-bold rounded-full">
                Économisez 20%
              </span>
            )}
          </div>
          
          <div className="grid md:grid-cols-3 gap-6">
            {Object.entries(PLANS).map(([planKey, plan]) => {
              // Get current subscription billing period from Stripe data
              const currentBillingPeriod = subscriptionInfo?.subscription?.billing_interval || 'month';
              const selectedBillingPeriod = isAnnual ? 'year' : 'month';
              
              // Check if this is the current plan AND same billing period
              const isCurrentPlan = isActive && currentPlan === planKey && currentBillingPeriod === selectedBillingPeriod;
              const isProcessing = processingPlan === planKey;
              const isEnterprise = plan.isEnterprise;
              const isRecommended = plan.isRecommended;
              
              return (
                <div
                  key={`${planKey}-${isAnnual ? 'annual' : 'monthly'}`}
                  className={`bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all ${
                    isRecommended
                      ? 'border-4 border-[#F97316] relative transform scale-105'
                      : isEnterprise
                      ? 'border-2 border-[#1E40AF]/30'
                      : 'border-2 border-slate-200'
                  }`}
                >
                  {/* Recommended badge */}
                  {isRecommended && (
                    <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 z-10">
                      <div className="bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white px-6 py-2 rounded-full text-sm font-bold flex items-center gap-2">
                        <Star className="w-4 h-4" />
                        RECOMMANDÉ
                      </div>
                    </div>
                  )}

                  <div className={`text-center mb-6 ${isRecommended ? 'pt-4' : ''}`}>
                    <h3 className="text-2xl font-bold text-[#1E40AF] mb-2">{plan.name}</h3>
                    <p className="text-[#334155] mb-4">{plan.subtitle}</p>
                    {isEnterprise ? (
                      <div>
                        <div className="flex items-baseline justify-center gap-2">
                          <span className="text-3xl font-bold text-[#1E40AF]">Sur devis</span>
                        </div>
                        <p className="text-sm text-green-600 font-semibold mt-2">16+ espaces vendeur</p>
                        <p className="text-xs text-gray-600 mt-1">+ Espace Manager inclus</p>
                      </div>
                    ) : !isAnnual ? (
                      <div>
                        <div className="flex items-baseline justify-center gap-2">
                          <span className={`text-5xl font-bold ${
                            isRecommended 
                              ? 'bg-gradient-to-r from-[#F97316] to-[#EA580C] bg-clip-text text-transparent'
                              : 'text-[#1E40AF]'
                          }`}>
                            {plan.pricePerSeller}€
                          </span>
                          <span className="text-[#334155]">/vendeur/mois</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Hors taxe</p>
                        <p className={`text-sm font-semibold mt-2 ${
                          isRecommended ? 'text-[#EA580C]' : 'text-green-600'
                        }`}>
                          {plan.minSellers} à {plan.maxSellers} espaces vendeur
                        </p>
                        <p className="text-xs text-gray-600 mt-1">+ Espace Manager inclus</p>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-baseline justify-center gap-2">
                          <span className={`text-5xl font-bold ${
                            isRecommended 
                              ? 'bg-gradient-to-r from-[#F97316] to-[#EA580C] bg-clip-text text-transparent'
                              : 'text-[#1E40AF]'
                          }`}>
                            {Math.round(plan.pricePerSeller * 12 * 0.8)}€
                          </span>
                          <span className="text-[#334155]">/vendeur/an</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Hors taxe</p>
                        <p className="text-sm text-green-600 font-semibold mt-2">
                          {plan.minSellers} à {plan.maxSellers} espaces vendeur
                        </p>
                        <p className="text-xs text-gray-600 mt-1">Au lieu de {plan.pricePerSeller * 12}€ • Économisez {Math.round(plan.pricePerSeller * 12 * 0.2)}€/vendeur/an</p>
                      </div>
                    )}
                  </div>

                  {/* Main Features */}
                  <ul className="space-y-3 mb-4">
                    {plan.mainFeatures.map((feature, idx) => (
                      <li key={`plan-${planKey}-main-${idx}-${feature.substring(0, 15)}`} className="flex items-center gap-3">
                        <Check className="w-5 h-5 text-[#10B981] flex-shrink-0" />
                        <span className="text-[#334155]">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {/* Specs section */}
                  <div className={`border-t ${
                    isRecommended ? 'border-[#F97316]' : 'border-gray-200'
                  } my-4 pt-4`}>
                    <p className={`text-sm font-semibold mb-3 ${
                      isRecommended ? 'text-[#F97316]' : 'text-[#1E40AF]'
                    }`}>
                      Spécificités :
                    </p>
                    <ul className="space-y-3 mb-4">
                      {plan.specs.map((spec, idx) => (
                        <li key={`plan-${planKey}-spec-${idx}-${spec.substring(0, 15)}`} className="flex items-center gap-3">
                          <Check className="w-5 h-5 text-[#10B981] flex-shrink-0" />
                          <span className="text-[#334155] font-medium">{spec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Warning if too many sellers */}
                  {!isEnterprise && plan.maxSellers && sellerCount > plan.maxSellers && !isCurrentPlan && (
                    <div className="mb-4 p-3 bg-orange-50 border-2 border-orange-300 rounded-lg">
                      <p className="text-sm text-orange-800 font-semibold">
                        ⚠️ Attention
                      </p>
                      <p className="text-xs text-orange-700 mt-1">
                        Vous avez {sellerCount} vendeur(s). Ce plan est limité à {plan.maxSellers}.
                      </p>
                    </div>
                  )}

                  {isCurrentPlan ? (
                    <button
                      disabled
                      className="w-full py-3 bg-green-600 text-white rounded-lg font-semibold"
                    >
                      ✓ Plan actuel {isAnnual ? '(Annuel)' : '(Mensuel)'}
                    </button>
                  ) : isEnterprise ? (
                    <a
                      href="mailto:contact@retailperformerai.com?subject=Demande d'information - Plan Large Team"
                      className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-colors font-semibold flex items-center justify-center gap-2"
                    >
                      📧 Nous contacter
                    </a>
                  ) : (
                    <>
                      {/* Check if trying to downgrade from annual to monthly (not allowed) */}
                      {isActive && currentPlan === planKey && currentBillingPeriod === 'year' && selectedBillingPeriod === 'month' ? (
                        <div className="w-full">
                          <button
                            disabled
                            className="w-full py-3 bg-gray-400 text-white rounded-lg font-semibold cursor-not-allowed opacity-50"
                          >
                            Non disponible
                          </button>
                          <p className="text-xs text-orange-600 mt-2 text-center">
                            ⚠️ Impossible de passer d'annuel à mensuel. Veuillez annuler votre abonnement actuel.
                          </p>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleSelectPlan(planKey)}
                          disabled={isProcessing}
                          className="w-full py-3 bg-[#1E40AF] text-white rounded-lg hover:bg-[#1E3A8A] transition-colors font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {isProcessing ? (
                            <>
                              <Loader className="w-5 h-5 animate-spin" />
                              Redirection...
                            </>
                          ) : (
                            <>
                              <Crown className="w-5 h-5" />
                              {isActive && currentPlan === planKey && currentBillingPeriod === 'month' && selectedBillingPeriod === 'year'
                                ? "Passer à l'annuel"
                                : isActive 
                                ? 'Changer de plan' 
                                : 'Choisir ce plan'}
                            </>
                          )}
                        </button>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* Info */}
          <div className="mt-8 space-y-3">
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-sm text-gray-600 text-center">
                💳 Paiement sécurisé par Stripe • ✅ Annulation à tout moment • 📧 Support inclus
              </p>
            </div>
            
            {/* Billing period change notice */}
            {isActive && subscriptionInfo.subscription?.billing_interval === 'year' && !isAnnual && (
              <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                <p className="text-sm text-orange-800 text-center font-semibold">
                  ℹ️ Vous avez un abonnement annuel. Le passage à un abonnement mensuel n'est pas possible. Pour changer, vous devez annuler votre abonnement actuel et souscrire un nouveau plan mensuel.
                </p>
              </div>
            )}
            
            {isActive && subscriptionInfo.subscription?.billing_interval === 'month' && isAnnual && (
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <p className="text-sm text-green-800 text-center font-semibold">
                  💰 Économisez 20% en passant à la facturation annuelle !
                </p>
              </div>
            )}
          </div>
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
      {showPlanConfirmModal && planConfirmData && (
        <div 
          onClick={(e) => { 
            if (e.target === e.currentTarget) { 
              setShowPlanConfirmModal(false); 
              setPlanConfirmData(null); 
            } 
          }} 
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] backdrop-blur-sm"
        >
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
            {/* Header */}
            <div className={`p-4 text-white ${
              planConfirmData.isUpgrade 
                ? 'bg-gradient-to-r from-purple-500 to-indigo-600' 
                : 'bg-gradient-to-r from-blue-500 to-cyan-600'
            }`}>
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Crown className="w-5 h-5" />
                Confirmation du plan
              </h3>
            </div>

            {/* Content */}
            <div className="p-4 space-y-3">
              {/* Plan Selected */}
              <div className={`rounded-lg p-3 text-center border-2 ${
                planConfirmData.isUpgrade 
                  ? 'bg-purple-50 border-purple-300' 
                  : 'bg-blue-50 border-blue-300'
              }`}>
                <p className="text-sm opacity-75 font-semibold">Plan sélectionné</p>
                <p className="text-2xl font-black">{planConfirmData.planName}</p>
                <p className="text-sm mt-1">
                  {planConfirmData.pricePerSeat}€ / siège / {planConfirmData.isAnnual ? 'an' : 'mois'}
                </p>
                {planConfirmData.isAnnual && (
                  <p className="text-xs text-green-600 font-semibold mt-1">
                    Au lieu de {planConfirmData.monthlyPrice * 12}€ • Économisez {Math.round(planConfirmData.monthlyPrice * 12 * 0.2)}€/an par siège
                  </p>
                )}
              </div>

              {/* Quantity Selector */}
              <div className="bg-gray-100 rounded-lg p-3 border border-gray-300">
                <p className="text-sm font-semibold mb-2">Nombre de sièges</p>
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={() => {
                      const planInfo = PLANS[planConfirmData.planKey];
                      const newQty = Math.max(planConfirmData.quantity - 1, planInfo.minSellers, sellerCount);
                      setPlanConfirmData({
                        ...planConfirmData,
                        quantity: newQty,
                        monthlyAmount: newQty * planConfirmData.pricePerSeat
                      });
                    }}
                    className="w-10 h-10 bg-white rounded-lg border-2 border-gray-300 hover:border-blue-500 hover:bg-blue-50 transition-all font-bold text-xl"
                  >
                    −
                  </button>
                  <div className="flex-1 text-center">
                    <span className="text-4xl font-black">{planConfirmData.quantity}</span>
                  </div>
                  <button
                    onClick={() => {
                      const planInfo = PLANS[planConfirmData.planKey];
                      const newQty = Math.min(planConfirmData.quantity + 1, planInfo.maxSellers);
                      setPlanConfirmData({
                        ...planConfirmData,
                        quantity: newQty,
                        monthlyAmount: newQty * planConfirmData.pricePerSeat
                      });
                    }}
                    className="w-10 h-10 bg-white rounded-lg border-2 border-gray-300 hover:border-blue-500 hover:bg-blue-50 transition-all font-bold text-xl"
                  >
                    +
                  </button>
                </div>
                <p className="text-xs text-gray-600 text-center mt-2">
                  Min: {PLANS[planConfirmData.planKey].minSellers} • Max: {PLANS[planConfirmData.planKey].maxSellers}
                </p>
              </div>

              {/* Cost Details - Simplified view */}
              {(() => {
                const currentSeats = subscriptionInfo?.subscription?.seats || 0;
                const currentPlan = subscriptionInfo?.plan || 'starter';
                const currentPricePerSeat = PLANS[currentPlan]?.pricePerSeller || 29;
                const currentMonthlyAmount = currentSeats * currentPricePerSeat;
                
                return (
                  <>
                    {/* Current Amount (if exists) */}
                    {currentSeats > 0 && (
                      <div className="bg-gray-50 rounded-lg p-3 border border-gray-300">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-semibold">📊 Abonnement actuel</span>
                          <span className="text-xl font-black text-gray-700">
                            {currentMonthlyAmount}€
                          </span>
                        </div>
                        <p className="text-xs text-gray-600">
                          {currentSeats} siège(s) × {currentPricePerSeat}€ = {currentMonthlyAmount}€/mois
                        </p>
                      </div>
                    )}
                    
                    {/* New Recurring Amount */}
                    <div className="bg-blue-50 rounded-lg p-3 border border-blue-300">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold">📅 Nouveau montant récurrent</span>
                        <span className="text-2xl font-black text-blue-700">
                          {planConfirmData.monthlyAmount}€
                        </span>
                      </div>
                      <p className="text-xs text-gray-600">
                        {planConfirmData.quantity} × {planConfirmData.pricePerSeat}€ = {planConfirmData.monthlyAmount}€/{planConfirmData.isAnnual ? 'an' : 'mois'}
                      </p>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Footer */}
            <div className="bg-gray-50 p-3 border-t flex gap-2">
              <button
                onClick={() => {
                  setShowPlanConfirmModal(false);
                  setPlanConfirmData(null);
                }}
                className="flex-1 py-2 bg-white border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-100 transition-all text-sm"
              >
                Annuler
              </button>
              <button
                onClick={async () => {
                  setShowPlanConfirmModal(false);
                  
                  // Set selected plan and quantity
                  setSelectedPlan(planConfirmData.planKey);
                  setSelectedQuantity(planConfirmData.quantity);
                  
                  // Wait a bit for state to update, then call payment
                  await new Promise(resolve => setTimeout(resolve, 100));
                  
                  // Close main modal and proceed to payment
                  onClose();
                  await new Promise(resolve => setTimeout(resolve, 300));
                  
                  try {
                    const token = localStorage.getItem('token');
                    const originUrl = window.location.origin;
                    
                    const response = await axios.post(
                      `${API}/api/checkout/create-session`,
                      {
                        plan: planConfirmData.planKey,
                        origin_url: originUrl,
                        quantity: planConfirmData.quantity,
                        billing_period: isAnnual ? 'annual' : 'monthly'
                      },
                      {
                        headers: { Authorization: `Bearer ${token}` }
                      }
                    );
                    
                    if (response.data.url) {
                      window.location.replace(response.data.url);
                    } else if (response.data.success) {
                      window.location.reload();
                    }
                  } catch (error) {
                    console.error('❌ Checkout error:', error);
                    toast.error('Erreur lors de la création de la session');
                    setTimeout(() => window.location.reload(), 2000);
                  }
                }}
                className="flex-1 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all shadow-md text-sm"
              >
                Continuer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal - Compact version with pricing details */}
      {showConfirmModal && confirmData && (
        <div 
          onClick={(e) => { 
            if (e.target === e.currentTarget) { 
              setShowConfirmModal(false); 
              setConfirmData(null); 
            } 
          }} 
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] backdrop-blur-sm"
        >
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
            {/* Header - Compact */}
            <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-4 text-white">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <span>📊</span>
                Confirmer la modification
              </h3>
            </div>

            {/* Content - Compact */}
            <div className="p-4 space-y-3">
              {/* Action Type */}
              <div className={`rounded-lg p-3 text-center border-2 ${
                confirmData.isIncrease ? 'bg-green-50 border-green-300' : 'bg-orange-50 border-orange-300'
              }`}>
                <p className="text-xl font-black">
                  {confirmData.action} de {confirmData.diff} siège{confirmData.diff > 1 ? 's' : ''}
                </p>
              </div>

              {/* Comparison - Compact */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-100 rounded-lg p-3 text-center border border-gray-300">
                  <p className="text-xs text-gray-600 font-semibold">Actuellement</p>
                  <p className="text-3xl font-black text-gray-800">{confirmData.currentSeats}</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-3 text-center border border-blue-400">
                  <p className="text-xs text-blue-700 font-semibold">Nouveau</p>
                  <p className="text-3xl font-black text-blue-900">{confirmData.newSeats}</p>
                </div>
              </div>

              {/* Pricing Details */}
              <div className={`rounded-lg p-3 border ${
                confirmData.isIncrease ? 'bg-blue-50 border-blue-200' : 'bg-purple-50 border-purple-200'
              }`}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-semibold">
                    {confirmData.isIncrease ? '💳 Montant facturé' : '💰 Crédit appliqué'}
                  </p>
                  <p className="text-lg font-black">
                    {confirmData.isIncrease ? '+' : '-'}{confirmData.estimatedAmount.toFixed(2)}€
                  </p>
                </div>
                <p className="text-xs text-gray-600">
                  Prorata {confirmData.isIncrease ? 'ajouté à' : 'déduit de'} votre prochaine facture
                </p>
              </div>

              {/* Warning - Compact */}
              <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-2">
                <p className="text-xs text-yellow-800 flex items-center gap-1">
                  <span>⚠️</span>
                  La page se rechargera après validation
                </p>
              </div>
            </div>

            {/* Footer - Compact */}
            <div className="bg-gray-50 p-3 border-t flex gap-2">
              <button
                onClick={() => {
                  setShowConfirmModal(false);
                  setConfirmData(null);
                }}
                className="flex-1 py-2 bg-white border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-100 transition-all text-sm"
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  setShowConfirmModal(false);
                  handleChangeSeats(confirmData.newSeats);
                }}
                className="flex-1 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all shadow-md text-sm"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}

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
    </>
  );
}
