import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { X, Award, MessageSquare, RefreshCw, Eye, EyeOff, CheckCircle, XCircle, Trash2, Share2, Lock, Filter } from 'lucide-react';
import ChallengeHistoryModal from './ChallengeHistoryModal';
import VenteConclueForm from './VenteConclueForm';
import OpportuniteManqueeForm from './OpportuniteManqueeForm';
import { api } from '../lib/apiClient';
import { LABEL_DECOUVERTE } from '../lib/constants';
import { logger } from '../utils/logger';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import { renderMarkdownBold } from '../utils/markdownRenderer';

const TAB_BUTTON_BASE_CLASS = 'px-3 md:px-4 py-2 text-sm md:text-base font-semibold transition-all rounded-t-lg';

function getCompetenceBadgeLabel(competence) {
  return competence ? String(competence).toUpperCase() : 'CHALLENGE';
}

function TabButton({ active, onClick, children, activeClass, inactiveClass, baseClass = TAB_BUTTON_BASE_CLASS }) {
  const className = `${baseClass} ${active ? activeClass : inactiveClass}`;
  return (
    <button type="button" onClick={onClick} className={className}>
      {children}
    </button>
  );
}
TabButton.propTypes = {
  active: PropTypes.bool.isRequired,
  onClick: PropTypes.func.isRequired,
  children: PropTypes.node.isRequired,
  activeClass: PropTypes.string.isRequired,
  inactiveClass: PropTypes.string.isRequired,
  baseClass: PropTypes.string
};

function EmptyState({ icon: Icon, title, subtitle, action }) {
  return (
    <div className="text-center py-12 px-6 text-gray-500">
      {Icon && <Icon className="w-16 h-16 mx-auto mb-4 text-gray-300" />}
      <p className="text-lg font-semibold mb-2">{title}</p>
      <p className="text-sm mb-4">{subtitle}</p>
      {action}
    </div>
  );
}
EmptyState.propTypes = {
  icon: PropTypes.elementType,
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string.isRequired,
  action: PropTypes.node
};

function getChallengeResultDisplay(result) {
  if (result === 'success') {
    return { resultClass: 'bg-gradient-to-r from-green-100 to-green-200 text-green-800', emoji: '🎉', label: 'Défi Réussi !' };
  }
  if (result === 'partial') {
    return { resultClass: 'bg-gradient-to-r from-orange-100 to-orange-200 text-orange-800', emoji: '💪', label: 'C\'était difficile' };
  }
  return { resultClass: 'bg-gradient-to-r from-red-100 to-red-200 text-red-800', emoji: '🤔', label: 'Pas cette fois' };
}

function getHistoryEmptyTitle(historyFilter) {
  if (historyFilter === 'all') return 'Aucune analyse pour le moment';
  if (historyFilter === 'conclue') return 'Aucune vente conclue';
  return 'Aucune opportunité manquée';
}

function getHistoryEmptySubtitle(historyFilter) {
  return historyFilter === 'all'
    ? 'Créez votre première analyse de vente pour recevoir un coaching personnalisé'
    : 'Aucune analyse de ce type pour le moment';
}

function getHistoryListLabel(historyFilter, count) {
  if (historyFilter === 'all') return `Toutes vos analyses (${count})`;
  if (historyFilter === 'conclue') return `Ventes conclues (${count})`;
  return `Opportunités manquées (${count})`;
}

function ChallengeResultBadge({ challengeResult }) {
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

function DebriefCard({ debrief, isExpanded, onToggle, onToggleVisibility, onDelete }) {
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

const aiFeedbackShape = PropTypes.shape({
  analyse: PropTypes.string,
  points_travailler: PropTypes.string,
  recommandation: PropTypes.string,
  exemple_concret: PropTypes.string
});

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
  
  // Challenge states
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [expandedDebriefs, setExpandedDebriefs] = useState({});
  const [selectedCompetence, setSelectedCompetence] = useState(null);
  
  // Filter state for historique
  const [historyFilter, setHistoryFilter] = useState('all'); // 'all', 'conclue', 'manquee'

  useEffect(() => {
    if (isOpen && activeTab === 'coach') {
      fetchStats();
    }
  }, [isOpen, activeTab]);

  const fetchStats = async () => {
    try {
      const res = await api.get('/seller/daily-challenge/stats');
      setStats(res.data);
    } catch (err) {
      logger.error('Error fetching stats:', err);
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
      await api.post(
        '/seller/daily-challenge/complete',
        {
          challenge_id: dailyChallenge.id,
          result,
          comment: feedbackComment
        }
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
      logger.error('Error completing challenge:', err);
      toast.error('Erreur lors de la validation');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setLoading(true);
    try {
      const res = await api.post(
        '/seller/daily-challenge/refresh',
        { competence: selectedCompetence }
      );
      
      if (onRefreshChallenge) {
        onRefreshChallenge(res.data);
      }
      
      toast.success('✨ Nouveau défi généré !');
    } catch (err) {
      logger.error('Error refreshing challenge:', err);
      toast.error('Erreur lors de la génération du défi');
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

  const handleDeleteDebrief = async (debriefId) => {
    if (!globalThis.confirm('Êtes-vous sûr de vouloir supprimer cette analyse ?')) {
      return;
    }
    
    try {
      await api.delete(`/debriefs/${debriefId}`);
      toast.success('Analyse supprimée');
      if (onCreateDebrief) {
        await onCreateDebrief();
      }
    } catch (err) {
      logger.error('Error deleting debrief:', err);
      toast.error('Erreur lors de la suppression');
    }
  };

  const handleToggleVisibility = async (debriefId, currentVisibility) => {
    try {
      await api.patch(
        `/debriefs/${debriefId}/visibility`,
        { shared_with_manager: !currentVisibility }
      );
      toast.success(!currentVisibility ? 'Partagé avec le manager' : 'Partagé uniquement avec moi');
      if (onCreateDebrief) {
        await onCreateDebrief();
      }
    } catch (err) {
      logger.error('Error updating visibility:', err);
      toast.error('Erreur lors de la mise à jour');
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[95vh] sm:max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-900 via-indigo-800 to-teal-800 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">🤖 Mon coach IA</h2>
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
            <div className="flex gap-0.5 px-2 md:px-6">
              <TabButton
                active={activeTab === 'coach'}
                onClick={() => setActiveTab('coach')}
                activeClass="bg-purple-300 text-gray-800 shadow-md border-b-4 border-purple-500"
                inactiveClass="text-gray-600 hover:text-purple-600 hover:bg-gray-100"
              >
                <div className="flex items-center justify-center gap-1.5">
                  <Award className="w-4 h-4" />
                  <span>Mon défi du jour</span>
                </div>
              </TabButton>
              <TabButton
                active={activeTab === 'analyse'}
                onClick={() => setActiveTab('analyse')}
                activeClass="bg-purple-300 text-gray-800 shadow-md border-b-4 border-purple-500"
                inactiveClass="text-gray-600 hover:text-purple-600 hover:bg-gray-100"
              >
                <div className="flex items-center justify-center gap-1.5">
                  <MessageSquare className="w-4 h-4" />
                  <span>Analyser mes ventes</span>
                </div>
              </TabButton>
            </div>
          </div>

          {/* Contenu */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === 'coach' && (
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
                        onChange={(e) => setSelectedCompetence(e.target.value || null)}
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
                            Lancer un nouveau défi
                          </button>
                        ) : (
                          <button
                            onClick={handleRefresh}
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
                            {(() => {
                              const competenceLabel = dailyChallenge.competence ? dailyChallenge.competence.toUpperCase() : 'CHALLENGE';
                              return competenceLabel;
                            })()}
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
                        onClick={handleRefresh}
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
            )}

            {activeTab === 'analyse' && (
              <div>
                {/* Sous-onglets Analyse */}
                <div className="border-b border-gray-200 bg-gray-50 px-6 pt-3">
                  <div className="flex gap-2">
                    <TabButton
                      active={analyseSubTab === 'conclue'}
                      onClick={() => setAnalyseSubTab('conclue')}
                      baseClass="px-4 py-2 font-medium text-sm transition-all rounded-t-lg"
                      activeClass="bg-green-100 text-green-700 border-b-2 border-green-500"
                      inactiveClass="text-gray-600 hover:text-green-600 hover:bg-gray-100"
                    >
                      <CheckCircle className="w-4 h-4 inline mr-1" />
                      Vente conclue
                    </TabButton>
                    <TabButton
                      active={analyseSubTab === 'manquee'}
                      onClick={() => setAnalyseSubTab('manquee')}
                      activeClass="px-4 py-2 bg-orange-100 text-orange-700 border-b-2 border-orange-500"
                      inactiveClass="px-4 py-2 text-gray-600 hover:text-orange-600 hover:bg-gray-100"
                    >
                      <XCircle className="w-4 h-4 inline mr-1" />
                      Opportunité manquée
                    </TabButton>
                    <TabButton
                      active={analyseSubTab === 'historique'}
                      onClick={() => setAnalyseSubTab('historique')}
                      baseClass="px-4 py-2 font-medium text-sm transition-all rounded-t-lg"
                      activeClass="bg-purple-100 text-purple-700 border-b-2 border-purple-500"
                      inactiveClass="text-gray-600 hover:text-purple-600 hover:bg-gray-100"
                    >
                      <MessageSquare className="w-4 h-4 inline mr-1" />
                      Historique ({debriefs.length})
                    </TabButton>
                  </div>
                </div>

                {/* Contenu des sous-onglets */}
                {analyseSubTab === 'conclue' && (
                  <VenteConclueForm 
                    token={token} 
                    onSuccess={async (newDebrief) => {
                      if (onCreateDebrief) {
                        await onCreateDebrief();
                      }
                      // Passer automatiquement à l'onglet Historique
                      setAnalyseSubTab('historique');
                      // Attendre que le DOM soit mis à jour avec la nouvelle liste
                      setTimeout(() => {
                        // Récupérer le premier élément dans le DOM (la plus récente analyse)
                        const firstAnalysis = document.querySelector('[data-debrief-card]');
                        if (firstAnalysis) {
                          const debriefId = firstAnalysis.dataset.debriefId;
                          logger.log('Opening debrief:', debriefId);
                          if (debriefId) {
                            // Déplier la première analyse
                            setExpandedDebriefs(prev => ({ [debriefId]: true }));
                          }
                          // Scroller vers la première analyse
                          setTimeout(() => {
                            firstAnalysis.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          }, 200);
                        }
                      }, 1200);
                    }} 
                  />
                )}

                {analyseSubTab === 'manquee' && (
                  <OpportuniteManqueeForm 
                    token={token} 
                    onSuccess={async (newDebrief) => {
                      if (onCreateDebrief) {
                        await onCreateDebrief();
                      }
                      // Passer automatiquement à l'onglet Historique
                      setAnalyseSubTab('historique');
                      // Attendre que le DOM soit mis à jour avec la nouvelle liste
                      setTimeout(() => {
                        // Récupérer le premier élément dans le DOM (la plus récente analyse)
                        const firstAnalysis = document.querySelector('[data-debrief-card]');
                        if (firstAnalysis) {
                          const debriefId = firstAnalysis.dataset.debriefId;
                          logger.log('Opening debrief:', debriefId);
                          if (debriefId) {
                            // Déplier la première analyse
                            setExpandedDebriefs(prev => ({ [debriefId]: true }));
                          }
                          // Scroller vers la première analyse
                          setTimeout(() => {
                            firstAnalysis.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          }, 200);
                        }
                      }, 1200);
                    }} 
                  />
                )}

                {analyseSubTab === 'historique' && (
                  <div>
                    {/* Filtres */}
                    <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <Filter className="w-4 h-4 text-gray-600" />
                          <span className="text-sm font-semibold text-gray-700">Filtrer par type :</span>
                        </div>
                        
                        <div className="flex gap-2">
                          <TabButton
                            active={historyFilter === 'all'}
                            onClick={() => setHistoryFilter('all')}
                            baseClass="px-3 py-1.5 text-sm rounded-lg transition-all"
                            activeClass="bg-purple-600 text-white shadow-md"
                            inactiveClass="bg-white text-gray-700 border border-gray-300 hover:bg-gray-100"
                          >
                            Tous
                          </TabButton>
                          <TabButton
                            active={historyFilter === 'conclue'}
                            onClick={() => setHistoryFilter('conclue')}
                            baseClass="px-3 py-1.5 text-sm rounded-lg transition-all flex items-center gap-1"
                            activeClass="bg-green-600 text-white shadow-md"
                            inactiveClass="bg-white text-gray-700 border border-gray-300 hover:bg-gray-100"
                          >
                            <CheckCircle className="w-4 h-4" />
                            Ventes conclues
                          </TabButton>
                          <TabButton
                            active={historyFilter === 'manquee'}
                            onClick={() => setHistoryFilter('manquee')}
                            baseClass="px-3 py-1.5 text-sm rounded-lg transition-all flex items-center gap-1"
                            activeClass="bg-orange-600 text-white shadow-md"
                            inactiveClass="bg-white text-gray-700 border border-gray-300 hover:bg-gray-100"
                          >
                            <XCircle className="w-4 h-4" />
                            Opportunités manquées
                          </TabButton>
                        </div>
                      </div>
                    </div>

                    <div className="p-6">
                      {(() => {
                        // Filter debriefs based on selected filter
                        const filteredDebriefs = debriefs.filter(debrief => {
                          if (historyFilter === 'all') return true;
                          if (historyFilter === 'conclue') return debrief.vente_conclue === true;
                          if (historyFilter === 'manquee') return debrief.vente_conclue === false;
                          return true;
                        });
                        
                        const emptyTitle = getHistoryEmptyTitle(historyFilter);
                        const emptySubtitle = getHistoryEmptySubtitle(historyFilter);
                        const listLabel = getHistoryListLabel(historyFilter, filteredDebriefs.length);

                        return filteredDebriefs.length > 0 ? (
                          <div className="space-y-4">
                            <p className="text-sm text-gray-600 mb-4">{listLabel}</p>
                            {filteredDebriefs.map((debrief) => (
                              <DebriefCard
                                key={debrief.id}
                                debrief={debrief}
                                isExpanded={!!expandedDebriefs[debrief.id]}
                                onToggle={toggleDebrief}
                                onToggleVisibility={handleToggleVisibility}
                                onDelete={handleDeleteDebrief}
                              />
                            ))}
                          </div>
                        ) : (
                          <EmptyState
                            icon={MessageSquare}
                            title={emptyTitle}
                            subtitle={emptySubtitle}
                          />
                        );
                      })()}
                    </div>
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

    </>
  );
}
CoachingModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  dailyChallenge: PropTypes.object,
  onRefreshChallenge: PropTypes.func,
  onCompleteChallenge: PropTypes.func,
  onOpenChallengeHistory: PropTypes.func,
  debriefs: PropTypes.arrayOf(PropTypes.object),
  onCreateDebrief: PropTypes.func,
  token: PropTypes.string,
  activeTab: PropTypes.string
};

