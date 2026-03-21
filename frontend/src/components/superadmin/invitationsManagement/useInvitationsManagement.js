import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { api } from '../../../lib/apiClient';
import { logger } from '../../../utils/logger';

function normalizeInvitationsResponse(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.invitations)) return data.invitations;
  return [];
}

export default function useInvitationsManagement() {
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});

  useEffect(() => { fetchInvitations(); }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchInvitations = async () => {
    try {
      setLoading(true);
      const url = filter === 'all' ? '/superadmin/invitations' : `/superadmin/invitations?status=${filter}`;
      const response = await api.get(url);
      setInvitations(normalizeInvitationsResponse(response.data));
    } catch (error) {
      logger.error('Erreur chargement invitations:', error);
      toast.error('Erreur lors du chargement des invitations');
      setInvitations([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (invitationId, email) => {
    if (!globalThis.confirm(`Supprimer l'invitation pour ${email} ?`)) return;
    try {
      await api.delete(`/superadmin/invitations/${invitationId}`);
      toast.success('Invitation supprimée');
      fetchInvitations();
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    }
  };

  const handleResend = async (invitationId, email) => {
    try {
      await api.post(`/superadmin/invitations/${invitationId}/resend`, {});
      toast.success(`Invitation renvoyée à ${email}`);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors du renvoi');
    }
  };

  const startEdit = (inv) => {
    setEditingId(inv.id);
    setEditData({ email: inv.email, role: inv.role, store_name: inv.store_name || '', status: inv.status });
  };

  const cancelEdit = () => { setEditingId(null); setEditData({}); };

  const saveEdit = async (invitationId) => {
    try {
      await api.patch(`/superadmin/invitations/${invitationId}`, editData);
      toast.success('Invitation mise à jour');
      setEditingId(null);
      fetchInvitations();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la mise à jour');
    }
  };

  const filteredInvitations = Array.isArray(invitations)
    ? invitations.filter(inv =>
        inv.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inv.store_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inv.gerant_email?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : [];

  return {
    loading, filter, setFilter, searchTerm, setSearchTerm,
    editingId, editData, setEditData,
    filteredInvitations,
    fetchInvitations, handleDelete, handleResend,
    startEdit, cancelEdit, saveEdit,
  };
}
