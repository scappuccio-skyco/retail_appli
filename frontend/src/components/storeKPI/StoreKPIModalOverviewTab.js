import React from 'react';
import PropTypes from 'prop-types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatChartDate, computePeriodTotals, formatListDateLabel } from './storeKPIUtils';
import ChartFilters from './storeKPIOverview/ChartFilters';
import OverviewListTotals from './storeKPIOverview/OverviewListTotals';
import OverviewListEntries from './storeKPIOverview/OverviewListEntries';

export { WeekPicker } from './WeekPicker';

const DEFAULT_VISIBLE_CHARTS = { ca: true, ventes: true, panierMoyen: true, tauxTransformation: true, indiceVente: true, articles: true };

function getChartInterval(viewMode) {
  if (viewMode === 'week') return 0;
  if (viewMode === 'month') return 2;
  return 0;
}

function SingleLineChart({ data, dataKey, name, viewMode }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={getChartInterval(viewMode)} angle={-45} textAnchor="end" height={70} tickFormatter={formatChartDate} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip formatter={(value) => [value, name]} labelFormatter={formatChartDate} />
        <Line type="monotone" dataKey={dataKey} name={name} stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export default function StoreKPIModalOverviewTab({
  viewMode, displayMode, setDisplayMode,
  displayedListItems, setDisplayedListItems,
  visibleCharts, toggleChart, setVisibleCharts,
  historicalData, loadingHistorical,
}) {
  const hasData = historicalData.length > 0;
  const hasProspectsData = historicalData.some(d => d.total_prospects > 0);
  const emptyMessage = loadingHistorical ? '⏳ Chargement des données...' : '📭 Aucune donnée disponible pour cette période';

  return (
    <div className="space-y-6">
      {/* View mode toggle */}
      <div className="flex gap-2 mb-4">
        {[
          { id: 'list', label: '📊 Vue Chiffrée' },
          { id: 'chart', label: '📈 Vue Graphique' },
        ].map(({ id, label }) => (
          <button
            key={id}
            onClick={() => { setDisplayMode(id); setDisplayedListItems(10); }}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all border-2 ${
              displayMode === id
                ? 'border-purple-500 bg-purple-500 text-white shadow-md'
                : 'border-gray-300 text-gray-700 hover:border-purple-400 hover:text-purple-600 hover:bg-purple-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Charts */}
      {displayMode === 'chart' && (
        <>
          <ChartFilters
            visibleCharts={visibleCharts}
            onToggleChart={toggleChart}
            onShowAll={() => setVisibleCharts(DEFAULT_VISIBLE_CHARTS)}
          />
          {!hasData ? (
            <div className="text-center py-12"><p className="text-gray-500">{emptyMessage}</p></div>
          ) : (
            <div className="space-y-6">
              {visibleCharts.ca && (
                <div className="bg-white rounded-xl p-5 border-2 border-gray-200 shadow-sm">
                  <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">💰 Chiffre d'Affaires</h4>
                  <SingleLineChart data={historicalData} dataKey="total_ca" name="CA (€)" viewMode={viewMode} />
                </div>
              )}
              {visibleCharts.ventes && (
                <div className="bg-white rounded-xl p-5 border-2 border-gray-200 shadow-sm">
                  <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">🛒 Nombre de Ventes</h4>
                  <SingleLineChart data={historicalData} dataKey="total_ventes" name="Ventes" viewMode={viewMode} />
                </div>
              )}
              {visibleCharts.panierMoyen && (
                <div className="bg-white rounded-xl p-5 border-2 border-gray-200 shadow-sm">
                  <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">🛍️ Panier Moyen</h4>
                  <SingleLineChart data={historicalData} dataKey="panier_moyen" name="Panier Moyen (€)" viewMode={viewMode} />
                </div>
              )}
              {visibleCharts.tauxTransformation && (
                <div className="bg-white rounded-xl p-5 border-2 border-gray-200 shadow-sm">
                  <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">📈 Taux de Transformation (%)</h4>
                  {hasProspectsData ? (
                    <SingleLineChart data={historicalData} dataKey="taux_transformation" name="Taux (%)" viewMode={viewMode} />
                  ) : (
                    <div className="h-[300px] flex flex-col items-center justify-center text-center p-6 bg-purple-50 rounded-lg border-2 border-purple-200">
                      <div className="text-4xl mb-3">📊</div>
                      <p className="text-gray-700 font-semibold mb-2">Données de prospects manquantes</p>
                      <p className="text-sm text-gray-600 max-w-md">Le taux de transformation nécessite le suivi du nombre de prospects. Activez le KPI "Prospects" dans la configuration et demandez à vos vendeurs de le renseigner quotidiennement.</p>
                      <div className="mt-4 text-xs text-purple-700 bg-purple-100 px-4 py-2 rounded-lg">💡 Taux = (Ventes ÷ Prospects) × 100</div>
                    </div>
                  )}
                </div>
              )}
              {visibleCharts.indiceVente && (
                <div className="bg-white rounded-xl p-5 border-2 border-gray-200 shadow-sm">
                  <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">📊 Indice de Vente</h4>
                  <SingleLineChart data={historicalData} dataKey="indice_vente" name="Indice" viewMode={viewMode} />
                </div>
              )}
              {visibleCharts.articles && (
                <div className="bg-white rounded-xl p-5 border-2 border-gray-200 shadow-sm">
                  <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">📦 Articles Vendus</h4>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={historicalData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 9 }} interval={getChartInterval(viewMode)} angle={-45} textAnchor="end" height={60} tickFormatter={formatChartDate} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(value) => [value, 'Articles']} labelFormatter={formatChartDate} />
                      <Line type="monotone" dataKey="total_articles" name="Articles" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 2 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* List */}
      {displayMode === 'list' && (
        <div className="space-y-4">
          {hasData ? (
            <>
              <OverviewListTotals historicalData={historicalData} computePeriodTotals={computePeriodTotals} />
              <OverviewListEntries historicalData={historicalData} displayedListItems={displayedListItems} setDisplayedListItems={setDisplayedListItems} formatListDateLabel={formatListDateLabel} />
            </>
          ) : (
            <div className="text-center py-12"><p className="text-gray-500">{emptyMessage}</p></div>
          )}
        </div>
      )}
    </div>
  );
}

StoreKPIModalOverviewTab.propTypes = {
  viewMode: PropTypes.string.isRequired,
  displayMode: PropTypes.string.isRequired,
  setDisplayMode: PropTypes.func.isRequired,
  displayedListItems: PropTypes.number.isRequired,
  setDisplayedListItems: PropTypes.func.isRequired,
  visibleCharts: PropTypes.object.isRequired,
  toggleChart: PropTypes.func.isRequired,
  setVisibleCharts: PropTypes.func.isRequired,
  historicalData: PropTypes.array.isRequired,
  loadingHistorical: PropTypes.bool.isRequired,
};
