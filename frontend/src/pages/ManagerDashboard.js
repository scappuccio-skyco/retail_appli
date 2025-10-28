import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { LogOut, Users, TrendingUp, Award } from 'lucide-react';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer } from 'recharts';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function ManagerDashboard({ user, onLogout }) {
  const [sellers, setSellers] = useState([]);
  const [selectedSeller, setSelectedSeller] = useState(null);
  const [sellerStats, setSellerStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSellers();
  }, []);

  const fetchSellers = async () => {
    try {
      const res = await axios.get(`${API}/manager/sellers`);
      setSellers(res.data);
    } catch (err) {
      toast.error('Erreur de chargement des vendeurs');
    } finally {
      setLoading(false);
    }
  };

  const fetchSellerStats = async (sellerId) => {
    try {
      const res = await axios.get(`${API}/manager/seller/${sellerId}/stats`);
      setSellerStats(res.data);
    } catch (err) {
      toast.error('Erreur de chargement des statistiques');
    }
  };

  const handleSellerClick = async (seller) => {
    setSelectedSeller(seller);
    await fetchSellerStats(seller.id);
  };

  const radarData = sellerStats?.avg_radar_scores
    ? [
        { skill: 'Accueil', value: sellerStats.avg_radar_scores.accueil },
        { skill: 'Découverte', value: sellerStats.avg_radar_scores.decouverte },
        { skill: 'Argumentation', value: sellerStats.avg_radar_scores.argumentation },
        { skill: 'Closing', value: sellerStats.avg_radar_scores.closing },
        { skill: 'Fidélisation', value: sellerStats.avg_radar_scores.fidelisation }
      ]
    : [];

  if (loading) {
    return (
      <div data-testid="manager-loading" className="flex items-center justify-center min-h-screen">
        <div className="text-xl font-medium text-gray-600">Chargement...</div>
      </div>
    );
  }

  return (
    <div data-testid="manager-dashboard" className="min-h-screen p-4 md:p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="glass-morphism rounded-3xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-2">
              Tableau de Bord Manager
            </h1>
            <p className="text-gray-600">Bienvenue, {user.name}</p>
          </div>
          <button
            data-testid="logout-button"
            onClick={onLogout}
            className="btn-secondary flex items-center gap-2"
          >
            <LogOut className="w-5 h-5" />
            Déconnexion
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="glass-morphism rounded-2xl p-6 card-hover">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Vendeurs</p>
                <p className="text-3xl font-bold text-gray-800">{sellers.length}</p>
              </div>
            </div>
          </div>

          <div className="glass-morphism rounded-2xl p-6 card-hover">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Évaluations Totales</p>
                <p className="text-3xl font-bold text-gray-800">
                  {sellers.reduce((sum, s) => sum + s.total_evaluations, 0)}
                </p>
              </div>
            </div>
          </div>

          <div className="glass-morphism rounded-2xl p-6 card-hover">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <Award className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Score Moyen Équipe</p>
                <p className="text-3xl font-bold text-gray-800">
                  {sellers.length > 0
                    ? (sellers.reduce((sum, s) => sum + s.avg_score, 0) / sellers.length).toFixed(2)
                    : 0}
                  /5
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Sellers List */}
          <div className="glass-morphism rounded-2xl p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Équipe de Vente</h2>
            {sellers.length > 0 ? (
              <div className="space-y-3">
                {sellers.map((seller) => (
                  <div
                    key={seller.id}
                    data-testid={`seller-${seller.id}`}
                    onClick={() => handleSellerClick(seller)}
                    className={`bg-white rounded-xl p-5 border-2 cursor-pointer transition-all hover:shadow-lg ${
                      selectedSeller?.id === seller.id
                        ? 'border-blue-500 shadow-md'
                        : 'border-gray-200'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-semibold text-lg text-gray-800">{seller.name}</h3>
                        <p className="text-sm text-gray-500">{seller.email}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-blue-600">{seller.avg_score}/5</div>
                        <p className="text-xs text-gray-500">{seller.total_evaluations} évals</p>
                      </div>
                    </div>
                    {seller.last_feedback_date && (
                      <p className="text-xs text-gray-500">
                        Dernière éval: {new Date(seller.last_feedback_date).toLocaleDateString('fr-FR')}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                Aucun vendeur sous votre supervision
              </div>
            )}
          </div>

          {/* Seller Details */}
          <div className="glass-morphism rounded-2xl p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Détails Vendeur</h2>
            {sellerStats ? (
              <div>
                {/* Radar Chart */}
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-700 mb-4">Compétences</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="#cbd5e1" />
                      <PolarAngleAxis dataKey="skill" tick={{ fill: '#475569', fontSize: 12 }} />
                      <Radar name="Score" dataKey="value" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>

                {/* Recent Evaluations */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-700 mb-4">Dernières Évaluations</h3>
                  {sellerStats.evaluations.length > 0 ? (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {sellerStats.evaluations.slice(0, 5).map((evaluation) => (
                        <div
                          key={evaluation.id}
                          className="bg-white rounded-lg p-4 border border-gray-200"
                        >
                          <p className="text-xs text-gray-500 mb-2">
                            {new Date(evaluation.created_at).toLocaleDateString('fr-FR')}
                          </p>
                          <div className="flex gap-2 text-xs mb-3">
                            <span>A: {evaluation.accueil}</span>
                            <span>D: {evaluation.decouverte}</span>
                            <span>Ar: {evaluation.argumentation}</span>
                            <span>C: {evaluation.closing}</span>
                            <span>F: {evaluation.fidelisation}</span>
                          </div>
                          {evaluation.ai_feedback && (
                            <p className="text-xs text-gray-700 bg-blue-50 p-3 rounded-lg">
                              {evaluation.ai_feedback}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">Aucune évaluation disponible</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                Sélectionnez un vendeur pour voir ses détails
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
