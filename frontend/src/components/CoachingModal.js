import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { X, Award, MessageSquare } from 'lucide-react';
import ChallengeHistoryModal from './ChallengeHistoryModal';
import { api } from '../lib/apiClient';
import { logger } from '../utils/logger';
import { getSubscriptionErrorMessage } from '../utils/apiHelpers';
import { useAuth } from '../contexts';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import { TabButton } from './coachingModal/shared';
import { ChallengeTab } from './coachingModal/ChallengeTab';
import { AnalyseTab } from './coachingModal/AnalyseTab';

export default function CoachingModal({
  isOpen,
  onClose,
  dailyChallenge,
  onRefreshChallenge,
  onCompleteChallenge,
  onOpenChallengeHistory,
  debriefs = [],
  onCreateDebrief,
  activeTab: initialTab = 'coach'
}) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(initialTab);
  const [analyseSubTab, setAnalyseSubTab] = useState('conclue');
  const [showChallengeHistoryModal, setShowChallengeHistoryModal] = useState(false);

  // Challenge states
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [expandedDebriefs, setExpandedDebriefs] = useState({});
  const [selectedCompetence, setSelectedCompetence] = useState(null);

  // Filter state for historique
  const [historyFilter, setHistoryFilter] = useState('all');

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
      confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0 }, colors });
      confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1 }, colors });
      if (Date.now() < end) requestAnimationFrame(frame);
    }());
  };

  const handleComplete = async (result) => {
    if (!result) {
      setShowFeedbackForm(true);
      return;
    }

    setLoading(true);
    try {
      await api.post('/seller/daily-challenge/complete', {
        challenge_id: dailyChallenge.id,
        result,
        comment: feedbackComment
      });

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

      if (onCompleteChallenge) onCompleteChallenge();
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
      const res = await api.post('/seller/daily-challenge/refresh', { competence: selectedCompetence });
      if (onRefreshChallenge) onRefreshChallenge(res.data);
      toast.success('✨ Nouveau défi généré !');
    } catch (err) {
      logger.error('Error refreshing challenge:', err);
      toast.error(getSubscriptionErrorMessage(err, user?.role) || 'Erreur lors de la génération du défi');
    } finally {
      setLoading(false);
    }
  };

  const toggleDebrief = (debriefId) => {
    setExpandedDebriefs(prev => ({ ...prev, [debriefId]: !prev[debriefId] }));
  };

  const handleDeleteDebrief = async (debriefId) => {
    if (!globalThis.confirm('Êtes-vous sûr de vouloir supprimer cette analyse ?')) return;

    try {
      await api.delete(`/debriefs/${debriefId}`);
      toast.success('Analyse supprimée');
      if (onCreateDebrief) await onCreateDebrief();
    } catch (err) {
      logger.error('Error deleting debrief:', err);
      toast.error('Erreur lors de la suppression');
    }
  };

  const handleToggleVisibility = async (debriefId, currentVisibility) => {
    try {
      await api.patch(`/debriefs/${debriefId}/visibility`, { shared_with_manager: !currentVisibility });
      toast.success(!currentVisibility ? 'Partagé avec le manager' : 'Partagé uniquement avec moi');
      if (onCreateDebrief) await onCreateDebrief();
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
              <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors">
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
              <ChallengeTab
                dailyChallenge={dailyChallenge}
                stats={stats}
                loading={loading}
                selectedCompetence={selectedCompetence}
                onSelectCompetence={setSelectedCompetence}
                showFeedbackForm={showFeedbackForm}
                feedbackComment={feedbackComment}
                onFeedbackCommentChange={setFeedbackComment}
                onShowFeedbackForm={() => setShowFeedbackForm(true)}
                onHideFeedbackForm={() => { setShowFeedbackForm(false); setFeedbackComment(''); }}
                onComplete={handleComplete}
                onRefresh={handleRefresh}
                onOpenHistory={() => setShowChallengeHistoryModal(true)}
              />
            )}

            {activeTab === 'analyse' && (
              <AnalyseTab
                analyseSubTab={analyseSubTab}
                onSetAnalyseSubTab={setAnalyseSubTab}
                debriefs={debriefs}
                expandedDebriefs={expandedDebriefs}
                historyFilter={historyFilter}
                onSetHistoryFilter={setHistoryFilter}
                onCreateDebrief={onCreateDebrief}
                onToggleDebrief={toggleDebrief}
                onToggleVisibility={handleToggleVisibility}
                onDeleteDebrief={handleDeleteDebrief}
                onSetExpandedDebriefs={setExpandedDebriefs}
              />
            )}
          </div>
        </div>
      </div>

      {showChallengeHistoryModal && (
        <ChallengeHistoryModal onClose={() => setShowChallengeHistoryModal(false)} />
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
  activeTab: PropTypes.string
};
