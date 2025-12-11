import React from 'react';
import { Building2, Users, TrendingUp, MapPin } from 'lucide-react';
import Sparkline from './Sparkline';

// Palette de couleurs pour différencier les magasins
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

const StoreCard = ({ store, stats, badge, sparklineData, onClick, colorIndex = 0 }) => {
  // Utiliser l'index pour choisir une couleur (avec modulo pour boucler)
  const colors = STORE_COLORS[colorIndex % STORE_COLORS.length];
  
  return (
    <div
      onClick={onClick}
      className={`glass-morphism rounded-xl overflow-hidden cursor-pointer group hover:shadow-2xl transition-all duration-300 border-2 border-transparent ${colors.border}`}
    >
      <div className={`relative h-24 bg-gradient-to-br ${colors.from} ${colors.via} ${colors.to} overflow-hidden`}>
        <div className="absolute inset-0 bg-black opacity-20"></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <Building2 className="w-12 h-12 text-white opacity-80" />
        </div>
        {/* Badge de performance */}
        {badge && (
          <div className={`absolute top-2 right-2 px-2 py-1 rounded-full text-xs font-bold shadow-lg ${badge.bgClass} text-white`}>
            {badge.icon} {badge.label}
          </div>
        )}
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-lg font-bold text-gray-800 mb-1">{store.name}</h3>
            <div className="flex items-center gap-1 text-xs text-gray-600">
              <MapPin className="w-3 h-3" />
              <span>{store.location}</span>
            </div>
          </div>
          {store.active ? (
            <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
              Actif
            </span>
          ) : (
            <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs font-semibold rounded-full">
              Inactif
            </span>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className={`${colors.bg} rounded-lg p-2`}>
            <div className="flex items-center gap-1 mb-1">
              <Users className={`w-3 h-3 ${colors.text}`} />
              <span className="text-xs text-gray-600">Managers</span>
            </div>
            <p className="text-xl font-bold text-blue-600">
              {stats?.managers_count || 0}
            </p>
          </div>

          <div className="bg-purple-50 rounded-lg p-2">
            <div className="flex items-center gap-1 mb-1">
              <Users className="w-3 h-3 text-purple-600" />
              <span className="text-xs text-gray-600">Vendeurs</span>
            </div>
            <p className="text-xl font-bold text-purple-600">
              {stats?.sellers_count || 0}
            </p>
          </div>
        </div>

        <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-2">
          <div className="flex items-center gap-1 mb-1">
            <TrendingUp className="w-3 h-3 text-green-600" />
            <span className="text-xs text-gray-600">CA Année</span>
          </div>
          <p className="text-xl font-bold text-green-600">
            {stats?.month_ca ? `${stats.month_ca.toLocaleString('fr-FR')} €` : '0 €'}
          </p>
          <p className="text-xs text-gray-600 mt-1">
            {stats?.month_ventes || 0} vente{stats?.month_ventes > 1 ? 's' : ''}
          </p>
        </div>

        {/* Period CA */}
        <div className="mt-3 pt-3 border-t border-gray-200">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-600">Dernière semaine complète</span>
            <span className="text-sm font-bold text-orange-600">
              {stats?.period_ca ? `${stats.period_ca.toLocaleString('fr-FR')} €` : '0 €'}
            </span>
          </div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-gray-500">
              {stats?.period_ventes || 0} vente{stats?.period_ventes > 1 ? 's' : ''}
            </p>
            {stats?.prev_period_ca > 0 && stats?.period_ca !== undefined && (
              <div className={`flex items-center gap-1 text-xs font-semibold ${
                stats.period_ca >= stats.prev_period_ca ? 'text-green-600' : 'text-red-600'
              }`}>
                {stats.period_ca >= stats.prev_period_ca ? '↗' : '↘'}
                {Math.abs(((stats.period_ca - stats.prev_period_ca) / stats.prev_period_ca) * 100).toFixed(0)}%
              </div>
            )}
          </div>
          
          {/* Sparkline - Évolution 4 dernières semaines */}
          {sparklineData && sparklineData.length > 0 && (
            <div className="mt-2 pt-2 border-t border-gray-100">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-500">Tendance (4 semaines)</span>
              </div>
              <div className="flex justify-center">
                <Sparkline 
                  data={sparklineData} 
                  width={120} 
                  height={30} 
                  color="#f97316" 
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
        <p className="text-sm text-purple-600 font-semibold group-hover:text-purple-700">
          Voir les détails →
        </p>
      </div>
    </div>
  );
};

export default StoreCard;
