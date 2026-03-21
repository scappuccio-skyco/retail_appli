import React from 'react';
import { X, Check, Calendar } from 'lucide-react';

export default function DemoModal({ showDemoModal, setShowDemoModal }) {
  if (!showDemoModal) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) setShowDemoModal(false); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-[#1E40AF] to-[#1E3A8A] p-6 rounded-t-2xl relative">
          <button
            onClick={() => setShowDemoModal(false)}
            className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <Calendar className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Réserver une Démo</h2>
              <p className="text-white/80">30 min avec un expert</p>
            </div>
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-5">
          <div className="text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-[#F97316] to-[#EA580C] rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-10 h-10 text-white" />
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">Choisissez votre créneau</h3>
            <p className="text-gray-600">
              Sélectionnez directement un créneau disponible dans notre agenda Calendly.
            </p>
          </div>

          <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
            <p className="text-sm text-[#1E40AF]">
              📅 <strong>Ce qui vous attend :</strong> Une démonstration personnalisée de 30 minutes pour découvrir comment Retail Performer AI peut transformer votre équipe.
            </p>
          </div>

          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-center gap-2">
              <Check className="w-5 h-5 text-green-500" />
              Confirmation immédiate par email
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-5 h-5 text-green-500" />
              Rappel automatique avant le RDV
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-5 h-5 text-green-500" />
              Lien de visioconférence inclus
            </li>
          </ul>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setShowDemoModal(false)}
              className="flex-1 py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-colors"
            >
              Annuler
            </button>
            <a
              href="https://calendly.com/s-cappuccio-skyco/30min"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setShowDemoModal(false)}
              className="flex-1 py-3 bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white font-semibold rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2"
            >
              <Calendar className="w-5 h-5" />
              Ouvrir Calendly
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
