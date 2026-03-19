import React, { useState, useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatChartDate, computePeriodTotals, formatListDateLabel } from './storeKPIUtils';

/** Convert a YYYY-MM-DD date string to its ISO week string (YYYY-Www). */
function dateToISOWeek(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay() === 0 ? 7 : d.getDay(); // Mon=1 … Sun=7
  d.setDate(d.getDate() + 4 - day);
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

/** Return the Monday Date of a given ISO week (year, weekNo). */
function isoWeekToMonday(year, weekNo) {
  const jan4 = new Date(year, 0, 4);
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - (jan4.getDay() === 0 ? 6 : jan4.getDay() - 1) + (weekNo - 1) * 7);
  return monday;
}

/** Human-readable label for an ISO week string (e.g. "S12 · 17-23 mar. 2025"). */
function weekLabel(isoWeek) {
  const [year, wPart] = isoWeek.split('-W');
  const weekNo = parseInt(wPart, 10);
  // Find Monday of that ISO week
  const jan4 = new Date(parseInt(year, 10), 0, 4);
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - (jan4.getDay() === 0 ? 6 : jan4.getDay() - 1) + (weekNo - 1) * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (d) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  return `S${weekNo} · ${fmt(monday)} – ${fmt(sunday)}`;
}

const MONTH_NAMES = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
const DAY_NAMES = ['lu','ma','me','je','ve','sa','di'];

export function WeekPicker({ value, onChange, datesWithData }) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef(null);

  const [viewDate, setViewDate] = useState(() => {
    if (value) {
      const [y, w] = value.split('-W');
      const m = isoWeekToMonday(parseInt(y, 10), parseInt(w, 10));
      return { year: m.getFullYear(), month: m.getMonth() };
    }
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  const weeksWithData = useMemo(
    () => new Set((datesWithData || []).map(dateToISOWeek)),
    [datesWithData]
  );

  function getDateISOWeek(date) {
    const d = new Date(date);
    const day = d.getDay() === 0 ? 7 : d.getDay();
    d.setDate(d.getDate() + 4 - day);
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
    return `${d.getFullYear()}-W${String(weekNo).padStart(2, '0')}`;
  }

  function getWeekRows() {
    const { year, month } = viewDate;
    const firstDay = new Date(year, month, 1);
    const startDay = new Date(firstDay);
    const dow = startDay.getDay() === 0 ? 7 : startDay.getDay();
    startDay.setDate(startDay.getDate() - (dow - 1));
    const rows = [];
    const cur = new Date(startDay);
    for (let row = 0; row < 6; row++) {
      const weekStart = new Date(cur);
      const days = Array.from({ length: 7 }, () => { const d = new Date(cur); cur.setDate(cur.getDate() + 1); return d; });
      rows.push({ isoWeek: getDateISOWeek(weekStart), days });
      if (cur.getMonth() !== month && row >= 3) break;
    }
    return rows;
  }

  const weekRows = getWeekRows();
  const displayValue = value ? weekLabel(value) : 'Sélectionner une semaine';

  const handlePrev = () => setViewDate(prev => {
    const d = new Date(prev.year, prev.month - 1, 1);
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const handleNext = () => setViewDate(prev => {
    const d = new Date(prev.year, prev.month + 1, 1);
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  return (
    <div className="relative flex-1 max-w-md">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(o => !o)}
        className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-purple-400 focus:outline-none cursor-pointer bg-white text-left flex items-center justify-between text-sm font-medium text-gray-700"
      >
        <span>📅 {displayValue}</span>
        <svg className={`w-4 h-4 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full mt-2 left-0 bg-white rounded-xl shadow-2xl border border-gray-200 p-3 z-[9999] min-w-[300px]">
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
              <button type="button" onClick={handlePrev} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
                <ChevronLeft className="w-4 h-4 text-gray-600" />
              </button>
              <span className="text-xs font-bold text-gray-800">
                {MONTH_NAMES[viewDate.month]} {viewDate.year}
              </span>
              <button type="button" onClick={handleNext} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
                <ChevronRight className="w-4 h-4 text-gray-600" />
              </button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 gap-0.5 mb-1">
              {DAY_NAMES.map(d => (
                <div key={d} className="text-center text-xs font-semibold text-gray-500 py-1">{d}</div>
              ))}
            </div>

            {/* Week rows */}
            <div className="space-y-0.5">
              {weekRows.map(({ isoWeek, days }) => {
                const isSelected = value === isoWeek;
                const hasData = weeksWithData.has(isoWeek);
                return (
                  <button
                    key={isoWeek}
                    type="button"
                    onClick={() => { onChange(isoWeek); setIsOpen(false); }}
                    title={hasData ? 'Cette semaine a des données' : ''}
                    className={`w-full grid grid-cols-7 gap-0.5 rounded-lg px-0.5 py-0.5 transition-all border ${
                      isSelected
                        ? 'bg-orange-500 text-white border-orange-500 shadow-md'
                        : hasData
                        ? 'bg-green-100 hover:bg-green-200 text-green-900 border-green-300'
                        : 'hover:bg-gray-100 text-gray-700 border-transparent'
                    }`}
                  >
                    {days.map((day, i) => (
                      <div key={i} className={`text-xs text-center py-1 rounded ${day.getMonth() !== viewDate.month ? 'opacity-30' : ''}`}>
                        {day.getDate()}
                      </div>
                    ))}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="mt-3 pt-2 border-t border-gray-200 flex gap-4 text-xs text-gray-600">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 bg-green-100 rounded border border-green-300" />
                <span>Données</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 bg-orange-500 rounded" />
                <span>Sélectionnée</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
WeekPicker.propTypes = {
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  datesWithData: PropTypes.arrayOf(PropTypes.string)
};

function getChartInterval(viewMode) {
  if (viewMode === 'week') return 0;
  if (viewMode === 'month') return 2;
  return 0;
}

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
ChartFilters.propTypes = {
  visibleCharts: PropTypes.object.isRequired,
  onToggleChart: PropTypes.func.isRequired,
  onShowAll: PropTypes.func.isRequired
};

function SingleLineChart({ data, dataKey, name, viewMode, formatDate }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={getChartInterval(viewMode)} angle={-45} textAnchor="end" height={70} tickFormatter={formatDate} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip formatter={(value) => [value, name]} labelFormatter={formatDate} />
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



export default function StoreKPIModalOverviewTab({
  viewMode,
  displayMode,
  setDisplayMode,
  displayedListItems,
  setDisplayedListItems,
  visibleCharts,
  toggleChart,
  setVisibleCharts,
  historicalData,
  loadingHistorical,
}) {
  const hasData = historicalData.length > 0;
  const allZero = historicalData.every(d => d.total_ca === 0 && d.total_ventes === 0);
  const hasProspectsData = historicalData.some(d => d.total_prospects > 0);
  const defaultVisibleCharts = { ca: true, ventes: true, panierMoyen: true, tauxTransformation: true, indiceVente: true, articles: true };
  const chartEmptyMessageLoading = '⏳ Chargement des données...';
  const chartEmptyMessageNoData = '📭 Aucune donnée disponible pour cette période';
  const chartEmptyMessage = loadingHistorical ? chartEmptyMessageLoading : chartEmptyMessageNoData;
  const showChartWithData = displayMode === 'chart' && hasData;
  const showChartEmpty = displayMode === 'chart' && !hasData;

  const chartPlaceholderBlock = showChartEmpty ? (
    <div className="text-center py-12">
      <p className="text-gray-500">{chartEmptyMessage}</p>
    </div>
  ) : null;

  const chartSectionContent = showChartWithData ? (
    <div className="space-y-6">
      {visibleCharts.ca && (
        <div className="bg-white rounded-xl p-5 border-2 border-gray-200 shadow-sm">
          <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">💰 Chiffre d'Affaires</h4>
          <SingleLineChart data={historicalData} dataKey="total_ca" name="CA (€)" viewMode={viewMode} formatDate={formatChartDate} />
        </div>
      )}
      {visibleCharts.ventes && (
        <div className="bg-white rounded-xl p-5 border-2 border-gray-200 shadow-sm">
          <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">🛒 Nombre de Ventes</h4>
          <SingleLineChart data={historicalData} dataKey="total_ventes" name="Ventes" viewMode={viewMode} formatDate={formatChartDate} />
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
          {hasProspectsData ? (
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
              <XAxis dataKey="date" tick={{ fontSize: 9 }} interval={getChartInterval(viewMode)} angle={-45} textAnchor="end" height={60} tickFormatter={formatChartDate} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={(value) => [value, 'Articles']} labelFormatter={formatChartDate} />
              <Line type="monotone" dataKey="total_articles" name="Articles" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  ) : chartPlaceholderBlock;

  return (
    <div className="space-y-6">
      <div className="flex gap-2 mb-4">
        <button onClick={() => { setDisplayMode('list'); setDisplayedListItems(10); }} className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all border-2 ${displayMode === 'list' ? 'border-purple-500 bg-purple-500 text-white shadow-md' : 'border-gray-300 text-gray-700 hover:border-purple-400 hover:text-purple-600 hover:bg-purple-50'}`}>📊 Vue Chiffrée</button>
        <button onClick={() => { setDisplayMode('chart'); setDisplayedListItems(10); }} className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all border-2 ${displayMode === 'chart' ? 'border-purple-500 bg-purple-500 text-white shadow-md' : 'border-gray-300 text-gray-700 hover:border-purple-400 hover:text-purple-600 hover:bg-purple-50'}`}>📈 Vue Graphique</button>
      </div>

      {displayMode === 'chart' && <ChartFilters visibleCharts={visibleCharts} onToggleChart={toggleChart} onShowAll={() => setVisibleCharts(defaultVisibleCharts)} />}

      {chartSectionContent}

      {displayMode === 'list' && (
        <div className="space-y-4">
          {hasData ? (
            <>
              <OverviewListTotals historicalData={historicalData} computePeriodTotals={computePeriodTotals} />
              <OverviewListEntries historicalData={historicalData} displayedListItems={displayedListItems} setDisplayedListItems={setDisplayedListItems} formatListDateLabel={formatListDateLabel} />
            </>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500">{chartEmptyMessage}</p>
            </div>
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

function OverviewListTotals({ historicalData, computePeriodTotals }) {
  const { total_ca, total_ventes, total_articles, total_prospects, total_clients, panierMoyen, tauxTransfo, indiceVente } = computePeriodTotals(historicalData);
  const dayLabel = historicalData.length === 1 ? 'jour' : 'jours';
  const clientsDisplay = total_clients > 0 ? total_clients : 'N/A';
  return (
    <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl border-2 border-orange-300 shadow-lg overflow-hidden">
      <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-4 py-3">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">📊 TOTAL PÉRIODE <span className="text-sm font-normal opacity-90">({historicalData.length} {dayLabel})</span></h3>
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
