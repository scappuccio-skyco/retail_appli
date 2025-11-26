import React, { useState, useEffect } from 'react';
import { Copy, Eye, EyeOff, Plus, Trash2, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';

const APIKeysManagement = () => {
  const [apiKeys, setApiKeys] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyData, setNewKeyData] = useState({
    name: '',
    permissions: ['write:kpi', 'read:stats'],
    expires_days: null,
    store_ids: null  // null = all stores
  });
  const [createdKey, setCreatedKey] = useState(null);
  const [visibleKeys, setVisibleKeys] = useState({});
  const [copiedKey, setCopiedKey] = useState('');

  useEffect(() => {
    fetchAPIKeys();
    fetchStores();
  }, []);

  const fetchStores = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/gerant/stores`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Erreur lors du chargement des magasins');

      const data = await response.json();
      setStores(data.stores || []);
    } catch (err) {
      console.error('Erreur chargement magasins:', err);
    }
  };

  const fetchAPIKeys = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/manager/api-keys`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Erreur lors du chargement des clés API');

      const data = await response.json();
      setApiKeys(data.api_keys || []);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const createAPIKey = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/manager/api-keys`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newKeyData)
      });

      if (!response.ok) throw new Error('Erreur lors de la création de la clé API');

      const data = await response.json();
      setCreatedKey(data);
      setShowCreateModal(false);
      setNewKeyData({ name: '', permissions: ['write:kpi', 'read:stats'], expires_days: null });
      fetchAPIKeys();
    } catch (err) {
      setError(err.message);
    }
  };

  const deleteAPIKey = async (keyId) => {
    if (!window.confirm('Êtes-vous sûr de vouloir désactiver cette clé API ?')) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/manager/api-keys/${keyId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Erreur lors de la suppression de la clé API');

      fetchAPIKeys();
    } catch (err) {
      setError(err.message);
    }
  };

  const regenerateAPIKey = async (keyId) => {
    if (!window.confirm('Régénérer cette clé désactivera l\'ancienne. Continuer ?')) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/manager/api-keys/${keyId}/regenerate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Erreur lors de la régénération de la clé API');

      const data = await response.json();
      setCreatedKey(data);
      fetchAPIKeys();
    } catch (err) {
      setError(err.message);
    }
  };

  const toggleKeyVisibility = (keyId) => {
    setVisibleKeys(prev => ({
      ...prev,
      [keyId]: !prev[keyId]
    }));
  };

  const copyToClipboard = (text, keyId) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyId);
    setTimeout(() => setCopiedKey(''), 2000);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Jamais';
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const maskKey = (key) => {
    if (!key) return '';
    return `${key.substring(0, 12)}${'•'.repeat(20)}${key.substring(key.length - 4)}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Gestion des Clés API</h1>
        <p className="text-gray-600">
          Créez et gérez vos clés API pour connecter vos logiciels externes (caisse, ERP, etc.)
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          <span>{error}</span>
        </div>
      )}

      {/* Created Key Alert */}
      {createdKey && (
        <div className="mb-6 bg-green-50 border-2 border-green-500 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="h-6 w-6 text-green-600" />
            <h3 className="text-lg font-semibold text-green-900">Clé API créée avec succès !</h3>
          </div>
          <p className="text-green-800 mb-4">
            <strong>IMPORTANT :</strong> Copiez cette clé maintenant. Elle ne sera plus affichée par la suite.
          </p>
          <div className="bg-white border border-green-300 rounded-lg p-4 font-mono text-sm break-all flex items-center justify-between gap-4">
            <code className="text-gray-900">{createdKey.key}</code>
            <button
              onClick={() => copyToClipboard(createdKey.key, 'created')}
              className="flex-shrink-0 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
            >
              {copiedKey === 'created' ? (
                <>
                  <CheckCircle className="h-4 w-4" />
                  Copié !
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copier
                </>
              )}
            </button>
          </div>
          <button
            onClick={() => setCreatedKey(null)}
            className="mt-4 text-green-700 hover:text-green-900 font-medium"
          >
            J'ai copié la clé, masquer ce message
          </button>
        </div>
      )}

      {/* Create Button */}
      <div className="mb-6">
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg flex items-center gap-2 font-semibold transition-colors shadow-sm"
        >
          <Plus className="h-5 w-5" />
          Créer une nouvelle clé API
        </button>
      </div>

      {/* API Keys List */}
      <div className="space-y-4">
        {apiKeys.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <p className="text-gray-600 text-lg">Aucune clé API créée</p>
            <p className="text-gray-500 text-sm mt-2">Créez votre première clé pour commencer l'intégration</p>
          </div>
        ) : (
          apiKeys.map((key) => (
            <div
              key={key.id}
              className={`border rounded-lg p-6 transition-all ${
                key.active 
                  ? 'bg-white border-gray-200 hover:border-blue-300 hover:shadow-md' 
                  : 'bg-gray-50 border-gray-300 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-semibold text-gray-900">{key.name}</h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      key.active 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-200 text-gray-700'
                    }`}>
                      {key.active ? 'Active' : 'Désactivée'}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p><strong>Créée :</strong> {formatDate(key.created_at)}</p>
                    <p><strong>Dernière utilisation :</strong> {formatDate(key.last_used_at)}</p>
                    {key.expires_at && (
                      <p><strong>Expire :</strong> {formatDate(key.expires_at)}</p>
                    )}
                  </div>
                </div>

                {key.active && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => regenerateAPIKey(key.id)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Régénérer"
                    >
                      <RefreshCw className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => deleteAPIKey(key.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Désactiver"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                )}
              </div>

              <div className="bg-gray-50 rounded-lg p-3 font-mono text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 flex-1">
                    {maskKey('rp_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx')}
                  </span>
                  <span className="text-xs text-gray-500 italic">
                    (Clé masquée pour des raisons de sécurité)
                  </span>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {key.permissions.map((perm) => (
                  <span
                    key={perm}
                    className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium"
                  >
                    {perm}
                  </span>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Créer une nouvelle clé API</h2>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nom de la clé <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newKeyData.name}
                  onChange={(e) => setNewKeyData({ ...newKeyData, name: e.target.value })}
                  placeholder="Ex: Caisse Magasin Paris"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Expiration (jours)
                </label>
                <input
                  type="number"
                  value={newKeyData.expires_days || ''}
                  onChange={(e) => setNewKeyData({ ...newKeyData, expires_days: e.target.value ? parseInt(e.target.value) : null })}
                  placeholder="Laisser vide pour aucune expiration"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min="1"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Optionnel : définir une date d'expiration automatique
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Permissions
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={newKeyData.permissions.includes('write:kpi')}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setNewKeyData({
                            ...newKeyData,
                            permissions: [...newKeyData.permissions, 'write:kpi']
                          });
                        } else {
                          setNewKeyData({
                            ...newKeyData,
                            permissions: newKeyData.permissions.filter(p => p !== 'write:kpi')
                          });
                        }
                      }}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="text-sm text-gray-700">Écriture KPI (write:kpi)</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={newKeyData.permissions.includes('read:stats')}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setNewKeyData({
                            ...newKeyData,
                            permissions: [...newKeyData.permissions, 'read:stats']
                          });
                        } else {
                          setNewKeyData({
                            ...newKeyData,
                            permissions: newKeyData.permissions.filter(p => p !== 'read:stats')
                          });
                        }
                      }}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="text-sm text-gray-700">Lecture statistiques (read:stats)</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={createAPIKey}
                disabled={!newKeyData.name.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium transition-colors"
              >
                Créer la clé
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default APIKeysManagement;
