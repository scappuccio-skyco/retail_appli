import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/apiClient';
import { logger } from '../utils/logger';

/**
 * Hook pour gérer l'état et la navigation de l'onboarding avec persistance
 * 
 * @param {number} totalSteps - Nombre total d'étapes
 * @returns {Object} État et fonctions de navigation
 */
export const useOnboarding = (totalSteps, { readyToAutoOpen = true } = {}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState([]);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [pendingAutoOpen, setPendingAutoOpen] = useState(false);

  // Charger la progression depuis le backend
  useEffect(() => {
    const loadProgress = async () => {
      try {
        const response = await api.get('/onboarding/progress');

        if (response.data) {
          if (response.data.is_completed) {
            setIsCompleted(true);
          } else {
            const step = response.data.current_step || 0;
            const completed = response.data.completed_steps || [];
            setCurrentStep(step);
            setCompletedSteps(completed);
            // Premier login : jamais démarré → ouvrir automatiquement (si prêt)
            if (step === 0 && completed.length === 0) {
              if (readyToAutoOpen) setIsOpen(true);
              else setPendingAutoOpen(true);
            }
          }
        }
        setIsLoaded(true);
      } catch (error) {
        logger.error('Error loading onboarding progress:', error);
        setIsLoaded(true);
      }
    };

    loadProgress();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Déclenche l'auto-open dès que readyToAutoOpen devient true (si en attente)
  useEffect(() => {
    if (readyToAutoOpen && pendingAutoOpen) {
      setIsOpen(true);
      setPendingAutoOpen(false);
    }
  }, [readyToAutoOpen, pendingAutoOpen]);

  // Sauvegarder la progression dans le backend
  const saveProgress = useCallback(async (step, completed) => {
    try {
      await api.post('/onboarding/progress', {
        current_step: step,
        completed_steps: completed,
        is_completed: false
      });
    } catch (error) {
      logger.error('Error saving onboarding progress:', error);
    }
  }, []);

  // Marquer l'onboarding comme terminé
  const markAsComplete = useCallback(async () => {
    try {
      await api.post('/onboarding/complete', {});
    } catch (error) {
      logger.error('Error marking onboarding complete:', error);
    }
  }, []);

  // Ouvrir le modal
  const open = () => {
    setIsOpen(true);
  };

  // Fermer le modal et sauvegarder la progression (sans toucher is_completed)
  const close = () => {
    setIsOpen(false);
    if (isLoaded) {
      saveProgress(currentStep, completedSteps);
    }
  };

  // Étape suivante
  const next = () => {
    if (currentStep < totalSteps - 1) {
      const newCompleted = !completedSteps.includes(currentStep)
        ? [...completedSteps, currentStep]
        : completedSteps;
      const newStep = currentStep + 1;

      setCompletedSteps(newCompleted);
      setCurrentStep(newStep);

      if (isLoaded) {
        saveProgress(newStep, newCompleted);
      }
    } else {
      // Dernière étape : marquer complet et fermer SANS repasser par close()
      // (évite la race condition close() → saveProgress(is_completed:false) après markAsComplete)
      const newCompleted = !completedSteps.includes(currentStep)
        ? [...completedSteps, currentStep]
        : completedSteps;

      setCompletedSteps(newCompleted);

      if (isLoaded) {
        markAsComplete();
      }

      setIsCompleted(true);
      setIsOpen(false); // pas close() — ne re-sauvegarde pas avec is_completed:false
    }
  };

  // Étape précédente
  const prev = () => {
    if (currentStep > 0) {
      const newStep = currentStep - 1;
      setCurrentStep(newStep);
      
      if (isLoaded) {
        saveProgress(newStep, completedSteps);
      }
    }
  };

  // Aller à une étape spécifique
  const goTo = (step) => {
    if (step >= 0 && step < totalSteps) {
      setCurrentStep(step);
      
      if (isLoaded) {
        saveProgress(step, completedSteps);
      }
    }
  };

  // Passer tout le tutoriel (ferme + marque complet)
  const skip = () => {
    if (isLoaded) {
      markAsComplete();
    }
    setIsCompleted(true);
    setIsOpen(false);
  };

  return {
    isOpen,
    currentStep,
    completedSteps,
    isCompleted,
    totalSteps,
    open,
    close,
    next,
    prev,
    goTo,
    skip,
    isLoaded
  };
};
