import { useState, useEffect } from 'react';
import { api } from '../../lib/apiClient';
import { logger } from '../../utils/logger';
import {
  stylesVente, niveaux, motivations, discProfiles,
  managementStyles, compatibilityGuide,
} from '../guideProfilsData';

export default function useGuideProfilsModal({ userRole, storeIdParam, userProfileName = null }) {
  const allSections = userRole === 'seller'
    ? ['mon_profil', 'mon_manager', 'les_styles']
    : ['mon_profil'];

  const [activeSection, setActiveSection] = useState(allSections[0]);
  const [currentProfile, setCurrentProfile] = useState(0);
  const [managerProfile, setManagerProfile] = useState(null);
  const [managerFullDiagnostic, setManagerFullDiagnostic] = useState(null);
  const [teamSellers, setTeamSellers] = useState([]);
  const [loadingCompatibility, setLoadingCompatibility] = useState(false);
  const [aiCompatibilityAdvice, setAiCompatibilityAdvice] = useState({});
  const [loadingAdviceIds, setLoadingAdviceIds] = useState(new Set());
  const [sellerCompatibilityAdvice, setSellerCompatibilityAdvice] = useState(null);
  const [loadingSellerAdvice, setLoadingSellerAdvice] = useState(false);

  const urlParams = new URLSearchParams(globalThis.location.search);
  const urlStoreId = urlParams.get('store_id');
  const effectiveStoreId = storeIdParam || urlStoreId;
  const storeParam = effectiveStoreId ? `?store_id=${effectiveStoreId}` : '';

  // Pour le manager : charger les données équipe dès l'ouverture
  useEffect(() => {
    if (userRole === 'manager') fetchCompatibilityData();
  }, [storeParam]);

  // Pour le vendeur : charger l'advice de compatibilité généré par le manager
  useEffect(() => {
    if (userRole === 'seller') fetchSellerCompatibilityAdvice();
  }, []);

  const fetchSellerCompatibilityAdvice = async () => {
    setLoadingSellerAdvice(true);
    try {
      const res = await api.get('/seller/compatibility-advice');
      setSellerCompatibilityAdvice(res.data?.advice || null);
    } catch (err) {
      logger.error('Error fetching seller compatibility advice:', err);
    } finally {
      setLoadingSellerAdvice(false);
    }
  };

  const fetchCompatibilityData = async () => {
    setLoadingCompatibility(true);
    try {
      const managerRes = await api.get('/auth/me');
      const diagnosticRes = await api.get('/manager-diagnostic/me');
      const fullDiagnostic = diagnosticRes.data?.diagnostic || null;
      setManagerFullDiagnostic(fullDiagnostic);
      setManagerProfile({
        ...managerRes.data,
        management_style: fullDiagnostic?.profil_nom || managerRes.data.management_style || 'Pilote',
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

  const generateCompatibilityAdvice = async (seller) => {
    if (!managerFullDiagnostic || !seller?.style_vente) return;
    const sellerId = seller.id;
    setLoadingAdviceIds(prev => new Set(prev).add(sellerId));
    try {
      const res = await api.post(`/manager/compatibility-advice${storeParam}`, {
        manager_diagnostic: managerFullDiagnostic,
        seller_name: seller.name,
        seller_style: seller.style_vente,
        seller_id: seller.id,
      });
      setAiCompatibilityAdvice(prev => ({ ...prev, [sellerId]: res.data }));
    } catch (err) {
      logger.error('Error generating compatibility advice:', err);
    } finally {
      setLoadingAdviceIds(prev => { const s = new Set(prev); s.delete(sellerId); return s; });
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
    if (activeSection === 'les_styles') return stylesVente;
    return [];
  };

  const profiles = getCurrentProfiles();

  const handleNext = () => {
    if (currentProfile < profiles.length - 1) setCurrentProfile(currentProfile + 1);
  };

  const handlePrevious = () => {
    if (currentProfile > 0) setCurrentProfile(currentProfile - 1);
  };

  // Normalise un nom de profil en retirant l'article (Le / La / L')
  const normalizeName = (name) =>
    (name || '').replace(/^(Le |La |L')/i, '').trim().toLowerCase();

  // Profil propre de l'utilisateur pour l'onglet "Mon Profil"
  const profilePool = userRole === 'seller' ? stylesVente : managementStyles;
  const ownProfile = userProfileName
    ? profilePool.find(p => normalizeName(p.name) === normalizeName(userProfileName)) || profilePool[0]
    : profilePool[0];

  return {
    allSections, activeSection, currentProfile,
    managerProfile, managerFullDiagnostic, teamSellers, loadingCompatibility,
    aiCompatibilityAdvice, loadingAdviceIds, generateCompatibilityAdvice,
    sellerCompatibilityAdvice, loadingSellerAdvice,
    profiles, profile: profiles[currentProfile],
    ownProfile,
    handleSectionChange, handleNext, handlePrevious,
    getColorClasses,
  };
}
