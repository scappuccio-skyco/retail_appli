import React, { useMemo, useRef } from 'react';
import { Sparkles, X, TrendingUp, AlertTriangle, Target, ChevronLeft, ChevronRight, BarChart3, Download } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export default function BilanIndividuelModal({ bilan, kpiConfig, kpiEntries, onClose, currentWeekOffset, onWeekChange, onRegenerate, generatingBilan }) {
  if (!bilan) return null;

  // Prepare chart data from KPI entries for current week
  const chartData = useMemo(() => {
    if (!kpiEntries || kpiEntries.length === 0) return [];
    
    // Get current week dates
    const now = new Date();
    const offsetDays = currentWeekOffset * 7;
    const monday = new Date(now);
    monday.setDate(monday.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1) + offsetDays);
    monday.setHours(0, 0, 0, 0);
    
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    
    // Filter entries for current week
    const weekEntries = kpiEntries.filter(entry => {
      const entryDate = new Date(entry.date);
      return entryDate >= monday && entryDate <= sunday;
    });
    
    // Sort by date
    const sortedEntries = weekEntries.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // Transform for charts
    return sortedEntries.map(entry => ({
      date: new Date(entry.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' }),
      CA: entry.ca_journalier || 0,
      Ventes: entry.nb_ventes || 0,
      Articles: entry.nb_articles || 0,
      'Panier Moyen': entry.ca_journalier && entry.nb_ventes ? (entry.ca_journalier / entry.nb_ventes).toFixed(2) : 0
    }));
  }, [kpiEntries, currentWeekOffset]);

  // Calculate week-over-week comparison
  const comparisonData = useMemo(() => {
    if (!bilan || !bilan.kpi_resume) return null;
    
    const current = bilan.kpi_resume;
    // This would need previous week data - for now showing trend indicators
    return {
      ca_trend: current.ca_total > 0 ? 'up' : 'stable',
      ventes_trend: current.ventes > 0 ? 'up' : 'stable'
    };
  }, [bilan]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl my-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#ffd871] to-yellow-300 p-6 rounded-t-2xl relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-700 hover:text-gray-900 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Sparkles className="w-8 h-8 text-gray-800" />
              <div>
                <h2 className="text-2xl font-bold text-gray-800">🤖 Mon Bilan Individuel</h2>
                <p className="text-sm text-gray-700">📅 {currentWeekOffset === 0 ? 'Semaine actuelle' : bilan.periode}</p>
              </div>
            </div>
            
            {/* Week Navigation - Enhanced */}
            {onWeekChange && (
              <div className="flex items-center gap-3 mr-10 bg-white bg-opacity-50 rounded-xl px-3 py-2">
                <button
                  onClick={() => onWeekChange(currentWeekOffset - 1)}
                  className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-all shadow-md hover:shadow-lg"
                  title="Semaine précédente"
                >
                  <ChevronLeft className="w-5 h-5 text-white" />
                </button>
                <div className="text-center px-2">
                  <p className="text-xs font-semibold text-gray-700">Naviguer</p>
                  <p className="text-xs text-gray-600">← Semaines →</p>
                </div>
                <button
                  onClick={() => onWeekChange(currentWeekOffset + 1)}
                  disabled={currentWeekOffset === 0}
                  className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-all shadow-md hover:shadow-lg disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Semaine suivante"
                >
                  <ChevronRight className="w-5 h-5 text-white" />
                </button>
              </div>
            )}
          </div>
          
          {/* Regenerate button */}
          {onRegenerate && (
            <button
              onClick={onRegenerate}
              disabled={generatingBilan}
              className="mt-3 px-4 py-2 bg-white bg-opacity-50 hover:bg-opacity-70 text-gray-800 font-semibold rounded-lg transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <TrendingUp className={`w-4 h-4 ${generatingBilan ? 'animate-spin' : ''}`} />
              {generatingBilan ? 'Génération...' : 'Regénérer le bilan'}
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {/* KPI Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {kpiConfig?.track_ca && bilan.kpi_resume.ca_total !== undefined && (
              <div className="bg-blue-50 rounded-lg p-3">
                <p className="text-xs text-blue-600 mb-1">💰 CA</p>
                <p className="text-lg font-bold text-blue-900">{bilan.kpi_resume.ca_total.toFixed(0)}€</p>
              </div>
            )}
            {kpiConfig?.track_ventes && bilan.kpi_resume.ventes !== undefined && (
              <div className="bg-green-50 rounded-lg p-3">
                <p className="text-xs text-green-600 mb-1">🛒 Ventes</p>
                <p className="text-lg font-bold text-green-900">{bilan.kpi_resume.ventes}</p>
              </div>
            )}
            {kpiConfig?.track_clients && bilan.kpi_resume.clients !== undefined && (
              <div className="bg-purple-50 rounded-lg p-3">
                <p className="text-xs text-purple-600 mb-1">👥 Clients</p>
                <p className="text-lg font-bold text-purple-900">{bilan.kpi_resume.clients}</p>
              </div>
            )}
            {kpiConfig?.track_articles && bilan.kpi_resume.articles !== undefined && (
              <div className="bg-orange-50 rounded-lg p-3">
                <p className="text-xs text-orange-600 mb-1">📦 Articles</p>
                <p className="text-lg font-bold text-orange-900">{bilan.kpi_resume.articles}</p>
              </div>
            )}
            {kpiConfig?.track_ca && kpiConfig?.track_ventes && bilan.kpi_resume.panier_moyen !== undefined && (
              <div className="bg-indigo-50 rounded-lg p-3">
                <p className="text-xs text-indigo-600 mb-1">💳 P. Moyen</p>
                <p className="text-lg font-bold text-indigo-900">{bilan.kpi_resume.panier_moyen.toFixed(0)}€</p>
              </div>
            )}
            {kpiConfig?.track_ventes && kpiConfig?.track_clients && bilan.kpi_resume.taux_transformation !== undefined && (
              <div className="bg-pink-50 rounded-lg p-3">
                <p className="text-xs text-pink-600 mb-1">📈 Taux Transfo</p>
                <p className="text-lg font-bold text-pink-900">{bilan.kpi_resume.taux_transformation.toFixed(0)}%</p>
              </div>
            )}
            {kpiConfig?.track_articles && kpiConfig?.track_clients && bilan.kpi_resume.indice_vente !== undefined && (
              <div className="bg-teal-50 rounded-lg p-3">
                <p className="text-xs text-teal-600 mb-1">🎯 Indice</p>
                <p className="text-lg font-bold text-teal-900">{bilan.kpi_resume.indice_vente.toFixed(1)}</p>
              </div>
            )}
          </div>

          {/* Charts Section */}
          {chartData && chartData.length > 0 && (
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
          )}

          {/* Synthèse */}
          <div className="bg-gradient-to-r from-[#ffd871] to-yellow-200 rounded-xl p-4 mb-4">
            <p className="text-gray-800 font-medium">{bilan.synthese}</p>
          </div>

          {/* Points forts */}
          <div className="bg-green-50 rounded-xl p-4 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-5 h-5 text-green-600" />
              <h3 className="font-bold text-green-900">💪 Tes points forts</h3>
            </div>
            <ul className="space-y-2">
              {bilan.points_forts && bilan.points_forts.map((point, idx) => (
                <li key={idx} className="flex items-start gap-2 text-green-800">
                  <span className="text-green-600 mt-1">✓</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Points d'attention */}
          <div className="bg-orange-50 rounded-xl p-4 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
              <h3 className="font-bold text-orange-900">⚠️ Points à améliorer</h3>
            </div>
            <ul className="space-y-2">
              {bilan.points_attention && bilan.points_attention.map((point, idx) => (
                <li key={idx} className="flex items-start gap-2 text-orange-800">
                  <span className="text-orange-600 mt-1">!</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Recommandations personnalisées */}
          <div className="bg-blue-50 rounded-xl p-4 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-5 h-5 text-blue-600" />
              <h3 className="font-bold text-blue-900">🎯 Recommandations personnalisées</h3>
            </div>
            <ul className="space-y-2">
              {bilan.recommandations && bilan.recommandations.map((action, idx) => (
                <li key={idx} className="flex items-start gap-2 text-blue-800">
                  <span className="text-blue-600 font-bold mt-1">{idx + 1}.</span>
                  <span>{action}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
