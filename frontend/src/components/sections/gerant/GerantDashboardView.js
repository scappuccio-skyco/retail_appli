import React from 'react';
import { Plus, Building2, Users, TrendingUp, BarChart3, Lock } from 'lucide-react';
import StoreCard from '../../gerant/StoreCard';

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
  onStoreClick,
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
    const periodEvolution = prevPeriodCA > 0 ? ((periodCA - prevPeriodCA) / prevPeriodCA) * 100 : 0;
    return { ...store, stats, periodCA, periodVentes, periodEvolution };
  }).sort((a, b) => b.periodCA - a.periodCA);

  const getPerformanceBadge = (store) => {
    const storeData = rankedStores.find(s => s.id === store.id);
    if (!storeData) return null;
    const active = rankedStores.filter(s => s.periodCA >= 100);
    const pool = active.length >= 2 ? active : rankedStores;
    if (pool.length === 0) return { type: 'weak', bgClass: 'bg-gray-500', icon: '⚪', label: 'Aucune donnée' };
    const avg = pool.reduce((s, x) => s + x.periodCA, 0) / pool.length;
    const rel = avg > 0 ? ((storeData.periodCA - avg) / avg) * 100 : 0;
    if (storeData.periodCA < 100) return { type: 'weak', bgClass: 'bg-gray-500', icon: '⚪', label: 'Inactif' };
    if (rel > 20 || storeData.periodEvolution > 15) return { type: 'excellent', bgClass: 'bg-green-500', icon: '🔥', label: 'Excellent' };
    if (rel > 0 || storeData.periodEvolution > 5) return { type: 'good', bgClass: 'bg-blue-500', icon: '👍', label: 'Bon' };
    if (rel > -20 && storeData.periodEvolution > -10) return { type: 'average', bgClass: 'bg-orange-500', icon: '⚡', label: 'Moyen' };
    return { type: 'weak', bgClass: 'bg-red-500', icon: '⚠️', label: 'À améliorer' };
  };

  const getRankIcon = (rank) => {
    if (rank === 0) return '🥇';
    if (rank === 1) return '🥈';
    if (rank === 2) return '🥉';
    if (rank === 3) return '🏅';
    if (rank === 4) return '⭐';
    if (rank === 5) return '✨';
    return `${rank + 1}.`;
  };

  const periodLabel = periodType === 'week' ? 'Sem.' : periodType === 'month' ? 'Mois' : 'An';

  return (
    <>
      {/* Stats Globales */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-orange-600" />
          Vue d'Ensemble
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="glass-morphism rounded-xl p-6 border-2 border-orange-200">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <Building2 className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Magasins</p>
                <p className="text-2xl font-bold text-gray-800">{globalStats?.total_stores || 0}</p>
              </div>
            </div>
          </div>

          <div className="glass-morphism rounded-xl p-6 border-2 border-blue-200">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-600">Managers actifs</p>
                <p className="text-2xl font-bold text-gray-800">{globalStats?.total_managers || 0}</p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {pendingInvitations.managers > 0 && (
                    <span className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">+{pendingInvitations.managers} en attente</span>
                  )}
                  {globalStats?.suspended_managers > 0 && (
                    <span className="text-xs text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">{globalStats.suspended_managers} en veille</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="glass-morphism rounded-xl p-6 border-2 border-indigo-200">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-indigo-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-600">Vendeurs actifs</p>
                <p className="text-2xl font-bold text-gray-800">{globalStats?.total_sellers || 0}</p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {pendingInvitations.sellers > 0 && (
                    <span className="text-xs text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">+{pendingInvitations.sellers} en attente</span>
                  )}
                  {globalStats?.suspended_sellers > 0 && (
                    <span className="text-xs text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">{globalStats.suspended_sellers} en veille</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="glass-morphism rounded-xl p-6 border-2 border-green-200">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">CA du Mois</p>
                <p className="text-2xl font-bold text-gray-800">
                  {globalStats?.month_ca ? `${globalStats.month_ca.toLocaleString('fr-FR')} €` : '0 €'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sélecteur de Période */}
      <div className="mb-8">
        <div className="glass-morphism rounded-xl p-3 sm:p-4 border-2 border-blue-200">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <span className="text-xs sm:text-sm font-semibold text-gray-700 whitespace-nowrap">Type d'analyse :</span>
              <div className="flex gap-1 sm:gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                {[['week', 'Semaine'], ['month', 'Mois'], ['year', 'Année']].map(([type, label]) => (
                  <button
                    key={type}
                    onClick={() => { setPeriodType(type); setPeriodOffset(-1); }}
                    className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all whitespace-nowrap flex-shrink-0 ${
                      periodType === type
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-white text-gray-700 border-2 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="w-full h-px sm:hidden bg-gray-200" />

            <div className="flex items-center justify-between sm:justify-center gap-2 sm:gap-3 flex-wrap">
              <button
                onClick={() => setPeriodOffset(periodOffset - 1)}
                className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-all text-xs sm:text-sm"
              >
                <span>◀</span>
                <span className="hidden xs:inline sm:inline">{periodLabel} préc.</span>
              </button>

              <div className="text-center flex-1 sm:flex-none sm:min-w-[140px]">
                <p className="text-xs text-gray-500">📅 Période</p>
                <p className="text-xs sm:text-sm font-bold text-gray-800 truncate max-w-[150px] sm:max-w-none mx-auto">
                  {formatPeriod(periodType, periodOffset)}
                </p>
                {periodType === 'week' && (
                  <p className="text-xs text-gray-400">
                    S{getPeriodNumber('week', getPeriodDates('week', periodOffset).start)}
                  </p>
                )}
              </div>

              <button
                onClick={() => setPeriodOffset(periodOffset + 1)}
                disabled={periodOffset >= 0}
                className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-2 font-semibold rounded-lg transition-all text-xs sm:text-sm ${
                  periodOffset >= 0 ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                <span className="hidden xs:inline sm:inline">{periodLabel} suiv.</span>
                <span>▶</span>
              </button>

              {periodOffset !== 0 && (
                <button
                  onClick={() => setPeriodOffset(0)}
                  className="text-xs text-blue-600 hover:text-blue-700 font-semibold underline whitespace-nowrap w-full sm:w-auto text-center sm:text-left mt-2 sm:mt-0"
                >
                  ↻ Actuel
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Classement des Magasins */}
      {rankedStores.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-3 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-orange-600" />
            🏆 Classement {periodType === 'week' ? 'de la Semaine' : periodType === 'month' ? 'du Mois' : "de l'Année"}
            <span className="text-sm font-normal text-gray-500">({rankedStores.length} magasin{rankedStores.length > 1 ? 's' : ''})</span>
          </h2>
          <div className="glass-morphism rounded-xl p-4 border-2 border-orange-200">
            {rankedStores.length <= 6 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {rankedStores.map((s, idx) => (
                  <div
                    key={s.id}
                    className={`p-3 rounded-lg border-2 transition-all hover:shadow-md ${
                      idx === 0 ? 'bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-300' :
                      idx === 1 ? 'bg-gradient-to-br from-gray-50 to-slate-100 border-gray-300' :
                      idx === 2 ? 'bg-gradient-to-br from-orange-50 to-amber-50 border-orange-300' :
                      'bg-white border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">{getRankIcon(idx)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-gray-800 truncate">{s.name}</p>
                        <p className="text-xs text-gray-500 truncate">{s.location}</p>
                      </div>
                    </div>
                    <p className="text-lg font-bold text-gray-800">{(s.periodCA || 0).toLocaleString('fr-FR')} €</p>
                    <p className="text-xs text-gray-500">{s.periodVentes || 0} ventes</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border border-gray-200">
                <div className="grid grid-cols-12 gap-2 p-2 bg-gray-100 font-semibold text-xs text-gray-600 border-b border-gray-200">
                  <div className="col-span-1 text-center">#</div>
                  <div className="col-span-6">Magasin</div>
                  <div className="col-span-5 text-right">CA</div>
                </div>
                <div className="max-h-[240px] overflow-y-auto">
                  {rankedStores.slice(0, 20).map((s, idx) => (
                    <div
                      key={s.id}
                      className={`grid grid-cols-12 gap-2 p-2 items-center text-sm border-b border-gray-100 hover:bg-orange-50 transition-colors ${idx < 3 ? 'bg-orange-50/50' : 'bg-white'}`}
                    >
                      <div className="col-span-1 text-center">
                        {idx < 3 ? <span className="text-lg">{getRankIcon(idx)}</span> : <span className="text-gray-500 font-medium">{idx + 1}</span>}
                      </div>
                      <div className="col-span-5">
                        <p className="font-semibold text-gray-800 truncate text-xs sm:text-sm">{s.name}</p>
                        <p className="text-xs text-gray-400 truncate hidden sm:block">{s.location}</p>
                      </div>
                      <div className="col-span-6 text-right">
                        <p className="font-bold text-gray-800 text-xs sm:text-sm">{(s.periodCA || 0).toLocaleString('fr-FR')} €</p>
                        <p className="text-xs text-gray-400">{s.periodVentes || 0} ventes</p>
                      </div>
                    </div>
                  ))}
                </div>
                {rankedStores.length > 20 && (
                  <div className="p-2 bg-gray-50 text-center text-xs text-gray-500 border-t border-gray-200">
                    +{rankedStores.length - 20} autres magasins
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mes Magasins */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Building2 className="w-5 h-5 sm:w-6 sm:h-6 text-orange-600" />
            Mes Magasins
          </h2>
          <div className="flex flex-wrap gap-2 sm:gap-3">
            <button
              onClick={() => !isReadOnly && onOpenInviteStaff()}
              disabled={isReadOnly}
              title={isReadOnly ? "Période d'essai terminée" : 'Inviter du personnel'}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 text-sm sm:text-base font-semibold rounded-xl transition-all ${
                isReadOnly ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:shadow-lg'
              }`}
            >
              <Users className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden xs:inline">Inviter du</span> Personnel
              {isReadOnly && <Lock className="w-3 h-3 ml-1" />}
            </button>
            <button
              onClick={() => !isReadOnly && onOpenCreateStore()}
              disabled={isReadOnly}
              title={isReadOnly ? "Période d'essai terminée" : 'Créer un nouveau magasin'}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 text-sm sm:text-base font-semibold rounded-xl transition-all ${
                isReadOnly ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:shadow-lg'
              }`}
            >
              <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden xs:inline">Nouveau</span> Magasin
              {isReadOnly && <Lock className="w-3 h-3 ml-1" />}
            </button>
          </div>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {stores.map((store, index) => {
              const badge = getPerformanceBadge(store);
              const stats = storesStats[store.id];
              const sparklineData = stats
                ? [(stats.week_ca || 0) * 0.7, (stats.week_ca || 0) * 0.85, (stats.week_ca || 0) * 0.95, stats.week_ca || 0]
                : [];
              return (
                <StoreCard
                  key={store.id}
                  store={store}
                  stats={stats}
                  badge={badge}
                  sparklineData={sparklineData}
                  onClick={() => onStoreClick(store, index)}
                  colorIndex={index}
                />
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
