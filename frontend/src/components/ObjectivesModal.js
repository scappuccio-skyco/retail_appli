import React, { useState, useEffect } from 'react';
import { X, Target, Trophy, History, Filter } from 'lucide-react';
import { api } from '../lib/apiClient';
import { logger } from '../utils/logger';
import { toast } from 'sonner';
import AchievementModal from './AchievementModal';

export default function ObjectivesModal({ 
  isOpen, 
  onClose,
  activeObjectives: initialObjectives = [],
  activeChallenges: initialChallenges = [],
  onUpdate
}) {
  // Local state for objectives and challenges
  const [activeObjectives, setActiveObjectives] = useState(initialObjectives);
  const [activeChallenges, setActiveChallenges] = useState(initialChallenges);
  
  // Update local state when props change
  useEffect(() => {
    setActiveObjectives(initialObjectives);
    setActiveChallenges(initialChallenges);
  }, [initialObjectives, initialChallenges]);
  
  // Always refresh data when modal opens to ensure latest updates are shown
  useEffect(() => {
    if (isOpen) {
      refreshActiveData();
    }
  }, [isOpen]);
  const [activeTab, setActiveTab] = useState('objectifs'); // 'objectifs', 'challenges', or 'historique'
  const [updatingObjectiveId, setUpdatingObjectiveId] = useState(null);
  const [objectiveProgressValue, setObjectiveProgressValue] = useState('');
  const [updatingChallengeId, setUpdatingChallengeId] = useState(null);
  const [challengeProgress, setChallengeProgress] = useState({
    ca: 0,
    ventes: 0,
    clients: 0
  });
  const [challengeCurrentValue, setChallengeCurrentValue] = useState('');
  
  // Historique states
  const [historyObjectives, setHistoryObjectives] = useState([]);
  const [historyChallenges, setHistoryChallenges] = useState([]);
  const [historyTypeFilter, setHistoryTypeFilter] = useState('all'); // 'all', 'objectifs', 'challenges'
  const [historyStatusFilter, setHistoryStatusFilter] = useState('all'); // 'all', 'achieved', 'not_achieved'
  
  // Achievement notification states
  const [achievementModal, setAchievementModal] = useState({
    isOpen: false,
    item: null,
    itemType: null
  });
  
  // Fetch history when tab changes to historique
  useEffect(() => {
    if (activeTab === 'historique' && isOpen) {
      fetchHistory();
    }
  }, [activeTab, isOpen]);

  // Refresh active data when modal opens or when isOpen changes
  useEffect(() => {
    if (isOpen) {
      // Always refresh data when modal opens to get latest updates
      refreshActiveData();
    }
  }, [isOpen]);
  
  const fetchHistory = async () => {
    try {
      // Fetch objectives history
      const objRes = await api.get('/seller/objectives/history');
      setHistoryObjectives(objRes.data);
      
      // Fetch challenges history
      const challRes = await api.get('/seller/challenges/history');
      setHistoryChallenges(challRes.data);
    } catch (err) {
      logger.error('Error fetching history:', err);
      toast.error('Erreur lors du chargement de l\'historique');
    }
  };
  
  const refreshActiveData = async () => {
    try {
      // Fetch active objectives
      const objRes = await api.get('/seller/objectives/active');
      const objectives = objRes.data || [];
      setActiveObjectives(objectives);
      
      // Fetch active challenges
      const challRes = await api.get('/seller/challenges/active');
      const challenges = challRes.data || [];
      setActiveChallenges(challenges);
      
      // Debug: log objectives to check flags
      console.log('🔍 [FRONTEND] Objectives received:', objectives.length);
      objectives.forEach(obj => {
        if (obj.status === 'achieved') {
          console.log(`🔍 [FRONTEND] Objective "${obj.title}": status=${obj.status}, has_unseen_achievement=${obj.has_unseen_achievement}`);
        }
      });
      
      // Check for unseen achievements and show modal
      const unseenObjective = objectives.find(obj => obj.has_unseen_achievement === true);
      const unseenChallenge = challenges.find(chall => chall.has_unseen_achievement === true);
      
      console.log('🔍 [FRONTEND] Unseen objective:', unseenObjective ? unseenObjective.title : 'none');
      console.log('🔍 [FRONTEND] Unseen challenge:', unseenChallenge ? unseenChallenge.title : 'none');
      
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
      
      // Also refresh history if we're on the history tab
      if (activeTab === 'historique') {
        await fetchHistory();
      }
      
      // Also call parent's onUpdate if provided
      if (onUpdate) {
        onUpdate();
      }
    } catch (err) {
      logger.error('Error refreshing data:', err);
    }
  };
  
  const handleMarkAchievementAsSeen = async () => {
    // Refresh data after marking as seen
    await refreshActiveData();
    // Also refresh history to show the objective there
    if (activeTab === 'historique') {
      await fetchHistory();
    }
    if (activeTab === 'historique') {
      await fetchHistory();
    }
  };
  
  const handleUpdateProgress = async (objectiveId) => {
    try {
      const value = parseFloat(objectiveProgressValue);
      if (isNaN(value) || value < 0) {
        toast.error('Veuillez entrer une valeur valide');
        return;
      }
      
      const response = await api.post(
        `/seller/objectives/${objectiveId}/progress`,
        { value: value }
      );
      
      const updatedObjective = response.data;
      
      setUpdatingObjectiveId(null);
      setObjectiveProgressValue('');
      
      // Check if objective just became "achieved" and has unseen achievement
      if (updatedObjective.status === 'achieved' && updatedObjective.has_unseen_achievement === true) {
        console.log('🎉 [PROGRESS UPDATE] Objective just achieved! Showing modal...');
        // Show achievement modal immediately (before refreshing)
        setAchievementModal({
          isOpen: true,
          item: updatedObjective,
          itemType: 'objective'
        });
        toast.success('🎉 Objectif atteint !');
      } else if (updatedObjective.status === 'achieved') {
        // Already seen, just show toast
        toast.success('🎉 Félicitations ! Objectif atteint !', { 
          duration: 5000,
          style: {
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: 'white',
            fontSize: '16px',
            fontWeight: 'bold',
            padding: '16px',
          }
        });
      } else {
        toast.success('Progression mise à jour !');
      }
      
      // Rafraîchir les données sans recharger la page
      await refreshActiveData();
    } catch (error) {
      logger.error('Error updating progress:', error);
      toast.error(error.response?.data?.detail || 'Erreur lors de la mise à jour');
    }
  };

  const handleUpdateChallengeProgress = async (challengeId, challengeType) => {
    try {
      // Pour les challenges de type kpi_standard, envoyer value (increment)
      if (challengeType === 'kpi_standard') {
        const value = parseFloat(challengeCurrentValue);
        if (isNaN(value) || value < 0) {
          toast.error('Veuillez entrer une valeur valide');
          return;
        }
        
        await api.post(
          `/seller/challenges/${challengeId}/progress`,
          { value: value }
        );
      } else {
        // Pour les autres challenges, envoyer value comme increment
        // Note: Pour les challenges multi-KPI, on peut envoyer une valeur globale
        const totalValue = challengeProgress.ca + challengeProgress.ventes + challengeProgress.clients;
        if (totalValue <= 0) {
          toast.error('Veuillez entrer au moins une valeur');
          return;
        }
        
        await api.post(
          `/seller/challenges/${challengeId}/progress`,
          { value: totalValue }
        );
      }
      
      // Check if challenge is now achieved
      const updatedChallenge = await api.get('/seller/challenges/active');
      const chall = updatedChallenge.data?.find(c => c.id === challengeId);
      const isNowAchieved = chall && (chall.status === 'achieved' || (chall.current_value >= chall.target_value && chall.target_value > 0));
      
      setUpdatingChallengeId(null);
      setChallengeProgress({ ca: 0, ventes: 0, clients: 0 });
      setChallengeCurrentValue('');
      
      // Rafraîchir les données sans recharger la page
      await refreshActiveData();
      
      // Show celebration after data refresh
      if (isNowAchieved) {
        setTimeout(() => {
          toast.success('🎉 Félicitations ! Challenge réussi !', { 
            duration: 5000,
            style: {
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: 'white',
              fontSize: '16px',
              fontWeight: 'bold',
              padding: '16px',
            }
          });
        }, 300);
      } else {
        toast.success('Progression du challenge mise à jour !');
      }
    } catch (error) {
      logger.error('Error updating challenge progress:', error);
      toast.error(error.response?.data?.detail || 'Erreur lors de la mise à jour');
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <style>{`
        @keyframes celebrate {
          0%, 100% { transform: scale(1) rotate(0deg); }
          25% { transform: scale(1.1) rotate(-5deg); }
          50% { transform: scale(1.15) rotate(5deg); }
          75% { transform: scale(1.1) rotate(-3deg); }
        }
        @keyframes confetti {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(-100px) rotate(360deg); opacity: 0; }
        }
        .celebrate-animation {
          animation: celebrate 0.6s ease-in-out infinite;
        }
        .confetti {
          position: absolute;
          width: 10px;
          height: 10px;
          background: #10b981;
          animation: confetti 2s ease-out forwards;
        }
      `}</style>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-900 via-teal-800 to-green-800 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white">🎯 Objectifs et Challenges</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-full transition-colors"
            >
              <X className="w-6 h-6 text-white" />
            </button>
          </div>
        </div>

        {/* Onglets */}
        <div className="border-b border-gray-200 bg-gray-50 pt-2">
          <div className="flex gap-0.5 px-2 md:px-6">
            <button
              onClick={() => setActiveTab('objectifs')}
              className={`px-2 md:px-4 py-2 text-xs md:text-sm font-semibold transition-all rounded-t-lg ${
                activeTab === 'objectifs'
                  ? 'bg-blue-300 text-gray-800 shadow-md border-b-4 border-blue-500'
                  : 'text-gray-600 hover:text-blue-600 hover:bg-gray-100'
              }`}
            >
              <div className="flex items-center justify-center gap-1">
                <Target className="w-4 h-4" />
                <span>Objectifs ({activeObjectives.length})</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('challenges')}
              className={`px-2 md:px-4 py-2 text-xs md:text-sm font-semibold transition-all rounded-t-lg ${
                activeTab === 'challenges'
                  ? 'bg-green-300 text-gray-800 shadow-md border-b-4 border-green-500'
                  : 'text-gray-600 hover:text-green-600 hover:bg-gray-100'
              }`}
            >
              <div className="flex items-center justify-center gap-1">
                <Trophy className="w-4 h-4" />
                <span>Challenges ({activeChallenges.length})</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('historique')}
              className={`px-2 md:px-4 py-2 text-xs md:text-sm font-semibold transition-all rounded-t-lg ${
                activeTab === 'historique'
                  ? 'bg-purple-300 text-gray-800 shadow-md border-b-4 border-purple-500'
                  : 'text-gray-600 hover:text-purple-600 hover:bg-gray-100'
              }`}
            >
              <div className="flex items-center justify-center gap-1">
                <History className="w-4 h-4" />
                <span className="hidden sm:inline">Historique</span>
                <span className="sm:hidden">Hist.</span>
              </div>
            </button>
          </div>
        </div>

        {/* Contenu du modal selon l'onglet actif */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'objectifs' && (
            <div>
              {/* Bandeau fin "Mes Objectifs" */}
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-8 py-3">
                <p className="text-sm">Suivez vos objectifs et progressez vers vos cibles</p>
              </div>

              {/* Contenu avec padding */}
              <div className="px-6 py-6">
                {activeObjectives.length > 0 ? (
                  <div className="space-y-4">
                    {activeObjectives.map((objective, index) => {
                      const isAchieved = objective.status === 'achieved' || (objective.current_value >= objective.target_value && objective.target_value > 0);
                      const isCompleted = objective.status === 'completed' || new Date(objective.period_end) < new Date();
                      
                      return (
                      <div 
                        key={`${objective.id}-${index}`}
                        className={`rounded-xl p-4 border-2 transition-all relative overflow-hidden ${
                          isAchieved 
                            ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-400 hover:border-green-500 shadow-lg' 
                            : isCompleted
                            ? 'bg-gradient-to-r from-gray-50 to-slate-50 border-gray-300'
                            : 'bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200 hover:border-purple-300'
                        }`}
                      >
                        {isAchieved && (
                          <div className="absolute inset-0 pointer-events-none">
                            <div className="absolute top-2 right-2 text-4xl animate-bounce">🎉</div>
                            <div className="absolute top-8 right-8 text-3xl animate-pulse">✨</div>
                            <div className="absolute bottom-4 left-4 text-3xl animate-bounce" style={{ animationDelay: '0.2s' }}>🌟</div>
                            <div className="absolute bottom-8 right-12 text-2xl animate-pulse" style={{ animationDelay: '0.4s' }}>💫</div>
                          </div>
                        )}
                        <div className="flex items-start justify-between mb-3 relative z-10">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <h4 className="font-bold text-gray-800">{objective.title || objective.name}</h4>
                              {isAchieved && (
                                <span className="inline-flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-full text-xs font-bold shadow-md celebrate-animation">
                                  🎉 Réussi !
                                </span>
                              )}
                              {isCompleted && !isAchieved && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-500 text-white rounded-full text-xs font-semibold">
                                  ✓ Terminé
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600">{objective.description}</p>
                          </div>
                          <div className="ml-4 flex flex-col gap-2">
                            <span className="px-3 py-1 bg-purple-600 text-white rounded-full text-xs font-semibold">
                              {objective.type || 'Standard'}
                            </span>
                            {isAchieved && (
                              <div className="text-center">
                                <div className="text-3xl celebrate-animation">🏆</div>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Informations détaillées */}
                        <div className="bg-white rounded-lg p-3 mb-3 space-y-2">
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <p className="text-xs font-semibold text-gray-500 mb-1">📅 Période</p>
                              <p className="text-gray-800">
                                {new Date(objective.period_start).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })} - {new Date(objective.period_end).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-gray-500 mb-1">🎯 Type</p>
                              {objective.objective_type === 'kpi_standard' && (
                                <p className="text-gray-800 capitalize">
                                  {objective.kpi_name === 'ca' ? '💰 Chiffre d\'affaires' :
                                   objective.kpi_name === 'ventes' ? '🛍️ Nombre de ventes' :
                                   objective.kpi_name === 'articles' ? '📦 Nombre d\'articles' :
                                   objective.kpi_name || 'N/A'}
                                </p>
                              )}
                              {objective.objective_type === 'product_focus' && (
                                <p className="text-gray-800">📦 Focus Produit</p>
                              )}
                              {objective.objective_type === 'custom' && (
                                <p className="text-gray-800">✨ Personnalisé</p>
                              )}
                            </div>
                          </div>
                          
                          {/* Afficher les détails du produit pour product_focus */}
                          {objective.objective_type === 'product_focus' && objective.product_name && (
                            <div className="pt-2 border-t border-gray-200">
                              <p className="text-xs font-semibold text-gray-500 mb-1">📦 Produit ciblé</p>
                              <p className="text-gray-800 font-semibold">{objective.product_name}</p>
                              {objective.target_value && (
                                <p className="text-xs text-gray-600 mt-1">
                                  Objectif : {objective.target_value} {objective.unit || ''}
                                </p>
                              )}
                            </div>
                          )}
                          
                          {/* Afficher la description pour custom */}
                          {objective.objective_type === 'custom' && objective.custom_description && (
                            <div className="pt-2 border-t border-gray-200">
                              <p className="text-xs font-semibold text-gray-500 mb-1">✨ Description</p>
                              <p className="text-xs text-gray-700">{objective.custom_description}</p>
                            </div>
                          )}
                        </div>
                        
                        {/* Barre de progression */}
                        {objective.target_value && (
                          <div className="mt-3 relative z-10">
                            <div className="flex justify-between text-xs text-gray-600 mb-1">
                              <span>Progression</span>
                              <span className={`font-semibold ${isAchieved ? 'text-green-600 font-bold' : ''}`}>
                                {objective.current_value || 0} / {objective.target_value} {objective.unit || ''}
                                {isAchieved && ' 🎯'}
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-3 relative overflow-hidden">
                              <div 
                                className={`h-3 rounded-full transition-all duration-500 ${
                                  isAchieved 
                                    ? 'bg-gradient-to-r from-green-500 via-emerald-500 to-green-600 animate-pulse' 
                                    : 'bg-gradient-to-r from-purple-600 to-pink-600'
                                }`}
                                style={{ width: `${Math.min(((objective.current_value || 0) / objective.target_value) * 100, 100)}%` }}
                              >
                                {isAchieved && (
                                  <div className="absolute inset-0 bg-white opacity-30 animate-ping"></div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Historique des progressions */}
                        {objective.progress_history && objective.progress_history.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-purple-200">
                            <details className="group">
                              <summary className="cursor-pointer text-xs font-semibold text-purple-600 hover:text-purple-700 flex items-center gap-1">
                                📊 Historique des progressions ({objective.progress_history.length})
                                <span className="text-xs">▼</span>
                              </summary>
                              <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                                {[...objective.progress_history].reverse().map((entry, idx) => (
                                  <div key={idx} className="flex items-center justify-between text-xs bg-purple-50 rounded px-2 py-1">
                                    <span className="text-gray-600">
                                      {new Date(entry.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                    <span className="font-semibold text-purple-700">
                                      {entry.value} {objective.unit || ''}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </details>
                          </div>
                        )}
                        
                        {/* Bouton de mise à jour pour vendeur */}
                        {objective.data_entry_responsible === 'seller' && (
                          <div className="mt-3">
                            {updatingObjectiveId === objective.id ? (
                              <div className="bg-white rounded-lg p-3 border-2 border-cyan-300">
                                <p className="text-sm font-semibold text-gray-700 mb-2">Mettre à jour ma progression :</p>
                                <div className="flex gap-1.5">
                                  <input
                                    type="number"
                                    value={objectiveProgressValue}
                                    onChange={(e) => setObjectiveProgressValue(e.target.value)}
                                    placeholder="Nouvelle valeur"
                                    className="flex-1 p-2 border-2 border-purple-300 rounded-lg focus:border-purple-500 focus:outline-none text-sm min-w-0"
                                  />
                                  <button
                                    onClick={() => handleUpdateProgress(objective.id)}
                                    className="px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all font-semibold flex-shrink-0"
                                    title="Valider"
                                  >
                                    ✅
                                  </button>
                                  <button
                                    onClick={() => {
                                      setUpdatingObjectiveId(null);
                                      setObjectiveProgressValue('');
                                    }}
                                    className="px-3 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-all flex-shrink-0"
                                    title="Annuler"
                                  >
                                    ❌
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => {
                                  setUpdatingObjectiveId(objective.id);
                                  // Clear value for fresh entry (incremental UX)
                                  setObjectiveProgressValue('');
                                }}
                                className="w-full px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg hover:from-cyan-600 hover:to-blue-600 transition-all font-semibold flex items-center justify-center gap-2"
                              >
                                📝 Mettre à jour ma progression
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <Target className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                    <p className="text-lg font-semibold mb-2">Aucun objectif actif</p>
                    <p className="text-sm">Vos objectifs apparaîtront ici une fois créés</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'challenges' && (
            <div>
              {/* Bandeau fin "Mes Challenges" */}
              <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-8 py-3">
                <p className="text-sm">Relevez vos défis et dépassez-vous chaque jour</p>
              </div>

              {/* Contenu avec padding */}
              <div className="px-6 py-6">
                {activeChallenges.length > 0 ? (
                  <div className="space-y-4">
                    {activeChallenges.map((challenge, index) => {
                      const isAchieved = challenge.status === 'achieved' || (challenge.current_value >= challenge.target_value && challenge.target_value > 0);
                      const isCompleted = challenge.status === 'completed' || new Date(challenge.end_date) < new Date();
                      
                      return (
                      <div 
                        key={index}
                        className={`rounded-xl p-4 border-2 transition-all ${
                          isAchieved 
                            ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-300 hover:border-green-400 animate-pulse' 
                            : isCompleted
                            ? 'bg-gradient-to-r from-gray-50 to-slate-50 border-gray-300'
                            : 'bg-gradient-to-r from-pink-50 to-orange-50 border-pink-200 hover:border-pink-300'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-bold text-gray-800">{challenge.title || challenge.name}</h4>
                              {isAchieved && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-500 text-white rounded-full text-xs font-bold animate-bounce">
                                  🎉 Réussi !
                                </span>
                              )}
                              {isCompleted && !isAchieved && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-500 text-white rounded-full text-xs font-semibold">
                                  ✓ Terminé
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600">{challenge.description}</p>
                          </div>
                          <div className="ml-4 flex flex-col gap-2">
                            <span className="px-3 py-1 bg-pink-600 text-white rounded-full text-xs font-semibold">
                              {challenge.type || 'Challenge'}
                            </span>
                            {isAchieved && (
                              <div className="text-center">
                                <div className="text-2xl animate-spin">🎊</div>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Informations détaillées */}
                        <div className="bg-white rounded-lg p-3 mb-3 space-y-2">
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <p className="text-xs font-semibold text-gray-500 mb-1">📅 Période</p>
                              <p className="text-gray-800">
                                {new Date(challenge.start_date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })} - {new Date(challenge.end_date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-gray-500 mb-1">🎯 Type</p>
                              {challenge.challenge_type === 'kpi_standard' && (
                                <p className="text-gray-800 capitalize">
                                  {challenge.kpi_name === 'ca' ? '💰 Chiffre d\'affaires' :
                                   challenge.kpi_name === 'ventes' ? '🛍️ Nombre de ventes' :
                                   challenge.kpi_name === 'articles' ? '📦 Nombre d\'articles' :
                                   challenge.kpi_name || 'N/A'}
                                </p>
                              )}
                              {challenge.challenge_type === 'product_focus' && (
                                <p className="text-gray-800">📦 Focus Produit</p>
                              )}
                              {challenge.challenge_type === 'custom' && (
                                <p className="text-gray-800">✨ Personnalisé</p>
                              )}
                            </div>
                          </div>
                          
                          {/* Afficher les détails du produit pour product_focus */}
                          {challenge.challenge_type === 'product_focus' && challenge.product_name && (
                            <div className="pt-2 border-t border-gray-200">
                              <p className="text-xs font-semibold text-gray-500 mb-1">📦 Produit ciblé</p>
                              <p className="text-gray-800 font-semibold">{challenge.product_name}</p>
                              {challenge.target_value && (
                                <p className="text-xs text-gray-600 mt-1">
                                  Objectif : {challenge.target_value} {challenge.unit || ''}
                                </p>
                              )}
                            </div>
                          )}
                          
                          {/* Afficher la description pour custom */}
                          {challenge.challenge_type === 'custom' && challenge.custom_description && (
                            <div className="pt-2 border-t border-gray-200">
                              <p className="text-xs font-semibold text-gray-500 mb-1">✨ Description</p>
                              <p className="text-xs text-gray-700">{challenge.custom_description}</p>
                            </div>
                          )}
                          
                          {/* Progression actuelle pour kpi_standard */}
                          {challenge.challenge_type === 'kpi_standard' && challenge.target_value && (
                            <div className="pt-2 border-t border-gray-200">
                              <div className="flex justify-between text-xs text-gray-600 mb-1">
                                <span>Progression</span>
                                <span className="font-semibold">{challenge.current_value || 0} / {challenge.target_value} {challenge.unit || ''}</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div 
                                  className="bg-gradient-to-r from-pink-600 to-orange-600 h-2 rounded-full transition-all"
                                  style={{ width: `${Math.min(((challenge.current_value || 0) / challenge.target_value) * 100, 100)}%` }}
                                ></div>
                              </div>
                            </div>
                          )}

                          {/* Historique des progressions pour challenges */}
                          {challenge.progress_history && challenge.progress_history.length > 0 && (
                            <div className="pt-2 border-t border-gray-200 mt-2">
                              <details className="group">
                                <summary className="cursor-pointer text-xs font-semibold text-pink-600 hover:text-pink-700 flex items-center gap-1">
                                  📊 Historique des progressions ({challenge.progress_history.length})
                                  <span className="text-xs">▼</span>
                                </summary>
                                <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                                  {[...challenge.progress_history].reverse().map((entry, idx) => (
                                    <div key={idx} className="flex items-center justify-between text-xs bg-pink-50 rounded px-2 py-1">
                                      <span className="text-gray-600">
                                        {new Date(entry.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                      <span className="font-semibold text-pink-700">
                                        {entry.value} {challenge.unit || ''}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </details>
                            </div>
                          )}
                        </div>
                        
                        {/* Récompense ou statut */}
                        {challenge.reward && (
                          <div className="mt-2 flex items-center text-sm text-orange-600">
                            <Trophy className="w-4 h-4 mr-1" />
                            <span>Récompense : {challenge.reward}</span>
                          </div>
                        )}
                        
                        {/* Bouton de mise à jour pour vendeur */}
                        {challenge.data_entry_responsible === 'seller' && (
                          <div className="mt-3">
                            {updatingChallengeId === challenge.id ? (
                              <div className="bg-white rounded-lg p-3 border-2 border-pink-300">
                                <p className="text-sm font-semibold text-gray-700 mb-2">Mettre à jour ma progression :</p>
                                
                                {/* Challenge de type kpi_standard */}
                                {challenge.challenge_type === 'kpi_standard' ? (
                                  <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        placeholder={`Nouvelle valeur (${challenge.unit || ''})`}
                                        value={challengeCurrentValue}
                                        onChange={(e) => setChallengeCurrentValue(e.target.value)}
                                        className="flex-1 p-2 border-2 border-purple-300 rounded-lg focus:border-purple-500 focus:outline-none text-sm"
                                      />
                                      {challenge.unit && (
                                        <span className="text-xs text-gray-500">{challenge.unit}</span>
                                      )}
                                    </div>
                                    {challenge.target_value && (
                                      <p className="text-xs text-gray-500">
                                        Objectif : {challenge.target_value} {challenge.unit || ''}
                                      </p>
                                    )}
                                  </div>
                                ) : (
                                  /* Challenge avec targets multiples */
                                  <div className="space-y-2">
                                    {challenge.ca_target && challenge.ca_target > 0 && (
                                      <div className="flex items-center gap-2">
                                        <label className="text-xs text-gray-600 w-24">💰 CA :</label>
                                        <input
                                          type="number"
                                          step="0.01"
                                          min="0"
                                          placeholder="Valeur en €"
                                          value={challengeProgress.ca}
                                          onChange={(e) => {
                                            const val = parseFloat(e.target.value) || 0;
                                            setChallengeProgress(prev => ({ ...prev, ca: val }));
                                          }}
                                          className="flex-1 p-2 border-2 border-purple-300 rounded-lg focus:border-purple-500 focus:outline-none text-sm"
                                        />
                                        <span className="text-xs text-gray-500">€</span>
                                      </div>
                                    )}
                                    {challenge.ventes_target && challenge.ventes_target > 0 && (
                                      <div className="flex items-center gap-2">
                                        <label className="text-xs text-gray-600 w-24">📈 Ventes :</label>
                                        <input
                                          type="number"
                                          min="0"
                                          placeholder="Nombre"
                                          value={challengeProgress.ventes}
                                          onChange={(e) => {
                                            const val = parseInt(e.target.value) || 0;
                                            setChallengeProgress(prev => ({ ...prev, ventes: val }));
                                          }}
                                          className="flex-1 p-2 border-2 border-purple-300 rounded-lg focus:border-purple-500 focus:outline-none text-sm"
                                        />
                                      </div>
                                    )}
                                    {challenge.clients_target && challenge.clients_target > 0 && (
                                      <div className="flex items-center gap-2">
                                        <label className="text-xs text-gray-600 w-24">👥 Clients :</label>
                                        <input
                                          type="number"
                                          min="0"
                                          placeholder="Nombre"
                                          value={challengeProgress.clients}
                                          onChange={(e) => {
                                            const val = parseInt(e.target.value) || 0;
                                            setChallengeProgress(prev => ({ ...prev, clients: val }));
                                          }}
                                          className="flex-1 p-2 border-2 border-purple-300 rounded-lg focus:border-purple-500 focus:outline-none text-sm"
                                        />
                                      </div>
                                    )}
                                  </div>
                                )}
                                
                                <div className="flex gap-1.5 mt-3">
                                  <button
                                    onClick={() => handleUpdateChallengeProgress(challenge.id, challenge.challenge_type)}
                                    className="flex-1 px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all font-semibold text-sm"
                                    title="Valider"
                                  >
                                    ✅ Valider
                                  </button>
                                  <button
                                    onClick={() => {
                                      setUpdatingChallengeId(null);
                                      setChallengeProgress({ ca: 0, ventes: 0, clients: 0 });
                                      setChallengeCurrentValue('');
                                    }}
                                    className="px-3 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-all text-sm flex-shrink-0"
                                    title="Annuler"
                                  >
                                    ❌
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => {
                                  setUpdatingChallengeId(challenge.id);
                                  // Clear values for fresh entry (incremental UX)
                                  if (challenge.challenge_type === 'kpi_standard') {
                                    setChallengeCurrentValue('');
                                  } else {
                                    setChallengeProgress({
                                      ca: 0,
                                      ventes: 0,
                                      clients: 0
                                    });
                                  }
                                }}
                                className="w-full px-4 py-2 bg-gradient-to-r from-pink-500 to-orange-500 text-white rounded-lg hover:from-pink-600 hover:to-orange-600 transition-all font-semibold flex items-center justify-center gap-2"
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
                  <div className="text-center py-12 text-gray-500">
                    <Trophy className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                    <p className="text-lg font-semibold mb-2">Aucun challenge actif</p>
                    <p className="text-sm">Vos challenges apparaîtront ici une fois créés</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'historique' && (
            <div>
              {/* Bandeau fin "Historique" */}
              <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-8 py-3">
                <p className="text-sm">Consultez l'historique de vos objectifs et challenges terminés</p>
              </div>

              {/* Filtres */}
              <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-gray-600" />
                    <span className="text-sm font-semibold text-gray-700">Filtres :</span>
                  </div>
                  
                  {/* Type filter */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setHistoryTypeFilter('all')}
                      className={`px-3 py-1.5 text-sm rounded-lg transition-all ${
                        historyTypeFilter === 'all'
                          ? 'bg-purple-600 text-white shadow-md'
                          : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
                      }`}
                    >
                      Tous
                    </button>
                    <button
                      onClick={() => setHistoryTypeFilter('objectifs')}
                      className={`px-3 py-1.5 text-sm rounded-lg transition-all flex items-center gap-1 ${
                        historyTypeFilter === 'objectifs'
                          ? 'bg-blue-600 text-white shadow-md'
                          : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
                      }`}
                    >
                      <Target className="w-4 h-4" />
                      Objectifs
                    </button>
                    <button
                      onClick={() => setHistoryTypeFilter('challenges')}
                      className={`px-3 py-1.5 text-sm rounded-lg transition-all flex items-center gap-1 ${
                        historyTypeFilter === 'challenges'
                          ? 'bg-green-600 text-white shadow-md'
                          : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
                      }`}
                    >
                      <Trophy className="w-4 h-4" />
                      Challenges
                    </button>
                  </div>

                  {/* Status filter */}
                  <div className="flex gap-2 ml-auto">
                    <button
                      onClick={() => setHistoryStatusFilter('all')}
                      className={`px-3 py-1.5 text-sm rounded-lg transition-all ${
                        historyStatusFilter === 'all'
                          ? 'bg-purple-600 text-white shadow-md'
                          : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
                      }`}
                    >
                      Tous les statuts
                    </button>
                    <button
                      onClick={() => setHistoryStatusFilter('achieved')}
                      className={`px-3 py-1.5 text-sm rounded-lg transition-all ${
                        historyStatusFilter === 'achieved'
                          ? 'bg-green-600 text-white shadow-md'
                          : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
                      }`}
                    >
                      ✅ Atteints
                    </button>
                    <button
                      onClick={() => setHistoryStatusFilter('not_achieved')}
                      className={`px-3 py-1.5 text-sm rounded-lg transition-all ${
                        historyStatusFilter === 'not_achieved'
                          ? 'bg-red-600 text-white shadow-md'
                          : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
                      }`}
                    >
                      ❌ Non atteints
                    </button>
                  </div>
                </div>
              </div>

              {/* Contenu historique */}
              <div className="px-6 py-6 overflow-y-auto max-h-[60vh]">
                {(() => {
                  // Combine and filter objectives and challenges
                  let items = [];
                  
                  // Add objectives with type marker
                  if (historyTypeFilter === 'all' || historyTypeFilter === 'objectifs') {
                    items = items.concat(
                      historyObjectives
                        .filter(obj => {
                          if (historyStatusFilter === 'all') return true;
                          if (historyStatusFilter === 'achieved') return obj.achieved;
                          if (historyStatusFilter === 'not_achieved') return !obj.achieved;
                          return true;
                        })
                        .map(obj => ({ ...obj, itemType: 'objectif' }))
                    );
                  }
                  
                  // Add challenges with type marker
                  if (historyTypeFilter === 'all' || historyTypeFilter === 'challenges') {
                    items = items.concat(
                      historyChallenges
                        .filter(chall => {
                          if (historyStatusFilter === 'all') return true;
                          if (historyStatusFilter === 'achieved') return chall.achieved;
                          if (historyStatusFilter === 'not_achieved') return !chall.achieved;
                          return true;
                        })
                        .map(chall => ({ ...chall, itemType: 'challenge' }))
                    );
                  }
                  
                  // Sort by end date (most recent first)
                  items.sort((a, b) => {
                    const dateA = new Date(a.period_end || a.end_date);
                    const dateB = new Date(b.period_end || b.end_date);
                    return dateB - dateA;
                  });
                  
                  if (items.length === 0) {
                    return (
                      <div className="text-center py-12 text-gray-500">
                        <History className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                        <p className="text-lg font-semibold mb-2">Aucun élément dans l'historique</p>
                        <p className="text-sm">Les objectifs et challenges terminés apparaîtront ici</p>
                      </div>
                    );
                  }
                  
                  return (
                    <div className="space-y-3">
                      {items.map((item, index) => (
                        <div 
                          key={`${item.itemType}-${item.id}-${index}`}
                          className={`rounded-xl p-4 border-2 transition-all ${
                            item.achieved
                              ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200'
                              : 'bg-gradient-to-r from-red-50 to-orange-50 border-red-200'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                {item.itemType === 'objectif' ? (
                                  <Target className="w-4 h-4 text-blue-600" />
                                ) : (
                                  <Trophy className="w-4 h-4 text-green-600" />
                                )}
                                <h4 className="font-bold text-gray-800">{item.title || item.name}</h4>
                              </div>
                              <p className="text-sm text-gray-600">{item.description}</p>
                            </div>
                            <div className="ml-4 flex flex-col items-end gap-2">
                              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                item.achieved
                                  ? 'bg-green-600 text-white'
                                  : 'bg-red-600 text-white'
                              }`}>
                                {item.achieved ? '✅ Atteint' : '❌ Non atteint'}
                              </span>
                              <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                                {item.type || 'Standard'}
                              </span>
                            </div>
                          </div>
                          
                          {/* Progress info */}
                          <div className="mt-3 pt-3 border-t border-gray-200">
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <span className="text-gray-600">Période :</span>
                                <p className="font-semibold text-gray-800">
                                  {new Date(item.period_start || item.start_date).toLocaleDateString('fr-FR')} - {new Date(item.period_end || item.end_date).toLocaleDateString('fr-FR')}
                                </p>
                              </div>
                              <div>
                                <span className="text-gray-600">Progression :</span>
                                <p className="font-semibold text-gray-800">
                                  {item.current_value || 0} / {item.target_value || 0} {item.unit || ''}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
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
    </>
  );
}
