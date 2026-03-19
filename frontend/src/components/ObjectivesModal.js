import React, { useState, useEffect, useRef } from 'react';
import { X, Target, History, Filter } from 'lucide-react';
import { api } from '../lib/apiClient';
import { logger } from '../utils/logger';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import AchievementModal from './AchievementModal';

export default function ObjectivesModal({
  isOpen,
  onClose,
  activeObjectives: initialObjectives = [],
  onUpdate
}) {
  const isMountedRef = useRef(true);
  useEffect(() => () => { isMountedRef.current = false; }, []);

  // Local state for objectives
  const [activeObjectives, setActiveObjectives] = useState(initialObjectives);

  // Update local state when props change
  useEffect(() => {
    setActiveObjectives(initialObjectives);
  }, [initialObjectives]);

  // Always refresh data when modal opens to ensure latest updates are shown
  useEffect(() => {
    if (isOpen) refreshActiveData();
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps
  const [activeTab, setActiveTab] = useState('objectifs'); // 'objectifs' or 'historique'
  const [updatingObjectiveId, setUpdatingObjectiveId] = useState(null);
  const [objectiveProgressValue, setObjectiveProgressValue] = useState('');

  // Historique states
  const [historyObjectives, setHistoryObjectives] = useState([]);
  const [historyStatusFilter, setHistoryStatusFilter] = useState('all'); // 'all', 'achieved', 'not_achieved'
  
  // Achievement notification states
  const [achievementModal, setAchievementModal] = useState({
    isOpen: false,
    item: null,
    itemType: null
  });
  
  // Fetch history when tab changes to historique
  useEffect(() => {
    if (activeTab === 'historique' && isOpen) fetchHistory();
  }, [activeTab, isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchHistory = async () => {
    try {
      const objRes = await api.get('/seller/objectives/history');
      if (!isMountedRef.current) return;
      setHistoryObjectives(objRes.data);
    } catch (err) {
      if (!isMountedRef.current) return;
      logger.error('Error fetching history:', err);
      toast.error("Erreur lors du chargement de l'historique");
    }
  };

  const refreshActiveData = async () => {
    try {
      // Fetch active objectives
      const objRes = await api.get('/seller/objectives/active');
      const objectives = objRes.data || [];

      if (!isMountedRef.current) return;

      // Filter out achieved objectives from active list
      const activeOnly = objectives.filter(obj => obj.status !== 'achieved');

      setActiveObjectives(activeOnly);

      // Check for unseen achievements and show modal
      if (!achievementModal.isOpen) {
        const unseenObjective = activeOnly.find(obj => obj.has_unseen_achievement === true);
        if (unseenObjective) {
          setAchievementModal({
            isOpen: true,
            item: unseenObjective,
            itemType: 'objective'
          });
        }
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
      if (!isMountedRef.current) return;
      logger.error('Error refreshing data:', err);
    }
  };
  
  const handleMarkAchievementAsSeen = async () => {
    // Close modal and refresh data
    setAchievementModal({ isOpen: false, item: null, itemType: null });
    
    // Refresh data after marking as seen
    await refreshActiveData();
    
    if (activeTab === 'historique') {
      await fetchHistory();
    }
    
    if (onUpdate) {
      onUpdate();
    }
  };
  
  // 🎉 Petite pluie de confettis discrète pour chaque progression
  // Utilise un canvas global avec z-index maximum pour s'assurer qu'il est visible
  const triggerConfetti = () => {
    try {
      const confettiFn = confetti || globalThis.confetti;
      if (!confettiFn) return;
      
      // Configuration discrète pour les petites victoires
      confettiFn({
        particleCount: 30,
        spread: 50,
        origin: { y: 0.6 },
        colors: ['#ffd700', '#ff6b6b', '#4ecdc4'],
        zIndex: 99999
      });
      
      // Nettoyage automatique : canvas-confetti gère lui-même le nettoyage après animation
      // Les particules sont automatiquement supprimées du DOM après leur durée de vie
    } catch (error) {
      // Silently fail - confetti is not critical for functionality
    }
  };

  const handleUpdateProgress = async (objectiveId) => {
    try {
      const value = Number.parseFloat(objectiveProgressValue);
      if (isNaN(value) || value < 0) {
        toast.error('Veuillez entrer une valeur valide');
        return;
      }
      
      const response = await api.post(
        `/seller/objectives/${objectiveId}/progress`,
        { 
          value: value,
          mode: 'add'  // Add mode: adds to current_value instead of replacing it
        }
      );
      
      const updatedObjective = response.data;
      
      setUpdatingObjectiveId(null);
      setObjectiveProgressValue('');
      
      // 🎉 PETITE VICTOIRE : Confettis à chaque progression (même si objectif pas fini)
      triggerConfetti();
      toast.success('Progression mise à jour !', { duration: 2000 });
      
      // 🏆 GRANDE VICTOIRE : Modal uniquement quand just_achieved est true (passage à 100%)
      if (updatedObjective.just_achieved === true && updatedObjective.has_unseen_achievement === true) {
        setAchievementModal({
          isOpen: true,
          item: updatedObjective,
          itemType: 'objective'
        });
      }
      
      // Refresh data
      await refreshActiveData();
    } catch (error) {
      logger.error('Error updating progress:', error);
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
            <h2 className="text-2xl font-bold text-white">🎯 Mes Objectifs</h2>
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
                      );
                    })}
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


          {activeTab === 'historique' && (
            <div>
              {/* Bandeau fin "Historique" */}
              <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-8 py-3">
                <p className="text-sm">Consultez l'historique de vos objectifs terminés</p>
              </div>

              {/* Filtres */}
              <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-gray-600" />
                    <span className="text-sm font-semibold text-gray-700">Filtres :</span>
                  </div>

                  {/* Status filter */}
                  <div className="flex gap-2">
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
                  // Filter objectives by status
                  const items = historyObjectives.filter(obj => {
                    if (historyStatusFilter === 'all') return true;
                    if (historyStatusFilter === 'achieved') return obj.achieved;
                    if (historyStatusFilter === 'not_achieved') return !obj.achieved;
                    return true;
                  }).sort((a, b) => new Date(b.period_end || b.end_date) - new Date(a.period_end || a.end_date));

                  if (items.length === 0) {
                    return (
                      <div className="text-center py-12 text-gray-500">
                        <History className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                        <p className="text-lg font-semibold mb-2">Aucun élément dans l'historique</p>
                        <p className="text-sm">Les objectifs terminés apparaîtront ici</p>
                      </div>
                    );
                  }
                  
                  return (
                    <div className="space-y-3">
                      {items.map((item, index) => (
                        <div 
                          key={`${item.id}-${index}`}
                          className={`rounded-xl p-4 border-2 transition-all ${
                            item.achieved
                              ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200'
                              : 'bg-gradient-to-r from-red-50 to-orange-50 border-red-200'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Target className="w-4 h-4 text-blue-600" />
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
