import React from 'react';

export default function LoadingOverlay() {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
        <div className="text-center mb-6">
          <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center animate-pulse">
            <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h3 className="text-2xl font-bold text-gray-800 mb-2">
            Analyse en cours...
          </h3>
          <p className="text-gray-600">
            L'IA analyse les performances de votre équipe
          </p>
        </div>

        {/* Progress Bar */}
        <div className="relative w-full h-3 bg-gray-200 rounded-full overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500 via-indigo-500 to-purple-500 animate-progress-slide"></div>
        </div>

        <div className="mt-4 text-center text-sm text-gray-500">
          <p>⏱️ Temps estimé : 30-60 secondes</p>
        </div>
      </div>
    </div>
  );
}
