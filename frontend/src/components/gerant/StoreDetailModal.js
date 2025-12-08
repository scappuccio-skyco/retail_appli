import React, { useState, useEffect } from 'react';
import { X, Users, TrendingUp, UserPlus, RefreshCw, Trash2, Pause } from 'lucide-react';
import StoreKPIModal from '../StoreKPIModal';

const StoreDetailModal = ({ store, onClose, onTransferManager, onTransferSeller, onDeleteStore, onRefresh }) => {
  const [activeTab, setActiveTab] = useState('performance');
  const [managers, setManagers] = useState([]);
  const [sellers, setSellers] = useState([]);
  const [pendingInvitations, setPendingInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0); // Force re-render après changement de statut
  const backendUrl = process.env.REACT_APP_BACKEND_URL;

  const fetchStoreTeam = async () => {
    try {
      const token = localStorage.getItem('token');

      // Récupérer les managers actifs
      const managersResponse = await fetch(`${backendUrl}/api/gerant/stores/${store.id}/managers`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (managersResponse.ok) {
        const managersData = await managersResponse.json();
        console.log('Managers chargés:', managersData);
        setManagers(managersData || []);
      } else {
        console.error('Erreur chargement managers:', managersResponse.status);
        setManagers([]);
      }

      // Récupérer les vendeurs
      const sellersResponse = await fetch(`${backendUrl}/api/gerant/stores/${store.id}/sellers`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (sellersResponse.ok) {
        const sellersData = await sellersResponse.json();
        console.log('Vendeurs chargés:', sellersData);
        setSellers(sellersData || []);
      } else {
        console.error('Erreur chargement vendeurs:', sellersResponse.status);
        setSellers([]);
      }

      // Récupérer toutes les invitations en attente
      const invitationsResponse = await fetch(`${backendUrl}/api/gerant/invitations`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (invitationsResponse.ok) {
        const allInvitations = await invitationsResponse.json();
        // Filtrer les invitations pour ce magasin et status pending
        const storeInvitations = allInvitations.filter(
          inv => inv.store_id === store.id && inv.status === 'pending'
        );
        setPendingInvitations(storeInvitations);
      }
    } catch (error) {
      console.error('Erreur chargement équipe:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId, userRole, userName) => {
    const roleLabel = userRole === 'manager' ? 'le manager' : 'le vendeur';
    const warningMessage = userRole === 'manager'
      ? `⚠️ ATTENTION : Suppression d'un Manager\n\nVous êtes sur le point de supprimer ${roleLabel} "${userName}".\n\n❗ Conséquences :\n- Le manager ne pourra plus se connecter\n- Ses données historiques seront conservées\n- Les vendeurs sous sa responsabilité resteront actifs\n\nCette action est IRRÉVERSIBLE.\n\nConfirmez-vous la suppression ?`
      : `⚠️ ATTENTION : Suppression d'un Vendeur\n\nVous êtes sur le point de supprimer ${roleLabel} "${userName}".\n\n❗ Conséquences :\n- Le vendeur ne pourra plus se connecter\n- Ses KPIs et historique seront conservés\n- Ses données resteront visibles dans les rapports\n\nCette action est IRRÉVERSIBLE.\n\nConfirmez-vous la suppression ?`;
    
    if (!window.confirm(warningMessage)) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const endpoint = userRole === 'manager' 
        ? `${backendUrl}/api/gerant/managers/${userId}`
        : `${backendUrl}/api/gerant/sellers/${userId}`;
        
      const response = await fetch(endpoint, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        // Mettre à jour la liste localement
        if (userRole === 'manager') {
          setManagers(managers.filter(m => m.id !== userId));
        } else if (userRole === 'seller') {
          setSellers(sellers.filter(s => s.id !== userId));
        }
        // Rafraîchir si besoin
        if (onRefresh) {
          onRefresh();
        }
      } else {
        const error = await response.json();
        alert(error.detail || 'Erreur lors de la suppression');
      }
    } catch (error) {
      console.error('Erreur suppression utilisateur:', error);
      alert('Erreur lors de la suppression');
    }
  };

  const handleToggleSuspend = async (userId, userRole, userName, action) => {
    const roleLabel = userRole === 'manager' ? 'le manager' : 'le vendeur';
    const actionLabel = action === 'suspend' ? 'suspendre' : 'réactiver';
    const warningMessage = action === 'suspend'
      ? `Suspendre ${roleLabel} "${userName}" ?\n\n⚠️ Conséquences :\n- ${userRole === 'manager' ? 'Le manager' : 'Le vendeur'} ne pourra plus se connecter\n- Ses données seront conservées\n- Vous pourrez le réactiver à tout moment\n\nConfirmez-vous ?`
      : `Réactiver ${roleLabel} "${userName}" ?\n\n✅ ${userRole === 'manager' ? 'Le manager' : 'Le vendeur'} pourra à nouveau se connecter et accéder à l'application.\n\nConfirmez-vous ?`;
    
    if (!window.confirm(warningMessage)) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const endpoint = userRole === 'manager' 
        ? `${backendUrl}/api/gerant/managers/${userId}/${action}`
        : `${backendUrl}/api/gerant/sellers/${userId}/${action}`;
        
      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const result = await response.json();
        // Incrémenter refreshKey pour forcer un re-render complet et éviter l'erreur DOM
        setRefreshKey(prev => prev + 1);
        // Recharger toutes les données de l'équipe
        await fetchStoreTeam();
        // Rafraîchir si besoin
        if (onRefresh) {
          onRefresh();
        }
        // Message de succès (pas d'alert pour éviter les erreurs DOM)
        console.log(result.message || `${userRole === 'manager' ? 'Manager' : 'Vendeur'} ${action === 'suspend' ? 'suspendu' : 'réactivé'} avec succès`);
      } else {
        const error = await response.json();
        console.error(error.detail || `Erreur lors de ${actionLabel}`);
      }
    } catch (error) {
      console.error(`Erreur ${actionLabel}:`, error);
    }
  };

  const handleCancelInvitation = async (invitationId) => {
    if (!window.confirm('Êtes-vous sûr de vouloir annuler cette invitation ?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${backendUrl}/api/gerant/invitations/${invitationId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        // Mettre à jour la liste localement
        setPendingInvitations(pendingInvitations.filter(inv => inv.id !== invitationId));
        // Optionnel: rafraîchir si besoin
        if (onRefresh) {
          onRefresh();
        }
      } else {
        const error = await response.json();
        alert(error.detail || 'Erreur lors de l\'annulation de l\'invitation');
      }
    } catch (error) {
      console.error('Erreur annulation invitation:', error);
      alert('Erreur lors de l\'annulation de l\'invitation');
    }
  };

  useEffect(() => {
    if (store && store.id) {
      console.log('useEffect déclenché pour store:', store.id);
      fetchStoreTeam();
    }
  }, [store?.id]); // Dépendance sur store.id uniquement

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] shadow-2xl flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 p-6 relative flex-shrink-0">
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
        <div className="border-b border-gray-200 px-6 flex-shrink-0">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('performance')}
              className={`py-3 px-4 font-semibold border-b-2 transition-colors ${
                activeTab === 'performance'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              📊 Performance
            </button>
            <button
              onClick={() => setActiveTab('managers')}
              className={`py-3 px-4 font-semibold border-b-2 transition-colors ${
                activeTab === 'managers'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              👔 Managers actifs ({managers.filter(m => m.status === 'active').length})
            </button>
            <button
              onClick={() => setActiveTab('sellers')}
              className={`py-3 px-4 font-semibold border-b-2 transition-colors ${
                activeTab === 'sellers'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              👥 Vendeurs actifs ({sellers.filter(s => s.status === 'active').length})
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 min-h-0">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
              <p className="text-gray-600 mt-4">Chargement...</p>
            </div>
          ) : activeTab === 'performance' ? (
            <div className="h-full">
              <StoreKPIModal 
                onClose={() => console.log('Close not needed')} 
                onSuccess={() => onRefresh()}
                hideCloseButton={true}
                storeId={store.id}
                storeName={store.name}
              />
            </div>
          ) : activeTab === 'managers' ? (
            <div key={`managers-${refreshKey}`} className="space-y-3">
              {managers.length === 0 && pendingInvitations.filter(inv => inv.role === 'manager').length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Users className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                  <p>Aucun manager dans ce magasin</p>
                </div>
              ) : (
                <>
                  {/* Managers actifs */}
                  {managers.map((manager) => (
                    <div
                      key={`${manager.id}-${refreshKey}`}
                      className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-gray-800">{manager.name}</p>
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                            manager.status === 'suspended' 
                              ? 'bg-orange-100 text-orange-700' 
                              : 'bg-green-100 text-green-700'
                          }`}>
                            {manager.status === 'suspended' ? '⏸ En veille' : '✓ Actif'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">{manager.email}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => onTransferManager(manager)}
                          className="flex items-center gap-2 px-3 py-2 bg-white border-2 border-blue-500 text-blue-600 rounded-lg hover:bg-blue-50 transition-all text-sm font-semibold"
                        >
                          <RefreshCw className="w-4 h-4" />
                          Transférer
                        </button>
                        {manager.status === 'suspended' ? (
                          <button
                            onClick={() => handleToggleSuspend(manager.id, 'manager', manager.name, 'reactivate')}
                            className="flex items-center gap-2 px-3 py-2 bg-white border-2 border-green-500 text-green-600 rounded-lg hover:bg-green-50 transition-all text-sm font-semibold"
                            title="Réactiver le manager"
                          >
                            <RefreshCw className="w-4 h-4" />
                            Réactiver
                          </button>
                        ) : (
                          <button
                            onClick={() => handleToggleSuspend(manager.id, 'manager', manager.name, 'suspend')}
                            className="flex items-center gap-2 px-3 py-2 bg-white border-2 border-orange-500 text-orange-600 rounded-lg hover:bg-orange-50 transition-all text-sm font-semibold"
                            title="Suspendre le manager"
                          >
                            <Pause className="w-4 h-4" />
                            Suspendre
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteUser(manager.id, 'manager', manager.name)}
                          className="flex items-center gap-2 px-3 py-2 bg-white border-2 border-red-500 text-red-600 rounded-lg hover:bg-red-50 transition-all text-sm font-semibold"
                          title="Supprimer le manager"
                        >
                          <Trash2 className="w-4 h-4" />
                          Supprimer
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Invitations en attente pour managers */}
                  {pendingInvitations.filter(inv => inv.role === 'manager').map((invitation) => (
                    <div
                      key={invitation.id}
                      className="flex items-center justify-between p-4 bg-orange-50 rounded-lg border border-orange-200"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-gray-800">Manager en attente</p>
                          <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs font-semibold rounded-full">
                            📨 Invitation envoyée
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">{invitation.email}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          Envoyée le {new Date(invitation.created_at).toLocaleDateString('fr-FR')}
                        </p>
                      </div>
                      <button
                        onClick={() => handleCancelInvitation(invitation.id)}
                        className="ml-4 px-3 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                        title="Annuler l'invitation"
                      >
                        ✕ Annuler
                      </button>
                    </div>
                  ))}
                </>
              )}
            </div>
          ) : (
            <div key={`sellers-${refreshKey}`} className="space-y-3">
              {sellers.length === 0 && pendingInvitations.filter(inv => inv.role === 'seller').length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Users className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                  <p>Aucun vendeur dans ce magasin</p>
                </div>
              ) : (
                <>
                  {/* Vendeurs actifs */}
                  {sellers.map((seller) => (
                    <div
                      key={`${seller.id}-${refreshKey}`}
                      className="flex items-center justify-between p-4 bg-purple-50 rounded-lg border border-purple-200"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-gray-800">{seller.name}</p>
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                            seller.status === 'suspended' 
                              ? 'bg-orange-100 text-orange-700' 
                              : 'bg-green-100 text-green-700'
                          }`}>
                            {seller.status === 'suspended' ? '⏸ En veille' : '✓ Actif'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">{seller.email}</p>
                        {seller.manager_id && (
                          <p className="text-xs text-gray-500 mt-1">
                            Manager: {managers.find(m => m.id === seller.manager_id)?.name || 'N/A'}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => onTransferSeller(seller)}
                          className="flex items-center gap-2 px-3 py-2 bg-white border-2 border-purple-500 text-purple-600 rounded-lg hover:bg-purple-50 transition-all text-sm font-semibold"
                        >
                          <RefreshCw className="w-4 h-4" />
                          Transférer
                        </button>
                        {seller.status === 'suspended' ? (
                          <button
                            onClick={() => handleToggleSuspend(seller.id, 'seller', seller.name, 'reactivate')}
                            className="flex items-center gap-2 px-3 py-2 bg-white border-2 border-green-500 text-green-600 rounded-lg hover:bg-green-50 transition-all text-sm font-semibold"
                            title="Réactiver le vendeur"
                          >
                            <RefreshCw className="w-4 h-4" />
                            Réactiver
                          </button>
                        ) : (
                          <button
                            onClick={() => handleToggleSuspend(seller.id, 'seller', seller.name, 'suspend')}
                            className="flex items-center gap-2 px-3 py-2 bg-white border-2 border-orange-500 text-orange-600 rounded-lg hover:bg-orange-50 transition-all text-sm font-semibold"
                            title="Suspendre le vendeur"
                          >
                            <Pause className="w-4 h-4" />
                            Suspendre
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteUser(seller.id, 'seller', seller.name)}
                          className="flex items-center gap-2 px-3 py-2 bg-white border-2 border-red-500 text-red-600 rounded-lg hover:bg-red-50 transition-all text-sm font-semibold"
                          title="Supprimer le vendeur"
                        >
                          <Trash2 className="w-4 h-4" />
                          Supprimer
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Invitations en attente pour vendeurs */}
                  {pendingInvitations.filter(inv => inv.role === 'seller').map((invitation) => (
                    <div
                      key={invitation.id}
                      className="flex items-center justify-between p-4 bg-orange-50 rounded-lg border border-orange-200"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-gray-800">Vendeur en attente</p>
                          <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs font-semibold rounded-full">
                            📨 Invitation envoyée
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">{invitation.email}</p>
                        {invitation.manager_name && (
                          <p className="text-xs text-gray-500 mt-1">
                            Manager assigné: {invitation.manager_name}
                          </p>
                        )}
                        <p className="text-xs text-gray-500 mt-1">
                          Envoyée le {new Date(invitation.created_at).toLocaleDateString('fr-FR')}
                        </p>
                      </div>
                      <button
                        onClick={() => handleCancelInvitation(invitation.id)}
                        className="ml-4 px-3 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                        title="Annuler l'invitation"
                      >
                        ✕ Annuler
                      </button>
                    </div>
                  ))}
                </>
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
