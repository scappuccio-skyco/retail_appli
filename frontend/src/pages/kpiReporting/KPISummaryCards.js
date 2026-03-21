import React from 'react';

export default function KPISummaryCards({ stats, kpiConfig }) {
  if (!stats || !kpiConfig) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
      {kpiConfig.track_ca && stats.totalCA !== undefined && (
        <div className="glass-morphism rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">💰</span>
            <p className="text-sm text-gray-600">CA Total</p>
          </div>
          <p className="text-2xl font-bold text-gray-800">{stats.totalCA}€</p>
          <p className="text-xs text-gray-500 mt-1">{stats.nbJours} jours</p>
        </div>
      )}

      {kpiConfig.track_ventes && stats.totalVentes !== undefined && (
        <div className="glass-morphism rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">🛍️</span>
            <p className="text-sm text-gray-600">Ventes</p>
          </div>
          <p className="text-2xl font-bold text-gray-800">{stats.totalVentes}</p>
          <p className="text-xs text-gray-500 mt-1">Total période</p>
        </div>
      )}

      {kpiConfig.track_clients && stats.totalClients !== undefined && (
        <div className="glass-morphism rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">👥</span>
            <p className="text-sm text-gray-600">Clients</p>
          </div>
          <p className="text-2xl font-bold text-gray-800">{stats.totalClients}</p>
          <p className="text-xs text-gray-500 mt-1">Accueillis</p>
        </div>
      )}

      {kpiConfig.track_articles && stats.totalArticles !== undefined && (
        <div className="glass-morphism rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">📦</span>
            <p className="text-sm text-gray-600">Articles</p>
          </div>
          <p className="text-2xl font-bold text-gray-800">{stats.totalArticles}</p>
          <p className="text-xs text-gray-500 mt-1">Vendus</p>
        </div>
      )}

      {stats.avgPanierMoyen !== undefined && (
        <div className="glass-morphism rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">🛒</span>
            <p className="text-sm text-gray-600">Panier Moyen</p>
          </div>
          <p className="text-2xl font-bold text-gray-800">{stats.avgPanierMoyen}€</p>
          <p className="text-xs text-gray-500 mt-1">Moyenne</p>
        </div>
      )}

      {stats.avgTauxTransfo !== undefined && (
        <div className="glass-morphism rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">📈</span>
            <p className="text-sm text-gray-600">Taux Transfo</p>
          </div>
          <p className="text-2xl font-bold text-gray-800">{stats.avgTauxTransfo}%</p>
          <p className="text-xs text-gray-500 mt-1">Moyenne</p>
        </div>
      )}

      {stats.avgIndiceVente !== undefined && (
        <div className="glass-morphism rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">💎</span>
            <p className="text-sm text-gray-600">Indice Vente</p>
          </div>
          <p className="text-2xl font-bold text-gray-800">{stats.avgIndiceVente}€</p>
          <p className="text-xs text-gray-500 mt-1">Moyenne</p>
        </div>
      )}
    </div>
  );
}
