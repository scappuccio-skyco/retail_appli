import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Sparkles, TrendingUp, AlertTriangle, Target, MessageSquare, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function TeamBilanIA() {
  const [bilan, setBilan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [showDataSources, setShowDataSources] = useState(false);

  useEffect(() => {
    fetchBilan();
  }, []);

  const fetchBilan = async () => {
    try {
      const res = await axios.get(`${API}/manager/team-bilan/latest`);
      if (res.data.status === 'success') {
        setBilan(res.data.bilan);
      }
    } catch (err) {
      console.error('Error fetching bilan:', err);
    }
  };

  const generateNewBilan = async () => {
    setLoading(true);
    try {
      const res = await axios.post(`${API}/manager/team-bilan`);
      setBilan(res.data);
      toast.success('Bilan IA généré ! 🤖');
    } catch (err) {
      console.error('Error generating bilan:', err);
      toast.error('Erreur lors de la génération du bilan');
    } finally {
      setLoading(false);
    }
  };

  if (!bilan && !loading) {
    return (
      <div className="glass-morphism rounded-2xl p-6 mb-8 border-2 border-[#ffd871]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-[#ffd871]" />
            <div>
              <h2 className="text-2xl font-bold text-gray-800">🤖 Bilan IA de l'équipe</h2>
              <p className="text-sm text-gray-600">Analyse intelligente de la performance hebdomadaire</p>
            </div>
          </div>
          <button
            onClick={generateNewBilan}
            disabled={loading}
            className="btn-primary flex items-center gap-2"
          >
            <Sparkles className="w-5 h-5" />
            Générer le bilan
          </button>
        </div>
      </div>
    );
  }

  if (!bilan) return null;

  return (
    <div className="glass-morphism rounded-2xl p-6 mb-8 border-2 border-[#ffd871]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Sparkles className="w-8 h-8 text-[#ffd871]" />
          <div>
            <h2 className="text-2xl font-bold text-gray-800">🤖 Bilan IA de l'équipe</h2>
            <p className="text-sm text-gray-600">{bilan.periode}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDataSources(!showDataSources)}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            📊 Données sources
          </button>
          <button
            onClick={generateNewBilan}
            disabled={loading}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Régénérer
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="btn-secondary p-2"
          >
            {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <div className="bg-blue-50 rounded-lg p-3">
          <p className="text-xs text-blue-600 mb-1">💰 CA</p>
          <p className="text-lg font-bold text-blue-900">{bilan.kpi_resume.ca_total.toFixed(0)}€</p>
        </div>
        <div className="bg-green-50 rounded-lg p-3">
          <p className="text-xs text-[#10B981] mb-1">🛒 Ventes</p>
          <p className="text-lg font-bold text-green-900">{bilan.kpi_resume.ventes}</p>
        </div>
        <div className="bg-purple-50 rounded-lg p-3">
          <p className="text-xs text-purple-600 mb-1">👥 Clients</p>
          <p className="text-lg font-bold text-purple-900">{bilan.kpi_resume.clients}</p>
        </div>
        <div className="bg-orange-50 rounded-lg p-3">
          <p className="text-xs text-[#F97316] mb-1">🧮 P. Moyen</p>
          <p className="text-lg font-bold text-orange-900">{bilan.kpi_resume.panier_moyen.toFixed(0)}€</p>
        </div>
        <div className="bg-pink-50 rounded-lg p-3">
          <p className="text-xs text-pink-600 mb-1">📈 Taux</p>
          <p className="text-lg font-bold text-pink-900">{bilan.kpi_resume.taux_transformation.toFixed(1)}%</p>
        </div>
      </div>

      {/* Synthèse */}
      <div className="bg-gradient-to-r from-[#1E40AF] to-[#1E3A8A] rounded-xl p-4 mb-4">
        <p className="text-gray-800 font-medium">{bilan.synthese}</p>
      </div>

      {/* Données sources panel */}
      {showDataSources && bilan.donnees_sources && (
        <div className="bg-white border-2 border-blue-300 rounded-xl p-4 mb-4 animate-fadeIn">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">📊</span>
            <h3 className="font-bold text-blue-900">Données sources utilisées par l'IA</h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-blue-200">
                  <th className="text-left py-2 px-3 text-blue-900">Vendeur</th>
                  <th className="text-right py-2 px-3 text-blue-900">CA</th>
                  <th className="text-right py-2 px-3 text-blue-900">Ventes</th>
                  <th className="text-right py-2 px-3 text-blue-900">Panier Moyen</th>
                  <th className="text-right py-2 px-3 text-blue-900">Scores</th>
                </tr>
              </thead>
              <tbody>
                {bilan.donnees_sources.map((seller, idx) => (
                  <tr key={`team-bilan-seller-${seller.seller_id || seller.name}-${idx}`} className="border-b border-blue-100 hover:bg-blue-50">
                    <td className="py-2 px-3 font-medium text-gray-800">{seller.name}</td>
                    <td className="text-right py-2 px-3 text-gray-700">{seller.ca.toFixed(2)}€</td>
                    <td className="text-right py-2 px-3 text-gray-700">{seller.ventes}</td>
                    <td className="text-right py-2 px-3 text-gray-700">{seller.panier_moyen.toFixed(2)}€</td>
                    <td className="text-right py-2 px-3 text-xs text-gray-600">
                      {seller.scores ? (
                        <span>
                          A:{seller.scores.score_accueil} 
                          D:{seller.scores.score_decouverte} 
                          Ar:{seller.scores.score_argumentation} 
                          C:{seller.scores.score_closing} 
                          F:{seller.scores.score_fidelisation}
                        </span>
                      ) : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="mt-4 bg-blue-50 rounded-lg p-3 text-sm text-blue-800">
            <p className="font-semibold mb-1">💡 Pourquoi cette section ?</p>
            <p>Ces données brutes sont celles envoyées à l'IA. Elles te permettent de vérifier que l'analyse est basée sur des chiffres réels et non inventés.</p>
          </div>
        </div>
      )}

      {expanded && (
        <div className="space-y-4 animate-fadeIn">
          {/* Points forts */}
          <div className="bg-green-50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-5 h-5 text-[#10B981]" />
              <h3 className="font-bold text-green-900">💪 Points forts</h3>
            </div>
            <ul className="space-y-2">
              {bilan.points_forts.map((point, idx) => (
                <li key={`team-bilan-forts-${idx}-${point.substring(0, 20)}`} className="flex items-start gap-2 text-green-800">
                  <span className="text-[#10B981] mt-1">✓</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Points d'attention */}
          <div className="bg-orange-50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-5 h-5 text-[#F97316]" />
              <h3 className="font-bold text-orange-900">⚠️ Points d'attention</h3>
            </div>
            <ul className="space-y-2">
              {bilan.points_attention.map((point, idx) => (
                <li key={`team-bilan-attention-${idx}-${point.substring(0, 20)}`} className="flex items-start gap-2 text-orange-800">
                  <span className="text-[#F97316] mt-1">!</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Actions prioritaires */}
          <div className="bg-blue-50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-5 h-5 text-blue-600" />
              <h3 className="font-bold text-blue-900">🎯 3 Actions prioritaires</h3>
            </div>
            <ul className="space-y-2">
              {bilan.actions_prioritaires.map((action, idx) => (
                <li key={`team-bilan-actions-${idx}-${action.substring(0, 20)}`} className="flex items-start gap-2 text-blue-800">
                  <span className="text-blue-600 font-bold mt-1">{idx + 1}.</span>
                  <span>{action}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Suggestion de brief */}
          <div className="bg-purple-50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="w-5 h-5 text-purple-600" />
              <h3 className="font-bold text-purple-900">💬 Suggestion de brief</h3>
            </div>
            <p className="text-purple-800 italic">"{bilan.suggestion_brief}"</p>
          </div>

          {/* Compétences moyennes */}
          {bilan.competences_moyenne && Object.keys(bilan.competences_moyenne).length > 0 && (
            <div className="bg-gray-50 rounded-xl p-4">
              <h3 className="font-bold text-gray-900 mb-3">📊 Compétences moyennes de l'équipe</h3>
              <div className="grid grid-cols-5 gap-2">
                {Object.entries(bilan.competences_moyenne).map(([comp, score]) => (
                  <div key={comp} className="text-center">
                    <p className="text-xs text-gray-600 mb-1 capitalize">{comp}</p>
                    <p className="text-lg font-bold text-gray-800">{score}/5</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
