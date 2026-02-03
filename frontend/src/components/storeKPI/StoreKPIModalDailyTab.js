import React from 'react';
import KPICalendar from '../KPICalendar';

export default function StoreKPIModalDailyTab({
  overviewData,
  overviewDate,
  onOverviewDateChange,
  datesWithData,
  lockedDates,
  onShowAIModal,
  storeId
}) {
  const managerData = overviewData?.manager_data || overviewData?.managers_data || {};
  const hasManagerData = managerData && Object.keys(managerData).length > 0;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <KPICalendar
            selectedDate={overviewDate}
            onDateChange={onOverviewDateChange}
            datesWithData={datesWithData}
            lockedDates={lockedDates}
          />
        </div>
        <button
          onClick={() => onShowAIModal(true)}
          disabled={!overviewData || (overviewData.totals?.ca === 0 && overviewData.totals?.ventes === 0)}
          className="px-4 py-1.5 text-sm bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          title={!overviewData ? 'Sélectionnez une date' : (overviewData.totals?.ca === 0 && overviewData.totals?.ventes === 0) ? 'Aucune donnée disponible pour cette date' : ''}
        >
          <span>🤖</span> Lancer l'Analyse IA
        </button>
      </div>

      {overviewData ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-3 border border-purple-200">
              <div className="text-xs text-purple-700 font-semibold mb-0.5">💰 CA Réalisé</div>
              <div className="text-2xl font-bold text-purple-900">
                {overviewData.totals?.ca != null ? `${overviewData.totals.ca.toFixed(2)} €` : '0 €'}
              </div>
              <div className="text-xs text-purple-600 mt-0.5">
                {overviewData.sellers_reported} / {overviewData.total_sellers} vendeurs
              </div>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-3 border border-green-200">
              <div className="text-xs text-green-700 font-semibold mb-0.5">🛍️ Nombre de Ventes</div>
              <div className="text-2xl font-bold text-green-900">
                {overviewData.totals?.ventes != null ? overviewData.totals.ventes : '0'}
              </div>
              <div className="text-xs text-[#10B981] mt-0.5">
                {overviewData.calculated_kpis?.panier_moyen != null ? `PM: ${overviewData.calculated_kpis.panier_moyen} €` : 'Panier Moyen: N/A'}
              </div>
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-3 border border-blue-200">
              <div className="text-xs text-blue-700 font-semibold mb-0.5">📈 Taux de Transformation</div>
              <div className="text-2xl font-bold text-blue-900">
                {overviewData.calculated_kpis?.taux_transformation != null ? `${overviewData.calculated_kpis.taux_transformation} %` : 'N/A'}
              </div>
              <div className="text-xs text-blue-600 mt-0.5">
                {overviewData.calculated_kpis?.taux_transformation != null ? 'Ventes / Prospects' : 'Données manquantes'}
              </div>
            </div>
            <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-3 border border-orange-200">
              <div className="text-xs text-orange-700 font-semibold mb-0.5">📦 Indice de Vente (UPT)</div>
              <div className="text-2xl font-bold text-orange-900">
                {overviewData.calculated_kpis?.indice_vente != null ? overviewData.calculated_kpis.indice_vente : 'N/A'}
              </div>
              <div className="text-xs text-orange-600 mt-0.5">
                {overviewData.calculated_kpis?.indice_vente != null ? 'Articles / Ventes' : 'Données manquantes'}
              </div>
            </div>
          </div>

          {!storeId && (
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-1.5">
                <span>✅</span> Données Validées
              </h3>
              {(hasManagerData || overviewData.sellers_reported > 0) ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="flex flex-col items-center p-3 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg border border-purple-200">
                    <span className="text-xs text-purple-700 font-semibold mb-1">💰 CA</span>
                    <span className="text-lg font-bold text-purple-900">
                      {((hasManagerData ? (managerData.ca_journalier || 0) : 0) + (overviewData.sellers_data?.ca_journalier || 0)).toFixed(2)} €
                    </span>
                  </div>
                  <div className="flex flex-col items-center p-3 bg-gradient-to-br from-green-50 to-green-100 rounded-lg border border-green-200">
                    <span className="text-xs text-green-700 font-semibold mb-1">🛍️ Ventes</span>
                    <span className="text-lg font-bold text-green-900">
                      {((hasManagerData ? (managerData.nb_ventes || 0) : 0) + (overviewData.sellers_data?.nb_ventes || 0))}
                    </span>
                  </div>
                  <div className="flex flex-col items-center p-3 bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg border border-orange-200">
                    <span className="text-xs text-orange-700 font-semibold mb-1">📦 Articles</span>
                    <span className="text-lg font-bold text-orange-900">
                      {((hasManagerData ? (managerData.nb_articles || 0) : 0) + (overviewData.sellers_data?.nb_articles || 0))}
                    </span>
                  </div>
                  {(hasManagerData && managerData.nb_prospects > 0) && (
                    <div className="flex flex-col items-center p-3 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200">
                      <span className="text-xs text-blue-700 font-semibold mb-1">🚶 Prospects</span>
                      <span className="text-lg font-bold text-blue-900">{managerData.nb_prospects || 0}</span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-gray-500 text-xs italic">Aucune donnée validée pour cette date</p>
              )}
            </div>
          )}

          {overviewData.seller_entries && overviewData.seller_entries.length > 0 && (
            <div className="bg-white rounded-lg p-3 border border-gray-200">
              <h3 className="text-sm font-bold text-gray-800 mb-2">📋 Détails par vendeur</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-1 py-1.5 text-left font-semibold text-gray-700">Vendeur</th>
                      <th className="px-4 py-1.5 text-center font-semibold text-gray-700">💰 CA</th>
                      <th className="px-3 py-1.5 text-center font-semibold text-gray-700">🛍️ Ventes</th>
                      <th className="px-3 py-1.5 text-center font-semibold text-gray-700">📦 Articles</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overviewData.seller_entries.map((entry, idx) => (
                      <tr key={`store-kpi-seller-${entry.seller_id || entry.seller_name}-${idx}`} className="border-t border-gray-100">
                        <td className="px-1 py-1.5 text-gray-800 font-medium">{entry.seller_name || `Vendeur ${idx + 1}`}</td>
                        <td className="px-4 py-1.5 text-center text-gray-700 whitespace-nowrap">
                          {(entry.seller_ca || entry.ca_journalier || 0).toFixed(2)} €
                        </td>
                        <td className="px-3 py-1.5 text-center text-gray-700 whitespace-nowrap">{entry.nb_ventes || 0}</td>
                        <td className="px-3 py-1.5 text-center text-gray-700 whitespace-nowrap">{entry.nb_articles || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mb-4" />
          <p className="text-gray-600">Chargement des données...</p>
        </div>
      )}
    </div>
  );
}
