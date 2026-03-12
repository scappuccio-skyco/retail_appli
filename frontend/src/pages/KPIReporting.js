import React, { useState, useEffect } from 'react';
import { api } from '../lib/apiClient';
import { logger } from '../utils/logger';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { toast } from 'sonner';

export default function KPIReporting({ user, onBack }) {
  const navigate = useNavigate();
  const [entries, setEntries] = useState([]); // Entries filtrées pour les graphiques
  const [allEntries, setAllEntries] = useState([]); // TOUTES les entrées pour le détail
  const [kpiConfig, setKpiConfig] = useState(null); // Configuration KPI du manager
  const [kpiMetrics, setKpiMetrics] = useState(null); // Agrégats serveur (source de vérité)
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
      const days = period === 'week' ? 7 : period === 'month' ? 30 : period === 'quarter' ? 90 : 365;
      // Récupérer la config KPI, les entrées et les métriques agrégées côté serveur
      const [configRes, allRes, filteredRes, metricsRes] = await Promise.all([
        api.get('/seller/kpi-config'),
        api.get('/seller/kpi-entries?days=365'),
        api.get(`/seller/kpi-entries?days=${days}`),
        api.get(`/seller/kpi-metrics?days=${days}`)
      ]);

      setKpiConfig(configRes.data);
      const allEntriesData = Array.isArray(allRes.data) ? allRes.data : (allRes.data?.items || []);
      const filteredEntriesData = Array.isArray(filteredRes.data) ? filteredRes.data : (filteredRes.data?.items || []);
      setAllEntries(allEntriesData);
      setEntries(filteredEntriesData);
      setKpiMetrics(metricsRes.data);
    } catch (err) {
      logger.error('Error loading KPI data:', err);
      toast.error('Erreur de chargement des KPI');
    } finally {
      setLoading(false);
    }
  };

  // Build stats from server-side aggregation (source de vérité — évite les erreurs de pagination)
  const calculateStats = () => {
    if (!kpiMetrics || !kpiConfig) return null;

    const stats = { nbJours: kpiMetrics.nb_jours ?? entries.length };

    if (kpiConfig.track_ca) {
      stats.totalCA = (kpiMetrics.ca ?? 0).toFixed(2);
    }
    if (kpiConfig.track_ventes) {
      stats.totalVentes = kpiMetrics.ventes ?? 0;
    }
    if (kpiConfig.track_clients) {
      stats.totalClients = entries.reduce((sum, e) => sum + (e.nb_clients || 0), 0);
    }
    if (kpiConfig.track_articles) {
      stats.totalArticles = kpiMetrics.articles ?? 0;
    }
    // panier_moyen = CA total / ventes totales (calculé côté serveur, pas moyenne de moyennes)
    if (kpiConfig.track_ca && kpiConfig.track_ventes && kpiMetrics.panier_moyen != null) {
      stats.avgPanierMoyen = (kpiMetrics.panier_moyen ?? 0).toFixed(2);
    }
    // taux_transformation = ventes / prospects (calculé côté serveur)
    if (kpiConfig.track_ventes && kpiConfig.track_prospects && kpiMetrics.taux_transformation != null) {
      stats.avgTauxTransfo = (kpiMetrics.taux_transformation ?? 0).toFixed(2);
    }
    // indice_vente = articles / ventes (calculé côté serveur)
    if (kpiConfig.track_ca && kpiConfig.track_articles && kpiMetrics.indice_vente != null) {
      stats.avgIndiceVente = (kpiMetrics.indice_vente ?? 0).toFixed(2);
    }

    return stats;
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
            indiceVenteSum: 0,
            count: 0
          };
        }
        
        monthlyData[monthKey].ca += entry.ca_journalier || 0;
        monthlyData[monthKey].ventes += entry.nb_ventes || 0;
        monthlyData[monthKey].clients += entry.nb_clients || 0;
        monthlyData[monthKey].panierMoyenSum += entry.panier_moyen || 0;
        monthlyData[monthKey].tauxTransfoSum += entry.taux_transformation || 0;
        monthlyData[monthKey].indiceVenteSum += entry.indice_vente || 0;
        monthlyData[monthKey].count += 1;
      });
      
      return Object.keys(monthlyData).sort((a, b) => a.localeCompare(b, 'fr-FR')).map(monthKey => {
        const data = monthlyData[monthKey];
        const [year, month] = monthKey.split('-');
        const monthName = new Date(year, month - 1).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
        
        return {
          date: monthName,
          ca: data.ca,
          ventes: data.ventes,
          clients: data.clients,
          panierMoyen: data.panierMoyenSum / data.count,
          tauxTransfo: data.tauxTransfoSum / data.count,
          indiceVente: data.indiceVenteSum / data.count
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
            indiceVenteSum: 0,
            count: 0
          };
        }
        
        weeklyData[weekKey].ca += entry.ca_journalier || 0;
        weeklyData[weekKey].ventes += entry.nb_ventes || 0;
        weeklyData[weekKey].clients += entry.nb_clients || 0;
        weeklyData[weekKey].panierMoyenSum += entry.panier_moyen || 0;
        weeklyData[weekKey].tauxTransfoSum += entry.taux_transformation || 0;
        weeklyData[weekKey].indiceVenteSum += entry.indice_vente || 0;
        weeklyData[weekKey].count += 1;
      });
      
      return Object.keys(weeklyData).sort((a, b) => a.localeCompare(b, 'fr-FR')).map(weekKey => {
        const data = weeklyData[weekKey];
        const weekDate = new Date(weekKey);
        const weekLabel = `S${Math.ceil((weekDate.getDate() + 6 - weekDate.getDay()) / 7)} ${weekDate.toLocaleDateString('fr-FR', { month: 'short' })}`;
        
        return {
          date: weekLabel,
          ca: data.ca,
          ventes: data.ventes,
          clients: data.clients,
          panierMoyen: data.panierMoyenSum / data.count,
          tauxTransfo: data.tauxTransfoSum / data.count,
          indiceVente: data.indiceVenteSum / data.count
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
      tauxTransfo: entry.taux_transformation,
      indiceVente: entry.indice_vente
    }));
  };

  const stats = calculateStats();
  const chartData = prepareChartData();

  if (loading) {
    return (
      <div className="p-4">
        <div className="text-center py-12">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="max-w-full mx-auto">
        {/* Header */}
        <div className="glass-morphism rounded-2xl p-6 mb-6">`
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
            {/* Summary Cards - Dynamiques selon config */}
            {stats && kpiConfig && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
                {kpiConfig.track_ca && stats.totalCA !== undefined && (
                  <div className="glass-morphism rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">💰</span>
                      <p className="text-sm text-gray-600">CA Total</p>
                    </div>
                    <p className="text-2xl font-bold text-gray-800">{stats.totalCA}€</p>
                    <p className="text-xs text-gray-500 mt-1">{stats.nbJours} jours</p>
                  </div>
                )}

                {kpiConfig.track_ventes && stats.totalVentes !== undefined && (
                  <div className="glass-morphism rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">🛍️</span>
                      <p className="text-sm text-gray-600">Ventes</p>
                    </div>
                    <p className="text-2xl font-bold text-gray-800">{stats.totalVentes}</p>
                    <p className="text-xs text-gray-500 mt-1">Total période</p>
                  </div>
                )}

                {kpiConfig.track_clients && stats.totalClients !== undefined && (
                  <div className="glass-morphism rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">👥</span>
                      <p className="text-sm text-gray-600">Clients</p>
                    </div>
                    <p className="text-2xl font-bold text-gray-800">{stats.totalClients}</p>
                    <p className="text-xs text-gray-500 mt-1">Accueillis</p>
                  </div>
                )}

                {kpiConfig.track_articles && stats.totalArticles !== undefined && (
                  <div className="glass-morphism rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">📦</span>
                      <p className="text-sm text-gray-600">Articles</p>
                    </div>
                    <p className="text-2xl font-bold text-gray-800">{stats.totalArticles}</p>
                    <p className="text-xs text-gray-500 mt-1">Vendus</p>
                  </div>
                )}

                {stats.avgPanierMoyen !== undefined && (
                  <div className="glass-morphism rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">🛒</span>
                      <p className="text-sm text-gray-600">Panier Moyen</p>
                    </div>
                    <p className="text-2xl font-bold text-gray-800">{stats.avgPanierMoyen}€</p>
                    <p className="text-xs text-gray-500 mt-1">Moyenne</p>
                  </div>
                )}

                {stats.avgTauxTransfo !== undefined && (
                  <div className="glass-morphism rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">📈</span>
                      <p className="text-sm text-gray-600">Taux Transfo</p>
                    </div>
                    <p className="text-2xl font-bold text-gray-800">{stats.avgTauxTransfo}%</p>
                    <p className="text-xs text-gray-500 mt-1">Moyenne</p>
                  </div>
                )}

                {stats.avgIndiceVente !== undefined && (
                  <div className="glass-morphism rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">💎</span>
                      <p className="text-sm text-gray-600">Indice Vente</p>
                    </div>
                    <p className="text-2xl font-bold text-gray-800">{stats.avgIndiceVente}€</p>
                    <p className="text-xs text-gray-500 mt-1">Moyenne</p>
                  </div>
                )}
              </div>
            )}

            {/* Charts - Conditionnels selon config KPI */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* CA Evolution - Afficher seulement si CA est configuré */}
              {kpiConfig?.track_ca && (
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
              )}

              {/* Ventes vs Clients - Afficher seulement si Ventes ET Clients sont configurés */}
              {kpiConfig?.track_ventes && kpiConfig?.track_prospects && (
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
              )}

              {/* Panier Moyen Evolution - Afficher seulement si CA ET Ventes sont configurés */}
              {kpiConfig?.track_ca && kpiConfig?.track_ventes && (
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
              )}

              {/* Taux de Transformation - Afficher seulement si Ventes ET Clients sont configurés */}
              {kpiConfig?.track_ventes && kpiConfig?.track_prospects && (
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
              )}

              {/* Indice de Vente - Afficher seulement si CA ET Articles sont configurés */}
              {kpiConfig?.track_ca && kpiConfig?.track_articles && (
                <div className="glass-morphism rounded-2xl p-6">
                  <h3 className="text-lg font-bold text-gray-800 mb-4">💎 Indice de Vente</h3>
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

            {/* Detailed Table - Accordion - Conditionnel selon config KPI */}
            <div className="glass-morphism rounded-2xl p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4">📋 Détail des saisies ({allEntries.length})</h3>
              
              {/* Always show last 3 entries - Colonnes dynamiques */}
              <div className="space-y-3 mb-4">
                {allEntries.slice(0, 3).map((entry) => (
                  <div key={entry.id} className="bg-white rounded-xl p-4 border border-gray-200">
                    <div className="flex justify-between items-center mb-3">
                      <p className="text-sm font-semibold text-gray-700">
                        {new Date(entry.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long' })}
                      </p>
                    </div>
                    <div className={`grid gap-2 ${
                      kpiConfig ? `grid-cols-${Math.min(
                        [
                          kpiConfig.track_ca,
                          kpiConfig.track_ventes,
                          kpiConfig.track_clients,
                          kpiConfig.track_articles,
                          kpiConfig.track_ca && kpiConfig.track_ventes, // Panier moyen
                          kpiConfig.track_ventes && kpiConfig.track_clients, // Taux transfo
                          kpiConfig.track_ca && kpiConfig.track_articles // Indice vente
                        ].filter(Boolean).length,
                        5
                      )}` : 'grid-cols-5'
                    } md:grid-cols-${Math.min(
                      kpiConfig ? [
                        kpiConfig.track_ca,
                        kpiConfig.track_ventes,
                        kpiConfig.track_clients,
                        kpiConfig.track_articles,
                        kpiConfig.track_ca && kpiConfig.track_ventes,
                        kpiConfig.track_ventes && kpiConfig.track_clients,
                        kpiConfig.track_ca && kpiConfig.track_articles
                      ].filter(Boolean).length : 7,
                      7
                    )}`}>
                      {kpiConfig?.track_ca && (
                        <div className="bg-blue-50 rounded-lg p-3">
                          <p className="text-xs text-blue-600 mb-1">💰 CA</p>
                          <p className="text-lg font-bold text-blue-900">{entry.ca_journalier?.toFixed(2)}€</p>
                        </div>
                      )}
                      {kpiConfig?.track_ventes && (
                        <div className="bg-green-50 rounded-lg p-3">
                          <p className="text-xs text-green-600 mb-1">🛒 Ventes</p>
                          <p className="text-lg font-bold text-green-900">{entry.nb_ventes}</p>
                        </div>
                      )}
                      {kpiConfig?.track_clients && (
                        <div className="bg-purple-50 rounded-lg p-3">
                          <p className="text-xs text-purple-600 mb-1">👥 Clients</p>
                          <p className="text-lg font-bold text-purple-900">{entry.nb_clients}</p>
                        </div>
                      )}
                      {kpiConfig?.track_articles && (
                        <div className="bg-orange-50 rounded-lg p-3">
                          <p className="text-xs text-orange-600 mb-1">📦 Articles</p>
                          <p className="text-lg font-bold text-orange-900">{entry.nb_articles || 0}</p>
                        </div>
                      )}
                      {kpiConfig?.track_ca && kpiConfig?.track_ventes && (
                        <div className="bg-indigo-50 rounded-lg p-3">
                          <p className="text-xs text-indigo-600 mb-1">🧮 Panier Moyen</p>
                          <p className="text-lg font-bold text-indigo-900">{entry.panier_moyen?.toFixed(2)}€</p>
                        </div>
                      )}
                      {kpiConfig?.track_ventes && kpiConfig?.track_prospects && (
                        <div className="bg-pink-50 rounded-lg p-3">
                          <p className="text-xs text-pink-600 mb-1">📊 Taux Transfo</p>
                          <p className="text-lg font-bold text-pink-900">{entry.taux_transformation?.toFixed(2)}%</p>
                        </div>
                      )}
                      {kpiConfig?.track_ca && kpiConfig?.track_articles && (
                        <div className="bg-teal-50 rounded-lg p-3">
                          <p className="text-xs text-teal-600 mb-1">🎯 Indice Vente</p>
                          <p className="text-lg font-bold text-teal-900">{entry.indice_vente?.toFixed(2)}€</p>
                        </div>
                      )}
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
                            {kpiConfig?.track_ca && (
                              <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">CA</th>
                            )}
                            {kpiConfig?.track_ventes && (
                              <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Ventes</th>
                            )}
                            {kpiConfig?.track_clients && (
                              <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Clients</th>
                            )}
                            {kpiConfig?.track_articles && (
                              <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Articles</th>
                            )}
                            {kpiConfig?.track_ca && kpiConfig?.track_ventes && (
                              <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Panier Moyen</th>
                            )}
                            {kpiConfig?.track_ventes && kpiConfig?.track_prospects && (
                              <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Taux Transfo</th>
                            )}
                            {kpiConfig?.track_ca && kpiConfig?.track_articles && (
                              <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Indice Vente</th>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {allEntries.map((entry, index) => (
                            <tr key={entry.id} className="border-b border-gray-100 hover:bg-gray-50">
                              <td className="py-3 px-4 text-sm text-gray-800">
                                {new Date(entry.date).toLocaleDateString('fr-FR')}
                              </td>
                              {kpiConfig?.track_ca && (
                                <td className="py-3 px-4 text-sm text-right font-medium text-gray-800">
                                  {entry.ca_journalier?.toFixed(2)}€
                                </td>
                              )}
                              {kpiConfig?.track_ventes && (
                                <td className="py-3 px-4 text-sm text-right text-gray-800">
                                  {entry.nb_ventes}
                                </td>
                              )}
                              {kpiConfig?.track_clients && (
                                <td className="py-3 px-4 text-sm text-right text-gray-800">
                                  {entry.nb_clients}
                                </td>
                              )}
                              {kpiConfig?.track_articles && (
                                <td className="py-3 px-4 text-sm text-right text-gray-800">
                                  {entry.nb_articles || 0}
                                </td>
                              )}
                              {kpiConfig?.track_ca && kpiConfig?.track_ventes && (
                                <td className="py-3 px-4 text-sm text-right text-gray-800">
                                  {entry.panier_moyen?.toFixed(2)}€
                                </td>
                              )}
                              {kpiConfig?.track_ventes && kpiConfig?.track_prospects && (
                                <td className="py-3 px-4 text-sm text-right text-gray-800">
                                  {entry.taux_transformation?.toFixed(2)}%
                                </td>
                              )}
                              {kpiConfig?.track_ca && kpiConfig?.track_articles && (
                                <td className="py-3 px-4 text-sm text-right text-gray-800">
                                  {entry.indice_vente?.toFixed(2)}€
                                </td>
                              )}
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
