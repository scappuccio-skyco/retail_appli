import React, { useState, useEffect } from 'react';
import { AlertCircle, Crown, Clock } from 'lucide-react';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

export default function SubscriptionBanner({ onUpgradeClick }) {
  const [subscriptionInfo, setSubscriptionInfo] = useState(null);
  const [loading, setLoading] = useState(true);

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

  if (loading || !subscriptionInfo) return null;

  // Trial active
  if (subscriptionInfo.status === 'trialing' && subscriptionInfo.has_access) {
    return (
      <div className="bg-gradient-to-r from-blue-50 to-blue-100 border-l-4 border-blue-500 p-4 mb-6 rounded-lg shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Clock className="w-6 h-6 text-blue-600" />
            <div>
              <p className="font-semibold text-gray-800">
                Essai gratuit - {subscriptionInfo.days_left} jour{subscriptionInfo.days_left > 1 ? 's' : ''} restant{subscriptionInfo.days_left > 1 ? 's' : ''}
              </p>
              <p className="text-sm text-gray-600">
                Profitez de toutes les fonctionnalités jusqu'au {new Date(subscriptionInfo.trial_end).toLocaleDateString('fr-FR')}
              </p>
            </div>
          </div>
          <button
            onClick={onUpgradeClick}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold flex items-center gap-2"
          >
            <Crown className="w-4 h-4" />
            S'abonner maintenant
          </button>
        </div>
      </div>
    );
  }

  // Trial expired
  if (subscriptionInfo.status === 'trial_expired' && !subscriptionInfo.has_access) {
    return (
      <div className="bg-gradient-to-r from-orange-50 to-orange-100 border-l-4 border-orange-500 p-4 mb-6 rounded-lg shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-orange-600" />
            <div>
              <p className="font-semibold text-gray-800">
                Votre essai gratuit est terminé
              </p>
              <p className="text-sm text-gray-600">
                Abonnez-vous pour continuer à ajouter des KPI et profiter de toutes les fonctionnalités
              </p>
            </div>
          </div>
          <button
            onClick={onUpgradeClick}
            className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-semibold flex items-center gap-2"
          >
            <Crown className="w-4 h-4" />
            Choisir mon plan
          </button>
        </div>
      </div>
    );
  }

  // Active subscription
  if (subscriptionInfo.status === 'active' && subscriptionInfo.has_access) {
    const planName = subscriptionInfo.plan === 'starter' ? 'Small Team' : subscriptionInfo.plan === 'professional' ? 'Medium Team' : 'Large Team';
    return (
      <div className="bg-gradient-to-r from-green-50 to-green-100 border-l-4 border-green-500 p-4 mb-6 rounded-lg shadow-sm">
        <div className="flex items-center gap-3">
          <Crown className="w-6 h-6 text-green-600" />
          <div>
            <p className="font-semibold text-gray-800">
              Abonnement {planName} actif
            </p>
            <p className="text-sm text-gray-600">
              Renouvellement le {new Date(subscriptionInfo.period_end).toLocaleDateString('fr-FR')}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
