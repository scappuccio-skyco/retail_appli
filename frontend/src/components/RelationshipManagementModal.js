import React, { useState, useEffect, useRef } from 'react';
import { api } from '../lib/apiClient';
import { logger } from '../utils/logger';
import { toast } from 'sonner';
import { X, MessageCircle, AlertTriangle, Users, Calendar } from 'lucide-react';
import { getApiPrefixByRole, normalizeHistoryResponse } from '../utils/apiHelpers';
import { useAuth } from '../contexts';
import FormTab from './relationshipModal/FormTab';
import HistoryTab from './relationshipModal/HistoryTab';

export default function RelationshipManagementModal({ onClose, onSuccess, sellers = [], autoShowResult = false, storeId = null }) {
  const { user } = useAuth();

  // Filter to show only active sellers (exclude suspended and deleted)
  const activeSellers = sellers.filter(seller => !seller.status || seller.status === 'active');

  // Build store_id param for API calls
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

  // ─── Situation type definitions ───────────────────────────────────────────────
  const situationTypes = {
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

  // ─── Close dropdowns on outside click ────────────────────────────────────────
  useEffect(() => {
    function handleClickOutside(event) {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target)) {
        setIsFilterDropdownOpen(false);
      }
    }
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
    if (activeMainTab === 'history') {
      loadHistory();
    }
  }, [activeMainTab]);

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

  // ─── Derived data ─────────────────────────────────────────────────────────────
  const filteredHistory = history
    .filter(h => {
      if (activeHistoryTab === 'relationnel') return h.advice_type === 'relationnel';
      if (activeHistoryTab === 'conflit') return h.advice_type === 'conflit';
      return true;
    })
    .filter(h => historyFilter === 'all' || h.seller_id === historyFilter);

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-500 to-indigo-600 p-6 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Users className="w-6 h-6" />
              Gestion relationnelle & Conflit
            </h2>
            <p className="text-purple-100 text-sm mt-1">
              Recommandations IA personnalisées pour votre équipe
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Main Tabs */}
        <div className="border-b border-gray-200 bg-gray-50">
          <div className="flex flex-wrap gap-2 px-3 sm:px-6 pt-2">
            <button
              onClick={() => { setActiveMainTab('form'); setActiveFormTab('relationnel'); resetForm(); }}
              className={`px-3 sm:px-6 py-2 sm:py-3 text-sm sm:text-base font-semibold transition-all rounded-t-lg ${
                activeMainTab === 'form' && activeFormTab === 'relationnel'
                  ? 'bg-purple-300 text-gray-800 shadow-md border-b-4 border-purple-500'
                  : 'text-gray-600 hover:text-purple-600 hover:bg-gray-100'
              }`}
            >
              <MessageCircle className="w-4 h-4 inline mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Gestion relationnelle</span>
              <span className="sm:hidden">Relationnel</span>
            </button>
            <button
              onClick={() => { setActiveMainTab('form'); setActiveFormTab('conflit'); resetForm(); }}
              className={`px-3 sm:px-6 py-2 sm:py-3 text-sm sm:text-base font-semibold transition-all rounded-t-lg ${
                activeMainTab === 'form' && activeFormTab === 'conflit'
                  ? 'bg-purple-300 text-gray-800 shadow-md border-b-4 border-purple-500'
                  : 'text-gray-600 hover:text-purple-600 hover:bg-gray-100'
              }`}
            >
              <AlertTriangle className="w-4 h-4 inline mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Gestion de conflit</span>
              <span className="sm:hidden">Conflit</span>
            </button>
            <button
              onClick={() => setActiveMainTab('history')}
              className={`px-3 sm:px-6 py-2 sm:py-3 text-sm sm:text-base font-semibold transition-all rounded-t-lg ${
                activeMainTab === 'history'
                  ? 'bg-purple-300 text-gray-800 shadow-md border-b-4 border-purple-500'
                  : 'text-gray-600 hover:text-purple-600 hover:bg-gray-100'
              }`}
            >
              <Calendar className="w-4 h-4 inline mr-1 sm:mr-2" />
              Historique
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeMainTab === 'form' ? (
            <FormTab
              activeFormTab={activeFormTab}
              activeSellers={activeSellers}
              selectedSeller={selectedSeller}
              setSelectedSeller={setSelectedSeller}
              isSellerDropdownOpen={isSellerDropdownOpen}
              setIsSellerDropdownOpen={setIsSellerDropdownOpen}
              sellerDropdownRef={sellerDropdownRef}
              situationType={situationType}
              setSituationType={setSituationType}
              situationTypes={situationTypes}
              description={description}
              setDescription={setDescription}
              conflictContexte={conflictContexte}
              setConflictContexte={setConflictContexte}
              conflictComportement={conflictComportement}
              setConflictComportement={setConflictComportement}
              conflictImpact={conflictImpact}
              setConflictImpact={setConflictImpact}
              conflictTentatives={conflictTentatives}
              setConflictTentatives={setConflictTentatives}
              onSubmit={handleGenerateAdvice}
            />
          ) : (
            <HistoryTab
              history={history}
              filteredHistory={filteredHistory}
              activeHistoryTab={activeHistoryTab}
              setActiveHistoryTab={setActiveHistoryTab}
              historyFilter={historyFilter}
              setHistoryFilter={setHistoryFilter}
              loadHistory={loadHistory}
              isFilterDropdownOpen={isFilterDropdownOpen}
              setIsFilterDropdownOpen={setIsFilterDropdownOpen}
              filterDropdownRef={filterDropdownRef}
              sellers={sellers}
              expandedItems={expandedItems}
              setExpandedItems={setExpandedItems}
              resolvingItem={resolvingItem}
              onToggleResolved={handleToggleResolved}
              onDelete={handleDeleteConsultation}
              situationTypes={situationTypes}
            />
          )}
        </div>
      </div>
    </div>
  );
}
