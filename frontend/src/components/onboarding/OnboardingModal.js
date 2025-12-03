import React from 'react';
import { X } from 'lucide-react';
import ProgressBar from './ProgressBar';
import OnboardingStep from './OnboardingStep';

/**
 * Modal principal d'onboarding
 */
export default function OnboardingModal({
  isOpen,
  onClose,
  currentStep,
  totalSteps,
  steps,
  onNext,
  onPrev,
  onGoTo,
  onSkip,
  completedSteps = []
}) {
  if (!isOpen) return null;

  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === totalSteps - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl max-w-xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 hover:bg-gray-100 rounded-full transition-colors z-10"
          title="Fermer"
        >
          <X className="w-4 h-4 text-gray-500" />
        </button>

        {/* Content */}
        <div className="p-6">
          {/* Progress bar */}
          <ProgressBar
            current={currentStep}
            total={totalSteps}
            onGoTo={onGoTo}
            completedSteps={completedSteps}
          />

          {/* Step content */}
          <OnboardingStep step={steps[currentStep]} />

          {/* Navigation */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t">
            <button
              onClick={onPrev}
              disabled={isFirstStep}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                isFirstStep
                  ? 'opacity-0 cursor-default'
                  : 'border-2 border-gray-300 hover:border-blue-500 hover:text-blue-600'
              }`}
            >
              ← Précédent
            </button>

            <button
              onClick={onSkip}
              className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              Passer
            </button>

            <button
              onClick={isLastStep ? onClose : onNext}
              className="px-5 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {isLastStep ? 'Terminer' : 'Suivant →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
