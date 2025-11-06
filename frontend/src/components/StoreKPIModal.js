import React, { useState, useEffect } from 'react';
import { X, TrendingUp, Users, Settings, BarChart3, ChevronLeft, ChevronRight, AlertCircle, CheckCircle, AlertTriangle } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import axios from 'axios';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL || '';

export default function StoreKPIModal({ onClose, onSuccess }) {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'sellers', 'config', 'prospects'
  const [timeFilter, setTimeFilter] = useState('today'); // 'today', 'week', 'month', 'custom'
  const [currentOffset, setCurrentOffset] = useState(0); // Pour navigation semaine/mois
  const [loading, setLoading] = useState(true);
  
  // Data states
  const [storeStats, setStoreStats] = useState(null);
  const [sellersKPI, setSellersKPI] = useState([]);
  const [kpiConfig, setKpiConfig] = useState(null);
  const [evolutionData, setEvolutionData] = useState([]);
  const [alerts, setAlerts] = useState([]);
  
  // Prospect form state
  const [prospectFormData, setProspectFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    nb_prospects: ''
  });

  useEffect(() => {
    fetchData();
  }, [timeFilter, currentOffset]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      
      // Get date range based on filter
      const { startDate, endDate } = getDateRange();
      
      // Fetch KPI config first
      const configRes = await axios.get(`${API}/api/manager/kpi-config`, { headers });
      setKpiConfig(configRes.data || {});
      
      // Fetch store stats
      const statsRes = await axios.get(`${API}/api/manager/store-kpi/stats?start_date=${startDate}&end_date=${endDate}`, { headers });
      setStoreStats(statsRes.data || {});
      
      // Fetch sellers KPI
      const sellersRes = await axios.get(`${API}/api/manager/sellers`, { headers });
      const sellersWithKPI = await Promise.all(
        sellersRes.data.map(async (seller) => {
          try {
            const kpiRes = await axios.get(`${API}/api/manager/kpi-entries/${seller.id}?start_date=${startDate}&end_date=${endDate}`, { headers });
            const statsRes = await axios.get(`${API}/api/manager/seller/${seller.id}/stats`, { headers });
            return {
              ...seller,
              kpi_entries: kpiRes.data || [],
              stats: statsRes.data || {}
            };
          } catch (err) {
            console.error(`Error fetching data for seller ${seller.id}:`, err);
            return {
              ...seller,
              kpi_entries: [],
              stats: {}
            };
          }
        })
      );
      setSellersKPI(sellersWithKPI);
      
      // Calculate alerts
      calculateAlerts(sellersWithKPI, statsRes.data);
      
    } catch (err) {
      console.error('Error fetching store KPI data:', err);
      toast.error('Erreur de chargement des données');
      // Set default values to prevent rendering errors
      setKpiConfig({});
      setStoreStats({});
      setSellersKPI([]);
    } finally {
      setLoading(false);
    }
  };

  const getDateRange = () => {
    const today = new Date();
    let startDate, endDate;
    
    if (timeFilter === 'today') {
      startDate = endDate = today.toISOString().split('T')[0];
    } else if (timeFilter === 'week') {
      const dayOfWeek = today.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(today);
      monday.setDate(today.getDate() + mondayOffset + (currentOffset * 7));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      startDate = monday.toISOString().split('T')[0];
      endDate = sunday.toISOString().split('T')[0];
    } else if (timeFilter === 'month') {
      const firstDay = new Date(today.getFullYear(), today.getMonth() + currentOffset, 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth() + currentOffset + 1, 0);
      startDate = firstDay.toISOString().split('T')[0];
      endDate = lastDay.toISOString().split('T')[0];
    }
    
    return { startDate, endDate };
  };

  const calculateAlerts = (sellers, storeData) => {
    const newAlerts = [];
    
    // Check store-level alerts
    if (storeData?.taux_transformation < 30) {
      newAlerts.push({
        level: 'danger',
        message: `Taux de transformation magasin faible: ${storeData.taux_transformation?.toFixed(1)}%`
      });
    }
    
    // Check seller-level alerts
    const avgCA = sellers.reduce((sum, s) => sum + (s.stats?.ca_total || 0), 0) / sellers.length;
    sellers.forEach(seller => {
      const sellerCA = seller.stats?.ca_total || 0;
      if (sellerCA < avgCA * 0.5) {
        newAlerts.push({
          level: 'warning',
          seller: seller.name,
          message: `${seller.name} : Performance en dessous de la moyenne équipe`
        });
      }
    });
    
    setAlerts(newAlerts);
  };

  const handleProspectSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API}/api/manager/store-kpi`,
        {
          date: prospectFormData.date,
          nb_prospects: parseInt(prospectFormData.nb_prospects)
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Prospects enregistrés avec succès !');
      setProspectFormData({ date: new Date().toISOString().split('T')[0], nb_prospects: '' });
      fetchData();
    } catch (err) {
      console.error('Error saving prospects:', err);
      toast.error('Erreur lors de l\'enregistrement');
    }
  };

  const handleKPIConfigUpdate = async (kpiField, value) => {
    try {
      const token = localStorage.getItem('token');
      const updatedConfig = { ...kpiConfig, [kpiField]: value };
      await axios.put(
        `${API}/api/manager/kpi-config`,
        updatedConfig,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setKpiConfig(updatedConfig);
      toast.success('Configuration KPI mise à jour !');
    } catch (err) {
      console.error('Error updating KPI config:', err);
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const formatDate = (offset = currentOffset) => {
    if (timeFilter === 'today') return "Aujourd'hui";
    
    const today = new Date();
    if (timeFilter === 'week') {
      const dayOfWeek = today.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(today);
      monday.setDate(today.getDate() + mondayOffset + (offset * 7));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return `Semaine du ${monday.getDate()}/${monday.getMonth() + 1} au ${sunday.getDate()}/${sunday.getMonth() + 1}`;
    } else if (timeFilter === 'month') {
      const monthDate = new Date(today.getFullYear(), today.getMonth() + offset, 1);
      const months = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
      return `${months[monthDate.getMonth()]} ${monthDate.getFullYear()}`;
    }
  };

  const getAlertIcon = (level) => {
    if (level === 'danger') return <AlertCircle className="w-5 h-5 text-red-500" />;
    if (level === 'warning') return <AlertTriangle className="w-5 h-5 text-orange-500" />;
    return <CheckCircle className="w-5 h-5 text-green-500" />;
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Chargement des KPI...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-7xl my-8 shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-600 to-emerald-600 p-6 rounded-t-2xl">
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3">
              <BarChart3 className="w-8 h-8 text-white" />
              <div>
                <h2 className="text-2xl font-bold text-white">Vue d'ensemble KPI Magasin</h2>
                <p className="text-teal-100 text-sm">Analyse des performances du point de vente</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Time Filters */}
          <div className="flex flex-wrap gap-3 items-center">
            <button
              onClick={() => { setTimeFilter('today'); setCurrentOffset(0); }}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                timeFilter === 'today'
                  ? 'bg-white text-teal-700 shadow-md'
                  : 'bg-teal-500 text-white hover:bg-teal-400'
              }`}
            >
              Aujourd'hui
            </button>
            <button
              onClick={() => { setTimeFilter('week'); setCurrentOffset(0); }}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                timeFilter === 'week'
                  ? 'bg-white text-teal-700 shadow-md'
                  : 'bg-teal-500 text-white hover:bg-teal-400'
              }`}
            >
              Cette semaine
            </button>
            <button
              onClick={() => { setTimeFilter('month'); setCurrentOffset(0); }}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                timeFilter === 'month'
                  ? 'bg-white text-teal-700 shadow-md'
                  : 'bg-teal-500 text-white hover:bg-teal-400'
              }`}
            >
              Ce mois
            </button>

            {/* Navigation arrows for week/month */}
            {(timeFilter === 'week' || timeFilter === 'month') && (
              <div className="flex items-center gap-2 ml-auto">
                <button
                  onClick={() => setCurrentOffset(currentOffset - 1)}
                  className="p-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg text-white transition-all"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-white font-semibold px-3">{formatDate()}</span>
                <button
                  onClick={() => setCurrentOffset(currentOffset + 1)}
                  disabled={currentOffset >= 0}
                  className={`p-2 rounded-lg text-white transition-all ${
                    currentOffset >= 0
                      ? 'bg-white bg-opacity-10 cursor-not-allowed'
                      : 'bg-white bg-opacity-20 hover:bg-opacity-30'
                  }`}
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 bg-gray-50">
          <div className="flex gap-1 px-6">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-6 py-3 font-semibold transition-all ${
                activeTab === 'overview'
                  ? 'border-b-3 border-teal-600 text-teal-700 bg-white'
                  : 'text-gray-600 hover:text-teal-600'
              }`}
            >
              📈 Vue d'ensemble
            </button>
            <button
              onClick={() => setActiveTab('sellers')}
              className={`px-6 py-3 font-semibold transition-all ${
                activeTab === 'sellers'
                  ? 'border-b-3 border-teal-600 text-teal-700 bg-white'
                  : 'text-gray-600 hover:text-teal-600'
              }`}
            >
              👥 Par vendeur
            </button>
            <button
              onClick={() => setActiveTab('config')}
              className={`px-6 py-3 font-semibold transition-all ${
                activeTab === 'config'
                  ? 'border-b-3 border-teal-600 text-teal-700 bg-white'
                  : 'text-gray-600 hover:text-teal-600'
              }`}
            >
              ⚙️ Configuration KPI
            </button>
            <button
              onClick={() => setActiveTab('prospects')}
              className={`px-6 py-3 font-semibold transition-all ${
                activeTab === 'prospects'
                  ? 'border-b-3 border-teal-600 text-teal-700 bg-white'
                  : 'text-gray-600 hover:text-teal-600'
              }`}
            >
              📊 Saisie Prospects
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[600px] overflow-y-auto">
          {/* Alerts Section - Always visible */}
          {alerts.length > 0 && (
            <div className="mb-6 space-y-2">
              {alerts.map((alert, index) => (
                <div
                  key={index}
                  className={`flex items-center gap-3 p-4 rounded-lg border-2 ${
                    alert.level === 'danger'
                      ? 'bg-red-50 border-red-200'
                      : alert.level === 'warning'
                      ? 'bg-orange-50 border-orange-200'
                      : 'bg-green-50 border-green-200'
                  }`}
                >
                  {getAlertIcon(alert.level)}
                  <p className={`font-medium ${
                    alert.level === 'danger'
                      ? 'text-red-800'
                      : alert.level === 'warning'
                      ? 'text-orange-800'
                      : 'text-green-800'
                  }`}>
                    {alert.message}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border-2 border-blue-200">
                  <p className="text-sm font-semibold text-blue-600 mb-1">💰 CA Total</p>
                  <p className="text-3xl font-bold text-blue-900">
                    {storeStats?.ca_total?.toLocaleString('fr-FR') || 0}€
                  </p>
                </div>
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 border-2 border-green-200">
                  <p className="text-sm font-semibold text-green-600 mb-1">🛍️ Ventes</p>
                  <p className="text-3xl font-bold text-green-900">
                    {storeStats?.nb_ventes || 0}
                  </p>
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 border-2 border-purple-200">
                  <p className="text-sm font-semibold text-purple-600 mb-1">🛒 Panier Moyen</p>
                  <p className="text-3xl font-bold text-purple-900">
                    {storeStats?.panier_moyen?.toFixed(2) || 0}€
                  </p>
                </div>
                <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-4 border-2 border-orange-200">
                  <p className="text-sm font-semibold text-orange-600 mb-1">📈 Taux Transfo</p>
                  <p className="text-3xl font-bold text-orange-900">
                    {storeStats?.taux_transformation?.toFixed(1) || 0}%
                  </p>
                </div>
              </div>

              {/* Top Performers */}
              <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-xl p-6 border-2 border-yellow-200">
                <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                  🏆 Top Performers
                </h3>
                <div className="space-y-3">
                  {sellersKPI
                    .sort((a, b) => (b.stats?.ca_total || 0) - (a.stats?.ca_total || 0))
                    .slice(0, 3)
                    .map((seller, index) => (
                      <div key={seller.id} className="flex items-center justify-between bg-white rounded-lg p-4">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}</span>
                          <div>
                            <p className="font-bold text-gray-800">{seller.name}</p>
                            <p className="text-sm text-gray-600">{seller.stats?.nb_ventes || 0} ventes</p>
                          </div>
                        </div>
                        <p className="text-xl font-bold text-green-700">
                          {seller.stats?.ca_total?.toLocaleString('fr-FR') || 0}€
                        </p>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}

          {/* Sellers Tab */}
          {activeTab === 'sellers' && (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Vendeur</th>
                      {kpiConfig?.track_ca && <th className="px-4 py-3 text-right font-semibold text-gray-700">CA</th>}
                      {kpiConfig?.track_ventes && <th className="px-4 py-3 text-right font-semibold text-gray-700">Ventes</th>}
                      {kpiConfig?.track_clients && <th className="px-4 py-3 text-right font-semibold text-gray-700">Clients</th>}
                      {kpiConfig?.track_articles && <th className="px-4 py-3 text-right font-semibold text-gray-700">Articles</th>}
                      {kpiConfig?.track_ca && kpiConfig?.track_ventes && (
                        <th className="px-4 py-3 text-right font-semibold text-gray-700">Panier Moyen</th>
                      )}
                      <th className="px-4 py-3 text-center font-semibold text-gray-700">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sellersKPI.map((seller) => {
                      const avgCA = sellersKPI.reduce((sum, s) => sum + (s.stats?.ca_total || 0), 0) / sellersKPI.length;
                      const performance = ((seller.stats?.ca_total || 0) / avgCA) * 100;
                      
                      return (
                        <tr key={seller.id} className="border-b border-gray-200 hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center">
                                <span className="text-sm font-bold text-teal-700">{seller.name.charAt(0)}</span>
                              </div>
                              <span className="font-medium text-gray-800">{seller.name}</span>
                            </div>
                          </td>
                          {kpiConfig?.track_ca && (
                            <td className="px-4 py-3 text-right font-semibold text-gray-800">
                              {seller.stats?.ca_total?.toLocaleString('fr-FR') || 0}€
                            </td>
                          )}
                          {kpiConfig?.track_ventes && (
                            <td className="px-4 py-3 text-right text-gray-700">
                              {seller.stats?.nb_ventes || 0}
                            </td>
                          )}
                          {kpiConfig?.track_clients && (
                            <td className="px-4 py-3 text-right text-gray-700">
                              {seller.stats?.nb_clients || 0}
                            </td>
                          )}
                          {kpiConfig?.track_articles && (
                            <td className="px-4 py-3 text-right text-gray-700">
                              {seller.stats?.nb_articles || 0}
                            </td>
                          )}
                          {kpiConfig?.track_ca && kpiConfig?.track_ventes && (
                            <td className="px-4 py-3 text-right text-gray-700">
                              {seller.stats?.panier_moyen?.toFixed(2) || 0}€
                            </td>
                          )}
                          <td className="px-4 py-3 text-center">
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              performance >= 100
                                ? 'bg-green-100 text-green-700'
                                : performance >= 80
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-red-100 text-red-700'
                            }`}>
                              {performance >= 100 ? '🟢 Excellent' : performance >= 80 ? '🟡 Bon' : '🔴 À améliorer'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Config Tab */}
          {activeTab === 'config' && kpiConfig && (
            <div className="space-y-6">
              <div className="bg-blue-50 rounded-xl p-4 border-2 border-blue-200">
                <p className="text-sm text-blue-800">
                  💡 <strong>Configuration des KPI :</strong> Activez les KPI à suivre. Par défaut, les vendeurs remplissent leurs KPI quotidiennement. 
                  Vous pouvez changer qui remplit les KPI ci-dessous.
                </p>
              </div>

              {/* Info message */}
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-3 border-2 border-purple-200">
                <p className="text-xs text-purple-900">
                  💡 <strong>Pour chaque KPI</strong>, choisissez qui doit le remplir : soit les <strong>Vendeurs</strong> (toggle à gauche), soit le <strong>Manager</strong> (toggle à droite). Les deux ne peuvent pas être actifs en même temps.
                </p>
              </div>

              {/* Calculated KPIs Section - MOVED TO TOP */}
              <div className="bg-purple-50 rounded-xl p-3 border-2 border-purple-200">
                <h3 className="text-xs font-bold text-purple-900 mb-2">
                  🧮 KPI Calculés Automatiquement
                </h3>
                <p className="text-[10px] text-purple-700 mb-2">
                  Ces indicateurs seront calculés à partir des KPI activés :
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {/* Panier Moyen */}
                  {((kpiConfig.seller_track_ca || kpiConfig.manager_track_ca) && (kpiConfig.seller_track_ventes || kpiConfig.manager_track_ventes)) ? (
                    <div className="flex items-center gap-1 bg-white rounded-lg p-2 border border-green-300">
                      <span className="text-sm">✅</span>
                      <div className="flex-1">
                        <p className="text-[10px] font-bold text-gray-800">🛒 Panier Moyen</p>
                        <p className="text-[9px] text-gray-600">CA ÷ Ventes</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 bg-gray-50 rounded-lg p-2 border border-gray-300 opacity-60">
                      <span className="text-sm">⬜</span>
                      <div className="flex-1">
                        <p className="text-[10px] font-bold text-gray-600">🛒 Panier Moyen</p>
                        <p className="text-[9px] text-gray-500">CA + Ventes</p>
                      </div>
                    </div>
                  )}

                  {/* Taux de Transformation */}
                  {kpiConfig.track_ventes && kpiConfig.track_clients ? (
                    <div className="flex items-center gap-1 bg-white rounded-lg p-2 border border-green-300">
                      <span className="text-sm">✅</span>
                      <div className="flex-1">
                        <p className="text-[10px] font-bold text-gray-800">📈 Taux Transfo</p>
                        <p className="text-[9px] text-gray-600">Ventes ÷ Clients</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 bg-gray-50 rounded-lg p-2 border border-gray-300 opacity-60">
                      <span className="text-sm">⬜</span>
                      <div className="flex-1">
                        <p className="text-[10px] font-bold text-gray-600">📈 Taux Transfo</p>
                        <p className="text-[9px] text-gray-500">Ventes + Clients</p>
                      </div>
                    </div>
                  )}

                  {/* Indice de Vente */}
                  {kpiConfig.track_ca && kpiConfig.track_ventes && kpiConfig.track_articles ? (
                    <div className="flex items-center gap-1 bg-white rounded-lg p-2 border border-green-300">
                      <span className="text-sm">✅</span>
                      <div className="flex-1">
                        <p className="text-[10px] font-bold text-gray-800">🎯 Indice Vente</p>
                        <p className="text-[9px] text-gray-600">Formule complexe</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 bg-gray-50 rounded-lg p-2 border border-gray-300 opacity-60">
                      <span className="text-sm">⬜</span>
                      <div className="flex-1">
                        <p className="text-[10px] font-bold text-gray-600">🎯 Indice Vente</p>
                        <p className="text-[9px] text-gray-500">CA + Ventes + Articles</p>
                      </div>
                    </div>
                  )}

                  {/* Articles par Vente */}
                  {kpiConfig.track_articles && kpiConfig.track_ventes ? (
                    <div className="flex items-center gap-1 bg-white rounded-lg p-2 border border-green-300">
                      <span className="text-sm">✅</span>
                      <div className="flex-1">
                        <p className="text-[10px] font-bold text-gray-800">📦 Articles/Vente</p>
                        <p className="text-[9px] text-gray-600">Articles ÷ Ventes</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 bg-gray-50 rounded-lg p-2 border border-gray-300 opacity-60">
                      <span className="text-sm">⬜</span>
                      <div className="flex-1">
                        <p className="text-[10px] font-bold text-gray-600">📦 Articles/Vente</p>
                        <p className="text-[9px] text-gray-500">Articles + Ventes</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                {/* CA */}
                <div className="bg-white rounded-lg p-2 border-2 border-gray-200">
                  <div className="flex items-center gap-2">
                    <div className="text-xl">💰</div>
                    <div className="flex-1">
                      <h4 className="font-bold text-gray-800 text-xs">Chiffre d'Affaires</h4>
                      <p className="text-[9px] text-gray-600">CA quotidien en euros</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-center">
                        <p className="text-[9px] text-gray-600 mb-0.5">🧑‍💼 Vendeurs</p>
                        <button
                          type="button"
                          onClick={() => handleKPIConfigUpdate('seller_track_ca', !(kpiConfig.seller_track_ca || false))}
                          disabled={kpiConfig.manager_track_ca}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
                            kpiConfig.seller_track_ca ? 'bg-green-500' : kpiConfig.manager_track_ca ? 'bg-gray-200 cursor-not-allowed' : 'bg-gray-300'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              kpiConfig.seller_track_ca ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                      <div className="text-center">
                        <p className="text-[9px] text-gray-600 mb-0.5">👨‍💼 Manager</p>
                        <button
                          type="button"
                          onClick={() => handleKPIConfigUpdate('manager_track_ca', !(kpiConfig.manager_track_ca || false))}
                          disabled={kpiConfig.seller_track_ca}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
                            kpiConfig.manager_track_ca ? 'bg-purple-500' : kpiConfig.seller_track_ca ? 'bg-gray-200 cursor-not-allowed' : 'bg-gray-300'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              kpiConfig.manager_track_ca ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Ventes */}
                <div className="bg-white rounded-lg p-2 border-2 border-gray-200">
                  <div className="flex items-center gap-2">
                    <div className="text-xl">🛍️</div>
                    <div className="flex-1">
                      <h4 className="font-bold text-gray-800 text-xs">Nombre de Ventes</h4>
                      <p className="text-[9px] text-gray-600">Nombre de transactions</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-center">
                        <p className="text-[9px] text-gray-600 mb-0.5">🧑‍💼 Vendeurs</p>
                        <button
                          type="button"
                          onClick={() => handleKPIConfigUpdate('seller_track_ventes', !(kpiConfig.seller_track_ventes || false))}
                          disabled={kpiConfig.manager_track_ventes}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
                            kpiConfig.seller_track_ventes ? 'bg-green-500' : kpiConfig.manager_track_ventes ? 'bg-gray-200 cursor-not-allowed' : 'bg-gray-300'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              kpiConfig.seller_track_ventes ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                      <div className="text-center">
                        <p className="text-[9px] text-gray-600 mb-0.5">👨‍💼 Manager</p>
                        <button
                          type="button"
                          onClick={() => handleKPIConfigUpdate('manager_track_ventes', !(kpiConfig.manager_track_ventes || false))}
                          disabled={kpiConfig.seller_track_ventes}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
                            kpiConfig.manager_track_ventes ? 'bg-purple-500' : kpiConfig.seller_track_ventes ? 'bg-gray-200 cursor-not-allowed' : 'bg-gray-300'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              kpiConfig.manager_track_ventes ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Clients */}
                <div className="bg-white rounded-lg p-2 border-2 border-gray-200">
                  <div className="flex items-center gap-2">
                    <div className="text-xl">👥</div>
                    <div className="flex-1">
                      <h4 className="font-bold text-gray-800 text-xs">Nombre de Clients</h4>
                      <p className="text-[9px] text-gray-600">Clients servis</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-center">
                        <p className="text-[9px] text-gray-600 mb-0.5">🧑‍💼 Vendeurs</p>
                        <button
                          type="button"
                          onClick={() => handleKPIConfigUpdate('seller_track_clients', !(kpiConfig.seller_track_clients || false))}
                          disabled={kpiConfig.manager_track_clients}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
                            kpiConfig.seller_track_clients ? 'bg-green-500' : kpiConfig.manager_track_clients ? 'bg-gray-200 cursor-not-allowed' : 'bg-gray-300'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              kpiConfig.seller_track_clients ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                      <div className="text-center">
                        <p className="text-[9px] text-gray-600 mb-0.5">👨‍💼 Manager</p>
                        <button
                          type="button"
                          onClick={() => handleKPIConfigUpdate('manager_track_clients', !(kpiConfig.manager_track_clients || false))}
                          disabled={kpiConfig.seller_track_clients}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
                            kpiConfig.manager_track_clients ? 'bg-purple-500' : kpiConfig.seller_track_clients ? 'bg-gray-200 cursor-not-allowed' : 'bg-gray-300'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              kpiConfig.manager_track_clients ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Articles */}
                <div className="bg-white rounded-lg p-2 border-2 border-gray-200">
                  <div className="flex items-center gap-2">
                    <div className="text-xl">📦</div>
                    <div className="flex-1">
                      <h4 className="font-bold text-gray-800 text-xs">Nombre d'Articles</h4>
                      <p className="text-[9px] text-gray-600">Articles vendus</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-center">
                        <p className="text-[9px] text-gray-600 mb-0.5">🧑‍💼 Vendeurs</p>
                        <button
                          type="button"
                          onClick={() => handleKPIConfigUpdate('seller_track_articles', !(kpiConfig.seller_track_articles || false))}
                          disabled={kpiConfig.manager_track_articles}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
                            kpiConfig.seller_track_articles ? 'bg-green-500' : kpiConfig.manager_track_articles ? 'bg-gray-200 cursor-not-allowed' : 'bg-gray-300'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              kpiConfig.seller_track_articles ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                      <div className="text-center">
                        <p className="text-[9px] text-gray-600 mb-0.5">👨‍💼 Manager</p>
                        <button
                          type="button"
                          onClick={() => handleKPIConfigUpdate('manager_track_articles', !(kpiConfig.manager_track_articles || false))}
                          disabled={kpiConfig.seller_track_articles}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
                            kpiConfig.manager_track_articles ? 'bg-purple-500' : kpiConfig.seller_track_articles ? 'bg-gray-200 cursor-not-allowed' : 'bg-gray-300'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              kpiConfig.manager_track_articles ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-green-50 rounded-xl p-3 border-2 border-green-200">
                <p className="text-xs text-green-800">
                  ✅ Les KPI activés côté <strong>Vendeurs</strong> (vert) apparaîtront dans leur formulaire de saisie quotidien.
                  {(kpiConfig.manager_track_ca || kpiConfig.manager_track_ventes || kpiConfig.manager_track_clients || kpiConfig.manager_track_articles) && (
                    <> Les KPI activés côté <strong>Manager</strong> (violet) apparaîtront dans l'onglet "Saisie KPI Manager".</>
                  )}
                </p>
              </div>
            </div>
          )}

          {/* Prospects Tab */}
          {activeTab === 'prospects' && (
            <div className="max-w-2xl mx-auto">
              <div className="bg-blue-50 rounded-xl p-4 border-2 border-blue-200 mb-6">
                <p className="text-sm text-blue-800">
                  💡 <strong>Saisie des Prospects :</strong> Le nombre de prospects permet de calculer le{' '}
                  <strong>taux de transformation de l'équipe</strong> : (Ventes ÷ Prospects) × 100
                </p>
              </div>

              <form onSubmit={handleProspectSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    📅 Date
                  </label>
                  <input
                    type="date"
                    required
                    value={prospectFormData.date}
                    onChange={(e) => setProspectFormData({ ...prospectFormData, date: e.target.value })}
                    className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-teal-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    👥 Nombre de Prospects
                  </label>
                  <p className="text-xs text-gray-500 mb-2">
                    Personnes entrées dans le magasin (compteur, estimation, etc.)
                  </p>
                  <input
                    type="number"
                    required
                    min="0"
                    value={prospectFormData.nb_prospects}
                    onChange={(e) => setProspectFormData({ ...prospectFormData, nb_prospects: e.target.value })}
                    className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-teal-400 focus:outline-none"
                    placeholder="Ex: 150"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setProspectFormData({ date: new Date().toISOString().split('T')[0], nb_prospects: '' })}
                    className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-teal-500 to-emerald-500 text-white font-semibold rounded-lg hover:shadow-lg transition-all"
                  >
                    💾 Enregistrer
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
