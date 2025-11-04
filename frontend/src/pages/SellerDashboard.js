import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { LogOut, Plus, TrendingUp, Award, MessageSquare, Sparkles, BarChart3, RefreshCw } from 'lucide-react';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import EvaluationModal from '../components/EvaluationModal';
import DebriefModal from '../components/DebriefModal';
import DebriefHistoryModal from '../components/DebriefHistoryModal';
import KPIEntryModal from '../components/KPIEntryModal';
import KPIHistoryModal from '../components/KPIHistoryModal';
import KPIReporting from './KPIReporting';
import SellerProfileModal from '../components/SellerProfileModal';
import BilanIndividuelModal from '../components/BilanIndividuelModal';
import DiagnosticFormModal from '../components/DiagnosticFormModal';
import CompetencesExplicationModal from '../components/CompetencesExplicationModal';
import ChallengeHistoryModal from '../components/ChallengeHistoryModal';
import DailyChallengeModal from '../components/DailyChallengeModal';
import ObjectivesAndChallengesModal from '../components/ObjectivesAndChallengesModal';

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
    green: { bg: 'from-green-50 to-emerald-50', border: 'border-green-200', text: 'text-green-600', textBold: 'text-green-700' }
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
        <span className="text-xs text-green-600 font-medium">✅ Réalisé</span>
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

export default function SellerDashboard({ user, diagnostic: initialDiagnostic, onLogout }) {
  const navigate = useNavigate();
  const [evaluations, setEvaluations] = useState([]);
  const [sales, setSales] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [debriefs, setDebriefs] = useState([]);
  const [competencesHistory, setCompetencesHistory] = useState([]);
  const [kpiEntries, setKpiEntries] = useState([]);
  const [diagnostic, setDiagnostic] = useState(initialDiagnostic);
  const [dailyChallenge, setDailyChallenge] = useState(null);
  const [loadingChallenge, setLoadingChallenge] = useState(false);
  const [showEvalModal, setShowEvalModal] = useState(false);
  const [showDebriefModal, setShowDebriefModal] = useState(false);
  const [showDebriefHistoryModal, setShowDebriefHistoryModal] = useState(false);
  const [showKPIModal, setShowKPIModal] = useState(false);
  const [showKPIHistoryModal, setShowKPIHistoryModal] = useState(false);
  const [editingKPI, setEditingKPI] = useState(null);
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
  const [showCompetencesModal, setShowCompetencesModal] = useState(false);
  // States for Bilan Individuel
  const [bilanIndividuel, setBilanIndividuel] = useState(null);
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);
  const [generatingBilan, setGeneratingBilan] = useState(false);
  const [kpiConfig, setKpiConfig] = useState(null);
  const [activeChallenges, setActiveChallenges] = useState([]); // Challenges actifs (collectifs + personnels)
  const [activeObjectives, setActiveObjectives] = useState([]); // Objectifs d'équipe actifs
  const [currentObjectiveIndex, setCurrentObjectiveIndex] = useState(0); // Carousel for objectives
  const [currentChallengeIndex, setCurrentChallengeIndex] = useState(0); // Carousel for challenges
  // States for daily challenge feedback
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [challengeFeedbackComment, setChallengeFeedbackComment] = useState('');
  const [showChallengeHistoryModal, setShowChallengeHistoryModal] = useState(false);
  const [showDailyChallengeModal, setShowDailyChallengeModal] = useState(false);
  const [showObjectivesModal, setShowObjectivesModal] = useState(false);
  
  // Dashboard Filters & Preferences
  const [dashboardFilters, setDashboardFilters] = useState(() => {
    const saved = localStorage.getItem('seller_dashboard_filters');
    return saved ? JSON.parse(saved) : {
      showProfile: true,
      showCompetences: true,
      showObjectives: true,
      showChallenges: true,
      showKPI: true,
      showDebriefs: true,
      showBilan: true,
      periodFilter: 'all' // 'today', 'week', 'month', 'all', 'custom'
    };
  });
  const [showFilters, setShowFilters] = useState(false);
  const [sectionOrder, setSectionOrder] = useState(() => {
    const saved = localStorage.getItem('seller_section_order');
    return saved ? JSON.parse(saved) : ['profile', 'objectives', 'competences', 'kpi', 'debriefs'];
  });

  useEffect(() => {
    fetchData();
    fetchKpiConfig();
    fetchBilanIndividuel();
    fetchActiveChallenges();
    fetchActiveObjectives();
    fetchDailyChallenge();
  }, []);

  // Save filter preferences
  useEffect(() => {
    localStorage.setItem('seller_dashboard_filters', JSON.stringify(dashboardFilters));
  }, [dashboardFilters]);

  // Save section order
  useEffect(() => {
    localStorage.setItem('seller_section_order', JSON.stringify(sectionOrder));
  }, [sectionOrder]);

  // Update tasks when daily challenge changes
  useEffect(() => {
    if (!dailyChallenge) return;
    
    setTasks(prevTasks => {
      // Remove old challenge task if exists
      let newTasks = prevTasks.filter(t => t.id !== 'daily-challenge');
      
      // Add new challenge task if not completed
      if (!dailyChallenge.completed) {
        const challengeTask = {
          id: 'daily-challenge',
          type: 'challenge',
          icon: '🎯',
          title: dailyChallenge.title,
          description: dailyChallenge.description,
          priority: 'important'
        };
        newTasks = [challengeTask, ...newTasks];
      }
      
      return newTasks;
    });
  }, [dailyChallenge]);

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

  // Get section position for CSS ordering
  const getSectionOrder = (sectionId) => {
    return sectionOrder.indexOf(sectionId);
  };

  const fetchActiveObjectives = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/seller/objectives/active`, {
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
      const res = await axios.get(`${API}/seller/challenges/active`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setActiveChallenges(res.data);
    } catch (err) {
      console.error('Error fetching active challenges:', err);
    }
  };

  const fetchDailyChallenge = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/seller/daily-challenge`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDailyChallenge(res.data);
    } catch (err) {
      console.error('Error fetching daily challenge:', err);
    }
  };

  const completeDailyChallenge = async (result) => {
    if (!dailyChallenge) return;
    
    // If no result provided, just show the feedback form
    if (!result) {
      setShowFeedbackForm(true);
      return;
    }
    
    setLoadingChallenge(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(
        `${API}/seller/daily-challenge/complete`,
        { 
          challenge_id: dailyChallenge.id,
          result: result,
          comment: challengeFeedbackComment || null
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setDailyChallenge(res.data);
      setShowFeedbackForm(false);
      setChallengeFeedbackComment('');
      
      const messages = {
        success: '🎉 Excellent ! Challenge réussi !',
        partial: '💪 Bon effort ! Continue comme ça !',
        failed: '🤔 Pas grave ! On réessaie demain !'
      };
      toast.success(messages[result] || '✅ Feedback enregistré !');
    } catch (err) {
      console.error('Error completing challenge:', err);
      toast.error('Erreur lors de la validation');
    } finally {
      setLoadingChallenge(false);
    }
  };

  const refreshDailyChallenge = async () => {
    setLoadingChallenge(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(
        `${API}/seller/daily-challenge/refresh`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setDailyChallenge(res.data);
      toast.success('✨ Nouveau challenge généré !');
    } catch (err) {
      console.error('Error refreshing challenge:', err);
      toast.error('Erreur lors de la génération');
    } finally {
      setLoadingChallenge(false);
    }
  };

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const [evalsRes, salesRes, tasksRes, debriefsRes] = await Promise.all([
        axios.get(`${API}/evaluations`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/sales`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/seller/tasks`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/debriefs`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      
      setEvaluations(evalsRes.data);
      setSales(salesRes.data);
      setTasks(tasksRes.data);
      setDebriefs(debriefsRes.data);
      
      // Try to load live scores (non-blocking)
      try {
        const liveScoresRes = await axios.get(`${API}/diagnostic/me/live-scores`, { headers: { Authorization: `Bearer ${token}` } });
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
      } catch (err) {
        console.log('No diagnostic or live scores available yet');
        setCompetencesHistory([]);
      }
      
      // Try to load diagnostic info
      try {
        const diagnosticRes = await axios.get(`${API}/diagnostic/me`, { headers: { Authorization: `Bearer ${token}` } });
        if (diagnosticRes.data) {
          setDiagnostic(diagnosticRes.data);
        }
      } catch (err) {
        console.log('No diagnostic available yet');
      }
      
      // Get KPI entries
      try {
        const kpiRes = await axios.get(`${API}/seller/kpi-entries`, { headers: { Authorization: `Bearer ${token}` } });
        setKpiEntries(kpiRes.data);
        
        // Check if today's KPI has been entered
        const today = new Date().toISOString().split('T')[0];
        const todayKPI = kpiRes.data.find(entry => entry.date === today);
        
        // Build tasks list
        let newTasks = [...tasksRes.data];
        
        // Add daily KPI task if not entered today
        if (!todayKPI && !tasksRes.data.find(t => t.id === 'daily-kpi')) {
          const kpiTask = {
            id: 'daily-kpi',
            type: 'kpi',
            icon: '📊',
            title: 'Saisir les KPI du jour',
            description: 'Renseigne ton chiffre d\'affaires, nombre de ventes et clients du jour',
            priority: 'normal'
          };
          newTasks = [kpiTask, ...newTasks];
        }
        
        // Note: Daily challenge task is added via useEffect when dailyChallenge changes
        
        setTasks(newTasks);
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

  const refreshCompetenceScores = async () => {
    try {
      const token = localStorage.getItem('token');
      const liveScoresRes = await axios.get(`${API}/diagnostic/me/live-scores`, { headers: { Authorization: `Bearer ${token}` } });
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
        toast.success('✨ Tes compétences ont été mises à jour !');
      }
    } catch (err) {
      console.log('Unable to refresh competence scores');
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

  // KPI Reporting Modal will be rendered at the end of the JSX

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
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
              Personnaliser
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

      {/* Dashboard Filters Bar */}
      {showFilters && (
        <div className="max-w-7xl mx-auto mb-6">
          <div className="glass-morphism rounded-2xl p-4">
            <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-gray-800">🎛️ Personnalisation du Dashboard</h3>
              </div>
              
              {/* Quick stats */}
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span>
                  {Object.values(dashboardFilters).filter(v => v === true).length - 1} sections affichées
                </span>
              </div>
            </div>

            {/* Filter Toggles */}
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-3">Afficher/Masquer les sections :</p>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
                <button
                  onClick={() => toggleFilter('showProfile')}
                  className={`px-4 py-3 rounded-lg font-medium transition-all border-2 ${
                    dashboardFilters.showProfile
                      ? 'bg-green-50 border-green-500 text-green-700'
                      : 'bg-gray-50 border-gray-300 text-gray-500'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    {dashboardFilters.showProfile ? '✅' : '⬜'}
                    <span className="text-xs">👤 Profil</span>
                  </div>
                </button>

                <button
                  onClick={() => toggleFilter('showCompetences')}
                  className={`px-4 py-3 rounded-lg font-medium transition-all border-2 ${
                    dashboardFilters.showCompetences
                      ? 'bg-green-50 border-green-500 text-green-700'
                      : 'bg-gray-50 border-gray-300 text-gray-500'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    {dashboardFilters.showCompetences ? '✅' : '⬜'}
                    <span className="text-xs">⭐ Compétences</span>
                  </div>
                </button>

                <button
                  onClick={() => toggleFilter('showObjectives')}
                  className={`px-4 py-3 rounded-lg font-medium transition-all border-2 ${
                    dashboardFilters.showObjectives
                      ? 'bg-green-50 border-green-500 text-green-700'
                      : 'bg-gray-50 border-gray-300 text-gray-500'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    {dashboardFilters.showObjectives ? '✅' : '⬜'}
                    <span className="text-xs">🎯 Objectifs</span>
                  </div>
                </button>

                <button
                  onClick={() => toggleFilter('showChallenges')}
                  className={`px-4 py-3 rounded-lg font-medium transition-all border-2 ${
                    dashboardFilters.showChallenges
                      ? 'bg-green-50 border-green-500 text-green-700'
                      : 'bg-gray-50 border-gray-300 text-gray-500'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    {dashboardFilters.showChallenges ? '✅' : '⬜'}
                    <span className="text-xs">🏆 Challenges</span>
                  </div>
                </button>

                <button
                  onClick={() => toggleFilter('showKPI')}
                  className={`px-4 py-3 rounded-lg font-medium transition-all border-2 ${
                    dashboardFilters.showKPI
                      ? 'bg-green-50 border-green-500 text-green-700'
                      : 'bg-gray-50 border-gray-300 text-gray-500'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    {dashboardFilters.showKPI ? '✅' : '⬜'}
                    <span className="text-xs">📊 KPI</span>
                  </div>
                </button>

                <button
                  onClick={() => toggleFilter('showDebriefs')}
                  className={`px-4 py-3 rounded-lg font-medium transition-all border-2 ${
                    dashboardFilters.showDebriefs
                      ? 'bg-green-50 border-green-500 text-green-700'
                      : 'bg-gray-50 border-gray-300 text-gray-500'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    {dashboardFilters.showDebriefs ? '✅' : '⬜'}
                    <span className="text-xs">📝 Débriefs</span>
                  </div>
                </button>

                <button
                  onClick={() => toggleFilter('showBilan')}
                  className={`px-4 py-3 rounded-lg font-medium transition-all border-2 ${
                    dashboardFilters.showBilan
                      ? 'bg-green-50 border-green-500 text-green-700'
                      : 'bg-gray-50 border-gray-300 text-gray-500'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    {dashboardFilters.showBilan ? '✅' : '⬜'}
                    <span className="text-xs">📈 Bilan</span>
                  </div>
                </button>
              </div>

              {/* Section Reordering */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <p className="text-sm font-semibold text-gray-700 mb-3">Réorganiser les sections :</p>
                <div className="space-y-2">
                  {sectionOrder.map((sectionId, index) => {
                    const sectionNames = {
                      profile: '👤 Profil & Bilan',
                      objectives: '🎯 Objectifs & Challenges',
                      competences: '⭐ Compétences',
                      kpi: '📊 KPI',
                      debriefs: '📝 Débriefs'
                    };
                    return (
                      <div key={sectionId} className="flex items-center justify-between bg-white rounded-lg p-3 border-2 border-gray-200">
                        <span className="font-medium text-gray-800">{sectionNames[sectionId]}</span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => moveSectionUp(sectionId)}
                            disabled={index === 0}
                            className={`p-2 rounded-lg transition-all ${
                              index === 0
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
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
                            className={`p-2 rounded-lg transition-all ${
                              index === sectionOrder.length - 1
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
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
        </div>
      )}

      <div className="max-w-7xl mx-auto flex flex-col">
        {/* Tasks Section - Always visible - Compact */}
        <div className="glass-morphism rounded-2xl p-4 mb-6 border-2 border-[#ffd871]">
          <h2 className="text-xl font-bold text-gray-800 mb-3">Mes tâches à faire</h2>
          
          {tasks.length > 0 ? (
            <div className="space-y-2">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="bg-white rounded-lg p-3 border border-gray-200 hover:shadow-md transition-all cursor-pointer"
                  onClick={() => {
                    if (task.type === 'diagnostic') {
                      setShowDiagnosticModal(true);
                    } else if (task.type === 'kpi') {
                      setShowKPIModal(true);
                    } else if (task.type === 'challenge') {
                      // Open daily challenge modal
                      setShowDailyChallengeModal(true);
                    } else {
                      setSelectedTask(task);
                      setShowTaskModal(true);
                    }
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1">
                      <span className="text-2xl">{task.icon}</span>
                      <div className="flex-1">
                        <h3 className="text-sm font-semibold text-gray-800">{task.title}</h3>
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      task.priority === 'high' ? 'bg-red-100 text-red-700' : 
                      task.priority === 'important' ? 'bg-orange-100 text-orange-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {task.priority === 'high' ? 'Urgent' : task.priority === 'important' ? 'Important' : 'Normal'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-8 text-center border-2 border-green-200">
              <div className="text-6xl mb-4">🎉</div>
              <h3 className="text-2xl font-bold text-green-800 mb-2">Bravo !</h3>
              <p className="text-green-700 text-lg">Tu as rempli toutes tes tâches du jour !</p>
              <p className="text-green-600 text-sm mt-2">Continue comme ça, tu es au top ! 💪</p>
            </div>
          )}
        </div>

        {/* Grid 2x2 for all cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        
        {/* Profile & Bilan - Visual Cards */}
            {/* Profile Card - Visual */}
            {diagnostic && dashboardFilters.showProfile && (
            <div 
              onClick={() => setShowProfileModal(true)}
              className="glass-morphism rounded-2xl overflow-hidden cursor-pointer group hover:shadow-2xl transition-all duration-300 border-2 border-transparent hover:border-[#ffd871]"
            >
              <div className="relative h-48 bg-gradient-to-br from-purple-400 via-pink-400 to-red-400 flex items-center justify-center">
                <div className="absolute inset-0 bg-black opacity-20 group-hover:opacity-10 transition-opacity"></div>
                <div className="relative z-10 text-center text-white">
                  <div className="w-20 h-20 bg-white bg-opacity-30 rounded-full mx-auto mb-3 flex items-center justify-center backdrop-blur-sm">
                    <Sparkles className="w-10 h-10" />
                  </div>
                  <h3 className="text-2xl font-bold">Mon Profil de Vente</h3>
                  <p className="text-sm mt-2 opacity-90">Cliquer pour voir les détails →</p>
                </div>
              </div>
              <div className="p-4 bg-white">
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center">
                    <p className="text-xs text-purple-600 mb-1">Style</p>
                    <p className="text-sm font-bold text-purple-900">{diagnostic.style}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-green-600 mb-1">Niveau</p>
                    <p className="text-sm font-bold text-green-900">{diagnostic.level}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-orange-600 mb-1">DISC</p>
                    <p className="text-sm font-bold text-orange-900">{diagnostic.disc_dominant}</p>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDiagnosticModal(true);
                  }}
                  className="w-full mt-3 px-3 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:shadow-lg text-white font-semibold rounded-lg transition-all flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Relancer le diagnostic
                </button>
              </div>
            </div>
          )}

          {/* Bilan Individuel Card - Visual */}
          {bilanIndividuel && dashboardFilters.showBilan && (
            <div 
              onClick={() => setShowBilanModal(true)}
              className="glass-morphism rounded-2xl overflow-hidden cursor-pointer group hover:shadow-2xl transition-all duration-300 border-2 border-transparent hover:border-[#ffd871]"
            >
              <div className="relative h-48 bg-gradient-to-br from-blue-400 via-cyan-400 to-teal-400 flex items-center justify-center">
                <div className="absolute inset-0 bg-black opacity-20 group-hover:opacity-10 transition-opacity"></div>
                <div className="relative z-10 text-center text-white">
                  <div className="w-20 h-20 bg-white bg-opacity-30 rounded-full mx-auto mb-3 flex items-center justify-center backdrop-blur-sm">
                    <TrendingUp className="w-10 h-10" />
                  </div>
                  <h3 className="text-2xl font-bold">🤖 Mon Bilan Individuel</h3>
                  <p className="text-sm mt-2 opacity-90">Cliquer pour voir les détails →</p>
                </div>
              </div>
              <div className="p-4 bg-white">
                {bilanIndividuel.competences_cles && bilanIndividuel.competences_cles.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-semibold text-gray-600 mb-2">Top 3 compétences :</p>
                    <div className="flex flex-wrap gap-1">
                      {bilanIndividuel.competences_cles.slice(0, 3).map((comp, idx) => (
                        <span key={idx} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                          {comp}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    regenerateBilan();
                  }}
                  disabled={generatingBilan}
                  className="w-full px-3 py-2 bg-gradient-to-r from-blue-500 to-teal-500 hover:shadow-lg text-white font-semibold rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${generatingBilan ? 'animate-spin' : ''}`} />
                  {generatingBilan ? 'Génération...' : 'Regénérer le bilan'}
                </button>
              </div>
            </div>
          )}

        )}

        {/* Objectives and Challenges Card */}
        {((activeObjectives.length > 0 && dashboardFilters.showObjectives) || (activeChallenges.length > 0 && dashboardFilters.showChallenges)) && (
          <div 
            onClick={() => setShowObjectivesModal(true)}
            className="glass-morphism rounded-2xl overflow-hidden cursor-pointer group hover:shadow-2xl transition-all duration-300 border-2 border-transparent hover:border-[#ffd871]"
          >
            <div className="relative h-48 overflow-hidden">
              <img 
                src="https://images.unsplash.com/photo-1758599543129-5269a8f29e68?w=800&h=400&fit=crop" 
                alt="Objectifs et Challenges"
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-purple-900/70 to-pink-900/70 group-hover:from-purple-900/60 group-hover:to-pink-900/60 transition-all"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center text-white">
                  <div className="w-16 h-16 bg-white bg-opacity-30 rounded-full mx-auto mb-3 flex items-center justify-center backdrop-blur-sm">
                    <Award className="w-8 h-8" />
                  </div>
                  <h2 className="text-2xl font-bold">🎯 Objectifs et Challenges</h2>
                  <p className="text-sm mt-2 opacity-90">
                    {activeObjectives.length} objectifs • {activeChallenges.length} challenges
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Challenge du Jour IA Card */}
        {dashboardFilters.showCompetences && dailyChallenge && (
          <div 
            onClick={() => setShowDailyChallengeModal(true)}
            className="glass-morphism rounded-2xl overflow-hidden cursor-pointer group hover:shadow-2xl transition-all duration-300 border-2 border-transparent hover:border-[#ffd871]"
          >
            <div className="relative h-48 overflow-hidden">
              <img 
                src="https://images.unsplash.com/photo-1697577418970-95d99b5a55cf?w=800&h=400&fit=crop" 
                alt="Challenge du Jour IA"
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-orange-900/70 to-red-900/70 group-hover:from-orange-900/60 group-hover:to-red-900/60 transition-all"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center text-white">
                  <div className="w-16 h-16 bg-white bg-opacity-30 rounded-full mx-auto mb-3 flex items-center justify-center backdrop-blur-sm">
                    <Award className="w-8 h-8" />
                  </div>
                  <h2 className="text-2xl font-bold">🎯 Challenge du Jour IA</h2>
                  <p className="text-sm mt-2 opacity-90">
                    {dailyChallenge.completed ? '✅ Challenge relevé !' : 'Ton défi personnalisé'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Mes KPI Card */}
        {dashboardFilters.showKPI && (
          <div 
            onClick={() => setShowKPIHistoryModal(true)}
            className="glass-morphism rounded-2xl overflow-hidden cursor-pointer group hover:shadow-2xl transition-all duration-300 border-2 border-transparent hover:border-[#ffd871]"
          >
            <div className="relative h-48 overflow-hidden">
              <img 
                src="https://images.unsplash.com/photo-1608222351212-18fe0ec7b13b?w=800&h=400&fit=crop" 
                alt="Mes KPI"
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-blue-900/70 to-indigo-900/70 group-hover:from-blue-900/60 group-hover:to-indigo-900/60 transition-all"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center text-white">
                  <div className="w-16 h-16 bg-white bg-opacity-30 rounded-full mx-auto mb-3 flex items-center justify-center backdrop-blur-sm">
                    <BarChart3 className="w-8 h-8" />
                  </div>
                  <h2 className="text-2xl font-bold">📊 Mes KPI</h2>
                  <p className="text-sm mt-2 opacity-90">
                    {kpiEntries.length} KPI enregistré{kpiEntries.length > 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Mes derniers Debriefs Card */}
        {dashboardFilters.showDebriefs && (
          <div 
            onClick={() => setShowDebriefHistoryModal(true)}
            className="glass-morphism rounded-2xl overflow-hidden cursor-pointer group hover:shadow-2xl transition-all duration-300 border-2 border-transparent hover:border-[#ffd871]"
          >
            <div className="relative h-48 overflow-hidden">
              <img 
                src="https://images.unsplash.com/photo-1746021375306-9dec0f637732?w=800&h=400&fit=crop" 
                alt="Mes derniers Debriefs"
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-green-900/70 to-teal-900/70 group-hover:from-green-900/60 group-hover:to-teal-900/60 transition-all"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center text-white">
                  <div className="w-16 h-16 bg-white bg-opacity-30 rounded-full mx-auto mb-3 flex items-center justify-center backdrop-blur-sm">
                    <MessageSquare className="w-8 h-8" />
                  </div>
                  <h2 className="text-2xl font-bold">📝 Mes derniers Debriefs</h2>
                  <p className="text-sm mt-2 opacity-90">Voir tous mes débriefs →</p>
                </div>
              </div>
            </div>
          </div>
        )}

        </div>
        {/* End of Grid 2x2 */}

          {/* OLD DETAILED CARDS - TO BE REMOVED */}
          {false && diagnostic && dashboardFilters.showProfile && (
            <div className="glass-morphism rounded-2xl p-6 border-2 border-transparent hover:border-[#ffd871] transition-all">
              <div className="flex items-center justify-between mb-4">
                <div 
                  className="flex items-center gap-3 cursor-pointer"
                  onClick={() => setShowProfileModal(true)}
                >
                  <div className="w-12 h-12 bg-gradient-to-r from-[#ffd871] to-yellow-300 rounded-xl flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-gray-800" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-800">Mon Profil de Vente</h3>
                    <p className="text-sm text-gray-600">Cliquer pour voir le profil complet →</p>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDiagnosticModal(true);
                  }}
                  className="px-3 py-1.5 bg-gradient-to-r from-[#ffd871] to-yellow-300 hover:shadow-md text-gray-800 font-semibold rounded-lg transition-all flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Relancer
                </button>
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
              
              {/* Commentaire personnalisé IA */}
              {diagnostic.ai_profile_summary && (
                <div className="mt-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 border-l-4 border-purple-500">
                  <div className="flex items-start gap-2 mb-2">
                    <Sparkles className="w-4 h-4 text-purple-600 mt-0.5" />
                    <p className="text-xs font-semibold text-purple-900">Analyse IA de ton profil :</p>
                  </div>
                  <p className="text-xs text-purple-800 leading-relaxed">
                    {diagnostic.ai_profile_summary.length > 200 
                      ? `${diagnostic.ai_profile_summary.substring(0, 200)}...` 
                      : diagnostic.ai_profile_summary}
                  </p>
                  {diagnostic.ai_profile_summary.length > 200 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowProfileModal(true);
                      }}
                      className="text-xs text-purple-600 hover:text-purple-800 font-semibold mt-2 flex items-center gap-1"
                    >
                      Lire la suite →
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Bilan Individuel Card */}
          {bilanIndividuel && dashboardFilters.showBilan ? (
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
        )}

        {/* Objectives & Challenges Carousel Section */}
        {/* OLD Objectifs & Challenges - REMOVED (now in grid) */}
        {false && ((activeObjectives.length > 0 && dashboardFilters.showObjectives) || (activeChallenges.length > 0 && dashboardFilters.showChallenges)) && (
          <div 
            onClick={() => setShowObjectivesModal(true)}
            className="glass-morphism rounded-2xl overflow-hidden cursor-pointer group hover:shadow-2xl transition-all duration-300 mb-8 border-2 border-transparent hover:border-[#ffd871]"
            style={{ order: getSectionOrder('objectives') }}
          >
            <div className="relative h-48 overflow-hidden">
              <img 
                src="https://images.unsplash.com/photo-1758599543129-5269a8f29e68?w=800&h=400&fit=crop" 
                alt="Objectifs et Challenges"
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-purple-900/70 to-pink-900/70 group-hover:from-purple-900/60 group-hover:to-pink-900/60 transition-all"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center text-white">
                  <div className="w-16 h-16 bg-white bg-opacity-30 rounded-full mx-auto mb-3 flex items-center justify-center backdrop-blur-sm">
                    <Award className="w-8 h-8" />
                  </div>
                  <h2 className="text-2xl font-bold">🎯 Objectifs et Challenges</h2>
                  <p className="text-sm mt-2 opacity-90">
                    {activeObjectives.length} objectifs • {activeChallenges.length} challenges
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* OLD CAROUSEL SECTION - TO BE REMOVED */}
        {false && ((activeObjectives.length > 0 && dashboardFilters.showObjectives) || (activeChallenges.length > 0 && dashboardFilters.showChallenges)) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8" style={{ order: getSectionOrder('objectives') }}>
            {/* Team Objectives Section (Left) - Carousel */}
            {activeObjectives.length > 0 && dashboardFilters.showObjectives && (
              <div className="glass-morphism rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-6">
                  <Award className="w-6 h-6 text-purple-500" />
                  <h3 className="text-xl font-bold text-gray-800">🎯 Objectifs d'Équipe</h3>
                </div>

                {/* Carousel Navigation & Card */}
                <div className="relative">
                  {/* Navigation Buttons */}
                  {activeObjectives.length > 1 && (
                    <>
                      <button
                        onClick={() => setCurrentObjectiveIndex((prev) => (prev > 0 ? prev - 1 : activeObjectives.length - 1))}
                        className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white rounded-full p-2 shadow-lg hover:bg-gray-100 transition-all"
                      >
                        <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setCurrentObjectiveIndex((prev) => (prev < activeObjectives.length - 1 ? prev + 1 : 0))}
                        className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white rounded-full p-2 shadow-lg hover:bg-gray-100 transition-all"
                      >
                        <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </>
                  )}

                  {/* Objective Card */}
                  <div className="px-8">
                    {(() => {
                      const objective = activeObjectives[currentObjectiveIndex];
                      const daysRemaining = Math.ceil((new Date(objective.period_end) - new Date()) / (1000 * 60 * 60 * 24));

                      // Calculate progress percentage
                      const progressPercentage = (() => {
                        if (objective.ca_target && objective.progress_ca !== undefined) {
                          return (objective.progress_ca / objective.ca_target) * 100;
                        }
                        if (objective.panier_moyen_target && objective.progress_panier_moyen !== undefined) {
                          return (objective.progress_panier_moyen / objective.panier_moyen_target) * 100;
                        }
                        if (objective.indice_vente_target && objective.progress_indice_vente !== undefined) {
                          return (objective.progress_indice_vente / objective.indice_vente_target) * 100;
                        }
                        return 0;
                      })();

                      const status = objective.status || 'in_progress';

                      return (
                        <div 
                          key={objective.id} 
                          className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 border-2 border-purple-300 hover:shadow-lg transition-all min-h-[280px] flex flex-col"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <h4 className="font-bold text-gray-800 text-lg line-clamp-1">{objective.title}</h4>
                            <div className="flex flex-col gap-1 items-end">
                              {status === 'achieved' && (
                                <span className="bg-green-100 text-green-700 text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap">
                                  🎉 Atteint !
                                </span>
                              )}
                              {status === 'failed' && (
                                <span className="bg-red-100 text-red-700 text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap">
                                  ⚠️ Non atteint
                                </span>
                              )}
                              {status === 'in_progress' && (
                                <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap">
                                  ⏳ En cours
                                </span>
                              )}
                              <span className="bg-purple-100 text-purple-700 text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap">
                                👥 Équipe
                              </span>
                            </div>
                          </div>

                          {/* Période */}
                          <div className="text-xs text-gray-600 mb-2">
                            📅 {new Date(objective.period_start).toLocaleDateString('fr-FR')} - {new Date(objective.period_end).toLocaleDateString('fr-FR')}
                          </div>

                          {/* Progress Bar */}
                          <div className="mb-2">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-xs text-gray-600">Progression</span>
                              <span className="text-xs font-bold text-gray-800">{Math.min(100, progressPercentage.toFixed(0))}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div 
                                className={`h-2 rounded-full transition-all ${
                                  status === 'achieved' ? 'bg-gradient-to-r from-green-400 to-green-500' :
                                  status === 'failed' ? 'bg-gradient-to-r from-red-400 to-red-500' :
                                  'bg-gradient-to-r from-purple-400 to-pink-400'
                                }`}
                                style={{ width: `${Math.min(100, progressPercentage)}%` }}
                              ></div>
                            </div>
                          </div>

                          {/* Targets with Progress - Improved Clarity */}
                          <div className="space-y-2 mb-2 flex-1">
                            {objective.ca_target && (() => {
                              const progressCA = ((objective.progress_ca || 0) / objective.ca_target) * 100;
                              const reste = objective.ca_target - (objective.progress_ca || 0);
                              return (
                                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-2.5 border border-blue-200">
                                  <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-xs font-semibold text-gray-700">💰 Chiffre d'Affaires</span>
                                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                                      progressCA >= 100 ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                                    }`}>
                                      {progressCA.toFixed(0)}%
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between mb-0.5">
                                    <span className="text-xs text-indigo-600 font-medium">🎯 Objectif</span>
                                    <span className="text-sm font-bold text-indigo-700">
                                      {objective.ca_target.toLocaleString('fr-FR')}€
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between mb-0.5">
                                    <span className="text-xs text-green-600 font-medium">✅ Réalisé</span>
                                    <span className="text-sm font-bold text-green-700">
                                      {(objective.progress_ca || 0).toLocaleString('fr-FR')}€
                                    </span>
                                  </div>
                                  {progressCA < 100 ? (
                                    <div className="flex items-center justify-between pt-1 border-t border-blue-200">
                                      <span className="text-xs text-gray-600">📉 Reste</span>
                                      <span className="text-xs font-semibold text-gray-700">
                                        {reste.toLocaleString('fr-FR')}€
                                      </span>
                                    </div>
                                  ) : (
                                    <div className="pt-1 border-t border-green-200">
                                      <span className="text-xs text-green-700 font-semibold">
                                        🎉 Dépassé de {Math.abs(reste).toLocaleString('fr-FR')}€
                                      </span>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                            
                            {objective.panier_moyen_target && (() => {
                              const progressPM = ((objective.progress_panier_moyen || 0) / objective.panier_moyen_target) * 100;
                              const reste = objective.panier_moyen_target - (objective.progress_panier_moyen || 0);
                              return (
                                <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-2.5 border border-purple-200">
                                  <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-xs font-semibold text-gray-700">🛒 Panier Moyen</span>
                                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                                      progressPM >= 100 ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                                    }`}>
                                      {progressPM.toFixed(0)}%
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between mb-0.5">
                                    <span className="text-xs text-purple-600 font-medium">🎯 Objectif</span>
                                    <span className="text-sm font-bold text-purple-700">
                                      {objective.panier_moyen_target.toLocaleString('fr-FR')}€
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between mb-0.5">
                                    <span className="text-xs text-green-600 font-medium">✅ Réalisé</span>
                                    <span className="text-sm font-bold text-green-700">
                                      {(objective.progress_panier_moyen || 0).toFixed(1)}€
                                    </span>
                                  </div>
                                  {progressPM < 100 ? (
                                    <div className="flex items-center justify-between pt-1 border-t border-purple-200">
                                      <span className="text-xs text-gray-600">📉 Reste</span>
                                      <span className="text-xs font-semibold text-gray-700">
                                        {reste.toFixed(1)}€
                                      </span>
                                    </div>
                                  ) : (
                                    <div className="pt-1 border-t border-green-200">
                                      <span className="text-xs text-green-700 font-semibold">
                                        🎉 Dépassé de {Math.abs(reste).toFixed(1)}€
                                      </span>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                            
                            {objective.indice_vente_target && (() => {
                              const progressIndice = ((objective.progress_indice_vente || 0) / objective.indice_vente_target) * 100;
                              const reste = objective.indice_vente_target - (objective.progress_indice_vente || 0);
                              return (
                                <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg p-2.5 border border-yellow-200">
                                  <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-xs font-semibold text-gray-700">💎 Indice de Vente</span>
                                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                                      progressIndice >= 100 ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                                    }`}>
                                      {progressIndice.toFixed(0)}%
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between mb-0.5">
                                    <span className="text-xs text-yellow-600 font-medium">🎯 Objectif</span>
                                    <span className="text-sm font-bold text-yellow-700">
                                      {objective.indice_vente_target.toFixed(1)}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between mb-0.5">
                                    <span className="text-xs text-green-600 font-medium">✅ Réalisé</span>
                                    <span className="text-sm font-bold text-green-700">
                                      {(objective.progress_indice_vente || 0).toFixed(1)}
                                    </span>
                                  </div>
                                  {progressIndice < 100 ? (
                                    <div className="flex items-center justify-between pt-1 border-t border-yellow-200">
                                      <span className="text-xs text-gray-600">📉 Reste</span>
                                      <span className="text-xs font-semibold text-gray-700">
                                        {reste.toFixed(1)}
                                      </span>
                                    </div>
                                  ) : (
                                    <div className="pt-1 border-t border-green-200">
                                      <span className="text-xs text-green-700 font-semibold">
                                        🎉 Dépassé de {Math.abs(reste).toFixed(1)}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>

                          {/* Time remaining */}
                          <div className="flex items-center gap-2 text-xs text-gray-600 mt-auto pt-2 border-t border-purple-200">
                            <span>⏰</span>
                            <span>
                              {daysRemaining > 0 ? `${daysRemaining}j restant${daysRemaining > 1 ? 's' : ''}` : 'Se termine'}
                            </span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Pagination Dots */}
                  {activeObjectives.length > 1 && (
                    <div className="flex justify-center gap-2 mt-4">
                      {activeObjectives.map((_, index) => (
                        <button
                          key={index}
                          onClick={() => setCurrentObjectiveIndex(index)}
                          className={`w-2 h-2 rounded-full transition-all ${
                            index === currentObjectiveIndex ? 'bg-purple-500 w-4' : 'bg-gray-300'
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Challenges Section (Right) - Carousel */}
            {activeChallenges.length > 0 && dashboardFilters.showChallenges && (
              <div className="glass-morphism rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-6">
                  <Award className="w-6 h-6 text-[#ffd871]" />
                  <h3 className="text-xl font-bold text-gray-800">🏆 Mes Challenges</h3>
                </div>

                {/* Carousel Navigation & Card */}
                <div className="relative">
                  {/* Navigation Buttons */}
                  {activeChallenges.length > 1 && (
                    <>
                      <button
                        onClick={() => setCurrentChallengeIndex((prev) => (prev > 0 ? prev - 1 : activeChallenges.length - 1))}
                        className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white rounded-full p-2 shadow-lg hover:bg-gray-100 transition-all"
                      >
                        <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setCurrentChallengeIndex((prev) => (prev < activeChallenges.length - 1 ? prev + 1 : 0))}
                        className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white rounded-full p-2 shadow-lg hover:bg-gray-100 transition-all"
                      >
                        <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </>
                  )}

                  {/* Challenge Card */}
                  <div className="px-8">
                    {(() => {
                      const challenge = activeChallenges[currentChallengeIndex];
                      const progressPercentage = (() => {
                        if (challenge.ca_target) return (challenge.progress_ca / challenge.ca_target) * 100;
                        if (challenge.ventes_target) return (challenge.progress_ventes / challenge.ventes_target) * 100;
                        if (challenge.indice_vente_target) return (challenge.progress_indice_vente / challenge.indice_vente_target) * 100;
                        if (challenge.panier_moyen_target) return (challenge.progress_panier_moyen / challenge.panier_moyen_target) * 100;
                        return 0;
                      })();

                      const daysRemaining = Math.ceil((new Date(challenge.end_date) - new Date()) / (1000 * 60 * 60 * 24));
                      const isPersonal = challenge.type === 'individual' && challenge.seller_id === user.id;

                      return (
                        <div 
                          key={challenge.id} 
                          className={`rounded-xl p-4 border-2 hover:shadow-lg transition-all min-h-[280px] flex flex-col ${
                            isPersonal 
                              ? 'bg-gradient-to-br from-purple-50 to-pink-50 border-purple-300' 
                              : 'bg-gradient-to-br from-amber-50 to-yellow-50 border-[#ffd871]'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <h4 className="font-bold text-gray-800 text-lg line-clamp-1">{challenge.title}</h4>
                            <span className={`text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap ${
                              isPersonal 
                                ? 'bg-purple-100 text-purple-700' 
                                : 'bg-green-100 text-green-700'
                            }`}>
                              {isPersonal ? '👤 Personnel' : '🏆 Équipe'}
                            </span>
                          </div>

                          {challenge.description && (
                            <p className="text-gray-600 text-xs mb-2 line-clamp-1">{challenge.description}</p>
                          )}

                          {/* Progress Bar */}
                          <div className="mb-2">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-xs text-gray-600">Progression</span>
                              <span className="text-xs font-bold text-gray-800">{Math.min(100, progressPercentage.toFixed(0))}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div 
                                className={`h-2 rounded-full transition-all ${
                                  isPersonal 
                                    ? 'bg-gradient-to-r from-purple-400 to-pink-400' 
                                    : 'bg-gradient-to-r from-[#ffd871] to-yellow-300'
                                }`}
                                style={{ width: `${Math.min(100, progressPercentage)}%` }}
                              ></div>
                            </div>
                          </div>

                          {/* Targets with improved clarity */}
                          <div className="space-y-2 mb-2 flex-1">
                            {challenge.ca_target && (() => {
                              const progressCA = (challenge.progress_ca / challenge.ca_target) * 100;
                              const reste = challenge.ca_target - challenge.progress_ca;
                              return (
                                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-2.5 border border-blue-200">
                                  <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-xs font-semibold text-gray-700">💰 Chiffre d'Affaires</span>
                                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                                      progressCA >= 100 ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                                    }`}>
                                      {progressCA.toFixed(0)}%
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between mb-0.5">
                                    <span className="text-xs text-indigo-600 font-medium">🎯 Objectif</span>
                                    <span className="text-sm font-bold text-indigo-700">
                                      {challenge.ca_target.toLocaleString('fr-FR')}€
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between mb-0.5">
                                    <span className="text-xs text-green-600 font-medium">✅ Réalisé</span>
                                    <span className="text-sm font-bold text-green-700">
                                      {challenge.progress_ca.toLocaleString('fr-FR')}€
                                    </span>
                                  </div>
                                  {progressCA < 100 ? (
                                    <div className="flex items-center justify-between pt-1 border-t border-blue-200">
                                      <span className="text-xs text-gray-600">📉 Reste</span>
                                      <span className="text-xs font-semibold text-gray-700">
                                        {reste.toLocaleString('fr-FR')}€
                                      </span>
                                    </div>
                                  ) : (
                                    <div className="pt-1 border-t border-green-200">
                                      <span className="text-xs text-green-700 font-semibold">
                                        🎉 Dépassé de {Math.abs(reste).toLocaleString('fr-FR')}€
                                      </span>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                            
                            {challenge.ventes_target && (() => {
                              const progressVentes = (challenge.progress_ventes / challenge.ventes_target) * 100;
                              const reste = challenge.ventes_target - challenge.progress_ventes;
                              return (
                                <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-2.5 border border-green-200">
                                  <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-xs font-semibold text-gray-700">🛍️ Nombre de Ventes</span>
                                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                                      progressVentes >= 100 ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                                    }`}>
                                      {progressVentes.toFixed(0)}%
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between mb-0.5">
                                    <span className="text-xs text-green-600 font-medium">🎯 Objectif</span>
                                    <span className="text-sm font-bold text-green-700">
                                      {challenge.ventes_target}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between mb-0.5">
                                    <span className="text-xs text-emerald-600 font-medium">✅ Réalisé</span>
                                    <span className="text-sm font-bold text-emerald-700">
                                      {challenge.progress_ventes}
                                    </span>
                                  </div>
                                  {progressVentes < 100 ? (
                                    <div className="flex items-center justify-between pt-1 border-t border-green-200">
                                      <span className="text-xs text-gray-600">📉 Reste</span>
                                      <span className="text-xs font-semibold text-gray-700">
                                        {reste}
                                      </span>
                                    </div>
                                  ) : (
                                    <div className="pt-1 border-t border-emerald-200">
                                      <span className="text-xs text-emerald-700 font-semibold">
                                        🎉 Dépassé de {Math.abs(reste)}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                            
                            {challenge.panier_moyen_target && (() => {
                              const progressPM = (challenge.progress_panier_moyen / challenge.panier_moyen_target) * 100;
                              const reste = challenge.panier_moyen_target - challenge.progress_panier_moyen;
                              return (
                                <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-2.5 border border-purple-200">
                                  <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-xs font-semibold text-gray-700">🛒 Panier Moyen</span>
                                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                                      progressPM >= 100 ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                                    }`}>
                                      {progressPM.toFixed(0)}%
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between mb-0.5">
                                    <span className="text-xs text-purple-600 font-medium">🎯 Objectif</span>
                                    <span className="text-sm font-bold text-purple-700">
                                      {challenge.panier_moyen_target.toFixed(1)}€
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between mb-0.5">
                                    <span className="text-xs text-green-600 font-medium">✅ Réalisé</span>
                                    <span className="text-sm font-bold text-green-700">
                                      {challenge.progress_panier_moyen.toFixed(1)}€
                                    </span>
                                  </div>
                                  {progressPM < 100 ? (
                                    <div className="flex items-center justify-between pt-1 border-t border-purple-200">
                                      <span className="text-xs text-gray-600">📉 Reste</span>
                                      <span className="text-xs font-semibold text-gray-700">
                                        {reste.toFixed(1)}€
                                      </span>
                                    </div>
                                  ) : (
                                    <div className="pt-1 border-t border-green-200">
                                      <span className="text-xs text-green-700 font-semibold">
                                        🎉 Dépassé de {Math.abs(reste).toFixed(1)}€
                                      </span>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                            
                            {challenge.indice_vente_target && (() => {
                              const progressIndice = (challenge.progress_indice_vente / challenge.indice_vente_target) * 100;
                              const reste = challenge.indice_vente_target - challenge.progress_indice_vente;
                              return (
                                <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg p-2.5 border border-yellow-200">
                                  <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-xs font-semibold text-gray-700">💎 Indice de Vente</span>
                                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                                      progressIndice >= 100 ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                                    }`}>
                                      {progressIndice.toFixed(0)}%
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between mb-0.5">
                                    <span className="text-xs text-yellow-600 font-medium">🎯 Objectif</span>
                                    <span className="text-sm font-bold text-yellow-700">
                                      {challenge.indice_vente_target.toFixed(1)}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between mb-0.5">
                                    <span className="text-xs text-green-600 font-medium">✅ Réalisé</span>
                                    <span className="text-sm font-bold text-green-700">
                                      {challenge.progress_indice_vente.toFixed(1)}
                                    </span>
                                  </div>
                                  {progressIndice < 100 ? (
                                    <div className="flex items-center justify-between pt-1 border-t border-yellow-200">
                                      <span className="text-xs text-gray-600">📉 Reste</span>
                                      <span className="text-xs font-semibold text-gray-700">
                                        {reste.toFixed(1)}
                                      </span>
                                    </div>
                                  ) : (
                                    <div className="pt-1 border-t border-green-200">
                                      <span className="text-xs text-green-700 font-semibold">
                                        🎉 Dépassé de {Math.abs(reste).toFixed(1)}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>

                          {/* Time remaining */}
                          <div className="flex items-center gap-2 text-xs text-gray-600 mt-auto pt-2 border-t border-gray-200">
                            <span>⏰</span>
                            <span>
                              {daysRemaining > 0 ? `${daysRemaining}j restant${daysRemaining > 1 ? 's' : ''}` : 'Se termine'}
                            </span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Pagination Dots */}
                  {activeChallenges.length > 1 && (
                    <div className="flex justify-center gap-2 mt-4">
                      {activeChallenges.map((_, index) => (
                        <button
                          key={index}
                          onClick={() => setCurrentChallengeIndex(index)}
                          className={`w-2 h-2 rounded-full transition-all ${
                            index === currentChallengeIndex ? 'bg-[#ffd871] w-4' : 'bg-gray-300'
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* OLD Challenge du Jour IA - REMOVED (now in grid) */}
        {false && dashboardFilters.showCompetences && dailyChallenge && (
          <div 
            className="glass-morphism rounded-2xl overflow-hidden mb-8 border-2 border-transparent hover:border-[#ffd871] transition-all"
            data-section="challenge" 
            style={{ order: getSectionOrder('competences') }}
          >
            <div className="relative h-48 overflow-hidden group cursor-pointer" onClick={() => setShowDailyChallengeModal(true)}>
              <img 
                src="https://images.unsplash.com/photo-1697577418970-95d99b5a55cf?w=800&h=400&fit=crop" 
                alt="Challenge du Jour IA"
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-orange-900/70 to-red-900/70 group-hover:from-orange-900/60 group-hover:to-red-900/60 transition-all"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center text-white">
                  <div className="w-16 h-16 bg-white bg-opacity-30 rounded-full mx-auto mb-3 flex items-center justify-center backdrop-blur-sm">
                    <Award className="w-8 h-8" />
                  </div>
                  <h2 className="text-2xl font-bold">🎯 Challenge du Jour IA</h2>
                  <p className="text-sm mt-2 opacity-90">
                    {dailyChallenge.completed ? '✅ Challenge relevé !' : 'Ton défi personnalisé'}
                  </p>
                </div>
              </div>
            </div>
            <div className="p-4 bg-white flex justify-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowChallengeHistoryModal(true);
                }}
                className="px-4 py-2 bg-[#ffd871] hover:bg-[#ffc940] text-gray-800 font-semibold rounded-lg transition-all flex items-center gap-2"
              >
                <MessageSquare className="w-4 h-4" />
                Historique
              </button>
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  setLoadingChallenge(true);
                  try {
                    const token = localStorage.getItem('token');
                    const res = await axios.post(
                      `${API}/seller/daily-challenge/refresh`,
                      {},
                      { headers: { Authorization: `Bearer ${token}` } }
                    );
                    setDailyChallenge(res.data);
                    toast.success('✨ Nouveau challenge généré !');
                    setShowDailyChallengeModal(true);
                  } catch (err) {
                    console.error('Error refreshing challenge:', err);
                    toast.error('Erreur lors du rafraîchissement');
                  } finally {
                    setLoadingChallenge(false);
                  }
                }}
                disabled={loadingChallenge}
                className="px-4 py-2 bg-gradient-to-r from-orange-500 to-red-500 hover:shadow-lg text-white font-semibold rounded-lg transition-all flex items-center gap-2 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loadingChallenge ? 'animate-spin' : ''}`} />
                Relancer un défi
              </button>
            </div>
          </div>
        )}

        {/* OLD Mes KPI - REMOVED (now in grid) */}
        {false && dashboardFilters.showKPI && (
          <div 
            className="glass-morphism rounded-2xl overflow-hidden mt-8 border-2 border-transparent hover:border-[#ffd871] transition-all"
            style={{ order: getSectionOrder('kpi') }}
          >
            <div className="relative h-48 overflow-hidden group cursor-pointer" onClick={() => setShowKPIHistoryModal(true)}>
              <img 
                src="https://images.unsplash.com/photo-1608222351212-18fe0ec7b13b?w=800&h=400&fit=crop" 
                alt="Mes KPI"
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-blue-900/70 to-indigo-900/70 group-hover:from-blue-900/60 group-hover:to-indigo-900/60 transition-all"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center text-white">
                  <div className="w-16 h-16 bg-white bg-opacity-30 rounded-full mx-auto mb-3 flex items-center justify-center backdrop-blur-sm">
                    <BarChart3 className="w-8 h-8" />
                  </div>
                  <h2 className="text-2xl font-bold">📊 Mes KPI</h2>
                  <p className="text-sm mt-2 opacity-90">
                    {kpiEntries.length} KPI enregistré{kpiEntries.length > 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            </div>
            <div className="p-4 bg-white flex justify-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowKPIModal(true);
                }}
                className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 hover:shadow-lg text-white font-semibold rounded-lg transition-all flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Saisir KPI
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowKPIHistoryModal(true);
                }}
                className="px-4 py-2 bg-[#ffd871] hover:bg-[#ffc940] text-gray-800 font-semibold rounded-lg transition-all flex items-center gap-2"
              >
                <BarChart3 className="w-4 h-4" />
                Historique
              </button>
            </div>
          </div>
        )}

        {/* OLD Mes derniers Debriefs - REMOVED (now in grid) */}
        {false && dashboardFilters.showDebriefs && (
          <div 
            onClick={() => setShowDebriefHistoryModal(true)}
            className="glass-morphism rounded-2xl overflow-hidden mt-8 cursor-pointer group hover:shadow-2xl transition-all duration-300 border-2 border-transparent hover:border-[#ffd871]"
            style={{ order: getSectionOrder('debriefs') }}
          >
            <div className="relative h-48 overflow-hidden">
              <img 
                src="https://images.unsplash.com/photo-1746021375306-9dec0f637732?w=800&h=400&fit=crop" 
                alt="Mes derniers Debriefs"
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-green-900/70 to-teal-900/70 group-hover:from-green-900/60 group-hover:to-teal-900/60 transition-all"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center text-white">
                  <div className="w-16 h-16 bg-white bg-opacity-30 rounded-full mx-auto mb-3 flex items-center justify-center backdrop-blur-sm">
                    <MessageSquare className="w-8 h-8" />
                  </div>
                  <h2 className="text-2xl font-bold">📝 Mes derniers Debriefs</h2>
                  <p className="text-sm mt-2 opacity-90">Voir tous mes débriefs →</p>
                </div>
              </div>
            </div>
          </div>
        )}
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

      {showDebriefHistoryModal && (
        <DebriefHistoryModal
          debriefs={debriefs}
          onClose={() => setShowDebriefHistoryModal(false)}
          onNewDebrief={() => {
            setShowDebriefHistoryModal(false);
            setShowDebriefModal(true);
          }}
        />
      )}

      {showKPIModal && (
        <KPIEntryModal
          onClose={() => {
            setShowKPIModal(false);
            setEditingKPI(null);
          }}
          onSuccess={() => {
            setShowKPIModal(false);
            setEditingKPI(null);
            fetchData();
            refreshCompetenceScores(); // Refresh scores after KPI entry
          }}
          editEntry={editingKPI}
        />
      )}

      {showKPIHistoryModal && (
        <KPIHistoryModal
          kpiEntries={kpiEntries}
          kpiConfig={kpiConfig}
          onClose={() => setShowKPIHistoryModal(false)}
          onNewKPI={() => {
            setShowKPIHistoryModal(false);
            setShowKPIModal(true);
          }}
          onEditKPI={(entry) => {
            setEditingKPI(entry);
            setShowKPIHistoryModal(false);
            setShowKPIModal(true);
          }}
        />
      )}

      {showChallengeHistoryModal && (
        <ChallengeHistoryModal
          onClose={() => setShowChallengeHistoryModal(false)}
        />
      )}

      {showDailyChallengeModal && dailyChallenge && (
        <DailyChallengeModal
          challenge={dailyChallenge}
          onClose={() => setShowDailyChallengeModal(false)}
          onRefresh={(newChallenge) => {
            setDailyChallenge(newChallenge);
          }}
          onComplete={(updatedChallenge) => {
            setDailyChallenge(updatedChallenge);
            fetchData(); // Refresh tasks
          }}
        />
      )}

      {showObjectivesModal && (
        <ObjectivesAndChallengesModal
          objectives={activeObjectives}
          challenges={activeChallenges}
          onClose={() => setShowObjectivesModal(false)}
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
            fetchData(); // Reload data including diagnostic
          }}
        />
      )}

      {/* Competences Explication Modal */}
      {showCompetencesModal && (
        <CompetencesExplicationModal
          onClose={() => setShowCompetencesModal(false)}
        />
      )}

      {/* KPI Reporting Modal */}
      {showKPIReporting && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowKPIReporting(false)}>
          <div className="bg-white rounded-2xl w-full max-w-7xl max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <KPIReporting user={user} onBack={() => setShowKPIReporting(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
