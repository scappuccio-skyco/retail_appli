import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Calendar, Clock, Users, Search, AlertCircle, CheckCircle } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function TrialManagement() {
  const [gerants, setGerants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingTrial, setEditingTrial] = useState(null);
  const [newTrialEnd, setNewTrialEnd] = useState('');

  useEffect(() => {
    fetchGerants();
  }, []);

  const fetchGerants = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      
      const response = await axios.get(`${API}/superadmin/gerants/trials`, { headers });
      setGerants(response.data);
    } catch (error) {
      console.error('Error fetching gerants:', error);
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
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      
      await axios.patch(
        `${API}/superadmin/gerants/${gerantId}/trial`,
        { trial_end: newTrialEnd },
        { headers }
      );
      
      toast.success('Période d\'essai mise à jour avec succès');
      setEditingTrial(null);
      setNewTrialEnd('');
      fetchGerants();
    } catch (error) {
      console.error('Error updating trial:', error);
      toast.error(error.response?.data?.detail || 'Erreur lors de la mise à jour');
    }
  };

  const calculateDaysRemaining = (trialEnd) => {
    if (!trialEnd) return null;
    const now = new Date();
    const end = new Date(trialEnd);
    const diff = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const filteredGerants = gerants.filter(g => 
    g.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    g.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Rechercher par nom ou email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Gerants List */}
        <div className="space-y-4">
          {filteredGerants.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p>Aucun gérant trouvé</p>
            </div>
          ) : (
            filteredGerants.map((gerant) => {
              const daysRemaining = calculateDaysRemaining(gerant.trial_end);
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
                        {gerant.has_subscription ? (
                          <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded-full flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            Abonné
                          </span>
                        ) : gerant.trial_end ? (
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
                          <span>{gerant.active_sellers_count || 0} vendeurs actifs</span>
                        </div>
                        
                        {gerant.trial_end && (
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
                          Modifier l'essai
                        </button>
                      ) : (
                        <div className="flex flex-col gap-2">
                          <input
                            type="date"
                            value={newTrialEnd}
                            onChange={(e) => setNewTrialEnd(e.target.value)}
                            min={new Date().toISOString().split('T')[0]}
                            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
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
            <li>Vous pouvez modifier la date de fin d'essai pour rallonger ou raccourcir la période</li>
            <li>Les gérants avec un abonnement actif ne peuvent pas être modifiés ici</li>
            <li>Un essai expiré est marqué en rouge, un essai proche de l'expiration en orange</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
