import React from 'react';
import PropTypes from 'prop-types';
import { MessageSquare, RefreshCw, Award } from 'lucide-react';
import { LABEL_DECOUVERTE } from '../../lib/constants';
import { EmptyState } from './shared';
import { ChallengeResultBadge } from './DebriefCard';

export function ChallengeTab({
  dailyChallenge,
  stats,
  loading,
  selectedCompetence,
  onSelectCompetence,
  showFeedbackForm,
  feedbackComment,
  onFeedbackCommentChange,
  onShowFeedbackForm,
  onHideFeedbackForm,
  onComplete,
  onRefresh,
  onOpenHistory
}) {
  return (
    <div>
      {dailyChallenge ? (
        <div>
          {/* Competence Dropdown */}
          <div className="bg-gradient-to-r from-purple-50 to-indigo-50 p-4 border-b-2 border-purple-100">
            <label className="block text-xs text-gray-700 font-semibold mb-2">
              🎯 Compétence à travailler :
            </label>
            <select
              value={selectedCompetence || ''}
              onChange={(e) => onSelectCompetence(e.target.value || null)}
              className="w-full px-4 py-2 bg-white border-2 border-purple-200 rounded-lg text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all cursor-pointer hover:border-purple-300"
            >
              <option value="">🎲 Aléatoire (Recommandé)</option>
              <option value="accueil">👋 Accueil</option>
              <option value="decouverte">🔍 {LABEL_DECOUVERTE}</option>
              <option value="argumentation">💬 Argumentation</option>
              <option value="closing">✅ Closing</option>
              <option value="fidelisation">💎 Fidélisation</option>
            </select>
          </div>

          {/* Statistics Section - Compact */}
          {stats && (
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 px-4 py-2 border-b border-purple-100">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-gray-600 font-semibold">📊 Stats</span>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <span className="text-sm">🏆</span>
                    <span className="text-sm font-bold text-gray-800">{stats.completed_count}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-sm">✅</span>
                    <span className="text-sm font-bold text-green-600">{stats.success_count}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-sm">💪</span>
                    <span className="text-sm font-bold text-orange-500">{stats.partial_count}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-sm">❌</span>
                    <span className="text-sm font-bold text-red-600">{stats.failed_count}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="p-6">
            {/* Action buttons */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={onOpenHistory}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-2 px-4 rounded-lg transition-all flex items-center justify-center gap-2"
              >
                <MessageSquare className="w-4 h-4" />
                📜 Historique
              </button>
              {dailyChallenge.completed ? (
                <button
                  onClick={onRefresh}
                  disabled={loading}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                  Lancer un nouveau défi
                </button>
              ) : (
                <button
                  onClick={onRefresh}
                  disabled={loading}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-2 px-4 rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  Lancer un nouveau défi
                </button>
              )}
            </div>

            <div className="bg-gradient-to-r from-orange-50 to-red-50 rounded-xl p-4 border-2 border-orange-200">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-0.5 bg-[#F97316] text-white text-xs font-bold rounded-full">
                  {dailyChallenge.competence ? dailyChallenge.competence.toUpperCase() : 'CHALLENGE'}
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
                    onClick={onShowFeedbackForm}
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
                        onClick={() => onComplete('success')}
                        disabled={loading}
                        className="bg-gradient-to-r from-green-500 to-green-600 hover:shadow-lg text-white font-bold py-2 px-3 rounded-lg transition-all disabled:opacity-50 flex flex-col items-center gap-0.5"
                      >
                        <span className="text-xl">✅</span>
                        <span className="text-xs">Réussi</span>
                      </button>
                      <button
                        onClick={() => onComplete('partial')}
                        disabled={loading}
                        className="bg-gradient-to-r from-orange-500 to-orange-600 hover:shadow-lg text-white font-bold py-2 px-3 rounded-lg transition-all disabled:opacity-50 flex flex-col items-center gap-0.5"
                      >
                        <span className="text-xl">⚠️</span>
                        <span className="text-xs">Difficile</span>
                      </button>
                      <button
                        onClick={() => onComplete('failed')}
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
                        onChange={(e) => onFeedbackCommentChange(e.target.value)}
                        placeholder="Commentaire optionnel..."
                        className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
                        rows={2}
                      />
                    </div>
                    <button
                      onClick={onHideFeedbackForm}
                      className="w-full text-xs text-gray-600 hover:text-gray-800 py-1 transition-colors"
                    >
                      Annuler
                    </button>
                  </div>
                )
              ) : (
                <ChallengeResultBadge challengeResult={dailyChallenge.challenge_result} />
              )}
            </div>
          </div>
        </div>
      ) : (
        <EmptyState
          icon={Award}
          title="Aucun challenge actif"
          subtitle="Votre prochain challenge sera bientôt disponible"
          action={
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="px-6 py-3 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition-all inline-flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Générer un challenge
            </button>
          }
        />
      )}
    </div>
  );
}

ChallengeTab.propTypes = {
  dailyChallenge: PropTypes.object,
  stats: PropTypes.shape({
    completed_count: PropTypes.number,
    success_count: PropTypes.number,
    partial_count: PropTypes.number,
    failed_count: PropTypes.number
  }),
  loading: PropTypes.bool.isRequired,
  selectedCompetence: PropTypes.string,
  onSelectCompetence: PropTypes.func.isRequired,
  showFeedbackForm: PropTypes.bool.isRequired,
  feedbackComment: PropTypes.string.isRequired,
  onFeedbackCommentChange: PropTypes.func.isRequired,
  onShowFeedbackForm: PropTypes.func.isRequired,
  onHideFeedbackForm: PropTypes.func.isRequired,
  onComplete: PropTypes.func.isRequired,
  onRefresh: PropTypes.func.isRequired,
  onOpenHistory: PropTypes.func.isRequired
};
