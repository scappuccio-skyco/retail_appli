/**
 * SettingsModalVariant — Variantes B et C de ManagerSettingsModal
 *
 * B — "Cards & Progress" : header vert foncé avec barre de statut,
 *     navigation par icônes en sidebar, objectifs en cartes avec barres de progression bien visibles.
 *
 * C — "Focus Mode" : header blanc, navigation horizontale en pills,
 *     layout à fond gris très clair, tabs en style "segment control".
 */
import React, { useEffect } from 'react';
import { X, Plus, Target, Trophy, Settings } from 'lucide-react';
import AchievementModal from './AchievementModal';
import { useManagerSettings } from './managerSettings/useManagerSettings';
import ObjectivesCompletedTab from './managerSettings/ObjectivesCompletedTab';
import ChallengesCompletedTab from './managerSettings/ChallengesCompletedTab';
import CreateObjectiveTab from './managerSettings/CreateObjectiveTab';
import ActiveObjectivesTab from './managerSettings/ActiveObjectivesTab';
import CreateChallengeTab from './managerSettings/CreateChallengeTab';
import ActiveChallengesTab from './managerSettings/ActiveChallengesTab';

/* ─── Contenu partagé par B et C ─── */
function SettingsContent({ state, modalType, onUpdate }) {
  const {
    storeParam, activeTab, setActiveTab, objectives, challenges, sellers, loading,
    editingChallenge, setEditingChallenge, editingObjective, setEditingObjective,
    achievementModal, setAchievementModal, newChallenge, setNewChallenge,
    selectedVisibleSellersChallenge, setSelectedVisibleSellersChallenge,
    isChallengeSellerDropdownOpen, setIsChallengeSellerDropdownOpen, challengeSellerDropdownRef,
    updatingProgressObjectiveId, setUpdatingProgressObjectiveId, progressValue, setProgressValue,
    updatingProgressChallengeId, setUpdatingProgressChallengeId, challengeProgressValue, setChallengeProgressValue,
    newObjective, setNewObjective, selectedVisibleSellers, setSelectedVisibleSellers,
    isSellerDropdownOpen, setIsSellerDropdownOpen, sellerDropdownRef,
    handleCreateChallenge, handleUpdateChallenge, handleDeleteChallenge,
    handleCreateObjective, handleUpdateObjective, handleDeleteObjective,
    handleUpdateProgress, fetchData,
  } = state;

  if (loading) return <div className="text-center py-16 text-gray-400">Chargement...</div>;

  return (
    <>
      {activeTab === 'create_objective' && (
        <CreateObjectiveTab editingObjective={editingObjective} setEditingObjective={setEditingObjective}
          newObjective={newObjective} setNewObjective={setNewObjective} sellers={sellers}
          selectedVisibleSellers={selectedVisibleSellers} setSelectedVisibleSellers={setSelectedVisibleSellers}
          isSellerDropdownOpen={isSellerDropdownOpen} setIsSellerDropdownOpen={setIsSellerDropdownOpen}
          sellerDropdownRef={sellerDropdownRef} handleCreateObjective={handleCreateObjective}
          handleUpdateObjective={handleUpdateObjective} setActiveTab={setActiveTab} />
      )}
      {activeTab === 'active_objectives' && (
        <ActiveObjectivesTab objectives={objectives} sellers={sellers}
          updatingProgressObjectiveId={updatingProgressObjectiveId} setUpdatingProgressObjectiveId={setUpdatingProgressObjectiveId}
          progressValue={progressValue} setProgressValue={setProgressValue}
          handleDeleteObjective={handleDeleteObjective} handleUpdateProgress={handleUpdateProgress}
          setEditingObjective={setEditingObjective} setActiveTab={setActiveTab} />
      )}
      {activeTab === 'completed_objectives' && (
        <ObjectivesCompletedTab objectives={objectives} onDeleteObjective={handleDeleteObjective} />
      )}
      {activeTab === 'create_challenge' && (
        <CreateChallengeTab editingChallenge={editingChallenge} setEditingChallenge={setEditingChallenge}
          newChallenge={newChallenge} setNewChallenge={setNewChallenge} sellers={sellers}
          selectedVisibleSellersChallenge={selectedVisibleSellersChallenge} setSelectedVisibleSellersChallenge={setSelectedVisibleSellersChallenge}
          isChallengeSellerDropdownOpen={isChallengeSellerDropdownOpen} setIsChallengeSellerDropdownOpen={setIsChallengeSellerDropdownOpen}
          challengeSellerDropdownRef={challengeSellerDropdownRef}
          handleCreateChallenge={handleCreateChallenge} handleUpdateChallenge={handleUpdateChallenge} />
      )}
      {activeTab === 'active_challenges' && (
        <ActiveChallengesTab challenges={challenges} sellers={sellers}
          updatingProgressChallengeId={updatingProgressChallengeId} setUpdatingProgressChallengeId={setUpdatingProgressChallengeId}
          challengeProgressValue={challengeProgressValue} setChallengeProgressValue={setChallengeProgressValue}
          handleDeleteChallenge={handleDeleteChallenge} setEditingChallenge={setEditingChallenge}
          setActiveTab={setActiveTab} storeParam={storeParam} fetchData={fetchData} onUpdate={onUpdate} />
      )}
      {activeTab === 'completed_challenges' && (
        <ChallengesCompletedTab challenges={challenges} onDeleteChallenge={handleDeleteChallenge} />
      )}
    </>
  );
}

/* ══════════════════════════════════════
   STYLE B — Cards & Progress
══════════════════════════════════════ */
function ModalVariantB({ isOpen, onClose, onUpdate, modalType = 'objectives', storeIdParam = null, initialObjectiveId = null }) {
  const state = useManagerSettings({ isOpen, onClose, onUpdate, modalType, storeIdParam });
  const { activeTab, setActiveTab, objectives, challenges } = state;

  useEffect(() => {
    if (initialObjectiveId && isOpen) {
      setTimeout(() => {
        const el = document.getElementById(`obj-${initialObjectiveId}`);
        if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('ring-2', 'ring-orange-400'); setTimeout(() => el.classList.remove('ring-2', 'ring-orange-400'), 3000); }
      }, 300);
    }
  }, [initialObjectiveId, isOpen]);

  if (!isOpen) return null;

  const isObjectives = modalType === 'objectives';
  const todayStr = new Date().toISOString().split('T')[0];

  const objectiveTabs = [
    { id: 'create_objective', icon: Plus, label: 'Nouveau', accent: 'bg-purple-600' },
    { id: 'active_objectives', icon: Target, label: `En cours (${objectives.filter(o => o.period_end >= todayStr && o.status !== 'achieved' && o.status !== 'failed').length})`, accent: 'bg-blue-600' },
    { id: 'completed_objectives', icon: Trophy, label: `Terminés (${objectives.filter(o => o.period_end < todayStr || o.status === 'achieved' || o.status === 'failed').length})`, accent: 'bg-emerald-600' },
  ];

  const challengeTabs = [
    { id: 'create_challenge', icon: Plus, label: 'Nouveau', accent: 'bg-purple-600' },
    { id: 'active_challenges', icon: Target, label: `En cours (${challenges.filter(c => c.end_date >= todayStr && c.status !== 'achieved').length})`, accent: 'bg-blue-600' },
    { id: 'completed_challenges', icon: Trophy, label: `Terminés (${challenges.filter(c => c.end_date < todayStr || c.status === 'achieved').length})`, accent: 'bg-emerald-600' },
  ];

  const tabs = isObjectives ? objectiveTabs : challengeTabs;
  const activeTabInfo = tabs.find(t => t.id === activeTab) || tabs[0];

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-50 rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">

        {/* Header sombre */}
        <div className={`px-6 py-4 flex items-center justify-between flex-shrink-0 ${isObjectives ? 'bg-blue-950' : 'bg-green-950'}`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isObjectives ? 'bg-blue-800' : 'bg-green-800'}`}>
              {isObjectives ? <Target className="w-5 h-5 text-blue-300" /> : <Trophy className="w-5 h-5 text-green-300" />}
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">{isObjectives ? '🎯 Objectifs' : '🏆 Challenges'}</h2>
              <p className={`text-xs ${isObjectives ? 'text-blue-400' : 'text-green-400'}`}>
                {isObjectives
                  ? `${objectives.filter(o => o.period_end >= todayStr && o.status !== 'achieved' && o.status !== 'failed').length} en cours`
                  : `${challenges.filter(c => c.end_date >= todayStr && c.status !== 'achieved').length} en cours`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors">
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Navigation en cards */}
        <div className="px-4 py-3 bg-white border-b border-gray-100 flex gap-2 flex-shrink-0">
          {tabs.map(({ id, icon: Icon, label, accent }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${activeTab === id ? `${accent} text-white shadow-md` : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Contenu */}
        <div className="flex-1 overflow-y-auto p-6">
          <SettingsContent state={state} modalType={modalType} onUpdate={onUpdate} />
        </div>
      </div>

      <AchievementModal
        isOpen={state.achievementModal.isOpen}
        onClose={() => state.setAchievementModal({ isOpen: false, item: null, itemType: null })}
        item={state.achievementModal.item} itemType={state.achievementModal.itemType}
        onMarkAsSeen={state.handleMarkAchievementAsSeen} userRole="manager"
      />
    </div>
  );
}

/* ══════════════════════════════════════
   STYLE C — Focus Mode
══════════════════════════════════════ */
function ModalVariantC({ isOpen, onClose, onUpdate, modalType = 'objectives', storeIdParam = null, initialObjectiveId = null }) {
  const state = useManagerSettings({ isOpen, onClose, onUpdate, modalType, storeIdParam });
  const { activeTab, setActiveTab, objectives, challenges } = state;

  useEffect(() => {
    if (initialObjectiveId && isOpen) {
      setTimeout(() => {
        const el = document.getElementById(`obj-${initialObjectiveId}`);
        if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('ring-2', 'ring-orange-400'); setTimeout(() => el.classList.remove('ring-2', 'ring-orange-400'), 3000); }
      }, 300);
    }
  }, [initialObjectiveId, isOpen]);

  if (!isOpen) return null;

  const isObjectives = modalType === 'objectives';
  const todayStr = new Date().toISOString().split('T')[0];

  const objectivePills = [
    { id: 'create_objective', label: '+ Nouveau' },
    { id: 'active_objectives', label: `En cours · ${objectives.filter(o => o.period_end >= todayStr && o.status !== 'achieved' && o.status !== 'failed').length}` },
    { id: 'completed_objectives', label: `Terminés · ${objectives.filter(o => o.period_end < todayStr || o.status === 'achieved' || o.status === 'failed').length}` },
  ];

  const challengePills = [
    { id: 'create_challenge', label: '+ Nouveau' },
    { id: 'active_challenges', label: `En cours · ${challenges.filter(c => c.end_date >= todayStr && c.status !== 'achieved').length}` },
    { id: 'completed_challenges', label: `Terminés · ${challenges.filter(c => c.end_date < todayStr || c.status === 'achieved').length}` },
  ];

  const pills = isObjectives ? objectivePills : challengePills;
  const accentColor = isObjectives ? 'bg-blue-600' : 'bg-emerald-600';

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">

        {/* Header blanc minimaliste */}
        <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`w-1.5 h-9 rounded-full ${isObjectives ? 'bg-blue-500' : 'bg-emerald-500'}`} />
              <div>
                <h2 className="text-xl font-bold text-gray-900">{isObjectives ? '🎯 Objectifs' : '🏆 Challenges'}</h2>
                <p className="text-xs text-gray-400">
                  {isObjectives
                    ? `${objectives.filter(o => o.period_end >= todayStr && o.status !== 'achieved' && o.status !== 'failed').length} objectifs actifs`
                    : `${challenges.filter(c => c.end_date >= todayStr && c.status !== 'achieved').length} challenges actifs`}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-50 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Segment control */}
          <div className="inline-flex bg-gray-100 rounded-xl p-1 gap-1">
            {pills.map(({ id, label }) => (
              <button key={id} onClick={() => setActiveTab(id)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${activeTab === id ? `${accentColor} text-white shadow-sm` : 'text-gray-600 hover:text-gray-900'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Contenu */}
        <div className="flex-1 overflow-y-auto p-6">
          <SettingsContent state={state} modalType={modalType} onUpdate={onUpdate} />
        </div>
      </div>

      <AchievementModal
        isOpen={state.achievementModal.isOpen}
        onClose={() => state.setAchievementModal({ isOpen: false, item: null, itemType: null })}
        item={state.achievementModal.item} itemType={state.achievementModal.itemType}
        onMarkAsSeen={state.handleMarkAchievementAsSeen} userRole="manager"
      />
    </div>
  );
}

/* ─── Export ─── */
export default function SettingsModalVariant({ variant, ...props }) {
  if (variant === 'C') return <ModalVariantC {...props} />;
  return <ModalVariantB {...props} />;
}
