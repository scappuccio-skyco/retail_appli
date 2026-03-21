import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { api } from '../../lib/apiClient';
import { logger } from '../../utils/logger';
import { getApiPrefixByRole, normalizeHistoryResponse } from '../../utils/apiHelpers';
import { useAuth } from '../../contexts';

export const SITUATION_TYPES = {
  relationnel: [
    { value: 'augmentation', label: '💰 Demande d\'augmentation' },
    { value: 'demotivation', label: '😔 Baisse de motivation' },
    { value: 'formation', label: '📚 Demande de formation' },
    { value: 'reorganisation', label: '🔄 Adaptation à une réorganisation' },
    { value: 'charge_travail', label: '⚖️ Charge de travail' },
    { value: 'ambitions', label: '🎯 Discussion sur les ambitions' },
    { value: 'feedback', label: '💬 Donner un feedback constructif' },
    { value: 'autre', label: '📝 Autre situation' },
  ],
  conflit: [
    { value: 'collegue', label: '👥 Conflit avec un collègue' },
    { value: 'client', label: '🛍️ Conflit avec un client' },
    { value: 'manager', label: '👔 Tension avec le manager' },
    { value: 'communication', label: '💬 Problème de communication' },
    { value: 'horaires', label: '⏰ Conflit d\'horaires' },
    { value: 'taches', label: '📋 Désaccord sur les tâches' },
    { value: 'comportement', label: '⚠️ Comportement inapproprié' },
    { value: 'autre', label: '📝 Autre conflit' },
  ],
};

export default function useRelationshipManagementModal({ sellers, autoShowResult, storeId, onSuccess }) {
  const { user } = useAuth();

  const activeSellers = sellers.filter(seller => !seller.status || seller.status === 'active');
  const storeIdParam = storeId ? `?store_id=${storeId}` : '';

  // ─── Tab state ───────────────────────────────────────────────────────────────
  const [activeMainTab, setActiveMainTab] = useState(autoShowResult ? 'history' : 'form');
  const [activeFormTab, setActiveFormTab] = useState('relationnel');
  const [activeHistoryTab, setActiveHistoryTab] = useState('all');

  // ─── Form state ───────────────────────────────────────────────────────────────
  const [selectedSeller, setSelectedSeller] = useState('');
  const [situationType, setSituationType] = useState('');
  const [description, setDescription] = useState('');
  const [conflictContexte, setConflictContexte] = useState('');
  const [conflictComportement, setConflictComportement] = useState('');
  const [conflictImpact, setConflictImpact] = useState('');
  const [conflictTentatives, setConflictTentatives] = useState('');

  // ─── History state ────────────────────────────────────────────────────────────
  const [resolvingItem, setResolvingItem] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyFilter, setHistoryFilter] = useState('all');
  const [expandedItems, setExpandedItems] = useState({});

  // ─── Dropdown state ───────────────────────────────────────────────────────────
  const [isSellerDropdownOpen, setIsSellerDropdownOpen] = useState(false);
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const sellerDropdownRef = useRef(null);
  const filterDropdownRef = useRef(null);
  const isMountedRef = useRef(true);
  useEffect(() => () => { isMountedRef.current = false; }, []);

  // ─── Close dropdowns on outside click ────────────────────────────────────────
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target)) {
        setIsFilterDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (sellerDropdownRef.current && !sellerDropdownRef.current.contains(event.target)) {
        setIsSellerDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ─── History loading ──────────────────────────────────────────────────────────
  const loadHistory = async (sellerId = null) => {
    try {
      const userRole = user?.role || 'manager';
      const apiPrefix = getApiPrefixByRole(userRole);

      let url;
      if (userRole === 'seller') {
        url = `${apiPrefix}/relationship-advice/history`;
      } else {
        url = `${apiPrefix}/relationship-advice/history${storeIdParam}`;
        if (sellerId) {
          url += storeIdParam ? `&seller_id=${sellerId}` : `?seller_id=${sellerId}`;
        }
      }

      const response = await api.get(url);
      if (!isMountedRef.current) return;
      const consultations = normalizeHistoryResponse(response.data);
      setHistory(consultations);

      if (autoShowResult && consultations.length > 0) {
        setExpandedItems({ [consultations[0].id]: true });
      }
    } catch (error) {
      if (!isMountedRef.current) return;
      logger.error('Error loading history:', error);
      toast.error("Erreur lors du chargement de l'historique");
    }
  };

  useEffect(() => {
    if (activeMainTab === 'history') loadHistory();
  }, [activeMainTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Handlers ─────────────────────────────────────────────────────────────────
  const handleDeleteConsultation = async (consultationId) => {
    if (!globalThis.confirm('Êtes-vous sûr de vouloir supprimer cette consultation ?')) return;
    try {
      await api.delete(`/manager/relationship-consultation/${consultationId}${storeIdParam}`);
      toast.success('Consultation supprimée avec succès');
      loadHistory(historyFilter !== 'all' ? historyFilter : null);
    } catch (error) {
      logger.error('Error deleting consultation:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  const handleToggleResolved = async (item) => {
    try {
      setResolvingItem(item.id);
      const newResolved = !item.resolved;
      const userRole = user?.role || 'manager';
      const apiPrefix = getApiPrefixByRole(userRole);
      await api.patch(
        `${apiPrefix}/relationship-consultation/${item.id}/resolve${storeIdParam}`,
        { resolved: newResolved }
      );
      setHistory(prev => prev.map(h => h.id === item.id ? { ...h, resolved: newResolved } : h));
      toast.success(newResolved ? '✅ Marqué comme résolu' : 'Consultation rouverte');
    } catch (error) {
      logger.error('Error toggling resolved:', error);
      toast.error('Erreur lors de la mise à jour');
    } finally {
      setResolvingItem(null);
    }
  };

  const buildConflictDescription = () => {
    const parts = [];
    if (conflictContexte.trim()) parts.push(`Contexte : ${conflictContexte.trim()}`);
    if (conflictComportement.trim()) parts.push(`Comportement observé : ${conflictComportement.trim()}`);
    if (conflictImpact.trim()) parts.push(`Impact sur l'équipe : ${conflictImpact.trim()}`);
    if (conflictTentatives.trim()) parts.push(`Tentatives précédentes : ${conflictTentatives.trim()}`);
    return parts.join('\n');
  };

  const resetForm = () => {
    setSelectedSeller('');
    setSituationType('');
    setDescription('');
    setConflictContexte('');
    setConflictComportement('');
    setConflictImpact('');
    setConflictTentatives('');
  };

  const handleGenerateAdvice = async (e) => {
    e.preventDefault();
    let finalDescription = description;
    if (activeFormTab === 'conflit') {
      finalDescription = buildConflictDescription();
      if (!selectedSeller || !situationType || !conflictContexte.trim() || !conflictComportement.trim()) {
        toast.error('Veuillez remplir au minimum le contexte et le comportement observé');
        return;
      }
    } else {
      if (!selectedSeller || !situationType || !description.trim()) {
        toast.error('Veuillez remplir tous les champs');
        return;
      }
    }
    if (onSuccess) {
      onSuccess({
        seller_id: selectedSeller,
        advice_type: activeFormTab,
        situation_type: situationType,
        description: finalDescription,
      });
    }
  };

  const filteredHistory = history
    .filter(h => {
      if (activeHistoryTab === 'relationnel') return h.advice_type === 'relationnel';
      if (activeHistoryTab === 'conflit') return h.advice_type === 'conflit';
      return true;
    })
    .filter(h => historyFilter === 'all' || h.seller_id === historyFilter);

  return {
    // Tab state
    activeMainTab, setActiveMainTab,
    activeFormTab, setActiveFormTab,
    activeHistoryTab, setActiveHistoryTab,
    // Form state
    activeSellers, selectedSeller, setSelectedSeller,
    isSellerDropdownOpen, setIsSellerDropdownOpen, sellerDropdownRef,
    situationType, setSituationType,
    description, setDescription,
    conflictContexte, setConflictContexte,
    conflictComportement, setConflictComportement,
    conflictImpact, setConflictImpact,
    conflictTentatives, setConflictTentatives,
    // History state
    history, historyFilter, setHistoryFilter,
    expandedItems, setExpandedItems,
    resolvingItem,
    isFilterDropdownOpen, setIsFilterDropdownOpen, filterDropdownRef,
    // Handlers
    resetForm, loadHistory,
    handleGenerateAdvice, handleDeleteConsultation, handleToggleResolved,
    // Derived
    filteredHistory,
    situationTypes: SITUATION_TYPES,
  };
}
