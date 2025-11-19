import React, { useState } from 'react';
import { X, Target, Trophy } from 'lucide-react';

export default function ObjectivesModal({ 
  isOpen, 
  onClose,
  activeObjectives = [],
  activeChallenges = []
}) {
  const [activeTab, setActiveTab] = useState('objectifs'); // 'objectifs' or 'challenges'

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header avec bouton fermer */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-800">🎯 Objectifs et Challenges</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        {/* Onglets */}
        <div className="flex border-b bg-gray-50">
          <button
            onClick={() => setActiveTab('objectifs')}
            className={`flex-1 px-6 py-4 font-semibold transition-all ${
              activeTab === 'objectifs'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
            }`}
          >
            <Target className="w-5 h-5 inline-block mr-2" />
            Mes Objectifs ({activeObjectives.length})
          </button>
          <button
            onClick={() => setActiveTab('challenges')}
            className={`flex-1 px-6 py-4 font-semibold transition-all ${
              activeTab === 'challenges'
                ? 'text-green-600 border-b-2 border-green-600 bg-white'
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
            }`}
          >
            <Trophy className="w-5 h-5 inline-block mr-2" />
            Mes Challenges ({activeChallenges.length})
          </button>
        </div>

        {/* Contenu du modal selon l'onglet actif */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'objectifs' && (
            <div>
              {/* Bandeau coloré "Mes Objectifs" */}
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-8 py-6 mb-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold">🎯 Mes Objectifs</h3>
                  {activeObjectives.length > 0 && (
                    <span className="text-sm text-purple-100">
                      {activeObjectives.length} objectif{activeObjectives.length > 1 ? 's' : ''} actif{activeObjectives.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <p className="text-sm text-purple-100 mt-2">Suivez vos objectifs et progressez vers vos cibles</p>
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
              <div className="bg-gradient-to-r from-pink-600 to-pink-700 text-white px-8 py-6 mb-6">
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
