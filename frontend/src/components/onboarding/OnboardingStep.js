import React from 'react';

/**
 * Composant pour afficher le contenu d'une étape d'onboarding
 */
export default function OnboardingStep({ step }) {
  if (!step) return null;

  return (
    <div className="py-1">
      {/* Icon */}
      {step.icon && (
        <div className="text-2xl mb-2 text-center">
          {step.icon}
        </div>
      )}

      {/* Title */}
      <h2 className="text-lg font-bold text-gray-900 mb-2 text-center">
        {step.title}
      </h2>

      {/* Description */}
      <div className="text-xs text-gray-600 text-center space-y-1.5 mb-3">
        {step.description}
      </div>

      {/* Screenshot or illustration (optional) */}
      {step.image && (
        <div className="bg-gray-100 rounded p-2 mb-2">
          <img 
            src={step.image} 
            alt={step.title}
            className="w-full rounded"
          />
        </div>
      )}

      {/* Tips (optional) */}
      {step.tips && (
        <div className="bg-blue-50 border border-blue-200 rounded p-2 mt-2">
          <p className="text-xs text-blue-800">
            💡 {step.tips}
          </p>
        </div>
      )}

      {/* Action button (optional) */}
      {step.actionLabel && step.onAction && (
        <div className="mt-3">
          <button
            type="button"
            onClick={step.onAction}
            className="w-full px-3 py-2 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            {step.actionLabel} →
          </button>
        </div>
      )}
    </div>
  );
}
