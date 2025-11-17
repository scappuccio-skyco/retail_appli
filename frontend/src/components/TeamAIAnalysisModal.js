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

          {aiAnalysis && !loading && (
            <div className="space-y-4">
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
                            
                            // Liste à puces
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
                            
                            // Paragraphe normal
                            return (
                              <p key={lineIdx} className="text-gray-700 leading-relaxed">
                                {cleaned}
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
        </div>
      </div>
    </div>
  );
}
