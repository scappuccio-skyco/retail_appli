import React from 'react';
import { X, Award, RefreshCw, MessageSquare } from 'lucide-react';
import useDailyChallengeModal from './dailyChallengeModal/useDailyChallengeModal';
import ChallengeStatsBar from './dailyChallengeModal/ChallengeStatsBar';
import ChallengeActions from './dailyChallengeModal/ChallengeActions';

export default function DailyChallengeModal({ challenge, onClose, onRefresh, onComplete, onOpenHistory }) {
  const {
    stats, loading,
    showFeedbackForm, setShowFeedbackForm,
    feedbackComment, setFeedbackComment,
    handleComplete, handleRefresh,
  } = useDailyChallengeModal({ challenge, onClose, onRefresh, onComplete });

  if (!challenge) return null;

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
    >
      <div className="challenge-modal-content bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <style>{`
          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            10%, 30%, 50%, 70%, 90% { transform: translateX(-10px); }
            20%, 40%, 60%, 80% { transform: translateX(10px); }
          }
          .shake-animation { animation: shake 0.6s ease-in-out; }
        `}</style>

        {/* Header */}
        <div className="bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white bg-opacity-20 rounded-xl flex items-center justify-center">
                <Award className="w-7 h-7" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">🤖 Mon Coach IA</h2>
                <p className="text-sm text-orange-100">{challenge.completed ? '✅ Défi relevé !' : 'Ton défi personnalisé'}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-all">
              <X className="w-6 h-6" />
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onOpenHistory}
              className="flex-1 bg-white bg-opacity-20 hover:bg-opacity-30 text-white font-semibold py-2 px-4 rounded-lg transition-all flex items-center justify-center gap-2"
            >
              <MessageSquare className="w-4 h-4" />📜 Historique
            </button>
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="flex-1 bg-white bg-opacity-20 hover:bg-opacity-30 text-white font-semibold py-2 px-4 rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              {challenge.completed ? '🔄 Nouveau défi' : 'Relancer'}
            </button>
          </div>
        </div>

        <ChallengeStatsBar stats={stats} />

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="bg-gradient-to-r from-orange-50 to-red-50 rounded-xl p-4 border-2 border-orange-200">
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-0.5 bg-[#F97316] text-white text-xs font-bold rounded-full">
                {challenge.competence.toUpperCase()}
              </span>
              <h3 className="text-base font-bold text-gray-900">{challenge.title}</h3>
            </div>

            <div className="bg-white rounded-lg p-3 mb-2">
              <p className="text-xs font-semibold text-orange-900 mb-1">💪 Ton Défi :</p>
              <p className="text-sm text-gray-800">{challenge.description}</p>
            </div>

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

            {challenge.examples?.length > 0 && (
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-3 mb-3 border-2 border-green-200">
                <p className="text-xs font-semibold text-green-900 mb-2">✨ 3 Exemples pour Réussir</p>
                <div className="space-y-2">
                  {challenge.examples.map((example, index) => (
                    <div key={`example-${challenge.id}-${index}-${example.substring(0, 20)}`} className="flex gap-2">
                      <span className="text-green-700 font-bold text-xs flex-shrink-0">{index + 1}.</span>
                      <p className="text-xs text-green-800 italic">{example}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <ChallengeActions
              challenge={challenge}
              loading={loading}
              showFeedbackForm={showFeedbackForm}
              feedbackComment={feedbackComment}
              setFeedbackComment={setFeedbackComment}
              setShowFeedbackForm={setShowFeedbackForm}
              onComplete={handleComplete}
            />
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
