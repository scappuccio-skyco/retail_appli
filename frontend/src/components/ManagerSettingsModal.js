import React, { useEffect } from 'react';
import { X, Settings, Target, Trophy, Plus } from 'lucide-react';
import AchievementModal from './AchievementModal';
import { useManagerSettings } from './managerSettings/useManagerSettings';
import ObjectivesCompletedTab from './managerSettings/ObjectivesCompletedTab';
import ChallengesCompletedTab from './managerSettings/ChallengesCompletedTab';
import CreateObjectiveTab from './managerSettings/CreateObjectiveTab';
import ActiveObjectivesTab from './managerSettings/ActiveObjectivesTab';
import CreateChallengeTab from './managerSettings/CreateChallengeTab';
import ActiveChallengesTab from './managerSettings/ActiveChallengesTab';

export default function ManagerSettingsModal({ isOpen, onClose, onUpdate, modalType = 'objectives', storeIdParam = null, initialObjectiveId = null }) {
  const state = useManagerSettings({ isOpen, onClose, onUpdate, modalType, storeIdParam });

  useEffect(() => {
    if (initialObjectiveId && isOpen) {
      setTimeout(() => {
        const el = document.getElementById(`obj-${initialObjectiveId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('ring-2', 'ring-orange-400');
          setTimeout(() => el.classList.remove('ring-2', 'ring-orange-400'), 3000);
        }
      }, 300);
    }
  }, [initialObjectiveId, isOpen]);

  const {
    storeParam,
    activeTab,
    setActiveTab,
    objectives,
    challenges,
    sellers,
    loading,
    editingChallenge,
    setEditingChallenge,
    editingObjective,
    setEditingObjective,
    achievementModal,
    setAchievementModal,
    newChallenge,
    setNewChallenge,
    selectedVisibleSellersChallenge,
    setSelectedVisibleSellersChallenge,
    isChallengeSellerDropdownOpen,
    setIsChallengeSellerDropdownOpen,
    challengeSellerDropdownRef,
    updatingProgressObjectiveId,
    setUpdatingProgressObjectiveId,
    progressValue,
    setProgressValue,
    updatingProgressChallengeId,
    setUpdatingProgressChallengeId,
    challengeProgressValue,
    setChallengeProgressValue,
    newObjective,
    setNewObjective,
    selectedVisibleSellers,
    setSelectedVisibleSellers,
    isSellerDropdownOpen,
    setIsSellerDropdownOpen,
    sellerDropdownRef,
    handleCreateChallenge,
    handleUpdateChallenge,
    handleDeleteChallenge,
    handleCreateObjective,
    handleUpdateObjective,
    handleDeleteObjective,
    handleUpdateProgress,
    fetchData,
  } = state;

  const handleMarkAchievementAsSeen = state.handleMarkAchievementAsSeen;

  if (!isOpen) return null;

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) { onClose(); } }} className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className={`sticky top-0 p-6 flex justify-between items-center border-b border-gray-200 ${
          modalType === 'objectives'
            ? 'bg-gradient-to-r from-[#1E40AF] to-[#1E3A8A]'
            : 'bg-gradient-to-r from-green-600 to-emerald-600'
        }`}>
          <div className="flex items-center gap-3">
            <Settings className="w-8 h-8 text-white" />
            <h2 className="text-3xl font-bold text-white">
              {modalType === 'objectives' ? '🎯 Objectifs' : '🏆 Challenges'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-100 transition-colors"
          >
            <X className="w-8 h-8" />
          </button>
        </div>

        {/* Tabs - Main level tabs */}
        <div className="border-b border-gray-200 bg-gray-50 pt-2">
          <div className="flex gap-0.5 px-2 md:px-6">
            {modalType === 'objectives' && (
              <>
                <button
                  onClick={() => setActiveTab('create_objective')}
                  className={`px-2 md:px-4 py-2 text-xs md:text-sm font-semibold transition-all rounded-t-lg ${
                    activeTab === 'create_objective'
                      ? 'bg-purple-300 text-gray-800 shadow-md border-b-4 border-purple-500'
                      : 'text-gray-600 hover:text-purple-600 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center justify-center gap-1">
                    <Plus className="w-4 h-4" />
                    <span>Nouveau</span>
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('active_objectives')}
                  className={`px-2 md:px-4 py-2 text-xs md:text-sm font-semibold transition-all rounded-t-lg ${
                    activeTab === 'active_objectives'
                      ? 'bg-blue-300 text-gray-800 shadow-md border-b-4 border-blue-500'
                      : 'text-gray-600 hover:text-blue-600 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center justify-center gap-1">
                    <Target className="w-4 h-4" />
                    <span>En cours ({objectives.filter(obj => {
                      const today = new Date().toISOString().split('T')[0];
                      return obj.period_end >= today && obj.status !== 'achieved' && obj.status !== 'failed';
                    }).length})</span>
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('completed_objectives')}
                  className={`px-2 md:px-4 py-2 text-xs md:text-sm font-semibold transition-all rounded-t-lg ${
                    activeTab === 'completed_objectives'
                      ? 'bg-green-300 text-gray-800 shadow-md border-b-4 border-green-500'
                      : 'text-gray-600 hover:text-green-600 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center justify-center gap-1">
                    <Trophy className="w-4 h-4" />
                    <span>Terminés ({objectives.filter(obj => {
                      const today = new Date().toISOString().split('T')[0];
                      return obj.period_end < today || obj.status === 'achieved' || obj.status === 'failed';
                    }).length})</span>
                  </div>
                </button>
              </>
            )}
            {modalType === 'challenges' && (
              <>
                <button
                  onClick={() => setActiveTab('create_challenge')}
                  className={`px-2 md:px-4 py-2 text-xs md:text-sm font-semibold transition-all rounded-t-lg ${
                    activeTab === 'create_challenge'
                      ? 'bg-purple-300 text-gray-800 shadow-md border-b-4 border-purple-500'
                      : 'text-gray-600 hover:text-purple-600 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center justify-center gap-1">
                    <Plus className="w-4 h-4" />
                    <span>Nouveau</span>
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('active_challenges')}
                  className={`px-2 md:px-4 py-2 text-xs md:text-sm font-semibold transition-all rounded-t-lg ${
                    activeTab === 'active_challenges'
                      ? 'bg-blue-300 text-gray-800 shadow-md border-b-4 border-blue-500'
                      : 'text-gray-600 hover:text-blue-600 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center justify-center gap-1">
                    <Target className="w-4 h-4" />
                    <span>En cours ({challenges.filter(chall => {
                      const today = new Date().toISOString().split('T')[0];
                      return chall.end_date >= today && chall.status !== 'achieved';
                    }).length})</span>
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('completed_challenges')}
                  className={`px-2 md:px-4 py-2 text-xs md:text-sm font-semibold transition-all rounded-t-lg ${
                    activeTab === 'completed_challenges'
                      ? 'bg-green-300 text-gray-800 shadow-md border-b-4 border-green-500'
                      : 'text-gray-600 hover:text-green-600 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center justify-center gap-1">
                    <Trophy className="w-4 h-4" />
                    <span>Challenges terminés ({challenges.filter(chall => {
                      const today = new Date().toISOString().split('T')[0];
                      return chall.end_date < today || chall.status === 'achieved';
                    }).length})</span>
                  </div>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-12">Chargement...</div>
          ) : (
            <>
              {activeTab === 'create_objective' && (
                <CreateObjectiveTab
                  editingObjective={editingObjective}
                  setEditingObjective={setEditingObjective}
                  newObjective={newObjective}
                  setNewObjective={setNewObjective}
                  sellers={sellers}
                  selectedVisibleSellers={selectedVisibleSellers}
                  setSelectedVisibleSellers={setSelectedVisibleSellers}
                  isSellerDropdownOpen={isSellerDropdownOpen}
                  setIsSellerDropdownOpen={setIsSellerDropdownOpen}
                  sellerDropdownRef={sellerDropdownRef}
                  handleCreateObjective={handleCreateObjective}
                  handleUpdateObjective={handleUpdateObjective}
                  setActiveTab={setActiveTab}
                />
              )}

              {activeTab === 'active_objectives' && (
                <ActiveObjectivesTab
                  objectives={objectives}
                  sellers={sellers}
                  updatingProgressObjectiveId={updatingProgressObjectiveId}
                  setUpdatingProgressObjectiveId={setUpdatingProgressObjectiveId}
                  progressValue={progressValue}
                  setProgressValue={setProgressValue}
                  handleDeleteObjective={handleDeleteObjective}
                  handleUpdateProgress={handleUpdateProgress}
                  setEditingObjective={setEditingObjective}
                  setActiveTab={setActiveTab}
                />
              )}

              {activeTab === 'completed_objectives' && (
                <ObjectivesCompletedTab objectives={objectives} onDeleteObjective={handleDeleteObjective} />
              )}

              {activeTab === 'create_challenge' && (
                <CreateChallengeTab
                  editingChallenge={editingChallenge}
                  setEditingChallenge={setEditingChallenge}
                  newChallenge={newChallenge}
                  setNewChallenge={setNewChallenge}
                  sellers={sellers}
                  selectedVisibleSellersChallenge={selectedVisibleSellersChallenge}
                  setSelectedVisibleSellersChallenge={setSelectedVisibleSellersChallenge}
                  isChallengeSellerDropdownOpen={isChallengeSellerDropdownOpen}
                  setIsChallengeSellerDropdownOpen={setIsChallengeSellerDropdownOpen}
                  challengeSellerDropdownRef={challengeSellerDropdownRef}
                  handleCreateChallenge={handleCreateChallenge}
                  handleUpdateChallenge={handleUpdateChallenge}
                />
              )}

              {activeTab === 'active_challenges' && (
                <ActiveChallengesTab
                  challenges={challenges}
                  sellers={sellers}
                  updatingProgressChallengeId={updatingProgressChallengeId}
                  setUpdatingProgressChallengeId={setUpdatingProgressChallengeId}
                  challengeProgressValue={challengeProgressValue}
                  setChallengeProgressValue={setChallengeProgressValue}
                  handleDeleteChallenge={handleDeleteChallenge}
                  setEditingChallenge={setEditingChallenge}
                  setActiveTab={setActiveTab}
                  storeParam={storeParam}
                  fetchData={fetchData}
                  onUpdate={onUpdate}
                />
              )}

              {activeTab === 'completed_challenges' && (
                <ChallengesCompletedTab challenges={challenges} onDeleteChallenge={handleDeleteChallenge} />
              )}
            </>
          )}
        </div>
      </div>

      {/* Achievement Modal */}
      <AchievementModal
        isOpen={achievementModal.isOpen}
        onClose={() => setAchievementModal({ isOpen: false, item: null, itemType: null })}
        item={achievementModal.item}
        itemType={achievementModal.itemType}
        onMarkAsSeen={handleMarkAchievementAsSeen}
        userRole="manager"
      />
    </div>
  );
}
