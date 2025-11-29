import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  Users, UserCog, Search, Filter, Building2, Mail, Phone, 
  MoreVertical, Trash2, Ban, CheckCircle, ArrowRightLeft, X 
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function StaffOverview({ onRefresh }) {
  const [activeTab, setActiveTab] = useState('managers');
  const [managers, setManagers] = useState([]);
  const [sellers, setSellers] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [storeFilter, setStoreFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('active'); // Par défaut : afficher uniquement les actifs
  const [actionMenuOpen, setActionMenuOpen] = useState(null);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const [managersRes, sellersRes, storesRes] = await Promise.all([
        axios.get(`${API}/gerant/managers`, { headers }),
        axios.get(`${API}/gerant/sellers`, { headers }),
        axios.get(`${API}/gerant/stores`, { headers })
      ]);

      setManagers(managersRes.data || []);
      setSellers(sellersRes.data || []);
      setStores(storesRes.data || []);
    } catch (error) {
      toast.error('Erreur lors du chargement des données');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSuspend = async (userId, role) => {
    if (!window.confirm('Êtes-vous sûr de vouloir suspendre cet utilisateur ?')) return;

    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      const endpoint = role === 'manager' 
        ? `${API}/gerant/managers/${userId}/suspend`
        : `${API}/gerant/sellers/${userId}/suspend`;

      await axios.patch(endpoint, {}, { headers });
      toast.success('Utilisateur suspendu avec succès');
      fetchData();
      setActionMenuOpen(null);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la suspension');
    }
  };

  const handleReactivate = async (userId, role) => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      const endpoint = role === 'manager'
        ? `${API}/gerant/managers/${userId}/reactivate`
        : `${API}/gerant/sellers/${userId}/reactivate`;

      await axios.patch(endpoint, {}, { headers });
      toast.success('Utilisateur réactivé avec succès');
      fetchData();
      setActionMenuOpen(null);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la réactivation');
    }
  };

  const handleDelete = async (userId, role) => {
    // Pour les managers, vérifier d'abord s'ils ont des vendeurs
    if (role === 'manager') {
      const manager = (activeTab === 'managers' ? managers : sellers).find(u => u.id === userId);
      
      // Compter les vendeurs actifs de ce manager
      const sellersCount = sellers.filter(s => 
        s.manager_id === userId && 
        (s.status === 'active' || s.status === 'suspended')
      ).length;
      
      if (sellersCount > 0) {
        const confirmMessage = `⚠️ ATTENTION\n\nCe manager a ${sellersCount} vendeur(s) sous sa responsabilité.\n\nLes vendeurs resteront attachés à leur magasin (aucune perte de données), mais n'auront plus de manager actif.\n\n✅ Recommandation : Transférez d'abord les vendeurs vers un autre manager.\n\nVoulez-vous quand même supprimer ce manager ?`;
        
        if (!window.confirm(confirmMessage)) return;
      }
    }
    
    // Confirmation finale
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer définitivement cet utilisateur ? Cette action est irréversible.')) return;

    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      const endpoint = role === 'manager'
        ? `${API}/gerant/managers/${userId}`
        : `${API}/gerant/sellers/${userId}`;

      await axios.delete(endpoint, { headers });
      toast.success('Utilisateur supprimé avec succès');
      fetchData();
      setActionMenuOpen(null);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la suppression');
    }
  };

  const openTransferModal = (user) => {
    setSelectedUser(user);
    setTransferModalOpen(true);
    setActionMenuOpen(null);
  };

  const handleTransfer = async (newStoreId, newManagerId) => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      if (selectedUser.role === 'manager') {
        await axios.post(
          `${API}/gerant/managers/${selectedUser.id}/transfer`,
          { new_store_id: newStoreId },
          { headers }
        );
      } else {
        await axios.post(
          `${API}/gerant/sellers/${selectedUser.id}/transfer`,
          { new_store_id: newStoreId, new_manager_id: newManagerId },
          { headers }
        );
      }

      toast.success('Transfert effectué avec succès');
      fetchData();
      if (onRefresh) onRefresh(); // Rafraîchir les cartes de magasins
      setTransferModalOpen(false);
      setSelectedUser(null);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors du transfert');
    }
  };

  const getStoreName = (storeId) => {
    const store = stores.find(s => s.id === storeId);
    return store ? store.name : 'N/A';
  };

  const getStatusBadge = (status) => {
    // Normaliser le statut : undefined, null, vide, ou 'inactive' = 'active' par défaut
    const normalizedStatus = (!status || status === 'inactive') ? 'active' : status;
    
    switch (normalizedStatus) {
      case 'active':
        return <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">Actif</span>;
      case 'suspended':
        return <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs">Suspendu</span>;
      case 'deleted':
        return <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs">Supprimé</span>;
      default:
        return <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">Actif</span>;
    }
  };

  const filterUsers = (users) => {
    return users.filter(user => {
      const matchesSearch = 
        user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStore = storeFilter === 'all' || user.store_id === storeFilter;
      const matchesStatus = statusFilter === 'all' || (user.status || 'active') === statusFilter;

      return matchesSearch && matchesStore && matchesStatus;
    });
  };

  const filteredManagers = filterUsers(managers);
  const filteredSellers = filterUsers(sellers);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-gray-600">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Vue générale du personnel</h2>
          <p className="text-gray-600 mt-1">
            Gérez tous vos managers et vendeurs depuis une seule vue
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Rechercher par nom ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          <select
            value={storeFilter}
            onChange={(e) => setStoreFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="all">Tous les magasins</option>
            {stores.map(store => (
              <option key={store.id} value={store.id}>{store.name}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="all">Tous les statuts</option>
            <option value="active">Actif</option>
            <option value="suspended">Suspendu</option>
            <option value="deleted">Supprimé</option>
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <div className="flex">
            <button
              onClick={() => setActiveTab('managers')}
              className={`flex items-center gap-2 px-6 py-4 font-medium border-b-2 transition-colors ${
                activeTab === 'managers'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <UserCog className="w-5 h-5" />
              Managers ({filteredManagers.length})
            </button>
            <button
              onClick={() => setActiveTab('sellers')}
              className={`flex items-center gap-2 px-6 py-4 font-medium border-b-2 transition-colors ${
                activeTab === 'sellers'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <Users className="w-5 h-5" />
              Vendeurs ({filteredSellers.length})
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nom</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Téléphone</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Magasin</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {(activeTab === 'managers' ? filteredManagers : filteredSellers).map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900">{user.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Mail className="w-4 h-4" />
                      {user.email}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Phone className="w-4 h-4" />
                      {user.phone || 'N/A'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Building2 className="w-4 h-4" />
                      {getStoreName(user.store_id)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(user.status || 'active')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="relative">
                      <button
                        onClick={() => setActionMenuOpen(actionMenuOpen === user.id ? null : user.id)}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <MoreVertical className="w-5 h-5 text-gray-600" />
                      </button>

                      {actionMenuOpen === user.id && (
                        <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                          {(user.status || 'active') === 'active' && (
                            <>
                              <button
                                onClick={() => openTransferModal(user)}
                                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                              >
                                <ArrowRightLeft className="w-4 h-4" />
                                Transférer
                              </button>
                              <button
                                onClick={() => handleSuspend(user.id, user.role)}
                                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-orange-600"
                              >
                                <Ban className="w-4 h-4" />
                                Suspendre
                              </button>
                            </>
                          )}
                          {(user.status || 'active') === 'suspended' && (
                            <button
                              onClick={() => handleReactivate(user.id, user.role)}
                              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-green-600"
                            >
                              <CheckCircle className="w-4 h-4" />
                              Réactiver
                            </button>
                          )}
                          {(user.status || 'active') !== 'deleted' && (
                            <button
                              onClick={() => handleDelete(user.id, user.role)}
                              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-red-600 border-t"
                            >
                              <Trash2 className="w-4 h-4" />
                              Supprimer
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {(activeTab === 'managers' ? filteredManagers : filteredSellers).length === 0 && (
            <div className="text-center py-12 text-gray-500">
              Aucun résultat trouvé
            </div>
          )}
        </div>
      </div>

      {/* Transfer Modal */}
      {transferModalOpen && selectedUser && (
        <TransferModal
          user={selectedUser}
          stores={stores}
          managers={managers}
          onTransfer={handleTransfer}
          onClose={() => {
            setTransferModalOpen(false);
            setSelectedUser(null);
          }}
        />
      )}
    </div>
  );
}

// Transfer Modal Component
function TransferModal({ user, stores, managers, onTransfer, onClose }) {
  const [selectedStore, setSelectedStore] = useState('');
  const [selectedManager, setSelectedManager] = useState('');

  const availableManagers = managers.filter(m => m.store_id === selectedStore && m.status === 'active');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (user.role === 'seller' && !selectedManager) {
      toast.error('Veuillez sélectionner un manager');
      return;
    }
    onTransfer(selectedStore, selectedManager);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-6 border-b">
          <h3 className="text-lg font-semibold">Transférer {user.name}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nouveau magasin *
            </label>
            <select
              required
              value={selectedStore}
              onChange={(e) => {
                setSelectedStore(e.target.value);
                setSelectedManager('');
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
            >
              <option value="">Sélectionner un magasin</option>
              {stores.filter(s => s.id !== user.store_id).map(store => (
                <option key={store.id} value={store.id}>{store.name}</option>
              ))}
            </select>
          </div>

          {user.role === 'seller' && selectedStore && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nouveau manager *
              </label>
              <select
                required
                value={selectedManager}
                onChange={(e) => setSelectedManager(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                <option value="">Sélectionner un manager</option>
                {availableManagers.map(manager => (
                  <option key={manager.id} value={manager.id}>{manager.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              Transférer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
