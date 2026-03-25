import React from 'react';
import { Plus, Building2, Users, TrendingUp, BarChart3, Lock, TrendingDown, Minus, MapPin } from 'lucide-react';

/**
 * Vue principale du dashboard gérant (onglet "Vue d'ensemble").
 * Contient : stats globales, sélecteur de période, classement, grille magasins.
 */
export default function GerantDashboardView({
  globalStats,
  stores,
  storesStats,
  rankingStats,
  pendingInvitations,
  periodType,
  periodOffset,
  setPeriodType,
  setPeriodOffset,
  isReadOnly,
  onOpenCreateStore,
  onOpenInviteStaff,
}) {
  // ── Period helpers ─────────────────────────────────────────
  const getPeriodDates = (type, offset) => {
    const now = new Date();
    if (type === 'week') {
      const diff = now.getDay() === 0 ? -6 : 1 - now.getDay();
      const monday = new Date(now);
      monday.setDate(now.getDate() + diff + offset * 7);
      monday.setHours(0, 0, 0, 0);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);
      return { start: monday, end: sunday };
    } else if (type === 'month') {
      const target = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      const start = new Date(target.getFullYear(), target.getMonth(), 1);
      start.setHours(0, 0, 0, 0);
      const end = new Date(target.getFullYear(), target.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    } else {
      const year = now.getFullYear() + offset;
      const start = new Date(year, 0, 1);
      start.setHours(0, 0, 0, 0);
      const end = new Date(year, 11, 31);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
  };

  const formatPeriod = (type, offset) => {
    const { start } = getPeriodDates(type, offset);
    const { end } = getPeriodDates(type, offset);
    const fmt = (d) => `${d.getDate()} ${d.toLocaleDateString('fr-FR', { month: 'short' })}`;
    if (type === 'week') return offset === 0 ? `Semaine actuelle (${fmt(start)} - ${fmt(end)})` : `Semaine du ${fmt(start)} au ${fmt(end)}`;
    if (type === 'month') {
      const name = start.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
      return offset === 0 ? `Mois actuel (${name})` : name.charAt(0).toUpperCase() + name.slice(1);
    }
    const year = start.getFullYear();
    return offset === 0 ? `Année actuelle (${year})` : `Année ${year}`;
  };

  const getPeriodNumber = (type, date) => {
    if (type === 'week') {
      const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
      const dayNum = d.getUTCDay() || 7;
      d.setUTCDate(d.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    }
    if (type === 'month') return date.getMonth() + 1;
    return date.getFullYear();
  };

  // ── Rankings ───────────────────────────────────────────────
  const rankedStores = stores.map(store => {
    const stats = rankingStats[store.id] || {};
    const periodCA = stats.period_ca || 0;
    const prevPeriodCA = stats.prev_period_ca || 0;
    const periodVentes = stats.period_ventes || 0;
    const periodProspects = stats.period_prospects || 0;
    const periodEvolution = prevPeriodCA > 0 ? ((periodCA - prevPeriodCA) / prevPeriodCA) * 100 : 0;
    return { ...store, stats, periodCA, periodVentes, periodProspects, periodEvolution };
  }).sort((a, b) => b.periodCA - a.periodCA);



  return (
    <>
      {/* Stats Globales */}
      <div className="mb-8">
        <h2 className="text-xl font-bold text-gray-700 mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-orange-500" />
          Vue d'ensemble
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">

          {/* Magasins */}
          <div className="glass-morphism rounded-2xl p-5 border border-orange-200 flex flex-col items-center text-center gap-2">
            <div className="w-11 h-11 bg-orange-100 rounded-xl flex items-center justify-center">
              <Building2 className="w-5 h-5 text-orange-600" />
            </div>
            <p className="text-3xl font-extrabold text-gray-900">{globalStats?.total_stores || 0}</p>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Magasins</p>
          </div>

          {/* Managers */}
          <div className="glass-morphism rounded-2xl p-5 border border-blue-200 flex flex-col items-center text-center gap-2">
            <div className="w-11 h-11 bg-blue-100 rounded-xl flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-3xl font-extrabold text-gray-900">{globalStats?.total_managers || 0}</p>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Managers actifs</p>
            <div className="flex flex-wrap justify-center gap-1">
              {pendingInvitations.managers > 0 && (
                <span className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">+{pendingInvitations.managers} en attente</span>
              )}
              {globalStats?.suspended_managers > 0 && (
                <span className="text-xs text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded-full">{globalStats.suspended_managers} en veille</span>
              )}
            </div>
          </div>

          {/* Vendeurs */}
          <div className="glass-morphism rounded-2xl p-5 border border-indigo-200 flex flex-col items-center text-center gap-2">
            <div className="w-11 h-11 bg-indigo-100 rounded-xl flex items-center justify-center">
              <Users className="w-5 h-5 text-indigo-600" />
            </div>
            <p className="text-3xl font-extrabold text-gray-900">{globalStats?.total_sellers || 0}</p>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Vendeurs actifs</p>
            <div className="flex flex-wrap justify-center gap-1">
              {pendingInvitations.sellers > 0 && (
                <span className="text-xs text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-full">+{pendingInvitations.sellers} en attente</span>
              )}
              {globalStats?.suspended_sellers > 0 && (
                <span className="text-xs text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded-full">{globalStats.suspended_sellers} en veille</span>
              )}
            </div>
          </div>

          {/* CA mois */}
          <div className="glass-morphism rounded-2xl p-5 border border-green-200 flex flex-col items-center text-center gap-2 col-span-2 lg:col-span-1">
            <div className="w-11 h-11 bg-green-100 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-3xl font-extrabold text-gray-900">
              {globalStats?.month_ca ? `${Math.round(globalStats.month_ca).toLocaleString('fr-FR')} €` : '0 €'}
            </p>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              CA — {new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
            </p>
          </div>

        </div>
      </div>

      {/* Mes Magasins */}
      <div className="mb-8">
        {/* Ligne 1 : titre + boutons d'action */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
          <h2 className="text-xl font-bold text-gray-700 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-orange-500" />
            Mes Magasins
          </h2>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => !isReadOnly && onOpenInviteStaff()}
              disabled={isReadOnly}
              title={isReadOnly ? "Période d'essai terminée" : 'Inviter du personnel'}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-xl transition-all ${
                isReadOnly ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:shadow-lg'
              }`}
            >
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Inviter du</span> Personnel
              {isReadOnly && <Lock className="w-3 h-3 ml-1" />}
            </button>
            <button
              onClick={() => !isReadOnly && onOpenCreateStore()}
              disabled={isReadOnly}
              title={isReadOnly ? "Période d'essai terminée" : 'Créer un nouveau magasin'}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-xl transition-all ${
                isReadOnly ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:shadow-lg'
              }`}
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Nouveau</span> Magasin
              {isReadOnly && <Lock className="w-3 h-3 ml-1" />}
            </button>
          </div>
        </div>

        {/* Ligne 2 : sélecteur de période intégré */}
        <div className="flex flex-wrap items-center gap-2 mb-4 p-3 bg-gray-50 rounded-xl border border-gray-200">
          {/* Type */}
          <div className="flex gap-1">
            {[['week', 'Semaine'], ['month', 'Mois'], ['year', 'Année']].map(([type, label]) => (
              <button
                key={type}
                onClick={() => { setPeriodType(type); setPeriodOffset(0); }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  periodType === type
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Séparateur */}
          <div className="w-px h-5 bg-gray-300 hidden sm:block" />

          {/* Navigation */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPeriodOffset(periodOffset - 1)}
              className="p-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-600 rounded-lg transition-all text-xs font-bold"
            >
              ◀
            </button>
            <span className="px-3 py-1.5 text-xs font-semibold text-gray-800 bg-white border border-gray-200 rounded-lg min-w-[120px] text-center">
              {formatPeriod(periodType, periodOffset)}
            </span>
            <button
              onClick={() => setPeriodOffset(periodOffset + 1)}
              disabled={periodOffset >= 0}
              className={`p-1.5 border rounded-lg transition-all text-xs font-bold ${
                periodOffset >= 0
                  ? 'bg-gray-100 border-gray-200 text-gray-300 cursor-not-allowed'
                  : 'bg-white border-gray-300 hover:bg-gray-50 text-gray-600'
              }`}
            >
              ▶
            </button>
          </div>

          {/* Retour au présent */}
          {periodOffset !== 0 && (
            <button
              onClick={() => setPeriodOffset(0)}
              className="text-xs text-blue-600 hover:text-blue-700 font-semibold underline whitespace-nowrap"
            >
              ↻ Actuel
            </button>
          )}
        </div>

        {stores.length === 0 ? (
          <div className="glass-morphism rounded-xl p-12 text-center">
            <Building2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">Aucun magasin pour le moment</p>
            <button
              onClick={() => !isReadOnly && onOpenCreateStore()}
              disabled={isReadOnly}
              className={`px-6 py-3 font-semibold rounded-xl transition-all ${
                isReadOnly ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:shadow-lg'
              }`}
            >
              Créer votre premier magasin
            </button>
          </div>
        ) : (
          <div className="glass-morphism rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-3 text-center w-10">#</th>
                  <th className="px-4 py-3 text-left">Magasin</th>
                  <th className="px-4 py-3 text-right">CA — {formatPeriod(periodType, periodOffset)}</th>
                  <th className="px-4 py-3 text-right hidden sm:table-cell">Ventes</th>
                  <th className="px-4 py-3 text-right hidden lg:table-cell">
                    <span className="relative group inline-block">
                      <span className="cursor-help border-b border-dashed border-gray-400">Panier moyen</span>
                      <span className="pointer-events-none absolute bottom-full right-0 mb-2 w-64 rounded-lg bg-gray-800 px-3 py-2 text-left text-xs font-normal normal-case text-white shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50">
                        Panier moyen = CA ÷ Nombre de ventes. Montant moyen dépensé par transaction sur la période.
                      </span>
                    </span>
                  </th>
                  <th className="px-4 py-3 text-right hidden lg:table-cell">
                    <span className="relative group inline-block">
                      <span className="cursor-help border-b border-dashed border-gray-400">Transformation</span>
                      <span className="pointer-events-none absolute bottom-full right-0 mb-2 w-64 rounded-lg bg-gray-800 px-3 py-2 text-left text-xs font-normal normal-case text-white shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50">
                        Taux de transformation = Ventes ÷ Prospects. Indique la part des prospects convertis en achat.
                      </span>
                    </span>
                  </th>
                  <th className="px-4 py-3 text-center hidden md:table-cell">
                    <span className="relative group inline-block">
                      <span className="cursor-help border-b border-dashed border-gray-400">Évolution</span>
                      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 rounded-lg bg-gray-800 px-3 py-2 text-left text-xs font-normal normal-case text-white shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50">
                        Évolution du CA par rapport à la même période précédente (semaine / mois / année selon le filtre sélectionné).
                      </span>
                    </span>
                  </th>
                  <th className="px-4 py-3 text-center hidden md:table-cell">Équipe</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rankedStores.map((s, index) => {
                  const originalIndex = stores.findIndex(st => st.id === s.id);
                  const rankIcons = ['🥇', '🥈', '🥉', '🏅', '⭐', '✨'];
                  const rankIcon = index < rankIcons.length ? rankIcons[index] : `${index + 1}`;
                  const evo = s.periodEvolution;
                  const hasEvo = evo !== null && evo !== undefined && !isNaN(evo) && (s.stats?.prev_period_ca > 0 || s.periodCA > 0);
                  return (
                    <tr key={s.id} className={`hover:bg-orange-50/40 transition-colors ${index < 3 ? 'bg-orange-50/20' : 'bg-white'}`}>
                      {/* Rang */}
                      <td className="px-4 py-4 text-center">
                        <span className="text-xl">{rankIcon}</span>
                      </td>

                      {/* Magasin */}
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <div>
                            <p className="font-semibold text-gray-900">{s.name}</p>
                            {s.location && (
                              <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                                <MapPin className="w-3 h-3" />{s.location}
                              </p>
                            )}
                          </div>
                          {(s.pending_manager_count || 0) + (s.pending_seller_count || 0) > 0 && (
                            <span className="text-xs font-bold text-yellow-800 bg-yellow-100 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                              +{(s.pending_manager_count || 0) + (s.pending_seller_count || 0)} en attente
                            </span>
                          )}
                        </div>
                      </td>

                      {/* CA sélectionné */}
                      <td className="px-4 py-4 text-right">
                        <p className="font-bold text-gray-900 text-base">
                          {s.periodCA > 0 ? `${s.periodCA.toLocaleString('fr-FR')} €` : <span className="text-gray-400 font-normal text-sm">—</span>}
                        </p>
                      </td>

                      {/* Ventes */}
                      <td className="px-4 py-4 text-right hidden sm:table-cell">
                        <p className="font-semibold text-gray-700">
                          {s.periodVentes > 0 ? s.periodVentes : <span className="text-gray-400 font-normal text-sm">—</span>}
                        </p>
                      </td>

                      {/* Panier moyen */}
                      <td className="px-4 py-4 text-right hidden lg:table-cell">
                        {s.periodVentes > 0 && s.periodCA > 0 ? (
                          <p className="font-semibold text-gray-700">
                            {Math.round(s.periodCA / s.periodVentes).toLocaleString('fr-FR')} €
                          </p>
                        ) : (
                          <span className="text-gray-400 text-sm">—</span>
                        )}
                      </td>

                      {/* Taux de transformation */}
                      <td className="px-4 py-4 text-right hidden lg:table-cell">
                        {s.periodProspects > 0 && s.periodVentes > 0 ? (
                          <p className="font-semibold text-gray-700">
                            {Math.round((s.periodVentes / s.periodProspects) * 100)} %
                          </p>
                        ) : (
                          <span className="text-gray-400 text-sm">—</span>
                        )}
                      </td>

                      {/* Évolution */}
                      <td className="px-4 py-4 text-center hidden md:table-cell">
                        {hasEvo ? (
                          evo > 0 ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-green-700 bg-green-100 px-2 py-1 rounded-full">
                              <TrendingUp className="w-3 h-3" />+{Math.round(evo * 10) / 10}%
                            </span>
                          ) : evo < 0 ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-red-700 bg-red-100 px-2 py-1 rounded-full">
                              <TrendingDown className="w-3 h-3" />{Math.round(evo * 10) / 10}%
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                              <Minus className="w-3 h-3" />0%
                            </span>
                          )
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>

                      {/* Équipe (masquée sur md, visible lg) */}
                      <td className="px-4 py-4 text-center hidden md:table-cell">
                        <div className="flex items-center justify-center gap-3 text-xs text-gray-600">
                          <span className="flex items-center gap-1">
                            <Users className="w-3.5 h-3.5 text-blue-400" />
                            <span className="font-semibold">{storesStats[s.id]?.managers_count ?? '—'}</span>
                          </span>
                          <span className="text-gray-300">|</span>
                          <span className="flex items-center gap-1">
                            <Users className="w-3.5 h-3.5 text-purple-400" />
                            <span className="font-semibold">{storesStats[s.id]?.sellers_count ?? '—'}</span>
                          </span>
                        </div>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
