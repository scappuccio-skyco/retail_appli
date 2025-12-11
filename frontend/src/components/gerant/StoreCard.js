import React from 'react';
import { Building2, Users, MapPin } from 'lucide-react';

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

const StoreCard = ({ store, stats, onClick, colorIndex = 0 }) => {
  const colors = STORE_COLORS[colorIndex % STORE_COLORS.length];
  
  return (
    <div
      onClick={onClick}
      className={`glass-morphism rounded-xl overflow-hidden cursor-pointer group hover:shadow-2xl transition-all duration-300 border-2 border-transparent ${colors.border}`}
    >
      {/* Header coloré */}
      <div className={`relative h-20 bg-gradient-to-br ${colors.from} ${colors.via} ${colors.to} overflow-hidden`}>
        <div className="absolute inset-0 bg-black opacity-10"></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <Building2 className="w-10 h-10 text-white opacity-80" />
        </div>
      </div>

      <div className="p-4">
        {/* Nom et localisation */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-800 mb-1">{store.name}</h3>
            {store.location && (
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <MapPin className="w-3 h-3" />
                <span>{store.location}</span>
              </div>
            )}
          </div>
          {store.active ? (
            <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
              Actif
            </span>
          ) : (
            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-semibold rounded-full">
              Inactif
            </span>
          )}
        </div>

        {/* Stats équipe */}
        <div className="grid grid-cols-2 gap-3">
          <div className={`${colors.bg} rounded-lg p-3 text-center`}>
            <div className="flex items-center justify-center gap-1 mb-1">
              <Users className={`w-4 h-4 ${colors.text}`} />
            </div>
            <p className={`text-2xl font-bold ${colors.text}`}>
              {stats?.managers_count || 0}
            </p>
            <span className="text-xs text-gray-600">Managers</span>
          </div>

          <div className="bg-purple-50 rounded-lg p-3 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Users className="w-4 h-4 text-purple-600" />
            </div>
            <p className="text-2xl font-bold text-purple-600">
              {stats?.sellers_count || 0}
            </p>
            <span className="text-xs text-gray-600">Vendeurs</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
        <p className={`text-sm ${colors.text} font-semibold group-hover:translate-x-1 transition-transform`}>
          Voir les détails →
        </p>
      </div>
    </div>
  );
};

export default StoreCard;
