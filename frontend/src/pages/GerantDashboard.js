import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Plus, Building2, Users, TrendingUp, BarChart3, Settings, Key, UserCog, Info, Lock, Upload, Headphones, Store } from 'lucide-react';
import CreateStoreModal from '../components/gerant/CreateStoreModal';
import BulkStoreImportModal from '../components/gerant/BulkStoreImportModal';
import TutorialButton from '../components/onboarding/TutorialButton';
import OnboardingModal from '../components/onboarding/OnboardingModal';
import { gerantSteps } from '../components/onboarding/gerantSteps';
import { useOnboarding } from '../hooks/useOnboarding';
import { toast } from 'sonner';
import axios from 'axios';
import StoreCard from '../components/gerant/StoreCard';
import StoreDetailModal from '../components/gerant/StoreDetailModal';
import ManagerTransferModal from '../components/gerant/ManagerTransferModal';
import SellerTransferModal from '../components/gerant/SellerTransferModal';
import DeleteStoreConfirmation from '../components/gerant/DeleteStoreConfirmation';
import InviteStaffModal from '../components/gerant/InviteStaffModal';
import SubscriptionModal from '../components/SubscriptionModal';
import SupportModal from '../components/SupportModal';
import APIKeysManagement from '../components/gerant/APIKeysManagement';
import StaffOverview from '../components/gerant/StaffOverview';
import StoresManagement from '../components/gerant/StoresManagement';

const GerantDashboard = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const backendUrl = process.env.REACT_APP_BACKEND_URL;

  const [stores, setStores] = useState([]);
  const [globalStats, setGlobalStats] = useState(null);
  const [storesStats, setStoresStats] = useState({}); // Pour les cartes (toujours semaine -1)
  const [rankingStats, setRankingStats] = useState({}); // Pour le classement (période sélectionnée)
  const [pendingInvitations, setPendingInvitations] = useState({ managers: 0, sellers: 0 });
  const [loading, setLoading] = useState(true);
  
  // View state
  const [activeView, setActiveView] = useState('dashboard'); // 'dashboard' ou 'api'
  
  // Period selection state
  const [periodType, setPeriodType] = useState('week'); // 'week', 'month', 'year'
  const [periodOffset, setPeriodOffset] = useState(-1); // -1 = période dernière complète

  // Modal states
  const [showCreateStoreModal, setShowCreateStoreModal] = useState(false);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [showStoreDetailModal, setShowStoreDetailModal] = useState(false);
  const [showManagerTransferModal, setShowManagerTransferModal] = useState(false);
  const [showSellerTransferModal, setShowSellerTransferModal] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [showInviteStaffModal, setShowInviteStaffModal] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);
  
  // Onboarding
  const onboarding = useOnboarding(gerantSteps.length);
  
  // Selected items for modals
  const [selectedStore, setSelectedStore] = useState(null);
  const [selectedStoreColorIndex, setSelectedStoreColorIndex] = useState(0);
  const [selectedManager, setSelectedManager] = useState(null);
  const [selectedSeller, setSelectedSeller] = useState(null);
  const [subscriptionInfo, setSubscriptionInfo] = useState(null);

  // === MODE LECTURE SEULE : Calcul basé sur l'état de l'abonnement ===
  // Accès autorisé si :
  // - Abonnement actif (status === 'active')
  // - Essai en cours avec trial_end dans le futur
  const isReadOnly = (() => {
    if (!subscriptionInfo) return false; // Attendre les données
    
    const status = subscriptionInfo.status;
    
    // Abonnement actif = accès complet
    if (status === 'active') return false;
    
    // Essai en cours = vérifier si trial_end est dans le futur
    if (status === 'trialing') {
      if (subscriptionInfo.trial_end) {
        const trialEndDate = new Date(subscriptionInfo.trial_end);
        const now = new Date();
        // Si trial_end est dans le futur (ou aujourd'hui) = accès autorisé
        if (trialEndDate >= now) return false;
      }
      // Pas de date ou date passée = lecture seule
      return true;
    }
    
    // Tous les autres statuts = lecture seule
    return true;
  })();

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

  // Fonction pour récupérer les stats des cartes (toujours semaine -1)
  const fetchStoreCardsData = async (storesList) => {
    try {
      const token = localStorage.getItem('token');
      
      // Récupérer deux jeux de données: année courante ET dernière semaine complète
      const yearPromises = storesList.map(store =>
        fetch(`${backendUrl}/api/gerant/stores/${store.id}/stats?period_type=year&period_offset=0`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }).then(res => res.json())
      );
      
      const weekPromises = storesList.map(store =>
        fetch(`${backendUrl}/api/gerant/stores/${store.id}/stats?period_type=week&period_offset=-2`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }).then(res => res.json())
      );
      
      const [yearStatsArray, weekStatsArray] = await Promise.all([
        Promise.all(yearPromises),
        Promise.all(weekPromises)
      ]);
      
      const statsMap = {};
      storesList.forEach((store, index) => {
        const yearStats = yearStatsArray[index];
        const weekStats = weekStatsArray[index];
        
        statsMap[store.id] = {
          managers_count: yearStats.managers_count || 0,
          sellers_count: yearStats.sellers_count || 0,
          // Données annuelles pour "CA Année"
          month_ca: yearStats.period?.ca || 0,
          month_ventes: yearStats.period?.ventes || 0,
          // Données hebdomadaires pour "Dernière semaine complète"
          period_ca: weekStats.period?.ca || 0,
          period_ventes: weekStats.period?.ventes || 0,
          prev_period_ca: weekStats.previous_period?.ca || 0,
          week_ca: weekStats.period?.ca || 0,
          today_ca: yearStats.today?.total_ca || 0,
          today_ventes: yearStats.today?.total_ventes || 0
        };
      });
      setStoresStats(statsMap);
    } catch (err) {
      console.error('Error fetching store cards data:', err);
    }
  };

  // Fonction pour récupérer les stats du classement (période sélectionnée)
  const fetchRankingData = async (storesList) => {
    try {
      const token = localStorage.getItem('token');
      
      // Pour le classement, utiliser la période sélectionnée
      const rankingStatsPromises = storesList.map(store =>
        fetch(`${backendUrl}/api/gerant/stores/${store.id}/stats?period_type=${periodType}&period_offset=${periodOffset}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }).then(res => res.json())
      );
      
      const rankingStatsArray = await Promise.all(rankingStatsPromises);
      const statsMap = {};
      rankingStatsArray.forEach((stats, index) => {
        // Map API response to expected format for ranking
        statsMap[storesList[index].id] = {
          period_ca: stats.period?.ca || 0,
          period_ventes: stats.period?.ventes || 0,
          prev_period_ca: stats.previous_period?.ca || 0,
          ca_evolution: stats.period?.ca_evolution || 0
        };
      });
      setRankingStats(statsMap);
    } catch (err) {
      console.error('Error fetching ranking data:', err);
    }
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

        // Pour les cartes, toujours utiliser semaine -1
        if (data.stores && data.stores.length > 0) {
          await fetchStoreCardsData(data.stores);
          // Pour le classement, utiliser la période sélectionnée
          await fetchRankingData(data.stores);
        }
      }

      // Récupérer les invitations en attente
      const invitationsResponse = await fetch(`${backendUrl}/api/gerant/invitations`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (invitationsResponse.ok) {
        const invitations = await invitationsResponse.json();
        const pendingManagers = invitations.filter(inv => inv.status === 'pending' && inv.role === 'manager').length;
        const pendingSellers = invitations.filter(inv => inv.status === 'pending' && inv.role === 'seller').length;
        setPendingInvitations({ managers: pendingManagers, sellers: pendingSellers });
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

  // Recharger uniquement les stats du classement quand la période change
  useEffect(() => {
    if (user && stores.length > 0) {
      fetchRankingData(stores);
    }
    // eslint-disable-next-line
  }, [periodType, periodOffset]);

  const fetchSubscriptionInfo = async () => {
    try {
      const token = localStorage.getItem('token');
      // Use gerant-specific endpoint
      const res = await fetch(`${backendUrl}/api/gerant/subscription/status`, {
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
      // Utiliser axios au lieu de fetch pour éviter l'interception de rrweb-recorder
      const token = localStorage.getItem('token');
      await axios.post(
        `${backendUrl}/api/gerant/stores`, 
        formData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      toast.success('Magasin créé avec succès ! 🎉');
      await fetchDashboardData();
    } catch (error) {
      console.error('Erreur création magasin:', error);
      const errorMessage = error.response?.data?.detail || 'Erreur lors de la création';
      throw new Error(errorMessage);
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
      // Utiliser axios au lieu de fetch pour éviter l'interception de rrweb-recorder
      const token = localStorage.getItem('token');
      await axios.post(
        `${backendUrl}/api/gerant/sellers/${sellerId}/transfer`, 
        {
          new_store_id: newStoreId,
          new_manager_id: newManagerId
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      toast.success('Vendeur transféré avec succès ! 🎉');
      await fetchDashboardData();
    } catch (error) {
      console.error('Erreur transfert vendeur:', error);
      const errorMessage = error.response?.data?.detail || 'Erreur lors du transfert';
      throw new Error(errorMessage);
    }
  };

  const handleDeleteStore = async (storeId) => {
    try {
      // Utiliser axios au lieu de fetch pour éviter l'interception de rrweb-recorder
      const token = localStorage.getItem('token');
      await axios.delete(`${backendUrl}/api/gerant/stores/${storeId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      toast.success('Magasin supprimé avec succès ! L\'équipe a été suspendue automatiquement.');
      await fetchDashboardData();
    } catch (error) {
      console.error('Erreur suppression magasin:', error);
      const errorMessage = error.response?.data?.detail || 'Erreur lors de la suppression';
      throw new Error(errorMessage);
    }
  };

  const handleInviteStaff = async (inviteData) => {
    try {
      // Utiliser axios au lieu de fetch pour éviter l'interception de rrweb-recorder
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${backendUrl}/api/gerant/invitations`, 
        inviteData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const roleText = inviteData.role === 'manager' ? 'Manager' : 'Vendeur';
      toast.success(`Invitation envoyée avec succès ! 📨 Le ${roleText} recevra un email pour rejoindre votre équipe.`);
      
      await fetchDashboardData();
    } catch (error) {
      console.error('Erreur invitation:', error);
      const errorMessage = error.response?.data?.detail || 'Erreur lors de l\'invitation';
      throw new Error(errorMessage);
    }
  };

  // Calculer les performances pour la période sélectionnée (utilise rankingStats)
  const getStorePerformanceData = () => {
    if (!stores || stores.length === 0) return [];

    const { start: periodStart, end: periodEnd } = getPeriodDates(periodType, periodOffset);

    return stores.map(store => {
      const stats = rankingStats[store.id] || {};
      
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
  const rankedStores = getStorePerformanceData().sort((a, b) => b.periodCA - a.periodCA);
  
  // Calculer les badges de performance
  const getPerformanceBadge = (store) => {
    const storeData = rankedStores.find(s => s.id === store.id);
    if (!storeData) return null;

    // Exclure les magasins sans activité (CA < 100€) pour un calcul plus juste
    const activeStores = rankedStores.filter(s => s.periodCA >= 100);
    // Si pas assez de magasins actifs, utiliser tous les magasins
    const storesForAvg = activeStores.length >= 2 ? activeStores : rankedStores;
    
    // Protection contre division par zéro
    if (storesForAvg.length === 0) {
      return { 
        type: 'weak', 
        bgClass: 'bg-gray-500', 
        icon: '⚪', 
        label: 'Aucune donnée' 
      };
    }
    
    const avgCA = storesForAvg.reduce((sum, s) => sum + s.periodCA, 0) / storesForAvg.length;
    
    const relativePerformance = avgCA > 0 ? ((storeData.periodCA - avgCA) / avgCA) * 100 : 0;
    
    // Cas spécial : magasin sans activité significative
    if (storeData.periodCA < 100) {
      return { 
        type: 'weak', 
        bgClass: 'bg-gray-500', 
        icon: '⚪', 
        label: 'Inactif' 
      };
    }
    
    // Badge basé sur performance relative ET évolution
    if (relativePerformance > 20 || storeData.periodEvolution > 15) {
      return { 
        type: 'excellent', 
        bgClass: 'bg-green-500', 
        icon: '🔥', 
        label: 'Excellent' 
      };
    } else if (relativePerformance > 0 || storeData.periodEvolution > 5) {
      return { 
        type: 'good', 
        bgClass: 'bg-blue-500', 
        icon: '👍', 
        label: 'Bon' 
      };
    } else if (relativePerformance > -20 && storeData.periodEvolution > -10) {
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
      {/* CSS pour animation de glissement */}
      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-slideIn {
          animation: slideIn 0.5s ease-out;
        }
        
        .ranking-item {
          transition: all 0.6s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .ranking-item:hover {
          transform: translateX(4px);
        }
      `}</style>
      
      {/* Header */}
      <div className="bg-white shadow-md border-b-4 border-orange-500">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-3 sm:py-4">
          <div className="flex items-start sm:items-center justify-between mb-3 sm:mb-4 gap-2">
            <div className="min-w-0 flex-1 max-w-[250px] sm:max-w-none">
              <h1 className="text-lg sm:text-2xl md:text-3xl font-bold bg-gradient-to-r from-orange-600 to-orange-500 bg-clip-text text-transparent">
                🏢 <span className="hidden sm:inline">Dashboard </span>Gérant
              </h1>
              <p className="text-xs sm:text-sm text-gray-600 truncate">Bonjour, {user?.name}</p>
              {/* Badge Données Sécurisées */}
              <div className="flex items-center gap-1 mt-1">
                <span className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 bg-green-50 text-green-700 text-xs font-medium rounded-full border border-green-200">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <span className="hidden xs:inline">Données sécurisées</span>
                  <span className="xs:hidden">Sécurisé</span>
                </span>
              </div>
            </div>

            <div className="flex gap-1 sm:gap-2 flex-shrink-0">
              <button
                onClick={() => setShowSubscriptionModal(true)}
                className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 bg-gradient-to-r from-[#1E40AF] to-[#1E3A8A] text-white font-medium rounded-lg hover:shadow-lg transition-all text-xs sm:text-sm"
              >
                <Settings className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden md:inline">Mon abonnement</span>
              </button>
              <button
                onClick={() => setShowSupportModal(true)}
                className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-medium rounded-lg hover:shadow-lg transition-all text-xs sm:text-sm"
                title="Contacter le support"
              >
                <Headphones className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden md:inline">Support</span>
              </button>
              <TutorialButton onClick={onboarding.open} />
              <button
                onClick={handleLogoutClick}
                className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2.5 bg-white border-2 border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 hover:shadow-md transition-all text-xs sm:text-base"
              >
                <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">Déconnexion</span>
              </button>
            </div>
          </div>

          {/* Onglets de navigation - Scrollable sur mobile */}
          <div className="overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0">
            <div className="flex gap-1 border-b border-gray-200 min-w-max">
              <button
                onClick={() => setActiveView('dashboard')}
                className={`flex items-center gap-1 sm:gap-2 px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-base font-semibold transition-all whitespace-nowrap ${
                  activeView === 'dashboard'
                    ? 'text-orange-600 border-b-2 border-orange-600 bg-orange-50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5" />
                <span>Vue d'ensemble</span>
              </button>
              <button
                onClick={() => setActiveView('stores')}
                className={`flex items-center gap-1 sm:gap-2 px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-base font-semibold transition-all whitespace-nowrap ${
                  activeView === 'stores'
                    ? 'text-orange-600 border-b-2 border-orange-600 bg-orange-50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <Store className="w-4 h-4 sm:w-5 sm:h-5" />
                <span>Magasins</span>
              </button>
              <button
                onClick={() => setActiveView('staff')}
                className={`flex items-center gap-1 sm:gap-2 px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-base font-semibold transition-all whitespace-nowrap ${
                  activeView === 'staff'
                    ? 'text-orange-600 border-b-2 border-orange-600 bg-orange-50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <UserCog className="w-4 h-4 sm:w-5 sm:h-5" />
                <span>Personnel</span>
              </button>
              <button
                onClick={() => setActiveView('api')}
                className={`flex items-center gap-1 sm:gap-2 px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-base font-semibold transition-all whitespace-nowrap ${
                  activeView === 'api'
                    ? 'text-orange-600 border-b-2 border-orange-600 bg-orange-50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <Key className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden xs:inline">Intégrations</span> API
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
        {/* === BANNIÈRE MODE LECTURE SEULE === */}
        {isReadOnly && (
          <div className="mb-4 sm:mb-6 bg-amber-50 border-2 border-amber-300 rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg flex-shrink-0">
              <Lock className="w-5 h-5 sm:w-6 sm:h-6 text-amber-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-amber-800">Mode lecture seule</h3>
              <p className="text-amber-700 text-sm">
                Votre période d'essai est terminée. Souscrivez à un abonnement pour débloquer toutes les fonctionnalités.
              </p>
            </div>
            <button
              onClick={() => setShowSubscriptionModal(true)}
              className="px-4 py-2 bg-amber-500 text-white font-semibold rounded-lg hover:bg-amber-600 transition-colors"
            >
              Voir les offres
            </button>
          </div>
        )}

        {activeView === 'api' ? (
          <APIKeysManagement isReadOnly={isReadOnly} />
        ) : activeView === 'stores' ? (
          <StoresManagement 
            onRefresh={fetchDashboardData}
            onOpenCreateStoreModal={() => !isReadOnly && setShowCreateStoreModal(true)}
            isReadOnly={isReadOnly}
          />
        ) : activeView === 'staff' ? (
          <StaffOverview 
            onRefresh={fetchDashboardData}
            onOpenInviteModal={() => !isReadOnly && setShowInviteStaffModal(true)}
            onOpenCreateStoreModal={() => !isReadOnly && setShowCreateStoreModal(true)}
            isReadOnly={isReadOnly}
          />
        ) : (
          <>
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
                <div className="flex-1">
                  <p className="text-sm text-gray-600">Managers actifs</p>
                  <p className="text-2xl font-bold text-gray-800">{globalStats?.total_managers || 0}</p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {pendingInvitations.managers > 0 && (
                      <span className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                        +{pendingInvitations.managers} en attente
                      </span>
                    )}
                    {globalStats?.suspended_managers > 0 && (
                      <span className="text-xs text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">
                        {globalStats.suspended_managers} en veille
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Total Vendeurs */}
            <div className="glass-morphism rounded-xl p-6 border-2 border-indigo-200">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                  <Users className="w-6 h-6 text-indigo-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-600">Vendeurs actifs</p>
                  <p className="text-2xl font-bold text-gray-800">{globalStats?.total_sellers || 0}</p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {pendingInvitations.sellers > 0 && (
                      <span className="text-xs text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                        +{pendingInvitations.sellers} en attente
                      </span>
                    )}
                    {globalStats?.suspended_sellers > 0 && (
                      <span className="text-xs text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">
                        {globalStats.suspended_sellers} en veille
                      </span>
                    )}
                  </div>
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

        {/* Sélecteur de Type de Période + Navigation - Mobile First */}
        <div className="mb-8">
          <div className="glass-morphism rounded-xl p-3 sm:p-4 border-2 border-blue-200">
            <div className="flex flex-col gap-4">
              {/* Type d'analyse - Scrollable sur mobile */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <span className="text-xs sm:text-sm font-semibold text-gray-700 whitespace-nowrap">Type d'analyse :</span>
                <div className="flex gap-1 sm:gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                  <button
                    onClick={() => { setPeriodType('week'); setPeriodOffset(-1); }}
                    className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all whitespace-nowrap flex-shrink-0 ${
                      periodType === 'week'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-white text-gray-700 border-2 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    Semaine
                  </button>
                  <button
                    onClick={() => { setPeriodType('month'); setPeriodOffset(-1); }}
                    className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all whitespace-nowrap flex-shrink-0 ${
                      periodType === 'month'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-white text-gray-700 border-2 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    Mois
                  </button>
                  <button
                    onClick={(e) => { 
                      e.preventDefault(); 
                      e.stopPropagation(); 
                      setTimeout(() => {
                        setPeriodType('year'); 
                        setPeriodOffset(-1);
                      }, 0);
                    }}
                    className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all whitespace-nowrap flex-shrink-0 ${
                      periodType === 'year'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-white text-gray-700 border-2 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    Année
                  </button>
                </div>
              </div>

              {/* Séparateur horizontal sur mobile, vertical sur desktop */}
              <div className="w-full h-px sm:hidden bg-gray-200"></div>

              {/* Navigation de Période - Responsive */}
              <div className="flex items-center justify-between sm:justify-center gap-2 sm:gap-3 flex-wrap">
                <button
                  onClick={() => setPeriodOffset(periodOffset - 1)}
                  className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-all text-xs sm:text-sm"
                >
                  <span>◀</span>
                  <span className="hidden xs:inline sm:inline">
                    {periodType === 'week' ? 'Sem.' : periodType === 'month' ? 'Mois' : 'An'} préc.
                  </span>
                </button>
                
                <div className="text-center flex-1 sm:flex-none sm:min-w-[140px]">
                  <p className="text-xs text-gray-500">📅 Période</p>
                  <p className="text-xs sm:text-sm font-bold text-gray-800 truncate max-w-[150px] sm:max-w-none mx-auto">
                    {formatPeriod(periodType, periodOffset)}
                  </p>
                  {periodType === 'week' && (
                    <p className="text-xs text-gray-400">
                      S{getPeriodNumber('week', getPeriodDates('week', periodOffset).start)}
                    </p>
                  )}
                </div>
                
                <button
                  onClick={() => setPeriodOffset(periodOffset + 1)}
                  disabled={periodOffset >= 0}
                  className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-2 font-semibold rounded-lg transition-all text-xs sm:text-sm ${
                    periodOffset >= 0 
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  <span className="hidden xs:inline sm:inline">
                    {periodType === 'week' ? 'Sem.' : periodType === 'month' ? 'Mois' : 'An'} suiv.
                  </span>
                  <span>▶</span>
                </button>

                {periodOffset !== 0 && (
                  <button
                    onClick={() => setPeriodOffset(0)}
                    className="text-xs text-blue-600 hover:text-blue-700 font-semibold underline whitespace-nowrap w-full sm:w-auto text-center sm:text-left mt-2 sm:mt-0"
                    title={`Revenir à la ${periodType === 'week' ? 'semaine' : periodType === 'month' ? 'mois' : 'année'} actuelle`}
                  >
                    ↻ Actuel
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Classement des Magasins - Version adaptative */}
        {rankedStores.length > 0 && (
          <div className="mb-6">
            <h2 className="text-xl font-bold text-gray-800 mb-3 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-orange-600" />
              🏆 Classement {periodType === 'week' ? 'de la Semaine' : periodType === 'month' ? 'du Mois' : "de l'Année"}
              <span className="text-sm font-normal text-gray-500">({rankedStores.length} magasin{rankedStores.length > 1 ? 's' : ''})</span>
            </h2>
            <div className="glass-morphism rounded-xl p-4 border-2 border-orange-200">
              {/* Mode Grille pour ≤6 magasins */}
              {rankedStores.length <= 6 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {rankedStores.map((storeData, index) => {
                    const getRankIcon = (rank) => {
                      if (rank === 0) return '🥇';
                      if (rank === 1) return '🥈';
                      if (rank === 2) return '🥉';
                      if (rank === 3) return '🏅';
                      if (rank === 4) return '⭐';
                      if (rank === 5) return '✨';
                      return `${rank + 1}.`;
                    };
                    
                    return (
                      <div
                        key={storeData.id}
                        className={`p-3 rounded-lg border-2 transition-all hover:shadow-md ${
                          index === 0 ? 'bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-300' :
                          index === 1 ? 'bg-gradient-to-br from-gray-50 to-slate-100 border-gray-300' :
                          index === 2 ? 'bg-gradient-to-br from-orange-50 to-amber-50 border-orange-300' :
                          'bg-white border-gray-200'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-2xl">{getRankIcon(index)}</span>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm text-gray-800 truncate">{storeData.name}</p>
                            <p className="text-xs text-gray-500 truncate">{storeData.location}</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-lg font-bold text-gray-800">
                              {(storeData.periodCA || 0).toLocaleString('fr-FR')} €
                            </p>
                            <p className="text-xs text-gray-500">{storeData.periodVentes || 0} ventes</p>
                          </div>
                          {storeData.periodEvolution !== 0 && isFinite(storeData.periodEvolution) && (
                            <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold ${
                              storeData.periodEvolution > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {storeData.periodEvolution > 0 ? '↗' : '↘'} {Math.abs(storeData.periodEvolution).toFixed(0)}%
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Mode Tableau compact pour >6 magasins */
                <div className="overflow-hidden rounded-lg border border-gray-200">
                  {/* Header du tableau */}
                  <div className="grid grid-cols-12 gap-2 p-2 bg-gray-100 font-semibold text-xs text-gray-600 border-b border-gray-200">
                    <div className="col-span-1 text-center">#</div>
                    <div className="col-span-5">Magasin</div>
                    <div className="col-span-3 text-right">CA</div>
                    <div className="col-span-3 text-right">Évol.</div>
                  </div>
                  {/* Corps du tableau avec scroll */}
                  <div className="max-h-[240px] overflow-y-auto">
                    {rankedStores.slice(0, 20).map((storeData, index) => {
                      const getRankDisplay = (rank) => {
                        if (rank === 0) return <span className="text-lg">🥇</span>;
                        if (rank === 1) return <span className="text-lg">🥈</span>;
                        if (rank === 2) return <span className="text-lg">🥉</span>;
                        return <span className="text-gray-500 font-medium">{rank + 1}</span>;
                      };
                      
                      return (
                        <div
                          key={storeData.id}
                          className={`grid grid-cols-12 gap-2 p-2 items-center text-sm border-b border-gray-100 hover:bg-orange-50 transition-colors ${
                            index < 3 ? 'bg-orange-50/50' : 'bg-white'
                          }`}
                        >
                          <div className="col-span-1 text-center">{getRankDisplay(index)}</div>
                          <div className="col-span-5">
                            <p className="font-semibold text-gray-800 truncate text-xs sm:text-sm">{storeData.name}</p>
                            <p className="text-xs text-gray-400 truncate hidden sm:block">{storeData.location}</p>
                          </div>
                          <div className="col-span-3 text-right">
                            <p className="font-bold text-gray-800 text-xs sm:text-sm">
                              {(storeData.periodCA || 0).toLocaleString('fr-FR')} €
                            </p>
                            <p className="text-xs text-gray-400">{storeData.periodVentes || 0} ventes</p>
                          </div>
                          <div className="col-span-3 text-right">
                            {storeData.periodEvolution !== 0 && isFinite(storeData.periodEvolution) ? (
                              <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-semibold ${
                                storeData.periodEvolution > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                              }`}>
                                {storeData.periodEvolution > 0 ? '↗' : '↘'} {Math.abs(storeData.periodEvolution).toFixed(0)}%
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {/* Footer si plus de 20 magasins */}
                  {rankedStores.length > 20 && (
                    <div className="p-2 bg-gray-50 text-center text-xs text-gray-500 border-t border-gray-200">
                      +{rankedStores.length - 20} autres magasins
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Mes Magasins */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Building2 className="w-5 h-5 sm:w-6 sm:h-6 text-orange-600" />
              Mes Magasins
            </h2>
            <div className="flex flex-wrap gap-2 sm:gap-3">
              <button
                onClick={() => !isReadOnly && setShowInviteStaffModal(true)}
                disabled={isReadOnly}
                title={isReadOnly ? "Période d'essai terminée" : "Inviter du personnel"}
                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 text-sm sm:text-base font-semibold rounded-xl transition-all ${
                  isReadOnly 
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:shadow-lg'
                }`}
              >
                <Users className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden xs:inline">Inviter du</span> Personnel
                {isReadOnly && <Lock className="w-3 h-3 ml-1" />}
              </button>
              <button
                onClick={() => !isReadOnly && setShowCreateStoreModal(true)}
                disabled={isReadOnly}
                title={isReadOnly ? "Période d'essai terminée" : "Créer un nouveau magasin"}
                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 text-sm sm:text-base font-semibold rounded-xl transition-all ${
                  isReadOnly 
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                    : 'bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:shadow-lg'
                }`}
              >
                <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden xs:inline">Nouveau</span> Magasin
                {isReadOnly && <Lock className="w-3 h-3 ml-1" />}
              </button>
              
              {/* Bouton Import Massif - Visible pour Enterprise ou flag can_bulk_import */}
              {(user?.role === 'enterprise' || user?.can_bulk_import || user?.sync_mode === 'api_sync' || true) && (
                <button
                  onClick={() => !isReadOnly && setShowBulkImportModal(true)}
                  disabled={isReadOnly}
                  title={isReadOnly ? "Période d'essai terminée" : "Importer plusieurs magasins via CSV"}
                  className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 text-sm sm:text-base font-semibold rounded-xl transition-all ${
                    isReadOnly 
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                      : 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:shadow-lg'
                  }`}
                >
                  <Upload className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="hidden sm:inline">Import CSV</span>
                  {isReadOnly && <Lock className="w-3 h-3 ml-1" />}
                </button>
              )}
            </div>
          </div>

          {stores.length === 0 ? (
            <div className="glass-morphism rounded-xl p-12 text-center">
              <Building2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">Aucun magasin pour le moment</p>
              <button
                onClick={() => !isReadOnly && setShowCreateStoreModal(true)}
                disabled={isReadOnly}
                title={isReadOnly ? "Période d'essai terminée" : ""}
                className={`px-6 py-3 font-semibold rounded-xl transition-all ${
                  isReadOnly 
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                    : 'bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:shadow-lg'
                }`}
              >
                Créer votre premier magasin
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {stores.map((store, index) => {
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
                    onClick={() => {
                      setSelectedStore(store);
                      setSelectedStoreColorIndex(index);
                      setShowStoreDetailModal(true);
                    }}
                    colorIndex={index}
                  />
                );
              })}
            </div>
          )}
        </div>
          </>
        )}
      </div>

      {/* Modals */}
      {showCreateStoreModal && (
        <CreateStoreModal
          onClose={() => setShowCreateStoreModal(false)}
          onCreate={handleCreateStore}
        />
      )}

      {/* Modal Import Massif de Magasins */}
      {showBulkImportModal && (
        <BulkStoreImportModal
          isOpen={showBulkImportModal}
          onClose={() => setShowBulkImportModal(false)}
          onSuccess={() => {
            // Recharger toutes les données du dashboard après import réussi
            fetchDashboardData();
            toast.success('Liste des magasins mise à jour');
          }}
        />
      )}

      {showStoreDetailModal && selectedStore && (
        <StoreDetailModal
          store={selectedStore}
          colorIndex={selectedStoreColorIndex}
          isReadOnly={isReadOnly}
          onClose={() => {
            setShowStoreDetailModal(false);
            setSelectedStore(null);
          }}
          onTransferManager={(manager) => {
            if (!isReadOnly) {
              setSelectedManager(manager);
              setShowManagerTransferModal(true);
            }
          }}
          onTransferSeller={(seller) => {
            if (!isReadOnly) {
              setSelectedSeller(seller);
              setShowSellerTransferModal(true);
            }
          }}
          onDeleteStore={(store) => {
            if (!isReadOnly) {
              setSelectedStore(store);
              setShowDeleteConfirmation(true);
            }
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
        userRole={user?.role}
      />

      {/* Support Modal */}
      <SupportModal 
        isOpen={showSupportModal}
        onClose={() => setShowSupportModal(false)}
      />

      {/* Onboarding Modal */}
      <OnboardingModal
        isOpen={onboarding.isOpen}
        onClose={onboarding.close}
        currentStep={onboarding.currentStep}
        totalSteps={gerantSteps.length}
        steps={gerantSteps}
        onNext={onboarding.next}
        onPrev={onboarding.prev}
        onGoTo={onboarding.goTo}
        onSkip={onboarding.skip}
        completedSteps={onboarding.completedSteps}
      />
    </div>
  );
};

export default GerantDashboard;
