import { useState, useEffect } from 'react';
import { api } from '../../lib/apiClient';
import { logger } from '../../utils/logger';
import { toast } from 'sonner';
import {
  getCurrentWeek,
  getWeekStartEnd,
  getMonthStartEnd,
  getYearStartEnd,
  filterByDateRange,
  fillMissingDays,
  aggregateByMonth,
  addDerivedMetrics,
  extractAvailableYears
} from './storeKPIUtils';

const DEFAULT_VISIBLE_CHARTS = {
  ca: true,
  ventes: true,
  panierMoyen: true,
  tauxTransformation: true,
  indiceVente: true,
  articles: true
};

const DEFAULT_KPI_CONFIG = {
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
};

export function useStoreKPIModal({ onClose, onSuccess, initialDate = null, storeId = null }) {
  const defaultDate = initialDate || new Date().toISOString().split('T')[0];
  const [activeTab, setActiveTab] = useState('daily');
  const [overviewData, setOverviewData] = useState(null);
  const [overviewDate, setOverviewDate] = useState(defaultDate);
  const [showDailyAIModal, setShowDailyAIModal] = useState(false);
  const [showOverviewAIModal, setShowOverviewAIModal] = useState(false);

  const [viewMode, setViewMode] = useState('week');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedWeek, setSelectedWeek] = useState(getCurrentWeek());
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [historicalData, setHistoricalData] = useState([]);
  const [availableYears, setAvailableYears] = useState([]);
  const [datesWithData, setDatesWithData] = useState([]);
  const [lockedDates, setLockedDates] = useState([]);
  const [displayMode, setDisplayMode] = useState('chart');
  const [displayedListItems, setDisplayedListItems] = useState(10);
  const [loadingHistorical, setLoadingHistorical] = useState(false);
  const [visibleCharts, setVisibleCharts] = useState(DEFAULT_VISIBLE_CHARTS);

  const [formData, setFormData] = useState({ date: defaultDate, nb_prospects: '' });
  const [managerKPIData, setManagerKPIData] = useState({
    date: defaultDate,
    ca_journalier: '',
    nb_ventes: '',
    nb_clients: '',
    nb_articles: '',
    nb_prospects: ''
  });
  const [sellers, setSellers] = useState([]);
  const [sellersKPIData, setSellersKPIData] = useState({});
  const [loading, setLoading] = useState(false);
  const [loadingSellers, setLoadingSellers] = useState(false);
  const [kpiConfig, setKpiConfig] = useState(DEFAULT_KPI_CONFIG);

  const isDateLocked = (date) => lockedDates.includes(date);
  const isManagerDateLocked = isDateLocked(managerKPIData.date);

  const toggleChart = (chartKey) => {
    setVisibleCharts(prev => ({ ...prev, [chartKey]: !prev[chartKey] }));
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
    setLoadingHistorical(true);
    try {
      let startDate = null;
      let endDate = null;
      let days = 90;

      if (viewMode === 'week' && selectedWeek) {
        const range = getWeekStartEnd(selectedWeek);
        startDate = range.startDate;
        endDate = range.endDate;
        days = range.days;
      } else if (viewMode === 'month' && selectedMonth) {
        const range = getMonthStartEnd(selectedMonth);
        startDate = range.startDate;
        endDate = range.endDate;
        days = range.days;
      } else if (viewMode === 'year' && selectedYear) {
        const range = getYearStartEnd(selectedYear);
        startDate = range.startDate;
        endDate = range.endDate;
        days = range.days;
      }

      let historicalArray = await fetchRawHistoricalData(storeId, startDate, endDate, days);

      if (startDate && endDate) {
        historicalArray = filterByDateRange(historicalArray, startDate, endDate);
      }
      if (viewMode === 'month' && startDate && endDate) {
        historicalArray = fillMissingDays(historicalArray, startDate, endDate);
      }

      const aggregatedData = viewMode === 'year' ? aggregateByMonth(historicalArray) : historicalArray;
      const finalData = addDerivedMetrics(aggregatedData);

      if (!storeId && historicalArray.length > 0) {
        setAvailableYears(extractAvailableYears(historicalArray));
      }
      setHistoricalData(finalData);
    } catch (err) {
      logger.error('Error fetching historical data:', err);
      toast.error('Erreur lors du chargement des données historiques');
    } finally {
      setLoadingHistorical(false);
    }
  };

  async function fetchRawHistoricalData(storeIdParam, startDate, endDate, days) {
    if (storeIdParam) {
      let url = `/gerant/stores/${storeIdParam}/kpi-history?days=${days}`;
      if (startDate && endDate) {
        url = `/gerant/stores/${storeIdParam}/kpi-history?start_date=${startDate.toISOString().split('T')[0]}&end_date=${endDate.toISOString().split('T')[0]}`;
      }
      const historyRes = await api.get(url);
      const rawData = Array.isArray(historyRes.data) ? historyRes.data : [];
      return rawData.map(entry => ({
        date: entry.date,
        seller_ca: entry.ca_journalier || 0,
        seller_ventes: entry.nb_ventes || 0,
        seller_clients: entry.nb_clients || 0,
        seller_articles: entry.nb_articles || 0,
        seller_prospects: entry.nb_prospects || 0
      }));
    }

    const usersRes = await api.get('/manager/sellers');
    const sellersList = usersRes.data;
    const storeParam = storeIdParam ? '&store_id=' + storeIdParam : '';
    const startStr = startDate?.toISOString().split('T')[0];
    const endStr = endDate?.toISOString().split('T')[0];
    const kpiUrl = (sellerId) => startStr && endStr
      ? `/manager/kpi-entries/${sellerId}?start_date=${startStr}&end_date=${endStr}${storeParam}`
      : `/manager/kpi-entries/${sellerId}?days=${days}${storeParam}`;

    const today = new Date();
    const managerStart = new Date(today);
    managerStart.setDate(today.getDate() - days);
    const managerKpiUrl = storeIdParam
      ? `/manager/manager-kpi?start_date=${managerStart.toISOString().split('T')[0]}&end_date=${today.toISOString().split('T')[0]}&store_id=${storeIdParam}`
      : `/manager/manager-kpi?start_date=${managerStart.toISOString().split('T')[0]}&end_date=${today.toISOString().split('T')[0]}`;

    const [sellersDataResponses, managerKpiRes] = await Promise.all([
      Promise.all(sellersList.map(seller => api.get(kpiUrl(seller.id)))),
      api.get(managerKpiUrl)
    ]);

    const dateMap = {};
    const addEntry = (entry, caValue) => {
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
      const d = dateMap[entry.date];
      d.seller_ca += caValue;
      d.seller_ventes += entry.nb_ventes || 0;
      d.seller_clients += entry.nb_clients || 0;
      d.seller_articles += entry.nb_articles || 0;
      d.seller_prospects += entry.nb_prospects || 0;
    };

    sellersDataResponses.forEach(response => {
      if (response.data && Array.isArray(response.data)) {
        response.data.forEach(entry => addEntry(entry, entry.seller_ca || entry.ca_journalier || 0));
      }
    });
    if (managerKpiRes.data && Array.isArray(managerKpiRes.data)) {
      managerKpiRes.data.forEach(entry => addEntry(entry, entry.ca_journalier || 0));
    }

    return Object.values(dateMap).sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  const fetchDatesWithData = async () => {
    try {
      const days = 730;
      if (storeId) {
        const historyRes = await api.get(`/gerant/stores/${storeId}/kpi-history?days=${days}`);
        const rawData = Array.isArray(historyRes.data) ? historyRes.data : [];
        setDatesWithData(rawData.filter(e => (e.ca_journalier > 0) || (e.nb_ventes > 0)).map(e => e.date));
        setLockedDates(rawData.filter(e => e.locked === true).map(e => e.date));
      } else {
        const usersRes = await api.get('/manager/sellers');
        const today = new Date();
        const startDate = new Date(today);
        startDate.setDate(today.getDate() - days);
        const promises = usersRes.data.map(seller =>
          api.get(`/manager/kpi-entries/${seller.id}?start_date=${startDate.toISOString().split('T')[0]}&end_date=${today.toISOString().split('T')[0]}`)
        );
        const responses = await Promise.all(promises);
        const allDates = new Set();
        const allLocked = new Set();
        responses.forEach(res => {
          (res.data || []).forEach(entry => {
            if ((entry.ca_journalier > 0) || (entry.nb_ventes > 0)) allDates.add(entry.date);
            if (entry.locked === true) allLocked.add(entry.date);
          });
        });
        setDatesWithData([...allDates]);
        setLockedDates([...allLocked]);
      }
    } catch (err) {
      logger.error('Error fetching dates with data:', err);
    }
  };

  const fetchAvailableYears = async () => {
    try {
      if (storeId) {
        const res = await api.get(`/gerant/stores/${storeId}/available-years`);
        if (res.data.years && res.data.years.length > 0) setAvailableYears(res.data.years);
      }
    } catch (err) {
      logger.error('Error fetching available years:', err);
    }
  };

  const fetchSellers = async () => {
    try {
      setLoadingSellers(true);
      const storeParam = storeId ? '?store_id=' + storeId : '';
      const res = await api.get('/manager/sellers' + storeParam);
      const activeSellers = (res.data || []).filter(s => !s.status || s.status === 'active');
      setSellers(activeSellers);
    } catch (err) {
      logger.error('Error fetching sellers:', err);
      toast.error('Erreur lors du chargement des vendeurs');
      setSellers([]);
    } finally {
      setLoadingSellers(false);
    }
  };

  const fetchKPIConfig = async () => {
    try {
      const url = storeId ? `/gerant/stores/${storeId}/kpi-config` : '/manager/kpi-config';
      const res = await api.get(url);
      if (!res.data) return;
      let config = { ...res.data };
      if (config.seller_track_ca && config.manager_track_ca) config.manager_track_ca = false;
      if (config.seller_track_ventes && config.manager_track_ventes) config.manager_track_ventes = false;
      if (config.seller_track_clients && config.manager_track_clients) config.manager_track_clients = false;
      if (config.seller_track_articles && config.manager_track_articles) config.manager_track_articles = false;
      if (config.seller_track_prospects && config.manager_track_prospects) config.manager_track_prospects = false;
      if (!config.seller_track_ca && !config.manager_track_ca) config.seller_track_ca = true;
      if (!config.seller_track_ventes && !config.manager_track_ventes) config.seller_track_ventes = true;
      if (!config.seller_track_clients && !config.manager_track_clients) config.seller_track_clients = true;
      if (!config.seller_track_articles && !config.manager_track_articles) config.seller_track_articles = true;
      if (!config.seller_track_prospects && !config.manager_track_prospects) config.seller_track_prospects = true;
      setKpiConfig(config);
    } catch (err) {
      logger.error('Error fetching KPI config:', err);
    }
  };

  useEffect(() => {
    fetchKPIConfig();
    if (storeId) fetchAvailableYears();
    fetchDatesWithData();
  }, [storeId]);

  useEffect(() => {
    if (activeTab === 'daily') fetchOverviewData();
    else if (activeTab === 'overview') fetchHistoricalData();
  }, [activeTab, overviewDate, viewMode, selectedWeek, selectedMonth, selectedYear]);

  useEffect(() => {
    if (activeTab === 'prospects') fetchSellers();
  }, [activeTab, storeId]);

  const handleKPIUpdate = async (field, value) => {
    try {
      let updatedConfig = { ...kpiConfig, [field]: value };
      if (value === true) {
        const opposite = { seller_track_ca: 'manager_track_ca', manager_track_ca: 'seller_track_ca',
          seller_track_ventes: 'manager_track_ventes', manager_track_ventes: 'seller_track_ventes',
          seller_track_clients: 'manager_track_clients', manager_track_clients: 'seller_track_clients',
          seller_track_articles: 'manager_track_articles', manager_track_articles: 'seller_track_articles',
          seller_track_prospects: 'manager_track_prospects', manager_track_prospects: 'seller_track_prospects' };
        if (opposite[field]) updatedConfig[opposite[field]] = false;
      }
      const url = storeId ? `/gerant/stores/${storeId}/kpi-config` : `/manager/kpi-config${storeId ? '?store_id=' + storeId : ''}`;
      await api.put(url, updatedConfig);
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
      await api.post('/manager/store-kpi', { date: formData.date, nb_prospects: Number.parseInt(formData.nb_prospects, 10) });
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
      const sellers_data = [];
      sellers.forEach(seller => {
        const sellerKPI = sellersKPIData[seller.id];
        if (!sellerKPI) return;
        const sellerEntry = { seller_id: seller.id };
        if (kpiConfig.manager_track_ca && (sellerKPI.ca_journalier !== '' && sellerKPI.ca_journalier !== undefined)) {
          sellerEntry.ca_journalier = Number.parseFloat(sellerKPI.ca_journalier) || 0;
        }
        if (kpiConfig.manager_track_ventes && (sellerKPI.nb_ventes !== '' && sellerKPI.nb_ventes !== undefined)) {
          sellerEntry.nb_ventes = Number.parseInt(sellerKPI.nb_ventes, 10) || 0;
        }
        if (kpiConfig.manager_track_articles && (sellerKPI.nb_articles !== '' && sellerKPI.nb_articles !== undefined)) {
          sellerEntry.nb_articles = Number.parseInt(sellerKPI.nb_articles, 10) || 0;
        }
        if (Object.keys(sellerEntry).length > 1) sellers_data.push(sellerEntry);
      });
      const payload = { date: managerKPIData.date };
      if (sellers_data.length > 0) payload.sellers_data = sellers_data;
      if (kpiConfig.manager_track_prospects && managerKPIData.nb_prospects !== '') {
        payload.nb_prospects = Number.parseInt(managerKPIData.nb_prospects, 10) || 0;
      }
      const storeParam = storeId ? '?store_id=' + storeId : '';
      await api.post('/manager/manager-kpi' + storeParam, payload);
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

  return {
    activeTab,
    setActiveTab,
    overviewData,
    overviewDate,
    setOverviewDate,
    showDailyAIModal,
    setShowDailyAIModal,
    showOverviewAIModal,
    setShowOverviewAIModal,
    viewMode,
    setViewMode,
    selectedYear,
    setSelectedYear,
    selectedWeek,
    setSelectedWeek,
    selectedMonth,
    setSelectedMonth,
    historicalData,
    availableYears,
    datesWithData,
    lockedDates,
    displayMode,
    setDisplayMode,
    displayedListItems,
    setDisplayedListItems,
    loadingHistorical,
    visibleCharts,
    setVisibleCharts,
    toggleChart,
    formData,
    setFormData,
    managerKPIData,
    setManagerKPIData,
    sellers,
    sellersKPIData,
    setSellersKPIData,
    loading,
    loadingSellers,
    kpiConfig,
    isDateLocked,
    isManagerDateLocked,
    getCurrentWeek,
    fetchOverviewData,
    fetchHistoricalData,
    handleKPIUpdate,
    handleSubmit,
    handleManagerKPISubmit
  };
}
