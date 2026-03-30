import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatChartDate, computePeriodTotals, formatListDateLabel } from './storeKPIUtils';
import OverviewListTotals from './storeKPIOverview/OverviewListTotals';
import OverviewListEntries from './storeKPIOverview/OverviewListEntries';

export { WeekPicker } from './WeekPicker';

function getChartInterval(viewMode) {
  if (viewMode === 'week') return 0;
  if (viewMode === 'month') return 4;
  return 0;
}

function SingleBarChart({ data, dataKey, name, viewMode }) {
  return (
    <div className="h-56 sm:h-72">
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={getChartInterval(viewMode)} angle={-45} textAnchor="end" height={70} tickFormatter={formatChartDate} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip formatter={(value) => [typeof value === 'number' ? value.toFixed(2) : value, name]} labelFormatter={formatChartDate} />
        <Bar dataKey={dataKey} name={name} fill="#8b5cf6" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
    </div>
  );
}

export default function StoreKPIModalOverviewTab({
  viewMode, displayMode, setDisplayMode,
  displayedListItems, setDisplayedListItems,
  visibleCharts, toggleChart, setVisibleCharts,
  historicalData, loadingHistorical,
}) {
  const [activeChart, setActiveChart] = useState(0);

  const hasData = historicalData.length > 0;
  const hasProspectsData = historicalData.some(d => d.total_prospects > 0);
  const emptyMessage = loadingHistorical ? '⏳ Chargement des données...' : '📭 Aucune donnée disponible pour cette période';

  const chartDefs = [
    {
      label: '💰 Chiffre d\'Affaires',
      content: <SingleBarChart data={historicalData} dataKey="total_ca" name="CA (€)" viewMode={viewMode} />,
    },
    {
      label: '🛒 Nombre de Ventes',
      content: <SingleBarChart data={historicalData} dataKey="total_ventes" name="Ventes" viewMode={viewMode} />,
    },
    {
      label: '🛍️ Panier Moyen',
      content: <SingleBarChart data={historicalData} dataKey="panier_moyen" name="Panier Moyen (€)" viewMode={viewMode} />,
    },
    {
      label: '📈 Taux de Transformation (%)',
      content: hasProspectsData ? (
        <SingleBarChart data={historicalData} dataKey="taux_transformation" name="Taux (%)" viewMode={viewMode} />
      ) : (
        <div className="h-[300px] flex flex-col items-center justify-center text-center p-6 bg-purple-50 rounded-lg border-2 border-purple-200">
          <div className="text-4xl mb-3">📊</div>
          <p className="text-gray-700 font-semibold mb-2">Données de prospects manquantes</p>
          <p className="text-sm text-gray-600 max-w-md">Le taux de transformation nécessite le suivi du nombre de prospects. Activez le KPI "Prospects" dans la configuration et demandez à vos vendeurs de le renseigner quotidiennement.</p>
          <div className="mt-4 text-xs text-purple-700 bg-purple-100 px-4 py-2 rounded-lg">💡 Taux = (Ventes ÷ Prospects) × 100</div>
        </div>
      ),
    },
    {
      label: '📊 Indice de Vente',
      content: <SingleBarChart data={historicalData} dataKey="indice_vente" name="Indice" viewMode={viewMode} />,
    },
    {
      label: '📦 Articles Vendus',
      content: (
        <div className="h-56 sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={historicalData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 9 }} interval={getChartInterval(viewMode)} angle={-45} textAnchor="end" height={60} tickFormatter={formatChartDate} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip formatter={(value) => [typeof value === 'number' ? value.toFixed(2) : value, 'Articles']} labelFormatter={formatChartDate} />
            <Bar dataKey="total_articles" name="Articles" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        </div>
      ),
    },
  ];

  const prev = () => setActiveChart(i => (i - 1 + chartDefs.length) % chartDefs.length);
  const next = () => setActiveChart(i => (i + 1) % chartDefs.length);
  const active = chartDefs[activeChart % chartDefs.length];

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
          {!hasData ? (
            <div className="text-center py-12"><p className="text-gray-500">{emptyMessage}</p></div>
          ) : (
            <div className="bg-white rounded-xl p-5 border-2 border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-gray-700">{active.label}</span>
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    {chartDefs.map((_, i) => (
                      <button key={i} onClick={() => setActiveChart(i)}
                        className={`h-2 rounded-full transition-all ${i === activeChart ? 'bg-gray-600 w-4' : 'bg-gray-200 w-2 hover:bg-gray-300'}`}
                      />
                    ))}
                  </div>
                  <button onClick={prev} className="p-1 rounded-lg hover:bg-gray-100"><ChevronLeft className="w-4 h-4 text-gray-500" /></button>
                  <button onClick={next} className="p-1 rounded-lg hover:bg-gray-100"><ChevronRight className="w-4 h-4 text-gray-500" /></button>
                </div>
              </div>
              {active.content}
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
