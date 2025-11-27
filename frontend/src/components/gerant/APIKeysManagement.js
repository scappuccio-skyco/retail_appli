import React, { useState, useEffect, useRef } from 'react';
import { Copy, Eye, EyeOff, Plus, Trash2, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import CopyButton from './CopyButton';
import StoreDropdown from './StoreDropdown';

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
  const [showInactive, setShowInactive] = useState(false);

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

  const permanentDeleteAPIKey = async (keyId) => {
    if (!window.confirm('⚠️ ATTENTION : Cette action est IRRÉVERSIBLE !\n\nVoulez-vous vraiment supprimer définitivement cette clé API désactivée ?\n\nElle sera supprimée de la base de données et ne pourra pas être récupérée.')) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/manager/api-keys/${keyId}/permanent`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Erreur lors de la suppression définitive de la clé API');

      fetchAPIKeys();
    } catch (err) {
      setError(err.message);
    }
  };

  const regenerateAPIKey = async (keyId) => {
    if (!window.confirm('⚠️ Attention : Régénérer cette clé désactivera l\'ancienne clé définitivement.\n\n⚠️ LA NOUVELLE CLÉ SERA AFFICHÉE UNE SEULE FOIS dans la liste après régénération.\n\nContinuer ?')) return;

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
      
      // Simply refresh the list - no alert to avoid conflicts
      await fetchAPIKeys();
      
      // Show a simple browser alert with the new key
      alert(`✅ Clé régénérée avec succès !\n\n🔑 COPIEZ CETTE CLÉ MAINTENANT :\n\n${data.key}\n\n⚠️ Elle ne sera plus affichée après fermeture de cette fenêtre.`);
      
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
            <code className="text-gray-900" id="api-key-text">{createdKey.key}</code>
            <button
              onClick={() => {
                const textArea = document.createElement('textarea');
                textArea.value = createdKey.key;
                textArea.style.position = 'fixed';
                textArea.style.left = '-999999px';
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                
                // Show feedback without React state
                const btn = document.getElementById('copy-btn');
                if (btn) {
                  const originalHTML = btn.innerHTML;
                  btn.innerHTML = '✓ Copié !';
                  btn.classList.add('bg-green-800');
                  setTimeout(() => {
                    btn.innerHTML = originalHTML;
                    btn.classList.remove('bg-green-800');
                  }, 2000);
                }
              }}
              id="copy-btn"
              className="flex-shrink-0 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              📋 Copier
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
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg flex items-center gap-2 font-semibold transition-colors shadow-sm"
          >
            <Plus className="h-5 w-5" />
            Créer une nouvelle clé API
          </button>
          <a
            href="/API_INTEGRATION_GUIDE.md"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-3 rounded-lg flex items-center gap-2 font-semibold transition-colors shadow-sm border border-gray-300"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Notice d'utilisation API
          </a>
        </div>
        
        {apiKeys.filter(k => !k.active).length > 0 && (
          <button
            onClick={() => setShowInactive(!showInactive)}
            className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {showInactive && <EyeOff className="h-4 w-4" />}
            {!showInactive && <Eye className="h-4 w-4" />}
            <span>
              {showInactive 
                ? `Masquer les clés désactivées (${apiKeys.filter(k => !k.active).length})`
                : `Afficher les clés désactivées (${apiKeys.filter(k => !k.active).length})`
              }
            </span>
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
              className={`border rounded-lg p-4 transition-all ${
                key.active 
                  ? 'bg-white border-gray-200 hover:border-blue-300 hover:shadow-sm' 
                  : 'bg-gray-50 border-gray-300 opacity-60'
              }`}
            >
              <div className="flex items-center justify-between gap-4">
                {/* Left: Name + Status */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <h3 className="text-base font-semibold text-gray-900 truncate">{key.name}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${
                    key.active 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-gray-200 text-gray-700'
                  }`}>
                    {key.active ? 'Active' : 'Désactivée'}
                  </span>
                </div>

                {/* Middle: Dates */}
                <div className="hidden md:flex items-center gap-4 text-xs text-gray-500">
                  <span title="Date de création">Créée: {formatDate(key.created_at)}</span>
                  {key.last_used_at && (
                    <span title="Dernière utilisation">Utilisée: {formatDate(key.last_used_at)}</span>
                  )}
                </div>

                {/* Right: Action button */}
                <div key={`actions-${key.id}-${key.active}`} className="shrink-0">
                  {key.active && (
                    <button
                      onClick={() => deleteAPIKey(key.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Désactiver la clé"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                  {!key.active && (
                    <button
                      onClick={() => permanentDeleteAPIKey(key.id)}
                      className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
                      title="Supprimer définitivement"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Supprimer
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                {/* Permissions */}
                {key.permissions.map((perm) => {
                  const permLabel = perm === 'write:kpi' 
                    ? '📝 Écriture KPI' 
                    : perm === 'read:stats' 
                    ? '📊 Lecture stats' 
                    : perm;
                  return (
                    <span
                      key={perm}
                      className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-medium"
                      title={perm === 'write:kpi' 
                        ? 'Permet d\'envoyer les données de ventes' 
                        : 'Permet de récupérer les statistiques'}
                    >
                      {permLabel}
                    </span>
                  );
                })}

                {/* Store Access */}
                <span className="text-gray-400">•</span>
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Accès aux magasins <span className="text-red-500">*</span>
                </label>
                
                <StoreDropdown
                  stores={stores}
                  selectedStoreIds={newKeyData.store_ids}
                  onSelectionChange={(storeIds) => setNewKeyData({ ...newKeyData, store_ids: storeIds })}
                />
                
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
