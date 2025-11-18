import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Plus, Building2, Users, TrendingUp, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';
import StoreCard from '../components/gerant/StoreCard';
import CreateStoreModal from '../components/gerant/CreateStoreModal';
import StoreDetailModal from '../components/gerant/StoreDetailModal';
import ManagerTransferModal from '../components/gerant/ManagerTransferModal';
import SellerTransferModal from '../components/gerant/SellerTransferModal';
import DeleteStoreConfirmation from '../components/gerant/DeleteStoreConfirmation';

const GerantDashboard = () => {
  const navigate = useNavigate();
  const backendUrl = process.env.REACT_APP_BACKEND_URL;

  const [user, setUser] = useState(null);
  const [stores, setStores] = useState([]);
  const [globalStats, setGlobalStats] = useState(null);
  const [storesStats, setStoresStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [hasCheckedAuth, setHasCheckedAuth] = useState(false);

  // Vérifier l'auth seulement au montage
  useEffect(() => {
    if (hasCheckedAuth) return;
    
    const userData = localStorage.getItem('user');
    if (!userData) {
      navigate('/login');
      return;
    }

    const parsedUser = JSON.parse(userData);
    setUser(parsedUser);

    if (parsedUser.role !== 'gerant') {
      navigate('/login');
      return;
    }

    setHasCheckedAuth(true);
  }, [hasCheckedAuth, navigate]);

  // Fetch data après authentification
  useEffect(() => {
    if (hasCheckedAuth && user) {
      fetchDashboardData();
    }
  }, [hasCheckedAuth, user]);

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('token');

      // Récupérer les stats globales et la liste des magasins
      const statsResponse = await fetch(`${backendUrl}/api/gerant/dashboard/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (statsResponse.ok) {
        const data = await statsResponse.json();
        setGlobalStats(data);
        setStores(data.stores || []);

        // Récupérer les stats détaillées de chaque magasin
        const storesStatsPromises = data.stores.map(store =>
          fetch(`${backendUrl}/api/gerant/stores/${store.id}/stats`, {
            headers: { 'Authorization': `Bearer ${token}` }
          }).then(res => res.json())
        );

        const storesStatsData = await Promise.all(storesStatsPromises);
        const statsMap = {};
        storesStatsData.forEach((stats, index) => {
          statsMap[data.stores[index].id] = stats;
        });
        setStoresStats(statsMap);
      }
    } catch (error) {
      console.error('Erreur chargement données:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const handleStoreClick = (store) => {
    // TODO: Ouvrir modal détails magasin
    console.log('Store clicked:', store);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50">
      {/* Header */}
      <div className="bg-white shadow-md border-b-4 border-purple-500">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                🏢 Dashboard Gérant
              </h1>
              <p className="text-sm text-gray-600">Bonjour, {user?.name}</p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2.5 bg-white border-2 border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 hover:shadow-md transition-all"
              >
                <LogOut className="w-5 h-5" />
                <span className="hidden sm:inline">Déconnexion</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats Globales */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-purple-600" />
            Vue d'Ensemble
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Magasins */}
            <div className="glass-morphism rounded-xl p-6 border-2 border-purple-200">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Magasins</p>
                  <p className="text-2xl font-bold text-gray-800">{globalStats?.total_stores || 0}</p>
                </div>
              </div>
            </div>

            {/* Total Managers */}
            <div className="glass-morphism rounded-xl p-6 border-2 border-blue-200">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Managers</p>
                  <p className="text-2xl font-bold text-gray-800">{globalStats?.total_managers || 0}</p>
                </div>
              </div>
            </div>

            {/* Total Vendeurs */}
            <div className="glass-morphism rounded-xl p-6 border-2 border-pink-200">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 bg-pink-100 rounded-lg flex items-center justify-center">
                  <Users className="w-6 h-6 text-pink-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Vendeurs</p>
                  <p className="text-2xl font-bold text-gray-800">{globalStats?.total_sellers || 0}</p>
                </div>
              </div>
            </div>

            {/* CA Total Aujourd'hui */}
            <div className="glass-morphism rounded-xl p-6 border-2 border-green-200">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">CA Aujourd'hui</p>
                  <p className="text-2xl font-bold text-gray-800">
                    {globalStats?.today_ca ? `${globalStats.today_ca.toLocaleString('fr-FR')} €` : '0 €'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Mes Magasins */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Building2 className="w-6 h-6 text-purple-600" />
              Mes Magasins
            </h2>
            <button
              onClick={() => console.log('Créer magasin')}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all"
            >
              <Plus className="w-5 h-5" />
              Nouveau Magasin
            </button>
          </div>

          {stores.length === 0 ? (
            <div className="glass-morphism rounded-xl p-12 text-center">
              <Building2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">Aucun magasin pour le moment</p>
              <button
                onClick={() => console.log('Créer magasin')}
                className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all"
              >
                Créer votre premier magasin
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {stores.map((store) => (
                <StoreCard
                  key={store.id}
                  store={store}
                  stats={storesStats[store.id]}
                  onClick={() => handleStoreClick(store)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GerantDashboard;
