import React from 'react';
import { BarChart3 } from 'lucide-react';
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
  return (
    <>
      {kpiEntries.length > 0 ? (
        <>
          {/* Controls: period filter + chart toggles */}
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
            {/* Chart toggles */}
            {Object.values(availableCharts).some(v => v) && (
              <div className="flex flex-wrap gap-1.5 pt-2 border-t border-gray-100">
                {[
                  { key: 'ca',             label: 'CA',        color: '#6366f1', avail: availableCharts.ca },
                  { key: 'ventes',         label: 'Ventes',    color: '#10b981', avail: availableCharts.ventes },
                  { key: 'clients',        label: 'Clients',   color: '#9333ea', avail: availableCharts.clients },
                  { key: 'articles',       label: 'Articles',  color: '#f59e0b', avail: availableCharts.articles },
                  { key: 'ventesVsClients',label: 'V vs C',    color: '#6366f1', avail: availableCharts.ventesVsClients },
                  { key: 'panierMoyen',    label: 'Panier',    color: '#14b8a6', avail: availableCharts.panierMoyen },
                  { key: 'tauxTransfo',    label: 'Transfo',   color: '#ec4899', avail: availableCharts.tauxTransfo },
                  { key: 'indiceVente',    label: 'Indice',    color: '#f97316', avail: availableCharts.indiceVente },
                ].filter(c => c.avail).map(({ key, label, color }) => (
                  <button
                    key={key}
                    onClick={() => setVisibleCharts(prev => ({ ...prev, [key]: !prev[key] }))}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all border ${
                      visibleCharts[key]
                        ? 'text-white border-transparent'
                        : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                    }`}
                    style={visibleCharts[key] ? { backgroundColor: color } : {}}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
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

          {/* Charts grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* CA */}
            {availableCharts.ca && visibleCharts.ca && (
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-center gap-1.5 mb-3">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block" />
                  <h3 className="text-xs font-bold text-gray-700">Chiffre d'affaires</h3>
                </div>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={(() => {
                    const fe = kpiFilter === '7j' ? kpiEntries.filter(e => new Date(e.date) >= new Date(Date.now() - 7*864e5))
                      : kpiFilter === '30j' ? kpiEntries.filter(e => new Date(e.date) >= new Date(Date.now() - 30*864e5)) : kpiEntries;
                    return fe.sort((a,b) => new Date(a.date)-new Date(b.date)).map(e => ({
                      date: new Date(e.date).toLocaleDateString('fr-FR', {day:'2-digit',month:'2-digit'}), CA: e.ca_journalier || 0
                    }));
                  })()}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '11px' }} formatter={v => `${v.toFixed(2)}€`} />
                    <Bar dataKey="CA" fill="#6366f1" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Ventes */}
            {availableCharts.ventes && visibleCharts.ventes && (
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-center gap-1.5 mb-3">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                  <h3 className="text-xs font-bold text-gray-700">Nombre de ventes</h3>
                </div>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={(() => {
                    const fe = kpiFilter === '7j' ? kpiEntries.filter(e => new Date(e.date) >= new Date(Date.now() - 7*864e5))
                      : kpiFilter === '30j' ? kpiEntries.filter(e => new Date(e.date) >= new Date(Date.now() - 30*864e5)) : kpiEntries;
                    return fe.sort((a,b) => new Date(a.date)-new Date(b.date)).map(e => ({
                      date: new Date(e.date).toLocaleDateString('fr-FR', {day:'2-digit',month:'2-digit'}), Ventes: e.nb_ventes || 0
                    }));
                  })()}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '11px' }} />
                    <Bar dataKey="Ventes" fill="#10b981" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Clients */}
            {availableCharts.clients && visibleCharts.clients && (
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-center gap-1.5 mb-3">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-500 inline-block" />
                  <h3 className="text-xs font-bold text-gray-700">Clients servis</h3>
                </div>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={(() => {
                    const fe = kpiFilter === '7j' ? kpiEntries.filter(e => new Date(e.date) >= new Date(Date.now() - 7*864e5))
                      : kpiFilter === '30j' ? kpiEntries.filter(e => new Date(e.date) >= new Date(Date.now() - 30*864e5)) : kpiEntries;
                    return fe.sort((a,b) => new Date(a.date)-new Date(b.date)).map(e => ({
                      date: new Date(e.date).toLocaleDateString('fr-FR', {day:'2-digit',month:'2-digit'}), Clients: e.nb_clients || 0
                    }));
                  })()}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '11px' }} />
                    <Bar dataKey="Clients" fill="#9333ea" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Articles */}
            {availableCharts.articles && visibleCharts.articles && (
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-center gap-1.5 mb-3">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                  <h3 className="text-xs font-bold text-gray-700">Articles vendus</h3>
                </div>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={(() => {
                    const fe = kpiFilter === '7j' ? kpiEntries.filter(e => new Date(e.date) >= new Date(Date.now() - 7*864e5))
                      : kpiFilter === '30j' ? kpiEntries.filter(e => new Date(e.date) >= new Date(Date.now() - 30*864e5)) : kpiEntries;
                    return fe.sort((a,b) => new Date(a.date)-new Date(b.date)).map(e => ({
                      date: new Date(e.date).toLocaleDateString('fr-FR', {day:'2-digit',month:'2-digit'}), Articles: e.nb_articles || 0
                    }));
                  })()}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '11px' }} />
                    <Bar dataKey="Articles" fill="#f59e0b" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Ventes vs Clients */}
            {availableCharts.ventesVsClients && visibleCharts.ventesVsClients && (
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-center gap-1.5 mb-3">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 inline-block" />
                  <h3 className="text-xs font-bold text-gray-700">Ventes vs Clients</h3>
                </div>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={(() => {
                    const fe = kpiFilter === '7j' ? kpiEntries.filter(e => new Date(e.date) >= new Date(Date.now() - 7*864e5))
                      : kpiFilter === '30j' ? kpiEntries.filter(e => new Date(e.date) >= new Date(Date.now() - 30*864e5)) : kpiEntries;
                    return fe.sort((a,b) => new Date(a.date)-new Date(b.date)).map(e => ({
                      date: new Date(e.date).toLocaleDateString('fr-FR', {day:'2-digit',month:'2-digit'}),
                      Ventes: e.nb_ventes || 0, Clients: e.nb_clients || 0
                    }));
                  })()}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '11px' }} />
                    <Legend wrapperStyle={{ fontSize: '10px' }} />
                    <Bar dataKey="Ventes" fill="#fbbf24" radius={[4,4,0,0]} />
                    <Bar dataKey="Clients" fill="#93c5fd" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Panier Moyen */}
            {availableCharts.panierMoyen && visibleCharts.panierMoyen && (
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-center gap-1.5 mb-3">
                  <span className="w-2.5 h-2.5 rounded-full bg-teal-500 inline-block" />
                  <h3 className="text-xs font-bold text-gray-700">Panier Moyen</h3>
                </div>
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={(() => {
                    const fe = kpiFilter === '7j' ? kpiEntries.filter(e => new Date(e.date) >= new Date(Date.now() - 7*864e5))
                      : kpiFilter === '30j' ? kpiEntries.filter(e => new Date(e.date) >= new Date(Date.now() - 30*864e5)) : kpiEntries;
                    return fe.sort((a,b) => new Date(a.date)-new Date(b.date)).map(e => ({
                      date: new Date(e.date).toLocaleDateString('fr-FR', {day:'2-digit',month:'2-digit'}),
                      PanierMoyen: e.nb_ventes > 0 ? (e.ca_journalier / e.nb_ventes) : 0
                    }));
                  })()}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '11px' }} formatter={v => `${v.toFixed(2)}€`} />
                    <Line type="monotone" dataKey="PanierMoyen" stroke="#14b8a6" strokeWidth={2} dot={{ r: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Taux Transformation */}
            {availableCharts.tauxTransfo && visibleCharts.tauxTransfo && (
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-center gap-1.5 mb-3">
                  <span className="w-2.5 h-2.5 rounded-full bg-pink-500 inline-block" />
                  <h3 className="text-xs font-bold text-gray-700">Taux Transformation</h3>
                </div>
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={(() => {
                    const fe = kpiFilter === '7j' ? kpiEntries.filter(e => new Date(e.date) >= new Date(Date.now() - 7*864e5))
                      : kpiFilter === '30j' ? kpiEntries.filter(e => new Date(e.date) >= new Date(Date.now() - 30*864e5)) : kpiEntries;
                    return fe.sort((a,b) => new Date(a.date)-new Date(b.date)).map(e => ({
                      date: new Date(e.date).toLocaleDateString('fr-FR', {day:'2-digit',month:'2-digit'}),
                      TauxTransfo: e.taux_transformation || 0
                    }));
                  })()}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '11px' }} formatter={v => `${v.toFixed(2)}%`} />
                    <Line type="monotone" dataKey="TauxTransfo" stroke="#ec4899" strokeWidth={2} dot={{ r: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Indice de Vente */}
            {availableCharts.indiceVente && visibleCharts.indiceVente && (
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-center gap-1.5 mb-3">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block" />
                  <h3 className="text-xs font-bold text-gray-700">Indice de Vente</h3>
                </div>
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={(() => {
                    const fe = kpiFilter === '7j' ? kpiEntries.filter(e => new Date(e.date) >= new Date(Date.now() - 7*864e5))
                      : kpiFilter === '30j' ? kpiEntries.filter(e => new Date(e.date) >= new Date(Date.now() - 30*864e5)) : kpiEntries;
                    return fe.sort((a,b) => new Date(a.date)-new Date(b.date)).map(e => ({
                      date: new Date(e.date).toLocaleDateString('fr-FR', {day:'2-digit',month:'2-digit'}),
                      IndiceVente: e.indice_vente !== undefined && e.indice_vente !== null
                        ? e.indice_vente
                        : (e.nb_ventes > 0 ? (e.nb_articles / e.nb_ventes) : 0)
                    }));
                  })()}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '11px' }} formatter={v => v.toFixed(2)} />
                    <Line type="monotone" dataKey="IndiceVente" stroke="#f97316" strokeWidth={2} dot={{ r: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
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
