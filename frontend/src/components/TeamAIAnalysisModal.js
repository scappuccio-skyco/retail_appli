import React, { useState } from 'react';
import axios from 'axios';
import { X } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function TeamAIAnalysisModal({ teamData, onClose }) {
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleGenerateAnalysis = async () => {
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      
      // Prepare team context for AI
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

      const res = await axios.post(
        `${API}/manager/analyze-team`,
        { team_data: teamContext },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setAiAnalysis(res.data.analysis);
      toast.success('Analyse IA générée !');
    } catch (err) {
      console.error('Error generating AI analysis:', err);
      toast.error('Erreur lors de l\'analyse IA');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
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

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(80vh-120px)]">
          {!aiAnalysis && !loading && (
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

          {loading && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-600 mb-4"></div>
              <p className="text-indigo-700 font-medium">Génération de l'analyse en cours...</p>
            </div>
          )}

          {aiAnalysis && !loading && (
            <div className="space-y-4">
              <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg p-6 border-2 border-indigo-200">
                <div className="space-y-3">
                  {aiAnalysis.split('\n').map((line, idx) => {
                    // Section titles (##)
                    if (line.startsWith('## ')) {
                      return (
                        <h4 key={`title-${idx}`} className="text-base font-bold text-indigo-900 mt-4 mb-2 flex items-center gap-2">
                          <span className="w-1 h-5 bg-indigo-600 rounded"></span>
                          {line.replace('## ', '')}
                        </h4>
                      );
                    }
                    // List items (-)
                    if (line.startsWith('- ')) {
                      const content = line.replace('- ', '');
                      const parts = content.split(/(\*\*.*?\*\*)/g);
                      return (
                        <div key={`item-${idx}`} className="flex gap-2 text-sm text-gray-700 leading-relaxed ml-2">
                          <span className="text-indigo-600 mt-1">•</span>
                          <span>
                            {parts.map((part, i) => {
                              if (part.startsWith('**') && part.endsWith('**')) {
                                return <strong key={`bold-${i}`} className="text-gray-900 font-semibold">{part.slice(2, -2)}</strong>;
                              }
                              return <span key={`text-${i}`}>{part}</span>;
                            })}
                          </span>
                        </div>
                      );
                    }
                    // Empty lines
                    if (line.trim() === '') {
                      return <div key={`space-${idx}`} className="h-2"></div>;
                    }
                    // Regular text
                    if (line.trim()) {
                      return <p key={`para-${idx}`} className="text-sm text-gray-700 leading-relaxed">{line}</p>;
                    }
                    return null;
                  })}
                </div>
              </div>

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
        </div>
      </div>
    </div>
  );
}
