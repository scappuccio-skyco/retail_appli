import React, { useState, useEffect } from 'react';
import { Mail, Trash2, RefreshCw, Clock, CheckCircle, XCircle, Search, Edit2, X, Save } from 'lucide-react';
import { api } from '../../lib/apiClient';
import { logger } from '../../utils/logger';
import { toast } from 'sonner';

const InvitationsManagement = () => {
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});

  useEffect(() => {
    fetchInvitations();
  }, [filter]);

  const fetchInvitations = async () => {
    try {
      setLoading(true);
      const url = filter === 'all' 
        ? '/superadmin/invitations'
        : `/superadmin/invitations?status=${filter}`;
      
      const response = await api.get(url);
      setInvitations(response.data);
    } catch (error) {
      logger.error('Erreur chargement invitations:', error);
      toast.error('Erreur lors du chargement des invitations');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (invitationId, email) => {
    if (!window.confirm(`Supprimer l'invitation pour ${email} ?`)) return;

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
      await api.post(
        `/superadmin/invitations/${invitationId}/resend`,
        {}
      );
      toast.success(`Invitation renvoyée à ${email}`);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors du renvoi');
    }
  };

  const startEdit = (inv) => {
    setEditingId(inv.id);
    setEditData({
      email: inv.email,
      role: inv.role,
      store_name: inv.store_name || '',
      status: inv.status
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditData({});
  };

  const saveEdit = async (invitationId) => {
    try {
      await api.patch(
        `/superadmin/invitations/${invitationId}`,
        editData
      );
      toast.success('Invitation mise à jour');
      setEditingId(null);
      fetchInvitations();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la mise à jour');
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Attente' },
      accepted: { bg: 'bg-green-100', text: 'text-green-700', label: 'Acceptée' },
      expired: { bg: 'bg-red-100', text: 'text-red-700', label: 'Expirée' }
    };
    const badge = badges[status] || badges.pending;
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  const getRoleBadge = (role) => {
    const roleMap = {
      gerant: { bg: 'bg-indigo-100', text: 'text-indigo-700', label: 'Gérant' },
      gérant: { bg: 'bg-indigo-100', text: 'text-indigo-700', label: 'Gérant' },
      manager: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Manager' },
      seller: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Vendeur' }
    };
    const badge = roleMap[role] || { bg: 'bg-gray-100', text: 'text-gray-700', label: role };
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  const filteredInvitations = invitations.filter(inv => 
    inv.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inv.store_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inv.gerant_email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Compact Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-800">
          Invitations ({filteredInvitations.length})
        </h2>
        <button
          onClick={fetchInvitations}
          className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg"
          title="Actualiser"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Compact Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex gap-1">
          {['all', 'pending', 'accepted', 'expired'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                filter === f
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f === 'all' ? 'Toutes' : f === 'pending' ? 'Attente' : f === 'accepted' ? 'Acceptées' : 'Expirées'}
            </button>
          ))}
        </div>
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Rechercher..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-1 focus:ring-purple-500"
            />
          </div>
        </div>
      </div>

      {/* Compact Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {filteredInvitations.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Mail className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Aucune invitation</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-3 py-2 text-left">Email</th>
                  <th className="px-3 py-2 text-left">Rôle</th>
                  <th className="px-3 py-2 text-left">Magasin</th>
                  <th className="px-3 py-2 text-left">Gérant</th>
                  <th className="px-3 py-2 text-left">Statut</th>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredInvitations.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50">
                    {editingId === inv.id ? (
                      <>
                        <td className="px-3 py-2">
                          <input
                            type="email"
                            value={editData.email}
                            onChange={(e) => setEditData({...editData, email: e.target.value})}
                            className="w-full px-2 py-1 text-xs border rounded"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={editData.role}
                            onChange={(e) => setEditData({...editData, role: e.target.value})}
                            className="px-2 py-1 text-xs border rounded"
                          >
                            <option value="gerant">Gérant</option>
                            <option value="manager">Manager</option>
                            <option value="seller">Vendeur</option>
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={editData.store_name}
                            onChange={(e) => setEditData({...editData, store_name: e.target.value})}
                            className="w-full px-2 py-1 text-xs border rounded"
                          />
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-500">{inv.gerant_email || '-'}</td>
                        <td className="px-3 py-2">
                          <select
                            value={editData.status}
                            onChange={(e) => setEditData({...editData, status: e.target.value})}
                            className="px-2 py-1 text-xs border rounded"
                          >
                            <option value="pending">En attente</option>
                            <option value="accepted">Acceptée</option>
                            <option value="expired">Expirée</option>
                          </select>
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-500">
                          {inv.created_at ? new Date(inv.created_at).toLocaleDateString('fr-FR') : '-'}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex justify-end gap-1">
                            <button
                              onClick={() => saveEdit(inv.id)}
                              className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                              title="Sauvegarder"
                            >
                              <Save className="w-4 h-4" />
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="p-1.5 text-gray-600 hover:bg-gray-100 rounded"
                              title="Annuler"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-3 py-2">
                          <span className="text-gray-900 truncate max-w-[180px] block" title={inv.email}>
                            {inv.email}
                          </span>
                        </td>
                        <td className="px-3 py-2">{getRoleBadge(inv.role)}</td>
                        <td className="px-3 py-2 text-gray-600 truncate max-w-[120px]" title={inv.store_name}>
                          {inv.store_name || '-'}
                        </td>
                        <td className="px-3 py-2">
                          <span className="text-gray-600 truncate max-w-[150px] block" title={inv.gerant_email}>
                            {inv.gerant_name || inv.gerant_email || '-'}
                          </span>
                        </td>
                        <td className="px-3 py-2">{getStatusBadge(inv.status)}</td>
                        <td className="px-3 py-2 text-xs text-gray-500">
                          {inv.created_at ? new Date(inv.created_at).toLocaleDateString('fr-FR') : '-'}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex justify-end gap-1">
                            <button
                              onClick={() => startEdit(inv)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                              title="Modifier"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            {inv.status === 'pending' && (
                              <button
                                onClick={() => handleResend(inv.id, inv.email)}
                                className="p-1.5 text-purple-600 hover:bg-purple-50 rounded"
                                title="Renvoyer"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete(inv.id, inv.email)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                              title="Supprimer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default InvitationsManagement;
