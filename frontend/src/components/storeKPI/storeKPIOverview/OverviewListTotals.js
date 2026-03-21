import React from 'react';
import PropTypes from 'prop-types';

export default function OverviewListTotals({ historicalData, computePeriodTotals }) {
  const { total_ca, total_ventes, total_articles, total_prospects, total_clients, panierMoyen, tauxTransfo, indiceVente } = computePeriodTotals(historicalData);
  const dayLabel = historicalData.length === 1 ? 'jour' : 'jours';
  const clientsDisplay = total_clients > 0 ? total_clients : 'N/A';

  return (
    <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl border-2 border-orange-300 shadow-lg overflow-hidden">
      <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-4 py-3">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          📊 TOTAL PÉRIODE <span className="text-sm font-normal opacity-90">({historicalData.length} {dayLabel})</span>
        </h3>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-3 border-2 border-green-300 flex flex-col items-center justify-center text-center">
            <div className="text-xs text-green-700 font-semibold mb-1">💰 CA Total</div>
            <div className="text-sm font-bold text-green-900 break-words">{total_ca.toFixed(2)} €</div>
          </div>
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-3 border-2 border-blue-300 flex flex-col items-center justify-center text-center">
            <div className="text-xs text-blue-700 font-semibold mb-1">🛍️ Ventes Total</div>
            <div className="text-sm font-bold text-blue-900 break-words">{total_ventes}</div>
          </div>
          <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-lg p-3 border-2 border-indigo-300 flex flex-col items-center justify-center text-center">
            <div className="text-xs text-indigo-700 font-semibold mb-1">📦 Articles Total</div>
            <div className="text-sm font-bold text-indigo-900 break-words">{total_articles}</div>
          </div>
          <div className="bg-gradient-to-br from-pink-50 to-pink-100 rounded-lg p-3 border-2 border-pink-300 flex flex-col items-center justify-center text-center">
            <div className="text-xs text-pink-700 font-semibold mb-1">👤 Prospects Total</div>
            <div className="text-sm font-bold text-pink-900 break-words">{total_prospects}</div>
          </div>
          <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg p-3 border-2 border-yellow-300 flex flex-col items-center justify-center text-center">
            <div className="text-xs text-yellow-700 font-semibold mb-1">👥 Clients Total</div>
            <div className="text-sm font-bold text-yellow-900 break-words">{clientsDisplay}</div>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-3 border-2 border-purple-300 flex flex-col items-center justify-center text-center">
            <div className="text-xs text-purple-700 font-semibold mb-1">🛒 Panier Moyen</div>
            <div className="text-sm font-bold text-purple-900 break-words">{panierMoyen} €</div>
          </div>
          <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-3 border-2 border-orange-300 flex flex-col items-center justify-center text-center">
            <div className="text-xs text-orange-700 font-semibold mb-1">📈 Taux Transfo</div>
            <div className="text-sm font-bold text-orange-900 break-words">{tauxTransfo}%</div>
          </div>
          <div className="bg-gradient-to-br from-cyan-50 to-cyan-100 rounded-lg p-3 border-2 border-cyan-300 flex flex-col items-center justify-center text-center">
            <div className="text-xs text-cyan-700 font-semibold mb-1">📊 Indice Vente</div>
            <div className="text-sm font-bold text-cyan-900 break-words">{indiceVente}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

OverviewListTotals.propTypes = {
  historicalData: PropTypes.array.isRequired,
  computePeriodTotals: PropTypes.func.isRequired,
};
