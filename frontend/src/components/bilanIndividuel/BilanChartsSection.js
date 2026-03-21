import React from 'react';
import { BarChart3 } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function BilanChartsSection({ chartData, kpiConfig }) {
  if (!chartData || chartData.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="w-5 h-5 text-blue-600" />
        <h3 className="font-bold text-gray-800">📊 Évolution de la semaine</h3>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* CA Evolution Chart */}
        {kpiConfig?.track_ca && (
          <div className="bg-blue-50 rounded-xl p-4">
            <h4 className="text-sm font-semibold text-blue-900 mb-3">💰 Évolution du CA</h4>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: '#1e40af' }}
                  stroke="#3b82f6"
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#1e40af' }}
                  stroke="#3b82f6"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#eff6ff',
                    border: '2px solid #3b82f6',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="CA"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  dot={{ fill: '#1e40af', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Ventes Evolution Chart */}
        {kpiConfig?.track_ventes && (
          <div className="bg-green-50 rounded-xl p-4">
            <h4 className="text-sm font-semibold text-green-900 mb-3">🛒 Évolution des Ventes</h4>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#d1fae5" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: '#166534' }}
                  stroke="#22c55e"
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#166534' }}
                  stroke="#22c55e"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#f0fdf4',
                    border: '2px solid #22c55e',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                />
                <Bar
                  dataKey="Ventes"
                  fill="#22c55e"
                  radius={[8, 8, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Panier Moyen Chart */}
        {kpiConfig?.track_ca && kpiConfig?.track_ventes && (
          <div className="bg-indigo-50 rounded-xl p-4">
            <h4 className="text-sm font-semibold text-indigo-900 mb-3">💳 Évolution du Panier Moyen</h4>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: '#3730a3' }}
                  stroke="#6366f1"
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#3730a3' }}
                  stroke="#6366f1"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#eef2ff',
                    border: '2px solid #6366f1',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="Panier Moyen"
                  stroke="#6366f1"
                  strokeWidth={3}
                  dot={{ fill: '#4338ca', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Articles Chart */}
        {kpiConfig?.track_articles && (
          <div className="bg-orange-50 rounded-xl p-4">
            <h4 className="text-sm font-semibold text-orange-900 mb-3">📦 Évolution des Articles</h4>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#fed7aa" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: '#9a3412' }}
                  stroke="#f97316"
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#9a3412' }}
                  stroke="#f97316"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff7ed',
                    border: '2px solid #f97316',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                />
                <Bar
                  dataKey="Articles"
                  fill="#f97316"
                  radius={[8, 8, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
