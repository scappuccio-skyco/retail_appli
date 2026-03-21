import React, { useState } from 'react';
import { X } from 'lucide-react';
import { toast } from 'sonner';

export default function TransferModal({ user, stores, managers, onTransfer, onClose }) {
  const [selectedStore, setSelectedStore] = useState('');
  const [selectedManager, setSelectedManager] = useState('');

  const availableManagers = managers.filter(m => m.store_id === selectedStore && m.status === 'active');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (user.role === 'seller' && !selectedManager) {
      toast.error('Veuillez sélectionner un manager');
      return;
    }
    onTransfer(selectedStore, selectedManager);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-6 border-b">
          <h3 className="text-lg font-semibold">Transférer {user.name}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Nouveau magasin *</label>
            <select
              required
              value={selectedStore}
              onChange={(e) => { setSelectedStore(e.target.value); setSelectedManager(''); }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
            >
              <option value="">Sélectionner un magasin</option>
              {stores.filter(s => s.id !== user.store_id).map(store => (
                <option key={store.id} value={store.id}>{store.name}</option>
              ))}
            </select>
          </div>

          {user.role === 'seller' && selectedStore && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Nouveau manager *</label>
              <select
                required
                value={selectedManager}
                onChange={(e) => setSelectedManager(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                <option value="">Sélectionner un manager</option>
                {availableManagers.map(manager => (
                  <option key={manager.id} value={manager.id}>{manager.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
              Annuler
            </button>
            <button type="submit" className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
              Transférer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
