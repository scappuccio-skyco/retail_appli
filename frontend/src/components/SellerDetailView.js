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
      <div className="flex flex-col h-full max-h-[95vh] items-center justify-center bg-white rounded-2xl">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-600 border-t-transparent mb-3" />
        <p className="text-sm text-gray-400 font-medium">Chargement du profil...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-h-[95vh] overflow-hidden rounded-2xl bg-white shadow-xl">

      {/* ── Header ── */}
      <div className="flex-shrink-0 bg-slate-900 px-5 pt-4 pb-0 rounded-t-2xl">
        {/* Back + Identity row */}
        <div className="flex items-center gap-3 pb-3">
          <button
            onClick={onBack}
            className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          {/* Avatar initials */}
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 ring-2 ring-white/20">
            {seller.name?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-white truncate leading-tight">{seller.name}</h1>
            <p className="text-xs text-slate-400 truncate">{seller.email}</p>
          </div>
          {/* Profile badge */}
          {diagnostic && (
            <span className="flex-shrink-0 text-[10px] font-semibold text-indigo-200 bg-indigo-500/30 border border-indigo-400/30 px-2 py-0.5 rounded-full">
              {diagnostic.profile === 'communicant_naturel' ? 'Comm. Naturel' :
               diagnostic.profile === 'excellence_commerciale' ? 'Excellence' :
               diagnostic.profile === 'potentiel_developper' ? 'Potentiel' :
               diagnostic.profile === 'equilibre' ? 'Équilibré' :
               diagnostic.style || '—'}
            </span>
          )}
        </div>

        {/* Quick stats row */}
        <div className="flex border-t border-slate-700/50 divide-x divide-slate-700/50">
          <div className="flex-1 py-2.5 text-center">
            <p className="text-base font-bold text-white">{kpiStats.totalEvaluations}</p>
            <p className="text-[10px] text-slate-400">Analyses</p>
          </div>
          {isTrack('ventes') && (
            <div className="flex-1 py-2.5 text-center">
              <p className="text-base font-bold text-white">{kpiStats.totalVentes}</p>
              <p className="text-[10px] text-slate-400">Ventes 7j</p>
            </div>
          )}
          {isTrack('ca') && (
            <div className="flex-1 py-2.5 text-center">
              <p className="text-base font-bold text-white">
                {kpiStats.totalCA >= 1000
                  ? `${(kpiStats.totalCA / 1000).toFixed(1)}k€`
                  : `${kpiStats.totalCA.toFixed(0)}€`}
              </p>
              <p className="text-[10px] text-slate-400">CA 7j</p>
            </div>
          )}
          {diagnostic?.score != null && (
            <div className="flex-1 py-2.5 text-center">
              <p className="text-base font-bold text-white">
                {Number(diagnostic.score).toFixed(1)}<span className="text-xs text-slate-400">/10</span>
              </p>
              <p className="text-[10px] text-slate-400">Score</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Tab Bar ── */}
      <div className="flex-shrink-0 bg-white border-b border-gray-100">
        <div className="flex px-2">
          {[
            { id: 'competences', Icon: Award,         label: 'Compétences' },
            { id: 'kpi',         Icon: BarChart3,      label: 'KPI'         },
            { id: 'debriefs',    Icon: MessageSquare,  label: 'Analyses'    },
            { id: 'notes',       Icon: StickyNote,     label: 'Notes'       },
          ].map(({ id, Icon, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-1.5 px-3 py-3 text-xs font-medium border-b-2 transition-all flex-1 justify-center ${
                activeTab === id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Scrollable Content ── */}
      <div className="flex-1 overflow-y-auto bg-gray-50 p-4 space-y-4">

        {/* ══ TAB: Compétences ══ */}
        {activeTab === 'competences' && (
          <>
            {/* Diagnostic profile card */}
            {diagnostic ? (
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-center gap-2 mb-3">
                  <Award className="w-4 h-4 text-indigo-500" />
                  <h2 className="text-sm font-bold text-gray-800">Profil de vente</h2>
                </div>
                <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-xl p-3 border border-indigo-100/60">
                  {diagnostic.style ? (
                    <>
                      <div className="grid grid-cols-3 gap-2 mb-3">
                        <div className="bg-white rounded-xl p-2 text-center shadow-sm">
                          <p className="text-[10px] text-gray-400 mb-0.5">Style</p>
                          <p className="text-xs font-bold text-gray-800">{diagnostic.style}</p>
                        </div>
                        <div className="bg-white rounded-xl p-2 text-center shadow-sm">
                          <p className="text-[10px] text-gray-400 mb-0.5">Niveau</p>
                          <p className="text-xs font-bold text-gray-800">{diagnostic.level || 'N/A'}</p>
                        </div>
                        <div className="bg-white rounded-xl p-2 text-center shadow-sm">
                          <p className="text-[10px] text-gray-400 mb-0.5">Motivation</p>
                          <p className="text-xs font-bold text-gray-800">{diagnostic.motivation || 'N/A'}</p>
                        </div>
                      </div>
                      {diagnostic.ai_profile_summary && (
                        <div className="bg-white rounded-xl p-3 shadow-sm">
                          <p className="text-xs text-gray-700 leading-relaxed">{renderMarkdownBold(diagnostic.ai_profile_summary)}</p>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-white rounded-xl p-2 text-center shadow-sm">
                        <p className="text-[10px] text-gray-400 mb-0.5">Score</p>
                        <p className="text-sm font-bold text-gray-800">
                          {diagnostic.score != null ? `${Number(diagnostic.score).toFixed(1)} / 10` : 'N/A'}
                        </p>
                      </div>
                      <div className="bg-white rounded-xl p-2 text-center shadow-sm">
                        <p className="text-[10px] text-gray-400 mb-0.5">Profil</p>
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
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Award className="w-4 h-4 text-amber-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-amber-800">Diagnostic non complété</p>
                  <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                    {seller.name} n'a pas encore effectué son diagnostic. Il doit se connecter à son compte pour le compléter.
                  </p>
                </div>
              </div>
            )}

            {/* Charts grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Radar */}
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-4 h-4 text-blue-500" />
                  <h3 className="text-sm font-bold text-gray-800">Compétences actuelles</h3>
                </div>
                {hasAnyScore ? (
                  <ResponsiveContainer width="100%" height={210}>
                    <RadarChart data={radarData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
                      <PolarGrid stroke="#e2e8f0" />
                      <PolarAngleAxis dataKey="skill" tick={{ fill: '#64748b', fontSize: 11 }} />
                      <PolarRadiusAxis angle={30} domain={[0, 10]} tick={false} axisLine={false} />
                      <Radar name="Score" dataKey="value" stroke="#6366f1" fill="#6366f1" fillOpacity={0.25} strokeWidth={2} dot={{ r: 3, fill: '#6366f1' }} />
                    </RadarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[210px] flex flex-col items-center justify-center text-gray-400 gap-2">
                    <BarChart3 className="w-8 h-8 opacity-30" />
                    <p className="text-xs text-center">
                      {currentCompetences
                        ? 'Aucune compétence évaluée — scores à 0'
                        : 'Diagnostic non complété'}
                    </p>
                  </div>
                )}
              </div>

              {/* Evolution */}
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                    <h3 className="text-sm font-bold text-gray-800">Évolution du score global</h3>
                  </div>
                  {evolutionData.length > 0 && (
                    <span className="text-xs font-bold text-blue-600">
                      {evolutionData[evolutionData.length - 1]['Score Global']}/50
                      {evolutionData.length > 1 && (
                        <span className={`ml-1 text-[10px] font-medium ${
                          evolutionData[evolutionData.length - 1]['Score Global'] - evolutionData[0]['Score Global'] >= 0
                            ? 'text-emerald-600' : 'text-red-500'
                        }`}>
                          ({evolutionData[evolutionData.length - 1]['Score Global'] - evolutionData[0]['Score Global'] >= 0 ? '+' : ''}
                          {(evolutionData[evolutionData.length - 1]['Score Global'] - evolutionData[0]['Score Global']).toFixed(1)})
                        </span>
                      )}
                    </span>
                  )}
                </div>
                {evolutionData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={210}>
                    <LineChart data={evolutionData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="fullDate" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                      <YAxis domain={[0, 50]} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                      <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '12px' }} />
                      <Line type="monotone" dataKey="Score Global" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3, fill: '#10b981' }} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[210px] flex flex-col items-center justify-center text-gray-400 gap-2">
                    <TrendingUp className="w-8 h-8 opacity-30" />
                    <p className="text-xs">Pas encore d'historique</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* ══ TAB: KPI ══ */}
        {activeTab === 'kpi' && (
          <>
            {kpiEntries.length > 0 ? (
              <>
                {/* Controls: period filter + chart toggles */}
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide">Période</h3>
                    <div className="flex gap-1">
                      {['7j', '30j', 'tout'].map(f => (
                        <button
                          key={f}
                          onClick={() => setKpiFilter(f)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                            kpiFilter === f ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                          }`}
                        >
                          {f === 'tout' ? 'Tout' : f}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Chart toggles */}
                  {Object.values(availableCharts).some(v => v) && (
                    <div className="flex flex-wrap gap-1.5 pt-2 border-t border-gray-100">
                      {[
                        { key: 'ca',             label: 'CA',        color: '#6366f1', avail: availableCharts.ca },
                        { key: 'ventes',         label: 'Ventes',    color: '#10b981', avail: availableCharts.ventes },
                        { key: 'clients',        label: 'Clients',   color: '#9333ea', avail: availableCharts.clients },
                        { key: 'articles',       label: 'Articles',  color: '#f59e0b', avail: availableCharts.articles },
                        { key: 'ventesVsClients',label: 'V vs C',    color: '#6366f1', avail: availableCharts.ventesVsClients },
                        { key: 'panierMoyen',    label: 'Panier',    color: '#14b8a6', avail: availableCharts.panierMoyen },
                        { key: 'tauxTransfo',    label: 'Transfo',   color: '#ec4899', avail: availableCharts.tauxTransfo },
                        { key: 'indiceVente',    label: 'Indice',    color: '#f97316', avail: availableCharts.indiceVente },
                      ].filter(c => c.avail).map(({ key, label, color }) => (
                        <button
                          key={key}
                          onClick={() => setVisibleCharts(prev => ({ ...prev, [key]: !prev[key] }))}
                          className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all border ${
                            visibleCharts[key]
                              ? 'text-white border-transparent'
                              : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                          }`}
                          style={visibleCharts[key] ? { backgroundColor: color } : {}}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* KPI metric cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  {isTrack('ca') && (
                    <div className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100 text-center">
                      <p className="text-[10px] font-medium text-gray-400 mb-1 uppercase tracking-wide">CA Total</p>
                      <p className="text-lg font-bold text-indigo-600">{(kpiMetrics?.ca ?? 0).toFixed(2)}€</p>
                    </div>
                  )}
                  {isTrack('ventes') && (
                    <div className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100 text-center">
                      <p className="text-[10px] font-medium text-gray-400 mb-1 uppercase tracking-wide">Ventes</p>
                      <p className="text-lg font-bold text-emerald-600">{kpiMetrics?.ventes ?? 0}</p>
                    </div>
                  )}
                  {isTrack('prospects') && (
                    <div className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100 text-center">
                      <p className="text-[10px] font-medium text-gray-400 mb-1 uppercase tracking-wide">Prospects</p>
                      <p className="text-lg font-bold text-purple-600">{kpiMetrics?.prospects ?? 0}</p>
                    </div>
                  )}
                  {isTrack('ca') && isTrack('ventes') && (
                    <div className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100 text-center">
                      <p className="text-[10px] font-medium text-gray-400 mb-1 uppercase tracking-wide">Panier Moy.</p>
                      <p className="text-lg font-bold text-orange-500">{(kpiMetrics?.panier_moyen ?? 0).toFixed(2)}€</p>
                    </div>
                  )}
                  {isTrack('ca') && isTrack('ventes') && isTrack('articles') && (
                    <div className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100 text-center">
                      <p className="text-[10px] font-medium text-gray-400 mb-1 uppercase tracking-wide">Indice Vente</p>
                      <p className="text-lg font-bold text-amber-600">{(kpiMetrics?.indice_vente ?? 0).toFixed(2)}</p>
                    </div>
                  )}
                </div>

                {/* Charts grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* CA */}
                  {availableCharts.ca && visibleCharts.ca && (
                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                      <div className="flex items-center gap-1.5 mb-3">
                        <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block" />
                        <h3 className="text-xs font-bold text-gray-700">Chiffre d'affaires</h3>
                      </div>
                      <ResponsiveContainer width="100%" height={160}>
                        <BarChart data={(() => {
                          const fe = kpiFilter === '7j' ? kpiEntries.filter(e => new Date(e.date) >= new Date(Date.now() - 7*864e5))
                            : kpiFilter === '30j' ? kpiEntries.filter(e => new Date(e.date) >= new Date(Date.now() - 30*864e5)) : kpiEntries;
                          return fe.sort((a,b) => new Date(a.date)-new Date(b.date)).map(e => ({
                            date: new Date(e.date).toLocaleDateString('fr-FR', {day:'2-digit',month:'2-digit'}), CA: e.ca_journalier || 0
                          }));
                        })()}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                          <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                          <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '11px' }} formatter={v => `${v.toFixed(2)}€`} />
                          <Bar dataKey="CA" fill="#6366f1" radius={[4,4,0,0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* Ventes */}
                  {availableCharts.ventes && visibleCharts.ventes && (
                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                      <div className="flex items-center gap-1.5 mb-3">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                        <h3 className="text-xs font-bold text-gray-700">Nombre de ventes</h3>
                      </div>
                      <ResponsiveContainer width="100%" height={160}>
                        <BarChart data={(() => {
                          const fe = kpiFilter === '7j' ? kpiEntries.filter(e => new Date(e.date) >= new Date(Date.now() - 7*864e5))
                            : kpiFilter === '30j' ? kpiEntries.filter(e => new Date(e.date) >= new Date(Date.now() - 30*864e5)) : kpiEntries;
                          return fe.sort((a,b) => new Date(a.date)-new Date(b.date)).map(e => ({
                            date: new Date(e.date).toLocaleDateString('fr-FR', {day:'2-digit',month:'2-digit'}), Ventes: e.nb_ventes || 0
                          }));
                        })()}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                          <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                          <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '11px' }} />
                          <Bar dataKey="Ventes" fill="#10b981" radius={[4,4,0,0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* Clients */}
                  {availableCharts.clients && visibleCharts.clients && (
                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                      <div className="flex items-center gap-1.5 mb-3">
                        <span className="w-2.5 h-2.5 rounded-full bg-purple-500 inline-block" />
                        <h3 className="text-xs font-bold text-gray-700">Clients servis</h3>
                      </div>
                      <ResponsiveContainer width="100%" height={160}>
                        <BarChart data={(() => {
                          const fe = kpiFilter === '7j' ? kpiEntries.filter(e => new Date(e.date) >= new Date(Date.now() - 7*864e5))
                            : kpiFilter === '30j' ? kpiEntries.filter(e => new Date(e.date) >= new Date(Date.now() - 30*864e5)) : kpiEntries;
                          return fe.sort((a,b) => new Date(a.date)-new Date(b.date)).map(e => ({
                            date: new Date(e.date).toLocaleDateString('fr-FR', {day:'2-digit',month:'2-digit'}), Clients: e.nb_clients || 0
                          }));
                        })()}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                          <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                          <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '11px' }} />
                          <Bar dataKey="Clients" fill="#9333ea" radius={[4,4,0,0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* Articles */}
                  {availableCharts.articles && visibleCharts.articles && (
                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                      <div className="flex items-center gap-1.5 mb-3">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                        <h3 className="text-xs font-bold text-gray-700">Articles vendus</h3>
                      </div>
                      <ResponsiveContainer width="100%" height={160}>
                        <BarChart data={(() => {
                          const fe = kpiFilter === '7j' ? kpiEntries.filter(e => new Date(e.date) >= new Date(Date.now() - 7*864e5))
                            : kpiFilter === '30j' ? kpiEntries.filter(e => new Date(e.date) >= new Date(Date.now() - 30*864e5)) : kpiEntries;
                          return fe.sort((a,b) => new Date(a.date)-new Date(b.date)).map(e => ({
                            date: new Date(e.date).toLocaleDateString('fr-FR', {day:'2-digit',month:'2-digit'}), Articles: e.nb_articles || 0
                          }));
                        })()}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                          <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                          <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '11px' }} />
                          <Bar dataKey="Articles" fill="#f59e0b" radius={[4,4,0,0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* Ventes vs Clients */}
                  {availableCharts.ventesVsClients && visibleCharts.ventesVsClients && (
                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                      <div className="flex items-center gap-1.5 mb-3">
                        <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 inline-block" />
                        <h3 className="text-xs font-bold text-gray-700">Ventes vs Clients</h3>
                      </div>
                      <ResponsiveContainer width="100%" height={160}>
                        <BarChart data={(() => {
                          const fe = kpiFilter === '7j' ? kpiEntries.filter(e => new Date(e.date) >= new Date(Date.now() - 7*864e5))
                            : kpiFilter === '30j' ? kpiEntries.filter(e => new Date(e.date) >= new Date(Date.now() - 30*864e5)) : kpiEntries;
                          return fe.sort((a,b) => new Date(a.date)-new Date(b.date)).map(e => ({
                            date: new Date(e.date).toLocaleDateString('fr-FR', {day:'2-digit',month:'2-digit'}),
                            Ventes: e.nb_ventes || 0, Clients: e.nb_clients || 0
                          }));
                        })()}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                          <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                          <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '11px' }} />
                          <Legend wrapperStyle={{ fontSize: '10px' }} />
                          <Bar dataKey="Ventes" fill="#fbbf24" radius={[4,4,0,0]} />
                          <Bar dataKey="Clients" fill="#93c5fd" radius={[4,4,0,0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* Panier Moyen */}
                  {availableCharts.panierMoyen && visibleCharts.panierMoyen && (
                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                      <div className="flex items-center gap-1.5 mb-3">
                        <span className="w-2.5 h-2.5 rounded-full bg-teal-500 inline-block" />
                        <h3 className="text-xs font-bold text-gray-700">Panier Moyen</h3>
                      </div>
                      <ResponsiveContainer width="100%" height={160}>
                        <LineChart data={(() => {
                          const fe = kpiFilter === '7j' ? kpiEntries.filter(e => new Date(e.date) >= new Date(Date.now() - 7*864e5))
                            : kpiFilter === '30j' ? kpiEntries.filter(e => new Date(e.date) >= new Date(Date.now() - 30*864e5)) : kpiEntries;
                          return fe.sort((a,b) => new Date(a.date)-new Date(b.date)).map(e => ({
                            date: new Date(e.date).toLocaleDateString('fr-FR', {day:'2-digit',month:'2-digit'}),
                            PanierMoyen: e.nb_ventes > 0 ? (e.ca_journalier / e.nb_ventes) : 0
                          }));
                        })()}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                          <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                          <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '11px' }} formatter={v => `${v.toFixed(2)}€`} />
                          <Line type="monotone" dataKey="PanierMoyen" stroke="#14b8a6" strokeWidth={2} dot={{ r: 2 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* Taux Transformation */}
                  {availableCharts.tauxTransfo && visibleCharts.tauxTransfo && (
                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                      <div className="flex items-center gap-1.5 mb-3">
                        <span className="w-2.5 h-2.5 rounded-full bg-pink-500 inline-block" />
                        <h3 className="text-xs font-bold text-gray-700">Taux Transformation</h3>
                      </div>
                      <ResponsiveContainer width="100%" height={160}>
                        <LineChart data={(() => {
                          const fe = kpiFilter === '7j' ? kpiEntries.filter(e => new Date(e.date) >= new Date(Date.now() - 7*864e5))
                            : kpiFilter === '30j' ? kpiEntries.filter(e => new Date(e.date) >= new Date(Date.now() - 30*864e5)) : kpiEntries;
                          return fe.sort((a,b) => new Date(a.date)-new Date(b.date)).map(e => ({
                            date: new Date(e.date).toLocaleDateString('fr-FR', {day:'2-digit',month:'2-digit'}),
                            TauxTransfo: e.taux_transformation || 0
                          }));
                        })()}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                          <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                          <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '11px' }} formatter={v => `${v.toFixed(2)}%`} />
                          <Line type="monotone" dataKey="TauxTransfo" stroke="#ec4899" strokeWidth={2} dot={{ r: 2 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* Indice de Vente */}
                  {availableCharts.indiceVente && visibleCharts.indiceVente && (
                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                      <div className="flex items-center gap-1.5 mb-3">
                        <span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block" />
                        <h3 className="text-xs font-bold text-gray-700">Indice de Vente</h3>
                      </div>
                      <ResponsiveContainer width="100%" height={160}>
                        <LineChart data={(() => {
                          const fe = kpiFilter === '7j' ? kpiEntries.filter(e => new Date(e.date) >= new Date(Date.now() - 7*864e5))
                            : kpiFilter === '30j' ? kpiEntries.filter(e => new Date(e.date) >= new Date(Date.now() - 30*864e5)) : kpiEntries;
                          return fe.sort((a,b) => new Date(a.date)-new Date(b.date)).map(e => ({
                            date: new Date(e.date).toLocaleDateString('fr-FR', {day:'2-digit',month:'2-digit'}),
                            IndiceVente: e.indice_vente !== undefined && e.indice_vente !== null
                              ? e.indice_vente
                              : (e.nb_ventes > 0 ? (e.nb_articles / e.nb_ventes) : 0)
                          }));
                        })()}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                          <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                          <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '11px' }} formatter={v => v.toFixed(2)} />
                          <Line type="monotone" dataKey="IndiceVente" stroke="#f97316" strokeWidth={2} dot={{ r: 2 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <BarChart3 className="w-10 h-10 text-gray-200" />
                <p className="text-sm font-medium text-gray-400">Aucune donnée KPI disponible</p>
              </div>
            )}
          </>
        )}

        {/* ══ TAB: Analyses ══ */}
        {activeTab === 'debriefs' && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className="w-4 h-4 text-blue-500" />
              <h2 className="text-sm font-bold text-gray-800">Dernières analyses des ventes</h2>
            </div>

            {debriefs.length > 0 ? (
              <>
                <div className="flex gap-1.5 mb-4">
                  {[
                    { id: 'all',     label: `Toutes (${debriefs.length})`,                                     cls: 'bg-slate-700 text-white' },
                    { id: 'success', label: `✅ Réussies (${debriefs.filter(d => d.vente_conclue === true).length})`,  cls: 'bg-green-600 text-white'  },
                    { id: 'missed',  label: `❌ Manquées (${debriefs.filter(d => d.vente_conclue === false).length})`, cls: 'bg-orange-600 text-white'  },
                  ].map(f => (
                    <button
                      key={f.id}
                      onClick={() => setDebriefFilter(f.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                        debriefFilter === f.id ? f.cls : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <div className="space-y-2">
                  {debriefs
                    .filter(d => debriefFilter === 'success' ? d.vente_conclue === true : debriefFilter === 'missed' ? d.vente_conclue === false : true)
                    .slice(0, showAllDebriefs ? debriefs.length : 3)
                    .map(debrief => {
                      const isConclue = debrief.vente_conclue === true;
                      return (
                        <div
                          key={debrief.id}
                          className={`rounded-xl border border-gray-100 bg-gray-50 overflow-hidden border-l-4 ${isConclue ? 'border-l-green-400' : 'border-l-orange-400'}`}
                        >
                          <button
                            onClick={() => toggleDebrief(debrief.id)}
                            className="w-full p-3 text-left hover:bg-gray-100/80 transition-colors"
                          >
                            <div className="flex justify-between items-start">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${isConclue ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                    {isConclue ? '✅ Réussi' : '❌ Manqué'}
                                  </span>
                                  <span className="text-[11px] text-gray-400">
                                    {new Date(debrief.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                                  </span>
                                </div>
                                <p className="text-xs text-gray-600 truncate">
                                  {debrief.produit || debrief.context || 'N/A'} · {debrief.type_client || debrief.customer_profile || 'N/A'}
                                </p>
                                {!expandedDebriefs[debrief.id] && (
                                  <p className="text-xs text-gray-400 truncate mt-0.5">
                                    {debrief.description_vente || debrief.demarche_commerciale || ''}
                                  </p>
                                )}
                              </div>
                              <span className="ml-2 text-gray-400 text-base flex-shrink-0">{expandedDebriefs[debrief.id] ? '−' : '+'}</span>
                            </div>
                          </button>

                          {expandedDebriefs[debrief.id] && (
                            <div className="px-3 pb-3 space-y-2 border-t border-gray-100 pt-2">
                              {debrief.ai_recommendation && (
                                <div className="bg-blue-50 rounded-xl p-2.5">
                                  <p className="text-[10px] font-semibold text-blue-700 mb-1">💡 Recommandation IA</p>
                                  <p className="text-xs text-blue-800 leading-relaxed">{debrief.ai_recommendation}</p>
                                </div>
                              )}
                              <div className="grid grid-cols-5 gap-1.5">
                                <div className="bg-purple-50 rounded-lg p-1.5 text-center">
                                  <p className="text-[10px] text-purple-600">Accueil</p>
                                  <p className="text-sm font-bold text-purple-900">{debrief.score_accueil ?? 0}/10</p>
                                </div>
                                <div className="bg-green-50 rounded-lg p-1.5 text-center">
                                  <p className="text-[10px] text-green-600">{LABEL_DECOUVERTE}</p>
                                  <p className="text-sm font-bold text-green-900">{debrief.score_decouverte ?? 0}/10</p>
                                </div>
                                <div className="bg-orange-50 rounded-lg p-1.5 text-center">
                                  <p className="text-[10px] text-orange-600">Argum.</p>
                                  <p className="text-sm font-bold text-orange-900">{debrief.score_argumentation ?? 0}/10</p>
                                </div>
                                <div className="bg-red-50 rounded-lg p-1.5 text-center">
                                  <p className="text-[10px] text-red-600">Closing</p>
                                  <p className="text-sm font-bold text-red-900">{debrief.score_closing ?? 0}/10</p>
                                </div>
                                <div className="bg-blue-50 rounded-lg p-1.5 text-center">
                                  <p className="text-[10px] text-blue-600">Fidél.</p>
                                  <p className="text-sm font-bold text-blue-900">{debrief.score_fidelisation ?? 0}/10</p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>

                {debriefs.length > 3 && (
                  <div className="mt-4 text-center">
                    <button
                      onClick={() => setShowAllDebriefs(!showAllDebriefs)}
                      className="px-4 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-xs font-medium transition-colors"
                    >
                      {showAllDebriefs ? '↑ Voir moins' : `↓ Charger plus (${debriefs.length - 3} autres)`}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <MessageSquare className="w-8 h-8 text-gray-200" />
                <p className="text-sm text-gray-400">Aucune analyse de vente pour le moment</p>
              </div>
            )}
          </div>
        )}

        {/* ══ TAB: Conflit (navigable via _openTab) ══ */}
        {activeTab === 'conflit' && (
          <ConflictResolutionForm sellerId={seller.id} sellerName={seller.name} />
        )}

        {/* ══ TAB: Notes ══ */}
        {activeTab === 'notes' && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <StickyNote className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-bold text-gray-800">Notes partagées</h3>
              </div>
              {sharedNotes.length > 0 && (
                <span className="text-xs bg-amber-100 text-amber-700 font-semibold px-2 py-0.5 rounded-full">
                  {sharedNotes.length}
                </span>
              )}
            </div>

            {notesLoading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-7 w-7 border-2 border-amber-500 border-t-transparent" />
              </div>
            ) : sharedNotes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center">
                  <StickyNote className="w-7 h-7 text-amber-300" />
                </div>
                <div>
                  <p className="font-semibold text-gray-700 text-sm">Aucune note partagée</p>
                  <p className="text-gray-400 text-xs mt-1">{seller.name} n'a pas encore partagé de notes avec vous.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {sharedNotes.map(note => (
                  <div key={note.id} className="bg-amber-50 border border-amber-100 rounded-xl p-3.5">
                    <span className="text-[11px] font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                      {formatNoteDate(note.date || note.created_at)}
                    </span>
                    <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap leading-relaxed">{note.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>{/* end scrollable */}
    </div>
  );
}
