import React from 'react';
import { Sparkles } from 'lucide-react';

export default function MonManagerSection({ advice, isLoading }) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 gap-3 text-gray-500">
        <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
        Chargement des conseils...
      </div>
    );
  }

  if (!advice) {
    return (
      <div className="text-center py-16 text-gray-500">
        <Sparkles className="w-10 h-10 mx-auto mb-3 text-gray-300" />
        <p className="font-medium text-gray-600">Pas encore de conseils disponibles</p>
        <p className="text-sm mt-1">Ton manager doit générer une analyse de compatibilité pour toi.</p>
      </div>
    );
  }

  const dataUsed = advice.data_used || {};

  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-4 border border-indigo-200">
        <h3 className="font-bold text-indigo-900 flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-purple-600" />
          Conseils personnalisés de ton manager
        </h3>
        {dataUsed.manager_style && (
          <div className="flex flex-wrap gap-2 mb-1">
            {dataUsed.manager_style && (
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-medium">
                Style manager : {dataUsed.manager_style}
              </span>
            )}
            {dataUsed.disc && (
              <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded-full font-medium">
                DISC : {dataUsed.disc}
              </span>
            )}
            {dataUsed.seller_style && (
              <span className="text-xs bg-cyan-100 text-cyan-800 px-2 py-1 rounded-full font-medium">
                Ton style : {dataUsed.seller_style}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-purple-50 rounded-xl p-4 border border-purple-100">
          <h4 className="font-semibold text-purple-800 mb-3 text-sm flex items-center gap-2">
            👔 Ce que ton manager adapte pour toi
          </h4>
          <ul className="space-y-2">
            {(advice.manager || []).map((item, idx) => (
              <li key={idx} className="flex items-start gap-2 text-xs text-purple-900">
                <span className="text-purple-400 mt-0.5 shrink-0">▸</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
          <h4 className="font-semibold text-blue-800 mb-3 text-sm flex items-center gap-2">
            👤 Conseils pour toi
          </h4>
          <ul className="space-y-2">
            {(advice.seller || []).map((item, idx) => (
              <li key={idx} className="flex items-start gap-2 text-xs text-blue-900">
                <span className="text-blue-400 mt-0.5 shrink-0">▸</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
