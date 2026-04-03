import React from 'react';
import { GraduationCap } from 'lucide-react';

/**
 * Bouton pour lancer le tutoriel
 * - Badge orange pulsant si onboarding non complété
 * - Indicateur X/Y si en cours
 * - Libellé "Revoir le guide" si complété
 */
export default function TutorialButton({ onClick, isCompleted = false, currentStep = 0, totalSteps }) {
  const inProgress = !isCompleted && currentStep > 0;

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
      title="Tuto"
    >
      <div className="relative">
        <GraduationCap className="w-5 h-5" />
        {!isCompleted && (
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-orange-400 rounded-full animate-pulse" />
        )}
      </div>
      <span className="hidden md:inline">Tuto</span>
      {inProgress && totalSteps && (
        <span className="text-xs font-medium text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded">
          {currentStep}/{totalSteps}
        </span>
      )}
    </button>
  );
}
