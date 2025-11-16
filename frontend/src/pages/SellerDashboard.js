import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { LogOut, Plus, TrendingUp, Award, MessageSquare, Sparkles, BarChart3, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import EvaluationModal from '../components/EvaluationModal';
import DebriefModal from '../components/DebriefModal';
import DebriefHistoryModal from '../components/DebriefHistoryModal';
import KPIEntryModal from '../components/KPIEntryModal';
import KPIHistoryModal from '../components/KPIHistoryModal';
import KPIReporting from './KPIReporting';
import SellerProfileModal from '../components/SellerProfileModal';
import BilanIndividuelModal from '../components/BilanIndividuelModal';
import DiagnosticFormScrollable from '../components/DiagnosticFormScrollable';
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
  const [challengeStats, setChallengeStats] = useState(null);
  const [loadingChallenge, setLoadingChallenge] = useState(false);
  const [showEvalModal, setShowEvalModal] = useState(false);
  const [showDebriefModal, setShowDebriefModal] = useState(false);
  const [showDebriefHistoryModal, setShowDebriefHistoryModal] = useState(false);
  const [autoExpandDebriefId, setAutoExpandDebriefId] = useState(null);
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
    return saved ? JSON.parse(saved) : ['profile', 'bilan', 'objectives', 'competences', 'kpi', 'debriefs'];
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

  // Recalculate weekly KPI when kpiEntries change (automatic daily update)
  useEffect(() => {
    if (kpiEntries.length > 0 && currentWeekOffset === 0) {
      // Only auto-update for current week
      fetchBilanIndividuel(0);
    }
  }, [kpiEntries]);

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
      
      // Fetch challenge stats
      const statsRes = await axios.get(`${API}/seller/daily-challenge/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setChallengeStats(statsRes.data);
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

  const fetchDebriefs = async () => {
    try {
      const token = localStorage.getItem('token');
      const debriefsRes = await axios.get(`${API}/debriefs`, { headers: { Authorization: `Bearer ${token}` } });
      setDebriefs(debriefsRes.data);
    } catch (error) {
      console.error('Error fetching debriefs:', error);
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

  const calculateWeeklyKPI = (startDate, endDate, allKpiEntries) => {
    // Convertir les dates string en objets Date pour comparaison
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Filtrer les KPI de la semaine
    const weekKPIs = allKpiEntries.filter(entry => {
      const entryDate = new Date(entry.date);
      return entryDate >= start && entryDate <= end;
    });

    console.log('Calculating KPI for week:', { startDate, endDate, weekKPIsCount: weekKPIs.length });

    // Calculer les totaux et moyennes
    const kpi_resume = {
      ca_total: 0,
      ventes: 0,
      articles: 0,
      prospects: 0,
      panier_moyen: 0,
      taux_transformation: 0,
      indice_vente: 0
    };

    if (weekKPIs.length > 0) {
      weekKPIs.forEach(entry => {
        kpi_resume.ca_total += entry.ca_journalier || 0;
        kpi_resume.ventes += entry.nb_ventes || 0;
        kpi_resume.articles += entry.nb_articles || 0;
        kpi_resume.prospects += entry.nb_prospects || 0;
      });

      // Calculer les moyennes
      if (kpi_resume.ventes > 0) {
        kpi_resume.panier_moyen = kpi_resume.ca_total / kpi_resume.ventes;
      }
      
      if (kpi_resume.ventes > 0) {
        kpi_resume.indice_vente = kpi_resume.articles / kpi_resume.ventes;
      }

      // Calculer le taux de transformation
      if (kpi_resume.prospects > 0) {
        kpi_resume.taux_transformation = (kpi_resume.ventes / kpi_resume.prospects) * 100;
      }
    }

    console.log('Calculated KPI resume:', kpi_resume);
    return kpi_resume;
  };

  const fetchBilanForWeek = async (startDate, endDate, periode) => {
    try {
      const token = localStorage.getItem('token');
      
      // 1. D'abord récupérer tous les KPI du vendeur
      const kpiRes = await axios.get(`${API}/seller/kpi-entries`, { headers: { Authorization: `Bearer ${token}` } });
      const allKpiEntries = kpiRes.data || [];
      
      console.log('All KPI entries loaded:', allKpiEntries.length);
      
      // 2. Calculer automatiquement les KPI de la semaine
      const kpi_resume = calculateWeeklyKPI(startDate, endDate, allKpiEntries);
      
      // 3. Chercher si un bilan IA existe pour cette semaine
      const res = await axios.get(`${API}/seller/bilan-individuel/all`, { headers: { Authorization: `Bearer ${token}` } });
      let existingBilan = null;
      
      if (res.data.status === 'success' && res.data.bilans) {
        existingBilan = res.data.bilans.find(b => b.periode === periode);
      }

      // 4. Créer l'objet bilan avec KPI calculés + analyse IA si disponible
      if (existingBilan) {
        // Bilan IA existe : on garde l'analyse mais on met à jour les KPI avec les calculs actuels
        setBilanIndividuel({
          ...existingBilan,
          kpi_resume, // KPI recalculés automatiquement
          periode
        });
      } else {
        // Pas de bilan IA : on affiche juste les KPI calculés
        setBilanIndividuel({
          periode,
          kpi_resume,
          synthese: '',
          points_forts: [],
          points_attention: [],
          recommandations: [],
          competences_cles: []
        });
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

  const fetchBilanIndividuel = async (offset = 0) => {
    try {
      const weekDates = getWeekDates(offset);
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
            <img src="/logo-retail-performer-blue.png" alt="Retail Performer AI" className="h-14 object-contain" />
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-[#1E40AF] mb-2">
                Bonjour, {user.name}!
              </h1>
              <p className="text-gray-600">Suivez vos performances et progressez chaque jour</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-6 py-2.5 bg-white border-2 border-purple-500 text-purple-600 font-semibold rounded-xl hover:bg-purple-50 hover:shadow-md transition-all group"
              title="Personnaliser l'affichage du dashboard"
            >
              <svg className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="hidden sm:inline">Personnaliser</span>
            </button>
            <button
              data-testid="logout-button"
              onClick={onLogout}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border-2 border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 hover:shadow-md transition-all"
              title="Se déconnecter"
            >
              <LogOut className="w-5 h-5" />
              <span className="hidden sm:inline">Déconnexion</span>
            </button>
          </div>
        </div>
      </div>

      {/* Dashboard Filters Bar */}
      {showFilters && (
        <div className="max-w-7xl mx-auto mb-6 animate-fadeIn">
          <div className="bg-gradient-to-br from-purple-50 via-pink-50 to-white rounded-2xl p-6 border-2 border-purple-200 shadow-lg">
            <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-800">Personnalisation du Dashboard</h3>
                  <p className="text-sm text-gray-600">Adaptez votre espace à vos besoins</p>
                </div>
              </div>
              
              {/* Quick stats */}
              <div className="flex items-center gap-2 bg-white rounded-xl px-4 py-2 border border-purple-200">
                <div className="w-2 h-2 bg-[#10B981] rounded-full animate-pulse"></div>
                <span className="text-sm font-semibold text-gray-700">
                  {Object.values(dashboardFilters).filter(v => v === true).length} sections actives
                </span>
              </div>
            </div>

            {/* Filter Toggles */}
            <div>
              <p className="text-sm font-bold text-purple-900 mb-4 flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-purple-500 rounded-full"></span>
                Afficher / Masquer les sections
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
                <button
                  onClick={() => toggleFilter('showProfile')}
                  className={`px-4 py-3 rounded-xl font-medium transition-all transform hover:scale-105 ${
                    dashboardFilters.showProfile
                      ? 'bg-gradient-to-br from-green-400 to-green-500 text-white shadow-md'
                      : 'bg-white border-2 border-gray-200 text-gray-600 hover:border-green-300'
                  }`}
                >
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-xl">👤</span>
                    <span className="text-xs font-semibold">Profil</span>
                  </div>
                </button>

                <button
                  onClick={() => toggleFilter('showBilan')}
                  className={`px-4 py-3 rounded-xl font-medium transition-all transform hover:scale-105 ${
                    dashboardFilters.showBilan
                      ? 'bg-gradient-to-br from-green-400 to-green-500 text-white shadow-md'
                      : 'bg-white border-2 border-gray-200 text-gray-600 hover:border-green-300'
                  }`}
                >
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-xl">📈</span>
                    <span className="text-xs font-semibold">Bilan</span>
                  </div>
                </button>

                <button
                  onClick={() => toggleFilter('showObjectives')}
                  className={`px-4 py-3 rounded-xl font-medium transition-all transform hover:scale-105 ${
                    dashboardFilters.showObjectives
                      ? 'bg-gradient-to-br from-green-400 to-green-500 text-white shadow-md'
                      : 'bg-white border-2 border-gray-200 text-gray-600 hover:border-green-300'
                  }`}
                >
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-xl">🎯</span>
                    <span className="text-xs font-semibold">Objectifs</span>
                  </div>
                </button>

                <button
                  onClick={() => toggleFilter('showCompetences')}
                  className={`px-4 py-3 rounded-xl font-medium transition-all transform hover:scale-105 ${
                    dashboardFilters.showCompetences
                      ? 'bg-gradient-to-br from-green-400 to-green-500 text-white shadow-md'
                      : 'bg-white border-2 border-gray-200 text-gray-600 hover:border-green-300'
                  }`}
                >
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-xl">🤖</span>
                    <span className="text-xs font-semibold">Mon Coach IA</span>
                  </div>
                </button>

                <button
                  onClick={() => toggleFilter('showKPI')}
                  className={`px-4 py-3 rounded-xl font-medium transition-all transform hover:scale-105 ${
                    dashboardFilters.showKPI
                      ? 'bg-gradient-to-br from-green-400 to-green-500 text-white shadow-md'
                      : 'bg-white border-2 border-gray-200 text-gray-600 hover:border-green-300'
                  }`}
                >
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-xl">📊</span>
                    <span className="text-xs font-semibold">KPI</span>
                  </div>
                </button>

                <button
                  onClick={() => toggleFilter('showDebriefs')}
                  className={`px-4 py-3 rounded-xl font-medium transition-all transform hover:scale-105 ${
                    dashboardFilters.showDebriefs
                      ? 'bg-gradient-to-br from-green-400 to-green-500 text-white shadow-md'
                      : 'bg-white border-2 border-gray-200 text-gray-600 hover:border-green-300'
                  }`}
                >
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-xl">📊</span>
                    <span className="text-xs font-semibold">Analyse de vente</span>
                  </div>
                </button>
              </div>

              {/* Section Reordering */}
              <div className="mt-6 pt-6 border-t-2 border-purple-100">
                <p className="text-sm font-bold text-purple-900 mb-4 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-purple-500 rounded-full"></span>
                  Réorganiser l'ordre des sections
                </p>
                <div className="space-y-2">
                  {sectionOrder.map((sectionId, index) => {
                    const sectionNames = {
                      profile: '👤 Profil de Vente',
                      bilan: '📈 Bilan Individuel',
                      objectives: '🎯 Objectifs & Challenges',
                      competences: '🤖 Mon Coach IA',
                      kpi: '📊 Mes KPI',
                      debriefs: '📝 Analyse de Vente'
                    };
                    return (
                      <div key={sectionId} className="flex items-center justify-between bg-white rounded-xl p-4 border-2 border-gray-200 hover:border-purple-300 transition-all shadow-sm">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-bold text-gray-400">#{index + 1}</span>
                          <span className="font-semibold text-gray-800">{sectionNames[sectionId]}</span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => moveSectionUp(sectionId)}
                            disabled={index === 0}
                            className={`p-2 rounded-lg transition-all ${
                              index === 0
                                ? 'bg-gray-50 text-gray-300 cursor-not-allowed'
                                : 'bg-purple-100 text-purple-600 hover:bg-purple-200 hover:shadow-md'
                            }`}
                            title="Monter"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                            </svg>
                          </button>
                          <button
                            onClick={() => moveSectionDown(sectionId)}
                            disabled={index === sectionOrder.length - 1}
                            className={`p-2 rounded-lg transition-all ${
                              index === sectionOrder.length - 1
                                ? 'bg-gray-50 text-gray-300 cursor-not-allowed'
                                : 'bg-purple-100 text-purple-600 hover:bg-purple-200 hover:shadow-md'
                            }`}
                            title="Descendre"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        <div className="glass-morphism rounded-2xl p-3 mb-6 border-2 border-[#ffd871]">
          <h2 className="text-lg font-bold text-gray-800 mb-2">Mes tâches à faire</h2>
          
          {tasks.length > 0 ? (
            <div className="space-y-1.5">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="bg-white rounded-lg p-2 border border-gray-200 hover:shadow-md transition-all cursor-pointer"
                  onClick={() => {
                    if (task.type === 'diagnostic') {
                      // Si pas de diagnostic, ouvrir le formulaire pour le faire
                      if (!diagnostic) {
                        setShowDiagnosticFormModal(true);
                      } else {
                        setShowDiagnosticModal(true);
                      }
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
                      <span className="text-xl">{task.icon}</span>
                      <div className="flex-1">
                        <h3 className="text-sm font-semibold text-gray-800">{task.title}</h3>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
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
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4 text-center border-2 border-green-200">
              <div className="text-4xl mb-2">🎉</div>
              <h3 className="text-lg font-bold text-green-800 mb-1">Bravo !</h3>
              <p className="text-green-700 text-sm">Tu as rempli toutes tes tâches du jour !</p>
              <p className="text-[#10B981] text-xs mt-1">Continue comme ça, tu es au top ! 💪</p>
            </div>
          )}
        </div>

        {/* Grid 2x2 for all cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        
        {/* Profile & Bilan - Visual Cards */}
            {/* Profile Card - Visual */}
            {dashboardFilters.showProfile && (
            <div 
              onClick={() => diagnostic ? setShowProfileModal(true) : setShowDiagnosticFormModal(true)}
              className="glass-morphism rounded-2xl overflow-hidden cursor-pointer group hover:shadow-2xl transition-all duration-300 border-2 border-transparent hover:border-[#ffd871]"
            >
              <div className="relative h-48 overflow-hidden">
                <img 
                  src="https://images.unsplash.com/photo-1556761175-b413da4baf72?w=800&h=400&fit=crop" 
                  alt="Mon Profil de Vente"
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-purple-900/70 via-pink-900/70 to-red-900/70 group-hover:from-purple-900/60 group-hover:via-pink-900/60 group-hover:to-red-900/60 transition-all"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center text-white px-4">
                    <div className="w-16 h-16 bg-white bg-opacity-30 rounded-full mx-auto mb-3 flex items-center justify-center backdrop-blur-sm">
                      <Sparkles className="w-8 h-8" />
                    </div>
                    <h3 className="text-2xl font-bold">Mon Profil de Vente</h3>
                    {diagnostic ? (
                      <p className="text-sm mt-2 opacity-90">Cliquer pour voir les détails →</p>
                    ) : (
                      <p className="text-sm mt-2 opacity-90">Complétez votre diagnostic pour découvrir votre profil →</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Bilan Individuel Card - Visual */}
          {bilanIndividuel && dashboardFilters.showBilan && (
            <div 
              onClick={() => setShowBilanModal(true)}
              className="glass-morphism rounded-2xl overflow-hidden cursor-pointer group hover:shadow-2xl transition-all duration-300 border-2 border-transparent hover:border-[#ffd871]"
            >
              <div className="relative h-48 overflow-hidden">
                <img 
                  src="https://images.unsplash.com/photo-1608222351212-18fe0ec7b13b?w=800&h=400&fit=crop" 
                  alt="Mon Bilan Individuel"
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-blue-900/70 to-teal-900/70 group-hover:from-blue-900/60 group-hover:to-teal-900/60 transition-all"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center text-white">
                    <div className="w-16 h-16 bg-white bg-opacity-30 rounded-full mx-auto mb-3 flex items-center justify-center backdrop-blur-sm">
                      <TrendingUp className="w-8 h-8" />
                    </div>
                    <h2 className="text-2xl font-bold">🤖 Mon Bilan Individuel</h2>
                    <p className="text-sm mt-2 opacity-90">Voir mes KPI hebdomadaires →</p>
                  </div>
                </div>
              </div>
            </div>
          )}

        {/* Objectives and Challenges Card */}
        {(dashboardFilters.showObjectives || dashboardFilters.showChallenges) && (
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
                <div className="text-center text-white px-4">
                  <div className="w-16 h-16 bg-white bg-opacity-30 rounded-full mx-auto mb-3 flex items-center justify-center backdrop-blur-sm">
                    <Award className="w-8 h-8" />
                  </div>
                  <h2 className="text-2xl font-bold">🎯 Objectifs et Challenges</h2>
                  {(activeObjectives.length > 0 || activeChallenges.length > 0) ? (
                    <p className="text-sm mt-2 opacity-90">
                      {activeObjectives.length} objectifs • {activeChallenges.length} challenges
                    </p>
                  ) : (
                    <p className="text-sm mt-2 opacity-90">
                      Aucun objectif actif pour le moment
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Mon Coach IA Card */}
        {dashboardFilters.showCompetences && dailyChallenge && (
          <div 
            onClick={() => setShowDailyChallengeModal(true)}
            className={`glass-morphism rounded-2xl overflow-hidden cursor-pointer group hover:shadow-2xl transition-all duration-300 border-2 ${
              dailyChallenge.completed 
                ? 'border-green-400' 
                : 'border-transparent hover:border-[#ffd871]'
            }`}
          >
            <div className="relative h-48 overflow-hidden">
              <img 
                src="https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&h=400&fit=crop" 
                alt="Mon Coach IA"
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-purple-900/70 via-indigo-900/70 to-blue-900/70 group-hover:from-purple-900/60 group-hover:via-indigo-900/60 group-hover:to-blue-900/60 transition-all"></div>
              
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center text-white px-4">
                  <div className="w-16 h-16 bg-white bg-opacity-30 rounded-full mx-auto mb-3 flex items-center justify-center backdrop-blur-sm">
                    <Award className="w-8 h-8" />
                  </div>
                  <h2 className="text-2xl font-bold">🤖 Mon Coach IA</h2>
                  <p className="text-sm mt-2 opacity-90">Prêt à relever une mission ?</p>
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

        {/* Analyse de vente Card */}
        {dashboardFilters.showDebriefs && (
          <div 
            onClick={() => setShowDebriefHistoryModal(true)}
            className="glass-morphism rounded-2xl overflow-hidden cursor-pointer group hover:shadow-2xl transition-all duration-300 border-2 border-transparent hover:border-[#ffd871]"
          >
            <div className="relative h-48 overflow-hidden">
              <img 
                src="https://images.unsplash.com/photo-1746021375306-9dec0f637732?w=800&h=400&fit=crop" 
                alt="Analyse de vente"
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-green-900/70 to-teal-900/70 group-hover:from-green-900/60 group-hover:to-teal-900/60 transition-all"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center text-white">
                  <div className="w-16 h-16 bg-white bg-opacity-30 rounded-full mx-auto mb-3 flex items-center justify-center backdrop-blur-sm">
                    <MessageSquare className="w-8 h-8" />
                  </div>
                  <h2 className="text-2xl font-bold">📊 Analyse de vente</h2>
                  <p className="text-sm mt-2 opacity-90">Reçois un coaching immédiat pour progresser →</p>
                </div>
              </div>
            </div>
          </div>
        )}

        </div>
        {/* End of Grid 2x2 */}

      </div>
      {/* End of max-w-7xl container */}

      {/* MODALS */}
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
          onClose={() => setShowDebriefHistoryModal(false)}
          onSuccess={(newDebrief) => {
            // Fermer d'abord (comme DiagnosticFormScrollable)
            setShowDebriefHistoryModal(false);
            // Puis rafraîchir
            fetchDebriefs();
            // Rouvrir le même modal après 500ms pour afficher le résultat
            setTimeout(() => {
              setShowDebriefHistoryModal(true);
            }, 500);
          }}
          token={localStorage.getItem('token')}
        />
      )}

      {showKPIModal && (
        <KPIEntryModal
          onClose={() => {
            setShowKPIModal(false);
            setEditingKPI(null);
          }}
          onSuccess={async () => {
            setShowKPIModal(false);
            setEditingKPI(null);
            await fetchData(); // Recharger les KPI
            refreshCompetenceScores(); // Refresh scores after KPI entry
            // Recalculer automatiquement les KPI de la semaine actuelle
            fetchBilanIndividuel(0);
            toast.success('📊 KPI enregistré ! Les totaux hebdomadaires sont mis à jour.');
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
          onOpenHistory={() => {
            setShowDailyChallengeModal(false);
            setShowChallengeHistoryModal(true);
          }}
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
          kpiEntries={kpiEntries}
          currentWeekOffset={currentWeekOffset}
          onWeekChange={(offset) => {
            setCurrentWeekOffset(offset);
            fetchBilanIndividuel(offset);
          }}
          onRegenerate={regenerateBilan}
          generatingBilan={generatingBilan}
          onClose={() => setShowBilanModal(false)}
        />
      )}

      {/* Diagnostic Form Modal */}
      {showDiagnosticFormModal && (
        <DiagnosticFormScrollable
          isModal={true}
          onClose={() => setShowDiagnosticFormModal(false)}
          onComplete={() => {
            setShowDiagnosticFormModal(false);
            fetchData(); // Reload data including diagnostic
            // Ouvrir automatiquement le modal de profil après avoir terminé le diagnostic
            setTimeout(() => {
              setShowProfileModal(true);
            }, 500);
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
