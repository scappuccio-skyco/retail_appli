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
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [analysisMetadata, setAnalysisMetadata] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('new'); // 'new' or 'history'
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

          {activeTab === 'history' && (
            <HistoryTab
              history={history}
              loadingHistory={loadingHistory}
              expandedItems={expandedItems}
              onToggleExpand={handleToggleExpand}
              onDeleteAnalysis={handleDeleteAnalysis}
              onCreateAnalysis={() => setActiveTab('new')}
            />
          )}
        </div>
      </div>
    </div>
  );
}
