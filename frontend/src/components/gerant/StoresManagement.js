import React from 'react';
import { Building2, Plus, Loader2, Store } from 'lucide-react';
import useStoresManagement from './storesManagement/useStoresManagement';
import StoreCard from './storesManagement/StoreCard';

export default function StoresManagement({ onRefresh, onOpenCreateStoreModal, isReadOnly }) {
  const {
    stores, loading, editingStore, editForm, saving,
    handleEdit, handleCancel, handleSave, handleInputChange,
  } = useStoresManagement({ isReadOnly, onRefresh });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
        <span className="ml-3 text-gray-600">Chargement des magasins...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Store className="w-6 h-6 text-orange-600" />
            Mes Magasins
          </h2>
          <p className="text-gray-600 mt-1">
            Gérez les informations de vos {stores.length} magasin{stores.length > 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={onOpenCreateStoreModal}
          disabled={isReadOnly}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all ${
            isReadOnly
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:shadow-lg'
          }`}
        >
          <Plus className="w-5 h-5" />
          Ajouter un magasin
        </button>
      </div>

      {/* Liste */}
      {stores.length === 0 ? (
        <div className="bg-gray-50 rounded-xl p-8 text-center">
          <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Aucun magasin</h3>
          <p className="text-gray-500 mb-4">Commencez par créer votre premier magasin</p>
          <button onClick={onOpenCreateStoreModal} disabled={isReadOnly} className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors">
            Créer un magasin
          </button>
        </div>
      ) : (
        <div className="grid gap-6">
          {stores.map((store, index) => (
            <StoreCard
              key={store.id}
              store={store}
              colorIndex={index}
              isEditing={editingStore === store.id}
              editForm={editForm}
              saving={saving}
              isReadOnly={isReadOnly}
              onEdit={handleEdit}
              onSave={handleSave}
              onCancel={handleCancel}
              onInputChange={handleInputChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}
