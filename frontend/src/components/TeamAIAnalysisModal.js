import React, { useState, useEffect, useRef } from 'react';
import { api } from '../lib/apiClient';
import { logger } from '../utils/logger';
import { getSubscriptionErrorMessage } from '../utils/apiHelpers';
import { useAuth } from '../contexts';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import AnalysisContent from './teamAIAnalysis/AnalysisContent';
import LoadingOverlay from './teamAIAnalysis/LoadingOverlay';
import HistoryTab from './teamAIAnalysis/HistoryTab';

export default function TeamAIAnalysisModal({ teamData, periodFilter, customDateRange, onClose, storeIdParam = null }) {
  const { user } = useAuth();
  const isDemo = !!user?.is_demo;
  const teamTotalCA = (teamData || []).reduce((sum, s) => sum + (s.monthlyCA || 0), 0);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [analysisMetadata, setAnalysisMetadata] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showDemoPrompt, setShowDemoPrompt] = useState(false);
  const [activeTab, setActiveTab] = useState(isDemo ? 'history' : 'new'); // démo → onglet historique
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [expandedItems, setExpandedItems] = useState({});
  const generateAbortRef = useRef(null);

  // Build store_id param for gerant viewing as manager
  const storeParam = storeIdParam ? `?store_id=${storeIdParam}` : '';

  useEffect(() => {
    loadHistory();
    return () => { if (generateAbortRef.current) generateAbortRef.current.abort(); };
  }, []);

  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory();
    }
  }, [activeTab]);

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await api.get(`/manager/team-analyses-history${storeParam}`);
      setHistory(res.data.analyses || []);
    } catch (err) {
      logger.error('Error loading history:', err);
      toast.error('Erreur lors du chargement de l\'historique');
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleDeleteAnalysis = async (analysisId) => {
    if (!globalThis.confirm('Êtes-vous sûr de vouloir supprimer cette analyse ?')) {
      return;
    }
    try {
      await api.delete(`/manager/team-analysis/${analysisId}${storeParam}`);
      toast.success('Analyse supprimée');
      loadHistory();
    } catch (err) {
      logger.error('Error deleting analysis:', err);
      toast.error('Erreur lors de la suppression');
    }
  };

  const handleGenerateAnalysis = async () => {
    if (isDemo) { setShowDemoPrompt(true); return; }
    if (generateAbortRef.current) generateAbortRef.current.abort();
    generateAbortRef.current = new AbortController();

    setLoading(true);
    try {
      const teamContext = {
        total_sellers: teamData.length,
        sellers_with_kpi: teamData.filter(s => s.hasKpiToday).length,
        team_total_ca: teamData.reduce((sum, s) => sum + s.monthlyCA, 0),
        team_total_ventes: teamData.reduce((sum, s) => sum + s.monthlyVentes, 0),
        sellers_details: teamData.map(s => ({
          name: s.name,
          ca: s.monthlyCA,
          ventes: s.monthlyVentes,
          panier_moyen: s.panierMoyen,
          avg_competence: s.avgCompetence,
          best_skill: s.bestCompetence.name,
          worst_skill: s.worstCompetence.name
        }))
      };

      const requestBody = {
        team_data: teamContext,
        period_filter: periodFilter || '30'
      };

      if (periodFilter === 'custom' && customDateRange?.start && customDateRange?.end) {
        requestBody.start_date = customDateRange.start;
        requestBody.end_date = customDateRange.end;
      }

      const res = await api.post(`/manager/analyze-team${storeParam}`, requestBody, { signal: generateAbortRef.current.signal });

      setAiAnalysis(res.data.analysis);
      setAnalysisMetadata({
        period_start: res.data.period_start,
        period_end: res.data.period_end,
        generated_at: res.data.generated_at
      });
      toast.success('Analyse IA générée !');
      loadHistory();
    } catch (err) {
      if (err.code === 'ERR_CANCELED') return;
      logger.error('Error generating AI analysis:', err);
      toast.error(getSubscriptionErrorMessage(err, user?.role) || 'Erreur lors de l\'analyse IA');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleExpand = (analysisId) => {
    setExpandedItems(prev => ({ ...prev, [analysisId]: !prev[analysisId] }));
  };

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) { onClose(); } }}
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-6 text-white">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <span>🤖</span> Analyse IA de l'Équipe
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 px-6">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('new')}
              className={`px-4 py-3 font-semibold transition-colors border-b-2 ${
                activeTab === 'new'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
            >
              Nouvelle Analyse
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 py-3 font-semibold transition-colors border-b-2 ${
                activeTab === 'history'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
            >
              Historique ({history.length})
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(80vh-180px)]">
          {loading && <LoadingOverlay />}

          {showDemoPrompt && (
            <div className="mb-6 bg-indigo-50 border border-indigo-200 rounded-xl p-5 text-center">
              <div className="text-4xl mb-3">✨</div>
              <h3 className="font-bold text-indigo-800 text-lg mb-2">Fonctionnalité disponible après inscription</h3>
              <p className="text-indigo-700 text-sm mb-4">
                En mode démo, les analyses IA sont pré-chargées pour vous donner un aperçu réaliste.
                Créez un compte pour générer vos propres analyses en temps réel, basées sur les données de votre équipe.
              </p>
              <div className="flex justify-center gap-3">
                <a
                  href="/#pricing"
                  onClick={onClose}
                  className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors text-sm"
                >
                  Voir les offres
                </a>
                <button
                  onClick={() => { setShowDemoPrompt(false); setActiveTab('history'); }}
                  className="px-4 py-2 bg-white border border-indigo-300 text-indigo-700 font-medium rounded-lg hover:bg-indigo-50 transition-colors text-sm"
                >
                  Voir les exemples d'analyses
                </button>
              </div>
            </div>
          )}

          {activeTab === 'new' && !aiAnalysis && !loading && (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🤖</div>
              <p className="text-gray-600 mb-6">
                Générez une analyse IA personnalisée de votre équipe
              </p>
              <button
                onClick={handleGenerateAnalysis}
                className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all"
              >
                Lancer l'Analyse IA
              </button>
            </div>
          )}

          {activeTab === 'new' && aiAnalysis && !loading && (
            <div className="space-y-4">
              <AnalysisContent analysisText={aiAnalysis} metadata={analysisMetadata} />
              <div className="flex justify-center gap-3">
                <button
                  onClick={handleGenerateAnalysis}
                  className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-medium rounded-lg hover:shadow-lg transition-all"
                >
                  🔄 Régénérer l'analyse
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Fermer
                </button>
              </div>
            </div>
          )}

          {activeTab === 'history' && isDemo && teamTotalCA === 0 ? (
            <div className="text-center py-12">
              <div className="text-5xl mb-4">📭</div>
              <p className="font-semibold text-gray-700 mb-2">Aucune donnée pour cette période</p>
              <p className="text-sm text-gray-500">Naviguez vers une période avec des ventes pour voir des exemples d'analyses.</p>
            </div>
          ) : activeTab === 'history' && (
            <HistoryTab
              history={history}
              loadingHistory={loadingHistory}
              expandedItems={expandedItems}
              onToggleExpand={handleToggleExpand}
              onDeleteAnalysis={handleDeleteAnalysis}
              onCreateAnalysis={() => setActiveTab('new')}
              isDemo={isDemo}
            />
          )}
        </div>
      </div>
    </div>
  );
}
