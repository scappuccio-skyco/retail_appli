import React from 'react';
import PropTypes from 'prop-types';

const CHART_ITEMS = [
  { key: 'ca', label: '💰 CA' },
  { key: 'ventes', label: '🛒 Ventes' },
  { key: 'panierMoyen', label: '🛍️ Panier Moyen' },
  { key: 'tauxTransformation', label: '📈 Taux Transfo' },
  { key: 'indiceVente', label: '📊 Indice Vente' },
  { key: 'articles', label: '📦 Articles' },
];

export default function ChartFilters({ visibleCharts, onToggleChart, onShowAll }) {
  return (
    <div className="bg-white rounded-xl p-4 border-2 border-gray-200 shadow-sm">
      <h3 className="text-md font-bold text-gray-800 mb-3 flex items-center gap-2">🔍 Filtrer les graphiques</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {CHART_ITEMS.map(({ key, label }) => (
          <label key={key} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors">
            <input
              type="checkbox"
              checked={visibleCharts[key]}
              onChange={() => onToggleChart(key)}
              className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
            />
            <span className="text-sm font-medium text-gray-700">{label}</span>
          </label>
        ))}
        <button
          type="button"
          onClick={onShowAll}
          className="col-span-2 md:col-span-1 px-3 py-2 bg-orange-100 text-orange-700 text-sm font-medium rounded-lg hover:bg-orange-200 transition-colors"
        >
          ✓ Tout afficher
        </button>
      </div>
    </div>
  );
}

ChartFilters.propTypes = {
  visibleCharts: PropTypes.object.isRequired,
  onToggleChart: PropTypes.func.isRequired,
  onShowAll: PropTypes.func.isRequired,
};
