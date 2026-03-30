import React from 'react';
import { X } from 'lucide-react';
import useGuideProfilsModal from './guideProfilsModal/useGuideProfilsModal';
import CompatibiliteSection from './guideProfilsModal/CompatibiliteSection';
import ProfileSection from './guideProfilsModal/ProfileSection';
import MonProfilSection from './guideProfilsModal/MonProfilSection';
import MonManagerSection from './guideProfilsModal/MonManagerSection';

export default function GuideProfilsModal({ onClose, userRole = 'manager', storeIdParam = null, userProfileName = null }) {
  const {
    allSections, activeSection,
    currentProfile, profiles, profile,
    managerProfile, managerFullDiagnostic, teamSellers, loadingCompatibility,
    aiCompatibilityAdvice, loadingAdviceIds, generateCompatibilityAdvice,
    sellerCompatibilityAdvice, loadingSellerAdvice,
    ownProfile,
    handleSectionChange, handleNext, handlePrevious,
    getColorClasses,
  } = useGuideProfilsModal({ userRole, storeIdParam, userProfileName });

  const sectionLabels = {
    mon_profil: '🎯 Mon Profil',
    mon_manager: '🤝 Mon Manager',
    mon_equipe: '👥 Mon Équipe',
    les_styles: '🎨 Les autres styles',
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="bg-gradient-to-r from-[#1E40AF] to-[#1E3A8A] p-5 rounded-t-2xl relative">
          <button onClick={onClose} className="absolute top-4 right-4 text-white hover:text-gray-200 transition-colors">
            <X className="w-6 h-6" />
          </button>
          <h2 className="text-xl font-bold text-white">
            {userRole === 'manager' ? '📚 Guide des Profils' : '📚 Guide des Profils Vendeur'}
          </h2>
          <p className="text-white opacity-80 text-sm mt-1">
            {userRole === 'manager'
              ? 'Comprends ton profil et adapte ton management à chaque vendeur'
              : 'Comprends les différents profils pour mieux adapter ta communication'}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 bg-gray-50 px-4">
          {allSections.map((section) => (
            <button
              key={section}
              onClick={() => handleSectionChange(section)}
              className={`px-5 py-3 text-sm font-semibold transition-colors whitespace-nowrap ${
                activeSection === section
                  ? 'text-[#1E40AF] border-b-2 border-[#1E40AF]'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {sectionLabels[section]}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {activeSection === 'mon_profil' && (
            <MonProfilSection
              profile={ownProfile}
              getColorClasses={getColorClasses}
            />
          )}
          {activeSection === 'mon_manager' && (
            <MonManagerSection
              advice={sellerCompatibilityAdvice}
              isLoading={loadingSellerAdvice}
            />
          )}
          {activeSection === 'mon_equipe' && (
            <CompatibiliteSection
              managerProfile={managerProfile}
              managerFullDiagnostic={managerFullDiagnostic}
              teamSellers={teamSellers}
              loadingCompatibility={loadingCompatibility}
              aiCompatibilityAdvice={aiCompatibilityAdvice}
              loadingAdviceIds={loadingAdviceIds}
              onGenerateAdvice={generateCompatibilityAdvice}
            />
          )}
          {activeSection === 'les_styles' && (
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
      </div>
    </div>
  );
}
