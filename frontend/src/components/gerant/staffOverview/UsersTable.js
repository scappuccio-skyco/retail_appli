import React from 'react';
import { Mail, Phone, Building2, MoreVertical, Trash2, Ban, CheckCircle, ArrowRightLeft, Lock, Edit, Store } from 'lucide-react';
import { toast } from 'sonner';

function getStatusBadge(status) {
  const s = (!status || status === 'inactive') ? 'active' : status;
  if (s === 'suspended') return <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs">En veille</span>;
  if (s === 'deleted') return <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs">Supprimé</span>;
  return <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">Actif</span>;
}

export default function UsersTable({
  users, canManageStaff,
  actionMenuOpen, setActionMenuOpen,
  getStoreName,
  onEdit, onTransfer, onSuspend, onReactivate, onDelete, onManageStores,
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nom</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Téléphone</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Magasin</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {users.map((user) => (
            <tr key={user.id} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="font-medium text-gray-900">{user.name}</div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Mail className="w-4 h-4" />{user.email}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Phone className="w-4 h-4" />{user.phone || 'N/A'}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Building2 className="w-4 h-4" />{getStoreName(user.store_id)}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                {getStatusBadge(user.status || 'active')}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right">
                <div className="relative">
                  <button
                    onClick={() => {
                      if (!canManageStaff) { toast.error("Période d'essai terminée. Contactez votre administrateur."); return; }
                      setActionMenuOpen(actionMenuOpen === user.id ? null : user.id);
                    }}
                    className={`p-2 rounded-lg transition-colors ${!canManageStaff ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100'}`}
                    title={!canManageStaff ? "Période d'essai terminée" : 'Actions'}
                  >
                    <MoreVertical className="w-5 h-5 text-gray-600" />
                    {!canManageStaff && <Lock className="w-3 h-3 absolute -top-1 -right-1 text-gray-400" />}
                  </button>

                  {actionMenuOpen === user.id && canManageStaff && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                      <button onClick={() => onEdit(user)} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2">
                        <Edit className="w-4 h-4" /> Modifier
                      </button>
                      {user.role === 'manager' && onManageStores && (
                        <button onClick={() => onManageStores(user)} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-indigo-600">
                          <Store className="w-4 h-4" /> Gérer les magasins
                        </button>
                      )}
                      {(user.status || 'active') === 'active' && (
                        <>
                          <button onClick={() => onTransfer(user)} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2">
                            <ArrowRightLeft className="w-4 h-4" /> Transférer
                          </button>
                          <button onClick={() => onSuspend(user.id, user.role)} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-orange-600">
                            <Ban className="w-4 h-4" /> Suspendre
                          </button>
                        </>
                      )}
                      {(user.status || 'active') === 'suspended' && (
                        <button onClick={() => onReactivate(user.id, user.role)} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-green-600">
                          <CheckCircle className="w-4 h-4" /> Réactiver
                        </button>
                      )}
                      {(user.status || 'active') !== 'deleted' && (
                        <button onClick={() => onDelete(user.id, user.role)} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-red-600 border-t">
                          <Trash2 className="w-4 h-4" /> Supprimer
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {users.length === 0 && (
        <div className="text-center py-12 text-gray-500">Aucun résultat trouvé</div>
      )}
    </div>
  );
}
