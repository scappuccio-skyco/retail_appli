import React, { useState } from 'react';
import { X, RefreshCw, AlertTriangle } from 'lucide-react';

const ManagerTransferModal = ({ manager, stores, currentStoreId, onClose, onTransfer }) => {
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleTransfer = async () => {
    if (!selectedStoreId) {
      setError('Veuillez sélectionner un magasin');
      return;
    }

    setError('');
    setLoading(true);

    try {
      await onTransfer(manager.id, selectedStoreId);
      onClose();
    } catch (err) {
      setError(err.message || 'Erreur lors du transfert');
    } finally {
      setLoading(false);
    }
  };

  const currentStore = stores.find(s => s.id === currentStoreId);
  const targetStore = stores.find(s => s.id === selectedStoreId);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 rounded-t-2xl relative flex-shrink-0">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white hover:text-gray-200 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
              <RefreshCw className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Transférer un Manager</h2>
              <p className="text-white opacity-90 text-sm">Changer {manager.name} de magasin</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 min-h-0">
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Manager Info */}
          <div className="bg-blue-50 rounded-lg p-4 mb-4 border border-blue-200">
            <p className="text-sm text-gray-600 mb-1">Manager à transférer</p>
            <p className="font-bold text-gray-800 text-lg">{manager.name}</p>
            <p className="text-sm text-gray-600">{manager.email}</p>
          </div>

          {/* Store Transfer */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                De (Magasin Actuel)
              </label>
              <div className="p-3 bg-gray-100 rounded-lg border border-gray-300">
                <p className="font-semibold text-gray-800">📍 {currentStore?.name || 'Magasin actuel'}</p>
                <p className="text-sm text-gray-600">{currentStore?.location}</p>
              </div>
            </div>

            <div className="flex justify-center">
              <div className="text-3xl">↓</div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Vers (Nouveau Magasin) *
              </label>
              <select
                value={selectedStoreId}
                onChange={(e) => setSelectedStoreId(e.target.value)}
                className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none"
              >
                <option value="">Sélectionner un magasin...</option>
                {stores
                  .filter(store => store.id !== currentStoreId && store.active)
                  .map(store => (
                    <option key={store.id} value={store.id}>
                      📍 {store.name} - {store.location}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* Warning */}
          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-300 rounded-lg flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-yellow-800 mb-1">⚠️ Important</p>
              <p className="text-yellow-700">
                Les vendeurs de ce manager resteront dans le magasin actuel. 
                Vous devrez les réassigner à un autre manager si nécessaire.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-6 bg-gray-50 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-6 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all font-semibold"
          >
            Annuler
          </button>
          <button
            onClick={handleTransfer}
            disabled={loading || !selectedStoreId}
            className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>Transfert en cours...</>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                Confirmer le Transfert
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ManagerTransferModal;
