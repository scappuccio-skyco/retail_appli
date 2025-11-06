import React, { useState, useEffect } from 'react';
import { X, Award, RefreshCw, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import confetti from 'canvas-confetti';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function DailyChallengeModal({ challenge, onClose, onRefresh, onComplete, onOpenHistory }) {
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);

  // Fetch challenge stats
  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/seller/daily-challenge/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStats(res.data);
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  // Trigger confetti when challenge is completed
  useEffect(() => {
    if (challenge && challenge.completed && challenge.challenge_result === 'success') {
      triggerConfetti();
    }
  }, [challenge]);

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
      const token = localStorage.getItem('token');
      const res = await axios.post(
        `${API}/seller/daily-challenge/complete`,
        {
          challenge_id: challenge.id,
          result: result,
          comment: feedbackComment || null
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const messages = {
        success: '🎉 Excellent ! Défi réussi !',
        partial: '💪 Bon effort ! Continue comme ça !',
        failed: '🤔 Pas grave ! On réessaie demain !'
      };
      
      // Show success message
      toast.success(messages[result] || '✅ Feedback enregistré !');
      
      // Update challenge state to show completion
      if (onComplete) {
        onComplete(res.data);
      }
      
      // Close after a short delay to let user see the success message
      setTimeout(() => {
        onClose();
      }, 1500);
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
      const token = localStorage.getItem('token');
      const res = await axios.post(
        `${API}/seller/daily-challenge/refresh`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('✨ Nouveau défi généré !');
      
      if (onRefresh) {
        onRefresh(res.data);
      }
    } catch (err) {
      console.error('Error refreshing challenge:', err);
      toast.error('Erreur lors du rafraîchissement');
    } finally {
      setLoading(false);
    }
  };

  if (!challenge) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-400 to-red-500 text-white p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white bg-opacity-20 rounded-xl flex items-center justify-center">
                <Award className="w-7 h-7" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">🤖 Mon Coach IA</h2>
                <p className="text-sm text-orange-100">
                  {challenge.completed ? '✅ Défi relevé !' : 'Ton défi personnalisé'}
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
          
          {/* Action buttons in header */}
          <div className="flex gap-2">
            <button
              onClick={onOpenHistory}
              className="flex-1 bg-white bg-opacity-20 hover:bg-opacity-30 text-white font-semibold py-2 px-4 rounded-lg transition-all flex items-center justify-center gap-2"
            >
              <MessageSquare className="w-4 h-4" />
              📜 Historique
            </button>
            {challenge.completed ? (
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="flex-1 bg-white bg-opacity-20 hover:bg-opacity-30 text-white font-bold py-2 px-4 rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                🔄 Nouveau défi
              </button>
            ) : (
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="flex-1 bg-white bg-opacity-20 hover:bg-opacity-30 text-white font-semibold py-2 px-4 rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Relancer
              </button>
            )}
          </div>
        </div>

        {/* Statistics Section */}
        {stats && (
          <div className="bg-gradient-to-r from-purple-50 to-indigo-50 p-4 border-b-2 border-purple-100">
            <p className="text-xs text-gray-600 font-semibold mb-3">📊 Tes Statistiques</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white rounded-xl p-3 text-center shadow-sm">
                <div className="text-2xl mb-1">🏆</div>
                <p className="text-xl font-bold text-gray-800">{stats.completed_count}</p>
                <p className="text-xs text-gray-600">Défi{stats.completed_count > 1 ? 's' : ''} relevé{stats.completed_count > 1 ? 's' : ''}</p>
              </div>
              <div className="bg-white rounded-xl p-3 text-center shadow-sm">
                <div className="text-2xl mb-1">✅</div>
                <p className="text-xl font-bold text-green-600">{stats.success_count}</p>
                <p className="text-xs text-gray-600">Réussi{stats.success_count > 1 ? 's' : ''}</p>
              </div>
              <div className="bg-white rounded-xl p-3 text-center shadow-sm">
                <div className="text-2xl mb-1">💪</div>
                <p className="text-xl font-bold text-orange-600">{stats.completed_count - stats.success_count}</p>
                <p className="text-xs text-gray-600">Difficile{(stats.completed_count - stats.success_count) > 1 ? 's' : ''}</p>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="bg-gradient-to-r from-orange-50 to-red-50 rounded-xl p-4 border-2 border-orange-200">
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-0.5 bg-orange-500 text-white text-xs font-bold rounded-full">
                {challenge.competence.toUpperCase()}
              </span>
              <h3 className="text-base font-bold text-gray-900">{challenge.title}</h3>
            </div>

            {/* Le Défi */}
            <div className="bg-white rounded-lg p-3 mb-2">
              <p className="text-xs font-semibold text-orange-900 mb-1">💪 Ton Défi :</p>
              <p className="text-sm text-gray-800">{challenge.description}</p>
            </div>

            {/* Rappel & Exemple */}
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div className="bg-white rounded-lg p-2">
                <p className="text-xs font-semibold text-blue-900 mb-1">🎓 Rappel</p>
                <p className="text-xs text-gray-700 italic">{challenge.pedagogical_tip}</p>
              </div>
              <div className="bg-white rounded-lg p-2">
                <p className="text-xs font-semibold text-purple-900 mb-1">📊 Pourquoi ?</p>
                <p className="text-xs text-gray-700">{challenge.reason}</p>
              </div>
            </div>

            {/* Exemples Concrets (3) */}
            {challenge.examples && challenge.examples.length > 0 && (
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-3 mb-3 border-2 border-green-200">
                <p className="text-xs font-semibold text-green-900 mb-2">✨ 3 Exemples pour Réussir</p>
                <div className="space-y-2">
                  {challenge.examples.map((example, index) => (
                    <div key={index} className="flex gap-2">
                      <span className="text-green-700 font-bold text-xs flex-shrink-0">{index + 1}.</span>
                      <p className="text-xs text-green-800 italic">{example}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            {!challenge.completed ? (
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
              <div className="space-y-2">
                <div className={`rounded-lg p-3 flex items-center justify-center gap-2 ${
                  challenge.challenge_result === 'success' 
                    ? 'bg-gradient-to-r from-green-100 to-green-200 text-green-800'
                    : challenge.challenge_result === 'partial'
                    ? 'bg-gradient-to-r from-orange-100 to-orange-200 text-orange-800'
                    : 'bg-gradient-to-r from-red-100 to-red-200 text-red-800'
                }`}>
                  <span className="text-xl">
                    {challenge.challenge_result === 'success' ? '🎉' : 
                     challenge.challenge_result === 'partial' ? '💪' : '🤔'}
                  </span>
                  <span className="font-bold text-sm">
                    {challenge.challenge_result === 'success' ? 'Défi réussi !' : 
                     challenge.challenge_result === 'partial' ? 'Défi difficile' : 'Défi non réussi'}
                  </span>
                </div>
                {challenge.feedback_comment && (
                  <div className="bg-white rounded-lg p-2 border border-gray-200">
                    <p className="text-xs font-semibold text-gray-600 mb-0.5">Ton commentaire :</p>
                    <p className="text-xs text-gray-800 italic">{challenge.feedback_comment}</p>
                  </div>
                )}
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
