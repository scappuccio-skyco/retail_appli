import React from 'react';
import { Building2, Users, MapPin, TrendingUp, TrendingDown, Minus } from 'lucide-react';

const STORE_COLORS = [
  { from: 'from-orange-500', via: 'via-orange-600', to: 'to-orange-700', border: 'hover:border-orange-400', bg: 'bg-orange-50', text: 'text-orange-600' },
  { from: 'from-blue-500', via: 'via-blue-600', to: 'to-blue-700', border: 'hover:border-blue-400', bg: 'bg-blue-50', text: 'text-blue-600' },
  { from: 'from-purple-500', via: 'via-purple-600', to: 'to-purple-700', border: 'hover:border-purple-400', bg: 'bg-purple-50', text: 'text-purple-600' },
  { from: 'from-emerald-500', via: 'via-emerald-600', to: 'to-emerald-700', border: 'hover:border-emerald-400', bg: 'bg-emerald-50', text: 'text-emerald-600' },
  { from: 'from-pink-500', via: 'via-pink-600', to: 'to-pink-700', border: 'hover:border-pink-400', bg: 'bg-pink-50', text: 'text-pink-600' },
  { from: 'from-cyan-500', via: 'via-cyan-600', to: 'to-cyan-700', border: 'hover:border-cyan-400', bg: 'bg-cyan-50', text: 'text-cyan-600' },
  { from: 'from-amber-500', via: 'via-amber-600', to: 'to-amber-700', border: 'hover:border-amber-400', bg: 'bg-amber-50', text: 'text-amber-600' },
  { from: 'from-indigo-500', via: 'via-indigo-600', to: 'to-indigo-700', border: 'hover:border-indigo-400', bg: 'bg-indigo-50', text: 'text-indigo-600' },
];

const RANK_ICONS = ['🥇', '🥈', '🥉', '🏅', '⭐', '✨'];

function EvolutionBadge({ value }) {
  if (value === null || value === undefined || isNaN(value)) return null;
  const rounded = Math.round(value * 10) / 10;
  if (rounded > 0) return (
    <span className="inline-flex items-center gap-0.5 text-xs font-bold text-green-700 bg-green-100 px-1.5 py-0.5 rounded-full">
      <TrendingUp className="w-3 h-3" />+{rounded}%
    </span>
  );
  if (rounded < 0) return (
    <span className="inline-flex items-center gap-0.5 text-xs font-bold text-red-700 bg-red-100 px-1.5 py-0.5 rounded-full">
      <TrendingDown className="w-3 h-3" />{rounded}%
    </span>
  );
  return (
    <span className="inline-flex items-center gap-0.5 text-xs font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full">
      <Minus className="w-3 h-3" />0%
    </span>
  );
}

const StoreCard = ({ store, stats, rank, badge, periodCA, periodVentes, periodEvolution, onClick, colorIndex = 0 }) => {
  const colors = STORE_COLORS[colorIndex % STORE_COLORS.length];
  const pendingManagers = store.pending_manager_count || 0;
  const pendingSellers = store.pending_seller_count || 0;
  const totalPending = pendingManagers + pendingSellers;
  const rankIcon = rank !== undefined && rank < RANK_ICONS.length ? RANK_ICONS[rank] : rank !== undefined ? `${rank + 1}.` : null;

  return (
    <div
      onClick={onClick}
      className={`glass-morphism rounded-xl overflow-hidden cursor-pointer group hover:shadow-2xl transition-all duration-300 border-2 border-transparent ${colors.border} flex flex-col h-full`}
    >
      {/* Header coloré */}
      <div className={`relative bg-gradient-to-br ${colors.from} ${colors.via} ${colors.to} px-4 py-3 flex items-center gap-3`}>
        <div className="flex-shrink-0">
          {rankIcon
            ? <span className="text-2xl drop-shadow">{rankIcon}</span>
            : <Building2 className="w-7 h-7 text-white opacity-80" />
          }
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-white truncate">{store.name}</h3>
          {store.location && (
            <div className="flex items-center gap-1 text-xs text-white/80 mt-0.5">
              <MapPin className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{store.location}</span>
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          {badge && (
            <span className="text-xs font-bold text-white bg-white/20 px-2 py-0.5 rounded-full whitespace-nowrap">
              {badge.icon} {badge.label}
            </span>
          )}
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${store.active ? 'bg-green-400/30 text-white' : 'bg-gray-400/30 text-white/70'}`}>
            {store.active ? 'Actif' : 'Inactif'}
          </span>
        </div>
      </div>

      {/* KPIs période */}
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">CA période</p>
            <p className="text-xl font-bold text-gray-800">
              {periodCA !== undefined ? `${(periodCA || 0).toLocaleString('fr-FR')} €` : '— €'}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-400 mb-0.5">Ventes</p>
            <p className="text-xl font-bold text-gray-700">{periodVentes ?? '—'}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400 mb-1">vs période préc.</p>
            <EvolutionBadge value={periodEvolution} />
          </div>
        </div>
      </div>

      {/* Équipe */}
      <div className="px-4 py-3 flex items-center justify-between mt-auto">
        <div className="flex items-center gap-3 text-sm text-gray-600">
          <span className="flex items-center gap-1">
            <Users className="w-4 h-4 text-blue-500" />
            <span className="font-semibold">{stats?.managers_count ?? 0}</span>
            <span className="text-xs text-gray-400">manager{(stats?.managers_count ?? 0) > 1 ? 's' : ''}</span>
          </span>
          <span className="text-gray-300">|</span>
          <span className="flex items-center gap-1">
            <Users className="w-4 h-4 text-purple-500" />
            <span className="font-semibold">{stats?.sellers_count ?? 0}</span>
            <span className="text-xs text-gray-400">vendeur{(stats?.sellers_count ?? 0) > 1 ? 's' : ''}</span>
          </span>
        </div>
        {totalPending > 0 && (
          <span className="text-xs font-bold text-yellow-800 bg-yellow-100 px-2 py-0.5 rounded-full animate-pulse">
            +{totalPending} en attente
          </span>
        )}
      </div>
    </div>
  );
};

export default StoreCard;
