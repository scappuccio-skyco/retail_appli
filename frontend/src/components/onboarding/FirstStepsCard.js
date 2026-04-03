import React from 'react';
import { BookOpen, ChevronRight, X } from 'lucide-react';

/**
 * Carte "Premiers pas" affichée dans le dashboard tant que l'onboarding n'est pas terminé.
 * Props:
 *   onboarding : résultat de useOnboarding()
 *   steps      : tableau des étapes (avec .icon et .title)
 */
export default function FirstStepsCard({ onboarding, steps }) {
  if (!onboarding.isLoaded || onboarding.isCompleted) return null;

  const { currentStep, completedSteps, totalSteps, open, skip } = onboarding;
  const progressPct = Math.round((completedSteps.length / totalSteps) * 100);
  const step = steps[currentStep] || steps[0];

  return (
    <div className="glass-morphism rounded-2xl p-5 mb-6 border border-blue-200 bg-gradient-to-br from-blue-50/80 to-indigo-50/80">
      <div className="flex items-start justify-between gap-4">
        {/* Icône + contenu */}
        <div className="flex items-start gap-4 flex-1 min-w-0">
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md">
            <BookOpen className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-base font-bold text-gray-800">Guide de démarrage</h3>
              <span className="text-xs font-medium text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                Étape {currentStep + 1}/{totalSteps}
              </span>
            </div>

            {/* Étape en cours */}
            <p className="text-sm text-gray-600 mb-3 truncate">
              {step?.icon && <span className="mr-1">{step.icon}</span>}
              {step?.title || 'Continuer le guide'}
            </p>

            {/* Barre de progression */}
            <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={open}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
              >
                Continuer
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={skip}
                className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
              >
                Passer
              </button>
            </div>
          </div>
        </div>

        {/* Bouton fermer (skip) */}
        <button
          onClick={skip}
          className="text-gray-300 hover:text-gray-500 transition-colors flex-shrink-0 mt-0.5"
          title="Fermer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
