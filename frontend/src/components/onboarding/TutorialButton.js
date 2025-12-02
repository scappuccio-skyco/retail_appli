import React from 'react';
import { GraduationCap } from 'lucide-react';

/**
 * Bouton permanent pour lancer le tutoriel
 * À placer dans le header de chaque dashboard
 */
export default function TutorialButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
      title="Découvrir l'application"
    >
      <GraduationCap className="w-5 h-5" />
      <span className="hidden md:inline">Tutoriel</span>
    </button>
  );
}
