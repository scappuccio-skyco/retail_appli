import React, { useMemo } from 'react';
import { BarChart3 } from 'lucide-react';
import KPITable from './KPITable';
import KPICharts from './KPICharts';
import AIBilanSection from './AIBilanSection';

export default function MonthYearView({
  viewMode, periodLoading,
  periodAggregates, periodEntries, yearMonthlyData, periodChartData,
  kpiConfig, periodRange, periodBilan, periodGenerating, generatePeriodBilan,
}) {
  // Pour la vue année : regrouper par mois (plus lisible que 365 points)
  const yearChartData = useMemo(() => {
    if (viewMode !== 'annee' || !yearMonthlyData?.length) return [];
    return yearMonthlyData.map(m => {
      const [y, mo] = m.month.split('-');
      const label = new Date(parseInt(y), parseInt(mo) - 1, 1)
        .toLocaleDateString('fr-FR', { month: 'short' });
      return {
        date: label,
        CA: m.ca,
        Ventes: m.ventes,
        Articles: m.articles,
        Prospects: m.prospects,
        'Panier Moyen': m.ventes > 0 ? Math.round(m.ca / m.ventes) : 0,
        'Taux Transfo': m.prospects > 0 ? Math.round((m.ventes / m.prospects) * 100) : 0,
      };
    });
  }, [viewMode, yearMonthlyData]);

  const chartData = viewMode === 'annee' ? yearChartData : periodChartData;

  if (periodLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-500">
        <div className="w-10 h-10 border-4 border-orange-400 border-t-transparent rounded-full animate-spin mb-4" />
        <p>Chargement des données...</p>
      </div>
    );
  }

  if (!periodAggregates) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
        <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <p className="text-gray-600">Aucune donnée saisie pour cette période</p>
      </div>
    );
  }

  return (
    <>
      {/* Summary header */}
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="w-5 h-5 text-orange-600" />
        <h3 className="font-bold text-gray-800">
          {periodRange?.label} — {periodAggregates.nb_jours} jour{periodAggregates.nb_jours > 1 ? 's' : ''} avec données
        </h3>
      </div>

      {/* Aggregate KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {(kpiConfig?.track_ca ?? true) && (
          <div className="bg-blue-50 rounded-lg p-3">
            <p className="text-xs text-blue-600 mb-1">💰 CA total</p>
            <p className="text-lg font-bold text-blue-900">{periodAggregates.ca.toFixed(0)}€</p>
          </div>
        )}
        {(kpiConfig?.track_ventes ?? true) && (
          <div className="bg-green-50 rounded-lg p-3">
            <p className="text-xs text-green-600 mb-1">🛒 Ventes</p>
            <p className="text-lg font-bold text-green-900">{periodAggregates.ventes}</p>
          </div>
        )}
        {(kpiConfig?.track_articles ?? true) && (
          <div className="bg-orange-50 rounded-lg p-3">
            <p className="text-xs text-orange-600 mb-1">📦 Articles</p>
            <p className="text-lg font-bold text-orange-900">{periodAggregates.articles}</p>
          </div>
        )}
        {(kpiConfig?.track_prospects ?? true) && (
          <div className="bg-purple-50 rounded-lg p-3">
            <p className="text-xs text-purple-600 mb-1">🚶 Prospects</p>
            <p className="text-lg font-bold text-purple-900">{periodAggregates.prospects}</p>
          </div>
        )}
        {(kpiConfig?.track_ca ?? true) && (kpiConfig?.track_ventes ?? true) && periodAggregates.panier_moyen > 0 && (
          <div className="bg-indigo-50 rounded-lg p-3">
            <p className="text-xs text-indigo-600 mb-1">💳 Panier moyen</p>
            <p className="text-lg font-bold text-indigo-900">{periodAggregates.panier_moyen.toFixed(0)}€</p>
          </div>
        )}
        {(kpiConfig?.track_ventes ?? true) && (kpiConfig?.track_prospects ?? true) && periodAggregates.taux_transformation > 0 && (
          <div className="bg-pink-50 rounded-lg p-3">
            <p className="text-xs text-pink-600 mb-1">📈 Taux transfo</p>
            <p className="text-lg font-bold text-pink-900">{periodAggregates.taux_transformation.toFixed(1)}%</p>
          </div>
        )}
        {(kpiConfig?.track_articles ?? true) && (kpiConfig?.track_ventes ?? true) && periodAggregates.indice_vente > 0 && (
          <div className="bg-teal-50 rounded-lg p-3">
            <p className="text-xs text-teal-600 mb-1">🎯 Indice vente</p>
            <p className="text-lg font-bold text-teal-900">{periodAggregates.indice_vente.toFixed(2)}</p>
          </div>
        )}
      </div>

      {/* Detail table */}
      <KPITable
        entries={periodEntries}
        yearMonthlyData={yearMonthlyData}
        viewMode={viewMode}
        kpiConfig={kpiConfig}
      />

      {/* Charts */}
      {chartData.length > 0 && (
        <KPICharts data={chartData} kpiConfig={kpiConfig} />
      )}

      {/* AI Section */}
      <div className="mt-6">
        <AIBilanSection
          bilan={periodBilan}
          generating={periodGenerating}
          onGenerate={generatePeriodBilan}
          periodLabel={periodRange?.label}
        />
      </div>
    </>
  );
}
