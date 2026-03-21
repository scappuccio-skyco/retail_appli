import React from 'react';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

const tooltipStyle = {
  contentStyle: { backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' },
};

export default function KPIChartsSection({ chartData, kpiConfig }) {
  if (!kpiConfig) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      {/* CA Evolution */}
      {kpiConfig.track_ca && (
        <div className="glass-morphism rounded-2xl p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">📈 Évolution du CA</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" stroke="#6b7280" fontSize={12} />
              <YAxis stroke="#6b7280" fontSize={12} />
              <Tooltip {...tooltipStyle} formatter={(value) => `${value}€`} />
              <Line
                type="monotone"
                dataKey="ca"
                stroke="#ffd871"
                strokeWidth={3}
                name="CA"
                dot={{ fill: '#ffd871', r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Ventes vs Clients */}
      {kpiConfig.track_ventes && kpiConfig.track_prospects && (
        <div className="glass-morphism rounded-2xl p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">🛍️ Ventes vs Clients</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" stroke="#6b7280" fontSize={12} />
              <YAxis stroke="#6b7280" fontSize={12} />
              <Tooltip {...tooltipStyle} />
              <Legend />
              <Bar dataKey="ventes" fill="#ffd871" name="Ventes" />
              <Bar dataKey="clients" fill="#93c5fd" name="Clients" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Panier Moyen Evolution */}
      {kpiConfig.track_ca && kpiConfig.track_ventes && (
        <div className="glass-morphism rounded-2xl p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">🛒 Panier Moyen</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" stroke="#6b7280" fontSize={12} />
              <YAxis stroke="#6b7280" fontSize={12} />
              <Tooltip {...tooltipStyle} formatter={(value) => `${value}€`} />
              <Line
                type="monotone"
                dataKey="panierMoyen"
                stroke="#10b981"
                strokeWidth={3}
                name="Panier Moyen"
                dot={{ fill: '#10b981', r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Taux de Transformation */}
      {kpiConfig.track_ventes && kpiConfig.track_prospects && (
        <div className="glass-morphism rounded-2xl p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">📊 Taux de Transformation</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" stroke="#6b7280" fontSize={12} />
              <YAxis stroke="#6b7280" fontSize={12} />
              <Tooltip {...tooltipStyle} formatter={(value) => `${value}%`} />
              <Line
                type="monotone"
                dataKey="tauxTransfo"
                stroke="#8b5cf6"
                strokeWidth={3}
                name="Taux de Transformation"
                dot={{ fill: '#8b5cf6', r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Indice de Vente */}
      {kpiConfig.track_ca && kpiConfig.track_articles && (
        <div className="glass-morphism rounded-2xl p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">💎 Indice de Vente</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" stroke="#6b7280" fontSize={12} />
              <YAxis stroke="#6b7280" fontSize={12} />
              <Tooltip {...tooltipStyle} formatter={(value) => `${value}€`} />
              <Line
                type="monotone"
                dataKey="indiceVente"
                stroke="#f59e0b"
                strokeWidth={3}
                name="Indice de Vente"
                dot={{ fill: '#f59e0b', r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
