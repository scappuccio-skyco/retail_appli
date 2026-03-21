import React from 'react';
import { Mail, Building2, Clock, CheckCircle, X, RefreshCw } from 'lucide-react';

export default function InvitationsTable({
  invitations, resendingInvitation,
  getStoreName, onResend, onCancel, onOpenInviteModal,
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1000px]">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-32">Nom</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-24">Rôle</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Magasin</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-24">Statut</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-32">Date d'envoi</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase w-48">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {invitations.map((inv) => (
            <tr key={inv.id} className="hover:bg-gray-50">
              <td className="px-4 py-4 whitespace-nowrap">
                <div className="font-medium text-gray-900">{inv.name}</div>
              </td>
              <td className="px-4 py-4">
                <div className="flex items-center text-gray-600 text-sm">
                  <Mail className="w-4 h-4 mr-2 flex-shrink-0" />
                  <span className="break-all">{inv.email}</span>
                </div>
              </td>
              <td className="px-4 py-4 whitespace-nowrap">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  inv.role === 'manager' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                }`}>
                  {inv.role === 'manager' ? 'Manager' : 'Vendeur'}
                </span>
              </td>
              <td className="px-4 py-4 whitespace-nowrap">
                <div className="flex items-center text-gray-600 text-sm">
                  <Building2 className="w-4 h-4 mr-2" />
                  {inv.store_name || getStoreName(inv.store_id)}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                {inv.status === 'pending' && (
                  <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs flex items-center gap-1 w-fit" title="En attente">
                    <Clock className="w-3 h-3" />
                  </span>
                )}
                {inv.status === 'accepted' && (
                  <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs flex items-center gap-1 w-fit" title="Acceptée">
                    <CheckCircle className="w-3 h-3" />
                  </span>
                )}
                {inv.status === 'expired' && (
                  <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs flex items-center gap-1 w-fit" title="Expirée">
                    <Clock className="w-3 h-3" />
                  </span>
                )}
                {inv.status === 'cancelled' && (
                  <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs flex items-center gap-1 w-fit" title="Annulée">
                    <X className="w-3 h-3" />
                  </span>
                )}
              </td>
              <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                {inv.created_at ? new Date(inv.created_at).toLocaleDateString('fr-FR', {
                  day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                }) : 'N/A'}
              </td>
              <td className="px-4 py-4 whitespace-nowrap text-right">
                <div className="flex items-center justify-end gap-2">
                  {inv.status === 'pending' && (
                    <>
                      <button
                        onClick={() => onResend(inv.id)}
                        disabled={resendingInvitation === inv.id}
                        className="group flex items-center gap-1 p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
                        title="Renvoyer l'invitation"
                      >
                        {resendingInvitation === inv.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                        <span className="hidden group-hover:inline max-w-0 group-hover:max-w-[100px] overflow-hidden transition-all duration-200">Renvoyer</span>
                      </button>
                      <button
                        onClick={() => onCancel(inv.id)}
                        className="group flex items-center gap-1 p-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-sm font-medium transition-all"
                        title="Annuler l'invitation"
                      >
                        <X className="w-4 h-4" />
                        <span className="hidden group-hover:inline max-w-0 group-hover:max-w-[100px] overflow-hidden transition-all duration-200">Annuler</span>
                      </button>
                    </>
                  )}
                  {inv.status === 'expired' && (
                    <button
                      onClick={() => onResend(inv.id)}
                      disabled={resendingInvitation === inv.id}
                      className="group flex items-center gap-1 p-2 bg-orange-50 text-orange-600 hover:bg-orange-100 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
                      title="Réinviter"
                    >
                      {resendingInvitation === inv.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                      <span className="hidden group-hover:inline max-w-0 group-hover:max-w-[100px] overflow-hidden transition-all duration-200">Réinviter</span>
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {invitations.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <Clock className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p>Aucune invitation trouvée</p>
          <button onClick={onOpenInviteModal} className="mt-4 text-blue-600 hover:underline">
            Inviter du personnel
          </button>
        </div>
      )}
    </div>
  );
}
