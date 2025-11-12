import React, { useState, useEffect } from 'react';
import { unstable_batchedUpdates } from 'react-dom';
import { X, Crown, Check, Loader, Users } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import QuantityModal from './QuantityModal';

const API = process.env.REACT_APP_BACKEND_URL;

const PLANS = {
  starter: {
    name: 'Starter',
    pricePerSeller: 29,
    minSellers: 1,
    maxSellers: 5,
    aiCredits: 500,
    features: [
      'Manager gratuit',
      '29€ par vendeur/mois',
      'Dashboard complet',
      'Diagnostic DISC',
      'Suivi KPI en temps réel',
      '1 à 5 vendeurs max',
      '500 crédits IA/mois inclus',
      'Support email sous 48h'
    ]
  },
  professional: {
    name: 'Professional',
    pricePerSeller: 25,
    minSellers: 6,
    maxSellers: 15,
    aiCredits: 1500,
    features: [
      'Manager gratuit',
      '25€ par vendeur/mois (tarif dégressif)',
      'Dashboard complet',
      'Diagnostic DISC',
      'Suivi KPI en temps réel',
      '6 à 15 vendeurs max',
      '1500 crédits IA/mois inclus',
      'Support prioritaire',
      'Onboarding personnalisé'
    ]
  }
};

export default function SubscriptionModal({ isOpen, onClose }) {
  const [subscriptionInfo, setSubscriptionInfo] = useState(null);
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
  
  // Confirmation modal state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmData, setConfirmData] = useState(null);

  useEffect(() => {
    // Cleanup function to prevent setState on unmounted component
    return () => {
      setIsMounted(false);
    };
  }, []);

  // Fetch data whenever modal opens
  useEffect(() => {
    if (isOpen) {
      fetchSubscriptionStatus();
      fetchSellerCount();
      fetchSubscriptionHistory();
    }
  }, [isOpen]);

  // Initialize newSeatsCount when subscription info is loaded
  useEffect(() => {
    if (subscriptionInfo && subscriptionInfo.subscription) {
      setNewSeatsCount(subscriptionInfo.subscription.seats || 1);
    }
  }, [subscriptionInfo]);

  const fetchSubscriptionStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/api/subscription/status`, {
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
      const response = await axios.get(`${API}/api/manager/sellers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (isMounted) {
        setSellerCount(response.data.length);
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
    if (!subscriptionInfo || !isMounted) return;
    
    // Batch initial state update
    unstable_batchedUpdates(() => {
      setAdjustingSeats(true);
    });
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/api/subscription/change-seats?new_seats=${newSeats}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.success && isMounted) {
        console.log('✅ Sièges modifiés:', response.data.message);
        
        // ULTIMATE FIX: Reload entire page to avoid ALL React DOM conflicts
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      }
    } catch (error) {
      if (isMounted) {
        const errorMsg = error.response?.data?.detail || 'Erreur lors du changement de sièges';
        console.error('❌ Erreur:', errorMsg);
      }
    } finally {
      if (isMounted) {
        // Batch final state update
        unstable_batchedUpdates(() => {
          setAdjustingSeats(false);
        });
      }
    }
  };

  const handleSelectPlan = (plan) => {
    // Check if user has too many sellers for Starter plan
    const planInfo = PLANS[plan];
    if (sellerCount > planInfo.maxSellers) {
      const sellersToRemove = sellerCount - planInfo.maxSellers;
      
      setTimeout(() => {
        const confirmed = window.confirm(
          `⚠️ ATTENTION\n\n` +
          `Vous avez actuellement ${sellerCount} vendeur(s).\n` +
          `Le plan ${planInfo.name} est limité à ${planInfo.maxSellers} vendeur(s).\n\n` +
          `Vous devez supprimer ${sellersToRemove} vendeur(s) avant de souscrire à ce plan.\n\n` +
          `Souhaitez-vous plutôt choisir le plan Professional (15 vendeurs) ?`
        );
        
        if (confirmed) {
          handleSelectPlan('professional');
        }
      }, 100);
      
      return;
    }
    
    // Set up quantity modal
    setSelectedPlan(plan);
    const minQuantity = Math.max(sellerCount, planInfo.minSellers);
    setSelectedQuantity(minQuantity);
    setShowQuantityModal(true);
  };

  const handleProceedToPayment = async () => {
    if (!selectedPlan || !isMounted) return;
    
    // Batch initial state update to prevent React reconciliation conflicts
    unstable_batchedUpdates(() => {
      setProcessingPlan(selectedPlan);
    });
    
    try {
      const token = localStorage.getItem('token');
      const originUrl = window.location.origin;
      
      const response = await axios.post(
        `${API}/api/checkout/create-session`,
        {
          plan: selectedPlan,
          origin_url: originUrl,
          quantity: selectedQuantity
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      // Redirect to Stripe - wrap in batchedUpdates to complete any pending updates
      if (response.data.url) {
        unstable_batchedUpdates(() => {
          // Mark component as unmounting to prevent further state updates
          setIsMounted(false);
          
          // Small delay to let React finish reconciliation
          setTimeout(() => {
            window.location.replace(response.data.url);
          }, 50);
        });
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
      
      // Only update state if component is still mounted
      if (isMounted) {
        unstable_batchedUpdates(() => {
          setProcessingPlan(null);
        });
        
        setTimeout(() => {
          const errorMessage = error.response?.data?.detail || 'Erreur lors de la création de la session de paiement';
          alert(errorMessage);
        }, 100);
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

  const handleCancelSubscription = async () => {
    const confirmed = window.confirm(
      '⚠️ Confirmer l\'annulation\n\n' +
      'Votre abonnement restera actif jusqu\'à la fin de la période payée.\n' +
      'Après cette date, vous n\'aurez plus accès aux fonctionnalités premium.\n\n' +
      'Voulez-vous vraiment annuler votre abonnement ?'
    );

    if (!confirmed) return;

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/api/subscription/cancel`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      alert('✅ ' + response.data.message);
      
      // Refresh subscription status
      fetchSubscriptionStatus();
    } catch (error) {
      console.error('Error canceling subscription:', error);
      const errorMessage = error.response?.data?.detail || 'Erreur lors de l\'annulation de l\'abonnement';
      alert('❌ ' + errorMessage);
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
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
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
                    <span className="font-semibold">Plan {PLANS[currentPlan].name}</span> - Actif
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    {subscriptionInfo.subscription?.cancel_at_period_end ? (
                      <>
                        ⚠️ Annulation programmée - Accès jusqu'au {new Date(subscriptionInfo.period_end).toLocaleDateString('fr-FR')}
                      </>
                    ) : (
                      <>
                        Renouvellement le {new Date(subscriptionInfo.period_end).toLocaleDateString('fr-FR')}
                      </>
                    )}
                  </p>
                  {!subscriptionInfo.subscription?.cancel_at_period_end && (
                    <button
                      onClick={handleCancelSubscription}
                      className="mt-3 text-sm text-red-600 hover:text-red-700 underline"
                    >
                      Annuler l'abonnement
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
              <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-t-xl p-6 text-white">
                <h3 className="text-2xl font-bold flex items-center gap-3">
                  <Users className="w-7 h-7" />
                  Gérer mes sièges vendeurs
                </h3>
                <p className="text-green-50 text-sm mt-1">Ajustez votre capacité en temps réel avec facturation proratée</p>
              </div>
              
              <div className="bg-white rounded-b-xl border-2 border-green-200 p-6">
                {/* Stats Cards */}
                <div className="grid md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-5 rounded-xl border-2 border-blue-200 relative overflow-hidden">
                    <div className="absolute top-0 right-0 opacity-10">
                      <Crown className="w-20 h-20 text-blue-600" />
                    </div>
                    <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1">Sièges achetés</p>
                    <p className="text-4xl font-black text-blue-900">{subscriptionInfo.subscription.seats || 1}</p>
                  </div>
                  
                  <div className="bg-gradient-to-br from-green-50 to-green-100 p-5 rounded-xl border-2 border-green-200 relative overflow-hidden">
                    <div className="absolute top-0 right-0 opacity-10">
                      <Users className="w-20 h-20 text-green-600" />
                    </div>
                    <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-1">Vendeurs actifs</p>
                    <p className="text-4xl font-black text-green-900">{sellerCount}</p>
                  </div>
                  
                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-5 rounded-xl border-2 border-purple-200 relative overflow-hidden">
                    <div className="absolute top-0 right-0 opacity-10">
                      <Check className="w-20 h-20 text-purple-600" />
                    </div>
                    <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide mb-1">Sièges libres</p>
                    <p className="text-4xl font-black text-purple-900">
                      {(subscriptionInfo.subscription.seats || 1) - sellerCount}
                    </p>
                  </div>
                </div>

              {/* Adjustment Section */}
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-6 rounded-xl border-2 border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-lg font-bold text-gray-800">Ajuster mes sièges</p>
                    <p className="text-xs text-gray-600">Utilisez le slider ou saisissez directement</p>
                  </div>
                  <div className="bg-white px-4 py-2 rounded-lg border-2 border-green-500">
                    <p className="text-xs text-gray-600">Nouveau total</p>
                    <p className="text-3xl font-black text-green-600">{newSeatsCount}</p>
                  </div>
                </div>
                
                {/* Slider */}
                <div className="mb-4">
                  <input
                    type="range"
                    min={sellerCount}
                    max={15}
                    value={newSeatsCount}
                    onChange={(e) => setNewSeatsCount(parseInt(e.target.value))}
                    disabled={adjustingSeats}
                    className="w-full h-3 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-green-500"
                    style={{
                      background: `linear-gradient(to right, #10b981 0%, #10b981 ${((newSeatsCount - sellerCount) / (15 - sellerCount)) * 100}%, #d1d5db ${((newSeatsCount - sellerCount) / (15 - sellerCount)) * 100}%, #d1d5db 100%)`
                    }}
                  />
                  <div className="flex justify-between text-xs text-gray-600 mt-1">
                    <span>Min: {sellerCount}</span>
                    <span>Max: 15</span>
                  </div>
                </div>
                
                {/* Fine tune buttons */}
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

                {/* Preview of change */}
                {newSeatsCount !== (subscriptionInfo.subscription.seats || 1) && (
                  <div className="mb-4 p-5 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl text-white shadow-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-sm opacity-90">Changement prévu</p>
                        <p className="text-2xl font-black">
                          {(subscriptionInfo.subscription.seats || 1)} → {newSeatsCount} sièges
                        </p>
                      </div>
                      <div className={`px-4 py-2 rounded-lg font-black text-2xl ${newSeatsCount > (subscriptionInfo.subscription.seats || 1) ? 'bg-green-400 text-green-900' : 'bg-orange-400 text-orange-900'}`}>
                        {newSeatsCount > (subscriptionInfo.subscription.seats || 1) ? '+' : ''}
                        {newSeatsCount - (subscriptionInfo.subscription.seats || 1)}
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-start gap-2 bg-white bg-opacity-20 rounded-lg p-3">
                        <span className="text-xl">
                          {newSeatsCount > (subscriptionInfo.subscription.seats || 1) ? '💳' : '💰'}
                        </span>
                        <div className="flex-1">
                          <p className="font-bold text-sm">
                            {newSeatsCount > (subscriptionInfo.subscription.seats || 1) 
                              ? 'Facturation immédiate' 
                              : 'Crédit appliqué'}
                          </p>
                          <p className="text-xs opacity-90">
                            {newSeatsCount > (subscriptionInfo.subscription.seats || 1)
                              ? 'Montant au prorata du temps restant sur votre période'
                              : 'Le crédit sera déduit de votre prochaine facture'}
                          </p>
                        </div>
                      </div>
                      
                      {/* Determine new plan */}
                      {(() => {
                        const currentSeats = subscriptionInfo.subscription.seats || 1;
                        const currentPlanType = currentSeats <= 5 ? 'starter' : 'professional';
                        const newPlanType = newSeatsCount <= 5 ? 'starter' : 'professional';
                        
                        if (currentPlanType !== newPlanType) {
                          return (
                            <div className="flex items-start gap-2 bg-yellow-400 bg-opacity-30 rounded-lg p-3">
                              <span className="text-xl">⚡</span>
                              <div className="flex-1">
                                <p className="font-bold text-sm">Changement de plan</p>
                                <p className="text-xs opacity-90">
                                  {newPlanType === 'starter' ? 'Starter (29€/vendeur/mois)' : 'Professional (25€/vendeur/mois)'}
                                </p>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => {
                    const currentSeats = subscriptionInfo.subscription.seats || 1;
                    if (newSeatsCount === currentSeats) {
                      alert('Le nombre de sièges est déjà à cette valeur.');
                      return;
                    }
                    
                    const diff = newSeatsCount - currentSeats;
                    const currentPlan = currentSeats <= 5 ? 'starter' : 'professional';
                    const newPlan = newSeatsCount <= 5 ? 'starter' : 'professional';
                    
                    // Prepare data for custom confirmation modal
                    setConfirmData({
                      currentSeats,
                      newSeats: newSeatsCount,
                      diff,
                      currentPlan,
                      newPlan,
                      isIncrease: diff > 0
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

              {/* Info section */}
              <div className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-200">
                <p className="font-bold text-blue-900 mb-2 flex items-center gap-2">
                  <span className="text-xl">💡</span>
                  Comment ça marche ?
                </p>
                <ul className="space-y-2 text-sm text-blue-800">
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <span>Utilisez le slider, +/- ou saisissez directement le nombre</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <span>Une seule confirmation pour valider votre choix</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <span>Stripe calcule automatiquement le prorata (facturation ou crédit)</span>
                  </li>
                </ul>
              </div>
            </div>

              {/* History */}
              {subscriptionHistory.length > 0 && (
                <div className="mt-4">
                  <details className="bg-white p-4 rounded-lg border border-green-200">
                    <summary className="cursor-pointer font-semibold text-gray-700 hover:text-gray-900">
                      📊 Historique des modifications ({subscriptionHistory.length})
                    </summary>
                    <div className="mt-3 space-y-2 max-h-60 overflow-y-auto">
                      {subscriptionHistory.map((entry, idx) => (
                        <div key={entry.id || idx} className="text-sm p-2 bg-gray-50 rounded border-l-4 border-blue-400">
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
                  </details>
                </div>
              )}
            </div>
          )}

          {/* Plans */}
          <h3 className="text-2xl font-bold text-gray-800 mb-6 text-center">
            Choisissez votre plan
          </h3>
          
          <div className="grid md:grid-cols-2 gap-6">
            {Object.entries(PLANS).map(([planKey, plan]) => {
              const isCurrentPlan = isActive && currentPlan === planKey;
              const isProcessing = processingPlan === planKey;
              
              return (
                <div
                  key={planKey}
                  className={`border-2 rounded-xl p-6 transition-all ${
                    isCurrentPlan
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-blue-400 hover:shadow-lg'
                  }`}
                >
                  <div className="text-center mb-6">
                    <h4 className="text-2xl font-bold text-gray-800 mb-2">
                      {plan.name}
                    </h4>
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-4xl font-bold text-[#1E40AF]">
                        {plan.pricePerSeller}€
                      </span>
                      <span className="text-gray-600">/vendeur/mois</span>
                    </div>
                    <p className="text-sm text-green-600 font-semibold mt-2">
                      Manager gratuit
                    </p>
                  </div>

                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature, idx) => (
                      <li key={`plan-${planKey}-feature-${idx}-${feature.substring(0, 15)}`} className="flex items-start gap-2">
                        <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-700">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {/* Warning if too many sellers */}
                  {sellerCount > plan.maxSellers && !isCurrentPlan && (
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
                      Plan actuel
                    </button>
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
                          {isActive ? 'Changer de plan' : 'Choisir ce plan'}
                        </>
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Info */}
          <div className="mt-8 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-sm text-gray-600 text-center">
              💳 Paiement sécurisé par Stripe • ✅ Annulation à tout moment • 📧 Support inclus
            </p>
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
      
      {/* Custom Confirmation Modal */}
      {showConfirmModal && confirmData && (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-[60] flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full transform animate-scaleIn">
            {/* Header */}
            <div className={`p-6 rounded-t-2xl ${confirmData.isIncrease ? 'bg-gradient-to-r from-green-500 to-emerald-600' : 'bg-gradient-to-r from-orange-500 to-red-500'} text-white`}>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                  <span className="text-3xl">{confirmData.isIncrease ? '➕' : '➖'}</span>
                </div>
                <div>
                  <h3 className="text-xl font-bold">
                    {confirmData.isIncrease ? 'Ajouter' : 'Retirer'} des sièges
                  </h3>
                  <p className="text-sm opacity-90">
                    {Math.abs(confirmData.diff)} siège(s)
                  </p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              {/* Change summary */}
              <div className="bg-gray-50 rounded-xl p-4 border-2 border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-gray-600 font-semibold">Changement</span>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-black text-gray-700">{confirmData.currentSeats}</span>
                    <span className="text-gray-400">→</span>
                    <span className="text-2xl font-black text-green-600">{confirmData.newSeats}</span>
                  </div>
                </div>
                
                {/* Plan change notification */}
                {confirmData.currentPlan !== confirmData.newPlan && (
                  <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-3 flex items-start gap-2">
                    <span className="text-xl">⚡</span>
                    <div className="flex-1">
                      <p className="font-bold text-yellow-900 text-sm">Changement de plan automatique</p>
                      <p className="text-xs text-yellow-800">
                        {confirmData.newPlan === 'starter' ? 'Plan Starter (29€/vendeur/mois)' : 'Plan Professional (25€/vendeur/mois)'}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Billing info */}
              <div className={`rounded-xl p-4 border-2 ${confirmData.isIncrease ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'}`}>
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{confirmData.isIncrease ? '💳' : '💰'}</span>
                  <div className="flex-1">
                    <p className={`font-bold text-sm mb-1 ${confirmData.isIncrease ? 'text-blue-900' : 'text-orange-900'}`}>
                      {confirmData.isIncrease ? 'Facturation immédiate' : 'Crédit appliqué'}
                    </p>
                    <p className={`text-xs ${confirmData.isIncrease ? 'text-blue-700' : 'text-orange-700'}`}>
                      {confirmData.isIncrease 
                        ? 'Le montant sera calculé au prorata du temps restant dans votre période de facturation actuelle.'
                        : 'Un crédit sera automatiquement appliqué sur votre prochaine facture.'
                      }
                    </p>
                  </div>
                </div>
              </div>

              {/* Info */}
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <p className="text-xs text-gray-600 flex items-start gap-2">
                  <span className="text-sm">ℹ️</span>
                  <span>Stripe traitera automatiquement cette modification. Vous recevrez un email de confirmation.</span>
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="p-6 bg-gray-50 rounded-b-2xl flex gap-3">
              <button
                onClick={() => {
                  setShowConfirmModal(false);
                  setConfirmData(null);
                }}
                className="flex-1 px-6 py-3 bg-white border-2 border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-100 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  const seatsToChange = confirmData.newSeats;
                  
                  // Close modal first
                  setShowConfirmModal(false);
                  setConfirmData(null);
                  
                  // Increased delay to ensure modal DOM cleanup completes
                  setTimeout(() => {
                    handleChangeSeats(seatsToChange);
                  }, 300);
                }}
                className={`flex-1 px-6 py-3 text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-xl ${
                  confirmData.isIncrease 
                    ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700' 
                    : 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600'
                }`}
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
