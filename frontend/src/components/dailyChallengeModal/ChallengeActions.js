import React from 'react';

export default function ChallengeActions({ challenge, loading, showFeedbackForm, feedbackComment, setFeedbackComment, setShowFeedbackForm, onComplete }) {
  if (challenge.completed) {
    return (
      <div className="space-y-2">
        <div className={`rounded-lg p-3 flex items-center justify-center gap-2 ${
          challenge.challenge_result === 'success' ? 'bg-gradient-to-r from-green-100 to-green-200 text-green-800' :
          challenge.challenge_result === 'partial' ? 'bg-gradient-to-r from-orange-100 to-orange-200 text-orange-800' :
          'bg-gradient-to-r from-red-100 to-red-200 text-red-800'
        }`}>
          <span className="text-xl">
            {challenge.challenge_result === 'success' ? '🎉' : challenge.challenge_result === 'partial' ? '💪' : '🤔'}
          </span>
          <span className="font-bold text-sm">
            {challenge.challenge_result === 'success' ? 'Défi réussi !' : challenge.challenge_result === 'partial' ? 'Défi difficile' : 'Défi non réussi'}
          </span>
        </div>
        {challenge.feedback_comment && (
          <div className="bg-white rounded-lg p-2 border border-gray-200">
            <p className="text-xs font-semibold text-gray-600 mb-0.5">Ton commentaire :</p>
            <p className="text-xs text-gray-800 italic">{challenge.feedback_comment}</p>
          </div>
        )}
      </div>
    );
  }

  if (!showFeedbackForm) {
    return (
      <button
        onClick={() => setShowFeedbackForm(true)}
        disabled={loading}
        className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:shadow-lg text-white font-bold py-3 px-6 rounded-lg transition-all disabled:opacity-50"
      >
        ✅ J'ai relevé le défi !
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-gray-700">Comment ça s'est passé ?</p>
      <div className="grid grid-cols-3 gap-2">
        <button onClick={() => onComplete('success')} disabled={loading}
          className="bg-gradient-to-r from-green-500 to-green-600 hover:shadow-lg text-white font-bold py-2 px-3 rounded-lg transition-all disabled:opacity-50 flex flex-col items-center gap-0.5">
          <span className="text-xl">✅</span><span className="text-xs">Réussi</span>
        </button>
        <button onClick={() => onComplete('partial')} disabled={loading}
          className="bg-gradient-to-r from-orange-500 to-orange-600 hover:shadow-lg text-white font-bold py-2 px-3 rounded-lg transition-all disabled:opacity-50 flex flex-col items-center gap-0.5">
          <span className="text-xl">⚠️</span><span className="text-xs">Difficile</span>
        </button>
        <button onClick={() => onComplete('failed')} disabled={loading}
          className="bg-gradient-to-r from-red-500 to-red-600 hover:shadow-lg text-white font-bold py-2 px-3 rounded-lg transition-all disabled:opacity-50 flex flex-col items-center gap-0.5">
          <span className="text-xl">❌</span><span className="text-xs">Échoué</span>
        </button>
      </div>
      <textarea
        value={feedbackComment}
        onChange={(e) => setFeedbackComment(e.target.value)}
        placeholder="Commentaire optionnel..."
        className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
        rows={2}
      />
      <button
        onClick={() => { setShowFeedbackForm(false); setFeedbackComment(''); }}
        className="w-full text-xs text-gray-600 hover:text-gray-800 py-1 transition-colors"
      >
        Annuler
      </button>
    </div>
  );
}
