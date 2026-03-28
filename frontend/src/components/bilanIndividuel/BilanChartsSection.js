import React, { useState } from 'react';
import { BarChart3, ChevronLeft, ChevronRight } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function BilanChartsSection({ chartData, kpiConfig }) {
  const [activeChart, setActiveChart] = useState(0);

  if (!chartData || chartData.length === 0) return null;

  const chartDefs = [
    kpiConfig?.track_ca && {
      label: '💰 Évolution du CA',
      content: (
        <div className="bg-blue-50 rounded-xl p-4">
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#1e40af' }} stroke="#3b82f6" />
              <YAxis tick={{ fontSize: 11, fill: '#1e40af' }} stroke="#3b82f6" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#eff6ff',
                  border: '2px solid #3b82f6',
                  borderRadius: '8px',
                  fontSize: '12px'
                }}
              />
              <Line type="monotone" dataKey="CA" stroke="#3b82f6" strokeWidth={3} dot={{ fill: '#1e40af', r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ),
    },
    kpiConfig?.track_ventes && {
      label: '🛒 Évolution des Ventes',
      content: (
        <div className="bg-green-50 rounded-xl p-4">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#d1fae5" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#166534' }} stroke="#22c55e" />
              <YAxis tick={{ fontSize: 11, fill: '#166534' }} stroke="#22c55e" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#f0fdf4',
                  border: '2px solid #22c55e',
                  borderRadius: '8px',
                  fontSize: '12px'
                }}
              />
              <Bar dataKey="Ventes" fill="#22c55e" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ),
    },
    (kpiConfig?.track_ca && kpiConfig?.track_ventes) && {
      label: '💳 Évolution du Panier Moyen',
      content: (
        <div className="bg-indigo-50 rounded-xl p-4">
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#3730a3' }} stroke="#6366f1" />
              <YAxis tick={{ fontSize: 11, fill: '#3730a3' }} stroke="#6366f1" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#eef2ff',
                  border: '2px solid #6366f1',
                  borderRadius: '8px',
                  fontSize: '12px'
                }}
              />
              <Line type="monotone" dataKey="Panier Moyen" stroke="#6366f1" strokeWidth={3} dot={{ fill: '#4338ca', r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ),
    },
    kpiConfig?.track_articles && {
      label: '📦 Évolution des Articles',
      content: (
        <div className="bg-orange-50 rounded-xl p-4">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#fed7aa" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9a3412' }} stroke="#f97316" />
              <YAxis tick={{ fontSize: 11, fill: '#9a3412' }} stroke="#f97316" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff7ed',
                  border: '2px solid #f97316',
                  borderRadius: '8px',
                  fontSize: '12px'
                }}
              />
              <Bar dataKey="Articles" fill="#f97316" radius={[8, 8, 0, 0]} />
            </BarChart>
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
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="w-5 h-5 text-blue-600" />
        <h3 className="font-bold text-gray-800">📊 Évolution de la semaine</h3>
      </div>

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
    </div>
  );
}
