import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { LogOut, Plus, TrendingUp, Award, MessageSquare, Sparkles, BarChart3, RefreshCw } from 'lucide-react';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import EvaluationModal from '../components/EvaluationModal';
import DebriefModal from '../components/DebriefModal';
import KPIEntryModal from '../components/KPIEntryModal';
import KPIReporting from './KPIReporting';
import SellerProfileModal from '../components/SellerProfileModal';
import BilanIndividuelModal from '../components/BilanIndividuelModal';
import DiagnosticFormModal from '../components/DiagnosticFormModal';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function SellerDashboard({ user, diagnostic, onLogout }) {
  const navigate = useNavigate();
  const [evaluations, setEvaluations] = useState([]);
  const [sales, setSales] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [debriefs, setDebriefs] = useState([]);
  const [competencesHistory, setCompetencesHistory] = useState([]);
  const [kpiEntries, setKpiEntries] = useState([]);
  const [showEvalModal, setShowEvalModal] = useState(false);
  const [showDebriefModal, setShowDebriefModal] = useState(false);
  const [showKPIModal, setShowKPIModal] = useState(false);
  const [showKPIReporting, setShowKPIReporting] = useState(false);
  const [showDiagnosticModal, setShowDiagnosticModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [taskResponse, setTaskResponse] = useState('');
  const [loading, setLoading] = useState(true);
  const [diagnosticExpanded, setDiagnosticExpanded] = useState(false);
  const [expandedDebriefs, setExpandedDebriefs] = useState({});
  const [showAllDebriefs, setShowAllDebriefs] = useState(false);
  // New states for modals
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showBilanModal, setShowBilanModal] = useState(false);
  const [showDiagnosticFormModal, setShowDiagnosticFormModal] = useState(false);
  // States for Bilan Individuel
  const [bilanIndividuel, setBilanIndividuel] = useState(null);
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);
  const [generatingBilan, setGeneratingBilan] = useState(false);
  const [kpiConfig, setKpiConfig] = useState(null);

  useEffect(() => {
    fetchData();
    fetchKpiConfig();
    fetchBilanIndividuel();
  }, []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const [evalsRes, salesRes, tasksRes, debriefsRes, competencesRes] = await Promise.all([
        axios.get(`${API}/evaluations`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/sales`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/seller/tasks`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/debriefs`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/diagnostic/me/live-scores`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      
      setEvaluations(evalsRes.data);
      setSales(salesRes.data);
      setTasks(tasksRes.data);
      setDebriefs(debriefsRes.data);
      
      // Process live scores response
      if (liveScoresRes.data && liveScoresRes.data.live_scores) {
        const { live_scores, diagnostic_age_days } = liveScoresRes.data;
        const scoreEntry = {
          date: new Date().toISOString(),
          score_accueil: live_scores.score_accueil,
          score_decouverte: live_scores.score_decouverte,
          score_argumentation: live_scores.score_argumentation,
          score_closing: live_scores.score_closing,
          score_fidelisation: live_scores.score_fidelisation,
          days_since_diagnostic: diagnostic_age_days
        };
        setCompetencesHistory([scoreEntry]);
      }
      
      // Get KPI entries
      try {
        const kpiRes = await axios.get(`${API}/seller/kpi-entries`, { headers: { Authorization: `Bearer ${token}` } });
        setKpiEntries(kpiRes.data);
        
        // Check if today's KPI has been entered
        const today = new Date().toISOString().split('T')[0];
        const todayKPI = kpiRes.data.find(entry => entry.date === today);
        
        // Add daily KPI task if not entered today
        if (!todayKPI) {
          const kpiTask = {
            id: 'daily-kpi',
            type: 'kpi',
            icon: '📊',
            title: 'Saisir les KPI du jour',
            description: 'Renseigne ton chiffre d\'affaires, nombre de ventes et clients du jour',
            priority: 'normal'
          };
          
          // Add to tasks if not already there
          if (!tasksRes.data.find(t => t.id === 'daily-kpi')) {
            setTasks([kpiTask, ...tasksRes.data]);
          }
        }
      } catch (err) {
        console.log('KPI entries not available:', err);
        setKpiEntries([]);
      }
    } catch (err) {
      console.error('Error loading data:', err);
      toast.error('Erreur de chargement des données');
    } finally {
      setLoading(false);
    }
  };

  // Helper functions for Bilan Individuel
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
      const token = localStorage.getItem('token');
      // Chercher si un bilan existe pour cette semaine
      const res = await axios.get(`${API}/seller/bilan-individuel/all`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.data.status === 'success' && res.data.bilans) {
        const bilan = res.data.bilans.find(b => b.periode === periode);
        if (bilan) {
          setBilanIndividuel(bilan);
        } else {
          // Créer un bilan vide avec la période correcte
          setBilanIndividuel({
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
      const res = await axios.get(`${API}/seller/kpi-config`, { headers: { Authorization: `Bearer ${token}` } });
      setKpiConfig(res.data);
    } catch (err) {
      console.error('Error fetching KPI config:', err);
    }
  };

  const fetchBilanIndividuel = async () => {
    try {
      const weekDates = getWeekDates(0); // Semaine actuelle
      await fetchBilanForWeek(weekDates.startISO, weekDates.endISO, weekDates.periode);
    } catch (err) {
      console.error('Error fetching individual bilan:', err);
    }
  };

  const regenerateBilan = async () => {
    setGeneratingBilan(true);
    try {
      const token = localStorage.getItem('token');
      const weekDates = getWeekDates(currentWeekOffset);
      
      // Regenerate the bilan for this week
      const res = await axios.post(
        `${API}/seller/bilan-individuel?start_date=${weekDates.startISO}&end_date=${weekDates.endISO}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (res.data) {
        setBilanIndividuel(res.data);
        toast.success('Bilan régénéré avec succès !');
      }
    } catch (err) {
      console.error('Error regenerating bilan:', err);
      toast.error('Erreur lors de la régénération du bilan');
    } finally {
      setGeneratingBilan(false);
    }
  };

  const handleEvaluationCreated = () => {
    fetchData();
    setShowEvalModal(false);
  };

  const handleDebriefSuccess = () => {
    fetchData();
    setShowDebriefModal(false);
  };
  
  const toggleDebrief = (debriefId) => {
    setExpandedDebriefs(prev => ({
      ...prev,
      [debriefId]: !prev[debriefId]
    }));
  };

  // Calculate current competence scores (from last entry in history)
  const currentCompetences = competencesHistory.length > 0
    ? competencesHistory[competencesHistory.length - 1]
    : null;

  const avgRadarScores = currentCompetences
    ? [
        { skill: 'Accueil', value: currentCompetences.score_accueil },
        { skill: 'Découverte', value: currentCompetences.score_decouverte },
        { skill: 'Argumentation', value: currentCompetences.score_argumentation },
        { skill: 'Closing', value: currentCompetences.score_closing },
        { skill: 'Fidélisation', value: currentCompetences.score_fidelisation }
      ]
    : [];

  // Calculate evolution data from competences history - Score global sur 25
  const evolutionData = competencesHistory.map((entry, idx) => {
    const date = new Date(entry.date);
    const scoreTotal = 
      (entry.score_accueil || 0) + 
      (entry.score_decouverte || 0) + 
      (entry.score_argumentation || 0) + 
      (entry.score_closing || 0) + 
      (entry.score_fidelisation || 0);
    
    return {
      name: date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
      'Score Global': scoreTotal,
      fullDate: date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
    };
  });

  // Calculate KPIs for last 7 days
  const last7Days = new Date();
  last7Days.setDate(last7Days.getDate() - 7);
  
  const recentKpis = kpiEntries.filter(entry => {
    const entryDate = new Date(entry.date);
    return entryDate >= last7Days;
  });

  const kpiStats = {
    totalEvaluations: (diagnostic ? 1 : 0) + debriefs.length,
    totalVentes: recentKpis.reduce((sum, e) => sum + (e.nb_ventes || 0), 0),
    totalCA: recentKpis.reduce((sum, e) => sum + (e.ca_journalier || 0), 0)
  };

  // If showing KPI reporting, render that component AFTER all hooks
  if (showKPIReporting) {
    return <KPIReporting user={user} onBack={() => setShowKPIReporting(false)} />;
  }

  if (loading) {
    return (
      <div data-testid="seller-loading" className="flex items-center justify-center min-h-screen">
        <div className="text-xl font-medium text-gray-600">Chargement...</div>
      </div>
    );
  }

  return (
    <div data-testid="seller-dashboard" className="min-h-screen p-4 md:p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="glass-morphism rounded-3xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <img src="/logo.jpg" alt="Logo" className="w-16 h-16 rounded-xl shadow-md object-cover" />
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-2">
                Bonjour, {user.name}!
              </h1>
              <p className="text-gray-600">Suivez vos performances et progressez chaque jour</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowKPIReporting(true)}
              className="btn-secondary flex items-center gap-2"
            >
              <BarChart3 className="w-5 h-5" />
              Reporting KPI
            </button>
            <button
              onClick={() => setShowKPIModal(true)}
              className="btn-secondary flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Saisir KPI
            </button>
            <button
              data-testid="debrief-button"
              onClick={() => setShowDebriefModal(true)}
              className="btn-primary flex items-center gap-2"
              style={{ backgroundColor: '#FFD871', color: '#1f2937' }}
            >
              <MessageSquare className="w-5 h-5" />
              Débriefer ma vente
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
        {/* Tasks Section */}
        {tasks.length > 0 && (
          <div className="glass-morphism rounded-2xl p-6 mb-8 border-2 border-[#ffd871]">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Mes tâches à faire</h2>
            <div className="space-y-3">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="bg-white rounded-xl p-4 border border-gray-200 hover:shadow-md transition-all cursor-pointer"
                  onClick={() => {
                    if (task.type === 'diagnostic') {
                      setShowDiagnosticModal(true);
                    } else if (task.type === 'kpi') {
                      setShowKPIModal(true);
                    } else {
                      setSelectedTask(task);
                      setShowTaskModal(true);
                    }
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <span className="text-3xl">{task.icon}</span>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-800">{task.title}</h3>
                        <p className="text-sm text-gray-600 mt-1">{task.description}</p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      task.priority === 'high' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {task.priority === 'high' ? 'Urgent' : 'Important'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Compact Cards: Profile + Bilan Individuel (side by side like manager dashboard) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Profile Card */}
          {diagnostic && (
            <div 
              className="glass-morphism rounded-2xl p-6 cursor-pointer hover:shadow-xl transition-all border-2 border-transparent hover:border-[#ffd871]"
              onClick={() => setShowProfileModal(true)}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-gradient-to-r from-[#ffd871] to-yellow-300 rounded-xl flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-gray-800" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-800">Mon Profil de Vente</h3>
                  <p className="text-sm text-gray-600">Cliquer pour voir le profil complet →</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-purple-50 rounded-lg p-2 text-center">
                  <p className="text-xs text-purple-600 mb-1">Style</p>
                  <p className="text-sm font-bold text-purple-900">{diagnostic.style}</p>
                </div>
                <div className="bg-green-50 rounded-lg p-2 text-center">
                  <p className="text-xs text-green-600 mb-1">Niveau</p>
                  <p className="text-sm font-bold text-green-900">{diagnostic.level}</p>
                </div>
                <div className="bg-orange-50 rounded-lg p-2 text-center">
                  <p className="text-xs text-orange-600 mb-1">Motivation</p>
                  <p className="text-sm font-bold text-orange-900">{diagnostic.motivation}</p>
                </div>
              </div>
              
              {/* DISC Profile Display */}
              {diagnostic.disc_dominant && (
                <div className="bg-white bg-opacity-70 rounded-lg p-3 mt-3">
                  <p className="text-xs font-semibold text-gray-700 mb-1">
                    🎨 Profil DISC : {diagnostic.disc_dominant}
                  </p>
                  <div className="flex gap-1 mt-2">
                    {diagnostic.disc_percentages && Object.entries(diagnostic.disc_percentages).map(([letter, percent]) => (
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
            </div>
          )}

          {/* Bilan Individuel Card */}
          {bilanIndividuel ? (
            <div className="glass-morphism rounded-2xl p-6 border-2 border-transparent hover:border-[#ffd871] transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Sparkles className="w-6 h-6 text-[#ffd871]" />
                  <h3 className="text-xl font-bold text-gray-800">🤖 Mon Bilan Individuel</h3>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    regenerateBilan();
                  }}
                  disabled={generatingBilan}
                  className="flex items-center gap-2 px-3 py-2 bg-[#ffd871] hover:bg-yellow-400 text-gray-800 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                >
                  <RefreshCw className={`w-4 h-4 ${generatingBilan ? 'animate-spin' : ''}`} />
                  {generatingBilan ? 'Génération...' : 'Relancer'}
                </button>
              </div>

              {/* Week Navigation with Arrows */}
              {bilanIndividuel && (
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
                    📅 {currentWeekOffset === 0 ? 'Semaine actuelle' : bilanIndividuel.periode}
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
                onClick={() => setShowBilanModal(true)}
                className="cursor-pointer space-y-3"
              >
                <div className="bg-gradient-to-r from-[#ffd871] to-yellow-200 rounded-xl p-3">
                  <p className="text-xs text-gray-700 mb-1">{bilanIndividuel.periode}</p>
                  <p className="text-sm text-gray-800 font-medium line-clamp-2">{bilanIndividuel.synthese}</p>
                </div>
                
                {/* All KPIs Grid */}
                <div className="grid grid-cols-3 gap-2">
                  {kpiConfig?.track_ca && bilanIndividuel.kpi_resume.ca_total !== undefined && (
                    <div className="bg-blue-50 rounded-lg p-2 text-center">
                      <p className="text-xs text-blue-600">💰 CA</p>
                      <p className="text-sm font-bold text-blue-900">{(bilanIndividuel.kpi_resume.ca_total / 1000).toFixed(1)}k€</p>
                    </div>
                  )}
                  {kpiConfig?.track_ventes && bilanIndividuel.kpi_resume.ventes !== undefined && (
                    <div className="bg-green-50 rounded-lg p-2 text-center">
                      <p className="text-xs text-green-600">🛒 Ventes</p>
                      <p className="text-sm font-bold text-green-900">{bilanIndividuel.kpi_resume.ventes}</p>
                    </div>
                  )}
                  {kpiConfig?.track_clients && bilanIndividuel.kpi_resume.clients !== undefined && (
                    <div className="bg-purple-50 rounded-lg p-2 text-center">
                      <p className="text-xs text-purple-600">👥 Clients</p>
                      <p className="text-sm font-bold text-purple-900">{bilanIndividuel.kpi_resume.clients}</p>
                    </div>
                  )}
                  {kpiConfig?.track_articles && bilanIndividuel.kpi_resume.articles !== undefined && (
                    <div className="bg-orange-50 rounded-lg p-2 text-center">
                      <p className="text-xs text-orange-600">📦 Articles</p>
                      <p className="text-sm font-bold text-orange-900">{bilanIndividuel.kpi_resume.articles}</p>
                    </div>
                  )}
                  {kpiConfig?.track_ca && kpiConfig?.track_ventes && bilanIndividuel.kpi_resume.panier_moyen !== undefined && (
                    <div className="bg-indigo-50 rounded-lg p-2 text-center">
                      <p className="text-xs text-indigo-600">💳 Panier M.</p>
                      <p className="text-sm font-bold text-indigo-900">{bilanIndividuel.kpi_resume.panier_moyen.toFixed(0)}€</p>
                    </div>
                  )}
                  {kpiConfig?.track_ventes && kpiConfig?.track_clients && bilanIndividuel.kpi_resume.taux_transformation !== undefined && (
                    <div className="bg-pink-50 rounded-lg p-2 text-center">
                      <p className="text-xs text-pink-600">📈 Taux Transfo</p>
                      <p className="text-sm font-bold text-pink-900">{bilanIndividuel.kpi_resume.taux_transformation.toFixed(0)}%</p>
                    </div>
                  )}
                  {kpiConfig?.track_articles && kpiConfig?.track_clients && bilanIndividuel.kpi_resume.indice_vente !== undefined && (
                    <div className="bg-teal-50 rounded-lg p-2 text-center">
                      <p className="text-xs text-teal-600">🎯 Indice</p>
                      <p className="text-sm font-bold text-teal-900">{bilanIndividuel.kpi_resume.indice_vente.toFixed(1)}</p>
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
                <h3 className="text-xl font-bold text-gray-800">🤖 Mon Bilan Individuel</h3>
              </div>
              
              <div className="text-center py-8">
                <p className="text-gray-600 mb-4">Aucun bilan généré pour le moment</p>
                <button
                  onClick={regenerateBilan}
                  disabled={generatingBilan}
                  className="flex items-center gap-2 px-4 py-3 bg-[#ffd871] hover:bg-yellow-400 text-gray-800 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium mx-auto"
                >
                  <Sparkles className={`w-5 h-5 ${generatingBilan ? 'animate-spin' : ''}`} />
                  {generatingBilan ? 'Génération en cours...' : 'Générer mon bilan'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="glass-morphism rounded-2xl p-6 card-hover">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Évaluations</p>
                <p className="text-3xl font-bold text-gray-800">{kpiStats.totalEvaluations}</p>
                <p className="text-xs text-gray-500">Diagnostic + Débriefs</p>
              </div>
            </div>
          </div>

          <div className="glass-morphism rounded-2xl p-6 card-hover">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <MessageSquare className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Ventes (7j)</p>
                <p className="text-3xl font-bold text-gray-800">{kpiStats.totalVentes}</p>
              </div>
            </div>
          </div>

          <div className="glass-morphism rounded-2xl p-6 card-hover">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Award className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">CA (7j)</p>
                <p className="text-3xl font-bold text-gray-800">{kpiStats.totalCA.toFixed(0)}€</p>
              </div>
            </div>
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Radar Chart */}
          <div className="glass-morphism rounded-2xl p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Compétences</h2>
            {avgRadarScores.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={avgRadarScores}>
                  <PolarGrid stroke="#cbd5e1" />
                  <PolarAngleAxis dataKey="skill" tick={{ fill: '#475569', fontSize: 12 }} />
                  <Radar name="Score" dataKey="value" stroke="#ffd871" fill="#ffd871" fillOpacity={0.6} />
                </RadarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-12 text-gray-500">Aucune donnée disponible</div>
            )}
          </div>

          {/* Evolution Chart - Score Global sur 25 */}
          <div className="glass-morphism rounded-2xl p-6">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-800">Évolution de ton score global</h2>
              {evolutionData.length > 0 && (
                <p className="text-sm text-gray-600 mt-1">
                  Score actuel : <span className="font-bold text-[#ffd871]">{evolutionData[evolutionData.length - 1]['Score Global']}/25</span>
                  {evolutionData.length > 1 && (
                    <span className="ml-2">
                      ({evolutionData[evolutionData.length - 1]['Score Global'] - evolutionData[0]['Score Global'] >= 0 ? '+' : ''}
                      {(evolutionData[evolutionData.length - 1]['Score Global'] - evolutionData[0]['Score Global']).toFixed(1)} points depuis le début)
                    </span>
                  )}
                </p>
              )}
            </div>
            {evolutionData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={evolutionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                  <XAxis dataKey="fullDate" tick={{ fill: '#475569', fontSize: 12 }} />
                  <YAxis domain={[0, 25]} tick={{ fill: '#475569' }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#fff', border: '2px solid #ffd871', borderRadius: '8px' }}
                    labelStyle={{ color: '#1f2937', fontWeight: 'bold' }}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="Score Global" 
                    stroke="#ffd871" 
                    strokeWidth={3} 
                    dot={{ r: 5, fill: '#ffd871', strokeWidth: 2, stroke: '#fff' }}
                    activeDot={{ r: 7 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-12 text-gray-500">Complète ton diagnostic pour voir ton évolution</div>
            )}
          </div>
        </div>

        {/* Derniers KPIs rentrés */}
        {kpiEntries.length > 0 && (
          <div className="glass-morphism rounded-2xl p-6 mt-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">📊 Derniers KPIs rentrés</h2>
            <div className="space-y-4">
              {kpiEntries.slice(0, 3).map((entry) => (
                <div
                  key={entry.id}
                  className="bg-white rounded-xl p-4 border border-gray-200 hover:shadow-md transition-all"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="text-sm text-gray-500 mb-1">
                        🗓️ {new Date(entry.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <div className="bg-blue-50 rounded-lg p-3">
                      <p className="text-xs text-blue-600 mb-1">💰 CA</p>
                      <p className="text-lg font-bold text-blue-900">{entry.ca_journalier.toFixed(2)}€</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-3">
                      <p className="text-xs text-green-600 mb-1">🛒 Ventes</p>
                      <p className="text-lg font-bold text-green-900">{entry.nb_ventes}</p>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-3">
                      <p className="text-xs text-purple-600 mb-1">👥 Clients</p>
                      <p className="text-lg font-bold text-purple-900">{entry.nb_clients}</p>
                    </div>
                    <div className="bg-orange-50 rounded-lg p-3">
                      <p className="text-xs text-orange-600 mb-1">🧮 Panier Moyen</p>
                      <p className="text-lg font-bold text-orange-900">{entry.panier_moyen.toFixed(2)}€</p>
                    </div>
                    <div className="bg-pink-50 rounded-lg p-3">
                      <p className="text-xs text-pink-600 mb-1">📊 Taux Transfo</p>
                      <p className="text-lg font-bold text-pink-900">{entry.taux_transformation.toFixed(2)}%</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Derniers débriefs */}
        <div className="glass-morphism rounded-2xl p-6 mt-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">📝 Derniers débriefs</h2>
          
          {debriefs.length > 0 ? (
            <>
              <div className="space-y-4">
                {debriefs.slice(0, showAllDebriefs ? debriefs.length : 3).map((debrief) => (
                  <div
                    key={debrief.id}
                    className="bg-white rounded-xl border border-gray-200 hover:shadow-md transition-all"
                  >
                    {/* Compact Header - Always Visible */}
                    <button
                      onClick={() => toggleDebrief(debrief.id)}
                      className="w-full p-4 text-left hover:bg-gray-50 transition-colors rounded-xl"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="text-sm text-gray-500 mb-2">
                            🗓️ {new Date(debrief.created_at).toLocaleDateString('fr-FR')} — Produit : {debrief.produit} — Type de client : {debrief.type_client}
                          </p>
                          <div className="space-y-1 text-sm text-gray-600">
                            <p>💬 Description : {debrief.description_vente}</p>
                            <p>📍 Moment clé : {debrief.moment_perte_client}</p>
                            <p>❌ Raisons évoquées : {debrief.raisons_echec}</p>
                          </div>
                        </div>
                        <div className="ml-4 text-gray-600 font-bold text-xl flex-shrink-0">
                          {expandedDebriefs[debrief.id] ? '−' : '+'}
                        </div>
                      </div>
                    </button>

                    {/* AI Analysis - Expandable */}
                    {expandedDebriefs[debrief.id] && (
                      <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3 animate-fadeIn">
                        {/* Analyse */}
                        <div className="bg-blue-50 rounded-lg p-3">
                          <p className="text-xs font-semibold text-blue-900 mb-1">💬 Analyse</p>
                          <p className="text-sm text-blue-800 whitespace-pre-line">{debrief.ai_analyse}</p>
                        </div>

                        {/* Points à travailler */}
                        <div className="bg-orange-50 rounded-lg p-3">
                          <p className="text-xs font-semibold text-orange-900 mb-1">🎯 Points à travailler</p>
                          <p className="text-sm text-orange-800 whitespace-pre-line">{debrief.ai_points_travailler}</p>
                        </div>

                        {/* Recommandation */}
                        <div className="bg-green-50 rounded-lg p-3">
                          <p className="text-xs font-semibold text-green-900 mb-1">🚀 Recommandation</p>
                          <p className="text-sm text-green-800 whitespace-pre-line">{debrief.ai_recommandation}</p>
                        </div>

                        {/* Exemple concret */}
                        <div className="bg-purple-50 rounded-lg p-3">
                          <p className="text-xs font-semibold text-purple-900 mb-1">💡 Exemple concret</p>
                          <p className="text-sm text-purple-800 italic whitespace-pre-line">{debrief.ai_exemple_concret}</p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              
              {/* Load More Button */}
              {debriefs.length > 3 && !showAllDebriefs && (
                <div className="mt-4 text-center">
                  <button
                    onClick={() => setShowAllDebriefs(true)}
                    className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full font-medium transition-colors"
                  >
                    Voir tous les débriefs ({debriefs.length - 3} de plus)
                  </button>
                </div>
              )}
              
              {showAllDebriefs && debriefs.length > 3 && (
                <div className="mt-4 text-center">
                  <button
                    onClick={() => setShowAllDebriefs(false)}
                    className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full font-medium transition-colors"
                  >
                    Voir moins
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12 text-gray-500">
              Aucun débrief pour le moment. Analysez votre première vente non conclue !
            </div>
          )}
        </div>
      </div>

      {showEvalModal && (
        <EvaluationModal
          sales={sales}
          onClose={() => setShowEvalModal(false)}
          onSuccess={handleEvaluationCreated}
        />
      )}

      {showDebriefModal && (
        <DebriefModal
          onClose={() => setShowDebriefModal(false)}
          onSuccess={handleDebriefSuccess}
        />
      )}

      {showKPIModal && (
        <KPIEntryModal
          onClose={() => setShowKPIModal(false)}
          onSuccess={() => {
            setShowKPIModal(false);
            fetchData();
          }}
        />
      )}

      {/* Diagnostic Modal */}
      {showDiagnosticModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Diagnostic vendeur</h2>
            <p className="text-gray-600 mb-6">
              Complète ton diagnostic pour découvrir ton profil unique de vendeur. Ça prend moins de 10 minutes !
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDiagnosticModal(false);
                  navigate('/diagnostic');
                }}
                className="flex-1 btn-primary"
              >
                Commencer
              </button>
              <button
                onClick={() => setShowDiagnosticModal(false)}
                className="flex-1 btn-secondary"
              >
                Plus tard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manager Request Modal */}
      {showTaskModal && selectedTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">{selectedTask.title}</h2>
            <p className="text-gray-600 mb-6">{selectedTask.description}</p>
            
            <textarea
              value={taskResponse}
              onChange={(e) => setTaskResponse(e.target.value)}
              placeholder="Écris ta réponse ici..."
              rows={5}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#ffd871] focus:border-transparent resize-none mb-4"
            />
            
            <div className="flex gap-3">
              <button
                onClick={async () => {
                  try {
                    await axios.post(`${API}/seller/respond-request`, {
                      request_id: selectedTask.id,
                      response: taskResponse
                    });
                    toast.success('Réponse envoyée!');
                    setShowTaskModal(false);
                    setSelectedTask(null);
                    setTaskResponse('');
                    fetchData();
                  } catch (err) {
                    toast.error('Erreur lors de l\'envoi');
                  }
                }}
                disabled={!taskResponse.trim()}
                className="flex-1 btn-primary disabled:opacity-50"
              >
                Envoyer
              </button>
              <button
                onClick={() => {
                  setShowTaskModal(false);
                  setSelectedTask(null);
                  setTaskResponse('');
                }}
                className="flex-1 btn-secondary"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile Modal */}
      {showProfileModal && (
        <SellerProfileModal
          diagnostic={diagnostic}
          onClose={() => setShowProfileModal(false)}
          onRedoDiagnostic={() => setShowDiagnosticFormModal(true)}
        />
      )}

      {/* Bilan Individuel Modal */}
      {showBilanModal && bilanIndividuel && (
        <BilanIndividuelModal
          bilan={bilanIndividuel}
          kpiConfig={kpiConfig}
          onClose={() => setShowBilanModal(false)}
        />
      )}

      {/* Diagnostic Form Modal */}
      {showDiagnosticFormModal && (
        <DiagnosticFormModal
          onClose={() => setShowDiagnosticFormModal(false)}
          onSuccess={() => {
            setShowDiagnosticFormModal(false);
            toast.success('Diagnostic complété! Rechargement...');
            setTimeout(() => window.location.reload(), 1000);
          }}
        />
      )}
    </div>
  );
}
