import React, { useState, useEffect } from 'react';
import { X, TrendingUp } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import StoreKPIAIAnalysisModal from './StoreKPIAIAnalysisModal';

const API = process.env.REACT_APP_BACKEND_URL || '';

export default function StoreKPIModal({ onClose, onSuccess, initialDate = null, hideCloseButton = false, storeId = null, storeName = null }) {
  const [activeTab, setActiveTab] = useState('daily');
  const [overviewData, setOverviewData] = useState(null);
  const [overviewDate, setOverviewDate] = useState(initialDate || new Date().toISOString().split('T')[0]);
  const [showDailyAIModal, setShowDailyAIModal] = useState(false);
  const [showOverviewAIModal, setShowOverviewAIModal] = useState(false);
  
  // Helper to get current week
  const getCurrentWeek = () => {
    const now = new Date();
    const year = now.getFullYear();
    const firstDayOfYear = new Date(year, 0, 1);
    const pastDaysOfYear = (now - firstDayOfYear) / 86400000;
    const weekNum = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
    return `${year}-W${String(weekNum).padStart(2, '0')}`;
  };

  // New states for global overview with charts
  const [viewMode, setViewMode] = useState('year'); // 'week', 'month', 'year'
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear()); // 2025, 2024, etc.
  const [selectedWeek, setSelectedWeek] = useState(getCurrentWeek());
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0,7));
  const [historicalData, setHistoricalData] = useState([]);
  
  // Chart visibility filters
  const [visibleCharts, setVisibleCharts] = useState({
    ca: true,
    ventes: true,
    panierMoyen: true,
    tauxTransformation: true,
    indiceVente: true,
    articles: true
  });

  const toggleChart = (chartKey) => {
    setVisibleCharts(prev => ({
      ...prev,
      [chartKey]: !prev[chartKey]
    }));
  };
  const [formData, setFormData] = useState({
    date: initialDate || new Date().toISOString().split('T')[0],
    nb_prospects: ''
  });
  const [managerKPIData, setManagerKPIData] = useState({
    date: initialDate || new Date().toISOString().split('T')[0],
    ca_journalier: '',
    nb_ventes: '',
    nb_clients: '',
    nb_articles: '',
    nb_prospects: ''
  });
  const [loading, setLoading] = useState(false);
  const [kpiConfig, setKpiConfig] = useState({
    seller_track_ca: true,
    manager_track_ca: false,
    seller_track_ventes: true,
    manager_track_ventes: false,
    seller_track_clients: true,
    manager_track_clients: false,
    seller_track_articles: true,
    manager_track_articles: false,
    seller_track_prospects: true,
    manager_track_prospects: false
  });

  const fetchOverviewData = async () => {
    try {
      const token = localStorage.getItem('token');
      const endpoint = storeId 
        ? `${API}/api/gerant/stores/${storeId}/kpi-overview?date=${overviewDate}`
        : `${API}/api/manager/store-kpi-overview?date=${overviewDate}`;
      const res = await axios.get(endpoint, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setOverviewData(res.data);
    } catch (err) {
      console.error('Error fetching overview:', err);
      toast.error('Erreur lors du chargement de la synthèse');
    }
  };

  const fetchHistoricalData = async () => {
    try {
      const token = localStorage.getItem('token');
      let days = 90; // default 3 months
      let startDate = null;
      let endDate = null;
      
      if (viewMode === 'week' && selectedWeek) {
        // Parse week format "YYYY-Wxx" to get start/end dates
        const [year, week] = selectedWeek.split('-W');
        const firstDayOfYear = new Date(parseInt(year), 0, 1);
        const weekStart = new Date(firstDayOfYear);
        weekStart.setDate(firstDayOfYear.getDate() + (parseInt(week) - 1) * 7);
        startDate = new Date(weekStart);
        endDate = new Date(weekStart);
        endDate.setDate(weekStart.getDate() + 6);
        days = 7;
      } else if (viewMode === 'month' && selectedMonth) {
        // Parse month format "YYYY-MM"
        const [year, month] = selectedMonth.split('-');
        startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
        endDate = new Date(parseInt(year), parseInt(month), 0); // Last day of month
        days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
      } else if (viewMode === 'multi') {
        if (multiPeriod === '3months') days = 90;
        else if (multiPeriod === '6months') days = 180;
        else if (multiPeriod === '12months') days = 365;
      } else if (viewMode === 'week') {
        days = 7;
      } else if (viewMode === 'month') {
        days = 30;
      }

      let historicalArray = [];

      if (storeId) {
        // Gérant: Fetch aggregated data for the store
        const historyRes = await axios.get(`${API}/api/gerant/stores/${storeId}/kpi-history?days=${days}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        // Transform data to match expected format
        // The API returns an array directly, not an object with data property
        const rawData = Array.isArray(historyRes.data) ? historyRes.data : [];
        historicalArray = rawData.map(entry => ({
          date: entry.date,
          seller_ca: entry.ca_journalier || 0,
          seller_ventes: entry.nb_ventes || 0,
          seller_clients: entry.nb_clients || 0,
          seller_articles: entry.nb_articles || 0,
          seller_prospects: entry.nb_prospects || 0
        }));
      } else {
        // Manager: Fetch all sellers data
        const usersRes = await axios.get(`${API}/api/manager/sellers`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        const sellers = usersRes.data;
        
        // Fetch KPI entries for all sellers
        const sellersDataPromises = sellers.map(seller =>
          axios.get(`${API}/api/manager/kpi-entries/${seller.id}?days=${days}`, {
            headers: { Authorization: `Bearer ${token}` }
          })
        );

        const sellersDataResponses = await Promise.all(sellersDataPromises);
        
        // Fetch manager's KPI data
        const today = new Date();
        const startDate = new Date(today);
        startDate.setDate(today.getDate() - days);
        
        const managerKpiRes = await axios.get(
          `${API}/api/manager/manager-kpi?start_date=${startDate.toISOString().split('T')[0]}&end_date=${today.toISOString().split('T')[0]}`,
          { headers: { Authorization: `Bearer ${token}` }}
        );
        
        // Aggregate data by date
        const dateMap = {};
        
        // Add sellers data
        sellersDataResponses.forEach(response => {
          if (response.data && Array.isArray(response.data)) {
            response.data.forEach(entry => {
              if (!dateMap[entry.date]) {
                dateMap[entry.date] = {
                  date: entry.date,
                  seller_ca: 0,
                  seller_ventes: 0,
                  seller_clients: 0,
                  seller_articles: 0,
                  seller_prospects: 0
                };
              }
              dateMap[entry.date].seller_ca += entry.ca_journalier || 0;
              dateMap[entry.date].seller_ventes += entry.nb_ventes || 0;
              dateMap[entry.date].seller_clients += entry.nb_clients || 0;
              dateMap[entry.date].seller_articles += entry.nb_articles || 0;
              dateMap[entry.date].seller_prospects += entry.nb_prospects || 0;
            });
          }
        });
        
        // Add manager's data
        if (managerKpiRes.data && Array.isArray(managerKpiRes.data)) {
          managerKpiRes.data.forEach(entry => {
            if (!dateMap[entry.date]) {
              dateMap[entry.date] = {
                date: entry.date,
                seller_ca: 0,
                seller_ventes: 0,
                seller_clients: 0,
                seller_articles: 0,
                seller_prospects: 0
              };
            }
            // Add manager's data to the aggregated data
            dateMap[entry.date].seller_ca += entry.ca_journalier || 0;
            dateMap[entry.date].seller_ventes += entry.nb_ventes || 0;
            dateMap[entry.date].seller_clients += entry.nb_clients || 0;
            dateMap[entry.date].seller_articles += entry.nb_articles || 0;
            dateMap[entry.date].seller_prospects += entry.nb_prospects || 0;
          });
        }

        // Convert to array and sort by date
        historicalArray = Object.values(dateMap)
          .sort((a, b) => new Date(a.date) - new Date(b.date));
      }

      // Filter data by date range if needed
      if (startDate && endDate) {
        historicalArray = historicalArray.filter(day => {
          const dayDate = new Date(day.date);
          return dayDate >= startDate && dayDate <= endDate;
        });
      }

      // Aggregate data based on period
      let aggregatedData = [];
      
      if (viewMode === 'multi') {
        if (multiPeriod === '3months') {
          // Group by week
          const weekMap = {};
          historicalArray.forEach(day => {
            const date = new Date(day.date);
            const year = date.getFullYear();
            const weekNum = Math.ceil((date.getDate() + new Date(year, date.getMonth(), 1).getDay()) / 7);
            const weekKey = `${year}-S${String(weekNum).padStart(2, '0')}`;
            
            if (!weekMap[weekKey]) {
              weekMap[weekKey] = {
                date: weekKey,
                seller_ca: 0,
                seller_ventes: 0,
                seller_clients: 0,
                seller_articles: 0,
                seller_prospects: 0,
                count: 0
              };
            }
            
            weekMap[weekKey].seller_ca += day.seller_ca;
            weekMap[weekKey].seller_ventes += day.seller_ventes;
            weekMap[weekKey].seller_clients += day.seller_clients;
            weekMap[weekKey].seller_articles += day.seller_articles;
            weekMap[weekKey].seller_prospects += day.seller_prospects;
            weekMap[weekKey].count++;
          });
          
          aggregatedData = Object.values(weekMap).sort((a, b) => a.date.localeCompare(b.date));
        } else if (multiPeriod === '6months') {
          // Group by 2 weeks (bi-weekly)
          const biWeekMap = {};
          historicalArray.forEach(day => {
            const date = new Date(day.date);
            const year = date.getFullYear();
            const weekNum = Math.ceil((date.getDate() + new Date(year, date.getMonth(), 1).getDay()) / 7);
            const biWeekNum = Math.ceil(weekNum / 2);
            const biWeekKey = `${year}-${String(date.getMonth() + 1).padStart(2, '0')}-B${biWeekNum}`;
            
            if (!biWeekMap[biWeekKey]) {
              biWeekMap[biWeekKey] = {
                date: biWeekKey,
                seller_ca: 0,
                seller_ventes: 0,
                seller_clients: 0,
                seller_articles: 0,
                seller_prospects: 0,
                count: 0
              };
            }
            
            biWeekMap[biWeekKey].seller_ca += day.seller_ca;
            biWeekMap[biWeekKey].seller_ventes += day.seller_ventes;
            biWeekMap[biWeekKey].seller_clients += day.seller_clients;
            biWeekMap[biWeekKey].seller_articles += day.seller_articles;
            biWeekMap[biWeekKey].seller_prospects += day.seller_prospects;
            biWeekMap[biWeekKey].count++;
          });
          
          aggregatedData = Object.values(biWeekMap).sort((a, b) => a.date.localeCompare(b.date));
        } else if (multiPeriod === '12months') {
          // Group by month with French month names
          const monthMap = {};
          const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 
                             'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
          
          historicalArray.forEach(day => {
            const monthKey = day.date.substring(0, 7); // YYYY-MM
            const [year, month] = monthKey.split('-');
            const monthName = `${monthNames[parseInt(month) - 1]} ${year}`;
            
            if (!monthMap[monthKey]) {
              monthMap[monthKey] = {
                date: monthName,
                sortKey: monthKey,
                seller_ca: 0,
                seller_ventes: 0,
                seller_clients: 0,
                seller_articles: 0,
                seller_prospects: 0,
                count: 0
              };
            }
            
            monthMap[monthKey].seller_ca += day.seller_ca;
            monthMap[monthKey].seller_ventes += day.seller_ventes;
            monthMap[monthKey].seller_clients += day.seller_clients;
            monthMap[monthKey].seller_articles += day.seller_articles;
            monthMap[monthKey].seller_prospects += day.seller_prospects;
            monthMap[monthKey].count++;
          });
          
          aggregatedData = Object.values(monthMap).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
        }
      } else {
        // For week and month views, keep daily data
        aggregatedData = historicalArray;
      }

      // Calculate derived metrics
      const finalData = aggregatedData.map(period => ({
        ...period,
        total_ca: period.seller_ca,
        total_ventes: period.seller_ventes,
        total_clients: period.seller_clients,
        total_articles: period.seller_articles,
        total_prospects: period.seller_prospects,
        panier_moyen: period.seller_ventes > 0 
          ? period.seller_ca / period.seller_ventes 
          : 0,
        taux_transformation: period.seller_prospects > 0
          ? (period.seller_ventes / period.seller_prospects) * 100
          : 0,
        indice_vente: period.seller_ventes > 0
          ? period.seller_articles / period.seller_ventes
          : 0
      }));

      setHistoricalData(finalData);
    } catch (err) {
      console.error('Error fetching historical data:', err);
      toast.error('Erreur lors du chargement des données historiques');
    }
  };




  useEffect(() => {
    // Only fetch KPI config for Manager view, not for Gérant view
    if (!storeId) {
      fetchKPIConfig();
    }
  }, [storeId]);

  useEffect(() => {
    if (activeTab === 'daily') {
      fetchOverviewData();
    } else if (activeTab === 'overview') {
      fetchHistoricalData();
    }
  }, [activeTab, overviewDate, viewMode, multiPeriod, selectedWeek, selectedMonth]);

  const fetchKPIConfig = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/api/manager/kpi-config`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data) {
        let config = res.data;
        
        // Enforce mutual exclusivity: if both are true, prioritize seller
        if (config.seller_track_ca && config.manager_track_ca) config.manager_track_ca = false;
        if (config.seller_track_ventes && config.manager_track_ventes) config.manager_track_ventes = false;
        if (config.seller_track_clients && config.manager_track_clients) config.manager_track_clients = false;
        if (config.seller_track_articles && config.manager_track_articles) config.manager_track_articles = false;
        if (config.seller_track_prospects && config.manager_track_prospects) config.manager_track_prospects = false;
        
        // Set defaults if both are false
        if (!config.seller_track_ca && !config.manager_track_ca) config.seller_track_ca = true;
        if (!config.seller_track_ventes && !config.manager_track_ventes) config.seller_track_ventes = true;
        if (!config.seller_track_clients && !config.manager_track_clients) config.seller_track_clients = true;
        if (!config.seller_track_articles && !config.manager_track_articles) config.seller_track_articles = true;
        if (!config.seller_track_prospects && !config.manager_track_prospects) config.seller_track_prospects = true;
        
        setKpiConfig(config);
      }
    } catch (err) {
      console.error('Error fetching KPI config:', err);
    }
  };

  const handleKPIUpdate = async (field, value) => {
    try {
      const token = localStorage.getItem('token');
      let updatedConfig = { ...kpiConfig, [field]: value };
      
      // Exclusivité mutuelle
      if (value === true) {
        if (field === 'seller_track_ca') updatedConfig.manager_track_ca = false;
        if (field === 'manager_track_ca') updatedConfig.seller_track_ca = false;
        if (field === 'seller_track_ventes') updatedConfig.manager_track_ventes = false;
        if (field === 'manager_track_ventes') updatedConfig.seller_track_ventes = false;
        if (field === 'seller_track_clients') updatedConfig.manager_track_clients = false;
        if (field === 'manager_track_clients') updatedConfig.seller_track_clients = false;
        if (field === 'seller_track_articles') updatedConfig.manager_track_articles = false;
        if (field === 'manager_track_articles') updatedConfig.seller_track_articles = false;
        if (field === 'seller_track_prospects') updatedConfig.manager_track_prospects = false;
        if (field === 'manager_track_prospects') updatedConfig.seller_track_prospects = false;
      }
      
      await axios.put(`${API}/api/manager/kpi-config`, updatedConfig, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setKpiConfig(updatedConfig);
      toast.success('Configuration mise à jour !');
    } catch (err) {
      console.error('Error updating KPI config:', err);
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API}/api/manager/store-kpi`,
        {
          date: formData.date,
          nb_prospects: parseInt(formData.nb_prospects)
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success('Prospects enregistrés avec succès !');
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error saving store KPI:', err);
      toast.error('Erreur lors de l\'enregistrement');
    } finally {
      setLoading(false);
    }
  };

  const handleManagerKPISubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      const payload = {
        date: managerKPIData.date
      };
      
      // Ajouter seulement les KPIs activés côté manager
      if (kpiConfig.manager_track_ca && managerKPIData.ca_journalier) {
        payload.ca_journalier = parseFloat(managerKPIData.ca_journalier);
      }
      if (kpiConfig.manager_track_ventes && managerKPIData.nb_ventes) {
        payload.nb_ventes = parseInt(managerKPIData.nb_ventes);
      }
      if (kpiConfig.manager_track_clients && managerKPIData.nb_clients) {
        payload.nb_clients = parseInt(managerKPIData.nb_clients);
      }
      if (kpiConfig.manager_track_articles && managerKPIData.nb_articles) {
        payload.nb_articles = parseInt(managerKPIData.nb_articles);
      }
      if (kpiConfig.manager_track_prospects && managerKPIData.nb_prospects) {
        payload.nb_prospects = parseInt(managerKPIData.nb_prospects);
      }

      await axios.post(
        `${API}/api/manager/manager-kpi`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success('KPI Manager enregistrés avec succès !');
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error saving manager KPI:', err);
      toast.error('Erreur lors de l\'enregistrement');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      onClick={hideCloseButton ? undefined : (e) => { if (e.target === e.currentTarget) { onClose(); } }} 
      className={hideCloseButton ? "w-full" : "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"}
    >
      <div className={hideCloseButton ? "bg-white rounded-2xl w-full shadow-lg" : "bg-white rounded-2xl w-full max-w-4xl shadow-2xl"}>
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-6 flex justify-between items-center rounded-t-2xl">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-7 h-7 text-white" />
            <h2 className="text-2xl font-bold text-white">🏪 {storeName || 'Mon Magasin'}</h2>
          </div>
          {!hideCloseButton && (
            <button
              onClick={onClose}
              className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 bg-gray-50 pt-2">
          <div className="flex gap-0.5 px-1 md:px-6 overflow-x-auto">
            <button
              onClick={() => setActiveTab('daily')}
              className={`px-1.5 md:px-4 py-2 text-xs md:text-sm font-semibold transition-all rounded-t-lg whitespace-nowrap flex-shrink-0 ${
                activeTab === 'daily'
                  ? 'bg-orange-300 text-gray-800 shadow-md border-b-4 border-orange-500'
                  : 'text-gray-600 hover:text-orange-600 hover:bg-gray-100'
              }`}
            >
              📅 Quotidien
            </button>
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-1.5 md:px-4 py-2 text-xs md:text-sm font-semibold transition-all rounded-t-lg whitespace-nowrap flex-shrink-0 ${
                activeTab === 'overview'
                  ? 'bg-orange-300 text-gray-800 shadow-md border-b-4 border-orange-500'
                  : 'text-gray-600 hover:text-orange-600 hover:bg-gray-100'
              }`}
            >
              📊 Historique
            </button>
            {!storeId && (
              <>
                <button
                  onClick={() => setActiveTab('config')}
                  className={`px-1.5 md:px-4 py-2 text-xs md:text-sm font-semibold transition-all rounded-t-lg whitespace-nowrap flex-shrink-0 ${
                    activeTab === 'config'
                      ? 'bg-orange-300 text-gray-800 shadow-md border-b-4 border-orange-500'
                      : 'text-gray-600 hover:text-orange-600 hover:bg-gray-100'
                  }`}
                >
                  ⚙️ Config des données
                </button>
                <button
                  onClick={() => setActiveTab('prospects')}
                  className={`px-1.5 md:px-4 py-2 text-xs md:text-sm font-semibold transition-all rounded-t-lg whitespace-nowrap flex-shrink-0 ${
                    activeTab === 'prospects'
                  ? 'bg-orange-300 text-gray-800 shadow-md border-b-4 border-orange-500'
                  : 'text-gray-600 hover:text-orange-600 hover:bg-gray-100'
                  }`}
                >
                  👨‍💼 Saisie des données
                </button>
              </>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[600px] overflow-y-auto">
          {activeTab === 'daily' && (() => {
            // Variables pour gérer les deux structures de données (manager vs gérant)
            const managerData = overviewData?.manager_data || overviewData?.managers_data || {};
            const hasManagerData = managerData && Object.keys(managerData).length > 0;
            
            return (
            <div className="max-w-5xl mx-auto">
              {/* Date selector and AI Analysis button */}
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <label className="text-sm font-semibold text-gray-700">📅 Date :</label>
                  <input
                    type="date"
                    value={overviewDate}
                    onChange={(e) => setOverviewDate(e.target.value)}
                    onClick={(e) => {
                      try {
                        if (typeof e.target.showPicker === 'function') {
                          e.target.showPicker();
                        }
                      } catch (error) {
                        console.log('showPicker not supported');
                      }
                    }}
                    className="px-3 py-1.5 text-sm border-2 border-gray-300 rounded-lg focus:border-purple-400 focus:outline-none cursor-pointer"
                  />
                </div>
                
                <button
                  onClick={() => setShowDailyAIModal(true)}
                  disabled={!overviewData || (overviewData.totals?.ca === 0 && overviewData.totals?.ventes === 0)}
                  className="px-4 py-1.5 text-sm bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  title={!overviewData ? "Sélectionnez une date" : (overviewData.totals?.ca === 0 && overviewData.totals?.ventes === 0) ? "Aucune donnée disponible pour cette date" : ""}
                >
                  <span>🤖</span> Lancer l'Analyse IA
                </button>
              </div>

              {overviewData ? (
                <div className="space-y-4">
                  {/* Summary cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-3 border border-purple-200">
                      <div className="text-xs text-purple-700 font-semibold mb-0.5">💰 CA Réalisé</div>
                      <div className="text-2xl font-bold text-purple-900">
                        {overviewData.totals?.ca !== null 
                          ? `${overviewData.totals.ca.toFixed(2)} €`
                          : '0 €'
                        }
                      </div>
                      <div className="text-xs text-purple-600 mt-0.5">
                        {overviewData.sellers_reported} / {overviewData.total_sellers} vendeurs
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-3 border border-green-200">
                      <div className="text-xs text-green-700 font-semibold mb-0.5">🛍️ Nombre de Ventes</div>
                      <div className="text-2xl font-bold text-green-900">
                        {overviewData.totals?.ventes !== null 
                          ? overviewData.totals.ventes
                          : '0'
                        }
                      </div>
                      <div className="text-xs text-[#10B981] mt-0.5">
                        {overviewData.calculated_kpis?.panier_moyen !== null 
                          ? `PM: ${overviewData.calculated_kpis.panier_moyen} €`
                          : 'Panier Moyen: N/A'
                        }
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-3 border border-blue-200">
                      <div className="text-xs text-blue-700 font-semibold mb-0.5">📈 Taux de Transformation</div>
                      <div className="text-2xl font-bold text-blue-900">
                        {overviewData.calculated_kpis?.taux_transformation !== null 
                          ? `${overviewData.calculated_kpis.taux_transformation} %`
                          : 'N/A'
                        }
                      </div>
                      <div className="text-xs text-blue-600 mt-0.5">
                        {overviewData.calculated_kpis?.taux_transformation !== null 
                          ? 'Ventes / Prospects'
                          : 'Données manquantes'
                        }
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-3 border border-orange-200">
                      <div className="text-xs text-orange-700 font-semibold mb-0.5">📦 Indice de Vente (UPT)</div>
                      <div className="text-2xl font-bold text-orange-900">
                        {overviewData.calculated_kpis?.indice_vente !== null 
                          ? overviewData.calculated_kpis.indice_vente
                          : 'N/A'
                        }
                      </div>
                      <div className="text-xs text-orange-600 mt-0.5">
                        {overviewData.calculated_kpis?.indice_vente !== null 
                          ? 'Articles / Ventes'
                          : 'Données manquantes'
                        }
                      </div>
                    </div>
                  </div>


                  {/* Detailed comparison */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Manager data */}
                    <div className="bg-white rounded-lg p-3 border border-gray-200">
                      <h3 className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-1.5">
                        <span>👨‍💼</span> Données Manager{storeId && 's'}
                      </h3>
                      {hasManagerData ? (
                        <div className="space-y-1.5">
                          {managerData.ca_journalier > 0 && (
                            <div className="flex justify-between items-center py-1.5 border-b border-gray-100">
                              <span className="text-xs text-gray-600">💰 CA Journalier</span>
                              <span className="text-sm font-bold text-gray-800">{managerData.ca_journalier} €</span>
                            </div>
                          )}
                          {managerData.nb_ventes > 0 && (
                            <div className="flex justify-between items-center py-1.5 border-b border-gray-100">
                              <span className="text-xs text-gray-600">🛍️ Ventes</span>
                              <span className="text-sm font-bold text-gray-800">{managerData.nb_ventes}</span>
                            </div>
                          )}
                          {managerData.nb_articles > 0 && (
                            <div className="flex justify-between items-center py-1.5 border-b border-gray-100">
                              <span className="text-xs text-gray-600">📦 Articles</span>
                              <span className="text-sm font-bold text-gray-800">{managerData.nb_articles}</span>
                            </div>
                          )}
                          {managerData.nb_prospects > 0 && (
                            <div className="flex justify-between items-center py-1.5 border-b border-gray-100">
                              <span className="text-xs text-gray-600">🚶 Prospects</span>
                              <span className="text-sm font-bold text-gray-800">{managerData.nb_prospects}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-gray-500 text-xs italic">Aucune donnée saisie pour cette date</p>
                      )}
                    </div>

                    {/* Sellers aggregated data */}
                    <div className="bg-white rounded-lg p-3 border border-gray-200">
                      <h3 className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-1.5">
                        <span>🧑‍💼</span> Données Vendeurs (Agrégées)
                      </h3>
                      {overviewData.sellers_reported > 0 ? (
                        <div className="space-y-1.5">
                          <div className="flex justify-between items-center py-1.5 border-b border-gray-100">
                            <span className="text-xs text-gray-600">💰 CA Journalier</span>
                            <span className="text-sm font-bold text-gray-800">{overviewData.sellers_data.ca_journalier?.toFixed(2) || '0.00'} €</span>
                          </div>
                          
                          <div className="flex justify-between items-center py-1.5 border-b border-gray-100">
                            <span className="text-xs text-gray-600">🛍️ Ventes</span>
                            <span className="text-sm font-bold text-gray-800">{overviewData.sellers_data.nb_ventes || 0}</span>
                          </div>
                          
                          <div className="flex justify-between items-center py-1.5 border-b border-gray-100">
                            <span className="text-xs text-gray-600">📦 Articles</span>
                            <span className="text-sm font-bold text-gray-800">{overviewData.sellers_data.nb_articles || 0}</span>
                          </div>
                        </div>
                      ) : (
                        <p className="text-gray-500 text-xs italic">Aucun vendeur n'a saisi ses KPIs pour cette date</p>
                      )}
                    </div>
                  </div>

                  {/* Individual seller entries */}
                  {overviewData.seller_entries.length > 0 && (
                    <div className="bg-white rounded-lg p-3 border border-gray-200">
                      <h3 className="text-sm font-bold text-gray-800 mb-2">📋 Détail par vendeur</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-1 py-1.5 text-left font-semibold text-gray-700">Vendeur</th>
                              <th className="px-4 py-1.5 text-center font-semibold text-gray-700">💰 CA</th>
                              <th className="px-3 py-1.5 text-center font-semibold text-gray-700">🛍️ Ventes</th>
                              <th className="px-3 py-1.5 text-center font-semibold text-gray-700">📦 Articles</th>
                            </tr>
                          </thead>
                          <tbody>
                            {overviewData.seller_entries.map((entry, idx) => (
                              <tr key={`store-kpi-seller-${entry.seller_id || entry.seller_name}-${idx}`} className="border-t border-gray-100">
                                <td className="px-1 py-1.5 text-gray-800 font-medium">
                                  {entry.seller_name || `Vendeur ${idx + 1}`}
                                </td>
                                <td className="px-4 py-1.5 text-center text-gray-700 whitespace-nowrap">
                                  {entry.ca_journalier?.toFixed(2) || '0.00'} €
                                </td>
                                <td className="px-3 py-1.5 text-center text-gray-700 whitespace-nowrap">
                                  {entry.nb_ventes || 0}
                                </td>
                                <td className="px-3 py-1.5 text-center text-gray-700 whitespace-nowrap">
                                  {entry.nb_articles || 0}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mb-4"></div>
                  <p className="text-gray-600">Chargement des données...</p>
                </div>
              )}
            </div>
            );
          })()}

          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* View Mode Selector - Tabs */}
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => {
                    setViewMode('week');
                    if (!selectedWeek) setSelectedWeek(getCurrentWeek());
                  }}
                  className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all border-2 ${
                    viewMode === 'week'
                      ? 'border-orange-500 bg-orange-500 text-white shadow-md'
                      : 'border-gray-300 text-gray-700 hover:border-orange-400 hover:text-orange-600 hover:bg-orange-50'
                  }`}
                >
                  📅 Vue Hebdomadaire
                </button>
                <button
                  onClick={() => {
                    setViewMode('month');
                    setSelectedMonth(new Date().toISOString().slice(0,7));
                  }}
                  className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all border-2 ${
                    viewMode === 'month'
                      ? 'border-orange-500 bg-orange-500 text-white shadow-md'
                      : 'border-gray-300 text-gray-700 hover:border-orange-400 hover:text-orange-600 hover:bg-orange-50'
                  }`}
                >
                  📆 Vue Mensuelle
                </button>
                <button
                  onClick={() => setViewMode('multi')}
                  className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all border-2 ${
                    viewMode === 'multi'
                      ? 'border-orange-500 bg-orange-500 text-white shadow-md'
                      : 'border-gray-300 text-gray-700 hover:border-orange-400 hover:text-orange-600 hover:bg-orange-50'
                  }`}
                >
                  📅 Vue Annuelle
                </button>
              </div>

              {/* Week View */}
              {viewMode === 'week' && (
                <div className="bg-gradient-to-r from-orange-50 to-orange-100 rounded-xl p-4 border-2 border-orange-200">
                  <h3 className="text-lg font-bold text-orange-900 mb-3">📅 Sélectionner une semaine</h3>
                  <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                    <input
                      type="week"
                      value={selectedWeek}
                      onChange={(e) => setSelectedWeek(e.target.value)}
                      onClick={(e) => {
                        try {
                          if (typeof e.target.showPicker === 'function') {
                            e.target.showPicker();
                          }
                        } catch (error) {
                          console.log('showPicker not supported');
                        }
                      }}
                      className="flex-1 max-w-md px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-purple-400 focus:outline-none cursor-pointer"
                    />
                    <button
                      onClick={() => setShowOverviewAIModal(true)}
                      disabled={!historicalData.length || !selectedWeek || historicalData.every(d => d.total_ca === 0 && d.total_ventes === 0)}
                      className="px-5 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 whitespace-nowrap"
                      title={!selectedWeek ? "Sélectionnez une semaine" : historicalData.every(d => d.total_ca === 0 && d.total_ventes === 0) ? "Aucune donnée disponible pour cette période" : ""}
                    >
                      🤖 Analyse IA
                    </button>
                  </div>
                </div>
              )}

              {/* Month View */}
              {viewMode === 'month' && (
                <div className="bg-gradient-to-r from-orange-50 to-orange-100 rounded-xl p-4 border-2 border-orange-200">
                  <h3 className="text-lg font-bold text-orange-900 mb-3">📆 Sélectionner un mois</h3>
                  <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                    <input
                      type="month"
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      className="flex-1 max-w-md px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-purple-400 focus:outline-none"
                    />
                    <button
                      onClick={() => setShowOverviewAIModal(true)}
                      disabled={!historicalData.length || !selectedMonth || historicalData.every(d => d.total_ca === 0 && d.total_ventes === 0)}
                      className="px-5 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 whitespace-nowrap"
                      title={!selectedMonth ? "Sélectionnez un mois" : historicalData.every(d => d.total_ca === 0 && d.total_ventes === 0) ? "Aucune donnée disponible pour cette période" : ""}
                    >
                      🤖 Analyse IA
                    </button>
                  </div>
                </div>
              )}

              {/* Multi Period View */}
              {viewMode === 'multi' && (
                <div className="space-y-3">
                  <div className="bg-gradient-to-r from-orange-50 to-orange-100 rounded-xl p-4 border-2 border-orange-200">
                    <h3 className="text-lg font-bold text-orange-900 mb-3">📊 Sélectionner une période</h3>
                    <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                      <button
                        onClick={() => setMultiPeriod('3months')}
                        className={`px-4 py-2 text-sm rounded-lg font-medium transition-all ${
                          multiPeriod === '3months'
                            ? 'bg-orange-600 text-white shadow-lg scale-105'
                            : 'bg-white text-gray-700 border-2 border-gray-300 hover:border-orange-400 hover:scale-105'
                        }`}
                      >
                        3 mois
                      </button>
                      <button
                        onClick={() => setMultiPeriod('6months')}
                        className={`px-4 py-2 text-sm rounded-lg font-medium transition-all ${
                          multiPeriod === '6months'
                            ? 'bg-orange-600 text-white shadow-lg scale-105'
                            : 'bg-white text-gray-700 border-2 border-gray-300 hover:border-orange-400 hover:scale-105'
                        }`}
                      >
                        6 mois
                      </button>
                      <button
                        onClick={() => setMultiPeriod('12months')}
                        className={`px-4 py-2 text-sm rounded-lg font-medium transition-all ${
                          multiPeriod === '12months'
                            ? 'bg-orange-600 text-white shadow-lg scale-105'
                            : 'bg-white text-gray-700 border-2 border-gray-300 hover:border-orange-400 hover:scale-105'
                        }`}
                      >
                        12 mois
                      </button>
                    </div>
                  </div>
                  
                  {/* Bouton Analyse IA séparé */}
                  <button
                    onClick={() => setShowOverviewAIModal(true)}
                    disabled={!historicalData.length || historicalData.every(d => d.total_ca === 0 && d.total_ventes === 0)}
                    className="w-full px-5 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    title={historicalData.every(d => d.total_ca === 0 && d.total_ventes === 0) ? "Aucune donnée disponible pour cette période" : ""}
                  >
                    🤖 Lancer l'Analyse IA de la période
                  </button>
                </div>
              )}

              {/* Chart Filters */}
              <div className="bg-white rounded-xl p-4 border-2 border-gray-200 shadow-sm">
                <h3 className="text-md font-bold text-gray-800 mb-3 flex items-center gap-2">
                  🔍 Filtrer les graphiques
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors">
                    <input
                      type="checkbox"
                      checked={visibleCharts.ca}
                      onChange={() => toggleChart('ca')}
                      className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                    />
                    <span className="text-sm font-medium text-gray-700">💰 CA</span>
                  </label>
                  
                  <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors">
                    <input
                      type="checkbox"
                      checked={visibleCharts.ventes}
                      onChange={() => toggleChart('ventes')}
                      className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                    />
                    <span className="text-sm font-medium text-gray-700">🛒 Ventes</span>
                  </label>
                  
                  <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors">
                    <input
                      type="checkbox"
                      checked={visibleCharts.panierMoyen}
                      onChange={() => toggleChart('panierMoyen')}
                      className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                    />
                    <span className="text-sm font-medium text-gray-700">🛍️ Panier Moyen</span>
                  </label>
                  
                  <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors">
                    <input
                      type="checkbox"
                      checked={visibleCharts.tauxTransformation}
                      onChange={() => toggleChart('tauxTransformation')}
                      className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                    />
                    <span className="text-sm font-medium text-gray-700">📈 Taux Transfo</span>
                  </label>
                  
                  <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors">
                    <input
                      type="checkbox"
                      checked={visibleCharts.indiceVente}
                      onChange={() => toggleChart('indiceVente')}
                      className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                    />
                    <span className="text-sm font-medium text-gray-700">📊 Indice Vente</span>
                  </label>
                  
                  <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors">
                    <input
                      type="checkbox"
                      checked={visibleCharts.articles}
                      onChange={() => toggleChart('articles')}
                      className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                    />
                    <span className="text-sm font-medium text-gray-700">📦 Articles</span>
                  </label>
                  
                  <button
                    onClick={() => setVisibleCharts({
                      ca: true,
                      ventes: true,
                      panierMoyen: true,
                      tauxTransformation: true,
                      indiceVente: true,
                      articles: true
                    })}
                    className="col-span-2 md:col-span-1 px-3 py-2 bg-orange-100 text-orange-700 text-sm font-medium rounded-lg hover:bg-orange-200 transition-colors"
                  >
                    ✓ Tout afficher
                  </button>
                </div>
              </div>


              {/* Charts */}
              {historicalData.length > 0 ? (
                <div className="space-y-6">
                  {/* CA Chart */}
                  {visibleCharts.ca && (
                  <div className="bg-white rounded-xl p-5 border-2 border-gray-200 shadow-sm">
                    <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                      💰 Chiffre d'Affaires
                    </h4>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={historicalData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="date" 
                          tick={{ fontSize: 10 }}
                          interval={viewMode === 'week' ? 0 : viewMode === 'month' ? 2 : 0}
                          angle={-45}
                          textAnchor="end"
                          height={70}
                        />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="total_ca" name="CA Total" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} />
                        <Line type="monotone" dataKey="seller_ca" name="CA Vendeurs" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  )}

                  {/* Ventes Chart */}
                  {visibleCharts.ventes && (
                  <div className="bg-white rounded-xl p-5 border-2 border-gray-200 shadow-sm">
                    <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                      🛒 Nombre de Ventes
                    </h4>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={historicalData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="date" 
                          tick={{ fontSize: 10 }}
                          interval={viewMode === 'week' ? 0 : viewMode === 'month' ? 2 : 0}
                          angle={-45}
                          textAnchor="end"
                          height={70}
                        />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="total_ventes" name="Ventes Totales" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} />
                        <Line type="monotone" dataKey="seller_ventes" name="Ventes Vendeurs" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  )}

                  {/* Panier Moyen Chart */}
                  {visibleCharts.panierMoyen && (
                  <div className="bg-white rounded-xl p-5 border-2 border-gray-200 shadow-sm">
                    <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                      🛍️ Panier Moyen
                    </h4>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={historicalData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="date" 
                          tick={{ fontSize: 10 }}
                          interval={viewMode === 'week' ? 0 : viewMode === 'month' ? 2 : 0}
                          angle={-45}
                          textAnchor="end"
                          height={70}
                        />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="panier_moyen" name="Panier Moyen (€)" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  )}

                  {/* Taux Transformation Chart */}
                  {visibleCharts.tauxTransformation && (
                  <div className="bg-white rounded-xl p-5 border-2 border-gray-200 shadow-sm">
                    <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                      📈 Taux de Transformation (%)
                    </h4>
                    {historicalData.some(d => d.total_prospects > 0) ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={historicalData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis 
                            dataKey="date" 
                            tick={{ fontSize: 10 }}
                            interval={viewMode === 'week' ? 0 : viewMode === 'month' ? 2 : 0}
                            angle={-45}
                            textAnchor="end"
                            height={70}
                          />
                          <YAxis tick={{ fontSize: 12 }} />
                          <Tooltip />
                          <Legend />
                          <Line type="monotone" dataKey="taux_transformation" name="Taux (%)" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[300px] flex flex-col items-center justify-center text-center p-6 bg-purple-50 rounded-lg border-2 border-purple-200">
                        <div className="text-4xl mb-3">📊</div>
                        <p className="text-gray-700 font-semibold mb-2">Données de prospects manquantes</p>
                        <p className="text-sm text-gray-600 max-w-md">
                          Le taux de transformation nécessite le suivi du nombre de prospects. 
                          Activez le KPI "Prospects" dans la configuration et demandez à vos vendeurs de le renseigner quotidiennement.
                        </p>
                        <div className="mt-4 text-xs text-purple-700 bg-purple-100 px-4 py-2 rounded-lg">
                          💡 Taux = (Ventes ÷ Prospects) × 100
                        </div>
                      </div>
                    )}
                  </div>
                  )}

                  {/* Indice Vente Chart */}
                  {visibleCharts.indiceVente && (
                  <div className="bg-white rounded-xl p-5 border-2 border-gray-200 shadow-sm">
                    <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                      📊 Indice de Vente
                    </h4>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={historicalData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="date" 
                          tick={{ fontSize: 10 }}
                          interval={viewMode === 'week' ? 0 : viewMode === 'month' ? 2 : 0}
                          angle={-45}
                          textAnchor="end"
                          height={70}
                        />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="indice_vente" name="Indice" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  )}

                  {/* Articles & Clients Charts */}
                  {visibleCharts.articles && (
                  <div className="grid grid-cols-1 gap-6">
                    <div className="bg-white rounded-xl p-5 border-2 border-gray-200 shadow-sm">
                      <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                        📦 Articles Vendus
                      </h4>
                      <ResponsiveContainer width="100%" height={250}>
                        <LineChart data={historicalData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis 
                            dataKey="date" 
                            tick={{ fontSize: 9 }}
                            interval={viewMode === 'week' ? 0 : viewMode === 'month' ? 2 : 0}
                            angle={-45}
                            textAnchor="end"
                            height={60}
                          />
                          <YAxis tick={{ fontSize: 10 }} />
                          <Tooltip />
                          <Legend />
                          <Line type="monotone" dataKey="total_articles" name="Articles" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 2 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-500">Chargement des données...</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'config' && (
            <div className="space-y-4">
              <div className="bg-orange-500 rounded-xl p-3 border-2 border-orange-600">
                <p className="text-sm text-white font-bold">
                  💡 <strong>Configuration des données :</strong> Choisissez qui remplit chaque donnée. Vendeurs (Bleu) ou Manager (orange) ou aucun des deux (gris).
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-lg p-4 border-2 border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div>
                        <h4 className="font-bold text-gray-800">💰 Chiffre d'Affaires</h4>
                        <p className="text-sm text-gray-600">CA quotidien</p>
                      </div>
                      <span 
                        className="text-blue-500 cursor-help" 
                        title="Total des ventes en euros. Permet de calculer le Panier Moyen (CA ÷ Ventes)."
                      >
                        ⓘ
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleKPIUpdate('seller_track_ca', !kpiConfig.seller_track_ca)}
                        className={`w-12 h-8 rounded font-bold text-xs ${
                          kpiConfig.seller_track_ca ? 'bg-cyan-500 text-white' : 'bg-gray-200 text-gray-500'
                        }`}
                        title="Vendeur"
                      >
                        🧑‍💼
                      </button>
                      <button
                        onClick={() => handleKPIUpdate('manager_track_ca', !kpiConfig.manager_track_ca)}
                        className={`w-12 h-8 rounded font-bold text-xs ${
                          kpiConfig.manager_track_ca ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-500'
                        }`}
                        title="Manager"
                      >
                        👨‍💼
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg p-4 border-2 border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div>
                        <h4 className="font-bold text-gray-800">🛍️ Nombre de Ventes</h4>
                        <p className="text-sm text-gray-600">Transactions</p>
                      </div>
                      <span 
                        className="text-blue-500 cursor-help" 
                        title="Nombre de transactions réalisées. Permet de calculer : Panier Moyen (CA ÷ Ventes), Taux de Transformation (Ventes ÷ Prospects) et Indice de Vente (Articles ÷ Ventes)."
                      >
                        ⓘ
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleKPIUpdate('seller_track_ventes', !kpiConfig.seller_track_ventes)}
                        className={`w-12 h-8 rounded font-bold text-xs ${
                          kpiConfig.seller_track_ventes ? 'bg-cyan-500 text-white' : 'bg-gray-200 text-gray-500'
                        }`}
                        title="Vendeur"
                      >
                        🧑‍💼
                      </button>
                      <button
                        onClick={() => handleKPIUpdate('manager_track_ventes', !kpiConfig.manager_track_ventes)}
                        className={`w-12 h-8 rounded font-bold text-xs ${
                          kpiConfig.manager_track_ventes ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-500'
                        }`}
                        title="Manager"
                      >
                        👨‍💼
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg p-4 border-2 border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div>
                        <h4 className="font-bold text-gray-800">📦 Nombre d'Articles</h4>
                        <p className="text-sm text-gray-600">Articles vendus</p>
                      </div>
                      <span 
                        className="text-blue-500 cursor-help" 
                        title="Nombre total d'articles vendus. Permet de calculer l'Indice de Vente/UPT (Articles ÷ Ventes) : nombre moyen d'articles par transaction."
                      >
                        ⓘ
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleKPIUpdate('seller_track_articles', !kpiConfig.seller_track_articles)}
                        className={`w-12 h-8 rounded font-bold text-xs ${
                          kpiConfig.seller_track_articles ? 'bg-cyan-500 text-white' : 'bg-gray-200 text-gray-500'
                        }`}
                        title="Vendeur"
                      >
                        🧑‍💼
                      </button>
                      <button
                        onClick={() => handleKPIUpdate('manager_track_articles', !kpiConfig.manager_track_articles)}
                        className={`w-12 h-8 rounded font-bold text-xs ${
                          kpiConfig.manager_track_articles ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-500'
                        }`}
                        title="Manager"
                      >
                        👨‍💼
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg p-4 border-2 border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div>
                        <h4 className="font-bold text-gray-800">🚶 Nombre de Prospects</h4>
                        <p className="text-sm text-gray-600">Entrées magasin</p>
                      </div>
                      <span 
                        className="text-blue-500 cursor-help" 
                        title="Nombre de personnes entrées dans le magasin. Permet de calculer le Taux de Transformation (Ventes ÷ Prospects) : pourcentage de visiteurs qui achètent."
                      >
                        ⓘ
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleKPIUpdate('seller_track_prospects', !kpiConfig.seller_track_prospects)}
                        className={`w-12 h-8 rounded font-bold text-xs ${
                          kpiConfig.seller_track_prospects ? 'bg-cyan-500 text-white' : 'bg-gray-200 text-gray-500'
                        }`}
                        title="Vendeur"
                      >
                        🧑‍💼
                      </button>
                      <button
                        onClick={() => handleKPIUpdate('manager_track_prospects', !kpiConfig.manager_track_prospects)}
                        className={`w-12 h-8 rounded font-bold text-xs ${
                          kpiConfig.manager_track_prospects ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-500'
                        }`}
                        title="Manager"
                      >
                        👨‍💼
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'prospects' && (
            <div className="max-w-2xl mx-auto">
              {/* Affichage conditionnel : si manager a activé des données, afficher formulaire, sinon message d'instruction */}
              {(kpiConfig.manager_track_ca || kpiConfig.manager_track_ventes || kpiConfig.manager_track_articles || kpiConfig.manager_track_prospects) ? (
                // Formulaire Saisie Manager
                <>
                  <div className="bg-orange-500 rounded-xl p-4 border-2 border-orange-600 mb-6">
                    <p className="text-sm text-white font-bold">
                      💡 <strong>Saisie des données Manager :</strong> Remplissez les données que vous avez configurées pour le manager.
                    </p>
                  </div>

                  <form onSubmit={handleManagerKPISubmit} className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">📅 Date</label>
                      <input
                        type="date"
                        required
                        value={managerKPIData.date}
                        onChange={(e) => setManagerKPIData({ ...managerKPIData, date: e.target.value })}
                        onClick={(e) => {
                          try {
                            if (typeof e.target.showPicker === 'function') {
                              e.target.showPicker();
                            }
                          } catch (error) {
                            console.log('showPicker not supported');
                          }
                        }}
                        className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-purple-400 focus:outline-none cursor-pointer"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {kpiConfig.manager_track_ca && (
                        <div className="bg-orange-50 rounded-lg p-4 border-2 border-orange-200">
                          <label className="block text-sm font-semibold text-gray-700 mb-2">💰 Chiffre d'Affaires</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            required
                            value={managerKPIData.ca_journalier}
                            onChange={(e) => setManagerKPIData({ ...managerKPIData, ca_journalier: e.target.value })}
                            className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-purple-400 focus:outline-none"
                            placeholder="Ex: 2500.50"
                          />
                        </div>
                      )}

                      {kpiConfig.manager_track_ventes && (
                        <div className="bg-orange-50 rounded-lg p-4 border-2 border-orange-200">
                          <label className="block text-sm font-semibold text-gray-700 mb-2">🛍️ Nombre de Ventes</label>
                          <input
                            type="number"
                            min="0"
                            required
                            value={managerKPIData.nb_ventes}
                            onChange={(e) => setManagerKPIData({ ...managerKPIData, nb_ventes: e.target.value })}
                            className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-purple-400 focus:outline-none"
                            placeholder="Ex: 25"
                          />
                        </div>
                      )}

                      {kpiConfig.manager_track_clients && (
                        <div className="bg-orange-50 rounded-lg p-4 border-2 border-orange-200">
                          <label className="block text-sm font-semibold text-gray-700 mb-2">👥 Nombre de Clients</label>
                          <input
                            type="number"
                            min="0"
                            required
                            value={managerKPIData.nb_clients}
                            onChange={(e) => setManagerKPIData({ ...managerKPIData, nb_clients: e.target.value })}
                            className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-purple-400 focus:outline-none"
                            placeholder="Ex: 30"
                          />
                        </div>
                      )}

                      {kpiConfig.manager_track_articles && (
                        <div className="bg-orange-50 rounded-lg p-4 border-2 border-orange-200">
                          <label className="block text-sm font-semibold text-gray-700 mb-2">📦 Nombre d'Articles</label>
                          <input
                            type="number"
                            min="0"
                            required
                            value={managerKPIData.nb_articles}
                            onChange={(e) => setManagerKPIData({ ...managerKPIData, nb_articles: e.target.value })}
                            className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-purple-400 focus:outline-none"
                            placeholder="Ex: 45"
                          />
                        </div>
                      )}

                      {kpiConfig.manager_track_prospects && (
                        <div className="bg-orange-50 rounded-lg p-4 border-2 border-orange-200">
                          <label className="block text-sm font-semibold text-gray-700 mb-2">🚶 Nombre de Prospects</label>
                          <input
                            type="number"
                            min="0"
                            required
                            value={managerKPIData.nb_prospects}
                            onChange={(e) => setManagerKPIData({ ...managerKPIData, nb_prospects: e.target.value })}
                            className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-purple-400 focus:outline-none"
                            placeholder="Ex: 150"
                          />
                        </div>
                      )}
                    </div>

                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-colors"
                      >
                        Annuler
                      </button>
                      <button
                        type="submit"
                        disabled={loading}
                        className="flex-1 px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all disabled:opacity-50"
                      >
                        {loading ? 'Enregistrement...' : '💾 Enregistrer les données'}
                      </button>
                    </div>
                  </form>
                </>
              ) : (
                // Message d'instruction quand aucune donnée manager n'est activée
                <div className="flex flex-col items-center justify-center py-6 px-6">
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border-2 border-blue-200 max-w-md">
                    <div className="text-center mb-4">
                      <div className="inline-flex items-center justify-center w-14 h-14 bg-yellow-100 rounded-full mb-3">
                        <span className="text-3xl">📋</span>
                      </div>
                      <h3 className="text-lg font-bold text-gray-800 mb-1">Aucune donnée à saisir</h3>
                      <p className="text-sm text-gray-600">
                        Vous n'avez activé aucune donnée pour la saisie Manager.
                      </p>
                    </div>
                    
                    <div className="bg-white rounded-lg p-3 border border-yellow-300 mb-4">
                      <p className="text-xs text-gray-700 mb-2">
                        💡 <strong>Pour commencer la saisie :</strong>
                      </p>
                      <ol className="text-xs text-gray-600 space-y-1.5 list-decimal list-inside">
                        <li>Rendez-vous dans l'onglet <strong className="text-orange-700">⚙️ Config des données</strong></li>
                        <li>Activez les données (bouton orange 👨‍💼)</li>
                        <li>Revenez dans cet onglet pour saisir vos données</li>
                      </ol>
                    </div>
                    
                    <button
                      onClick={() => setActiveTab('config')}
                      className="w-full px-4 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white text-sm font-semibold rounded-lg hover:shadow-lg transition-all flex items-center justify-center gap-2"
                    >
                      <span>⚙️</span>
                      Aller à la Config des données
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* AI Analysis Modals */}
      {showDailyAIModal && overviewData && (
        <StoreKPIAIAnalysisModal
          kpiData={overviewData}
          analysisType="daily"
          onClose={() => setShowDailyAIModal(false)}
        />
      )}
      
      {showOverviewAIModal && historicalData.length > 0 && (
        <StoreKPIAIAnalysisModal
          analysisType="overview"
          viewContext={{
            viewMode,
            period: viewMode === 'week' ? `Semaine ${selectedWeek}` : 
                    viewMode === 'month' ? `Mois ${selectedMonth}` :
                    multiPeriod === '3months' ? '3 derniers mois' :
                    multiPeriod === '6months' ? '6 derniers mois' : '12 derniers mois',
            historicalData
          }}
          onClose={() => setShowOverviewAIModal(false)}
        />
      )}
    </div>
  );
}
