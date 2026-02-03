import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { api } from '../../lib/apiClient';
import { logger } from '../../utils/logger';
import confetti from 'canvas-confetti';

const DEFAULT_OBJECTIVE = {
  title: '',
  description: '',
  type: 'collective',
  seller_id: '',
  visible: true,
  visible_to_sellers: [],
  period_start: '',
  period_end: '',
  objective_type: 'kpi_standard',
  kpi_name: 'ca',
  product_name: '',
  custom_description: '',
  target_value: '',
  data_entry_responsible: 'manager',
  unit: '€'
};

const DEFAULT_CHALLENGE = {
  title: '',
  description: '',
  type: 'collective',
  seller_id: '',
  visible: true,
  visible_to_sellers: [],
  start_date: '',
  end_date: '',
  challenge_type: 'kpi_standard',
  kpi_name: 'ca',
  product_name: '',
  custom_description: '',
  target_value: '',
  data_entry_responsible: 'manager',
  unit: '€'
};

export function useManagerSettings({ isOpen, onClose, onUpdate, modalType, storeIdParam }) {
  const storeParam = storeIdParam ? `?store_id=${storeIdParam}` : '';
  const storeParamAnd = storeIdParam ? `&store_id=${storeIdParam}` : '';

  const [activeTab, setActiveTab] = useState(modalType === 'objectives' ? 'create_objective' : 'create_challenge');
  const [kpiConfig, setKpiConfig] = useState(null);
  const [objectives, setObjectives] = useState([]);
  const [challenges, setChallenges] = useState([]);
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingChallenge, setEditingChallenge] = useState(null);
  const [editingObjective, setEditingObjective] = useState(null);
  const [achievementModal, setAchievementModal] = useState({ isOpen: false, item: null, itemType: null });
  const [newChallenge, setNewChallenge] = useState({ ...DEFAULT_CHALLENGE });
  const [selectedVisibleSellersChallenge, setSelectedVisibleSellersChallenge] = useState([]);
  const [isChallengeSellerDropdownOpen, setIsChallengeSellerDropdownOpen] = useState(false);
  const challengeSellerDropdownRef = useRef(null);
  const [updatingProgressObjectiveId, setUpdatingProgressObjectiveId] = useState(null);
  const [progressValue, setProgressValue] = useState('');
  const [updatingProgressChallengeId, setUpdatingProgressChallengeId] = useState(null);
  const [challengeProgressValue, setChallengeProgressValue] = useState('');
  const [newObjective, setNewObjective] = useState({ ...DEFAULT_OBJECTIVE });
  const [selectedVisibleSellers, setSelectedVisibleSellers] = useState([]);
  const [isSellerDropdownOpen, setIsSellerDropdownOpen] = useState(false);
  const sellerDropdownRef = useRef(null);

  useEffect(() => {
    if (!updatingProgressObjectiveId) return;
    setProgressValue('');
    const t = setTimeout(() => setProgressValue(''), 0);
    return () => clearTimeout(t);
  }, [updatingProgressObjectiveId]);

  useEffect(() => {
    if (!updatingProgressChallengeId) return;
    setChallengeProgressValue('');
    const t = setTimeout(() => setChallengeProgressValue(''), 0);
    return () => clearTimeout(t);
  }, [updatingProgressChallengeId]);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(modalType === 'objectives' ? 'create_objective' : 'create_challenge');
      fetchData();
    }
  }, [isOpen, modalType]);

  const fetchData = async () => {
    logger.log('🔍 ManagerSettingsModal - fetchData called, storeParam:', storeParam);
    try {
      setLoading(true);
      const [configRes, objectivesRes, challengesRes, sellersRes] = await Promise.all([
        api.get(`/manager/kpi-config${storeParam}`),
        api.get(`/manager/objectives${storeParam}`),
        api.get(`/manager/challenges${storeParam}`),
        api.get(`/manager/sellers${storeParam}`)
      ]);
      logger.log('✅ ManagerSettingsModal - fetchData success', {
        kpiConfig: configRes.data,
        objectives: objectivesRes.data?.length,
        challenges: challengesRes.data?.length,
        sellers: sellersRes.data?.length
      });
      const objectivesData = objectivesRes.data || [];
      const challengesData = challengesRes.data || [];
      setKpiConfig(configRes.data);
      setObjectives(objectivesData);
      setChallenges(challengesData);
      setSellers(sellersRes.data || []);
      const unseenObjective = objectivesData.find(obj => obj.has_unseen_achievement === true);
      const unseenChallenge = challengesData.find(chall => chall.has_unseen_achievement === true);
      if (unseenObjective && !achievementModal.isOpen) {
        setAchievementModal({ isOpen: true, item: unseenObjective, itemType: 'objective' });
      } else if (unseenChallenge && !achievementModal.isOpen && !unseenObjective) {
        setAchievementModal({ isOpen: true, item: unseenChallenge, itemType: 'challenge' });
      }
    } catch (err) {
      logger.error('❌ ManagerSettingsModal - fetchData error:', err);
      toast.error('Erreur de chargement des données');
    } finally {
      logger.log('🔄 ManagerSettingsModal - setting loading to false');
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) fetchData();
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (sellerDropdownRef.current && !sellerDropdownRef.current.contains(event.target)) setIsSellerDropdownOpen(false);
    };
    if (isSellerDropdownOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isSellerDropdownOpen]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (challengeSellerDropdownRef.current && !challengeSellerDropdownRef.current.contains(event.target)) setIsChallengeSellerDropdownOpen(false);
    };
    if (isChallengeSellerDropdownOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isChallengeSellerDropdownOpen]);

  useEffect(() => {
    if (editingObjective) {
      setNewObjective({
        title: editingObjective.title || '',
        description: editingObjective.description || '',
        type: editingObjective.type || 'collective',
        seller_id: editingObjective.seller_id || '',
        visible: editingObjective.visible !== false,
        visible_to_sellers: editingObjective.visible_to_sellers || [],
        period_start: editingObjective.period_start || '',
        period_end: editingObjective.period_end || '',
        objective_type: editingObjective.objective_type || 'kpi_standard',
        kpi_name: editingObjective.kpi_name || 'ca',
        product_name: editingObjective.product_name || '',
        custom_description: editingObjective.custom_description || '',
        target_value: editingObjective.target_value || '',
        data_entry_responsible: editingObjective.data_entry_responsible || 'manager',
        unit: editingObjective.unit || '€'
      });
      if (editingObjective.type === 'collective' && editingObjective.visible_to_sellers && Array.isArray(editingObjective.visible_to_sellers)) {
        setSelectedVisibleSellers(editingObjective.visible_to_sellers);
      } else {
        setSelectedVisibleSellers([]);
      }
    } else {
      setSelectedVisibleSellers([]);
      setNewObjective({ ...DEFAULT_OBJECTIVE });
    }
  }, [editingObjective]);

  useEffect(() => {
    if (editingChallenge) {
      setNewChallenge({
        title: editingChallenge.title || '',
        description: editingChallenge.description || '',
        type: editingChallenge.type || 'collective',
        seller_id: editingChallenge.seller_id || '',
        visible: editingChallenge.visible !== false,
        visible_to_sellers: editingChallenge.visible_to_sellers || [],
        start_date: editingChallenge.start_date || '',
        end_date: editingChallenge.end_date || '',
        challenge_type: editingChallenge.challenge_type || 'kpi_standard',
        kpi_name: editingChallenge.kpi_name || 'ca',
        product_name: editingChallenge.product_name || '',
        custom_description: editingChallenge.custom_description || '',
        target_value: editingChallenge.target_value || '',
        data_entry_responsible: editingChallenge.data_entry_responsible || 'manager',
        unit: editingChallenge.unit || '€'
      });
      if (editingChallenge.type === 'collective' && editingChallenge.visible_to_sellers && Array.isArray(editingChallenge.visible_to_sellers)) {
        setSelectedVisibleSellersChallenge(editingChallenge.visible_to_sellers);
      } else {
        setSelectedVisibleSellersChallenge([]);
      }
    } else {
      setSelectedVisibleSellersChallenge([]);
      setNewChallenge({ ...DEFAULT_CHALLENGE });
    }
  }, [editingChallenge]);

  const triggerConfetti = () => {
    try {
      const confettiFn = confetti || window.confetti;
      if (!confettiFn) return;
      confettiFn({ particleCount: 30, spread: 50, origin: { y: 0.6 }, colors: ['#ffd700', '#ff6b6b', '#4ecdc4'] });
    } catch (_) {}
  };

  const handleMarkAchievementAsSeen = async () => {
    await fetchData();
  };

  const handleKPIConfigUpdate = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/manager/kpi-config${storeParam}`, kpiConfig);
      toast.success('Configuration KPI mise à jour');
      if (onUpdate) onUpdate();
    } catch (err) {
      logger.error('Error updating KPI config:', err);
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const handleCreateChallenge = async (e) => {
    e.preventDefault();
    try {
      const cleanedData = {
        title: newChallenge.title,
        description: newChallenge.description,
        type: newChallenge.type,
        visible: newChallenge.visible,
        start_date: newChallenge.start_date,
        end_date: newChallenge.end_date,
        challenge_type: newChallenge.challenge_type,
        target_value: parseFloat(newChallenge.target_value),
        data_entry_responsible: newChallenge.data_entry_responsible,
        unit: newChallenge.unit
      };
      if (newChallenge.type === 'individual' && newChallenge.seller_id) cleanedData.seller_id = newChallenge.seller_id;
      if (newChallenge.visible) {
        cleanedData.visible_to_sellers = selectedVisibleSellersChallenge.length > 0 ? selectedVisibleSellersChallenge : [];
      } else {
        cleanedData.visible_to_sellers = null;
      }
      if (newChallenge.challenge_type === 'kpi_standard') cleanedData.kpi_name = newChallenge.kpi_name;
      else if (newChallenge.challenge_type === 'product_focus') cleanedData.product_name = newChallenge.product_name;
      else if (newChallenge.challenge_type === 'custom') cleanedData.custom_description = newChallenge.custom_description;
      await api.post(`/manager/challenges${storeParam}`, cleanedData);
      toast.success('Challenge créé avec succès');
      setNewChallenge({ ...DEFAULT_CHALLENGE });
      setSelectedVisibleSellersChallenge([]);
      fetchData();
      if (onUpdate) onUpdate();
    } catch (err) {
      logger.error('Error creating challenge:', err);
      toast.error('Erreur lors de la création du challenge');
    }
  };

  const handleUpdateChallenge = async (e) => {
    e.preventDefault();
    try {
      const cleanedData = {
        title: newChallenge.title,
        description: newChallenge.description,
        start_date: newChallenge.start_date,
        end_date: newChallenge.end_date,
        type: newChallenge.type,
        visible: newChallenge.visible,
        challenge_type: newChallenge.challenge_type,
        target_value: parseFloat(newChallenge.target_value),
        data_entry_responsible: newChallenge.data_entry_responsible,
        unit: newChallenge.unit
      };
      if (newChallenge.type === 'individual' && newChallenge.seller_id) cleanedData.seller_id = newChallenge.seller_id;
      if (newChallenge.visible) {
        cleanedData.visible_to_sellers = selectedVisibleSellersChallenge.length > 0 ? selectedVisibleSellersChallenge : [];
      } else {
        cleanedData.visible_to_sellers = null;
      }
      if (newChallenge.challenge_type === 'kpi_standard') cleanedData.kpi_name = newChallenge.kpi_name;
      else if (newChallenge.challenge_type === 'product_focus') cleanedData.product_name = newChallenge.product_name;
      else if (newChallenge.challenge_type === 'custom') cleanedData.custom_description = newChallenge.custom_description;
      await api.put(`/manager/challenges/${editingChallenge.id}${storeParam}`, cleanedData);
      toast.success('Challenge modifié avec succès');
      setEditingChallenge(null);
      await fetchData();
      if (onUpdate) onUpdate();
    } catch (err) {
      logger.error('Error updating challenge:', err);
      toast.error('Erreur lors de la modification du challenge');
    }
  };

  const handleDeleteChallenge = async (challengeId, challengeTitle) => {
    if (!window.confirm(`Êtes-vous sûr de vouloir supprimer le challenge "${challengeTitle}" ?`)) return;
    try {
      await api.delete(`/manager/challenges/${challengeId}${storeParam}`);
      toast.success('Challenge supprimé avec succès');
      fetchData();
      if (onUpdate) onUpdate();
    } catch (err) {
      logger.error('Error deleting challenge:', err);
      toast.error('Erreur lors de la suppression');
    }
  };

  const handleUpdateChallengeProgress = async (challengeId) => {
    if (!challengeProgressValue || challengeProgressValue === '') {
      toast.error('Veuillez entrer une valeur');
      return;
    }
    try {
      const response = await api.post(`/manager/challenges/${challengeId}/progress${storeParam}`, { current_value: parseFloat(challengeProgressValue), mode: 'add' });
      const updatedChallenge = response.data;
      setUpdatingProgressChallengeId(null);
      setChallengeProgressValue('');
      triggerConfetti();
      toast.success('Progression mise à jour !', { duration: 2000 });
      if (updatedChallenge.just_achieved === true && updatedChallenge.has_unseen_achievement === true) {
        setAchievementModal({ isOpen: true, item: updatedChallenge, itemType: 'challenge' });
      }
      await fetchData();
      if (onUpdate) onUpdate();
    } catch (err) {
      logger.error('Error updating challenge progress:', err);
      toast.error(err.response?.data?.detail || 'Erreur lors de la mise à jour de la progression');
    }
  };

  const handleUpdateChallengeProgressMulti = async (challengeId, payload) => {
    try {
      await api.post(`/manager/challenges/${challengeId}/progress${storeParam}`, payload);
      toast.success('Progression mise à jour');
      setUpdatingProgressChallengeId(null);
      setChallengeProgressValue('');
      fetchData();
      if (onUpdate) onUpdate();
    } catch (err) {
      logger.error('Error:', err);
      toast.error('Erreur');
    }
  };

  const handleCreateObjective = async (e) => {
    e.preventDefault();
    try {
      const cleanedData = {
        title: newObjective.title,
        description: newObjective.description,
        type: newObjective.type,
        visible: newObjective.visible,
        period_start: newObjective.period_start,
        period_end: newObjective.period_end,
        objective_type: newObjective.objective_type,
        target_value: parseFloat(newObjective.target_value),
        data_entry_responsible: newObjective.data_entry_responsible,
        unit: newObjective.unit
      };
      if (newObjective.type === 'individual' && newObjective.seller_id) cleanedData.seller_id = newObjective.seller_id;
      if (newObjective.visible) {
        cleanedData.visible_to_sellers = selectedVisibleSellers.length > 0 ? selectedVisibleSellers : [];
      } else {
        cleanedData.visible_to_sellers = null;
      }
      if (newObjective.objective_type === 'kpi_standard') cleanedData.kpi_name = newObjective.kpi_name;
      else if (newObjective.objective_type === 'product_focus') cleanedData.product_name = newObjective.product_name;
      else if (newObjective.objective_type === 'custom') cleanedData.custom_description = newObjective.custom_description;
      await api.post(`/manager/objectives${storeParam}`, cleanedData);
      toast.success('Objectif créé avec succès');
      setNewObjective({ ...DEFAULT_OBJECTIVE });
      setSelectedVisibleSellers([]);
      fetchData();
      if (onUpdate) onUpdate();
    } catch (err) {
      logger.error('Error creating objective:', err);
      toast.error('Erreur lors de la création de l\'objectif');
    }
  };

  const handleUpdateObjective = async (e) => {
    e.preventDefault();
    try {
      const cleanedData = {
        title: newObjective.title,
        description: newObjective.description,
        period_start: newObjective.period_start,
        period_end: newObjective.period_end,
        type: newObjective.type,
        visible: newObjective.visible,
        objective_type: newObjective.objective_type,
        target_value: parseFloat(newObjective.target_value),
        data_entry_responsible: newObjective.data_entry_responsible,
        unit: newObjective.unit
      };
      if (newObjective.type === 'individual' && newObjective.seller_id) cleanedData.seller_id = newObjective.seller_id;
      if (newObjective.visible) {
        cleanedData.visible_to_sellers = selectedVisibleSellers.length > 0 ? selectedVisibleSellers : [];
      } else {
        cleanedData.visible_to_sellers = null;
      }
      if (newObjective.objective_type === 'kpi_standard') cleanedData.kpi_name = newObjective.kpi_name;
      else if (newObjective.objective_type === 'product_focus') cleanedData.product_name = newObjective.product_name;
      else if (newObjective.objective_type === 'custom') cleanedData.custom_description = newObjective.custom_description;
      await api.put(`/manager/objectives/${editingObjective.id}${storeParam}`, cleanedData);
      toast.success('Objectif modifié avec succès');
      setEditingObjective(null);
      await fetchData();
      if (onUpdate) onUpdate();
    } catch (err) {
      logger.error('Error updating objective:', err);
      toast.error('Erreur lors de la modification de l\'objectif');
    }
  };

  const handleDeleteObjective = async (objectiveId) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cet objectif ?')) return;
    try {
      await api.delete(`/manager/objectives/${objectiveId}${storeParam}`);
      toast.success('Objectif supprimé avec succès');
      fetchData();
      if (onUpdate) onUpdate();
    } catch (err) {
      logger.error('Error deleting objective:', err);
      toast.error('Erreur lors de la suppression');
    }
  };

  const handleUpdateProgress = async (objectiveId) => {
    if (!progressValue || progressValue === '') {
      toast.error('Veuillez entrer une valeur');
      return;
    }
    try {
      const response = await api.post(`/manager/objectives/${objectiveId}/progress${storeParam}`, { current_value: parseFloat(progressValue), mode: 'add' });
      const updatedObjective = response.data;
      setUpdatingProgressObjectiveId(null);
      setProgressValue('');
      triggerConfetti();
      toast.success('Progression mise à jour !', { duration: 2000 });
      if (updatedObjective.just_achieved === true && updatedObjective.has_unseen_achievement === true) {
        setAchievementModal({ isOpen: true, item: updatedObjective, itemType: 'objective' });
      }
      await fetchData();
      if (onUpdate) onUpdate();
    } catch (err) {
      logger.error('Error updating progress:', err);
      toast.error(err.response?.data?.detail || 'Erreur lors de la mise à jour de la progression');
    }
  };

  return {
    storeParam,
    activeTab,
    setActiveTab,
    kpiConfig,
    setKpiConfig,
    objectives,
    challenges,
    sellers,
    loading,
    editingChallenge,
    setEditingChallenge,
    editingObjective,
    setEditingObjective,
    achievementModal,
    setAchievementModal,
    newChallenge,
    setNewChallenge,
    selectedVisibleSellersChallenge,
    setSelectedVisibleSellersChallenge,
    isChallengeSellerDropdownOpen,
    setIsChallengeSellerDropdownOpen,
    challengeSellerDropdownRef,
    updatingProgressObjectiveId,
    setUpdatingProgressObjectiveId,
    progressValue,
    setProgressValue,
    updatingProgressChallengeId,
    setUpdatingProgressChallengeId,
    challengeProgressValue,
    setChallengeProgressValue,
    newObjective,
    setNewObjective,
    selectedVisibleSellers,
    setSelectedVisibleSellers,
    isSellerDropdownOpen,
    setIsSellerDropdownOpen,
    sellerDropdownRef,
    fetchData,
    handleMarkAchievementAsSeen,
    handleKPIConfigUpdate,
    handleCreateChallenge,
    handleUpdateChallenge,
    handleDeleteChallenge,
    handleUpdateChallengeProgress,
    handleUpdateChallengeProgressMulti,
    handleCreateObjective,
    handleUpdateObjective,
    handleDeleteObjective,
    handleUpdateProgress
  };
}
