import React from 'react';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

/**
 * 4-chart grid for CA, Ventes, Articles, Prospects.
 * showDots=true for semaine view (larger dots/bars).
 */
export default function KPICharts({ data, kpiConfig, showDots = false }) {
  if (!data || data.length === 0) return null;

  const fs = showDots ? 11 : 10;
  const barRadius = showDots ? [8, 8, 0, 0] : [4, 4, 0, 0];
  const sw = showDots ? 3 : 2;
  const dot = showDots ? { fill: '#1e40af', r: 4 } : false;
  const prospDot = showDots ? { fill: '#7c3aed', r: 4 } : false;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {(kpiConfig?.track_ca ?? true) && (
        <div className="bg-blue-50 rounded-xl p-4">
          <h4 className="text-sm font-semibold text-blue-900 mb-3">💰 Évolution du CA</h4>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" />
              <XAxis dataKey="date" tick={{ fontSize: fs, fill: '#1e40af' }} stroke="#3b82f6" />
              <YAxis tick={{ fontSize: fs, fill: '#1e40af' }} stroke="#3b82f6" />
              <Tooltip contentStyle={{ backgroundColor: '#eff6ff', border: '2px solid #3b82f6', borderRadius: '8px' }} />
              <Line type="monotone" dataKey="CA" stroke="#3b82f6" strokeWidth={sw} dot={dot} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {(kpiConfig?.track_ventes ?? true) && (
        <div className="bg-green-50 rounded-xl p-4">
          <h4 className="text-sm font-semibold text-green-900 mb-3">🛒 Évolution des Ventes</h4>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#d1fae5" />
              <XAxis dataKey="date" tick={{ fontSize: fs, fill: '#065f46' }} stroke="#10b981" />
              <YAxis tick={{ fontSize: fs, fill: '#065f46' }} stroke="#10b981" />
              <Tooltip contentStyle={{ backgroundColor: '#d1fae5', border: '2px solid #10b981', borderRadius: '8px' }} />
              <Bar dataKey="Ventes" fill="#10b981" radius={barRadius} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {(kpiConfig?.track_articles ?? true) && (
        <div className="bg-orange-50 rounded-xl p-4">
          <h4 className="text-sm font-semibold text-orange-900 mb-3">📦 Évolution des Articles</h4>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#fed7aa" />
              <XAxis dataKey="date" tick={{ fontSize: fs, fill: '#9a3412' }} stroke="#f97316" />
              <YAxis tick={{ fontSize: fs, fill: '#9a3412' }} stroke="#f97316" />
              <Tooltip contentStyle={{ backgroundColor: '#ffedd5', border: '2px solid #f97316', borderRadius: '8px' }} />
              <Bar dataKey="Articles" fill="#f97316" radius={barRadius} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {(kpiConfig?.track_prospects ?? true) && (
        <div className="bg-purple-50 rounded-xl p-4">
          <h4 className="text-sm font-semibold text-purple-900 mb-3">🚶 Évolution des Prospects</h4>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e9d5ff" />
              <XAxis dataKey="date" tick={{ fontSize: fs, fill: '#581c87' }} stroke="#a855f7" />
              <YAxis tick={{ fontSize: fs, fill: '#581c87' }} stroke="#a855f7" />
              <Tooltip contentStyle={{ backgroundColor: '#f3e8ff', border: '2px solid #a855f7', borderRadius: '8px' }} />
              <Line type="monotone" dataKey="Prospects" stroke="#a855f7" strokeWidth={sw} dot={prospDot} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {(kpiConfig?.track_ca ?? true) && (kpiConfig?.track_ventes ?? true) && (
        <div className="bg-indigo-50 rounded-xl p-4">
          <h4 className="text-sm font-semibold text-indigo-900 mb-3">💳 Panier moyen (€)</h4>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" />
              <XAxis dataKey="date" tick={{ fontSize: fs, fill: '#3730a3' }} stroke="#6366f1" />
              <YAxis tick={{ fontSize: fs, fill: '#3730a3' }} stroke="#6366f1" />
              <Tooltip
                formatter={(v) => [`${v} €`, 'Panier moyen']}
                contentStyle={{ backgroundColor: '#eef2ff', border: '2px solid #6366f1', borderRadius: '8px' }}
              />
              <Line type="monotone" dataKey="Panier Moyen" stroke="#6366f1" strokeWidth={sw} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {(kpiConfig?.track_ventes ?? true) && (kpiConfig?.track_prospects ?? true) && (
        <div className="bg-pink-50 rounded-xl p-4">
          <h4 className="text-sm font-semibold text-pink-900 mb-3">📈 Taux de transformation (%)</h4>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#fce7f3" />
              <XAxis dataKey="date" tick={{ fontSize: fs, fill: '#9d174d' }} stroke="#ec4899" />
              <YAxis tick={{ fontSize: fs, fill: '#9d174d' }} stroke="#ec4899" domain={[0, 100]} />
              <Tooltip
                formatter={(v) => [`${v} %`, 'Taux transfo']}
                contentStyle={{ backgroundColor: '#fdf2f8', border: '2px solid #ec4899', borderRadius: '8px' }}
              />
              <Line type="monotone" dataKey="Taux Transfo" stroke="#ec4899" strokeWidth={sw} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
