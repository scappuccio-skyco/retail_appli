import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '../lib/apiClient';
import { logger } from '../utils/logger';
import {
  stylesVente,
  niveaux,
  motivations,
  discProfiles,
  managementStyles,
  compatibilityGuide,
  getCompatibilityResult,
} from './guideProfilsData';

export default function GuideProfilsModal({ onClose, userRole = 'manager', storeIdParam = null }) {
  // Define sections based on user role
  const allSections = userRole === 'seller' 
    ? ['style_vente', 'niveau', 'motivation', 'disc']  // 4 sections for sellers
    : ['management', 'style_vente', 'niveau', 'motivation', 'disc', 'compatibilite'];  // 6 sections for managers
  
  const [activeSection, setActiveSection] = useState(allSections[0]);
  const [currentProfile, setCurrentProfile] = useState(0);
  
  // States for real compatibility data
  const [managerProfile, setManagerProfile] = useState(null);
  const [teamSellers, setTeamSellers] = useState([]);
  const [loadingCompatibility, setLoadingCompatibility] = useState(false);
  
  // Get store_id from URL if not provided as prop (for gerant accessing as manager)
  const urlParams = new URLSearchParams(globalThis.location.search);
  const urlStoreId = urlParams.get('store_id');
  const effectiveStoreId = storeIdParam || urlStoreId;
  const storeParam = effectiveStoreId ? `?store_id=${effectiveStoreId}` : '';

  // Fetch manager and sellers data for compatibility
  useEffect(() => {
    if (activeSection === 'compatibilite' && userRole === 'manager') {
      fetchCompatibilityData();
    }
  }, [activeSection, storeParam]); // Re-fetch if storeParam changes

  // Reload compatibility data when modal opens
  useEffect(() => {
    if (userRole === 'manager') {
      fetchCompatibilityData();
    }
  }, [storeParam]); // Re-fetch if storeParam changes

  const fetchCompatibilityData = async () => {
    setLoadingCompatibility(true);
    try {
      // Get manager info
      const managerRes = await api.get('/auth/me');
      logger.log('[GuideProfils] Manager data:', managerRes.data);
      
      // Get manager diagnostic to have profil_nom
      const diagnosticRes = await api.get('/manager-diagnostic/me');
      logger.log('Manager diagnostic:', diagnosticRes.data);
      
      // Combine manager data with diagnostic profil_nom
      const managerWithProfile = {
        ...managerRes.data,
        management_style: diagnosticRes.data?.diagnostic?.profil_nom || managerRes.data.management_style || 'Pilote'
      };
      logger.log('Manager with profile:', managerWithProfile);
      setManagerProfile(managerWithProfile);
      
      // Get sellers - Use same endpoint and params as TeamModal/ManagerSettingsModal
      const sellersUrl = `/manager/sellers${storeParam}`;
      logger.log('[GuideProfils] 🔍 Fetching sellers:', {
        url: sellersUrl,
        storeId: effectiveStoreId,
        storeParam: storeParam
      });
      
      const sellersRes = await api.get(sellersUrl);
      
      // Normalize response (handles both array and {sellers: []} formats)
      const sellersData = Array.isArray(sellersRes.data) 
        ? sellersRes.data 
        : (sellersRes.data?.sellers || sellersRes.data || []);
      
      logger.log('[GuideProfils] ✅ Sellers response:', {
        rawResponse: sellersRes.data,
        normalizedSellers: sellersData,
        sellersCount: sellersData.length,
        responseKeys: Object.keys(sellersRes.data || {}),
        firstSeller: sellersData[0] || null
      });
      
      setTeamSellers(sellersData);
      
    } catch (error) {
      logger.error('Error fetching compatibility data:', error);
    } finally {
      setLoadingCompatibility(false);
    }
  };


  const getColorClasses = (color) => {
    const colors = {
      blue: 'bg-blue-50 border-blue-200',
      red: 'bg-red-50 border-red-200',
      green: 'bg-green-50 border-green-200',
      purple: 'bg-purple-50 border-purple-200',
      yellow: 'bg-yellow-50 border-blue-200',
      orange: 'bg-orange-50 border-orange-200',
      pink: 'bg-pink-50 border-pink-200',
      gray: 'bg-gray-50 border-gray-200'
    };
    return colors[color] || colors.blue;
  };

  const handleSectionChange = (section) => {
    setActiveSection(section);
    setCurrentProfile(0);
  };

  const getCurrentProfiles = () => {
    if (activeSection === 'management') return managementStyles;
    if (activeSection === 'style_vente') return stylesVente;
    if (activeSection === 'niveau') return niveaux;
    if (activeSection === 'motivation') return motivations;
    if (activeSection === 'disc') return discProfiles;
    if (activeSection === 'compatibilite') return compatibilityGuide;
    return [];
  };

  const profiles = getCurrentProfiles();
  const profile = profiles[currentProfile];

  const handleNext = () => {
    if (currentProfile < profiles.length - 1) {
      setCurrentProfile(currentProfile + 1);
    }
  };

  const handlePrevious = () => {
    if (currentProfile > 0) {
      setCurrentProfile(currentProfile - 1);
    }
  };

  const getSectionTitle = () => {
    if (activeSection === 'style_vente') return '🎨 Styles de Vente';
    if (activeSection === 'niveau') return '⭐ Niveaux d\'Expérience';
    if (activeSection === 'motivation') return '⚡ Leviers de Motivation';
    if (activeSection === 'disc') return '🎭 Profils DISC';
    if (activeSection === 'management') return '👔 Type de Management';
    if (activeSection === 'compatibilite') return '🤝 Compatibilité';
    return '';
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-500 to-blue-500 p-6 rounded-t-2xl relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white hover:text-gray-200 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          <h2 className="text-2xl font-bold text-white mb-2">📚 Guide des Profils</h2>
          <p className="text-white text-opacity-90">Comprends les différents profils pour mieux adapter ta communication</p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 bg-gray-50 px-6 py-4 mb-4 flex-wrap">
          {allSections.includes('management') && (
            <button
              onClick={() => handleSectionChange('management')}
              className={`px-6 py-4 text-sm font-semibold transition-colors whitespace-nowrap ${
                activeSection === 'management'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              👔 Type de management
            </button>
          )}
          {allSections.includes('style_vente') && (
            <button
              onClick={() => handleSectionChange('style_vente')}
              className={`px-6 py-4 text-sm font-semibold transition-colors whitespace-nowrap ${
                activeSection === 'style_vente'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              🎨 Styles de Vente
            </button>
          )}
          {allSections.includes('niveau') && (
            <button
              onClick={() => handleSectionChange('niveau')}
              className={`px-6 py-4 text-sm font-semibold transition-colors whitespace-nowrap ${
                activeSection === 'niveau'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              ⭐ Niveaux
            </button>
          )}
          {allSections.includes('motivation') && (
            <button
              onClick={() => handleSectionChange('motivation')}
              className={`px-6 py-4 text-sm font-semibold transition-colors whitespace-nowrap ${
                activeSection === 'motivation'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              ⚡ Motivations
            </button>
          )}
          {allSections.includes('disc') && (
            <button
              onClick={() => handleSectionChange('disc')}
              className={`px-6 py-4 text-sm font-semibold transition-colors whitespace-nowrap ${
                activeSection === 'disc'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              🎭 DISC
            </button>
          )}
          {allSections.includes('compatibilite') && (
            <button
              onClick={() => handleSectionChange('compatibilite')}
              className={`px-6 py-4 text-sm font-semibold transition-colors whitespace-nowrap ${
                activeSection === 'compatibilite'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              🤝 Compatibilité
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeSection === 'compatibilite' ? (
            /* Real Compatibility with Team */
            <div className="space-y-6">
              {loadingCompatibility ? (
                <div className="text-center py-12">
                  <div className="text-gray-600">Chargement de votre équipe...</div>
                </div>
              ) : (
                <>
                  {/* Manager Profile Header */}
                  {managerProfile && (
                    <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-2xl p-6 border-2 border-blue-300">
                      <h3 className="text-2xl font-bold text-gray-800 mb-2">
                        👔 Votre Profil de Management
                      </h3>
                      <div className="flex items-center gap-3 mt-4">
                        <div className="bg-blue-100 rounded-full w-16 h-16 flex items-center justify-center text-3xl">
                          🎯
                        </div>
                        <div>
                          <p className="text-xl font-bold text-gray-800">
                            {managerProfile.management_style}
                          </p>
                          <p className="text-gray-600 text-sm">
                            {managerProfile.name || 'Manager'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Team Compatibility */}
                  <div>
                    <h3 className="text-xl font-bold text-gray-800 mb-4">
                      🤝 Compatibilité avec votre équipe ({teamSellers.length} vendeur{teamSellers.length > 1 ? 's' : ''})
                    </h3>

                    {teamSellers.length === 0 ? (
                      <div className="text-center py-12 text-gray-500">
                        <p>Aucun vendeur rattaché à votre équipe</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {teamSellers.map((seller) => {
                          // Enlever "Le " du début du nom du profil pour matcher avec la matrice
                          const rawManagementType = managerProfile?.management_style || 'Pilote';
                          const managementType = rawManagementType.replace(/^Le\s+/i, '');
                          
                          // Enlever "Le " ou "L'" du début du style de vente
                          const rawSellingStyle = seller.style_vente || 'Dynamique';
                          const sellingStyle = rawSellingStyle.replace(/^(Le|L')\s+/i, '');
                          
                          const compatibilityResult = getCompatibilityResult(managementType, sellingStyle);

                          if (!compatibilityResult) return null;

                          return (
                            <div key={seller.id} className="bg-white rounded-2xl border-2 border-gray-200 overflow-hidden">
                              {/* Seller Header */}
                              <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-4 border-b-2 border-gray-200">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <div className="bg-purple-100 rounded-full w-12 h-12 flex items-center justify-center text-xl">
                                      👤
                                    </div>
                                    <div>
                                      <p className="font-bold text-gray-800 text-lg">{seller.name}</p>
                                      <p className="text-sm text-gray-600">Style : {sellingStyle}</p>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-xs text-gray-500 mb-1">Compatibilité</p>
                                    <p className="text-2xl">{compatibilityResult.score}</p>
                                  </div>
                                </div>
                              </div>

                              {/* Compatibility Details */}
                              <div className="p-5 space-y-4">
                                {/* Title & Description */}
                                <div>
                                  <h4 className="text-lg font-bold text-gray-800 mb-1">
                                    {compatibilityResult.title}
                                  </h4>
                                  <p className="text-gray-600">{compatibilityResult.description}</p>
                                </div>

                                {/* Caractéristiques */}
                                <div className="bg-blue-50 rounded-xl p-4">
                                  <h5 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
                                    ✨ Caractéristiques de la relation
                                  </h5>
                                  <ul className="space-y-1">
                                    {compatibilityResult.caracteristiques.map((item, idx) => (
                                      <li key={`compat-caract-${idx}-${item.substring(0, 20)}`} className="flex items-start gap-2 text-sm text-gray-700">
                                        <span className="text-blue-500 mt-1">•</span>
                                        <span>{item}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>

                                {/* Forces et Points d'attention */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  <div className="bg-green-50 rounded-xl p-4">
                                    <h5 className="font-bold text-green-900 mb-2 flex items-center gap-2 text-sm">
                                      ✅ Forces
                                    </h5>
                                    <ul className="space-y-1">
                                      {compatibilityResult.forces.map((item, idx) => (
                                        <li key={`compat-forces-${idx}-${item.substring(0, 20)}`} className="flex items-start gap-2 text-xs text-green-800">
                                          <span className="text-[#10B981] mt-0.5">✓</span>
                                          <span>{item}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>

                                  <div className="bg-orange-50 rounded-xl p-4">
                                    <h5 className="font-bold text-orange-900 mb-2 flex items-center gap-2 text-sm">
                                      ⚠️ Points d'attention
                                    </h5>
                                    <ul className="space-y-1">
                                      {compatibilityResult.attention.map((item, idx) => (
                                        <li key={`compat-attention-${idx}-${item.substring(0, 20)}`} className="flex items-start gap-2 text-xs text-orange-800">
                                          <span className="text-[#F97316] mt-0.5">!</span>
                                          <span>{item}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                </div>

                                {/* Recommandations */}
                                {compatibilityResult.recommandations ? (
                                  <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl p-5 border-2 border-purple-200">
                                    <h5 className="font-bold text-purple-900 mb-4 flex items-center gap-2">
                                      💡 Recommandations pour un fonctionnement optimal
                                    </h5>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      {/* Recommandations Manager */}
                                      <div>
                                        <h6 className="font-semibold text-purple-800 mb-2 text-sm flex items-center gap-2">
                                          👔 Pour vous (Manager)
                                        </h6>
                                        <ul className="space-y-2">
                                          {compatibilityResult.recommandations.manager.map((item, idx) => (
                                            <li key={`compat-reco-mgr-${idx}-${item.substring(0, 20)}`} className="flex items-start gap-2 text-xs text-purple-900">
                                              <span className="text-purple-600 mt-0.5">▸</span>
                                              <span>{item}</span>
                                            </li>
                                          ))}
                                        </ul>
                                      </div>

                                      {/* Recommandations Vendeur */}
                                      <div>
                                        <h6 className="font-semibold text-blue-800 mb-2 text-sm flex items-center gap-2">
                                          👤 Pour {seller.name.split(' ')[0]}
                                        </h6>
                                        <ul className="space-y-2">
                                          {compatibilityResult.recommandations.vendeur.map((item, idx) => (
                                            <li key={`compat-reco-vendeur-${idx}-${item.substring(0, 20)}`} className="flex items-start gap-2 text-xs text-blue-900">
                                              <span className="text-blue-600 mt-0.5">▸</span>
                                              <span>{item}</span>
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="text-center text-gray-500 text-sm py-2">
                                    Recommandations non disponibles pour cette combinaison
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          ) : profile && (
            <div className="space-y-6">
              {/* Profile Header */}
              <div className={`${getColorClasses(profile.color)} rounded-2xl p-6 border-2`}>
                <div className="flex items-center gap-4 mb-4">
                  <span className="text-5xl">{profile.icon}</span>
                  <div>
                    <h3 className="text-2xl font-bold text-gray-800">{profile.name}</h3>
                    <p className="text-gray-600">{profile.description}</p>
                  </div>
                </div>
              </div>

              {/* Navigation */}
              <div className="flex items-center justify-between">
                <button
                  onClick={handlePrevious}
                  disabled={currentProfile === 0}
                  className="flex items-center gap-2 text-blue-600 hover:text-blue-800 disabled:text-gray-400 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-5 h-5" />
                  Précédent
                </button>
                <span className="text-gray-600 font-medium">
                  {currentProfile + 1} / {profiles.length}
                </span>
                <button
                  onClick={handleNext}
                  disabled={currentProfile === profiles.length - 1}
                  className="flex items-center gap-2 text-blue-600 hover:text-blue-800 disabled:text-gray-400 disabled:cursor-not-allowed"
                >
                  Suivant
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              {/* Caractéristiques */}
              <div className="bg-white rounded-xl border-2 border-gray-200 p-5">
                <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                  ✨ Caractéristiques
                </h4>
                <ul className="space-y-2">
                  {profile.caracteristiques.map((item, idx) => (
                    <li key={`profile-caract-${idx}-${item.substring(0, 20)}`} className="flex items-start gap-2 text-gray-700">
                      <span className="text-blue-500 mt-1">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Forces / Moteurs / Communication */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-green-50 rounded-xl border-2 border-green-200 p-5">
                  <h4 className="font-bold text-green-900 mb-3 flex items-center gap-2">
                    ✅ {profile.forces ? 'Forces' : profile.moteurs ? 'Moteurs' : 'Communication'}
                  </h4>
                  <ul className="space-y-2">
                    {(profile.forces || profile.moteurs || profile.communication || []).map((item, idx) => (
                      <li key={`profile-forces-${idx}-${item.substring(0, 20)}`} className="flex items-start gap-2 text-green-800">
                        <span className="text-[#10B981] mt-1">✓</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-orange-50 rounded-xl border-2 border-orange-200 p-5">
                  <h4 className="font-bold text-orange-900 mb-3 flex items-center gap-2">
                    📝 {profile.attention ? 'Points d\'attention' : profile.objectifs ? 'Objectifs' : profile.conseils ? 'Conseils' : 'Développement'}
                  </h4>
                  <ul className="space-y-2">
                    {(profile.attention || profile.objectifs || profile.conseils || []).map((item, idx) => (
                      <li key={`profile-attention-${idx}-${item.substring(0, 20)}`} className="flex items-start gap-2 text-orange-800">
                        <span className="text-[#F97316] mt-1">→</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
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
