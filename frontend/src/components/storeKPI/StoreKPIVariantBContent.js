/**
 * StoreKPIVariantBContent — Style B "Dashboard View"
 * Présentation différente des mêmes données :
 * - CA en hero avec grande typographie
 * - KPIs secondaires en ligne compacte avec badges
 * - Vendeurs en cartes (pas en tableau)
 * - Section IA toujours visible (carte amber)
 * - Pas de tabs : tout sur une seule page scrollable
 */
import React from 'react';
import { TrendingUp, TrendingDown, Minus, Users, ShoppingBag, BarChart2, Zap, RefreshCw } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { formatChartDate, computePeriodTotals } from './storeKPIUtils';

/* ─── Helpers ─── */
function Badge({ value, suffix = '' }) {
  if (value === null || value === undefined) return null;
  const isPos = value > 0;
  const isNeg = value < 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full ${isPos ? 'bg-emerald-100 text-emerald-700' : isNeg ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'}`}>
      {isPos ? <TrendingUp className="w-3 h-3" /> : isNeg ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
      {isPos ? '+' : ''}{value}{suffix}
    </span>
  );
}

function ProgressBar({ value, max, color = 'bg-blue-500' }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
      <div className={`h-full ${color} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
    </div>
  );
}

/* ─── Vue Journalière ─── */
function DailyView({ overviewData }) {
  const totals = overviewData?.totals ?? {};
  const kpis = overviewData?.calculated_kpis ?? {};
  const ca = totals.ca ?? 0;
  const ventes = totals.ventes ?? 0;
  const panierMoyen = kpis.panier_moyen ?? null;
  const tauxTransfo = kpis.taux_transformation ?? null;
  const indiceVente = kpis.indice_vente ?? null;
  const sellersReported = overviewData?.sellers_reported ?? 0;
  const totalSellers = overviewData?.total_sellers ?? 0;
  const sellerEntries = overviewData?.seller_entries ?? [];

  return (
    <div className="space-y-6">
      {/* Hero CA */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">CA Réalisé</p>
        <div className="flex items-end gap-3 mb-3">
          <span className="text-5xl font-bold text-gray-900 tracking-tight">{ca.toFixed(0)} €</span>
        </div>
        <ProgressBar value={sellersReported} max={totalSellers} color="bg-blue-500" />
        <p className="text-xs text-gray-400 mt-1.5">{sellersReported}/{totalSellers} vendeurs ont saisi leurs données</p>
      </div>

      {/* KPIs secondaires */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm text-center">
          <ShoppingBag className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
          <p className="text-2xl font-bold text-gray-900">{ventes}</p>
          <p className="text-xs text-gray-400 mt-0.5">Ventes</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm text-center">
          <BarChart2 className="w-5 h-5 text-blue-500 mx-auto mb-1" />
          <p className="text-2xl font-bold text-gray-900">{tauxTransfo !== null ? `${tauxTransfo}%` : '—'}</p>
          <p className="text-xs text-gray-400 mt-0.5">Transfo</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm text-center">
          <TrendingUp className="w-5 h-5 text-purple-500 mx-auto mb-1" />
          <p className="text-2xl font-bold text-gray-900">{panierMoyen !== null ? `${panierMoyen} €` : '—'}</p>
          <p className="text-xs text-gray-400 mt-0.5">Panier Moy.</p>
        </div>
      </div>

      {/* Vendeurs en cartes */}
      {sellerEntries.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Détails par vendeur</p>
          <div className="space-y-2">
            {sellerEntries.map((entry, idx) => {
              const sellerCa = entry.seller_ca || entry.ca_journalier || 0;
              const pct = ca > 0 ? Math.round((sellerCa / ca) * 100) : 0;
              const initials = (entry.seller_name || 'V').slice(0, 2).toUpperCase();
              return (
                <div key={entry.seller_id || idx} className="bg-white rounded-xl px-4 py-3 border border-gray-100 flex items-center gap-4">
                  <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600 flex-shrink-0">
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{entry.seller_name || `Vendeur ${idx + 1}`}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-400 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-gray-400 flex-shrink-0">{pct}%</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-gray-900">{sellerCa.toFixed(0)} €</p>
                    <p className="text-xs text-gray-400">{entry.nb_ventes || 0} ventes</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Vue Période ─── */
function PeriodView({ historicalData, viewMode, loadingHistorical }) {
  if (loadingHistorical) return <div className="text-center py-12 text-gray-400">⏳ Chargement...</div>;
  if (!historicalData.length) return <div className="text-center py-12 text-gray-400">📭 Aucune donnée pour cette période</div>;

  const totals = computePeriodTotals(historicalData);
  const avgTransfo = historicalData.filter(d => d.taux_transformation > 0).reduce((s, d) => s + d.taux_transformation, 0) / Math.max(1, historicalData.filter(d => d.taux_transformation > 0).length);

  return (
    <div className="space-y-6">
      {/* Totaux */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">CA Total Période</p>
        <p className="text-5xl font-bold text-gray-900 tracking-tight mb-3">{(totals.ca || 0).toFixed(0)} €</p>
        <div className="grid grid-cols-3 gap-4 pt-3 border-t border-gray-100">
          <div>
            <p className="text-lg font-bold text-gray-800">{totals.ventes || 0}</p>
            <p className="text-xs text-gray-400">Ventes totales</p>
          </div>
          <div>
            <p className="text-lg font-bold text-gray-800">{avgTransfo > 0 ? `${avgTransfo.toFixed(1)}%` : '—'}</p>
            <p className="text-xs text-gray-400">Taux transfo moy.</p>
          </div>
          <div>
            <p className="text-lg font-bold text-gray-800">{totals.ventes > 0 && totals.ca > 0 ? `${(totals.ca / totals.ventes).toFixed(0)} €` : '—'}</p>
            <p className="text-xs text-gray-400">Panier moyen</p>
          </div>
        </div>
      </div>

      {/* Graphique CA */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
        <p className="text-sm font-semibold text-gray-700 mb-4">Évolution du CA</p>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={historicalData}>
            <defs>
              <linearGradient id="caGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={formatChartDate} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip formatter={(v) => [`${v} €`, 'CA']} labelFormatter={formatChartDate} />
            <Area type="monotone" dataKey="total_ca" stroke="#3B82F6" strokeWidth={2} fill="url(#caGrad)" dot={{ r: 3, fill: '#3B82F6' }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Données journalières */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Données Quotidiennes</p>
        <div className="space-y-1.5">
          {historicalData.slice().reverse().slice(0, 10).map((d, i) => (
            <div key={i} className="bg-white rounded-xl px-4 py-2.5 border border-gray-100 flex items-center justify-between">
              <p className="text-sm text-gray-600">{formatChartDate(d.date)}</p>
              <div className="flex items-center gap-6">
                <span className="text-sm font-semibold text-gray-900">{(d.total_ca || 0).toFixed(0)} €</span>
                <span className="text-xs text-gray-400">{d.total_ventes || 0} ventes</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Composant principal ─── */
export default function StoreKPIVariantBContent({
  viewMode, overviewData, historicalData, loadingHistorical,
  aiAnalysis, aiGenerating, canLaunchAI, generateAnalysis, aiSectionRef,
  state,
}) {
  return (
    <div className="space-y-6">
      {/* Insight IA — toujours visible en haut */}
      {!aiAnalysis && !aiGenerating && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-200 flex items-center justify-center flex-shrink-0">
            <Zap className="w-4 h-4 text-amber-700" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-800">Analyse IA disponible</p>
            <p className="text-xs text-amber-700 mt-0.5">Obtenez des insights sur vos performances pour cette période.</p>
          </div>
          <button
            onClick={generateAnalysis}
            disabled={!canLaunchAI}
            className="flex-shrink-0 px-3 py-1.5 text-xs font-semibold bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Générer
          </button>
        </div>
      )}
      {aiGenerating && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
          <RefreshCw className="w-5 h-5 text-amber-600 animate-spin" />
          <p className="text-sm font-semibold text-amber-800">Analyse en cours...</p>
        </div>
      )}
      {aiAnalysis && !aiGenerating && (
        <div ref={aiSectionRef} className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-600" />
              <p className="text-sm font-semibold text-amber-800">Insight IA</p>
            </div>
            <button onClick={generateAnalysis} className="text-xs text-amber-600 hover:text-amber-800">Regénérer</button>
          </div>
          <p className="text-sm text-amber-900 leading-relaxed line-clamp-4">
            {typeof aiAnalysis === 'string' ? aiAnalysis : aiAnalysis?.summary || aiAnalysis?.content || 'Analyse disponible'}
          </p>
        </div>
      )}

      {/* Contenu données */}
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
