import React from 'react';
import {
  CheckSquare, Square, Trash2, PlayCircle, AlertCircle
} from 'lucide-react';

export default function WorkspacesTab({
  workspaces,
  workspaceFilter,
  setWorkspaceFilter,
  expandedWorkspaces,
  selectedWorkspaces,
  setSelectedWorkspaces,
  bulkActionLoading,
  getNormalizedSubscriptionStatus,
  getSubscriptionStatusLabel,
  getSubscriptionStatusClasses,
  toggleWorkspace,
  toggleWorkspaceSelection,
  toggleSelectAll,
  areAllSelected,
  getFilteredWorkspaces,
  handleWorkspaceStatusChange,
  handleBulkStatusChange,
}) {
  const workspaceList = Array.isArray(workspaces) ? workspaces : [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h2 className="text-2xl font-bold text-gray-800">Gestion des Workspaces</h2>
        {/* Filtres par statut */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-gray-500 text-sm">Filtrer :</span>
          {[
            { id: 'all', label: `Tous (${workspaceList.length})`, activeClass: 'bg-[#1E40AF] text-white' },
            { id: 'active', label: `🟢 Actifs (${workspaceList.filter(w => getNormalizedSubscriptionStatus(w) === 'active').length})`, activeClass: 'bg-green-600 text-white' },
            { id: 'trial', label: `🟡 Essais (${workspaceList.filter(w => getNormalizedSubscriptionStatus(w) === 'trial').length})`, activeClass: 'bg-yellow-500 text-white' },
            { id: 'expired', label: `⚪ Expirés (${workspaceList.filter(w => getNormalizedSubscriptionStatus(w) === 'expired').length})`, activeClass: 'bg-gray-500 text-white' },
            { id: 'payment_failed', label: `🔴 Paiement KO (${workspaceList.filter(w => getNormalizedSubscriptionStatus(w) === 'payment_failed').length})`, activeClass: 'bg-red-500 text-white' },
            { id: 'deleted', label: `🗑 Supprimés (${workspaceList.filter(w => w.status === 'deleted').length})`, activeClass: 'bg-red-500 text-white' },
          ].map(({ id, label, activeClass }) => (
            <button
              key={id}
              onClick={() => setWorkspaceFilter(id)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-all ${
                workspaceFilter === id ? activeClass : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedWorkspaces.size > 0 && (
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckSquare className="w-5 h-5 text-blue-600" />
            <span className="text-gray-800 font-medium">
              {selectedWorkspaces.size} workspace(s) sélectionné(s)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleBulkStatusChange('active')}
              disabled={bulkActionLoading}
              className="flex items-center gap-2 px-4 py-2 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg text-sm transition-all disabled:opacity-50"
            >
              <PlayCircle className="w-4 h-4" />
              Réactiver
            </button>
            <button
              onClick={() => handleBulkStatusChange('deleted')}
              disabled={bulkActionLoading}
              className="flex items-center gap-2 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-sm transition-all disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              Supprimer
            </button>
            <button
              onClick={() => setSelectedWorkspaces(new Set())}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm transition-all"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left p-3 text-gray-600 font-semibold w-10">
                <button
                  onClick={toggleSelectAll}
                  className="p-1 hover:bg-gray-200 rounded transition-colors"
                  title={areAllSelected() ? "Tout désélectionner" : "Tout sélectionner"}
                >
                  {areAllSelected() ? (
                    <CheckSquare className="w-5 h-5 text-[#1E40AF]" />
                  ) : (
                    <Square className="w-5 h-5 text-gray-400" />
                  )}
                </button>
              </th>
              <th className="text-left p-3 text-gray-600 font-semibold">Workspace / Gérant</th>
              <th className="text-left p-3 text-gray-600 font-semibold">Magasins</th>
              <th className="text-left p-3 text-gray-600 font-semibold">Managers</th>
              <th className="text-left p-3 text-gray-600 font-semibold">Vendeurs</th>
              <th className="text-left p-3 text-gray-600 font-semibold">Plan</th>
              <th className="text-left p-3 text-gray-600 font-semibold">Statut</th>
              <th className="text-left p-3 text-gray-600 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {getFilteredWorkspaces().map((workspace) => (
              <React.Fragment key={workspace.id}>
                <tr className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors ${
                  selectedWorkspaces.has(workspace.id) ? 'bg-blue-50' : ''
                }`}>
                  <td className="p-3 w-10">
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleWorkspaceSelection(workspace.id); }}
                      className="p-1 hover:bg-gray-200 rounded transition-colors"
                    >
                      {selectedWorkspaces.has(workspace.id) ? (
                        <CheckSquare className="w-5 h-5 text-[#1E40AF]" />
                      ) : (
                        <Square className="w-5 h-5 text-gray-400" />
                      )}
                    </button>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleWorkspace(workspace.id)}
                        className="text-gray-400 hover:text-gray-700 transition-colors"
                        title={expandedWorkspaces[workspace.id] ? "Masquer les détails" : "Afficher les détails"}
                      >
                        {expandedWorkspaces[workspace.id] ? '▼' : '▶'}
                      </button>
                      <div>
                        <div className="text-gray-800 font-bold">{workspace.name}</div>
                        {workspace.gerant ? (
                          <div className="text-xs text-gray-500 mt-1">
                            👤 {workspace.gerant.name} — {workspace.gerant.email}
                          </div>
                        ) : (
                          <div className="text-xs text-red-400 mt-1">❌ Aucun gérant</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="p-3 text-gray-700">
                    <button
                      onClick={() => toggleWorkspace(workspace.id)}
                      className="font-medium hover:text-[#1E40AF] transition-colors"
                    >
                      {workspace.stores_count || 0} magasin{(workspace.stores_count || 0) > 1 ? 's' : ''}
                    </button>
                  </td>
                  <td className="p-3 text-gray-700">
                    <div className="font-medium">{workspace.managers_count || 0} manager{(workspace.managers_count || 0) > 1 ? 's' : ''}</div>
                  </td>
                  <td className="p-3 text-gray-700">
                    <div className="font-medium">{workspace.sellers_count || 0} actif{(workspace.sellers_count || 0) > 1 ? 's' : ''}</div>
                    {workspace.total_sellers > workspace.sellers_count && (
                      <div className="text-xs text-gray-400">({workspace.total_sellers} total)</div>
                    )}
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      workspace.subscription.plan === 'enterprise'
                        ? 'bg-purple-100 text-purple-700'
                        : workspace.subscription.plan === 'professional'
                        ? 'bg-blue-100 text-blue-700'
                        : workspace.subscription.plan === 'starter'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {workspace.subscription.plan}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getSubscriptionStatusClasses(getNormalizedSubscriptionStatus(workspace))}`}>
                      {getSubscriptionStatusLabel(getNormalizedSubscriptionStatus(workspace))}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      {workspace.status !== 'deleted' && (
                        <button
                          onClick={() => {
                            if (globalThis.confirm(`⚠️ Êtes-vous sûr de vouloir supprimer le workspace "${workspace.name}" ?\n\nCette action est IRRÉVERSIBLE et supprimera :\n- Le workspace\n- Tous les utilisateurs (manager + vendeurs)\n- Toutes les données (analyses, diagnostics, etc.)`)) {
                              handleWorkspaceStatusChange(workspace.id, 'deleted');
                            }
                          }}
                          className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded text-sm transition-all"
                        >
                          Supprimer
                        </button>
                      )}
                      {workspace.status === 'deleted' && (
                        <button
                          onClick={() => {
                            if (globalThis.confirm(`Voulez-vous restaurer le workspace "${workspace.name}" ?`)) {
                              handleWorkspaceStatusChange(workspace.id, 'active');
                            }
                          }}
                          className="px-3 py-1 bg-green-100 hover:bg-green-200 text-green-700 rounded text-sm transition-all"
                        >
                          Restaurer
                        </button>
                      )}
                    </div>
                  </td>
                </tr>

                {/* Stores accordéon */}
                {expandedWorkspaces[workspace.id] && workspace.stores && workspace.stores.length > 0 && workspace.stores.map((store, storeIdx) => (
                  <tr key={`${workspace.id}-store-${storeIdx}`} className="border-b border-gray-100 bg-slate-50">
                    <td className="p-3"></td>
                    <td className="p-3 pl-8">
                      <div className="text-sm text-gray-700 font-medium">
                        🏪 {store.name}
                      </div>
                    </td>
                    <td className="p-3 text-xs text-gray-400">—</td>
                    <td className="p-3">
                      {store.manager ? (
                        <div className="text-sm text-gray-700">
                          👤 {store.manager.name}
                          <div className="text-xs text-gray-500">{store.manager.email}</div>
                        </div>
                      ) : (
                        <div className="text-xs text-gray-400">Aucun manager</div>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="text-sm text-gray-700">
                        {store.sellers_count || 0} actif{(store.sellers_count || 0) > 1 ? 's' : ''}
                      </div>
                      {store.sellers && store.sellers.length > 0 && (
                        <div className="mt-1 text-xs text-gray-500 space-y-0.5">
                          {store.sellers.slice(0, 5).map((seller, sellerIdx) => (
                            <div key={sellerIdx} className={seller.status !== 'active' ? 'opacity-50' : ''}>
                              • {seller.name}
                              {seller.status !== 'active' && (
                                <span className="ml-1 text-orange-500">({seller.status})</span>
                              )}
                            </div>
                          ))}
                          {store.sellers.length > 5 && (
                            <div className="text-gray-400">+ {store.sellers.length - 5} autres...</div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-xs text-gray-400">—</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        store.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {store.status === 'active' ? 'actif' : 'inactif'}
                      </span>
                    </td>
                    <td className="p-3 text-xs text-gray-400">—</td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
