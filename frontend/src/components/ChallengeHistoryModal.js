import React, { useState, useEffect } from 'react';
import { X, Award, CheckCircle, AlertCircle, XCircle, Calendar } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function ChallengeHistoryModal({ onClose }) {
  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [displayLimit, setDisplayLimit] = useState(20); // Afficher 20 challenges à la fois

  useEffect(() => {
    fetchChallengeHistory();
  }, []);

  const fetchChallengeHistory = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/seller/daily-challenge/history`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setChallenges(res.data || []);
    } catch (err) {
      console.error('Error fetching challenge history:', err);
      toast.error('Erreur lors du chargement de l\'historique');
    } finally {
      setLoading(false);
    }
  };

  // Limiter l'affichage des challenges
  const displayedChallenges = challenges.slice(0, displayLimit);
  const hasMore = displayLimit < challenges.length;
  const remainingCount = challenges.length - displayLimit;

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    });
  };

  const getResultBadge = (result) => {
    if (result === 'success') {
      return (
        <div className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
          <CheckCircle className="w-3 h-3" />
          Réussi
        </div>
      );
    } else if (result === 'partial') {
      return (
        <div className="flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-semibold">
          <AlertCircle className="w-3 h-3" />
          Difficile
        </div>
      );
    } else if (result === 'failed') {
      return (
        <div className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold">
          <XCircle className="w-3 h-3" />
          Échoué
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-semibold">
        Non complété
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-400 to-red-500 text-white p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white bg-opacity-20 rounded-xl flex items-center justify-center">
              <Award className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Mon Historique de Challenges</h2>
              <p className="text-sm text-orange-100">
                {displayLimit >= challenges.length 
                  ? `${challenges.length} challenge${challenges.length > 1 ? 's' : ''} affiché${challenges.length > 1 ? 's' : ''}`
                  : `Affichage de ${displayLimit} sur ${challenges.length} challenges`
                }
              </p>
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
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#F97316]"></div>
            </div>
          ) : challenges.length === 0 ? (
            <div className="text-center py-12">
              <Award className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">Aucun challenge pour le moment</p>
              <p className="text-gray-400 text-sm mt-2">Tes futurs challenges apparaîtront ici</p>
            </div>
          ) : (
            <div className="space-y-4">
              {displayedChallenges.map((challenge) => (
                <div
                  key={challenge.id}
                  className={`border-2 rounded-xl transition-all ${
                    challenge.completed
                      ? challenge.challenge_result === 'success'
                        ? 'border-green-200 bg-green-50'
                        : challenge.challenge_result === 'partial'
                        ? 'border-orange-200 bg-orange-50'
                        : 'border-red-200 bg-red-50'
                      : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div
                    className="p-4 cursor-pointer"
                    onClick={() => setExpandedId(expandedId === challenge.id ? null : challenge.id)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-600" />
                        <span className="text-sm font-semibold text-gray-700">
                          {formatDate(challenge.date)}
                        </span>
                      </div>
                      {challenge.completed && getResultBadge(challenge.challenge_result)}
                    </div>

                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-0.5 bg-[#F97316] text-white text-xs font-bold rounded-full uppercase">
                        {challenge.competence}
                      </span>
                      <h3 className="text-lg font-bold text-gray-900">{challenge.title}</h3>
                    </div>

                    {expandedId !== challenge.id && (
                      <p className="text-sm text-gray-600 line-clamp-2">{challenge.description}</p>
                    )}
                  </div>

                  {expandedId === challenge.id && (
                    <div className="px-4 pb-4 space-y-3">
                      <div className="bg-white rounded-lg p-3 border border-gray-200">
                        <p className="text-xs font-semibold text-orange-900 mb-1 flex items-center gap-1">
                          <span>💪</span> Le Défi :
                        </p>
                        <p className="text-sm text-gray-800">{challenge.description}</p>
                      </div>

                      <div className="bg-white rounded-lg p-3 border border-gray-200">
                        <p className="text-xs font-semibold text-blue-900 mb-1 flex items-center gap-1">
                          <span>🎓</span> Rappel :
                        </p>
                        <p className="text-sm text-gray-800 italic">{challenge.pedagogical_tip}</p>
                      </div>

                      <div className="bg-white rounded-lg p-3 border border-gray-200">
                        <p className="text-xs font-semibold text-purple-900 mb-1 flex items-center gap-1">
                          <span>📊</span> Pourquoi ce défi ?
                        </p>
                        <p className="text-sm text-gray-800">{challenge.reason}</p>
                      </div>

                      {challenge.completed && challenge.feedback_comment && (
                        <div className="bg-white rounded-lg p-3 border border-gray-200">
                          <p className="text-xs font-semibold text-indigo-900 mb-1 flex items-center gap-1">
                            <span>💭</span> Ton Commentaire :
                          </p>
                          <p className="text-sm text-gray-800 italic">{challenge.feedback_comment}</p>
                        </div>
                      )}

                      {challenge.completed && (
                        <div className="text-xs text-gray-500 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          Complété le {new Date(challenge.completed_at).toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {/* Bouton Charger plus */}
              {hasMore && (
                <div className="mt-6 text-center">
                  <button
                    onClick={() => setDisplayLimit(prev => prev + 20)}
                    className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-all inline-flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                    Charger plus ({remainingCount} challenge{remainingCount > 1 ? 's' : ''} restant{remainingCount > 1 ? 's' : ''})
                  </button>
                </div>
              )}
            </div>
          )}
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
