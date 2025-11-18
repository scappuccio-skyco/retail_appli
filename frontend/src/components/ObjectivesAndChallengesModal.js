import React, { useState } from 'react';
import { X, Award, Calendar, TrendingUp, CheckCircle, XCircle } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function ObjectivesAndChallengesModal({ objectives, challenges, onClose, onUpdate }) {
  const [showInactive, setShowInactive] = useState(false);
  const [updatingProgressObjectiveId, setUpdatingProgressObjectiveId] = useState(null);
  const [progressValue, setProgressValue] = useState('');
  
  // Séparer les objectifs actifs et inactifs
  const activeObjectives = objectives?.filter(obj => {
    const today = new Date().toISOString().split('T')[0];
    return obj.period_end > today;
  }) || [];
  
  const inactiveObjectives = objectives?.filter(obj => {
    const today = new Date().toISOString().split('T')[0];
    return obj.period_end <= today;
  }) || [];
  
  const formatDate = (dateStr) => {
    if (!dateStr) return 'Date non définie';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return 'Date invalide';
      return date.toLocaleDateString('fr-FR', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
      });
    } catch (error) {
      return 'Date invalide';
    }
  };

  // NEW SYSTEM: Calculate progress using current_value and target_value
  const calculateProgress = (objective) => {
    if (!objective.target_value || objective.target_value === 0) return 0;
    return ((objective.current_value || 0) / objective.target_value) * 100;
  };

  const handleUpdateProgress = async (objectiveId) => {
    if (!progressValue || progressValue === '') {
      toast.error('Veuillez entrer une valeur');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API}/manager/objectives/${objectiveId}/progress`,
        { current_value: parseFloat(progressValue) },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Progression mise à jour avec succès');
      setUpdatingProgressObjectiveId(null);
      setProgressValue('');
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error('Error updating progress:', err);
      toast.error(err.response?.data?.detail || 'Erreur lors de la mise à jour de la progression');
    }
  };

  const calculateChallengeProgress = (challenge) => {
    if (challenge.ca_target) return (challenge.progress_ca / challenge.ca_target) * 100;
    if (challenge.ventes_target) return (challenge.progress_ventes / challenge.ventes_target) * 100;
    if (challenge.indice_vente_target) return (challenge.progress_indice_vente / challenge.indice_vente_target) * 100;
    if (challenge.panier_moyen_target) return (challenge.progress_panier_moyen / challenge.panier_moyen_target) * 100;
    return 0;
  };

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) { onClose(); } }} className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white bg-opacity-20 rounded-xl flex items-center justify-center">
              <Award className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Objectifs et Challenges</h2>
              <p className="text-sm text-purple-100">Tous mes objectifs d'équipe et défis personnels</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-all"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Objectifs Actifs */}
          <div className="mb-8">
            <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Award className="w-5 h-5 text-purple-500" />
              🎯 Objectifs Actifs
              <span className="ml-2 bg-green-100 text-green-700 text-sm font-semibold px-3 py-1 rounded-full">
                {activeObjectives.length}
              </span>
            </h3>

            {activeObjectives.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {activeObjectives.map((objective) => {
                  const progressPercentage = calculateProgress(objective);
                  const status = objective.status || 'in_progress';

                  return (
                    <div 
                      key={objective.id} 
                      className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 border-2 border-purple-200"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <h4 className="font-bold text-gray-800 text-base">{objective.title}</h4>
                        <div className="flex flex-col gap-1 items-end">
                          {status === 'achieved' && (
                            <span className="bg-green-100 text-green-700 text-xs font-semibold px-2 py-1 rounded-full">
                              🎉 Atteint !
                            </span>
                          )}
                          {status === 'failed' && (
                            <span className="bg-red-100 text-red-700 text-xs font-semibold px-2 py-1 rounded-full">
                              ⚠️ Non atteint
                            </span>
                          )}
                          {status === 'in_progress' && (
                            <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-2 py-1 rounded-full">
                              ⏳ En cours
                            </span>
                          )}
                          <span className="bg-purple-100 text-purple-700 text-xs font-semibold px-2 py-1 rounded-full">
                            👥 Équipe
                          </span>
                        </div>
                      </div>

                      {/* Période */}
                      <div className="flex items-center gap-1 text-xs text-gray-600 mb-3">
                        <Calendar className="w-3 h-3" />
                        {formatDate(objective.period_start)} - {formatDate(objective.period_end)}
                      </div>

                      {/* Progress Bar */}
                      <div className="mb-3">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs text-gray-600">Progression</span>
                          <span className="text-xs font-bold text-gray-800">{Math.min(100, progressPercentage.toFixed(0))}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full transition-all ${
                              status === 'achieved' ? 'bg-gradient-to-r from-green-400 to-green-500' :
                              status === 'failed' ? 'bg-gradient-to-r from-red-400 to-red-500' :
                              'bg-gradient-to-r from-purple-400 to-pink-400'
                            }`}
                            style={{ width: `${Math.min(100, progressPercentage)}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* Targets */}
                      <div className="space-y-2">
                        {objective.ca_target && (
                          <div className="bg-white rounded-lg p-2 border border-purple-200">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-gray-700">💰 CA</span>
                              <span className="text-sm font-bold text-purple-700">
                                {(objective.progress_ca || 0).toLocaleString('fr-FR')}€ / {objective.ca_target.toLocaleString('fr-FR')}€
                              </span>
                            </div>
                          </div>
                        )}
                        {objective.panier_moyen_target && (
                          <div className="bg-white rounded-lg p-2 border border-purple-200">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-gray-700">🛒 Panier Moyen</span>
                              <span className="text-sm font-bold text-purple-700">
                                {(objective.progress_panier_moyen || 0).toFixed(2)}€ / {objective.panier_moyen_target.toFixed(2)}€
                              </span>
                            </div>
                          </div>
                        )}
                        {objective.indice_vente_target && (
                          <div className="bg-white rounded-lg p-2 border border-purple-200">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-gray-700">📊 Indice de Vente</span>
                              <span className="text-sm font-bold text-purple-700">
                                {(objective.progress_indice_vente || 0).toFixed(2)} / {objective.indice_vente_target.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 bg-gray-50 rounded-xl">
                <Award className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500">Aucun objectif actif pour le moment</p>
              </div>
            )}
          </div>

          {/* Objectifs Inactifs */}
          {inactiveObjectives.length > 0 && (
            <div className="mb-8">
              <button
                onClick={() => setShowInactive(!showInactive)}
                className="w-full text-left mb-4 flex items-center justify-between p-4 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
              >
                <h3 className="text-xl font-bold text-gray-700 flex items-center gap-2">
                  <XCircle className="w-5 h-5 text-gray-500" />
                  📋 Objectifs Terminés
                  <span className="ml-2 bg-gray-200 text-gray-700 text-sm font-semibold px-3 py-1 rounded-full">
                    {inactiveObjectives.length}
                  </span>
                </h3>
                <span className="text-gray-500">
                  {showInactive ? '▲ Masquer' : '▼ Afficher'}
                </span>
              </button>

              {showInactive && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {inactiveObjectives.map((objective) => {
                    const progressPercentage = calculateProgress(objective);
                    const status = objective.status || 'in_progress';

                    return (
                      <div 
                        key={objective.id} 
                        className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border-2 border-gray-300 opacity-75"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <h4 className="font-bold text-gray-700 text-base">{objective.title}</h4>
                          <div className="flex flex-col gap-1 items-end">
                            {status === 'achieved' && (
                              <span className="bg-green-100 text-green-700 text-xs font-semibold px-2 py-1 rounded-full">
                                🎉 Atteint !
                              </span>
                            )}
                            {status === 'failed' && (
                              <span className="bg-red-100 text-red-700 text-xs font-semibold px-2 py-1 rounded-full">
                                ⚠️ Non atteint
                              </span>
                            )}
                            {status === 'in_progress' && (
                              <span className="bg-gray-200 text-gray-600 text-xs font-semibold px-2 py-1 rounded-full">
                                ⏹️ Terminé
                              </span>
                            )}
                            <span className="bg-gray-200 text-gray-600 text-xs font-semibold px-2 py-1 rounded-full">
                              👥 Équipe
                            </span>
                          </div>
                        </div>

                        {/* Période */}
                        <div className="flex items-center gap-1 text-xs text-gray-500 mb-3">
                          <Calendar className="w-3 h-3" />
                          {formatDate(objective.period_start)} - {formatDate(objective.period_end)}
                        </div>

                        {/* Progress Bar */}
                        <div className="mb-3">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs text-gray-500">Progression finale</span>
                            <span className="text-xs font-bold text-gray-700">{Math.min(100, progressPercentage.toFixed(0))}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full transition-all ${
                                status === 'achieved' ? 'bg-gradient-to-r from-green-400 to-green-500' :
                                status === 'failed' ? 'bg-gradient-to-r from-red-400 to-red-500' :
                                'bg-gradient-to-r from-gray-400 to-gray-500'
                              }`}
                              style={{ width: `${Math.min(100, progressPercentage)}%` }}
                            ></div>
                          </div>
                        </div>

                        {/* Targets */}
                        <div className="space-y-2">
                          {objective.ca_target && (
                            <div className="bg-white rounded-lg p-2 border border-gray-300">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-gray-600">💰 CA</span>
                                <span className="text-sm font-bold text-gray-700">
                                  {(objective.progress_ca || 0).toLocaleString('fr-FR')}€ / {objective.ca_target.toLocaleString('fr-FR')}€
                                </span>
                              </div>
                            </div>
                          )}
                          {objective.panier_moyen_target && (
                            <div className="bg-white rounded-lg p-2 border border-gray-300">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-gray-600">🛒 Panier Moyen</span>
                                <span className="text-sm font-bold text-gray-700">
                                  {(objective.progress_panier_moyen || 0).toFixed(2)}€ / {objective.panier_moyen_target.toFixed(2)}€
                                </span>
                              </div>
                            </div>
                          )}
                          {objective.indice_vente_target && (
                            <div className="bg-white rounded-lg p-2 border border-gray-300">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-gray-600">📊 Indice de Vente</span>
                                <span className="text-sm font-bold text-gray-700">
                                  {(objective.progress_indice_vente || 0).toFixed(2)} / {objective.indice_vente_target.toFixed(2)}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Mes Challenges */}
          <div>
            <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#ffd871]" />
              🏆 Mes Challenges
            </h3>

            {challenges && challenges.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {challenges.map((challenge) => {
                  const progressPercentage = calculateChallengeProgress(challenge);
                  const status = challenge.status || 'in_progress';

                  return (
                    <div 
                      key={challenge.id} 
                      className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border-2 border-blue-200"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <h4 className="font-bold text-gray-800 text-base">{challenge.title}</h4>
                        <div className="flex flex-col gap-1 items-end">
                          {status === 'achieved' && (
                            <span className="bg-green-100 text-green-700 text-xs font-semibold px-2 py-1 rounded-full">
                              🎉 Réussi !
                            </span>
                          )}
                          {status === 'failed' && (
                            <span className="bg-red-100 text-red-700 text-xs font-semibold px-2 py-1 rounded-full">
                              ⚠️ Échoué
                            </span>
                          )}
                          {status === 'in_progress' && (
                            <span className="bg-orange-100 text-orange-700 text-xs font-semibold px-2 py-1 rounded-full">
                              ⏳ En cours
                            </span>
                          )}
                          <span className="bg-yellow-100 text-yellow-700 text-xs font-semibold px-2 py-1 rounded-full">
                            👤 Personnel
                          </span>
                        </div>
                      </div>

                      {/* Description */}
                      {challenge.description && (
                        <p className="text-sm text-gray-600 mb-3">
                          {challenge.description}
                        </p>
                      )}

                      {/* Période */}
                      <div className="flex items-center gap-1 text-xs text-gray-600 mb-3">
                        <Calendar className="w-3 h-3" />
                        {formatDate(challenge.start_date || challenge.period_start)} - {formatDate(challenge.end_date || challenge.period_end)}
                      </div>

                      {/* Progress Bar */}
                      <div className="mb-3">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs text-gray-600">Progression</span>
                          <span className="text-xs font-bold text-gray-800">{Math.min(100, progressPercentage.toFixed(0))}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full transition-all ${
                              status === 'achieved' ? 'bg-gradient-to-r from-green-400 to-green-500' :
                              status === 'failed' ? 'bg-gradient-to-r from-red-400 to-red-500' :
                              'bg-gradient-to-r from-yellow-400 to-orange-400'
                            }`}
                            style={{ width: `${Math.min(100, progressPercentage)}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* Targets */}
                      <div className="space-y-2">
                        {challenge.ca_target && (
                          <div className="bg-white rounded-lg p-2 border border-blue-200">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-gray-700">💰 CA</span>
                              <span className="text-sm font-bold text-orange-700">
                                {(challenge.progress_ca || 0).toLocaleString('fr-FR')}€ / {challenge.ca_target.toLocaleString('fr-FR')}€
                              </span>
                            </div>
                          </div>
                        )}
                        {challenge.ventes_target && (
                          <div className="bg-white rounded-lg p-2 border border-blue-200">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-gray-700">🛍️ Ventes</span>
                              <span className="text-sm font-bold text-orange-700">
                                {(challenge.progress_ventes || 0)} / {challenge.ventes_target}
                              </span>
                            </div>
                          </div>
                        )}
                        {challenge.panier_moyen_target && (
                          <div className="bg-white rounded-lg p-2 border border-blue-200">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-gray-700">🛒 Panier Moyen</span>
                              <span className="text-sm font-bold text-orange-700">
                                {(challenge.progress_panier_moyen || 0).toFixed(2)}€ / {challenge.panier_moyen_target.toFixed(2)}€
                              </span>
                            </div>
                          </div>
                        )}
                        {challenge.indice_vente_target && (
                          <div className="bg-white rounded-lg p-2 border border-blue-200">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-gray-700">📊 Indice de Vente</span>
                              <span className="text-sm font-bold text-orange-700">
                                {(challenge.progress_indice_vente || 0).toFixed(2)} / {challenge.indice_vente_target.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 bg-gray-50 rounded-xl">
                <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500">Aucun challenge personnel pour le moment</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t p-4 bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded-lg transition-all"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
