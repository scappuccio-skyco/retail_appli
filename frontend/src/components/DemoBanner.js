import React from 'react';
import { Eye, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/**
 * Bandeau persistant affiché en haut de tous les dashboards en mode démo.
 * Visible uniquement si user.is_demo === true.
 */
export default function DemoBanner() {
  const navigate = useNavigate();

  return (
    <div className="w-full bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white px-4 py-2 flex items-center justify-between gap-4 z-50">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Eye className="w-4 h-4 flex-shrink-0" />
        <span>Mode démo — Lecture seule. Les modifications ne sont pas sauvegardées.</span>
      </div>
      <button
        onClick={() => navigate('/early-access')}
        className="flex items-center gap-1.5 text-sm font-semibold bg-white/20 hover:bg-white/30 transition-colors px-3 py-1 rounded-lg flex-shrink-0"
      >
        Créer mon compte
        <ArrowRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
