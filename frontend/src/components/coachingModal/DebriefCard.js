import React from 'react';
import PropTypes from 'prop-types';
import { Eye, EyeOff, CheckCircle, XCircle, Trash2, Share2, Lock } from 'lucide-react';
import { renderMarkdownBold } from '../../utils/markdownRenderer';

export function getChallengeResultDisplay(result) {
  if (result === 'success') {
    return { resultClass: 'bg-gradient-to-r from-green-100 to-green-200 text-green-800', emoji: '🎉', label: 'Défi Réussi !' };
  }
  if (result === 'partial') {
    return { resultClass: 'bg-gradient-to-r from-orange-100 to-orange-200 text-orange-800', emoji: '💪', label: 'C\'était difficile' };
  }
  return { resultClass: 'bg-gradient-to-r from-red-100 to-red-200 text-red-800', emoji: '🤔', label: 'Pas cette fois' };
}

export function ChallengeResultBadge({ challengeResult }) {
  const { resultClass, emoji, label } = getChallengeResultDisplay(challengeResult);
  return (
    <div className={`rounded-lg p-3 flex items-center justify-center gap-2 ${resultClass}`}>
      <span className="text-xl">{emoji}</span>
      <span className="font-bold">{label}</span>
    </div>
  );
}
ChallengeResultBadge.propTypes = {
  challengeResult: PropTypes.oneOf(['success', 'partial', 'failed']).isRequired
};

const aiFeedbackShape = PropTypes.shape({
  analyse: PropTypes.string,
  points_travailler: PropTypes.string,
  recommandation: PropTypes.string,
  exemple_concret: PropTypes.string
});

export function DebriefCard({ debrief, isExpanded, onToggle, onToggleVisibility, onDelete }) {
  const visibilityClass = debrief.visible_to_manager ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700';
  const visibilityLabel = debrief.visible_to_manager ? 'Partagé avec le manager' : 'Privé - visible uniquement par vous';
  return (
    <div
      data-debrief-card
      data-debrief-id={debrief.id}
      className="relative bg-gradient-to-r from-green-50 to-teal-50 rounded-xl border-2 border-green-200 cursor-pointer hover:shadow-lg transition-shadow"
    >
      <button
        type="button"
        className="absolute inset-0 w-full h-full rounded-xl z-0 focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-inset"
        onClick={() => onToggle(debrief.id)}
        aria-label={isExpanded ? 'Masquer les détails de l\'analyse' : 'Afficher les détails de l\'analyse'}
      />
      <div className="relative z-10 p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
            {debrief.vente_conclue ? <CheckCircle className="w-6 h-6 text-white" /> : <XCircle className="w-6 h-6 text-white" />}
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-bold text-gray-800">
                {debrief.vente_conclue ? '✅ Vente conclue' : '❌ Opportunité manquée'}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onToggle(debrief.id); }}
                  className="p-1 hover:bg-white/50 rounded transition-colors"
                  title={isExpanded ? 'Masquer les détails' : 'Voir les détails'}
                >
                  {isExpanded ? <EyeOff className="w-4 h-4 text-gray-600" /> : <Eye className="w-4 h-4 text-gray-600" />}
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">
                {new Date(debrief.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onToggleVisibility(debrief.id, debrief.visible_to_manager); }}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all ${visibilityClass}`}
                  title={visibilityLabel}
                  aria-label={visibilityLabel}
                >
                  {debrief.visible_to_manager ? <><Share2 className="w-3 h-3" /> Partagé</> : <><Lock className="w-3 h-3" /> Privé</>}
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onDelete(debrief.id); }}
                  className="p-1 hover:bg-red-100 rounded transition-colors"
                  title="Supprimer l'analyse"
                  aria-label="Supprimer l'analyse"
                >
                  <Trash2 className="w-4 h-4 text-red-600" />
                </button>
              </div>
            </div>
            {isExpanded && (
              <div className="bg-white rounded-lg p-4 border border-green-200 mt-2 space-y-3">
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1">📦 Produit</p>
                  <p className="text-sm text-gray-700">{debrief.produit}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1">👤 Type de client</p>
                  <p className="text-sm text-gray-700">{debrief.type_client}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1">✨ Moments clés</p>
                  <p className="text-sm text-gray-700">{debrief.moment_perte_client}</p>
                </div>
                <div className="pt-3 border-t border-gray-200">
                  <p className="text-xs font-semibold text-purple-600 mb-2">🤖 Analyse du Coach IA</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{renderMarkdownBold(debrief.ai_analyse || debrief.ai_feedback?.analyse || debrief.analysis || debrief.feedback || 'Analyse en cours...')}</p>
                </div>
                {(debrief.ai_points_travailler || debrief.ai_feedback?.points_travailler) && (
                  <div className="bg-yellow-50 rounded p-3">
                    <p className="text-xs font-semibold text-yellow-700 mb-1">💪 Points forts identifiés</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{renderMarkdownBold(debrief.ai_points_travailler || debrief.ai_feedback?.points_travailler)}</p>
                  </div>
                )}
                {(debrief.ai_recommandation || debrief.ai_feedback?.recommandation) && (
                  <div className="bg-blue-50 rounded p-3">
                    <p className="text-xs font-semibold text-blue-700 mb-1">💡 Recommandation</p>
                    <p className="text-sm text-gray-700">{renderMarkdownBold(debrief.ai_recommandation || debrief.ai_feedback?.recommandation)}</p>
                  </div>
                )}
                {(debrief.ai_exemple_concret || debrief.ai_feedback?.exemple_concret) && (
                  <div className="bg-green-50 rounded p-3">
                    <p className="text-xs font-semibold text-green-700 mb-1">📝 Exemple concret</p>
                    <p className="text-sm text-gray-700">{renderMarkdownBold(debrief.ai_exemple_concret || debrief.ai_feedback?.exemple_concret)}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

DebriefCard.propTypes = {
  debrief: PropTypes.shape({
    id: PropTypes.string.isRequired,
    vente_conclue: PropTypes.bool,
    created_at: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
    visible_to_manager: PropTypes.bool,
    produit: PropTypes.string,
    type_client: PropTypes.string,
    moment_perte_client: PropTypes.string,
    ai_analyse: PropTypes.string,
    ai_points_travailler: PropTypes.string,
    ai_recommandation: PropTypes.string,
    ai_exemple_concret: PropTypes.string,
    analysis: PropTypes.string,
    feedback: PropTypes.string,
    ai_feedback: aiFeedbackShape
  }).isRequired,
  isExpanded: PropTypes.bool.isRequired,
  onToggle: PropTypes.func.isRequired,
  onToggleVisibility: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired
};
