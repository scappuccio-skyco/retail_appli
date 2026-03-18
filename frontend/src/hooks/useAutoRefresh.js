import { useEffect, useRef, useCallback } from 'react';

/**
 * Rafraîchit automatiquement les données à intervalle régulier.
 *
 * - Se met en pause si l'onglet est caché (Page Visibility API)
 * - Se déclenche immédiatement quand l'onglet redevient visible
 * - Ne se déclenche pas au montage (le chargement initial est géré par le composant)
 *
 * @param {Function} callback  Fonction async de rafraîchissement (ex: fetchTasks)
 * @param {number}   interval  Intervalle en ms (défaut: 30 000)
 * @param {boolean}  enabled   Désactiver le polling si false (ex: pendant le chargement initial)
 */
export function useAutoRefresh(callback, interval = 30_000, enabled = true) {
  const callbackRef = useRef(callback);

  // Toujours garder la ref à jour sans relancer l'effet
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return;

    const tick = () => {
      if (!document.hidden) {
        callbackRef.current();
      }
    };

    // Rafraîchir immédiatement quand l'onglet redevient visible
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        callbackRef.current();
      }
    };

    const timerId = setInterval(tick, interval);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(timerId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [interval, enabled]);
}
