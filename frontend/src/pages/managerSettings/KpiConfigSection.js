import React from 'react';
import { Settings } from 'lucide-react';

export default function KpiConfigSection({ kpiConfig, onUpdate }) {
  if (!kpiConfig) return <p className="text-gray-500">Chargement de la configuration...</p>;

  const KpiCheckbox = ({ field, label }) => (
    <label className="flex items-center gap-3 cursor-pointer">
      <input
        type="checkbox"
        checked={kpiConfig[field] === true}
        onChange={(e) => onUpdate(field, e.target.checked)}
        className="w-5 h-5 cursor-pointer"
      />
      <span className="text-lg">{label}</span>
    </label>
  );

  const hasCalculated =
    (kpiConfig.track_ca && kpiConfig.track_ventes) ||
    (kpiConfig.track_ventes && kpiConfig.track_prospects) ||
    (kpiConfig.track_articles && kpiConfig.track_ventes);

  return (
    <div className="bg-white rounded-2xl p-6 shadow-lg">
      <div className="flex items-center gap-3 mb-6">
        <Settings className="w-6 h-6 text-[#ffd871]" />
        <h2 className="text-2xl font-bold">Configuration des KPI</h2>
      </div>
      <div className="space-y-4">
        <KpiCheckbox field="track_ca"       label="Chiffre d'affaires (CA)" />
        <KpiCheckbox field="track_ventes"   label="Nombre de ventes" />
        <KpiCheckbox field="track_clients"  label="Nombre de clients" />
        <KpiCheckbox field="track_articles" label="Nombre d'articles" />

        <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border-2 border-blue-200">
          <p className="text-sm font-semibold text-gray-700 mb-3">
            📊 KPI calculés automatiquement avec votre sélection :
          </p>
          <div className="space-y-2">
            {kpiConfig.track_ca && kpiConfig.track_ventes && (
              <div className="flex items-center gap-2 text-sm text-gray-700 bg-white px-3 py-2 rounded-lg">
                <span className="text-green-600 font-bold">✓</span>
                <span className="font-medium">Panier moyen</span>
                <span className="text-gray-500 text-xs">(CA ÷ Ventes)</span>
              </div>
            )}
            {kpiConfig.track_ventes && kpiConfig.track_prospects && (
              <div className="flex items-center gap-2 text-sm text-gray-700 bg-white px-3 py-2 rounded-lg">
                <span className="text-green-600 font-bold">✓</span>
                <span className="font-medium">Taux de transformation</span>
                <span className="text-gray-500 text-xs">(Ventes ÷ Prospects × 100)</span>
              </div>
            )}
            {kpiConfig.track_articles && kpiConfig.track_ventes && (
              <div className="flex items-center gap-2 text-sm text-gray-700 bg-white px-3 py-2 rounded-lg">
                <span className="text-green-600 font-bold">✓</span>
                <span className="font-medium">Indice de vente</span>
                <span className="text-gray-500 text-xs">(Articles ÷ Ventes)</span>
              </div>
            )}
            {!hasCalculated && (
              <p className="text-sm text-gray-500 italic">
                Sélectionnez des combinaisons de KPI pour voir les calculs automatiques disponibles
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
