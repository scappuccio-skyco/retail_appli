import React, { useState, useEffect } from 'react';
import { X, Award, MessageSquare, RefreshCw, Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react';
import ChallengeHistoryModal from './ChallengeHistoryModal';
import DebriefHistoryModal from './DebriefHistoryModal';
import VenteConclueForm from './VenteConclueForm';
import OpportuniteManqueeForm from './OpportuniteManqueeForm';
import axios from 'axios';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function CoachingModal({ 
  isOpen, 
  onClose,
  dailyChallenge,
  onRefreshChallenge,
  onCompleteChallenge,
  onOpenChallengeHistory,
  debriefs = [],
  onCreateDebrief,
  token,
  activeTab: initialTab = 'coach'
}) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [analyseSubTab, setAnalyseSubTab] = useState('conclue'); // 'conclue', 'manquee', 'historique'
  const [showChallengeHistoryModal, setShowChallengeHistoryModal] = useState(false);
  const [showDebriefHistoryModal, setShowDebriefHistoryModal] = useState(false);
  
  // Challenge states
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [expandedDebriefs, setExpandedDebriefs] = useState({});

  useEffect(() => {
    if (isOpen && activeTab === 'coach') {
      fetchStats();
    }
  }, [isOpen, activeTab]);

  const fetchStats = async () => {
    try {
      const res = await axios.get(`${API}/seller/daily-challenge/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStats(res.data);
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  const triggerConfetti = () => {
    const duration = 3000;
    const end = Date.now() + duration;
    const colors = ['#ffd700', '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4'];

    (function frame() {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: colors
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: colors
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    }());
  };

  const handleComplete = async (result) => {
    if (!result) {
      setShowFeedbackForm(true);
      return;
    }

    setLoading(true);
    try {
      await axios.post(
        `${API}/seller/daily-challenge/complete`,
        {
          challenge_id: dailyChallenge.id,
          result,
          comment: feedbackComment
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (result === 'success') {
        triggerConfetti();
        toast.success('🎉 Bravo ! Défi réussi !');
      } else if (result === 'partial') {
        toast('💪 Continue comme ça !', { icon: '⚠️' });
      } else {
        toast('Pas grave, tu feras mieux la prochaine fois !', { icon: '❌' });
      }

      setShowFeedbackForm(false);
      setFeedbackComment('');
      
      if (onCompleteChallenge) {
        onCompleteChallenge();
      }
      
      await fetchStats();
    } catch (err) {
      console.error('Error completing challenge:', err);
      toast.error('Erreur lors de la validation');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setLoading(true);
    try {
      const res = await axios.post(
        `${API}/seller/daily-challenge/refresh`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('✨ Nouveau défi généré !');
      
      if (onRefreshChallenge) {
        onRefreshChallenge(res.data);
      }
    } catch (err) {
      console.error('Error refreshing challenge:', err);
      toast.error('Erreur lors du rafraîchissement');
    } finally {
      setLoading(false);
    }
  };

  const toggleDebrief = (debriefId) => {
    setExpandedDebriefs(prev => ({
      ...prev,
      [debriefId]: !prev[debriefId]
    }));
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
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
          <div className="flex-1 overflow-y-auto">
            {activeTab === 'coach' && (
              <div>
                {dailyChallenge ? (
                  <div>
                    {/* Statistics Section */}
                    {stats && (
                      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 p-4 border-b-2 border-purple-100">
                        <p className="text-xs text-gray-600 font-semibold mb-3">📊 Tes Statistiques</p>
                        <div className="grid grid-cols-4 gap-2">
                          <div className="bg-white rounded-xl p-2 text-center shadow-sm">
                            <div className="text-2xl mb-1">🏆</div>
                            <p className="text-lg font-bold text-gray-800">{stats.completed_count}</p>
                            <p className="text-xs text-gray-600">Relevé{stats.completed_count > 1 ? 's' : ''}</p>
                          </div>
                          <div className="bg-white rounded-xl p-2 text-center shadow-sm">
                            <div className="text-2xl mb-1">✅</div>
                            <p className="text-lg font-bold text-[#10B981]">{stats.success_count}</p>
                            <p className="text-xs text-gray-600">Réussi{stats.success_count > 1 ? 's' : ''}</p>
                          </div>
                          <div className="bg-white rounded-xl p-2 text-center shadow-sm">
                            <div className="text-2xl mb-1">💪</div>
                            <p className="text-lg font-bold text-[#F97316]">{stats.partial_count}</p>
                            <p className="text-xs text-gray-600">Difficile{stats.partial_count > 1 ? 's' : ''}</p>
                          </div>
                          <div className="bg-white rounded-xl p-2 text-center shadow-sm">
                            <div className="text-2xl mb-1">❌</div>
                            <p className="text-lg font-bold text-red-600">{stats.failed_count}</p>
                            <p className="text-xs text-gray-600">Échoué{stats.failed_count > 1 ? 's' : ''}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="p-6">
                      {/* Action buttons */}
                      <div className="flex gap-2 mb-4">
                        <button
                          onClick={() => setShowChallengeHistoryModal(true)}
                          className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-2 px-4 rounded-lg transition-all flex items-center justify-center gap-2"
                        >
                          <MessageSquare className="w-4 h-4" />
                          📜 Historique
                        </button>
                        {dailyChallenge.completed ? (
                          <button
                            onClick={handleRefresh}
                            disabled={loading}
                            className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                          >
                            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                            🔄 Nouveau défi
                          </button>
                        ) : (
                          <button
                            onClick={handleRefresh}
                            disabled={loading}
                            className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-2 px-4 rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                          >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                            Relancer
                          </button>
                        )}
                      </div>

                      <div className="bg-gradient-to-r from-orange-50 to-red-50 rounded-xl p-4 border-2 border-orange-200">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="px-2 py-0.5 bg-[#F97316] text-white text-xs font-bold rounded-full">
                            {dailyChallenge.competence?.toUpperCase() || 'CHALLENGE'}
                          </span>
                          <h3 className="text-base font-bold text-gray-900">{dailyChallenge.title}</h3>
                        </div>

                        {/* Le Défi */}
                        <div className="bg-white rounded-lg p-3 mb-2">
                          <p className="text-xs font-semibold text-orange-900 mb-1">💪 Ton Défi :</p>
                          <p className="text-sm text-gray-800">{dailyChallenge.description}</p>
                        </div>

                        {/* Rappel & Exemple */}
                        <div className="grid grid-cols-2 gap-2 mb-2">
                          {dailyChallenge.pedagogical_tip && (
                            <div className="bg-white rounded-lg p-2">
                              <p className="text-xs font-semibold text-blue-900 mb-1">🎓 Rappel</p>
                              <p className="text-xs text-gray-700 italic">{dailyChallenge.pedagogical_tip}</p>
                            </div>
                          )}
                          {dailyChallenge.reason && (
                            <div className="bg-white rounded-lg p-2">
                              <p className="text-xs font-semibold text-purple-900 mb-1">📊 Pourquoi ?</p>
                              <p className="text-xs text-gray-700">{dailyChallenge.reason}</p>
                            </div>
                          )}
                        </div>

                        {/* Exemples Concrets */}
                        {dailyChallenge.examples && dailyChallenge.examples.length > 0 && (
                          <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-3 mb-3 border-2 border-green-200">
                            <p className="text-xs font-semibold text-green-900 mb-2">✨ 3 Exemples pour Réussir</p>
                            <div className="space-y-2">
                              {dailyChallenge.examples.map((example, index) => (
                                <div key={index} className="flex gap-2">
                                  <span className="text-green-700 font-bold text-xs flex-shrink-0">{index + 1}.</span>
                                  <p className="text-xs text-green-800 italic">{example}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Actions */}
                        {!dailyChallenge.completed ? (
                          !showFeedbackForm ? (
                            <button
                              onClick={() => setShowFeedbackForm(true)}
                              disabled={loading}
                              className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:shadow-lg text-white font-bold py-3 px-6 rounded-lg transition-all disabled:opacity-50"
                            >
                              ✅ J'ai relevé le défi !
                            </button>
                          ) : (
                            <div className="space-y-2">
                              <p className="text-xs font-semibold text-gray-700">Comment ça s'est passé ?</p>
                              <div className="grid grid-cols-3 gap-2">
                                <button
                                  onClick={() => handleComplete('success')}
                                  disabled={loading}
                                  className="bg-gradient-to-r from-green-500 to-green-600 hover:shadow-lg text-white font-bold py-2 px-3 rounded-lg transition-all disabled:opacity-50 flex flex-col items-center gap-0.5"
                                >
                                  <span className="text-xl">✅</span>
                                  <span className="text-xs">Réussi</span>
                                </button>
                                <button
                                  onClick={() => handleComplete('partial')}
                                  disabled={loading}
                                  className="bg-gradient-to-r from-orange-500 to-orange-600 hover:shadow-lg text-white font-bold py-2 px-3 rounded-lg transition-all disabled:opacity-50 flex flex-col items-center gap-0.5"
                                >
                                  <span className="text-xl">⚠️</span>
                                  <span className="text-xs">Difficile</span>
                                </button>
                                <button
                                  onClick={() => handleComplete('failed')}
                                  disabled={loading}
                                  className="bg-gradient-to-r from-red-500 to-red-600 hover:shadow-lg text-white font-bold py-2 px-3 rounded-lg transition-all disabled:opacity-50 flex flex-col items-center gap-0.5"
                                >
                                  <span className="text-xl">❌</span>
                                  <span className="text-xs">Échoué</span>
                                </button>
                              </div>
                              <div>
                                <textarea
                                  value={feedbackComment}
                                  onChange={(e) => setFeedbackComment(e.target.value)}
                                  placeholder="Commentaire optionnel..."
                                  className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
                                  rows={2}
                                />
                              </div>
                              <button
                                onClick={() => {
                                  setShowFeedbackForm(false);
                                  setFeedbackComment('');
                                }}
                                className="w-full text-xs text-gray-600 hover:text-gray-800 py-1 transition-colors"
                              >
                                Annuler
                              </button>
                            </div>
                          )
                        ) : (
                          <div className={`rounded-lg p-3 flex items-center justify-center gap-2 ${
                            dailyChallenge.challenge_result === 'success' 
                              ? 'bg-gradient-to-r from-green-100 to-green-200 text-green-800'
                              : dailyChallenge.challenge_result === 'partial'
                              ? 'bg-gradient-to-r from-orange-100 to-orange-200 text-orange-800'
                              : 'bg-gradient-to-r from-red-100 to-red-200 text-red-800'
                          }`}>
                            <span className="text-xl">
                              {dailyChallenge.challenge_result === 'success' ? '🎉' : 
                               dailyChallenge.challenge_result === 'partial' ? '💪' : '🤔'}
                            </span>
                            <span className="font-bold">
                              {dailyChallenge.challenge_result === 'success' ? 'Défi Réussi !' :
                               dailyChallenge.challenge_result === 'partial' ? 'C\'était difficile' : 'Pas cette fois'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 px-6 text-gray-500">
                    <Award className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                    <p className="text-lg font-semibold mb-2">Aucun challenge actif</p>
                    <p className="text-sm mb-4">Votre prochain challenge sera bientôt disponible</p>
                    <button
                      onClick={handleRefresh}
                      disabled={loading}
                      className="px-6 py-3 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition-all inline-flex items-center gap-2 disabled:opacity-50"
                    >
                      <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                      Générer un challenge
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'analyse' && (
              <div className="p-6">
                <div className="flex gap-3 mb-6">
                  {onCreateDebrief && (
                    <button
                      onClick={onCreateDebrief}
                      className="flex-1 px-6 py-4 bg-gradient-to-r from-green-600 to-teal-600 text-white font-semibold rounded-lg hover:from-green-700 hover:to-teal-700 transition-all shadow-md"
                    >
                      ➕ Nouvelle analyse de vente
                    </button>
                  )}
                  <button
                    onClick={() => setShowDebriefHistoryModal(true)}
                    className="px-6 py-4 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-700 transition-all"
                  >
                    📜 Historique
                  </button>
                </div>

                {debriefs.length > 0 ? (
                  <div className="space-y-4">
                    <p className="text-sm text-gray-600 mb-4">Dernières analyses ({Math.min(debriefs.length, 5)})</p>
                    {debriefs.slice(0, 5).map((debrief) => (
                      <div key={debrief.id} className="bg-gradient-to-r from-green-50 to-teal-50 rounded-xl border-2 border-green-200">
                        <div className="p-6">
                          <div className="flex items-start gap-4">
                            <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                              {debrief.type === 'vente_conclue' ? (
                                <CheckCircle className="w-6 h-6 text-white" />
                              ) : (
                                <XCircle className="w-6 h-6 text-white" />
                              )}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-2">
                                <h3 className="text-lg font-bold text-gray-800">
                                  {debrief.type === 'vente_conclue' ? '✅ Vente conclue' : '❌ Opportunité manquée'}
                                </h3>
                                <button
                                  onClick={() => toggleDebrief(debrief.id)}
                                  className="p-1 hover:bg-white/50 rounded transition-colors"
                                >
                                  {expandedDebriefs[debrief.id] ? (
                                    <EyeOff className="w-4 h-4 text-gray-600" />
                                  ) : (
                                    <Eye className="w-4 h-4 text-gray-600" />
                                  )}
                                </button>
                              </div>
                              <p className="text-sm text-gray-600 mb-2">
                                {new Date(debrief.timestamp).toLocaleDateString('fr-FR', { 
                                  day: 'numeric', 
                                  month: 'long', 
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                              {expandedDebriefs[debrief.id] && (
                                <div className="bg-white rounded-lg p-4 border border-green-200 mt-2">
                                  <p className="text-gray-700 whitespace-pre-wrap">{debrief.analysis || debrief.feedback}</p>
                                </div>
                              )}
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

      {/* Modal Challenge Historique */}
      {showChallengeHistoryModal && (
        <ChallengeHistoryModal
          onClose={() => setShowChallengeHistoryModal(false)}
        />
      )}

      {/* Modal Debrief Historique */}
      {showDebriefHistoryModal && (
        <DebriefHistoryModal
          onClose={() => setShowDebriefHistoryModal(false)}
          token={token}
          onSuccess={() => {
            setShowDebriefHistoryModal(false);
          }}
        />
      )}
    </>
  );
}
