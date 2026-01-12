import React, { useState, useEffect } from 'react';
import { X, TrendingUp } from 'lucide-react';
import { api } from '../lib/apiClient';
import { logger } from '../utils/logger';
import { toast } from 'sonner';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import StoreKPIAIAnalysisModal from './StoreKPIAIAnalysisModal';
import KPICalendar from './KPICalendar';

export default function StoreKPIModal({ onClose, onSuccess, initialDate = null, hideCloseButton = false, storeId = null, storeName = null, isManager = false }) {
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
  const [viewMode, setViewMode] = useState('week'); // 'week', 'month', 'year'
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear()); // 2025, 2024, etc.
  const [selectedWeek, setSelectedWeek] = useState(getCurrentWeek());
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0,7));
  const [historicalData, setHistoricalData] = useState([]);
  const [availableYears, setAvailableYears] = useState([]);
  const [datesWithData, setDatesWithData] = useState([]);
  const [lockedDates, setLockedDates] = useState([]); // Dates verrouillées (import API/POS)
  const [displayMode, setDisplayMode] = useState('chart'); // 'chart' or 'list'
  const [displayedListItems, setDisplayedListItems] = useState(10); // For pagination
  const [loadingHistorical, setLoadingHistorical] = useState(false); // Loading state for historical data
  
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
  const [sellers, setSellers] = useState([]);  // ⭐ Liste des vendeurs actifs
  const [sellersKPIData, setSellersKPIData] = useState({});  // ⭐ Données KPIs par vendeur {seller_id: {ca, ventes, articles}}
  const [loading, setLoading] = useState(false);
  const [loadingSellers, setLoadingSellers] = useState(false);
  
  // Vérifier si la date sélectionnée est verrouillée (données API)
  const isDateLocked = (date) => {
    return lockedDates.includes(date);
  };
  
  // Date sélectionnée verrouillée pour la saisie Manager
  const isManagerDateLocked = isDateLocked(managerKPIData.date);
  
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

  // Format date for chart display (YYYY-MM-DD -> DD/MM/YYYY or Month name)
  const formatChartDate = (dateStr) => {
    if (!dateStr) return '';
    
    // If it's already a month name (e.g., "Janvier", "Février"), return as is
    if (dateStr.match(/^[A-Za-zÀ-ÿ]+$/)) {
      return dateStr;
    }
    
    // If it's a week format (e.g., "2025-S49"), return as is
    if (dateStr.includes('-S') || dateStr.includes('-B')) {
      return dateStr;
    }
    
    // Otherwise, convert YYYY-MM-DD to DD/MM/YYYY
    try {
      const [year, month, day] = dateStr.split('-');
      return `${day}/${month}/${year}`;
    } catch {
      return dateStr;
    }
  };

  const fetchOverviewData = async () => {
    try {
      const endpoint = storeId 
        ? `/gerant/stores/${storeId}/kpi-overview?date=${overviewDate}`
        : `/manager/store-kpi-overview?date=${overviewDate}`;
      const res = await api.get(endpoint);
      setOverviewData(res.data);
    } catch (err) {
      logger.error('Error fetching overview:', err);
      toast.error('Erreur lors du chargement de la synthèse');
    }
  };

  const fetchHistoricalData = async () => {
    setLoadingHistorical(true); // Start loading
    try {
      let days = 90; // default 3 months
      let startDate = null;
      let endDate = null;
      
      if (viewMode === 'week' && selectedWeek) {
        // Parse week format "YYYY-Wxx" to get start/end dates (ISO 8601)
        const [year, week] = selectedWeek.split('-W');
        const weekNum = parseInt(week);
        const yearNum = parseInt(year);
        
        // ISO 8601: Week 1 is the first week with a Thursday
        // Get January 4th (always in week 1)
        const jan4 = new Date(yearNum, 0, 4);
        // Get the Monday of that week
        const firstMonday = new Date(jan4);
        const dayOfWeek = jan4.getDay() || 7; // Convert Sunday=0 to 7
        firstMonday.setDate(jan4.getDate() - (dayOfWeek - 1));
        
        // Calculate the Monday of the target week
        startDate = new Date(firstMonday);
        startDate.setDate(firstMonday.getDate() + (weekNum - 1) * 7);
        
        // End date is Sunday of that week
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        days = 7;
      } else if (viewMode === 'month' && selectedMonth) {
        // Parse month format "YYYY-MM"
        const [year, month] = selectedMonth.split('-');
        // Set startDate to first day of the month at 00:00:00 UTC
        startDate = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, 1, 0, 0, 0, 0));
        // Set endDate to last day of the month at 23:59:59 UTC
        endDate = new Date(Date.UTC(parseInt(year), parseInt(month), 0, 23, 59, 59, 999));
        days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
      } else if (viewMode === 'year' && selectedYear) {
        // Year view: get full year
        startDate = new Date(selectedYear, 0, 1);
        endDate = new Date(selectedYear, 11, 31);
        days = 365;
      }

      let historicalArray = [];

      if (storeId) {
        // Gérant: Fetch aggregated data for the store
        // Build URL with start_date and end_date for better filtering
        let url = `/gerant/stores/${storeId}/kpi-history?days=${days}`;
        if (startDate && endDate) {
          const startStr = startDate.toISOString().split('T')[0];
          const endStr = endDate.toISOString().split('T')[0];
          url = `/gerant/stores/${storeId}/kpi-history?start_date=${startStr}&end_date=${endStr}`;
        }
        
        const historyRes = await api.get(url);
        
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
        const usersRes = await api.get('/manager/sellers');
        
        const sellers = usersRes.data;
        
        // Fetch KPI entries for all sellers
        // Use start_date and end_date if available, otherwise use days
        let kpiUrl;
        const storeParam = storeId ? `&store_id=${storeId}` : '';
        if (startDate && endDate) {
          const startStr = startDate.toISOString().split('T')[0];
          const endStr = endDate.toISOString().split('T')[0];
          kpiUrl = (sellerId) => `/manager/kpi-entries/${sellerId}?start_date=${startStr}&end_date=${endStr}${storeParam}`;
        } else {
          kpiUrl = (sellerId) => `/manager/kpi-entries/${sellerId}?days=${days}${storeParam}`;
        }
        
        const sellersDataPromises = sellers.map(seller =>
          api.get(kpiUrl(seller.id))
        );

        const sellersDataResponses = await Promise.all(sellersDataPromises);
        
        // Fetch manager's KPI data
        const today = new Date();
        const managerStartDate = new Date(today);
        managerStartDate.setDate(today.getDate() - days);
        
        const managerKpiUrl = storeId 
          ? `/manager/manager-kpi?start_date=${managerStartDate.toISOString().split('T')[0]}&end_date=${today.toISOString().split('T')[0]}&store_id=${storeId}`
          : `/manager/manager-kpi?start_date=${managerStartDate.toISOString().split('T')[0]}&end_date=${today.toISOString().split('T')[0]}`;
        
        const managerKpiRes = await api.get(managerKpiUrl);
        
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
              dateMap[entry.date].seller_ca += entry.seller_ca || entry.ca_journalier || 0;
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
        // Normalize dates to UTC for accurate comparison
        const startUTC = new Date(startDate);
        startUTC.setUTCHours(0, 0, 0, 0);
        const endUTC = new Date(endDate);
        endUTC.setUTCHours(23, 59, 59, 999);
        
        historicalArray = historicalArray.filter(day => {
          const dayDate = new Date(day.date + 'T00:00:00Z'); // Parse as UTC
          return dayDate >= startUTC && dayDate <= endUTC;
        });
      }

      // Fill missing days for month view with zeros
      if (viewMode === 'month' && startDate && endDate) {
        const filledArray = [];
        const existingDates = new Set(historicalArray.map(d => d.date));
        
        // Create a copy of startDate to avoid mutating the original
        const currentDate = new Date(startDate);
        const endDateCopy = new Date(endDate);
        
        // Normalize to UTC to avoid timezone issues
        currentDate.setUTCHours(0, 0, 0, 0);
        endDateCopy.setUTCHours(23, 59, 59, 999);
        
        // Iterate through all days in the range (from 1st to last day of month)
        while (currentDate <= endDateCopy) {
          const dateStr = currentDate.toISOString().split('T')[0];
          
          const existing = historicalArray.find(item => item.date === dateStr);
          if (existing) {
            filledArray.push(existing);
          } else {
            // Add missing day with zeros
            filledArray.push({
              date: dateStr,
              seller_ca: 0,
              seller_ventes: 0,
              seller_clients: 0,
              seller_articles: 0,
              seller_prospects: 0
            });
          }
          
          // Move to next day
          currentDate.setUTCDate(currentDate.getUTCDate() + 1);
        }
        
        historicalArray = filledArray;
      }

      // Aggregate data based on period
      let aggregatedData = [];
      
      if (viewMode === 'year') {
        // Year view: Group by month with French month names
        const monthMap = {};
        const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 
                           'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
        
        historicalArray.forEach(day => {
          const monthKey = day.date.substring(0, 7); // YYYY-MM
          const [year, month] = monthKey.split('-');
          const monthName = monthNames[parseInt(month) - 1];
          
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

      // Extract available years from the data (only for Manager view)
      // For Gérant view, years are fetched via API in fetchAvailableYears()
      if (!storeId && historicalArray.length > 0) {
        const years = [...new Set(historicalArray.map(d => {
          const year = new Date(d.date).getFullYear();
          return year;
        }))].sort((a, b) => b - a); // Sort descending (most recent first)
        setAvailableYears(years);
      }

      setHistoricalData(finalData);
    } catch (err) {
        logger.error('Error fetching historical data:', err);
      toast.error('Erreur lors du chargement des données historiques');
    } finally {
      setLoadingHistorical(false); // Stop loading
    }
  };

  // Fetch all dates with data (last 2 years) for calendar highlighting
  const fetchDatesWithData = async () => {
    logger.log('[DEBUG] fetchDatesWithData called, storeId:', storeId);
    try {
      const days = 730; // 2 years
      
      if (storeId) {
        // Gérant: Fetch aggregated data for the store
        const historyRes = await api.get(`/gerant/stores/${storeId}/kpi-history?days=${days}`);
        
        const rawData = Array.isArray(historyRes.data) ? historyRes.data : [];
        // Extract dates that have actual data (non-zero values)
        const dates = rawData
          .filter(entry => 
            (entry.ca_journalier && entry.ca_journalier > 0) || 
            (entry.nb_ventes && entry.nb_ventes > 0)
          )
          .map(entry => entry.date);
        setDatesWithData(dates);
        
        // Extract locked dates (from API/POS imports)
        const locked = rawData
          .filter(entry => entry.locked === true)
          .map(entry => entry.date);
        setLockedDates(locked);
      } else {
        // Manager: Fetch from seller entries
        const usersRes = await api.get('/manager/sellers');
        
        const sellers = usersRes.data;
        const today = new Date();
        const startDate = new Date(today);
        startDate.setDate(today.getDate() - days);
        
        const sellersDataPromises = sellers.map(seller =>
          api.get(
            `/manager/kpi-entries/${seller.id}?start_date=${startDate.toISOString().split('T')[0]}&end_date=${today.toISOString().split('T')[0]}`
          )
        );

        const sellersDataResponses = await Promise.all(sellersDataPromises);
        
        // Collect all unique dates with data and locked dates
        const allDates = new Set();
        const allLockedDates = new Set();
        sellersDataResponses.forEach(response => {
          const entries = response.data || [];
          entries.forEach(entry => {
            if ((entry.ca_journalier && entry.ca_journalier > 0) || (entry.nb_ventes && entry.nb_ventes > 0)) {
              allDates.add(entry.date);
            }
            if (entry.locked === true) {
              logger.log('[DEBUG] Found locked date:', entry.date, entry);
              allLockedDates.add(entry.date);
            }
          });
        });
        
        logger.log('[DEBUG] All dates with data:', [...allDates]);
        logger.log('[DEBUG] All locked dates:', [...allLockedDates]);
        
        setDatesWithData([...allDates]);
        setLockedDates([...allLockedDates]);
      }
    } catch (err) {
      logger.error('Error fetching dates with data:', err);
    }
  };


  // Fetch available years for the year selector
  const fetchAvailableYears = async () => {
    try {
      if (storeId) {
        // Gérant view: fetch available years from API
        const res = await api.get(`/gerant/stores/${storeId}/available-years`);
        if (res.data.years && res.data.years.length > 0) {
          setAvailableYears(res.data.years);
        }
      }
    } catch (err) {
      logger.error('Error fetching available years:', err);
    }
  };

  useEffect(() => {
    // Fetch KPI config pour Manager ET Gérant
    fetchKPIConfig();
    
    // Fetch available years for year selector
    if (storeId) {
      fetchAvailableYears();
    }
    // Fetch dates with data for calendar
    fetchDatesWithData();
  }, [storeId]);

  useEffect(() => {
    if (activeTab === 'daily') {
      fetchOverviewData();
    } else if (activeTab === 'overview') {
      fetchHistoricalData();
    }
  }, [activeTab, overviewDate, viewMode, selectedWeek, selectedMonth, selectedYear]);

  const fetchKPIConfig = async () => {
    try {
      // Ajouter store_id pour les gérants
      const storeParam = storeId ? `?store_id=${storeId}` : '';
      const res = await api.get(`/manager/kpi-config${storeParam}`);
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
      logger.error('Error fetching KPI config:', err);
    }
  };

  const handleKPIUpdate = async (field, value) => {
    try {
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
      
      // Ajouter store_id pour les gérants
      const storeParam = storeId ? `?store_id=${storeId}` : '';
      await api.put(`/manager/kpi-config${storeParam}`, updatedConfig);
      
      setKpiConfig(updatedConfig);
      toast.success('Configuration mise à jour !');
    } catch (err) {
      logger.error('Error updating KPI config:', err);
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await api.post(
        `/manager/store-kpi`,
        {
          date: formData.date,
          nb_prospects: parseInt(formData.nb_prospects)
        }
      );

      toast.success('Prospects enregistrés avec succès !');
      onSuccess();
      onClose();
    } catch (err) {
      logger.error('Error saving store KPI:', err);
      toast.error('Erreur lors de l\'enregistrement');
    } finally {
      setLoading(false);
    }
  };

  const handleManagerKPISubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        date: managerKPIData.date
      };
      
      // Ajouter seulement les KPIs activés côté manager
      // Note: On vérifie !== '' pour inclure les valeurs 0
      if (kpiConfig.manager_track_ca && managerKPIData.ca_journalier !== '') {
        payload.ca_journalier = parseFloat(managerKPIData.ca_journalier) || 0;
      }
      if (kpiConfig.manager_track_ventes && managerKPIData.nb_ventes !== '') {
        payload.nb_ventes = parseInt(managerKPIData.nb_ventes) || 0;
      }
      if (kpiConfig.manager_track_clients && managerKPIData.nb_clients !== '') {
        payload.nb_clients = parseInt(managerKPIData.nb_clients) || 0;
      }
      if (kpiConfig.manager_track_articles && managerKPIData.nb_articles !== '') {
        payload.nb_articles = parseInt(managerKPIData.nb_articles) || 0;
      }
      if (kpiConfig.manager_track_prospects && managerKPIData.nb_prospects !== '') {
        payload.nb_prospects = parseInt(managerKPIData.nb_prospects) || 0;
      }

      // Add store_id for gerant viewing specific store
      const storeParam = storeId ? `?store_id=${storeId}` : '';
      await api.post(
        `/manager/manager-kpi${storeParam}`,
        payload
      );

      toast.success('KPI Manager enregistrés avec succès !');
      onSuccess();
      onClose();
    } catch (err) {
      logger.error('Error saving manager KPI:', err);
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
      <div className={hideCloseButton ? "bg-white rounded-2xl w-full shadow-lg max-h-[90vh] flex flex-col" : "bg-white rounded-2xl w-full max-w-4xl shadow-2xl max-h-[90vh] flex flex-col"}>
        {/* Header - Only show in Manager view (not in Gérant StoreDetailModal) */}
        {!hideCloseButton && (
          <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-6 flex justify-between items-center rounded-t-2xl flex-shrink-0">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-7 h-7 text-white" />
              <h2 className="text-2xl font-bold text-white">🏪 {storeName || 'Mon Magasin'}</h2>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="border-b border-gray-200 bg-gray-50 pt-2 flex-shrink-0">
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
            {/* Onglets Config et Saisie - Toujours visibles pour Manager ET Gérant */}
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
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto overflow-x-visible flex-1 min-h-0">
          {activeTab === 'daily' && (() => {
            // Variables pour gérer les deux structures de données (manager vs gérant)
            const managerData = overviewData?.manager_data || overviewData?.managers_data || {};
            const hasManagerData = managerData && Object.keys(managerData).length > 0;
            
            return (
            <div className="max-w-5xl mx-auto">
              {/* Date selector and AI Analysis button */}
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <KPICalendar
                    selectedDate={overviewDate}
                    onDateChange={(date) => setOverviewDate(date)}
                    datesWithData={datesWithData}
                    lockedDates={lockedDates}
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


                  {/* Données validées (fusion manager + vendeurs) - Only for Manager view */}
                  {!storeId && (
                  <div className="bg-white rounded-lg p-4 border border-gray-200">
                    <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-1.5">
                      <span>✅</span> Données Validées
                    </h3>
                    {(hasManagerData || overviewData.sellers_reported > 0) ? (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {/* CA */}
                        <div className="flex flex-col items-center p-3 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg border border-purple-200">
                          <span className="text-xs text-purple-700 font-semibold mb-1">💰 CA</span>
                          <span className="text-lg font-bold text-purple-900">
                            {((hasManagerData ? (managerData.ca_journalier || 0) : 0) + 
                              (overviewData.sellers_data?.ca_journalier || 0)).toFixed(2)} €
                          </span>
                        </div>
                        
                        {/* Ventes */}
                        <div className="flex flex-col items-center p-3 bg-gradient-to-br from-green-50 to-green-100 rounded-lg border border-green-200">
                          <span className="text-xs text-green-700 font-semibold mb-1">🛍️ Ventes</span>
                          <span className="text-lg font-bold text-green-900">
                            {((hasManagerData ? (managerData.nb_ventes || 0) : 0) + 
                              (overviewData.sellers_data?.nb_ventes || 0))}
                          </span>
                        </div>
                        
                        {/* Articles */}
                        <div className="flex flex-col items-center p-3 bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg border border-orange-200">
                          <span className="text-xs text-orange-700 font-semibold mb-1">📦 Articles</span>
                          <span className="text-lg font-bold text-orange-900">
                            {((hasManagerData ? (managerData.nb_articles || 0) : 0) + 
                              (overviewData.sellers_data?.nb_articles || 0))}
                          </span>
                        </div>
                        
                        {/* Prospects */}
                        {(hasManagerData && managerData.nb_prospects > 0) && (
                          <div className="flex flex-col items-center p-3 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200">
                            <span className="text-xs text-blue-700 font-semibold mb-1">🚶 Prospects</span>
                            <span className="text-lg font-bold text-blue-900">
                              {managerData.nb_prospects || 0}
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-xs italic">Aucune donnée validée pour cette date</p>
                    )}
                  </div>
                  )}

                  {/* Individual seller entries */}
                  {overviewData.seller_entries.length > 0 && (
                    <div className="bg-white rounded-lg p-3 border border-gray-200">
                      <h3 className="text-sm font-bold text-gray-800 mb-2">📋 Détails par vendeur</h3>
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
                                  {(entry.seller_ca || entry.ca_journalier || 0).toFixed(2)} €
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
                  onClick={() => setViewMode('year')}
                  className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all border-2 ${
                    viewMode === 'year'
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
                          logger.log('showPicker not supported');
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
                      onClick={(e) => {
                        try {
                          if (typeof e.target.showPicker === 'function') {
                            e.target.showPicker();
                          }
                        } catch (error) {
                          logger.log('showPicker not supported');
                        }
                      }}
                      className="flex-1 max-w-md px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-purple-400 focus:outline-none cursor-pointer"
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

              {/* Year View */}
              {viewMode === 'year' && (
                <div className="bg-gradient-to-r from-orange-50 to-orange-100 rounded-xl p-4 border-2 border-orange-200">
                  <h3 className="text-lg font-bold text-orange-900 mb-3">📅 Sélectionner une année</h3>
                  <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                    <select
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                      className="flex-1 max-w-md px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-purple-400 focus:outline-none bg-white cursor-pointer"
                    >
                      {availableYears.length > 0 ? (
                        availableYears.map(year => (
                          <option key={year} value={year}>{year}</option>
                        ))
                      ) : (
                        <>
                          <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>
                          <option value={new Date().getFullYear() - 1}>{new Date().getFullYear() - 1}</option>
                        </>
                      )}
                    </select>
                    <button
                      onClick={() => setShowOverviewAIModal(true)}
                      disabled={!historicalData.length || historicalData.every(d => d.total_ca === 0 && d.total_ventes === 0)}
                      className="px-5 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 whitespace-nowrap"
                      title={historicalData.every(d => d.total_ca === 0 && d.total_ventes === 0) ? "Aucune donnée disponible pour cette période" : ""}
                    >
                      🤖 Analyse IA
                    </button>
                  </div>
                </div>
              )}

              {/* Display Mode Toggle */}
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => {
                    setDisplayMode('list');
                    setDisplayedListItems(10); // Reset pagination
                  }}
                  className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all border-2 ${
                    displayMode === 'list'
                      ? 'border-purple-500 bg-purple-500 text-white shadow-md'
                      : 'border-gray-300 text-gray-700 hover:border-purple-400 hover:text-purple-600 hover:bg-purple-50'
                  }`}
                >
                  📊 Vue Chiffrée
                </button>
                <button
                  onClick={() => {
                    setDisplayMode('chart');
                    setDisplayedListItems(10); // Reset pagination
                  }}
                  className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all border-2 ${
                    displayMode === 'chart'
                      ? 'border-purple-500 bg-purple-500 text-white shadow-md'
                      : 'border-gray-300 text-gray-700 hover:border-purple-400 hover:text-purple-600 hover:bg-purple-50'
                  }`}
                >
                  📈 Vue Graphique
                </button>
              </div>

              {/* Chart Filters */}
              {displayMode === 'chart' && (
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
              )}

              {/* Charts */}
              {displayMode === 'chart' && historicalData.length > 0 ? (
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
                          tickFormatter={formatChartDate}
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
                          tickFormatter={formatChartDate}
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
                          tickFormatter={formatChartDate}
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
                            tickFormatter={formatChartDate}
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
                          tickFormatter={formatChartDate}
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
                            tickFormatter={formatChartDate}
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
              ) : displayMode === 'chart' ? (
                <div className="text-center py-12">
                  {loadingHistorical ? (
                    <p className="text-gray-500">⏳ Chargement des données...</p>
                  ) : (
                    <p className="text-gray-500">📭 Aucune donnée disponible pour cette période</p>
                  )}
                </div>
              ) : null}

              {/* List View */}
              {displayMode === 'list' && (
                <div className="space-y-4">
                  {historicalData.length > 0 ? (
                    <>
                      {/* Calculate Totals */}
                      {(() => {
                        const totals = historicalData.reduce((acc, entry) => {
                          const ca = entry.total_ca || entry.seller_ca || 0;
                          const ventes = entry.total_ventes || entry.seller_ventes || 0;
                          const articles = entry.total_articles || entry.seller_articles || 0;
                          const prospects = entry.total_prospects || entry.seller_prospects || 0;
                          const clients = entry.total_clients || entry.seller_clients || 0;
                          
                          return {
                            total_ca: acc.total_ca + (typeof ca === 'number' ? ca : 0),
                            total_ventes: acc.total_ventes + (typeof ventes === 'number' ? ventes : 0),
                            total_articles: acc.total_articles + (typeof articles === 'number' ? articles : 0),
                            total_prospects: acc.total_prospects + (typeof prospects === 'number' ? prospects : 0),
                            total_clients: acc.total_clients + (typeof clients === 'number' ? clients : 0)
                          };
                        }, {
                          total_ca: 0,
                          total_ventes: 0,
                          total_articles: 0,
                          total_prospects: 0,
                          total_clients: 0
                        });
                        
                        const panierMoyen = totals.total_ventes > 0 
                          ? (totals.total_ca / totals.total_ventes).toFixed(2) 
                          : '0.00';
                        const tauxTransfo = totals.total_prospects > 0 
                          ? ((totals.total_ventes / totals.total_prospects) * 100).toFixed(1) 
                          : '0.0';
                        const indiceVente = totals.total_ventes > 0 
                          ? (totals.total_articles / totals.total_ventes).toFixed(2) 
                          : '0.00';
                        
                        return (
                          <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl border-2 border-orange-300 shadow-lg overflow-hidden">
                            <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-4 py-3">
                              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                📊 TOTAL PÉRIODE
                                <span className="text-sm font-normal opacity-90">
                                  ({historicalData.length} {historicalData.length === 1 ? 'jour' : 'jours'})
                                </span>
                              </h3>
                            </div>
                            
                            <div className="p-4">
                              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
                                {/* CA Total */}
                                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-3 border-2 border-green-300">
                                  <div className="text-xs text-green-700 font-semibold mb-1">💰 CA Total</div>
                                  <div className="text-lg font-bold text-green-900">
                                    {totals.total_ca.toFixed(2)} €
                                  </div>
                                </div>

                                {/* Ventes Total */}
                                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-3 border-2 border-blue-300">
                                  <div className="text-xs text-blue-700 font-semibold mb-1">🛍️ Ventes Total</div>
                                  <div className="text-lg font-bold text-blue-900">
                                    {totals.total_ventes}
                                  </div>
                                </div>

                                {/* Articles Total */}
                                <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-lg p-3 border-2 border-indigo-300">
                                  <div className="text-xs text-indigo-700 font-semibold mb-1">📦 Articles Total</div>
                                  <div className="text-lg font-bold text-indigo-900">
                                    {totals.total_articles}
                                  </div>
                                </div>

                                {/* Prospects Total */}
                                <div className="bg-gradient-to-br from-pink-50 to-pink-100 rounded-lg p-3 border-2 border-pink-300">
                                  <div className="text-xs text-pink-700 font-semibold mb-1">👤 Prospects Total</div>
                                  <div className="text-lg font-bold text-pink-900">
                                    {totals.total_prospects}
                                  </div>
                                </div>

                                {/* Clients Total */}
                                <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg p-3 border-2 border-yellow-300">
                                  <div className="text-xs text-yellow-700 font-semibold mb-1">👥 Clients Total</div>
                                  <div className="text-lg font-bold text-yellow-900">
                                    {totals.total_clients > 0 ? totals.total_clients : 'N/A'}
                                  </div>
                                </div>

                                {/* Panier Moyen */}
                                <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-3 border-2 border-purple-300">
                                  <div className="text-xs text-purple-700 font-semibold mb-1">🛒 Panier Moyen</div>
                                  <div className="text-lg font-bold text-purple-900">
                                    {panierMoyen} €
                                  </div>
                                </div>

                                {/* Taux Transformation */}
                                <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-3 border-2 border-orange-300">
                                  <div className="text-xs text-orange-700 font-semibold mb-1">📈 Taux Transfo</div>
                                  <div className="text-lg font-bold text-orange-900">
                                    {tauxTransfo}%
                                  </div>
                                </div>

                                {/* Indice Vente */}
                                <div className="bg-gradient-to-br from-cyan-50 to-cyan-100 rounded-lg p-3 border-2 border-cyan-300">
                                  <div className="text-xs text-cyan-700 font-semibold mb-1">📊 Indice Vente</div>
                                  <div className="text-lg font-bold text-cyan-900">
                                    {indiceVente}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                      
                      {/* Data List */}
                      <div className="bg-white rounded-xl border-2 border-gray-200 shadow-sm overflow-hidden">
                        <div className="bg-gradient-to-r from-purple-500 to-purple-600 px-4 py-3">
                          <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            📋 Données Quotidiennes
                            <span className="text-sm font-normal opacity-90">
                              ({historicalData.length} entrées)
                            </span>
                          </h3>
                        </div>
                        
                        <div className="divide-y divide-gray-200">
                          {historicalData.slice(0, displayedListItems).map((entry, index) => {
                            const panierMoyen = entry.total_ventes > 0 ? (entry.total_ca / entry.total_ventes).toFixed(2) : 0;
                            const tauxTransfo = entry.total_prospects > 0 ? ((entry.total_ventes / entry.total_prospects) * 100).toFixed(1) : 0;
                            const indiceVente = entry.total_ventes > 0 ? (entry.total_articles / entry.total_ventes).toFixed(2) : 0;
                            
                            return (
                              <div 
                                key={index}
                                className="p-5 hover:bg-purple-50 transition-colors border-b border-gray-100 last:border-b-0"
                              >
                                {/* Date Header */}
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center gap-2">
                                    <span className="text-lg font-bold text-purple-600">
                                      📅 {
                                        // For year view, date is month name (e.g., "Janvier")
                                        // For other views, date is ISO format (e.g., "2025-12-08")
                                        entry.date.includes('-') 
                                          ? new Date(entry.date + 'T00:00:00').toLocaleDateString('fr-FR', { 
                                              weekday: 'long',
                                              day: 'numeric', 
                                              month: 'long', 
                                              year: 'numeric' 
                                            })
                                          : entry.date
                                      }
                                    </span>
                                  </div>
                                  <span className="text-xs text-gray-500 font-medium">
                                    Entrée #{historicalData.length - index}
                                  </span>
                                </div>

                                {/* KPI Grid */}
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                                  {/* CA */}
                                  <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-3 border border-green-200">
                                    <div className="text-xs text-green-700 font-semibold mb-1">💰 CA</div>
                                    <div className="text-lg font-bold text-green-900">
                                      {entry.total_ca?.toFixed(2) || '0.00'} €
                                    </div>
                                  </div>

                                  {/* Ventes */}
                                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-3 border border-blue-200">
                                    <div className="text-xs text-blue-700 font-semibold mb-1">🛍️ Ventes</div>
                                    <div className="text-lg font-bold text-blue-900">
                                      {entry.total_ventes || 0}
                                    </div>
                                  </div>

                                  {/* Panier Moyen */}
                                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-3 border border-purple-200">
                                    <div className="text-xs text-purple-700 font-semibold mb-1">🛒 Panier Moy.</div>
                                    <div className="text-lg font-bold text-purple-900">
                                      {panierMoyen} €
                                    </div>
                                  </div>

                                  {/* Clients */}
                                  <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg p-3 border border-yellow-200">
                                    <div className="text-xs text-yellow-700 font-semibold mb-1">👥 Clients</div>
                                    <div className="text-lg font-bold text-yellow-900">
                                      {entry.total_clients || 0}
                                    </div>
                                  </div>

                                  {/* Taux Transformation */}
                                  <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-3 border border-orange-200">
                                    <div className="text-xs text-orange-700 font-semibold mb-1">📈 Taux Transfo</div>
                                    <div className="text-lg font-bold text-orange-900">
                                      {tauxTransfo}%
                                    </div>
                                  </div>

                                  {/* Articles */}
                                  <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-lg p-3 border border-indigo-200">
                                    <div className="text-xs text-indigo-700 font-semibold mb-1">📦 Articles</div>
                                    <div className="text-lg font-bold text-indigo-900">
                                      {entry.total_articles || 0}
                                    </div>
                                  </div>
                                </div>

                                {/* Additional Metrics */}
                                <div className="mt-3 flex gap-4 text-sm text-gray-600">
                                  <div>
                                    <span className="font-semibold">Prospects:</span> {entry.total_prospects || 0}
                                  </div>
                                  <div>
                                    <span className="font-semibold">Indice Vente:</span> {indiceVente}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Load More Button */}
                        {displayedListItems < historicalData.length && (
                          <div className="p-4 bg-gray-50 border-t border-gray-200">
                            <button
                              onClick={() => setDisplayedListItems(prev => Math.min(prev + 10, historicalData.length))}
                              className="w-full px-4 py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white font-semibold rounded-lg hover:from-purple-600 hover:to-purple-700 transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                            >
                              <span>📄 Charger plus</span>
                              <span className="text-sm opacity-90">
                                ({displayedListItems} / {historicalData.length})
                              </span>
                            </button>
                          </div>
                        )}

                        {/* All Loaded Message */}
                        {displayedListItems >= historicalData.length && historicalData.length > 10 && (
                          <div className="p-3 bg-purple-50 border-t border-purple-200 text-center">
                            <p className="text-sm text-purple-700 font-medium">
                              ✅ Toutes les données sont affichées ({historicalData.length} entrées)
                            </p>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-12">
                      {loadingHistorical ? (
                        <p className="text-gray-500">⏳ Chargement des données...</p>
                      ) : (
                        <p className="text-gray-500">📭 Aucune donnée disponible pour cette période</p>
                      )}
                    </div>
                  )}
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
                  {/* Message de verrouillage si données API */}
                  {isManagerDateLocked && (
                    <div className="bg-red-100 rounded-xl p-4 border-2 border-red-300 mb-6">
                      <p className="text-sm text-red-800 font-bold flex items-center gap-2">
                        🔒 <strong>Données certifiées par le Siège/ERP</strong>
                      </p>
                      <p className="text-xs text-red-600 mt-1">
                        Les données de cette journée proviennent de l'API et ne peuvent pas être modifiées manuellement.
                        Sélectionnez une autre date pour saisir des données.
                      </p>
                    </div>
                  )}

                  {!isManagerDateLocked && (
                    <div className="bg-orange-500 rounded-xl p-4 border-2 border-orange-600 mb-6">
                      <p className="text-sm text-white font-bold">
                        💡 <strong>Saisie par Vendeur :</strong> Remplissez les données pour chaque vendeur individuellement.
                      </p>
                    </div>
                  )}

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
                            logger.log('showPicker not supported');
                          }
                        }}
                        className={`w-full p-3 border-2 rounded-lg focus:outline-none cursor-pointer ${
                          isManagerDateLocked 
                            ? 'border-red-300 bg-red-50' 
                            : 'border-gray-300 focus:border-purple-400'
                        }`}
                      />
                      {isManagerDateLocked && (
                        <p className="text-xs text-red-500 mt-1">⚠️ Cette date est verrouillée (données API)</p>
                      )}
                    </div>

                    {/* ⭐ NOUVELLE INTERFACE : Liste des vendeurs */}
                    {(kpiConfig.manager_track_ca || kpiConfig.manager_track_ventes || kpiConfig.manager_track_articles) && (
                      <div className="space-y-4">
                        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                          <h3 className="text-sm font-bold text-gray-800 mb-2">📋 Saisie par Vendeur</h3>
                          <p className="text-xs text-gray-600">
                            Saisissez les données pour chaque vendeur actif du magasin.
                          </p>
                        </div>

                        {loadingSellers ? (
                          <div className="text-center py-8">
                            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                            <p className="text-sm text-gray-600 mt-2">Chargement des vendeurs...</p>
                          </div>
                        ) : sellers.length === 0 ? (
                          <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4">
                            <p className="text-sm text-yellow-800">
                              ⚠️ Aucun vendeur actif trouvé pour ce magasin.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-3 max-h-96 overflow-y-auto">
                            {sellers.map((seller) => (
                              <div
                                key={seller.id}
                                className="bg-white border-2 border-gray-200 rounded-lg p-4 hover:border-orange-300 transition-colors"
                              >
                                <div className="flex items-center justify-between mb-3">
                                  <h4 className="font-semibold text-gray-800">{seller.name}</h4>
                                  <span className="text-xs text-gray-500">ID: {seller.id.substring(0, 8)}...</span>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                  {kpiConfig.manager_track_ca && (
                                    <div>
                                      <label className="block text-xs font-medium text-gray-700 mb-1">
                                        💰 CA (€)
                                      </label>
                                      <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        disabled={isManagerDateLocked}
                                        value={sellersKPIData[seller.id]?.ca_journalier || ''}
                                        onChange={(e) => {
                                          setSellersKPIData(prev => ({
                                            ...prev,
                                            [seller.id]: {
                                              ...prev[seller.id],
                                              ca_journalier: e.target.value
                                            }
                                          }));
                                        }}
                                        className={`w-full p-2 border rounded-lg text-sm focus:outline-none ${
                                          isManagerDateLocked 
                                            ? 'border-gray-300 bg-gray-100 cursor-not-allowed text-gray-500' 
                                            : 'border-gray-300 focus:border-orange-400'
                                        }`}
                                        placeholder="0.00"
                                      />
                                    </div>
                                  )}

                                  {kpiConfig.manager_track_ventes && (
                                    <div>
                                      <label className="block text-xs font-medium text-gray-700 mb-1">
                                        🛍️ Ventes
                                      </label>
                                      <input
                                        type="number"
                                        min="0"
                                        disabled={isManagerDateLocked}
                                        value={sellersKPIData[seller.id]?.nb_ventes || ''}
                                        onChange={(e) => {
                                          setSellersKPIData(prev => ({
                                            ...prev,
                                            [seller.id]: {
                                              ...prev[seller.id],
                                              nb_ventes: e.target.value
                                            }
                                          }));
                                        }}
                                        className={`w-full p-2 border rounded-lg text-sm focus:outline-none ${
                                          isManagerDateLocked 
                                            ? 'border-gray-300 bg-gray-100 cursor-not-allowed text-gray-500' 
                                            : 'border-gray-300 focus:border-orange-400'
                                        }`}
                                        placeholder="0"
                                      />
                                    </div>
                                  )}

                                  {kpiConfig.manager_track_articles && (
                                    <div>
                                      <label className="block text-xs font-medium text-gray-700 mb-1">
                                        📦 Articles
                                      </label>
                                      <input
                                        type="number"
                                        min="0"
                                        disabled={isManagerDateLocked}
                                        value={sellersKPIData[seller.id]?.nb_articles || ''}
                                        onChange={(e) => {
                                          setSellersKPIData(prev => ({
                                            ...prev,
                                            [seller.id]: {
                                              ...prev[seller.id],
                                              nb_articles: e.target.value
                                            }
                                          }));
                                        }}
                                        className={`w-full p-2 border rounded-lg text-sm focus:outline-none ${
                                          isManagerDateLocked 
                                            ? 'border-gray-300 bg-gray-100 cursor-not-allowed text-gray-500' 
                                            : 'border-gray-300 focus:border-orange-400'
                                        }`}
                                        placeholder="0"
                                      />
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* ⭐ Prospects globaux (pour répartition) */}
                    {kpiConfig.manager_track_prospects && (
                      <div className={`rounded-lg p-4 border-2 ${isManagerDateLocked ? 'bg-gray-100 border-gray-300' : 'bg-orange-50 border-orange-200'}`}>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          🚶 Nombre de Prospects (Trafic Magasin Global)
                        </label>
                        <p className="text-xs text-gray-600 mb-2">
                          Ce total sera réparti automatiquement entre les vendeurs pour le calcul du taux de transformation.
                        </p>
                        <input
                          type="number"
                          min="0"
                          required={!isManagerDateLocked}
                          disabled={isManagerDateLocked}
                          value={managerKPIData.nb_prospects}
                          onChange={(e) => setManagerKPIData({ ...managerKPIData, nb_prospects: e.target.value })}
                          className={`w-full p-3 border-2 rounded-lg focus:outline-none ${
                            isManagerDateLocked 
                              ? 'border-gray-300 bg-gray-200 cursor-not-allowed text-gray-500' 
                              : 'border-gray-300 focus:border-purple-400'
                          }`}
                          placeholder="Ex: 150"
                        />
                      </div>
                    )}

                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-colors"
                      >
                        Annuler
                      </button>
                      {isManagerDateLocked ? (
                        <div className="flex-1 px-6 py-3 bg-red-100 text-red-600 font-semibold rounded-lg text-center border-2 border-red-300">
                          🔒 Données verrouillées (API)
                        </div>
                      ) : (
                        <button
                          type="submit"
                          disabled={loading}
                          className="flex-1 px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all disabled:opacity-50"
                        >
                          {loading ? 'Enregistrement...' : '💾 Enregistrer les données'}
                        </button>
                      )}
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
          storeId={storeId}
          onClose={() => setShowDailyAIModal(false)}
        />
      )}
      
      {showOverviewAIModal && historicalData.length > 0 && (
        <StoreKPIAIAnalysisModal
          analysisType="overview"
          storeId={storeId}
          viewContext={{
            viewMode,
            period: viewMode === 'week' ? `Semaine ${selectedWeek}` : 
                    viewMode === 'month' ? `Mois ${selectedMonth}` :
                    viewMode === 'year' ? `Année ${selectedYear}` : 'Période inconnue',
            historicalData
          }}
          onClose={() => setShowOverviewAIModal(false)}
        />
      )}
    </div>
  );
}
