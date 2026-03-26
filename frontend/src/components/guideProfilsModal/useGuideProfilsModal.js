import { useState, useEffect } from 'react';
import { api } from '../../lib/apiClient';
import { logger } from '../../utils/logger';
import {
  stylesVente, niveaux, motivations, discProfiles,
  managementStyles, compatibilityGuide,
} from '../guideProfilsData';

export default function useGuideProfilsModal({ userRole, storeIdParam, userProfileName = null }) {
  const allSections = userRole === 'seller'
    ? ['style_vente', 'niveau', 'motivation', 'disc']
    : ['management', 'style_vente', 'niveau', 'motivation', 'disc', 'compatibilite'];

  const [activeSection, setActiveSection] = useState(allSections[0]);

  // Auto-navigate to the user's own profile on open
  const getInitialProfileIndex = () => {
    if (!userProfileName) return 0;
    const initialProfiles = userRole === 'seller' ? stylesVente : managementStyles;
    const idx = initialProfiles.findIndex(p => p.name === userProfileName);
    return idx >= 0 ? idx : 0;
  };

  const [currentProfile, setCurrentProfile] = useState(getInitialProfileIndex);
  const [managerProfile, setManagerProfile] = useState(null);
  const [teamSellers, setTeamSellers] = useState([]);
  const [loadingCompatibility, setLoadingCompatibility] = useState(false);

  const urlParams = new URLSearchParams(globalThis.location.search);
  const urlStoreId = urlParams.get('store_id');
  const effectiveStoreId = storeIdParam || urlStoreId;
  const storeParam = effectiveStoreId ? `?store_id=${effectiveStoreId}` : '';

  useEffect(() => {
    if (activeSection === 'compatibilite' && userRole === 'manager') {
      fetchCompatibilityData();
    }
  }, [activeSection, storeParam]);

  useEffect(() => {
    if (userRole === 'manager') fetchCompatibilityData();
  }, [storeParam]);

  const fetchCompatibilityData = async () => {
    setLoadingCompatibility(true);
    try {
      const managerRes = await api.get('/auth/me');
      const diagnosticRes = await api.get('/manager-diagnostic/me');
      setManagerProfile({
        ...managerRes.data,
        management_style: diagnosticRes.data?.diagnostic?.profil_nom || managerRes.data.management_style || 'Pilote',
      });
      const sellersRes = await api.get(`/manager/sellers${storeParam}`);
      const sellersData = Array.isArray(sellersRes.data)
        ? sellersRes.data
        : (sellersRes.data?.sellers || sellersRes.data || []);
      setTeamSellers(sellersData);
    } catch (error) {
      logger.error('Error fetching compatibility data:', error);
    } finally {
      setLoadingCompatibility(false);
    }
  };

  const getColorClasses = (color) => {
    const colors = {
      blue: 'bg-blue-50 border-blue-200', red: 'bg-red-50 border-red-200',
      green: 'bg-green-50 border-green-200', purple: 'bg-purple-50 border-purple-200',
      yellow: 'bg-yellow-50 border-blue-200', orange: 'bg-orange-50 border-orange-200',
      pink: 'bg-pink-50 border-pink-200', gray: 'bg-gray-50 border-gray-200',
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

  const handleNext = () => {
    if (currentProfile < profiles.length - 1) setCurrentProfile(currentProfile + 1);
  };

  const handlePrevious = () => {
    if (currentProfile > 0) setCurrentProfile(currentProfile - 1);
  };

  const getSectionTitle = () => {
    const titles = {
      style_vente: '🎨 Styles de Vente',
      niveau: "⭐ Niveaux d'Expérience",
      motivation: '⚡ Leviers de Motivation',
      disc: '🎭 Profils DISC',
      management: '👔 Type de Management',
      compatibilite: '🤝 Compatibilité',
    };
    return titles[activeSection] || '';
  };

  return {
    allSections, activeSection, currentProfile,
    managerProfile, teamSellers, loadingCompatibility,
    profiles, profile: profiles[currentProfile],
    handleSectionChange, handleNext, handlePrevious,
    getSectionTitle, getColorClasses,
  };
}
