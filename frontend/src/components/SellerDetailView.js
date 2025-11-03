import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { ArrowLeft, TrendingUp, Award, MessageSquare, BarChart3, Calendar, RefreshCw } from 'lucide-react';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import ConflictResolutionForm from './ConflictResolutionForm';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function SellerDetailView({ seller, onBack }) {
  const [diagnostic, setDiagnostic] = useState(null);
  const [debriefs, setDebriefs] = useState([]);
  const [competencesHistory, setCompetencesHistory] = useState([]);
  const [liveCompetences, setLiveCompetences] = useState(null); // NEW: Live scores for current radar
  const [kpiEntries, setKpiEntries] = useState([]);
  const [kpiConfig, setKpiConfig] = useState(null); // NEW: Manager's KPI configuration
  const [loading, setLoading] = useState(true);
  const [expandedDebriefs, setExpandedDebriefs] = useState({});
  const [activeTab, setActiveTab] = useState('competences'); // New state for tabs
  const [showAllDebriefs, setShowAllDebriefs] = useState(false); // New state for debriefs display
  const [kpiFilter, setKpiFilter] = useState('7j'); // New state for KPI filter: '7j', '30j', 'tout'
  const [showConflictModal, setShowConflictModal] = useState(false); // New state for conflict modal
  const [visibleCharts, setVisibleCharts] = useState({
    ca: true,
    ventes: true,
    clients: true,
    articles: true,
    ventesVsClients: true,
    panierMoyen: true,
    tauxTransfo: true,
    indiceVente: true
  }); // New state for chart visibility toggles

  useEffect(() => {
    fetchSellerData();
  }, [seller.id]);

  const fetchSellerData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const [statsRes, diagRes, debriefsRes, competencesRes, kpiRes, kpiConfigRes] = await Promise.all([
        axios.get(`${API}/manager/seller/${seller.id}/stats`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/diagnostic/seller/${seller.id}`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/manager/debriefs/${seller.id}`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/manager/competences-history/${seller.id}`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/manager/kpi-entries/${seller.id}?days=30`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/manager/kpi-config`, { headers: { Authorization: `Bearer ${token}` } })
      ]);

      // Extract LIVE scores from stats endpoint (harmonized with manager overview)
      const statsData = statsRes.data;
      const liveScores = statsData.avg_radar_scores || {
        accueil: 0,
        decouverte: 0,
        argumentation: 0,
        closing: 0,
        fidelisation: 0
      };
      
      // Set live scores for current radar chart (consistent with manager overview)
      setLiveCompetences({
        type: "live",
        date: new Date().toISOString(),
        score_accueil: liveScores.accueil,
        score_decouverte: liveScores.decouverte,
        score_argumentation: liveScores.argumentation,
        score_closing: liveScores.closing,
        score_fidelisation: liveScores.fidelisation
      });
      
      setDiagnostic(diagRes.data);
      setDebriefs(debriefsRes.data);
      setCompetencesHistory(competencesRes.data); // Keep historical data for evolution chart
      setKpiEntries(kpiRes.data);
      setKpiConfig(kpiConfigRes.data); // Store manager's KPI configuration
      
      // Debug: Log KPI configuration
      console.log('📊 KPI Configuration loaded:', kpiConfigRes.data);
      console.log('✅ track_ca:', kpiConfigRes.data?.track_ca);
      console.log('✅ track_ventes:', kpiConfigRes.data?.track_ventes);
      console.log('✅ track_clients:', kpiConfigRes.data?.track_clients);
      console.log('✅ track_articles:', kpiConfigRes.data?.track_articles);
    } catch (err) {
      console.error('Error loading seller data:', err);
      toast.error('Erreur de chargement des données du vendeur');
    } finally {
      setLoading(false);
    }
  };

  const toggleDebrief = (debriefId) => {
    setExpandedDebriefs(prev => ({
      ...prev,
      [debriefId]: !prev[debriefId]
    }));
  };

  const handleResetDiagnostic = async () => {
    if (!window.confirm(`Êtes-vous sûr de vouloir réinitialiser le profil de ${seller.name} ? Cela supprimera son diagnostic actuel et lui permettra de refaire le test.`)) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/manager/seller/${seller.id}/diagnostic`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Profil réinitialisé avec succès');
      setDiagnostic(null);
    } catch (err) {
      console.error('Error resetting diagnostic:', err);
      toast.error('Erreur lors de la réinitialisation du profil');
    }
  };

  // Calculate current competences (use LIVE scores for consistency with overview)
  const currentCompetences = liveCompetences;

  const radarData = currentCompetences
    ? [
        { skill: 'Accueil', value: currentCompetences.score_accueil },
        { skill: 'Découverte', value: currentCompetences.score_decouverte },
        { skill: 'Argumentation', value: currentCompetences.score_argumentation },
        { skill: 'Closing', value: currentCompetences.score_closing },
        { skill: 'Fidélisation', value: currentCompetences.score_fidelisation }
      ]
    : [];

  // Calculate evolution data (score global sur 25)
  const evolutionData = competencesHistory.map((entry) => {
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

  // Determine which charts should be available based on manager's KPI configuration
  const availableCharts = useMemo(() => {
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
    
    const charts = {
      ca: kpiConfig.track_ca === true,
      ventes: kpiConfig.track_ventes === true,
      clients: kpiConfig.track_clients === true,
      articles: kpiConfig.track_articles === true,
      ventesVsClients: kpiConfig.track_ventes === true && kpiConfig.track_clients === true,
      panierMoyen: kpiConfig.track_ca === true && kpiConfig.track_ventes === true,
      tauxTransfo: kpiConfig.track_ventes === true && kpiConfig.track_clients === true,
      indiceVente: kpiConfig.track_ca === true && kpiConfig.track_ventes === true && kpiConfig.track_articles === true
    };
    
    // Debug: Log available charts
    console.log('📈 Available Charts calculated:', charts);
    console.log('🔍 kpiConfig:', kpiConfig);
    
    return charts;
  }, [kpiConfig]);

  // Calculate KPI stats (last 7 days)
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 p-8">
        <div className="text-center py-12">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="glass-morphism rounded-2xl p-6 mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="btn-secondary flex items-center gap-2"
            >
              <ArrowLeft className="w-5 h-5" />
              Retour
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-800">{seller.name}</h1>
              <p className="text-gray-600">{seller.email}</p>
            </div>
          </div>
        </div>
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
              <BarChart3 className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">CA (7j)</p>
              <p className="text-3xl font-bold text-gray-800">{kpiStats.totalCA.toFixed(0)}€</p>
            </div>
          </div>
        </div>
      </div>

      {/* Diagnostic Profile */}
      {diagnostic ? (
        <div className="glass-morphism rounded-2xl p-6 mb-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800">Profil de vente</h2>
            <button
              onClick={handleResetDiagnostic}
              className="btn-secondary px-4 py-2 text-sm flex items-center gap-2"
              title="Réinitialiser le profil"
            >
              <RefreshCw className="w-4 h-4" />
              Refaire le test
            </button>
          </div>
          
          <div className="bg-gradient-to-r from-[#ffd871] to-yellow-300 rounded-xl p-4 shadow-lg">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
              <div className="bg-white bg-opacity-70 rounded-lg p-3">
                <p className="text-xs text-gray-600 mb-1">🎨 Style</p>
                <p className="text-lg font-bold text-gray-800">{diagnostic.style}</p>
              </div>
              <div className="bg-white bg-opacity-70 rounded-lg p-3">
                <p className="text-xs text-gray-600 mb-1">🎯 Niveau</p>
                <p className="text-lg font-bold text-gray-800">{diagnostic.level}</p>
              </div>
              <div className="bg-white bg-opacity-70 rounded-lg p-3">
                <p className="text-xs text-gray-600 mb-1">⚡ Motivation</p>
                <p className="text-lg font-bold text-gray-800">{diagnostic.motivation}</p>
              </div>
            </div>
            
            {diagnostic.ai_profile_summary && (
              <div className="bg-white bg-opacity-70 rounded-lg p-4">
                <p className="text-sm text-gray-800 whitespace-pre-line">{diagnostic.ai_profile_summary}</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="glass-morphism rounded-2xl p-6 mb-8 bg-gray-50">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Profil de vente</h2>
          <div className="text-center py-8">
            <p className="text-gray-600 mb-4">
              {seller.name} n'a pas encore complété son diagnostic de vente.
            </p>
            <p className="text-sm text-gray-500">
              Le vendeur doit se connecter à son compte et compléter le diagnostic pour voir son profil ici.
            </p>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="glass-morphism rounded-2xl p-2 mb-8">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('competences')}
            className={`flex-1 py-3 px-6 rounded-xl font-semibold transition-all ${
              activeTab === 'competences'
                ? 'bg-gradient-to-r from-[#ffd871] to-yellow-300 text-gray-800 shadow-lg'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            📊 Compétences
          </button>
          <button
            onClick={() => setActiveTab('kpi')}
            className={`flex-1 py-3 px-6 rounded-xl font-semibold transition-all ${
              activeTab === 'kpi'
                ? 'bg-gradient-to-r from-[#ffd871] to-yellow-300 text-gray-800 shadow-lg'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            💰 KPI
          </button>
          <button
            onClick={() => setActiveTab('debriefs')}
            className={`flex-1 py-3 px-6 rounded-xl font-semibold transition-all ${
              activeTab === 'debriefs'
                ? 'bg-gradient-to-r from-[#ffd871] to-yellow-300 text-gray-800 shadow-lg'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            📝 Débriefs
          </button>
          <button
            onClick={() => setShowConflictModal(true)}
            className="flex-1 py-3 px-6 rounded-xl font-semibold transition-all bg-orange-100 text-orange-700 hover:bg-orange-200 border-2 border-orange-300"
          >
            🤝 Gestion de Conflit
          </button>
        </div>
      </div>

      {/* Tab Content - Compétences */}
      {activeTab === 'competences' && (
        <>
      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Radar Chart */}
        <div className="glass-morphism rounded-2xl p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Compétences actuelles</h2>
          {radarData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={radarData}>
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
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-800">Évolution du score global</h2>
            {evolutionData.length > 0 && (
              <p className="text-sm text-gray-600 mt-1">
                Score actuel : <span className="font-bold text-[#ffd871]">{evolutionData[evolutionData.length - 1]['Score Global']}/25</span>
                {evolutionData.length > 1 && (
                  <span className="ml-2">
                    ({evolutionData[evolutionData.length - 1]['Score Global'] - evolutionData[0]['Score Global'] >= 0 ? '+' : ''}
                    {(evolutionData[evolutionData.length - 1]['Score Global'] - evolutionData[0]['Score Global']).toFixed(1)} points)
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
            <div className="text-center py-12 text-gray-500">Pas encore d'historique</div>
          )}
        </div>
      </div>
        </>
      )}

      {/* Tab Content - KPI */}
      {activeTab === 'kpi' && (
        <div className="glass-morphism rounded-2xl p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">📊 KPI</h2>
          
          {/* Filtres */}
          <div className="flex gap-3 mb-6">
            <button
              onClick={() => setKpiFilter('7j')}
              className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                kpiFilter === '7j'
                  ? 'bg-gradient-to-r from-[#ffd871] to-yellow-300 text-gray-800 shadow-md'
                  : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              7 derniers jours
            </button>
            <button
              onClick={() => setKpiFilter('30j')}
              className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                kpiFilter === '30j'
                  ? 'bg-gradient-to-r from-[#ffd871] to-yellow-300 text-gray-800 shadow-md'
                  : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              30 derniers jours
            </button>
            <button
              onClick={() => setKpiFilter('tout')}
              className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                kpiFilter === 'tout'
                  ? 'bg-gradient-to-r from-[#ffd871] to-yellow-300 text-gray-800 shadow-md'
                  : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              Tout
            </button>
          </div>

          {/* DEBUG: Display KPI Config Status */}
          <div className="bg-red-50 border-2 border-red-500 rounded-xl p-4 mb-6">
            <p className="text-sm font-bold text-red-900 mb-2">🐛 DEBUG MODE (à retirer en production)</p>
            <p className="text-xs text-red-800">kpiConfig exists: {kpiConfig ? 'OUI ✅' : 'NON ❌'}</p>
            {kpiConfig && (
              <>
                <p className="text-xs text-red-800">track_ca: {kpiConfig.track_ca ? '✅' : '❌'}</p>
                <p className="text-xs text-red-800">track_ventes: {kpiConfig.track_ventes ? '✅' : '❌'}</p>
                <p className="text-xs text-red-800">track_clients: {kpiConfig.track_clients ? '✅' : '❌'}</p>
                <p className="text-xs text-red-800">track_articles: {kpiConfig.track_articles ? '✅' : '❌'}</p>
                <p className="text-xs text-red-800 mt-2 font-bold">Graphiques disponibles:</p>
                <p className="text-xs text-red-800">CA: {availableCharts.ca ? '✅' : '❌'} | Ventes: {availableCharts.ventes ? '✅' : '❌'} | Clients: {availableCharts.clients ? '✅' : '❌'} | Articles: {availableCharts.articles ? '✅' : '❌'}</p>
                <p className="text-xs text-red-800">Ventes vs Clients: {availableCharts.ventesVsClients ? '✅' : '❌'} | Panier Moyen: {availableCharts.panierMoyen ? '✅' : '❌'} | Taux Transfo: {availableCharts.tauxTransfo ? '✅' : '❌'} | Indice Vente: {availableCharts.indiceVente ? '✅' : '❌'}</p>
              </>
            )}
          </div>

          {/* Chart visibility toggles - Only show buttons for available charts */}
          {Object.values(availableCharts).some(v => v) && (
          <div className="bg-white rounded-xl p-4 border border-gray-200 mb-6">
            <p className="text-sm font-semibold text-gray-700 mb-3">📊 Graphiques affichés :</p>
            <div className="flex flex-wrap gap-2">
              {availableCharts.ca && (
              <button
                onClick={() => setVisibleCharts(prev => ({ ...prev, ca: !prev.ca }))}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  visibleCharts.ca
                    ? 'bg-blue-100 text-blue-700 border-2 border-blue-300'
                    : 'bg-gray-100 text-gray-500 border-2 border-transparent hover:bg-gray-200'
                }`}
              >
                💰 CA
              </button>
              )}
              {availableCharts.ventes && (
              <button
                onClick={() => setVisibleCharts(prev => ({ ...prev, ventes: !prev.ventes }))}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  visibleCharts.ventes
                    ? 'bg-green-100 text-green-700 border-2 border-green-300'
                    : 'bg-gray-100 text-gray-500 border-2 border-transparent hover:bg-gray-200'
                }`}
              >
                🛍️ Ventes
              </button>
              )}
              {availableCharts.clients && (
              <button
                onClick={() => setVisibleCharts(prev => ({ ...prev, clients: !prev.clients }))}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  visibleCharts.clients
                    ? 'bg-purple-100 text-purple-700 border-2 border-purple-300'
                    : 'bg-gray-100 text-gray-500 border-2 border-transparent hover:bg-gray-200'
                }`}
              >
                👥 Clients
              </button>
              )}
              {availableCharts.articles && (
              <button
                onClick={() => setVisibleCharts(prev => ({ ...prev, articles: !prev.articles }))}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  visibleCharts.articles
                    ? 'bg-amber-100 text-amber-700 border-2 border-amber-300'
                    : 'bg-gray-100 text-gray-500 border-2 border-transparent hover:bg-gray-200'
                }`}
              >
                📦 Articles
              </button>
              )}
              {availableCharts.ventesVsClients && (
              <button
                onClick={() => setVisibleCharts(prev => ({ ...prev, ventesVsClients: !prev.ventesVsClients }))}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  visibleCharts.ventesVsClients
                    ? 'bg-indigo-100 text-indigo-700 border-2 border-indigo-300'
                    : 'bg-gray-100 text-gray-500 border-2 border-transparent hover:bg-gray-200'
                }`}
              >
                📊 Ventes vs Clients
              </button>
              )}
              {availableCharts.panierMoyen && (
              <button
                onClick={() => setVisibleCharts(prev => ({ ...prev, panierMoyen: !prev.panierMoyen }))}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  visibleCharts.panierMoyen
                    ? 'bg-teal-100 text-teal-700 border-2 border-teal-300'
                    : 'bg-gray-100 text-gray-500 border-2 border-transparent hover:bg-gray-200'
                }`}
              >
                🛒 Panier Moyen
              </button>
              )}
              {availableCharts.tauxTransfo && (
              <button
                onClick={() => setVisibleCharts(prev => ({ ...prev, tauxTransfo: !prev.tauxTransfo }))}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  visibleCharts.tauxTransfo
                    ? 'bg-pink-100 text-pink-700 border-2 border-pink-300'
                    : 'bg-gray-100 text-gray-500 border-2 border-transparent hover:bg-gray-200'
                }`}
              >
                📈 Taux Transfo
              </button>
              )}
              {availableCharts.indiceVente && (
              <button
                onClick={() => setVisibleCharts(prev => ({ ...prev, indiceVente: !prev.indiceVente }))}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  visibleCharts.indiceVente
                    ? 'bg-orange-100 text-orange-700 border-2 border-orange-300'
                    : 'bg-gray-100 text-gray-500 border-2 border-transparent hover:bg-gray-200'
                }`}
              >
                💎 Indice Vente
              </button>
              )}
            </div>
          </div>
          )}
          
          {kpiEntries.length > 0 ? (
            <>
              {/* KPI Cards - Only show configured KPIs */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                {kpiConfig && kpiConfig.track_ca && (
                <div className="bg-blue-50 rounded-xl p-4">
                  <p className="text-sm text-blue-600 mb-2">💰 CA Total</p>
                  <p className="text-2xl font-bold text-blue-900">
                    {(() => {
                      const filteredEntries = kpiFilter === '7j' 
                        ? kpiEntries.filter(e => new Date(e.date) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
                        : kpiFilter === '30j'
                        ? kpiEntries.filter(e => new Date(e.date) >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
                        : kpiEntries;
                      return filteredEntries.reduce((sum, e) => sum + (e.ca_journalier || 0), 0).toFixed(2);
                    })()}€
                  </p>
                </div>
                )}
                {kpiConfig && kpiConfig.track_ventes && (
                <div className="bg-green-50 rounded-xl p-4">
                  <p className="text-sm text-green-600 mb-2">🛒 Ventes</p>
                  <p className="text-2xl font-bold text-green-900">
                    {(() => {
                      const filteredEntries = kpiFilter === '7j' 
                        ? kpiEntries.filter(e => new Date(e.date) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
                        : kpiFilter === '30j'
                        ? kpiEntries.filter(e => new Date(e.date) >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
                        : kpiEntries;
                      return filteredEntries.reduce((sum, e) => sum + (e.nb_ventes || 0), 0);
                    })()}
                  </p>
                </div>
                )}
                {kpiConfig && kpiConfig.track_clients && (
                <div className="bg-purple-50 rounded-xl p-4">
                  <p className="text-sm text-purple-600 mb-2">👥 Clients</p>
                  <p className="text-2xl font-bold text-purple-900">
                    {(() => {
                      const filteredEntries = kpiFilter === '7j' 
                        ? kpiEntries.filter(e => new Date(e.date) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
                        : kpiFilter === '30j'
                        ? kpiEntries.filter(e => new Date(e.date) >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
                        : kpiEntries;
                      return filteredEntries.reduce((sum, e) => sum + (e.nb_clients || 0), 0);
                    })()}
                  </p>
                </div>
                )}
                {kpiConfig && kpiConfig.track_ca && kpiConfig.track_ventes && (
                <div className="bg-orange-50 rounded-xl p-4">
                  <p className="text-sm text-orange-600 mb-2">🧮 Panier Moyen</p>
                  <p className="text-2xl font-bold text-orange-900">
                    {(() => {
                      const filteredEntries = kpiFilter === '7j' 
                        ? kpiEntries.filter(e => new Date(e.date) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
                        : kpiFilter === '30j'
                        ? kpiEntries.filter(e => new Date(e.date) >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
                        : kpiEntries;
                      return filteredEntries.length > 0
                        ? (filteredEntries.reduce((sum, e) => sum + (e.panier_moyen || 0), 0) / filteredEntries.length).toFixed(2)
                        : 0;
                    })()}€
                  </p>
                </div>
                )}
              </div>

              {/* Graphiques - Affichés selon les filtres ET la configuration du manager */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Graphique CA */}
                {availableCharts.ca && visibleCharts.ca && (
                  <div className="bg-white rounded-xl p-4 border border-gray-200">
                    <h3 className="text-lg font-bold text-gray-800 mb-4">💰 Évolution du CA</h3>
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={(() => {
                        const filteredEntries = kpiFilter === '7j' 
                          ? kpiEntries.filter(e => new Date(e.date) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
                          : kpiFilter === '30j'
                          ? kpiEntries.filter(e => new Date(e.date) >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
                          : kpiEntries;
                        return filteredEntries.map(e => ({
                          date: new Date(e.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
                          CA: e.ca_journalier || 0
                        }));
                      })()}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                        <XAxis dataKey="date" tick={{ fill: '#475569', fontSize: 11 }} />
                        <YAxis tick={{ fill: '#475569', fontSize: 11 }} />
                        <Tooltip contentStyle={{ backgroundColor: '#fff', border: '2px solid #3b82f6', borderRadius: '8px' }} />
                        <Line type="monotone" dataKey="CA" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Graphique Ventes */}
                {availableCharts.ventes && visibleCharts.ventes && (
                  <div className="bg-white rounded-xl p-4 border border-gray-200">
                    <h3 className="text-lg font-bold text-gray-800 mb-4">🛍️ Évolution des ventes</h3>
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={(() => {
                        const filteredEntries = kpiFilter === '7j' 
                          ? kpiEntries.filter(e => new Date(e.date) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
                          : kpiFilter === '30j'
                          ? kpiEntries.filter(e => new Date(e.date) >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
                          : kpiEntries;
                        return filteredEntries.map(e => ({
                          date: new Date(e.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
                          Ventes: e.nb_ventes || 0
                        }));
                      })()}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                        <XAxis dataKey="date" tick={{ fill: '#475569', fontSize: 11 }} />
                        <YAxis tick={{ fill: '#475569', fontSize: 11 }} />
                        <Tooltip contentStyle={{ backgroundColor: '#fff', border: '2px solid #10b981', borderRadius: '8px' }} />
                        <Line type="monotone" dataKey="Ventes" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Graphique Clients */}
                {availableCharts.clients && visibleCharts.clients && (
                  <div className="bg-white rounded-xl p-4 border border-gray-200">
                    <h3 className="text-lg font-bold text-gray-800 mb-4">👥 Évolution des clients</h3>
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={(() => {
                        const filteredEntries = kpiFilter === '7j' 
                          ? kpiEntries.filter(e => new Date(e.date) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
                          : kpiFilter === '30j'
                          ? kpiEntries.filter(e => new Date(e.date) >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
                          : kpiEntries;
                        return filteredEntries.map(e => ({
                          date: new Date(e.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
                          Clients: e.nb_clients || 0
                        }));
                      })()}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                        <XAxis dataKey="date" tick={{ fill: '#475569', fontSize: 11 }} />
                        <YAxis tick={{ fill: '#475569', fontSize: 11 }} />
                        <Tooltip contentStyle={{ backgroundColor: '#fff', border: '2px solid #9333ea', borderRadius: '8px' }} />
                        <Line type="monotone" dataKey="Clients" stroke="#9333ea" strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Graphique Articles */}
                {availableCharts.articles && visibleCharts.articles && (
                  <div className="bg-white rounded-xl p-4 border border-gray-200">
                    <h3 className="text-lg font-bold text-gray-800 mb-4">📦 Évolution des articles vendus</h3>
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={(() => {
                        const filteredEntries = kpiFilter === '7j' 
                          ? kpiEntries.filter(e => new Date(e.date) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
                          : kpiFilter === '30j'
                          ? kpiEntries.filter(e => new Date(e.date) >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
                          : kpiEntries;
                        return filteredEntries.map(e => ({
                          date: new Date(e.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
                          Articles: e.nb_articles || 0
                        }));
                      })()}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                        <XAxis dataKey="date" tick={{ fill: '#475569', fontSize: 11 }} />
                        <YAxis tick={{ fill: '#475569', fontSize: 11 }} />
                        <Tooltip contentStyle={{ backgroundColor: '#fff', border: '2px solid #f59e0b', borderRadius: '8px' }} />
                        <Line type="monotone" dataKey="Articles" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Graphique Ventes vs Clients */}
                {availableCharts.ventesVsClients && visibleCharts.ventesVsClients && (
                  <div className="bg-white rounded-xl p-4 border border-gray-200">
                    <h3 className="text-lg font-bold text-gray-800 mb-4">📊 Ventes vs Clients</h3>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={(() => {
                        const filteredEntries = kpiFilter === '7j' 
                          ? kpiEntries.filter(e => new Date(e.date) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
                          : kpiFilter === '30j'
                          ? kpiEntries.filter(e => new Date(e.date) >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
                          : kpiEntries;
                        return filteredEntries.map(e => ({
                          date: new Date(e.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
                          Ventes: e.nb_ventes || 0,
                          Clients: e.nb_clients || 0
                        }));
                      })()}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                        <XAxis dataKey="date" tick={{ fill: '#475569', fontSize: 11 }} />
                        <YAxis tick={{ fill: '#475569', fontSize: 11 }} />
                        <Tooltip contentStyle={{ backgroundColor: '#fff', border: '2px solid #6366f1', borderRadius: '8px' }} />
                        <Legend />
                        <Bar dataKey="Ventes" fill="#ffd871" name="Ventes" />
                        <Bar dataKey="Clients" fill="#93c5fd" name="Clients" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Graphique Panier Moyen */}
                {availableCharts.panierMoyen && visibleCharts.panierMoyen && (
                  <div className="bg-white rounded-xl p-4 border border-gray-200">
                    <h3 className="text-lg font-bold text-gray-800 mb-4">🛒 Panier Moyen</h3>
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={(() => {
                        const filteredEntries = kpiFilter === '7j' 
                          ? kpiEntries.filter(e => new Date(e.date) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
                          : kpiFilter === '30j'
                          ? kpiEntries.filter(e => new Date(e.date) >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
                          : kpiEntries;
                        return filteredEntries.map(e => ({
                          date: new Date(e.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
                          PanierMoyen: e.panier_moyen || 0
                        }));
                      })()}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                        <XAxis dataKey="date" tick={{ fill: '#475569', fontSize: 11 }} />
                        <YAxis tick={{ fill: '#475569', fontSize: 11 }} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#fff', border: '2px solid #14b8a6', borderRadius: '8px' }}
                          formatter={(value) => `${value.toFixed(2)}€`}
                        />
                        <Line type="monotone" dataKey="PanierMoyen" stroke="#14b8a6" strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Graphique Taux de Transformation */}
                {availableCharts.tauxTransfo && visibleCharts.tauxTransfo && (
                  <div className="bg-white rounded-xl p-4 border border-gray-200">
                    <h3 className="text-lg font-bold text-gray-800 mb-4">📈 Taux de Transformation</h3>
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={(() => {
                        const filteredEntries = kpiFilter === '7j' 
                          ? kpiEntries.filter(e => new Date(e.date) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
                          : kpiFilter === '30j'
                          ? kpiEntries.filter(e => new Date(e.date) >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
                          : kpiEntries;
                        return filteredEntries.map(e => ({
                          date: new Date(e.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
                          TauxTransfo: e.taux_transformation || 0
                        }));
                      })()}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                        <XAxis dataKey="date" tick={{ fill: '#475569', fontSize: 11 }} />
                        <YAxis tick={{ fill: '#475569', fontSize: 11 }} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#fff', border: '2px solid #ec4899', borderRadius: '8px' }}
                          formatter={(value) => `${value.toFixed(2)}%`}
                        />
                        <Line type="monotone" dataKey="TauxTransfo" stroke="#ec4899" strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Graphique Indice de Vente */}
                {availableCharts.indiceVente && visibleCharts.indiceVente && (
                  <div className="bg-white rounded-xl p-4 border border-gray-200">
                    <h3 className="text-lg font-bold text-gray-800 mb-4">💎 Indice de Vente</h3>
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={(() => {
                        const filteredEntries = kpiFilter === '7j' 
                          ? kpiEntries.filter(e => new Date(e.date) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
                          : kpiFilter === '30j'
                          ? kpiEntries.filter(e => new Date(e.date) >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
                          : kpiEntries;
                        return filteredEntries.map(e => ({
                          date: new Date(e.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
                          IndiceVente: e.indice_vente || 0
                        }));
                      })()}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                        <XAxis dataKey="date" tick={{ fill: '#475569', fontSize: 11 }} />
                        <YAxis tick={{ fill: '#475569', fontSize: 11 }} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#fff', border: '2px solid #f97316', borderRadius: '8px' }}
                          formatter={(value) => `${value.toFixed(2)}€`}
                        />
                        <Line type="monotone" dataKey="IndiceVente" stroke="#f97316" strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-gray-500">
              Aucune donnée KPI disponible
            </div>
          )}
        </div>
      )}

      {/* Tab Content - Débriefs */}
      {activeTab === 'debriefs' && (
      <div className="glass-morphism rounded-2xl p-6 mb-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">📝 Derniers débriefs</h2>
        
        {debriefs.length > 0 ? (
          <>
            <div className="space-y-4">
              {debriefs.slice(0, showAllDebriefs ? debriefs.length : 3).map((debrief) => (
                <div
                  key={debrief.id}
                  className="bg-white rounded-xl border border-gray-200 hover:shadow-md transition-all"
                >
                  <button
                    onClick={() => toggleDebrief(debrief.id)}
                    className="w-full p-4 text-left hover:bg-gray-50 transition-colors rounded-xl"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="text-sm text-gray-500 mb-2">
                          🗓️ {new Date(debrief.created_at).toLocaleDateString('fr-FR')} — Produit : {debrief.produit || debrief.context} — Type : {debrief.type_client || debrief.customer_profile}
                        </p>
                        <div className="space-y-1 text-sm text-gray-600">
                          <p>💬 Description : {debrief.description_vente || debrief.demarche_commerciale}</p>
                          <p>📍 Moment clé : {debrief.moment_perte_client || debrief.moment_perte_client}</p>
                          <p>❌ Raisons : {debrief.raisons_echec || debrief.objections}</p>
                        </div>
                      </div>
                      <div className="ml-4 text-gray-600 font-bold text-xl flex-shrink-0">
                        {expandedDebriefs[debrief.id] ? '−' : '+'}
                      </div>
                    </div>
                  </button>

                  {expandedDebriefs[debrief.id] && (
                    <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3 animate-fadeIn">
                      {debrief.ai_recommendation && (
                        <div className="bg-blue-50 rounded-lg p-3">
                          <p className="text-xs font-semibold text-blue-900 mb-1">💡 Recommandation IA</p>
                          <p className="text-sm text-blue-800 whitespace-pre-line">{debrief.ai_recommendation}</p>
                        </div>
                      )}
                      
                      <div className="grid grid-cols-5 gap-2">
                        <div className="bg-purple-50 rounded-lg p-2 text-center">
                          <p className="text-xs text-purple-600">Accueil</p>
                          <p className="text-lg font-bold text-purple-900">{debrief.score_accueil || 0}/5</p>
                        </div>
                        <div className="bg-green-50 rounded-lg p-2 text-center">
                          <p className="text-xs text-green-600">Découverte</p>
                          <p className="text-lg font-bold text-green-900">{debrief.score_decouverte || 0}/5</p>
                        </div>
                        <div className="bg-orange-50 rounded-lg p-2 text-center">
                          <p className="text-xs text-orange-600">Argumentation</p>
                          <p className="text-lg font-bold text-orange-900">{debrief.score_argumentation || 0}/5</p>
                        </div>
                        <div className="bg-red-50 rounded-lg p-2 text-center">
                          <p className="text-xs text-red-600">Closing</p>
                          <p className="text-lg font-bold text-red-900">{debrief.score_closing || 0}/5</p>
                        </div>
                        <div className="bg-blue-50 rounded-lg p-2 text-center">
                          <p className="text-xs text-blue-600">Fidélisation</p>
                          <p className="text-lg font-bold text-blue-900">{debrief.score_fidelisation || 0}/5</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            {/* Bouton Charger plus */}
            {debriefs.length > 3 && (
              <div className="mt-6 text-center">
                <button
                  onClick={() => setShowAllDebriefs(!showAllDebriefs)}
                  className="btn-secondary px-6 py-2"
                >
                  {showAllDebriefs ? '↑ Voir moins' : `↓ Charger plus (${debriefs.length - 3} autres)`}
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12 text-gray-500">
            Aucun débrief pour le moment
          </div>
        )}
      </div>
      )}

      {/* Conflict Resolution Modal */}
      {showConflictModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-800">🤝 Gestion de Conflit - {seller.name}</h2>
              <button
                onClick={() => setShowConflictModal(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
              >
                ×
              </button>
            </div>
            <div className="p-6">
              <ConflictResolutionForm sellerId={seller.id} sellerName={seller.name} />
            </div>
          </div>
        </div>
      )}
      </div> {/* Fermeture du conteneur max-w-7xl */}
    </div>
  );
}
