import { useState, useEffect, useMemo } from 'react';
import { api } from '../../lib/apiClient';
import { LABEL_DECOUVERTE } from '../../lib/constants';
import { logger } from '../../utils/logger';
import { toast } from 'sonner';

export default function useSellerDetail(seller, storeIdParam) {
  const [diagnostic, setDiagnostic] = useState(null);
  const [debriefs, setDebriefs] = useState([]);
  const [competencesHistory, setCompetencesHistory] = useState([]);
  const [liveCompetences, setLiveCompetences] = useState(null);
  const [kpiEntries, setKpiEntries] = useState([]);
  const [kpiMetrics, setKpiMetrics] = useState(null);
  const [kpiConfig, setKpiConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedDebriefs, setExpandedDebriefs] = useState({});
  const [activeTab, setActiveTab] = useState(seller?._openTab || 'competences');
  const [sharedNotes, setSharedNotes] = useState([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [showAllDebriefs, setShowAllDebriefs] = useState(false);
  const [debriefFilter, setDebriefFilter] = useState('all');
  const [kpiFilter, setKpiFilter] = useState('7j');
  const [visibleCharts, setVisibleCharts] = useState({
    ca: true, ventes: true, clients: true, articles: true,
    ventesVsClients: true, panierMoyen: true, tauxTransfo: true, indiceVente: true,
  });

  const storeParam = storeIdParam ? `?store_id=${storeIdParam}` : '';

  useEffect(() => {
    fetchSellerData();
  }, [seller.id, storeIdParam]);

  useEffect(() => {
    if (seller?.id && !loading) {
      fetchKPIData();
    }
  }, [kpiFilter, loading]);

  useEffect(() => {
    if (activeTab === 'notes' && seller?.id) {
      fetchSharedNotes();
    }
  }, [activeTab, seller?.id]);

  const fetchSellerData = async () => {
    setLoading(true);
    try {
      const [statsRes, diagRes, debriefsRes, competencesRes, kpiConfigRes] = await Promise.all([
        api.get(`/manager/seller/${seller.id}/stats${storeParam}`),
        api.get(`/manager-diagnostic/seller/${seller.id}${storeParam}`),
        api.get(`/manager/debriefs/${seller.id}${storeParam}`),
        api.get(`/manager/competences-history/${seller.id}${storeParam}`),
        api.get(`/manager/kpi-config${storeParam}`),
      ]);

      const statsData = statsRes.data;
      const liveScores = statsData.avg_radar_scores || {
        accueil: 0, decouverte: 0, argumentation: 0, closing: 0, fidelisation: 0,
      };

      setLiveCompetences({
        type: 'live',
        date: new Date().toISOString(),
        score_accueil: liveScores.accueil || 0,
        score_decouverte: liveScores.decouverte || 0,
        score_argumentation: liveScores.argumentation || 0,
        score_closing: liveScores.closing || 0,
        score_fidelisation: liveScores.fidelisation || 0,
      });

      setDiagnostic(diagRes.data);
      setDebriefs(debriefsRes.data);
      setCompetencesHistory(competencesRes.data || []);
      setKpiConfig(kpiConfigRes.data);
    } catch (err) {
      logger.error('Error loading seller data:', err);
      toast.error('Erreur de chargement des données du vendeur');
    } finally {
      setLoading(false);
    }
  };

  const fetchKPIData = async () => {
    if (!seller?.id) return;
    try {
      const days = kpiFilter === '7j' ? 7 : kpiFilter === '30j' ? 30 : 365;
      const storeParamAnd = storeIdParam ? `&store_id=${storeIdParam}` : '';
      const [entriesRes, metricsRes] = await Promise.all([
        api.get(`/manager/kpi-entries/${seller.id}?days=${days}${storeParamAnd}`),
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

  const fetchSharedNotes = async () => {
    setNotesLoading(true);
    try {
      const res = await api.get(`/manager/sellers/${seller.id}/interview-notes${storeParam}`);
      setSharedNotes(res.data.notes || []);
      await api.patch(`/manager/sellers/${seller.id}/notes-seen${storeParam}`);
    } catch (err) {
      logger.error('Error loading shared notes:', err);
    } finally {
      setNotesLoading(false);
    }
  };

  const handleSendReply = async (noteId) => {
    if (!replyText.trim()) return;
    setSendingReply(true);
    try {
      await api.patch(
        `/manager/sellers/${seller.id}/interview-notes/${noteId}/reply${storeParam}`,
        { reply: replyText.trim() }
      );
      toast.success('Réponse envoyée');
      setReplyingTo(null);
      setReplyText('');
      await fetchSharedNotes();
    } catch (err) {
      logger.error('Error sending reply:', err);
      toast.error("Erreur lors de l'envoi de la réponse");
    } finally {
      setSendingReply(false);
    }
  };

  const toggleDebrief = (debriefId) => {
    setExpandedDebriefs(prev => ({ ...prev, [debriefId]: !prev[debriefId] }));
  };

  const currentCompetences = liveCompetences;

  const radarData = [
    { skill: 'Accueil', value: currentCompetences?.score_accueil || 0 },
    { skill: LABEL_DECOUVERTE, value: currentCompetences?.score_decouverte || 0 },
    { skill: 'Argumentation', value: currentCompetences?.score_argumentation || 0 },
    { skill: 'Closing', value: currentCompetences?.score_closing || 0 },
    { skill: 'Fidélisation', value: currentCompetences?.score_fidelisation || 0 },
  ];

  const hasAnyScore = radarData.some(d => d.value > 0);

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
      fullDate: date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
    };
  });

  const availableCharts = useMemo(() => {
    const track = (key) => {
      if (!kpiConfig) return true;
      return (
        kpiConfig[`manager_track_${key}`] === true ||
        kpiConfig[`seller_track_${key}`] === true ||
        kpiConfig[`track_${key}`] === true
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
      indiceVente: track('ca') && track('ventes') && track('articles'),
    };
  }, [kpiConfig]);

  const isTrack = (key) => {
    if (!kpiConfig) return true;
    return (
      kpiConfig[`manager_track_${key}`] === true ||
      kpiConfig[`seller_track_${key}`] === true ||
      kpiConfig[`track_${key}`] === true
    );
  };

  const last7Days = new Date();
  last7Days.setDate(last7Days.getDate() - 7);
  const recentKpis = kpiEntries.filter(e => new Date(e.date) >= last7Days);
  const kpiStats = {
    totalEvaluations: (diagnostic ? 1 : 0) + debriefs.length,
    totalVentes: recentKpis.reduce((sum, e) => sum + (e.nb_ventes || 0), 0),
    totalCA: recentKpis.reduce((sum, e) => sum + (e.ca_journalier || 0), 0),
  };

  return {
    // state
    diagnostic, debriefs, loading,
    activeTab, setActiveTab,
    expandedDebriefs, showAllDebriefs, setShowAllDebriefs,
    debriefFilter, setDebriefFilter,
    kpiEntries, kpiMetrics, kpiFilter, setKpiFilter,
    visibleCharts, setVisibleCharts,
    sharedNotes, notesLoading,
    replyingTo, setReplyingTo, replyText, setReplyText,
    sendingReply,
    // handlers
    toggleDebrief, handleSendReply,
    // computed
    currentCompetences, radarData, hasAnyScore, evolutionData,
    availableCharts, isTrack, kpiStats,
  };
}
