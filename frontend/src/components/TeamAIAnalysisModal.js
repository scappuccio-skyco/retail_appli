import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { X, Trash2, Calendar, Clock, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function TeamAIAnalysisModal({ teamData, onClose }) {
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [analysisMetadata, setAnalysisMetadata] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('new'); // 'new' or 'history'
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [expandedItems, setExpandedItems] = useState({});

  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory();
    }
  }, [activeTab]);

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(
        `${API}/manager/team-analyses-history`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setHistory(res.data.analyses || []);
    } catch (err) {
      console.error('Error loading history:', err);
      toast.error('Erreur lors du chargement de l\'historique');
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleDeleteAnalysis = async (analysisId) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette analyse ?')) {
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      await axios.delete(
        `${API}/manager/team-analysis/${analysisId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Analyse supprimée');
      loadHistory();
    } catch (err) {
      console.error('Error deleting analysis:', err);
      toast.error('Erreur lors de la suppression');
    }
  };

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
      setAnalysisMetadata({
        period_start: res.data.period_start,
        period_end: res.data.period_end,
        generated_at: res.data.generated_at
      });
      toast.success('Analyse IA générée !');
      
      // Refresh history
      loadHistory();
    } catch (err) {
      console.error('Error generating AI analysis:', err);
      toast.error('Erreur lors de l\'analyse IA');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) { onClose(); } }} className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
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

          {loading && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
              <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
                <div className="text-center mb-6">
                  <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center animate-pulse">
                    <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-800 mb-2">
                    Analyse en cours...
                  </h3>
                  <p className="text-gray-600">
                    L'IA analyse les performances de votre équipe
                  </p>
                </div>
                
                {/* Progress Bar */}
                <div className="relative w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-500 via-indigo-500 to-purple-500 animate-progress-slide"></div>
                </div>
                
                <div className="mt-4 text-center text-sm text-gray-500">
                  <p>⏱️ Temps estimé : 30-60 secondes</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'new' && aiAnalysis && !loading && (
            <div className="space-y-4">
              {/* Métadonnées de l'analyse */}
              {analysisMetadata && (
                <div className="bg-white rounded-xl p-4 shadow-sm border-2 border-gray-200">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar className="w-4 h-4" />
                      <span className="font-semibold">Période :</span>
                      <span>
                        {new Date(analysisMetadata.period_start).toLocaleDateString('fr-FR')} 
                        {' → '}
                        {new Date(analysisMetadata.period_end).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Clock className="w-4 h-4" />
                      <span className="font-semibold">Générée le :</span>
                      <span>
                        {new Date(analysisMetadata.generated_at).toLocaleDateString('fr-FR')} à{' '}
                        {new Date(analysisMetadata.generated_at).toLocaleTimeString('fr-FR', { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="bg-gradient-to-br from-orange-50 to-yellow-50 rounded-xl p-6 space-y-4">
                {(() => {
                  const sections = aiAnalysis.split('##').filter(s => s.trim());
                  
                  // Palette de couleurs variées selon la charte graphique
                  const colorPalette = [
                    {
                      badge: 'bg-indigo-100 text-indigo-800',
                      card: 'bg-indigo-50 border-indigo-200',
                      icon: '📊',
                      gradient: 'from-indigo-500 to-purple-600'
                    },
                    {
                      badge: 'bg-green-100 text-green-800',
                      card: 'bg-green-50 border-green-200',
                      icon: '✅',
                      gradient: 'from-green-500 to-emerald-600'
                    },
                    {
                      badge: 'bg-orange-100 text-orange-800',
                      card: 'bg-orange-50 border-orange-200',
                      icon: '⚠️',
                      gradient: 'from-orange-500 to-red-500'
                    },
                    {
                      badge: 'bg-purple-100 text-purple-800',
                      card: 'bg-purple-50 border-purple-200',
                      icon: '🎯',
                      gradient: 'from-purple-500 to-indigo-600'
                    },
                    {
                      badge: 'bg-teal-100 text-teal-800',
                      card: 'bg-teal-50 border-teal-200',
                      icon: '💡',
                      gradient: 'from-teal-500 to-cyan-600'
                    },
                    {
                      badge: 'bg-pink-100 text-pink-800',
                      card: 'bg-pink-50 border-pink-200',
                      icon: '🌟',
                      gradient: 'from-pink-500 to-rose-600'
                    }
                  ];
                  
                  return sections.map((section, sectionIdx) => {
                    const lines = section.trim().split('\n');
                    // Supprimer les ** du titre
                    const title = lines[0].trim().replace(/\*\*/g, '');
                    const content = lines.slice(1).join('\n').trim();
                    
                    // Déterminer la couleur selon le type de section avec fallback sur rotation
                    let colorScheme;
                    const titleLower = title.toLowerCase();
                    
                    if (titleLower.includes('force') || titleLower.includes('positif') || titleLower.includes('réussite')) {
                      colorScheme = colorPalette[1]; // Vert
                    } else if (titleLower.includes('attention') || titleLower.includes('faible') || titleLower.includes('améliorer') || titleLower.includes('difficulté')) {
                      colorScheme = colorPalette[2]; // Orange
                    } else if (titleLower.includes('recommandation') || titleLower.includes('action') || titleLower.includes('priorité')) {
                      colorScheme = colorPalette[3]; // Purple
                    } else if (titleLower.includes('analyse') || titleLower.includes('synthèse') || titleLower.includes('résumé')) {
                      colorScheme = colorPalette[0]; // Indigo
                    } else if (titleLower.includes('opportunité') || titleLower.includes('potentiel') || titleLower.includes('développement')) {
                      colorScheme = colorPalette[4]; // Teal
                    } else {
                      // Rotation des couleurs pour les autres sections
                      colorScheme = colorPalette[sectionIdx % colorPalette.length];
                    }
                    
                    return (
                      <div key={sectionIdx} className={`rounded-xl p-5 shadow-sm border-2 ${colorScheme.card}`}>
                        {/* Badge titre */}
                        <div className="mb-4">
                          <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full font-bold text-sm ${colorScheme.badge}`}>
                            <span>{colorScheme.icon}</span>
                            {title}
                          </span>
                        </div>
                        
                        {/* Contenu */}
                        <div className="space-y-3">
                          {content.split('\n').map((line, lineIdx) => {
                            const cleaned = line.trim();
                            if (!cleaned) return null;
                            
                            // Sous-titre en gras (**Titre**)
                            if (cleaned.startsWith('**') && cleaned.endsWith('**') && !cleaned.includes('-')) {
                              const subtitle = cleaned.replace(/\*\*/g, '');
                              return (
                                <h5 key={lineIdx} className="text-base font-bold text-gray-900 mt-4 mb-2 flex items-center gap-2 first:mt-0">
                                  <span className={`w-2 h-2 rounded-full bg-gradient-to-br ${colorScheme.gradient}`}></span>
                                  {subtitle}
                                </h5>
                              );
                            }
                            
                            // Liste à puces avec **texte en gras** dedans
                            if (cleaned.startsWith('-')) {
                              const text = cleaned.replace(/^[-•]\s*/, '');
                              const parts = text.split(/(\*\*.*?\*\*)/g);
                              
                              return (
                                <div key={lineIdx} className="flex gap-3 items-start">
                                  <span className="text-gray-400 font-bold text-lg mt-0.5">•</span>
                                  <p className="flex-1 text-gray-700 leading-relaxed">
                                    {parts.map((part, i) => {
                                      if (part.startsWith('**') && part.endsWith('**')) {
                                        return <strong key={i} className="font-bold text-gray-900">{part.slice(2, -2)}</strong>;
                                      }
                                      return <span key={i}>{part}</span>;
                                    })}
                                  </p>
                                </div>
                              );
                            }
                            
                            // Paragraphe normal avec **texte en gras**
                            const parts = cleaned.split(/(\*\*.*?\*\*)/g);
                            return (
                              <p key={lineIdx} className="text-gray-700 leading-relaxed">
                                {parts.map((part, i) => {
                                  if (part.startsWith('**') && part.endsWith('**')) {
                                    return <strong key={i} className="font-bold text-gray-900">{part.slice(2, -2)}</strong>;
                                  }
                                  return <span key={i}>{part}</span>;
                                })}
                              </p>
                            );
                          })}
                        </div>
                      </div>
                    );
                  });
                })()}
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

          {/* Onglet Historique */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              {loadingHistory && (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-indigo-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Chargement de l'historique...</p>
                </div>
              )}

              {!loadingHistory && history.length === 0 && (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">📊</div>
                  <p className="text-gray-600">Aucune analyse dans l'historique</p>
                  <button
                    onClick={() => setActiveTab('new')}
                    className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                  >
                    Créer une analyse
                  </button>
                </div>
              )}

              {!loadingHistory && history.length > 0 && (
                <div className="space-y-4">
                  {history.map((item, index) => {
                    const isExpanded = expandedItems[item.analysis_id];
                    const isLatest = index === 0;

                    return (
                      <div
                        key={item.analysis_id}
                        className={`border-2 rounded-xl overflow-hidden transition-all ${
                          isLatest
                            ? 'border-indigo-400 bg-gradient-to-br from-indigo-50 to-purple-50 shadow-lg'
                            : 'border-gray-200 bg-white hover:shadow-md'
                        }`}
                      >
                        {/* Header cliquable */}
                        <div
                          className="p-4 cursor-pointer hover:bg-white/50 transition-colors"
                          onClick={() => setExpandedItems(prev => ({ ...prev, [item.analysis_id]: !prev[item.analysis_id] }))}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                {isLatest && (
                                  <span className="px-2 py-0.5 bg-indigo-500 text-white text-xs font-bold rounded-full">
                                    DERNIER
                                  </span>
                                )}
                                <span className="text-sm font-semibold text-gray-800">
                                  Analyse d'équipe
                                </span>
                              </div>
                              <div className="flex items-center gap-4 flex-wrap text-sm text-gray-600">
                                <div className="flex items-center gap-1">
                                  <Calendar className="w-4 h-4" />
                                  <span>
                                    {new Date(item.period_start).toLocaleDateString('fr-FR')} 
                                    {' → '}
                                    {new Date(item.period_end).toLocaleDateString('fr-FR')}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Clock className="w-4 h-4" />
                                  <span>
                                    {new Date(item.generated_at).toLocaleDateString('fr-FR')}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <ChevronDown
                                className={`w-5 h-5 text-gray-500 transition-transform ${
                                  isExpanded ? 'rotate-180' : ''
                                }`}
                              />
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteAnalysis(item.analysis_id);
                                }}
                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                title="Supprimer cette analyse"
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Contenu détaillé */}
                        {isExpanded && (
                          <div className="border-t-2 border-gray-200 bg-gradient-to-br from-orange-50 to-yellow-50 p-6">
                            {/* Afficher l'analyse avec le même style que l'onglet nouveau */}
                            {(() => {
                              const sections = item.analysis.split('##').filter(s => s.trim());
                              
                              return (
                                <div className="space-y-4">
                                  {sections.map((section, sectionIdx) => {
                                    const lines = section.trim().split('\n');
                                    const title = lines[0].trim().replace(/\*\*/g, '');
                                    const content = lines.slice(1).join('\n').trim();
                                    
                                    const colorPalette = [
                                      { badge: 'bg-indigo-100 text-indigo-800', card: 'bg-indigo-50 border-indigo-200', icon: '📊', gradient: 'from-indigo-500 to-purple-600' },
                                      { badge: 'bg-green-100 text-green-800', card: 'bg-green-50 border-green-200', icon: '✅', gradient: 'from-green-500 to-emerald-600' },
                                      { badge: 'bg-orange-100 text-orange-800', card: 'bg-orange-50 border-orange-200', icon: '⚠️', gradient: 'from-orange-500 to-red-500' },
                                      { badge: 'bg-purple-100 text-purple-800', card: 'bg-purple-50 border-purple-200', icon: '🎯', gradient: 'from-purple-500 to-indigo-600' },
                                      { badge: 'bg-teal-100 text-teal-800', card: 'bg-teal-50 border-teal-200', icon: '💡', gradient: 'from-teal-500 to-cyan-600' },
                                      { badge: 'bg-pink-100 text-pink-800', card: 'bg-pink-50 border-pink-200', icon: '🌟', gradient: 'from-pink-500 to-rose-600' }
                                    ];
                                    
                                    let colorScheme;
                                    const titleLower = title.toLowerCase();
                                    
                                    if (titleLower.includes('force') || titleLower.includes('positif') || titleLower.includes('réussite')) {
                                      colorScheme = colorPalette[1];
                                    } else if (titleLower.includes('attention') || titleLower.includes('faible') || titleLower.includes('améliorer') || titleLower.includes('difficulté')) {
                                      colorScheme = colorPalette[2];
                                    } else if (titleLower.includes('recommandation') || titleLower.includes('action') || titleLower.includes('priorité')) {
                                      colorScheme = colorPalette[3];
                                    } else if (titleLower.includes('analyse') || titleLower.includes('synthèse') || titleLower.includes('résumé')) {
                                      colorScheme = colorPalette[0];
                                    } else if (titleLower.includes('opportunité') || titleLower.includes('potentiel') || titleLower.includes('développement')) {
                                      colorScheme = colorPalette[4];
                                    } else {
                                      colorScheme = colorPalette[sectionIdx % colorPalette.length];
                                    }
                                    
                                    return (
                                      <div key={sectionIdx} className={`rounded-xl p-5 shadow-sm border-2 ${colorScheme.card}`}>
                                        <div className="mb-4">
                                          <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full font-bold text-sm ${colorScheme.badge}`}>
                                            <span>{colorScheme.icon}</span>
                                            {title}
                                          </span>
                                        </div>
                                        <div className="space-y-3">
                                          {content.split('\n').map((line, lineIdx) => {
                                            const cleaned = line.trim();
                                            if (!cleaned) return null;
                                            
                                            if (cleaned.startsWith('-')) {
                                              const text = cleaned.replace(/^[-•]\s*/, '');
                                              const parts = text.split(/(\*\*.*?\*\*)/g);
                                              
                                              return (
                                                <div key={lineIdx} className="flex gap-3 items-start bg-white rounded-lg p-3 shadow-sm">
                                                  <span className={`flex-shrink-0 w-7 h-7 bg-gradient-to-br ${colorScheme.gradient} text-white rounded-full flex items-center justify-center font-bold text-sm`}>
                                                    •
                                                  </span>
                                                  <p className="flex-1 text-gray-800">
                                                    {parts.map((part, i) => {
                                                      if (part.startsWith('**') && part.endsWith('**')) {
                                                        return <strong key={i} className="font-bold">{part.slice(2, -2)}</strong>;
                                                      }
                                                      return <span key={i}>{part}</span>;
                                                    })}
                                                  </p>
                                                </div>
                                              );
                                            }
                                            
                                            return (
                                              <p key={lineIdx} className="text-gray-700 leading-relaxed">
                                                {cleaned}
                                              </p>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
