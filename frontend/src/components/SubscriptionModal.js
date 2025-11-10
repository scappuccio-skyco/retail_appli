import React, { useState, useEffect } from 'react';
import { X, Crown, Check, Loader } from 'lucide-react';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

const PLANS = {
  starter: {
    name: 'Starter',
    price: 29,
    maxSellers: 5,
    features: [
      'Accès Manager + Vendeurs',
      'Dashboard complet',
      'Diagnostic DISC',
      'Suivi KPI en temps réel',
      'Jusqu\'à 5 vendeurs',
      'Support par email'
    ]
  },
  professional: {
    name: 'Professional',
    price: 249,
    maxSellers: 15,
    features: [
      'Toutes les fonctionnalités Starter',
      'Dashboard complet',
      'Diagnostic DISC',
      'Suivi KPI en temps réel',
      'Jusqu\'à 15 vendeurs',
      'Support prioritaire',
      'Analyses IA avancées',
      'Rapports personnalisés'
    ]
  }
};

export default function SubscriptionModal({ onClose }) {
  const [subscriptionInfo, setSubscriptionInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processingPlan, setProcessingPlan] = useState(null);

  useEffect(() => {
    fetchSubscriptionStatus();
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

  const handleSubscribe = async (plan) => {
    setProcessingPlan(plan);
    
    try {
      const token = localStorage.getItem('token');
      const originUrl = window.location.origin;
      
      const response = await axios.post(
        `${API}/api/checkout/create-session`,
        {
          plan: plan,
          origin_url: originUrl
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      // Redirect to Stripe Checkout
      if (response.data.url) {
        window.location.href = response.data.url;
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
      alert('Erreur lors de la création de la session de paiement');
      setProcessingPlan(null);
    }
  };

  const currentPlan = subscriptionInfo?.plan || 'starter';
  const isActive = subscriptionInfo?.status === 'active';

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#1E40AF] to-[#1E3A8A] p-6 rounded-t-2xl relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white hover:text-gray-200 transition-colors"
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
                            {plan.price}€
                          </span>
                          <span className="text-gray-600">/mois</span>
                        </div>
                      </div>

                      <ul className="space-y-3 mb-6">
                        {plan.features.map((feature, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                            <span className="text-gray-700">{feature}</span>
                          </li>
                        ))}
                      </ul>

                      {isCurrentPlan ? (
                        <button
                          disabled
                          className="w-full py-3 bg-green-600 text-white rounded-lg font-semibold"
                        >
                          Plan actuel
                        </button>
                      ) : (
                        <button
                          onClick={() => handleSubscribe(planKey)}
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
                              {isActive ? 'Changer de plan' : 'S\'abonner'}
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
