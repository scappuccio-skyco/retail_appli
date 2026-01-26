import React, { useState, useEffect } from 'react';
import { api } from '../../lib/apiClient';
import { logger } from '../../utils/logger';
import { toast } from 'sonner';
import { Calendar, Clock, Users, Search, AlertCircle, CheckCircle } from 'lucide-react';

export default function TrialManagement() {
  const [gerants, setGerants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editingTrial, setEditingTrial] = useState(null);
  const [newTrialEnd, setNewTrialEnd] = useState('');
  const [refreshKey, setRefreshKey] = useState(0); // Force re-render après mise à jour

  useEffect(() => {
    fetchGerants();
  }, []);

  const fetchGerants = async () => {
    try {
      setLoading(true);
      const response = await api.get('/superadmin/gerants/trials');
      setGerants(response.data);
    } catch (error) {
      logger.error('Error fetching gerants:', error);
      toast.error('Erreur lors du chargement des gérants');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateTrial = async (gerantId) => {
    if (!newTrialEnd) {
      toast.error('Veuillez sélectionner une date');
      return;
    }

    try {
      // Convertir la date YYYY-MM-DD en format ISO avec heure à minuit UTC
      const trialEndDate = new Date(newTrialEnd + 'T00:00:00.000Z');
      const trialEndISO = trialEndDate.toISOString();
      
      await api.patch(
        `/superadmin/gerants/${gerantId}/trial`,
        { trial_end: trialEndISO }
      );
      
      toast.success('Période d\'essai mise à jour avec succès');
      setEditingTrial(null);
      setNewTrialEnd('');
      
      // Forcer un rafraîchissement immédiat puis un second après un court délai
      // pour s'assurer que le backend a bien mis à jour
      await fetchGerants();
      setRefreshKey(prev => prev + 1); // Force re-render
      
      // Second rafraîchissement après un délai pour garantir la mise à jour
      setTimeout(async () => {
        await fetchGerants();
        setRefreshKey(prev => prev + 1);
      }, 500);
    } catch (error) {
      logger.error('Error updating trial:', error);
      toast.error(error.response?.data?.detail || 'Erreur lors de la mise à jour');
    }
  };

  const calculateDaysRemaining = (trialEnd) => {
    if (!trialEnd) return null;
    const now = new Date();
    const end = new Date(trialEnd);
    // Utiliser Math.floor pour être cohérent avec le backend
    // et éviter les différences d'un jour selon l'heure
    const diff = Math.floor((end - now) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const getGerantStatus = (gerant) => {
    // ⚠️ IMPORTANT: has_subscription peut être true pour un essai (trialing) OU un abonnement actif (active)
    // Il faut vérifier subscription_status pour distinguer les deux
    if (gerant.subscription_status === 'active') {
      return 'subscribed';
    }
    if (gerant.subscription_status === 'trialing') {
      // Utiliser days_left du backend si disponible, sinon calculer
      const daysRemaining = gerant.days_left !== undefined ? gerant.days_left : calculateDaysRemaining(gerant.trial_end);
      if (daysRemaining === null || daysRemaining < 0) return 'expired';
      if (daysRemaining <= 7) return 'expiring_soon';
      return 'active_trial';
    }
    if (!gerant.trial_end) return 'no_trial';
    const daysRemaining = calculateDaysRemaining(gerant.trial_end);
    if (daysRemaining < 0) return 'expired';
    if (daysRemaining <= 7) return 'expiring_soon';
    return 'active_trial';
  };

  const filteredGerants = gerants.filter(g => {
    // Search filter
    const matchesSearch = g.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      g.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Status filter
    if (statusFilter === 'all') return matchesSearch;
    
    const status = getGerantStatus(g);
    
    switch (statusFilter) {
      case 'active_trial':
        return matchesSearch && (status === 'active_trial' || status === 'expiring_soon');
      case 'expiring_soon':
        return matchesSearch && status === 'expiring_soon';
      case 'expired':
        return matchesSearch && status === 'expired';
      case 'no_trial':
        return matchesSearch && status === 'no_trial';
      case 'subscribed':
        return matchesSearch && status === 'subscribed';
      default:
        return matchesSearch;
    }
  });

  // Count by status for filter badges
  const statusCounts = {
    all: gerants.length,
    active_trial: gerants.filter(g => {
      const status = getGerantStatus(g);
      return status === 'active_trial' || status === 'expiring_soon';
    }).length,
    expiring_soon: gerants.filter(g => getGerantStatus(g) === 'expiring_soon').length,
    expired: gerants.filter(g => getGerantStatus(g) === 'expired').length,
    no_trial: gerants.filter(g => getGerantStatus(g) === 'no_trial').length,
    subscribed: gerants.filter(g => getGerantStatus(g) === 'subscribed').length
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Calendar className="w-7 h-7 text-blue-600" />
              Gestion des Périodes d'Essai
            </h2>
            <p className="text-gray-600 mt-1">
              Gérer les périodes d'essai des gérants
            </p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Rechercher par nom ou email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Status Filter Buttons */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
              statusFilter === 'all'
                ? 'bg-gray-800 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Tous ({statusCounts.all})
          </button>
          <button
            onClick={() => setStatusFilter('active_trial')}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
              statusFilter === 'active_trial'
                ? 'bg-blue-600 text-white'
                : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
            }`}
          >
            <Clock className="w-3.5 h-3.5 inline mr-1" />
            En essai ({statusCounts.active_trial})
          </button>
          <button
            onClick={() => setStatusFilter('expiring_soon')}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
              statusFilter === 'expiring_soon'
                ? 'bg-orange-500 text-white'
                : 'bg-orange-50 text-orange-600 hover:bg-orange-100'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5 inline mr-1" />
            Expire bientôt ({statusCounts.expiring_soon})
          </button>
          <button
            onClick={() => setStatusFilter('expired')}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
              statusFilter === 'expired'
                ? 'bg-red-600 text-white'
                : 'bg-red-50 text-red-600 hover:bg-red-100'
            }`}
          >
            Expiré ({statusCounts.expired})
          </button>
          <button
            onClick={() => setStatusFilter('no_trial')}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
              statusFilter === 'no_trial'
                ? 'bg-gray-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Aucun essai ({statusCounts.no_trial})
          </button>
          <button
            onClick={() => setStatusFilter('subscribed')}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
              statusFilter === 'subscribed'
                ? 'bg-green-600 text-white'
                : 'bg-green-50 text-green-600 hover:bg-green-100'
            }`}
          >
            <CheckCircle className="w-3.5 h-3.5 inline mr-1" />
            Abonnés ({statusCounts.subscribed})
          </button>
        </div>

        {/* Gerants List */}
        <div key={refreshKey} className="space-y-4">
          {filteredGerants.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p>Aucun gérant trouvé</p>
            </div>
          ) : (
            filteredGerants.map((gerant) => {
              // Utiliser days_left du backend en priorité pour garantir la cohérence
              // Ne calculer que si days_left n'est pas disponible
              const daysRemaining = gerant.days_left !== undefined 
                ? gerant.days_left 
                : calculateDaysRemaining(gerant.trial_end);
              const isExpired = daysRemaining !== null && daysRemaining < 0;
              const isExpiringSoon = daysRemaining !== null && daysRemaining >= 0 && daysRemaining <= 7;
              const isEditing = editingTrial === gerant.id;

              return (
                <div
                  key={gerant.id}
                  className={`border rounded-lg p-4 transition-all ${
                    isExpired ? 'border-red-300 bg-red-50' :
                    isExpiringSoon ? 'border-orange-300 bg-orange-50' :
                    'border-gray-200 bg-white hover:shadow-md'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-800">
                          {gerant.name}
                        </h3>
                        {gerant.subscription_status === 'active' ? (
                          <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded-full flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            Abonné
                          </span>
                        ) : gerant.subscription_status === 'trialing' || gerant.trial_end ? (
                          <span className={`px-2 py-0.5 text-xs font-semibold rounded-full flex items-center gap-1 ${
                            isExpired ? 'bg-red-100 text-red-700' :
                            isExpiringSoon ? 'bg-orange-100 text-orange-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            <Clock className="w-3 h-3" />
                            {isExpired ? 'Expiré' : 'Essai'}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs font-semibold rounded-full">
                            Aucun essai
                          </span>
                        )}
                      </div>
                      
                      <p className="text-sm text-gray-600 mb-2">{gerant.email}</p>
                      
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1 text-gray-600">
                          <Users className="w-4 h-4" />
                          <span>
                            {gerant.active_sellers_count || 0} 
                            {gerant.max_sellers ? ` / ${gerant.max_sellers}` : ''} vendeurs actifs
                          </span>
                        </div>
                        
                        {(gerant.trial_end || gerant.days_left !== undefined) && (
                          <div className={`flex items-center gap-1 ${
                            isExpired ? 'text-red-600 font-semibold' :
                            isExpiringSoon ? 'text-orange-600 font-semibold' :
                            'text-gray-600'
                          }`}>
                            <Calendar className="w-4 h-4" />
                            <span>
                              {isExpired ? 'Expiré depuis ' : 'Expire dans '}
                              {Math.abs(daysRemaining)} jour{Math.abs(daysRemaining) > 1 ? 's' : ''}
                            </span>
                          </div>
                        )}
                      </div>

                      {gerant.trial_end && (
                        <p className="text-xs text-gray-500 mt-2">
                          Fin d'essai : {new Date(gerant.trial_end).toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric'
                          })}
                        </p>
                      )}
                    </div>

                    <div className="ml-4">
                      {!isEditing ? (
                        <button
                          onClick={() => {
                            setEditingTrial(gerant.id);
                            // Set default value to current trial_end or 30 days from now
                            const defaultDate = gerant.trial_end 
                              ? new Date(gerant.trial_end).toISOString().split('T')[0]
                              : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                            setNewTrialEnd(defaultDate);
                          }}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                        >
                          Prolonger l'essai
                        </button>
                      ) : (
                        <div className="flex flex-col gap-2">
                          <div className="text-xs text-gray-600">
                            Fin d'essai actuelle :
                            <span className="ml-1 font-semibold text-gray-800">
                              {gerant.trial_end
                                ? new Date(gerant.trial_end).toLocaleDateString('fr-FR')
                                : 'Aucune'}
                            </span>
                          </div>
                          <div className="relative">
                            <input
                              type="date"
                              value={newTrialEnd}
                              onChange={(e) => setNewTrialEnd(e.target.value)}
                              min={(gerant.trial_end
                                ? new Date(gerant.trial_end).toISOString().split('T')[0]
                                : new Date().toISOString().split('T')[0])}
                              className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
                              onClick={(e) => e.target.showPicker && e.target.showPicker()}
                            />
                          </div>
                          {newTrialEnd && (
                            <div className="text-xs text-blue-700">
                              Nouvelle fin d'essai :
                              <span className="ml-1 font-semibold">
                                {new Date(newTrialEnd).toLocaleDateString('fr-FR')}
                              </span>
                            </div>
                          )}
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleUpdateTrial(gerant.id)}
                              className="flex-1 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                            >
                              Valider
                            </button>
                            <button
                              onClick={() => {
                                setEditingTrial(null);
                                setNewTrialEnd('');
                              }}
                              className="flex-1 px-3 py-1.5 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors text-sm font-medium"
                            >
                              Annuler
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p className="font-semibold mb-1">Information</p>
          <ul className="list-disc list-inside space-y-1 text-blue-700">
            <li>Vous pouvez prolonger la date de fin d'essai pour rallonger la période</li>
            <li>Les gérants avec un abonnement actif ne sont pas modifiables ici</li>
            <li>Un essai expiré est marqué en rouge, un essai proche de l'expiration en orange</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
