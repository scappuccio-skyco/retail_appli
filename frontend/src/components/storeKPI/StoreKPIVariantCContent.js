/**
 * StoreKPIVariantCContent — Style C "Analytics View"
 * Présentation différente :
 * - Insight IA épinglé tout en haut (carte visible sans cliquer)
 * - Graphiques en premier plan dès l'ouverture (pas cachés derrière un toggle)
 * - KPIs compacts en ligne au-dessus des graphiques
 * - Filtres graphiques intégrés directement
 * - Tableau de données condensé en bas
 */
import React, { useState } from 'react';
import { Zap, RefreshCw, TrendingUp, TrendingDown, ChevronLeft, ChevronRight } from 'lucide-react';
import ManagerAIAnalysisDisplay from '../ManagerAIAnalysisDisplay';
import {
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { formatChartDate, computePeriodTotals } from './storeKPIUtils';

/* ─── KPI compact ─── */
function KpiPill({ label, value, color = 'text-gray-900' }) {
  return (
    <div className="flex flex-col items-center px-4 py-2 bg-white/80 rounded-xl border border-gray-100">
      <span className={`text-lg font-bold ${color}`}>{value}</span>
      <span className="text-xs text-gray-400 mt-0.5">{label}</span>
    </div>
  );
}


/* ─── Vue Journalière ─── */
function DailyView({ overviewData }) {
  const totals = overviewData?.totals ?? {};
  const kpis = overviewData?.calculated_kpis ?? {};
  const ca = totals.ca ?? 0;
  const ventes = totals.ventes ?? 0;
  const tauxTransfo = kpis.taux_transformation ?? null;
  const panierMoyen = kpis.panier_moyen ?? null;
  const indiceVente = kpis.indice_vente ?? null;
  const sellerEntries = overviewData?.seller_entries ?? [];

  return (
    <div className="space-y-5">
      {/* KPIs en ligne */}
      <div className="flex gap-3 flex-wrap">
        <KpiPill label="CA" value={`${ca.toFixed(0)} €`} color="text-blue-600" />
        <KpiPill label="Ventes" value={ventes} color="text-emerald-600" />
        <KpiPill label="Transfo" value={tauxTransfo !== null ? `${parseFloat(tauxTransfo).toFixed(2)}%` : '—'} color="text-purple-600" />
        <KpiPill label="Panier" value={panierMoyen !== null ? `${parseFloat(panierMoyen).toFixed(2)} €` : '—'} color="text-orange-600" />
        <KpiPill label="UPT" value={indiceVente !== null ? parseFloat(indiceVente).toFixed(2) : '—'} color="text-pink-600" />
      </div>

      {/* Tableau vendeurs — version analytics (barres de progression + ranking) */}
      {sellerEntries.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700">Performance vendeurs</span>
            <span className="text-xs text-gray-400">{sellerEntries.length} vendeurs</span>
          </div>
          <div className="divide-y divide-gray-50">
            {(() => {
              const sorted = [...sellerEntries].sort((a, b) => (b.seller_ca || b.ca_journalier || 0) - (a.seller_ca || a.ca_journalier || 0));
              const maxCa = sorted[0]?.seller_ca || sorted[0]?.ca_journalier || 1;
              return sorted.map((entry, idx) => {
                const sellerCa = entry.seller_ca || entry.ca_journalier || 0;
                const pct = maxCa > 0 ? Math.round((sellerCa / maxCa) * 100) : 0;
                const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-orange-400', 'bg-pink-400'];
                return (
                  <div key={entry.seller_id || idx} className="px-4 py-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-400 w-4">#{idx + 1}</span>
                        <span className="text-sm font-medium text-gray-800">{entry.seller_name || `Vendeur ${idx + 1}`}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-500">{entry.nb_ventes || 0} ventes</span>
                        <span className="text-sm font-bold text-gray-900">{sellerCa.toFixed(0)} €</span>
                      </div>
                    </div>
                    <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full ${colors[idx % colors.length]} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Vue Période ─── */
function PeriodView({ historicalData, viewMode, loadingHistorical }) {
  const [activeChart, setActiveChart] = useState(0);

  if (loadingHistorical) return <div className="text-center py-12 text-gray-400">⏳ Chargement...</div>;
  if (!historicalData.length) return <div className="text-center py-12 text-gray-400">📭 Aucune donnée pour cette période</div>;

  const totals = computePeriodTotals(historicalData);

  const chartDefs = [
    {
      label: 'Chiffre d\'Affaires', dot: 'bg-blue-500',
      chart: (
        <BarChart data={historicalData} barSize={viewMode === 'year' ? 8 : 16}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={formatChartDate} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
          <Tooltip formatter={(v) => [`${v} €`, 'CA']} labelFormatter={formatChartDate} />
          <Bar dataKey="total_ca" fill="#3B82F6" radius={[4, 4, 0, 0]} />
        </BarChart>
      ),
    },
    {
      label: 'Nombre de Ventes', dot: 'bg-emerald-500',
      chart: (
        <BarChart data={historicalData} barSize={viewMode === 'year' ? 8 : 16}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={formatChartDate} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
          <Tooltip formatter={(v) => [v, 'Ventes']} labelFormatter={formatChartDate} />
          <Bar dataKey="total_ventes" fill="#10B981" radius={[4, 4, 0, 0]} />
        </BarChart>
      ),
    },
    {
      label: 'Taux de Transformation', dot: 'bg-purple-500',
      chart: (
        <BarChart data={historicalData} barSize={viewMode === 'year' ? 8 : 16}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={formatChartDate} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10 }} unit="%" axisLine={false} tickLine={false} />
          <Tooltip formatter={(v) => [`${v}%`, 'Transfo']} labelFormatter={formatChartDate} />
          <Bar dataKey="taux_transformation" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
        </BarChart>
      ),
    },
  ];

  const current = chartDefs[activeChart];
  const prev = () => setActiveChart(i => (i - 1 + chartDefs.length) % chartDefs.length);
  const next = () => setActiveChart(i => (i + 1) % chartDefs.length);

  return (
    <div className="space-y-5">
      {/* KPIs compacts */}
      <div className="flex gap-3 flex-wrap">
        <KpiPill label="CA total" value={`${(totals.total_ca || 0).toFixed(0)} €`} color="text-blue-600" />
        <KpiPill label="Ventes" value={totals.total_ventes || 0} color="text-emerald-600" />
        <KpiPill label="Panier moy." value={totals.total_ventes > 0 && totals.total_ca > 0 ? `${(totals.total_ca / totals.total_ventes).toFixed(0)} €` : '—'} color="text-orange-600" />
      </div>

      {/* Carrousel graphique */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${current.dot} inline-block`} />
            <span className="text-sm font-semibold text-gray-700">{current.label}</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Dots */}
            <div className="flex gap-1.5 mr-1">
              {chartDefs.map((_, i) => (
                <button key={i} onClick={() => setActiveChart(i)}
                  className={`w-2 h-2 rounded-full transition-all ${i === activeChart ? 'bg-gray-600 w-4' : 'bg-gray-200 hover:bg-gray-300'}`}
                />
              ))}
            </div>
            <button onClick={prev} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
              <ChevronLeft className="w-4 h-4 text-gray-500" />
            </button>
            <button onClick={next} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
              <ChevronRight className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          {current.chart}
        </ResponsiveContainer>
      </div>

      {/* Table condensée */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-gray-100">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Données détaillées</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-gray-500 font-medium">Date</th>
                <th className="px-4 py-2 text-right text-gray-500 font-medium">CA</th>
                <th className="px-4 py-2 text-right text-gray-500 font-medium">Ventes</th>
                <th className="px-4 py-2 text-right text-gray-500 font-medium">Panier</th>
                <th className="px-4 py-2 text-right text-gray-500 font-medium">Transfo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {historicalData.slice().reverse().map((d, i) => {
                const panier = d.total_ventes > 0 ? (d.total_ca / d.total_ventes).toFixed(0) : '—';
                const prevCa = i < historicalData.length - 1 ? historicalData[historicalData.length - 2 - i]?.total_ca : null;
                const isUp = prevCa !== null && d.total_ca > prevCa;
                const isDown = prevCa !== null && d.total_ca < prevCa;
                return (
                  <tr key={i} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2 text-gray-600">{formatChartDate(d.date)}</td>
                    <td className="px-4 py-2 text-right">
                      <span className="font-semibold text-gray-900">{(d.total_ca || 0).toFixed(0)} €</span>
                      {isUp && <TrendingUp className="inline-block w-3 h-3 text-emerald-500 ml-1" />}
                      {isDown && <TrendingDown className="inline-block w-3 h-3 text-red-400 ml-1" />}
                    </td>
                    <td className="px-4 py-2 text-right text-gray-700">{d.total_ventes || 0}</td>
                    <td className="px-4 py-2 text-right text-gray-700">{panier} {panier !== '—' ? '€' : ''}</td>
                    <td className="px-4 py-2 text-right text-gray-700">{d.taux_transformation > 0 ? `${parseFloat(d.taux_transformation).toFixed(2)}%` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 border-t border-gray-50 flex items-center gap-4 text-[11px] text-gray-400">
          <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3 text-emerald-500" /> CA en hausse vs veille</span>
          <span className="flex items-center gap-1"><TrendingDown className="w-3 h-3 text-red-400" /> CA en baisse vs veille</span>
        </div>
      </div>
    </div>
  );
}

/* ─── Composant principal ─── */
export default function StoreKPIVariantCContent({
  viewMode, overviewData, historicalData, loadingHistorical,
  aiAnalysis, aiGenerating, canLaunchAI, generateAnalysis, aiSectionRef,
}) {
  return (
    <div className="space-y-5">
      {/* Insight IA épinglé en haut */}
      <div ref={aiSectionRef}>
        {!aiAnalysis && !aiGenerating && (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-gray-400" />
              <p className="text-sm text-gray-500">Aucune analyse IA générée pour cette période</p>
            </div>
            <button onClick={generateAnalysis} disabled={!canLaunchAI} className="text-xs px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed font-medium">
              ✨ Analyser
            </button>
          </div>
        )}
        {aiGenerating && (
          <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 flex items-center gap-3">
            <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />
            <p className="text-sm text-blue-700 font-medium">Analyse IA en cours...</p>
          </div>
        )}
        {aiAnalysis && !aiGenerating && (
          <ManagerAIAnalysisDisplay
            analysis={aiAnalysis}
            onRegenerate={generateAnalysis}
            title="Analyse IA — KPIs Magasin"
            sources={['CA du jour', 'Ventes', 'Clients', 'Panier moyen', 'Taux de transformation', 'Indice de vente']}
          />
        )}
      </div>

      {/* Données */}
      {viewMode === 'day' ? (
        overviewData ? <DailyView overviewData={overviewData} /> : (
          <div className="text-center py-12 text-gray-400">⏳ Chargement...</div>
        )
      ) : (
        <PeriodView historicalData={historicalData} viewMode={viewMode} loadingHistorical={loadingHistorical} />
      )}
    </div>
  );
}
