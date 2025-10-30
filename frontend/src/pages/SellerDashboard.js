import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { LogOut, Plus, TrendingUp, Award, MessageSquare, Sparkles, BarChart3 } from 'lucide-react';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import EvaluationModal from '../components/EvaluationModal';
import DebriefModal from '../components/DebriefModal';
import KPIEntryModal from '../components/KPIEntryModal';
import KPIReporting from './KPIReporting';
import SellerProfileModal from '../components/SellerProfileModal';
import LastDebriefModal from '../components/LastDebriefModal';
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
  const [showLastDebriefModal, setShowLastDebriefModal] = useState(false);
  const [showDiagnosticFormModal, setShowDiagnosticFormModal] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const [evalsRes, salesRes, tasksRes, debriefsRes, competencesRes] = await Promise.all([
        axios.get(`${API}/evaluations`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/sales`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/seller/tasks`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/debriefs`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/competences/history`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      
      setEvaluations(evalsRes.data);
      setSales(salesRes.data);
      setTasks(tasksRes.data);
      setDebriefs(debriefsRes.data);
      setCompetencesHistory(competencesRes.data);
      
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
              onClick={() => setShowDiagnosticFormModal(true)}
              className="btn-secondary flex items-center gap-2"
            >
              <Sparkles className="w-5 h-5" />
              {diagnostic ? 'Refaire mon diagnostic' : 'Faire mon diagnostic'}
            </button>
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

        {/* Votre profil de vente - Version colorée */}
        {diagnostic && (
          <div className="glass-morphism rounded-2xl p-6 mb-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Votre profil de vente</h2>
            
            <div className="bg-gradient-to-r from-[#ffd871] to-yellow-300 rounded-xl p-4 shadow-lg">
              <button
                onClick={() => setDiagnosticExpanded(!diagnosticExpanded)}
                className="w-full flex items-start justify-between"
              >
                <div className="text-left">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-2xl">✨</span>
                    <h3 className="text-xl font-bold text-gray-800">Analyse initiale</h3>
                  </div>
                  <p className="text-sm text-gray-700">
                    {new Date(diagnostic.created_at).toLocaleDateString('fr-FR')}
                  </p>
                </div>
                <div className="text-gray-800 font-bold text-xl">
                  {diagnosticExpanded ? '−' : '+'}
                </div>
              </button>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                <div className="bg-white bg-opacity-70 rounded-lg p-3">
                  <p className="text-xs text-gray-600 mb-1">🎨 Ton style</p>
                  <p className="text-lg font-bold text-gray-800">{diagnostic.style}</p>
                </div>
                <div className="bg-white bg-opacity-70 rounded-lg p-3">
                  <p className="text-xs text-gray-600 mb-1">
                    {diagnostic.level === 'Explorateur' && '🟢'} 
                    {diagnostic.level === 'Challenger' && '🟡'}
                    {diagnostic.level === 'Ambassadeur' && '🟠'}
                    {diagnostic.level === 'Maître du Jeu' && '🔴'}
                    {!['Explorateur', 'Challenger', 'Ambassadeur', 'Maître du Jeu'].includes(diagnostic.level) && '🎯'}
                    {' '}Ton niveau
                  </p>
                  <p className="text-lg font-bold text-gray-800">{diagnostic.level}</p>
                </div>
                <div className="bg-white bg-opacity-70 rounded-lg p-3">
                  <p className="text-xs text-gray-600 mb-1">⚡ Ta motivation</p>
                  <p className="text-lg font-bold text-gray-800">{diagnostic.motivation}</p>
                </div>
              </div>
              
              {diagnosticExpanded && diagnostic.ai_profile_summary && (
                <div className="bg-white bg-opacity-70 rounded-lg p-4 mt-3 animate-fadeIn">
                  <p className="text-sm font-medium text-gray-900 mb-2 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    Ton profil analysé par l'IA
                  </p>
                  <p className="text-sm text-gray-800 whitespace-pre-line">{diagnostic.ai_profile_summary}</p>
                </div>
              )}
            </div>
          </div>
        )}

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
    </div>
  );
}
