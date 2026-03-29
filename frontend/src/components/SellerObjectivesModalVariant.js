/**
 * SellerObjectivesModalVariant — STAGING UNIQUEMENT
 *
 * Dupliqué depuis ObjectivesModal.js — mêmes fonctionnalités, présentation différente.
 *
 * variant='B' → Sans onglets : objectifs visibles + historique en section expansible en bas
 * variant='C' → Panneau latéral : sidebar de stats + contenu principal à droite
 */
import React, { useState, useEffect, useRef } from 'react';
import { X, Target, History, Award, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';
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
    historyObjectives, historyStatusFilter, setHistoryStatusFilter,
    achievementModal, setAchievementModal,
    refreshActiveData, fetchHistory, handleMarkAchievementAsSeen, triggerConfetti,
  };
}

/* ══════════════════════════════════════
   STYLE B — Sans Onglets
   Objectifs en haut, Historique en section dépliable en bas
══════════════════════════════════════ */
function ModalVariantB({ isOpen, onClose, activeObjectives: initialObjectives = [], onUpdate, initialObjectiveId }) {
  const s = useObjectivesState({ isOpen, initialObjectives, onUpdate, initialObjectiveId });
  const [histoOpen, setHistoOpen] = useState(false);

  // Charger l'historique quand on ouvre la section
  useEffect(() => {
    if (histoOpen && isOpen) s.fetchHistory();
  }, [histoOpen, isOpen]); // eslint-disable-line

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-gray-200">

        {/* Header avec hero stat */}
        <div className="bg-gradient-to-r from-blue-900 via-teal-800 to-green-800 px-6 pt-5 pb-4 flex-shrink-0 rounded-t-2xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Target className="w-5 h-5" />
              Mes Objectifs
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-white/20 text-white font-medium">Style B</span>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors ml-2">
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
          {/* Hero stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/10 rounded-xl px-4 py-3 backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-300 flex-shrink-0" />
                <div>
                  <p className="text-2xl font-bold text-white leading-none">{s.activeObjectives.length}</p>
                  <p className="text-xs text-teal-200 mt-0.5">objectif{s.activeObjectives.length > 1 ? 's' : ''} actif{s.activeObjectives.length > 1 ? 's' : ''}</p>
                </div>
              </div>
            </div>
            <div className="bg-white/10 rounded-xl px-4 py-3 backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-yellow-300 flex-shrink-0" />
                <div>
                  <p className="text-2xl font-bold text-white leading-none">
                    {s.activeObjectives.length > 0
                      ? Math.round(s.activeObjectives.reduce((acc, o) => acc + (o.progress_percentage || 0), 0) / s.activeObjectives.length)
                      : 0}%
                  </p>
                  <p className="text-xs text-teal-200 mt-0.5">progression moyenne</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Corps scrollable */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {/* Section Objectifs actifs — toujours visible */}
          <ObjectivesTab
            activeObjectives={s.activeObjectives} setActiveObjectives={s.setActiveObjectives}
            updatingObjectiveId={s.updatingObjectiveId} setUpdatingObjectiveId={s.setUpdatingObjectiveId}
            objectiveProgressValue={s.objectiveProgressValue} setObjectiveProgressValue={s.setObjectiveProgressValue}
            refreshActiveData={s.refreshActiveData} triggerConfetti={s.triggerConfetti}
          />

          {/* Section Historique — expansible */}
          <div className="border-t border-gray-200">
            <button
              onClick={() => setHistoOpen(o => !o)}
              className="w-full flex items-center justify-between px-5 py-3.5 bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <History className="w-4 h-4 text-purple-500" />
                Historique des objectifs
              </div>
              {histoOpen
                ? <ChevronUp className="w-4 h-4 text-gray-400" />
                : <ChevronDown className="w-4 h-4 text-gray-400" />
              }
            </button>
            {histoOpen && (
              <HistoriqueTab
                historyObjectives={s.historyObjectives} historyStatusFilter={s.historyStatusFilter}
                setHistoryStatusFilter={s.setHistoryStatusFilter}
              />
            )}
          </div>
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
   STYLE C — Panneau Latéral
   Sidebar gauche avec stats + navigation, contenu à droite
══════════════════════════════════════ */
function ModalVariantC({ isOpen, onClose, activeObjectives: initialObjectives = [], onUpdate, initialObjectiveId }) {
  const s = useObjectivesState({ isOpen, initialObjectives, onUpdate, initialObjectiveId });
  if (!isOpen) return null;

  const avgProgress = s.activeObjectives.length > 0
    ? Math.round(s.activeObjectives.reduce((acc, o) => acc + (o.progress_percentage || 0), 0) / s.activeObjectives.length)
    : 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-100">

        {/* Header minimaliste */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 flex-shrink-0 bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center">
              <Target className="w-4 h-4 text-teal-600" />
            </div>
            <h2 className="text-base font-bold text-gray-900">Mes Objectifs</h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-teal-50 text-teal-600 font-semibold border border-teal-100">Style C</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mobile : stats en ligne + onglets pleine largeur */}
        <div className="sm:hidden flex-shrink-0 border-b border-gray-100 bg-gray-50">
          <div className="flex gap-3 px-4 py-3">
            <div className="flex-1 bg-white rounded-xl px-3 py-2 border border-gray-100 text-center">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">Actifs</p>
              <p className="text-xl font-bold text-teal-600">{s.activeObjectives.length}</p>
            </div>
            <div className="flex-1 bg-white rounded-xl px-3 py-2 border border-gray-100 text-center">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">Progression</p>
              <p className="text-xl font-bold text-green-600">{avgProgress}%</p>
            </div>
          </div>
          <div className="flex gap-1 px-4 pb-3">
            {[{ id: 'objectifs', label: 'Actifs', icon: Target }, { id: 'historique', label: 'Historique', icon: History }].map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => s.setActiveTab(id)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  s.activeTab === id ? 'bg-teal-500 text-white shadow' : 'bg-white text-gray-500 border border-gray-200'
                }`}>
                <Icon className="w-4 h-4" />{label}
              </button>
            ))}
          </div>
        </div>

        {/* Mobile : contenu pleine largeur */}
        <div className="sm:hidden flex-1 overflow-y-auto min-h-0">
          {s.activeTab === 'objectifs' && (
            <ObjectivesTab
              activeObjectives={s.activeObjectives} setActiveObjectives={s.setActiveObjectives}
              updatingObjectiveId={s.updatingObjectiveId} setUpdatingObjectiveId={s.setUpdatingObjectiveId}
              objectiveProgressValue={s.objectiveProgressValue} setObjectiveProgressValue={s.setObjectiveProgressValue}
              refreshActiveData={s.refreshActiveData} triggerConfetti={s.triggerConfetti}
            />
          )}
          {s.activeTab === 'historique' && (
            <HistoriqueTab historyObjectives={s.historyObjectives} historyStatusFilter={s.historyStatusFilter}
              setHistoryStatusFilter={s.setHistoryStatusFilter} />
          )}
        </div>

        {/* Desktop : sidebar gauche + contenu droit */}
        <div className="hidden sm:flex flex-1 overflow-hidden min-h-0">

          {/* Sidebar stats + nav */}
          <div className="w-52 flex-shrink-0 border-r border-gray-100 bg-gray-50 flex flex-col py-4 px-3">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-2 mb-3">Vue d'ensemble</p>

            {/* Stats cards */}
            <div className="space-y-2 mb-4">
              <div className="bg-white rounded-xl px-3 py-3 border border-gray-100 shadow-sm">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide">Actifs</p>
                <p className="text-2xl font-bold text-teal-600">{s.activeObjectives.length}</p>
                <p className="text-xs text-gray-500">objectif{s.activeObjectives.length > 1 ? 's' : ''}</p>
              </div>
              <div className="bg-white rounded-xl px-3 py-3 border border-gray-100 shadow-sm">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide">Progression</p>
                <p className="text-2xl font-bold text-green-600">{avgProgress}%</p>
                <div className="mt-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-green-400 rounded-full transition-all" style={{ width: `${avgProgress}%` }} />
                </div>
              </div>
            </div>

            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-2 mb-2">Navigation</p>
            {[
              { id: 'objectifs', label: 'Actifs', icon: Target },
              { id: 'historique', label: 'Historique', icon: History },
            ].map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => s.setActiveTab(id)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left ${
                  s.activeTab === id
                    ? 'bg-teal-500 text-white shadow-md shadow-teal-200'
                    : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900'
                }`}>
                <Icon className="w-4 h-4 flex-shrink-0" />
                {label}
              </button>
            ))}
          </div>

          {/* Contenu principal */}
          <div className="flex-1 overflow-y-auto min-h-0">
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
