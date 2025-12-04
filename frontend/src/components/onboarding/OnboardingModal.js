import React from 'react';
import { X } from 'lucide-react';
import ProgressBar from './ProgressBar';
import OnboardingStep from './OnboardingStep';

/**
 * Modal principal d'onboarding
 */
const OnboardingModal = React.memo(function OnboardingModal({
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
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      data-emergent-ignore="true"
      style={{ pointerEvents: 'auto' }}
    >
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        data-emergent-ignore="true"
      />
      
      {/* Modal */}
      <div 
        className="relative bg-white rounded-lg shadow-2xl max-w-md w-full mx-4 max-h-[75vh] overflow-y-auto"
        data-emergent-ignore="true"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onClose();
          }}
          className="absolute top-2 right-2 p-1 hover:bg-gray-100 rounded-full transition-colors z-10"
          title="Fermer"
        >
          <X className="w-3.5 h-3.5 text-gray-400" />
        </button>

        {/* Content */}
        <div className="p-4">
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
          <div className="flex items-center justify-between mt-4 pt-3 border-t">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onPrev();
              }}
              disabled={isFirstStep}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                isFirstStep
                  ? 'opacity-0 cursor-default'
                  : 'border border-gray-300 hover:border-blue-500 hover:text-blue-600'
              }`}
            >
              ← Précédent
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onSkip();
              }}
              className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
            >
              Passer
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (isLastStep) {
                  onClose();
                } else {
                  onNext();
                }
              }}
              className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              {isLastStep ? 'Terminer' : 'Suivant →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

export default OnboardingModal;
