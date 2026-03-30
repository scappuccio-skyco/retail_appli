import React, { useState } from 'react';
import { Building2, ArrowRight, LogOut } from 'lucide-react';
import Logo from '../../shared/Logo';

/**
 * Full-screen store selector for multi-store managers.
 * Shown on first login and when clicking "Changer de magasin" in the header.
 */
export default function StoreSelectionScreen({ user, storeOptions, onSelectStore, onLogout, isSwitch = false }) {
  const [selected, setSelected] = useState(null);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <Logo variant="header" size="md" showByline={false} />
          <h1 className="mt-6 text-2xl font-bold text-gray-900">
            {isSwitch ? 'Changer de magasin' : `Bonjour, ${user?.name}`}
          </h1>
          <p className="mt-2 text-gray-600">
            {isSwitch
              ? 'Sélectionnez le magasin pour lequel vous souhaitez travailler.'
              : 'Dans quel magasin travaillez-vous aujourd\'hui ?'}
          </p>
        </div>

        <div className="space-y-3">
          {storeOptions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1E40AF] mx-auto mb-3" />
              Chargement des magasins...
            </div>
          ) : (
            storeOptions.map(store => (
              <button
                key={store.id}
                onClick={() => setSelected(store.id)}
                className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                  selected === store.id
                    ? 'border-[#1E40AF] bg-blue-50'
                    : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${selected === store.id ? 'bg-[#1E40AF]' : 'bg-gray-100'}`}>
                    <Building2 className={`w-5 h-5 ${selected === store.id ? 'text-white' : 'text-gray-500'}`} />
                  </div>
                  <span className={`font-medium ${selected === store.id ? 'text-[#1E40AF]' : 'text-gray-700'}`}>
                    {store.name}
                  </span>
                </div>
                {selected === store.id && (
                  <div className="w-5 h-5 rounded-full bg-[#1E40AF] flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </button>
            ))
          )}
        </div>

        <button
          onClick={() => selected && onSelectStore(selected)}
          disabled={!selected || storeOptions.length === 0}
          className="mt-6 w-full flex items-center justify-center gap-2 py-3 px-6 bg-gradient-to-r from-[#1E40AF] to-[#1E3A8A] text-white font-semibold rounded-xl disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-lg transition-all"
        >
          {isSwitch ? 'Changer de magasin' : 'Accéder au dashboard'}
          <ArrowRight className="w-5 h-5" />
        </button>

        <button
          onClick={onLogout}
          className="mt-3 w-full flex items-center justify-center gap-2 py-2 text-gray-500 hover:text-gray-700 text-sm transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Se déconnecter
        </button>
      </div>
    </div>
  );
}
