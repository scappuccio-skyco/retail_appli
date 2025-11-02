import React, { useState } from 'react';
import { Sparkles, X, RefreshCw, BookOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import GuideProfilsModal from './GuideProfilsModal';

export default function SellerProfileModal({ diagnostic, onClose }) {
  const navigate = useNavigate();
  const [showGuide, setShowGuide] = useState(false);
  
  if (!diagnostic) return null;

  const handleRedo = () => {
    onClose();
    navigate('/diagnostic');
  };

  return (
    <>
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
            <h2 className="text-2xl font-bold text-gray-800">🎯 Mon Profil de Vente</h2>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="bg-white rounded-xl">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-purple-50 rounded-xl p-4">
                <p className="text-sm text-purple-600 mb-2">🎨 Style de vente</p>
                <p className="text-xl font-bold text-purple-900">{diagnostic.style}</p>
              </div>
              <div className="bg-green-50 rounded-xl p-4">
                <p className="text-sm text-green-600 mb-2">🎯 Niveau</p>
                <p className="text-xl font-bold text-green-900">{diagnostic.level}</p>
              </div>
              <div className="bg-orange-50 rounded-xl p-4">
                <p className="text-sm text-orange-600 mb-2">⚡ Motivation</p>
                <p className="text-xl font-bold text-orange-900">{diagnostic.motivation}</p>
              </div>
            </div>
            
            {diagnostic.ai_profile_summary && (
              <div className="bg-blue-50 rounded-xl p-5 mb-4">
                <p className="text-sm font-semibold text-blue-900 mb-2">💡 Analyse IA de ton profil :</p>
                <p className="text-blue-800 whitespace-pre-line">{diagnostic.ai_profile_summary}</p>
              </div>
            )}

            {/* Compétences */}
            <div className="bg-gray-50 rounded-xl p-5">
              <p className="text-sm font-semibold text-gray-900 mb-4">📊 Tes compétences :</p>
              <div className="grid grid-cols-5 gap-3">
                <div className="text-center">
                  <p className="text-xs text-gray-600 mb-1">Accueil</p>
                  <p className="text-2xl font-bold text-gray-800">{diagnostic.score_accueil || 0}/5</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-600 mb-1">Découverte</p>
                  <p className="text-2xl font-bold text-gray-800">{diagnostic.score_decouverte || 0}/5</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-600 mb-1">Argumentation</p>
                  <p className="text-2xl font-bold text-gray-800">{diagnostic.score_argumentation || 0}/5</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-600 mb-1">Closing</p>
                  <p className="text-2xl font-bold text-gray-800">{diagnostic.score_closing || 0}/5</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-600 mb-1">Fidélisation</p>
                  <p className="text-2xl font-bold text-gray-800">{diagnostic.score_fidelisation || 0}/5</p>
                </div>
              </div>
            </div>
          </div>

          {/* Guide des Profils Button */}
          <div className="mt-6 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-4 border-2 border-blue-200">
            <p className="text-sm text-gray-700 mb-3 text-center">
              💡 Envie de mieux comprendre les différents profils de vente ?
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
              onClick={handleRedo}
              className="btn-secondary px-6 py-3 flex items-center justify-center gap-2 mx-auto"
            >
              <RefreshCw className="w-5 h-5" />
              Refaire mon diagnostic
            </button>
            <p className="text-xs text-gray-500 mt-2">
              Ton profil peut évoluer avec le temps
            </p>
          </div>
        </div>
      </div>

      {showGuide && (
        <GuideProfilsModal onClose={() => setShowGuide(false)} />
      )}
    </>
  );
}
