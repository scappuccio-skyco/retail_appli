import { useState, useEffect } from 'react';
import { api } from '../../../lib/apiClient';
import { logger } from '../../../utils/logger';
import { toast } from 'sonner';

export default function useStaffOverview({ onRefresh }) {
  const [activeTab, setActiveTab] = useState('managers');
  const [managers, setManagers] = useState([]);
  const [sellers, setSellers] = useState([]);
  const [stores, setStores] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [storeFilter, setStoreFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('active');
  const [invitationStatusFilter, setInvitationStatusFilter] = useState('pending');
  const [actionMenuOpen, setActionMenuOpen] = useState(null);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [resendingInvitation, setResendingInvitation] = useState(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState(null);
  const [managerStoresModalOpen, setManagerStoresModalOpen] = useState(false);
  const [managerForStores, setManagerForStores] = useState(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [managersRes, sellersRes, storesRes, invitationsRes] = await Promise.all([
        api.get('/gerant/managers'),
        api.get('/gerant/sellers'),
        api.get('/gerant/stores'),
        api.get('/gerant/invitations').catch(() => ({ data: [] })),
      ]);
      const toArr = (d) => (Array.isArray(d) ? d : (d?.items ?? []));
      setManagers(toArr(managersRes.data));
      setSellers(toArr(sellersRes.data));
      setStores(storesRes.data || []);
      setInvitations(invitationsRes.data || []);
    } catch (error) {
      toast.error('Erreur lors du chargement des données');
      logger.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleResendInvitation = async (invitationId) => {
    setResendingInvitation(invitationId);
    try {
      await api.post(`/gerant/invitations/${invitationId}/resend`, {});
      toast.success('Invitation renvoyée avec succès !');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erreur lors du renvoi de l'invitation");
    } finally {
      setResendingInvitation(null);
    }
  };

  const handleCancelInvitation = async (invitationId) => {
    if (!globalThis.confirm('Êtes-vous sûr de vouloir annuler cette invitation ?')) return;
    try {
      await api.delete(`/gerant/invitations/${invitationId}`);
      toast.success('Invitation annulée');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erreur lors de l'annulation");
    }
  };

  const handleSuspend = async (userId, role) => {
    if (!globalThis.confirm('Êtes-vous sûr de vouloir suspendre cet utilisateur ?')) return;
    try {
      const endpoint = role === 'manager' ? `/gerant/managers/${userId}/suspend` : `/gerant/sellers/${userId}/suspend`;
      await api.patch(endpoint, {});
      toast.success('Utilisateur suspendu avec succès');
      fetchData();
      if (onRefresh) onRefresh();
      setActionMenuOpen(null);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la suspension');
    }
  };

  const handleReactivate = async (userId, role) => {
    try {
      const endpoint = role === 'manager' ? `/gerant/managers/${userId}/reactivate` : `/gerant/sellers/${userId}/reactivate`;
      await api.patch(endpoint, {});
      toast.success('Utilisateur réactivé avec succès');
      fetchData();
      if (onRefresh) onRefresh();
      setActionMenuOpen(null);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la réactivation');
    }
  };

  const handleDelete = async (userId, role) => {
    if (role === 'manager') {
      const sellersCount = sellers.filter(s => s.manager_id === userId && (s.status === 'active' || s.status === 'suspended')).length;
      if (sellersCount > 0) {
        const confirmMessage = `⚠️ ATTENTION\n\nCe manager a ${sellersCount} vendeur(s) sous sa responsabilité.\n\nLes vendeurs resteront attachés à leur magasin (aucune perte de données), mais n'auront plus de manager actif.\n\n✅ Recommandation : Transférez d'abord les vendeurs vers un autre manager.\n\nVoulez-vous quand même supprimer ce manager ?`;
        if (!globalThis.confirm(confirmMessage)) return;
      }
    }
    if (!globalThis.confirm('Êtes-vous sûr de vouloir supprimer définitivement cet utilisateur ? Cette action est irréversible.')) return;
    try {
      const endpoint = role === 'manager' ? `/gerant/managers/${userId}` : `/gerant/sellers/${userId}`;
      await api.delete(endpoint);
      toast.success('Utilisateur supprimé avec succès');
      fetchData();
      if (onRefresh) onRefresh();
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
      if (selectedUser.role === 'manager') {
        await api.post(`/gerant/managers/${selectedUser.id}/transfer`, { new_store_id: newStoreId });
      } else {
        await api.post(`/gerant/sellers/${selectedUser.id}/transfer`, { new_store_id: newStoreId, new_manager_id: newManagerId });
      }
      toast.success('Transfert effectué avec succès');
      fetchData();
      if (onRefresh) onRefresh();
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

  const filterUsers = (users) => users.filter(user => {
    const matchesSearch =
      user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStore = storeFilter === 'all' || user.store_id === storeFilter;
    const matchesStatus = statusFilter === 'all' || (user.status || 'active') === statusFilter;
    return matchesSearch && matchesStore && matchesStatus;
  });

  const filterInvitations = () => invitations.filter(inv => {
    const matchesSearch =
      inv.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStore = storeFilter === 'all' || inv.store_id === storeFilter;
    const matchesStatus = invitationStatusFilter === 'all' || inv.status === invitationStatusFilter;
    return matchesSearch && matchesStore && matchesStatus;
  });

  const filteredManagers = filterUsers(managers);
  const filteredSellers = filterUsers(sellers);
  const filteredInvitations = filterInvitations();
  const pendingInvitationsCount = invitations.filter(i => i.status === 'pending').length;

  return {
    activeTab, setActiveTab,
    managers, sellers, stores,
    loading,
    searchTerm, setSearchTerm,
    storeFilter, setStoreFilter,
    statusFilter, setStatusFilter,
    invitationStatusFilter, setInvitationStatusFilter,
    actionMenuOpen, setActionMenuOpen,
    transferModalOpen, setTransferModalOpen,
    selectedUser, setSelectedUser,
    resendingInvitation,
    editModalOpen, setEditModalOpen,
    userToEdit, setUserToEdit,
    managerStoresModalOpen, setManagerStoresModalOpen,
    managerForStores, setManagerForStores,
    filteredManagers, filteredSellers, filteredInvitations,
    pendingInvitationsCount,
    fetchData,
    handleResendInvitation, handleCancelInvitation,
    handleSuspend, handleReactivate, handleDelete,
    openTransferModal, handleTransfer,
    getStoreName,
  };
}
