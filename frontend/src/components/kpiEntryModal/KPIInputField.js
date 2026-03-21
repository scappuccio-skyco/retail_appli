import React from 'react';
import { Lock } from 'lucide-react';

export default function KPIInputField({ emoji, label, value, onChange, unit, step = '1', isReadOnly, isEntryLocked }) {
  const disabled = isReadOnly || isEntryLocked;
  return (
    <div className="bg-gray-50 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">{emoji}</span>
        <label className="font-medium text-gray-800">{label}</label>
        {isReadOnly && <Lock className="w-4 h-4 text-gray-500" />}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={step === '0.01' ? '0.00' : '0'}
          step={step}
          min="0"
          disabled={disabled}
          className={`flex-1 px-4 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-[#ffd871] focus:border-transparent ${disabled ? 'bg-gray-100 cursor-not-allowed text-gray-600' : ''}`}
        />
        <span className="text-gray-600 font-medium min-w-[40px]">{unit}</span>
      </div>
    </div>
  );
}
