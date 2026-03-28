import React, { useState } from 'react';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const tooltipStyle = {
  contentStyle: { backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' },
};

export default function KPIChartsSection({ chartData, kpiConfig }) {
  const [activeChart, setActiveChart] = useState(0);

  if (!kpiConfig) return null;

  const chartDefs = [
    kpiConfig.track_ca && {
      label: '📈 Évolution du CA',
      content: (
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="date" stroke="#6b7280" fontSize={12} />
            <YAxis stroke="#6b7280" fontSize={12} />
            <Tooltip {...tooltipStyle} formatter={(value) => `${value}€`} />
            <Line type="monotone" dataKey="ca" stroke="#ffd871" strokeWidth={3} name="CA" dot={{ fill: '#ffd871', r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      ),
    },
    kpiConfig.track_ventes && kpiConfig.track_prospects && {
      label: '🛍️ Ventes vs Clients',
      content: (
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
      ),
    },
    kpiConfig.track_ca && kpiConfig.track_ventes && {
      label: '🛒 Panier Moyen',
      content: (
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="date" stroke="#6b7280" fontSize={12} />
            <YAxis stroke="#6b7280" fontSize={12} />
            <Tooltip {...tooltipStyle} formatter={(value) => `${value}€`} />
            <Line type="monotone" dataKey="panierMoyen" stroke="#10b981" strokeWidth={3} name="Panier Moyen" dot={{ fill: '#10b981', r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      ),
    },
    kpiConfig.track_ventes && kpiConfig.track_prospects && {
      label: '📊 Taux de Transformation',
      content: (
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="date" stroke="#6b7280" fontSize={12} />
            <YAxis stroke="#6b7280" fontSize={12} />
            <Tooltip {...tooltipStyle} formatter={(value) => `${value}%`} />
            <Line type="monotone" dataKey="tauxTransfo" stroke="#8b5cf6" strokeWidth={3} name="Taux de Transformation" dot={{ fill: '#8b5cf6', r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      ),
    },
    kpiConfig.track_ca && kpiConfig.track_articles && {
      label: '💎 Indice de Vente',
      content: (
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="date" stroke="#6b7280" fontSize={12} />
            <YAxis stroke="#6b7280" fontSize={12} />
            <Tooltip {...tooltipStyle} formatter={(value) => `${value}€`} />
            <Line type="monotone" dataKey="indiceVente" stroke="#f59e0b" strokeWidth={3} name="Indice de Vente" dot={{ fill: '#f59e0b', r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      ),
    },
  ].filter(Boolean);

  if (chartDefs.length === 0) return null;

  const active = chartDefs[activeChart % chartDefs.length];
  const prev = () => setActiveChart(i => (i - 1 + chartDefs.length) % chartDefs.length);
  const next = () => setActiveChart(i => (i + 1) % chartDefs.length);

  return (
    <div className="glass-morphism rounded-2xl p-6 mb-6">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-gray-700">{active.label}</span>
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            {chartDefs.map((_, i) => (
              <button key={i} onClick={() => setActiveChart(i)}
                className={`h-2 rounded-full transition-all ${i === activeChart ? 'bg-gray-600 w-4' : 'bg-gray-200 w-2 hover:bg-gray-300'}`}
              />
            ))}
          </div>
          <button onClick={prev} className="p-1 rounded-lg hover:bg-gray-100"><ChevronLeft className="w-4 h-4 text-gray-500" /></button>
          <button onClick={next} className="p-1 rounded-lg hover:bg-gray-100"><ChevronRight className="w-4 h-4 text-gray-500" /></button>
        </div>
      </div>
      {active.content}
    </div>
  );
}
