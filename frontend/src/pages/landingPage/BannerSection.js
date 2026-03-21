import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function BannerSection() {
  const navigate = useNavigate();

  return (
    <div className="fixed top-0 left-0 right-0 z-[60] bg-gradient-to-r from-[#F97316] via-[#EA580C] to-[#DC2626] text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm sm:text-base font-medium flex-1 text-center sm:text-left">
            🚀 PROGRAMME PILOTE : Accompagnement VIP + Tarif Fondateur à 19€/vendeur bloqué à vie. Places limitées !
          </p>
          <button
            onClick={() => navigate('/early-access')}
            className="px-4 sm:px-6 py-2 bg-white text-[#F97316] font-semibold rounded-lg hover:bg-gray-100 transition-all whitespace-nowrap text-sm sm:text-base shadow-md"
          >
            Postuler
          </button>
        </div>
      </div>
    </div>
  );
}
