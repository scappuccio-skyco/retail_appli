import React, { useState } from 'react';
import { X, Store, Save, Loader } from 'lucide-react';
import { api } from '../../lib/apiClient';
import { toast } from 'sonner';
import { logger } from '../../utils/logger';

export default function ManagerStoresModal({ isOpen, onClose, manager, stores, onUpdate }) {
  const [selectedIds, setSelectedIds] = useState(
    () => new Set(manager?.store_ids?.length ? manager.store_ids : manager?.store_id ? [manager.store_id] : [])
  );
  const [loading, setLoading] = useState(false);

  // Sync si le manager change
  React.useEffect(() => {
    if (manager) {
      setSelectedIds(new Set(manager.store_ids?.length ? manager.store_ids : manager.store_id ? [manager.store_id] : []));
    }
  }, [manager]);

  if (!isOpen || !manager) return null;

  const toggle = (storeId) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(storeId) ? next.delete(storeId) : next.add(storeId);
      return next;
    });
  };

  const handleSave = async () => {
    if (selectedIds.size === 0) {
      toast.error('Le manager doit être assigné à au moins un magasin.');
      return;
    }
    setLoading(true);
    try {
      await api.patch(`/gerant/managers/${manager.id}/stores`, { store_ids: [...selectedIds] });
      toast.success('Magasins mis à jour avec succès');
      onUpdate();
      onClose();
    } catch (err) {
      logger.error('Error updating manager stores:', err);
      toast.error(err.response?.data?.detail || 'Erreur lors de la mise à jour');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-[#1E40AF] flex items-center gap-2">
              <Store className="w-5 h-5" /> Magasins assignés
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">{manager.name}</p>
          </div>
          <button onClick={onClose} disabled={loading} className="text-gray-500 hover:text-gray-700 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          {stores.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-4">Aucun magasin disponible.</p>
          ) : (
            <div className="space-y-2">
              {stores.map(store => (
                <label
                  key={store.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedIds.has(store.id)
                      ? 'border-indigo-400 bg-indigo-50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(store.id)}
                    onChange={() => toggle(store.id)}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm font-medium text-gray-800">{store.name}</span>
                </label>
              ))}
            </div>
          )}

          {selectedIds.size === 0 && (
            <p className="mt-3 text-xs text-red-500">Sélectionnez au moins un magasin.</p>
          )}
        </div>

        <div className="flex justify-end gap-3 px-6 pb-6">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-5 py-2.5 rounded-lg text-gray-700 border border-gray-300 hover:bg-gray-50 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={loading || selectedIds.size === 0}
            className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-[#1E40AF] to-[#1E3A8A] text-white font-semibold hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {loading ? <><Loader className="w-4 h-4 animate-spin" /> Enregistrement...</> : <><Save className="w-4 h-4" /> Enregistrer</>}
          </button>
        </div>
      </div>
    </div>
  );
}
