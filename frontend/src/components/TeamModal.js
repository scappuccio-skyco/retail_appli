import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { X, Users, TrendingUp, Target, Award, AlertCircle, Info } from 'lucide-react';
import { toast } from 'sonner';
import TeamAIAnalysisModal from './TeamAIAnalysisModal';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function TeamModal({ sellers, onClose, onViewSellerDetail }) {
  const [teamData, setTeamData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAIAnalysisModal, setShowAIAnalysisModal] = useState(false);
  const [periodFilter, setPeriodFilter] = useState('30'); // '7', '30', '90', 'all'
  const [showNiveauTooltip, setShowNiveauTooltip] = useState(false);
  const [chartData, setChartData] = useState([]);
  const [visibleMetrics, setVisibleMetrics] = useState({
    ca: true,
    ventes: true,
    panierMoyen: true
  });

  useEffect(() => {
    console.log(`[TeamModal] 🔄 useEffect TRIGGERED - periodFilter changed to: ${periodFilter}`);
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
          
          const [statsRes, kpiRes, diagRes] = await Promise.all([
            axios.get(`${API}/manager/seller/${seller.id}/stats`, { 
              headers: { Authorization: `Bearer ${token}` },
              params: { _t: Date.now() } // Cache buster
            }),
            axios.get(`${API}/manager/kpi-entries/${seller.id}?days=${daysParam}`, { 
              headers: { Authorization: `Bearer ${token}` },
              params: { _t: Date.now() } // Cache buster
            }),
            axios.get(`${API}/manager/seller/${seller.id}/diagnostic`, { 
              headers: { Authorization: `Bearer ${token}` },
              params: { _t: Date.now() } // Cache buster
            }).catch(() => ({ data: null })) // If no diagnostic, return null
          ]);

          const stats = statsRes.data;
          const kpiEntries = kpiRes.data;
          const diagnostic = diagRes.data;

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
          
          // Check if all competences have the same value
          const allSameValue = competencesList.every(c => c.value === competencesList[0].value);
          const allZero = competencesList.every(c => c.value === 0);
          
          let bestCompetence, worstCompetence;
          
          if (allZero) {
            // If all scores are 0 (no diagnostic), indicate this
            bestCompetence = { name: 'Non évalué', value: 0 };
            worstCompetence = { name: 'Non évalué', value: 0 };
          } else if (allSameValue) {
            // If all competences are equal (initial questionnaire), indicate balanced profile
            bestCompetence = { name: 'Profil équilibré', value: competencesList[0].value };
            worstCompetence = { name: 'Profil équilibré', value: competencesList[0].value };
          } else {
            // Find actual best and worst
            bestCompetence = competencesList.reduce((max, c) => c.value > max.value ? c : max);
            worstCompetence = competencesList.reduce((min, c) => c.value < min.value ? c : min);
          }

          // Determine score source for transparency
          let scoreSource = 'none';
          if (diagnostic) {
            scoreSource = 'diagnostic'; // Basé sur questionnaire initial
          }
          // Note: In future, we could check if debriefs exist to show 'diagnostic+debriefs'

          return {
            ...seller,
            monthlyCA,
            monthlyVentes,
            panierMoyen,
            avgCompetence,
            bestCompetence,
            worstCompetence,
            lastKpiDate: kpiEntries.length > 0 ? kpiEntries[0].date : null,
            hasKpiToday: kpiEntries.some(e => e.date === new Date().toISOString().split('T')[0]),
            scoreSource,
            hasDiagnostic: !!diagnostic,
            niveau: diagnostic?.level || seller.niveau || 'Non défini'
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
      
      console.log(`[TeamModal] ✅ ALL DATA PROCESSED, setting state with ${sellersData.length} sellers:`);
      sellersData.forEach(s => {
        console.log(`[TeamModal]    - ${s.name}: CA=${s.monthlyCA.toFixed(2)} €`);
      });
      
      setTeamData(sellersData);
    } catch (err) {
      console.error('Error fetching team data:', err);
      toast.error('Erreur lors du chargement des données d\'équipe');
    } finally {
      setLoading(false);
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

                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg p-4 border border-indigo-200 flex flex-col items-center justify-center">
                  <button
                    onClick={() => setShowAIAnalysisModal(true)}
                    className="px-6 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all flex items-center gap-2"
                  >
                    🤖 Analyse IA de l'équipe
                  </button>
                </div>

              </div>

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
                        <th className="px-4 py-3 text-center font-semibold text-gray-700">
                          <div className="flex items-center justify-center gap-1">
                            <span>Niveau</span>
                            <div className="relative">
                              <Info 
                                className="w-3.5 h-3.5 text-blue-500 cursor-help" 
                                onMouseEnter={() => setShowNiveauTooltip(true)}
                                onMouseLeave={() => setShowNiveauTooltip(false)}
                              />
                              {showNiveauTooltip && (
                                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-50 w-72 p-4 bg-gray-900 text-white text-xs rounded-lg shadow-2xl">
                                  <div className="space-y-2">
                                    <div className="font-semibold text-sm mb-3 text-center border-b border-gray-700 pb-2">Les 4 Niveaux</div>
                                    <div><span className="font-bold text-green-300">🟢 Explorateur:</span> Découvre le terrain, teste, apprend les bases</div>
                                    <div><span className="font-bold text-yellow-300">🟡 Challenger:</span> A pris ses repères, cherche à performer</div>
                                    <div><span className="font-bold text-orange-300">🟠 Ambassadeur:</span> Inspire confiance, maîtrise les étapes de vente</div>
                                    <div><span className="font-bold text-red-300">🔴 Maître du Jeu:</span> Expert relation client, adapte son style</div>
                                  </div>
                                  <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-8 border-transparent border-t-gray-900"></div>
                                </div>
                              )}
                            </div>
                          </div>
                        </th>
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
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${
                              (seller.niveau === 'Maître du Jeu' || seller.niveau === 'Expert') ? 'bg-red-100 text-red-800' :
                              (seller.niveau === 'Ambassadeur' || seller.niveau === 'Confirmé') ? 'bg-orange-100 text-orange-800' :
                              seller.niveau === 'Challenger' ? 'bg-yellow-100 text-yellow-800' :
                              (seller.niveau === 'Explorateur' || seller.niveau === 'Apprenti') ? 'bg-green-100 text-green-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {(seller.niveau === 'Maître du Jeu' || seller.niveau === 'Expert') && '🔴 '}
                              {(seller.niveau === 'Ambassadeur' || seller.niveau === 'Confirmé') && '🟠 '}
                              {seller.niveau === 'Challenger' && '🟡 '}
                              {(seller.niveau === 'Explorateur' || seller.niveau === 'Apprenti') && '🟢 '}
                              {seller.niveau}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-green-700 font-medium">{seller.bestCompetence.name}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-orange-700 font-medium">{seller.worstCompetence.name}</span>
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
      
      {/* AI Analysis Modal */}
      {showAIAnalysisModal && (
        <TeamAIAnalysisModal
          teamData={teamData}
          onClose={() => setShowAIAnalysisModal(false)}
        />
      )}
    </div>
  );
}
