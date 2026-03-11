import React, { useState, useEffect } from 'react';
import { X, Users, UserPlus, RefreshCw, Trash2, Pause, Lock } from 'lucide-react';
import StoreKPIModal from '../StoreKPIModal';
import { toast } from 'sonner';
import { api } from '../../lib/apiClient';
import { logger } from '../../utils/logger';

// Mapping des couleurs selon l'index - couleurs de base pour le gradient
const STORE_COLOR_CONFIG = [
  { name: 'orange', from: '#f97316', via: '#ea580c', to: '#c2410c', accent: 'text-orange-600 border-orange-600' },
  { name: 'blue', from: '#3b82f6', via: '#2563eb', to: '#1d4ed8', accent: 'text-blue-600 border-blue-600' },
  { name: 'purple', from: '#a855f7', via: '#9333ea', to: '#7e22ce', accent: 'text-purple-600 border-purple-600' },
  { name: 'emerald', from: '#10b981', via: '#059669', to: '#047857', accent: 'text-emerald-600 border-emerald-600' },
  { name: 'pink', from: '#ec4899', via: '#db2777', to: '#be185d', accent: 'text-pink-600 border-pink-600' },
  { name: 'cyan', from: '#06b6d4', via: '#0891b2', to: '#0e7490', accent: 'text-cyan-600 border-cyan-600' },
  { name: 'amber', from: '#f59e0b', via: '#d97706', to: '#b45309', accent: 'text-amber-600 border-amber-600' },
  { name: 'indigo', from: '#6366f1', via: '#4f46e5', to: '#4338ca', accent: 'text-indigo-600 border-indigo-600' },
];

const StoreDetailModal = ({ store, colorIndex = 0, isReadOnly = false, onClose, onTransferManager, onTransferSeller, onDeleteStore, onRefresh }) => {
  const colorConfig = STORE_COLOR_CONFIG[colorIndex % STORE_COLOR_CONFIG.length];
  const [activeTab, setActiveTab] = useState('performance');
  const [managers, setManagers] = useState([]);
  const [sellers, setSellers] = useState([]);
  const [pendingInvitations, setPendingInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0); // Force re-render après changement de statut

  const fetchStoreTeam = async (signal) => {
    const config = signal ? { signal } : {};
    try {
      const [managersRes, sellersRes, invitationsRes] = await Promise.all([
        api.get(`/gerant/stores/${store.id}/managers`, config),
        api.get(`/gerant/stores/${store.id}/sellers`, config),
        api.get('/gerant/invitations', config),
      ]);
      setManagers(managersRes.data || []);
      setSellers(sellersRes.data || []);
      const storeInvitations = (invitationsRes.data || []).filter(
        inv => inv.store_id === store.id && inv.status === 'pending'
      );
      setPendingInvitations(storeInvitations);
    } catch (error) {
      if (error.code === 'ERR_CANCELED') return;
      logger.error('Erreur chargement équipe:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId, userRole, userName) => {
    const roleLabel = userRole === 'manager' ? 'le manager' : 'le vendeur';
    const warningMessage = userRole === 'manager'
      ? `⚠️ ATTENTION : Suppression d'un Manager\n\nVous êtes sur le point de supprimer ${roleLabel} "${userName}".\n\n❗ Conséquences :\n- Le manager ne pourra plus se connecter\n- Ses données historiques seront conservées\n- Les vendeurs sous sa responsabilité resteront actifs\n\nCette action est IRRÉVERSIBLE.\n\nConfirmez-vous la suppression ?`
      : `⚠️ ATTENTION : Suppression d'un Vendeur\n\nVous êtes sur le point de supprimer ${roleLabel} "${userName}".\n\n❗ Conséquences :\n- Le vendeur ne pourra plus se connecter\n- Ses KPIs et historique seront conservés\n- Ses données resteront visibles dans les rapports\n\nCette action est IRRÉVERSIBLE.\n\nConfirmez-vous la suppression ?`;
    
    if (!globalThis.confirm(warningMessage)) {
      return;
    }

    try {
      const endpoint = userRole === 'manager'
        ? `/gerant/managers/${userId}`
        : `/gerant/sellers/${userId}`;
      await api.delete(endpoint);
      if (userRole === 'manager') {
        setManagers(managers.filter(m => m.id !== userId));
      } else if (userRole === 'seller') {
        setSellers(sellers.filter(s => s.id !== userId));
      }
      if (onRefresh) onRefresh();
    } catch (error) {
      logger.error('Erreur suppression utilisateur:', error);
      toast.error(error.response?.data?.detail || 'Erreur lors de la suppression');
    }
  };

  const handleToggleSuspend = async (userId, userRole, userName, action) => {
    const roleLabel = userRole === 'manager' ? 'le manager' : 'le vendeur';
    const actionLabel = action === 'suspend' ? 'suspendre' : 'réactiver';
    const warningMessage = action === 'suspend'
      ? `Suspendre ${roleLabel} "${userName}" ?\n\n⚠️ Conséquences :\n- ${userRole === 'manager' ? 'Le manager' : 'Le vendeur'} ne pourra plus se connecter\n- Ses données seront conservées\n- Vous pourrez le réactiver à tout moment\n\nConfirmez-vous ?`
      : `Réactiver ${roleLabel} "${userName}" ?\n\n✅ ${userRole === 'manager' ? 'Le manager' : 'Le vendeur'} pourra à nouveau se connecter et accéder à l'application.\n\nConfirmez-vous ?`;
    
    if (!globalThis.confirm(warningMessage)) {
      return;
    }

    try {
      const endpoint = userRole === 'manager'
        ? `/gerant/managers/${userId}/${action}`
        : `/gerant/sellers/${userId}/${action}`;
      const res = await api.patch(endpoint);
      setRefreshKey(prev => prev + 1);
      await fetchStoreTeam();
      if (onRefresh) onRefresh();
      toast.success(res.data?.message || `${userRole === 'manager' ? 'Manager' : 'Vendeur'} ${action === 'suspend' ? 'suspendu' : 'réactivé'} avec succès`);
    } catch (error) {
      logger.error(`Erreur ${actionLabel}:`, error);
      toast.error(error.response?.data?.detail || `Erreur lors de ${actionLabel}`);
    }
  };

  const handleCancelInvitation = async (invitationId) => {
    if (!globalThis.confirm('Êtes-vous sûr de vouloir annuler cette invitation ?')) {
      return;
    }

    try {
      await api.delete(`/gerant/invitations/${invitationId}`);
      setPendingInvitations(pendingInvitations.filter(inv => inv.id !== invitationId));
      if (onRefresh) onRefresh();
    } catch (error) {
      logger.error('Erreur annulation invitation:', error);
      toast.error(error.response?.data?.detail || "Erreur lors de l'annulation de l'invitation");
    }
  };

  useEffect(() => {
    if (!store?.id) return;
    const controller = new AbortController();
    fetchStoreTeam(controller.signal);
    return () => controller.abort();
  }, [store?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[95vh] sm:max-h-[90vh] shadow-2xl flex flex-col">
        {/* Header - couleur dynamique via style inline */}
        <div 
          className="p-4 sm:p-6 relative flex-shrink-0 rounded-t-2xl"
          style={{ 
            background: `linear-gradient(135deg, ${colorConfig.from} 0%, ${colorConfig.via} 50%, ${colorConfig.to} 100%)` 
          }}
        >
          <button
            onClick={onClose}
            className="absolute top-3 right-3 sm:top-4 sm:right-4 text-white hover:text-gray-200 transition-colors p-1"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
          
          <h2 className="text-lg sm:text-2xl font-bold text-white mb-1 sm:mb-2 pr-8">{store.name}</h2>
          <p className="text-white opacity-90 text-sm sm:text-base">📍 {store.location}</p>
          {store.address && <p className="text-white opacity-80 text-xs sm:text-sm mt-1 truncate">{store.address}</p>}
        </div>

        {/* Tabs - Scrollable horizontally on mobile */}
        <div className="border-b border-gray-200 flex-shrink-0 overflow-x-auto">
          <div className="flex min-w-max px-3 sm:px-6">
            <button
              onClick={() => setActiveTab('performance')}
              className={`py-2 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'performance'
                  ? colorConfig.accent
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              📊 Performance
            </button>
            <button
              onClick={() => setActiveTab('managers')}
              className={`py-2 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'managers'
                  ? colorConfig.accent
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              👔 Managers ({managers.filter(m => m.status === 'active').length})
            </button>
            <button
              onClick={() => setActiveTab('sellers')}
              className={`py-2 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'sellers'
                  ? colorConfig.accent
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              👥 Vendeurs ({sellers.filter(s => s.status === 'active').length})
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-3 sm:p-6 overflow-y-auto flex-1 min-h-0">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto" style={{ borderColor: colorConfig.from }}></div>
              <p className="text-gray-600 mt-4">Chargement...</p>
            </div>
          ) : activeTab === 'performance' ? (
            <StoreKPIModal
              onClose={() => {}}
              onSuccess={() => onRefresh()}
              hideCloseButton={true}
              storeId={store.id}
              storeName={store.name}
            />
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
          ) : activeTab === 'sellers' ? (
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
          ) : null}
        </div>

        {/* Footer Actions - Responsive */}
        <div className="border-t border-gray-200 p-3 sm:p-6 bg-gray-50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-0 flex-shrink-0">
          <button
            onClick={() => onDeleteStore(store)}
            className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all text-sm sm:text-base font-semibold order-2 sm:order-1"
          >
            <Trash2 className="w-4 h-4" />
            <span className="hidden xs:inline">Supprimer</span>
            <span className="xs:hidden">Suppr.</span>
          </button>
          
          <div className="flex gap-2 order-1 sm:order-2">
            <button
              onClick={() => {
                fetchStoreTeam();
                onRefresh();
              }}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 bg-white border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all text-sm sm:text-base font-semibold"
            >
              <RefreshCw className="w-4 h-4" />
              <span className="hidden sm:inline">Actualiser</span>
            </button>
            <button
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 sm:px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-all text-sm sm:text-base font-semibold"
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
