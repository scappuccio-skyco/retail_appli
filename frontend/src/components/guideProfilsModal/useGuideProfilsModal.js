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
    : ['mon_profil', 'mon_equipe'];

  const [activeSection, setActiveSection] = useState(allSections[0]);
  const [currentProfile, setCurrentProfile] = useState(0);
  const [managerProfile, setManagerProfile] = useState(null);
  const [teamSellers, setTeamSellers] = useState([]);
  const [loadingCompatibility, setLoadingCompatibility] = useState(false);

  const urlParams = new URLSearchParams(globalThis.location.search);
  const urlStoreId = urlParams.get('store_id');
  const effectiveStoreId = storeIdParam || urlStoreId;
  const storeParam = effectiveStoreId ? `?store_id=${effectiveStoreId}` : '';

  // Pour le manager : charger les données équipe dès l'ouverture
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
    if (activeSection === 'style_vente') return stylesVente;
    if (activeSection === 'niveau') return niveaux;
    if (activeSection === 'motivation') return motivations;
    if (activeSection === 'disc') return discProfiles;
    return [];
  };

  const profiles = getCurrentProfiles();

  const handleNext = () => {
    if (currentProfile < profiles.length - 1) setCurrentProfile(currentProfile + 1);
  };

  const handlePrevious = () => {
    if (currentProfile > 0) setCurrentProfile(currentProfile - 1);
  };

  // Profil propre du manager (pour l'onglet "Mon profil")
  const ownProfile = userProfileName
    ? managementStyles.find(p => p.name === userProfileName) || managementStyles[0]
    : managementStyles[0];

  return {
    allSections, activeSection, currentProfile,
    managerProfile, teamSellers, loadingCompatibility,
    profiles, profile: profiles[currentProfile],
    ownProfile,
    handleSectionChange, handleNext, handlePrevious,
    getColorClasses,
  };
}
