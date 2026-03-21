import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { api } from '../../lib/apiClient';
import { logger } from '../../utils/logger';
import confetti from 'canvas-confetti';

function triggerConfetti() {
  const end = Date.now() + 3000;
  const colors = ['#ffd700', '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4'];
  (function frame() {
    confetti({ particleCount: 3, angle: 60,  spread: 55, origin: { x: 0 }, colors });
    confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1 }, colors });
    if (Date.now() < end) requestAnimationFrame(frame);
  }());
}

function triggerPartialConfetti() {
  const end = Date.now() + 2000;
  const colors = ['#fb923c', '#fdba74', '#fcd34d'];
  (function frame() {
    confetti({ particleCount: 2, angle: 90, spread: 45, origin: { x: 0.5, y: 0.5 }, colors });
    if (Date.now() < end) requestAnimationFrame(frame);
  }());
}

function triggerFailAnimation() {
  const el = document.querySelector('.challenge-modal-content');
  if (el) {
    el.classList.add('shake-animation');
    setTimeout(() => el.classList.remove('shake-animation'), 600);
  }
}

export default function useDailyChallengeModal({ challenge, onClose, onRefresh, onComplete }) {
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api.get('/seller/daily-challenge/stats')
      .then(res => { if (!cancelled) setStats(res.data); })
      .catch(err => { if (!cancelled) logger.error('Error fetching stats:', err); });
    return () => { cancelled = true; };
  }, []);

  const handleComplete = async (result) => {
    if (!result) { setShowFeedbackForm(true); return; }
    setLoading(true);
    try {
      const res = await api.post('/seller/daily-challenge/complete', {
        challenge_id: challenge.id,
        result,
        comment: feedbackComment || null,
      });
      const messages = {
        success: '🎉 Excellent ! Défi réussi !',
        partial: '💪 Bon effort ! Continue comme ça !',
        failed:  '🤔 Pas grave ! Chaque essai te fait progresser !',
      };
      toast.success(messages[result] || '✅ Feedback enregistré !');
      if (result === 'success') triggerConfetti();
      else if (result === 'partial') triggerPartialConfetti();
      else if (result === 'failed') triggerFailAnimation();
      if (onComplete) onComplete(res.data);
      setTimeout(() => onClose(), 1500);
    } catch (err) {
      logger.error('Error completing challenge:', err);
      toast.error('Erreur lors de la validation');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setLoading(true);
    try {
      const res = await api.post('/seller/daily-challenge/refresh', {});
      toast.success('✨ Nouveau défi généré !');
      if (onRefresh) onRefresh(res.data);
    } catch (err) {
      logger.error('Error refreshing challenge:', err);
      toast.error('Erreur lors du rafraîchissement');
    } finally {
      setLoading(false);
    }
  };

  return {
    stats, loading,
    showFeedbackForm, setShowFeedbackForm,
    feedbackComment, setFeedbackComment,
    handleComplete, handleRefresh,
  };
}
