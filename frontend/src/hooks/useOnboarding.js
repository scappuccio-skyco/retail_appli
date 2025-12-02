import { useState } from 'react';

/**
 * Hook pour gérer l'état et la navigation de l'onboarding
 * 
 * @param {number} totalSteps - Nombre total d'étapes
 * @returns {Object} État et fonctions de navigation
 */
export const useOnboarding = (totalSteps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState([]);

  // Ouvrir le modal
  const open = () => {
    setIsOpen(true);
    setCurrentStep(0);
  };

  // Fermer le modal
  const close = () => {
    setIsOpen(false);
  };

  // Étape suivante
  const next = () => {
    if (currentStep < totalSteps - 1) {
      markCompleted(currentStep);
      setCurrentStep(currentStep + 1);
    } else {
      // Dernière étape, fermer
      markCompleted(currentStep);
      close();
    }
  };

  // Étape précédente
  const prev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Aller à une étape spécifique
  const goTo = (step) => {
    if (step >= 0 && step < totalSteps) {
      setCurrentStep(step);
    }
  };

  // Passer l'étape courante (même comportement que next)
  const skip = () => {
    next();
  };

  // Marquer une étape comme complétée
  const markCompleted = (step) => {
    if (!completedSteps.includes(step)) {
      setCompletedSteps([...completedSteps, step]);
    }
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
    skip
  };
};
