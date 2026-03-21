import React, { useState, useEffect, useRef } from 'react';
import { X, Target, History } from 'lucide-react';
import { api } from '../lib/apiClient';
import { logger } from '../utils/logger';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import AchievementModal from './AchievementModal';
import ObjectivesTab from './objectivesModal/ObjectivesTab';
import HistoriqueTab from './objectivesModal/HistoriqueTab';

export default function ObjectivesModal({
  isOpen,
  onClose,
  activeObjectives: initialObjectives = [],
  onUpdate,
  initialObjectiveId = null,
}) {
  const isMountedRef = useRef(true);
  useEffect(() => () => { isMountedRef.current = false; }, []);

  // Local state for objectives
  const [activeObjectives, setActiveObjectives] = useState(initialObjectives);

  // Update local state when props change
  useEffect(() => {
    setActiveObjectives(initialObjectives);
  }, [initialObjectives]);

  // Always refresh data when modal opens to ensure latest updates are shown
  useEffect(() => {
    if (isOpen) refreshActiveData();
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (initialObjectiveId) {
      setTimeout(() => {
        const el = document.getElementById(`seller-obj-${initialObjectiveId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('ring-2', 'ring-orange-400');
          setTimeout(() => el.classList.remove('ring-2', 'ring-orange-400'), 3000);
        }
      }, 400);
    }
  }, [initialObjectiveId]);

  const [activeTab, setActiveTab] = useState('objectifs'); // 'objectifs' or 'historique'
  const [updatingObjectiveId, setUpdatingObjectiveId] = useState(null);
  const [objectiveProgressValue, setObjectiveProgressValue] = useState('');

  // Historique states
  const [historyObjectives, setHistoryObjectives] = useState([]);
  const [historyStatusFilter, setHistoryStatusFilter] = useState('all'); // 'all', 'achieved', 'not_achieved'

  // Achievement notification states
  const [achievementModal, setAchievementModal] = useState({
    isOpen: false,
    item: null,
    itemType: null,
  });

  // Fetch history when tab changes to historique
  useEffect(() => {
    if (activeTab === 'historique' && isOpen) fetchHistory();
  }, [activeTab, isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchHistory = async () => {
    try {
      const objRes = await api.get('/seller/objectives/history');
      if (!isMountedRef.current) return;
      setHistoryObjectives(objRes.data);
    } catch (err) {
      if (!isMountedRef.current) return;
      logger.error('Error fetching history:', err);
      toast.error("Erreur lors du chargement de l'historique");
    }
  };

  const refreshActiveData = async () => {
    try {
      const objRes = await api.get('/seller/objectives/active');
      const objectives = objRes.data || [];

      if (!isMountedRef.current) return;

      // Filter out achieved objectives from active list
      const activeOnly = objectives.filter((obj) => obj.status !== 'achieved');
      setActiveObjectives(activeOnly);

      // Check for unseen achievements and show modal
      if (!achievementModal.isOpen) {
        const unseenObjective = activeOnly.find((obj) => obj.has_unseen_achievement === true);
        if (unseenObjective) {
          setAchievementModal({ isOpen: true, item: unseenObjective, itemType: 'objective' });
        }
      }

      // Also refresh history if we're on the history tab
      if (activeTab === 'historique') {
        await fetchHistory();
      }

      if (onUpdate) {
        onUpdate();
      }
    } catch (err) {
      if (!isMountedRef.current) return;
      logger.error('Error refreshing data:', err);
    }
  };

  const handleMarkAchievementAsSeen = async () => {
    setAchievementModal({ isOpen: false, item: null, itemType: null });
    await refreshActiveData();
    if (activeTab === 'historique') {
      await fetchHistory();
    }
    if (onUpdate) {
      onUpdate();
    }
  };

  const triggerConfetti = () => {
    try {
      const confettiFn = confetti || globalThis.confetti;
      if (!confettiFn) return;
      confettiFn({
        particleCount: 30,
        spread: 50,
        origin: { y: 0.6 },
        colors: ['#ffd700', '#ff6b6b', '#4ecdc4'],
        zIndex: 99999,
      });
    } catch (error) {
      // Silently fail - confetti is not critical for functionality
    }
  };

  const handleUpdateProgress = async (objectiveId) => {
    try {
      const value = Number.parseFloat(objectiveProgressValue);
      if (isNaN(value) || value < 0) {
        toast.error('Veuillez entrer une valeur valide');
        return;
      }

      const response = await api.post(`/seller/objectives/${objectiveId}/progress`, {
        value: value,
        mode: 'add',
      });

      const updatedObjective = response.data;

      setUpdatingObjectiveId(null);
      setObjectiveProgressValue('');

      triggerConfetti();
      toast.success('Progression mise à jour !', { duration: 2000 });

      if (
        updatedObjective.just_achieved === true &&
        updatedObjective.has_unseen_achievement === true
      ) {
        setAchievementModal({ isOpen: true, item: updatedObjective, itemType: 'objective' });
      }

      await refreshActiveData();
    } catch (error) {
      logger.error('Error updating progress:', error);
      toast.error(error.response?.data?.detail || 'Erreur lors de la mise à jour');
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <style>{`
        @keyframes celebrate {
          0%, 100% { transform: scale(1) rotate(0deg); }
          25% { transform: scale(1.1) rotate(-5deg); }
          50% { transform: scale(1.15) rotate(5deg); }
          75% { transform: scale(1.1) rotate(-3deg); }
        }
        @keyframes confetti {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(-100px) rotate(360deg); opacity: 0; }
        }
        .celebrate-animation {
          animation: celebrate 0.6s ease-in-out infinite;
        }
        .confetti {
          position: absolute;
          width: 10px;
          height: 10px;
          background: #10b981;
          animation: confetti 2s ease-out forwards;
        }
      `}</style>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-900 via-teal-800 to-green-800 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">🎯 Mes Objectifs</h2>
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
              <button
                onClick={() => setActiveTab('objectifs')}
                className={`px-2 md:px-4 py-2 text-xs md:text-sm font-semibold transition-all rounded-t-lg ${
                  activeTab === 'objectifs'
                    ? 'bg-blue-300 text-gray-800 shadow-md border-b-4 border-blue-500'
                    : 'text-gray-600 hover:text-blue-600 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center justify-center gap-1">
                  <Target className="w-4 h-4" />
                  <span>Objectifs ({activeObjectives.length})</span>
                </div>
              </button>
              <button
                onClick={() => setActiveTab('historique')}
                className={`px-2 md:px-4 py-2 text-xs md:text-sm font-semibold transition-all rounded-t-lg ${
                  activeTab === 'historique'
                    ? 'bg-purple-300 text-gray-800 shadow-md border-b-4 border-purple-500'
                    : 'text-gray-600 hover:text-purple-600 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center justify-center gap-1">
                  <History className="w-4 h-4" />
                  <span className="hidden sm:inline">Historique</span>
                  <span className="sm:hidden">Hist.</span>
                </div>
              </button>
            </div>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === 'objectifs' && (
              <ObjectivesTab
                activeObjectives={activeObjectives}
                updatingObjectiveId={updatingObjectiveId}
                objectiveProgressValue={objectiveProgressValue}
                setUpdatingObjectiveId={setUpdatingObjectiveId}
                setObjectiveProgressValue={setObjectiveProgressValue}
                handleUpdateProgress={handleUpdateProgress}
              />
            )}

            {activeTab === 'historique' && (
              <HistoriqueTab
                historyObjectives={historyObjectives}
                historyStatusFilter={historyStatusFilter}
                setHistoryStatusFilter={setHistoryStatusFilter}
              />
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
          userRole="seller"
        />
      </div>
    </>
  );
}
