import React from 'react';
import { MessageSquare, X } from 'lucide-react';

export default function LastDebriefModal({ debrief, onClose }) {
  if (!debrief) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl my-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-blue-400 p-6 rounded-t-2xl relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white hover:text-gray-200 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-3">
            <MessageSquare className="w-8 h-8 text-white" />
            <h2 className="text-2xl font-bold text-white">💬 Mon Dernier Débrief IA</h2>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Date et contexte */}
          <div className="mb-6">
            <p className="text-sm text-gray-500 mb-2">
              🗓️ {new Date(debrief.created_at).toLocaleDateString('fr-FR', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </p>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-600 mb-1">Produit/Service</p>
                <p className="font-medium text-gray-800">{debrief.produit || debrief.context}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-600 mb-1">Type de client</p>
                <p className="font-medium text-gray-800">{debrief.type_client || debrief.customer_profile}</p>
              </div>
            </div>
          </div>

          {/* Description de la vente */}
          <div className="bg-blue-50 rounded-xl p-4 mb-4">
            <p className="text-sm font-semibold text-blue-900 mb-2">💬 Description de la vente :</p>
            <p className="text-blue-800">{debrief.description_vente || debrief.demarche_commerciale}</p>
          </div>

          {/* Moment clé et raisons */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-orange-50 rounded-xl p-4">
              <p className="text-sm font-semibold text-orange-900 mb-2">📍 Moment clé :</p>
              <p className="text-orange-800">{debrief.moment_perte_client}</p>
            </div>
            <div className="bg-red-50 rounded-xl p-4">
              <p className="text-sm font-semibold text-red-900 mb-2">❌ Raisons :</p>
              <p className="text-red-800">{debrief.raisons_echec || debrief.objections}</p>
            </div>
          </div>

          {/* Analyse IA */}
          {debrief.ai_recommendation && (
            <div className="bg-green-50 rounded-xl p-5 mb-6">
              <p className="text-sm font-semibold text-green-900 mb-3">💡 Recommandation IA :</p>
              <p className="text-green-800 whitespace-pre-line">{debrief.ai_recommendation}</p>
            </div>
          )}

          {/* Scores des compétences */}
          <div className="bg-gray-50 rounded-xl p-5">
            <p className="text-sm font-semibold text-gray-900 mb-4">📊 Scores des compétences :</p>
            <div className="grid grid-cols-5 gap-3">
              <div className="bg-purple-100 rounded-lg p-3 text-center">
                <p className="text-xs text-purple-700 mb-1">Accueil</p>
                <p className="text-2xl font-bold text-purple-900">{debrief.score_accueil || 0}/5</p>
              </div>
              <div className="bg-green-100 rounded-lg p-3 text-center">
                <p className="text-xs text-green-700 mb-1">Découverte</p>
                <p className="text-2xl font-bold text-green-900">{debrief.score_decouverte || 0}/5</p>
              </div>
              <div className="bg-orange-100 rounded-lg p-3 text-center">
                <p className="text-xs text-orange-700 mb-1">Argumentation</p>
                <p className="text-2xl font-bold text-orange-900">{debrief.score_argumentation || 0}/5</p>
              </div>
              <div className="bg-red-100 rounded-lg p-3 text-center">
                <p className="text-xs text-red-700 mb-1">Closing</p>
                <p className="text-2xl font-bold text-red-900">{debrief.score_closing || 0}/5</p>
              </div>
              <div className="bg-blue-100 rounded-lg p-3 text-center">
                <p className="text-xs text-blue-700 mb-1">Fidélisation</p>
                <p className="text-2xl font-bold text-blue-900">{debrief.score_fidelisation || 0}/5</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
