import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { X, Settings, Target, Trophy, Edit2, Trash2, Plus } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function ManagerSettingsModal({ isOpen, onClose, onUpdate, modalType = 'objectives' }) {
  const [activeTab, setActiveTab] = useState(modalType); // 'objectives', 'challenges'
  const [kpiConfig, setKpiConfig] = useState(null);
  const [objectives, setObjectives] = useState([]);
  const [challenges, setChallenges] = useState([]);
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingChallenge, setEditingChallenge] = useState(null);
  const [editingObjective, setEditingObjective] = useState(null);
  
  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };
  
  // New challenge form - NEW FLEXIBLE SYSTEM (same as objectives)
  const [newChallenge, setNewChallenge] = useState({
    title: '',
    description: '', // Description du challenge
    type: 'collective',
    seller_id: '',
    visible: true,
    visible_to_sellers: [],
    start_date: '',
    end_date: '',
    challenge_type: 'kpi_standard', // 'kpi_standard' | 'product_focus' | 'custom'
    kpi_name: 'ca', // For kpi_standard
    product_name: '', // For product_focus
    custom_description: '', // For custom
    target_value: '',
    data_entry_responsible: 'manager', // 'manager' | 'seller'
    unit: '€' // Display unit
  });
  
  // Selected sellers for challenge visibility
  const [selectedVisibleSellersChallenge, setSelectedVisibleSellersChallenge] = useState([]);
  
  // Dropdown state for challenge seller selection
  const [isChallengeSellerDropdownOpen, setIsChallengeSellerDropdownOpen] = useState(false);
  const challengeSellerDropdownRef = useRef(null);
  
  // Progress update state for challenges
  const [updatingProgressChallengeId, setUpdatingProgressChallengeId] = useState(null);
  const [challengeProgressValue, setChallengeProgressValue] = useState('');

  // New objective form - NEW FLEXIBLE SYSTEM
  const [newObjective, setNewObjective] = useState({
    title: '',
    description: '', // Description de l'objectif
    type: 'collective',
    seller_id: '',
    visible: true,
    visible_to_sellers: [],
    period_start: '',
    period_end: '',
    objective_type: 'kpi_standard', // 'kpi_standard' | 'product_focus' | 'custom'
    kpi_name: 'ca', // For kpi_standard
    product_name: '', // For product_focus
    custom_description: '', // For custom
    target_value: '',
    data_entry_responsible: 'manager', // 'manager' | 'seller'
    unit: '€' // Display unit
  });
  
  // Selected sellers for visibility
  const [selectedVisibleSellers, setSelectedVisibleSellers] = useState([]);
  
  // Dropdown state for seller selection
  const [isSellerDropdownOpen, setIsSellerDropdownOpen] = useState(false);
  const sellerDropdownRef = useRef(null);
  
  // Progress update state
  const [updatingProgressObjectiveId, setUpdatingProgressObjectiveId] = useState(null);
  const [progressValue, setProgressValue] = useState('');

  useEffect(() => {
    if (isOpen) {
      setActiveTab(modalType);
      fetchData();
    }
  }, [isOpen, modalType]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [configRes, objectivesRes, challengesRes, sellersRes] = await Promise.all([
        axios.get(`${API}/manager/kpi-config`, { headers }),
        axios.get(`${API}/manager/objectives`, { headers }),
        axios.get(`${API}/manager/challenges`, { headers }),
        axios.get(`${API}/manager/sellers`, { headers })
      ]);
      
      setKpiConfig(configRes.data);
      setObjectives(objectivesRes.data);
      setChallenges(challengesRes.data);
      setSellers(sellersRes.data);
    } catch (err) {
      console.error('Error fetching data:', err);
      toast.error('Erreur de chargement des données');
    } finally {
      setLoading(false);
    }
  };

  // Charger les données au montage du composant
  useEffect(() => {
    fetchData();
  }, []);

  // Close seller dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (sellerDropdownRef.current && !sellerDropdownRef.current.contains(event.target)) {
        setIsSellerDropdownOpen(false);
      }
    };

    if (isSellerDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSellerDropdownOpen]);

  // Close challenge seller dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (challengeSellerDropdownRef.current && !challengeSellerDropdownRef.current.contains(event.target)) {
        setIsChallengeSellerDropdownOpen(false);
      }
    };

    if (isChallengeSellerDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isChallengeSellerDropdownOpen]);


  // Pré-remplir les champs lors de l'édition d'un objectif - NEW SYSTEM
  useEffect(() => {
    if (editingObjective) {
      // Pré-remplir tous les champs de l'objectif
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
      
      // Pré-remplir les vendeurs visibles pour les objectifs collectifs
      if (editingObjective.type === 'collective' && editingObjective.visible_to_sellers && Array.isArray(editingObjective.visible_to_sellers)) {
        setSelectedVisibleSellers(editingObjective.visible_to_sellers);
      } else {
        setSelectedVisibleSellers([]);
      }
    } else {
      // Réinitialiser quand on quitte le mode édition
      setSelectedVisibleSellers([]);
      setNewObjective({
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
      });
    }
  }, [editingObjective]);

  // Pré-remplir les champs lors de l'édition d'un challenge - NEW SYSTEM
  useEffect(() => {
    if (editingChallenge) {
      // Pré-remplir tous les champs du challenge
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
      
      // Pré-remplir les vendeurs visibles pour les challenges collectifs
      if (editingChallenge.type === 'collective' && editingChallenge.visible_to_sellers && Array.isArray(editingChallenge.visible_to_sellers)) {
        setSelectedVisibleSellersChallenge(editingChallenge.visible_to_sellers);
      } else {
        setSelectedVisibleSellersChallenge([]);
      }
    } else {
      // Réinitialiser quand on quitte le mode édition
      setSelectedVisibleSellersChallenge([]);
      setNewChallenge({
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
      });
    }
  }, [editingChallenge]);

  const handleKPIConfigUpdate = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`${API}/manager/kpi-config`, kpiConfig, { headers });
      toast.success('Configuration KPI mise à jour');
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error('Error updating KPI config:', err);
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const handleCreateChallenge = async (e) => {
    e.preventDefault();
    try {
      // Build data with new flexible system (same as objectives)
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
      
      // Add seller_id if individual type
      if (newChallenge.type === 'individual' && newChallenge.seller_id) {
        cleanedData.seller_id = newChallenge.seller_id;
      }
      
      // Add visible_to_sellers if specific sellers selected
      if (newChallenge.visible && selectedVisibleSellersChallenge.length > 0) {
        cleanedData.visible_to_sellers = selectedVisibleSellersChallenge;
      }
      
      // Add specific fields based on challenge_type
      if (newChallenge.challenge_type === 'kpi_standard') {
        cleanedData.kpi_name = newChallenge.kpi_name;
      } else if (newChallenge.challenge_type === 'product_focus') {
        cleanedData.product_name = newChallenge.product_name;
      } else if (newChallenge.challenge_type === 'custom') {
        cleanedData.custom_description = newChallenge.custom_description;
      }
      
      await axios.post(`${API}/manager/challenges`, cleanedData, { headers });
      toast.success('Challenge créé avec succès');
      setNewChallenge({
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
      });
      setSelectedVisibleSellersChallenge([]);
      fetchData();
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error('Error creating challenge:', err);
      toast.error('Erreur lors de la création du challenge');
    }
  };

  const handleUpdateChallenge = async (e) => {
    e.preventDefault();
    try {
      // Build data with new flexible system from newChallenge state (which contains editingChallenge data)
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
      
      // Ajouter seller_id si type individual
      if (newChallenge.type === 'individual' && newChallenge.seller_id) {
        cleanedData.seller_id = newChallenge.seller_id;
      }
      
      // Ajouter visible_to_sellers si type collective
      if (newChallenge.type === 'collective') {
        cleanedData.visible_to_sellers = selectedVisibleSellersChallenge;
      }
      
      // Add specific fields based on challenge_type
      if (newChallenge.challenge_type === 'kpi_standard') {
        cleanedData.kpi_name = newChallenge.kpi_name;
      } else if (newChallenge.challenge_type === 'product_focus') {
        cleanedData.product_name = newChallenge.product_name;
      } else if (newChallenge.challenge_type === 'custom') {
        cleanedData.custom_description = newChallenge.custom_description;
      }
      
      await axios.put(`${API}/manager/challenges/${editingChallenge.id}`, cleanedData, { headers });
      toast.success('Challenge modifié avec succès');
      setEditingChallenge(null);
      
      // Forcer le rechargement des données
      await fetchData();
      
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error('Error updating challenge:', err);
      toast.error('Erreur lors de la modification du challenge');
    }
  };

  const handleDeleteChallenge = async (challengeId, challengeTitle) => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer le challenge "${challengeTitle}" ?`)) {
      try {
        await axios.delete(`${API}/manager/challenges/${challengeId}`, { headers });
        toast.success('Challenge supprimé avec succès');
        fetchData();
        if (onUpdate) onUpdate();
      } catch (err) {
        console.error('Error deleting challenge:', err);
        toast.error('Erreur lors de la suppression');
      }
    }
  };

  const handleUpdateChallengeProgress = async (challengeId) => {
    if (!challengeProgressValue || challengeProgressValue === '') {
      toast.error('Veuillez entrer une valeur');
      return;
    }

    try {
      await axios.post(
        `${API}/manager/challenges/${challengeId}/progress`,
        { current_value: parseFloat(challengeProgressValue) },
        { headers }
      );
      toast.success('Progression mise à jour avec succès');
      setUpdatingProgressChallengeId(null);
      setChallengeProgressValue('');
      fetchData();
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error('Error updating challenge progress:', err);
      toast.error(err.response?.data?.detail || 'Erreur lors de la mise à jour de la progression');
    }
  };



  const handleCreateObjective = async (e) => {
    e.preventDefault();
    try {
      // Build data with new flexible system
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
      
      // Add seller_id if individual type
      if (newObjective.type === 'individual' && newObjective.seller_id) {
        cleanedData.seller_id = newObjective.seller_id;
      }
      
      // Add visible_to_sellers if specific sellers selected
      if (newObjective.visible && selectedVisibleSellers.length > 0) {
        cleanedData.visible_to_sellers = selectedVisibleSellers;
      }
      
      // Add specific fields based on objective_type
      if (newObjective.objective_type === 'kpi_standard') {
        cleanedData.kpi_name = newObjective.kpi_name;
      } else if (newObjective.objective_type === 'product_focus') {
        cleanedData.product_name = newObjective.product_name;
      } else if (newObjective.objective_type === 'custom') {
        cleanedData.custom_description = newObjective.custom_description;
      }
      
      await axios.post(`${API}/manager/objectives`, cleanedData, { headers });
      toast.success('Objectif créé avec succès');
      setNewObjective({
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
      });
      setSelectedVisibleSellers([]);
      fetchData();
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error('Error creating objective:', err);
      toast.error('Erreur lors de la création de l\'objectif');
    }
  };

  const handleUpdateObjective = async (e) => {
    e.preventDefault();
    try {
      // Build data with new flexible system from newObjective state (which contains editingObjective data)
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
      
      // Ajouter seller_id si type individual
      if (newObjective.type === 'individual' && newObjective.seller_id) {
        cleanedData.seller_id = newObjective.seller_id;
      }
      
      // Ajouter visible_to_sellers si type collective
      if (newObjective.type === 'collective') {
        cleanedData.visible_to_sellers = selectedVisibleSellers;
      }
      
      // Add specific fields based on objective_type
      if (newObjective.objective_type === 'kpi_standard') {
        cleanedData.kpi_name = newObjective.kpi_name;
      } else if (newObjective.objective_type === 'product_focus') {
        cleanedData.product_name = newObjective.product_name;
      } else if (newObjective.objective_type === 'custom') {
        cleanedData.custom_description = newObjective.custom_description;
      }
      
      await axios.put(`${API}/manager/objectives/${editingObjective.id}`, cleanedData, { headers });
      toast.success('Objectif modifié avec succès');
      setEditingObjective(null);
      
      // Forcer le rechargement des données
      await fetchData();
      
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error('Error updating objective:', err);
      toast.error('Erreur lors de la modification de l\'objectif');
    }
  };

  const handleDeleteObjective = async (objectiveId) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cet objectif ?')) {
      try {
        await axios.delete(`${API}/manager/objectives/${objectiveId}`, { headers });
        toast.success('Objectif supprimé avec succès');
        fetchData();
        if (onUpdate) onUpdate();
      } catch (err) {
        console.error('Error deleting objective:', err);
        toast.error('Erreur lors de la suppression');
      }
    }
  };

  const handleUpdateProgress = async (objectiveId) => {
    if (!progressValue || progressValue === '') {
      toast.error('Veuillez entrer une valeur');
      return;
    }

    try {
      await axios.post(
        `${API}/manager/objectives/${objectiveId}/progress`,
        { current_value: parseFloat(progressValue) },
        { headers }
      );
      toast.success('Progression mise à jour avec succès');
      setUpdatingProgressObjectiveId(null);
      setProgressValue('');
      fetchData();
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error('Error updating progress:', err);
      toast.error(err.response?.data?.detail || 'Erreur lors de la mise à jour de la progression');
    }
  };

  if (!isOpen) return null;

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) { onClose(); } }} className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className={`sticky top-0 p-6 flex justify-between items-center border-b border-gray-200 ${
          modalType === 'objectives' 
            ? 'bg-gradient-to-r from-[#1E40AF] to-[#1E3A8A]' 
            : 'bg-gradient-to-r from-green-600 to-emerald-600'
        }`}>
          <div className="flex items-center gap-3">
            <Settings className="w-8 h-8 text-white" />
            <h2 className="text-3xl font-bold text-white">
              {modalType === 'objectives' ? '🎯 Objectifs' : '🏆 Challenges'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-100 transition-colors"
          >
            <X className="w-8 h-8" />
          </button>
        </div>

        {/* Tabs - Only show the tab corresponding to modalType */}
        <div className="flex border-b border-gray-200 bg-gray-50 px-6">
          {modalType === 'objectives' && (
            <button
              onClick={() => setActiveTab('objectives')}
              className="px-6 py-4 font-semibold transition-all border-b-4 border-[#1E40AF] text-gray-800"
            >
              🎯 Objectifs
            </button>
          )}
          {modalType === 'challenges' && (
            <button
              onClick={() => setActiveTab('challenges')}
              className="px-6 py-4 font-semibold transition-all border-b-4 border-[#1E40AF] text-gray-800"
            >
              🏆 Challenges
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-12">Chargement...</div>
          ) : (
            <>
              {/* KPI Configuration Tab */}
              {activeTab === 'kpi_deleted' && kpiConfig && (
                <form onSubmit={handleKPIConfigUpdate} className="space-y-6">
                  <div className="bg-blue-50 rounded-xl p-6 border-2 border-blue-200">
                    <h3 className="text-xl font-bold text-gray-800 mb-4">📈 KPI à suivre</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Sélectionnez les KPI que vos vendeurs devront renseigner quotidiennement
                    </p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <label className="flex items-center gap-3 p-4 bg-white rounded-lg border-2 border-gray-200 hover:border-blue-300 cursor-pointer transition-all">
                        <input
                          type="checkbox"
                          checked={kpiConfig.track_ca}
                          onChange={(e) => setKpiConfig({ ...kpiConfig, track_ca: e.target.checked })}
                          className="w-5 h-5 text-blue-600"
                        />
                        <div>
                          <p className="font-semibold text-gray-800">💰 Chiffre d'Affaires</p>
                          <p className="text-xs text-gray-500">CA journalier réalisé</p>
                        </div>
                      </label>

                      <label className="flex items-center gap-3 p-4 bg-white rounded-lg border-2 border-gray-200 hover:border-blue-300 cursor-pointer transition-all">
                        <input
                          type="checkbox"
                          checked={kpiConfig.track_ventes}
                          onChange={(e) => setKpiConfig({ ...kpiConfig, track_ventes: e.target.checked })}
                          className="w-5 h-5 text-blue-600"
                        />
                        <div>
                          <p className="font-semibold text-gray-800">🛍️ Nombre de Ventes</p>
                          <p className="text-xs text-gray-500">Transactions réalisées</p>
                        </div>
                      </label>

                      <label className="flex items-center gap-3 p-4 bg-white rounded-lg border-2 border-gray-200 hover:border-blue-300 cursor-pointer transition-all">
                        <input
                          type="checkbox"
                          checked={kpiConfig.track_articles}
                          onChange={(e) => setKpiConfig({ ...kpiConfig, track_articles: e.target.checked })}
                          className="w-5 h-5 text-blue-600"
                        />
                        <div>
                          <p className="font-semibold text-gray-800">📦 Nombre d'Articles</p>
                          <p className="text-xs text-gray-500">Articles vendus</p>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* KPI Calculés automatiquement */}
                  <div className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-xl p-6 border-2 border-purple-200">
                    <h3 className="text-xl font-bold text-purple-900 mb-4 flex items-center gap-2">
                      <span>🧮</span> KPI Calculés Automatiquement
                    </h3>
                    <p className="text-sm text-purple-700 mb-4">
                      En fonction de votre sélection, ces KPI seront automatiquement calculés :
                    </p>
                    
                    <div className="space-y-3">
                      {kpiConfig.track_ca && kpiConfig.track_ventes ? (
                        <div className="bg-white rounded-lg p-4 border-l-4 border-indigo-500 shadow-sm">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                              <span className="text-xl">🧮</span>
                            </div>
                            <div className="flex-1">
                              <p className="font-semibold text-indigo-900">Panier Moyen</p>
                              <p className="text-xs text-indigo-600">CA ÷ Nombre de Ventes</p>
                            </div>
                            <div className="px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full">
                              ✓ Actif
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-gray-50 rounded-lg p-4 border-l-4 border-gray-300 opacity-60">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                              <span className="text-xl">🧮</span>
                            </div>
                            <div className="flex-1">
                              <p className="font-semibold text-gray-600">Panier Moyen</p>
                              <p className="text-xs text-gray-500">Nécessite : CA + Nombre de Ventes</p>
                            </div>
                            <div className="px-3 py-1 bg-gray-200 text-gray-600 text-xs font-bold rounded-full">
                              Inactif
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-4 border-l-4 border-blue-400">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-200 rounded-full flex items-center justify-center">
                            <span className="text-xl">📊</span>
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-blue-900">Taux de Transformation</p>
                            <p className="text-xs text-blue-700">Calculé au niveau magasin (Ventes Équipe ÷ Prospects)</p>
                            <p className="text-xs text-blue-600 mt-1">→ Voir la section "KPI Magasin" pour le saisir</p>
                          </div>
                          <div className="px-3 py-1 bg-blue-200 text-blue-800 text-xs font-bold rounded-full">
                            Magasin
                          </div>
                        </div>
                      </div>

                      {kpiConfig.track_articles && kpiConfig.track_ventes ? (
                        <div className="bg-white rounded-lg p-4 border-l-4 border-teal-500 shadow-sm">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center">
                              <span className="text-xl">🎯</span>
                            </div>
                            <div className="flex-1">
                              <p className="font-semibold text-teal-900">Indice de Vente (UPT)</p>
                              <p className="text-xs text-teal-600">Articles ÷ Ventes</p>
                            </div>
                            <div className="px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full">
                              ✓ Actif
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-gray-50 rounded-lg p-4 border-l-4 border-gray-300 opacity-60">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                              <span className="text-xl">🎯</span>
                            </div>
                            <div className="flex-1">
                              <p className="font-semibold text-gray-600">Indice de Vente (UPT)</p>
                              <p className="text-xs text-gray-500">Nécessite : Nombre d'Articles + Nombre de Ventes</p>
                            </div>
                            <div className="px-3 py-1 bg-gray-200 text-gray-600 text-xs font-bold rounded-full">
                              Inactif
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-gradient-to-r from-[#1E40AF] to-[#1E3A8A] text-white font-bold py-3 px-6 rounded-xl hover:shadow-lg transition-all"
                  >
                    💾 Enregistrer la Configuration
                  </button>
                </form>
              )}

              {/* Objectives Tab */}
              {activeTab === 'objectives' && (
                <div className="space-y-6">
                  {/* Create/Edit Objective Form */}
                  <div id="objective-form-section" className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 border-2 border-purple-300">
                    <h3 className="text-xl font-bold text-gray-800 mb-4">
                      {editingObjective ? '✏️ Modifier l\'Objectif' : '➕ Créer un Objectif'}
                    </h3>
                    
                    <form onSubmit={editingObjective ? handleUpdateObjective : handleCreateObjective} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                          <div className="flex items-center gap-2 mb-2">
                            <label className="block text-sm font-semibold text-gray-700">Nom de l'objectif *</label>
                            <div className="group relative">
                              <div className="w-5 h-5 bg-purple-500 text-white rounded-full flex items-center justify-center text-xs font-bold cursor-help hover:bg-purple-600 transition-all">
                                ?
                              </div>
                              <div className="invisible group-hover:visible absolute left-0 top-7 z-10 w-72 p-3 bg-purple-600 text-white text-sm rounded-lg shadow-2xl border-2 border-purple-400">
                                <div className="font-semibold mb-1">💡 Conseil :</div>
                                Donnez un nom à votre objectif (ex: "Objectifs Décembre 2025", "Q1 2025")
                              </div>
                            </div>
                          </div>
                          <input
                            type="text"
                            required
                            value={newObjective.title}
                            onChange={(e) => setNewObjective({ ...newObjective, title: e.target.value })}
                            className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-purple-400 focus:outline-none"
                            placeholder="Ex: Objectifs Décembre 2025"
                          />
                        </div>


                        {/* Description de l'objectif */}
                        <div className="md:col-span-2">
                          <label className="block text-sm font-semibold text-gray-700 mb-2">Description (optionnel)</label>
                          <textarea
                            rows="2"
                            value={newObjective.description}
                            onChange={(e) => setNewObjective({ ...newObjective, description: e.target.value })}
                            className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-purple-400 focus:outline-none resize-none"
                            placeholder="Décrivez brièvement cet objectif..."
                          />
                        </div>


                        {/* Type d'objectif */}
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">Type d'objectif *</label>
                          <select
                            value={newObjective.type}
                            onChange={(e) => {
                              const newType = e.target.value;
                              setNewObjective({ ...newObjective, type: newType, seller_id: newType === 'collective' ? '' : newObjective.seller_id });
                            }}
                            className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-purple-400 focus:outline-none"
                          >
                            <option value="collective">👥 Objectif d'Équipe</option>
                            <option value="individual">👤 Objectif Individuel</option>
                          </select>
                        </div>

                        {/* Seller selection for individual objectives */}
                        {newObjective.type === 'individual' && (
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Vendeur *</label>
                            <select
                              required
                              value={newObjective.seller_id}
                              onChange={(e) => setNewObjective({ ...newObjective, seller_id: e.target.value })}
                              className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-purple-400 focus:outline-none"
                            >
                              <option value="">Sélectionner un vendeur</option>
                              {sellers.map((seller) => (
                                <option key={seller.id} value={seller.id}>
                                  {seller.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {/* Visibilité - Layout horizontal */}
                        <div className="md:col-span-2">
                          <div className="flex items-start gap-4">
                            {/* Checkbox Visible */}
                            <label className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg border-2 border-blue-200 cursor-pointer hover:bg-blue-100 transition-all flex-shrink-0">
                              <input
                                type="checkbox"
                                checked={newObjective.visible !== false}
                                onChange={(e) => {
                                  const isChecked = e.target.checked;
                                  setNewObjective({ ...newObjective, visible: isChecked });
                                  if (!isChecked) {
                                    setSelectedVisibleSellers([]);
                                    setIsSellerDropdownOpen(false);
                                  }
                                }}
                                className="w-5 h-5 text-blue-600"
                              />
                              <div>
                                <p className="font-semibold text-gray-800">👁️ Visible par les vendeurs</p>
                                <p className="text-xs text-gray-600">Si coché, les vendeurs pourront voir cet objectif</p>
                              </div>
                            </label>
                            
                            {/* Seller selection dropdown - only for collective objectives */}
                            {newObjective.visible !== false && newObjective.type === 'collective' && (
                              <div className="flex-1 p-4 bg-green-50 rounded-lg border-2 border-green-200">
                                <div className="flex items-center justify-between mb-3">
                                  <p className="text-sm font-semibold text-gray-800">👥 Sélectionner les vendeurs (optionnel)</p>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (selectedVisibleSellers.length === sellers.length) {
                                        setSelectedVisibleSellers([]);
                                      } else {
                                        setSelectedVisibleSellers(sellers.map(s => s.id));
                                      }
                                    }}
                                    className="text-xs px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all"
                                  >
                                    {selectedVisibleSellers.length === sellers.length ? 'Tout désélectionner' : 'Tout sélectionner'}
                                  </button>
                                </div>
                                <p className="text-xs text-gray-600 mb-3">
                                  Si aucun vendeur n'est sélectionné, tous les vendeurs verront cet objectif
                                </p>
                                
                                {/* Custom Dropdown with Checkboxes */}
                                <div className="relative" ref={sellerDropdownRef}>
                                  <button
                                    type="button"
                                    onClick={() => setIsSellerDropdownOpen(!isSellerDropdownOpen)}
                                    className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-green-400 focus:outline-none bg-white text-left flex items-center justify-between hover:border-green-300 transition-all"
                                  >
                                    <span className="text-gray-700">
                                      {selectedVisibleSellers.length === 0 
                                        ? 'Sélectionner les vendeurs...' 
                                        : `${selectedVisibleSellers.length} vendeur${selectedVisibleSellers.length > 1 ? 's' : ''} sélectionné${selectedVisibleSellers.length > 1 ? 's' : ''}`
                                      }
                                    </span>
                                    <svg 
                                      className={`w-5 h-5 text-gray-500 transition-transform ${isSellerDropdownOpen ? 'rotate-180' : ''}`}
                                      fill="none" 
                                      stroke="currentColor" 
                                      viewBox="0 0 24 24"
                                    >
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                  </button>
                                  
                                  {isSellerDropdownOpen && (
                                    <div className="absolute z-10 w-full mt-2 bg-white border-2 border-green-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                      {sellers.map((seller) => (
                                        <label
                                          key={seller.id}
                                          className="flex items-center gap-3 p-3 hover:bg-green-50 cursor-pointer transition-colors border-b border-gray-100 last:border-b-0"
                                        >
                                          <input
                                            type="checkbox"
                                            checked={selectedVisibleSellers.includes(seller.id)}
                                            onChange={(e) => {
                                              if (e.target.checked) {
                                                setSelectedVisibleSellers([...selectedVisibleSellers, seller.id]);
                                              } else {
                                                setSelectedVisibleSellers(selectedVisibleSellers.filter(id => id !== seller.id));
                                              }
                                            }}
                                            className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                                          />
                                          <span className="text-sm text-gray-700 font-medium">{seller.name}</span>
                                        </label>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                
                                {/* Selected sellers badges */}
                                {selectedVisibleSellers.length > 0 && (
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {selectedVisibleSellers.map(sellerId => {
                                      const seller = sellers.find(s => s.id === sellerId);
                                      return seller ? (
                                        <span 
                                          key={sellerId}
                                          className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 text-sm font-semibold rounded-full"
                                        >
                                          {seller.name}
                                          <button
                                            type="button"
                                            onClick={() => setSelectedVisibleSellers(selectedVisibleSellers.filter(id => id !== sellerId))}
                                            className="ml-1 hover:text-green-900 font-bold text-lg leading-none"
                                          >
                                            ×
                                          </button>
                                        </span>
                                      ) : null;
                                    })}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <label className="block text-sm font-semibold text-gray-700">Période de début *</label>
                            <div className="group relative">
                              <div className="w-5 h-5 bg-purple-500 text-white rounded-full flex items-center justify-center text-xs font-bold cursor-help hover:bg-purple-600 transition-all">
                                ?
                              </div>
                              <div className="invisible group-hover:visible absolute left-0 top-7 z-10 w-72 p-3 bg-purple-600 text-white text-sm rounded-lg shadow-2xl border-2 border-purple-400">
                                <div className="font-semibold mb-1">📅 Début de période :</div>
                                Date de début pour la mesure des objectifs (ex: 1er du mois)
                              </div>
                            </div>
                          </div>
                          <input
                            type="date"
                            required
                            value={newObjective.period_start}
                            onChange={(e) => setNewObjective({ ...newObjective, period_start: e.target.value })}
                            onFocus={(e) => {
                              // Ouvrir le calendrier au focus
                              try {
                                if (typeof e.target.showPicker === 'function') {
                                  e.target.showPicker();
                                }
                              } catch (error) {
                                // showPicker n'est pas supporté par ce navigateur
                                console.log('showPicker not supported');
                              }
                            }}
                            className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-purple-400 focus:outline-none cursor-pointer"
                          />
                        </div>

                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <label className="block text-sm font-semibold text-gray-700">Période de fin *</label>
                            <div className="group relative">
                              <div className="w-5 h-5 bg-purple-500 text-white rounded-full flex items-center justify-center text-xs font-bold cursor-help hover:bg-purple-600 transition-all">
                                ?
                              </div>
                              <div className="invisible group-hover:visible absolute left-0 top-7 z-10 w-72 p-3 bg-purple-600 text-white text-sm rounded-lg shadow-2xl border-2 border-purple-400">
                                <div className="font-semibold mb-1">📅 Fin de période :</div>
                                Date de fin de la période de mesure (ex: dernier jour du mois)
                              </div>
                            </div>
                          </div>
                          <input
                            type="date"
                            required
                            min={newObjective.period_start}
                            value={newObjective.period_end}
                            onChange={(e) => setNewObjective({ ...newObjective, period_end: e.target.value })}
                            onFocus={(e) => {
                              // Ouvrir le calendrier au focus
                              try {
                                if (typeof e.target.showPicker === 'function') {
                                  e.target.showPicker();
                                }
                              } catch (error) {
                                // showPicker n'est pas supporté par ce navigateur
                                console.log('showPicker not supported');
                              }
                            }}
                            className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-purple-400 focus:outline-none cursor-pointer"
                          />
                        </div>

                        {/* NEW FLEXIBLE OBJECTIVE SYSTEM */}
                        <div className="md:col-span-2">
                          <div className="mb-3">
                            <h4 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                              <span className="text-lg">🎯</span>
                              Type d'objectif
                            </h4>
                          </div>
                          
                          {/* Objective Type Selection - Horizontal Radio Buttons */}
                          <div className="mb-4 flex flex-wrap gap-3">
                            <label className={`flex items-center gap-2 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                              newObjective.objective_type === 'kpi_standard'
                                ? 'bg-blue-50 border-blue-500 shadow-md'
                                : 'bg-white border-gray-300 hover:border-blue-300'
                            }`}>
                              <input
                                type="radio"
                                name="objective_type"
                                value="kpi_standard"
                                checked={newObjective.objective_type === 'kpi_standard'}
                                onChange={(e) => {
                                  const newType = e.target.value;
                                  setNewObjective({ 
                                    ...newObjective, 
                                    objective_type: newType,
                                    unit: newObjective.kpi_name === 'ca' ? '€' : 
                                          newObjective.kpi_name === 'ventes' ? 'ventes' :
                                          newObjective.kpi_name === 'articles' ? 'articles' : ''
                                  });
                                }}
                                className="w-4 h-4 text-blue-600"
                              />
                              <span className={`font-semibold ${
                                newObjective.objective_type === 'kpi_standard' ? 'text-blue-700' : 'text-gray-700'
                              }`}>
                                📊 KPI Standard
                              </span>
                            </label>

                            <label className={`flex items-center gap-2 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                              newObjective.objective_type === 'product_focus'
                                ? 'bg-green-50 border-green-500 shadow-md'
                                : 'bg-white border-gray-300 hover:border-green-300'
                            }`}>
                              <input
                                type="radio"
                                name="objective_type"
                                value="product_focus"
                                checked={newObjective.objective_type === 'product_focus'}
                                onChange={(e) => {
                                  setNewObjective({ 
                                    ...newObjective, 
                                    objective_type: e.target.value,
                                    unit: ''
                                  });
                                }}
                                className="w-4 h-4 text-green-600"
                              />
                              <span className={`font-semibold ${
                                newObjective.objective_type === 'product_focus' ? 'text-green-700' : 'text-gray-700'
                              }`}>
                                📦 Focus Produit
                              </span>
                            </label>

                            <label className={`flex items-center gap-2 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                              newObjective.objective_type === 'custom'
                                ? 'bg-purple-50 border-purple-500 shadow-md'
                                : 'bg-white border-gray-300 hover:border-purple-300'
                            }`}>
                              <input
                                type="radio"
                                name="objective_type"
                                value="custom"
                                checked={newObjective.objective_type === 'custom'}
                                onChange={(e) => {
                                  setNewObjective({ 
                                    ...newObjective, 
                                    objective_type: e.target.value,
                                    unit: ''
                                  });
                                }}
                                className="w-4 h-4 text-purple-600"
                              />
                              <span className={`font-semibold ${
                                newObjective.objective_type === 'custom' ? 'text-purple-700' : 'text-gray-700'
                              }`}>
                                ✨ Autre (personnalisé)
                              </span>
                            </label>
                          </div>

                          {/* Conditional Fields Based on Objective Type */}
                          {newObjective.objective_type === 'kpi_standard' && (
                            <div className="mb-4 bg-blue-50 rounded-lg p-4 border-2 border-blue-200">
                              <label className="block text-sm font-semibold text-gray-700 mb-2">KPI à cibler *</label>
                              <select
                                required
                                value={newObjective.kpi_name}
                                onChange={(e) => {
                                  const kpiName = e.target.value;
                                  let unit = '';
                                  if (kpiName === 'ca') unit = '€';
                                  else if (kpiName === 'ventes') unit = 'ventes';
                                  else if (kpiName === 'articles') unit = 'articles';
                                  setNewObjective({ ...newObjective, kpi_name: kpiName, unit });
                                }}
                                className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-blue-400 focus:outline-none"
                              >
                                <option value="ca">💰 Chiffre d'affaires</option>
                                <option value="ventes">🛍️ Nombre de ventes</option>
                                <option value="articles">📦 Nombre d'articles</option>
                              </select>
                            </div>
                          )}

                          {newObjective.objective_type === 'product_focus' && (
                            <div className="mb-4 bg-green-50 rounded-lg p-4 border-2 border-green-200">
                              <label className="block text-sm font-semibold text-gray-700 mb-2">Nom du produit *</label>
                              <input
                                type="text"
                                required
                                value={newObjective.product_name}
                                onChange={(e) => setNewObjective({ ...newObjective, product_name: e.target.value })}
                                className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-green-400 focus:outline-none"
                                placeholder="Ex: iPhone 15, Samsung Galaxy, MacBook Air..."
                              />
                              <p className="text-xs text-gray-600 mt-2">📦 Indiquez le produit sur lequel vous souhaitez vous concentrer</p>
                            </div>
                          )}

                          {newObjective.objective_type === 'custom' && (
                            <div className="mb-4 bg-purple-50 rounded-lg p-4 border-2 border-purple-200">
                              <label className="block text-sm font-semibold text-gray-700 mb-2">Description de l'objectif *</label>
                              <textarea
                                required
                                rows="3"
                                value={newObjective.custom_description}
                                onChange={(e) => setNewObjective({ ...newObjective, custom_description: e.target.value })}
                                className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-purple-400 focus:outline-none"
                                placeholder="Ex: Améliorer la satisfaction client, Augmenter les ventes croisées..."
                              />
                              <p className="text-xs text-gray-600 mt-2">✨ Décrivez votre objectif personnalisé</p>
                            </div>
                          )}

                          {/* Target Value */}
                          <div className="grid grid-cols-2 gap-3 mb-4">
                            <div>
                              <label className="block text-sm font-semibold text-gray-700 mb-2">Valeur cible *</label>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                required
                                value={newObjective.target_value}
                                onChange={(e) => setNewObjective({ ...newObjective, target_value: e.target.value })}
                                className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-purple-400 focus:outline-none"
                                placeholder="Ex: 50000"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-semibold text-gray-700 mb-2">Unité (optionnel)</label>
                              <input
                                type="text"
                                value={newObjective.unit}
                                onChange={(e) => setNewObjective({ ...newObjective, unit: e.target.value })}
                                className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-purple-400 focus:outline-none"
                                placeholder="€, ventes, %..."
                              />
                            </div>
                          </div>

                          {/* Data Entry Responsible - TOGGLES STYLE MAGASIN */}
                          <div className="bg-gradient-to-r from-orange-50 to-orange-100 rounded-lg p-4 border-2 border-orange-200">
                            <label className="block text-sm font-semibold text-gray-800 mb-3">
                              📝 Qui saisit la progression ? *
                            </label>
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => setNewObjective({ ...newObjective, data_entry_responsible: 'seller' })}
                                className={`w-12 h-8 rounded font-bold text-xs transition-all ${
                                  newObjective.data_entry_responsible === 'seller' 
                                    ? 'bg-cyan-500 text-white shadow-lg' 
                                    : 'bg-gray-200 text-gray-500'
                                }`}
                                title="Vendeur"
                              >
                                🧑‍💼
                              </button>
                              <span className={`text-sm font-medium ${
                                newObjective.data_entry_responsible === 'seller' ? 'text-cyan-700' : 'text-gray-500'
                              }`}>
                                Vendeur
                              </span>
                              
                              <div className="mx-4 h-8 w-px bg-gray-300"></div>
                              
                              <button
                                type="button"
                                onClick={() => setNewObjective({ ...newObjective, data_entry_responsible: 'manager' })}
                                className={`w-12 h-8 rounded font-bold text-xs transition-all ${
                                  newObjective.data_entry_responsible === 'manager' 
                                    ? 'bg-orange-500 text-white shadow-lg' 
                                    : 'bg-gray-200 text-gray-500'
                                }`}
                                title="Manager"
                              >
                                👨‍💼
                              </button>
                              <span className={`text-sm font-medium ${
                                newObjective.data_entry_responsible === 'manager' ? 'text-orange-700' : 'text-gray-500'
                              }`}>
                                Manager
                              </span>
                            </div>
                            <p className="text-xs text-gray-600 mt-3">
                              {newObjective.data_entry_responsible === 'seller' 
                                ? '🧑‍💼 Le vendeur pourra saisir la progression de cet objectif'
                                : '👨‍💼 Vous (manager) saisirez la progression de cet objectif'}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <button
                          type="submit"
                          className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold py-3 px-6 rounded-xl hover:shadow-lg transition-all"
                        >
                          {editingObjective ? '💾 Enregistrer les modifications' : '➕ Créer l\'Objectif'}
                        </button>
                        {editingObjective && (
                          <button
                            type="button"
                            onClick={() => setEditingObjective(null)}
                            className="px-6 py-3 bg-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-300 transition-all"
                          >
                            Annuler
                          </button>
                        )}
                      </div>
                    </form>
                  </div>

                  {/* Objectives List */}
                  <div className="bg-white rounded-xl p-6 border-2 border-gray-200">
                    <h3 className="text-xl font-bold text-gray-800 mb-4">📋 Liste des Objectifs</h3>
                    
                    {objectives.length === 0 ? (
                      <p className="text-center text-gray-500 py-8">Aucun objectif créé pour le moment</p>
                    ) : (
                      <div className="space-y-3">
                        {objectives.map((objective) => (
                          <div
                            key={objective.id}
                            className="bg-purple-50 rounded-lg p-4 border-2 border-purple-200 hover:border-purple-400 transition-all"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <h4 className="font-bold text-gray-800 text-lg">
                                    🎯 {objective.title}
                                  </h4>
                                  {/* Type badge */}
                                  <span className={`text-xs font-semibold px-2 py-1 rounded ${
                                    objective.type === 'collective' 
                                      ? 'bg-blue-100 text-blue-700' 
                                      : 'bg-orange-100 text-orange-700'
                                  }`}>
                                    {objective.type === 'collective' ? '👥 Collectif' : (
                                      objective.seller_id ? 
                                        `👤 ${sellers.find(s => s.id === objective.seller_id)?.name || 'Individuel'}` 
                                        : '👤 Individuel'
                                    )}
                                  </span>
                                  {/* Visibility badge */}
                                  <span className={`text-xs font-semibold px-2 py-1 rounded ${
                                    objective.visible === false
                                      ? 'bg-gray-100 text-gray-600' 
                                      : 'bg-green-100 text-green-700'
                                  }`}>
                                    {objective.visible === false ? '🔒 Non visible' : 
                                      objective.visible_to_sellers && objective.visible_to_sellers.length > 0
                                        ? `👁️ ${objective.visible_to_sellers.length} vendeur${objective.visible_to_sellers.length > 1 ? 's' : ''}`
                                        : '👁️ Tous les vendeurs'
                                    }
                                  </span>
                                  {/* Status badge */}
                                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                                    objective.status === 'achieved'
                                      ? 'bg-green-500 text-white shadow-lg' 
                                      : objective.status === 'failed'
                                      ? 'bg-red-500 text-white shadow-lg'
                                      : 'bg-yellow-400 text-gray-800 shadow-md'
                                  }`}>
                                    {objective.status === 'achieved' ? '✅ Réussi' : 
                                      objective.status === 'failed' ? '❌ Raté' : '⏳ En cours'}
                                  </span>
                                </div>
                                <div className="text-sm text-gray-600 mb-2">
                                  📅 Période: {new Date(objective.period_start).toLocaleDateString('fr-FR')} - {new Date(objective.period_end).toLocaleDateString('fr-FR')}
                                </div>
                                {/* Show specific sellers if any */}
                                {objective.visible && objective.visible_to_sellers && objective.visible_to_sellers.length > 0 && (
                                  <div className="text-xs text-gray-600 mb-2">
                                    👤 Visible pour : {objective.visible_to_sellers.map(sellerId => {
                                      const seller = sellers.find(s => s.id === sellerId);
                                      return seller ? seller.name : 'Inconnu';
                                    }).join(', ')}
                                  </div>
                                )}
                                
                                {/* NEW OBJECTIVE SYSTEM DISPLAY */}
                                <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-3 mb-3">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      {objective.objective_type === 'kpi_standard' && (
                                        <span className="text-sm font-semibold text-blue-700">
                                          📊 KPI: {
                                            objective.kpi_name === 'ca' ? '💰 Chiffre d\'affaires' :
                                            objective.kpi_name === 'ventes' ? '🛍️ Nombre de ventes' :
                                            objective.kpi_name === 'articles' ? '📦 Nombre d\'articles' :
                                            objective.kpi_name
                                          }
                                        </span>
                                      )}
                                      {objective.objective_type === 'product_focus' && (
                                        <span className="text-sm font-semibold text-green-700">
                                          📦 Produit: {objective.product_name}
                                        </span>
                                      )}
                                      {objective.objective_type === 'custom' && (
                                        <span className="text-sm font-semibold text-purple-700">
                                          ✨ Objectif personnalisé
                                        </span>
                                      )}
                                    </div>
                                    <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                                      objective.data_entry_responsible === 'seller' 
                                        ? 'bg-cyan-500 text-white' 
                                        : 'bg-orange-500 text-white'
                                    }`}>
                                      {objective.data_entry_responsible === 'seller' ? '🧑‍💼 Vendeur' : '👨‍💼 Manager'}
                                    </span>
                                  </div>
                                  
                                  {objective.objective_type === 'custom' && objective.custom_description && (
                                    <p className="text-xs text-gray-600 mb-2">{objective.custom_description}</p>
                                  )}
                                  
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm font-semibold text-gray-700">
                                      🎯 Cible: {objective.target_value?.toLocaleString('fr-FR')} {objective.unit || ''}
                                    </span>
                                    <span className="text-sm font-semibold text-gray-700">
                                      📊 Actuel: {(objective.current_value || 0)?.toLocaleString('fr-FR')} {objective.unit || ''}
                                    </span>
                                  </div>
                                  
                                  {/* Progress Bar */}
                                  <div className="mt-2">
                                    <div className="w-full bg-gray-200 rounded-full h-3">
                                      <div 
                                        className={`h-3 rounded-full transition-all duration-300 ${
                                          ((objective.current_value || 0) / objective.target_value) * 100 >= 75 ? 'bg-green-500' :
                                          ((objective.current_value || 0) / objective.target_value) * 100 >= 50 ? 'bg-yellow-500' :
                                          ((objective.current_value || 0) / objective.target_value) * 100 >= 25 ? 'bg-orange-500' :
                                          'bg-red-500'
                                        }`}
                                        style={{ width: `${Math.min(Math.round(((objective.current_value || 0) / objective.target_value) * 100), 100)}%` }}
                                      ></div>
                                    </div>
                                    <div className="text-xs text-gray-600 text-center mt-1">
                                      {Math.min(Math.round(((objective.current_value || 0) / objective.target_value) * 100), 100)}% atteint
                                    </div>
                                  </div>
                                  
                                  {/* Progress Update Button - Only for responsible user */}
                                  {objective.data_entry_responsible === 'manager' && (
                                    <div className="mt-3">
                                      {updatingProgressObjectiveId === objective.id ? (
                                        <div className="flex items-center gap-2">
                                          <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={progressValue}
                                            onChange={(e) => setProgressValue(e.target.value)}
                                            placeholder={`Nouvelle valeur (${objective.unit || ''})`}
                                            className="flex-1 p-2 border-2 border-purple-300 rounded-lg focus:border-purple-500 focus:outline-none"
                                            autoFocus
                                          />
                                          <button
                                            onClick={() => handleUpdateProgress(objective.id)}
                                            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all font-semibold"
                                          >
                                            ✅ Valider
                                          </button>
                                          <button
                                            onClick={() => {
                                              setUpdatingProgressObjectiveId(null);
                                              setProgressValue('');
                                            }}
                                            className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-all"
                                          >
                                            ❌
                                          </button>
                                        </div>
                                      ) : (
                                        <button
                                          onClick={() => {
                                            setUpdatingProgressObjectiveId(objective.id);
                                            setProgressValue(objective.current_value?.toString() || '0');
                                          }}
                                          className="w-full px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg hover:from-orange-600 hover:to-orange-700 transition-all font-semibold flex items-center justify-center gap-2"
                                        >
                                          📝 Mettre à jour la progression
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="flex gap-2 ml-4">
                                <button
                                  onClick={() => {
                                    setEditingObjective(objective);
                                    // Scroll vers le formulaire d'objectif
                                    setTimeout(() => {
                                      const objectiveSection = document.querySelector('#objective-form-section');
                                      if (objectiveSection) {
                                        objectiveSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                      }
                                    }, 100);
                                  }}
                                  className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-2 rounded transition-all"
                                  title="Modifier"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteObjective(objective.id)}
                                  className="text-red-600 hover:text-red-800 hover:bg-red-50 p-2 rounded transition-all"
                                  title="Supprimer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Challenges Tab */}
              {activeTab === 'challenges' && (
                <div className="space-y-6">
                  {/* Create/Edit Challenge Form */}
                  <div id="challenge-form-section" className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border-2 border-green-300">
                    <h3 className="text-xl font-bold text-gray-800 mb-4">
                      {editingChallenge ? '✏️ Modifier le Challenge' : '➕ Créer un Challenge'}
                    </h3>
                    
                    <form onSubmit={editingChallenge ? handleUpdateChallenge : handleCreateChallenge} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                          <div className="flex items-center gap-2 mb-2">
                            <label className="block text-sm font-semibold text-gray-700">Titre *</label>
                            <div className="group relative">
                              <div className="w-5 h-5 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold cursor-help hover:bg-blue-600 transition-all">
                                ?
                              </div>
                              <div className="invisible group-hover:visible absolute left-0 top-7 z-10 w-72 p-3 bg-blue-600 text-white text-sm rounded-lg shadow-2xl border-2 border-blue-400">
                                <div className="font-semibold mb-1">💡 Conseil :</div>
                                Donnez un nom accrocheur à votre challenge (ex: "Challenge Parfums", "Top Vendeur du Mois")
                              </div>
                            </div>
                          </div>
                          <input
                            type="text"
                            required
                            value={newChallenge.title}
                            onChange={(e) => setNewChallenge({ ...newChallenge, title: e.target.value })}
                            className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-[#ffd871] focus:outline-none"
                            placeholder="Ex: Challenge Parfums"
                          />
                        </div>

                        {/* Description du challenge */}
                        <div className="md:col-span-2">
                          <label className="block text-sm font-semibold text-gray-700 mb-2">Description (optionnel)</label>
                          <textarea
                            rows="2"
                            value={newChallenge.description}
                            onChange={(e) => setNewChallenge({ ...newChallenge, description: e.target.value })}
                            className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-yellow-400 focus:outline-none resize-none"
                            placeholder="Décrivez brièvement ce challenge..."
                          />
                        </div>

                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <label className="block text-sm font-semibold text-gray-700">Type *</label>
                            <div className="group relative">
                              <div className="w-5 h-5 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold cursor-help hover:bg-blue-600 transition-all">
                                ?
                              </div>
                              <div className="invisible group-hover:visible absolute left-0 top-7 z-10 w-80 p-3 bg-blue-600 text-white text-sm rounded-lg shadow-2xl border-2 border-blue-400">
                                <div className="font-semibold mb-2">🎯 Différence entre les types :</div>
                                <div className="space-y-2">
                                  <div><strong>🏆 Collectif :</strong> Toute l'équipe travaille ensemble vers l'objectif commun</div>
                                  <div><strong>👤 Individuel :</strong> Challenge personnel pour un vendeur spécifique</div>
                                </div>
                              </div>
                            </div>
                          </div>
                          <select
                            required
                            value={editingChallenge ? editingChallenge.type : newChallenge.type}
                            onChange={(e) => editingChallenge
                              ? setEditingChallenge({ ...editingChallenge, type: e.target.value, seller_id: '' })
                              : setNewChallenge({ ...newChallenge, type: e.target.value, seller_id: '' })
                            }
                            className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-[#ffd871] focus:outline-none"
                          >
                            <option value="collective">🏆 Collectif (toute l'équipe)</option>
                            <option value="individual">👤 Individuel (un vendeur)</option>
                          </select>
                        </div>

                        {(editingChallenge?.type === 'individual' || newChallenge.type === 'individual') && (
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Vendeur *</label>
                            <select
                              required
                              value={editingChallenge ? editingChallenge.seller_id : newChallenge.seller_id}
                              onChange={(e) => editingChallenge
                                ? setEditingChallenge({ ...editingChallenge, seller_id: e.target.value })
                                : setNewChallenge({ ...newChallenge, seller_id: e.target.value })
                              }
                              className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-[#ffd871] focus:outline-none"
                            >
                              <option value="">Sélectionner un vendeur</option>
                              {sellers.map((seller) => (
                                <option key={seller.id} value={seller.id}>
                                  {seller.name} ({seller.email})
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {/* Visibilité - Layout horizontal (same as objectives) */}
                        <div className="md:col-span-2">
                          <div className="flex items-start gap-4">
                            {/* Checkbox Visible */}
                            <label className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg border-2 border-blue-200 cursor-pointer hover:bg-blue-100 transition-all flex-shrink-0">
                              <input
                                type="checkbox"
                                checked={newChallenge.visible !== false}
                                onChange={(e) => {
                                  const isChecked = e.target.checked;
                                  setNewChallenge({ ...newChallenge, visible: isChecked });
                                  if (!isChecked) {
                                    setSelectedVisibleSellersChallenge([]);
                                    setIsChallengeSellerDropdownOpen(false);
                                  }
                                }}
                                className="w-5 h-5 text-blue-600"
                              />
                              <div>
                                <p className="font-semibold text-gray-800">👁️ Visible par les vendeurs</p>
                                <p className="text-xs text-gray-600">Si coché, les vendeurs pourront voir ce challenge</p>
                              </div>
                            </label>
                            
                            {/* Seller selection dropdown - only for collective challenges */}
                            {newChallenge.visible !== false && newChallenge.type === 'collective' && (
                              <div className="flex-1 p-4 bg-green-50 rounded-lg border-2 border-green-200">
                                <div className="flex items-center justify-between mb-3">
                                  <p className="text-sm font-semibold text-gray-800">👥 Sélectionner les vendeurs (optionnel)</p>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (selectedVisibleSellersChallenge.length === sellers.length) {
                                        setSelectedVisibleSellersChallenge([]);
                                      } else {
                                        setSelectedVisibleSellersChallenge(sellers.map(s => s.id));
                                      }
                                    }}
                                    className="text-xs px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all"
                                  >
                                    {selectedVisibleSellersChallenge.length === sellers.length ? 'Tout désélectionner' : 'Tout sélectionner'}
                                  </button>
                                </div>
                                <p className="text-xs text-gray-600 mb-3">
                                  Si aucun vendeur n'est sélectionné, tous les vendeurs verront ce challenge
                                </p>
                                
                                {/* Custom Dropdown with Checkboxes */}
                                <div className="relative" ref={challengeSellerDropdownRef}>
                                  <button
                                    type="button"
                                    onClick={() => setIsChallengeSellerDropdownOpen(!isChallengeSellerDropdownOpen)}
                                    className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-green-400 focus:outline-none bg-white text-left flex items-center justify-between hover:border-green-300 transition-all"
                                  >
                                    <span className="text-gray-700">
                                      {selectedVisibleSellersChallenge.length === 0 
                                        ? 'Sélectionner les vendeurs...' 
                                        : `${selectedVisibleSellersChallenge.length} vendeur${selectedVisibleSellersChallenge.length > 1 ? 's' : ''} sélectionné${selectedVisibleSellersChallenge.length > 1 ? 's' : ''}`
                                      }
                                    </span>
                                    <svg 
                                      className={`w-5 h-5 text-gray-500 transition-transform ${isChallengeSellerDropdownOpen ? 'rotate-180' : ''}`}
                                      fill="none" 
                                      stroke="currentColor" 
                                      viewBox="0 0 24 24"
                                    >
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                  </button>
                                  
                                  {isChallengeSellerDropdownOpen && (
                                    <div className="absolute z-10 w-full mt-2 bg-white border-2 border-green-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                      {sellers.map((seller) => (
                                        <label
                                          key={seller.id}
                                          className="flex items-center gap-3 p-3 hover:bg-green-50 cursor-pointer transition-colors border-b border-gray-100 last:border-b-0"
                                        >
                                          <input
                                            type="checkbox"
                                            checked={selectedVisibleSellersChallenge.includes(seller.id)}
                                            onChange={(e) => {
                                              if (e.target.checked) {
                                                setSelectedVisibleSellersChallenge([...selectedVisibleSellersChallenge, seller.id]);
                                              } else {
                                                setSelectedVisibleSellersChallenge(selectedVisibleSellersChallenge.filter(id => id !== seller.id));
                                              }
                                            }}
                                            className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                                          />
                                          <span className="text-sm text-gray-700 font-medium">{seller.name}</span>
                                        </label>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                
                                {/* Selected sellers badges */}
                                {selectedVisibleSellersChallenge.length > 0 && (
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {selectedVisibleSellersChallenge.map(sellerId => {
                                      const seller = sellers.find(s => s.id === sellerId);
                                      return seller ? (
                                        <span 
                                          key={sellerId}
                                          className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 text-sm font-semibold rounded-full"
                                        >
                                          {seller.name}
                                          <button
                                            type="button"
                                            onClick={() => setSelectedVisibleSellersChallenge(selectedVisibleSellersChallenge.filter(id => id !== sellerId))}
                                            className="ml-1 hover:text-green-900 font-bold text-lg leading-none"
                                          >
                                            ×
                                          </button>
                                        </span>
                                      ) : null;
                                    })}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <label className="block text-sm font-semibold text-gray-700">Date de début *</label>
                            <div className="group relative">
                              <div className="w-5 h-5 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold cursor-help hover:bg-blue-600 transition-all">
                                ?
                              </div>
                              <div className="invisible group-hover:visible absolute left-0 top-7 z-10 w-72 p-3 bg-blue-600 text-white text-sm rounded-lg shadow-2xl border-2 border-blue-400">
                                <div className="font-semibold mb-1">📅 Info :</div>
                                Le challenge peut commencer dans le futur. Il apparaîtra dans le dashboard avec un badge "Commence dans X jours"
                              </div>
                            </div>
                          </div>
                          <input
                            type="date"
                            required
                            value={editingChallenge ? editingChallenge.start_date : newChallenge.start_date}
                            onChange={(e) => editingChallenge
                              ? setEditingChallenge({ ...editingChallenge, start_date: e.target.value })
                              : setNewChallenge({ ...newChallenge, start_date: e.target.value })
                            }
                            onFocus={(e) => {
                              // Ouvrir le calendrier au focus
                              try {
                                if (typeof e.target.showPicker === 'function') {
                                  e.target.showPicker();
                                }
                              } catch (error) {
                                console.log('showPicker not supported');
                              }
                            }}
                            className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-[#ffd871] focus:outline-none cursor-pointer"
                          />
                        </div>

                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <label className="block text-sm font-semibold text-gray-700">Date de fin *</label>
                            <div className="group relative">
                              <div className="w-5 h-5 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold cursor-help hover:bg-blue-600 transition-all">
                                ?
                              </div>
                              <div className="invisible group-hover:visible absolute left-0 top-7 z-10 w-72 p-3 bg-blue-600 text-white text-sm rounded-lg shadow-2xl border-2 border-blue-400">
                                <div className="font-semibold mb-1">📅 Info :</div>
                                Date limite du challenge. Après cette date, le challenge sera marqué comme terminé
                              </div>
                            </div>
                          </div>
                          <input
                            type="date"
                            required
                            min={editingChallenge ? editingChallenge.start_date : newChallenge.start_date}
                            value={editingChallenge ? editingChallenge.end_date : newChallenge.end_date}
                            onChange={(e) => editingChallenge
                              ? setEditingChallenge({ ...editingChallenge, end_date: e.target.value })
                              : setNewChallenge({ ...newChallenge, end_date: e.target.value })
                            }
                            onFocus={(e) => {
                              // Ouvrir le calendrier au focus
                              try {
                                if (typeof e.target.showPicker === 'function') {
                                  e.target.showPicker();
                                }
                              } catch (error) {
                                console.log('showPicker not supported');
                              }
                            }}
                            className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-[#ffd871] focus:outline-none cursor-pointer"
                          />
                        </div>

                        {/* NEW FLEXIBLE CHALLENGE SYSTEM (same as objectives) */}
                        <div className="md:col-span-2">
                          <div className="mb-3">
                            <h4 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                              <span className="text-lg">🎯</span>
                              Type de challenge
                            </h4>
                          </div>
                          
                          {/* Challenge Type Selection - Horizontal Radio Buttons */}
                          <div className="mb-4 flex flex-wrap gap-3">
                            <label className={`flex items-center gap-2 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                              newChallenge.challenge_type === 'kpi_standard'
                                ? 'bg-yellow-50 border-yellow-500 shadow-md'
                                : 'bg-white border-gray-300 hover:border-yellow-300'
                            }`}>
                              <input
                                type="radio"
                                name="challenge_type"
                                value="kpi_standard"
                                checked={newChallenge.challenge_type === 'kpi_standard'}
                                onChange={(e) => {
                                  const newType = e.target.value;
                                  setNewChallenge({ 
                                    ...newChallenge, 
                                    challenge_type: newType,
                                    unit: newChallenge.kpi_name === 'ca' ? '€' : 
                                          newChallenge.kpi_name === 'ventes' ? 'ventes' :
                                          newChallenge.kpi_name === 'articles' ? 'articles' : ''
                                  });
                                }}
                                className="w-4 h-4 text-yellow-600"
                              />
                              <span className={`font-semibold ${
                                newChallenge.challenge_type === 'kpi_standard' ? 'text-yellow-700' : 'text-gray-700'
                              }`}>
                                📊 KPI Standard
                              </span>
                            </label>

                            <label className={`flex items-center gap-2 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                              newChallenge.challenge_type === 'product_focus'
                                ? 'bg-green-50 border-green-500 shadow-md'
                                : 'bg-white border-gray-300 hover:border-green-300'
                            }`}>
                              <input
                                type="radio"
                                name="challenge_type"
                                value="product_focus"
                                checked={newChallenge.challenge_type === 'product_focus'}
                                onChange={(e) => {
                                  setNewChallenge({ 
                                    ...newChallenge, 
                                    challenge_type: e.target.value,
                                    unit: ''
                                  });
                                }}
                                className="w-4 h-4 text-green-600"
                              />
                              <span className={`font-semibold ${
                                newChallenge.challenge_type === 'product_focus' ? 'text-green-700' : 'text-gray-700'
                              }`}>
                                📦 Focus Produit
                              </span>
                            </label>

                            <label className={`flex items-center gap-2 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                              newChallenge.challenge_type === 'custom'
                                ? 'bg-purple-50 border-purple-500 shadow-md'
                                : 'bg-white border-gray-300 hover:border-purple-300'
                            }`}>
                              <input
                                type="radio"
                                name="challenge_type"
                                value="custom"
                                checked={newChallenge.challenge_type === 'custom'}
                                onChange={(e) => {
                                  setNewChallenge({ 
                                    ...newChallenge, 
                                    challenge_type: e.target.value,
                                    unit: ''
                                  });
                                }}
                                className="w-4 h-4 text-purple-600"
                              />
                              <span className={`font-semibold ${
                                newChallenge.challenge_type === 'custom' ? 'text-purple-700' : 'text-gray-700'
                              }`}>
                                ✨ Autre (personnalisé)
                              </span>
                            </label>
                          </div>

                          {/* Conditional Fields Based on Challenge Type */}
                          {newChallenge.challenge_type === 'kpi_standard' && (
                            <div className="mb-4 bg-yellow-50 rounded-lg p-4 border-2 border-yellow-200">
                              <label className="block text-sm font-semibold text-gray-700 mb-2">KPI à cibler *</label>
                              <select
                                required
                                value={newChallenge.kpi_name}
                                onChange={(e) => {
                                  const kpiName = e.target.value;
                                  let unit = '';
                                  if (kpiName === 'ca') unit = '€';
                                  else if (kpiName === 'ventes') unit = 'ventes';
                                  else if (kpiName === 'articles') unit = 'articles';
                                  setNewChallenge({ ...newChallenge, kpi_name: kpiName, unit });
                                }}
                                className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-yellow-400 focus:outline-none"
                              >
                                <option value="ca">💰 Chiffre d'affaires</option>
                                <option value="ventes">🛍️ Nombre de ventes</option>
                                <option value="articles">📦 Nombre d'articles</option>
                              </select>
                            </div>
                          )}

                          {newChallenge.challenge_type === 'product_focus' && (
                            <div className="mb-4 bg-green-50 rounded-lg p-4 border-2 border-green-200">
                              <label className="block text-sm font-semibold text-gray-700 mb-2">Nom du produit *</label>
                              <input
                                type="text"
                                required
                                value={newChallenge.product_name}
                                onChange={(e) => setNewChallenge({ ...newChallenge, product_name: e.target.value })}
                                className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-green-400 focus:outline-none"
                                placeholder="Ex: iPhone 15, Samsung Galaxy, MacBook Air..."
                              />
                              <p className="text-xs text-gray-600 mt-2">📦 Indiquez le produit sur lequel vous souhaitez vous concentrer</p>
                            </div>
                          )}

                          {newChallenge.challenge_type === 'custom' && (
                            <div className="mb-4 bg-purple-50 rounded-lg p-4 border-2 border-purple-200">
                              <label className="block text-sm font-semibold text-gray-700 mb-2">Description du challenge *</label>
                              <textarea
                                required
                                rows="3"
                                value={newChallenge.custom_description}
                                onChange={(e) => setNewChallenge({ ...newChallenge, custom_description: e.target.value })}
                                className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-purple-400 focus:outline-none"
                                placeholder="Ex: Améliorer la satisfaction client, Augmenter les ventes croisées..."
                              />
                              <p className="text-xs text-gray-600 mt-2">✨ Décrivez votre challenge personnalisé</p>
                            </div>
                          )}

                          {/* Target Value */}
                          <div className="grid grid-cols-2 gap-3 mb-4">
                            <div>
                              <label className="block text-sm font-semibold text-gray-700 mb-2">Valeur cible *</label>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                required
                                value={newChallenge.target_value}
                                onChange={(e) => setNewChallenge({ ...newChallenge, target_value: e.target.value })}
                                className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-yellow-400 focus:outline-none"
                                placeholder="Ex: 50000"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-semibold text-gray-700 mb-2">Unité (optionnel)</label>
                              <input
                                type="text"
                                value={newChallenge.unit}
                                onChange={(e) => setNewChallenge({ ...newChallenge, unit: e.target.value })}
                                className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-yellow-400 focus:outline-none"
                                placeholder="€, ventes, %..."
                              />
                            </div>
                          </div>

                          {/* Data Entry Responsible - TOGGLES STYLE MAGASIN */}
                          <div className="bg-gradient-to-r from-orange-50 to-orange-100 rounded-lg p-4 border-2 border-orange-200">
                            <label className="block text-sm font-semibold text-gray-800 mb-3">
                              📝 Qui saisit la progression ? *
                            </label>
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => setNewChallenge({ ...newChallenge, data_entry_responsible: 'seller' })}
                                className={`w-12 h-8 rounded font-bold text-xs transition-all ${
                                  newChallenge.data_entry_responsible === 'seller' 
                                    ? 'bg-cyan-500 text-white shadow-lg' 
                                    : 'bg-gray-200 text-gray-500'
                                }`}
                                title="Vendeur"
                              >
                                🧑‍💼
                              </button>
                              <span className={`text-sm font-medium ${
                                newChallenge.data_entry_responsible === 'seller' ? 'text-cyan-700' : 'text-gray-500'
                              }`}>
                                Vendeur
                              </span>
                              
                              <div className="mx-4 h-8 w-px bg-gray-300"></div>
                              
                              <button
                                type="button"
                                onClick={() => setNewChallenge({ ...newChallenge, data_entry_responsible: 'manager' })}
                                className={`w-12 h-8 rounded font-bold text-xs transition-all ${
                                  newChallenge.data_entry_responsible === 'manager' 
                                    ? 'bg-orange-500 text-white shadow-lg' 
                                    : 'bg-gray-200 text-gray-500'
                                }`}
                                title="Manager"
                              >
                                👨‍💼
                              </button>
                              <span className={`text-sm font-medium ${
                                newChallenge.data_entry_responsible === 'manager' ? 'text-orange-700' : 'text-gray-500'
                              }`}>
                                Manager
                              </span>
                            </div>
                            <p className="text-xs text-gray-600 mt-3">
                              {newChallenge.data_entry_responsible === 'seller' 
                                ? '🧑‍💼 Le vendeur pourra saisir la progression de ce challenge'
                                : '👨‍💼 Vous (manager) saisirez la progression de ce challenge'}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Visibilité section - same as Objectives */}
                      {/* Visibilité - Layout horizontal (same as objectives) */}
                      <div className="md:col-span-2">
                        <div className="flex items-start gap-4">
                          {/* Checkbox Visible */}
                          <label className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg border-2 border-blue-200 cursor-pointer hover:bg-blue-100 transition-all flex-shrink-0">
                            <input
                              type="checkbox"
                              checked={newChallenge.visible !== false}
                              onChange={(e) => {
                                const isChecked = e.target.checked;
                                setNewChallenge({ ...newChallenge, visible: isChecked });
                                if (!isChecked) {
                                  setSelectedVisibleSellersChallenge([]);
                                  setIsChallengeSellerDropdownOpen(false);
                                }
                              }}
                              className="w-5 h-5 text-blue-600"
                            />
                            <div>
                              <p className="font-semibold text-gray-800">👁️ Visible par les vendeurs</p>
                              <p className="text-xs text-gray-600">Si coché, les vendeurs pourront voir ce challenge</p>
                            </div>
                          </label>
                          
                          {/* Seller selection dropdown - only for collective challenges */}
                          {newChallenge.visible !== false && newChallenge.type === 'collective' && (
                            <div className="flex-1 p-4 bg-green-50 rounded-lg border-2 border-green-200">
                              <div className="flex items-center justify-between mb-3">
                                <p className="text-sm font-semibold text-gray-800">👥 Sélectionner les vendeurs (optionnel)</p>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (selectedVisibleSellersChallenge.length === sellers.length) {
                                      setSelectedVisibleSellersChallenge([]);
                                    } else {
                                      setSelectedVisibleSellersChallenge(sellers.map(s => s.id));
                                    }
                                  }}
                                  className="text-xs px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all"
                                >
                                  {selectedVisibleSellersChallenge.length === sellers.length ? 'Tout désélectionner' : 'Tout sélectionner'}
                                </button>
                              </div>
                              <p className="text-xs text-gray-600 mb-3">
                                Si aucun vendeur n'est sélectionné, tous les vendeurs verront ce challenge
                              </p>
                              
                              {/* Custom Dropdown with Checkboxes */}
                              <div className="relative" ref={challengeSellerDropdownRef}>
                                <button
                                  type="button"
                                  onClick={() => setIsChallengeSellerDropdownOpen(!isChallengeSellerDropdownOpen)}
                                  className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-green-400 focus:outline-none bg-white text-left flex items-center justify-between hover:border-green-300 transition-all"
                                >
                                  <span className="text-gray-700">
                                    {selectedVisibleSellersChallenge.length === 0 
                                      ? 'Sélectionner les vendeurs...' 
                                      : `${selectedVisibleSellersChallenge.length} vendeur${selectedVisibleSellersChallenge.length > 1 ? 's' : ''} sélectionné${selectedVisibleSellersChallenge.length > 1 ? 's' : ''}`
                                    }
                                  </span>
                                  <svg 
                                    className={`w-5 h-5 text-gray-500 transition-transform ${isChallengeSellerDropdownOpen ? 'rotate-180' : ''}`}
                                    fill="none" 
                                    stroke="currentColor" 
                                    viewBox="0 0 24 24"
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                  </svg>
                                </button>
                                
                                {isChallengeSellerDropdownOpen && (
                                  <div className="absolute z-10 w-full mt-2 bg-white border-2 border-green-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                    {sellers.map((seller) => (
                                      <label
                                        key={seller.id}
                                        className="flex items-center gap-3 p-3 hover:bg-green-50 cursor-pointer transition-colors border-b border-gray-100 last:border-b-0"
                                      >
                                        <input
                                          type="checkbox"
                                          checked={selectedVisibleSellersChallenge.includes(seller.id)}
                                          onChange={(e) => {
                                            if (e.target.checked) {
                                              setSelectedVisibleSellersChallenge([...selectedVisibleSellersChallenge, seller.id]);
                                            } else {
                                              setSelectedVisibleSellersChallenge(selectedVisibleSellersChallenge.filter(id => id !== seller.id));
                                            }
                                          }}
                                          className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                                        />
                                        <span className="text-sm text-gray-700 font-medium">{seller.name}</span>
                                      </label>
                                    ))}
                                  </div>
                                )}
                              </div>
                              
                              {/* Selected sellers badges */}
                              {selectedVisibleSellersChallenge.length > 0 && (
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {selectedVisibleSellersChallenge.map(sellerId => {
                                    const seller = sellers.find(s => s.id === sellerId);
                                    return seller ? (
                                      <span 
                                        key={sellerId}
                                        className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 text-sm font-semibold rounded-full"
                                      >
                                        {seller.name}
                                        <button
                                          type="button"
                                          onClick={() => setSelectedVisibleSellersChallenge(selectedVisibleSellersChallenge.filter(id => id !== sellerId))}
                                          className="ml-1 hover:text-green-900 font-bold text-lg leading-none"
                                        >
                                          ×
                                        </button>
                                      </span>
                                    ) : null;
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <button
                          type="submit"
                          className="flex-1 bg-gradient-to-r from-[#1E40AF] to-[#1E3A8A] text-white font-bold py-3 px-6 rounded-xl hover:shadow-lg transition-all"
                        >
                          {editingChallenge ? '💾 Enregistrer les modifications' : '➕ Créer le Challenge'}
                        </button>
                        {editingChallenge && (
                          <button
                            type="button"
                            onClick={() => setEditingChallenge(null)}
                            className="px-6 py-3 bg-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-300 transition-all"
                          >
                            Annuler
                          </button>
                        )}
                      </div>
                    </form>
                  </div>

                  {/* Challenges List */}
                  <div className="bg-white rounded-xl p-6 border-2 border-gray-200">
                    <h3 className="text-xl font-bold text-gray-800 mb-4">📋 Liste des Challenges</h3>
                    
                    {challenges.length === 0 ? (
                      <p className="text-center text-gray-500 py-8">Aucun challenge créé pour le moment</p>
                    ) : (
                      <div className="space-y-3">
                        {challenges.map((challenge) => (
                          <div
                            key={challenge.id}
                            className="bg-gray-50 rounded-lg p-4 border-2 border-gray-200 hover:border-[#ffd871] transition-all"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <h4 className="font-bold text-gray-800 text-lg">
                                    🏆 {challenge.title}
                                  </h4>
                                  {/* Type badge */}
                                  <span className={`text-xs font-semibold px-2 py-1 rounded ${
                                    challenge.type === 'collective' 
                                      ? 'bg-blue-100 text-blue-700' 
                                      : 'bg-orange-100 text-orange-700'
                                  }`}>
                                    {challenge.type === 'collective' ? '👥 Collectif' : (
                                      challenge.seller_id ? 
                                        `👤 ${sellers.find(s => s.id === challenge.seller_id)?.name || 'Individuel'}` 
                                        : '👤 Individuel'
                                    )}
                                  </span>
                                  {/* Visibility badge */}
                                  <span className={`text-xs font-semibold px-2 py-1 rounded ${
                                    challenge.visible === false
                                      ? 'bg-gray-100 text-gray-600' 
                                      : 'bg-green-100 text-green-700'
                                  }`}>
                                    {challenge.visible === false ? '🔒 Non visible' : 
                                      challenge.visible_to_sellers && challenge.visible_to_sellers.length > 0
                                        ? `👁️ ${challenge.visible_to_sellers.length} vendeur${challenge.visible_to_sellers.length > 1 ? 's' : ''}`
                                        : '👁️ Tous les vendeurs'
                                    }
                                  </span>
                                  {/* Status badge */}
                                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                                    challenge.status === 'completed'
                                      ? 'bg-green-500 text-white shadow-lg' 
                                      : challenge.status === 'failed'
                                      ? 'bg-red-500 text-white shadow-lg'
                                      : 'bg-yellow-400 text-gray-800 shadow-md'
                                  }`}>
                                    {challenge.status === 'completed' ? '✅ Réussi' : 
                                      challenge.status === 'failed' ? '❌ Raté' : '⏳ En cours'}
                                  </span>
                                </div>
                                <div className="text-sm text-gray-600 mb-2">
                                  📅 Période: {new Date(challenge.start_date).toLocaleDateString('fr-FR')} - {new Date(challenge.end_date).toLocaleDateString('fr-FR')}
                                </div>
                                {/* Show specific sellers if any */}
                                {challenge.visible && challenge.visible_to_sellers && challenge.visible_to_sellers.length > 0 && (
                                  <div className="text-xs text-gray-600 mb-2">
                                    👤 Visible pour : {challenge.visible_to_sellers.map(sellerId => {
                                      const seller = sellers.find(s => s.id === sellerId);
                                      return seller ? seller.name : 'Inconnu';
                                    }).join(', ')}
                                  </div>
                                )}
                                {challenge.description && (
                                  <p className="text-sm text-gray-600 mb-2">{challenge.description}</p>
                                )}
                                <div className="flex flex-wrap gap-3 text-sm text-gray-600 mb-3">
                                  {challenge.ca_target && <span>💰 CA: {challenge.ca_target.toLocaleString('fr-FR')}€</span>}
                                  {challenge.ventes_target && <span>📈 Ventes: {challenge.ventes_target}</span>}
                                  {challenge.clients_target && <span>👥 Clients: {challenge.clients_target}</span>}
                                  {challenge.articles_target && <span>📦 Articles: {challenge.articles_target}</span>}
                                  {challenge.panier_moyen_target && <span>🛒 Panier Moyen: {challenge.panier_moyen_target.toLocaleString('fr-FR')}€</span>}
                                  {challenge.indice_vente_target && <span>💎 Indice: {challenge.indice_vente_target}</span>}
                                  {challenge.taux_transformation_target && <span>📊 Taux: {challenge.taux_transformation_target}%</span>}
                                </div>
                                
                                {/* Barres de progression par KPI */}
                                {(() => {
                                  const kpiProgressions = [];
                                  
                                  if (challenge.ca_target && challenge.ca_target > 0) {
                                    const progress_ca = challenge.progress_ca || 0;
                                    const percent = Math.min(Math.round((progress_ca / challenge.ca_target) * 100), 100);
                                    kpiProgressions.push({
                                      label: '💰 CA',
                                      current: progress_ca.toLocaleString('fr-FR'),
                                      target: challenge.ca_target.toLocaleString('fr-FR'),
                                      unit: '€',
                                      percent
                                    });
                                  }
                                  if (challenge.ventes_target && challenge.ventes_target > 0) {
                                    const progress_ventes = challenge.progress_ventes || 0;
                                    const percent = Math.min(Math.round((progress_ventes / challenge.ventes_target) * 100), 100);
                                    kpiProgressions.push({
                                      label: '📈 Ventes',
                                      current: progress_ventes,
                                      target: challenge.ventes_target,
                                      unit: '',
                                      percent
                                    });
                                  }
                                  if (challenge.articles_target && challenge.articles_target > 0) {
                                    const progress_articles = challenge.progress_articles || 0;
                                    const percent = Math.min(Math.round((progress_articles / challenge.articles_target) * 100), 100);
                                    kpiProgressions.push({
                                      label: '📦 Articles',
                                      current: progress_articles,
                                      target: challenge.articles_target,
                                      unit: '',
                                      percent
                                    });
                                  }
                                  if (challenge.panier_moyen_target && challenge.panier_moyen_target > 0) {
                                    const progress_pm = challenge.progress_panier_moyen || 0;
                                    const percent = Math.min(Math.round((progress_pm / challenge.panier_moyen_target) * 100), 100);
                                    kpiProgressions.push({
                                      label: '🛒 Panier Moyen',
                                      current: progress_pm.toFixed(2),
                                      target: challenge.panier_moyen_target.toFixed(2),
                                      unit: '€',
                                      percent
                                    });
                                  }
                                  if (challenge.indice_vente_target && challenge.indice_vente_target > 0) {
                                    const progress_iv = challenge.progress_indice_vente || 0;
                                    const percent = Math.min(Math.round((progress_iv / challenge.indice_vente_target) * 100), 100);
                                    kpiProgressions.push({
                                      label: '💎 Indice',
                                      current: progress_iv.toFixed(2),
                                      target: challenge.indice_vente_target.toFixed(2),
                                      unit: '',
                                      percent
                                    });
                                  }
                                  
                                  return kpiProgressions.length > 0 ? (
                                    <div className="mt-3 space-y-2">
                                      <div className="text-xs font-semibold text-gray-600 mb-2">📊 Progression par KPI</div>
                                      {kpiProgressions.map((kpi, index) => {
                                        let progressColor = 'bg-red-500';
                                        if (kpi.percent >= 75) progressColor = 'bg-green-500';
                                        else if (kpi.percent >= 50) progressColor = 'bg-yellow-500';
                                        else if (kpi.percent >= 25) progressColor = 'bg-orange-500';
                                        
                                        return (
                                          <div key={index} className="bg-gray-50 rounded-lg p-2">
                                            <div className="flex items-center justify-between mb-1">
                                              <span className="text-xs font-medium text-gray-700">{kpi.label}</span>
                                              <span className="text-xs text-gray-600">
                                                {kpi.current}{kpi.unit} / {kpi.target}{kpi.unit} ({kpi.percent}%)
                                              </span>
                                            </div>
                                            <div className="w-full bg-gray-200 rounded-full h-2">
                                              <div 
                                                className={`${progressColor} h-2 rounded-full transition-all duration-300`}
                                                style={{ width: `${kpi.percent}%` }}
                                              ></div>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  ) : null;
                                })()}
                              </div>
                              <div className="flex gap-2 ml-4">
                                <button
                                  onClick={() => {
                                    setEditingChallenge(challenge);
                                    
                                    // Scroll vers le formulaire de challenge
                                    setTimeout(() => {
                                      const challengeSection = document.querySelector('#challenge-form-section');
                                      if (challengeSection) {
                                        challengeSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                      }
                                    }, 100);
                                  }}
                                  className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-2 rounded transition-all"
                                  title="Modifier"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteChallenge(challenge.id, challenge.title)}
                                  className="text-red-600 hover:text-red-800 hover:bg-red-50 p-2 rounded transition-all"
                                  title="Supprimer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
