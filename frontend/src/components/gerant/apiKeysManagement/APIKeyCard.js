import React from 'react';
import { Trash2 } from 'lucide-react';

const PERM_LABELS = {
  'write:kpi': '📝 Écriture KPI',
  'read:stats': '📊 Lecture stats',
  'stores:read': '📖 Lire magasins',
  'stores:write': '🏪 Créer magasins',
  'users:write': '👥 Gérer utilisateurs',
};

const PERM_TITLES = {
  'write:kpi': "Permet d'envoyer des données KPI",
  'read:stats': 'Permet de lire les statistiques',
  'stores:read': 'Permet de lire les magasins',
  'stores:write': 'Permet de créer des magasins',
  'users:write': 'Permet de gérer les utilisateurs',
};

export default function APIKeyCard({ apiKey: key, formatDate, onDelete, onPermanentDelete }) {
  return (
    <div className={`border rounded-lg p-4 transition-all ${
      key.active
        ? 'bg-white border-gray-200 hover:border-blue-300 hover:shadow-sm'
        : 'bg-gray-50 border-gray-300 opacity-60'
    }`}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <h3 className="text-base font-semibold text-gray-900 truncate">{key.name}</h3>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${
            key.active ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700'
          }`}>
            {key.active ? 'Active' : 'Désactivée'}
          </span>
        </div>

        <div className="hidden md:flex items-center gap-4 text-xs text-gray-500">
          <span title="Date de création">Créée: {formatDate(key.created_at)}</span>
          {key.last_used_at && (
            <span title="Dernière utilisation">Utilisée: {formatDate(key.last_used_at)}</span>
          )}
          {key.expires_at && (
            <span title="Date d'expiration" className={`font-medium ${new Date(key.expires_at) < new Date() ? 'text-red-500' : 'text-amber-600'}`}>
              {new Date(key.expires_at) < new Date() ? '⚠️ Expirée' : `Expire: ${formatDate(key.expires_at)}`}
            </span>
          )}
        </div>

        <div className="shrink-0">
          {key.active ? (
            <button
              onClick={() => onDelete(key.id)}
              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Désactiver la clé"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={() => onPermanentDelete(key.id)}
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
        {key.permissions.map((perm) => (
          <span
            key={perm}
            className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-medium"
            title={PERM_TITLES[perm] || ''}
          >
            {PERM_LABELS[perm] || perm}
          </span>
        ))}

        <span className="text-gray-400">•</span>
        {key.store_ids === null || key.store_ids === undefined ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 rounded text-xs font-medium">
            🌐 Tous les magasins
          </span>
        ) : key.store_ids.length === 0 ? (
          <span className="px-2 py-0.5 bg-red-50 text-red-700 rounded text-xs font-medium">
            Aucun magasin
          </span>
        ) : (
          <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded text-xs font-medium">
            🏪 {key.store_ids.length} magasin{key.store_ids.length > 1 ? 's' : ''}
          </span>
        )}
      </div>
    </div>
  );
}
