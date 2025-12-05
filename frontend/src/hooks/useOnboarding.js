import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL || '';

/**
 * Hook pour gérer l'état et la navigation de l'onboarding avec persistance
 * 
 * @param {number} totalSteps - Nombre total d'étapes
 * @returns {Object} État et fonctions de navigation
 */
export const useOnboarding = (totalSteps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Charger la progression depuis le backend
  useEffect(() => {
    const loadProgress = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;

        const response = await axios.get(`${API}/api/onboarding/progress`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (response.data && !response.data.is_completed) {
          setCurrentStep(response.data.current_step || 0);
          setCompletedSteps(response.data.completed_steps || []);
        }
        setIsLoaded(true);
      } catch (error) {
        console.error('Error loading onboarding progress:', error);
        setIsLoaded(true);
      }
    };

    loadProgress();
  }, []);

  // Sauvegarder la progression dans le backend
  const saveProgress = useCallback(async (step, completed) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      await axios.post(`${API}/api/onboarding/progress`, {
        current_step: step,
        completed_steps: completed,
        is_completed: false
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (error) {
      console.error('Error saving onboarding progress:', error);
    }
  }, []);

  // Marquer l'onboarding comme terminé
  const markAsComplete = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      await axios.post(`${API}/api/onboarding/complete`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (error) {
      console.error('Error marking onboarding complete:', error);
    }
  }, []);

  // Ouvrir le modal
  const open = () => {
    setIsOpen(true);
  };

  // Fermer le modal et sauvegarder
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
      // Dernière étape, marquer comme complété et fermer
      const newCompleted = !completedSteps.includes(currentStep) 
        ? [...completedSteps, currentStep] 
        : completedSteps;
      
      setCompletedSteps(newCompleted);
      
      if (isLoaded) {
        markAsComplete();
      }
      
      close();
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

  // Passer l'étape courante (même comportement que next)
  const skip = () => {
    next();
  };

  return {
    isOpen,
    currentStep,
    completedSteps,
    open,
    close,
    next,
    prev,
    goTo,
    skip,
    isLoaded
  };
};
