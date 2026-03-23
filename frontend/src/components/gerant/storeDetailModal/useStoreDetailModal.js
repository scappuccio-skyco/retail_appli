import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { api } from '../../../lib/apiClient';
import { logger } from '../../../utils/logger';

export default function useStoreDetailModal({ store, onRefresh, refreshToken = 0 }) {
  const [activeTab, setActiveTab] = useState('performance');
  const [managers, setManagers] = useState([]);
  const [sellers, setSellers] = useState([]);
  const [pendingInvitations, setPendingInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

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

    if (!globalThis.confirm(warningMessage)) return;

    try {
      const endpoint = userRole === 'manager'
        ? `/gerant/managers/${userId}`
        : `/gerant/sellers/${userId}`;
      await api.delete(endpoint);
      if (userRole === 'manager') setManagers(prev => prev.filter(m => m.id !== userId));
      else setSellers(prev => prev.filter(s => s.id !== userId));
      if (onRefresh) onRefresh();
    } catch (error) {
      logger.error('Erreur suppression utilisateur:', error);
      toast.error(error.response?.data?.detail || 'Erreur lors de la suppression');
    }
  };

  const handleToggleSuspend = async (userId, userRole, userName, action) => {
    const actionLabel = action === 'suspend' ? 'suspendre' : 'réactiver';
    const warningMessage = action === 'suspend'
      ? `Suspendre ${userRole === 'manager' ? 'le manager' : 'le vendeur'} "${userName}" ?\n\n⚠️ Conséquences :\n- ${userRole === 'manager' ? 'Le manager' : 'Le vendeur'} ne pourra plus se connecter\n- Ses données seront conservées\n- Vous pourrez le réactiver à tout moment\n\nConfirmez-vous ?`
      : `Réactiver ${userRole === 'manager' ? 'le manager' : 'le vendeur'} "${userName}" ?\n\n✅ ${userRole === 'manager' ? 'Le manager' : 'Le vendeur'} pourra à nouveau se connecter et accéder à l'application.\n\nConfirmez-vous ?`;

    if (!globalThis.confirm(warningMessage)) return;

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
    if (!globalThis.confirm('Êtes-vous sûr de vouloir annuler cette invitation ?')) return;
    try {
      await api.delete(`/gerant/invitations/${invitationId}`);
      setPendingInvitations(prev => prev.filter(inv => inv.id !== invitationId));
      if (onRefresh) onRefresh();
    } catch (error) {
      logger.error('Erreur annulation invitation:', error);
      toast.error(error.response?.data?.detail || "Erreur lors de l'annulation de l'invitation");
    }
  };

  const handleRefresh = () => {
    fetchStoreTeam();
    if (onRefresh) onRefresh();
  };

  useEffect(() => {
    if (!store?.id) return;
    const controller = new AbortController();
    fetchStoreTeam(controller.signal);
    return () => controller.abort();
  }, [store?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (refreshToken > 0 && store?.id) {
      fetchStoreTeam();
    }
  }, [refreshToken]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    activeTab, setActiveTab,
    managers, sellers, pendingInvitations,
    loading, refreshKey,
    handleDeleteUser, handleToggleSuspend, handleCancelInvitation, handleRefresh,
  };
}
