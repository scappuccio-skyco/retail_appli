/**
 * SellerObjectivesModalVariant — STAGING UNIQUEMENT
 *
 * B — "Goal Board" : header dark emerald, objectifs en grand cards,
 *     compteur d'objectifs actifs en hero, onglets en pills.
 *
 * C — "Progress View" : header dégradé vert-teal, stats en ligne,
 *     onglets icônes minimalistes, fond très clair.
 */
import React, { useState, useEffect, useRef } from 'react';
import { X, Target, History, Award, CheckCircle } from 'lucide-react';
import { api } from '../lib/apiClient';
import { logger } from '../utils/logger';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import AchievementModal from './AchievementModal';
import ObjectivesTab from './objectivesModal/ObjectivesTab';
import HistoriqueTab from './objectivesModal/HistoriqueTab';

function useObjectivesState({ isOpen, initialObjectives, onUpdate, initialObjectiveId }) {
  const isMountedRef = useRef(true);
  useEffect(() => () => { isMountedRef.current = false; }, []);

  const [activeObjectives, setActiveObjectives] = useState(initialObjectives);
  useEffect(() => { setActiveObjectives(initialObjectives); }, [initialObjectives]);
  useEffect(() => { if (isOpen) refreshActiveData(); }, [isOpen]); // eslint-disable-line

  useEffect(() => {
    if (initialObjectiveId) {
      setTimeout(() => {
        const el = document.getElementById(`seller-obj-${initialObjectiveId}`);
        if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('ring-2', 'ring-orange-400'); setTimeout(() => el.classList.remove('ring-2', 'ring-orange-400'), 3000); }
      }, 400);
    }
  }, [initialObjectiveId]); // eslint-disable-line

  const [activeTab, setActiveTab] = useState('objectifs');
  const [updatingObjectiveId, setUpdatingObjectiveId] = useState(null);
  const [objectiveProgressValue, setObjectiveProgressValue] = useState('');
  const [historyObjectives, setHistoryObjectives] = useState([]);
  const [historyStatusFilter, setHistoryStatusFilter] = useState('all');
  const [achievementModal, setAchievementModal] = useState({ isOpen: false, item: null, itemType: null });

  useEffect(() => { if (activeTab === 'historique' && isOpen) fetchHistory(); }, [activeTab, isOpen]); // eslint-disable-line

  const fetchHistory = async () => {
    try { const res = await api.get('/seller/objectives/history'); if (isMountedRef.current) setHistoryObjectives(res.data); }
    catch (err) { if (isMountedRef.current) { logger.error('History error:', err); toast.error("Erreur historique"); } }
  };

  const refreshActiveData = async () => {
    try {
      const res = await api.get('/seller/objectives/active');
      if (!isMountedRef.current) return;
      const activeOnly = (res.data || []).filter(o => o.status !== 'achieved');
      setActiveObjectives(activeOnly);
      if (!achievementModal.isOpen) {
        const unseen = activeOnly.find(o => o.has_unseen_achievement === true);
        if (unseen) setAchievementModal({ isOpen: true, item: unseen, itemType: 'objective' });
      }
      if (activeTab === 'historique') await fetchHistory();
      if (onUpdate) onUpdate();
    } catch (err) { if (isMountedRef.current) logger.error('Refresh error:', err); }
  };

  const handleMarkAchievementAsSeen = async () => {
    setAchievementModal({ isOpen: false, item: null, itemType: null });
    await refreshActiveData();
    if (activeTab === 'historique') await fetchHistory();
    if (onUpdate) onUpdate();
  };

  const triggerConfetti = () => {
    try { const fn = confetti || globalThis.confetti; if (fn) fn({ particleCount: 30, spread: 50, origin: { y: 0.6 } }); } catch {}
  };

  return {
    activeObjectives, setActiveObjectives, activeTab, setActiveTab,
    updatingObjectiveId, setUpdatingObjectiveId,
    objectiveProgressValue, setObjectiveProgressValue,
    historyObjectives, setHistoryObjectives,
    historyStatusFilter, setHistoryStatusFilter,
    achievementModal, setAchievementModal,
    refreshActiveData, handleMarkAchievementAsSeen, triggerConfetti,
  };
}

/* ══════════════════════════════════════
   STYLE B — Goal Board
══════════════════════════════════════ */
function ModalVariantB({ isOpen, onClose, activeObjectives: initialObjectives = [], onUpdate, initialObjectiveId }) {
  const s = useObjectivesState({ isOpen, initialObjectives, onUpdate, initialObjectiveId });
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-emerald-950 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-emerald-800">

        {/* Header sombre emerald */}
        <div className="bg-emerald-900 px-6 py-4 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-700 flex items-center justify-center">
                <Target className="w-5 h-5 text-emerald-300" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Mes Objectifs</h2>
                <p className="text-xs text-emerald-400">Suivi de progression personnelle</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg bg-emerald-800 hover:bg-emerald-700 transition-colors">
              <X className="w-4 h-4 text-emerald-300" />
            </button>
          </div>
          {/* Hero stat */}
          <div className="bg-emerald-800/50 rounded-xl px-4 py-3 flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-emerald-400 flex-shrink-0" />
            <div>
              <p className="text-2xl font-bold text-white">{s.activeObjectives.length}</p>
              <p className="text-xs text-emerald-400">objectif{s.activeObjectives.length > 1 ? 's' : ''} actif{s.activeObjectives.length > 1 ? 's' : ''}</p>
            </div>
          </div>
        </div>

        {/* Tabs pills */}
        <div className="bg-emerald-900 px-6 pb-3 flex gap-2 flex-shrink-0">
          {[{ id: 'objectifs', label: 'Objectifs actifs', icon: Target }, { id: 'historique', label: 'Historique', icon: History }].map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => s.setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-full transition-all ${
                s.activeTab === id
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                  : 'bg-emerald-800 text-emerald-300 hover:bg-emerald-700'
              }`}>
              <Icon className="w-4 h-4" />{label}
            </button>
          ))}
        </div>

        {/* Content fond clair */}
        <div className="flex-1 overflow-y-auto bg-gray-50">
          {s.activeTab === 'objectifs' && (
            <ObjectivesTab
              activeObjectives={s.activeObjectives} setActiveObjectives={s.setActiveObjectives}
              updatingObjectiveId={s.updatingObjectiveId} setUpdatingObjectiveId={s.setUpdatingObjectiveId}
              objectiveProgressValue={s.objectiveProgressValue} setObjectiveProgressValue={s.setObjectiveProgressValue}
              refreshActiveData={s.refreshActiveData} triggerConfetti={s.triggerConfetti}
            />
          )}
          {s.activeTab === 'historique' && (
            <HistoriqueTab
              historyObjectives={s.historyObjectives} historyStatusFilter={s.historyStatusFilter}
              setHistoryStatusFilter={s.setHistoryStatusFilter}
            />
          )}
        </div>
      </div>
      {s.achievementModal.isOpen && (
        <AchievementModal item={s.achievementModal.item} itemType={s.achievementModal.itemType}
          onClose={s.handleMarkAchievementAsSeen} />
      )}
    </div>
  );
}

/* ══════════════════════════════════════
   STYLE C — Progress View
══════════════════════════════════════ */
function ModalVariantC({ isOpen, onClose, activeObjectives: initialObjectives = [], onUpdate, initialObjectiveId }) {
  const s = useObjectivesState({ isOpen, initialObjectives, onUpdate, initialObjectiveId });
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-gray-100">

        {/* Header dégradé vert-teal */}
        <div className="bg-gradient-to-r from-emerald-500 to-teal-500 px-8 py-5 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                <Target className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Mes Objectifs</h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-sm font-semibold text-emerald-100">{s.activeObjectives.length} actif{s.activeObjectives.length > 1 ? 's' : ''}</span>
                  <span className="text-white/50">·</span>
                  <span className="text-sm text-white/70">Suivi progression</span>
                </div>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl bg-white/20 hover:bg-white/30 backdrop-blur-sm transition-colors">
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* Tabs underline */}
        <div className="px-8 flex gap-6 border-b border-gray-100 flex-shrink-0">
          {[{ id: 'objectifs', label: 'Actifs', icon: Target }, { id: 'historique', label: 'Historique', icon: History }].map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => s.setActiveTab(id)}
              className={`flex items-center gap-2 py-4 text-sm font-semibold border-b-2 transition-all ${
                s.activeTab === id ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}>
              <Icon className="w-4 h-4" />{label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {s.activeTab === 'objectifs' && (
            <ObjectivesTab
              activeObjectives={s.activeObjectives} setActiveObjectives={s.setActiveObjectives}
              updatingObjectiveId={s.updatingObjectiveId} setUpdatingObjectiveId={s.setUpdatingObjectiveId}
              objectiveProgressValue={s.objectiveProgressValue} setObjectiveProgressValue={s.setObjectiveProgressValue}
              refreshActiveData={s.refreshActiveData} triggerConfetti={s.triggerConfetti}
            />
          )}
          {s.activeTab === 'historique' && (
            <HistoriqueTab
              historyObjectives={s.historyObjectives} historyStatusFilter={s.historyStatusFilter}
              setHistoryStatusFilter={s.setHistoryStatusFilter}
            />
          )}
        </div>
      </div>
      {s.achievementModal.isOpen && (
        <AchievementModal item={s.achievementModal.item} itemType={s.achievementModal.itemType}
          onClose={s.handleMarkAchievementAsSeen} />
      )}
    </div>
  );
}

export default function SellerObjectivesModalVariant({ variant, ...props }) {
  if (variant === 'C') return <ModalVariantC {...props} />;
  return <ModalVariantB {...props} />;
}
