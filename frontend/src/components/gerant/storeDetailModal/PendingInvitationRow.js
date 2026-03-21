import React from 'react';

export default function PendingInvitationRow({ invitation, role, onCancel }) {
  const isManager = role === 'manager';
  return (
    <div className="flex items-center justify-between p-4 bg-orange-50 rounded-lg border border-orange-200">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-gray-800">
            {isManager ? 'Manager en attente' : 'Vendeur en attente'}
          </p>
          <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs font-semibold rounded-full">
            📨 Invitation envoyée
          </span>
        </div>
        <p className="text-sm text-gray-600">{invitation.email}</p>
        {!isManager && invitation.manager_name && (
          <p className="text-xs text-gray-500 mt-1">Manager assigné : {invitation.manager_name}</p>
        )}
        <p className="text-xs text-gray-500 mt-1">
          Envoyée le {new Date(invitation.created_at).toLocaleDateString('fr-FR')}
        </p>
      </div>
      <button
        onClick={() => onCancel(invitation.id)}
        className="ml-4 px-3 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
        title="Annuler l'invitation"
      >
        ✕ Annuler
      </button>
    </div>
  );
}
