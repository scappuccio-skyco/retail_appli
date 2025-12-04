import React from 'react';

/**
 * Barre de progression cliquable pour l'onboarding
 */
export default function ProgressBar({ current, total, onGoTo, completedSteps = [] }) {
  return (
    <div className="mb-3">
      <div className="flex items-center justify-center gap-1 mb-1">
        {Array.from({ length: total }, (_, i) => {
          const isCompleted = completedSteps.includes(i);
          const isCurrent = i === current;
          const isPast = i < current;

          return (
            <button
              type="button"
              key={i}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onGoTo(i);
              }}
              className={`transition-all rounded-full ${
                isCurrent
                  ? 'w-2 h-2 bg-blue-600'
                  : isCompleted || isPast
                  ? 'w-1.5 h-1.5 bg-blue-400 hover:scale-125'
                  : 'w-1.5 h-1.5 bg-gray-300 hover:scale-125'
              }`}
              title={`Étape ${i + 1}`}
            />
          );
        })}
      </div>
      <p className="text-center text-xs text-gray-400">
        Étape {current + 1}/{total}
      </p>
    </div>
  );
}
