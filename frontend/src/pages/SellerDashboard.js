import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { LogOut, Plus, TrendingUp, Award, MessageSquare, Sparkles } from 'lucide-react';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import EvaluationModal from '../components/EvaluationModal';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function SellerDashboard({ user, diagnostic, onLogout }) {
  const [evaluations, setEvaluations] = useState([]);
  const [sales, setSales] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [showEvalModal, setShowEvalModal] = useState(false);
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
      const [evalsRes, salesRes, tasksRes] = await Promise.all([
        axios.get(`${API}/evaluations`),
        axios.get(`${API}/sales`),
        axios.get(`${API}/seller/tasks`)
      ]);
      setEvaluations(evalsRes.data);
      setSales(salesRes.data);
      setTasks(tasksRes.data);
    } catch (err) {
      toast.error('Erreur de chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const handleEvaluationCreated = () => {
    fetchData();
    setShowEvalModal(false);
  };

  // Calculate average radar scores
  const avgRadarScores = evaluations.length > 0
    ? [
        { skill: 'Accueil', value: evaluations.reduce((sum, e) => sum + e.accueil, 0) / evaluations.length },
        { skill: 'Découverte', value: evaluations.reduce((sum, e) => sum + e.decouverte, 0) / evaluations.length },
        { skill: 'Argumentation', value: evaluations.reduce((sum, e) => sum + e.argumentation, 0) / evaluations.length },
        { skill: 'Closing', value: evaluations.reduce((sum, e) => sum + e.closing, 0) / evaluations.length },
        { skill: 'Fidélisation', value: evaluations.reduce((sum, e) => sum + e.fidelisation, 0) / evaluations.length }
      ]
    : [];

  // Calculate evolution data
  const evolutionData = evaluations.slice(0, 10).reverse().map((e, idx) => ({
    name: `E${idx + 1}`,
    score: ((e.accueil + e.decouverte + e.argumentation + e.closing + e.fidelisation) / 5).toFixed(1)
  }));

  const avgScore = evaluations.length > 0
    ? (evaluations.reduce((sum, e) => sum + (e.accueil + e.decouverte + e.argumentation + e.closing + e.fidelisation) / 5, 0) / evaluations.length).toFixed(2)
    : 0;

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
              data-testid="new-evaluation-button"
              onClick={() => setShowEvalModal(true)}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Nouvelle Évaluation
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
              <div className="w-12 h-12 bg-[#ffd871] bg-opacity-20 rounded-xl flex items-center justify-center">
                <Award className="w-6 h-6 text-gray-800" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Score Moyen</p>
                <p className="text-3xl font-bold text-gray-800">{avgScore}/5</p>
              </div>
            </div>
          </div>

          <div className="glass-morphism rounded-2xl p-6 card-hover">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Évaluations</p>
                <p className="text-3xl font-bold text-gray-800">{evaluations.length}</p>
              </div>
            </div>
          </div>

          <div className="glass-morphism rounded-2xl p-6 card-hover">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <MessageSquare className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Ventes</p>
                <p className="text-3xl font-bold text-gray-800">{sales.length}</p>
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
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Évolution</h2>
            {evolutionData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={evolutionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                  <XAxis dataKey="name" tick={{ fill: '#475569' }} />
                  <YAxis domain={[0, 5]} tick={{ fill: '#475569' }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="score" stroke="#ffd871" strokeWidth={3} dot={{ fill: '#ffd871', r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-12 text-gray-500">Aucune donnée disponible</div>
            )}
          </div>
        </div>

        {/* Recent Evaluations */}
        <div className="glass-morphism rounded-2xl p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Dernières Évaluations</h2>
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
              Aucune évaluation pour le moment. Créez votre première évaluation!
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
    </div>
  );
}
