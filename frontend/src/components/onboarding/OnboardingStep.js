import React from 'react';

/**
 * Composant pour afficher le contenu d'une étape d'onboarding
 */
export default function OnboardingStep({ step }) {
  if (!step) return null;

  return (
    <div className="py-2">
      {/* Icon */}
      {step.icon && (
        <div className="text-3xl mb-3 text-center">
          {step.icon}
        </div>
      )}

      {/* Title */}
      <h2 className="text-xl font-bold text-gray-900 mb-3 text-center">
        {step.title}
      </h2>

      {/* Description */}
      <div className="text-sm text-gray-600 text-center space-y-2 mb-4">
        {step.description}
      </div>

      {/* Screenshot or illustration (optional) */}
      {step.image && (
        <div className="bg-gray-100 rounded-lg p-3 mb-3">
          <img 
            src={step.image} 
            alt={step.title}
            className="w-full rounded"
          />
        </div>
      )}

      {/* Tips (optional) */}
      {step.tips && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-3">
          <p className="text-xs text-blue-800">
            💡 <strong>Conseil :</strong> {step.tips}
          </p>
        </div>
      )}
    </div>
  );
}
