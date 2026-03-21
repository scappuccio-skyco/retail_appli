import React from 'react';

/**
 * Toggle to select who enters the progress data: seller or manager.
 * Used in both CreateChallengeTab and CreateObjectiveTab.
 *
 * Props:
 *   value: 'seller' | 'manager'
 *   onChange(newValue): called with 'seller' or 'manager'
 */
export default function DataEntryResponsibleToggle({ value, onChange }) {
  return (
    <div className="bg-gradient-to-r from-orange-50 to-orange-100 rounded-lg p-4 border-2 border-orange-200">
      <label className="block text-sm font-semibold text-gray-800 mb-3">
        📝 Qui saisit la progression ? *
      </label>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange('seller')}
          className={`w-12 h-8 rounded font-bold text-xs transition-all ${
            value === 'seller' ? 'bg-cyan-500 text-white shadow-lg' : 'bg-gray-200 text-gray-500'
          }`}
          title="Vendeur"
        >
          🧑‍💼
        </button>
        <span className={`text-sm font-medium ${value === 'seller' ? 'text-cyan-700' : 'text-gray-500'}`}>
          Vendeur
        </span>

        <div className="mx-4 h-8 w-px bg-gray-300" />

        <button
          type="button"
          onClick={() => onChange('manager')}
          className={`w-12 h-8 rounded font-bold text-xs transition-all ${
            value === 'manager' ? 'bg-orange-500 text-white shadow-lg' : 'bg-gray-200 text-gray-500'
          }`}
          title="Manager"
        >
          👨‍💼
        </button>
        <span className={`text-sm font-medium ${value === 'manager' ? 'text-orange-700' : 'text-gray-500'}`}>
          Manager
        </span>
      </div>
      <p className="text-xs text-gray-600 mt-3">
        {value === 'seller'
          ? '🧑‍💼 Le vendeur pourra saisir la progression'
          : '👨‍💼 Vous (manager) saisirez la progression'}
      </p>
    </div>
  );
}
