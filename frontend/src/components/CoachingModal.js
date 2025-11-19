import React, { useState } from 'react';
import { X, Award, MessageSquare } from 'lucide-react';

export default function CoachingModal({ 
  isOpen, 
  onClose,
  dailyChallenge,
  onCompleteChallenge,
  debriefs = [],
  onCreateDebrief,
  activeTab: initialTab = 'coach'
}) {
  const [activeTab, setActiveTab] = useState(initialTab);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white">🎯 Coaching & Analyse</h2>
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
              onClick={() => setActiveTab('coach')}
              className={`px-6 py-3 font-semibold transition-all rounded-t-lg ${
                activeTab === 'coach'
                  ? 'bg-purple-300 text-gray-800 shadow-md border-b-4 border-purple-500'
                  : 'text-gray-600 hover:text-purple-600 hover:bg-gray-100'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <Award className="w-5 h-5" />
                <span>Mon Coach IA</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('analyse')}
              className={`px-6 py-3 font-semibold transition-all rounded-t-lg ${
                activeTab === 'analyse'
                  ? 'bg-purple-300 text-gray-800 shadow-md border-b-4 border-purple-500'
                  : 'text-gray-600 hover:text-purple-600 hover:bg-gray-100'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <MessageSquare className="w-5 h-5" />
                <span>Analyse de vente • {debriefs.length}</span>
              </div>
            </button>
          </div>
        </div>

        {/* Contenu */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'coach' && (
            <div>
              {dailyChallenge ? (
                <div className="space-y-4">
                  <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl p-6 border-2 border-purple-200">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <Award className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-gray-800 mb-2">{dailyChallenge.title}</h3>
                        <p className="text-gray-700 mb-4">{dailyChallenge.description}</p>
                        
                        {dailyChallenge.kpi_name && (
                          <div className="bg-white rounded-lg p-4 border border-purple-200">
                            <p className="text-sm text-gray-600 mb-1">Objectif</p>
                            <p className="text-lg font-bold text-purple-600">
                              {dailyChallenge.kpi_name} : {dailyChallenge.target_value}
                            </p>
                          </div>
                        )}

                        {!dailyChallenge.completed && onCompleteChallenge && (
                          <button
                            onClick={onCompleteChallenge}
                            className="mt-4 px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all shadow-md"
                          >
                            Marquer comme complété
                          </button>
                        )}

                        {dailyChallenge.completed && (
                          <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
                            <p className="text-green-700 font-semibold">✅ Challenge complété !</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <Award className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg font-semibold mb-2">Aucun challenge actif</p>
                  <p className="text-sm">Votre prochain challenge sera bientôt disponible</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'analyse' && (
            <div>
              {onCreateDebrief && (
                <button
                  onClick={onCreateDebrief}
                  className="w-full mb-6 px-6 py-4 bg-gradient-to-r from-green-600 to-teal-600 text-white font-semibold rounded-lg hover:from-green-700 hover:to-teal-700 transition-all shadow-md"
                >
                  ➕ Nouvelle analyse de vente
                </button>
              )}

              {debriefs.length > 0 ? (
                <div className="space-y-4">
                  {debriefs.map((debrief, index) => (
                    <div key={index} className="bg-gradient-to-r from-green-50 to-teal-50 rounded-xl p-6 border-2 border-green-200">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                          <MessageSquare className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="text-lg font-bold text-gray-800">Analyse #{debriefs.length - index}</h3>
                            <span className="text-sm text-gray-500">
                              {new Date(debrief.timestamp).toLocaleDateString('fr-FR')}
                            </span>
                          </div>
                          <div className="bg-white rounded-lg p-4 border border-green-200">
                            <p className="text-gray-700 whitespace-pre-wrap">{debrief.analysis || debrief.feedback}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <MessageSquare className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg font-semibold mb-2">Aucune analyse pour le moment</p>
                  <p className="text-sm">Créez votre première analyse de vente pour recevoir un coaching personnalisé</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
