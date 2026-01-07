import React, { useState, useEffect } from 'react';
import { X, RefreshCw, Users } from 'lucide-react';
import { API_BASE } from '../../lib/api';

const SellerTransferModal = ({ seller, stores, currentStoreId, onClose, onTransfer }) => {
  const [transferMode, setTransferMode] = useState('same_store'); // 'same_store' or 'new_store'
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [selectedManagerId, setSelectedManagerId] = useState('');
  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingManagers, setLoadingManagers] = useState(false);
  const [error, setError] = useState('');
  const backendUrl = API_BASE;

  useEffect(() => {
    // If same store mode, load managers from current store immediately
    if (transferMode === 'same_store' && currentStoreId) {
      fetchManagers(currentStoreId);
    } else if (transferMode === 'new_store' && selectedStoreId) {
      fetchManagers(selectedStoreId);
    } else {
      setManagers([]);
      setSelectedManagerId('');
      setSelectedStoreId('');
    }
  }, [transferMode, selectedStoreId, currentStoreId]);

  const fetchManagers = async (storeId) => {
    setLoadingManagers(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${backendUrl}/api/gerant/stores/${storeId}/managers`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setManagers(data);
      }
    } catch (err) {
      console.error('Erreur chargement managers:', err);
    } finally {
      setLoadingManagers(false);
    }
  };

  const handleTransfer = async () => {
    // Determine the store ID to use
    const targetStoreId = transferMode === 'same_store' ? currentStoreId : selectedStoreId;
    
    if (!targetStoreId) {
      setError('Magasin non trouvé');
      return;
    }

    if (!selectedManagerId) {
      const modeText = transferMode === 'same_store' ? 'le magasin actuel' : 'le nouveau magasin';
      setError(`Veuillez sélectionner un manager dans ${modeText}`);
      return;
    }

    setError('');
    setLoading(true);

    try {
      await onTransfer(seller.id, targetStoreId, selectedManagerId);
      onClose();
    } catch (err) {
      setError(err.message || 'Erreur lors du transfert');
    } finally {
      setLoading(false);
    }
  };

  const currentStore = stores.find(s => s.id === currentStoreId);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6 rounded-t-2xl relative">
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
              <h2 className="text-2xl font-bold text-white">Changer le Manager d'un Vendeur</h2>
              <p className="text-white opacity-90 text-sm">Attribuer un autre manager à {seller.name}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Seller Info */}
          <div className="bg-purple-50 rounded-lg p-4 mb-4 border border-purple-200">
            <p className="text-sm text-gray-600 mb-1">Vendeur à transférer</p>
            <p className="font-bold text-gray-800 text-lg">{seller.name}</p>
            <p className="text-sm text-gray-600">{seller.email}</p>
          </div>

          {/* Mode Selection */}
          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Type de changement
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setTransferMode('same_store')}
                className={`flex-1 p-3 rounded-lg border-2 transition-all font-semibold ${
                  transferMode === 'same_store'
                    ? 'border-purple-500 bg-purple-50 text-purple-700'
                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                📍 Même magasin
              </button>
              <button
                type="button"
                onClick={() => setTransferMode('new_store')}
                className={`flex-1 p-3 rounded-lg border-2 transition-all font-semibold ${
                  transferMode === 'new_store'
                    ? 'border-purple-500 bg-purple-50 text-purple-700'
                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                🔄 Nouveau magasin
              </button>
            </div>
          </div>

          {/* Store Info */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Magasin actuel
              </label>
              <div className="p-3 bg-gray-100 rounded-lg border border-gray-300">
                <p className="font-semibold text-gray-800">📍 {currentStore?.name || 'Magasin actuel'}</p>
                <p className="text-sm text-gray-600">{currentStore?.location}</p>
              </div>
            </div>

            {/* New Store Selection (only if new_store mode) */}
            {transferMode === 'new_store' && (
              <>
                <div className="flex justify-center">
                  <div className="text-3xl">↓</div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Nouveau Magasin *
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
              </>
            )}

            {/* Manager Selection */}
            {(transferMode === 'same_store' || selectedStoreId) && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {transferMode === 'same_store' ? 'Nouveau Manager dans le même magasin *' : 'Nouveau Manager *'}
                </label>
                
                {loadingManagers ? (
                  <div className="p-4 border-2 border-gray-300 rounded-lg text-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600 mx-auto mb-2"></div>
                    <p className="text-sm text-gray-600">Chargement des managers...</p>
                  </div>
                ) : managers.length === 0 ? (
                  <div className="p-4 bg-yellow-50 border-2 border-yellow-300 rounded-lg">
                    <p className="text-sm text-yellow-800 font-semibold">
                      ⚠️ Aucun manager dans ce magasin
                    </p>
                    <p className="text-xs text-yellow-700 mt-1">
                      Vous devez d'abord assigner un manager à ce magasin
                    </p>
                  </div>
                ) : (
                  <select
                    value={selectedManagerId}
                    onChange={(e) => setSelectedManagerId(e.target.value)}
                    className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none"
                  >
                    <option value="">Sélectionner un manager...</option>
                    {managers.map(manager => (
                      <option key={manager.id} value={manager.id}>
                        👤 {manager.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </div>

          {/* Info */}
          {selectedManagerId && (
            <div className="mt-4 p-4 bg-green-50 border border-green-300 rounded-lg">
              <p className="text-sm text-green-800">
                {transferMode === 'same_store' 
                  ? '✅ Le manager sera changé, le vendeur reste dans le même magasin'
                  : '✅ Le vendeur sera transféré avec ses KPIs historiques conservés'}
              </p>
            </div>
          )}
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
            disabled={loading || (transferMode === 'new_store' && !selectedStoreId) || !selectedManagerId}
            className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:shadow-lg transition-all font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>Modification en cours...</>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                {transferMode === 'same_store' ? 'Changer le Manager' : 'Confirmer le Transfert'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SellerTransferModal;
