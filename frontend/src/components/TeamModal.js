import React, { useState, useEffect, startTransition } from 'react';
import axios from 'axios';
import { X, Users, TrendingUp, Target, Award, AlertCircle, Info, PauseCircle, PlayCircle, Trash2, Archive } from 'lucide-react';
import { toast } from 'sonner';
import TeamAIAnalysisModal from './TeamAIAnalysisModal';
import ConfirmActionModal from './ConfirmActionModal';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Utility function to format numbers with spaces for thousands
const formatNumber = (num) => {
  if (!num && num !== 0) return '0';
  return Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};

// Custom compact tooltip
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/95 backdrop-blur-sm border border-gray-300 rounded-lg shadow-lg p-2 text-xs">
        <p className="font-semibold text-gray-800 mb-1">{label}</p>
        {payload.map((entry, index) => (
          <p key={`tooltip-${entry.name}-${entry.value}-${index}`} style={{ color: entry.color }} className="font-medium">
            {entry.name}: {formatNumber(entry.value)}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function TeamModal({ sellers, onClose, onViewSellerDetail, onDataUpdate }) {
  const [teamData, setTeamData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAIAnalysisModal, setShowAIAnalysisModal] = useState(false);
  const [periodFilter, setPeriodFilter] = useState('30'); // '7', '30', '90', 'all', 'custom'
  const [showNiveauTooltip, setShowNiveauTooltip] = useState(false);
  const [customDateRange, setCustomDateRange] = useState({ start: '', end: '' });
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  const [chartData, setChartData] = useState([]);
  const [visibleMetrics, setVisibleMetrics] = useState({
    ca: true,
    ventes: true,
    panierMoyen: true
  });
  const [visibleSellers, setVisibleSellers] = useState({});
  const [isUpdatingCharts, setIsUpdatingCharts] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [displayedSellerCount, setDisplayedSellerCount] = useState(5);
  const [hoveredButton, setHoveredButton] = useState(null); // Pour les tooltips des boutons d'action
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, action: null, seller: null }); // Modal de confirmation
  const [showArchivedSellers, setShowArchivedSellers] = useState(false); // Afficher vendeurs archivés
  const [archivedSellers, setArchivedSellers] = useState([]); // Liste des vendeurs archivés
  const [hiddenSellerIds, setHiddenSellerIds] = useState([]); // IDs des vendeurs à masquer temporairement

  // Initialize visible sellers only once when sellers change
  useEffect(() => {
    console.log(`[TeamModal] 🔄 Initializing visible sellers`);
    const initialVisibleSellers = {};
    sellers.forEach((seller, index) => {
      initialVisibleSellers[seller.id] = index < 5; // Only first 5 are visible
    });
    setVisibleSellers(initialVisibleSellers);
  }, [sellers]);

  // Fetch team data when sellers or period changes
  useEffect(() => {
    console.log(`[TeamModal] 🔄 Fetching team data for period: ${periodFilter}, custom dates: ${customDateRange.start} - ${customDateRange.end}`);
    // Only fetch if:
    // - Period is not custom, OR
    // - Period is custom AND both dates are set
    if (periodFilter !== 'custom' || (periodFilter === 'custom' && customDateRange.start && customDateRange.end)) {
      console.log(`[TeamModal] ✅ Conditions met, calling fetchTeamData()`);
      fetchTeamData();
    } else {
      console.log(`[TeamModal] ⏸️ Waiting for both dates to be set`);
    }
  }, [sellers, periodFilter, customDateRange.start, customDateRange.end]);

  // Prepare chart data when period changes
  useEffect(() => {
    console.log(`[TeamModal] 🔄 Period changed to: ${periodFilter}, preparing chart data`);
    if (Object.keys(visibleSellers).length > 0) {
      prepareChartData();
    }
  }, [periodFilter, visibleSellers, customDateRange]);

  const fetchTeamData = async (sellersToUse = sellers) => {
    // Only set loading on initial fetch
    if (teamData.length === 0) {
      setLoading(true);
    }
    
    try {
      const token = localStorage.getItem('token');
      
      console.log(`[TeamModal] ========== FETCHING DATA FOR PERIOD: ${periodFilter} days ==========`);
      
      // Fetch data for each seller
      const sellersDataPromises = sellersToUse.map(async (seller) => {
        try {
          const daysParam = periodFilter === 'all' ? '365' : (periodFilter === 'custom' ? '0' : periodFilter);
          
          // Build API params
          let apiParams = { _t: Date.now() };
          let kpiUrl = `${API}/manager/kpi-entries/${seller.id}?days=${daysParam}`;
          
          if (periodFilter === 'custom' && customDateRange.start && customDateRange.end) {
            kpiUrl = `${API}/manager/kpi-entries/${seller.id}?start_date=${customDateRange.start}&end_date=${customDateRange.end}`;
            console.log(`[TeamModal] 📥 Fetching ${seller.name} (ID: ${seller.id}) with custom dates: ${customDateRange.start} to ${customDateRange.end}`);
          } else {
            console.log(`[TeamModal] 📥 Fetching ${seller.name} (ID: ${seller.id}) with days=${daysParam}`);
          }
          
          const [statsRes, kpiRes, diagRes] = await Promise.all([
            axios.get(`${API}/manager/seller/${seller.id}/stats`, { 
              headers: { Authorization: `Bearer ${token}` },
              params: apiParams
            }),
            axios.get(kpiUrl, { 
              headers: { Authorization: `Bearer ${token}` },
              params: apiParams
            }),
            axios.get(`${API}/manager/seller/${seller.id}/diagnostic`, { 
              headers: { Authorization: `Bearer ${token}` },
              params: { _t: Date.now() } // Cache buster
            }).catch(() => ({ data: null })) // If no diagnostic, return null
          ]);

          const stats = statsRes.data;
          const kpiEntries = kpiRes.data;
          const diagnostic = diagRes.data;

          console.log(`[TeamModal] 📊 ${seller.name}: ${kpiEntries.length} entries returned from API`);
          
          // Debug: show first and last entry dates
          if (kpiEntries.length > 0) {
            console.log(`[TeamModal] 📅 ${seller.name} date range: ${kpiEntries[kpiEntries.length - 1]?.date} to ${kpiEntries[0]?.date}`);
          }

          // Calculate period totals
          const monthlyCA = kpiEntries.reduce((sum, entry) => sum + (entry.ca_journalier || 0), 0);
          const monthlyVentes = kpiEntries.reduce((sum, entry) => sum + (entry.nb_ventes || 0), 0);
          const panierMoyen = monthlyVentes > 0 ? monthlyCA / monthlyVentes : 0;
          
          // Debug: show a sample entry
          if (kpiEntries.length > 0) {
            console.log(`[TeamModal] 📋 ${seller.name} SAMPLE ENTRY:`, kpiEntries[0]);
          }
          
          console.log(`[TeamModal] 💰 ${seller.name} CALCULATED => CA: ${monthlyCA.toFixed(2)} €, Ventes: ${monthlyVentes}`);

          // Get competences scores
          const competences = stats.avg_radar_scores || {};
          const competencesList = [
            { name: 'Accueil', value: competences.accueil || 0 },
            { name: 'Découverte', value: competences.decouverte || 0 },
            { name: 'Argumentation', value: competences.argumentation || 0 },
            { name: 'Closing', value: competences.closing || 0 },
            { name: 'Fidélisation', value: competences.fidelisation || 0 }
          ];

          const avgCompetence = competencesList.reduce((sum, c) => sum + c.value, 0) / 5;
          
          // Check if all competences have the same value
          const allSameValue = competencesList.every(c => c.value === competencesList[0].value);
          const allZero = competencesList.every(c => c.value === 0);
          
          let bestCompetence, worstCompetence;
          
          if (allZero) {
            // If all scores are 0 (no diagnostic), indicate this
            bestCompetence = { name: 'Non évalué', value: 0 };
            worstCompetence = { name: 'Non évalué', value: 0 };
          } else if (allSameValue) {
            // If all competences are equal (initial questionnaire), indicate balanced profile
            bestCompetence = { name: 'Profil équilibré', value: competencesList[0].value };
            worstCompetence = { name: 'Profil équilibré', value: competencesList[0].value };
          } else {
            // Find actual best and worst
            bestCompetence = competencesList.reduce((max, c) => c.value > max.value ? c : max);
            worstCompetence = competencesList.reduce((min, c) => c.value < min.value ? c : min);
          }

          // Determine score source for transparency
          let scoreSource = 'none';
          if (diagnostic) {
            scoreSource = 'diagnostic'; // Basé sur questionnaire initial
          }
          // Note: In future, we could check if debriefs exist to show 'diagnostic+debriefs'

          return {
            ...seller,
            monthlyCA,
            monthlyVentes,
            panierMoyen,
            avgCompetence,
            bestCompetence,
            worstCompetence,
            lastKpiDate: kpiEntries.length > 0 ? kpiEntries[0].date : null,
            hasKpiToday: kpiEntries.some(e => e.date === new Date().toISOString().split('T')[0]),
            scoreSource,
            hasDiagnostic: !!diagnostic,
            niveau: diagnostic?.level || seller.niveau || 'Non défini'
          };
        } catch (err) {
          console.error(`Error fetching data for seller ${seller.id}:`, err);
          return {
            ...seller,
            monthlyCA: 0,
            monthlyVentes: 0,
            panierMoyen: 0,
            avgCompetence: 0,
            bestCompetence: { name: 'N/A', value: 0 },
            worstCompetence: { name: 'N/A', value: 0 },
            lastKpiDate: null,
            hasKpiToday: false
          };
        }
      });

      const sellersData = await Promise.all(sellersDataPromises);
      
      console.log(`[TeamModal] ✅ ALL DATA PROCESSED, setting state with ${sellersData.length} sellers:`);
      sellersData.forEach(s => {
        console.log(`[TeamModal]    - ${s.name}: CA=${s.monthlyCA.toFixed(2)} €`);
      });
      
      setTeamData(sellersData);
      
      // Also refresh chart data after team data is updated
      if (Object.keys(visibleSellers).length > 0) {
        console.log('[TeamModal] 📈 Refreshing chart data after team data update');
        prepareChartData();
      }
    } catch (err) {
      console.error('Error fetching team data:', err);
      toast.error('Erreur lors du chargement des données d\'équipe');
    } finally {
      setLoading(false);
    }
  };

  // Prepare chart data with aggregation

  // Fonction pour rafraîchir les données sans recharger la page
  const refreshSellersData = async () => {
    try {
      const token = localStorage.getItem('token');
      // Re-fetch la liste des vendeurs actifs
      const response = await axios.get(`${API}/manager/sellers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Re-fetch les vendeurs archivés
      const archivedResponse = await axios.get(`${API}/manager/sellers/archived`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setArchivedSellers(archivedResponse.data);
      
      // IMPORTANT: Re-calculer teamData avec les nouvelles données
      await fetchTeamData(response.data);
      
      // Nettoyer visibleSellers pour ne garder que les vendeurs actifs
      const activeSellerIds = response.data.map(s => s.id);
      setVisibleSellers(prev => {
        const cleaned = {};
        Object.keys(prev).forEach(sellerId => {
          if (activeSellerIds.includes(sellerId)) {
            cleaned[sellerId] = prev[sellerId];
          }
        });
        return cleaned;
      });
    } catch (error) {
      console.error('Erreur lors du rafraîchissement:', error);
    }
  };

  // Gérer la désactivation d'un vendeur
  const handleDeactivate = async (sellerId) => {
    // Fermer le modal de confirmation immédiatement
    setConfirmModal({ isOpen: false, action: null, seller: null });
    
    // Masquer le vendeur immédiatement
    setHiddenSellerIds(prev => [...prev, sellerId]);
    
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API}/manager/seller/${sellerId}/deactivate`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Vendeur mis en sommeil avec succès');
      
      // Refresh des données
      await refreshSellersData();
      // Nettoyer les IDs masqués après le refresh
      setHiddenSellerIds([]);
      
      // Notifier le parent pour recharger ses données
      if (onDataUpdate) {
        await onDataUpdate();
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la désactivation');
      // Restaurer l'affichage en cas d'erreur
      setHiddenSellerIds(prev => prev.filter(id => id !== sellerId));
    }
  };

  // Gérer la suppression d'un vendeur
  const handleDelete = async (sellerId) => {
    // Fermer le modal de confirmation immédiatement
    setConfirmModal({ isOpen: false, action: null, seller: null });
    
    // Masquer le vendeur immédiatement
    setHiddenSellerIds(prev => [...prev, sellerId]);
    
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/manager/seller/${sellerId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Vendeur supprimé avec succès');
      
      // Refresh des données
      await refreshSellersData();
      // Nettoyer les IDs masqués après le refresh
      setHiddenSellerIds([]);
      
      // Notifier le parent pour recharger ses données
      if (onDataUpdate) {
        await onDataUpdate();
      }
      
      // Notifier le parent pour recharger ses données
      if (onDataUpdate) {
        await onDataUpdate();
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la suppression');
      // Restaurer l'affichage en cas d'erreur
      setHiddenSellerIds(prev => prev.filter(id => id !== sellerId));
    }
  };

  // Gérer la réactivation d'un vendeur
  const handleReactivate = async (sellerId) => {
    // Fermer le modal de confirmation immédiatement
    setConfirmModal({ isOpen: false, action: null, seller: null });
    
    try {
      const token = localStorage.getItem('token');
      
      // Retirer de la liste archivée immédiatement
      setArchivedSellers(prev => prev.filter(s => s.id !== sellerId));
      
      await axios.put(`${API}/manager/seller/${sellerId}/reactivate`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Vendeur réactivé avec succès');
      
      // Refresh des données
      await refreshSellersData();
      
      // Notifier le parent pour recharger ses données
      if (onDataUpdate) {
        await onDataUpdate();
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la réactivation');
      // Recharger les archivés en cas d'erreur
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${API}/manager/sellers/archived`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setArchivedSellers(response.data);
      } catch (err) {
        console.error('Error restoring archived sellers:', err);
      }
    }
  };

  const prepareChartData = async () => {
    try {
      const token = localStorage.getItem('token');
      const daysParam = periodFilter === 'all' ? 365 : (periodFilter === 'custom' ? 0 : periodFilter);
      
      // Fetch historical KPI data for each seller
      const chartDataPromises = sellers.map(async (seller) => {
        try {
          let url = `${API}/manager/kpi-entries/${seller.id}?days=${daysParam}`;
          
          // Use custom dates if period is custom
          if (periodFilter === 'custom' && customDateRange.start && customDateRange.end) {
            url = `${API}/manager/kpi-entries/${seller.id}?start_date=${customDateRange.start}&end_date=${customDateRange.end}`;
          }
          
          const res = await axios.get(url, {
            headers: { Authorization: `Bearer ${token}` }
          });
          return { sellerId: seller.id, sellerName: seller.name, data: res.data };
        } catch (err) {
          return { sellerId: seller.id, sellerName: seller.name, data: [] };
        }
      });

      const sellersKpiData = await Promise.all(chartDataPromises);
      
      // Group data by date
      const dateMap = new Map();
      
      sellersKpiData.forEach(({ sellerId, sellerName, data }) => {
        data.forEach(entry => {
          const date = entry.date;
          if (!dateMap.has(date)) {
            dateMap.set(date, { date });
          }
          const dayData = dateMap.get(date);
          dayData[`ca_${sellerId}`] = entry.ca_journalier || 0;
          dayData[`ventes_${sellerId}`] = entry.nb_ventes || 0;
          dayData[`panier_${sellerId}`] = entry.nb_ventes > 0 ? (entry.ca_journalier / entry.nb_ventes) : 0;
          dayData[`name_${sellerId}`] = sellerName;
        });
      });

      // Sort by date
      let chartArray = Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));
      
      // Aggregate data based on period for better readability
      if (periodFilter === '30') {
        // Weekly aggregation for 30 days
        chartArray = aggregateByWeek(chartArray, sellers);
      } else if (periodFilter === '90') {
        // Bi-weekly aggregation for 3 months
        chartArray = aggregateByBiWeek(chartArray, sellers);
      } else if (periodFilter === 'all') {
        // Monthly aggregation for year
        chartArray = aggregateByMonth(chartArray, sellers);
      } else if (periodFilter === 'custom') {
        // Determine aggregation based on date range length
        if (customDateRange.start && customDateRange.end) {
          const start = new Date(customDateRange.start);
          const end = new Date(customDateRange.end);
          const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
          
          if (daysDiff > 90) {
            // Monthly aggregation for long periods
            chartArray = aggregateByMonth(chartArray, sellers);
          } else if (daysDiff > 30) {
            // Bi-weekly aggregation for medium periods
            chartArray = aggregateByBiWeek(chartArray, sellers);
          } else if (daysDiff > 14) {
            // Weekly aggregation for ~month periods
            chartArray = aggregateByWeek(chartArray, sellers);
          }
          // Else keep daily data for short periods
        }
      }
      
      setChartData(chartArray);
    } catch (err) {
      console.error('Error preparing chart data:', err);
    }
  };

  // Aggregation functions
  const aggregateByWeek = (data, sellers) => {
    const weeks = new Map();
    data.forEach(day => {
      const date = new Date(day.date);
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay()); // Start of week (Sunday)
      const weekKey = weekStart.toISOString().split('T')[0];
      
      if (!weeks.has(weekKey)) {
        weeks.set(weekKey, { date: weekKey, count: 0 });
        sellers.forEach(seller => {
          weeks.get(weekKey)[`ca_${seller.id}`] = 0;
          weeks.get(weekKey)[`ventes_${seller.id}`] = 0;
          weeks.get(weekKey)[`panier_${seller.id}`] = 0;
          weeks.get(weekKey)[`name_${seller.id}`] = seller.name;
        });
      }
      
      const week = weeks.get(weekKey);
      sellers.forEach(seller => {
        week[`ca_${seller.id}`] += day[`ca_${seller.id}`] || 0;
        week[`ventes_${seller.id}`] += day[`ventes_${seller.id}`] || 0;
      });
      week.count++;
    });
    
    // Calculate average panier moyen
    weeks.forEach(week => {
      sellers.forEach(seller => {
        if (week[`ventes_${seller.id}`] > 0) {
          week[`panier_${seller.id}`] = week[`ca_${seller.id}`] / week[`ventes_${seller.id}`];
        }
      });
    });
    
    return Array.from(weeks.values()).sort((a, b) => a.date.localeCompare(b.date));
  };

  const aggregateByBiWeek = (data, sellers) => {
    const biWeeks = new Map();
    data.forEach(day => {
      const date = new Date(day.date);
      const dayOfYear = Math.floor((date - new Date(date.getFullYear(), 0, 0)) / 86400000);
      const biWeekNum = Math.floor(dayOfYear / 14);
      const biWeekKey = `${date.getFullYear()}-BW${biWeekNum}`;
      
      if (!biWeeks.has(biWeekKey)) {
        biWeeks.set(biWeekKey, { date: day.date, count: 0 });
        sellers.forEach(seller => {
          biWeeks.get(biWeekKey)[`ca_${seller.id}`] = 0;
          biWeeks.get(biWeekKey)[`ventes_${seller.id}`] = 0;
          biWeeks.get(biWeekKey)[`panier_${seller.id}`] = 0;
          biWeeks.get(biWeekKey)[`name_${seller.id}`] = seller.name;
        });
      }
      
      const biWeek = biWeeks.get(biWeekKey);
      sellers.forEach(seller => {
        biWeek[`ca_${seller.id}`] += day[`ca_${seller.id}`] || 0;
        biWeek[`ventes_${seller.id}`] += day[`ventes_${seller.id}`] || 0;
      });
      biWeek.count++;
    });
    
    // Calculate average panier moyen
    biWeeks.forEach(biWeek => {
      sellers.forEach(seller => {
        if (biWeek[`ventes_${seller.id}`] > 0) {
          biWeek[`panier_${seller.id}`] = biWeek[`ca_${seller.id}`] / biWeek[`ventes_${seller.id}`];
        }
      });
    });
    
    return Array.from(biWeeks.values()).sort((a, b) => a.date.localeCompare(b.date));
  };

  const aggregateByMonth = (data, sellers) => {
    const months = new Map();
    data.forEach(day => {
      const date = new Date(day.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!months.has(monthKey)) {
        months.set(monthKey, { date: `${monthKey}-01`, count: 0 });
        sellers.forEach(seller => {
          months.get(monthKey)[`ca_${seller.id}`] = 0;
          months.get(monthKey)[`ventes_${seller.id}`] = 0;
          months.get(monthKey)[`panier_${seller.id}`] = 0;
          months.get(monthKey)[`name_${seller.id}`] = seller.name;
        });
      }
      
      const month = months.get(monthKey);
      sellers.forEach(seller => {
        month[`ca_${seller.id}`] += day[`ca_${seller.id}`] || 0;
        month[`ventes_${seller.id}`] += day[`ventes_${seller.id}`] || 0;
      });
      month.count++;
    });
    
    // Calculate average panier moyen
    months.forEach(month => {
      sellers.forEach(seller => {
        if (month[`ventes_${seller.id}`] > 0) {
          month[`panier_${seller.id}`] = month[`ca_${seller.id}`] / month[`ventes_${seller.id}`];
        }
      });
    });
    
    return Array.from(months.values()).sort((a, b) => a.date.localeCompare(b.date));
  };


  // Calculate team totals
  const teamTotalCA = teamData.reduce((sum, s) => sum + (s.monthlyCA || 0), 0);
  const teamTotalVentes = teamData.reduce((sum, s) => sum + (s.monthlyVentes || 0), 0);
  const sellersWithKPI = teamData.filter(s => s.hasKpiToday).length;
  
  console.log('[TeamModal] 📊 Team totals:', { teamTotalCA, teamTotalVentes, teamDataLength: teamData.length });

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) { onClose(); } }} className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-cyan-600 to-blue-600 p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users className="w-8 h-8" />
              <div>
                <h2 className="text-2xl font-bold">Mon Équipe</h2>
                <p className="text-sm opacity-90">Vue d'ensemble managériale</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600"></div>
              <p className="text-gray-600 mt-4">Chargement des données...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Tabs: Actifs / Archivés */}
              <div className="flex gap-2 border-b border-gray-200 mb-6">
                <button
                  onClick={() => setShowArchivedSellers(false)}
                  className={`px-4 py-2 font-medium transition-colors ${
                    !showArchivedSellers
                      ? 'text-cyan-600 border-b-2 border-cyan-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Vendeurs actifs
                  </div>
                </button>
                <button
                  onClick={async () => {
                    setShowArchivedSellers(true);
                    // Charger les vendeurs archivés
                    try {
                      const token = localStorage.getItem('token');
                      const response = await axios.get(`${API}/manager/sellers/archived`, {
                        headers: { Authorization: `Bearer ${token}` }
                      });
                      setArchivedSellers(response.data);
                    } catch (error) {
                      console.error('Error fetching archived sellers:', error);
                      toast.error('Erreur lors du chargement des vendeurs archivés');
                    }
                  }}
                  className={`px-4 py-2 font-medium transition-colors ${
                    showArchivedSellers
                      ? 'text-orange-600 border-b-2 border-orange-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Archive className="w-4 h-4" />
                    Vendeurs archivés
                  </div>
                </button>
              </div>

              {/* Period Filter */}
              {!showArchivedSellers && (
              <div className="flex items-center justify-between mb-4">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-700">📅 Période :</span>
                    <div className="flex gap-2">
                      {[
                        { value: '7', label: '7 jours' },
                        { value: '30', label: '30 jours' },
                        { value: '90', label: '3 mois' },
                        { value: 'all', label: 'Année' }
                      ].map(option => (
                        <button
                          key={option.value}
                          onClick={() => {
                            setPeriodFilter(option.value);
                            setShowCustomDatePicker(false);
                          }}
                          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                            periodFilter === option.value
                              ? 'bg-[#1E40AF] text-white shadow-md'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                      <button
                        onClick={() => {
                          setShowCustomDatePicker(!showCustomDatePicker);
                          if (!showCustomDatePicker) {
                            // Only set to custom when opening the picker
                            setPeriodFilter('custom');
                          }
                        }}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                          periodFilter === 'custom'
                            ? 'bg-purple-600 text-white shadow-md'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        📆 Personnalisée
                      </button>
                    </div>
                  </div>
                  
                  {/* Custom Date Picker */}
                  {showCustomDatePicker && (
                    <div className="bg-purple-50 rounded-lg p-4 border-2 border-purple-200">
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                        <div className="flex-1">
                          <label className="block text-xs font-semibold text-gray-700 mb-1">Date de début</label>
                          <input
                            type="date"
                            value={customDateRange.start}
                            onChange={(e) => {
                              const newStart = e.target.value;
                              setCustomDateRange(prev => ({ ...prev, start: newStart }));
                              
                              // Set to custom mode if both dates will be set
                              if (newStart && customDateRange.end) {
                                setPeriodFilter('custom');
                              }
                            }}
                            onFocus={(e) => {
                              // Ouvrir le calendrier au focus
                              try {
                                if (typeof e.target.showPicker === 'function') {
                                  e.target.showPicker();
                                }
                              } catch (error) {
                                // showPicker n'est pas supporté par ce navigateur
                                console.log('showPicker not supported');
                              }
                            }}
                            className="w-full px-3 py-2 text-sm border-2 border-purple-300 rounded-lg focus:border-purple-500 focus:outline-none cursor-pointer"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="block text-xs font-semibold text-gray-700 mb-1">Date de fin</label>
                          <input
                            type="date"
                            value={customDateRange.end}
                            onChange={(e) => {
                              const newEnd = e.target.value;
                              setCustomDateRange(prev => ({ ...prev, end: newEnd }));
                              
                              // Set to custom mode if both dates are now set
                              if (customDateRange.start && newEnd) {
                                setPeriodFilter('custom');
                              }
                            }}
                            onFocus={(e) => {
                              // Ouvrir le calendrier au focus
                              try {
                                if (typeof e.target.showPicker === 'function') {
                                  e.target.showPicker();
                                }
                              } catch (error) {
                                // showPicker n'est pas supporté par ce navigateur
                                console.log('showPicker not supported');
                              }
                            }}
                            className="w-full px-3 py-2 text-sm border-2 border-purple-300 rounded-lg focus:border-purple-500 focus:outline-none cursor-pointer"
                          />
                        </div>
                      </div>
                      {periodFilter === 'custom' && customDateRange.start && customDateRange.end && (
                        <p className="text-xs text-purple-700 mt-2">
                          ✅ Période active : du {new Date(customDateRange.start).toLocaleDateString('fr-FR')} au {new Date(customDateRange.end).toLocaleDateString('fr-FR')}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
              )}

              {!showArchivedSellers && (
              <>{/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg p-4 border border-blue-200">
                  <div className="flex items-center gap-3 mb-2">
                    <Users className="w-5 h-5 text-blue-600" />
                    <span className="text-sm font-semibold text-gray-700">Équipe</span>
                  </div>
                  <div className="text-2xl font-bold text-blue-900">
                    {teamData.filter(seller => !hiddenSellerIds.includes(seller.id) && (!seller.status || seller.status === 'active')).length}
                  </div>
                  <div className="text-xs text-blue-600 mt-1">
                    vendeur{teamData.filter(seller => !hiddenSellerIds.includes(seller.id) && (!seller.status || seller.status === 'active')).length > 1 ? 's' : ''} actif{teamData.filter(seller => !hiddenSellerIds.includes(seller.id) && (!seller.status || seller.status === 'active')).length > 1 ? 's' : ''}
                  </div>
                </div>

                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200">
                  <div className="flex items-center gap-3 mb-2">
                    <TrendingUp className="w-5 h-5 text-[#10B981]" />
                    <span className="text-sm font-semibold text-gray-700">Performance Globale</span>
                  </div>
                  <div className="text-2xl font-bold text-green-900">{formatNumber(teamTotalCA)} €</div>
                  <div className="text-xs text-[#10B981] mt-1">
                    {formatNumber(teamTotalVentes)} ventes sur {
                      periodFilter === '7' ? '7 jours' :
                      periodFilter === '30' ? '30 jours' :
                      periodFilter === '90' ? '3 mois' :
                      periodFilter === 'custom' && customDateRange.start && customDateRange.end ? 
                        'période personnalisée' :
                      periodFilter === 'all' ? 'l\'année' :
                      'la période sélectionnée'
                    }
                  </div>
                </div>

                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg p-4 border border-indigo-200 flex flex-col items-center justify-center">
                  <button
                    onClick={() => setShowAIAnalysisModal(true)}
                    className="px-6 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all flex items-center gap-2"
                  >
                    🤖 Analyse IA de l'équipe
                  </button>
                </div>

              </div>

              {/* Sellers Table */}
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-bold text-gray-800">Détail par Vendeur</h3>
                    <span className="text-xs text-gray-600">
                      Performance sur {
                        periodFilter === '7' ? '7 jours' :
                        periodFilter === '30' ? '30 jours' :
                        periodFilter === '90' ? '3 mois' :
                        'l\'année'
                      }
                    </span>
                  </div>
                  {/* Search Input */}
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="🔍 Rechercher un vendeur..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setDisplayedSellerCount(5); // Reset to 5 when searching
                      }}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => {
                          setSearchQuery('');
                          setDisplayedSellerCount(5);
                        }}
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Vendeur</th>
                        <th className="px-4 py-3 text-right font-semibold text-gray-700">
                          CA {periodFilter === '7' ? '7j' : periodFilter === '30' ? '30j' : periodFilter === '90' ? '3m' : 'An'}
                        </th>
                        <th className="px-4 py-3 text-right font-semibold text-gray-700">Ventes</th>
                        <th className="px-4 py-3 text-right font-semibold text-gray-700">Panier Moy.</th>
                        <th className="px-4 py-3 text-center font-semibold text-gray-700">
                          <div className="flex items-center justify-center gap-1">
                            <span>Niveau</span>
                            <div className="relative">
                              <Info 
                                className="w-3.5 h-3.5 text-blue-500 cursor-help" 
                                onMouseEnter={() => setShowNiveauTooltip(true)}
                                onMouseLeave={() => setShowNiveauTooltip(false)}
                              />
                              {showNiveauTooltip && (
                                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-50 w-72 p-4 bg-gray-900 text-white text-xs rounded-lg shadow-2xl">
                                  <div className="space-y-2">
                                    <div className="font-semibold text-sm mb-3 text-center border-b border-gray-700 pb-2">Les 4 Niveaux</div>
                                    <div><span className="font-bold text-green-300">⚡ Nouveau Talent:</span> Découvre le terrain, teste, apprend les bases</div>
                                    <div><span className="font-bold text-yellow-300">🟡 Challenger:</span> A pris ses repères, cherche à performer</div>
                                    <div><span className="font-bold text-orange-300">🟠 Ambassadeur:</span> Inspire confiance, maîtrise les étapes de vente</div>
                                    <div><span className="font-bold text-red-300">🔴 Maître du Jeu:</span> Expert relation client, adapte son style</div>
                                  </div>
                                  <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-8 border-transparent border-t-gray-900"></div>
                                </div>
                              )}
                            </div>
                          </div>
                        </th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Point Fort</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">À Améliorer</th>
                        <th className="px-4 py-3 text-center font-semibold text-gray-700">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teamData
                        .filter(seller => 
                          // Exclure les vendeurs masqués temporairement
                          !hiddenSellerIds.includes(seller.id) &&
                          // Exclure les vendeurs inactifs ou supprimés
                          (!seller.status || seller.status === 'active') &&
                          // Filtre de recherche
                          (seller.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          seller.email.toLowerCase().includes(searchQuery.toLowerCase()))
                        )
                        .slice(0, displayedSellerCount)
                        .map((seller, idx) => (
                        <tr key={`${seller.id}-${periodFilter}`} className={`border-b border-gray-100 hover:bg-gray-50 transition-all duration-300 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className={`w-8 h-8 ${seller.status === 'active' ? 'bg-cyan-100' : seller.status === 'inactive' ? 'bg-orange-100' : 'bg-gray-100'} rounded-full flex items-center justify-center`}>
                                <span className={`text-sm font-bold ${seller.status === 'active' ? 'text-cyan-700' : seller.status === 'inactive' ? 'text-orange-700' : 'text-gray-700'}`}>{seller.name.charAt(0)}</span>
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-gray-800">{seller.name}</span>
                                  {seller.status === 'inactive' && (
                                    <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-medium rounded">
                                      En sommeil
                                    </span>
                                  )}
                                  {seller.status === 'deleted' && (
                                    <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded">
                                      Supprimé
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-gray-500">{seller.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right text-gray-700 font-medium">{formatNumber(seller.monthlyCA)} €</td>
                          <td className="px-4 py-3 text-right text-gray-700">{formatNumber(seller.monthlyVentes)}</td>
                          <td className="px-4 py-3 text-right text-gray-700">{formatNumber(seller.panierMoyen)} €</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${
                              (seller.niveau === 'Maître du Jeu' || seller.niveau === 'Expert') ? 'bg-red-100 text-red-800' :
                              (seller.niveau === 'Ambassadeur' || seller.niveau === 'Confirmé') ? 'bg-orange-100 text-orange-800' :
                              seller.niveau === 'Challenger' ? 'bg-yellow-100 text-yellow-800' :
                              (seller.niveau === 'Nouveau Talent' || seller.niveau === 'Explorateur' || seller.niveau === 'Apprenti') ? 'bg-green-100 text-green-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {(seller.niveau === 'Maître du Jeu' || seller.niveau === 'Expert') && '🔴 '}
                              {(seller.niveau === 'Ambassadeur' || seller.niveau === 'Confirmé') && '🟠 '}
                              {seller.niveau === 'Challenger' && '🟡 '}
                              {(seller.niveau === 'Nouveau Talent' || seller.niveau === 'Explorateur' || seller.niveau === 'Apprenti') && '⚡ '}
                              {seller.niveau}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-green-700 font-medium">{seller.bestCompetence.name}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-orange-700 font-medium">{seller.worstCompetence.name}</span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2 justify-center">
                              <button
                                onClick={() => onViewSellerDetail(seller)}
                                className="px-3 py-1.5 bg-[#1E40AF] text-white text-xs font-medium rounded hover:bg-blue-700 transition-colors"
                                title="Voir le détail"
                              >
                                Voir détail
                              </button>
                              
                              {seller.status === 'active' ? (
                                <>
                                  <div className="relative">
                                    <button
                                      onClick={() => setConfirmModal({ isOpen: true, action: 'deactivate', seller })}
                                      onMouseEnter={() => setHoveredButton(`pause-${seller.id}`)}
                                      onMouseLeave={() => setHoveredButton(null)}
                                      className="p-2 bg-orange-100 text-orange-600 rounded hover:bg-orange-200 transition-colors relative"
                                    >
                                      <PauseCircle className="w-4 h-4" />
                                    </button>
                                    {hoveredButton === `pause-${seller.id}` && (
                                      <div className="absolute right-full top-1/2 transform -translate-y-1/2 mr-2 z-[9999] w-64 bg-gray-900 text-white text-xs rounded-lg shadow-2xl p-3 pointer-events-none whitespace-nowrap">
                                        <div className="font-bold mb-2 text-orange-400">🟠 Mettre en sommeil</div>
                                        <div className="text-gray-300 space-y-1">
                                          <div>• Libère 1 siège</div>
                                          <div>• Réversible</div>
                                          <div>• Historique conservé</div>
                                        </div>
                                        <div className="absolute left-full top-1/2 transform -translate-y-1/2 border-4 border-transparent border-l-gray-900"></div>
                                      </div>
                                    )}
                                  </div>
                                  
                                  <div className="relative">
                                    <button
                                      onClick={() => setConfirmModal({ isOpen: true, action: 'delete', seller })}
                                      onMouseEnter={() => setHoveredButton(`delete-${seller.id}`)}
                                      onMouseLeave={() => setHoveredButton(null)}
                                      className="p-2 bg-red-100 text-red-600 rounded hover:bg-red-200 transition-colors relative"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                    {hoveredButton === `delete-${seller.id}` && (
                                      <div className="absolute right-full top-1/2 transform -translate-y-1/2 mr-2 z-[9999] w-64 bg-gray-900 text-white text-xs rounded-lg shadow-2xl p-3 pointer-events-none whitespace-nowrap">
                                        <div className="font-bold mb-2 text-red-400">🔴 Supprimer définitivement</div>
                                        <div className="text-gray-300 space-y-1">
                                          <div>• Libère 1 siège</div>
                                          <div>• Action irréversible</div>
                                          <div>• Historique conservé</div>
                                        </div>
                                        <div className="absolute left-full top-1/2 transform -translate-y-1/2 border-4 border-transparent border-l-gray-900"></div>
                                      </div>
                                    )}
                                  </div>
                                </>
                              ) : seller.status === 'inactive' ? (
                                <div className="relative">
                                  <button
                                    onClick={() => setConfirmModal({ isOpen: true, action: 'reactivate', seller })}
                                    onMouseEnter={() => setHoveredButton(`reactivate-${seller.id}`)}
                                    onMouseLeave={() => setHoveredButton(null)}
                                    className="p-2 bg-green-100 text-green-600 rounded hover:bg-green-200 transition-colors relative"
                                  >
                                    <PlayCircle className="w-4 h-4" />
                                  </button>
                                  {hoveredButton === `reactivate-${seller.id}` && (
                                    <div className="absolute right-full top-1/2 transform -translate-y-1/2 mr-2 z-[9999] w-72 bg-gray-900 text-white text-xs rounded-lg shadow-2xl p-3 pointer-events-none whitespace-nowrap">
                                      <div className="font-bold mb-2 text-green-400">🟢 Réactiver</div>
                                      <div className="text-gray-300 space-y-1">
                                        <div>• Consomme 1 siège</div>
                                        <div>• Le vendeur peut se reconnecter</div>
                                        <div>• Historique intact</div>
                                      </div>
                                      <div className="absolute left-full top-1/2 transform -translate-y-1/2 border-4 border-transparent border-l-gray-900"></div>
                                    </div>
                                  )}
                                </div>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                {/* Show More Button */}
                {teamData.filter(seller => 
                  !hiddenSellerIds.includes(seller.id) &&
                  (!seller.status || seller.status === 'active') &&
                  (seller.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  seller.email.toLowerCase().includes(searchQuery.toLowerCase()))
                ).length > displayedSellerCount && (
                  <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 text-center">
                    <button
                      onClick={() => setDisplayedSellerCount(prev => prev + 5)}
                      className="px-4 py-2 text-sm font-medium text-[#1E40AF] hover:text-cyan-700 hover:bg-cyan-50 rounded-lg transition-colors"
                    >
                      Afficher 5 vendeurs de plus ({teamData.filter(seller => 
                        !hiddenSellerIds.includes(seller.id) &&
                        (!seller.status || seller.status === 'active') &&
                        (seller.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        seller.email.toLowerCase().includes(searchQuery.toLowerCase()))
                      ).length - displayedSellerCount} restants)
                    </button>
                  </div>
                )}
              </div>
              </>
              )}

              {/* Section Vendeurs Archivés */}
              {showArchivedSellers && (
                <div className="bg-white rounded-lg border border-gray-200">
                  <div className="p-4 bg-gradient-to-r from-orange-50 to-amber-50 border-b border-gray-200">
                    <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                      <Archive className="w-5 h-5 text-orange-600" />
                      Vendeurs Archivés ({archivedSellers.length})
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Vendeurs en sommeil ou supprimés - L'historique est conservé
                    </p>
                  </div>

                  {archivedSellers.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      <Archive className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p>Aucun vendeur archivé</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-gray-50 text-gray-600 text-sm">
                            <th className="px-4 py-3 text-left font-semibold">Vendeur</th>
                            <th className="px-4 py-3 text-center font-semibold">Statut</th>
                            <th className="px-4 py-3 text-center font-semibold">Date archivage</th>
                            <th className="px-4 py-3 text-center font-semibold">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {archivedSellers.map((seller) => (
                            <tr key={seller.id} className="border-t border-gray-200 hover:bg-gray-50">
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <div className={`w-8 h-8 ${seller.status === 'inactive' ? 'bg-orange-100' : 'bg-gray-200'} rounded-full flex items-center justify-center`}>
                                    <span className={`text-sm font-bold ${seller.status === 'inactive' ? 'text-orange-700' : 'text-gray-600'}`}>
                                      {seller.name.charAt(0)}
                                    </span>
                                  </div>
                                  <div>
                                    <div className="font-medium text-gray-800">{seller.name}</div>
                                    <div className="text-xs text-gray-500">{seller.email}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-center">
                                {seller.status === 'inactive' ? (
                                  <span className="px-3 py-1 bg-orange-100 text-orange-700 text-xs font-medium rounded-full">
                                    En sommeil
                                  </span>
                                ) : (
                                  <span className="px-3 py-1 bg-gray-200 text-gray-700 text-xs font-medium rounded-full">
                                    Supprimé
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-center text-sm text-gray-600">
                                {seller.deactivated_at 
                                  ? new Date(seller.deactivated_at).toLocaleDateString('fr-FR')
                                  : seller.deleted_at
                                  ? new Date(seller.deleted_at).toLocaleDateString('fr-FR')
                                  : '-'
                                }
                              </td>
                              <td className="px-4 py-3 text-center">
                                <div className="flex items-center gap-2 justify-center">
                                  <button
                                    onClick={() => onViewSellerDetail(seller)}
                                    className="px-3 py-1.5 bg-cyan-600 text-white text-xs font-medium rounded hover:bg-cyan-700 transition-colors"
                                  >
                                    Voir historique
                                  </button>
                                  {seller.status === 'inactive' && (
                                    <button
                                      onClick={() => setConfirmModal({ isOpen: true, action: 'reactivate', seller })}
                                      className="p-2 bg-green-100 text-green-600 rounded hover:bg-green-200 transition-colors"
                                      title="Réactiver"
                                    >
                                      <PlayCircle className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Charts Section */}
              {!showArchivedSellers && (
              <div className="mt-8 space-y-6">
                {isUpdatingCharts && (
                  <div className="text-center py-8">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600"></div>
                    <p className="text-gray-600 mt-2 text-sm">Mise à jour des graphiques...</p>
                  </div>
                )}
                {!isUpdatingCharts && (
                <>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-gray-800">📊 Comparaison des Performances</h3>
                    
                    {/* Metric Filters */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => startTransition(() => setVisibleMetrics(prev => ({ ...prev, ca: !prev.ca })))}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          visibleMetrics.ca 
                            ? 'bg-blue-500 text-white' 
                            : 'bg-gray-200 text-gray-600'
                        }`}
                      >
                        {visibleMetrics.ca ? '✓' : ''} CA
                      </button>
                      <button
                        onClick={() => startTransition(() => setVisibleMetrics(prev => ({ ...prev, ventes: !prev.ventes })))}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          visibleMetrics.ventes 
                            ? 'bg-[#10B981] text-white' 
                            : 'bg-gray-200 text-gray-600'
                        }`}
                      >
                        {visibleMetrics.ventes ? '✓' : ''} Ventes
                      </button>
                      <button
                        onClick={() => startTransition(() => setVisibleMetrics(prev => ({ ...prev, panierMoyen: !prev.panierMoyen })))}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          visibleMetrics.panierMoyen 
                            ? 'bg-purple-500 text-white' 
                            : 'bg-gray-200 text-gray-600'
                        }`}
                      >
                        {visibleMetrics.panierMoyen ? '✓' : ''} Panier Moy.
                      </button>
                    </div>
                  </div>

                  {/* Seller Filters */}
                  <div className="flex items-start gap-2">
                    <span className="text-sm text-gray-600 font-medium mt-1.5">Vendeurs :</span>
                    <div className="flex flex-wrap gap-2">
                      {teamData
                        .filter(seller => 
                          !hiddenSellerIds.includes(seller.id) && 
                          (!seller.status || seller.status === 'active')
                        )
                        .map((seller, idx) => {
                        // Define colors for first 5 sellers
                        const colors = [
                          { bg: 'bg-blue-500', text: 'text-white' },
                          { bg: 'bg-[#10B981]', text: 'text-white' },
                          { bg: 'bg-[#F97316]', text: 'text-white' },
                          { bg: 'bg-purple-500', text: 'text-white' },
                          { bg: 'bg-pink-500', text: 'text-white' }
                        ];
                        const colorSet = colors[idx % 5] || { bg: 'bg-gray-500', text: 'text-white' };
                        
                        // Ne compter que les vendeurs actifs et sélectionnés
                        const selectedCount = Object.entries(visibleSellers)
                          .filter(([sellerId, isVisible]) => {
                            const s = teamData.find(sel => sel.id === sellerId);
                            return isVisible && s && !hiddenSellerIds.includes(sellerId) && (!s.status || s.status === 'active');
                          }).length;
                        const canSelect = visibleSellers[seller.id] || selectedCount < 5;
                        
                        return (
                          <button
                            key={seller.id}
                            onClick={() => {
                              if (canSelect) {
                                // Démontage temporaire des graphiques pour éviter les erreurs React
                                setIsUpdatingCharts(true);
                                setTimeout(() => {
                                  setVisibleSellers(prev => ({ ...prev, [seller.id]: !prev[seller.id] }));
                                  setTimeout(() => setIsUpdatingCharts(false), 50);
                                }, 50);
                              }
                            }}
                            disabled={!canSelect || isUpdatingCharts}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                              visibleSellers[seller.id]
                                ? `${colorSet.bg} ${colorSet.text}`
                                : canSelect 
                                  ? 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            }`}
                            title={!canSelect ? 'Maximum 5 vendeurs sélectionnés' : ''}
                          >
                            {visibleSellers[seller.id] ? '✓' : ''} {seller.name.split(' ')[0]}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 mt-1 ml-20">
                    {Object.entries(visibleSellers)
                      .filter(([sellerId, isVisible]) => {
                        // Ne compter que les vendeurs actifs et visibles
                        const seller = teamData.find(s => s.id === sellerId);
                        return isVisible && seller && !hiddenSellerIds.includes(sellerId) && (!seller.status || seller.status === 'active');
                      }).length} / 5 vendeurs sélectionnés
                  </div>
                </div>

                {/* Period Filter - Duplicate for convenience */}
                <div className="bg-gradient-to-r from-cyan-50 to-blue-50 rounded-lg p-3 border border-cyan-200">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-700 font-medium">📅 Période :</span>
                      <div className="flex gap-2">
                        {[
                          { value: '7', label: '7 jours' },
                          { value: '30', label: '30 jours' },
                          { value: '90', label: '3 mois' },
                          { value: 'all', label: 'Année' }
                        ].map(period => (
                          <button
                            key={period.value}
                            onClick={() => {
                              setPeriodFilter(period.value);
                              setShowCustomDatePicker(false);
                            }}
                            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                              periodFilter === period.value
                                ? 'bg-[#1E40AF] text-white shadow-md'
                                : 'bg-white text-gray-700 hover:bg-cyan-100'
                            }`}
                          >
                            {period.label}
                          </button>
                        ))}
                        <button
                          onClick={() => {
                            setShowCustomDatePicker(!showCustomDatePicker);
                            if (!showCustomDatePicker) {
                              // Only set to custom when opening the picker
                              setPeriodFilter('custom');
                            }
                          }}
                          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                            periodFilter === 'custom'
                              ? 'bg-purple-600 text-white shadow-md'
                              : 'bg-white text-gray-700 hover:bg-cyan-100'
                          }`}
                        >
                          📆 Personnalisée
                        </button>
                      </div>
                    </div>
                    
                    {/* Custom Date Picker - Second Location */}
                    {showCustomDatePicker && (
                      <div className="bg-purple-50 rounded-lg p-4 border-2 border-purple-200">
                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <label className="block text-xs font-semibold text-gray-700 mb-1">Date de début</label>
                            <input
                              type="date"
                              value={customDateRange.start}
                              onChange={(e) => {
                                const newStart = e.target.value;
                                setCustomDateRange(prev => ({ ...prev, start: newStart }));
                                
                                // Set to custom mode if both dates will be set
                                if (newStart && customDateRange.end) {
                                  setPeriodFilter('custom');
                                }
                              }}
                              onFocus={(e) => {
                                // Ouvrir le calendrier au focus
                                try {
                                  if (typeof e.target.showPicker === 'function') {
                                    e.target.showPicker();
                                  }
                                } catch (error) {
                                  // showPicker n'est pas supporté par ce navigateur
                                  console.log('showPicker not supported');
                                }
                              }}
                              className="w-full px-3 py-2 text-sm border-2 border-purple-300 rounded-lg focus:border-purple-500 focus:outline-none cursor-pointer"
                            />
                          </div>
                          <div className="flex-1">
                            <label className="block text-xs font-semibold text-gray-700 mb-1">Date de fin</label>
                            <input
                              type="date"
                              value={customDateRange.end}
                              onChange={(e) => {
                                const newEnd = e.target.value;
                                setCustomDateRange(prev => ({ ...prev, end: newEnd }));
                                
                                // Set to custom mode if both dates are now set
                                if (customDateRange.start && newEnd) {
                                  setPeriodFilter('custom');
                                }
                              }}
                              onFocus={(e) => {
                                // Ouvrir le calendrier au focus
                                try {
                                  if (typeof e.target.showPicker === 'function') {
                                    e.target.showPicker();
                                  }
                                } catch (error) {
                                  // showPicker n'est pas supporté par ce navigateur
                                  console.log('showPicker not supported');
                                }
                              }}
                              className="w-full px-3 py-2 text-sm border-2 border-purple-300 rounded-lg focus:border-purple-500 focus:outline-none cursor-pointer"
                            />
                          </div>
                        </div>
                        {periodFilter === 'custom' && customDateRange.start && customDateRange.end && (
                          <p className="text-xs text-purple-700 mt-2">
                            ✅ Période active : du {new Date(customDateRange.start).toLocaleDateString('fr-FR')} au {new Date(customDateRange.end).toLocaleDateString('fr-FR')}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* CA Chart */}
                  {visibleMetrics.ca && (
                    <div key={`chart-ca-${Object.keys(visibleSellers).filter(id => visibleSellers[id]).join('-')}`} className="bg-white rounded-lg p-4 border-2 border-blue-200">
                      <h4 className="font-semibold text-gray-800 mb-3 text-sm">💰 Chiffre d'Affaires (€)</h4>
                      <ResponsiveContainer width="100%" height={280}>
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis 
                            dataKey="date"
                            tick={{ fontSize: 10 }}
                            interval={periodFilter === 'all' ? 0 : periodFilter === '90' ? 1 : 'preserveStartEnd'}
                            angle={periodFilter === 'all' || periodFilter === '90' ? -45 : 0}
                            textAnchor={periodFilter === 'all' || periodFilter === '90' ? 'end' : 'middle'}
                            height={periodFilter === 'all' || periodFilter === '90' ? 60 : 30}
                            tickFormatter={(value) => {
                              const date = new Date(value);
                              if (periodFilter === 'all') {
                                return date.toLocaleDateString('fr-FR', { month: 'short' });
                              } else if (periodFilter === '90') {
                                return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
                              }
                              return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
                            }}
                          />
                          <YAxis tick={{ fontSize: 10 }} />
                          <RechartsTooltip content={<CustomTooltip />} />
                          {teamData
                            .filter(seller => 
                              visibleSellers[seller.id] && 
                              !hiddenSellerIds.includes(seller.id) && 
                              (!seller.status || seller.status === 'active')
                            )
                            .map((seller, idx) => (
                            <Line 
                              key={seller.id}
                              type="monotone" 
                              dataKey={`ca_${seller.id}`}
                              name={chartData[0]?.[`name_${seller.id}`] || seller.name}
                              stroke={idx === 0 ? '#3b82f6' : idx === 1 ? '#10b981' : idx === 2 ? '#f59e0b' : idx === 3 ? '#8b5cf6' : '#ec4899'}
                              strokeWidth={2}
                              dot={{ r: 2 }}
                            />
                          ))}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* Ventes Chart */}
                  {visibleMetrics.ventes && (
                    <div key={`chart-ventes-${Object.keys(visibleSellers).filter(id => visibleSellers[id]).join('-')}`} className="bg-white rounded-lg p-4 border-2 border-green-200">
                      <h4 className="font-semibold text-gray-800 mb-3 text-sm">🛍️ Nombre de Ventes</h4>
                      <ResponsiveContainer width="100%" height={280}>
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis 
                            dataKey="date"
                            tick={{ fontSize: 10 }}
                            interval={periodFilter === 'all' ? 0 : periodFilter === '90' ? 1 : 'preserveStartEnd'}
                            angle={periodFilter === 'all' || periodFilter === '90' ? -45 : 0}
                            textAnchor={periodFilter === 'all' || periodFilter === '90' ? 'end' : 'middle'}
                            height={periodFilter === 'all' || periodFilter === '90' ? 60 : 30}
                            tickFormatter={(value) => {
                              const date = new Date(value);
                              if (periodFilter === 'all') {
                                return date.toLocaleDateString('fr-FR', { month: 'short' });
                              } else if (periodFilter === '90') {
                                return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
                              }
                              return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
                            }}
                          />
                          <YAxis tick={{ fontSize: 10 }} />
                          <RechartsTooltip content={<CustomTooltip />} />
                          {teamData
                            .filter(seller => 
                              visibleSellers[seller.id] && 
                              !hiddenSellerIds.includes(seller.id) && 
                              (!seller.status || seller.status === 'active')
                            )
                            .map((seller, idx) => (
                            <Line 
                              key={seller.id}
                              type="monotone" 
                              dataKey={`ventes_${seller.id}`}
                              name={chartData[0]?.[`name_${seller.id}`] || seller.name}
                              stroke={idx === 0 ? '#3b82f6' : idx === 1 ? '#10b981' : idx === 2 ? '#f59e0b' : idx === 3 ? '#8b5cf6' : '#ec4899'}
                              strokeWidth={2}
                              dot={{ r: 2 }}
                            />
                          ))}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* Panier Moyen Chart */}
                  {visibleMetrics.panierMoyen && (
                    <div key={`chart-panier-${Object.keys(visibleSellers).filter(id => visibleSellers[id]).join('-')}`} className="bg-white rounded-lg p-4 border-2 border-purple-200">
                      <h4 className="font-semibold text-gray-800 mb-3 text-sm">💳 Panier Moyen (€)</h4>
                      <ResponsiveContainer width="100%" height={280}>
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis 
                            dataKey="date"
                            tick={{ fontSize: 10 }}
                            interval={periodFilter === 'all' ? 0 : periodFilter === '90' ? 1 : 'preserveStartEnd'}
                            angle={periodFilter === 'all' || periodFilter === '90' ? -45 : 0}
                            textAnchor={periodFilter === 'all' || periodFilter === '90' ? 'end' : 'middle'}
                            height={periodFilter === 'all' || periodFilter === '90' ? 60 : 30}
                            tickFormatter={(value) => {
                              const date = new Date(value);
                              if (periodFilter === 'all') {
                                return date.toLocaleDateString('fr-FR', { month: 'short' });
                              } else if (periodFilter === '90') {
                                return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
                              }
                              return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
                            }}
                          />
                          <YAxis tick={{ fontSize: 10 }} />
                          <RechartsTooltip content={<CustomTooltip />} />
                          {teamData
                            .filter(seller => 
                              visibleSellers[seller.id] && 
                              !hiddenSellerIds.includes(seller.id) && 
                              (!seller.status || seller.status === 'active')
                            )
                            .map((seller, idx) => (
                            <Line 
                              key={seller.id}
                              type="monotone" 
                              dataKey={`panier_${seller.id}`}
                              name={chartData[0]?.[`name_${seller.id}`] || seller.name}
                              stroke={idx === 0 ? '#3b82f6' : idx === 1 ? '#10b981' : idx === 2 ? '#f59e0b' : idx === 3 ? '#8b5cf6' : '#ec4899'}
                              strokeWidth={2}
                              dot={{ r: 2 }}
                            />
                          ))}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
                </>
                )}
              </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* AI Analysis Modal */}
      {showAIAnalysisModal && (
        <TeamAIAnalysisModal
          teamData={teamData}
          onClose={() => setShowAIAnalysisModal(false)}
        />
      )}

      {/* Modal de confirmation */}
      <ConfirmActionModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false, action: null, seller: null })}
        onConfirm={() => {
          if (confirmModal.action === 'deactivate') {
            handleDeactivate(confirmModal.seller.id);
          } else if (confirmModal.action === 'delete') {
            handleDelete(confirmModal.seller.id);
          } else if (confirmModal.action === 'reactivate') {
            handleReactivate(confirmModal.seller.id);
          }
        }}
        action={confirmModal.action}
        sellerName={confirmModal.seller?.name}
      />
    </div>
  );
}
