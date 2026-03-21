import React from 'react';
import { BarChart3 } from 'lucide-react';

/**
 * Reusable KPI table for semaine / mois / annee views.
 * For annee view, pass yearMonthlyData + viewMode='annee'.
 * For semaine/mois, pass entries + appropriate viewMode.
 */
export default function KPITable({ entries, yearMonthlyData, viewMode, kpiConfig }) {
  const isAnnee = viewMode === 'annee';
  const rows = isAnnee ? (yearMonthlyData || []) : (entries || []);

  const getLabel = (row) => {
    if (isAnnee) {
      const label = new Date(row.month + '-15').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
      return label.charAt(0).toUpperCase() + label.slice(1);
    }
    return new Date(row.date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  const getValues = (row) => {
    if (isAnnee) {
      const pm = row.ventes > 0 ? row.ca / row.ventes : 0;
      const iv = row.ventes > 0 ? row.articles / row.ventes : 0;
      return { ca: row.ca, ventes: row.ventes, articles: row.articles, prospects: row.prospects, pm, iv };
    }
    const pm = row.nb_ventes > 0 ? row.ca_journalier / row.nb_ventes : 0;
    const iv = row.nb_ventes > 0 ? (row.nb_articles ?? 0) / row.nb_ventes : 0;
    return { ca: row.ca_journalier, ventes: row.nb_ventes, articles: row.nb_articles, prospects: row.nb_prospects, pm, iv };
  };

  return (
    <div className="mb-6">
      <h3 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
        <BarChart3 className="w-4 h-4 text-gray-500" />
        {isAnnee ? '📋 Détail par mois' : '📋 Détail par journée'}
      </h3>
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="text-left px-3 py-2 text-gray-600 font-semibold">{isAnnee ? 'Mois' : 'Date'}</th>
              {(kpiConfig?.track_ca ?? true) && <th className="text-right px-3 py-2 text-blue-700 font-semibold">💰 CA</th>}
              {(kpiConfig?.track_ventes ?? true) && <th className="text-right px-3 py-2 text-green-700 font-semibold">🛒 Ventes</th>}
              {(kpiConfig?.track_articles ?? true) && <th className="text-right px-3 py-2 text-orange-700 font-semibold">📦 Articles</th>}
              {(kpiConfig?.track_prospects ?? true) && <th className="text-right px-3 py-2 text-purple-700 font-semibold">🚶 Prospects</th>}
              {(kpiConfig?.track_ca ?? true) && (kpiConfig?.track_ventes ?? true) && <th className="text-right px-3 py-2 text-indigo-700 font-semibold">💳 P.Moyen</th>}
              {(kpiConfig?.track_articles ?? true) && (kpiConfig?.track_ventes ?? true) && <th className="text-right px-3 py-2 text-teal-700 font-semibold">🎯 IV</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const { ca, ventes, articles, prospects, pm, iv } = getValues(row);
              return (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-3 py-2 text-gray-700 font-medium capitalize">{getLabel(row)}</td>
                  {(kpiConfig?.track_ca ?? true) && <td className="text-right px-3 py-2 text-blue-900 font-semibold">{ca != null && ca > 0 ? `${ca.toFixed(0)}€` : '—'}</td>}
                  {(kpiConfig?.track_ventes ?? true) && <td className="text-right px-3 py-2 text-green-900">{ventes || '—'}</td>}
                  {(kpiConfig?.track_articles ?? true) && <td className="text-right px-3 py-2 text-orange-900">{articles ?? '—'}</td>}
                  {(kpiConfig?.track_prospects ?? true) && <td className="text-right px-3 py-2 text-purple-900">{prospects ?? '—'}</td>}
                  {(kpiConfig?.track_ca ?? true) && (kpiConfig?.track_ventes ?? true) && <td className="text-right px-3 py-2 text-indigo-900">{pm > 0 ? `${pm.toFixed(0)}€` : '—'}</td>}
                  {(kpiConfig?.track_articles ?? true) && (kpiConfig?.track_ventes ?? true) && <td className="text-right px-3 py-2 text-teal-900">{ventes > 0 ? iv.toFixed(2) : '—'}</td>}
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-6 text-center text-gray-500 italic">
                  Aucune donnée saisie pour cette période
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
