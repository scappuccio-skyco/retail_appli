import React, { useState } from 'react';
import { X, Target, Trophy } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL || '';

export default function ObjectivesModal({ 
  isOpen, 
  onClose,
  activeObjectives = [],
  activeChallenges = []
}) {
  const [activeTab, setActiveTab] = useState('objectifs'); // 'objectifs' or 'challenges'
  const [updatingObjectiveId, setUpdatingObjectiveId] = useState(null);
  const [objectiveProgressValue, setObjectiveProgressValue] = useState('');
  const [updatingChallengeId, setUpdatingChallengeId] = useState(null);
  const [challengeProgress, setChallengeProgress] = useState({
    ca: 0,
    ventes: 0,
    clients: 0
  });
  const [challengeCurrentValue, setChallengeCurrentValue] = useState('');
  
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
              <div className="px-6 pb-6">
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
                        
                        {/* Barre de progression */}
                        {objective.target && (
                          <div className="mt-3">
                            <div className="flex justify-between text-xs text-gray-600 mb-1">
                              <span>Progression</span>
                              <span>{objective.current || 0} / {objective.target}</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-gradient-to-r from-purple-600 to-pink-600 h-2 rounded-full transition-all"
                                style={{ width: `${Math.min(((objective.current || 0) / objective.target) * 100, 100)}%` }}
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
              {/* Bandeau coloré "Mes Challenges" */}
              <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-8 py-6 mb-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold">🏆 Mes Challenges</h3>
                  {activeChallenges.length > 0 && (
                    <span className="text-sm text-pink-100">
                      {activeChallenges.length} challenge{activeChallenges.length > 1 ? 's' : ''} en cours
                    </span>
                  )}
                </div>
                <p className="text-sm text-pink-100 mt-2">Relevez vos défis et dépassez-vous chaque jour</p>
              </div>

              {/* Contenu avec padding */}
              <div className="px-6 pb-6">
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
        </div>
      </div>
    </div>
  );
}
