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
import InviteStaffModal from '../components/gerant/InviteStaffModal';

const GerantDashboard = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const backendUrl = process.env.REACT_APP_BACKEND_URL;

  const [stores, setStores] = useState([]);
  const [globalStats, setGlobalStats] = useState(null);
  const [storesStats, setStoresStats] = useState({});
  const [loading, setLoading] = useState(true);

  // Modal states
  const [showCreateStoreModal, setShowCreateStoreModal] = useState(false);
  const [showStoreDetailModal, setShowStoreDetailModal] = useState(false);
  const [showManagerTransferModal, setShowManagerTransferModal] = useState(false);
  const [showSellerTransferModal, setShowSellerTransferModal] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  
  // Selected items for modals
  const [selectedStore, setSelectedStore] = useState(null);
  const [selectedManager, setSelectedManager] = useState(null);
  const [selectedSeller, setSelectedSeller] = useState(null);

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

  // Charger les données au montage
  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
    // fetchDashboardData ne change pas, donc on peut ignorer l'avertissement
    // eslint-disable-next-line
  }, [user]);

  const handleLogoutClick = () => {
    if (onLogout) {
      onLogout();
    } else {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      navigate('/login');
    }
  };

  const handleStoreClick = (store) => {
    setSelectedStore(store);
    setShowStoreDetailModal(true);
  };

  const handleCreateStore = async (formData) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${backendUrl}/api/gerant/stores`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Erreur lors de la création');
      }

      toast.success('Magasin créé avec succès ! 🎉');
      await fetchDashboardData();
    } catch (error) {
      console.error('Erreur création magasin:', error);
      throw error;
    }
  };

  const handleTransferManager = async (managerId, newStoreId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${backendUrl}/api/gerant/managers/${managerId}/transfer`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ new_store_id: newStoreId })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Erreur lors du transfert');
      }

      const result = await response.json();
      
      if (result.warning) {
        toast.warning(result.warning);
      } else {
        toast.success('Manager transféré avec succès ! 🎉');
      }
      
      await fetchDashboardData();
    } catch (error) {
      console.error('Erreur transfert manager:', error);
      throw error;
    }
  };

  const handleTransferSeller = async (sellerId, newStoreId, newManagerId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${backendUrl}/api/gerant/sellers/${sellerId}/transfer`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          new_store_id: newStoreId,
          new_manager_id: newManagerId
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Erreur lors du transfert');
      }

      toast.success('Vendeur transféré avec succès ! 🎉');
      await fetchDashboardData();
    } catch (error) {
      console.error('Erreur transfert vendeur:', error);
      throw error;
    }
  };

  const handleDeleteStore = async (storeId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${backendUrl}/api/gerant/stores/${storeId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Erreur lors de la suppression');
      }

      toast.success('Magasin supprimé avec succès');
      await fetchDashboardData();
    } catch (error) {
      console.error('Erreur suppression magasin:', error);
      throw error;
    }
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
                onClick={handleLogoutClick}
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
              onClick={() => setShowCreateStoreModal(true)}
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
                onClick={() => setShowCreateStoreModal(true)}
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

      {/* Modals */}
      {showCreateStoreModal && (
        <CreateStoreModal
          onClose={() => setShowCreateStoreModal(false)}
          onCreate={handleCreateStore}
        />
      )}

      {showStoreDetailModal && selectedStore && (
        <StoreDetailModal
          store={selectedStore}
          onClose={() => {
            setShowStoreDetailModal(false);
            setSelectedStore(null);
          }}
          onTransferManager={(manager) => {
            setSelectedManager(manager);
            setShowManagerTransferModal(true);
          }}
          onTransferSeller={(seller) => {
            setSelectedSeller(seller);
            setShowSellerTransferModal(true);
          }}
          onDeleteStore={(store) => {
            setSelectedStore(store);
            setShowDeleteConfirmation(true);
          }}
          onRefresh={fetchDashboardData}
        />
      )}

      {showManagerTransferModal && selectedManager && (
        <ManagerTransferModal
          manager={selectedManager}
          stores={stores}
          currentStoreId={selectedStore?.id}
          onClose={() => {
            setShowManagerTransferModal(false);
            setSelectedManager(null);
          }}
          onTransfer={handleTransferManager}
        />
      )}

      {showSellerTransferModal && selectedSeller && (
        <SellerTransferModal
          seller={selectedSeller}
          stores={stores}
          currentStoreId={selectedStore?.id}
          onClose={() => {
            setShowSellerTransferModal(false);
            setSelectedSeller(null);
          }}
          onTransfer={handleTransferSeller}
        />
      )}

      {showDeleteConfirmation && selectedStore && (
        <DeleteStoreConfirmation
          store={selectedStore}
          onClose={() => {
            setShowDeleteConfirmation(false);
            // Don't reset selectedStore here as StoreDetailModal might still need it
          }}
          onDelete={handleDeleteStore}
        />
      )}
    </div>
  );
};

export default GerantDashboard;
