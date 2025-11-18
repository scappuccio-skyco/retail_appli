import React from 'react';
import { Building2, Users, TrendingUp, MapPin } from 'lucide-react';

const StoreCard = ({ store, stats, onClick }) => {
  return (
    <div
      onClick={onClick}
      className="glass-morphism rounded-2xl overflow-hidden cursor-pointer group hover:shadow-2xl transition-all duration-300 border-2 border-transparent hover:border-[#ffd871]"
    >
      <div className="relative h-32 bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 overflow-hidden">
        <div className="absolute inset-0 bg-black opacity-20"></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <Building2 className="w-16 h-16 text-white opacity-80" />
        </div>
      </div>

      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold text-gray-800 mb-1">{store.name}</h3>
            <div className="flex items-center gap-1 text-sm text-gray-600">
              <MapPin className="w-4 h-4" />
              <span>{store.location}</span>
            </div>
          </div>
          {store.active ? (
            <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
              Actif
            </span>
          ) : (
            <span className="px-3 py-1 bg-gray-100 text-gray-700 text-xs font-semibold rounded-full">
              Inactif
            </span>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-blue-50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-blue-600" />
              <span className="text-xs text-gray-600">Managers</span>
            </div>
            <p className="text-2xl font-bold text-blue-600">
              {stats?.managers_count || 0}
            </p>
          </div>

          <div className="bg-purple-50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-purple-600" />
              <span className="text-xs text-gray-600">Vendeurs</span>
            </div>
            <p className="text-2xl font-bold text-purple-600">
              {stats?.sellers_count || 0}
            </p>
          </div>
        </div>

        <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-green-600" />
            <span className="text-xs text-gray-600">CA Aujourd'hui</span>
          </div>
          <p className="text-2xl font-bold text-green-600">
            {stats?.today_ca ? `${stats.today_ca.toLocaleString('fr-FR')} €` : '0 €'}
          </p>
          <p className="text-xs text-gray-600 mt-1">
            {stats?.today_ventes || 0} vente{stats?.today_ventes > 1 ? 's' : ''}
          </p>
        </div>

        {/* Week CA */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-600">CA de la semaine</span>
            <span className="text-sm font-bold text-blue-600">
              {stats?.week_ca ? `${stats.week_ca.toLocaleString('fr-FR')} €` : '0 €'}
            </span>
          </div>
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
