import React from 'react';
import { BarChart3 } from 'lucide-react';
import AIBilanSection from './AIBilanSection';

export default function DayView({
  periodLoading, periodEntries, kpiConfig,
  periodBilan, periodGenerating, periodRange,
}) {
  if (periodLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-500">
        <div className="w-10 h-10 border-4 border-orange-400 border-t-transparent rounded-full animate-spin mb-4" />
        <p>Chargement des données...</p>
      </div>
    );
  }

  return (
    <>
      {periodEntries.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(kpiConfig?.track_ca ?? true) && (
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
              <p className="text-xs text-blue-700 font-semibold mb-1">💰 CA Réalisé</p>
              <p className="text-2xl font-bold text-blue-900">{(periodEntries[0].ca_journalier ?? 0).toFixed(0)} €</p>
            </div>
          )}
          {(kpiConfig?.track_ventes ?? true) && (
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
              <p className="text-xs text-green-700 font-semibold mb-1">🛒 Ventes</p>
              <p className="text-2xl font-bold text-green-900">{periodEntries[0].nb_ventes ?? 0}</p>
              {(kpiConfig?.track_ca ?? true) && periodEntries[0].nb_ventes > 0 && (
                <p className="text-xs text-green-600 mt-1">PM: {((periodEntries[0].ca_journalier ?? 0) / periodEntries[0].nb_ventes).toFixed(0)} €</p>
              )}
            </div>
          )}
          {(kpiConfig?.track_articles ?? true) && (
            <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4 border border-orange-200">
              <p className="text-xs text-orange-700 font-semibold mb-1">📦 Articles</p>
              <p className="text-2xl font-bold text-orange-900">{periodEntries[0].nb_articles ?? 0}</p>
              {(kpiConfig?.track_ventes ?? true) && periodEntries[0].nb_ventes > 0 && (
                <p className="text-xs text-orange-600 mt-1">IV: {(periodEntries[0].nb_articles / periodEntries[0].nb_ventes).toFixed(2)}</p>
              )}
            </div>
          )}
          {(kpiConfig?.track_prospects ?? true) && (
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
              <p className="text-xs text-purple-700 font-semibold mb-1">🚶 Prospects</p>
              <p className="text-2xl font-bold text-purple-900">{periodEntries[0].nb_prospects ?? 0}</p>
              {(kpiConfig?.track_ventes ?? true) && periodEntries[0].nb_prospects > 0 && (
                <p className="text-xs text-purple-600 mt-1">Taux: {((periodEntries[0].nb_ventes / periodEntries[0].nb_prospects) * 100).toFixed(0)}%</p>
              )}
            </div>
          )}
          {(kpiConfig?.track_ca ?? true) && (kpiConfig?.track_ventes ?? true) && periodEntries[0].nb_ventes > 0 && (
            <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-lg p-4 border border-indigo-200">
              <p className="text-xs text-indigo-700 font-semibold mb-1">💳 P.Moyen</p>
              <p className="text-2xl font-bold text-indigo-900">{((periodEntries[0].ca_journalier ?? 0) / periodEntries[0].nb_ventes).toFixed(0)} €</p>
            </div>
          )}
          {(kpiConfig?.track_articles ?? true) && (kpiConfig?.track_ventes ?? true) && periodEntries[0].nb_ventes > 0 && (
            <div className="bg-gradient-to-br from-teal-50 to-teal-100 rounded-lg p-4 border border-teal-200">
              <p className="text-xs text-teal-700 font-semibold mb-1">🎯 Ind.Vente</p>
              <p className="text-2xl font-bold text-teal-900">{(periodEntries[0].nb_articles / periodEntries[0].nb_ventes).toFixed(2)}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
          <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">Aucune saisie pour cette date</p>
        </div>
      )}

      <div className="mt-6">
        <AIBilanSection
          bilan={periodBilan}
          generating={periodGenerating}
          periodLabel={periodRange?.label}
        />
      </div>
    </>
  );
}
