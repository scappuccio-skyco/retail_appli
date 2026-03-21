import React from 'react';
import { Target, History, Filter } from 'lucide-react';

export default function HistoriqueTab({
  historyObjectives,
  historyStatusFilter,
  setHistoryStatusFilter,
}) {
  const items = historyObjectives
    .filter((obj) => {
      if (historyStatusFilter === 'all') return true;
      if (historyStatusFilter === 'achieved') return obj.achieved;
      if (historyStatusFilter === 'not_achieved') return !obj.achieved;
      return true;
    })
    .sort(
      (a, b) =>
        new Date(b.period_end || b.end_date) - new Date(a.period_end || a.end_date)
    );

  return (
    <div>
      {/* Bandeau fin "Historique" */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-8 py-3">
        <p className="text-sm">Consultez l'historique de vos objectifs terminés</p>
      </div>

      {/* Filtres */}
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-600" />
            <span className="text-sm font-semibold text-gray-700">Filtres :</span>
          </div>

          {/* Status filter */}
          <div className="flex gap-2">
            <button
              onClick={() => setHistoryStatusFilter('all')}
              className={`px-3 py-1.5 text-sm rounded-lg transition-all ${
                historyStatusFilter === 'all'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
              }`}
            >
              Tous les statuts
            </button>
            <button
              onClick={() => setHistoryStatusFilter('achieved')}
              className={`px-3 py-1.5 text-sm rounded-lg transition-all ${
                historyStatusFilter === 'achieved'
                  ? 'bg-green-600 text-white shadow-md'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
              }`}
            >
              ✅ Atteints
            </button>
            <button
              onClick={() => setHistoryStatusFilter('not_achieved')}
              className={`px-3 py-1.5 text-sm rounded-lg transition-all ${
                historyStatusFilter === 'not_achieved'
                  ? 'bg-red-600 text-white shadow-md'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
              }`}
            >
              ❌ Non atteints
            </button>
          </div>
        </div>
      </div>

      {/* Contenu historique */}
      <div className="px-6 py-6 overflow-y-auto max-h-[60vh]">
        {items.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <History className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-semibold mb-2">Aucun élément dans l'historique</p>
            <p className="text-sm">Les objectifs terminés apparaîtront ici</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item, index) => (
              <div
                key={`${item.id}-${index}`}
                className={`rounded-xl p-4 border-2 transition-all ${
                  item.achieved
                    ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200'
                    : 'bg-gradient-to-r from-red-50 to-orange-50 border-red-200'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Target className="w-4 h-4 text-blue-600" />
                      <h4 className="font-bold text-gray-800">{item.title || item.name}</h4>
                    </div>
                    <p className="text-sm text-gray-600">{item.description}</p>
                  </div>
                  <div className="ml-4 flex flex-col items-end gap-2">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        item.achieved ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
                      }`}
                    >
                      {item.achieved ? '✅ Atteint' : '❌ Non atteint'}
                    </span>
                    <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                      {item.type || 'Standard'}
                    </span>
                  </div>
                </div>

                {/* Progress info */}
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-600">Période :</span>
                      <p className="font-semibold text-gray-800">
                        {new Date(item.period_start || item.start_date).toLocaleDateString('fr-FR')}
                        {' - '}
                        {new Date(item.period_end || item.end_date).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-600">Progression :</span>
                      <p className="font-semibold text-gray-800">
                        {item.current_value || 0} / {item.target_value || 0} {item.unit || ''}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
