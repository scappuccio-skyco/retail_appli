import React from 'react';
import { BarChart3 } from 'lucide-react';
import KPITable from './KPITable';
import KPICharts from './KPICharts';
import AIBilanSection from './AIBilanSection';

export default function WeekView({
  bilanData, periodLoading, periodEntries, kpiConfig,
  chartData, generatingBilan, bilanSectionRef, onRegenerate, isDemo = false,
}) {
  return (
    <>
      {/* KPI Summary from bilanData */}
      {bilanData?.kpi_resume && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          {bilanData.kpi_resume?.ca_total !== undefined && (
            <div className="bg-blue-50 rounded-lg p-3">
              <p className="text-xs text-blue-600 mb-1">💰 CA</p>
              <p className="text-lg font-bold text-blue-900">{bilanData.kpi_resume.ca_total.toFixed(0)}€</p>
            </div>
          )}
          {bilanData.kpi_resume?.ventes !== undefined && (
            <div className="bg-green-50 rounded-lg p-3">
              <p className="text-xs text-green-600 mb-1">🛒 Ventes</p>
              <p className="text-lg font-bold text-green-900">{bilanData.kpi_resume.ventes}</p>
            </div>
          )}
          {bilanData.kpi_resume?.articles !== undefined && (
            <div className="bg-orange-50 rounded-lg p-3">
              <p className="text-xs text-orange-600 mb-1">📦 Articles</p>
              <p className="text-lg font-bold text-orange-900">{bilanData.kpi_resume.articles}</p>
            </div>
          )}
          {bilanData.kpi_resume?.panier_moyen !== undefined && (
            <div className="bg-indigo-50 rounded-lg p-3">
              <p className="text-xs text-indigo-600 mb-1">💳 P. Moyen</p>
              <p className="text-lg font-bold text-indigo-900">{bilanData.kpi_resume.panier_moyen.toFixed(0)}€</p>
            </div>
          )}
          {bilanData.kpi_resume?.indice_vente > 0 && (
            <div className="bg-teal-50 rounded-lg p-3">
              <p className="text-xs text-teal-600 mb-1">🎯 Ind. Vente</p>
              <p className="text-lg font-bold text-teal-900">{bilanData.kpi_resume.indice_vente.toFixed(2)}</p>
            </div>
          )}
        </div>
      )}

      {/* Détail journalier */}
      {periodLoading ? (
        <div className="flex items-center gap-2 py-4 text-gray-500 text-sm">
          <div className="w-4 h-4 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
          Chargement du détail...
        </div>
      ) : periodEntries.length > 0 ? (
        <KPITable entries={periodEntries} viewMode="semaine" kpiConfig={kpiConfig} />
      ) : (
        <p className="text-sm text-gray-500 mb-4">Aucune saisie pour cette semaine.</p>
      )}

      {/* Charts */}
      {chartData && chartData.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-gray-800">📊 Évolution de la semaine</h3>
          </div>
          <KPICharts data={chartData} kpiConfig={kpiConfig} showDots={true} />
        </div>
      )}

      {/* AI Section */}
      <AIBilanSection
        bilan={bilanData}
        generating={generatingBilan}
        onGenerate={onRegenerate}
        bilanSectionRef={bilanSectionRef}
        size="lg"
        isDemo={isDemo}
        totalCA={bilanData?.kpi_resume?.ca_total ?? null}
      />
    </>
  );
}
