import React, { useState, useEffect } from 'react';
import { X, Mail, UserPlus, Building2, Users } from 'lucide-react';
import { api } from '../../lib/apiClient';
import { logger } from '../../utils/logger';

const InviteStaffModal = ({ onClose, onInvite, stores, selectedStoreId = null }) => {
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'manager',
    store_id: selectedStoreId || '',
    manager_id: '',
    manager_email: '' // Pour stocker l'email du manager en attente
  });
  
  const [managers, setManagers] = useState([]);
  const [pendingManagerInvites, setPendingManagerInvites] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Charger les managers du magasin sélectionné (si vendeur)
  useEffect(() => {
    if (formData.role === 'seller' && formData.store_id) {
      fetchManagersAndInvites(formData.store_id);
    }
  }, [formData.role, formData.store_id]); // eslint-disable-line

  const fetchManagersAndInvites = async (storeId) => {
    try {
      const [managersRes, invitesRes] = await Promise.all([
        api.get(`/gerant/stores/${storeId}/managers`),
        api.get('/gerant/invitations'),
      ]);

      setManagers(managersRes.data);

      const pendingManagers = invitesRes.data.filter(
        inv => inv.store_id === storeId && inv.role === 'manager' && inv.status === 'pending'
      );
      setPendingManagerInvites(pendingManagers);
    } catch (error) {
      logger.error('Erreur chargement managers:', error);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
      // Reset manager_id si on change de magasin ou de rôle
      ...(name === 'store_id' || name === 'role' ? { manager_id: '' } : {})
    }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!formData.email) {
      setError('L\'email est requis');
      return;
    }
    if (!formData.store_id) {
      setError('Veuillez sélectionner un magasin');
      return;
    }
    if (formData.role === 'seller' && !formData.manager_id) {
      setError('Veuillez sélectionner un manager pour ce vendeur');
      return;
    }

    setLoading(true);

    try {
      const inviteData = {
        name: formData.name,
        email: formData.email,
        role: formData.role,
        store_id: formData.store_id,
        ...(formData.role === 'seller' && { manager_id: formData.manager_id })
      };

      await onInvite(inviteData);
      onClose();
    } catch (err) {
      setError(err.message || 'Erreur lors de l\'invitation');
    } finally {
      setLoading(false);
    }
  };

  const selectedStore = stores.find(s => s.id === formData.store_id);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-pink-600 text-white p-6 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <UserPlus className="w-6 h-6" />
              <h2 className="text-2xl font-bold">Inviter du Personnel</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-4 bg-red-50 border-2 border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          )}

          {/* Nom complet */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
              <UserPlus className="w-4 h-4" />
              Nom complet *
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              placeholder="Prénom Nom"
              className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none"
            />
          </div>

          {/* Email */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
              <Mail className="w-4 h-4" />
              Email de la personne *
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              placeholder="exemple@email.com"
              className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none"
            />
          </div>

          {/* Rôle */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
              <Users className="w-4 h-4" />
              Rôle *
            </label>
            <select
              name="role"
              value={formData.role}
              onChange={handleChange}
              className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none"
            >
              <option value="manager">👔 Manager</option>
              <option value="seller">👥 Vendeur</option>
            </select>
          </div>

          {/* Magasin */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
              <Building2 className="w-4 h-4" />
              Magasin de destination *
            </label>
            <select
              name="store_id"
              value={formData.store_id}
              onChange={handleChange}
              required
              className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none"
            >
              <option value="">Sélectionner un magasin</option>
              {stores.filter(s => s.active).map(store => (
                <option key={store.id} value={store.id}>
                  🏢 {store.name} - {store.location}
                </option>
              ))}
            </select>
          </div>

          {/* Manager (seulement si vendeur) */}
          {formData.role === 'seller' && formData.store_id && (
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                <UserPlus className="w-4 h-4" />
                Manager responsable *
              </label>
              {managers.length === 0 && pendingManagerInvites.length === 0 ? (
                <div className="p-3 bg-orange-50 border-2 border-orange-200 rounded-lg text-orange-700 text-sm">
                  ⚠️ Aucun manager dans ce magasin. Vous devez d'abord inviter un manager.
                </div>
              ) : (
                <>
                  <select
                    name="manager_id"
                    value={formData.manager_id}
                    onChange={(e) => {
                      const value = e.target.value;
                      const selectedOption = e.target.options[e.target.selectedIndex];
                      const email = selectedOption.dataset.email || '';
                      setFormData(prev => ({
                        ...prev,
                        manager_id: value,
                        manager_email: email || ''
                      }));
                      setError('');
                    }}
                    required
                    className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none"
                  >
                    <option value="">Sélectionner un manager</option>
                    
                    {/* Managers actifs */}
                    {managers.length > 0 && (
                      <optgroup label="✓ Managers Actifs">
                        {managers.map(manager => (
                          <option key={manager.id} value={manager.id} data-email={manager.email}>
                            👔 {manager.name} ({manager.email})
                          </option>
                        ))}
                      </optgroup>
                    )}
                    
                    {/* Managers en attente */}
                    {pendingManagerInvites.length > 0 && (
                      <optgroup label="📨 Managers en Attente d'Acceptation">
                        {pendingManagerInvites.map(invite => (
                          <option key={invite.id} value={`pending_${invite.id}`} data-email={invite.email}>
                            📨 {invite.email} (invitation envoyée)
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                  
                  {formData.manager_id && formData.manager_id.startsWith('pending_') && (
                    <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
                      💡 Le vendeur sera automatiquement assigné à ce manager une fois qu'il accepte l'invitation.
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Résumé */}
          {formData.store_id && (
            <div className="p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
              <p className="text-sm font-semibold text-blue-900 mb-2">📋 Résumé de l'invitation :</p>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Email : <span className="font-semibold">{formData.email || '(à saisir)'}</span></li>
                <li>• Rôle : <span className="font-semibold">{formData.role === 'manager' ? '👔 Manager' : '👥 Vendeur'}</span></li>
                <li>• Magasin : <span className="font-semibold">{selectedStore?.name}</span></li>
                {formData.role === 'seller' && formData.manager_id && (
                  <li>• Manager : <span className="font-semibold">
                    {formData.manager_id.startsWith('pending_')
                      ? `📨 ${formData.manager_email} (en attente)`
                      : managers.find(m => m.id === formData.manager_id)?.name
                    }
                  </span></li>
                )}
              </ul>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading || (formData.role === 'seller' && managers.length === 0 && pendingManagerInvites.length === 0)}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Envoi...' : '📨 Envoyer l\'invitation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InviteStaffModal;
