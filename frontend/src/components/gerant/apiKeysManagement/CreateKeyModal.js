import React from 'react';
import StoreDropdown from '../StoreDropdown';

const PERMISSIONS = [
  {
    id: 'write:kpi',
    label: '📝 Écriture des KPI',
    desc: "Permet d'<strong>envoyer</strong> les données de ventes quotidiennes (CA, nombre de ventes, articles vendus) depuis vos systèmes externes (caisse, ERP)",
  },
  {
    id: 'read:stats',
    label: '📊 Lecture des statistiques',
    desc: 'Permet de <strong>récupérer</strong> les statistiques et rapports (performances vendeurs, objectifs, classements) pour les afficher dans vos outils externes',
  },
  {
    id: 'stores:read',
    label: '📖 Lire les magasins',
    desc: 'Permet de <strong>lire</strong> la liste des magasins et leurs informations via l\'API',
  },
  {
    id: 'stores:write',
    label: '🏪 Créer des magasins',
    desc: 'Permet de <strong>créer</strong> de nouveaux magasins via l\'API (gérants uniquement)',
  },
  {
    id: 'users:write',
    label: '👥 Gérer les utilisateurs',
    desc: 'Permet de <strong>créer et modifier</strong> des managers et vendeurs via l\'API',
  },
];

export default function CreateKeyModal({ newKeyData, setNewKeyData, stores, onClose, onCreate, togglePermission }) {
  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto"
      onClick={onClose}
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
                onChange={(e) => setNewKeyData({ ...newKeyData, expires_days: e.target.value ? Number.parseInt(e.target.value) : null })}
                placeholder="Laisser vide pour aucune expiration"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                min="1"
              />
              <p className="text-xs text-gray-500 mt-1">Optionnel : définir une date d'expiration automatique</p>
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
                <InfoIcon />
                Cliquez pour choisir les magasins autorisés
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Autorisations <span className="text-red-500">*</span>
              </label>
              <div className="space-y-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
                {PERMISSIONS.map((perm, i) => (
                  <React.Fragment key={perm.id}>
                    {i > 0 && <div className="border-t border-blue-200" />}
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newKeyData.permissions.includes(perm.id)}
                        onChange={() => togglePermission(perm.id)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mt-0.5 cursor-pointer"
                      />
                      <div className="flex-1">
                        <span className="text-sm font-semibold text-gray-900 block">{perm.label}</span>
                        <span
                          className="text-xs text-gray-600 block mt-0.5"
                          dangerouslySetInnerHTML={{ __html: perm.desc }}
                        />
                      </div>
                    </label>
                  </React.Fragment>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                <InfoIcon />
                Cochez au moins une autorisation
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={onCreate}
              disabled={!newKeyData.name.trim()}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium transition-colors"
            >
              Créer la clé
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoIcon() {
  return (
    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
    </svg>
  );
}
