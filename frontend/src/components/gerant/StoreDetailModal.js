import React, { useState, useEffect } from 'react';
import { X, Users, TrendingUp, UserPlus, RefreshCw, Trash2 } from 'lucide-react';

const StoreDetailModal = ({ store, onClose, onTransferManager, onTransferSeller, onDeleteStore, onRefresh }) => {
  const [activeTab, setActiveTab] = useState('managers');
  const [managers, setManagers] = useState([]);
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const backendUrl = process.env.REACT_APP_BACKEND_URL;

  useEffect(() => {
    fetchStoreTeam();
  }, [store]);

  const fetchStoreTeam = async () => {
    try {
      const token = localStorage.getItem('token');

      // Récupérer les managers
      const managersResponse = await fetch(`${backendUrl}/api/gerant/stores/${store.id}/managers`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (managersResponse.ok) {
        const managersData = await managersResponse.json();
        setManagers(managersData);
      }

      // Récupérer les vendeurs
      const sellersResponse = await fetch(`${backendUrl}/api/gerant/stores/${store.id}/sellers`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (sellersResponse.ok) {
        const sellersData = await sellersResponse.json();
        setSellers(sellersData);
      }
    } catch (error) {
      console.error('Erreur chargement équipe:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white hover:text-gray-200 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          
          <h2 className="text-2xl font-bold text-white mb-2">{store.name}</h2>
          <p className="text-white opacity-90">📍 {store.location}</p>
          {store.address && <p className="text-white opacity-80 text-sm mt-1">{store.address}</p>}
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 px-6">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('managers')}
              className={`py-3 px-4 font-semibold border-b-2 transition-colors ${
                activeTab === 'managers'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              👔 Managers ({managers.length})
            </button>
            <button
              onClick={() => setActiveTab('sellers')}
              className={`py-3 px-4 font-semibold border-b-2 transition-colors ${
                activeTab === 'sellers'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              👥 Vendeurs ({sellers.length})
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
              <p className="text-gray-600 mt-4">Chargement...</p>
            </div>
          ) : activeTab === 'managers' ? (
            <div className="space-y-3">
              {managers.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Users className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                  <p>Aucun manager dans ce magasin</p>
                </div>
              ) : (
                managers.map((manager) => (
                  <div
                    key={manager.id}
                    className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200"
                  >
                    <div>
                      <p className="font-semibold text-gray-800">{manager.name}</p>
                      <p className="text-sm text-gray-600">{manager.email}</p>
                    </div>
                    <button
                      onClick={() => onTransferManager(manager)}
                      className="flex items-center gap-2 px-3 py-2 bg-white border-2 border-blue-500 text-blue-600 rounded-lg hover:bg-blue-50 transition-all text-sm font-semibold"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Transférer
                    </button>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {sellers.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Users className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                  <p>Aucun vendeur dans ce magasin</p>
                </div>
              ) : (
                sellers.map((seller) => (
                  <div
                    key={seller.id}
                    className="flex items-center justify-between p-4 bg-purple-50 rounded-lg border border-purple-200"
                  >
                    <div>
                      <p className="font-semibold text-gray-800">{seller.name}</p>
                      <p className="text-sm text-gray-600">{seller.email}</p>
                      {seller.manager_id && (
                        <p className="text-xs text-gray-500 mt-1">
                          Manager: {managers.find(m => m.id === seller.manager_id)?.name || 'N/A'}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => onTransferSeller(seller)}
                      className="flex items-center gap-2 px-3 py-2 bg-white border-2 border-purple-500 text-purple-600 rounded-lg hover:bg-purple-50 transition-all text-sm font-semibold"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Transférer
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="border-t border-gray-200 p-6 bg-gray-50 flex items-center justify-between">
          <button
            onClick={() => onDeleteStore(store)}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all font-semibold"
          >
            <Trash2 className="w-4 h-4" />
            Supprimer le magasin
          </button>
          
          <div className="flex gap-2">
            <button
              onClick={() => {
                fetchStoreTeam();
                onRefresh();
              }}
              className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all font-semibold"
            >
              <RefreshCw className="w-4 h-4" />
              Actualiser
            </button>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-all font-semibold"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StoreDetailModal;
