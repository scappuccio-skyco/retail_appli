import React from 'react';

export default function KPIDetailTable({ allEntries, kpiConfig, showAllEntries, onToggleShowAll }) {
  return (
    <div className="glass-morphism rounded-2xl p-6">
      <h3 className="text-lg font-bold text-gray-800 mb-4">
        📋 Détail des saisies ({allEntries.length})
      </h3>

      {/* Always show last 3 entries */}
      <div className="space-y-3 mb-4">
        {allEntries.slice(0, 3).map((entry) => {
          const activeCols = kpiConfig
            ? [
                kpiConfig.track_ca,
                kpiConfig.track_ventes,
                kpiConfig.track_clients,
                kpiConfig.track_articles,
                kpiConfig.track_ca && kpiConfig.track_ventes,
                kpiConfig.track_ventes && kpiConfig.track_clients,
                kpiConfig.track_ca && kpiConfig.track_articles,
              ].filter(Boolean).length
            : 5;
          const mobileColCount = Math.min(activeCols, 5);
          const desktopColCount = Math.min(activeCols, 7);

          return (
            <div key={entry.id} className="bg-white rounded-xl p-4 border border-gray-200">
              <div className="flex justify-between items-center mb-3">
                <p className="text-sm font-semibold text-gray-700">
                  {new Date(entry.date).toLocaleDateString('fr-FR', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'long',
                  })}
                </p>
              </div>
              <div
                className={`grid gap-2 grid-cols-${mobileColCount} md:grid-cols-${desktopColCount}`}
              >
                {kpiConfig?.track_ca && (
                  <div className="bg-blue-50 rounded-lg p-3">
                    <p className="text-xs text-blue-600 mb-1">💰 CA</p>
                    <p className="text-lg font-bold text-blue-900">
                      {entry.ca_journalier?.toFixed(2)}€
                    </p>
                  </div>
                )}
                {kpiConfig?.track_ventes && (
                  <div className="bg-green-50 rounded-lg p-3">
                    <p className="text-xs text-green-600 mb-1">🛒 Ventes</p>
                    <p className="text-lg font-bold text-green-900">{entry.nb_ventes}</p>
                  </div>
                )}
                {kpiConfig?.track_clients && (
                  <div className="bg-purple-50 rounded-lg p-3">
                    <p className="text-xs text-purple-600 mb-1">👥 Clients</p>
                    <p className="text-lg font-bold text-purple-900">{entry.nb_clients}</p>
                  </div>
                )}
                {kpiConfig?.track_articles && (
                  <div className="bg-orange-50 rounded-lg p-3">
                    <p className="text-xs text-orange-600 mb-1">📦 Articles</p>
                    <p className="text-lg font-bold text-orange-900">{entry.nb_articles || 0}</p>
                  </div>
                )}
                {kpiConfig?.track_ca && kpiConfig?.track_ventes && (
                  <div className="bg-indigo-50 rounded-lg p-3">
                    <p className="text-xs text-indigo-600 mb-1">🧮 Panier Moyen</p>
                    <p className="text-lg font-bold text-indigo-900">
                      {entry.panier_moyen?.toFixed(2)}€
                    </p>
                  </div>
                )}
                {kpiConfig?.track_ventes && kpiConfig?.track_prospects && (
                  <div className="bg-pink-50 rounded-lg p-3">
                    <p className="text-xs text-pink-600 mb-1">📊 Taux Transfo</p>
                    <p className="text-lg font-bold text-pink-900">
                      {entry.taux_transformation?.toFixed(2)}%
                    </p>
                  </div>
                )}
                {kpiConfig?.track_ca && kpiConfig?.track_articles && (
                  <div className="bg-teal-50 rounded-lg p-3">
                    <p className="text-xs text-teal-600 mb-1">🎯 Indice Vente</p>
                    <p className="text-lg font-bold text-teal-900">
                      {entry.indice_vente?.toFixed(2)}€
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* "See all" accordion */}
      {allEntries.length > 3 && (
        <>
          <button
            onClick={onToggleShowAll}
            className="w-full flex items-center justify-center gap-2 py-3 border-2 border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            <span className="text-sm font-semibold text-gray-700">
              {showAllEntries ? 'Voir moins' : 'Voir toutes les saisies'}
            </span>
            <span className="text-xl font-bold text-gray-600">
              {showAllEntries ? '−' : '+'}
            </span>
          </button>

          {showAllEntries && (
            <div className="overflow-x-auto mt-4 animate-fadeIn">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                      Date
                    </th>
                    {kpiConfig?.track_ca && (
                      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">
                        CA
                      </th>
                    )}
                    {kpiConfig?.track_ventes && (
                      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">
                        Ventes
                      </th>
                    )}
                    {kpiConfig?.track_clients && (
                      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">
                        Clients
                      </th>
                    )}
                    {kpiConfig?.track_articles && (
                      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">
                        Articles
                      </th>
                    )}
                    {kpiConfig?.track_ca && kpiConfig?.track_ventes && (
                      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">
                        Panier Moyen
                      </th>
                    )}
                    {kpiConfig?.track_ventes && kpiConfig?.track_prospects && (
                      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">
                        Taux Transfo
                      </th>
                    )}
                    {kpiConfig?.track_ca && kpiConfig?.track_articles && (
                      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">
                        Indice Vente
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {allEntries.map((entry) => (
                    <tr key={entry.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 text-sm text-gray-800">
                        {new Date(entry.date).toLocaleDateString('fr-FR')}
                      </td>
                      {kpiConfig?.track_ca && (
                        <td className="py-3 px-4 text-sm text-right font-medium text-gray-800">
                          {entry.ca_journalier?.toFixed(2)}€
                        </td>
                      )}
                      {kpiConfig?.track_ventes && (
                        <td className="py-3 px-4 text-sm text-right text-gray-800">
                          {entry.nb_ventes}
                        </td>
                      )}
                      {kpiConfig?.track_clients && (
                        <td className="py-3 px-4 text-sm text-right text-gray-800">
                          {entry.nb_clients}
                        </td>
                      )}
                      {kpiConfig?.track_articles && (
                        <td className="py-3 px-4 text-sm text-right text-gray-800">
                          {entry.nb_articles || 0}
                        </td>
                      )}
                      {kpiConfig?.track_ca && kpiConfig?.track_ventes && (
                        <td className="py-3 px-4 text-sm text-right text-gray-800">
                          {entry.panier_moyen?.toFixed(2)}€
                        </td>
                      )}
                      {kpiConfig?.track_ventes && kpiConfig?.track_prospects && (
                        <td className="py-3 px-4 text-sm text-right text-gray-800">
                          {entry.taux_transformation?.toFixed(2)}%
                        </td>
                      )}
                      {kpiConfig?.track_ca && kpiConfig?.track_articles && (
                        <td className="py-3 px-4 text-sm text-right text-gray-800">
                          {entry.indice_vente?.toFixed(2)}€
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
