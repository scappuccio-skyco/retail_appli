import React from 'react';

/**
 * Onglet "Mon Profil" — affiche le profil de management de l'utilisateur
 * de façon claire et actionnable, sans navigation entre profils.
 */
export default function MonProfilSection({ profile, getColorClasses }) {
  if (!profile) return null;

  return (
    <div className="space-y-5">

      {/* Carte profil */}
      <div className={`${getColorClasses(profile.color)} rounded-2xl p-6 border-2`}>
        <div className="flex items-center gap-4">
          <span className="text-5xl">{profile.icon}</span>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Ton style de management</p>
            <h3 className="text-2xl font-bold text-gray-800">{profile.name}</h3>
            <p className="text-gray-600 mt-1">{profile.description}</p>
          </div>
        </div>
      </div>

      {/* Comment tu fonctionnes */}
      <div className="bg-white rounded-xl border-2 border-gray-200 p-5">
        <h4 className="font-bold text-gray-800 mb-3">✨ Comment tu fonctionnes</h4>
        <ul className="space-y-2">
          {profile.caracteristiques.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2 text-gray-700">
              <span className="text-blue-500 mt-1 flex-shrink-0">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Forces & Points d'attention */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-green-50 rounded-xl border-2 border-green-200 p-5">
          <h4 className="font-bold text-green-900 mb-3">💪 Tes forces</h4>
          <ul className="space-y-2">
            {profile.forces.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2 text-green-800">
                <span className="text-green-500 mt-1 flex-shrink-0">✓</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-orange-50 rounded-xl border-2 border-orange-200 p-5">
          <h4 className="font-bold text-orange-900 mb-3">⚠️ Points d'attention</h4>
          <ul className="space-y-2">
            {profile.attention.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2 text-orange-800">
                <span className="text-orange-500 mt-1 flex-shrink-0">→</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Conseil actionnable */}
      <div className="bg-blue-50 rounded-xl border-2 border-blue-200 p-5">
        <h4 className="font-bold text-blue-900 mb-2">💡 Comment utiliser ce profil ?</h4>
        <p className="text-blue-800 text-sm">
          Consulte l'onglet <strong>Mon Équipe</strong> pour voir comment ton style de management
          se combine avec les profils de tes vendeurs — et adapter ton approche concrètement.
        </p>
      </div>

    </div>
  );
}
