import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

export default function KPICharts({ data, kpiConfig, showDots = false }) {
  const [activeChart, setActiveChart] = useState(0);

  if (!data || data.length === 0) return null;

  const fs = showDots ? 11 : 10;
  const barRadius = showDots ? [8, 8, 0, 0] : [4, 4, 0, 0];
  const sw = showDots ? 3 : 2;
  const dot = showDots ? { fill: '#1e40af', r: 4 } : false;
  const prospDot = showDots ? { fill: '#7c3aed', r: 4 } : false;
  const xInterval = data.length > 15 ? Math.floor(data.length / 7) : 0;
  // Affiche uniquement le numéro du jour sur l'axe X (ex: "lun. 16" → "16")
  // Le tooltip garde la date complète au tap/survol
  const tickFormatter = (val) => { const m = String(val).match(/\d+/); return m ? m[0] : val; };

  const chartDefs = [
    (kpiConfig?.track_ca ?? true) && {
      label: '💰 Évolution du CA',
      content: (
        <div className="bg-blue-50 rounded-xl p-4">
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" />
              <XAxis dataKey="date" tick={{ fontSize: fs, fill: '#1e40af' }} stroke="#3b82f6" interval={xInterval} tickFormatter={tickFormatter} />
              <YAxis tick={{ fontSize: fs, fill: '#1e40af' }} stroke="#3b82f6" />
              <Tooltip formatter={(v) => [typeof v === 'number' ? `${v.toFixed(2)} €` : v, 'CA']} contentStyle={{ backgroundColor: '#eff6ff', border: '2px solid #3b82f6', borderRadius: '8px' }} />
              <Line type="monotone" dataKey="CA" stroke="#3b82f6" strokeWidth={sw} dot={dot} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ),
    },
    (kpiConfig?.track_ventes ?? true) && {
      label: '🛒 Évolution des Ventes',
      content: (
        <div className="bg-green-50 rounded-xl p-4">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#d1fae5" />
              <XAxis dataKey="date" tick={{ fontSize: fs, fill: '#065f46' }} stroke="#10b981" interval={xInterval} tickFormatter={tickFormatter} />
              <YAxis tick={{ fontSize: fs, fill: '#065f46' }} stroke="#10b981" />
              <Tooltip formatter={(v) => [typeof v === 'number' ? v.toFixed(2) : v, 'Ventes']} contentStyle={{ backgroundColor: '#d1fae5', border: '2px solid #10b981', borderRadius: '8px' }} />
              <Bar dataKey="Ventes" fill="#10b981" radius={barRadius} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ),
    },
    (kpiConfig?.track_articles ?? true) && {
      label: '📦 Évolution des Articles',
      content: (
        <div className="bg-orange-50 rounded-xl p-4">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#fed7aa" />
              <XAxis dataKey="date" tick={{ fontSize: fs, fill: '#9a3412' }} stroke="#f97316" interval={xInterval} tickFormatter={tickFormatter} />
              <YAxis tick={{ fontSize: fs, fill: '#9a3412' }} stroke="#f97316" />
              <Tooltip formatter={(v) => [typeof v === 'number' ? v.toFixed(2) : v, 'Articles']} contentStyle={{ backgroundColor: '#ffedd5', border: '2px solid #f97316', borderRadius: '8px' }} />
              <Bar dataKey="Articles" fill="#f97316" radius={barRadius} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ),
    },
    (kpiConfig?.track_prospects ?? true) && {
      label: '🚶 Évolution des Prospects',
      content: (
        <div className="bg-purple-50 rounded-xl p-4">
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e9d5ff" />
              <XAxis dataKey="date" tick={{ fontSize: fs, fill: '#581c87' }} stroke="#a855f7" interval={xInterval} tickFormatter={tickFormatter} />
              <YAxis tick={{ fontSize: fs, fill: '#581c87' }} stroke="#a855f7" />
              <Tooltip formatter={(v) => [typeof v === 'number' ? v.toFixed(2) : v, 'Prospects']} contentStyle={{ backgroundColor: '#f3e8ff', border: '2px solid #a855f7', borderRadius: '8px' }} />
              <Line type="monotone" dataKey="Prospects" stroke="#a855f7" strokeWidth={sw} dot={prospDot} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ),
    },
    ((kpiConfig?.track_ca ?? true) && (kpiConfig?.track_ventes ?? true)) && {
      label: '💳 Panier moyen (€)',
      content: (
        <div className="bg-indigo-50 rounded-xl p-4">
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" />
              <XAxis dataKey="date" tick={{ fontSize: fs, fill: '#3730a3' }} stroke="#6366f1" interval={xInterval} tickFormatter={tickFormatter} />
              <YAxis tick={{ fontSize: fs, fill: '#3730a3' }} stroke="#6366f1" />
              <Tooltip
                formatter={(v) => [typeof v === 'number' ? `${v.toFixed(2)} €` : `${v} €`, 'Panier moyen']}
                contentStyle={{ backgroundColor: '#eef2ff', border: '2px solid #6366f1', borderRadius: '8px' }}
              />
              <Line type="monotone" dataKey="Panier Moyen" stroke="#6366f1" strokeWidth={sw} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ),
    },
    ((kpiConfig?.track_ventes ?? true) && (kpiConfig?.track_prospects ?? true)) && {
      label: '📈 Taux de transformation (%)',
      content: (
        <div className="bg-pink-50 rounded-xl p-4">
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#fce7f3" />
              <XAxis dataKey="date" tick={{ fontSize: fs, fill: '#9d174d' }} stroke="#ec4899" interval={xInterval} tickFormatter={tickFormatter} />
              <YAxis tick={{ fontSize: fs, fill: '#9d174d' }} stroke="#ec4899" domain={[0, 100]} />
              <Tooltip
                formatter={(v) => [typeof v === 'number' ? `${v.toFixed(1)} %` : `${v} %`, 'Taux transfo']}
                contentStyle={{ backgroundColor: '#fdf2f8', border: '2px solid #ec4899', borderRadius: '8px' }}
              />
              <Line type="monotone" dataKey="Taux Transfo" stroke="#ec4899" strokeWidth={sw} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ),
    },
  ].filter(Boolean);

  if (chartDefs.length === 0) return null;

  const active = chartDefs[activeChart % chartDefs.length];
  const prev = () => setActiveChart(i => (i - 1 + chartDefs.length) % chartDefs.length);
  const next = () => setActiveChart(i => (i + 1) % chartDefs.length);

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
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
          <button onClick={prev} className="p-1 rounded-lg hover:bg-gray-100 transition-colors"><ChevronLeft className="w-4 h-4 text-gray-500" /></button>
          <button onClick={next} className="p-1 rounded-lg hover:bg-gray-100 transition-colors"><ChevronRight className="w-4 h-4 text-gray-500" /></button>
        </div>
      </div>
      {active.content}
    </div>
  );
}
