import React, { useState, useEffect } from 'react';
import { X, Award, Calendar, TrendingUp, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../lib/apiClient';
import { logger } from '../utils/logger';
import AchievementModal from './AchievementModal';

export default function ObjectivesAndChallengesModal({ objectives, challenges, onClose, onUpdate }) {
  const [showInactive, setShowInactive] = useState(false);
  const [updatingProgressObjectiveId, setUpdatingProgressObjectiveId] = useState(null);
  const [progressValue, setProgressValue] = useState('');
  
  // Achievement notification states
  const [achievementModal, setAchievementModal] = useState({
    isOpen: false,
    item: null,
    itemType: null
  });
  
  // Local state for objectives and challenges to allow refresh
  const [localObjectives, setLocalObjectives] = useState(objectives);
  const [localChallenges, setLocalChallenges] = useState(challenges);
  
  // Refresh data when modal opens or when props change
  useEffect(() => {
    setLocalObjectives(objectives);
    setLocalChallenges(challenges);
  }, [objectives, challenges]);
  
  // Refresh data on mount to get latest flags
  useEffect(() => {
    const refreshData = async () => {
      try {
        const [objRes, challRes] = await Promise.all([
          api.get('/seller/objectives/active'),
          api.get('/seller/challenges/active')
        ]);
        setLocalObjectives(objRes.data || []);
        setLocalChallenges(challRes.data || []);
      } catch (err) {
        logger.error('Error refreshing objectives/challenges:', err);
      }
    };
    refreshData();
  }, []);
  
  // Check for unseen achievements when objectives/challenges change
  useEffect(() => {
    // Filter out achieved objectives first - they shouldn't trigger modals from active list
    const activeOnly = localObjectives?.filter(obj => obj.status !== 'achieved') || [];
    
    const unseenObjective = activeOnly.find(obj => obj.has_unseen_achievement === true);
    const unseenChallenge = localChallenges?.find(chall => chall.has_unseen_achievement === true);
    
    console.log('🔍 [ACHIEVEMENT CHECK] Objectives:', localObjectives?.length, 'After filtering achieved:', activeOnly.length, 'Challenges:', localChallenges?.length);
    console.log('🔍 [ACHIEVEMENT CHECK] All objectives:', activeOnly.map(obj => ({
      title: obj.title,
      status: obj.status,
      has_unseen: obj.has_unseen_achievement
    })));
    console.log('🔍 [ACHIEVEMENT CHECK] Unseen objective:', unseenObjective?.title, unseenObjective?.has_unseen_achievement);
    console.log('🔍 [ACHIEVEMENT CHECK] Unseen challenge:', unseenChallenge?.title, unseenChallenge?.has_unseen_achievement);
    
    // Priority: show objective first, then challenge
    // Only show if modal is not already open
    if (unseenObjective && !achievementModal.isOpen) {
      console.log('🎉 [ACHIEVEMENT] Showing achievement modal for objective:', unseenObjective.title);
      setAchievementModal({
        isOpen: true,
        item: unseenObjective,
        itemType: 'objective'
      });
    } else if (unseenChallenge && !achievementModal.isOpen && !unseenObjective) {
      console.log('🎉 [ACHIEVEMENT] Showing achievement modal for challenge:', unseenChallenge.title);
      setAchievementModal({
        isOpen: true,
        item: unseenChallenge,
        itemType: 'challenge'
      });
    }
  }, [localObjectives, localChallenges, achievementModal.isOpen]);
  
  const handleMarkAchievementAsSeen = async () => {
    console.log('✅ [ACHIEVEMENT] Marking achievement as seen, refreshing data...');
    // Close modal first
    setAchievementModal({ isOpen: false, item: null, itemType: null });
    
    // Refresh data after marking as seen (with delay to ensure modal closes smoothly)
    setTimeout(async () => {
      try {
        const [objRes, challRes] = await Promise.all([
          api.get('/seller/objectives/active'),
          api.get('/seller/challenges/active')
        ]);
        
        // Filter out any achieved objectives that might have slipped through
        // This ensures they don't come back even if backend returns them
        const filteredObjectives = (objRes.data || []).filter(obj => obj.status !== 'achieved');
        setLocalObjectives(filteredObjectives);
        setLocalChallenges(challRes.data || []);
        
        if (onUpdate) {
          await onUpdate();
        }
      } catch (err) {
        logger.error('Error refreshing after marking as seen:', err);
      }
    }, 300);
  };
  
  // Séparer les objectifs actifs et inactifs (use local state)
  // CRITICAL: Filter out achieved objectives from active list
  const today = new Date().toISOString().split('T')[0];
  const activeObjectives = localObjectives?.filter(obj => {
    const isNotAchieved = obj.status !== 'achieved';
    const isActivePeriod = obj.period_end > today;
    return isNotAchieved && isActivePeriod;
  }) || [];
  
  const inactiveObjectives = localObjectives?.filter(obj => {
    const isAchieved = obj.status === 'achieved';
    const isExpired = obj.period_end <= today;
    // Include in inactive if achieved OR expired
    return isAchieved || isExpired;
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
      const response = await api.post(
        `/seller/objectives/${objectiveId}/progress`,
        { value: parseFloat(progressValue) }
      );
      logger.log('✅ Progress updated, response:', response.data);
      
      const updatedObjective = response.data;
      
      setUpdatingProgressObjectiveId(null);
      setProgressValue('');
      
      // Check if objective just became "achieved" and has unseen achievement
      if (updatedObjective.status === 'achieved' && updatedObjective.has_unseen_achievement === true) {
        console.log('🎉 [PROGRESS UPDATE] Objective just achieved! Showing modal...');
        // Show achievement modal immediately (BEFORE refreshing)
        // Don't refresh yet - let the modal show first
        setAchievementModal({
          isOpen: true,
          item: updatedObjective,
          itemType: 'objective'
        });
        toast.success('🎉 Objectif atteint !');
        // Don't refresh here - refresh will happen after modal is closed
        return; // Exit early to prevent refresh
      } else if (updatedObjective.status === 'achieved') {
        // Already seen, just show toast and refresh
        toast.success('🎉 Félicitations ! Objectif atteint !');
        // Refresh to remove from active list
        try {
          const [objRes, challRes] = await Promise.all([
            api.get('/seller/objectives/active'),
            api.get('/seller/challenges/active')
          ]);
          setLocalObjectives(objRes.data || []);
          setLocalChallenges(challRes.data || []);
        } catch (err) {
          logger.error('Error refreshing after progress update:', err);
        }
      } else {
        toast.success('Progression mise à jour avec succès');
        // Refresh normally
        try {
          const [objRes, challRes] = await Promise.all([
            api.get('/seller/objectives/active'),
            api.get('/seller/challenges/active')
          ]);
          setLocalObjectives(objRes.data || []);
          setLocalChallenges(challRes.data || []);
        } catch (err) {
          logger.error('Error refreshing after progress update:', err);
        }
      }
      
      // Also call parent update
      if (onUpdate) {
        await onUpdate();
      }
    } catch (err) {
      logger.error('Error updating progress:', err);
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
                          {objective.status === 'achieved' && (
                            <span className="bg-green-100 text-green-700 text-xs font-semibold px-2 py-1 rounded-full">
                              🎉 Atteint !
                            </span>
                          )}
                          {objective.status === 'failed' && (
                            <span className="bg-red-100 text-red-700 text-xs font-semibold px-2 py-1 rounded-full">
                              ⚠️ Non atteint
                            </span>
                          )}
                          {objective.status === 'active' && (
                            <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-2 py-1 rounded-full">
                              ⏳ En cours
                            </span>
                          )}
                          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                            objective.data_entry_responsible === 'seller' 
                              ? 'bg-cyan-100 text-cyan-700' 
                              : 'bg-orange-100 text-orange-700'
                          }`}>
                            {objective.data_entry_responsible === 'seller' ? '🧑‍💼 Vendeur' : '👨‍💼 Manager'}
                          </span>
                        </div>
                      </div>

                      {/* Période */}
                      <div className="flex items-center gap-1 text-xs text-gray-600 mb-3">
                        <Calendar className="w-3 h-3" />
                        {formatDate(objective.period_start)} - {formatDate(objective.period_end)}
                      </div>

                      {/* NEW SYSTEM - Objective Type */}
                      <div className="mb-3 bg-white rounded-lg p-2 border border-purple-200">
                        {objective.objective_type === 'kpi_standard' && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-gray-700">📊 KPI:</span>
                            <span className="text-xs text-purple-700">
                              {objective.kpi_name === 'ca' ? '💰 Chiffre d\'affaires' :
                               objective.kpi_name === 'ventes' ? '🛍️ Nombre de ventes' :
                               objective.kpi_name === 'articles' ? '📦 Nombre d\'articles' :
                               objective.kpi_name}
                            </span>
                          </div>
                        )}
                        {objective.objective_type === 'product_focus' && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-gray-700">📦 Produit:</span>
                            <span className="text-xs text-purple-700">{objective.product_name}</span>
                          </div>
                        )}
                        {objective.objective_type === 'custom' && (
                          <div>
                            <span className="text-xs font-semibold text-gray-700">✨ Objectif personnalisé:</span>
                            <p className="text-xs text-purple-700 mt-1">{objective.custom_description}</p>
                          </div>
                        )}
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
                              objective.status === 'achieved' ? 'bg-gradient-to-r from-green-400 to-green-500' :
                              objective.status === 'failed' ? 'bg-gradient-to-r from-red-400 to-red-500' :
                              'bg-gradient-to-r from-purple-400 to-pink-400'
                            }`}
                            style={{ width: `${Math.min(100, progressPercentage)}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* Target and Current Value */}
                      <div className="bg-white rounded-lg p-3 border border-purple-200 mb-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-gray-700">🎯 Cible</span>
                          <span className="text-sm font-bold text-purple-700">
                            {objective.target_value?.toLocaleString('fr-FR')} {objective.unit || ''}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-gray-700">📊 Actuel</span>
                          <span className="text-sm font-bold text-blue-700">
                            {(objective.current_value || 0)?.toLocaleString('fr-FR')} {objective.unit || ''}
                          </span>
                        </div>
                      </div>

                      {/* Progress Update - Only for sellers with seller responsibility */}
                      {objective.data_entry_responsible === 'seller' && (
                        <div className="mt-3">
                          {updatingProgressObjectiveId === objective.id ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={progressValue}
                                onChange={(e) => setProgressValue(e.target.value)}
                                placeholder={`Nouvelle valeur (${objective.unit || ''})`}
                                className="flex-1 p-2 border-2 border-cyan-300 rounded-lg focus:border-cyan-500 focus:outline-none text-sm"
                                autoFocus
                              />
                              <button
                                onClick={() => handleUpdateProgress(objective.id)}
                                className="px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all font-semibold text-sm"
                              >
                                ✅
                              </button>
                              <button
                                onClick={() => {
                                  setUpdatingProgressObjectiveId(null);
                                  setProgressValue('');
                                }}
                                className="px-3 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-all text-sm"
                              >
                                ❌
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setUpdatingProgressObjectiveId(objective.id);
                                setProgressValue(objective.current_value?.toString() || '0');
                              }}
                              className="w-full px-3 py-2 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white rounded-lg hover:from-cyan-600 hover:to-cyan-700 transition-all font-semibold text-sm flex items-center justify-center gap-2"
                            >
                              📝 Mettre à jour ma progression
                            </button>
                          )}
                        </div>
                      )}
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
      
      {/* Achievement Modal */}
      <AchievementModal
        isOpen={achievementModal.isOpen}
        onClose={() => setAchievementModal({ isOpen: false, item: null, itemType: null })}
        item={achievementModal.item}
        itemType={achievementModal.itemType}
        onMarkAsSeen={handleMarkAchievementAsSeen}
        userRole="seller"
      />
    </div>
  );
}
