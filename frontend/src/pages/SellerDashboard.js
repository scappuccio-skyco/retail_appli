import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { LogOut, Plus, TrendingUp, Award, MessageSquare, Sparkles, BarChart3 } from 'lucide-react';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import EvaluationModal from '../components/EvaluationModal';
import DebriefModal from '../components/DebriefModal';
import KPIEntryModal from '../components/KPIEntryModal';
import KPIReporting from './KPIReporting';

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

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [evalsRes, salesRes, tasksRes, debriefsRes, competencesRes, kpiRes] = await Promise.all([
        axios.get(`${API}/evaluations`),
        axios.get(`${API}/sales`),
        axios.get(`${API}/seller/tasks`),
        axios.get(`${API}/debriefs`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        }),
        axios.get(`${API}/competences/history`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        }),
        axios.get(`${API}/kpi/entries`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        })
      ]);
      setEvaluations(evalsRes.data);
      setSales(salesRes.data);
      setTasks(tasksRes.data);
      setDebriefs(debriefsRes.data);
      setCompetencesHistory(competencesRes.data);
      setKpiEntries(kpiRes.data);
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

  // Calculate evolution data from competences history
  const evolutionData = competencesHistory.map((entry, idx) => {
    const date = new Date(entry.date);
    return {
      name: date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
      Accueil: entry.score_accueil,
      Découverte: entry.score_decouverte,
      Argumentation: entry.score_argumentation,
      Closing: entry.score_closing,
      Fidélisation: entry.score_fidelisation
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

        {/* Diagnostic Profile Card */}
        {diagnostic && (
          <div className="glass-morphism rounded-2xl p-6 mb-8 border-2 border-[#ffd871]">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2 flex items-center gap-2">
                  <Sparkles className="w-6 h-6 text-[#ffd871]" />
                  Ton Profil Vendeur
                </h2>
                <div className="flex gap-6 mt-4">
                  <div>
                    <p className="text-sm text-gray-600">Style</p>
                    <p className="text-lg font-bold text-gray-800">{diagnostic.style}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Niveau</p>
                    <p className="text-lg font-bold text-gray-800">{diagnostic.level}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Motivation</p>
                    <p className="text-lg font-bold text-gray-800">{diagnostic.motivation}</p>
                  </div>
                </div>
              </div>
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

          {/* Evolution Chart */}
          <div className="glass-morphism rounded-2xl p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Évolution des Compétences</h2>
            {evolutionData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={evolutionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                  <XAxis dataKey="name" tick={{ fill: '#475569', fontSize: 12 }} />
                  <YAxis domain={[0, 5]} tick={{ fill: '#475569' }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="Accueil" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="Découverte" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="Argumentation" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="Closing" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="Fidélisation" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-12 text-gray-500">Complète ton diagnostic pour voir ton évolution</div>
            )}
          </div>
        </div>

        {/* Recent Evaluations */}
        <div className="glass-morphism rounded-2xl p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Dernières Évaluations</h2>
          
          {/* Diagnostic Result Card (if exists) */}
          {diagnostic && (
            <div className="bg-gradient-to-r from-[#ffd871] to-yellow-300 rounded-xl p-6 mb-4 shadow-lg">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">✨</span>
                    <h3 className="text-xl font-bold text-gray-800">Diagnostic Vendeur Avancé</h3>
                  </div>
                  <p className="text-sm text-gray-700">
                    {new Date(diagnostic.created_at).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                <div className="bg-white bg-opacity-70 rounded-lg p-3">
                  <p className="text-xs text-gray-600 mb-1">Ton style</p>
                  <p className="text-lg font-bold text-gray-800">{diagnostic.style}</p>
                </div>
                <div className="bg-white bg-opacity-70 rounded-lg p-3">
                  <p className="text-xs text-gray-600 mb-1">Ton niveau</p>
                  <p className="text-lg font-bold text-gray-800">{diagnostic.level}</p>
                </div>
                <div className="bg-white bg-opacity-70 rounded-lg p-3">
                  <p className="text-xs text-gray-600 mb-1">Ta motivation</p>
                  <p className="text-lg font-bold text-gray-800">{diagnostic.motivation}</p>
                </div>
              </div>
              
              {diagnostic.ai_profile_summary && (
                <div className="bg-white bg-opacity-70 rounded-lg p-4">
                  <p className="text-sm font-medium text-gray-900 mb-2 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    Ton profil analysé par l'IA
                  </p>
                  <p className="text-sm text-gray-800 whitespace-pre-line">{diagnostic.ai_profile_summary}</p>
                </div>
              )}
            </div>
          )}
          
          {evaluations.length > 0 ? (
            <div className="space-y-4">
              {evaluations.slice(0, 5).map((evaluation) => (
                <div
                  key={evaluation.id}
                  data-testid={`evaluation-${evaluation.id}`}
                  className="bg-white rounded-xl p-6 border border-gray-200 hover:shadow-md transition-all"
                >
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                    <div>
                      <p className="text-sm text-gray-500 mb-1">
                        {new Date(evaluation.created_at).toLocaleDateString('fr-FR')}
                      </p>
                      <div className="flex gap-4 text-sm">
                        <span className="font-medium">Accueil: {evaluation.accueil}/5</span>
                        <span className="font-medium">Découverte: {evaluation.decouverte}/5</span>
                        <span className="font-medium">Argumentation: {evaluation.argumentation}/5</span>
                        <span className="font-medium">Closing: {evaluation.closing}/5</span>
                        <span className="font-medium">Fidélisation: {evaluation.fidelisation}/5</span>
                      </div>
                    </div>
                  </div>
                  {evaluation.ai_feedback && (
                    <div className="bg-[#ffd871] bg-opacity-10 rounded-lg p-4 border-l-4 border-[#ffd871]">
                      <p className="text-sm font-medium text-gray-900 mb-1">Feedback AI</p>
                      <p className="text-sm text-gray-800">{evaluation.ai_feedback}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              {diagnostic ? "Aucune évaluation de vente pour le moment. Créez votre première évaluation!" : "Aucune évaluation pour le moment. Créez votre première évaluation!"}
            </div>
          )}
        </div>

        {/* Derniers débriefs */}
        <div className="glass-morphism rounded-2xl p-6 mt-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">📝 Derniers débriefs</h2>
          
          {debriefs.length > 0 ? (
            <div className="space-y-6">
              {debriefs.slice(0, 5).map((debrief) => (
                <div
                  key={debrief.id}
                  className="bg-white rounded-xl p-6 border border-gray-200 hover:shadow-md transition-all"
                >
                  {/* Header */}
                  <div className="border-b border-gray-100 pb-3 mb-4">
                    <p className="text-sm text-gray-500 mb-2">
                      🗓️ {new Date(debrief.created_at).toLocaleDateString('fr-FR')} — Produit : {debrief.produit} — Type de client : {debrief.type_client}
                    </p>
                    <div className="space-y-1 text-sm text-gray-600">
                      <p>💬 Description : {debrief.description_vente}</p>
                      <p>📍 Moment clé : {debrief.moment_perte_client}</p>
                      <p>❌ Raisons évoquées : {debrief.raisons_echec}</p>
                    </div>
                  </div>

                  {/* AI Analysis */}
                  <div className="space-y-4">
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
                </div>
              ))}
            </div>
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
          onSuccess={() => {
            setShowDebriefModal(false);
            fetchData();
          }}
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
