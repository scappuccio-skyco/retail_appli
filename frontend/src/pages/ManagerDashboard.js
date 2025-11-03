import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { LogOut, Users, TrendingUp, Award, UserPlus, Clock, CheckCircle, XCircle, Sparkles, Settings, RefreshCw, Edit2, Trash2 } from 'lucide-react';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, BarChart, Bar } from 'recharts';
import InviteModal from '../components/InviteModal';
import KPIConfigModal from '../components/KPIConfigModal';
import ManagerDiagnosticForm from '../components/ManagerDiagnosticForm';
import TeamBilanIA from '../components/TeamBilanIA';
import ManagerProfileModal from '../components/ManagerProfileModal';
import TeamBilanModal from '../components/TeamBilanModal';
import SellerDetailView from '../components/SellerDetailView';
import ManagerSettingsModal from '../components/ManagerSettingsModal';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function ManagerDashboard({ user, onLogout }) {
  const navigate = useNavigate();
  const [sellers, setSellers] = useState([]);
  const [selectedSeller, setSelectedSeller] = useState(null);
  const [sellerStats, setSellerStats] = useState(null);
  const [sellerDiagnostic, setSellerDiagnostic] = useState(null);
  const [sellerKPIs, setSellerKPIs] = useState([]);
  const [activeTab, setActiveTab] = useState('competences'); // 'competences', 'kpi', 'evaluations'
  const [invitations, setInvitations] = useState([]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showKPIConfigModal, setShowKPIConfigModal] = useState(false);
  const [showManagerDiagnostic, setShowManagerDiagnostic] = useState(false);
  const [managerDiagnostic, setManagerDiagnostic] = useState(null);
  const [showManagerProfileModal, setShowManagerProfileModal] = useState(false);
  const [teamBilan, setTeamBilan] = useState(null);
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0); // 0 = semaine actuelle, -1 = semaine précédente, etc.
  const [showTeamBilanModal, setShowTeamBilanModal] = useState(false);
  const [showDetailView, setShowDetailView] = useState(false);
  const [loading, setLoading] = useState(true);
  const [generatingTeamBilan, setGeneratingTeamBilan] = useState(false);
  const [kpiConfig, setKpiConfig] = useState(null); // Configuration KPI du manager
  const [activeChallenges, setActiveChallenges] = useState([]); // Challenges collectifs actifs
  const [showSettingsModal, setShowSettingsModal] = useState(false); // Modal for settings
  const [visibleDashboardCharts, setVisibleDashboardCharts] = useState({
    ca: true,
    ventesVsClients: true,
    ventes: true,
    clients: true,
    articles: true,
    panierMoyen: true,
    tauxTransfo: true,
    indiceVente: true
  }); // New state for dashboard chart visibility

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
      clients: kpiConfig.track_clients === true,
      articles: kpiConfig.track_articles === true,
      ventesVsClients: kpiConfig.track_ventes === true && kpiConfig.track_clients === true,
      panierMoyen: kpiConfig.track_ca === true && kpiConfig.track_ventes === true,
      tauxTransfo: kpiConfig.track_ventes === true && kpiConfig.track_clients === true,
      indiceVente: kpiConfig.track_ca === true && kpiConfig.track_ventes === true && kpiConfig.track_articles === true
    };
  }, [kpiConfig]);

  useEffect(() => {
    fetchData();
    fetchManagerDiagnostic();
    fetchTeamBilan();
    fetchKpiConfig();
    fetchActiveChallenges();
  }, []);

  const fetchActiveChallenges = async () => {
    try {
      console.log('🎯 Fetching active challenges...');
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/manager/challenges/active`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('🎯 Active challenges received:', res.data);
      setActiveChallenges(res.data);
    } catch (err) {
      console.error('❌ Error fetching active challenges:', err);
    }
  };

  // Calculer les dates de la semaine basée sur currentWeekOffset
  const getWeekDates = (offset) => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = dimanche, 1 = lundi, ..., 6 = samedi
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Offset pour atteindre le lundi
    
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
    
    // Charger le bilan pour cette semaine
    const weekDates = getWeekDates(newOffset);
    fetchBilanForWeek(weekDates.startISO, weekDates.endISO, weekDates.periode);
  };

  const fetchBilanForWeek = async (startDate, endDate, periode) => {
    try {
      // Chercher si un bilan existe pour cette semaine
      const res = await axios.get(`${API}/manager/team-bilans/all`);
      if (res.data.status === 'success' && res.data.bilans) {
        const bilan = res.data.bilans.find(b => b.periode === periode);
        if (bilan) {
          setTeamBilan(bilan);
        } else {
          // Créer un bilan vide avec la période correcte
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
      const res = await axios.get(`${API}/manager/kpi-config`);
      setKpiConfig(res.data);
    } catch (err) {
      console.error('Error fetching KPI config:', err);
    }
  };

  const fetchData = async () => {
    try {
      const [sellersRes, invitesRes] = await Promise.all([
        axios.get(`${API}/manager/sellers`),
        axios.get(`${API}/manager/invitations`)
      ]);
      setSellers(sellersRes.data);
      setInvitations(invitesRes.data);
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
      const weekDates = getWeekDates(0); // Semaine actuelle
      await fetchBilanForWeek(weekDates.startISO, weekDates.endISO, weekDates.periode);
    } catch (err) {
      console.error('Error fetching team bilan:', err);
    }
  };

  const regenerateTeamBilan = async () => {
    setGeneratingTeamBilan(true);
    try {
      const weekDates = getWeekDates(currentWeekOffset);
      
      // Regenerate the bilan for this week
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
    setShowDetailView(false); // Ne pas ouvrir la vue complète immédiatement
    await fetchSellerStats(seller.id);
  };
  
  const handleViewFullDetails = () => {
    setShowDetailView(true);
  };

  const handleInviteSuccess = () => {
    fetchData();
  };

  const radarData = sellerStats?.avg_radar_scores
    ? [
        { skill: 'Accueil', value: sellerStats.avg_radar_scores.accueil },
        { skill: 'Découverte', value: sellerStats.avg_radar_scores.decouverte },
        { skill: 'Argumentation', value: sellerStats.avg_radar_scores.argumentation },
        { skill: 'Closing', value: sellerStats.avg_radar_scores.closing },
        { skill: 'Fidélisation', value: sellerStats.avg_radar_scores.fidelisation }
      ]
    : [];

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-orange-500" />;
      case 'accepted':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
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
      <div data-testid="manager-loading" className="flex items-center justify-center min-h-screen">
        <div className="text-xl font-medium text-gray-600">Chargement...</div>
      </div>
    );
  }

  // Show seller detail view if a seller is selected
  if (showDetailView && selectedSeller) {
    return (
      <SellerDetailView 
        seller={selectedSeller} 
        onBack={() => {
          setShowDetailView(false);
          setSelectedSeller(null);
        }}
      />
    );
  }

  return (
    <div data-testid="manager-dashboard" className="min-h-screen p-4 md:p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="glass-morphism rounded-3xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <img src="/logo.jpg" alt="Logo" className="w-16 h-16 rounded-xl shadow-md object-cover" />
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-2">
                Tableau de Bord Manager
              </h1>
              <p className="text-gray-600">Bienvenue, {user.name}</p>
            </div>
          </div>
          <div className="flex gap-3 flex-wrap">
            {!managerDiagnostic && (
              <button
                onClick={() => setShowManagerDiagnostic(true)}
                className="btn-secondary flex items-center gap-2 bg-gradient-to-r from-[#ffd871] to-yellow-300 text-gray-800 hover:shadow-lg"
              >
                <Sparkles className="w-5 h-5" />
                Mon profil manager
              </button>
            )}
            <button
              onClick={() => navigate('/manager/settings')}
              className="btn-secondary flex items-center gap-2"
            >
              <Settings className="w-5 h-5" />
              KPI & Challenges
            </button>
            <button
              data-testid="invite-seller-button"
              onClick={() => setShowInviteModal(true)}
              className="btn-primary flex items-center gap-2"
            >
              <UserPlus className="w-5 h-5" />
              Inviter un Vendeur
            </button>
            <button
              data-testid="logout-button"
              onClick={onLogout}
              className="btn-secondary flex items-center gap-2"
            >
              <LogOut className="w-5 h-5" />
              Déconnexion
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        {/* Compact Cards - Profile & Bilan side by side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Manager Profile Compact Card */}
          {managerDiagnostic && (
            <div 
              onClick={() => setShowManagerProfileModal(true)}
              className="glass-morphism rounded-2xl p-6 cursor-pointer hover:shadow-xl transition-all border-2 border-transparent hover:border-[#ffd871]"
            >
              <div className="flex items-center gap-3 mb-4">
                <Sparkles className="w-6 h-6 text-[#ffd871]" />
                <h3 className="text-xl font-bold text-gray-800">🎯 Ton Profil Manager</h3>
              </div>
              
              <div className="bg-gradient-to-r from-[#ffd871] to-yellow-200 rounded-xl p-4">
                <h4 className="text-lg font-bold text-gray-800 mb-2">
                  🧭 {managerDiagnostic.profil_nom}
                </h4>
                <p className="text-gray-700 text-sm line-clamp-2 mb-3">{managerDiagnostic.profil_description}</p>
                
                {/* DISC Profile Display */}
                {managerDiagnostic.disc_dominant && (
                  <div className="bg-white bg-opacity-70 rounded-lg p-3 mb-3">
                    <p className="text-xs font-semibold text-gray-700 mb-1">
                      🎨 Profil DISC : {managerDiagnostic.disc_dominant}
                    </p>
                    <div className="flex gap-1 mt-2">
                      {managerDiagnostic.disc_percentages && Object.entries(managerDiagnostic.disc_percentages).map(([letter, percent]) => (
                        <div key={letter} className="flex-1">
                          <div className="text-xs text-center font-semibold mb-1">
                            {letter === 'D' && '🔴'}
                            {letter === 'I' && '🟡'}
                            {letter === 'S' && '🟢'}
                            {letter === 'C' && '🔵'}
                            {' '}{letter}
                          </div>
                          <div className="bg-gray-200 h-2 rounded-full overflow-hidden">
                            <div 
                              className={`h-full ${
                                letter === 'D' ? 'bg-red-500' :
                                letter === 'I' ? 'bg-yellow-500' :
                                letter === 'S' ? 'bg-green-500' :
                                'bg-blue-500'
                              }`}
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                          <div className="text-xs text-center text-gray-600 mt-1">{percent}%</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="bg-white bg-opacity-70 rounded-lg p-3">
                  <p className="text-xs font-semibold text-gray-700 mb-1">💪 Forces clés</p>
                  <p className="text-xs text-gray-600 line-clamp-2">
                    {managerDiagnostic.force_1} • {managerDiagnostic.force_2}
                  </p>
                </div>
              </div>
              
              <p className="text-sm text-gray-500 text-center mt-4">
                Cliquer pour voir le profil complet →
              </p>
            </div>
          )}

          {/* Team Bilan Compact Card or Generate Button */}
          {teamBilan ? (
            <div className="glass-morphism rounded-2xl p-6 border-2 border-transparent hover:border-[#ffd871] transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Sparkles className="w-6 h-6 text-[#ffd871]" />
                  <h3 className="text-xl font-bold text-gray-800">🤖 Bilan IA d'équipe</h3>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    regenerateTeamBilan();
                  }}
                  disabled={generatingTeamBilan}
                  className="flex items-center gap-2 px-3 py-2 bg-[#ffd871] hover:bg-yellow-400 text-gray-800 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                >
                  <RefreshCw className={`w-4 h-4 ${generatingTeamBilan ? 'animate-spin' : ''}`} />
                  {generatingTeamBilan ? 'Génération...' : 'Relancer'}
                </button>
              </div>

              {/* Week Navigation with Arrows */}
              {teamBilan && (
                <div className="mb-3 flex items-center justify-between bg-white rounded-lg px-3 py-2 border-2 border-gray-200">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleWeekNavigation('prev');
                    }}
                    className="text-gray-600 hover:text-gray-800 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  
                  <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    📅 {currentWeekOffset === 0 ? 'Semaine actuelle' : teamBilan.periode}
                  </span>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleWeekNavigation('next');
                    }}
                    disabled={currentWeekOffset >= 0}
                    className="text-gray-600 hover:text-gray-800 disabled:text-gray-300 disabled:cursor-not-allowed transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              )}
              
              <div 
                onClick={() => setShowTeamBilanModal(true)}
                className="cursor-pointer space-y-3"
              >
                <div className="bg-gradient-to-r from-[#ffd871] to-yellow-200 rounded-xl p-3">
                  <p className="text-xs text-gray-700 mb-1">{teamBilan.periode}</p>
                  <p className="text-sm text-gray-800 font-medium line-clamp-2">{teamBilan.synthese}</p>
                </div>
                
                {/* All KPIs Grid */}
                <div className="grid grid-cols-3 gap-2">
                  {kpiConfig?.track_ca && teamBilan.kpi_resume.ca_total !== undefined && (
                    <div className="bg-blue-50 rounded-lg p-2 text-center">
                      <p className="text-xs text-blue-600">💰 CA</p>
                      <p className="text-sm font-bold text-blue-900">{(teamBilan.kpi_resume.ca_total / 1000).toFixed(0)}k€</p>
                    </div>
                  )}
                  {kpiConfig?.track_ventes && teamBilan.kpi_resume.ventes !== undefined && (
                    <div className="bg-green-50 rounded-lg p-2 text-center">
                      <p className="text-xs text-green-600">🛒 Ventes</p>
                      <p className="text-sm font-bold text-green-900">{teamBilan.kpi_resume.ventes}</p>
                    </div>
                  )}
                  {kpiConfig?.track_clients && teamBilan.kpi_resume.clients !== undefined && (
                    <div className="bg-purple-50 rounded-lg p-2 text-center">
                      <p className="text-xs text-purple-600">👥 Clients</p>
                      <p className="text-sm font-bold text-purple-900">{teamBilan.kpi_resume.clients}</p>
                    </div>
                  )}
                  {kpiConfig?.track_articles && teamBilan.kpi_resume.articles !== undefined && (
                    <div className="bg-orange-50 rounded-lg p-2 text-center">
                      <p className="text-xs text-orange-600">📦 Articles</p>
                      <p className="text-sm font-bold text-orange-900">{teamBilan.kpi_resume.articles}</p>
                    </div>
                  )}
                  {kpiConfig?.track_ca && kpiConfig?.track_ventes && teamBilan.kpi_resume.panier_moyen !== undefined && (
                    <div className="bg-indigo-50 rounded-lg p-2 text-center">
                      <p className="text-xs text-indigo-600">💳 Panier M.</p>
                      <p className="text-sm font-bold text-indigo-900">{teamBilan.kpi_resume.panier_moyen.toFixed(0)}€</p>
                    </div>
                  )}
                  {kpiConfig?.track_ventes && kpiConfig?.track_clients && teamBilan.kpi_resume.taux_transformation !== undefined && (
                    <div className="bg-pink-50 rounded-lg p-2 text-center">
                      <p className="text-xs text-pink-600">📈 Taux Transfo</p>
                      <p className="text-sm font-bold text-pink-900">{teamBilan.kpi_resume.taux_transformation.toFixed(0)}%</p>
                    </div>
                  )}
                  {kpiConfig?.track_articles && kpiConfig?.track_clients && teamBilan.kpi_resume.indice_vente !== undefined && (
                    <div className="bg-teal-50 rounded-lg p-2 text-center">
                      <p className="text-xs text-teal-600">🎯 Indice</p>
                      <p className="text-sm font-bold text-teal-900">{teamBilan.kpi_resume.indice_vente.toFixed(1)}</p>
                    </div>
                  )}
                </div>
                
                <p className="text-sm text-gray-500 text-center mt-4">
                  Cliquer pour voir le bilan complet →
                </p>
              </div>
            </div>
          ) : (
            <div className="glass-morphism rounded-2xl p-6 border-2 border-dashed border-gray-300">
              <div className="flex items-center gap-3 mb-4">
                <Sparkles className="w-6 h-6 text-[#ffd871]" />
                <h3 className="text-xl font-bold text-gray-800">🤖 Bilan IA d'équipe</h3>
              </div>
              
              <div className="text-center py-8">
                <p className="text-gray-600 mb-4">Aucun bilan d'équipe généré pour le moment</p>
                <button
                  onClick={regenerateTeamBilan}
                  disabled={generatingTeamBilan}
                  className="flex items-center gap-2 px-4 py-3 bg-[#ffd871] hover:bg-yellow-400 text-gray-800 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium mx-auto"
                >
                  <Sparkles className={`w-5 h-5 ${generatingTeamBilan ? 'animate-spin' : ''}`} />
                  {generatingTeamBilan ? 'Génération en cours...' : 'Générer le bilan'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Team Bilan IA */}
        {/* <TeamBilanIA /> */}

        {/* Active Challenges Section */}
        {activeChallenges.length > 0 && (
          <div className="glass-morphism rounded-2xl p-6 mb-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Award className="w-6 h-6 text-[#ffd871]" />
                <h3 className="text-2xl font-bold text-gray-800">🎯 Objectifs & Challenges Actifs</h3>
              </div>
              <button
                onClick={() => navigate('/manager/settings')}
                className="btn-secondary text-sm flex items-center gap-2"
              >
                <Settings className="w-4 h-4" />
                Gérer
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeChallenges.map((challenge) => {
                const progressPercentage = (() => {
                  if (challenge.ca_target) return (challenge.progress_ca / challenge.ca_target) * 100;
                  if (challenge.ventes_target) return (challenge.progress_ventes / challenge.ventes_target) * 100;
                  if (challenge.indice_vente_target) return (challenge.progress_indice_vente / challenge.indice_vente_target) * 100;
                  if (challenge.panier_moyen_target) return (challenge.progress_panier_moyen / challenge.panier_moyen_target) * 100;
                  return 0;
                })();

                const daysRemaining = Math.ceil((new Date(challenge.end_date) - new Date()) / (1000 * 60 * 60 * 24));
                const daysUntilStart = Math.ceil((new Date(challenge.start_date) - new Date()) / (1000 * 60 * 60 * 24));
                const hasStarted = daysUntilStart <= 0;

                return (
                  <div 
                    key={challenge.id} 
                    className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-xl p-4 border-2 border-[#ffd871] hover:shadow-lg transition-all"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <h4 className="font-bold text-gray-800 text-lg line-clamp-2">{challenge.title}</h4>
                      <div className="flex flex-col gap-1 items-end">
                        <span className="bg-green-100 text-green-700 text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap">
                          {challenge.type === 'collective' ? '🏆 Collectif' : '👤 Individuel'}
                        </span>
                        {!hasStarted && (
                          <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap">
                            ⏳ Commence dans {daysUntilStart} j
                          </span>
                        )}
                      </div>
                    </div>

                    {challenge.description && (
                      <p className="text-gray-600 text-sm mb-3 line-clamp-2">{challenge.description}</p>
                    )}

                    {/* Progress Bar */}
                    <div className="mb-3">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs text-gray-600">Progression</span>
                        <span className="text-xs font-bold text-gray-800">{Math.min(100, progressPercentage.toFixed(0))}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div 
                          className="bg-gradient-to-r from-[#ffd871] to-yellow-300 h-2.5 rounded-full transition-all"
                          style={{ width: `${Math.min(100, progressPercentage)}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Targets */}
                    <div className="space-y-1 mb-3">
                      {challenge.ca_target && (
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-600">💰 CA:</span>
                          <span className="font-semibold text-gray-800">{challenge.progress_ca.toFixed(0)}€ / {challenge.ca_target}€</span>
                        </div>
                      )}
                      {challenge.ventes_target && (
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-600">🛍️ Ventes:</span>
                          <span className="font-semibold text-gray-800">{challenge.progress_ventes} / {challenge.ventes_target}</span>
                        </div>
                      )}
                      {challenge.panier_moyen_target && (
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-600">🛒 Panier Moyen:</span>
                          <span className="font-semibold text-gray-800">{challenge.progress_panier_moyen.toFixed(2)}€ / {challenge.panier_moyen_target}€</span>
                        </div>
                      )}
                      {challenge.indice_vente_target && (
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-600">💎 Indice Vente:</span>
                          <span className="font-semibold text-gray-800">{challenge.progress_indice_vente.toFixed(1)} / {challenge.indice_vente_target}</span>
                        </div>
                      )}
                    </div>

                    {/* Time remaining */}
                    <div className="flex items-center justify-between gap-2 text-xs text-gray-600 mt-3 pt-3 border-t border-gray-200">
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5" />
                        <span>
                          {daysRemaining > 0 ? `${daysRemaining} jour${daysRemaining > 1 ? 's' : ''} restant${daysRemaining > 1 ? 's' : ''}` : 'Se termine aujourd\'hui'}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => navigate(`/manager/settings?edit=${challenge.id}`)}
                          className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-1.5 rounded transition-all"
                          title="Modifier"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={async () => {
                            if (window.confirm(`Êtes-vous sûr de vouloir supprimer le challenge "${challenge.title}" ?`)) {
                              try {
                                const token = localStorage.getItem('token');
                                await axios.delete(`${API}/manager/challenges/${challenge.id}`, {
                                  headers: { Authorization: `Bearer ${token}` }
                                });
                                toast.success('Challenge supprimé avec succès');
                                fetchActiveChallenges(); // Refresh the list
                              } catch (err) {
                                console.error('Error deleting challenge:', err);
                                toast.error('Erreur lors de la suppression du challenge');
                              }
                            }
                          }}
                          className="text-red-600 hover:text-red-800 hover:bg-red-50 p-1.5 rounded transition-all"
                          title="Supprimer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="glass-morphism rounded-2xl p-6 card-hover">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[#ffd871] bg-opacity-20 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-gray-800" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Vendeurs</p>
                <p className="text-3xl font-bold text-gray-800">{sellers.length}</p>
              </div>
            </div>
          </div>

          <div className="glass-morphism rounded-2xl p-6 card-hover">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Évaluations Totales</p>
                <p className="text-3xl font-bold text-gray-800">
                  {sellers.reduce((sum, s) => sum + s.total_evaluations, 0)}
                </p>
              </div>
            </div>
          </div>

          <div className="glass-morphism rounded-2xl p-6 card-hover">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <Award className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Score Moyen Équipe</p>
                <p className="text-3xl font-bold text-gray-800">
                  {sellers.length > 0
                    ? (sellers.reduce((sum, s) => sum + s.avg_score, 0) / sellers.length).toFixed(2)
                    : 0}
                  /5
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Invitations Section */}
        {invitations.length > 0 && (
          <div className="glass-morphism rounded-2xl p-6 mb-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Invitations</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {invitations.map((invite) => (
                <div
                  key={invite.id}
                  data-testid={`invitation-${invite.id}`}
                  className="bg-white rounded-xl p-4 border border-gray-200"
                >
                  <div className="flex items-start justify-between mb-2">
                    <p className="font-medium text-gray-800">{invite.email}</p>
                    {getStatusIcon(invite.status)}
                  </div>
                  <p className="text-xs text-gray-500">{getStatusText(invite.status)}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(invite.created_at).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Sellers List */}
          <div className="glass-morphism rounded-2xl p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Équipe de Vente</h2>
            {sellers.length > 0 ? (
              <div className="space-y-3">
                {sellers.map((seller) => (
                  <div
                    key={seller.id}
                    data-testid={`seller-${seller.id}`}
                    onClick={() => handleSellerClick(seller)}
                    className={`bg-white rounded-xl p-5 border-2 cursor-pointer transition-all hover:shadow-lg ${
                      selectedSeller?.id === seller.id
                        ? 'border-[#ffd871] shadow-md'
                        : 'border-gray-200'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-semibold text-lg text-gray-800">{seller.name}</h3>
                        <p className="text-sm text-gray-500">{seller.email}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-gray-800">{seller.avg_score}/5</div>
                        <p className="text-xs text-gray-500">{seller.total_evaluations} évals</p>
                      </div>
                    </div>
                    {seller.last_feedback_date && (
                      <p className="text-xs text-gray-500">
                        Dernière éval: {new Date(seller.last_feedback_date).toLocaleDateString('fr-FR')}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                Aucun vendeur dans votre équipe. Cliquez sur "Inviter un Vendeur" pour commencer.
              </div>
            )}
          </div>

          {/* Seller Details */}
          <div className="glass-morphism rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-800">Détails Vendeur</h2>
              {selectedSeller && (
                <button
                  onClick={handleViewFullDetails}
                  className="btn-primary flex items-center gap-2 text-sm"
                >
                  <Award className="w-4 h-4" />
                  Voir tous les détails
                </button>
              )}
            </div>
            {sellerStats ? (
              <div>
                {/* Diagnostic Profile */}
                {sellerDiagnostic && (
                  <div className="mb-6 bg-[#ffd871] bg-opacity-10 rounded-2xl p-5 border-l-4 border-[#ffd871]">
                    <h3 className="text-lg font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-[#ffd871]" />
                      Profil Vendeur
                    </h3>
                    <div className="grid grid-cols-3 gap-4 mb-3">
                      <div>
                        <p className="text-xs text-gray-600">Style</p>
                        <p className="text-sm font-bold text-gray-800">{sellerDiagnostic.style}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600">Niveau</p>
                        <p className="text-sm font-bold text-gray-800">{sellerDiagnostic.level}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600">Motivation</p>
                        <p className="text-sm font-bold text-gray-800">{sellerDiagnostic.motivation}</p>
                      </div>
                    </div>
                    <p className="text-xs text-gray-700 leading-relaxed line-clamp-2">
                      {sellerDiagnostic.ai_profile_summary}
                    </p>
                  </div>
                )}

                {/* Navigation Tabs */}
                <div className="flex gap-2 mb-6 border-b border-gray-200">
                  <button
                    onClick={() => setActiveTab('competences')}
                    className={`px-4 py-2 text-sm font-semibold transition-colors ${
                      activeTab === 'competences'
                        ? 'text-[#ffd871] border-b-2 border-[#ffd871]'
                        : 'text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    📊 Compétences
                  </button>
                  <button
                    onClick={() => setActiveTab('kpi')}
                    className={`px-4 py-2 text-sm font-semibold transition-colors ${
                      activeTab === 'kpi'
                        ? 'text-[#ffd871] border-b-2 border-[#ffd871]'
                        : 'text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    💰 KPI (7j)
                  </button>
                  <button
                    onClick={() => setActiveTab('evaluations')}
                    className={`px-4 py-2 text-sm font-semibold transition-colors ${
                      activeTab === 'evaluations'
                        ? 'text-[#ffd871] border-b-2 border-[#ffd871]'
                        : 'text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    📝 Évaluations
                  </button>
                </div>

                {/* Tab Content */}
                {activeTab === 'competences' && (
                  <div className="animate-fadeIn">
                    <ResponsiveContainer width="100%" height={350}>
                      <RadarChart data={radarData}>
                        <PolarGrid stroke="#cbd5e1" />
                        <PolarAngleAxis dataKey="skill" tick={{ fill: '#475569', fontSize: 12 }} />
                        <Radar name="Score" dataKey="value" stroke="#ffd871" fill="#ffd871" fillOpacity={0.6} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {activeTab === 'kpi' && sellerKPIs.length > 0 && (
                  <div className="space-y-4 max-h-[600px] overflow-y-auto animate-fadeIn">
                    {/* Chart visibility toggles - Only show buttons for available charts */}
                    {Object.values(availableDashboardCharts).some(v => v) && (
                    <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-4 border border-blue-200 sticky top-0 z-10">
                      <p className="text-xs font-semibold text-gray-700 mb-2">📊 Graphiques affichés :</p>
                      <div className="flex flex-wrap gap-1.5">
                        {availableDashboardCharts.ca && (
                        <button
                          onClick={() => setVisibleDashboardCharts(prev => ({ ...prev, ca: !prev.ca }))}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                            visibleDashboardCharts.ca
                              ? 'bg-yellow-100 text-yellow-700 border-2 border-yellow-400'
                              : 'bg-gray-100 text-gray-500 border-2 border-transparent hover:bg-gray-200'
                          }`}
                        >
                          💰 CA
                        </button>
                        )}
                        {availableDashboardCharts.ventesVsClients && (
                        <button
                          onClick={() => setVisibleDashboardCharts(prev => ({ ...prev, ventesVsClients: !prev.ventesVsClients }))}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                            visibleDashboardCharts.ventesVsClients
                              ? 'bg-blue-100 text-blue-700 border-2 border-blue-400'
                              : 'bg-gray-100 text-gray-500 border-2 border-transparent hover:bg-gray-200'
                          }`}
                        >
                          📊 Ventes vs Clients
                        </button>
                        )}
                        {availableDashboardCharts.ventes && (
                        <button
                          onClick={() => setVisibleDashboardCharts(prev => ({ ...prev, ventes: !prev.ventes }))}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                            visibleDashboardCharts.ventes
                              ? 'bg-green-100 text-green-700 border-2 border-green-400'
                              : 'bg-gray-100 text-gray-500 border-2 border-transparent hover:bg-gray-200'
                          }`}
                        >
                          🛍️ Ventes
                        </button>
                        )}
                        {availableDashboardCharts.clients && (
                        <button
                          onClick={() => setVisibleDashboardCharts(prev => ({ ...prev, clients: !prev.clients }))}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                            visibleDashboardCharts.clients
                              ? 'bg-purple-100 text-purple-700 border-2 border-purple-400'
                              : 'bg-gray-100 text-gray-500 border-2 border-transparent hover:bg-gray-200'
                          }`}
                        >
                          👥 Clients
                        </button>
                        )}
                        {availableDashboardCharts.articles && (
                        <button
                          onClick={() => setVisibleDashboardCharts(prev => ({ ...prev, articles: !prev.articles }))}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                            visibleDashboardCharts.articles
                              ? 'bg-amber-100 text-amber-700 border-2 border-amber-400'
                              : 'bg-gray-100 text-gray-500 border-2 border-transparent hover:bg-gray-200'
                          }`}
                        >
                          📦 Articles
                        </button>
                        )}
                        {availableDashboardCharts.panierMoyen && (
                        <button
                          onClick={() => setVisibleDashboardCharts(prev => ({ ...prev, panierMoyen: !prev.panierMoyen }))}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                            visibleDashboardCharts.panierMoyen
                              ? 'bg-teal-100 text-teal-700 border-2 border-teal-400'
                              : 'bg-gray-100 text-gray-500 border-2 border-transparent hover:bg-gray-200'
                          }`}
                        >
                          🛒 Panier Moyen
                        </button>
                        )}
                        {availableDashboardCharts.tauxTransfo && (
                        <button
                          onClick={() => setVisibleDashboardCharts(prev => ({ ...prev, tauxTransfo: !prev.tauxTransfo }))}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                            visibleDashboardCharts.tauxTransfo
                              ? 'bg-pink-100 text-pink-700 border-2 border-pink-400'
                              : 'bg-gray-100 text-gray-500 border-2 border-transparent hover:bg-gray-200'
                          }`}
                        >
                          📈 Taux Transfo
                        </button>
                        )}
                        {availableDashboardCharts.indiceVente && (
                        <button
                          onClick={() => setVisibleDashboardCharts(prev => ({ ...prev, indiceVente: !prev.indiceVente }))}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                            visibleDashboardCharts.indiceVente
                              ? 'bg-orange-100 text-orange-700 border-2 border-orange-400'
                              : 'bg-gray-100 text-gray-500 border-2 border-transparent hover:bg-gray-200'
                          }`}
                        >
                          💎 Indice Vente
                        </button>
                        )}
                      </div>
                    </div>
                    )}

                    {/* Évolution du CA */}
                    {availableDashboardCharts.ca && visibleDashboardCharts.ca && (
                      <div className="bg-white rounded-xl p-4 border border-gray-200">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">💰 Évolution du CA</h4>
                        <ResponsiveContainer width="100%" height={150}>
                          <LineChart data={sellerKPIs.slice().reverse()}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis 
                              dataKey="date" 
                              tick={{ fill: '#6b7280', fontSize: 10 }}
                              tickFormatter={(date) => new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                            />
                            <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} />
                            <Tooltip 
                              formatter={(value) => `${value.toFixed(2)}€`}
                              labelFormatter={(date) => new Date(date).toLocaleDateString('fr-FR')}
                            />
                            <Line 
                              type="monotone" 
                              dataKey="ca_journalier" 
                              stroke="#fbbf24" 
                              strokeWidth={2}
                              dot={{ r: 3 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    {/* Ventes vs Clients */}
                    {availableDashboardCharts.ventesVsClients && visibleDashboardCharts.ventesVsClients && (
                      <div className="bg-white rounded-xl p-4 border border-gray-200">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">📊 Ventes vs Clients</h4>
                        <ResponsiveContainer width="100%" height={150}>
                          <BarChart data={sellerKPIs.slice().reverse()}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis 
                              dataKey="date" 
                              tick={{ fill: '#6b7280', fontSize: 10 }}
                              tickFormatter={(date) => new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                            />
                            <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} />
                            <Tooltip 
                              labelFormatter={(date) => new Date(date).toLocaleDateString('fr-FR')}
                            />
                            <Legend />
                            <Bar dataKey="nb_ventes" fill="#3b82f6" name="Ventes" />
                            <Bar dataKey="nb_clients" fill="#fbbf24" name="Clients" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    {/* Ventes seules */}
                    {availableDashboardCharts.ventes && visibleDashboardCharts.ventes && (
                      <div className="bg-white rounded-xl p-4 border border-gray-200">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">🛍️ Évolution des ventes</h4>
                        <ResponsiveContainer width="100%" height={150}>
                          <LineChart data={sellerKPIs.slice().reverse()}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis 
                              dataKey="date" 
                              tick={{ fill: '#6b7280', fontSize: 10 }}
                              tickFormatter={(date) => new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                            />
                            <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} />
                            <Tooltip 
                              labelFormatter={(date) => new Date(date).toLocaleDateString('fr-FR')}
                            />
                            <Line 
                              type="monotone" 
                              dataKey="nb_ventes" 
                              stroke="#10b981" 
                              strokeWidth={2}
                              dot={{ r: 3 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    {/* Clients seuls */}
                    {availableDashboardCharts.clients && visibleDashboardCharts.clients && (
                      <div className="bg-white rounded-xl p-4 border border-gray-200">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">👥 Évolution des clients</h4>
                        <ResponsiveContainer width="100%" height={150}>
                          <LineChart data={sellerKPIs.slice().reverse()}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis 
                              dataKey="date" 
                              tick={{ fill: '#6b7280', fontSize: 10 }}
                              tickFormatter={(date) => new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                            />
                            <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} />
                            <Tooltip 
                              labelFormatter={(date) => new Date(date).toLocaleDateString('fr-FR')}
                            />
                            <Line 
                              type="monotone" 
                              dataKey="nb_clients" 
                              stroke="#9333ea" 
                              strokeWidth={2}
                              dot={{ r: 3 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    {/* Articles */}
                    {availableDashboardCharts.articles && visibleDashboardCharts.articles && (
                      <div className="bg-white rounded-xl p-4 border border-gray-200">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">📦 Évolution des articles</h4>
                        <ResponsiveContainer width="100%" height={150}>
                          <LineChart data={sellerKPIs.slice().reverse()}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis 
                              dataKey="date" 
                              tick={{ fill: '#6b7280', fontSize: 10 }}
                              tickFormatter={(date) => new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                            />
                            <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} />
                            <Tooltip 
                              labelFormatter={(date) => new Date(date).toLocaleDateString('fr-FR')}
                            />
                            <Line 
                              type="monotone" 
                              dataKey="nb_articles" 
                              stroke="#f59e0b" 
                              strokeWidth={2}
                              dot={{ r: 3 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    {/* Panier Moyen */}
                    {availableDashboardCharts.panierMoyen && visibleDashboardCharts.panierMoyen && (
                      <div className="bg-white rounded-xl p-4 border border-gray-200">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">🛒 Panier Moyen</h4>
                        <ResponsiveContainer width="100%" height={150}>
                          <LineChart data={sellerKPIs.slice().reverse()}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis 
                              dataKey="date" 
                              tick={{ fill: '#6b7280', fontSize: 10 }}
                              tickFormatter={(date) => new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                            />
                            <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} />
                            <Tooltip 
                              formatter={(value) => `${value.toFixed(2)}€`}
                              labelFormatter={(date) => new Date(date).toLocaleDateString('fr-FR')}
                            />
                            <Line 
                              type="monotone" 
                              dataKey="panier_moyen" 
                              stroke="#10b981" 
                              strokeWidth={2}
                              dot={{ r: 3 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    {/* Taux de Transformation */}
                    {availableDashboardCharts.tauxTransfo && visibleDashboardCharts.tauxTransfo && (
                      <div className="bg-white rounded-xl p-4 border border-gray-200">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">📈 Taux de Transformation</h4>
                        <ResponsiveContainer width="100%" height={150}>
                          <LineChart data={sellerKPIs.slice().reverse()}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis 
                              dataKey="date" 
                              tick={{ fill: '#6b7280', fontSize: 10 }}
                              tickFormatter={(date) => new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                            />
                            <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} />
                            <Tooltip 
                              formatter={(value) => `${value.toFixed(2)}%`}
                              labelFormatter={(date) => new Date(date).toLocaleDateString('fr-FR')}
                            />
                            <Line 
                              type="monotone" 
                              dataKey="taux_transformation" 
                              stroke="#8b5cf6" 
                              strokeWidth={2}
                              dot={{ r: 3 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    {/* Indice de Vente */}
                    {availableDashboardCharts.indiceVente && visibleDashboardCharts.indiceVente && (
                      <div className="bg-white rounded-xl p-4 border border-gray-200">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">💎 Indice de Vente</h4>
                        <ResponsiveContainer width="100%" height={150}>
                          <LineChart data={sellerKPIs.slice().reverse()}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis 
                              dataKey="date" 
                              tick={{ fill: '#6b7280', fontSize: 10 }}
                              tickFormatter={(date) => new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                            />
                            <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} />
                            <Tooltip 
                              formatter={(value) => `${value.toFixed(2)}€`}
                              labelFormatter={(date) => new Date(date).toLocaleDateString('fr-FR')}
                            />
                            <Line 
                              type="monotone" 
                              dataKey="indice_vente" 
                              stroke="#f97316" 
                              strokeWidth={2}
                              dot={{ r: 3 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'evaluations' && (
                  <div className="animate-fadeIn">
                    {sellerStats.evaluations.length > 0 ? (
                      <div className="space-y-3 max-h-[600px] overflow-y-auto">
                        {sellerStats.evaluations.slice(0, 5).map((evaluation) => (
                          <div
                            key={evaluation.id}
                            className="bg-white rounded-lg p-4 border border-gray-200"
                          >
                            <p className="text-xs text-gray-500 mb-2">
                              {new Date(evaluation.created_at).toLocaleDateString('fr-FR')}
                            </p>
                            <div className="flex gap-2 text-xs mb-3">
                              <span>A: {evaluation.accueil}</span>
                              <span>D: {evaluation.decouverte}</span>
                              <span>Ar: {evaluation.argumentation}</span>
                              <span>C: {evaluation.closing}</span>
                              <span>F: {evaluation.fidelisation}</span>
                            </div>
                            {evaluation.ai_feedback && (
                              <p className="text-xs text-gray-700 bg-[#ffd871] bg-opacity-10 p-3 rounded-lg">
                                {evaluation.ai_feedback}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">Aucune évaluation disponible</p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                Sélectionnez un vendeur pour voir ses détails
              </div>
            )}
          </div>
        </div>
      </div>

      {showInviteModal && (
        <InviteModal
          onClose={() => setShowInviteModal(false)}
          onSuccess={handleInviteSuccess}
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
          onSuccess={() => {
            setShowManagerDiagnostic(false);
            fetchManagerDiagnostic();
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
    </div>
  );
}
