import React from 'react';
import PropTypes from 'prop-types';

export default function OverviewListEntries({ historicalData, displayedListItems, setDisplayedListItems, formatListDateLabel }) {
  const slice = historicalData.slice(0, displayedListItems);

  return (
    <div className="bg-white rounded-xl border-2 border-gray-200 shadow-sm overflow-hidden">
      <div className="bg-gradient-to-r from-purple-500 to-purple-600 px-4 py-3">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          📋 Données Quotidiennes <span className="text-sm font-normal opacity-90">({historicalData.length} entrées)</span>
        </h3>
      </div>
      <div className="divide-y divide-gray-200">
        {slice.map((entry, index) => {
          const panierMoyen = entry.total_ventes > 0 ? (entry.total_ca / entry.total_ventes).toFixed(2) : 0;
          const tauxTransfo = entry.total_prospects > 0 ? ((entry.total_ventes / entry.total_prospects) * 100).toFixed(1) : 0;
          const indiceVente = entry.total_ventes > 0 ? (entry.total_articles / entry.total_ventes).toFixed(2) : 0;
          const entryKey = entry.sortKey || entry.date || `overview-list-${index}`;
          return (
            <div key={entryKey} className="p-5 hover:bg-purple-50 transition-colors border-b border-gray-100 last:border-b-0">
              <div className="flex items-center justify-between mb-3">
                <span className="text-lg font-bold text-purple-600">📅 {formatListDateLabel(entry.date)}</span>
                <span className="text-xs text-gray-500 font-medium">Entrée #{historicalData.length - index}</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-3 border border-green-200">
                  <div className="text-xs text-green-700 font-semibold mb-1">💰 CA</div>
                  <div className="text-lg font-bold text-green-900">{entry.total_ca?.toFixed(2) || '0.00'} €</div>
                </div>
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-3 border border-blue-200">
                  <div className="text-xs text-blue-700 font-semibold mb-1">🛍️ Ventes</div>
                  <div className="text-lg font-bold text-blue-900">{entry.total_ventes || 0}</div>
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-3 border border-purple-200">
                  <div className="text-xs text-purple-700 font-semibold mb-1">🛒 Panier Moy.</div>
                  <div className="text-lg font-bold text-purple-900">{panierMoyen} €</div>
                </div>
                <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg p-3 border border-yellow-200">
                  <div className="text-xs text-yellow-700 font-semibold mb-1">👥 Clients</div>
                  <div className="text-lg font-bold text-yellow-900">{entry.total_clients || 0}</div>
                </div>
                <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-3 border border-orange-200">
                  <div className="text-xs text-orange-700 font-semibold mb-1">📈 Taux Transfo</div>
                  <div className="text-lg font-bold text-orange-900">{tauxTransfo}%</div>
                </div>
                <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-lg p-3 border border-indigo-200">
                  <div className="text-xs text-indigo-700 font-semibold mb-1">📦 Articles</div>
                  <div className="text-lg font-bold text-indigo-900">{entry.total_articles || 0}</div>
                </div>
              </div>
              <div className="mt-3 flex gap-4 text-sm text-gray-600">
                <div><span className="font-semibold">Prospects:</span> {entry.total_prospects || 0}</div>
                <div><span className="font-semibold">Indice Vente:</span> {indiceVente}</div>
              </div>
            </div>
          );
        })}
      </div>
      {displayedListItems < historicalData.length && (
        <div className="p-4 bg-gray-50 border-t border-gray-200">
          <button
            type="button"
            onClick={() => setDisplayedListItems(prev => Math.min(prev + 10, historicalData.length))}
            className="w-full px-4 py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white font-semibold rounded-lg hover:from-purple-600 hover:to-purple-700 transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
          >
            <span>📄 Charger plus</span>
            <span className="text-sm opacity-90">({displayedListItems} / {historicalData.length})</span>
          </button>
        </div>
      )}
      {displayedListItems >= historicalData.length && historicalData.length > 10 && (
        <div className="p-3 bg-purple-50 border-t border-purple-200 text-center">
          <p className="text-sm text-purple-700 font-medium">✅ Toutes les données sont affichées ({historicalData.length} entrées)</p>
        </div>
      )}
    </div>
  );
}

OverviewListEntries.propTypes = {
  historicalData: PropTypes.array.isRequired,
  displayedListItems: PropTypes.number.isRequired,
  setDisplayedListItems: PropTypes.func.isRequired,
  formatListDateLabel: PropTypes.func.isRequired,
};
