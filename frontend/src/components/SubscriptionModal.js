import React, { useState, useEffect } from 'react';
import { X, Crown, Check, Loader } from 'lucide-react';
import axios from 'axios';
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

export default function SubscriptionModal({ onClose }) {
  const [subscriptionInfo, setSubscriptionInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processingPlan, setProcessingPlan] = useState(null);
  const [sellerCount, setSellerCount] = useState(0);
  const [isMounted, setIsMounted] = useState(true);
  
  // Quantity modal states
  const [showQuantityModal, setShowQuantityModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [selectedQuantity, setSelectedQuantity] = useState(1);

  useEffect(() => {
    fetchSubscriptionStatus();
    fetchSellerCount();
    
    // Cleanup function to prevent setState on unmounted component
    return () => {
      setIsMounted(false);
    };
  }, []);

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
        // DON'T modify React state before redirect - causes setState on unmounted component
        // Just redirect immediately - the page will be replaced anyway
        window.location.replace(response.data.url);
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
      // Only reset state on error, not on successful redirect
      setProcessingPlan(null);
      
      setTimeout(() => {
        const errorMessage = error.response?.data?.detail || 'Erreur lors de la création de la session de paiement';
        alert(errorMessage);
      }, 100);
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

  // Simple architecture: if quantity modal is open, don't render subscription modal
  if (showQuantityModal) {
    return (
      <QuantityModal
        selectedPlan={selectedPlan}
        selectedQuantity={selectedQuantity}
        sellerCount={sellerCount}
        processingPlan={processingPlan}
        onQuantityChange={handleQuantityChange}
        onBack={() => setShowQuantityModal(false)}
        onProceedToPayment={handleProceedToPayment}
      />
    );
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
}
