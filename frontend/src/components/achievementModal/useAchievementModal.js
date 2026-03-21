import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import { api } from '../../lib/apiClient';
import { logger } from '../../utils/logger';

const CONFETTI_COLORS = ['#ffd700', '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', '#ff9ff3', '#54a0ff', '#ffa502', '#ff6348'];

function triggerConfetti() {
  const end = Date.now() + 6000;
  confetti({ particleCount: 150, spread: 80, origin: { x: 0.5, y: 0.5 }, colors: CONFETTI_COLORS, startVelocity: 45, gravity: 0.8, ticks: 300, decay: 0.9 });
  setTimeout(() => {
    confetti({ particleCount: 100, spread: 60, origin: { x: 0.5, y: 0.4 }, colors: CONFETTI_COLORS, startVelocity: 35, gravity: 0.9, ticks: 250 });
  }, 500);
  (function frame() {
    confetti({ particleCount: 8, angle: 60, spread: 60, origin: { x: 0 }, colors: CONFETTI_COLORS, startVelocity: 35, gravity: 0.8 });
    confetti({ particleCount: 8, angle: 120, spread: 60, origin: { x: 1 }, colors: CONFETTI_COLORS, startVelocity: 35, gravity: 0.8 });
    confetti({ particleCount: 5, angle: 90, spread: 50, origin: { x: 0.5, y: 0 }, colors: CONFETTI_COLORS, startVelocity: 30, gravity: 0.9 });
    if (Math.random() > 0.7) {
      confetti({ particleCount: 20, spread: 40, origin: { x: Math.random() * 0.4 + 0.3, y: Math.random() * 0.3 + 0.2 }, colors: CONFETTI_COLORS, startVelocity: 25, gravity: 0.85 });
    }
    if (Date.now() < end) requestAnimationFrame(frame);
  }());
}

export default function useAchievementModal({ isOpen, item, itemType, userRole, onClose, onMarkAsSeen }) {
  const confettiTriggered = useRef(false);

  // Inject CSS animations once
  useEffect(() => {
    if (typeof document !== 'undefined' && !document.getElementById('achievement-modal-styles')) {
      const style = document.createElement('style');
      style.id = 'achievement-modal-styles';
      style.textContent = `
        @keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
        .animate-shimmer { animation: shimmer 2s ease-in-out infinite; }
        @keyframes modal-enter {
          0% { opacity: 0; transform: scale(0.7) translateY(-50px) rotate(-5deg); }
          50% { transform: scale(1.05) translateY(0) rotate(2deg); }
          100% { opacity: 1; transform: scale(1) translateY(0) rotate(0deg); }
        }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 20px rgba(255,215,0,0.5), 0 0 40px rgba(255,140,0,0.3); }
          50% { box-shadow: 0 0 30px rgba(255,215,0,0.8), 0 0 60px rgba(255,140,0,0.5); }
        }
        .modal-enter { animation: modal-enter 0.6s cubic-bezier(0.34, 1.56, 0.64, 1); }
        .modal-glow { animation: pulse-glow 2s ease-in-out infinite; }
      `;
      document.head.appendChild(style);
    }
  }, []);

  useEffect(() => {
    if (isOpen && item && !confettiTriggered.current) {
      confettiTriggered.current = true;
      const t = setTimeout(triggerConfetti, 500);
      return () => clearTimeout(t);
    } else if (!isOpen) {
      confettiTriggered.current = false;
    }
  }, [isOpen, item]);

  const handleMarkAsSeen = async () => {
    try {
      const endpoint = userRole === 'seller'
        ? `/${userRole}/${itemType}s/${item.id}/mark-achievement-seen`
        : `/manager/${itemType}s/${item.id}/mark-achievement-seen`;
      await api.post(endpoint);
      setTimeout(() => {
        onClose();
        toast.success('Félicitations ! 🎉');
        setTimeout(async () => { if (onMarkAsSeen) await onMarkAsSeen(); }, 300);
      }, 2000);
    } catch (err) {
      logger.error('Error marking achievement as seen:', err);
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const formatValue = (value, unit) => {
    if (typeof value === 'number') {
      return value.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + (unit ? ` ${unit}` : '');
    }
    return `${value}${unit ? ` ${unit}` : ''}`;
  };

  const getAchievementMessage = () =>
    itemType === 'objective'
      ? `Vous avez atteint votre objectif "${item.title}" ! 🎯`
      : `Vous avez terminé le challenge "${item.title}" ! 🏆`;

  const getAchievementDetails = () => {
    if (itemType === 'objective') {
      return {
        target: formatValue(item.target_value, item.unit),
        current: formatValue(item.current_value, item.unit),
        progress: item.progress_percentage || ((item.current_value / item.target_value) * 100).toFixed(1),
      };
    }
    if (item.ca_target) {
      return { target: formatValue(item.ca_target, '€'), current: formatValue(item.progress_ca, '€'), progress: ((item.progress_ca / item.ca_target) * 100).toFixed(1) };
    }
    if (item.ventes_target) {
      return { target: formatValue(item.ventes_target, 'ventes'), current: formatValue(item.progress_ventes, 'ventes'), progress: ((item.progress_ventes / item.ventes_target) * 100).toFixed(1) };
    }
    return null;
  };

  return { handleMarkAsSeen, getAchievementMessage, getAchievementDetails };
}
