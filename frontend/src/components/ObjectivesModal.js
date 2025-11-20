import React, { useState, useEffect } from 'react';
import { X, Target, Trophy, History, Filter } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL || '';

export default function ObjectivesModal({ 
  isOpen, 
  onClose,
  activeObjectives = [],
  activeChallenges = []
}) {
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
  
  // Fetch history when tab changes to historique
  useEffect(() => {
    if (activeTab === 'historique' && isOpen) {
      fetchHistory();
    }
  }, [activeTab, isOpen]);
  
  const fetchHistory = async () => {
    try {
      const token = localStorage.getItem('token');
      
      // Fetch objectives history
      const objRes = await axios.get(`${API}/api/seller/objectives/history`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setHistoryObjectives(objRes.data);
      
      // Fetch challenges history
      const challRes = await axios.get(`${API}/api/seller/challenges/history`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setHistoryChallenges(challRes.data);
    } catch (err) {
      console.error('Error fetching history:', err);
      toast.error('Erreur lors du chargement de l\'historique');
    }
  };
  
  const handleUpdateProgress = async (objectiveId) => {
    try {
      const value = parseFloat(objectiveProgressValue);
      if (isNaN(value) || value < 0) {
        toast.error('Veuillez entrer une valeur valide');
        return;
      }
      
      const token = localStorage.getItem('token');
      await axios.post(
        `${API}/api/manager/objectives/${objectiveId}/progress`,
        { current_value: value },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success('Progression mise à jour !');
      setUpdatingObjectiveId(null);
      setObjectiveProgressValue('');
      
      // Rafraîchir la page pour voir les changements
      window.location.reload();
    } catch (error) {
      console.error('Error updating progress:', error);
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const handleUpdateChallengeProgress = async (challengeId, challengeType) => {
    try {
      const token = localStorage.getItem('token');
      
      // Pour les challenges de type kpi_standard, envoyer current_value
      if (challengeType === 'kpi_standard') {
        const value = parseFloat(challengeCurrentValue);
        if (isNaN(value) || value < 0) {
          toast.error('Veuillez entrer une valeur valide');
          return;
        }
        
        await axios.post(
          `${API}/api/manager/challenges/${challengeId}/progress`,
          { current_value: value },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      } else {
        // Pour les autres challenges, envoyer progress_ca, progress_ventes, etc.
        await axios.post(
          `${API}/api/manager/challenges/${challengeId}/progress`,
          {
            progress_ca: challengeProgress.ca,
            progress_ventes: challengeProgress.ventes,
            progress_clients: challengeProgress.clients
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }
      
      toast.success('Progression du challenge mise à jour !');
      setUpdatingChallengeId(null);
      setChallengeProgress({ ca: 0, ventes: 0, clients: 0 });
      setChallengeCurrentValue('');
      
      // Rafraîchir la page pour voir les changements
      window.location.reload();
    } catch (error) {
      console.error('Error updating challenge progress:', error);
      toast.error('Erreur lors de la mise à jour');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4">
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
          <div className="flex gap-1 px-6">
            <button
              onClick={() => setActiveTab('objectifs')}
              className={`px-6 py-3 font-semibold transition-all rounded-t-lg ${
                activeTab === 'objectifs'
                  ? 'bg-blue-300 text-gray-800 shadow-md border-b-4 border-blue-500'
                  : 'text-gray-600 hover:text-blue-600 hover:bg-gray-100'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <Target className="w-5 h-5" />
                <span>Mes Objectifs ({activeObjectives.length})</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('challenges')}
              className={`px-6 py-3 font-semibold transition-all rounded-t-lg ${
                activeTab === 'challenges'
                  ? 'bg-green-300 text-gray-800 shadow-md border-b-4 border-green-500'
                  : 'text-gray-600 hover:text-green-600 hover:bg-gray-100'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <Trophy className="w-5 h-5" />
                <span>Mes Challenges ({activeChallenges.length})</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('historique')}
              className={`px-6 py-3 font-semibold transition-all rounded-t-lg ${
                activeTab === 'historique'
                  ? 'bg-purple-300 text-gray-800 shadow-md border-b-4 border-purple-500'
                  : 'text-gray-600 hover:text-purple-600 hover:bg-gray-100'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <History className="w-5 h-5" />
                <span>Historique</span>
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
                    {activeObjectives.map((objective, index) => (
                      <div 
                        key={index}
                        className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 border-2 border-purple-200 hover:border-purple-300 transition-all"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <h4 className="font-bold text-gray-800 mb-1">{objective.title || objective.name}</h4>
                            <p className="text-sm text-gray-600">{objective.description}</p>
                          </div>
                          <div className="ml-4">
                            <span className="px-3 py-1 bg-purple-600 text-white rounded-full text-xs font-semibold">
                              {objective.type || 'Standard'}
                            </span>
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
                              <p className="text-xs font-semibold text-gray-500 mb-1">🎯 KPI</p>
                              <p className="text-gray-800 capitalize">{objective.kpi_name || 'N/A'}</p>
                            </div>
                          </div>
                        </div>
                        
                        {/* Barre de progression */}
                        {objective.target_value && (
                          <div className="mt-3">
                            <div className="flex justify-between text-xs text-gray-600 mb-1">
                              <span>Progression</span>
                              <span className="font-semibold">{objective.current_value || 0} / {objective.target_value} {objective.unit || ''}</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-gradient-to-r from-purple-600 to-pink-600 h-2 rounded-full transition-all"
                                style={{ width: `${Math.min(((objective.current_value || 0) / objective.target_value) * 100, 100)}%` }}
                              ></div>
                            </div>
                          </div>
                        )}
                        
                        {/* Bouton de mise à jour pour vendeur */}
                        {objective.data_entry_responsible === 'seller' && (
                          <div className="mt-3">
                            {updatingObjectiveId === objective.id ? (
                              <div className="bg-white rounded-lg p-3 border-2 border-cyan-300">
                                <p className="text-sm font-semibold text-gray-700 mb-2">Mettre à jour ma progression :</p>
                                <div className="flex gap-2">
                                  <input
                                    type="number"
                                    value={objectiveProgressValue}
                                    onChange={(e) => setObjectiveProgressValue(e.target.value)}
                                    placeholder="Nouvelle valeur"
                                    className="flex-1 p-2 border-2 border-purple-300 rounded-lg focus:border-purple-500 focus:outline-none"
                                  />
                                  <button
                                    onClick={() => handleUpdateProgress(objective.id)}
                                    className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all font-semibold"
                                  >
                                    ✅
                                  </button>
                                  <button
                                    onClick={() => {
                                      setUpdatingObjectiveId(null);
                                      setObjectiveProgressValue('');
                                    }}
                                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-all"
                                  >
                                    ❌
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => {
                                  setUpdatingObjectiveId(objective.id);
                                  setObjectiveProgressValue(objective.current?.toString() || '0');
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
                    {activeChallenges.map((challenge, index) => (
                      <div 
                        key={index}
                        className="bg-gradient-to-r from-pink-50 to-orange-50 rounded-xl p-4 border-2 border-pink-200 hover:border-pink-300 transition-all"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <h4 className="font-bold text-gray-800 mb-1">{challenge.title || challenge.name}</h4>
                            <p className="text-sm text-gray-600">{challenge.description}</p>
                          </div>
                          <div className="ml-4">
                            <span className="px-3 py-1 bg-pink-600 text-white rounded-full text-xs font-semibold">
                              {challenge.type || 'Challenge'}
                            </span>
                          </div>
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
                                
                                <div className="flex gap-2 mt-3">
                                  <button
                                    onClick={() => handleUpdateChallengeProgress(challenge.id, challenge.challenge_type)}
                                    className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all font-semibold text-sm"
                                  >
                                    ✅ Valider
                                  </button>
                                  <button
                                    onClick={() => {
                                      setUpdatingChallengeId(null);
                                      setChallengeProgress({ ca: 0, ventes: 0, clients: 0 });
                                      setChallengeCurrentValue('');
                                    }}
                                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-all text-sm"
                                  >
                                    ❌
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => {
                                  setUpdatingChallengeId(challenge.id);
                                  if (challenge.challenge_type === 'kpi_standard') {
                                    setChallengeCurrentValue(challenge.current_value?.toString() || '0');
                                  } else {
                                    setChallengeProgress({
                                      ca: challenge.progress_ca || 0,
                                      ventes: challenge.progress_ventes || 0,
                                      clients: challenge.progress_clients || 0
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
                    ))}
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
    </div>
  );
}
