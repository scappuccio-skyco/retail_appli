import React, { useState, useEffect } from 'react';
import { api } from '../../lib/apiClient';
import { logger } from '../../utils/logger';
import { toast } from 'sonner';
import { UserPlus, Trash2, Mail, Shield } from 'lucide-react';

export default function AdminManagement() {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newAdmin, setNewAdmin] = useState({ email: '', name: '' });
  const [tempPassword, setTempPassword] = useState('');

  useEffect(() => {
    fetchAdmins();
  }, []);

  const fetchAdmins = async () => {
    try {
      setLoading(true);
      logger.log('Fetching admins from:', '/superadmin/admins');
      const res = await api.get('/superadmin/admins');
      logger.log('Admins received:', res.data);
      setAdmins(res.data.admins || []);
    } catch (error) {
      logger.error('Error fetching admins:', error);
      toast.error('Erreur lors du chargement des admins');
    } finally {
      setLoading(false);
    }
  };

  const handleAddAdmin = async (e) => {
    e.preventDefault();
    if (!newAdmin.email || !newAdmin.name) {
      toast.error('Email et nom requis');
      return;
    }
    try {
      const res = await api.post(
        `/superadmin/admins?email=${encodeURIComponent(newAdmin.email)}&name=${encodeURIComponent(newAdmin.name)}`,
        {}
      );
      setTempPassword(res.data.temporary_password);
      toast.success('Super admin ajouté avec succès!');
      fetchAdmins();
      setNewAdmin({ email: '', name: '' });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de l\'ajout');
    }
  };

  const handleRemoveAdmin = async (adminId) => {
    if (!globalThis.confirm('Êtes-vous sûr de vouloir retirer ce super admin ?')) return;
    try {
      await api.delete(`/superadmin/admins/${adminId}`);
      toast.success('Super admin retiré');
      fetchAdmins();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la suppression');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copié dans le presse-papiers');
  };

  if (loading) {
    return <div className="text-gray-500 text-center py-8">Chargement...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Gestion des Super Admins</h2>
          <p className="text-gray-500 text-sm mt-1">
            Gérez les personnes ayant un accès complet à l'administration
          </p>
        </div>
        <button
          onClick={() => { setShowAddModal(true); setTempPassword(''); }}
          className="px-4 py-2 bg-[#1E40AF] hover:bg-[#1E3A8A] text-white rounded-lg flex items-center gap-2 transition-all"
        >
          <UserPlus className="w-5 h-5" />
          Ajouter un admin
        </button>
      </div>

      {/* Admin List */}
      <div className="space-y-3">
        {admins.map((admin) => (
          <div
            key={admin.id}
            className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[#1E40AF] rounded-full flex items-center justify-center">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-gray-800 font-semibold">{admin.name}</h3>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Mail className="w-4 h-4" />
                  {admin.email}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  Créé le {new Date(admin.created_at).toLocaleDateString('fr-FR')}
                  {admin.created_by && ` par ${admin.created_by}`}
                </div>
              </div>
            </div>
            <button
              onClick={() => handleRemoveAdmin(admin.id)}
              className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-all"
              title="Retirer"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        ))}

        {admins.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            Aucun super admin trouvé
          </div>
        )}
      </div>

      {/* Add Admin Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 border border-gray-200 shadow-xl">
            <h3 className="text-2xl font-bold text-gray-800 mb-6">Ajouter un Super Admin</h3>

            {tempPassword ? (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-green-700 text-sm mb-2">✅ Super admin ajouté avec succès!</p>
                  <p className="text-gray-700 text-sm mb-3">
                    Envoyez ces informations au nouvel admin :
                  </p>
                  <div className="bg-gray-100 rounded p-3 space-y-2">
                    <div>
                      <span className="text-gray-500 text-xs">Email :</span>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-800 font-mono text-sm">{newAdmin.email}</span>
                        <button onClick={() => copyToClipboard(newAdmin.email)} className="text-blue-500 hover:text-blue-700">📋</button>
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-500 text-xs">Mot de passe temporaire :</span>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-800 font-mono text-sm">{tempPassword}</span>
                        <button onClick={() => copyToClipboard(tempPassword)} className="text-blue-500 hover:text-blue-700">📋</button>
                      </div>
                    </div>
                  </div>
                  <p className="text-yellow-700 text-xs mt-3">
                    ⚠️ Ce mot de passe ne sera plus affiché. Copiez-le maintenant !
                  </p>
                </div>
                <button
                  onClick={() => { setShowAddModal(false); setTempPassword(''); setNewAdmin({ email: '', name: '' }); }}
                  className="w-full px-4 py-2 bg-[#1E40AF] hover:bg-[#1E3A8A] text-white rounded-lg"
                >
                  Fermer
                </button>
              </div>
            ) : (
              <form onSubmit={handleAddAdmin} className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-600 font-medium mb-2">Nom complet</label>
                  <input
                    type="text"
                    value={newAdmin.name}
                    onChange={(e) => setNewAdmin({ ...newAdmin, name: e.target.value })}
                    className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    placeholder="John Doe"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 font-medium mb-2">Email</label>
                  <input
                    type="email"
                    value={newAdmin.email}
                    onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })}
                    className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    placeholder="admin@example.com"
                    required
                  />
                </div>
                <div className="flex gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => { setShowAddModal(false); setNewAdmin({ email: '', name: '' }); }}
                    className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-[#1E40AF] hover:bg-[#1E3A8A] text-white rounded-lg"
                  >
                    Ajouter
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
