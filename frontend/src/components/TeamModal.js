import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { X, Users, TrendingUp, Target, Award, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function TeamModal({ sellers, onClose, onViewSellerDetail }) {
  const [teamData, setTeamData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAIAnalysis, setShowAIAnalysis] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [periodFilter, setPeriodFilter] = useState('30'); // '7', '30', '90', 'all'

  useEffect(() => {
    fetchTeamData();
  }, [sellers, periodFilter]);

  const fetchTeamData = async () => {
    setLoading(true);
    setTeamData([]); // Clear existing data to force refresh
    
    try {
      const token = localStorage.getItem('token');
      
      console.log(`[TeamModal] ========== FETCHING DATA FOR PERIOD: ${periodFilter} days ==========`);
      
      // Fetch data for each seller
      const sellersDataPromises = sellers.map(async (seller) => {
        try {
          const daysParam = periodFilter === 'all' ? '365' : periodFilter;
          console.log(`[TeamModal] 📥 Fetching ${seller.name} (ID: ${seller.id}) with days=${daysParam}`);
          
          const [statsRes, kpiRes] = await Promise.all([
            axios.get(`${API}/manager/seller/${seller.id}/stats`, { 
              headers: { Authorization: `Bearer ${token}` },
              params: { _t: Date.now() } // Cache buster
            }),
            axios.get(`${API}/manager/kpi-entries/${seller.id}?days=${daysParam}`, { 
              headers: { Authorization: `Bearer ${token}` },
              params: { _t: Date.now() } // Cache buster
            })
          ]);

          const stats = statsRes.data;
          const kpiEntries = kpiRes.data;

          console.log(`[TeamModal] 📊 ${seller.name}: ${kpiEntries.length} entries returned from API`);
          
          // Debug: show first and last entry dates
          if (kpiEntries.length > 0) {
            console.log(`[TeamModal] 📅 ${seller.name} date range: ${kpiEntries[kpiEntries.length - 1]?.date} to ${kpiEntries[0]?.date}`);
          }

          // Calculate period totals
          const monthlyCA = kpiEntries.reduce((sum, entry) => sum + (entry.ca_journalier || 0), 0);
          const monthlyVentes = kpiEntries.reduce((sum, entry) => sum + (entry.nb_ventes || 0), 0);
          const panierMoyen = monthlyVentes > 0 ? monthlyCA / monthlyVentes : 0;
          
          console.log(`[TeamModal] 💰 ${seller.name} CALCULATED => CA: ${monthlyCA.toFixed(2)} €, Ventes: ${monthlyVentes}`);

          // Get competences scores
          const competences = stats.avg_radar_scores || {};
          const competencesList = [
            { name: 'Accueil', value: competences.accueil || 0 },
            { name: 'Découverte', value: competences.decouverte || 0 },
            { name: 'Argumentation', value: competences.argumentation || 0 },
            { name: 'Closing', value: competences.closing || 0 },
            { name: 'Fidélisation', value: competences.fidelisation || 0 }
          ];

          const avgCompetence = competencesList.reduce((sum, c) => sum + c.value, 0) / 5;
          const bestCompetence = competencesList.reduce((max, c) => c.value > max.value ? c : max);
          const worstCompetence = competencesList.reduce((min, c) => c.value < min.value ? c : min);

          return {
            ...seller,
            monthlyCA,
            monthlyVentes,
            panierMoyen,
            avgCompetence,
            bestCompetence,
            worstCompetence,
            lastKpiDate: kpiEntries.length > 0 ? kpiEntries[0].date : null,
            hasKpiToday: kpiEntries.some(e => e.date === new Date().toISOString().split('T')[0])
          };
        } catch (err) {
          console.error(`Error fetching data for seller ${seller.id}:`, err);
          return {
            ...seller,
            monthlyCA: 0,
            monthlyVentes: 0,
            panierMoyen: 0,
            avgCompetence: 0,
            bestCompetence: { name: 'N/A', value: 0 },
            worstCompetence: { name: 'N/A', value: 0 },
            lastKpiDate: null,
            hasKpiToday: false
          };
        }
      });

      const sellersData = await Promise.all(sellersDataPromises);
      setTeamData(sellersData);
    } catch (err) {
      console.error('Error fetching team data:', err);
      toast.error('Erreur lors du chargement des données d\'équipe');
    } finally {
      setLoading(false);
    }
  };

  const handleAIAnalysis = async () => {
    setLoadingAI(true);
    setShowAIAnalysis(true);

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
      setShowAIAnalysis(false);
    } finally {
      setLoadingAI(false);
    }
  };

  // Calculate team totals
  const teamTotalCA = teamData.reduce((sum, s) => sum + s.monthlyCA, 0);
  const teamTotalVentes = teamData.reduce((sum, s) => sum + s.monthlyVentes, 0);
  const sellersWithKPI = teamData.filter(s => s.hasKpiToday).length;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-cyan-600 to-blue-600 p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users className="w-8 h-8" />
              <div>
                <h2 className="text-2xl font-bold">Mon Équipe</h2>
                <p className="text-sm opacity-90">Vue d'ensemble managériale</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600"></div>
              <p className="text-gray-600 mt-4">Chargement des données...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Period Filter */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-700">📅 Période :</span>
                  <div className="flex gap-2">
                    {[
                      { value: '7', label: '7 jours' },
                      { value: '30', label: '30 jours' },
                      { value: '90', label: '3 mois' },
                      { value: 'all', label: 'Année' }
                    ].map(option => (
                      <button
                        key={option.value}
                        onClick={() => setPeriodFilter(option.value)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                          periodFilter === option.value
                            ? 'bg-cyan-600 text-white shadow-md'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg p-4 border border-blue-200">
                  <div className="flex items-center gap-3 mb-2">
                    <Users className="w-5 h-5 text-blue-600" />
                    <span className="text-sm font-semibold text-gray-700">Équipe</span>
                  </div>
                  <div className="text-2xl font-bold text-blue-900">{teamData.length}</div>
                  <div className="text-xs text-blue-600 mt-1">vendeur{teamData.length > 1 ? 's' : ''} actif{teamData.length > 1 ? 's' : ''}</div>
                </div>

                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200">
                  <div className="flex items-center gap-3 mb-2">
                    <TrendingUp className="w-5 h-5 text-green-600" />
                    <span className="text-sm font-semibold text-gray-700">Performance Globale</span>
                  </div>
                  <div className="text-2xl font-bold text-green-900">{teamTotalCA.toFixed(0)} €</div>
                  <div className="text-xs text-green-600 mt-1">
                    {teamTotalVentes} ventes sur {
                      periodFilter === '7' ? '7 jours' :
                      periodFilter === '30' ? '30 jours' :
                      periodFilter === '90' ? '3 mois' :
                      'l\'année'
                    }
                  </div>
                </div>

                <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-lg p-4 border border-orange-200">
                  <div className="flex items-center gap-3 mb-2">
                    <Target className="w-5 h-5 text-orange-600" />
                    <span className="text-sm font-semibold text-gray-700">Complétion KPI</span>
                  </div>
                  <div className="text-2xl font-bold text-orange-900">{sellersWithKPI} / {teamData.length}</div>
                  <div className="text-xs text-orange-600 mt-1">ont saisi aujourd'hui</div>
                </div>
              </div>

              {/* AI Analysis Button */}
              <div className="flex justify-center">
                <button
                  onClick={handleAIAnalysis}
                  disabled={loadingAI}
                  className="px-6 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {loadingAI ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Analyse en cours...
                    </>
                  ) : (
                    <>
                      🤖 Analyse IA de l'équipe
                    </>
                  )}
                </button>
              </div>

              {/* AI Analysis Result */}
              {showAIAnalysis && aiAnalysis && (
                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg p-4 border-2 border-indigo-200">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-indigo-900 flex items-center gap-2">
                      <span>🤖</span> Analyse IA de l'Équipe
                    </h3>
                    <button
                      onClick={() => setShowAIAnalysis(false)}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="max-h-48 overflow-y-auto pr-2">
                    <div className="space-y-3 text-sm text-gray-800">
                      {aiAnalysis.split('\n').map((line, idx) => {
                        if (line.startsWith('## ')) {
                          return (
                            <h4 key={idx} className="text-sm font-bold text-indigo-900 mt-3 mb-2 flex items-center gap-2">
                              <span className="w-1 h-4 bg-indigo-600 rounded"></span>
                              {line.replace('## ', '')}
                            </h4>
                          );
                        }
                        if (line.startsWith('- ')) {
                          const content = line.replace('- ', '');
                          const parts = content.split(/(\*\*.*?\*\*)/g);
                          return (
                            <div key={idx} className="flex gap-2 text-xs text-gray-700 leading-relaxed ml-2">
                              <span className="text-indigo-600 mt-1">•</span>
                              <span>
                                {parts.map((part, i) => {
                                  if (part.startsWith('**') && part.endsWith('**')) {
                                    return <strong key={i} className="text-gray-900 font-semibold">{part.slice(2, -2)}</strong>;
                                  }
                                  return <span key={i}>{part}</span>;
                                })}
                              </span>
                            </div>
                          );
                        }
                        if (line.trim() === '') {
                          return <div key={idx} className="h-1"></div>;
                        }
                        return null;
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Sellers Table */}
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-gray-800">Détail par Vendeur</h3>
                  <span className="text-xs text-gray-600">
                    Performance sur {
                      periodFilter === '7' ? '7 jours' :
                      periodFilter === '30' ? '30 jours' :
                      periodFilter === '90' ? '3 mois' :
                      'l\'année'
                    }
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Vendeur</th>
                        <th className="px-4 py-3 text-right font-semibold text-gray-700">
                          CA {periodFilter === '7' ? '7j' : periodFilter === '30' ? '30j' : periodFilter === '90' ? '3m' : 'An'}
                        </th>
                        <th className="px-4 py-3 text-right font-semibold text-gray-700">Ventes</th>
                        <th className="px-4 py-3 text-right font-semibold text-gray-700">Panier Moy.</th>
                        <th className="px-4 py-3 text-center font-semibold text-gray-700">Compétences</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Point Fort</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">À Améliorer</th>
                        <th className="px-4 py-3 text-center font-semibold text-gray-700">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teamData.map((seller, idx) => (
                        <tr key={`${seller.id}-${periodFilter}`} className={`border-b border-gray-100 hover:bg-gray-50 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 bg-cyan-100 rounded-full flex items-center justify-center">
                                <span className="text-sm font-bold text-cyan-700">{seller.name.charAt(0)}</span>
                              </div>
                              <div>
                                <div className="font-medium text-gray-800">{seller.name}</div>
                                <div className="text-xs text-gray-500">{seller.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right text-gray-700 font-medium">{seller.monthlyCA.toFixed(0)} €</td>
                          <td className="px-4 py-3 text-right text-gray-700">{seller.monthlyVentes}</td>
                          <td className="px-4 py-3 text-right text-gray-700">{seller.panierMoyen.toFixed(2)} €</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold ${
                              seller.avgCompetence >= 8 ? 'bg-green-100 text-green-800' :
                              seller.avgCompetence >= 6 ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              <Award className="w-3 h-3" />
                              {seller.avgCompetence.toFixed(1)}/10
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-green-700 font-medium">{seller.bestCompetence.name}</span>
                            <span className="text-xs text-gray-500 ml-1">({seller.bestCompetence.value.toFixed(1)})</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-orange-700 font-medium">{seller.worstCompetence.name}</span>
                            <span className="text-xs text-gray-500 ml-1">({seller.worstCompetence.value.toFixed(1)})</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => onViewSellerDetail(seller)}
                              className="px-3 py-1.5 bg-cyan-500 text-white text-xs font-medium rounded hover:bg-cyan-600 transition-colors"
                            >
                              Voir détail
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
