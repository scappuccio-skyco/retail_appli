import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function KPIReporting({ user, onBack }) {
  const navigate = useNavigate();
  const [entries, setEntries] = useState([]); // Entries filtrées pour les graphiques
  const [allEntries, setAllEntries] = useState([]); // TOUTES les entrées pour le détail
  const [kpiConfig, setKpiConfig] = useState(null); // Configuration KPI du manager
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('week'); // week, month, quarter, year
  const [compareYear, setCompareYear] = useState(false);
  const [showDetailTable, setShowDetailTable] = useState(false);
  const [showAllEntries, setShowAllEntries] = useState(false); // Pour le bouton "Voir plus"

  useEffect(() => {
    fetchKPIData();
  }, [period]);

  const fetchKPIData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      
      // Récupérer la config KPI et les entrées
      const [configRes, allRes, filteredRes] = await Promise.all([
        axios.get(`${API}/seller/kpi-config`, { headers }),
        axios.get(`${API}/seller/kpi-entries`, { headers }),
        axios.get(`${API}/seller/kpi-entries?days=${period === 'week' ? 7 : period === 'month' ? 30 : period === 'quarter' ? 90 : 365}`, { headers })
      ]);
      
      setKpiConfig(configRes.data);
      setAllEntries(allRes.data);
      setEntries(filteredRes.data);
    } catch (err) {
      console.error('Error loading KPI data:', err);
      toast.error('Erreur de chargement des KPI');
    } finally {
      setLoading(false);
    }
  };

  // Calculate aggregated stats
  const calculateStats = () => {
    if (entries.length === 0) return null;

    const totalCA = entries.reduce((sum, e) => sum + (e.ca_journalier || 0), 0);
    const totalVentes = entries.reduce((sum, e) => sum + (e.nb_ventes || 0), 0);
    const totalClients = entries.reduce((sum, e) => sum + (e.nb_clients || 0), 0);
    const avgPanierMoyen = entries.reduce((sum, e) => sum + (e.panier_moyen || 0), 0) / entries.length;
    const avgTauxTransfo = entries.reduce((sum, e) => sum + (e.taux_transformation || 0), 0) / entries.length;

    return {
      totalCA: totalCA.toFixed(2),
      totalVentes,
      totalClients,
      avgPanierMoyen: avgPanierMoyen.toFixed(2),
      avgTauxTransfo: avgTauxTransfo.toFixed(2),
      nbJours: entries.length
    };
  };

  // Prepare chart data
  const prepareChartData = () => {
    if (period === 'year') {
      // Agrégation mensuelle pour la vue "1 an"
      const monthlyData = {};
      
      entries.forEach(entry => {
        const date = new Date(entry.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = {
            ca: 0,
            ventes: 0,
            clients: 0,
            panierMoyenSum: 0,
            tauxTransfoSum: 0,
            count: 0
          };
        }
        
        monthlyData[monthKey].ca += entry.ca_journalier || 0;
        monthlyData[monthKey].ventes += entry.nb_ventes || 0;
        monthlyData[monthKey].clients += entry.nb_clients || 0;
        monthlyData[monthKey].panierMoyenSum += entry.panier_moyen || 0;
        monthlyData[monthKey].tauxTransfoSum += entry.taux_transformation || 0;
        monthlyData[monthKey].count += 1;
      });
      
      return Object.keys(monthlyData).sort().map(monthKey => {
        const data = monthlyData[monthKey];
        const [year, month] = monthKey.split('-');
        const monthName = new Date(year, month - 1).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
        
        return {
          date: monthName,
          ca: data.ca,
          ventes: data.ventes,
          clients: data.clients,
          panierMoyen: data.panierMoyenSum / data.count,
          tauxTransfo: data.tauxTransfoSum / data.count
        };
      });
    }
    
    if (period === 'quarter') {
      // Agrégation hebdomadaire pour la vue "90 jours"
      const weeklyData = {};
      
      entries.forEach(entry => {
        const date = new Date(entry.date);
        // Obtenir le lundi de la semaine (ISO week)
        const dayOfWeek = date.getDay();
        const diff = date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        const monday = new Date(date.setDate(diff));
        const weekKey = monday.toISOString().split('T')[0]; // Format YYYY-MM-DD
        
        if (!weeklyData[weekKey]) {
          weeklyData[weekKey] = {
            ca: 0,
            ventes: 0,
            clients: 0,
            panierMoyenSum: 0,
            tauxTransfoSum: 0,
            count: 0
          };
        }
        
        weeklyData[weekKey].ca += entry.ca_journalier || 0;
        weeklyData[weekKey].ventes += entry.nb_ventes || 0;
        weeklyData[weekKey].clients += entry.nb_clients || 0;
        weeklyData[weekKey].panierMoyenSum += entry.panier_moyen || 0;
        weeklyData[weekKey].tauxTransfoSum += entry.taux_transformation || 0;
        weeklyData[weekKey].count += 1;
      });
      
      return Object.keys(weeklyData).sort().map(weekKey => {
        const data = weeklyData[weekKey];
        const weekDate = new Date(weekKey);
        const weekLabel = `S${Math.ceil((weekDate.getDate() + 6 - weekDate.getDay()) / 7)} ${weekDate.toLocaleDateString('fr-FR', { month: 'short' })}`;
        
        return {
          date: weekLabel,
          ca: data.ca,
          ventes: data.ventes,
          clients: data.clients,
          panierMoyen: data.panierMoyenSum / data.count,
          tauxTransfo: data.tauxTransfoSum / data.count
        };
      });
    }
    
    // Vue quotidienne pour 7j et 30j
    return entries.slice().reverse().map(entry => ({
      date: new Date(entry.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
      ca: entry.ca_journalier,
      ventes: entry.nb_ventes,
      clients: entry.nb_clients,
      panierMoyen: entry.panier_moyen,
      tauxTransfo: entry.taux_transformation
    }));
  };

  const stats = calculateStats();
  const chartData = prepareChartData();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#fffef9] to-[#fff9e6] p-4">
        <div className="text-center py-12">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#fffef9] to-[#fff9e6] p-4">
      <div className="max-w-7xl mx-auto py-8">
        {/* Header */}
        <div className="glass-morphism rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <button
                onClick={onBack}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <div>
                <h1 className="text-3xl font-bold text-gray-800">📊 Reporting KPI</h1>
                <p className="text-gray-600">{user.name}</p>
              </div>
            </div>

            {/* Period Selector */}
            <div className="flex gap-2">
              <button
                onClick={() => setPeriod('week')}
                className={`px-4 py-2 rounded-full font-medium transition-all ${
                  period === 'week'
                    ? 'bg-[#ffd871] text-gray-800'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                7 jours
              </button>
              <button
                onClick={() => setPeriod('month')}
                className={`px-4 py-2 rounded-full font-medium transition-all ${
                  period === 'month'
                    ? 'bg-[#ffd871] text-gray-800'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                30 jours
              </button>
              <button
                onClick={() => setPeriod('quarter')}
                className={`px-4 py-2 rounded-full font-medium transition-all ${
                  period === 'quarter'
                    ? 'bg-[#ffd871] text-gray-800'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                90 jours
              </button>
              <button
                onClick={() => setPeriod('year')}
                className={`px-4 py-2 rounded-full font-medium transition-all ${
                  period === 'year'
                    ? 'bg-[#ffd871] text-gray-800'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                1 an
              </button>
            </div>
          </div>
        </div>

        {entries.length === 0 ? (
          <div className="glass-morphism rounded-2xl p-12 text-center">
            <BarChart3 className="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600 text-lg mb-2">Aucune donnée disponible</p>
            <p className="text-gray-500 text-sm">Commencez à saisir vos KPI quotidiens</p>
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            {stats && (
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
                <div className="glass-morphism rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">💰</span>
                    <p className="text-sm text-gray-600">CA Total</p>
                  </div>
                  <p className="text-2xl font-bold text-gray-800">{stats.totalCA}€</p>
                  <p className="text-xs text-gray-500 mt-1">{stats.nbJours} jours</p>
                </div>

                <div className="glass-morphism rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">🛍️</span>
                    <p className="text-sm text-gray-600">Ventes</p>
                  </div>
                  <p className="text-2xl font-bold text-gray-800">{stats.totalVentes}</p>
                  <p className="text-xs text-gray-500 mt-1">Total période</p>
                </div>

                <div className="glass-morphism rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">👥</span>
                    <p className="text-sm text-gray-600">Clients</p>
                  </div>
                  <p className="text-2xl font-bold text-gray-800">{stats.totalClients}</p>
                  <p className="text-xs text-gray-500 mt-1">Accueillis</p>
                </div>

                <div className="glass-morphism rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">🛒</span>
                    <p className="text-sm text-gray-600">Panier Moyen</p>
                  </div>
                  <p className="text-2xl font-bold text-gray-800">{stats.avgPanierMoyen}€</p>
                  <p className="text-xs text-gray-500 mt-1">Moyenne période</p>
                </div>

                <div className="glass-morphism rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">📈</span>
                    <p className="text-sm text-gray-600">Taux Transfo</p>
                  </div>
                  <p className="text-2xl font-bold text-gray-800">{stats.avgTauxTransfo}%</p>
                  <p className="text-xs text-gray-500 mt-1">Moyenne période</p>
                </div>
              </div>
            )}

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* CA Evolution */}
              <div className="glass-morphism rounded-2xl p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4">📈 Évolution du CA</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="date" stroke="#6b7280" fontSize={12} />
                    <YAxis stroke="#6b7280" fontSize={12} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                      formatter={(value) => `${value}€`}
                    />
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

              {/* Ventes vs Clients */}
              <div className="glass-morphism rounded-2xl p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4">🛍️ Ventes vs Clients</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="date" stroke="#6b7280" fontSize={12} />
                    <YAxis stroke="#6b7280" fontSize={12} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                    />
                    <Legend />
                    <Bar dataKey="ventes" fill="#ffd871" name="Ventes" />
                    <Bar dataKey="clients" fill="#93c5fd" name="Clients" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Panier Moyen Evolution */}
              <div className="glass-morphism rounded-2xl p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4">🛒 Panier Moyen</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="date" stroke="#6b7280" fontSize={12} />
                    <YAxis stroke="#6b7280" fontSize={12} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                      formatter={(value) => `${value}€`}
                    />
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

              {/* Taux de Transformation */}
              <div className="glass-morphism rounded-2xl p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4">📊 Taux de Transformation</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="date" stroke="#6b7280" fontSize={12} />
                    <YAxis stroke="#6b7280" fontSize={12} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                      formatter={(value) => `${value}%`}
                    />
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
            </div>

            {/* Detailed Table - Accordion */}
            <div className="glass-morphism rounded-2xl p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4">📋 Détail des saisies ({allEntries.length})</h3>
              
              {/* Always show last 3 entries */}
              <div className="space-y-3 mb-4">
                {allEntries.slice(0, 3).map((entry) => (
                  <div key={entry.id} className="bg-white rounded-xl p-4 border border-gray-200">
                    <div className="flex justify-between items-center mb-3">
                      <p className="text-sm font-semibold text-gray-700">
                        {new Date(entry.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long' })}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                      <div>
                        <p className="text-xs text-gray-500">CA</p>
                        <p className="text-sm font-bold text-gray-800">{entry.ca_journalier.toFixed(2)}€</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Ventes</p>
                        <p className="text-sm font-bold text-gray-800">{entry.nb_ventes}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Clients</p>
                        <p className="text-sm font-bold text-gray-800">{entry.nb_clients}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Panier Moyen</p>
                        <p className="text-sm font-bold text-gray-800">{entry.panier_moyen.toFixed(2)}€</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Taux Transfo</p>
                        <p className="text-sm font-bold text-gray-800">{entry.taux_transformation.toFixed(2)}%</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Show "See all" button if more than 3 entries */}
              {allEntries.length > 3 && (
                <>
                  <button
                    onClick={() => setShowAllEntries(!showAllEntries)}
                    className="w-full flex items-center justify-center gap-2 py-3 border-2 border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    <span className="text-sm font-semibold text-gray-700">
                      {showAllEntries ? 'Voir moins' : 'Voir toutes les saisies'}
                    </span>
                    <span className="text-xl font-bold text-gray-600">
                      {showAllEntries ? '−' : '+'}
                    </span>
                  </button>
                  
                  {showAllEntries && (
                    <div className="overflow-x-auto mt-4 animate-fadeIn">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-gray-200">
                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Date</th>
                            <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">CA</th>
                            <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Ventes</th>
                            <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Clients</th>
                            <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Panier Moyen</th>
                            <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Taux Transfo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {allEntries.map((entry, index) => (
                            <tr key={entry.id} className="border-b border-gray-100 hover:bg-gray-50">
                              <td className="py-3 px-4 text-sm text-gray-800">
                                {new Date(entry.date).toLocaleDateString('fr-FR')}
                              </td>
                              <td className="py-3 px-4 text-sm text-right font-medium text-gray-800">
                                {entry.ca_journalier.toFixed(2)}€
                              </td>
                              <td className="py-3 px-4 text-sm text-right text-gray-800">
                                {entry.nb_ventes}
                              </td>
                              <td className="py-3 px-4 text-sm text-right text-gray-800">
                                {entry.nb_clients}
                              </td>
                              <td className="py-3 px-4 text-sm text-right text-gray-800">
                                {entry.panier_moyen.toFixed(2)}€
                              </td>
                              <td className="py-3 px-4 text-sm text-right text-gray-800">
                                {entry.taux_transformation.toFixed(2)}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
