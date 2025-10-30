import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { LogOut, Users, TrendingUp, Award, UserPlus, Clock, CheckCircle, XCircle, Sparkles, Settings } from 'lucide-react';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer } from 'recharts';
import InviteModal from '../components/InviteModal';
import KPIConfigModal from '../components/KPIConfigModal';
import SellerDetailView from '../components/SellerDetailView';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function ManagerDashboard({ user, onLogout }) {
  const [sellers, setSellers] = useState([]);
  const [selectedSeller, setSelectedSeller] = useState(null);
  const [sellerStats, setSellerStats] = useState(null);
  const [sellerDiagnostic, setSellerDiagnostic] = useState(null);
  const [invitations, setInvitations] = useState([]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showKPIConfigModal, setShowKPIConfigModal] = useState(false);
  const [showDetailView, setShowDetailView] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [sellersRes, invitesRes] = await Promise.all([
        axios.get(`${API}/manager/sellers`),
        axios.get(`${API}/manager/invitations`)
      ]);
      setSellers(sellersRes.data);
      setInvitations(invitesRes.data);
    } catch (err) {
      toast.error('Erreur de chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const fetchSellerStats = async (sellerId) => {
    try {
      const [statsRes, diagRes] = await Promise.all([
        axios.get(`${API}/manager/seller/${sellerId}/stats`),
        axios.get(`${API}/diagnostic/seller/${sellerId}`)
      ]);
      setSellerStats(statsRes.data);
      setSellerDiagnostic(diagRes.data);
    } catch (err) {
      toast.error('Erreur de chargement des statistiques');
    }
  };

  const handleSellerClick = async (seller) => {
    setSelectedSeller(seller);
    setShowDetailView(false); // Ne pas ouvrir la vue complète immédiatement
    await fetchSellerStats(seller.id);
  };
  
  const handleViewFullDetails = () => {
    setShowDetailView(true);
  };

  const handleInviteSuccess = () => {
    fetchData();
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

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-orange-500" />;
      case 'accepted':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'expired':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'pending':
        return 'En attente';
      case 'accepted':
        return 'Acceptée';
      case 'expired':
        return 'Expirée';
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <div data-testid="manager-loading" className="flex items-center justify-center min-h-screen">
        <div className="text-xl font-medium text-gray-600">Chargement...</div>
      </div>
    );
  }

  // Show seller detail view if a seller is selected
  if (showDetailView && selectedSeller) {
    return (
      <SellerDetailView 
        seller={selectedSeller} 
        onBack={() => {
          setShowDetailView(false);
          setSelectedSeller(null);
        }}
      />
    );
  }

  return (
    <div data-testid="manager-dashboard" className="min-h-screen p-4 md:p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="glass-morphism rounded-3xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <img src="/logo.jpg" alt="Logo" className="w-16 h-16 rounded-xl shadow-md object-cover" />
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-2">
                Tableau de Bord Manager
              </h1>
              <p className="text-gray-600">Bienvenue, {user.name}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowKPIConfigModal(true)}
              className="btn-secondary flex items-center gap-2"
            >
              <Settings className="w-5 h-5" />
              Configurer KPI
            </button>
            <button
              data-testid="invite-seller-button"
              onClick={() => setShowInviteModal(true)}
              className="btn-primary flex items-center gap-2"
            >
              <UserPlus className="w-5 h-5" />
              Inviter un Vendeur
            </button>
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
      </div>

      <div className="max-w-7xl mx-auto">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="glass-morphism rounded-2xl p-6 card-hover">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[#ffd871] bg-opacity-20 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-gray-800" />
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

        {/* Invitations Section */}
        {invitations.length > 0 && (
          <div className="glass-morphism rounded-2xl p-6 mb-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Invitations</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {invitations.map((invite) => (
                <div
                  key={invite.id}
                  data-testid={`invitation-${invite.id}`}
                  className="bg-white rounded-xl p-4 border border-gray-200"
                >
                  <div className="flex items-start justify-between mb-2">
                    <p className="font-medium text-gray-800">{invite.email}</p>
                    {getStatusIcon(invite.status)}
                  </div>
                  <p className="text-xs text-gray-500">{getStatusText(invite.status)}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(invite.created_at).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

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
                        ? 'border-[#ffd871] shadow-md'
                        : 'border-gray-200'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-semibold text-lg text-gray-800">{seller.name}</h3>
                        <p className="text-sm text-gray-500">{seller.email}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-gray-800">{seller.avg_score}/5</div>
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
                Aucun vendeur dans votre équipe. Cliquez sur "Inviter un Vendeur" pour commencer.
              </div>
            )}
          </div>

          {/* Seller Details */}
          <div className="glass-morphism rounded-2xl p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Détails Vendeur</h2>
            {sellerStats ? (
              <div>
                {/* Diagnostic Profile */}
                {sellerDiagnostic && (
                  <div className="mb-8 bg-[#ffd871] bg-opacity-10 rounded-2xl p-5 border-l-4 border-[#ffd871]">
                    <h3 className="text-lg font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-[#ffd871]" />
                      Profil Vendeur
                    </h3>
                    <div className="grid grid-cols-3 gap-4 mb-3">
                      <div>
                        <p className="text-xs text-gray-600">Style</p>
                        <p className="text-sm font-bold text-gray-800">{sellerDiagnostic.style}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600">Niveau</p>
                        <p className="text-sm font-bold text-gray-800">{sellerDiagnostic.level}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600">Motivation</p>
                        <p className="text-sm font-bold text-gray-800">{sellerDiagnostic.motivation}</p>
                      </div>
                    </div>
                    <p className="text-xs text-gray-700 leading-relaxed">
                      {sellerDiagnostic.ai_profile_summary}
                    </p>
                  </div>
                )}

                {/* Radar Chart */}
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-700 mb-4">Compétences</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="#cbd5e1" />
                      <PolarAngleAxis dataKey="skill" tick={{ fill: '#475569', fontSize: 12 }} />
                      <Radar name="Score" dataKey="value" stroke="#ffd871" fill="#ffd871" fillOpacity={0.6} />
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
                            <p className="text-xs text-gray-700 bg-[#ffd871] bg-opacity-10 p-3 rounded-lg">
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

      {showInviteModal && (
        <InviteModal
          onClose={() => setShowInviteModal(false)}
          onSuccess={handleInviteSuccess}
        />
      )}

      {showKPIConfigModal && (
        <KPIConfigModal
          onClose={() => setShowKPIConfigModal(false)}
          onSuccess={() => {
            setShowKPIConfigModal(false);
            fetchData();
          }}
        />
      )}
    </div>
  );
}
