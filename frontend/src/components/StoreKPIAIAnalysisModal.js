import React, { useState } from 'react';
import axios from 'axios';
import { X } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function StoreKPIAIAnalysisModal({ 
  kpiData, 
  analysisType, // 'daily' or 'overview'
  viewContext, // For overview: { viewMode, period, historicalData }
  onClose 
}) {
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleGenerateAnalysis = async () => {
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      let endpoint = '';
      let payload = {};

      if (analysisType === 'daily') {
        endpoint = `${API}/manager/analyze-store-kpis`;
        payload = { kpi_data: kpiData };
      } else if (analysisType === 'overview') {
        endpoint = `${API}/manager/analyze-store-kpis`;
        
        // Calculate aggregated metrics
        const { historicalData, viewMode, period } = viewContext;
        const totalCA = historicalData.reduce((sum, d) => sum + d.total_ca, 0);
        const totalVentes = historicalData.reduce((sum, d) => sum + d.total_ventes, 0);
        const totalClients = historicalData.reduce((sum, d) => sum + d.total_clients, 0);
        const totalArticles = historicalData.reduce((sum, d) => sum + d.total_articles, 0);
        const totalProspects = historicalData.reduce((sum, d) => sum + d.total_prospects, 0);
        const avgPanierMoyen = totalVentes > 0 ? totalCA / totalVentes : 0;
        const avgTauxTransformation = totalProspects > 0 ? (totalVentes / totalProspects) * 100 : 0;
        const avgIndiceVente = totalClients > 0 ? totalArticles / totalClients : 0;

        // Format compatible avec l'endpoint backend
        payload = {
          kpi_data: {
            date: period,
            sellers_reported: historicalData.length,
            total_sellers: historicalData.length,
            calculated_kpis: {
              panier_moyen: parseFloat(avgPanierMoyen.toFixed(2)),
              taux_transformation: parseFloat(avgTauxTransformation.toFixed(2)),
              indice_vente: parseFloat(avgIndiceVente.toFixed(2))
            },
            totals: {
              ca: parseFloat(totalCA.toFixed(2)),
              ventes: Math.round(totalVentes),
              clients: Math.round(totalClients),
              articles: Math.round(totalArticles),
              prospects: Math.round(totalProspects)
            },
            trend_data: historicalData.slice(-5).map(d => ({
              date: d.date,
              ca: d.total_ca,
              ventes: d.total_ventes
            }))
          }
        };
      }

      const res = await axios.post(endpoint, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setAiAnalysis(res.data.analysis);
      toast.success('Analyse IA générée !');
    } catch (err) {
      console.error('Error generating AI analysis:', err);
      toast.error('Erreur lors de l\'analyse IA');
    } finally {
      setLoading(false);
    }
  };

  const getTitle = () => {
    if (analysisType === 'daily') {
      return '🤖 Analyse IA - Vue au quotidien';
    } else if (analysisType === 'overview') {
      const { viewMode } = viewContext;
      if (viewMode === 'week') return '🤖 Analyse IA - Vue Hebdomadaire';
      if (viewMode === 'month') return '🤖 Analyse IA - Vue Mensuelle';
      return '🤖 Analyse IA - Vue Multi-périodes';
    }
    return '🤖 Analyse IA';
  };

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) { onClose(); } }} className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-4 sm:p-6 text-white">
          <div className="flex items-center justify-between">
            <h2 className="text-lg sm:text-2xl font-bold">{getTitle()}</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(80vh-120px)]">
          {!aiAnalysis && !loading && (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🤖</div>
              <p className="text-gray-600 mb-6">
                Générez une analyse IA personnalisée de vos KPI
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
              {(() => {
                const sections = [];
                let currentSection = null;
                const colors = [
                  { bg: 'bg-blue-50', border: 'border-blue-200', title: 'bg-blue-500', text: 'text-blue-900' },
                  { bg: 'bg-green-50', border: 'border-green-200', title: 'bg-green-500', text: 'text-green-900' },
                  { bg: 'bg-orange-50', border: 'border-orange-200', title: 'bg-orange-500', text: 'text-orange-900' },
                  { bg: 'bg-purple-50', border: 'border-purple-200', title: 'bg-purple-500', text: 'text-purple-900' },
                  { bg: 'bg-pink-50', border: 'border-pink-200', title: 'bg-pink-500', text: 'text-pink-900' }
                ];
                let colorIndex = 0;

                aiAnalysis.split('\n').forEach((line) => {
                  if (line.startsWith('## ')) {
                    if (currentSection) {
                      sections.push(currentSection);
                    }
                    currentSection = {
                      title: line.replace('## ', ''),
                      content: [],
                      color: colors[colorIndex % colors.length]
                    };
                    colorIndex++;
                  } else if (currentSection) {
                    currentSection.content.push(line);
                  }
                });

                if (currentSection) {
                  sections.push(currentSection);
                }

                return sections.map((section, sIdx) => (
                  <div key={`section-${sIdx}`} className={`${section.color.bg} rounded-xl border-2 ${section.color.border} overflow-hidden shadow-sm`}>
                    <div className={`${section.color.title} text-white px-4 py-3`}>
                      <h3 className="text-base sm:text-lg font-bold">{section.title}</h3>
                    </div>
                    <div className="p-4 space-y-3">
                      {section.content.map((line, idx) => {
                        if (line.startsWith('- ')) {
                          const content = line.replace('- ', '');
                          const parts = content.split(/(\*\*.*?\*\*)/g);
                          return (
                            <div key={`item-${idx}`} className="flex gap-2 text-sm leading-relaxed">
                              <span className={`${section.color.text} mt-1 font-bold`}>•</span>
                              <span className="text-gray-700">
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
                        if (line.trim() === '') {
                          return <div key={`space-${idx}`} className="h-1"></div>;
                        }
                        if (line.trim()) {
                          return <p key={`para-${idx}`} className="text-sm text-gray-700 leading-relaxed">{line}</p>;
                        }
                        return null;
                      })}
                    </div>
                  </div>
                ));
              })()}

              <div className="flex justify-center gap-3 mt-4">
                <button
                  onClick={handleGenerateAnalysis}
                  className="px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-medium rounded-lg hover:shadow-lg transition-all"
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
