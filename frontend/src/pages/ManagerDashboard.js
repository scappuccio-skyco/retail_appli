import React, { useState, useEffect, useMemo } from 'react';
import { unstable_batchedUpdates } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { LogOut, Users, TrendingUp, Award, UserPlus, Clock, CheckCircle, XCircle, Sparkles, Settings, RefreshCw, Edit2, Trash2, Target, BarChart3, Bell, ChevronLeft, ChevronRight } from 'lucide-react';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, BarChart, Bar } from 'recharts';
import InviteModal from '../components/InviteModal';
import KPIConfigModal from '../components/KPIConfigModal';
import ManagerDiagnosticForm from '../components/ManagerDiagnosticForm';
import TeamBilanIA from '../components/TeamBilanIA';
import ManagerProfileModal from '../components/ManagerProfileModal';
import TeamBilanModal from '../components/TeamBilanModal';
import SellerDetailView from '../components/SellerDetailView';
import TeamModal from '../components/TeamModal';
import ManagerSettingsModal from '../components/ManagerSettingsModal';
import StoreKPIModal from '../components/StoreKPIModal';
import RelationshipManagementModal from '../components/RelationshipManagementModal';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Component for progress indicator
const ProgressIndicator = ({ label, emoji, target, progress, type = 'currency', colorScheme = 'blue' }) => {
  const progressPercent = (progress / target) * 100;
  const reste = target - progress;
  
  const colors = {
    blue: { bg: 'from-blue-50 to-indigo-50', border: 'border-blue-200', text: 'text-indigo-600', textBold: 'text-indigo-700' },
    purple: { bg: 'from-purple-50 to-pink-50', border: 'border-purple-200', text: 'text-purple-600', textBold: 'text-purple-700' },
    yellow: { bg: 'from-yellow-50 to-orange-50', border: 'border-yellow-200', text: 'text-yellow-600', textBold: 'text-yellow-700' },
    green: { bg: 'from-green-50 to-emerald-50', border: 'border-green-200', text: 'text-[#10B981]', textBold: 'text-green-700' }
  };
  
  const scheme = colors[colorScheme];
  const formatValue = (val) => {
    if (type === 'currency') return `${val.toLocaleString('fr-FR')}€`;
    if (type === 'decimal') return val.toFixed(1);
    return val;
  };
  
  return (
    <div className={`bg-gradient-to-r ${scheme.bg} rounded-lg p-2.5 border ${scheme.border}`}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-semibold text-gray-700">{emoji} {label}</span>
        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
          progressPercent >= 100 ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
        }`}>
          {progressPercent.toFixed(0)}%
        </span>
      </div>
      <div className="flex items-center justify-between mb-0.5">
        <span className={`text-xs ${scheme.text} font-medium`}>🎯 Objectif</span>
        <span className={`text-sm font-bold ${scheme.textBold}`}>
          {formatValue(target)}
        </span>
      </div>
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-xs text-[#10B981] font-medium">✅ Réalisé</span>
        <span className="text-sm font-bold text-green-700">
          {formatValue(progress)}
        </span>
      </div>
      {progressPercent < 100 ? (
        <div className={`flex items-center justify-between pt-1 border-t ${scheme.border}`}>
          <span className="text-xs text-gray-600">📉 Reste</span>
          <span className="text-xs font-semibold text-gray-700">
            {formatValue(reste)}
          </span>
        </div>
      ) : (
        <div className="pt-1 border-t border-green-200">
          <span className="text-xs text-green-700 font-semibold">
            🎉 Dépassé de {formatValue(Math.abs(reste))}
          </span>
        </div>
      )}
    </div>
  );
};

export default function ManagerDashboard({ user, onLogout }) {
  const navigate = useNavigate();
  const [sellers, setSellers] = useState([]);
  const [selectedSeller, setSelectedSeller] = useState(null);
  const [sellerStats, setSellerStats] = useState(null);
  const [sellerDiagnostic, setSellerDiagnostic] = useState(null);
  const [sellerKPIs, setSellerKPIs] = useState([]);
  const [activeTab, setActiveTab] = useState('competences');
  const [invitations, setInvitations] = useState([]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showKPIConfigModal, setShowKPIConfigModal] = useState(false);
  const [showManagerDiagnostic, setShowManagerDiagnostic] = useState(false);
  const [managerDiagnostic, setManagerDiagnostic] = useState(null);
  const [showManagerProfileModal, setShowManagerProfileModal] = useState(false);
  const [teamBilan, setTeamBilan] = useState(null);
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);
  const [showTeamBilanModal, setShowTeamBilanModal] = useState(false);
  const [showDetailView, setShowDetailView] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [processingStripeReturn, setProcessingStripeReturn] = useState(false);
  const [generatingTeamBilan, setGeneratingTeamBilan] = useState(false);
  const [kpiConfig, setKpiConfig] = useState(null);
  const [activeChallenges, setActiveChallenges] = useState([]);
  const [activeObjectives, setActiveObjectives] = useState([]);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsModalType, setSettingsModalType] = useState('objectives'); // 'objectives' or 'challenges'
  const [showStoreKPIModal, setShowStoreKPIModal] = useState(false);
  const [showRelationshipModal, setShowRelationshipModal] = useState(false);
  const [storeKPIStats, setStoreKPIStats] = useState(null);
  const [autoShowRelationshipResult, setAutoShowRelationshipResult] = useState(false);
  const [generatingAIAdvice, setGeneratingAIAdvice] = useState(false);
  const [storeName, setStoreName] = useState('');
  const [visibleDashboardCharts, setVisibleDashboardCharts] = useState({
    ca: true,
    ventesVsClients: true,
    ventes: true,
    clients: true,
    articles: true,
    panierMoyen: true,
    tauxTransfo: true,
    indiceVente: true
  });
  const [currentObjectiveIndex, setCurrentObjectiveIndex] = useState(0);
  const [currentChallengeIndex, setCurrentChallengeIndex] = useState(0);
  
  // Dashboard Filters & Preferences
  const [dashboardFilters, setDashboardFilters] = useState(() => {
    const saved = localStorage.getItem('manager_dashboard_filters');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Migration: Add showRelationship if not present
      if (parsed.showRelationship === undefined) {
        return { ...parsed, showRelationship: true };
      }
      return parsed;
    }
    return {
      showKPI: true,
      showTeam: true,
      showObjectives: true,
      showChallenges: true,
      showRelationship: true
    };
  });
  const [showFilters, setShowFilters] = useState(false);
  const [sectionOrder, setSectionOrder] = useState(() => {
    const saved = localStorage.getItem('manager_section_order');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Migration: Add 'relationship' if not present
      if (!parsed.includes('relationship')) {
        return [...parsed, 'relationship'];
      }
      return parsed;
    }
    return ['kpi', 'team', 'objectives', 'challenges', 'relationship'];
  });

  // Determine which charts should be available based on manager's KPI configuration
  const availableDashboardCharts = useMemo(() => {
    if (!kpiConfig) {
      return {
        ca: false,
        ventes: false,
        clients: false,
        articles: false,
        ventesVsClients: false,
        panierMoyen: false,
        tauxTransfo: false,
        indiceVente: false
      };
    }
    
    return {
      ca: kpiConfig.track_ca === true,
      ventes: kpiConfig.track_ventes === true,
      articles: kpiConfig.track_articles === true,
      panierMoyen: kpiConfig.track_ca === true && kpiConfig.track_ventes === true,
      tauxTransfo: kpiConfig.track_ventes === true && kpiConfig.track_prospects === true,
      indiceVente: kpiConfig.track_articles === true && kpiConfig.track_ventes === true
    };
  }, [kpiConfig]);

  useEffect(() => {
    // Check for Stripe return FIRST before loading anything else
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session_id');
    
    if (sessionId) {
      // Handle Stripe return - don't load dashboard data yet
      handleStripeCheckoutReturn(sessionId);
    } else {
      // Normal dashboard load
      fetchData();
      fetchManagerDiagnostic();
      fetchTeamBilan();
      fetchKpiConfig();
      fetchActiveChallenges();
      fetchActiveObjectives();
      fetchStoreKPIStats();
      fetchSubscriptionInfo();
    }
  }, []);

  const handleStripeCheckoutReturn = async (sessionId) => {
    // Batch all initial state updates to prevent React reconciliation conflicts
    unstable_batchedUpdates(() => {
      setProcessingStripeReturn(true);
      setLoading(true);
    });
    
    try {
      // Clean URL immediately to prevent reprocessing
      window.history.replaceState({}, document.title, '/dashboard');
      
      // Show loading toast
      const loadingToast = toast.loading('🔄 Vérification du paiement en cours...');
      
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/checkout/status/${sessionId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.dismiss(loadingToast);
      
      if (response.data.status === 'paid') {
        toast.success('🎉 Paiement réussi ! Votre abonnement est maintenant actif.', {
          duration: 5000
        });
        
        // Batch state update before reload
        unstable_batchedUpdates(() => {
          setLoading(false);
          setProcessingStripeReturn(false);
        });
        
        // Reload to show updated subscription data
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else if (response.data.status === 'pending') {
        toast.info('⏳ Paiement en cours de traitement...', {
          duration: 5000
        });
        
        // Batch state updates
        unstable_batchedUpdates(() => {
          setProcessingStripeReturn(false);
        });
        
        // Load dashboard normally
        fetchData();
        fetchManagerDiagnostic();
        fetchTeamBilan();
        fetchKpiConfig();
        fetchActiveChallenges();
        fetchActiveObjectives();
        fetchStoreKPIStats();
        fetchSubscriptionInfo();
      } else {
        toast.error('❌ Le paiement n\'a pas pu être confirmé. Contactez le support si le problème persiste.', {
          duration: 6000
        });
        
        // Batch state update
        unstable_batchedUpdates(() => {
          setProcessingStripeReturn(false);
        });
        
        // Load dashboard normally
        fetchData();
        fetchManagerDiagnostic();
        fetchTeamBilan();
        fetchKpiConfig();
        fetchActiveChallenges();
        fetchActiveObjectives();
        fetchStoreKPIStats();
        fetchSubscriptionInfo();
      }
    } catch (error) {
      console.error('Error checking payment status:', error);
      toast.error('Erreur lors de la vérification du paiement. Veuillez rafraîchir la page.', {
        duration: 5000
      });
      
      // Batch state update on error
      unstable_batchedUpdates(() => {
        setProcessingStripeReturn(false);
      });
      
      // Load dashboard normally even on error
      fetchData();
      fetchManagerDiagnostic();
      fetchTeamBilan();
      fetchKpiConfig();
      fetchActiveChallenges();
      fetchActiveObjectives();
      fetchStoreKPIStats();
    }
  };

  const fetchActiveObjectives = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/manager/objectives/active`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setActiveObjectives(res.data);
    } catch (err) {
      console.error('Error fetching active objectives:', err);
    }
  };

  const fetchActiveChallenges = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/manager/challenges/active`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setActiveChallenges(res.data);
    } catch (err) {
      console.error('Error fetching active challenges:', err);
    }
  };

  const fetchSubscriptionInfo = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/subscription/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSubscriptionInfo(res.data);
    } catch (err) {
      console.error('Error fetching subscription:', err);
    }
  };

  const getWeekDates = (offset) => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    
    const currentMonday = new Date(today);
    currentMonday.setDate(today.getDate() + mondayOffset + (offset * 7));
    
    const sunday = new Date(currentMonday);
    sunday.setDate(currentMonday.getDate() + 6);
    
    const formatDate = (date) => {
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = String(date.getFullYear()).slice(-2);
      return `${day}/${month}/${year}`;
    };
    
    return {
      start: currentMonday,
      end: sunday,
      startFormatted: formatDate(currentMonday),
      endFormatted: formatDate(sunday),
      periode: `Semaine du ${formatDate(currentMonday)} au ${formatDate(sunday)}`,
      startISO: currentMonday.toISOString().split('T')[0],
      endISO: sunday.toISOString().split('T')[0]
    };
  };

  const handleWeekNavigation = (direction) => {
    const newOffset = direction === 'prev' ? currentWeekOffset - 1 : currentWeekOffset + 1;
    setCurrentWeekOffset(newOffset);
    const weekDates = getWeekDates(newOffset);
    fetchBilanForWeek(weekDates.startISO, weekDates.endISO, weekDates.periode);
  };

  const fetchBilanForWeek = async (startDate, endDate, periode) => {
    try {
      const res = await axios.get(`${API}/manager/team-bilans/all`);
      if (res.data.status === 'success' && res.data.bilans) {
        const bilan = res.data.bilans.find(b => b.periode === periode);
        if (bilan) {
          setTeamBilan(bilan);
        } else {
          setTeamBilan({
            periode,
            synthese: '',
            kpi_resume: {},
            points_forts: [],
            points_attention: [],
            recommandations: []
          });
        }
      }
    } catch (err) {
      console.error('Error fetching bilan for week:', err);
    }
  };

  const fetchKpiConfig = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/manager/kpi-config`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setKpiConfig(res.data);
    } catch (err) {
      console.error('Error fetching KPI config:', err);
    }
  };

  const fetchStoreKPIStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/manager/store-kpi/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStoreKPIStats(res.data);
    } catch (err) {
      console.error('Error fetching store KPI stats:', err);
    }
  };

  useEffect(() => {
    localStorage.setItem('manager_dashboard_filters', JSON.stringify(dashboardFilters));
  }, [dashboardFilters]);

  useEffect(() => {
    localStorage.setItem('manager_section_order', JSON.stringify(sectionOrder));
  }, [sectionOrder]);

  const toggleFilter = (filterName) => {
    setDashboardFilters(prev => ({
      ...prev,
      [filterName]: !prev[filterName]
    }));
  };

  const moveSectionUp = (sectionId) => {
    const index = sectionOrder.indexOf(sectionId);
    if (index > 0) {
      const newOrder = [...sectionOrder];
      [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
      setSectionOrder(newOrder);
    }
  };

  const moveSectionDown = (sectionId) => {
    const index = sectionOrder.indexOf(sectionId);
    if (index < sectionOrder.length - 1) {
      const newOrder = [...sectionOrder];
      [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
      setSectionOrder(newOrder);
    }
  };

  const getSectionOrder = (sectionId) => {
    return sectionOrder.indexOf(sectionId);
  };

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const [sellersRes, invitesRes] = await Promise.all([
        axios.get(`${API}/manager/sellers`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/manager/invitations`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      setSellers(sellersRes.data);
      setInvitations(invitesRes.data);
      
      // Récupérer le nom du magasin si on a un store_id
      if (user?.store_id) {
        try {
          const storeRes = await axios.get(`${API}/stores/${user.store_id}/info`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (storeRes.data?.name) {
            setStoreName(storeRes.data.name);
          }
        } catch (err) {
          console.error('Could not fetch store name:', err);
        }
      }
    } catch (err) {
      toast.error('Erreur de chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const fetchManagerDiagnostic = async () => {
    try {
      const res = await axios.get(`${API}/manager-diagnostic/me`);
      if (res.data.status === 'completed') {
        setManagerDiagnostic(res.data.diagnostic);
      }
    } catch (err) {
      console.error('Error fetching manager diagnostic:', err);
    }
  };

  const fetchTeamBilan = async () => {
    try {
      const weekDates = getWeekDates(0);
      await fetchBilanForWeek(weekDates.startISO, weekDates.endISO, weekDates.periode);
    } catch (err) {
      console.error('Error fetching team bilan:', err);
    }
  };

  const regenerateTeamBilan = async () => {
    setGeneratingTeamBilan(true);
    try {
      const weekDates = getWeekDates(currentWeekOffset);
      const res = await axios.post(`${API}/manager/team-bilan?start_date=${weekDates.startISO}&end_date=${weekDates.endISO}`);
      if (res.data) {
        setTeamBilan(res.data);
        toast.success('Bilan régénéré avec succès !');
      }
    } catch (err) {
      console.error('Error regenerating team bilan:', err);
      toast.error('Erreur lors de la régénération du bilan');
    } finally {
      setGeneratingTeamBilan(false);
    }
  };

  const fetchSellerStats = async (sellerId) => {
    try {
      const [statsRes, diagRes, kpiRes] = await Promise.all([
        axios.get(`${API}/manager/seller/${sellerId}/stats`),
        axios.get(`${API}/diagnostic/seller/${sellerId}`),
        axios.get(`${API}/manager/kpi-entries/${sellerId}?days=7`)
      ]);
      setSellerStats(statsRes.data);
      setSellerDiagnostic(diagRes.data);
      setSellerKPIs(kpiRes.data);
    } catch (err) {
      toast.error('Erreur de chargement des statistiques');
    }
  };

  const handleSellerClick = async (seller) => {
    setSelectedSeller(seller);
    setShowDetailView(false);
    await fetchSellerStats(seller.id);
  };
  
  const handleViewFullDetails = () => {
    setShowDetailView(true);
  };

  const handleInviteSuccess = () => {
    fetchData();
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-[#F97316]" />;
      case 'accepted':
        return <CheckCircle className="w-4 h-4 text-[#10B981]" />;
      case 'expired':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'pending':
        return 'En attente';
      case 'accepted':
        return 'Acceptée';
      case 'expired':
        return 'Expirée';
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <div data-testid="manager-loading" className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-white">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-b-4 border-[#1E40AF] mb-4"></div>
          <div className="text-xl font-medium text-gray-700">
            {processingStripeReturn ? '🔄 Vérification du paiement...' : 'Chargement...'}
          </div>
          {processingStripeReturn && (
            <div className="text-sm text-gray-500 mt-2">
              Merci de patienter, nous finalisons votre abonnement.
            </div>
          )}
        </div>
      </div>
    );
  }

  // Helper function to render sections based on order
  const renderSection = (sectionId) => {
    const sections = {
      kpi: dashboardFilters.showKPI && (
        <div
          key="kpi"
          onClick={() => setShowStoreKPIModal(true)}
          className="glass-morphism rounded-2xl overflow-hidden cursor-pointer group hover:shadow-2xl transition-all duration-300 border-2 border-transparent hover:border-orange-400"
          style={{ order: getSectionOrder('kpi') }}
        >
          <div className="relative h-56 overflow-hidden">
            <img 
              src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=400&fit=crop" 
              alt="Mon Magasin"
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-orange-500/80 via-orange-600/80 to-orange-500/80 group-hover:from-orange-500/70 group-hover:via-orange-600/70 group-hover:to-orange-500/70 transition-all"></div>
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6">
              <div className="w-20 h-20 bg-white bg-opacity-20 rounded-full mb-4 flex items-center justify-center backdrop-blur-sm">
                <BarChart3 className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white text-center mb-2">🏪 Mon Magasin</h3>
              <p className="text-sm text-white opacity-90 text-center">Performances globales du point de vente</p>
              <p className="text-xs text-white opacity-80 mt-3">Cliquer pour voir les détails →</p>
            </div>
          </div>
        </div>
      ),
      team: dashboardFilters.showTeam && (
        <div
          key="team"
          onClick={() => setShowTeamModal(true)}
          className="glass-morphism rounded-2xl overflow-hidden cursor-pointer group hover:shadow-2xl transition-all duration-300 border-2 border-transparent hover:border-cyan-400"
          style={{ order: getSectionOrder('team') }}
        >
          <div className="relative h-56 overflow-hidden">
            <img 
              src="https://images.unsplash.com/photo-1600880292089-90a7e086ee0c?w=800&h=400&fit=crop" 
              alt="Mon Équipe"
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-blue-900/80 via-cyan-900/80 to-blue-900/80 group-hover:from-blue-900/70 group-hover:via-cyan-900/70 group-hover:to-blue-900/70 transition-all"></div>
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6">
              <div className="w-20 h-20 bg-white bg-opacity-20 rounded-full mb-4 flex items-center justify-center backdrop-blur-sm">
                <Users className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white text-center mb-2 flex items-center justify-center gap-2">
                <Users className="w-7 h-7 text-yellow-400" />
                Mon Équipe
              </h3>
              <p className="text-sm text-white opacity-90 text-center">
                {sellers.filter(s => s.status === 'active').length} vendeur{sellers.filter(s => s.status === 'active').length > 1 ? 's' : ''} actif{sellers.filter(s => s.status === 'active').length > 1 ? 's' : ''}
              </p>
              <p className="text-xs text-white opacity-80 mt-3">Vue d'ensemble de l'équipe →</p>
            </div>
          </div>
        </div>
      ),
      
      objectives: dashboardFilters.showObjectives && (
        <div
          key="objectives"
          onClick={() => {
            setSettingsModalType('objectives');
            setShowSettingsModal(true);
          }}
          className="glass-morphism rounded-2xl overflow-hidden cursor-pointer group hover:shadow-2xl transition-all duration-300 border-2 border-transparent hover:border-blue-400"
          style={{ order: getSectionOrder('objectives') }}
        >
          <div className="relative h-56 overflow-hidden">
            <img 
              src="https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800&h=400&fit=crop" 
              alt="Objectifs"
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-blue-900/80 via-blue-800/80 to-blue-900/80 group-hover:from-blue-900/70 group-hover:via-blue-800/70 group-hover:to-blue-900/70 transition-all"></div>
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6">
              <div className="w-20 h-20 bg-white bg-opacity-20 rounded-full mb-4 flex items-center justify-center backdrop-blur-sm">
                <Target className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white text-center mb-2">🎯 Objectifs</h3>
              <p className="text-sm text-white opacity-90 text-center">Définir et suivre des objectifs collectifs et/ou individuels</p>
              <p className="text-xs text-white opacity-80 mt-3">Gérer les objectifs →</p>
            </div>
          </div>
        </div>
      ),
      challenges: dashboardFilters.showChallenges && (
        <div
          key="challenges"
          onClick={() => {
            setSettingsModalType('challenges');
            setShowSettingsModal(true);
          }}
          className="glass-morphism rounded-2xl overflow-hidden cursor-pointer group hover:shadow-2xl transition-all duration-300 border-2 border-transparent hover:border-green-400"
          style={{ order: getSectionOrder('challenges') }}
        >
          <div className="relative h-56 overflow-hidden">
            <img 
              src="https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&h=400&fit=crop" 
              alt="Challenges"
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-green-600/80 via-emerald-600/80 to-green-600/80 group-hover:from-green-600/70 group-hover:via-emerald-600/70 group-hover:to-green-600/70 transition-all"></div>
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6">
              <div className="w-20 h-20 bg-white bg-opacity-20 rounded-full mb-4 flex items-center justify-center backdrop-blur-sm">
                <Award className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white text-center mb-2">🏆 Challenges</h3>
              <p className="text-sm text-white opacity-90 text-center">Lancer des challenges collectifs et/ou individuels</p>
              <p className="text-xs text-white opacity-80 mt-3">Gérer les challenges →</p>
            </div>
          </div>
        </div>
      ),
      // Carte Notifications supprimée
      
      relationship: dashboardFilters.showRelationship !== false && (
        <div
          key="relationship"
          onClick={() => setShowRelationshipModal(true)}
          className="glass-morphism rounded-2xl overflow-hidden cursor-pointer group hover:shadow-2xl transition-all duration-300 border-2 border-transparent hover:border-purple-400"
          style={{ order: getSectionOrder('relationship') }}
        >
          <div className="relative h-56 overflow-hidden">
            <img 
              src="https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=800&h=400&fit=crop" 
              alt="Gestion relationnelle"
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-purple-900/80 via-indigo-900/80 to-purple-900/80 group-hover:from-purple-900/70 group-hover:via-indigo-900/70 group-hover:to-purple-900/70 transition-all"></div>
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6">
              <div className="w-20 h-20 bg-white bg-opacity-20 rounded-full mb-4 flex items-center justify-center backdrop-blur-sm">
                <Users className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white text-center mb-2">🤝 Gestion relationnelle</h3>
              <p className="text-sm text-white opacity-90 text-center">Conseils IA pour situations & conflits</p>
              <p className="text-xs text-white opacity-80 mt-3">Obtenir des recommandations →</p>
            </div>
          </div>
        </div>
      ),
    };
    
    return sections[sectionId];
  };

  return (
    <div data-testid="manager-dashboard" className="min-h-screen p-4 md:p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="glass-morphism rounded-3xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <img src="/logo-retail-performer-blue.png" alt="Retail Performer AI" className="h-14 object-contain" />
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-[#1E40AF] mb-1">
                Retail Performer AI
              </h1>
              <p className="text-gray-600">
                Manager Dashboard - Bienvenue, {user.name}
                {storeName && <span className="ml-2 text-[#1E40AF] font-semibold">• 🏢 {storeName}</span>}
              </p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            {managerDiagnostic && (
              <button
                onClick={() => setShowManagerProfileModal(true)}
                className="px-3 py-2 flex items-center gap-1.5 bg-gradient-to-r from-[#1E40AF] to-[#1E3A8A] text-white font-medium rounded-lg hover:shadow-lg transition-all text-sm"
              >
                <Sparkles className="w-4 h-4" />
                Profil
              </button>
            )}
            {!managerDiagnostic && (
              <button
                onClick={() => setShowManagerDiagnostic(true)}
                className="px-3 py-2 flex items-center gap-1.5 bg-gradient-to-r from-[#1E40AF] to-[#1E3A8A] text-white font-medium rounded-lg hover:shadow-lg transition-all text-sm"
              >
                <Sparkles className="w-4 h-4" />
                Profil
              </button>
            )}
            <button
              onClick={() => setShowInviteModal(true)}
              className="px-3 py-2 flex items-center gap-1.5 bg-gradient-to-r from-[#1E40AF] to-[#1E3A8A] text-white font-medium rounded-lg hover:shadow-lg transition-all text-sm relative"
            >
              <UserPlus className="w-4 h-4" />
              Inviter
              {subscriptionInfo && (() => {
                // Use seats from subscription, fallback to plan_type
                const seatsAvailable = subscriptionInfo.subscription?.seats || 
                                      (subscriptionInfo.plan_type === 'professional' ? 15 : 5);
                const activeSellersCount = sellers.filter(s => s.status === 'active').length;
                const remainingInvites = seatsAvailable - activeSellersCount;
                return remainingInvites > 0 && (
                  <span className="absolute -top-2 -right-2 bg-[#F97316] text-white text-xs font-bold px-2 py-0.5 rounded-full shadow-md">
                    {remainingInvites}
                  </span>
                );
              })()}
            </button>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="px-3 py-2 flex items-center gap-1.5 bg-gradient-to-r from-[#1E40AF] to-[#1E3A8A] text-white font-medium rounded-lg hover:shadow-lg transition-all text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
              Config
            </button>
            <button
              data-testid="logout-button"
              onClick={onLogout}
              className="px-3 py-2 flex items-center gap-1.5 bg-gray-500 text-white font-medium rounded-lg hover:bg-gray-600 hover:shadow-lg transition-all text-sm"
            >
              <LogOut className="w-4 h-4" />
              Déconnexion
            </button>
          </div>
        </div>
      </div>

      {/* Dashboard Filters Panel */}
      {showFilters && (
        <div className="max-w-7xl mx-auto mb-6">
          <div className="glass-morphism rounded-2xl p-6 border-2 border-purple-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                Personnalisation du Dashboard
              </h3>
              <button
                onClick={() => setShowFilters(false)}
                className="text-gray-500 hover:text-gray-700 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Filter Toggles */}
            <div className="mb-8">
              <p className="text-sm font-bold text-purple-900 mb-4 flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-purple-500 rounded-full"></span>
                Afficher/Masquer les cartes
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                <button
                  onClick={() => toggleFilter('showKPI')}
                  className={`px-3 py-2 rounded-lg font-medium transition-all border-2 ${
                    dashboardFilters.showKPI
                      ? 'bg-green-50 border-green-500 text-green-700 shadow-md'
                      : 'bg-gray-50 border-gray-300 text-gray-500'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">📊</span>
                    <span className="text-sm font-semibold whitespace-nowrap">KPI Magasin</span>
                  </div>
                </button>

                <button
                  onClick={() => toggleFilter('showTeam')}
                  className={`px-3 py-2 rounded-lg font-medium transition-all border-2 ${
                    dashboardFilters.showTeam
                      ? 'bg-green-50 border-green-500 text-green-700 shadow-md'
                      : 'bg-gray-50 border-gray-300 text-gray-500'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">👥</span>
                    <span className="text-sm font-semibold whitespace-nowrap">Mon Équipe</span>
                  </div>
                </button>

                <button
                  onClick={() => toggleFilter('showObjectives')}
                  className={`px-3 py-2 rounded-lg font-medium transition-all border-2 ${
                    dashboardFilters.showObjectives
                      ? 'bg-green-50 border-green-500 text-green-700 shadow-md'
                      : 'bg-gray-50 border-gray-300 text-gray-500'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🎯</span>
                    <span className="text-sm font-semibold whitespace-nowrap">Objectifs</span>
                  </div>
                </button>

                <button
                  onClick={() => toggleFilter('showChallenges')}
                  className={`px-3 py-2 rounded-lg font-medium transition-all border-2 ${
                    dashboardFilters.showChallenges
                      ? 'bg-green-50 border-green-500 text-green-700 shadow-md'
                      : 'bg-gray-50 border-gray-300 text-gray-500'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🏆</span>
                    <span className="text-sm font-semibold whitespace-nowrap">Challenges</span>
                  </div>
                </button>

                <button
                  onClick={() => toggleFilter('showRelationship')}
                  className={`px-3 py-2 rounded-lg font-medium transition-all border-2 ${
                    dashboardFilters.showRelationship
                      ? 'bg-green-50 border-green-500 text-green-700 shadow-md'
                      : 'bg-gray-50 border-gray-300 text-gray-500'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🤝</span>
                    <span className="text-sm font-semibold whitespace-nowrap">Gestion relationnelle</span>
                  </div>
                </button>

              </div>
            </div>

            {/* Section Reordering */}
            <div className="pt-6 border-t-2 border-purple-100">
              <p className="text-sm font-bold text-purple-900 mb-4 flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-purple-500 rounded-full"></span>
                Réorganiser l'ordre des cartes
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {sectionOrder.map((sectionId, index) => {
                  const sectionNames = {
                    kpi: '📊 KPI',
                    team: '👥 Équipe',
                    objectives: '🎯 Objectifs',
                    challenges: '🏆 Challenges',
                    relationship: '🤝 Gestion rel.'
                  };
                  
                  // Skip if section doesn't exist in current cards
                  if (!sectionNames[sectionId]) return null;
                  
                  return (
                    <div key={sectionId} className="inline-flex items-center gap-2 bg-white rounded-lg px-3 py-2 border-2 border-gray-200 hover:border-purple-300 transition-all shadow-sm">
                      <span className="text-xs font-bold text-gray-400">#{index + 1}</span>
                      <span className="text-sm font-semibold text-gray-800">{sectionNames[sectionId]}</span>
                      <div className="flex gap-1 ml-1">
                        <button
                          onClick={() => moveSectionUp(sectionId)}
                          disabled={index === 0}
                          className={`p-1 rounded transition-all ${
                            index === 0
                              ? 'bg-gray-50 text-gray-300 cursor-not-allowed'
                              : 'bg-purple-100 text-purple-600 hover:bg-purple-200'
                          }`}
                          title="Monter"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        </button>
                        <button
                          onClick={() => moveSectionDown(sectionId)}
                          disabled={index === sectionOrder.length - 1}
                          className={`p-1 rounded transition-all ${
                            index === sectionOrder.length - 1
                              ? 'bg-gray-50 text-gray-300 cursor-not-allowed'
                              : 'bg-purple-100 text-purple-600 hover:bg-purple-200'
                          }`}
                          title="Descendre"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Dashboard Cards Grid */}
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
          {sectionOrder.map(renderSection)}
        </div>
      </div>

      {/* Modals */}
      {showInviteModal && (
        <InviteModal
          onClose={() => setShowInviteModal(false)}
          onSuccess={handleInviteSuccess}
          sellerCount={sellers.filter(s => s.status === 'active').length}
          subscriptionInfo={subscriptionInfo}
        />
      )}

      {showKPIConfigModal && (
        <KPIConfigModal
          onClose={() => setShowKPIConfigModal(false)}
          onSuccess={() => {
            setShowKPIConfigModal(false);
            fetchData();
          }}
        />
      )}

      {showManagerDiagnostic && (
        <ManagerDiagnosticForm
          onClose={() => setShowManagerDiagnostic(false)}
          onSuccess={async () => {
            setShowManagerDiagnostic(false);
            await fetchManagerDiagnostic();
            // Ouvrir automatiquement le modal du profil après la soumission
            setShowManagerProfileModal(true);
          }}
        />
      )}

      {showManagerProfileModal && (
        <ManagerProfileModal
          diagnostic={managerDiagnostic}
          onClose={() => setShowManagerProfileModal(false)}
          onRedo={() => {
            setShowManagerProfileModal(false);
            setShowManagerDiagnostic(true);
          }}
        />
      )}

      {showTeamBilanModal && (
        <TeamBilanModal
          bilan={teamBilan}
          kpiConfig={kpiConfig}
          onClose={() => setShowTeamBilanModal(false)}
        />
      )}

      {showSettingsModal && (
        <ManagerSettingsModal
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
          modalType={settingsModalType}
          onUpdate={() => {
            fetchActiveChallenges();
            fetchActiveObjectives();
            fetchKpiConfig();
          }}
        />
      )}

      {showStoreKPIModal && (
        <StoreKPIModal
          onClose={() => setShowStoreKPIModal(false)}
          onSuccess={() => {
            fetchStoreKPIStats();
          }}
        />
      )}

      {showRelationshipModal && (
        <RelationshipManagementModal
          onClose={() => {
            setShowRelationshipModal(false);
            setAutoShowRelationshipResult(false);
          }}
          onSuccess={async (formData) => {
            console.log('Form data:', formData);
            // FERMER LE MODAL IMMÉDIATEMENT (pattern correct)
            setShowRelationshipModal(false);
            
            // Afficher barre de chargement
            setGeneratingAIAdvice(true);
            
            try {
              // Faire l'appel API APRÈS fermeture du modal
              const token = localStorage.getItem('token');
              const response = await axios.post(
                `${API}/manager/relationship-advice`,
                formData,
                { headers: { Authorization: `Bearer ${token}` } }
              );
              
              setGeneratingAIAdvice(false);
              toast.success('Recommandation générée avec succès !');
              
              // Rafraîchir les sellers
              await fetchData();
              
              // Rouvrir le modal après 500ms pour afficher le résultat dans l'historique
              setTimeout(() => {
                setAutoShowRelationshipResult(true);
                setShowRelationshipModal(true);
              }, 500);
              
            } catch (error) {
              setGeneratingAIAdvice(false);
              console.error('Error generating advice:', error);
              toast.error('Erreur lors de la génération des recommandations');
            }
          }}
          sellers={sellers}
          autoShowResult={autoShowRelationshipResult}
        />
      )}

      {showTeamModal && (
        <TeamModal
          sellers={sellers}
          onClose={() => setShowTeamModal(false)}
          onViewSellerDetail={(seller) => {
            setSelectedSeller(seller);
            setShowDetailView(true);
            setShowTeamModal(false);
          }}
          onDataUpdate={async () => {
            // Recharger les vendeurs après une modification
            await fetchData();
          }}
        />
      )}

      {/* Seller Detail Modal */}
      {showDetailView && selectedSeller && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl w-full max-w-7xl my-8 shadow-2xl">
            <SellerDetailView 
              seller={selectedSeller} 
              onBack={() => {
                setShowDetailView(false);
                setSelectedSeller(null);
                setShowTeamModal(true); // Reopen TeamModal when going back
              }}
            />
          </div>
        </div>
      )}

      {/* AI Generation Loading Overlay */}
      {generatingAIAdvice && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
            <div className="text-center mb-6">
              <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center animate-pulse">
                <Sparkles className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-800 mb-2">
                Génération en cours...
              </h3>
              <p className="text-gray-600">
                L'IA analyse la situation et prépare des recommandations personnalisées
              </p>
            </div>
            
            {/* Progress Bar */}
            <div className="relative w-full h-3 bg-gray-200 rounded-full overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500 via-indigo-500 to-purple-500 animate-progress-slide"></div>
            </div>
            
            <div className="mt-4 text-center text-sm text-gray-500">
              <p>⏱️ Temps estimé : 30-60 secondes</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
