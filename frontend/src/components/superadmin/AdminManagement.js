import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { UserPlus, Trash2, Mail, Shield } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

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
      const token = localStorage.getItem('token');
      console.log('Fetching admins from:', `${API}/superadmin/admins`);
      const res = await axios.get(`${API}/superadmin/admins`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('Admins received:', res.data);
      setAdmins(res.data.admins || []);
    } catch (error) {
      console.error('Error fetching admins:', error);
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
      const token = localStorage.getItem('token');
      const res = await axios.post(
        `${API}/superadmin/admins?email=${encodeURIComponent(newAdmin.email)}&name=${encodeURIComponent(newAdmin.name)}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
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
    if (!window.confirm('Êtes-vous sûr de vouloir retirer ce super admin ?')) return;

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/superadmin/admins/${adminId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

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
    return <div className="text-white text-center py-8">Chargement...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Gestion des Super Admins</h2>
          <p className="text-purple-300 text-sm mt-1">
            Gérez les personnes ayant un accès complet à l'administration
          </p>
        </div>
        <button
          onClick={() => { setShowAddModal(true); setTempPassword(''); }}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center gap-2 transition-all"
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
            className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-lg p-4 flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-white font-semibold">{admin.name}</h3>
                <div className="flex items-center gap-2 text-sm text-purple-300">
                  <Mail className="w-4 h-4" />
                  {admin.email}
                </div>
                <div className="text-xs text-purple-400 mt-1">
                  Créé le {new Date(admin.created_at).toLocaleDateString('fr-FR')}
                  {admin.created_by && ` par ${admin.created_by}`}
                </div>
              </div>
            </div>
            <button
              onClick={() => handleRemoveAdmin(admin.id)}
              className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-all"
              title="Retirer"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        ))}

        {admins.length === 0 && (
          <div className="text-center py-12 text-purple-300">
            Aucun super admin trouvé
          </div>
        )}
      </div>

      {/* Add Admin Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gradient-to-br from-purple-900 to-indigo-900 rounded-2xl p-8 max-w-md w-full mx-4 border border-white/20">
            <h3 className="text-2xl font-bold text-white mb-6">Ajouter un Super Admin</h3>
            
            {tempPassword ? (
              <div className="space-y-4">
                <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-4">
                  <p className="text-green-200 text-sm mb-2">✅ Super admin ajouté avec succès!</p>
                  <p className="text-white text-sm mb-3">
                    Envoyez ces informations au nouvel admin :
                  </p>
                  <div className="bg-black/30 rounded p-3 space-y-2">
                    <div>
                      <span className="text-purple-300 text-xs">Email:</span>
                      <div className="flex items-center gap-2">
                        <span className="text-white font-mono text-sm">{newAdmin.email}</span>
                        <button
                          onClick={() => copyToClipboard(newAdmin.email)}
                          className="text-purple-400 hover:text-purple-300"
                        >
                          📋
                        </button>
                      </div>
                    </div>
                    <div>
                      <span className="text-purple-300 text-xs">Mot de passe temporaire:</span>
                      <div className="flex items-center gap-2">
                        <span className="text-white font-mono text-sm">{tempPassword}</span>
                        <button
                          onClick={() => copyToClipboard(tempPassword)}
                          className="text-purple-400 hover:text-purple-300"
                        >
                          📋
                        </button>
                      </div>
                    </div>
                  </div>
                  <p className="text-yellow-300 text-xs mt-3">
                    ⚠️ Ce mot de passe ne sera plus affiché. Copiez-le maintenant !
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setTempPassword('');
                    setNewAdmin({ email: '', name: '' });
                  }}
                  className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg"
                >
                  Fermer
                </button>
              </div>
            ) : (
              <form onSubmit={handleAddAdmin} className="space-y-4">
                <div>
                  <label className="block text-sm text-purple-200 mb-2">Nom complet</label>
                  <input
                    type="text"
                    value={newAdmin.name}
                    onChange={(e) => setNewAdmin({ ...newAdmin, name: e.target.value })}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-purple-300"
                    placeholder="John Doe"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-purple-200 mb-2">Email</label>
                  <input
                    type="email"
                    value={newAdmin.email}
                    onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-purple-300"
                    placeholder="admin@example.com"
                    required
                  />
                </div>
                <div className="flex gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => { setShowAddModal(false); setNewAdmin({ email: '', name: '' }); }}
                    className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg"
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
