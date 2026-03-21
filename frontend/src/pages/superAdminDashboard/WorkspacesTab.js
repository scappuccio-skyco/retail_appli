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
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">Gestion des Workspaces</h2>
        {/* Filtres par statut */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-purple-200 text-sm">Filtrer :</span>
          <button
            onClick={() => setWorkspaceFilter('all')}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-all ${
              workspaceFilter === 'all'
                ? 'bg-white text-purple-900'
                : 'bg-purple-800/50 text-purple-200 hover:bg-purple-700'
            }`}
          >
            Tous ({workspaceList.length})
          </button>
          <button
            onClick={() => setWorkspaceFilter('active')}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-all ${
              workspaceFilter === 'active'
                ? 'bg-green-500 text-white'
                : 'bg-purple-800/50 text-purple-200 hover:bg-purple-700'
            }`}
          >
            🟢 Actifs ({workspaceList.filter(w => getNormalizedSubscriptionStatus(w) === 'active').length})
          </button>
          <button
            onClick={() => setWorkspaceFilter('trial')}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-all ${
              workspaceFilter === 'trial'
                ? 'bg-yellow-500 text-white'
                : 'bg-purple-800/50 text-purple-200 hover:bg-purple-700'
            }`}
          >
            🟡 Essais ({workspaceList.filter(w => getNormalizedSubscriptionStatus(w) === 'trial').length})
          </button>
          <button
            onClick={() => setWorkspaceFilter('expired')}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-all ${
              workspaceFilter === 'expired'
                ? 'bg-gray-500 text-white'
                : 'bg-purple-800/50 text-purple-200 hover:bg-purple-700'
            }`}
          >
            ⚪ Expirés ({workspaceList.filter(w => getNormalizedSubscriptionStatus(w) === 'expired').length})
          </button>
          <button
            onClick={() => setWorkspaceFilter('payment_failed')}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-all ${
              workspaceFilter === 'payment_failed'
                ? 'bg-red-500 text-white'
                : 'bg-purple-800/50 text-purple-200 hover:bg-purple-700'
            }`}
          >
            🔴 Paiement KO ({workspaceList.filter(w => getNormalizedSubscriptionStatus(w) === 'payment_failed').length})
          </button>
          <button
            onClick={() => setWorkspaceFilter('deleted')}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-all ${
              workspaceFilter === 'deleted'
                ? 'bg-red-500 text-white'
                : 'bg-purple-800/50 text-purple-200 hover:bg-purple-700'
            }`}
          >
            🔴 Supprimés ({workspaceList.filter(w => w.status === 'deleted').length})
          </button>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedWorkspaces.size > 0 && (
        <div className="mb-4 p-4 bg-purple-600/30 border border-purple-500 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckSquare className="w-5 h-5 text-purple-300" />
            <span className="text-white font-medium">
              {selectedWorkspaces.size} workspace(s) sélectionné(s)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleBulkStatusChange('active')}
              disabled={bulkActionLoading}
              className="flex items-center gap-2 px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-200 rounded-lg text-sm transition-all disabled:opacity-50"
            >
              <PlayCircle className="w-4 h-4" />
              Réactiver
            </button>
            <button
              onClick={() => handleBulkStatusChange('deleted')}
              disabled={bulkActionLoading}
              className="flex items-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-200 rounded-lg text-sm transition-all disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              Supprimer
            </button>
            <button
              onClick={() => setSelectedWorkspaces(new Set())}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm transition-all"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/20">
              <th className="text-left p-3 text-purple-200 font-semibold w-10">
                <button
                  onClick={toggleSelectAll}
                  className="p-1 hover:bg-white/10 rounded transition-colors"
                  title={areAllSelected() ? "Tout désélectionner" : "Tout sélectionner"}
                >
                  {areAllSelected() ? (
                    <CheckSquare className="w-5 h-5 text-purple-300" />
                  ) : (
                    <Square className="w-5 h-5 text-purple-400" />
                  )}
                </button>
              </th>
              <th className="text-left p-3 text-purple-200 font-semibold">Workspace / Gérant</th>
              <th className="text-left p-3 text-purple-200 font-semibold">Magasins</th>
              <th className="text-left p-3 text-purple-200 font-semibold">Managers</th>
              <th className="text-left p-3 text-purple-200 font-semibold">Vendeurs</th>
              <th className="text-left p-3 text-purple-200 font-semibold">Plan</th>
              <th className="text-left p-3 text-purple-200 font-semibold">Statut</th>
              <th className="text-left p-3 text-purple-200 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {getFilteredWorkspaces().map((workspace) => (
              <React.Fragment key={workspace.id}>
                <tr className={`border-b border-white/10 hover:bg-white/5 cursor-pointer ${
                  selectedWorkspaces.has(workspace.id) ? 'bg-purple-600/20' : 'bg-purple-900/20'
                }`}>
                  <td className="p-3 w-10">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleWorkspaceSelection(workspace.id);
                      }}
                      className="p-1 hover:bg-white/10 rounded transition-colors"
                    >
                      {selectedWorkspaces.has(workspace.id) ? (
                        <CheckSquare className="w-5 h-5 text-purple-300" />
                      ) : (
                        <Square className="w-5 h-5 text-purple-400" />
                      )}
                    </button>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleWorkspace(workspace.id)}
                        className="text-purple-300 hover:text-white transition-colors"
                        title={expandedWorkspaces[workspace.id] ? "Masquer les détails" : "Afficher les détails"}
                      >
                        {expandedWorkspaces[workspace.id] ? '▼' : '▶'}
                      </button>
                      <div>
                        <div className="text-white font-bold">{workspace.name}</div>
                        {workspace.gerant ? (
                          <div className="text-xs text-purple-300 mt-1">
                            👤 {workspace.gerant.name} - {workspace.gerant.email}
                          </div>
                        ) : (
                          <div className="text-xs text-gray-400 mt-1">❌ Aucun gérant</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="p-3 text-white">
                    <button
                      onClick={() => toggleWorkspace(workspace.id)}
                      className="font-medium hover:text-purple-300 transition-colors"
                    >
                      {workspace.stores_count || 0} magasin{(workspace.stores_count || 0) > 1 ? 's' : ''}
                    </button>
                  </td>
                  <td className="p-3 text-white">
                    <div className="font-medium">{workspace.managers_count || 0} manager{(workspace.managers_count || 0) > 1 ? 's' : ''}</div>
                  </td>
                  <td className="p-3 text-white">
                    <div className="font-medium">{workspace.sellers_count || 0} actif{(workspace.sellers_count || 0) > 1 ? 's' : ''}</div>
                    {workspace.total_sellers > workspace.sellers_count && (
                      <div className="text-xs text-gray-400">({workspace.total_sellers} total)</div>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        workspace.subscription.plan === 'enterprise'
                          ? 'bg-purple-500/20 text-purple-200'
                          : workspace.subscription.plan === 'professional'
                          ? 'bg-blue-500/20 text-blue-200'
                          : workspace.subscription.plan === 'starter'
                          ? 'bg-green-500/20 text-green-200'
                          : 'bg-gray-500/20 text-gray-200'
                      }`}>
                        {workspace.subscription.plan}
                      </span>
                    </div>
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getSubscriptionStatusClasses(getNormalizedSubscriptionStatus(workspace))}`}>
                      {getSubscriptionStatusLabel(getNormalizedSubscriptionStatus(workspace))}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      {workspace.status !== 'deleted' && (
                        <>
                          <button
                            onClick={() => {
                              if (globalThis.confirm(`⚠️ Êtes-vous sûr de vouloir supprimer le workspace "${workspace.name}" ?\n\nCette action est IRRÉVERSIBLE et supprimera :\n- Le workspace\n- Tous les utilisateurs (manager + vendeurs)\n- Toutes les données (analyses, diagnostics, etc.)`)) {
                                handleWorkspaceStatusChange(workspace.id, 'deleted');
                              }
                            }}
                            className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-200 rounded text-sm transition-all"
                          >
                            Supprimer
                          </button>
                        </>
                      )}
                      {workspace.status === 'deleted' && (
                        <button
                          onClick={() => {
                            if (globalThis.confirm(`Voulez-vous restaurer le workspace "${workspace.name}" ?`)) {
                              handleWorkspaceStatusChange(workspace.id, 'active');
                            }
                          }}
                          className="px-3 py-1 bg-green-500/20 hover:bg-green-500/30 text-green-200 rounded text-sm transition-all"
                        >
                          Restaurer
                        </button>
                      )}
                    </div>
                  </td>
                </tr>

                {/* Afficher les stores sous le workspace (accordéon) */}
                {expandedWorkspaces[workspace.id] && workspace.stores && workspace.stores.length > 0 && workspace.stores.map((store, storeIdx) => (
                  <tr key={`${workspace.id}-store-${storeIdx}`} className="border-b border-white/5 bg-white/5">
                    <td className="p-3"></td> {/* Empty cell for checkbox column */}
                    <td className="p-3 pl-8">
                      <div className="text-sm text-purple-200">
                        🏪 {store.name}
                      </div>
                    </td>
                    <td className="p-3 text-xs text-gray-400">-</td>
                    <td className="p-3">
                      {store.manager ? (
                        <div className="text-sm text-purple-200">
                          👤 {store.manager.name}
                          <div className="text-xs text-purple-300">{store.manager.email}</div>
                        </div>
                      ) : (
                        <div className="text-xs text-gray-400">Aucun manager</div>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="text-sm text-white">
                        {store.sellers_count || 0} actif{(store.sellers_count || 0) > 1 ? 's' : ''}
                      </div>
                      {store.sellers && store.sellers.length > 0 && (
                        <div className="mt-1 text-xs text-purple-300 space-y-1">
                          {store.sellers.slice(0, 5).map((seller, sellerIdx) => (
                            <div key={sellerIdx} className={seller.status !== 'active' ? 'opacity-50' : ''}>
                              • {seller.name}
                              {seller.status !== 'active' && (
                                <span className="ml-1 text-orange-300">({seller.status})</span>
                              )}
                            </div>
                          ))}
                          {store.sellers.length > 5 && (
                            <div className="text-gray-400">+ {store.sellers.length - 5} autres...</div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-xs text-gray-400">-</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        store.status === 'active' ? 'bg-green-500/20 text-green-200' : 'bg-red-500/20 text-red-200'
                      }`}>
                        {store.status === 'active' ? 'actif' : 'inactif'}
                      </span>
                    </td>
                    <td className="p-3 text-xs text-gray-400">-</td>
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
