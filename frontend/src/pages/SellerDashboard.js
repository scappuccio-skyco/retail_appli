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
import CompetencesExplicationModal from '../components/CompetencesExplicationModal';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function SellerDashboard({ user, diagnostic: initialDiagnostic, onLogout }) {
  const navigate = useNavigate();
  const [evaluations, setEvaluations] = useState([]);
  const [sales, setSales] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [debriefs, setDebriefs] = useState([]);
  const [competencesHistory, setCompetencesHistory] = useState([]);
  const [kpiEntries, setKpiEntries] = useState([]);
  const [diagnostic, setDiagnostic] = useState(initialDiagnostic);
  const [showEvalModal, setShowEvalModal] = useState(false);
  const [showDebriefModal, setShowDebriefModal] = useState(false);
  const [showKPIModal, setShowKPIModal] = useState(false);
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

  useEffect(() => {
    fetchData();
    fetchKpiConfig();
    fetchBilanIndividuel();
    fetchActiveChallenges();
    fetchActiveObjectives();
  }, []);

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

        {/* Active Challenges Section */}
        {/* Objectives & Challenges Section - Separated like Manager Dashboard */}
        {(activeObjectives.length > 0 || activeChallenges.length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Team Objectives Section (Left) */}
            {activeObjectives.length > 0 && (
              <div className="glass-morphism rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-6">
                  <Award className="w-6 h-6 text-purple-500" />
                  <h3 className="text-xl font-bold text-gray-800">🎯 Objectifs d'Équipe</h3>
                </div>

                <div className="space-y-4">
                  {activeObjectives.map((objective) => {
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
                        className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 border-2 border-purple-300 hover:shadow-lg transition-all"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <h4 className="font-bold text-gray-800 text-base line-clamp-2">{objective.title}</h4>
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
                        <div className="text-xs text-gray-600 mb-3">
                          📅 {new Date(objective.period_start).toLocaleDateString('fr-FR')} - {new Date(objective.period_end).toLocaleDateString('fr-FR')}
                        </div>

                        {/* Progress Bar */}
                        <div className="mb-3">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs text-gray-600">Progression</span>
                            <span className="text-xs font-bold text-gray-800">{Math.min(100, progressPercentage.toFixed(0))}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2.5">
                            <div 
                              className={`h-2.5 rounded-full transition-all ${
                                status === 'achieved' ? 'bg-gradient-to-r from-green-400 to-green-500' :
                                status === 'failed' ? 'bg-gradient-to-r from-red-400 to-red-500' :
                                'bg-gradient-to-r from-purple-400 to-pink-400'
                              }`}
                              style={{ width: `${Math.min(100, progressPercentage)}%` }}
                            ></div>
                          </div>
                        </div>

                        {/* Targets with Progress */}
                        <div className="space-y-1 mb-3">
                          {objective.ca_target && (
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-600">💰 CA:</span>
                              <span className="font-semibold text-gray-800">
                                {(objective.progress_ca || 0).toFixed(0)}€ / {objective.ca_target}€
                              </span>
                            </div>
                          )}
                          {objective.panier_moyen_target && (
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-600">🛒 Panier M.:</span>
                              <span className="font-semibold text-gray-800">
                                {(objective.progress_panier_moyen || 0).toFixed(1)}€ / {objective.panier_moyen_target}€
                              </span>
                            </div>
                          )}
                          {objective.indice_vente_target && (
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-600">💎 Indice:</span>
                              <span className="font-semibold text-gray-800">
                                {(objective.progress_indice_vente || 0).toFixed(1)} / {objective.indice_vente_target}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Time remaining */}
                        <div className="flex items-center gap-2 text-xs text-gray-600">
                          <span>⏰</span>
                          <span>
                            {daysRemaining > 0 ? `${daysRemaining} jour${daysRemaining > 1 ? 's' : ''} restant${daysRemaining > 1 ? 's' : ''}` : 'Se termine aujourd\'hui'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Challenges Section (Right) */}
            {activeChallenges.length > 0 && (
              <div className="glass-morphism rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-6">
                  <Award className="w-6 h-6 text-[#ffd871]" />
                  <h3 className="text-xl font-bold text-gray-800">🏆 Mes Challenges</h3>
                </div>

                <div className="space-y-4">
                  {activeChallenges.map((challenge) => {
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
                        className={`rounded-xl p-4 border-2 hover:shadow-lg transition-all ${
                          isPersonal 
                            ? 'bg-gradient-to-br from-purple-50 to-pink-50 border-purple-300' 
                            : 'bg-gradient-to-br from-amber-50 to-yellow-50 border-[#ffd871]'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <h4 className="font-bold text-gray-800 text-base line-clamp-2">{challenge.title}</h4>
                          <span className={`text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap ${
                            isPersonal 
                              ? 'bg-purple-100 text-purple-700' 
                              : 'bg-green-100 text-green-700'
                          }`}>
                            {isPersonal ? '👤 Personnel' : '🏆 Équipe'}
                          </span>
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
                              className={`h-2.5 rounded-full transition-all ${
                                isPersonal 
                                  ? 'bg-gradient-to-r from-purple-400 to-pink-400' 
                                  : 'bg-gradient-to-r from-[#ffd871] to-yellow-300'
                              }`}
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
                        <div className="flex items-center gap-2 text-xs text-gray-600">
                          <span>⏰</span>
                          <span>
                            {daysRemaining > 0 ? `${daysRemaining} jour${daysRemaining > 1 ? 's' : ''} restant${daysRemaining > 1 ? 's' : ''}` : 'Se termine aujourd\'hui'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
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

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Radar Chart */}
          <div className="glass-morphism rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-800">Compétences</h2>
              <button
                onClick={() => setShowCompetencesModal(true)}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
              >
                <span>ℹ️</span> Comprendre mes scores
              </button>
            </div>
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

        {/* Mes derniers KPIs enregistrés */}
        {kpiEntries.length > 0 && (
          <div className="glass-morphism rounded-2xl p-6 mt-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">📊 Mes derniers KPIs enregistrés</h2>
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
                    <button
                      onClick={() => {
                        setEditingKPI(entry);
                        setShowKPIModal(true);
                      }}
                      className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Modifier
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {kpiConfig?.track_ca && (
                      <div className="bg-blue-50 rounded-lg p-3">
                        <p className="text-xs text-blue-600 mb-1">💰 CA</p>
                        <p className="text-lg font-bold text-blue-900">{entry.ca_journalier?.toFixed(2)}€</p>
                      </div>
                    )}
                    {kpiConfig?.track_ventes && (
                      <div className="bg-green-50 rounded-lg p-3">
                        <p className="text-xs text-green-600 mb-1">🛒 Ventes</p>
                        <p className="text-lg font-bold text-green-900">{entry.nb_ventes}</p>
                      </div>
                    )}
                    {kpiConfig?.track_clients && (
                      <div className="bg-purple-50 rounded-lg p-3">
                        <p className="text-xs text-purple-600 mb-1">👥 Clients</p>
                        <p className="text-lg font-bold text-purple-900">{entry.nb_clients}</p>
                      </div>
                    )}
                    {kpiConfig?.track_articles && (
                      <div className="bg-orange-50 rounded-lg p-3">
                        <p className="text-xs text-orange-600 mb-1">📦 Articles</p>
                        <p className="text-lg font-bold text-orange-900">{entry.nb_articles || 0}</p>
                      </div>
                    )}
                    {kpiConfig?.track_ca && kpiConfig?.track_ventes && (
                      <div className="bg-indigo-50 rounded-lg p-3">
                        <p className="text-xs text-indigo-600 mb-1">🧮 Panier Moyen</p>
                        <p className="text-lg font-bold text-indigo-900">{entry.panier_moyen?.toFixed(2)}€</p>
                      </div>
                    )}
                    {kpiConfig?.track_ventes && kpiConfig?.track_clients && (
                      <div className="bg-pink-50 rounded-lg p-3">
                        <p className="text-xs text-pink-600 mb-1">📊 Taux Transfo</p>
                        <p className="text-lg font-bold text-pink-900">{entry.taux_transformation?.toFixed(2)}%</p>
                      </div>
                    )}
                    {kpiConfig?.track_articles && kpiConfig?.track_clients && (
                      <div className="bg-teal-50 rounded-lg p-3">
                        <p className="text-xs text-teal-600 mb-1">🎯 Indice Vente</p>
                        <p className="text-lg font-bold text-teal-900">{entry.indice_vente?.toFixed(2)}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            {/* Bouton Voir tous mes KPIs */}
            <div className="mt-6 text-center">
              <button
                onClick={() => setShowKPIReporting(true)}
                className="btn-primary inline-flex items-center gap-2"
              >
                <BarChart3 className="w-5 h-5" />
                Voir tous mes KPIs
              </button>
            </div>
          </div>
        )}

        {/* Mes derniers débriefs */}
        <div className="glass-morphism rounded-2xl p-6 mt-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">📝 Mes derniers Debriefs</h2>
          
          {debriefs.length > 0 ? (
            <>
              <div className="space-y-4">
                {debriefs.slice(0, showAllDebriefs ? debriefs.length : 3).map((debrief) => (
                  <div
                    key={debrief.id}
                    className="bg-gradient-to-r from-white to-blue-50 rounded-2xl border-2 border-blue-100 hover:shadow-lg transition-all overflow-hidden"
                  >
                    {/* Compact Header - Always Visible */}
                    <button
                      onClick={() => toggleDebrief(debrief.id)}
                      className="w-full p-5 text-left hover:bg-white hover:bg-opacity-50 transition-colors"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-3">
                            <span className="px-3 py-1 bg-blue-500 text-white text-xs font-bold rounded-full">
                              {new Date(debrief.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                            </span>
                            <span className="text-sm font-semibold text-gray-800">
                              {debrief.produit}
                            </span>
                            <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded">
                              {debrief.type_client}
                            </span>
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-start gap-2">
                              <span className="text-gray-400 text-sm mt-0.5">💬</span>
                              <p className="text-sm text-gray-700 line-clamp-2">{debrief.description_vente}</p>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-gray-600">
                              <span className="flex items-center gap-1">
                                <span>📍</span> {debrief.moment_perte_client}
                              </span>
                              <span className="flex items-center gap-1">
                                <span>❌</span> {debrief.raisons_echec}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="ml-4 flex-shrink-0">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg transition-all ${
                            expandedDebriefs[debrief.id] 
                              ? 'bg-blue-500 text-white' 
                              : 'bg-blue-100 text-blue-600'
                          }`}>
                            {expandedDebriefs[debrief.id] ? '−' : '+'}
                          </div>
                        </div>
                      </div>
                    </button>

                    {/* AI Analysis - Expandable */}
                    {expandedDebriefs[debrief.id] && (
                      <div className="px-5 pb-5 space-y-3 bg-white border-t-2 border-blue-100 pt-4 animate-fadeIn">
                        {/* Analyse */}
                        <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl p-4 border-l-4 border-blue-500">
                          <p className="text-sm font-bold text-blue-900 mb-2 flex items-center gap-2">
                            <span className="text-lg">💬</span> Analyse
                          </p>
                          <p className="text-sm text-blue-800 whitespace-pre-line leading-relaxed">{debrief.ai_analyse}</p>
                        </div>

                        {/* Points à travailler */}
                        <div className="bg-gradient-to-r from-orange-50 to-orange-100 rounded-xl p-4 border-l-4 border-orange-500">
                          <p className="text-sm font-bold text-orange-900 mb-2 flex items-center gap-2">
                            <span className="text-lg">🎯</span> Points à travailler
                          </p>
                          <p className="text-sm text-orange-800 whitespace-pre-line leading-relaxed">{debrief.ai_points_travailler}</p>
                        </div>

                        {/* Recommandation */}
                        <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-xl p-4 border-l-4 border-green-500">
                          <p className="text-sm font-bold text-green-900 mb-2 flex items-center gap-2">
                            <span className="text-lg">🚀</span> Recommandation
                          </p>
                          <p className="text-sm text-green-800 whitespace-pre-line leading-relaxed">{debrief.ai_recommandation}</p>
                        </div>

                        {/* Exemple concret */}
                        <div className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-xl p-4 border-l-4 border-purple-500">
                          <p className="text-sm font-bold text-purple-900 mb-2 flex items-center gap-2">
                            <span className="text-lg">💡</span> Exemple concret
                          </p>
                          <p className="text-sm text-purple-800 italic whitespace-pre-line leading-relaxed">{debrief.ai_exemple_concret}</p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              
              {/* Load More Button - même style que KPI */}
              {debriefs.length > 3 && !showAllDebriefs && (
                <div className="mt-6 text-center">
                  <button
                    onClick={() => setShowAllDebriefs(true)}
                    className="btn-primary inline-flex items-center gap-2"
                  >
                    <MessageSquare className="w-5 h-5" />
                    Voir tous mes débriefs ({debriefs.length - 3} de plus)
                  </button>
                </div>
              )}
              
              {showAllDebriefs && debriefs.length > 3 && (
                <div className="mt-6 text-center">
                  <button
                    onClick={() => setShowAllDebriefs(false)}
                    className="btn-primary inline-flex items-center gap-2"
                  >
                    Voir moins
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">💬</div>
              <p className="text-gray-500 font-medium">Aucun débrief pour le moment</p>
              <p className="text-gray-400 text-sm mt-2">Analysez votre première vente non conclue !</p>
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
    </div>
  );
}
