import React from 'react';
import { Eye, EyeOff, Plus, AlertCircle, CheckCircle } from 'lucide-react';
import APIDocModal from './APIDocModal';
import useAPIKeysManagement from './apiKeysManagement/useAPIKeysManagement';
import APIKeyCard from './apiKeysManagement/APIKeyCard';
import CreateKeyModal from './apiKeysManagement/CreateKeyModal';

const APIKeysManagement = () => {
  const s = useAPIKeysManagement();

  if (s.loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const inactiveCount = s.apiKeys.filter(k => !k.active).length;
  const visibleKeys = s.apiKeys.filter(k => s.showInactive || k.active);

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Gestion des Clés API</h1>
        <p className="text-gray-600">
          Créez et gérez vos clés API pour connecter vos logiciels externes (caisse, ERP, etc.)
        </p>
      </div>

      {s.error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          <span>{s.error}</span>
        </div>
      )}

      {s.createdKey && (
        <div className="mb-6 bg-green-50 border-2 border-green-500 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="h-6 w-6 text-green-600" />
            <h3 className="text-lg font-semibold text-green-900">Clé API créée avec succès !</h3>
          </div>
          <p className="text-green-800 mb-4">
            <strong>IMPORTANT :</strong> Copiez cette clé maintenant. Elle ne sera plus affichée par la suite.
          </p>
          <div className="bg-white border border-green-300 rounded-lg p-4 font-mono text-sm break-all flex items-center justify-between gap-4">
            <code className="text-gray-900">{s.createdKey.key}</code>
            <button
              id="copy-btn"
              onClick={() => {
                const textArea = document.createElement('textarea');
                textArea.value = s.createdKey.key;
                textArea.style.position = 'fixed';
                textArea.style.left = '-999999px';
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                const btn = document.getElementById('copy-btn');
                if (btn) {
                  const orig = btn.innerHTML;
                  btn.innerHTML = '✓ Copié !';
                  btn.classList.add('bg-green-800');
                  setTimeout(() => { btn.innerHTML = orig; btn.classList.remove('bg-green-800'); }, 2000);
                }
              }}
              className="flex-shrink-0 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              📋 Copier
            </button>
          </div>
          <button
            onClick={() => s.setCreatedKey(null)}
            className="mt-4 text-green-700 hover:text-green-900 font-medium"
          >
            J'ai copié la clé, masquer ce message
          </button>
        </div>
      )}

      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => s.setShowCreateModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg flex items-center gap-2 font-semibold transition-colors shadow-sm"
          >
            <Plus className="h-5 w-5" />
            Créer une nouvelle clé API
          </button>
          <button
            onClick={() => s.setShowDocModal(true)}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-3 rounded-lg flex items-center gap-2 font-semibold transition-colors shadow-sm border border-gray-300"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Notice d'utilisation API
          </button>
        </div>

        {inactiveCount > 0 && (
          <button
            onClick={() => s.setShowInactive(!s.showInactive)}
            className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {s.showInactive ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            <span>
              {s.showInactive
                ? `Masquer les clés désactivées (${inactiveCount})`
                : `Afficher les clés désactivées (${inactiveCount})`}
            </span>
          </button>
        )}
      </div>

      <div className="space-y-4">
        {visibleKeys.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <p className="text-gray-600 text-lg">Aucune clé API</p>
            <p className="text-gray-500 text-sm mt-2">Créez votre première clé pour commencer l'intégration</p>
          </div>
        ) : (
          visibleKeys.map((key) => (
            <APIKeyCard
              key={key.id}
              apiKey={key}
              formatDate={s.formatDate}
              onDelete={s.deleteAPIKey}
              onPermanentDelete={s.permanentDeleteAPIKey}
            />
          ))
        )}
      </div>

      {s.showCreateModal && (
        <CreateKeyModal
          newKeyData={s.newKeyData}
          setNewKeyData={s.setNewKeyData}
          stores={s.stores}
          onClose={() => s.setShowCreateModal(false)}
          onCreate={s.createAPIKey}
          togglePermission={s.togglePermission}
        />
      )}

      <APIDocModal isOpen={s.showDocModal} onClose={() => s.setShowDocModal(false)} />
    </div>
  );
};

export default APIKeysManagement;
