import React, { useState } from 'react';
import { Sparkles, X, RefreshCw, BookOpen } from 'lucide-react';
import GuideProfilsModal from './GuideProfilsModal';

export default function ManagerProfileModal({ diagnostic, onClose, onRedo }) {
  const [showGuide, setShowGuide] = useState(false);
  
  if (!diagnostic) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[85vh] overflow-y-auto">
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
              
              <div className="bg-green-50 rounded-xl p-5 mb-6">
                <p className="text-sm font-semibold text-green-900 mb-2">💡 Exemple concret :</p>
                <p className="text-green-800 italic">"{diagnostic.exemple_concret}"</p>
              </div>

              {/* DISC Profile Section */}
              {diagnostic.disc_dominant && (
                <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-5 border-2 border-purple-200">
                  <p className="text-sm font-semibold text-purple-900 mb-4">🎭 Profil DISC :</p>
                  <div className="mb-4">
                    <p className="text-lg font-bold text-purple-800 mb-2">
                      Type dominant : <span className="text-2xl text-indigo-700">{diagnostic.disc_dominant}</span>
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-white rounded-lg p-3 text-center shadow-sm">
                      <p className="text-xs text-gray-600 mb-1">Dominant</p>
                      <p className="text-2xl font-bold text-red-600">{diagnostic.disc_percentages?.D || 0}%</p>
                    </div>
                    <div className="bg-white rounded-lg p-3 text-center shadow-sm">
                      <p className="text-xs text-gray-600 mb-1">Influent</p>
                      <p className="text-2xl font-bold text-yellow-600">{diagnostic.disc_percentages?.I || 0}%</p>
                    </div>
                    <div className="bg-white rounded-lg p-3 text-center shadow-sm">
                      <p className="text-xs text-gray-600 mb-1">Stable</p>
                      <p className="text-2xl font-bold text-green-600">{diagnostic.disc_percentages?.S || 0}%</p>
                    </div>
                    <div className="bg-white rounded-lg p-3 text-center shadow-sm">
                      <p className="text-xs text-gray-600 mb-1">Consciencieux</p>
                      <p className="text-2xl font-bold text-blue-600">{diagnostic.disc_percentages?.C || 0}%</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Guide des Profils Button */}
            <div className="mt-6 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-4 border-2 border-blue-200">
              <p className="text-sm text-gray-700 mb-3 text-center">
                💡 Envie de mieux comprendre les différents styles de management et de vente ?
              </p>
              <button
                onClick={() => setShowGuide(true)}
                className="w-full btn-primary bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:shadow-xl flex items-center justify-center gap-2 py-3"
              >
                <BookOpen className="w-5 h-5" />
                📚 Consulter le Guide des Profils
              </button>
            </div>

            {/* Button to redo test */}
            <div className="mt-6 text-center">
              <button
                onClick={onRedo}
                className="btn-secondary px-6 py-3 flex items-center justify-center gap-2 mx-auto"
              >
                <RefreshCw className="w-5 h-5" />
                Refaire le test
              </button>
              <p className="text-xs text-gray-500 mt-2">
                Votre profil peut évoluer avec le temps
              </p>
            </div>
          </div>
        </div>
      </div>

      {showGuide && (
        <GuideProfilsModal onClose={() => setShowGuide(false)} userRole="manager" />
      )}
    </>
  );
}
