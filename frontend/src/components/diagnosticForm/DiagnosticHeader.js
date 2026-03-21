import React from 'react';
import { X, Sparkles } from 'lucide-react';

export default function DiagnosticHeader({ isModal, onClose }) {
  return (
    <div className="bg-gradient-to-r from-[#1E40AF] to-[#1E3A8A] p-6 rounded-t-2xl relative">
      {isModal && onClose && (
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white hover:text-gray-200 transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
      )}
      <div className="flex items-center gap-3 mb-2">
        <Sparkles className="w-8 h-8 text-white" />
        <h2 className="text-2xl font-bold text-white">Identifier mon profil vendeur</h2>
      </div>
      <p className="text-white opacity-90">
        Découvre ton style de vente et ton profil DISC pour recevoir un coaching personnalisé.
      </p>
    </div>
  );
}
