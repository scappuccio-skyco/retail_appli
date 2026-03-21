import React from 'react';
import { X, Trophy, Target, Sparkles } from 'lucide-react';
import useAchievementModal from './achievementModal/useAchievementModal';

export default function AchievementModal({ isOpen, onClose, item, itemType, onMarkAsSeen, userRole = 'seller' }) {
  const { handleMarkAsSeen, getAchievementMessage, getAchievementDetails } = useAchievementModal({ isOpen, item, itemType, userRole, onClose, onMarkAsSeen });

  if (!isOpen || !item) return null;

  const details = getAchievementDetails();

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[9999] p-4"
      onClick={(e) => { if (e.target === e.currentTarget) handleMarkAsSeen(); }}
    >
      <div className="bg-gradient-to-br from-yellow-50 via-orange-50 to-pink-50 rounded-3xl shadow-2xl max-w-2xl w-full border-4 border-yellow-400 modal-enter modal-glow relative overflow-hidden">

        {/* Header */}
        <div className="relative bg-gradient-to-r from-yellow-400 via-orange-400 to-pink-400 p-6 rounded-t-3xl">
          <div className="absolute inset-0 overflow-hidden rounded-t-3xl">
            <Sparkles className="absolute top-2 left-4 w-8 h-8 text-yellow-200 animate-[bounce_1s_ease-in-out_infinite]" style={{ animationDelay: '0s' }} />
            <Sparkles className="absolute top-4 right-8 w-7 h-7 text-pink-200 animate-[bounce_1s_ease-in-out_infinite]" style={{ animationDelay: '0.2s' }} />
            <Sparkles className="absolute bottom-2 left-1/4 w-6 h-6 text-orange-200 animate-[bounce_1s_ease-in-out_infinite]" style={{ animationDelay: '0.4s' }} />
            <Sparkles className="absolute bottom-4 right-1/4 w-7 h-7 text-yellow-200 animate-[bounce_1s_ease-in-out_infinite]" style={{ animationDelay: '0.6s' }} />
            <Sparkles className="absolute top-1/2 left-1/2 w-10 h-10 text-white animate-[bounce_0.8s_ease-in-out_infinite] transform -translate-x-1/2 -translate-y-1/2" style={{ animationDelay: '0.3s' }} />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-20 animate-shimmer" />
          </div>
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white bg-opacity-30 rounded-full flex items-center justify-center backdrop-blur-sm">
                {itemType === 'objective' ? <Target className="w-10 h-10 text-white" /> : <Trophy className="w-10 h-10 text-white" />}
              </div>
              <div>
                <h2 className="text-3xl font-bold text-white drop-shadow-lg">🎉 Félicitations !</h2>
                <p className="text-yellow-100 text-sm mt-1">Objectif atteint avec succès</p>
              </div>
            </div>
            <button onClick={handleMarkAsSeen} className="p-2 hover:bg-white hover:bg-opacity-20 rounded-full transition-all">
              <X className="w-6 h-6 text-white" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-8">
          <div className="text-center mb-6">
            <p className="text-2xl font-bold text-gray-800 mb-2">{getAchievementMessage()}</p>
            {item.description && <p className="text-gray-600 italic">{item.description}</p>}
          </div>

          {details && (
            <div className="bg-white rounded-2xl p-6 mb-6 border-2 border-yellow-200">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div><p className="text-sm text-gray-500 mb-1">Cible</p><p className="text-xl font-bold text-gray-700">{details.target}</p></div>
                <div><p className="text-sm text-gray-500 mb-1">Atteint</p><p className="text-xl font-bold text-green-600">{details.current}</p></div>
                <div><p className="text-sm text-gray-500 mb-1">Progression</p><p className="text-xl font-bold text-purple-600">{details.progress}%</p></div>
              </div>
            </div>
          )}

          {details && (
            <div className="mb-6">
              <div className="w-full bg-gray-200 rounded-full h-6 overflow-hidden shadow-inner">
                <div
                  className="h-6 bg-gradient-to-r from-green-400 via-emerald-500 to-green-600 rounded-full transition-all duration-1000 relative"
                  style={{ width: `${Math.min(Number.parseFloat(details.progress), 100)}%` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-40 animate-shimmer" />
                  <div className="h-full bg-white opacity-20 animate-[pulse_1.5s_ease-in-out_infinite]" />
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-center">
            <button onClick={handleMarkAsSeen} className="px-8 py-4 bg-gradient-to-r from-yellow-400 via-orange-400 to-pink-400 text-white font-bold text-lg rounded-xl hover:from-yellow-500 hover:via-orange-500 hover:to-pink-500 transition-all transform hover:scale-105 shadow-lg hover:shadow-xl">
              🎊 Voir mes résultats
            </button>
          </div>
          <p className="text-center text-sm text-gray-500 mt-4">Cet objectif sera déplacé dans l'historique</p>
        </div>
      </div>
    </div>
  );
}
