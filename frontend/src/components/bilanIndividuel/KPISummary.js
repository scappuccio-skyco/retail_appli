import React from 'react';

const KPI_CARDS = [
  { key: 'ca', trackKey: 'track_ca', icon: '💰', label: 'CA', color: 'blue', format: v => `${v.toFixed(0)}€` },
  { key: 'ventes', trackKey: 'track_ventes', icon: '🛒', label: 'Ventes', color: 'green', format: v => v },
  { key: 'clients', trackKey: 'track_clients', icon: '👥', label: 'Clients', color: 'purple', format: v => v },
  { key: 'articles', trackKey: 'track_articles', icon: '📦', label: 'Articles', color: 'orange', format: v => v },
];

const COLOR_MAP = {
  blue: { bg: 'bg-blue-50', text: 'text-blue-600', bold: 'text-blue-900' },
  green: { bg: 'bg-green-50', text: 'text-[#10B981]', bold: 'text-green-900' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-600', bold: 'text-purple-900' },
  orange: { bg: 'bg-orange-50', text: 'text-[#F97316]', bold: 'text-orange-900' },
  indigo: { bg: 'bg-indigo-50', text: 'text-indigo-600', bold: 'text-indigo-900' },
  pink: { bg: 'bg-pink-50', text: 'text-pink-600', bold: 'text-pink-900' },
  teal: { bg: 'bg-teal-50', text: 'text-teal-600', bold: 'text-teal-900' },
};

function Card({ icon, label, value, color }) {
  const c = COLOR_MAP[color];
  return (
    <div className={`${c.bg} rounded-lg p-3`}>
      <p className={`text-xs ${c.text} mb-1`}>{icon} {label}</p>
      <p className={`text-lg font-bold ${c.bold}`}>{value}</p>
    </div>
  );
}

export default function KPISummary({ bilan, kpiConfig }) {
  const r = bilan.kpi_resume;
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
      {kpiConfig?.track_ca && r.ca_total !== undefined && <Card icon="💰" label="CA" value={`${r.ca_total.toFixed(0)}€`} color="blue" />}
      {kpiConfig?.track_ventes && r.ventes !== undefined && <Card icon="🛒" label="Ventes" value={r.ventes} color="green" />}
      {kpiConfig?.track_clients && r.clients !== undefined && <Card icon="👥" label="Clients" value={r.clients} color="purple" />}
      {kpiConfig?.track_articles && r.articles !== undefined && <Card icon="📦" label="Articles" value={r.articles} color="orange" />}
      {kpiConfig?.track_ca && kpiConfig?.track_ventes && r.panier_moyen !== undefined && <Card icon="💳" label="P. Moyen" value={`${r.panier_moyen.toFixed(0)}€`} color="indigo" />}
      {((kpiConfig?.seller_track_ventes || kpiConfig?.track_ventes) && (kpiConfig?.seller_track_prospects || kpiConfig?.track_prospects)) && r.taux_transformation !== undefined && r.taux_transformation > 0 && <Card icon="📈" label="Taux Transfo" value={`${r.taux_transformation.toFixed(0)}%`} color="pink" />}
      {kpiConfig?.track_articles && kpiConfig?.track_ventes && r.indice_vente !== undefined && <Card icon="🎯" label="Indice" value={r.indice_vente.toFixed(1)} color="teal" />}
    </div>
  );
}
