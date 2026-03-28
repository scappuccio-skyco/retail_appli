import React, { useState } from 'react';
import { BarChart3, ChevronLeft, ChevronRight } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

export default function KpiTab({
  kpiEntries,
  kpiMetrics,
  kpiFilter,
  setKpiFilter,
  visibleCharts,
  setVisibleCharts,
  availableCharts,
  isTrack,
}) {
  const [activeChart, setActiveChart] = useState(0);

  const getFilteredEntries = () => {
    const fe = kpiFilter === '7j' ? kpiEntries.filter(e => new Date(e.date) >= new Date(Date.now() - 7*864e5))
      : kpiFilter === '30j' ? kpiEntries.filter(e => new Date(e.date) >= new Date(Date.now() - 30*864e5)) : kpiEntries;
    return fe.sort((a, b) => new Date(a.date) - new Date(b.date));
  };

  const fmtDate = e => new Date(e.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
  const tooltipStyle = { backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '11px' };
  const axisStyle = { fill: '#94a3b8', fontSize: 10 };

  const chartDefs = [
    availableCharts.ca && {
      label: "Chiffre d'affaires",
      dot: 'bg-indigo-500',
      content: (
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={getFilteredEntries().map(e => ({ date: fmtDate(e), CA: e.ca_journalier || 0 }))}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="date" tick={axisStyle} />
            <YAxis tick={axisStyle} />
            <Tooltip contentStyle={tooltipStyle} formatter={v => `${v.toFixed(2)}€`} />
            <Bar dataKey="CA" fill="#6366f1" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      ),
    },
    availableCharts.ventes && {
      label: 'Nombre de ventes',
      dot: 'bg-emerald-500',
      content: (
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={getFilteredEntries().map(e => ({ date: fmtDate(e), Ventes: e.nb_ventes || 0 }))}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="date" tick={axisStyle} />
            <YAxis tick={axisStyle} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="Ventes" fill="#10b981" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      ),
    },
    availableCharts.clients && {
      label: 'Clients servis',
      dot: 'bg-purple-500',
      content: (
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={getFilteredEntries().map(e => ({ date: fmtDate(e), Clients: e.nb_clients || 0 }))}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="date" tick={axisStyle} />
            <YAxis tick={axisStyle} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="Clients" fill="#9333ea" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      ),
    },
    availableCharts.articles && {
      label: 'Articles vendus',
      dot: 'bg-amber-500',
      content: (
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={getFilteredEntries().map(e => ({ date: fmtDate(e), Articles: e.nb_articles || 0 }))}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="date" tick={axisStyle} />
            <YAxis tick={axisStyle} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="Articles" fill="#f59e0b" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      ),
    },
    availableCharts.ventesVsClients && {
      label: 'Ventes vs Clients',
      dot: 'bg-blue-400',
      content: (
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={getFilteredEntries().map(e => ({ date: fmtDate(e), Ventes: e.nb_ventes || 0, Clients: e.nb_clients || 0 }))}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="date" tick={axisStyle} />
            <YAxis tick={axisStyle} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: '10px' }} />
            <Bar dataKey="Ventes" fill="#fbbf24" radius={[4,4,0,0]} />
            <Bar dataKey="Clients" fill="#93c5fd" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      ),
    },
    availableCharts.panierMoyen && {
      label: 'Panier Moyen',
      dot: 'bg-teal-500',
      content: (
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={getFilteredEntries().map(e => ({
            date: fmtDate(e),
            PanierMoyen: e.nb_ventes > 0 ? (e.ca_journalier / e.nb_ventes) : 0
          }))}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="date" tick={axisStyle} />
            <YAxis tick={axisStyle} />
            <Tooltip contentStyle={tooltipStyle} formatter={v => `${v.toFixed(2)}€`} />
            <Line type="monotone" dataKey="PanierMoyen" stroke="#14b8a6" strokeWidth={2} dot={{ r: 2 }} />
          </LineChart>
        </ResponsiveContainer>
      ),
    },
    availableCharts.tauxTransfo && {
      label: 'Taux Transformation',
      dot: 'bg-pink-500',
      content: (
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={getFilteredEntries().map(e => ({
            date: fmtDate(e),
            TauxTransfo: e.taux_transformation || 0
          }))}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="date" tick={axisStyle} />
            <YAxis tick={axisStyle} />
            <Tooltip contentStyle={tooltipStyle} formatter={v => `${v.toFixed(2)}%`} />
            <Line type="monotone" dataKey="TauxTransfo" stroke="#ec4899" strokeWidth={2} dot={{ r: 2 }} />
          </LineChart>
        </ResponsiveContainer>
      ),
    },
    availableCharts.indiceVente && {
      label: 'Indice de Vente',
      dot: 'bg-orange-500',
      content: (
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={getFilteredEntries().map(e => ({
            date: fmtDate(e),
            IndiceVente: e.indice_vente !== undefined && e.indice_vente !== null
              ? e.indice_vente
              : (e.nb_ventes > 0 ? (e.nb_articles / e.nb_ventes) : 0)
          }))}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="date" tick={axisStyle} />
            <YAxis tick={axisStyle} />
            <Tooltip contentStyle={tooltipStyle} formatter={v => v.toFixed(2)} />
            <Line type="monotone" dataKey="IndiceVente" stroke="#f97316" strokeWidth={2} dot={{ r: 2 }} />
          </LineChart>
        </ResponsiveContainer>
      ),
    },
  ].filter(Boolean);

  return (
    <>
      {kpiEntries.length > 0 ? (
        <>
          {/* Controls: period filter */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide">Période</h3>
              <div className="flex gap-1">
                {['7j', '30j', 'tout'].map(f => (
                  <button
                    key={f}
                    onClick={() => setKpiFilter(f)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                      kpiFilter === f ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {f === 'tout' ? 'Tout' : f}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* KPI metric cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {isTrack('ca') && (
              <div className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100 text-center">
                <p className="text-[10px] font-medium text-gray-400 mb-1 uppercase tracking-wide">CA Total</p>
                <p className="text-lg font-bold text-indigo-600">{(kpiMetrics?.ca ?? 0).toFixed(2)}€</p>
              </div>
            )}
            {isTrack('ventes') && (
              <div className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100 text-center">
                <p className="text-[10px] font-medium text-gray-400 mb-1 uppercase tracking-wide">Ventes</p>
                <p className="text-lg font-bold text-emerald-600">{kpiMetrics?.ventes ?? 0}</p>
              </div>
            )}
            {isTrack('prospects') && (
              <div className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100 text-center">
                <p className="text-[10px] font-medium text-gray-400 mb-1 uppercase tracking-wide">Prospects</p>
                <p className="text-lg font-bold text-purple-600">{kpiMetrics?.prospects ?? 0}</p>
              </div>
            )}
            {isTrack('ca') && isTrack('ventes') && (
              <div className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100 text-center">
                <p className="text-[10px] font-medium text-gray-400 mb-1 uppercase tracking-wide">Panier Moy.</p>
                <p className="text-lg font-bold text-orange-500">{(kpiMetrics?.panier_moyen ?? 0).toFixed(2)}€</p>
              </div>
            )}
            {isTrack('ca') && isTrack('ventes') && isTrack('articles') && (
              <div className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100 text-center">
                <p className="text-[10px] font-medium text-gray-400 mb-1 uppercase tracking-wide">Indice Vente</p>
                <p className="text-lg font-bold text-amber-600">{(kpiMetrics?.indice_vente ?? 0).toFixed(2)}</p>
              </div>
            )}
          </div>

          {/* Charts carousel */}
          {chartDefs.length > 0 && (() => {
            const active = chartDefs[activeChart % chartDefs.length];
            const prev = () => setActiveChart(i => (i - 1 + chartDefs.length) % chartDefs.length);
            const next = () => setActiveChart(i => (i + 1) % chartDefs.length);
            return (
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2.5 h-2.5 rounded-full ${active.dot} inline-block`} />
                    <h3 className="text-xs font-bold text-gray-700">{active.label}</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1.5">
                      {chartDefs.map((_, i) => (
                        <button key={i} onClick={() => setActiveChart(i)}
                          className={`h-2 rounded-full transition-all ${i === (activeChart % chartDefs.length) ? 'bg-gray-600 w-4' : 'bg-gray-200 w-2 hover:bg-gray-300'}`}
                        />
                      ))}
                    </div>
                    <button onClick={prev} className="p-1 rounded-lg hover:bg-gray-100 transition-colors"><ChevronLeft className="w-4 h-4 text-gray-500" /></button>
                    <button onClick={next} className="p-1 rounded-lg hover:bg-gray-100 transition-colors"><ChevronRight className="w-4 h-4 text-gray-500" /></button>
                  </div>
                </div>
                {active.content}
              </div>
            );
          })()}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <BarChart3 className="w-10 h-10 text-gray-200" />
          <p className="text-sm font-medium text-gray-400">Aucune donnée KPI disponible</p>
        </div>
      )}
    </>
  );
}
