import React from 'react';
import PropTypes from 'prop-types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { formatChartDate, computePeriodTotals, formatListDateLabel } from './storeKPIUtils';

const CHART_INTERVAL = (viewMode) => (viewMode === 'week' ? 0 : viewMode === 'month' ? 2 : 0);

function ChartFilters({ visibleCharts, onToggleChart, onShowAll }) {
  const items = [
    { key: 'ca', label: '💰 CA' },
    { key: 'ventes', label: '🛒 Ventes' },
    { key: 'panierMoyen', label: '🛍️ Panier Moyen' },
    { key: 'tauxTransformation', label: '📈 Taux Transfo' },
    { key: 'indiceVente', label: '📊 Indice Vente' },
    { key: 'articles', label: '📦 Articles' }
  ];
  return (
    <div className="bg-white rounded-xl p-4 border-2 border-gray-200 shadow-sm">
      <h3 className="text-md font-bold text-gray-800 mb-3 flex items-center gap-2">🔍 Filtrer les graphiques</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {items.map(({ key, label }) => (
          <label key={key} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors">
            <input type="checkbox" checked={visibleCharts[key]} onChange={() => onToggleChart(key)} className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500" />
            <span className="text-sm font-medium text-gray-700">{label}</span>
          </label>
        ))}
        <button type="button" onClick={onShowAll} className="col-span-2 md:col-span-1 px-3 py-2 bg-orange-100 text-orange-700 text-sm font-medium rounded-lg hover:bg-orange-200 transition-colors">✓ Tout afficher</button>
      </div>
    </div>
  );
}

function SingleLineChart({ data, dataKey, name, viewMode, formatDate }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={CHART_INTERVAL(viewMode)} angle={-45} textAnchor="end" height={70} tickFormatter={formatDate} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip />
        <Legend />
        <Line type="monotone" dataKey={dataKey} name={name} stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
SingleLineChart.propTypes = {
  data: PropTypes.array.isRequired,
  dataKey: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  viewMode: PropTypes.string.isRequired,
  formatDate: PropTypes.func.isRequired
};

function DualLineChart({ data, primaryKey, primaryName, secondaryKey, secondaryName, viewMode, formatDate }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={CHART_INTERVAL(viewMode)} angle={-45} textAnchor="end" height={70} tickFormatter={formatDate} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip />
        <Legend />
        <Line type="monotone" dataKey={primaryKey} name={primaryName} stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} />
        <Line type="monotone" dataKey={secondaryKey} name={secondaryName} stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
DualLineChart.propTypes = {
  data: PropTypes.array.isRequired,
  primaryKey: PropTypes.string.isRequired,
  primaryName: PropTypes.string.isRequired,
  secondaryKey: PropTypes.string.isRequired,
  secondaryName: PropTypes.string.isRequired,
  viewMode: PropTypes.string.isRequired,
  formatDate: PropTypes.func.isRequired
};

export default function StoreKPIModalOverviewTab({
  viewMode,
  setViewMode,
  selectedWeek,
  setSelectedWeek,
  selectedMonth,
  setSelectedMonth,
  selectedYear,
  setSelectedYear,
  availableYears,
  getCurrentWeek,
  displayMode,
  setDisplayMode,
  displayedListItems,
  setDisplayedListItems,
  visibleCharts,
  toggleChart,
  setVisibleCharts,
  historicalData,
  loadingHistorical,
  onShowOverviewAIModal
}) {
  const hasData = historicalData.length > 0;
  const allZero = historicalData.every(d => d.total_ca === 0 && d.total_ventes === 0);
  const defaultVisibleCharts = { ca: true, ventes: true, panierMoyen: true, tauxTransformation: true, indiceVente: true, articles: true };

  const handleShowPicker = (e) => {
    try {
      if (typeof e.target.showPicker === 'function') e.target.showPicker();
    } catch (_) {}
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-2 mb-4">
        {[
          { id: 'week', label: '📅 Vue Hebdomadaire', onClick: () => { setViewMode('week'); if (!selectedWeek) setSelectedWeek(getCurrentWeek()); } },
          { id: 'month', label: '📆 Vue Mensuelle', onClick: () => { setViewMode('month'); setSelectedMonth(new Date().toISOString().slice(0, 7)); } },
          { id: 'year', label: '📅 Vue Annuelle', onClick: () => setViewMode('year') }
        ].map(({ id, label, onClick }) => (
          <button key={id} onClick={onClick} className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all border-2 ${viewMode === id ? 'border-orange-500 bg-orange-500 text-white shadow-md' : 'border-gray-300 text-gray-700 hover:border-orange-400 hover:text-orange-600 hover:bg-orange-50'}`}>{label}</button>
        ))}
      </div>

      {viewMode === 'week' && (
        <div className="bg-gradient-to-r from-orange-50 to-orange-100 rounded-xl p-4 border-2 border-orange-200">
          <h3 className="text-lg font-bold text-orange-900 mb-3">📅 Sélectionner une semaine</h3>
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <input type="week" value={selectedWeek} onChange={(e) => setSelectedWeek(e.target.value)} onClick={handleShowPicker} className="flex-1 max-w-md px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-purple-400 focus:outline-none cursor-pointer" />
            <button onClick={() => onShowOverviewAIModal(true)} disabled={!hasData || !selectedWeek || allZero} className="px-5 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 whitespace-nowrap" title={!selectedWeek ? 'Sélectionnez une semaine' : allZero ? 'Aucune donnée disponible pour cette période' : ''}>🤖 Analyse IA</button>
          </div>
        </div>
      )}
      {viewMode === 'month' && (
        <div className="bg-gradient-to-r from-orange-50 to-orange-100 rounded-xl p-4 border-2 border-orange-200">
          <h3 className="text-lg font-bold text-orange-900 mb-3">📆 Sélectionner un mois</h3>
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} onClick={handleShowPicker} className="flex-1 max-w-md px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-purple-400 focus:outline-none cursor-pointer" />
            <button onClick={() => onShowOverviewAIModal(true)} disabled={!hasData || !selectedMonth || allZero} className="px-5 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 whitespace-nowrap">🤖 Analyse IA</button>
          </div>
        </div>
      )}
      {viewMode === 'year' && (
        <div className="bg-gradient-to-r from-orange-50 to-orange-100 rounded-xl p-4 border-2 border-orange-200">
          <h3 className="text-lg font-bold text-orange-900 mb-3">📅 Sélectionner une année</h3>
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <select value={selectedYear} onChange={(e) => setSelectedYear(Number.parseInt(e.target.value, 10))} className="flex-1 max-w-md px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-purple-400 focus:outline-none bg-white cursor-pointer">
              {availableYears.length > 0 ? availableYears.map(y => <option key={y} value={y}>{y}</option>) : <><option value={new Date().getFullYear()}>{new Date().getFullYear()}</option><option value={new Date().getFullYear() - 1}>{new Date().getFullYear() - 1}</option></>}
            </select>
            <button onClick={() => onShowOverviewAIModal(true)} disabled={!hasData || allZero} className="px-5 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 whitespace-nowrap" title={allZero ? 'Aucune donnée disponible pour cette période' : ''}>🤖 Analyse IA</button>
          </div>
        </div>
      )}

      <div className="flex gap-2 mb-4">
        <button onClick={() => { setDisplayMode('list'); setDisplayedListItems(10); }} className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all border-2 ${displayMode === 'list' ? 'border-purple-500 bg-purple-500 text-white shadow-md' : 'border-gray-300 text-gray-700 hover:border-purple-400 hover:text-purple-600 hover:bg-purple-50'}`}>📊 Vue Chiffrée</button>
        <button onClick={() => { setDisplayMode('chart'); setDisplayedListItems(10); }} className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all border-2 ${displayMode === 'chart' ? 'border-purple-500 bg-purple-500 text-white shadow-md' : 'border-gray-300 text-gray-700 hover:border-purple-400 hover:text-purple-600 hover:bg-purple-50'}`}>📈 Vue Graphique</button>
      </div>

      {displayMode === 'chart' && <ChartFilters visibleCharts={visibleCharts} onToggleChart={toggleChart} onShowAll={() => setVisibleCharts(defaultVisibleCharts)} />}

      {displayMode === 'chart' && hasData ? (
        <div className="space-y-6">
          {visibleCharts.ca && (
            <div className="bg-white rounded-xl p-5 border-2 border-gray-200 shadow-sm">
              <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">💰 Chiffre d'Affaires</h4>
              <DualLineChart data={historicalData} primaryKey="total_ca" primaryName="CA Total" secondaryKey="seller_ca" secondaryName="CA Vendeurs" viewMode={viewMode} formatDate={formatChartDate} />
            </div>
          )}
          {visibleCharts.ventes && (
            <div className="bg-white rounded-xl p-5 border-2 border-gray-200 shadow-sm">
              <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">🛒 Nombre de Ventes</h4>
              <DualLineChart data={historicalData} primaryKey="total_ventes" primaryName="Ventes Totales" secondaryKey="seller_ventes" secondaryName="Ventes Vendeurs" viewMode={viewMode} formatDate={formatChartDate} />
            </div>
          )}
          {visibleCharts.panierMoyen && (
            <div className="bg-white rounded-xl p-5 border-2 border-gray-200 shadow-sm">
              <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">🛍️ Panier Moyen</h4>
              <SingleLineChart data={historicalData} dataKey="panier_moyen" name="Panier Moyen (€)" viewMode={viewMode} formatDate={formatChartDate} />
            </div>
          )}
          {visibleCharts.tauxTransformation && (
            <div className="bg-white rounded-xl p-5 border-2 border-gray-200 shadow-sm">
              <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">📈 Taux de Transformation (%)</h4>
              {historicalData.some(d => d.total_prospects > 0) ? (
                <SingleLineChart data={historicalData} dataKey="taux_transformation" name="Taux (%)" viewMode={viewMode} formatDate={formatChartDate} />
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
              <SingleLineChart data={historicalData} dataKey="indice_vente" name="Indice" viewMode={viewMode} formatDate={formatChartDate} />
            </div>
          )}
          {visibleCharts.articles && (
            <div className="bg-white rounded-xl p-5 border-2 border-gray-200 shadow-sm">
              <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">📦 Articles Vendus</h4>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={historicalData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 9 }} interval={CHART_INTERVAL(viewMode)} angle={-45} textAnchor="end" height={60} tickFormatter={formatChartDate} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="total_articles" name="Articles" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      ) : displayMode === 'chart' ? (
        <div className="text-center py-12">
          {loadingHistorical ? <p className="text-gray-500">⏳ Chargement des données...</p> : <p className="text-gray-500">📭 Aucune donnée disponible pour cette période</p>}
        </div>
      ) : null}

      {displayMode === 'list' && (
        <div className="space-y-4">
          {hasData ? (
            <>
              <OverviewListTotals historicalData={historicalData} computePeriodTotals={computePeriodTotals} />
              <OverviewListEntries historicalData={historicalData} displayedListItems={displayedListItems} setDisplayedListItems={setDisplayedListItems} formatListDateLabel={formatListDateLabel} />
            </>
          ) : (
            <div className="text-center py-12">
              {loadingHistorical ? <p className="text-gray-500">⏳ Chargement des données...</p> : <p className="text-gray-500">📭 Aucune donnée disponible pour cette période</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
StoreKPIModalOverviewTab.propTypes = {
  viewMode: PropTypes.string.isRequired,
  setViewMode: PropTypes.func.isRequired,
  selectedWeek: PropTypes.string.isRequired,
  setSelectedWeek: PropTypes.func.isRequired,
  selectedMonth: PropTypes.string.isRequired,
  setSelectedMonth: PropTypes.func.isRequired,
  selectedYear: PropTypes.number.isRequired,
  setSelectedYear: PropTypes.func.isRequired,
  availableYears: PropTypes.arrayOf(PropTypes.number).isRequired,
  getCurrentWeek: PropTypes.func.isRequired,
  displayMode: PropTypes.string.isRequired,
  setDisplayMode: PropTypes.func.isRequired,
  displayedListItems: PropTypes.number.isRequired,
  setDisplayedListItems: PropTypes.func.isRequired,
  visibleCharts: PropTypes.object.isRequired,
  toggleChart: PropTypes.func.isRequired,
  setVisibleCharts: PropTypes.func.isRequired,
  historicalData: PropTypes.array.isRequired,
  loadingHistorical: PropTypes.bool.isRequired,
  onShowOverviewAIModal: PropTypes.func.isRequired
};

function OverviewListTotals({ historicalData, computePeriodTotals }) {
  const { total_ca, total_ventes, total_articles, total_prospects, total_clients, panierMoyen, tauxTransfo, indiceVente } = computePeriodTotals(historicalData);
  return (
    <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl border-2 border-orange-300 shadow-lg overflow-hidden">
      <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-4 py-3">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">📊 TOTAL PÉRIODE <span className="text-sm font-normal opacity-90">({historicalData.length} {historicalData.length === 1 ? 'jour' : 'jours'})</span></h3>
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
            <div className="text-sm font-bold text-yellow-900 break-words">{total_clients > 0 ? total_clients : 'N/A'}</div>
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
  computePeriodTotals: PropTypes.func.isRequired
};

function OverviewListEntries({ historicalData, displayedListItems, setDisplayedListItems, formatListDateLabel }) {
  const slice = historicalData.slice(0, displayedListItems);
  return (
    <div className="bg-white rounded-xl border-2 border-gray-200 shadow-sm overflow-hidden">
      <div className="bg-gradient-to-r from-purple-500 to-purple-600 px-4 py-3">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">📋 Données Quotidiennes <span className="text-sm font-normal opacity-90">({historicalData.length} entrées)</span></h3>
      </div>
      <div className="divide-y divide-gray-200">
        {slice.map((entry, index) => {
          const panierMoyen = entry.total_ventes > 0 ? (entry.total_ca / entry.total_ventes).toFixed(2) : 0;
          const tauxTransfo = entry.total_prospects > 0 ? ((entry.total_ventes / entry.total_prospects) * 100).toFixed(1) : 0;
          const indiceVente = entry.total_ventes > 0 ? (entry.total_articles / entry.total_ventes).toFixed(2) : 0;
          return (
            <div key={index} className="p-5 hover:bg-purple-50 transition-colors border-b border-gray-100 last:border-b-0">
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
          <button type="button" onClick={() => setDisplayedListItems(prev => Math.min(prev + 10, historicalData.length))} className="w-full px-4 py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white font-semibold rounded-lg hover:from-purple-600 hover:to-purple-700 transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2">
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
  formatListDateLabel: PropTypes.func.isRequired
};
