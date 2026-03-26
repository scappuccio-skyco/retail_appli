import React from 'react';
import { X } from 'lucide-react';
import useGuideProfilsModal from './guideProfilsModal/useGuideProfilsModal';
import CompatibiliteSection from './guideProfilsModal/CompatibiliteSection';
import ProfileSection from './guideProfilsModal/ProfileSection';

export default function GuideProfilsModal({ onClose, userRole = 'manager', storeIdParam = null, userProfileName = null }) {
  const {
    allSections, activeSection, currentProfile,
    managerProfile, teamSellers, loadingCompatibility,
    profiles, profile,
    handleSectionChange, handleNext, handlePrevious,
    getColorClasses,
  } = useGuideProfilsModal({ userRole, storeIdParam, userProfileName });

  const sectionLabels = {
    management: '👔 Type de management',
    style_vente: '🎨 Styles de Vente',
    niveau: '⭐ Niveaux',
    motivation: '⚡ Motivations',
    disc: '🎭 DISC',
    compatibilite: '🤝 Compatibilité',
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="bg-gradient-to-r from-purple-500 to-blue-500 p-6 rounded-t-2xl relative">
          <button onClick={onClose} className="absolute top-4 right-4 text-white hover:text-gray-200 transition-colors">
            <X className="w-6 h-6" />
          </button>
          <h2 className="text-2xl font-bold text-white mb-2">📚 Guide des Profils</h2>
          <p className="text-white text-opacity-90">Comprends les différents profils pour mieux adapter ta communication</p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 bg-gray-50 px-6 py-4 mb-4 flex-wrap">
          {allSections.map((section) => (
            <button
              key={section}
              onClick={() => handleSectionChange(section)}
              className={`px-6 py-4 text-sm font-semibold transition-colors whitespace-nowrap ${
                activeSection === section
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              {sectionLabels[section]}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeSection === 'compatibilite' ? (
            <CompatibiliteSection
              managerProfile={managerProfile}
              teamSellers={teamSellers}
              loadingCompatibility={loadingCompatibility}
            />
          ) : (
            <ProfileSection
              profile={profile}
              currentProfile={currentProfile}
              profiles={profiles}
              getColorClasses={getColorClasses}
              handleNext={handleNext}
              handlePrevious={handlePrevious}
            />
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 rounded-b-2xl text-center text-sm text-gray-600">
          Retail Performer - Guide des Profils
        </div>
      </div>
    </div>
  );
}
