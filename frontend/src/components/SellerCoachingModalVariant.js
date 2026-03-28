/**
 * SellerCoachingModalVariant — STAGING UNIQUEMENT
 *
 * B — "Dark Coach" : header violet sombre, onglets en pills,
 *     fond très sombre pour l'immersion, accent violet/indigo.
 *
 * C — "Bright Coach" : header dégradé violet-indigo lumineux,
 *     onglets underline, fond clair et aéré.
 */
import React, { useState } from 'react';
import { X, Award, MessageSquare, Sparkles, Brain } from 'lucide-react';
import { useAuth } from '../contexts';
import { useQueryClient } from '@tanstack/react-query';
import { useDailyChallengeStats } from '../hooks/useDailyChallengeStats';
import { api } from '../lib/apiClient';
import { logger } from '../utils/logger';
import { getSubscriptionErrorMessage } from '../utils/apiHelpers';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import ChallengeHistoryModal from './ChallengeHistoryModal';
import { ChallengeTab } from './coachingModal/ChallengeTab';
import { AnalyseTab } from './coachingModal/AnalyseTab';

function useCoachingState({ isOpen, dailyChallenge, onRefreshChallenge, onCompleteChallenge, onOpenChallengeHistory, debriefs, onCreateDebrief }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('coach');
  const [analyseSubTab, setAnalyseSubTab] = useState('conclue');
  const [showChallengeHistoryModal, setShowChallengeHistoryModal] = useState(false);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [loading, setLoading] = useState(false);
  const { data: stats } = useDailyChallengeStats();
  const [expandedDebriefs, setExpandedDebriefs] = useState({});
  const [selectedCompetence, setSelectedCompetence] = useState(null);
  const [historyFilter, setHistoryFilter] = useState('all');

  const handleCompleteChallenge = async (challengeId, feedbackData = {}) => {
    if (!challengeId) return;
    setLoading(true);
    try {
      await api.post(`/seller/challenges/${challengeId}/complete`, feedbackData);
      queryClient.invalidateQueries({ queryKey: ['dailyChallengeStats'] });
      if (onCompleteChallenge) await onCompleteChallenge();
      toast.success('Défi complété ! 🎉');
      try { const fn = confetti || globalThis.confetti; if (fn) fn({ particleCount: 100, spread: 70, origin: { y: 0.6 } }); } catch {}
    } catch (err) {
      const msg = getSubscriptionErrorMessage(err, user?.role);
      toast.error(msg || 'Erreur lors de la complétion');
      logger.error('Complete challenge error:', err);
    } finally { setLoading(false); }
  };

  const handleRefreshChallenge = async () => {
    if (!onRefreshChallenge) return;
    setLoading(true);
    try { await onRefreshChallenge(); }
    catch (err) { logger.error('Refresh error:', err); toast.error('Erreur de rafraîchissement'); }
    finally { setLoading(false); }
  };

  const handleSubmitFeedback = async (challengeId) => {
    await handleCompleteChallenge(challengeId, { feedback: feedbackComment });
    setShowFeedbackForm(false); setFeedbackComment('');
  };

  return {
    user, activeTab, setActiveTab, analyseSubTab, setAnalyseSubTab,
    showChallengeHistoryModal, setShowChallengeHistoryModal,
    showFeedbackForm, setShowFeedbackForm, feedbackComment, setFeedbackComment,
    loading, stats, expandedDebriefs, setExpandedDebriefs,
    selectedCompetence, setSelectedCompetence, historyFilter, setHistoryFilter,
    handleCompleteChallenge, handleRefreshChallenge, handleSubmitFeedback,
    onOpenChallengeHistory, debriefs, onCreateDebrief,
  };
}

/* ══════════════════════════════════════
   STYLE B — Dark Coach
══════════════════════════════════════ */
function ModalVariantB({ isOpen, onClose, dailyChallenge, onRefreshChallenge, onCompleteChallenge, onOpenChallengeHistory, debriefs = [], onCreateDebrief }) {
  const s = useCoachingState({ isOpen, dailyChallenge, onRefreshChallenge, onCompleteChallenge, onOpenChallengeHistory, debriefs, onCreateDebrief });
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-violet-950 rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-violet-800">

        {/* Header violet sombre */}
        <div className="bg-violet-900 px-6 py-4 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-700 flex items-center justify-center">
                <Brain className="w-5 h-5 text-violet-300" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Mon Coach IA</h2>
                <p className="text-xs text-violet-400">Défis personnalisés · Analyse de ventes</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg bg-violet-800 hover:bg-violet-700 transition-colors">
              <X className="w-4 h-4 text-violet-300" />
            </button>
          </div>
          {/* Tabs pills */}
          <div className="flex gap-2">
            {[
              { id: 'coach', label: 'Mon Défi', icon: Award },
              { id: 'analyse', label: 'Analyse Ventes', icon: MessageSquare },
            ].map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => s.setActiveTab(id)}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-full transition-all ${
                  s.activeTab === id
                    ? 'bg-violet-500 text-white shadow-lg shadow-violet-500/30'
                    : 'bg-violet-800 text-violet-300 hover:bg-violet-700'
                }`}>
                <Icon className="w-4 h-4" />{label}
              </button>
            ))}
          </div>
        </div>

        {/* Content fond clair */}
        <div className="flex-1 overflow-y-auto bg-gray-50">
          {s.activeTab === 'coach' && (
            <ChallengeTab
              dailyChallenge={dailyChallenge} stats={s.stats} loading={s.loading}
              showFeedbackForm={s.showFeedbackForm} feedbackComment={s.feedbackComment}
              setShowFeedbackForm={s.setShowFeedbackForm} setFeedbackComment={s.setFeedbackComment}
              handleCompleteChallenge={s.handleCompleteChallenge}
              handleRefreshChallenge={s.handleRefreshChallenge}
              handleSubmitFeedback={s.handleSubmitFeedback}
              onOpenChallengeHistory={s.onOpenChallengeHistory}
            />
          )}
          {s.activeTab === 'analyse' && (
            <AnalyseTab
              debriefs={debriefs} expandedDebriefs={s.expandedDebriefs}
              setExpandedDebriefs={s.setExpandedDebriefs}
              selectedCompetence={s.selectedCompetence} setSelectedCompetence={s.setSelectedCompetence}
              historyFilter={s.historyFilter} setHistoryFilter={s.setHistoryFilter}
              analyseSubTab={s.analyseSubTab} setAnalyseSubTab={s.setAnalyseSubTab}
              onCreateDebrief={onCreateDebrief}
            />
          )}
        </div>
      </div>
      {s.showChallengeHistoryModal && (
        <ChallengeHistoryModal isOpen={s.showChallengeHistoryModal} onClose={() => s.setShowChallengeHistoryModal(false)} />
      )}
    </div>
  );
}

/* ══════════════════════════════════════
   STYLE C — Bright Coach
══════════════════════════════════════ */
function ModalVariantC({ isOpen, onClose, dailyChallenge, onRefreshChallenge, onCompleteChallenge, onOpenChallengeHistory, debriefs = [], onCreateDebrief }) {
  const s = useCoachingState({ isOpen, dailyChallenge, onRefreshChallenge, onCompleteChallenge, onOpenChallengeHistory, debriefs, onCreateDebrief });
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-gray-100">

        {/* Header dégradé violet-indigo */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-8 py-5 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Mon Coach IA</h2>
                <p className="text-sm text-purple-200">Défis · Analyse · Progression</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl bg-white/20 hover:bg-white/30 backdrop-blur-sm transition-colors">
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* Tabs underline */}
        <div className="px-8 flex gap-6 border-b border-gray-100 flex-shrink-0">
          {[
            { id: 'coach', label: 'Mon Défi', icon: Award },
            { id: 'analyse', label: 'Analyse Ventes', icon: MessageSquare },
          ].map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => s.setActiveTab(id)}
              className={`flex items-center gap-2 py-4 text-sm font-semibold border-b-2 transition-all ${
                s.activeTab === id ? 'border-purple-500 text-purple-600' : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}>
              <Icon className="w-4 h-4" />{label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {s.activeTab === 'coach' && (
            <ChallengeTab
              dailyChallenge={dailyChallenge} stats={s.stats} loading={s.loading}
              showFeedbackForm={s.showFeedbackForm} feedbackComment={s.feedbackComment}
              setShowFeedbackForm={s.setShowFeedbackForm} setFeedbackComment={s.setFeedbackComment}
              handleCompleteChallenge={s.handleCompleteChallenge}
              handleRefreshChallenge={s.handleRefreshChallenge}
              handleSubmitFeedback={s.handleSubmitFeedback}
              onOpenChallengeHistory={s.onOpenChallengeHistory}
            />
          )}
          {s.activeTab === 'analyse' && (
            <AnalyseTab
              debriefs={debriefs} expandedDebriefs={s.expandedDebriefs}
              setExpandedDebriefs={s.setExpandedDebriefs}
              selectedCompetence={s.selectedCompetence} setSelectedCompetence={s.setSelectedCompetence}
              historyFilter={s.historyFilter} setHistoryFilter={s.setHistoryFilter}
              analyseSubTab={s.analyseSubTab} setAnalyseSubTab={s.setAnalyseSubTab}
              onCreateDebrief={onCreateDebrief}
            />
          )}
        </div>
      </div>
      {s.showChallengeHistoryModal && (
        <ChallengeHistoryModal isOpen={s.showChallengeHistoryModal} onClose={() => s.setShowChallengeHistoryModal(false)} />
      )}
    </div>
  );
}

export default function SellerCoachingModalVariant({ variant, ...props }) {
  if (variant === 'C') return <ModalVariantC {...props} />;
  return <ModalVariantB {...props} />;
}
