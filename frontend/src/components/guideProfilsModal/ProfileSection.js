import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function ProfileSection({ profile, currentProfile, profiles, getColorClasses, handleNext, handlePrevious }) {
  if (!profile) return null;

  return (
    <div className="space-y-6">
      <div className={`${getColorClasses(profile.color)} rounded-2xl p-6 border-2`}>
        <div className="flex items-center gap-4 mb-4">
          <span className="text-5xl">{profile.icon}</span>
          <div>
            <h3 className="text-2xl font-bold text-gray-800">{profile.name}</h3>
            <p className="text-gray-600">{profile.description}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={handlePrevious}
          disabled={currentProfile === 0}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-800 disabled:text-gray-400 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-5 h-5" />
          Précédent
        </button>
        <span className="text-gray-600 font-medium">{currentProfile + 1} / {profiles.length}</span>
        <button
          onClick={handleNext}
          disabled={currentProfile === profiles.length - 1}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-800 disabled:text-gray-400 disabled:cursor-not-allowed"
        >
          Suivant
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <div className="bg-white rounded-xl border-2 border-gray-200 p-5">
        <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">✨ Caractéristiques</h4>
        <ul className="space-y-2">
          {profile.caracteristiques.map((item, idx) => (
            <li key={`profile-caract-${idx}-${item.substring(0, 20)}`} className="flex items-start gap-2 text-gray-700">
              <span className="text-blue-500 mt-1">•</span><span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-green-50 rounded-xl border-2 border-green-200 p-5">
          <h4 className="font-bold text-green-900 mb-3 flex items-center gap-2">
            ✅ {profile.forces ? 'Forces' : profile.moteurs ? 'Moteurs' : 'Communication'}
          </h4>
          <ul className="space-y-2">
            {(profile.forces || profile.moteurs || profile.communication || []).map((item, idx) => (
              <li key={`profile-forces-${idx}-${item.substring(0, 20)}`} className="flex items-start gap-2 text-green-800">
                <span className="text-[#10B981] mt-1">✓</span><span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-orange-50 rounded-xl border-2 border-orange-200 p-5">
          <h4 className="font-bold text-orange-900 mb-3 flex items-center gap-2">
            📝 {profile.attention ? "Points d'attention" : profile.objectifs ? 'Objectifs' : profile.conseils ? 'Conseils' : 'Développement'}
          </h4>
          <ul className="space-y-2">
            {(profile.attention || profile.objectifs || profile.conseils || []).map((item, idx) => (
              <li key={`profile-attention-${idx}-${item.substring(0, 20)}`} className="flex items-start gap-2 text-orange-800">
                <span className="text-[#F97316] mt-1">→</span><span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
