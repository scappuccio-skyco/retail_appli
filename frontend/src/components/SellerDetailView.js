import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { ArrowLeft, TrendingUp, Award, MessageSquare, BarChart3, Calendar } from 'lucide-react';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function SellerDetailView({ seller, onBack }) {
  const [diagnostic, setDiagnostic] = useState(null);
  const [debriefs, setDebriefs] = useState([]);
  const [competencesHistory, setCompetencesHistory] = useState([]);
  const [kpiEntries, setKpiEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedDebriefs, setExpandedDebriefs] = useState({});

  useEffect(() => {
    fetchSellerData();
  }, [seller.id]);

  const fetchSellerData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const [diagRes, debriefsRes, competencesRes, kpiRes] = await Promise.all([
        axios.get(`${API}/diagnostic/seller/${seller.id}`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/manager/debriefs/${seller.id}`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/manager/competences-history/${seller.id}`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/manager/kpi-entries/${seller.id}?days=30`, { headers: { Authorization: `Bearer ${token}` } })
      ]);

      setDiagnostic(diagRes.data);
      setDebriefs(debriefsRes.data);
      setCompetencesHistory(competencesRes.data);
      setKpiEntries(kpiRes.data);
    } catch (err) {
      console.error('Error loading seller data:', err);
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

  // Calculate current competences (from last entry in history)
  const currentCompetences = competencesHistory.length > 0
    ? competencesHistory[competencesHistory.length - 1]
    : null;

  const radarData = currentCompetences
    ? [
        { skill: 'Accueil', value: currentCompetences.score_accueil },
        { skill: 'Découverte', value: currentCompetences.score_decouverte },
        { skill: 'Argumentation', value: currentCompetences.score_argumentation },
        { skill: 'Closing', value: currentCompetences.score_closing },
        { skill: 'Fidélisation', value: currentCompetences.score_fidelisation }
      ]
    : [];

  // Calculate evolution data (score global sur 25)
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 p-8">
        <div className="text-center py-12">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 p-8">
      {/* Header */}
      <div className="glass-morphism rounded-2xl p-6 mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="btn-secondary flex items-center gap-2"
            >
              <ArrowLeft className="w-5 h-5" />
              Retour
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-800">{seller.name}</h1>
              <p className="text-gray-600">{seller.email}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="glass-morphism rounded-2xl p-6 card-hover">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Évaluations</p>
              <p className="text-3xl font-bold text-gray-800">{kpiStats.totalEvaluations}</p>
              <p className="text-xs text-gray-500">Diagnostic + Débriefs</p>
            </div>
          </div>
        </div>

        <div className="glass-morphism rounded-2xl p-6 card-hover">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
              <MessageSquare className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Ventes (7j)</p>
              <p className="text-3xl font-bold text-gray-800">{kpiStats.totalVentes}</p>
            </div>
          </div>
        </div>

        <div className="glass-morphism rounded-2xl p-6 card-hover">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">CA (7j)</p>
              <p className="text-3xl font-bold text-gray-800">{kpiStats.totalCA.toFixed(0)}€</p>
            </div>
          </div>
        </div>
      </div>

      {/* Diagnostic Profile */}
      {diagnostic && (
        <div className="glass-morphism rounded-2xl p-6 mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Profil de vente</h2>
          
          <div className="bg-gradient-to-r from-[#ffd871] to-yellow-300 rounded-xl p-4 shadow-lg">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
              <div className="bg-white bg-opacity-70 rounded-lg p-3">
                <p className="text-xs text-gray-600 mb-1">🎨 Style</p>
                <p className="text-lg font-bold text-gray-800">{diagnostic.style}</p>
              </div>
              <div className="bg-white bg-opacity-70 rounded-lg p-3">
                <p className="text-xs text-gray-600 mb-1">🎯 Niveau</p>
                <p className="text-lg font-bold text-gray-800">{diagnostic.level}</p>
              </div>
              <div className="bg-white bg-opacity-70 rounded-lg p-3">
                <p className="text-xs text-gray-600 mb-1">⚡ Motivation</p>
                <p className="text-lg font-bold text-gray-800">{diagnostic.motivation}</p>
              </div>
            </div>
            
            {diagnostic.ai_profile_summary && (
              <div className="bg-white bg-opacity-70 rounded-lg p-4">
                <p className="text-sm text-gray-800 whitespace-pre-line">{diagnostic.ai_profile_summary}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Radar Chart */}
        <div className="glass-morphism rounded-2xl p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Compétences actuelles</h2>
          {radarData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#cbd5e1" />
                <PolarAngleAxis dataKey="skill" tick={{ fill: '#475569', fontSize: 12 }} />
                <Radar name="Score" dataKey="value" stroke="#ffd871" fill="#ffd871" fillOpacity={0.6} />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-12 text-gray-500">Aucune donnée disponible</div>
          )}
        </div>

        {/* Evolution Chart */}
        <div className="glass-morphism rounded-2xl p-6">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-800">Évolution du score global</h2>
            {evolutionData.length > 0 && (
              <p className="text-sm text-gray-600 mt-1">
                Score actuel : <span className="font-bold text-[#ffd871]">{evolutionData[evolutionData.length - 1]['Score Global']}/25</span>
                {evolutionData.length > 1 && (
                  <span className="ml-2">
                    ({evolutionData[evolutionData.length - 1]['Score Global'] - evolutionData[0]['Score Global'] >= 0 ? '+' : ''}
                    {(evolutionData[evolutionData.length - 1]['Score Global'] - evolutionData[0]['Score Global']).toFixed(1)} points)
                  </span>
                )}
              </p>
            )}
          </div>
          {evolutionData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={evolutionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                <XAxis dataKey="fullDate" tick={{ fill: '#475569', fontSize: 12 }} />
                <YAxis domain={[0, 25]} tick={{ fill: '#475569' }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', border: '2px solid #ffd871', borderRadius: '8px' }}
                  labelStyle={{ color: '#1f2937', fontWeight: 'bold' }}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="Score Global" 
                  stroke="#ffd871" 
                  strokeWidth={3} 
                  dot={{ r: 5, fill: '#ffd871', strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 7 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-12 text-gray-500">Pas encore d'historique</div>
          )}
        </div>
      </div>

      {/* Derniers débriefs */}
      <div className="glass-morphism rounded-2xl p-6 mb-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">📝 Derniers débriefs</h2>
        
        {debriefs.length > 0 ? (
          <div className="space-y-4">
            {debriefs.slice(0, 5).map((debrief) => (
              <div
                key={debrief.id}
                className="bg-white rounded-xl border border-gray-200 hover:shadow-md transition-all"
              >
                <button
                  onClick={() => toggleDebrief(debrief.id)}
                  className="w-full p-4 text-left hover:bg-gray-50 transition-colors rounded-xl"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="text-sm text-gray-500 mb-2">
                        🗓️ {new Date(debrief.created_at).toLocaleDateString('fr-FR')} — Produit : {debrief.produit || debrief.context} — Type : {debrief.type_client || debrief.customer_profile}
                      </p>
                      <div className="space-y-1 text-sm text-gray-600">
                        <p>💬 Description : {debrief.description_vente || debrief.demarche_commerciale}</p>
                        <p>📍 Moment clé : {debrief.moment_perte_client || debrief.moment_perte_client}</p>
                        <p>❌ Raisons : {debrief.raisons_echec || debrief.objections}</p>
                      </div>
                    </div>
                    <div className="ml-4 text-gray-600 font-bold text-xl flex-shrink-0">
                      {expandedDebriefs[debrief.id] ? '−' : '+'}
                    </div>
                  </div>
                </button>

                {expandedDebriefs[debrief.id] && (
                  <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3 animate-fadeIn">
                    {debrief.ai_recommendation && (
                      <div className="bg-blue-50 rounded-lg p-3">
                        <p className="text-xs font-semibold text-blue-900 mb-1">💡 Recommandation IA</p>
                        <p className="text-sm text-blue-800 whitespace-pre-line">{debrief.ai_recommendation}</p>
                      </div>
                    )}
                    
                    <div className="grid grid-cols-5 gap-2">
                      <div className="bg-purple-50 rounded-lg p-2 text-center">
                        <p className="text-xs text-purple-600">Accueil</p>
                        <p className="text-lg font-bold text-purple-900">{debrief.score_accueil || 0}/5</p>
                      </div>
                      <div className="bg-green-50 rounded-lg p-2 text-center">
                        <p className="text-xs text-green-600">Découverte</p>
                        <p className="text-lg font-bold text-green-900">{debrief.score_decouverte || 0}/5</p>
                      </div>
                      <div className="bg-orange-50 rounded-lg p-2 text-center">
                        <p className="text-xs text-orange-600">Argumentation</p>
                        <p className="text-lg font-bold text-orange-900">{debrief.score_argumentation || 0}/5</p>
                      </div>
                      <div className="bg-red-50 rounded-lg p-2 text-center">
                        <p className="text-xs text-red-600">Closing</p>
                        <p className="text-lg font-bold text-red-900">{debrief.score_closing || 0}/5</p>
                      </div>
                      <div className="bg-blue-50 rounded-lg p-2 text-center">
                        <p className="text-xs text-blue-600">Fidélisation</p>
                        <p className="text-lg font-bold text-blue-900">{debrief.score_fidelisation || 0}/5</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            Aucun débrief pour le moment
          </div>
        )}
      </div>

      {/* KPI Stats (30 derniers jours) */}
      <div className="glass-morphism rounded-2xl p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">📊 KPI (30 derniers jours)</h2>
        
        {kpiEntries.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 rounded-xl p-4">
              <p className="text-sm text-blue-600 mb-2">💰 CA Total</p>
              <p className="text-2xl font-bold text-blue-900">
                {kpiEntries.reduce((sum, e) => sum + (e.ca_journalier || 0), 0).toFixed(2)}€
              </p>
            </div>
            <div className="bg-green-50 rounded-xl p-4">
              <p className="text-sm text-green-600 mb-2">🛒 Ventes</p>
              <p className="text-2xl font-bold text-green-900">
                {kpiEntries.reduce((sum, e) => sum + (e.nb_ventes || 0), 0)}
              </p>
            </div>
            <div className="bg-purple-50 rounded-xl p-4">
              <p className="text-sm text-purple-600 mb-2">👥 Clients</p>
              <p className="text-2xl font-bold text-purple-900">
                {kpiEntries.reduce((sum, e) => sum + (e.nb_clients || 0), 0)}
              </p>
            </div>
            <div className="bg-orange-50 rounded-xl p-4">
              <p className="text-sm text-orange-600 mb-2">🧮 Panier Moyen</p>
              <p className="text-2xl font-bold text-orange-900">
                {(kpiEntries.reduce((sum, e) => sum + (e.panier_moyen || 0), 0) / kpiEntries.length).toFixed(2)}€
              </p>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            Aucune donnée KPI disponible
          </div>
        )}
      </div>
    </div>
  );
}
