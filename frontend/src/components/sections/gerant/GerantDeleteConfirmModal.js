import React from 'react';
import { Loader2, Trash2 } from 'lucide-react';

export default function GerantDeleteConfirmModal({ deleteConfirm, deleting, onConfirm, onCancel }) {
  if (!deleteConfirm) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-2">
          Supprimer {deleteConfirm.length > 1 ? `ces ${deleteConfirm.length} magasins` : 'ce magasin'} ?
        </h3>
        <p className="text-sm text-gray-500 mb-6">
          Cette action est irréversible. Les managers et vendeurs associés ne seront pas supprimés.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 border border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors text-sm"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="flex-1 py-2.5 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 transition-colors text-sm disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Supprimer
          </button>
        </div>
      </div>
    </div>
  );
}
