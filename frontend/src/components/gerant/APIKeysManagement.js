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
  const [showInactive, setShowInactive] = useState(false);
  const [showStoreDropdown, setShowStoreDropdown] = useState(false);

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
      // L'endpoint retourne directement un array, pas {stores: [...]}
      setStores(Array.isArray(data) ? data : (data.stores || []));
    } catch (err) {
      console.error('Erreur chargement magasins:', err);
      setStores([]);
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
      setNewKeyData({ name: '', permissions: ['write:kpi', 'read:stats'], expires_days: null, store_ids: null });
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
      
      // Refresh the list first, then show the new key
      await fetchAPIKeys();
      
      // Use setTimeout to ensure DOM is stable before showing modal
      setTimeout(() => {
        setCreatedKey(data);
      }, 100);
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

      {/* Create Button & Filters */}
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg flex items-center gap-2 font-semibold transition-colors shadow-sm"
        >
          <Plus className="h-5 w-5" />
          Créer une nouvelle clé API
        </button>
        
        {apiKeys.filter(k => !k.active).length > 0 && (
          <button
            onClick={() => setShowInactive(!showInactive)}
            className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {showInactive ? (
              <>
                <EyeOff className="h-4 w-4" />
                Masquer les clés désactivées ({apiKeys.filter(k => !k.active).length})
              </>
            ) : (
              <>
                <Eye className="h-4 w-4" />
                Afficher les clés désactivées ({apiKeys.filter(k => !k.active).length})
              </>
            )}
          </button>
        )}
      </div>

      {/* API Keys List */}
      <div className="space-y-4">
        {apiKeys.filter(k => showInactive || k.active).length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <p className="text-gray-600 text-lg">Aucune clé API</p>
            <p className="text-gray-500 text-sm mt-2">Créez votre première clé pour commencer l'intégration</p>
          </div>
        ) : (
          apiKeys.filter(k => showInactive || k.active).map((key) => (
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

              <div className="mt-4 space-y-3">
                {/* Permissions */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Autorisations</p>
                  <div className="flex flex-wrap gap-2">
                    {key.permissions.map((perm) => {
                      const permLabel = perm === 'write:kpi' 
                        ? '📝 Écriture KPI' 
                        : perm === 'read:stats' 
                        ? '📊 Lecture stats' 
                        : perm;
                      return (
                        <span
                          key={perm}
                          className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium"
                          title={perm === 'write:kpi' 
                            ? 'Permet d\'envoyer les données de ventes' 
                            : 'Permet de récupérer les statistiques'}
                        >
                          {permLabel}
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* Store Access */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Accès magasins</p>
                  {key.store_ids === null || key.store_ids === undefined ? (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-50 text-green-700 rounded-full text-xs font-medium">
                      🌐 Tous les magasins
                    </span>
                  ) : key.store_ids.length === 0 ? (
                    <span className="px-3 py-1 bg-red-50 text-red-700 rounded-full text-xs font-medium">
                      Aucun magasin
                    </span>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {key.store_ids.map((storeId) => {
                        const store = stores.find(s => s.id === storeId);
                        return (
                          <span
                            key={storeId}
                            className="px-3 py-1 bg-purple-50 text-purple-700 rounded-full text-xs font-medium"
                          >
                            {store ? store.name : storeId}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto"
          onClick={() => setShowCreateModal(false)}
        >
          <div 
            className="bg-white rounded-xl shadow-2xl max-w-2xl w-full my-8 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
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

              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Accès aux magasins <span className="text-red-500">*</span>
                </label>
                
                {/* Dropdown Button */}
                <button
                  type="button"
                  onClick={() => setShowStoreDropdown(!showStoreDropdown)}
                  className="w-full px-4 py-3 text-left bg-white border border-gray-300 rounded-lg hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      {newKeyData.store_ids === null ? (
                        <div>
                          <span className="text-base font-semibold text-blue-700">🌐 Tous les magasins</span>
                          <span className="text-xs text-gray-500 block mt-0.5">
                            Accès à l'ensemble de vos {stores.length} magasin{stores.length > 1 ? 's' : ''}
                          </span>
                        </div>
                      ) : (
                        <div>
                          <span className="text-base font-semibold text-purple-700">
                            {newKeyData.store_ids.length} magasin{newKeyData.store_ids.length > 1 ? 's' : ''} sélectionné{newKeyData.store_ids.length > 1 ? 's' : ''}
                          </span>
                          <span className="text-xs text-gray-500 block mt-0.5">
                            {newKeyData.store_ids.map(id => {
                              const store = stores.find(s => s.id === id);
                              return store ? store.name : id;
                            }).join(', ')}
                          </span>
                        </div>
                      )}
                    </div>
                    <svg 
                      className={`w-5 h-5 text-gray-400 transition-transform ${showStoreDropdown ? 'rotate-180' : ''}`} 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {/* Dropdown Menu */}
                {showStoreDropdown && (
                  <div className="absolute z-10 mt-2 w-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-80 overflow-y-auto">
                    {/* Option: Tous les magasins */}
                    <div
                      onClick={() => {
                        setNewKeyData({ ...newKeyData, store_ids: null });
                        setShowStoreDropdown(false);
                      }}
                      className={`px-4 py-3 cursor-pointer hover:bg-blue-50 border-b border-gray-200 ${
                        newKeyData.store_ids === null ? 'bg-blue-50' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          newKeyData.store_ids === null ? 'border-blue-600 bg-blue-600' : 'border-gray-300'
                        }`}>
                          {newKeyData.store_ids === null && (
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1">
                          <span className="text-sm font-semibold text-blue-700 block">🌐 Tous les magasins</span>
                          <span className="text-xs text-gray-500">Accès complet à tous vos magasins</span>
                        </div>
                      </div>
                    </div>

                    {/* Divider */}
                    <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
                      <p className="text-xs font-semibold text-gray-600 uppercase">Ou sélectionnez des magasins spécifiques :</p>
                    </div>

                    {/* Store List */}
                    {stores.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-gray-500 italic">Chargement des magasins...</div>
                    ) : (
                      stores.map(store => (
                        <label 
                          key={store.id}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-purple-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={Array.isArray(newKeyData.store_ids) && newKeyData.store_ids.includes(store.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                const currentIds = Array.isArray(newKeyData.store_ids) ? newKeyData.store_ids : [];
                                setNewKeyData({
                                  ...newKeyData,
                                  store_ids: [...currentIds, store.id]
                                });
                              } else {
                                const currentIds = Array.isArray(newKeyData.store_ids) ? newKeyData.store_ids : [];
                                const newIds = currentIds.filter(id => id !== store.id);
                                setNewKeyData({
                                  ...newKeyData,
                                  store_ids: newIds.length > 0 ? newIds : null
                                });
                              }
                            }}
                            className="h-5 w-5 text-purple-600 focus:ring-purple-500 border-gray-300 rounded cursor-pointer"
                          />
                          <div className="flex-1">
                            <span className="text-sm font-medium text-gray-900 block">{store.name}</span>
                            {store.location && (
                              <span className="text-xs text-gray-500">{store.location}</span>
                            )}
                          </div>
                        </label>
                      ))
                    )}

                    {/* Footer with selection count */}
                    {Array.isArray(newKeyData.store_ids) && newKeyData.store_ids.length > 0 && (
                      <div className="px-4 py-2 bg-purple-50 border-t border-purple-200">
                        <p className="text-xs text-purple-700 font-medium">
                          ✓ {newKeyData.store_ids.length} magasin{newKeyData.store_ids.length > 1 ? 's' : ''} sélectionné{newKeyData.store_ids.length > 1 ? 's' : ''}
                        </p>
                      </div>
                    )}
                  </div>
                )}
                
                <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  Cliquez pour choisir les magasins autorisés
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Autorisations <span className="text-red-500">*</span>
                </label>
                <div className="space-y-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <label className="flex items-start gap-3 cursor-pointer">
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
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mt-0.5 cursor-pointer"
                    />
                    <div className="flex-1">
                      <span className="text-sm font-semibold text-gray-900 block">📝 Écriture des KPI</span>
                      <span className="text-xs text-gray-600 block mt-0.5">
                        Permet d'<strong>envoyer</strong> les données de ventes quotidiennes (CA, nombre de ventes, articles vendus) depuis vos systèmes externes (caisse, ERP)
                      </span>
                    </div>
                  </label>
                  
                  <div className="border-t border-blue-200"></div>
                  
                  <label className="flex items-start gap-3 cursor-pointer">
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
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mt-0.5 cursor-pointer"
                    />
                    <div className="flex-1">
                      <span className="text-sm font-semibold text-gray-900 block">📊 Lecture des statistiques</span>
                      <span className="text-xs text-gray-600 block mt-0.5">
                        Permet de <strong>récupérer</strong> les statistiques et rapports (performances vendeurs, objectifs, classements) pour les afficher dans vos outils externes
                      </span>
                    </div>
                  </label>
                </div>
                <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  Cochez au moins une autorisation
                </p>
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
        </div>
      )}
    </div>
  );
};

export default APIKeysManagement;
