import React from 'react';

export default function ChallengeStatsBar({ stats }) {
  if (!stats) return null;
  const items = [
    { emoji: '🏆', value: stats.completed_count, label: 'Relevé' },
    { emoji: '✅', value: stats.success_count,   label: 'Réussi',    color: 'text-[#10B981]' },
    { emoji: '💪', value: stats.partial_count,   label: 'Difficile', color: 'text-[#F97316]' },
    { emoji: '❌', value: stats.failed_count,    label: 'Échoué',    color: 'text-red-600' },
  ];
  return (
    <div className="bg-gradient-to-r from-purple-50 to-indigo-50 p-4 border-b-2 border-purple-100">
      <p className="text-xs text-gray-600 font-semibold mb-3">📊 Tes Statistiques</p>
      <div className="grid grid-cols-4 gap-2">
        {items.map(({ emoji, value, label, color }) => (
          <div key={label} className="bg-white rounded-xl p-2 text-center shadow-sm">
            <div className="text-2xl mb-1">{emoji}</div>
            <p className={`text-lg font-bold text-gray-800 ${color || ''}`}>{value}</p>
            <p className="text-xs text-gray-600">{label}{value > 1 ? 's' : ''}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
