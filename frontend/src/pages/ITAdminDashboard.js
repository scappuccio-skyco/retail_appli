import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  Key, Users, Store, Activity, Settings, Copy, 
  Eye, EyeOff, Trash2, Plus, CheckCircle, XCircle,
  Cloud, Database, Clock, BarChart3
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function ITAdminDashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [syncStatus, setSyncStatus] = useState(null);
  const [apiKeys, setApiKeys] = useState([]);
  const [enterpriseConfig, setEnterpriseConfig] = useState(null);
  const [syncLogs, setSyncLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showGenerateKeyModal, setShowGenerateKeyModal] = useState(false);

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [statusRes, keysRes, configRes, logsRes] = await Promise.all([
        axios.get(`${API}/enterprise/sync-status`, { headers }),
        axios.get(`${API}/enterprise/api-keys`, { headers }),
        axios.get(`${API}/enterprise/config`, { headers }),
        axios.get(`${API}/enterprise/sync-logs?limit=20`, { headers })
      ]);

      setSyncStatus(statusRes.data);
      setApiKeys(keysRes.data.api_keys || []);
      setEnterpriseConfig(configRes.data);
      setSyncLogs(logsRes.data.logs || []);
    } catch (err) {
      console.error('Error loading data:', err);
      toast.error('Erreur de chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateKey = () => {
    setShowGenerateKeyModal(true);
  };

  const handleRevokeKey = async (keyId, keyName) => {
    if (!window.confirm(`Voulez-vous vraiment révoquer la clé "${keyName}" ?`)) {
      return;
    }

    try {
      await axios.delete(`${API}/enterprise/api-keys/${keyId}`, { headers });
      toast.success('Clé API révoquée');
      fetchData();
    } catch (err) {
      console.error('Error revoking key:', err);
      toast.error('Erreur lors de la révocation');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-xl font-medium text-gray-600">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">IT Admin Dashboard</h1>
              <p className="text-sm text-gray-600 mt-1">{enterpriseConfig?.company_name}</p>
            </div>
            <button
              onClick={onLogout}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 font-medium"
            >
              Se déconnecter
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
          <div className="flex flex-wrap border-b border-gray-200">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-6 py-4 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'overview'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Vue d'ensemble
              </div>
            </button>
            <button
              onClick={() => setActiveTab('api-keys')}
              className={`px-6 py-4 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'api-keys'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4" />
                Clés API
              </div>
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`px-6 py-4 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'logs'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Logs de synchronisation
              </div>
            </button>
            <button
              onClick={() => setActiveTab('config')}
              className={`px-6 py-4 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'config'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Configuration
              </div>
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <OverviewTab syncStatus={syncStatus} />
        )}

        {activeTab === 'api-keys' && (
          <APIKeysTab 
            apiKeys={apiKeys} 
            onGenerate={handleGenerateKey}
            onRevoke={handleRevokeKey}
          />
        )}

        {activeTab === 'logs' && (
          <LogsTab logs={syncLogs} />
        )}

        {activeTab === 'config' && (
          <ConfigTab config={enterpriseConfig} onUpdate={fetchData} />
        )}
      </div>

      {/* Generate Key Modal */}
      {showGenerateKeyModal && (
        <GenerateKeyModal 
          onClose={() => setShowGenerateKeyModal(false)}
          onSuccess={fetchData}
        />
      )}
    </div>
  );
}

// Overview Tab Component
function OverviewTab({ syncStatus }) {
  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-100 rounded-full">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Utilisateurs</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">{syncStatus?.total_users || 0}</div>
          <p className="text-sm text-gray-600 mt-1">
            {syncStatus?.active_users || 0} actifs
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-100 rounded-full">
              <Store className="w-6 h-6 text-green-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Magasins</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">{syncStatus?.total_stores || 0}</div>
          <p className="text-sm text-gray-600 mt-1">Tous actifs</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className={`p-3 rounded-full ${
              syncStatus?.last_sync_status === 'success' 
                ? 'bg-green-100' 
                : syncStatus?.last_sync_status === 'failed'
                ? 'bg-red-100'
                : 'bg-gray-100'
            }`}>
              <Cloud className={`w-6 h-6 ${
                syncStatus?.last_sync_status === 'success' 
                  ? 'text-green-600' 
                  : syncStatus?.last_sync_status === 'failed'
                  ? 'text-red-600'
                  : 'text-gray-600'
              }`} />
            </div>
            <span className="text-sm font-medium text-gray-500">Synchronisation</span>
          </div>
          <div className="text-lg font-semibold text-gray-900 capitalize">
            {syncStatus?.last_sync_status === 'never' ? 'Jamais synchronisé' : syncStatus?.last_sync_status || 'Jamais'}
          </div>
          <p className="text-sm text-gray-600 mt-1">
            {syncStatus?.last_sync_at 
              ? new Date(syncStatus.last_sync_at).toLocaleString('fr-FR')
              : 'Aucune synchronisation'}
          </p>
        </div>
      </div>

      {/* Sync Status Details */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Database className="w-5 h-5 text-blue-600" />
          Configuration de synchronisation
        </h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <span className="text-gray-600">Mode de synchronisation</span>
            <span className="font-medium text-gray-900 uppercase">{syncStatus?.sync_mode || 'N/A'}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <span className="text-gray-600">Entreprise</span>
            <span className="font-medium text-gray-900">{syncStatus?.company_name || 'N/A'}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <span className="text-gray-600">SCIM activé</span>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              syncStatus?.scim_enabled 
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-700'
            }`}>
              {syncStatus?.scim_enabled ? 'Oui' : 'Non'}
            </span>
          </div>
        </div>
      </div>

      {/* Recent Logs Preview */}
      {syncStatus?.recent_logs && syncStatus.recent_logs.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Activité récente</h3>
          <div className="space-y-2">
            {syncStatus.recent_logs.slice(0, 5).map((log, index) => (
              <div key={index} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
                {log.status === 'success' ? (
                  <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                )}
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{log.operation}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(log.timestamp).toLocaleString('fr-FR')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// API Keys Tab Component
function APIKeysTab({ apiKeys, onGenerate, onRevoke }) {
  return (
    <div className="space-y-6">
      {/* Header with Generate Button */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Clés API</h3>
            <p className="text-sm text-gray-600 mt-1">
              Gérez les clés API pour l'intégration avec vos systèmes ERP
            </p>
          </div>
          <button
            onClick={onGenerate}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 font-medium"
          >
            <Plus className="w-4 h-4" />
            Générer une clé
          </button>
        </div>
      </div>

      {/* API Keys List */}
      {apiKeys.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <Key className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Aucune clé API</h3>
          <p className="text-gray-600 mb-6">
            Générez votre première clé API pour commencer l'intégration
          </p>
          <button
            onClick={onGenerate}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            Générer une clé
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {apiKeys.map((key) => (
            <div key={key.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h4 className="text-lg font-semibold text-gray-900">{key.name}</h4>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      key.is_active 
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {key.is_active ? 'Active' : 'Révoquée'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 font-mono mb-3">{key.key_preview}</p>
                  <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                    <div>
                      <span className="font-medium">Créée :</span>{' '}
                      {new Date(key.created_at).toLocaleDateString('fr-FR')}
                    </div>
                    <div>
                      <span className="font-medium">Dernière utilisation :</span>{' '}
                      {key.last_used_at 
                        ? new Date(key.last_used_at).toLocaleDateString('fr-FR')
                        : 'Jamais'}
                    </div>
                    <div>
                      <span className="font-medium">Requêtes :</span> {key.request_count || 0}
                    </div>
                  </div>
                  {key.scopes && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {key.scopes.map((scope, idx) => (
                        <span 
                          key={idx} 
                          className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-medium"
                        >
                          {scope}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {key.is_active && (
                  <button
                    onClick={() => onRevoke(key.id, key.name)}
                    className="ml-4 p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Révoquer cette clé"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Logs Tab Component
function LogsTab({ logs }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Logs de synchronisation</h3>
        <p className="text-sm text-gray-600 mt-1">Historique des 20 dernières opérations</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Statut
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Opération
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Date
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {logs.length === 0 ? (
              <tr>
                <td colSpan="4" className="px-6 py-12 text-center text-gray-500">
                  Aucun log disponible
                </td>
              </tr>
            ) : (
              logs.map((log, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    {log.status === 'success' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                        <CheckCircle className="w-3 h-3" />
                        Succès
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                        <XCircle className="w-3 h-3" />
                        Échec
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">{log.operation}</td>
                  <td className="px-6 py-4 text-sm text-gray-600 capitalize">{log.resource_type}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(log.timestamp).toLocaleString('fr-FR')}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Config Tab Component
function ConfigTab({ config }) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Configuration de l'entreprise</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nom de l'entreprise
            </label>
            <input
              type="text"
              value={config?.company_name || ''}
              disabled
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email de contact
            </label>
            <input
              type="email"
              value={config?.company_email || ''}
              disabled
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Mode de synchronisation
            </label>
            <input
              type="text"
              value={config?.sync_mode?.toUpperCase() || 'N/A'}
              disabled
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed"
            />
          </div>
        </div>
      </div>

      {/* Documentation Link */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h4 className="font-semibold text-blue-900 mb-2">📚 Documentation API</h4>
        <p className="text-sm text-blue-800 mb-4">
          Consultez la documentation complète pour intégrer votre système ERP avec Retail Performer.
        </p>
        <a
          href="/ENTERPRISE_API_DOCUMENTATION.md"
          target="_blank"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm"
        >
          <BarChart3 className="w-4 h-4" />
          Voir la documentation
        </a>
      </div>
    </div>
  );
}

// Generate Key Modal Component
function GenerateKeyModal({ onClose, onSuccess }) {
  const [name, setName] = useState('');
  const [expiresInDays, setExpiresInDays] = useState(365);
  const [scopes, setScopes] = useState(['users:read', 'users:write', 'stores:read', 'stores:write']);
  const [saving, setSaving] = useState(false);
  const [generatedKey, setGeneratedKey] = useState(null);

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  const handleGenerate = async () => {
    if (!name.trim()) {
      toast.error('Veuillez saisir un nom pour la clé');
      return;
    }

    setSaving(true);
    try {
      const response = await axios.post(
        `${API}/enterprise/api-keys/generate`,
        {
          name: name.trim(),
          scopes,
          expires_in_days: expiresInDays > 0 ? expiresInDays : null
        },
        { headers }
      );

      setGeneratedKey(response.data);
      toast.success('Clé API générée avec succès');
    } catch (err) {
      console.error('Error generating key:', err);
      toast.error('Erreur lors de la génération de la clé');
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = () => {
    if (!generatedKey?.key) return;

    // Méthode exacte de l'espace Gérant (manipulation DOM directe sans React state)
    const textArea = document.createElement('textarea');
    textArea.value = generatedKey.key;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    
    // Show feedback without React state (évite conflit DOM)
    const btn = document.getElementById('copy-api-key-btn');
    if (btn) {
      const originalHTML = btn.innerHTML;
      btn.innerHTML = '<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path></svg> Copié';
      btn.classList.add('bg-green-600');
      btn.classList.remove('bg-blue-600', 'hover:bg-blue-700');
      setTimeout(() => {
        btn.innerHTML = originalHTML;
        btn.classList.remove('bg-green-600');
        btn.classList.add('bg-blue-600', 'hover:bg-blue-700');
      }, 2000);
    }
  };

  const handleClose = () => {
    if (generatedKey) {
      onSuccess();
    }
    onClose();
  };

  return (
    <div 
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">Générer une clé API</h2>
        </div>

        <div className="p-6">
          {!generatedKey ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nom de la clé *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: SAP Production Key"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Expiration (jours)
                </label>
                <input
                  type="number"
                  value={expiresInDays}
                  onChange={(e) => setExpiresInDays(parseInt(e.target.value) || 0)}
                  min="0"
                  placeholder="365"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  0 = aucune expiration
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Permissions
                </label>
                <div className="space-y-2">
                  {['users:read', 'users:write', 'stores:read', 'stores:write'].map((scope) => (
                    <label key={scope} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={scopes.includes(scope)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setScopes([...scopes, scope]);
                          } else {
                            setScopes(scopes.filter(s => s !== scope));
                          }
                        }}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                      <span className="text-sm text-gray-700">{scope}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
                >
                  {saving ? 'Génération...' : 'Générer la clé'}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm font-medium text-yellow-900 mb-1">
                  ⚠️ Important : Copiez cette clé maintenant
                </p>
                <p className="text-sm text-yellow-800">
                  Cette clé ne sera plus jamais affichée. Stockez-la dans un endroit sûr.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Votre clé API
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={generatedKey.key}
                    readOnly
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 font-mono text-sm"
                  />
                  <button
                    onClick={handleCopy}
                    className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 ${
                      copied 
                        ? 'bg-green-600 text-white'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? 'Copié' : 'Copier'}
                  </button>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                <p><span className="font-medium">Nom :</span> {generatedKey.name}</p>
                <p><span className="font-medium">Créée le :</span> {new Date(generatedKey.created_at).toLocaleString('fr-FR')}</p>
                {generatedKey.expires_at && (
                  <p><span className="font-medium">Expire le :</span> {new Date(generatedKey.expires_at).toLocaleString('fr-FR')}</p>
                )}
              </div>

              <button
                onClick={handleClose}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                Fermer
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
