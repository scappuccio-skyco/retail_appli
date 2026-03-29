/**
 * SellerCoachingModalVariant — STAGING UNIQUEMENT
 *
 * Dupliqué depuis CoachingModal.js — mêmes fonctionnalités, présentation différente.
 *
 * variant='B' → Tout en Scroll : pas d'onglets, défi en hero + analyse en dessous (tout visible)
 * variant='C' → Deux Panneaux : défi à gauche + analyse à droite (côte à côte sur lg)
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
   STYLE B — Tout en Scroll
   Pas d'onglets : défi hero + analyse en dessous, tout visible d'un scroll
══════════════════════════════════════ */
function ModalVariantB({ isOpen, onClose, dailyChallenge, onRefreshChallenge, onCompleteChallenge, onOpenChallengeHistory, debriefs = [], onCreateDebrief }) {
  const s = useCoachingState({ isOpen, dailyChallenge, onRefreshChallenge, onCompleteChallenge, onOpenChallengeHistory, debriefs, onCreateDebrief });
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-gray-200">

        {/* Header compact */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 flex-shrink-0 bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
              <Brain className="w-4 h-4 text-purple-600" />
            </div>
            <h2 className="text-base font-bold text-gray-900">Mon Coach IA</h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 font-semibold border border-purple-100">Style B</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corps scrollable : tout affiché en sections, pas d'onglets */}
        <div className="flex-1 overflow-y-auto min-h-0">

          {/* Section 1 — Mon défi du jour */}
          <div>
            <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100 bg-white sticky top-0 z-10">
              <Award className="w-4 h-4 text-purple-500" />
              <span className="text-sm font-bold text-gray-800">Mon Défi du Jour</span>
            </div>
            <ChallengeTab
              dailyChallenge={dailyChallenge} stats={s.stats} loading={s.loading}
              showFeedbackForm={s.showFeedbackForm} feedbackComment={s.feedbackComment}
              setShowFeedbackForm={s.setShowFeedbackForm} setFeedbackComment={s.setFeedbackComment}
              handleCompleteChallenge={s.handleCompleteChallenge}
              handleRefreshChallenge={s.handleRefreshChallenge}
              handleSubmitFeedback={s.handleSubmitFeedback}
              onOpenChallengeHistory={s.onOpenChallengeHistory}
            />
          </div>

          {/* Diviseur visuel */}
          <div className="h-2 bg-gray-100 border-y border-gray-200" />

          {/* Section 2 — Analyser mes ventes */}
          <div>
            <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100 bg-white sticky top-0 z-10">
              <MessageSquare className="w-4 h-4 text-indigo-500" />
              <span className="text-sm font-bold text-gray-800">Analyser mes Ventes</span>
            </div>
            <AnalyseTab
              debriefs={debriefs} expandedDebriefs={s.expandedDebriefs}
              setExpandedDebriefs={s.setExpandedDebriefs}
              selectedCompetence={s.selectedCompetence} setSelectedCompetence={s.setSelectedCompetence}
              historyFilter={s.historyFilter} setHistoryFilter={s.setHistoryFilter}
              analyseSubTab={s.analyseSubTab} setAnalyseSubTab={s.setAnalyseSubTab}
              onCreateDebrief={onCreateDebrief}
            />
          </div>
        </div>
      </div>

      {s.showChallengeHistoryModal && (
        <ChallengeHistoryModal isOpen={s.showChallengeHistoryModal} onClose={() => s.setShowChallengeHistoryModal(false)} />
      )}
    </div>
  );
}

/* ══════════════════════════════════════
   STYLE C — Deux Panneaux
   Défi à gauche + Analyse à droite (côte à côte sur lg)
   Sur mobile : onglets classiques
══════════════════════════════════════ */
function ModalVariantC({ isOpen, onClose, dailyChallenge, onRefreshChallenge, onCompleteChallenge, onOpenChallengeHistory, debriefs = [], onCreateDebrief }) {
  const s = useCoachingState({ isOpen, dailyChallenge, onRefreshChallenge, onCompleteChallenge, onOpenChallengeHistory, debriefs, onCreateDebrief });
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-gray-50 rounded-2xl shadow-2xl max-w-6xl w-full max-h-[94vh] sm:max-h-[90vh] overflow-hidden flex flex-col border border-gray-200">

        {/* Header */}
        <div className="bg-white flex items-center justify-between px-5 py-3 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-purple-600" />
            </div>
            <h2 className="text-base font-bold text-gray-900">Mon Coach IA</h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 font-semibold border border-purple-100">Style C</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Tabs mobiles */}
            <div className="flex sm:hidden gap-1">
              <button onClick={() => s.setActiveTab('coach')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${s.activeTab === 'coach' ? 'bg-purple-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                Défi
              </button>
              <button onClick={() => s.setActiveTab('analyse')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${s.activeTab === 'analyse' ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                Analyse
              </button>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Mobile : onglet actif */}
        <div className="flex-1 sm:hidden overflow-y-auto min-h-0 bg-white">
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

        {/* Desktop : 2 panneaux côte à côte */}
        <div className="hidden sm:flex flex-1 overflow-hidden min-h-0 gap-px bg-gray-200">
          {/* Panneau gauche — Défi du jour */}
          <div className="flex-1 flex flex-col overflow-hidden bg-white min-w-0">
            <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50 flex-shrink-0">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-purple-500" />
                <span className="text-sm font-semibold text-gray-700">Mon Défi du Jour</span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto min-h-0">
              <ChallengeTab
                dailyChallenge={dailyChallenge} stats={s.stats} loading={s.loading}
                showFeedbackForm={s.showFeedbackForm} feedbackComment={s.feedbackComment}
                setShowFeedbackForm={s.setShowFeedbackForm} setFeedbackComment={s.setFeedbackComment}
                handleCompleteChallenge={s.handleCompleteChallenge}
                handleRefreshChallenge={s.handleRefreshChallenge}
                handleSubmitFeedback={s.handleSubmitFeedback}
                onOpenChallengeHistory={s.onOpenChallengeHistory}
              />
            </div>
          </div>

          {/* Panneau droit — Analyser mes ventes */}
          <div className="flex-1 flex flex-col overflow-hidden bg-white min-w-0">
            <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50 flex-shrink-0">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-indigo-500" />
                <span className="text-sm font-semibold text-gray-700">Analyser mes Ventes</span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto min-h-0">
              <AnalyseTab
                debriefs={debriefs} expandedDebriefs={s.expandedDebriefs}
                setExpandedDebriefs={s.setExpandedDebriefs}
                selectedCompetence={s.selectedCompetence} setSelectedCompetence={s.setSelectedCompetence}
                historyFilter={s.historyFilter} setHistoryFilter={s.setHistoryFilter}
                analyseSubTab={s.analyseSubTab} setAnalyseSubTab={s.setAnalyseSubTab}
                onCreateDebrief={onCreateDebrief}
              />
            </div>
          </div>
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
