import { useState, useEffect } from 'react';
import { api } from '../../../lib/apiClient';
import { logger } from '../../../utils/logger';

const DEFAULT_PERMISSIONS = ['write:kpi', 'read:stats', 'stores:read', 'stores:write', 'users:write'];
const DEFAULT_KEY_DATA = { name: '', permissions: DEFAULT_PERMISSIONS, expires_days: null, store_ids: null };

export default function useAPIKeysManagement() {
  const [apiKeys, setApiKeys] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyData, setNewKeyData] = useState(DEFAULT_KEY_DATA);
  const [createdKey, setCreatedKey] = useState(null);
  const [visibleKeys, setVisibleKeys] = useState({});
  const [showInactive, setShowInactive] = useState(false);
  const [showDocModal, setShowDocModal] = useState(false);

  useEffect(() => {
    fetchAPIKeys();
    fetchStores();
  }, []);

  const fetchStores = async () => {
    try {
      const response = await api.get('/gerant/stores');
      setStores(Array.isArray(response.data) ? response.data : (response.data.stores || []));
    } catch (err) {
      logger.error('Erreur chargement magasins:', err);
      setStores([]);
    }
  };

  const fetchAPIKeys = async () => {
    try {
      setLoading(true);
      const response = await api.get('/gerant/api-keys');
      setApiKeys(response.data.api_keys || []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    } finally {
      setLoading(false);
    }
  };

  const createAPIKey = async () => {
    try {
      const response = await api.post('/gerant/api-keys', newKeyData);
      setCreatedKey(response.data);
      setShowCreateModal(false);
      setNewKeyData(DEFAULT_KEY_DATA);
      fetchAPIKeys();
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    }
  };

  const deleteAPIKey = async (keyId) => {
    if (!globalThis.confirm('Êtes-vous sûr de vouloir désactiver cette clé API ?')) return;
    try {
      await api.delete(`/gerant/api-keys/${keyId}`);
      fetchAPIKeys();
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    }
  };

  const permanentDeleteAPIKey = async (keyId) => {
    if (!globalThis.confirm('⚠️ ATTENTION : Cette action est IRRÉVERSIBLE !\n\nVoulez-vous vraiment supprimer définitivement cette clé API désactivée ?\n\nElle sera supprimée de la base de données et ne pourra pas être récupérée.')) return;
    try {
      await api.delete(`/gerant/api-keys/${keyId}/permanent`);
      fetchAPIKeys();
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    }
  };

  const toggleKeyVisibility = (keyId) => {
    setVisibleKeys(prev => ({ ...prev, [keyId]: !prev[keyId] }));
  };

  const togglePermission = (perm) => {
    setNewKeyData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(perm)
        ? prev.permissions.filter(p => p !== perm)
        : [...prev.permissions, perm],
    }));
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Jamais';
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  const maskKey = (key) => {
    if (!key) return '';
    return `${key.substring(0, 12)}${'•'.repeat(20)}${key.substring(key.length - 4)}`;
  };

  return {
    apiKeys, stores, loading, error,
    showCreateModal, setShowCreateModal,
    newKeyData, setNewKeyData,
    createdKey, setCreatedKey,
    visibleKeys,
    showInactive, setShowInactive,
    showDocModal, setShowDocModal,
    createAPIKey, deleteAPIKey, permanentDeleteAPIKey,
    toggleKeyVisibility, togglePermission,
    formatDate, maskKey,
  };
}
