import React from 'react';
import { TrendingUp, BarChart3, Download, Sparkles, Target, AlertTriangle } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import KPICalendar from '../KPICalendar';
import { WeekPicker } from '../storeKPI/StoreKPIModalOverviewTab';
import { getWeekStartEnd } from '../storeKPI/storeKPIUtils';

// Fonction utilitaire pour formater les dates
const formatDate = (dateString) => {
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

export default function BilanTab({
  viewMode, setViewMode,
  selectedDay, setSelectedDay,
  selectedWeek, setSelectedWeek,
  selectedMonth, setSelectedMonth,
  selectedYear, setSelectedYear,
  periodLoading, periodEntries, periodBilan, periodGenerating,
  periodAggregates, periodChartData, yearMonthlyData, datesWithData,
  bilanData, kpiEntries, displayedKpiCount, setDisplayedKpiCount,
  exportingPDF, setExportingPDF, wasGenerating,
  weekInfo, periodRange, kpiConfig, user, isReadOnly,
  generatingBilan, currentWeekOffset,
  contentRef, bilanSectionRef,
  setEditingEntry, setActiveTab,
  generatePeriodBilan, onRegenerate, onLoadMoreKpi, onWeekChange,
  chartData, sellerAvailableYears, exportToPDF,
}) {
  return (
            <div>
              {/* Barre d'action */}
              <div className="px-4 py-3 bg-gray-50 border-b space-y-3">
                {/* Ligne 1 : sélecteur de vue + boutons */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  {/* Sélecteur de période */}
                  <div className="flex gap-1.5">
                    {[
                      { id: 'jour', label: '📅 Jour' },
                      { id: 'semaine', label: '📅 Semaine' },
                      { id: 'mois', label: '🗓️ Mois' },
                      { id: 'annee', label: '📆 Année' },
                    ].map(({ id, label }) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setViewMode(id)}
                        className={`px-3 py-1.5 text-sm font-semibold rounded-lg transition-all border-2 ${
                          viewMode === id
                            ? 'border-orange-500 bg-orange-500 text-white shadow-md'
                            : 'border-gray-300 text-gray-700 hover:border-orange-400 hover:text-orange-600 hover:bg-orange-50'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {/* Boutons IA + PDF */}
                  <div className="flex flex-wrap gap-2">
                    {viewMode === 'semaine' && onRegenerate && (
                      <button
                        onClick={onRegenerate}
                        disabled={generatingBilan}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition flex items-center gap-2 disabled:opacity-50"
                      >
                        <TrendingUp className={`w-4 h-4 ${generatingBilan ? 'animate-spin' : ''}`} />
                        <span>{generatingBilan ? 'Génération...' : (bilanData?.synthese ? 'Regénérer' : 'Générer')}</span>
                      </button>
                    )}
                    {(viewMode === 'jour' || viewMode === 'mois' || viewMode === 'annee') && (
                      <button
                        onClick={generatePeriodBilan}
                        disabled={periodGenerating || periodLoading}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition flex items-center gap-2 disabled:opacity-50"
                      >
                        <TrendingUp className={`w-4 h-4 ${periodGenerating ? 'animate-spin' : ''}`} />
                        <span>{periodGenerating ? 'Génération...' : (periodBilan?.synthese ? 'Regénérer IA' : 'Générer IA')}</span>
                      </button>
                    )}
                    <button
                      onClick={exportToPDF}
                      disabled={exportingPDF}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition flex items-center gap-2 disabled:opacity-50"
                    >
                      <Download className={`w-4 h-4 ${exportingPDF ? 'animate-bounce' : ''}`} />
                      <span>{exportingPDF ? 'Export...' : 'PDF'}</span>
                    </button>
                  </div>
                </div>

                {/* Ligne 2 : navigation temporelle */}
                {viewMode === 'jour' && (
                  <div className="flex items-center gap-2">
                    <KPICalendar
                      selectedDate={selectedDay}
                      onDateChange={setSelectedDay}
                      datesWithData={datesWithData}
                    />
                  </div>
                )}
                {viewMode === 'semaine' && (
                  <WeekPicker
                    value={selectedWeek}
                    onChange={(newWeek) => {
                      setSelectedWeek(newWeek);
                      if (onWeekChange) {
                        const { startDate: targetMonday } = getWeekStartEnd(newWeek);
                        const now = new Date();
                        const dow = now.getDay() || 7;
                        const currentMonday = new Date(now);
                        currentMonday.setDate(now.getDate() - dow + 1);
                        currentMonday.setHours(0, 0, 0, 0);
                        const diffWeeks = Math.round((targetMonday - currentMonday) / (7 * 24 * 3600 * 1000));
                        onWeekChange(diffWeeks);
                      }
                    }}
                    datesWithData={datesWithData}
                  />
                )}
                {viewMode === 'mois' && (
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    onClick={(e) => { try { if (typeof e.target.showPicker === 'function') e.target.showPicker(); } catch (_) {} }}
                    className="flex-1 max-w-md px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-orange-400 focus:outline-none cursor-pointer bg-white"
                  />
                )}
                {viewMode === 'annee' && (
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                    className="flex-1 max-w-md px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-orange-400 focus:outline-none bg-white cursor-pointer"
                  >
                    {sellerAvailableYears.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                )}
              </div>

              {/* Contenu scrollable */}
              <div ref={contentRef} data-pdf-content className="p-6">

                {/* === VUE JOUR (cartes KPI, style StoreKPI) === */}
                {viewMode === 'jour' && (
                  <>
                  {periodLoading ? (
                    <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                      <div className="w-10 h-10 border-4 border-orange-400 border-t-transparent rounded-full animate-spin mb-4" />
                      <p>Chargement des données...</p>
                    </div>
                  ) : periodEntries.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {(kpiConfig?.track_ca ?? true) && (
                        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
                          <p className="text-xs text-blue-700 font-semibold mb-1">💰 CA Réalisé</p>
                          <p className="text-2xl font-bold text-blue-900">{(periodEntries[0].ca_journalier ?? 0).toFixed(0)} €</p>
                        </div>
                      )}
                      {(kpiConfig?.track_ventes ?? true) && (
                        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
                          <p className="text-xs text-green-700 font-semibold mb-1">🛒 Ventes</p>
                          <p className="text-2xl font-bold text-green-900">{periodEntries[0].nb_ventes ?? 0}</p>
                          {(kpiConfig?.track_ca ?? true) && periodEntries[0].nb_ventes > 0 && (
                            <p className="text-xs text-green-600 mt-1">PM: {((periodEntries[0].ca_journalier ?? 0) / periodEntries[0].nb_ventes).toFixed(0)} €</p>
                          )}
                        </div>
                      )}
                      {(kpiConfig?.track_articles ?? true) && (
                        <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4 border border-orange-200">
                          <p className="text-xs text-orange-700 font-semibold mb-1">📦 Articles</p>
                          <p className="text-2xl font-bold text-orange-900">{periodEntries[0].nb_articles ?? 0}</p>
                          {(kpiConfig?.track_ventes ?? true) && periodEntries[0].nb_ventes > 0 && (
                            <p className="text-xs text-orange-600 mt-1">IV: {(periodEntries[0].nb_articles / periodEntries[0].nb_ventes).toFixed(2)}</p>
                          )}
                        </div>
                      )}
                      {(kpiConfig?.track_prospects ?? true) && (
                        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
                          <p className="text-xs text-purple-700 font-semibold mb-1">🚶 Prospects</p>
                          <p className="text-2xl font-bold text-purple-900">{periodEntries[0].nb_prospects ?? 0}</p>
                          {(kpiConfig?.track_ventes ?? true) && periodEntries[0].nb_prospects > 0 && (
                            <p className="text-xs text-purple-600 mt-1">Taux: {((periodEntries[0].nb_ventes / periodEntries[0].nb_prospects) * 100).toFixed(0)}%</p>
                          )}
                        </div>
                      )}
                      {(kpiConfig?.track_ca ?? true) && (kpiConfig?.track_ventes ?? true) && periodEntries[0].nb_ventes > 0 && (
                        <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-lg p-4 border border-indigo-200">
                          <p className="text-xs text-indigo-700 font-semibold mb-1">💳 P.Moyen</p>
                          <p className="text-2xl font-bold text-indigo-900">{((periodEntries[0].ca_journalier ?? 0) / periodEntries[0].nb_ventes).toFixed(0)} €</p>
                        </div>
                      )}
                      {(kpiConfig?.track_articles ?? true) && (kpiConfig?.track_ventes ?? true) && periodEntries[0].nb_ventes > 0 && (
                        <div className="bg-gradient-to-br from-teal-50 to-teal-100 rounded-lg p-4 border border-teal-200">
                          <p className="text-xs text-teal-700 font-semibold mb-1">🎯 Ind.Vente</p>
                          <p className="text-2xl font-bold text-teal-900">{(periodEntries[0].nb_articles / periodEntries[0].nb_ventes).toFixed(2)}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                      <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-600">Aucune saisie pour cette date</p>
                    </div>
                  )}

                  {/* Section IA — Jour */}
                  {!periodLoading && (
                    <div className="mt-6">
                      {periodGenerating && (
                        <div className="bg-white rounded-2xl p-8 max-w-md mx-auto shadow-2xl border-2 border-blue-200">
                          <div className="text-center mb-6">
                            <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center animate-pulse">
                              <Sparkles className="w-8 h-8 text-white" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-800 mb-2">Analyse en cours...</h3>
                            <p className="text-gray-600 text-sm">L'IA analyse vos performances du {periodRange?.label}</p>
                          </div>
                          <div className="relative w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-500" style={{ animation: 'progress-slide 2s ease-in-out infinite', backgroundSize: '200% 100%' }} />
                          </div>
                        </div>
                      )}
                      {periodBilan?.synthese && !periodGenerating && (
                        <div className="space-y-4">
                          <div className="bg-blue-50 rounded-xl p-4 border-l-4 border-blue-500">
                            <div className="flex items-start gap-2 mb-2">
                              <Sparkles className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                              <h3 className="font-bold text-blue-900">💡 Synthèse — {periodBilan.periode}</h3>
                            </div>
                            <p className="text-gray-700 leading-relaxed">{periodBilan.synthese}</p>
                          </div>
                          {periodBilan.action_prioritaire && (
                            <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-xl p-4 text-white shadow-lg">
                              <div className="flex items-center gap-2 mb-1">
                                <Target className="w-5 h-5 flex-shrink-0" />
                                <h3 className="font-bold text-sm uppercase tracking-wide">🎯 Action prioritaire</h3>
                              </div>
                              <p className="text-lg font-semibold leading-snug">{periodBilan.action_prioritaire}</p>
                            </div>
                          )}
                          {periodBilan.points_forts?.length > 0 && (
                            <div className="bg-green-50 rounded-xl p-4 border-l-4 border-green-500">
                              <div className="flex items-center gap-2 mb-3">
                                <TrendingUp className="w-5 h-5 text-green-600" />
                                <h3 className="font-bold text-green-900">👍 Points forts</h3>
                              </div>
                              <ul className="space-y-2">
                                {periodBilan.points_forts.map((p, i) => (
                                  <li key={i} className="flex items-start gap-2">
                                    <span className="text-green-600 mt-1">✓</span>
                                    <span className="text-gray-700">{p}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {periodBilan.points_attention?.length > 0 && (
                            <div className="bg-orange-50 rounded-xl p-4 border-l-4 border-orange-500">
                              <div className="flex items-center gap-2 mb-3">
                                <AlertTriangle className="w-5 h-5 text-orange-600" />
                                <h3 className="font-bold text-orange-900">⚠️ Points à améliorer</h3>
                              </div>
                              <ul className="space-y-2">
                                {periodBilan.points_attention.map((p, i) => (
                                  <li key={i} className="flex items-start gap-2">
                                    <span className="text-orange-600 mt-1">!</span>
                                    <span className="text-gray-700">{p}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {periodBilan.recommandations?.length > 0 && (
                            <div className="bg-indigo-50 rounded-xl p-4 border-l-4 border-indigo-500">
                              <div className="flex items-center gap-2 mb-3">
                                <Target className="w-5 h-5 text-indigo-600" />
                                <h3 className="font-bold text-indigo-900">🎯 Recommandations</h3>
                              </div>
                              <ol className="space-y-2 list-decimal list-inside">
                                {periodBilan.recommandations.map((r, i) => (
                                  <li key={i} className="text-gray-700">{r}</li>
                                ))}
                              </ol>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  </>
                )}

                {/* === VUES MOIS / ANNEE === */}
                {(viewMode === 'mois' || viewMode === 'annee') && (
                  periodLoading ? (
                    <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                      <div className="w-10 h-10 border-4 border-orange-400 border-t-transparent rounded-full animate-spin mb-4" />
                      <p>Chargement des données...</p>
                    </div>
                  ) : periodAggregates ? (
                    <>
                      <div className="flex items-center gap-2 mb-4">
                        <BarChart3 className="w-5 h-5 text-orange-600" />
                        <h3 className="font-bold text-gray-800">{periodRange?.label} — {periodAggregates.nb_jours} jour{periodAggregates.nb_jours > 1 ? 's' : ''} avec données</h3>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                        {(kpiConfig?.track_ca ?? true) && (
                          <div className="bg-blue-50 rounded-lg p-3">
                            <p className="text-xs text-blue-600 mb-1">💰 CA total</p>
                            <p className="text-lg font-bold text-blue-900">{periodAggregates.ca.toFixed(0)}€</p>
                          </div>
                        )}
                        {(kpiConfig?.track_ventes ?? true) && (
                          <div className="bg-green-50 rounded-lg p-3">
                            <p className="text-xs text-green-600 mb-1">🛒 Ventes</p>
                            <p className="text-lg font-bold text-green-900">{periodAggregates.ventes}</p>
                          </div>
                        )}
                        {(kpiConfig?.track_articles ?? true) && (
                          <div className="bg-orange-50 rounded-lg p-3">
                            <p className="text-xs text-orange-600 mb-1">📦 Articles</p>
                            <p className="text-lg font-bold text-orange-900">{periodAggregates.articles}</p>
                          </div>
                        )}
                        {(kpiConfig?.track_prospects ?? true) && (
                          <div className="bg-purple-50 rounded-lg p-3">
                            <p className="text-xs text-purple-600 mb-1">🚶 Prospects</p>
                            <p className="text-lg font-bold text-purple-900">{periodAggregates.prospects}</p>
                          </div>
                        )}
                        {(kpiConfig?.track_ca ?? true) && (kpiConfig?.track_ventes ?? true) && periodAggregates.panier_moyen > 0 && (
                          <div className="bg-indigo-50 rounded-lg p-3">
                            <p className="text-xs text-indigo-600 mb-1">💳 Panier moyen</p>
                            <p className="text-lg font-bold text-indigo-900">{periodAggregates.panier_moyen.toFixed(0)}€</p>
                          </div>
                        )}
                        {(kpiConfig?.track_ventes ?? true) && (kpiConfig?.track_prospects ?? true) && periodAggregates.taux_transformation > 0 && (
                          <div className="bg-pink-50 rounded-lg p-3">
                            <p className="text-xs text-pink-600 mb-1">📈 Taux transfo</p>
                            <p className="text-lg font-bold text-pink-900">{periodAggregates.taux_transformation.toFixed(1)}%</p>
                          </div>
                        )}
                        {(kpiConfig?.track_articles ?? true) && (kpiConfig?.track_ventes ?? true) && periodAggregates.indice_vente > 0 && (
                          <div className="bg-teal-50 rounded-lg p-3">
                            <p className="text-xs text-teal-600 mb-1">🎯 Indice vente</p>
                            <p className="text-lg font-bold text-teal-900">{periodAggregates.indice_vente.toFixed(2)}</p>
                          </div>
                        )}
                      </div>

                      {/* Détail */}
                      <div className="mb-6">
                        <h3 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
                          <BarChart3 className="w-4 h-4 text-gray-500" />
                          {viewMode === 'annee' ? '📋 Détail par mois' : '📋 Détail par journée'}
                        </h3>
                        <div className="overflow-x-auto rounded-xl border border-gray-200">
                          <table className="w-full text-sm">
                            <thead className="bg-gray-100">
                              <tr>
                                <th className="text-left px-3 py-2 text-gray-600 font-semibold">{viewMode === 'annee' ? 'Mois' : 'Date'}</th>
                                {(kpiConfig?.track_ca ?? true) && <th className="text-right px-3 py-2 text-blue-700 font-semibold">💰 CA</th>}
                                {(kpiConfig?.track_ventes ?? true) && <th className="text-right px-3 py-2 text-green-700 font-semibold">🛒 Ventes</th>}
                                {(kpiConfig?.track_articles ?? true) && <th className="text-right px-3 py-2 text-orange-700 font-semibold">📦 Articles</th>}
                                {(kpiConfig?.track_prospects ?? true) && <th className="text-right px-3 py-2 text-purple-700 font-semibold">🚶 Prospects</th>}
                                {(kpiConfig?.track_ca ?? true) && (kpiConfig?.track_ventes ?? true) && <th className="text-right px-3 py-2 text-indigo-700 font-semibold">💳 P.Moyen</th>}
                                {(kpiConfig?.track_articles ?? true) && (kpiConfig?.track_ventes ?? true) && <th className="text-right px-3 py-2 text-teal-700 font-semibold">🎯 IV</th>}
                              </tr>
                            </thead>
                            <tbody>
                              {viewMode === 'annee' ? yearMonthlyData.map((m, i) => {
                                const pm = m.ventes > 0 ? m.ca / m.ventes : 0;
                                const iv = m.ventes > 0 ? m.articles / m.ventes : 0;
                                const label = new Date(m.month + '-15').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
                                return (
                                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                    <td className="px-3 py-2 text-gray-700 font-medium capitalize">{label}</td>
                                    {(kpiConfig?.track_ca ?? true) && <td className="text-right px-3 py-2 text-blue-900 font-semibold">{m.ca > 0 ? `${m.ca.toFixed(0)}€` : '—'}</td>}
                                    {(kpiConfig?.track_ventes ?? true) && <td className="text-right px-3 py-2 text-green-900">{m.ventes || '—'}</td>}
                                    {(kpiConfig?.track_articles ?? true) && <td className="text-right px-3 py-2 text-orange-900">{m.articles || '—'}</td>}
                                    {(kpiConfig?.track_prospects ?? true) && <td className="text-right px-3 py-2 text-purple-900">{m.prospects || '—'}</td>}
                                    {(kpiConfig?.track_ca ?? true) && (kpiConfig?.track_ventes ?? true) && <td className="text-right px-3 py-2 text-indigo-900">{pm > 0 ? `${pm.toFixed(0)}€` : '—'}</td>}
                                    {(kpiConfig?.track_articles ?? true) && (kpiConfig?.track_ventes ?? true) && <td className="text-right px-3 py-2 text-teal-900">{m.ventes > 0 ? iv.toFixed(2) : '—'}</td>}
                                  </tr>
                                );
                              }) : periodEntries.map((entry, i) => {
                                const pm = entry.nb_ventes > 0 ? entry.ca_journalier / entry.nb_ventes : 0;
                                const iv = entry.nb_ventes > 0 ? (entry.nb_articles ?? 0) / entry.nb_ventes : 0;
                                return (
                                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                    <td className="px-3 py-2 text-gray-700 font-medium">{new Date(entry.date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}</td>
                                    {(kpiConfig?.track_ca ?? true) && <td className="text-right px-3 py-2 text-blue-900 font-semibold">{entry.ca_journalier != null ? `${entry.ca_journalier.toFixed(0)}€` : '—'}</td>}
                                    {(kpiConfig?.track_ventes ?? true) && <td className="text-right px-3 py-2 text-green-900">{entry.nb_ventes ?? '—'}</td>}
                                    {(kpiConfig?.track_articles ?? true) && <td className="text-right px-3 py-2 text-orange-900">{entry.nb_articles ?? '—'}</td>}
                                    {(kpiConfig?.track_prospects ?? true) && <td className="text-right px-3 py-2 text-purple-900">{entry.nb_prospects ?? '—'}</td>}
                                    {(kpiConfig?.track_ca ?? true) && (kpiConfig?.track_ventes ?? true) && <td className="text-right px-3 py-2 text-indigo-900">{pm > 0 ? `${pm.toFixed(0)}€` : '—'}</td>}
                                    {(kpiConfig?.track_articles ?? true) && (kpiConfig?.track_ventes ?? true) && <td className="text-right px-3 py-2 text-teal-900">{entry.nb_ventes > 0 ? iv.toFixed(2) : '—'}</td>}
                                  </tr>
                                );
                              })}
                              {(viewMode === 'annee' ? yearMonthlyData : periodEntries).length === 0 && (
                                <tr><td colSpan={10} className="px-3 py-6 text-center text-gray-500 italic">Aucune donnée saisie pour cette période</td></tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Graphiques période — masqués pour la vue Jour */}
                      {viewMode !== 'jour' && periodChartData.length > 0 && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          {(kpiConfig?.track_ca ?? true) && (
                            <div className="bg-blue-50 rounded-xl p-4">
                              <h4 className="text-sm font-semibold text-blue-900 mb-3">💰 Évolution du CA</h4>
                              <ResponsiveContainer width="100%" height={180}>
                                <LineChart data={periodChartData}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" />
                                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#1e40af' }} stroke="#3b82f6" />
                                  <YAxis tick={{ fontSize: 10, fill: '#1e40af' }} stroke="#3b82f6" />
                                  <Tooltip contentStyle={{ backgroundColor: '#eff6ff', border: '2px solid #3b82f6', borderRadius: '8px' }} />
                                  <Line type="monotone" dataKey="CA" stroke="#3b82f6" strokeWidth={2} dot={false} />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          )}
                          {(kpiConfig?.track_ventes ?? true) && (
                            <div className="bg-green-50 rounded-xl p-4">
                              <h4 className="text-sm font-semibold text-green-900 mb-3">🛒 Évolution des Ventes</h4>
                              <ResponsiveContainer width="100%" height={180}>
                                <BarChart data={periodChartData}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#d1fae5" />
                                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#065f46' }} stroke="#10b981" />
                                  <YAxis tick={{ fontSize: 10, fill: '#065f46' }} stroke="#10b981" />
                                  <Tooltip contentStyle={{ backgroundColor: '#d1fae5', border: '2px solid #10b981', borderRadius: '8px' }} />
                                  <Bar dataKey="Ventes" fill="#10b981" radius={[4, 4, 0, 0]} />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          )}
                          {(kpiConfig?.track_articles ?? true) && (
                            <div className="bg-orange-50 rounded-xl p-4">
                              <h4 className="text-sm font-semibold text-orange-900 mb-3">📦 Évolution des Articles</h4>
                              <ResponsiveContainer width="100%" height={180}>
                                <BarChart data={periodChartData}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#fed7aa" />
                                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9a3412' }} stroke="#f97316" />
                                  <YAxis tick={{ fontSize: 10, fill: '#9a3412' }} stroke="#f97316" />
                                  <Tooltip contentStyle={{ backgroundColor: '#ffedd5', border: '2px solid #f97316', borderRadius: '8px' }} />
                                  <Bar dataKey="Articles" fill="#f97316" radius={[4, 4, 0, 0]} />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          )}
                          {(kpiConfig?.track_prospects ?? true) && (
                            <div className="bg-purple-50 rounded-xl p-4">
                              <h4 className="text-sm font-semibold text-purple-900 mb-3">🚶 Évolution des Prospects</h4>
                              <ResponsiveContainer width="100%" height={180}>
                                <LineChart data={periodChartData}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#e9d5ff" />
                                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#581c87' }} stroke="#a855f7" />
                                  <YAxis tick={{ fontSize: 10, fill: '#581c87' }} stroke="#a855f7" />
                                  <Tooltip contentStyle={{ backgroundColor: '#f3e8ff', border: '2px solid #a855f7', borderRadius: '8px' }} />
                                  <Line type="monotone" dataKey="Prospects" stroke="#a855f7" strokeWidth={2} dot={false} />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Section IA — pour Jour, Mois et Année */}
                      {(viewMode === 'jour' || viewMode === 'mois' || viewMode === 'annee') && <div className="mt-6">
                        {periodGenerating && (
                          <div className="bg-white rounded-2xl p-8 max-w-md mx-auto shadow-2xl border-2 border-blue-200">
                            <div className="text-center mb-6">
                              <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center animate-pulse">
                                <Sparkles className="w-8 h-8 text-white" />
                              </div>
                              <h3 className="text-xl font-bold text-gray-800 mb-2">Analyse en cours...</h3>
                              <p className="text-gray-600 text-sm">L'IA analyse vos performances sur {periodRange?.label}</p>
                            </div>
                            <div className="relative w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-500" style={{ animation: 'progress-slide 2s ease-in-out infinite', backgroundSize: '200% 100%' }} />
                            </div>
                          </div>
                        )}

                        {periodBilan?.synthese && !periodGenerating && (
                          <div className="space-y-4">
                            <div className="bg-blue-50 rounded-xl p-4 border-l-4 border-blue-500">
                              <div className="flex items-start gap-2 mb-2">
                                <Sparkles className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                                <h3 className="font-bold text-blue-900">💡 Synthèse — {periodBilan.periode}</h3>
                              </div>
                              <p className="text-gray-700 leading-relaxed">{periodBilan.synthese}</p>
                            </div>
                            {periodBilan.action_prioritaire && (
                              <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-xl p-4 text-white shadow-lg">
                                <div className="flex items-center gap-2 mb-1">
                                  <Target className="w-5 h-5 flex-shrink-0" />
                                  <h3 className="font-bold text-sm uppercase tracking-wide">🎯 Action prioritaire</h3>
                                </div>
                                <p className="text-lg font-semibold leading-snug">{periodBilan.action_prioritaire}</p>
                              </div>
                            )}
                            {periodBilan.points_forts?.length > 0 && (
                              <div className="bg-green-50 rounded-xl p-4 border-l-4 border-green-500">
                                <div className="flex items-center gap-2 mb-3">
                                  <TrendingUp className="w-5 h-5 text-green-600" />
                                  <h3 className="font-bold text-green-900">👍 Points forts</h3>
                                </div>
                                <ul className="space-y-2">
                                  {periodBilan.points_forts.map((p, i) => (
                                    <li key={i} className="flex items-start gap-2">
                                      <span className="text-green-600 mt-1">✓</span>
                                      <span className="text-gray-700">{p}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {periodBilan.points_attention?.length > 0 && (
                              <div className="bg-orange-50 rounded-xl p-4 border-l-4 border-orange-500">
                                <div className="flex items-center gap-2 mb-3">
                                  <AlertTriangle className="w-5 h-5 text-orange-600" />
                                  <h3 className="font-bold text-orange-900">⚠️ Points à améliorer</h3>
                                </div>
                                <ul className="space-y-2">
                                  {periodBilan.points_attention.map((p, i) => (
                                    <li key={i} className="flex items-start gap-2">
                                      <span className="text-orange-600 mt-1">!</span>
                                      <span className="text-gray-700">{p}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {periodBilan.recommandations?.length > 0 && (
                              <div className="bg-indigo-50 rounded-xl p-4 border-l-4 border-indigo-500">
                                <div className="flex items-center gap-2 mb-3">
                                  <Target className="w-5 h-5 text-indigo-600" />
                                  <h3 className="font-bold text-indigo-900">🎯 Recommandations</h3>
                                </div>
                                <ol className="space-y-2 list-decimal list-inside">
                                  {periodBilan.recommandations.map((r, i) => (
                                    <li key={i} className="text-gray-700">{r}</li>
                                  ))}
                                </ol>
                              </div>
                            )}
                          </div>
                        )}

                        {!periodBilan?.synthese && !periodGenerating && (
                          <div className="text-center py-8 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                            <Sparkles className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                            <p className="text-gray-600 mb-4">Aucune analyse IA pour cette période</p>
                            <button
                              onClick={generatePeriodBilan}
                              disabled={periodLoading}
                              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50"
                            >
                              ✨ Générer l'analyse IA
                            </button>
                          </div>
                        )}
                      </div>}
                    </>
                  ) : (
                    <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                      <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-600">Aucune donnée saisie pour cette période</p>
                    </div>
                  )
                )}

                {/* === VUE SEMAINE (comportement actuel) === */}
                {viewMode === 'semaine' ? (
                  <>
                    {/* KPI Summary — from bilanData if available */}
                    {bilanData?.kpi_resume && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                        {bilanData.kpi_resume?.ca_total !== undefined && (
                          <div className="bg-blue-50 rounded-lg p-3">
                            <p className="text-xs text-blue-600 mb-1">💰 CA</p>
                            <p className="text-lg font-bold text-blue-900">{bilanData.kpi_resume.ca_total.toFixed(0)}€</p>
                          </div>
                        )}
                        {bilanData.kpi_resume?.ventes !== undefined && (
                          <div className="bg-green-50 rounded-lg p-3">
                            <p className="text-xs text-green-600 mb-1">🛒 Ventes</p>
                            <p className="text-lg font-bold text-green-900">{bilanData.kpi_resume.ventes}</p>
                          </div>
                        )}
                        {bilanData.kpi_resume?.articles !== undefined && (
                          <div className="bg-orange-50 rounded-lg p-3">
                            <p className="text-xs text-orange-600 mb-1">📦 Articles</p>
                            <p className="text-lg font-bold text-orange-900">{bilanData.kpi_resume.articles}</p>
                          </div>
                        )}
                        {bilanData.kpi_resume?.panier_moyen !== undefined && (
                          <div className="bg-indigo-50 rounded-lg p-3">
                            <p className="text-xs text-indigo-600 mb-1">💳 P. Moyen</p>
                            <p className="text-lg font-bold text-indigo-900">{bilanData.kpi_resume.panier_moyen.toFixed(0)}€</p>
                          </div>
                        )}
                        {bilanData.kpi_resume?.indice_vente > 0 && (
                          <div className="bg-teal-50 rounded-lg p-3">
                            <p className="text-xs text-teal-600 mb-1">🎯 Ind. Vente</p>
                            <p className="text-lg font-bold text-teal-900">{bilanData.kpi_resume.indice_vente.toFixed(2)}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Détail journalier semaine — depuis periodEntries (fetchés via API) */}
                    {periodLoading ? (
                      <div className="flex items-center gap-2 py-4 text-gray-500 text-sm">
                        <div className="w-4 h-4 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
                        Chargement du détail...
                      </div>
                    ) : periodEntries.length > 0 ? (
                      <div className="mb-6">
                        <h3 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
                          <BarChart3 className="w-4 h-4 text-gray-500" />
                          📋 Détail par journée
                        </h3>
                        <div className="overflow-x-auto rounded-xl border border-gray-200">
                          <table className="w-full text-sm">
                            <thead className="bg-gray-100">
                              <tr>
                                <th className="text-left px-3 py-2 text-gray-600 font-semibold">Date</th>
                                {(kpiConfig?.track_ca ?? true) && <th className="text-right px-3 py-2 text-blue-700 font-semibold">💰 CA</th>}
                                {(kpiConfig?.track_ventes ?? true) && <th className="text-right px-3 py-2 text-green-700 font-semibold">🛒 Ventes</th>}
                                {(kpiConfig?.track_articles ?? true) && <th className="text-right px-3 py-2 text-orange-700 font-semibold">📦 Articles</th>}
                                {(kpiConfig?.track_prospects ?? true) && <th className="text-right px-3 py-2 text-purple-700 font-semibold">🚶 Prospects</th>}
                                {(kpiConfig?.track_ca ?? true) && (kpiConfig?.track_ventes ?? true) && <th className="text-right px-3 py-2 text-indigo-700 font-semibold">💳 P.Moyen</th>}
                                {(kpiConfig?.track_articles ?? true) && (kpiConfig?.track_ventes ?? true) && <th className="text-right px-3 py-2 text-teal-700 font-semibold">🎯 IV</th>}
                              </tr>
                            </thead>
                            <tbody>
                              {periodEntries.map((entry, i) => {
                                const pm = entry.nb_ventes > 0 ? entry.ca_journalier / entry.nb_ventes : 0;
                                const iv = entry.nb_ventes > 0 ? entry.nb_articles / entry.nb_ventes : 0;
                                return (
                                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                    <td className="px-3 py-2 text-gray-700 font-medium">{new Date(entry.date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}</td>
                                    {(kpiConfig?.track_ca ?? true) && <td className="text-right px-3 py-2 text-blue-900 font-semibold">{entry.ca_journalier != null ? `${entry.ca_journalier.toFixed(0)}€` : '—'}</td>}
                                    {(kpiConfig?.track_ventes ?? true) && <td className="text-right px-3 py-2 text-green-900">{entry.nb_ventes ?? '—'}</td>}
                                    {(kpiConfig?.track_articles ?? true) && <td className="text-right px-3 py-2 text-orange-900">{entry.nb_articles ?? '—'}</td>}
                                    {(kpiConfig?.track_prospects ?? true) && <td className="text-right px-3 py-2 text-purple-900">{entry.nb_prospects ?? '—'}</td>}
                                    {(kpiConfig?.track_ca ?? true) && (kpiConfig?.track_ventes ?? true) && <td className="text-right px-3 py-2 text-indigo-900">{pm > 0 ? `${pm.toFixed(0)}€` : '—'}</td>}
                                    {(kpiConfig?.track_articles ?? true) && (kpiConfig?.track_ventes ?? true) && <td className="text-right px-3 py-2 text-teal-900">{entry.nb_ventes > 0 ? iv.toFixed(2) : '—'}</td>}
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 mb-4">Aucune saisie pour cette semaine.</p>
                    )}

                    {/* Charts */}
                    {chartData && chartData.length > 0 && (
                      <div className="mb-6">
                        <div className="flex items-center gap-2 mb-4">
                          <BarChart3 className="w-5 h-5 text-blue-600" />
                          <h3 className="font-bold text-gray-800">📊 Évolution de la semaine</h3>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          {chartData.some(d => d.CA !== undefined) && (
                            <div className="bg-blue-50 rounded-xl p-4">
                              <h4 className="text-sm font-semibold text-blue-900 mb-3">💰 Évolution du CA</h4>
                              <ResponsiveContainer width="100%" height={180}>
                                <LineChart data={chartData}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" />
                                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#1e40af' }} stroke="#3b82f6" />
                                  <YAxis tick={{ fontSize: 11, fill: '#1e40af' }} stroke="#3b82f6" />
                                  <Tooltip contentStyle={{ backgroundColor: '#eff6ff', border: '2px solid #3b82f6', borderRadius: '8px' }} />
                                  <Line type="monotone" dataKey="CA" stroke="#3b82f6" strokeWidth={3} dot={{ fill: '#1e40af', r: 4 }} />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          )}

                          {chartData.some(d => d.Ventes !== undefined) && (
                            <div className="bg-green-50 rounded-xl p-4">
                              <h4 className="text-sm font-semibold text-green-900 mb-3">🛒 Évolution des Ventes</h4>
                              <ResponsiveContainer width="100%" height={180}>
                                <BarChart data={chartData}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#d1fae5" />
                                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#065f46' }} stroke="#10b981" />
                                  <YAxis tick={{ fontSize: 11, fill: '#065f46' }} stroke="#10b981" />
                                  <Tooltip contentStyle={{ backgroundColor: '#d1fae5', border: '2px solid #10b981', borderRadius: '8px' }} />
                                  <Bar dataKey="Ventes" fill="#10b981" radius={[8, 8, 0, 0]} />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          )}

                          {chartData.some(d => d.Articles !== undefined) && (
                            <div className="bg-orange-50 rounded-xl p-4">
                              <h4 className="text-sm font-semibold text-orange-900 mb-3">📦 Évolution des Articles</h4>
                              <ResponsiveContainer width="100%" height={180}>
                                <BarChart data={chartData}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#fed7aa" />
                                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9a3412' }} stroke="#f97316" />
                                  <YAxis tick={{ fontSize: 11, fill: '#9a3412' }} stroke="#f97316" />
                                  <Tooltip contentStyle={{ backgroundColor: '#ffedd5', border: '2px solid #f97316', borderRadius: '8px' }} />
                                  <Bar dataKey="Articles" fill="#f97316" radius={[8, 8, 0, 0]} />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          )}

                          {chartData.some(d => d.Prospects !== undefined) && (
                            <div className="bg-purple-50 rounded-xl p-4">
                              <h4 className="text-sm font-semibold text-purple-900 mb-3">🚶 Évolution des Prospects</h4>
                              <ResponsiveContainer width="100%" height={180}>
                                <LineChart data={chartData}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#e9d5ff" />
                                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#581c87' }} stroke="#a855f7" />
                                  <YAxis tick={{ fontSize: 11, fill: '#581c87' }} stroke="#a855f7" />
                                  <Tooltip contentStyle={{ backgroundColor: '#f3e8ff', border: '2px solid #a855f7', borderRadius: '8px' }} />
                                  <Line type="monotone" dataKey="Prospects" stroke="#a855f7" strokeWidth={3} dot={{ fill: '#7c3aed', r: 4 }} />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Animation de génération élaborée */}
                    {generatingBilan && (
                      <div className="bg-white rounded-2xl p-8 max-w-md mx-auto shadow-2xl border-2 border-blue-200">
                        <div className="text-center mb-6">
                          <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center animate-pulse">
                            <Sparkles className="w-10 h-10 text-white" />
                          </div>
                          <h3 className="text-2xl font-bold text-gray-800 mb-2">
                            Analyse en cours...
                          </h3>
                          <p className="text-gray-600">
                            L'IA analyse vos performances de la semaine et prépare votre bilan personnalisé
                          </p>
                        </div>

                        {/* Progress Bar */}
                        <div className="relative w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="absolute inset-0 bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-500"
                            style={{
                              animation: 'progress-slide 2s ease-in-out infinite',
                              backgroundSize: '200% 100%'
                            }}
                          ></div>
                        </div>

                        <div className="mt-4 text-center text-sm text-gray-500">
                          <p>⏱️ Temps estimé : 30-60 secondes</p>
                        </div>
                      </div>
                    )}

                    {/* Analyse IA */}
                    {bilanData?.synthese && !generatingBilan && (
                      <div ref={bilanSectionRef} className="space-y-4">
                        <div className="bg-blue-50 rounded-xl p-4 border-l-4 border-blue-500">
                          <div className="flex items-start gap-2 mb-2">
                            <Sparkles className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                            <h3 className="font-bold text-blue-900">💡 Synthèse de la semaine</h3>
                          </div>
                          <p className="text-gray-700 leading-relaxed">{bilanData.synthese}</p>
                        </div>

                        {bilanData.action_prioritaire && (
                          <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-xl p-4 text-white shadow-lg">
                            <div className="flex items-center gap-2 mb-1">
                              <Target className="w-5 h-5 flex-shrink-0" />
                              <h3 className="font-bold text-sm uppercase tracking-wide">🎯 Action prioritaire</h3>
                            </div>
                            <p className="text-lg font-semibold leading-snug">{bilanData.action_prioritaire}</p>
                          </div>
                        )}

                        {bilanData.points_forts && bilanData.points_forts.length > 0 && (
                          <div className="bg-green-50 rounded-xl p-4 border-l-4 border-green-500">
                            <div className="flex items-center gap-2 mb-3">
                              <TrendingUp className="w-5 h-5 text-green-600" />
                              <h3 className="font-bold text-green-900">👍 Tes points forts</h3>
                            </div>
                            <ul className="space-y-2">
                              {bilanData.points_forts.map((point, idx) => (
                                <li key={idx} className="flex items-start gap-2">
                                  <span className="text-green-600 mt-1">✓</span>
                                  <span className="text-gray-700">{point}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {bilanData.points_attention && bilanData.points_attention.length > 0 && (
                          <div className="bg-orange-50 rounded-xl p-4 border-l-4 border-orange-500">
                            <div className="flex items-center gap-2 mb-3">
                              <AlertTriangle className="w-5 h-5 text-orange-600" />
                              <h3 className="font-bold text-orange-900">⚠️ Points à améliorer</h3>
                            </div>
                            <ul className="space-y-2">
                              {bilanData.points_attention.map((point, idx) => (
                                <li key={idx} className="flex items-start gap-2">
                                  <span className="text-orange-600 mt-1">!</span>
                                  <span className="text-gray-700">{point}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {bilanData.recommandations && bilanData.recommandations.length > 0 && (
                          <div className="bg-indigo-50 rounded-xl p-4 border-l-4 border-indigo-500">
                            <div className="flex items-center gap-2 mb-3">
                              <Target className="w-5 h-5 text-indigo-600" />
                              <h3 className="font-bold text-indigo-900">🎯 Recommandations personnalisées</h3>
                            </div>
                            <ol className="space-y-2 list-decimal list-inside">
                              {bilanData.recommandations.map((reco, idx) => (
                                <li key={idx} className="text-gray-700">{reco}</li>
                              ))}
                            </ol>
                          </div>
                        )}
                      </div>
                    )}

                    {!bilanData?.synthese && !generatingBilan && (
                      <div className="text-center py-8 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                        <Sparkles className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                        <p className="text-gray-600 mb-4">Aucune analyse IA disponible pour cette semaine</p>
                        {onRegenerate && (
                          <button
                            onClick={onRegenerate}
                            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-md hover:shadow-lg"
                          >
                            ✨ Générer l'analyse IA
                          </button>
                        )}
                      </div>
                    )}
                  </>
                ) : null}
              </div>
            </div>
  );
}
