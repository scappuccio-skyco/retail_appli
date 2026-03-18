import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../lib/apiClient';
import { LABEL_DECOUVERTE } from '../lib/constants';
import { logger } from '../utils/logger';
import { toast } from 'sonner';
import { ArrowLeft, TrendingUp, Award, MessageSquare, BarChart3, Calendar, StickyNote } from 'lucide-react';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import ConflictResolutionForm from './ConflictResolutionForm';
import { renderMarkdownBold } from '../utils/markdownRenderer';

const MONTHS_FR = ['jan.', 'fév.', 'mar.', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sep.', 'oct.', 'nov.', 'déc.'];
function formatNoteDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return `${d.getDate()} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`;
}

export default function SellerDetailView({ seller, onBack, storeIdParam = null }) {
  const [diagnostic, setDiagnostic] = useState(null);
  const [debriefs, setDebriefs] = useState([]);
  const [competencesHistory, setCompetencesHistory] = useState([]);
  const [liveCompetences, setLiveCompetences] = useState(null); // NEW: Live scores for current radar
  const [kpiEntries, setKpiEntries] = useState([]);
  const [kpiMetrics, setKpiMetrics] = useState(null); // Server-side aggregated metrics
  const [kpiConfig, setKpiConfig] = useState(null); // NEW: Manager's KPI configuration
  const [loading, setLoading] = useState(true);
  const [expandedDebriefs, setExpandedDebriefs] = useState({});
  const [activeTab, setActiveTab] = useState(seller?._openTab || 'competences');
  const [sharedNotes, setSharedNotes] = useState([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [showAllDebriefs, setShowAllDebriefs] = useState(false); // New state for debriefs display
  const [debriefFilter, setDebriefFilter] = useState('all'); // New state for debrief filter: 'all', 'success', 'missed'
  const [kpiFilter, setKpiFilter] = useState('7j'); // New state for KPI filter: '7j', '30j', 'tout'
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

  // Build store_id param for API calls (for gerant viewing as manager)
  const storeParam = storeIdParam ? `?store_id=${storeIdParam}` : '';
  const storeParamAnd = storeIdParam ? `&store_id=${storeIdParam}` : '';

  useEffect(() => {
    fetchSellerData();
  }, [seller.id, storeIdParam]);

  // Charger les KPI une fois les autres données prêtes, puis quand le filtre change (un seul appel pour éviter 429)
  useEffect(() => {
    if (seller?.id && !loading) {
      fetchKPIData();
    }
  }, [kpiFilter, loading]);

  // Charger les notes partagées quand l'onglet Notes est actif
  useEffect(() => {
    if (activeTab === 'notes' && seller?.id) {
      fetchSharedNotes();
    }
  }, [activeTab, seller?.id]);

  const fetchSharedNotes = async () => {
    setNotesLoading(true);
    try {
      const storeParam = storeIdParam ? `?store_id=${storeIdParam}` : '';
      const res = await api.get(`/manager/sellers/${seller.id}/interview-notes${storeParam}`);
      setSharedNotes(res.data.notes || []);
      // Marquer les notes comme vues
      await api.patch(`/manager/sellers/${seller.id}/notes-seen${storeParam}`);
    } catch (err) {
      logger.error('Error loading shared notes:', err);
    } finally {
      setNotesLoading(false);
    }
  };

  const fetchKPIData = async () => {
    if (!seller?.id) return;

    try {
      const days = kpiFilter === '7j' ? 7 : kpiFilter === '30j' ? 30 : 365;
      const storeParamAnd = storeIdParam ? `&store_id=${storeIdParam}` : '';
      const [entriesRes, metricsRes] = await Promise.all([
        // Entries pour les graphiques time-series (taille garantie suffisante par le backend)
        api.get(`/manager/kpi-entries/${seller.id}?days=${days}${storeParamAnd}`),
        // Métriques agrégées server-side — source de vérité unique
        api.get(`/manager/seller/${seller.id}/kpi-metrics?days=${days}${storeParamAnd}`),
      ]);
      const entries = Array.isArray(entriesRes.data?.items)
        ? entriesRes.data.items
        : (Array.isArray(entriesRes.data) ? entriesRes.data : []);
      setKpiEntries(entries);
      setKpiMetrics(metricsRes.data);
    } catch (err) {
      logger.error('Error loading KPI data:', err);
      setKpiEntries([]);
      setKpiMetrics(null);
      toast.error(`Erreur de chargement des KPI: ${err.response?.data?.detail || err.message}`);
    }
  };

  const fetchSellerData = async () => {
    setLoading(true);
    try {
      const [statsRes, diagRes, debriefsRes, competencesRes, kpiConfigRes] = await Promise.all([
        api.get(`/manager/seller/${seller.id}/stats${storeParam}`),
        api.get(`/manager-diagnostic/seller/${seller.id}${storeParam}`),
        api.get(`/manager/debriefs/${seller.id}${storeParam}`),
        api.get(`/manager/competences-history/${seller.id}${storeParam}`),
        api.get(`/manager/kpi-config${storeParam}`)
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
        score_accueil: liveScores.accueil || 0,
        score_decouverte: liveScores.decouverte || 0,
        score_argumentation: liveScores.argumentation || 0,
        score_closing: liveScores.closing || 0,
        score_fidelisation: liveScores.fidelisation || 0
      });

      setDiagnostic(diagRes.data);
      setDebriefs(debriefsRes.data);
      setCompetencesHistory(competencesRes.data || []); // Keep historical data for evolution chart
      setKpiConfig(kpiConfigRes.data); // Store manager's KPI configuration
      // KPI : chargé par l'effet (kpiFilter) après setLoading(false) pour éviter double appel → 429
    } catch (err) {
      logger.error('Error loading seller data:', err);
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

  // Calculate current competences (use LIVE scores for consistency with overview)
  const currentCompetences = liveCompetences;

  // Always create radar data structure (even if scores are 0) for consistent display
  const radarData = [
    { skill: 'Accueil', value: currentCompetences?.score_accueil || 0 },
    { skill: LABEL_DECOUVERTE, value: currentCompetences?.score_decouverte || 0 },
    { skill: 'Argumentation', value: currentCompetences?.score_argumentation || 0 },
    { skill: 'Closing', value: currentCompetences?.score_closing || 0 },
    { skill: 'Fidélisation', value: currentCompetences?.score_fidelisation || 0 }
  ];
  
  // Check if all scores are zero (no evaluation)
  const hasAnyScore = radarData.some(d => d.value > 0);

  // Calculate evolution data (score global sur 50 = 5 compétences × 10)
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
    // Helper: check flags with backward compatibility (manager_*, seller_*, track_*)
    const track = (key) => {
      if (!kpiConfig) return true; // si pas de config, ne pas bloquer l'affichage
      const managerKey = `manager_track_${key}`;
      const sellerKey = `seller_track_${key}`;
      const legacyKey = `track_${key}`;
      return (
        kpiConfig[managerKey] === true ||
        kpiConfig[sellerKey] === true ||
        kpiConfig[legacyKey] === true
      );
    };

    return {
      ca: track('ca'),
      ventes: track('ventes'),
      clients: track('clients'),
      articles: track('articles'),
      ventesVsClients: track('ventes') && track('clients'),
      panierMoyen: track('ca') && track('ventes'),
      tauxTransfo: track('ventes') && track('clients'),
      indiceVente: track('ca') && track('ventes') && track('articles')
    };
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

  // Helper accessible dans le rendu pour contrôler l'affichage des cartes KPI
  const isTrack = (key) => {
    if (!kpiConfig) return true;
    const managerKey = `manager_track_${key}`;
    const sellerKey = `seller_track_${key}`;
    const legacyKey = `track_${key}`;
    return (
      kpiConfig[managerKey] === true ||
      kpiConfig[sellerKey] === true ||
      kpiConfig[legacyKey] === true
    );
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-h-[95vh] overflow-hidden">
      {/* Header - Compact */}
      <div className="flex-shrink-0 bg-gradient-to-r from-blue-600 to-indigo-700 px-4 sm:px-6 py-4 rounded-t-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <button
              onClick={onBack}
              className="flex-shrink-0 w-9 h-9 flex items-center justify-center bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors"
              title="Retour"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg sm:text-xl font-bold text-white truncate">{seller.name}</h1>
              <p className="text-xs sm:text-sm text-blue-100 truncate">{seller.email}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto bg-gray-50 p-3 sm:p-4">

      {/* Diagnostic Profile - Compact */}
      {diagnostic ? (
        <div className="bg-white rounded-xl p-4 mb-4 shadow-sm border border-gray-200">
          <h2 className="text-base font-bold text-gray-800 mb-3">Profil de vente</h2>
          
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-3 border border-blue-100">
            {/* Show legacy detailed format (Style, Level, Motivation) OR new simplified format (Score, Profile) */}
            {diagnostic.style ? (
              // Legacy format for older diagnostics
              <>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="bg-white rounded-lg p-2 text-center">
                    <p className="text-[10px] text-gray-500 mb-0.5">🎨 Style</p>
                    <p className="text-sm font-bold text-gray-800">{diagnostic.style}</p>
                  </div>
                  <div className="bg-white rounded-lg p-2 text-center">
                    <p className="text-[10px] text-gray-500 mb-0.5">🎯 Niveau</p>
                    <p className="text-sm font-bold text-gray-800">{diagnostic.level || 'N/A'}</p>
                  </div>
                  <div className="bg-white rounded-lg p-2 text-center">
                    <p className="text-[10px] text-gray-500 mb-0.5">⚡ Motivation</p>
                    <p className="text-sm font-bold text-gray-800">{diagnostic.motivation || 'N/A'}</p>
                  </div>
                </div>
                
                {diagnostic.ai_profile_summary && (
                  <div className="bg-white rounded-lg p-3">
                    <p className="text-xs text-gray-700 leading-relaxed">{renderMarkdownBold(diagnostic.ai_profile_summary)}</p>
                  </div>
                )}
              </>
            ) : (
              // New simplified format for recent diagnostics
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white rounded-lg p-2 text-center">
                  <p className="text-[10px] text-gray-500 mb-0.5">📊 Score</p>
                  <p className="text-sm font-bold text-gray-800">{diagnostic.score != null ? `${Number(diagnostic.score).toFixed(1)} / 10` : 'N/A'}</p>
                </div>
                <div className="bg-white rounded-lg p-2 text-center">
                  <p className="text-[10px] text-gray-500 mb-0.5">🎯 Profil</p>
                  <p className="text-xs font-bold text-gray-800">
                    {diagnostic.profile === 'communicant_naturel' ? 'Communicant Naturel' :
                     diagnostic.profile === 'excellence_commerciale' ? 'Excellence Commerciale' :
                     diagnostic.profile === 'potentiel_developper' ? 'Potentiel à Développer' :
                     diagnostic.profile === 'equilibre' ? 'Profil Équilibré' :
                     diagnostic.profile || 'Non défini'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl p-4 mb-4 shadow-sm border border-gray-200">
          <h2 className="text-base font-bold text-gray-800 mb-3">Profil de vente</h2>
          <div className="text-center py-4">
            <p className="text-sm text-gray-600 mb-2">
              {seller.name} n'a pas encore complété son diagnostic de vente.
            </p>
            <p className="text-xs text-gray-500">
              Le vendeur doit se connecter à son compte et compléter le diagnostic pour voir son profil ici.
            </p>
          </div>
        </div>
      )}

      {/* Tab Navigation - Compact */}
      <div className="bg-white rounded-lg p-1 mb-4 shadow-sm border border-gray-200">
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab('competences')}
            className={`flex-1 py-2 px-3 rounded-lg font-medium transition-all text-xs sm:text-sm ${
              activeTab === 'competences'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            📊 Compétences
          </button>
          <button
            onClick={() => setActiveTab('kpi')}
            className={`flex-1 py-2 px-3 rounded-lg font-medium transition-all text-xs sm:text-sm ${
              activeTab === 'kpi'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            💰 KPI
          </button>
          <button
            onClick={() => setActiveTab('debriefs')}
            className={`flex-1 py-2 px-3 rounded-lg font-medium transition-all text-xs sm:text-sm ${
              activeTab === 'debriefs'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            📝 Analyses
          </button>
          <button
            onClick={() => setActiveTab('notes')}
            className={`flex-1 py-2 px-3 rounded-lg font-medium transition-all text-xs sm:text-sm ${
              activeTab === 'notes'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            🗒️ Notes
          </button>
        </div>
      </div>

      {/* Tab Content - Compétences */}
      {activeTab === 'competences' && (
        <>
      {/* Charts - Compact */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-4">
        {/* Radar Chart */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
          <h2 className="text-sm font-bold text-gray-800 mb-3">Compétences actuelles</h2>
          {hasAnyScore ? (
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#cbd5e1" />
                <PolarAngleAxis dataKey="skill" tick={{ fill: '#475569', fontSize: 11 }} />
                <PolarRadiusAxis angle={90} domain={[0, 10]} tick={{ fill: '#64748b', fontSize: 9 }} />
                <Radar name="Score" dataKey="value" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.5} />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-8 text-gray-500 text-sm">
              {currentCompetences ? 
                "Aucune compétence évaluée (tous les scores sont à 0). Le vendeur doit compléter son diagnostic ou avoir des debriefs pour voir ses compétences." : 
                "Aucune donnée disponible. Le vendeur doit compléter son diagnostic pour voir ses compétences."}
            </div>
          )}
        </div>

        {/* Evolution Chart */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
          <div className="mb-3">
            <h2 className="text-sm font-bold text-gray-800">Évolution du score global</h2>
            {evolutionData.length > 0 && (
              <p className="text-xs text-gray-600 mt-1">
                Score actuel : <span className="font-bold text-blue-600">{evolutionData[evolutionData.length - 1]['Score Global']}/25</span>
                {evolutionData.length > 1 && (
                  <span className="ml-1">
                    ({evolutionData[evolutionData.length - 1]['Score Global'] - evolutionData[0]['Score Global'] >= 0 ? '+' : ''}
                    {(evolutionData[evolutionData.length - 1]['Score Global'] - evolutionData[0]['Score Global']).toFixed(1)} pts)
                  </span>
                )}
              </p>
            )}
          </div>
          {evolutionData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={evolutionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                <XAxis dataKey="fullDate" tick={{ fill: '#475569', fontSize: 10 }} />
                <YAxis domain={[0, 50]} tick={{ fill: '#475569', fontSize: 10 }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #3b82f6', borderRadius: '6px', fontSize: '12px' }}
                  labelStyle={{ color: '#1f2937', fontWeight: 'bold', fontSize: '11px' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="Score Global" 
                  stroke="#3b82f6" 
                  strokeWidth={2} 
                  dot={{ r: 3, fill: '#3b82f6' }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-8 text-gray-500 text-sm">Pas encore d'historique</div>
          )}
        </div>
      </div>
        </>
      )}

      {/* Tab Content - KPI */}
      {activeTab === 'kpi' && (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
          <h2 className="text-base font-bold text-gray-800 mb-4">📊 KPI</h2>
          
          {/* Filtres - Compact */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setKpiFilter('7j')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                kpiFilter === '7j'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              7j
            </button>
            <button
              onClick={() => setKpiFilter('30j')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                kpiFilter === '30j'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              30j
            </button>
            <button
              onClick={() => setKpiFilter('tout')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                kpiFilter === 'tout'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Tout
            </button>
          </div>

          {/* Chart visibility toggles - Only show buttons for available charts */}
          {Object.values(availableCharts).some(v => v) && (
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-200 mb-4">
            <p className="text-xs font-semibold text-gray-700 mb-2">📊 Graphiques :</p>
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
              {/* KPI Cards — métriques server-side (source de vérité unique) */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mb-4">
                {isTrack('ca') && (
                <div className="bg-blue-50 rounded-lg p-3">
                  <p className="text-xs text-blue-600 mb-1">💰 CA Total</p>
                  <p className="text-lg font-bold text-blue-900">
                    {(kpiMetrics?.ca ?? 0).toFixed(2)}€
                  </p>
                </div>
                )}
                {isTrack('ventes') && (
                <div className="bg-green-50 rounded-lg p-3">
                  <p className="text-xs text-[#10B981] mb-1">🛒 Ventes</p>
                  <p className="text-lg font-bold text-green-900">
                    {kpiMetrics?.ventes ?? 0}
                  </p>
                </div>
                )}
                {isTrack('prospects') && (
                <div className="bg-purple-50 rounded-lg p-3">
                  <p className="text-xs text-purple-600 mb-1">🚶 Prospects</p>
                  <p className="text-lg font-bold text-purple-900">
                    {kpiMetrics?.prospects ?? 0}
                  </p>
                </div>
                )}
                {isTrack('ca') && isTrack('ventes') && (
                <div className="bg-orange-50 rounded-lg p-3">
                  <p className="text-xs text-[#F97316] mb-1">🧮 Panier Moyen</p>
                  <p className="text-lg font-bold text-orange-900">
                    {(kpiMetrics?.panier_moyen ?? 0).toFixed(2)}€
                  </p>
                </div>
                )}
                {isTrack('ca') && isTrack('ventes') && isTrack('articles') && (
                <div className="bg-amber-50 rounded-lg p-3">
                  <p className="text-xs text-amber-600 mb-1">💎 Indice Vente</p>
                  <p className="text-lg font-bold text-amber-900">
                    {(kpiMetrics?.indice_vente ?? 0).toFixed(2)}
                  </p>
                  <p className="text-[10px] text-amber-700 mt-0.5">articles/vente</p>
                </div>
                )}
              </div>

              {/* Graphiques - Affichés selon les filtres ET la configuration du manager - Compact */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {/* Graphique CA */}
                {availableCharts.ca && visibleCharts.ca && (
                  <div className="bg-white rounded-lg p-3 border border-gray-200">
                    <h3 className="text-sm font-bold text-gray-800 mb-2">💰 Évolution du CA</h3>
                    <ResponsiveContainer width="100%" height={180}>
                      <LineChart data={(() => {
                        const filteredEntries = kpiFilter === '7j' 
                          ? kpiEntries.filter(e => new Date(e.date) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
                          : kpiFilter === '30j'
                          ? kpiEntries.filter(e => new Date(e.date) >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
                          : kpiEntries;
                        return filteredEntries
                          .sort((a, b) => new Date(a.date) - new Date(b.date))
                          .map(e => ({
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
                  <div className="bg-white rounded-lg p-3 border border-gray-200">
                    <h3 className="text-sm font-bold text-gray-800 mb-2">🛍️ Évolution des ventes</h3>
                    <ResponsiveContainer width="100%" height={180}>
                      <LineChart data={(() => {
                        const filteredEntries = kpiFilter === '7j' 
                          ? kpiEntries.filter(e => new Date(e.date) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
                          : kpiFilter === '30j'
                          ? kpiEntries.filter(e => new Date(e.date) >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
                          : kpiEntries;
                        return filteredEntries
                          .sort((a, b) => new Date(a.date) - new Date(b.date))
                          .map(e => ({
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
                  <div className="bg-white rounded-lg p-3 border border-gray-200">
                    <h3 className="text-sm font-bold text-gray-800 mb-2">👥 Évolution des clients</h3>
                    <ResponsiveContainer width="100%" height={180}>
                      <LineChart data={(() => {
                        const filteredEntries = kpiFilter === '7j' 
                          ? kpiEntries.filter(e => new Date(e.date) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
                          : kpiFilter === '30j'
                          ? kpiEntries.filter(e => new Date(e.date) >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
                          : kpiEntries;
                        return filteredEntries
                          .sort((a, b) => new Date(a.date) - new Date(b.date))
                          .map(e => ({
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
                  <div className="bg-white rounded-lg p-3 border border-gray-200">
                    <h3 className="text-sm font-bold text-gray-800 mb-2">📦 Articles vendus</h3>
                    <ResponsiveContainer width="100%" height={180}>
                      <LineChart data={(() => {
                        const filteredEntries = kpiFilter === '7j' 
                          ? kpiEntries.filter(e => new Date(e.date) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
                          : kpiFilter === '30j'
                          ? kpiEntries.filter(e => new Date(e.date) >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
                          : kpiEntries;
                        return filteredEntries
                          .sort((a, b) => new Date(a.date) - new Date(b.date))
                          .map(e => ({
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
                  <div className="bg-white rounded-lg p-3 border border-gray-200">
                    <h3 className="text-sm font-bold text-gray-800 mb-2">📊 Ventes vs Clients</h3>
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={(() => {
                        const filteredEntries = kpiFilter === '7j' 
                          ? kpiEntries.filter(e => new Date(e.date) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
                          : kpiFilter === '30j'
                          ? kpiEntries.filter(e => new Date(e.date) >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
                          : kpiEntries;
                        return filteredEntries
                          .sort((a, b) => new Date(a.date) - new Date(b.date))
                          .map(e => ({
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
                  <div className="bg-white rounded-lg p-3 border border-gray-200">
                    <h3 className="text-sm font-bold text-gray-800 mb-2">🛒 Panier Moyen</h3>
                    <ResponsiveContainer width="100%" height={180}>
                      <LineChart data={(() => {
                        const filteredEntries = kpiFilter === '7j' 
                          ? kpiEntries.filter(e => new Date(e.date) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
                          : kpiFilter === '30j'
                          ? kpiEntries.filter(e => new Date(e.date) >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
                          : kpiEntries;
                        return filteredEntries
                          .sort((a, b) => new Date(a.date) - new Date(b.date))
                          .map(e => ({
                          date: new Date(e.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
                          PanierMoyen: (e.nb_ventes > 0) ? (e.ca_journalier / e.nb_ventes) : 0
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
                  <div className="bg-white rounded-lg p-3 border border-gray-200">
                    <h3 className="text-sm font-bold text-gray-800 mb-2">📈 Taux Transformation</h3>
                    <ResponsiveContainer width="100%" height={180}>
                      <LineChart data={(() => {
                        const filteredEntries = kpiFilter === '7j' 
                          ? kpiEntries.filter(e => new Date(e.date) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
                          : kpiFilter === '30j'
                          ? kpiEntries.filter(e => new Date(e.date) >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
                          : kpiEntries;
                        return filteredEntries
                          .sort((a, b) => new Date(a.date) - new Date(b.date))
                          .map(e => ({
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
                  <div className="bg-white rounded-lg p-3 border border-gray-200">
                    <h3 className="text-sm font-bold text-gray-800 mb-2">💎 Indice de Vente</h3>
                    <ResponsiveContainer width="100%" height={180}>
                      <LineChart data={(() => {
                        const filteredEntries = kpiFilter === '7j' 
                          ? kpiEntries.filter(e => new Date(e.date) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
                          : kpiFilter === '30j'
                          ? kpiEntries.filter(e => new Date(e.date) >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
                          : kpiEntries;
                        return filteredEntries
                          .sort((a, b) => new Date(a.date) - new Date(b.date))
                          .map(e => ({
                          date: new Date(e.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
                          IndiceVente: e.indice_vente !== undefined && e.indice_vente !== null 
                            ? e.indice_vente 
                            : (e.nb_ventes > 0 ? (e.nb_articles / e.nb_ventes) : 0)
                        }));
                      })()}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                        <XAxis dataKey="date" tick={{ fill: '#475569', fontSize: 11 }} />
                        <YAxis tick={{ fill: '#475569', fontSize: 11 }} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#fff', border: '2px solid #f97316', borderRadius: '8px' }}
                          formatter={(value) => `${value.toFixed(2)}`}
                        />
                        <Line type="monotone" dataKey="IndiceVente" stroke="#f97316" strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-gray-500 text-sm">
              Aucune donnée KPI disponible
            </div>
          )}
        </div>
      )}

      {/* Tab Content - Analyses des ventes */}
      {activeTab === 'debriefs' && (
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
        <h2 className="text-base font-bold text-gray-800 mb-4">📝 Dernières analyses des ventes</h2>
        
        {debriefs.length > 0 ? (
          <>
            {/* Filtres - Compact */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setDebriefFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  debriefFilter === 'all'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Toutes ({debriefs.length})
              </button>
              <button
                onClick={() => setDebriefFilter('success')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  debriefFilter === 'success'
                    ? 'bg-green-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                ✅ Réussies ({debriefs.filter(d => d.vente_conclue === true).length})
              </button>
              <button
                onClick={() => setDebriefFilter('missed')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  debriefFilter === 'missed'
                    ? 'bg-orange-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                ❌ Manquées ({debriefs.filter(d => d.vente_conclue === false).length})
              </button>
            </div>

            <div className="space-y-2">
              {debriefs
                .filter(debrief => {
                  if (debriefFilter === 'success') return debrief.vente_conclue === true;
                  if (debriefFilter === 'missed') return debrief.vente_conclue === false;
                  return true; // 'all'
                })
                .slice(0, showAllDebriefs ? debriefs.length : 3)
                .map((debrief) => {
                  const isConclue = debrief.vente_conclue === true;
                  return (
                <div
                  key={debrief.id}
                  className="bg-gray-50 rounded-lg border border-gray-200 hover:shadow-sm transition-all"
                >
                  <button
                    onClick={() => toggleDebrief(debrief.id)}
                    className="w-full p-3 text-left hover:bg-gray-100 transition-colors rounded-lg"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                            isConclue 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-orange-100 text-orange-700'
                          }`}>
                            {isConclue ? '✅ Réussi' : '❌ Manqué'}
                          </span>
                          <span className="text-xs text-gray-500">
                            🗓️ {new Date(debrief.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 mb-1 truncate">
                          📦 {debrief.produit || debrief.context || 'N/A'} — 👤 {debrief.type_client || debrief.customer_profile || 'N/A'}
                        </p>
                        {!expandedDebriefs[debrief.id] && (
                          <p className="text-xs text-gray-500 truncate">
                            {debrief.description_vente || debrief.demarche_commerciale || 'Aucune description'}
                          </p>
                        )}
                      </div>
                      <div className="ml-2 text-gray-400 font-bold text-lg flex-shrink-0">
                        {expandedDebriefs[debrief.id] ? '−' : '+'}
                      </div>
                    </div>
                  </button>

                  {expandedDebriefs[debrief.id] && (
                    <div className="px-3 pb-3 space-y-2 border-t border-gray-200 pt-2">
                      {debrief.ai_recommendation && (
                        <div className="bg-blue-50 rounded p-2">
                          <p className="text-[10px] font-semibold text-blue-900 mb-1">💡 Recommandation IA</p>
                          <p className="text-xs text-blue-800 leading-relaxed">{debrief.ai_recommendation}</p>
                        </div>
                      )}
                      
                      <div className="grid grid-cols-5 gap-1.5">
                        <div className="bg-purple-50 rounded p-1.5 text-center">
                          <p className="text-[10px] text-purple-600">Accueil</p>
                          <p className="text-sm font-bold text-purple-900">{debrief.score_accueil ?? 0}/10</p>
                        </div>
                        <div className="bg-green-50 rounded p-1.5 text-center">
                          <p className="text-[10px] text-green-600">{LABEL_DECOUVERTE}</p>
                          <p className="text-sm font-bold text-green-900">{debrief.score_decouverte ?? 0}/10</p>
                        </div>
                        <div className="bg-orange-50 rounded p-1.5 text-center">
                          <p className="text-[10px] text-orange-600">Argumentation</p>
                          <p className="text-sm font-bold text-orange-900">{debrief.score_argumentation ?? 0}/10</p>
                        </div>
                        <div className="bg-red-50 rounded p-1.5 text-center">
                          <p className="text-[10px] text-red-600">Closing</p>
                          <p className="text-sm font-bold text-red-900">{debrief.score_closing ?? 0}/10</p>
                        </div>
                        <div className="bg-blue-50 rounded p-1.5 text-center">
                          <p className="text-[10px] text-blue-600">Fidélisation</p>
                          <p className="text-sm font-bold text-blue-900">{debrief.score_fidelisation ?? 0}/10</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                  );
              })}
            </div>
            
            {/* Bouton Charger plus - Compact */}
            {debriefs.length > 3 && (
              <div className="mt-4 text-center">
                <button
                  onClick={() => setShowAllDebriefs(!showAllDebriefs)}
                  className="px-4 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-medium transition-colors"
                >
                  {showAllDebriefs ? '↑ Voir moins' : `↓ Charger plus (${debriefs.length - 3} autres)`}
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-8 text-gray-500 text-sm">
            Aucune analyse de vente pour le moment
          </div>
        )}
      </div>
      )}

      {/* Tab Content - Gestion de Conflit */}
      {activeTab === 'conflit' && (
        <div>
          <ConflictResolutionForm sellerId={seller.id} sellerName={seller.name} />
        </div>
      )}

      {/* Tab Content - Notes partagées */}
      {activeTab === 'notes' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-800">
              Notes partagées par {seller.name}
            </h3>
            {sharedNotes.length > 0 && (
              <span className="text-xs text-gray-500">{sharedNotes.length} note{sharedNotes.length > 1 ? 's' : ''}</span>
            )}
          </div>

          {notesLoading ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : sharedNotes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
              <div className="p-4 bg-gray-100 rounded-full">
                <StickyNote className="w-8 h-8 text-gray-400" />
              </div>
              <p className="font-semibold text-gray-700">Aucune note partagée</p>
              <p className="text-gray-500 text-sm">{seller.name} n'a pas encore partagé de notes avec vous.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sharedNotes.map((note) => (
                <div key={note.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                      {formatNoteDate(note.date || note.created_at)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{note.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      </div> {/* Fermeture du conteneur scrollable */}
    </div>
  );
}
