import React from 'react';
import { Sparkles, X } from 'lucide-react';

export default function ManagerProfileModal({ diagnostic, onClose }) {
  if (!diagnostic) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#ffd871] to-yellow-300 p-6 rounded-t-2xl relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-700 hover:text-gray-900 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-gray-800" />
            <h2 className="text-2xl font-bold text-gray-800">🎯 Ton Profil Manager</h2>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="bg-white rounded-xl">
            <h3 className="text-2xl font-bold text-gray-800 mb-3">
              🧭 {diagnostic.profil_nom}
            </h3>
            <p className="text-gray-700 mb-6 text-lg">{diagnostic.profil_description}</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="bg-green-50 rounded-xl p-5">
                <p className="text-sm font-semibold text-green-700 mb-3">💪 Tes Forces :</p>
                <ul className="list-disc list-inside space-y-2 text-green-800">
                  <li>{diagnostic.force_1}</li>
                  <li>{diagnostic.force_2}</li>
                </ul>
              </div>
              <div className="bg-orange-50 rounded-xl p-5">
                <p className="text-sm font-semibold text-orange-700 mb-3">🎯 Axe à travailler :</p>
                <p className="text-orange-800">{diagnostic.axe_progression}</p>
              </div>
            </div>
            
            <div className="bg-blue-50 rounded-xl p-5 mb-4">
              <p className="text-sm font-semibold text-blue-900 mb-2">🚀 Recommandation :</p>
              <p className="text-blue-800">{diagnostic.recommandation}</p>
            </div>
            
            <div className="bg-green-50 rounded-xl p-5">
              <p className="text-sm font-semibold text-green-900 mb-2">💡 Exemple concret :</p>
              <p className="text-green-800 italic">"{diagnostic.exemple_concret}"</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
