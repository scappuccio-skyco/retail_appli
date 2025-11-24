import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Plus, Building2, Users, TrendingUp, BarChart3, Settings } from 'lucide-react';
import { toast } from 'sonner';
import StoreCard from '../components/gerant/StoreCard';
import CreateStoreModal from '../components/gerant/CreateStoreModal';
import StoreDetailModal from '../components/gerant/StoreDetailModal';
import ManagerTransferModal from '../components/gerant/ManagerTransferModal';
import SellerTransferModal from '../components/gerant/SellerTransferModal';
import DeleteStoreConfirmation from '../components/gerant/DeleteStoreConfirmation';
import InviteStaffModal from '../components/gerant/InviteStaffModal';
import SubscriptionModal from '../components/SubscriptionModal';

const GerantDashboard = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const backendUrl = process.env.REACT_APP_BACKEND_URL;

  const [stores, setStores] = useState([]);
  const [globalStats, setGlobalStats] = useState(null);
  const [storesStats, setStoresStats] = useState({});
  const [loading, setLoading] = useState(true);
  
  // Period selection state
  const [periodType, setPeriodType] = useState('week'); // 'week', 'month', 'year'
  const [periodOffset, setPeriodOffset] = useState(-1); // -1 = période dernière complète

  // Modal states
  const [showCreateStoreModal, setShowCreateStoreModal] = useState(false);
  const [showStoreDetailModal, setShowStoreDetailModal] = useState(false);
  const [showManagerTransferModal, setShowManagerTransferModal] = useState(false);
  const [showSellerTransferModal, setShowSellerTransferModal] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [showInviteStaffModal, setShowInviteStaffModal] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  
  // Selected items for modals
  const [selectedStore, setSelectedStore] = useState(null);
  const [selectedManager, setSelectedManager] = useState(null);
  const [selectedSeller, setSelectedSeller] = useState(null);
  const [subscriptionInfo, setSubscriptionInfo] = useState(null);

  // Helper: Calculer les dates de début et fin selon le type de période
  const getPeriodDates = (type = 'week', offset = 0) => {
    const now = new Date();
    
    if (type === 'week') {
      const currentDay = now.getDay();
      const diff = currentDay === 0 ? -6 : 1 - currentDay; // Lundi = début de semaine
      
      const monday = new Date(now);
      monday.setDate(now.getDate() + diff + (offset * 7));
      monday.setHours(0, 0, 0, 0);
      
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);
      
      return { start: monday, end: sunday };
    } else if (type === 'month') {
      const targetMonth = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      const start = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1);
      start.setHours(0, 0, 0, 0);
      
      const end = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
      
      return { start, end };
    } else if (type === 'year') {
      const targetYear = now.getFullYear() + offset;
      const start = new Date(targetYear, 0, 1);
      start.setHours(0, 0, 0, 0);
      
      const end = new Date(targetYear, 11, 31);
      end.setHours(23, 59, 59, 999);
      
      return { start, end };
    }
    
    return { start: now, end: now };
  };

  // Helper: Formater la période selon le type
  const formatPeriod = (type = 'week', offset = 0) => {
    const { start, end } = getPeriodDates(type, offset);
    
    if (type === 'week') {
      const formatDate = (date) => {
        const day = date.getDate();
        const month = date.toLocaleDateString('fr-FR', { month: 'short' });
        return `${day} ${month}`;
      };
      
      if (offset === 0) {
        return `Semaine actuelle (${formatDate(start)} - ${formatDate(end)})`;
      } else {
        return `Semaine du ${formatDate(start)} au ${formatDate(end)}`;
      }
    } else if (type === 'month') {
      const monthName = start.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
      return offset === 0 ? `Mois actuel (${monthName})` : monthName.charAt(0).toUpperCase() + monthName.slice(1);
    } else if (type === 'year') {
      const year = start.getFullYear();
      return offset === 0 ? `Année actuelle (${year})` : `Année ${year}`;
    }
    
    return '';
  };

  // Helper: Obtenir le numéro de période
  const getPeriodNumber = (type, date) => {
    if (type === 'week') {
      const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
      const dayNum = d.getUTCDay() || 7;
      d.setUTCDate(d.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    } else if (type === 'month') {
      return date.getMonth() + 1;
    } else if (type === 'year') {
      return date.getFullYear();
    }
    return 0;
  };

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('token');

      // Récupérer les stats globales et la liste des magasins
      const statsResponse = await fetch(`${backendUrl}/api/gerant/dashboard/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (statsResponse.ok) {
        const data = await statsResponse.json();
        setGlobalStats(data);
        setStores(data.stores || []);

        // Récupérer les stats détaillées de chaque magasin avec period_type et period_offset
        const storesStatsPromises = data.stores.map(store =>
          fetch(`${backendUrl}/api/gerant/stores/${store.id}/stats?period_type=${periodType}&period_offset=${periodOffset}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          }).then(res => res.json())
        );

        const storesStatsData = await Promise.all(storesStatsPromises);
        const statsMap = {};
        storesStatsData.forEach((stats, index) => {
          statsMap[data.stores[index].id] = stats;
        });
        setStoresStats(statsMap);
      }
    } catch (error) {
      console.error('Erreur chargement données:', error);
    } finally {
      setLoading(false);
    }
  };

  // Charger les données au montage
  useEffect(() => {
    if (user) {
      fetchDashboardData();
      fetchSubscriptionInfo();
    }
    // fetchDashboardData ne change pas, donc on peut ignorer l'avertissement
    // eslint-disable-next-line
  }, [user]);

  // Recharger les stats quand periodType ou periodOffset change
  useEffect(() => {
    if (user && stores.length > 0) {
      fetchDashboardData();
    }
    // eslint-disable-next-line
  }, [periodType, periodOffset]);

  const fetchSubscriptionInfo = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${backendUrl}/api/subscription/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setSubscriptionInfo(data);
    } catch (err) {
      console.error('Error fetching subscription:', err);
    }
  };

  const handleLogoutClick = () => {
    if (onLogout) {
      onLogout();
    } else {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      navigate('/login');
    }
  };

  const handleStoreClick = (store) => {
    setSelectedStore(store);
    setShowStoreDetailModal(true);
  };

  const handleCreateStore = async (formData) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${backendUrl}/api/gerant/stores`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Erreur lors de la création');
      }

      toast.success('Magasin créé avec succès ! 🎉');
      await fetchDashboardData();
    } catch (error) {
      console.error('Erreur création magasin:', error);
      throw error;
    }
  };

  const handleTransferManager = async (managerId, newStoreId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${backendUrl}/api/gerant/managers/${managerId}/transfer`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ new_store_id: newStoreId })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Erreur lors du transfert');
      }

      const result = await response.json();
      
      if (result.warning) {
        toast.warning(result.warning);
      } else {
        toast.success('Manager transféré avec succès ! 🎉');
      }
      
      await fetchDashboardData();
    } catch (error) {
      console.error('Erreur transfert manager:', error);
      throw error;
    }
  };

  const handleTransferSeller = async (sellerId, newStoreId, newManagerId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${backendUrl}/api/gerant/sellers/${sellerId}/transfer`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          new_store_id: newStoreId,
          new_manager_id: newManagerId
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Erreur lors du transfert');
      }

      toast.success('Vendeur transféré avec succès ! 🎉');
      await fetchDashboardData();
    } catch (error) {
      console.error('Erreur transfert vendeur:', error);
      throw error;
    }
  };

  const handleDeleteStore = async (storeId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${backendUrl}/api/gerant/stores/${storeId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Erreur lors de la suppression');
      }

      toast.success('Magasin supprimé avec succès');
      await fetchDashboardData();
    } catch (error) {
      console.error('Erreur suppression magasin:', error);
      throw error;
    }
  };

  const handleInviteStaff = async (inviteData) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${backendUrl}/api/gerant/invitations`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(inviteData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Erreur lors de l\'invitation');
      }

      const roleText = inviteData.role === 'manager' ? 'Manager' : 'Vendeur';
      toast.success(`Invitation envoyée avec succès ! 📨 Le ${roleText} recevra un email pour rejoindre votre équipe.`);
      
      await fetchDashboardData();
    } catch (error) {
      console.error('Erreur invitation:', error);
      throw error;
    }
  };

  // Calculer les performances pour la période sélectionnée
  const getStorePerformanceData = () => {
    if (!stores || stores.length === 0) return [];

    const { start: periodStart, end: periodEnd } = getPeriodDates(periodType, periodOffset);

    return stores.map(store => {
      const stats = storesStats[store.id] || {};
      
      const periodCA = stats.period_ca || 0;
      const prevPeriodCA = stats.prev_period_ca || 0;
      const periodVentes = stats.period_ventes || 0;
      
      // Calcul évolution vs période précédente
      const periodEvolution = prevPeriodCA > 0 ? ((periodCA - prevPeriodCA) / prevPeriodCA) * 100 : 0;
      
      return {
        ...store,
        stats,
        periodCA,
        periodVentes,
        periodEvolution,
        periodStart,
        periodEnd
      };
    });
  };

  // Classement des magasins par CA
  const rankedStores = getStorePerformanceData().sort((a, b) => b.weekCA - a.weekCA);
  
  // Calculer les badges de performance
  const getPerformanceBadge = (store) => {
    const storeData = rankedStores.find(s => s.id === store.id);
    if (!storeData) return null;

    const avgCA = rankedStores.reduce((sum, s) => sum + s.weekCA, 0) / rankedStores.length;
    const relativePerformance = avgCA > 0 ? ((storeData.weekCA - avgCA) / avgCA) * 100 : 0;
    
    // Badge basé sur performance relative ET évolution
    if (relativePerformance > 20 || storeData.weekEvolution > 15) {
      return { 
        type: 'excellent', 
        bgClass: 'bg-green-500', 
        icon: '🔥', 
        label: 'Excellent' 
      };
    } else if (relativePerformance > 0 || storeData.weekEvolution > 5) {
      return { 
        type: 'good', 
        bgClass: 'bg-blue-500', 
        icon: '👍', 
        label: 'Bon' 
      };
    } else if (relativePerformance > -20 && storeData.weekEvolution > -10) {
      return { 
        type: 'average', 
        bgClass: 'bg-orange-500', 
        icon: '⚡', 
        label: 'Moyen' 
      };
    } else {
      return { 
        type: 'weak', 
        bgClass: 'bg-red-500', 
        icon: '⚠️', 
        label: 'À améliorer' 
      };
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-orange-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-orange-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-orange-50 to-white">
      {/* Header */}
      <div className="bg-white shadow-md border-b-4 border-orange-500">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-orange-500 bg-clip-text text-transparent">
                🏢 Dashboard Gérant
              </h1>
              <p className="text-sm text-gray-600">Bonjour, {user?.name}</p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowSubscriptionModal(true)}
                className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-[#1E40AF] to-[#1E3A8A] text-white font-medium rounded-lg hover:shadow-lg transition-all text-sm"
              >
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">Mon abonnement</span>
              </button>
              <button
                onClick={handleLogoutClick}
                className="flex items-center gap-2 px-4 py-2.5 bg-white border-2 border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 hover:shadow-md transition-all"
              >
                <LogOut className="w-5 h-5" />
                <span className="hidden sm:inline">Déconnexion</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats Globales */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-orange-600" />
            Vue d'Ensemble
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Magasins */}
            <div className="glass-morphism rounded-xl p-6 border-2 border-orange-200">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Magasins</p>
                  <p className="text-2xl font-bold text-gray-800">{globalStats?.total_stores || 0}</p>
                </div>
              </div>
            </div>

            {/* Total Managers */}
            <div className="glass-morphism rounded-xl p-6 border-2 border-blue-200">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Managers</p>
                  <p className="text-2xl font-bold text-gray-800">{globalStats?.total_managers || 0}</p>
                </div>
              </div>
            </div>

            {/* Total Vendeurs */}
            <div className="glass-morphism rounded-xl p-6 border-2 border-indigo-200">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                  <Users className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Vendeurs</p>
                  <p className="text-2xl font-bold text-gray-800">{globalStats?.total_sellers || 0}</p>
                </div>
              </div>
            </div>

            {/* CA Cumulé du Mois */}
            <div className="glass-morphism rounded-xl p-6 border-2 border-green-200">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">CA du Mois</p>
                  <p className="text-2xl font-bold text-gray-800">
                    {globalStats?.month_ca ? `${globalStats.month_ca.toLocaleString('fr-FR')} €` : '0 €'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Semaine */}
        <div className="mb-8">
          <div className="glass-morphism rounded-xl p-4 border-2 border-blue-200">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setWeekOffset(weekOffset - 1)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-all"
              >
                <span>◀</span>
                <span className="hidden sm:inline">Semaine précédente</span>
              </button>
              
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-1">📅 Période analysée</p>
                <p className="text-lg font-bold text-gray-800">
                  {formatWeekPeriod(weekOffset)}
                </p>
                <p className="text-xs text-gray-500">
                  Semaine {getWeekNumber(getWeekDates(weekOffset).start)}
                </p>
              </div>
              
              <button
                onClick={() => setWeekOffset(weekOffset + 1)}
                disabled={weekOffset >= 0}
                className={`flex items-center gap-2 px-4 py-2 font-semibold rounded-lg transition-all ${
                  weekOffset >= 0 
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                <span className="hidden sm:inline">Semaine suivante</span>
                <span>▶</span>
              </button>
            </div>
            
            {weekOffset !== 0 && (
              <div className="mt-3 text-center">
                <button
                  onClick={() => setWeekOffset(0)}
                  className="text-sm text-blue-600 hover:text-blue-700 font-semibold underline"
                >
                  ↻ Revenir à la semaine actuelle
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Classement des Magasins */}
        {rankedStores.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-orange-600" />
              🏆 Classement de la Semaine
            </h2>
            <div className="glass-morphism rounded-xl p-6 border-2 border-orange-200">
              <div className="space-y-3">
                {rankedStores.slice(0, 5).map((storeData, index) => {
                  const badge = getPerformanceBadge(storeData);
                  const rankEmoji = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
                  
                  return (
                    <div
                      key={storeData.id}
                      className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200 hover:shadow-md transition-all"
                    >
                      <div className="flex items-center gap-4">
                        <span className="text-2xl font-bold w-12 text-center">{rankEmoji}</span>
                        <div>
                          <p className="font-bold text-gray-800">{storeData.name}</p>
                          <p className="text-sm text-gray-600">{storeData.location}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-lg font-bold text-gray-800">
                            {storeData.weekCA.toLocaleString('fr-FR')} €
                          </p>
                          <p className="text-xs text-gray-500">{storeData.weekVentes} ventes</p>
                        </div>
                        {storeData.weekEvolution !== 0 && (
                          <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold ${
                            storeData.weekEvolution > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {storeData.weekEvolution > 0 ? '↗' : '↘'} {Math.abs(storeData.weekEvolution).toFixed(0)}%
                          </div>
                        )}
                        {badge && (
                          <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            badge.type === 'excellent' ? 'bg-green-100 text-green-700' :
                            badge.type === 'good' ? 'bg-blue-100 text-blue-700' :
                            badge.type === 'average' ? 'bg-orange-100 text-orange-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {badge.icon} {badge.label}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Mes Magasins */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Building2 className="w-6 h-6 text-orange-600" />
              Mes Magasins
            </h2>
            <div className="flex gap-3">
              <button
                onClick={() => setShowInviteStaffModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all"
              >
                <Users className="w-5 h-5" />
                Inviter du Personnel
              </button>
              <button
                onClick={() => setShowCreateStoreModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all"
              >
                <Plus className="w-5 h-5" />
                Nouveau Magasin
              </button>
            </div>
          </div>

          {stores.length === 0 ? (
            <div className="glass-morphism rounded-xl p-12 text-center">
              <Building2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">Aucun magasin pour le moment</p>
              <button
                onClick={() => setShowCreateStoreModal(true)}
                className="px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all"
              >
                Créer votre premier magasin
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {stores.map((store) => {
                const badge = getPerformanceBadge(store);
                const stats = storesStats[store.id];
                
                // Générer données sparkline (4 dernières semaines)
                // Pour le moment, données simulées - à remplacer par vraies données
                const sparklineData = stats ? [
                  (stats.week_ca || 0) * 0.7,
                  (stats.week_ca || 0) * 0.85,
                  (stats.week_ca || 0) * 0.95,
                  (stats.week_ca || 0)
                ] : [];
                
                return (
                  <StoreCard
                    key={store.id}
                    store={store}
                    stats={stats}
                    badge={badge}
                    sparklineData={sparklineData}
                    onClick={() => handleStoreClick(store)}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showCreateStoreModal && (
        <CreateStoreModal
          onClose={() => setShowCreateStoreModal(false)}
          onCreate={handleCreateStore}
        />
      )}

      {showStoreDetailModal && selectedStore && (
        <StoreDetailModal
          store={selectedStore}
          onClose={() => {
            setShowStoreDetailModal(false);
            setSelectedStore(null);
          }}
          onTransferManager={(manager) => {
            setSelectedManager(manager);
            setShowManagerTransferModal(true);
          }}
          onTransferSeller={(seller) => {
            setSelectedSeller(seller);
            setShowSellerTransferModal(true);
          }}
          onDeleteStore={(store) => {
            setSelectedStore(store);
            setShowDeleteConfirmation(true);
          }}
          onRefresh={fetchDashboardData}
        />
      )}

      {showManagerTransferModal && selectedManager && (
        <ManagerTransferModal
          manager={selectedManager}
          stores={stores}
          currentStoreId={selectedStore?.id}
          onClose={() => {
            setShowManagerTransferModal(false);
            setSelectedManager(null);
          }}
          onTransfer={handleTransferManager}
        />
      )}

      {showSellerTransferModal && selectedSeller && (
        <SellerTransferModal
          seller={selectedSeller}
          stores={stores}
          currentStoreId={selectedStore?.id}
          onClose={() => {
            setShowSellerTransferModal(false);
            setSelectedSeller(null);
          }}
          onTransfer={handleTransferSeller}
        />
      )}

      {showDeleteConfirmation && selectedStore && (
        <DeleteStoreConfirmation
          store={selectedStore}
          onClose={() => {
            setShowDeleteConfirmation(false);
            // Don't reset selectedStore here as StoreDetailModal might still need it
          }}
          onDelete={handleDeleteStore}
        />
      )}

      {showInviteStaffModal && (
        <InviteStaffModal
          onClose={() => setShowInviteStaffModal(false)}
          onInvite={handleInviteStaff}
          stores={stores}
        />
      )}

      {/* Subscription Modal */}
      <SubscriptionModal 
        isOpen={showSubscriptionModal}
        onClose={() => {
          setShowSubscriptionModal(false);
          fetchSubscriptionInfo();
        }}
        subscriptionInfo={subscriptionInfo}
      />
    </div>
  );
};

export default GerantDashboard;
