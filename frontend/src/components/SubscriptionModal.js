import React, { useState, useEffect } from 'react';
import { X, Crown, Check, Loader } from 'lucide-react';
import axios from 'axios';

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

export default function SubscriptionModal({ onClose }) {
  const [subscriptionInfo, setSubscriptionInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processingPlan, setProcessingPlan] = useState(null);
  const [sellerCount, setSellerCount] = useState(0);
  const [selectedPlan, setSelectedPlan] = useState(null); // Plan selected for quantity adjustment
  const [selectedQuantity, setSelectedQuantity] = useState(1); // Quantity to purchase

  useEffect(() => {
    fetchSubscriptionStatus();
    fetchSellerCount();
  }, []);

  const fetchSubscriptionStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/api/subscription/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSubscriptionInfo(response.data);
    } catch (error) {
      console.error('Error fetching subscription:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSellerCount = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/api/manager/sellers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSellerCount(response.data.length);
    } catch (error) {
      console.error('Error fetching sellers:', error);
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
    
    // Open quantity selector
    setSelectedPlan(plan);
    const minQuantity = Math.max(sellerCount, 1);
    setSelectedQuantity(minQuantity);
  };

  const handleProceedToPayment = async () => {
    if (!selectedPlan) return;
    
    setProcessingPlan(selectedPlan);
    
    try {
      const token = localStorage.getItem('token');
      const originUrl = window.location.origin;
      
      const response = await axios.post(
        `${API}/api/checkout/create-session`,
        {
          plan: selectedPlan,
          origin_url: originUrl,
          quantity: selectedQuantity  // Send selected quantity
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      // Redirect to Stripe Checkout
      if (response.data.url) {
        // Close modal immediately before redirect to prevent black screen
        setSelectedPlan(null);
        setProcessingPlan(null);
        
        // Use location.replace instead of href for cleaner redirect
        window.location.replace(response.data.url);
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
      setProcessingPlan(null);
      
      setTimeout(() => {
        const errorMessage = error.response?.data?.detail || 'Erreur lors de la création de la session de paiement';
        alert(errorMessage);
      }, 100);
    }
  };

  const handleQuantityChange = (delta) => {
    const planInfo = PLANS[selectedPlan];
    const minQuantity = Math.max(sellerCount, 1);
    const newQuantity = selectedQuantity + delta;
    
    if (newQuantity >= minQuantity && newQuantity <= planInfo.maxSellers) {
      setSelectedQuantity(newQuantity);
    }
  };

  const currentPlan = subscriptionInfo?.plan || 'starter';
  const isActive = subscriptionInfo?.status === 'active';

  const handleClose = () => {
    // Prevent closing while processing
    if (processingPlan) return;
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !processingPlan) {
          handleClose();
        }
      }}
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
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <Loader className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : (
            <>
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
                        Renouvellement le {new Date(subscriptionInfo.period_end).toLocaleDateString('fr-FR')}
                      </p>
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
                          <li key={idx} className="flex items-start gap-2">
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

              {/* Quantity Selector Modal */}
              {selectedPlan && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
                  <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-8">
                    <h3 className="text-2xl font-bold text-gray-800 mb-2 text-center">
                      Nombre de vendeurs
                    </h3>
                    <p className="text-gray-600 mb-6 text-center">
                      Plan {PLANS[selectedPlan].name} - {PLANS[selectedPlan].pricePerSeller}€ par vendeur/mois
                    </p>

                    {/* Quantity Selector */}
                    <div className="mb-8">
                      <div className="flex items-center justify-center gap-4 mb-4">
                        <button
                          onClick={() => handleQuantityChange(-1)}
                          disabled={selectedQuantity <= Math.max(sellerCount, 1)}
                          className="w-12 h-12 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 disabled:text-gray-400 rounded-full text-2xl font-bold transition-colors flex items-center justify-center"
                        >
                          −
                        </button>
                        
                        <div className="text-center">
                          <div className="text-6xl font-bold text-[#1E40AF] mb-1">
                            {selectedQuantity}
                          </div>
                          <div className="text-sm text-gray-600">
                            vendeur{selectedQuantity > 1 ? 's' : ''}
                          </div>
                        </div>
                        
                        <button
                          onClick={() => handleQuantityChange(1)}
                          disabled={selectedQuantity >= PLANS[selectedPlan].maxSellers}
                          className="w-12 h-12 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 disabled:text-gray-400 rounded-full text-2xl font-bold transition-colors flex items-center justify-center"
                        >
                          +
                        </button>
                      </div>

                      <div className="text-center text-sm text-gray-500">
                        Min: {Math.max(sellerCount, 1)} • Max: {PLANS[selectedPlan].maxSellers}
                      </div>
                    </div>

                    {/* Price Calculation */}
                    <div className="bg-blue-50 rounded-xl p-6 mb-6 border-2 border-blue-200">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-gray-700">Prix par vendeur</span>
                        <span className="font-semibold text-gray-800">
                          {PLANS[selectedPlan].pricePerSeller}€
                        </span>
                      </div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-gray-700">Quantité</span>
                        <span className="font-semibold text-gray-800">
                          × {selectedQuantity}
                        </span>
                      </div>
                      <div className="border-t-2 border-blue-300 pt-2 mt-2">
                        <div className="flex justify-between items-center">
                          <span className="text-lg font-bold text-gray-800">Total</span>
                          <span className="text-3xl font-bold text-[#1E40AF]">
                            {PLANS[selectedPlan].pricePerSeller * selectedQuantity}€
                          </span>
                        </div>
                        <div className="text-right text-sm text-gray-600 mt-1">
                          par mois
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3">
                      <button
                        onClick={() => setSelectedPlan(null)}
                        disabled={processingPlan}
                        className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-semibold"
                      >
                        Retour
                      </button>
                      <button
                        onClick={handleProceedToPayment}
                        disabled={processingPlan}
                        className="flex-1 py-3 bg-[#1E40AF] text-white rounded-lg hover:bg-[#1E3A8A] transition-colors font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {processingPlan ? (
                          <>
                            <Loader className="w-5 h-5 animate-spin" />
                            Chargement...
                          </>
                        ) : (
                          <>
                            <Crown className="w-5 h-5" />
                            Procéder au paiement
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Info */}
              <div className="mt-8 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-sm text-gray-600 text-center">
                  💳 Paiement sécurisé par Stripe • ✅ Annulation à tout moment • 📧 Support inclus
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
