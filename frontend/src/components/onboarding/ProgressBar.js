import React from 'react';

/**
 * Barre de progression cliquable pour l'onboarding
 */
export default function ProgressBar({ current, total, onGoTo, completedSteps = [] }) {
  return (
    <div className="mb-4">
      <div className="flex items-center justify-center gap-1.5 mb-1.5">
        {Array.from({ length: total }, (_, i) => {
          const isCompleted = completedSteps.includes(i);
          const isCurrent = i === current;
          const isPast = i < current;

          return (
            <button
              type="button"
              key={i}
              onClick={() => onGoTo(i)}
              className={`transition-all rounded-full ${
                isCurrent
                  ? 'w-3 h-3 bg-blue-600 scale-110'
                  : isCompleted || isPast
                  ? 'w-2.5 h-2.5 bg-blue-400 hover:scale-125'
                  : 'w-2.5 h-2.5 bg-gray-300 hover:scale-125'
              }`}
              title={`Étape ${i + 1}`}
            />
          );
        })}
      </div>
      <p className="text-center text-xs text-gray-500">
        Étape {current + 1} sur {total}
      </p>
    </div>
  );
}
