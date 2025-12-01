import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  TrendingUp, CreditCard, Users, DollarSign, CheckCircle, 
  XCircle, Clock, AlertTriangle, ChevronDown, ChevronUp,
  Calendar, Activity
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function StripeSubscriptionsView() {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedGerant, setExpandedGerant] = useState(null);
  const [gerantDetails, setGerantDetails] = useState({});

  useEffect(() => {
    fetchOverview();
  }, []);

  const fetchOverview = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/superadmin/subscriptions/overview`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setOverview(response.data);
    } catch (error) {
      toast.error('Erreur lors du chargement des abonnements');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchGerantDetails = async (gerantId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/superadmin/subscriptions/${gerantId}/details`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setGerantDetails(prev => ({ ...prev, [gerantId]: response.data }));
    } catch (error) {
      toast.error('Erreur lors du chargement des détails');
      console.error(error);
    }
  };

  const toggleGerantDetails = (gerantId) => {
    if (expandedGerant === gerantId) {
      setExpandedGerant(null);
    } else {
      setExpandedGerant(gerantId);
      if (!gerantDetails[gerantId]) {
        fetchGerantDetails(gerantId);
      }
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      active: { color: 'bg-green-100 text-green-700', icon: CheckCircle, label: 'Actif' },
      trialing: { color: 'bg-blue-100 text-blue-700', icon: Clock, label: 'Essai' },
      canceled: { color: 'bg-red-100 text-red-700', icon: XCircle, label: 'Annulé' },
      past_due: { color: 'bg-orange-100 text-orange-700', icon: AlertTriangle, label: 'En retard' }
    };
    
    const badge = badges[status] || badges.canceled;
    const Icon = badge.icon;
    
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${badge.color}`}>
        <Icon className="w-3 h-3" />
        {badge.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <Users className="w-8 h-8 opacity-80" />
          </div>
          <p className="text-sm opacity-90">Total Gérants</p>
          <p className="text-3xl font-bold">{overview?.summary?.total_gerants || 0}</p>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <CheckCircle className="w-8 h-8 opacity-80" />
          </div>
          <p className="text-sm opacity-90">Abonnements Actifs</p>
          <p className="text-3xl font-bold">{overview?.summary?.active_subscriptions || 0}</p>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <Clock className="w-8 h-8 opacity-80" />
          </div>
          <p className="text-sm opacity-90">En Essai</p>
          <p className="text-3xl font-bold">{overview?.summary?.trialing_subscriptions || 0}</p>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="w-8 h-8 opacity-80" />
          </div>
          <p className="text-sm opacity-90">MRR Total</p>
          <p className="text-3xl font-bold">{overview?.summary?.total_mrr?.toFixed(0) || 0}€</p>
          <p className="text-xs opacity-75 mt-1">Revenu Mensuel Récurrent</p>
        </div>
      </div>

      {/* Subscriptions List */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 px-6 py-4">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-6 h-6" />
            Tous les Abonnements
          </h3>
        </div>

        <div className="divide-y divide-gray-200">
          {overview?.subscriptions?.map((item) => {
            const sub = item.subscription;
            const isExpanded = expandedGerant === item.gerant.id;
            const details = gerantDetails[item.gerant.id];

            return (
              <div key={item.gerant.id} className="hover:bg-gray-50 transition-colors">
                {/* Main Row */}
                <div 
                  className="px-4 sm:px-6 py-4 cursor-pointer"
                  onClick={() => toggleGerantDetails(item.gerant.id)}
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3 sm:gap-4 flex-1">
                      <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                        {item.gerant.name?.charAt(0) || 'G'}
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h4 className="font-semibold text-gray-900">{item.gerant.name}</h4>
                          {sub && getStatusBadge(sub.status)}
                        </div>
                        <p className="text-sm text-gray-600">{item.gerant.email}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-sm w-full sm:w-auto">
                      {sub ? (
                        <>
                          <div className="text-center">
                            <p className="text-gray-500 text-xs">Sièges</p>
                            <p className="font-bold text-gray-900">{sub.seats || 0}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-gray-500 text-xs">Prix/siège</p>
                            <p className="font-bold text-gray-900">{sub.price_per_seat}€</p>
                          </div>
                          <div className="text-center">
                            <p className="text-gray-500 text-xs">Total/mois</p>
                            <p className="font-bold text-green-600">{((sub.seats || 0) * (sub.price_per_seat || 0)).toFixed(0)}€</p>
                          </div>
                          <div className="text-center">
                            <p className="text-gray-500 text-xs">Vendeurs actifs</p>
                            <p className="font-bold text-blue-600">{item.active_sellers_count}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-gray-500 text-xs">Crédits IA</p>
                            <p className="font-bold text-purple-600">{item.ai_credits_used || 0}</p>
                          </div>
                        </>
                      ) : (
                        <p className="text-gray-400 italic">Pas d'abonnement</p>
                      )}
                      
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && details && (
                  <div className="px-4 sm:px-6 py-4 bg-gray-50 border-t border-gray-200">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Left Column - Subscription Details */}
                      <div className="space-y-4">
                        <h5 className="font-semibold text-gray-900 flex items-center gap-2">
                          <CreditCard className="w-4 h-4" />
                          Détails Abonnement
                        </h5>
                        
                        {details.subscription ? (
                          <div className="bg-white rounded-lg p-4 space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-600">ID Stripe:</span>
                              <span className="font-mono text-xs">{details.subscription.stripe_subscription_id}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Période actuelle:</span>
                              <span>{new Date(details.subscription.current_period_start).toLocaleDateString('fr-FR')} → {new Date(details.subscription.current_period_end).toLocaleDateString('fr-FR')}</span>
                            </div>
                            {details.subscription.trial_end && (
                              <div className="flex justify-between">
                                <span className="text-gray-600">Fin d'essai:</span>
                                <span className="text-blue-600 font-semibold">{new Date(details.subscription.trial_end).toLocaleDateString('fr-FR')}</span>
                              </div>
                            )}
                            {details.subscription.last_payment_date && (
                              <div className="flex justify-between">
                                <span className="text-gray-600">Dernier paiement:</span>
                                <span className="text-green-600">{details.subscription.last_payment_amount}€ le {new Date(details.subscription.last_payment_date).toLocaleDateString('fr-FR')}</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-gray-500 italic">Aucun abonnement actif</p>
                        )}

                        <h5 className="font-semibold text-gray-900 flex items-center gap-2 mt-4">
                          <Users className="w-4 h-4" />
                          Équipe
                        </h5>
                        <div className="bg-white rounded-lg p-4 space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Vendeurs actifs:</span>
                            <span className="font-bold text-green-600">{details.sellers?.active || 0}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Vendeurs suspendus:</span>
                            <span className="font-bold text-orange-600">{details.sellers?.suspended || 0}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Total:</span>
                            <span className="font-bold text-gray-900">{details.sellers?.total || 0}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right Column - Transactions */}
                      <div className="space-y-4">
                        <h5 className="font-semibold text-gray-900 flex items-center gap-2">
                          <Activity className="w-4 h-4" />
                          Transactions Récentes
                        </h5>
                        
                        <div className="bg-white rounded-lg divide-y divide-gray-200 max-h-64 overflow-y-auto">
                          {details.transactions && details.transactions.length > 0 ? (
                            details.transactions.slice(0, 10).map((tx) => (
                              <div key={tx.id} className="p-3 hover:bg-gray-50">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    {tx.status === 'paid' ? (
                                      <CheckCircle className="w-4 h-4 text-green-500" />
                                    ) : (
                                      <XCircle className="w-4 h-4 text-red-500" />
                                    )}
                                    <div>
                                      <p className="text-sm font-medium text-gray-900">
                                        {tx.amount}€
                                        {tx.is_proration && <span className="ml-2 text-xs text-blue-600">(Proration)</span>}
                                      </p>
                                      <p className="text-xs text-gray-500">
                                        {new Date(tx.created_at).toLocaleString('fr-FR')}
                                      </p>
                                    </div>
                                  </div>
                                  <span className={`text-xs px-2 py-1 rounded ${
                                    tx.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                  }`}>
                                    {tx.status === 'paid' ? 'Payé' : 'Échoué'}
                                  </span>
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="p-4 text-gray-500 text-center italic">Aucune transaction</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
