import React from 'react';
import { RefreshCw, Pause, Trash2 } from 'lucide-react';

export default function TeamMemberRow({ member, role, managers, isReadOnly, onTransfer, onToggleSuspend, onDelete, refreshKey }) {
  const isManager = role === 'manager';
  const bgClass = isManager ? 'bg-blue-50 border-blue-200' : 'bg-purple-50 border-purple-200';
  const transferClass = isManager
    ? 'border-blue-500 text-blue-600 hover:bg-blue-50'
    : 'border-purple-500 text-purple-600 hover:bg-purple-50';

  return (
    <div
      key={`${member.id}-${refreshKey}`}
      className={`flex items-center justify-between p-4 rounded-lg border ${bgClass}`}
    >
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-gray-800">{member.name}</p>
          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
            member.status === 'suspended'
              ? 'bg-orange-100 text-orange-700'
              : 'bg-green-100 text-green-700'
          }`}>
            {member.status === 'suspended' ? '⏸ En veille' : '✓ Actif'}
          </span>
        </div>
        <p className="text-sm text-gray-600">{member.email}</p>
        {!isManager && member.manager_id && (
          <p className="text-xs text-gray-500 mt-1">
            Manager : {managers.find(m => m.id === member.manager_id)?.name || 'N/A'}
          </p>
        )}
      </div>

      {!isReadOnly && (
        <div className="flex gap-2">
          <button
            onClick={() => onTransfer(member)}
            className={`flex items-center gap-2 px-3 py-2 bg-white border-2 rounded-lg transition-all text-sm font-semibold ${transferClass}`}
          >
            <RefreshCw className="w-4 h-4" />
            Transférer
          </button>

          {member.status === 'suspended' ? (
            <button
              onClick={() => onToggleSuspend(member.id, role, member.name, 'reactivate')}
              className="flex items-center gap-2 px-3 py-2 bg-white border-2 border-green-500 text-green-600 rounded-lg hover:bg-green-50 transition-all text-sm font-semibold"
              title={`Réactiver ${isManager ? 'le manager' : 'le vendeur'}`}
            >
              <RefreshCw className="w-4 h-4" />
              Réactiver
            </button>
          ) : (
            <button
              onClick={() => onToggleSuspend(member.id, role, member.name, 'suspend')}
              className="flex items-center gap-2 px-3 py-2 bg-white border-2 border-orange-500 text-orange-600 rounded-lg hover:bg-orange-50 transition-all text-sm font-semibold"
              title={`Suspendre ${isManager ? 'le manager' : 'le vendeur'}`}
            >
              <Pause className="w-4 h-4" />
              Suspendre
            </button>
          )}

          <button
            onClick={() => onDelete(member.id, role, member.name)}
            className="flex items-center gap-2 px-3 py-2 bg-white border-2 border-red-500 text-red-600 rounded-lg hover:bg-red-50 transition-all text-sm font-semibold"
            title={`Supprimer ${isManager ? 'le manager' : 'le vendeur'}`}
          >
            <Trash2 className="w-4 h-4" />
            Supprimer
          </button>
        </div>
      )}
    </div>
  );
}
