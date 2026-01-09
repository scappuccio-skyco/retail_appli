import React, { useEffect, useRef } from 'react';
import { X, Trophy, Target, Sparkles } from 'lucide-react';
import { api } from '../lib/apiClient';
import { logger } from '../utils/logger';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';

export default function AchievementModal({ 
  isOpen, 
  onClose, 
  item, 
  itemType, // 'objective' or 'challenge'
  onMarkAsSeen,
  userRole = 'seller' // 'seller' or 'manager'
}) {
  const confettiTriggered = useRef(false);
  
  // Add shimmer animation styles
  useEffect(() => {
    if (typeof document !== 'undefined' && !document.getElementById('achievement-modal-styles')) {
      const style = document.createElement('style');
      style.id = 'achievement-modal-styles';
      style.textContent = `
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer {
          animation: shimmer 2s ease-in-out infinite;
        }
        @keyframes modal-enter {
          0% {
            opacity: 0;
            transform: scale(0.7) translateY(-50px) rotate(-5deg);
          }
          50% {
            transform: scale(1.05) translateY(0) rotate(2deg);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0) rotate(0deg);
          }
        }
        @keyframes pulse-glow {
          0%, 100% {
            box-shadow: 0 0 20px rgba(255, 215, 0, 0.5), 0 0 40px rgba(255, 140, 0, 0.3);
          }
          50% {
            box-shadow: 0 0 30px rgba(255, 215, 0, 0.8), 0 0 60px rgba(255, 140, 0, 0.5);
          }
        }
        .modal-enter {
          animation: modal-enter 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .modal-glow {
          animation: pulse-glow 2s ease-in-out infinite;
        }
      `;
      document.head.appendChild(style);
    }
  }, []);
  
  // Trigger confetti when modal opens (grande victoire)
  useEffect(() => {
    if (isOpen && item && !confettiTriggered.current) {
      confettiTriggered.current = true;
      
      // Delay confetti slightly to let modal appear first
      const confettiTimeout = setTimeout(() => {
        triggerConfetti();
      }, 500);
      
      return () => {
        clearTimeout(confettiTimeout);
      };
    } else if (!isOpen) {
      confettiTriggered.current = false;
    }
  }, [isOpen, item]);
  
  const triggerConfetti = () => {
    const duration = 6000; // 6 seconds of confetti for better visibility
    const end = Date.now() + duration;
    const colors = ['#ffd700', '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', '#ff9ff3', '#54a0ff', '#ffa502', '#ff6348'];
    
    // Initial big burst from center
    confetti({
      particleCount: 150,
      spread: 80,
      origin: { x: 0.5, y: 0.5 },
      colors: colors,
      startVelocity: 45,
      gravity: 0.8,
      ticks: 300,
      decay: 0.9
    });
    
    // Second burst after a short delay
    setTimeout(() => {
      confetti({
        particleCount: 100,
        spread: 60,
        origin: { x: 0.5, y: 0.4 },
        colors: colors,
        startVelocity: 35,
        gravity: 0.9,
        ticks: 250
      });
    }, 500);
    
    // Continuous confetti from sides and top
    (function frame() {
      // Left side
      confetti({
        particleCount: 8,
        angle: 60,
        spread: 60,
        origin: { x: 0 },
        colors: colors,
        startVelocity: 35,
        gravity: 0.8
      });
      
      // Right side
      confetti({
        particleCount: 8,
        angle: 120,
        spread: 60,
        origin: { x: 1 },
        colors: colors,
        startVelocity: 35,
        gravity: 0.8
      });
      
      // Top center
      confetti({
        particleCount: 5,
        angle: 90,
        spread: 50,
        origin: { x: 0.5, y: 0 },
        colors: colors,
        startVelocity: 30,
        gravity: 0.9
      });
      
      // Random bursts
      if (Math.random() > 0.7) {
        confetti({
          particleCount: 20,
          spread: 40,
          origin: { 
            x: Math.random() * 0.4 + 0.3, 
            y: Math.random() * 0.3 + 0.2 
          },
          colors: colors,
          startVelocity: 25,
          gravity: 0.85
        });
      }
      
      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    }());
  };
  
  if (!isOpen || !item) return null;
  

  const handleMarkAsSeen = async () => {
    try {
      const endpoint = userRole === 'seller' 
        ? `/${userRole}/${itemType}s/${item.id}/mark-achievement-seen`
        : `/manager/${itemType}s/${item.id}/mark-achievement-seen`;
      
      await api.post(endpoint);
      logger.log(`✅ Achievement notification marked as seen for ${itemType}:`, item.id);
      
      // Wait longer before closing to ensure animation is visible
      // The confetti lasts 6 seconds, so we keep modal open for at least 2 seconds
      setTimeout(() => {
        onClose();
        toast.success('Félicitations ! 🎉');
        
        // Then call parent callback to refresh data (after modal closes)
        setTimeout(async () => {
          if (onMarkAsSeen) {
            await onMarkAsSeen();
          }
        }, 300);
      }, 2000); // Keep modal open for 2 seconds to see animation and confetti
    } catch (err) {
      logger.error('Error marking achievement as seen:', err);
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const formatValue = (value, unit) => {
    if (typeof value === 'number') {
      return value.toLocaleString('fr-FR', { 
        minimumFractionDigits: 0, 
        maximumFractionDigits: 2 
      }) + (unit ? ` ${unit}` : '');
    }
    return `${value}${unit ? ` ${unit}` : ''}`;
  };

  const getAchievementMessage = () => {
    if (itemType === 'objective') {
      return `Vous avez atteint votre objectif "${item.title}" ! 🎯`;
    } else {
      return `Vous avez terminé le challenge "${item.title}" ! 🏆`;
    }
  };

  const getAchievementDetails = () => {
    if (itemType === 'objective') {
      return {
        target: formatValue(item.target_value, item.unit),
        current: formatValue(item.current_value, item.unit),
        progress: item.progress_percentage || ((item.current_value / item.target_value) * 100).toFixed(1)
      };
    } else {
      // For challenges, find the relevant metric
      if (item.ca_target) {
        return {
          target: formatValue(item.ca_target, '€'),
          current: formatValue(item.progress_ca, '€'),
          progress: ((item.progress_ca / item.ca_target) * 100).toFixed(1)
        };
      } else if (item.ventes_target) {
        return {
          target: formatValue(item.ventes_target, 'ventes'),
          current: formatValue(item.progress_ventes, 'ventes'),
          progress: ((item.progress_ventes / item.ventes_target) * 100).toFixed(1)
        };
      }
    }
    return null;
  };

  const details = getAchievementDetails();

  
  if (!isOpen || !item) {
    return null;
  }
  
  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[9999] p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleMarkAsSeen();
        }
      }}
    >
      <div className="bg-gradient-to-br from-yellow-50 via-orange-50 to-pink-50 rounded-3xl shadow-2xl max-w-2xl w-full border-4 border-yellow-400 modal-enter modal-glow relative overflow-hidden">
        {/* Header with confetti effect */}
        <div className="relative bg-gradient-to-r from-yellow-400 via-orange-400 to-pink-400 p-6 rounded-t-3xl">
          <div className="absolute inset-0 overflow-hidden rounded-t-3xl">
            {/* More sparkles for better effect */}
            <Sparkles className="absolute top-2 left-4 w-8 h-8 text-yellow-200 animate-[bounce_1s_ease-in-out_infinite]" style={{ animationDelay: '0s' }} />
            <Sparkles className="absolute top-4 right-8 w-7 h-7 text-pink-200 animate-[bounce_1s_ease-in-out_infinite]" style={{ animationDelay: '0.2s' }} />
            <Sparkles className="absolute bottom-2 left-1/4 w-6 h-6 text-orange-200 animate-[bounce_1s_ease-in-out_infinite]" style={{ animationDelay: '0.4s' }} />
            <Sparkles className="absolute bottom-4 right-1/4 w-7 h-7 text-yellow-200 animate-[bounce_1s_ease-in-out_infinite]" style={{ animationDelay: '0.6s' }} />
            <Sparkles className="absolute top-1/2 left-1/2 w-10 h-10 text-white animate-[bounce_0.8s_ease-in-out_infinite] transform -translate-x-1/2 -translate-y-1/2" style={{ animationDelay: '0.3s' }} />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-20 animate-shimmer"></div>
          </div>
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white bg-opacity-30 rounded-full flex items-center justify-center backdrop-blur-sm">
                {itemType === 'objective' ? (
                  <Target className="w-10 h-10 text-white" />
                ) : (
                  <Trophy className="w-10 h-10 text-white" />
                )}
              </div>
              <div>
                <h2 className="text-3xl font-bold text-white drop-shadow-lg">
                  🎉 Félicitations !
                </h2>
                <p className="text-yellow-100 text-sm mt-1">Objectif atteint avec succès</p>
              </div>
            </div>
            <button
              onClick={handleMarkAsSeen}
              className="p-2 hover:bg-white hover:bg-opacity-20 rounded-full transition-all"
            >
              <X className="w-6 h-6 text-white" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-8">
          <div className="text-center mb-6">
            <p className="text-2xl font-bold text-gray-800 mb-2">
              {getAchievementMessage()}
            </p>
            {item.description && (
              <p className="text-gray-600 italic">{item.description}</p>
            )}
          </div>

          {details && (
            <div className="bg-white rounded-2xl p-6 mb-6 border-2 border-yellow-200">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Cible</p>
                  <p className="text-xl font-bold text-gray-700">{details.target}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Atteint</p>
                  <p className="text-xl font-bold text-green-600">{details.current}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Progression</p>
                  <p className="text-xl font-bold text-purple-600">{details.progress}%</p>
                </div>
              </div>
            </div>
          )}

          {/* Progress bar visualization */}
          {details && (
            <div className="mb-6">
              <div className="w-full bg-gray-200 rounded-full h-6 overflow-hidden shadow-inner">
                <div 
                  className="h-6 bg-gradient-to-r from-green-400 via-emerald-500 to-green-600 rounded-full transition-all duration-1000 relative"
                  style={{ width: `${Math.min(parseFloat(details.progress), 100)}%` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-40 animate-shimmer"></div>
                  <div className="h-full bg-white opacity-20 animate-[pulse_1.5s_ease-in-out_infinite]"></div>
                </div>
              </div>
            </div>
          )}

          {/* Action button */}
          <div className="flex justify-center">
            <button
              onClick={handleMarkAsSeen}
              className="px-8 py-4 bg-gradient-to-r from-yellow-400 via-orange-400 to-pink-400 text-white font-bold text-lg rounded-xl hover:from-yellow-500 hover:via-orange-500 hover:to-pink-500 transition-all transform hover:scale-105 shadow-lg hover:shadow-xl"
            >
              🎊 Voir mes résultats
            </button>
          </div>

          <p className="text-center text-sm text-gray-500 mt-4">
            Cet objectif sera déplacé dans l'historique
          </p>
        </div>
      </div>
    </div>
  );
}
