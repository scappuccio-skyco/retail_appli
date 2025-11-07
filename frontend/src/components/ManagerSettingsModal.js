import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { X, Settings, Target, Trophy, Edit2, Trash2, Plus } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function ManagerSettingsModal({ isOpen, onClose, onUpdate }) {
  const [activeTab, setActiveTab] = useState('objectives'); // 'objectives', 'challenges'
  const [kpiConfig, setKpiConfig] = useState(null);
  const [objectives, setObjectives] = useState([]);
  const [challenges, setChallenges] = useState([]);
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingChallenge, setEditingChallenge] = useState(null);
  const [editingObjective, setEditingObjective] = useState(null);
  
  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };
  
  // New challenge form
  const [newChallenge, setNewChallenge] = useState({
    title: '',
    description: '',
    type: 'collective',
    seller_id: '',
    visible: true,
    visible_to_sellers: [],
    ca_target: '',
    ventes_target: '',
    indice_vente_target: '',
    panier_moyen_target: '',
    start_date: '',
    end_date: '',
    status: 'active' // Default status
  });
  
  // Selected sellers for challenge visibility
  const [selectedVisibleSellersChallenge, setSelectedVisibleSellersChallenge] = useState([]);

  // New objective form
  const [newObjective, setNewObjective] = useState({
    title: '',
    type: 'collective',
    seller_id: '',
    visible: true,
    visible_to_sellers: [],
    period_start: '',
    period_end: '',
    kpi_targets: {} // Dynamic KPI targets
  });
  
  // Selected KPIs for the objective
  const [selectedKPIs, setSelectedKPIs] = useState({});
  
  // Selected sellers for visibility
  const [selectedVisibleSellers, setSelectedVisibleSellers] = useState([]);

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen]);

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
      // Add visible_to_sellers if specific sellers selected
      const challengeData = { ...newChallenge };
      if (newChallenge.visible && selectedVisibleSellersChallenge.length > 0) {
        challengeData.visible_to_sellers = selectedVisibleSellersChallenge;
      }
      
      await axios.post(`${API}/manager/challenges`, challengeData, { headers });
      toast.success('Challenge créé avec succès');
      setNewChallenge({
        title: '',
        description: '',
        type: 'collective',
        seller_id: '',
        visible: true,
        visible_to_sellers: [],
        ca_target: '',
        ventes_target: '',
        indice_vente_target: '',
        panier_moyen_target: '',
        start_date: '',
        end_date: '',
        status: 'active'
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
      await axios.put(`${API}/manager/challenges/${editingChallenge.id}`, editingChallenge, { headers });
      toast.success('Challenge modifié avec succès');
      setEditingChallenge(null);
      fetchData();
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


  // Get available KPIs based on configuration
  const getAvailableKPIs = () => {
    if (!kpiConfig) return [];
    
    const kpis = [];
    
    // Basic KPIs
    if (kpiConfig.track_ca) {
      kpis.push({ key: 'ca', label: 'Chiffre d\'Affaires', unit: '€', icon: '💰' });
    }
    if (kpiConfig.track_ventes) {
      kpis.push({ key: 'ventes', label: 'Nombre de Ventes', unit: 'ventes', icon: '🛍️' });
    }
    if (kpiConfig.track_clients) {
      kpis.push({ key: 'clients', label: 'Nombre de Clients', unit: 'clients', icon: '👥' });
    }
    if (kpiConfig.track_articles) {
      kpis.push({ key: 'articles', label: 'Nombre d\'Articles', unit: 'articles', icon: '📦' });
    }
    if (kpiConfig.track_prospects) {
      kpis.push({ key: 'prospects', label: 'Prospects', unit: 'prospects', icon: '🎯' });
    }
    
    // Calculated KPIs
    if (kpiConfig.track_ca && kpiConfig.track_ventes) {
      kpis.push({ key: 'panier_moyen', label: 'Panier Moyen', unit: '€', icon: '💳', calculated: true });
    }
    if (kpiConfig.track_articles && kpiConfig.track_ventes) {
      kpis.push({ key: 'indice_vente', label: 'Indice de Vente', unit: 'articles/vente', icon: '📊', calculated: true });
    }
    if (kpiConfig.track_ventes && kpiConfig.track_prospects) {
      kpis.push({ key: 'taux_transformation', label: 'Taux de Transformation', unit: '%', icon: '🎲', calculated: true });
    }
    
    return kpis;
  };

  const handleCreateObjective = async (e) => {
    e.preventDefault();
    try {
      // Build cleaned data with selected KPI targets
      const cleanedData = {
        title: newObjective.title,
        type: newObjective.type,
        visible: newObjective.visible,
        period_start: newObjective.period_start,
        period_end: newObjective.period_end
      };
      
      // Add seller_id if individual type
      if (newObjective.type === 'individual' && newObjective.seller_id) {
        cleanedData.seller_id = newObjective.seller_id;
      }
      
      // Add visible_to_sellers if specific sellers selected
      if (newObjective.visible && selectedVisibleSellers.length > 0) {
        cleanedData.visible_to_sellers = selectedVisibleSellers;
      }
      
      // Add selected KPI targets
      Object.keys(selectedKPIs).forEach(kpiKey => {
        if (selectedKPIs[kpiKey] && newObjective.kpi_targets[kpiKey]) {
          const targetKey = `${kpiKey}_target`;
          cleanedData[targetKey] = parseFloat(newObjective.kpi_targets[kpiKey]);
        }
      });
      
      await axios.post(`${API}/manager/objectives`, cleanedData, { headers });
      toast.success('Objectif créé avec succès');
      setNewObjective({
        title: '',
        type: 'collective',
        seller_id: '',
        visible: true,
        visible_to_sellers: [],
        period_start: '',
        period_end: '',
        kpi_targets: {}
      });
      setSelectedKPIs({});
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
      // Clean data - remove empty strings and convert to numbers
      const cleanedData = {
        title: editingObjective.title,
        period_start: editingObjective.period_start,
        period_end: editingObjective.period_end
      };
      
      if (editingObjective.ca_target && editingObjective.ca_target !== '') {
        cleanedData.ca_target = parseFloat(editingObjective.ca_target);
      }
      if (editingObjective.indice_vente_target && editingObjective.indice_vente_target !== '') {
        cleanedData.indice_vente_target = parseFloat(editingObjective.indice_vente_target);
      }
      if (editingObjective.panier_moyen_target && editingObjective.panier_moyen_target !== '') {
        cleanedData.panier_moyen_target = parseFloat(editingObjective.panier_moyen_target);
      }
      
      await axios.put(`${API}/manager/objectives/${editingObjective.id}`, cleanedData, { headers });
      toast.success('Objectif modifié avec succès');
      setEditingObjective(null);
      fetchData();
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-[#ffd871] to-yellow-300 p-6 flex justify-between items-center border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Settings className="w-8 h-8 text-gray-800" />
            <h2 className="text-3xl font-bold text-gray-800">🎯 Objectifs & Challenges</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-800 hover:text-gray-600 transition-colors"
          >
            <X className="w-8 h-8" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 bg-gray-50 px-6">
          <button
            onClick={() => setActiveTab('objectives')}
            className={`px-6 py-4 font-semibold transition-all ${
              activeTab === 'objectives'
                ? 'border-b-4 border-[#ffd871] text-gray-800'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            🎯 Objectifs
          </button>
          <button
            onClick={() => setActiveTab('challenges')}
            className={`px-6 py-4 font-semibold transition-all ${
              activeTab === 'challenges'
                ? 'border-b-4 border-[#ffd871] text-gray-800'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            🏆 Challenges
          </button>
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
                    className="w-full bg-gradient-to-r from-[#ffd871] to-yellow-300 text-gray-800 font-bold py-3 px-6 rounded-xl hover:shadow-lg transition-all"
                  >
                    💾 Enregistrer la Configuration
                  </button>
                </form>
              )}

              {/* Objectives Tab */}
              {activeTab === 'objectives' && (
                <div className="space-y-6">
                  {/* Create/Edit Objective Form */}
                  <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 border-2 border-purple-300">
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
                            value={editingObjective ? editingObjective.title : newObjective.title}
                            onChange={(e) => editingObjective
                              ? setEditingObjective({ ...editingObjective, title: e.target.value })
                              : setNewObjective({ ...newObjective, title: e.target.value })
                            }
                            className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-purple-400 focus:outline-none"
                            placeholder="Ex: Objectifs Décembre 2025"
                          />
                        </div>

                        {/* Type d'objectif */}
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">Type d'objectif *</label>
                          <select
                            value={editingObjective ? editingObjective.type : newObjective.type}
                            onChange={(e) => {
                              const newType = e.target.value;
                              if (editingObjective) {
                                setEditingObjective({ ...editingObjective, type: newType, seller_id: newType === 'collective' ? '' : editingObjective.seller_id });
                              } else {
                                setNewObjective({ ...newObjective, type: newType, seller_id: newType === 'collective' ? '' : newObjective.seller_id });
                              }
                            }}
                            className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-purple-400 focus:outline-none"
                          >
                            <option value="collective">👥 Objectif d'Équipe</option>
                            <option value="individual">👤 Objectif Individuel</option>
                          </select>
                        </div>

                        {/* Seller selection for individual objectives */}
                        {(editingObjective ? editingObjective.type : newObjective.type) === 'individual' && (
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Vendeur *</label>
                            <select
                              required
                              value={editingObjective ? editingObjective.seller_id : newObjective.seller_id}
                              onChange={(e) => editingObjective
                                ? setEditingObjective({ ...editingObjective, seller_id: e.target.value })
                                : setNewObjective({ ...newObjective, seller_id: e.target.value })
                              }
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

                        {/* Visibilité */}
                        <div className="md:col-span-2">
                          <label className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg border-2 border-blue-200 cursor-pointer hover:bg-blue-100 transition-all">
                            <input
                              type="checkbox"
                              checked={editingObjective ? editingObjective.visible !== false : newObjective.visible !== false}
                              onChange={(e) => {
                                const isChecked = e.target.checked;
                                if (editingObjective) {
                                  setEditingObjective({ ...editingObjective, visible: isChecked });
                                } else {
                                  setNewObjective({ ...newObjective, visible: isChecked });
                                  if (!isChecked) {
                                    setSelectedVisibleSellers([]);
                                  }
                                }
                              }}
                              className="w-5 h-5 text-blue-600"
                            />
                            <div>
                              <p className="font-semibold text-gray-800">👁️ Visible par les vendeurs</p>
                              <p className="text-xs text-gray-600">Si coché, les vendeurs pourront voir cet objectif dans leur dashboard</p>
                            </div>
                          </label>
                          
                          {/* Seller selection for visibility - only for collective objectives */}
                          {(editingObjective ? editingObjective.visible !== false : newObjective.visible !== false) && 
                           (editingObjective ? editingObjective.type : newObjective.type) === 'collective' && (
                            <div className="mt-3 p-4 bg-green-50 rounded-lg border-2 border-green-200">
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
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                {sellers.map((seller) => (
                                  <label
                                    key={seller.id}
                                    className="flex items-center gap-2 p-2 bg-white rounded border-2 border-gray-200 hover:border-green-400 cursor-pointer transition-all"
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
                                      className="w-4 h-4 text-green-600"
                                    />
                                    <span className="text-sm text-gray-700">{seller.name}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          )}
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
                            value={editingObjective ? editingObjective.period_start : newObjective.period_start}
                            onChange={(e) => editingObjective
                              ? setEditingObjective({ ...editingObjective, period_start: e.target.value })
                              : setNewObjective({ ...newObjective, period_start: e.target.value })
                            }
                            className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-purple-400 focus:outline-none"
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
                            value={editingObjective ? editingObjective.period_end : newObjective.period_end}
                            onChange={(e) => editingObjective
                              ? setEditingObjective({ ...editingObjective, period_end: e.target.value })
                              : setNewObjective({ ...newObjective, period_end: e.target.value })
                            }
                            className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-purple-400 focus:outline-none"
                          />
                        </div>

                        {/* Dynamic KPI Selection - Compact Grid Layout */}
                        <div className="md:col-span-2">
                          <div className="mb-3">
                            <h4 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                              <span className="text-lg">📊</span>
                              Sélectionner les KPI à cibler
                            </h4>
                            <p className="text-xs text-gray-600 mb-3">Cochez les KPI et indiquez la valeur cible</p>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {getAvailableKPIs().map((kpi) => (
                              <div key={kpi.key} className="border-2 border-gray-200 rounded-lg p-3 hover:border-purple-300 transition-all">
                                {/* Checkbox + Label */}
                                <label className="flex items-center gap-2 cursor-pointer mb-2">
                                  <input
                                    type="checkbox"
                                    checked={selectedKPIs[kpi.key] || false}
                                    onChange={(e) => {
                                      setSelectedKPIs({ ...selectedKPIs, [kpi.key]: e.target.checked });
                                      if (!e.target.checked) {
                                        const newTargets = { ...newObjective.kpi_targets };
                                        delete newTargets[kpi.key];
                                        setNewObjective({ ...newObjective, kpi_targets: newTargets });
                                      }
                                    }}
                                    className="w-4 h-4 text-purple-600"
                                  />
                                  <div className="flex items-center gap-1.5 flex-1">
                                    <span className="text-base">{kpi.icon}</span>
                                    <span className="font-semibold text-sm text-gray-800">{kpi.label}</span>
                                    {kpi.calculated && (
                                      <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Auto</span>
                                    )}
                                  </div>
                                </label>
                                
                                {/* Value Input (inline when selected) */}
                                {selectedKPIs[kpi.key] && (
                                  <div className="animate-fadeIn">
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="number"
                                        step={kpi.key.includes('taux') ? '0.1' : kpi.key.includes('moyen') || kpi.key.includes('indice') ? '0.01' : '1'}
                                        value={newObjective.kpi_targets[kpi.key] || ''}
                                        onChange={(e) => {
                                          setNewObjective({
                                            ...newObjective,
                                            kpi_targets: {
                                              ...newObjective.kpi_targets,
                                              [kpi.key]: e.target.value
                                            }
                                          });
                                        }}
                                        className="flex-1 p-2 text-sm border-2 border-gray-300 rounded-lg focus:border-purple-400 focus:outline-none"
                                        placeholder={`Ex: ${kpi.key === 'ca' ? '50000' : kpi.key === 'ventes' ? '200' : kpi.key === 'panier_moyen' ? '150' : '2.5'}`}
                                        required
                                      />
                                      <span className="text-xs text-gray-500 whitespace-nowrap">{kpi.unit}</span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                          
                          {getAvailableKPIs().length === 0 && (
                            <div className="bg-orange-50 border-2 border-orange-200 rounded-lg p-4 text-center">
                              <p className="text-orange-700 font-semibold">⚠️ Aucun KPI configuré</p>
                              <p className="text-sm text-orange-600 mt-1">Veuillez d'abord configurer vos KPI dans "KPI Magasin"</p>
                            </div>
                          )}
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
                                    {objective.type === 'collective' ? '👥 Collectif' : '👤 Individuel'}
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
                                <div className="flex flex-wrap gap-3 text-sm text-gray-600">
                                  {objective.ca_target && <span>💰 CA: {objective.ca_target.toLocaleString('fr-FR')}€</span>}
                                  {objective.ventes_target && <span>📈 Ventes: {objective.ventes_target}</span>}
                                  {objective.clients_target && <span>👥 Clients: {objective.clients_target}</span>}
                                  {objective.articles_target && <span>📦 Articles: {objective.articles_target}</span>}
                                  {objective.panier_moyen_target && <span>🛒 Panier Moyen: {objective.panier_moyen_target.toLocaleString('fr-FR')}€</span>}
                                  {objective.indice_vente_target && <span>💎 Indice: {objective.indice_vente_target}</span>}
                                  {objective.taux_transformation_target && <span>📊 Taux: {objective.taux_transformation_target}%</span>}
                                </div>
                              </div>
                              <div className="flex gap-2 ml-4">
                                <button
                                  onClick={() => setEditingObjective(objective)}
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
                  <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-xl p-6 border-2 border-[#ffd871]">
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
                            value={editingChallenge ? editingChallenge.title : newChallenge.title}
                            onChange={(e) => editingChallenge 
                              ? setEditingChallenge({ ...editingChallenge, title: e.target.value })
                              : setNewChallenge({ ...newChallenge, title: e.target.value })
                            }
                            className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-[#ffd871] focus:outline-none"
                            placeholder="Ex: Challenge Parfums"
                          />
                        </div>

                        <div className="md:col-span-2">
                          <div className="flex items-center gap-2 mb-2">
                            <label className="block text-sm font-semibold text-gray-700">Description</label>
                            <div className="group relative">
                              <div className="w-5 h-5 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold cursor-help hover:bg-blue-600 transition-all">
                                ?
                              </div>
                              <div className="invisible group-hover:visible absolute left-0 top-7 z-10 w-72 p-3 bg-blue-600 text-white text-sm rounded-lg shadow-2xl border-2 border-blue-400">
                                <div className="font-semibold mb-1">💡 Conseil :</div>
                                Expliquez les règles et l'objectif du challenge pour motiver vos équipes
                              </div>
                            </div>
                          </div>
                          <textarea
                            value={editingChallenge ? editingChallenge.description : newChallenge.description}
                            onChange={(e) => editingChallenge
                              ? setEditingChallenge({ ...editingChallenge, description: e.target.value })
                              : setNewChallenge({ ...newChallenge, description: e.target.value })
                            }
                            className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-[#ffd871] focus:outline-none"
                            rows="3"
                            placeholder="Description du challenge..."
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

                        {/* Visibilité */}
                        <div className="md:col-span-2">
                          <label className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg border-2 border-blue-200 cursor-pointer hover:bg-blue-100 transition-all">
                            <input
                              type="checkbox"
                              checked={editingChallenge ? editingChallenge.visible !== false : newChallenge.visible !== false}
                              onChange={(e) => editingChallenge
                                ? setEditingChallenge({ ...editingChallenge, visible: e.target.checked })
                                : setNewChallenge({ ...newChallenge, visible: e.target.checked })
                              }
                              className="w-5 h-5 text-blue-600"
                            />
                            <div>
                              <p className="font-semibold text-gray-800">👁️ Visible par les vendeurs</p>
                              <p className="text-xs text-gray-600">Si coché, les vendeurs pourront voir ce challenge dans leur dashboard</p>
                            </div>
                          </label>
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
                            className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-[#ffd871] focus:outline-none"
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
                            value={editingChallenge ? editingChallenge.end_date : newChallenge.end_date}
                            onChange={(e) => editingChallenge
                              ? setEditingChallenge({ ...editingChallenge, end_date: e.target.value })
                              : setNewChallenge({ ...newChallenge, end_date: e.target.value })
                            }
                            className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-[#ffd871] focus:outline-none"
                          />
                        </div>

                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <label className="block text-sm font-semibold text-gray-700">💰 Objectif CA (€)</label>
                            <div className="group relative">
                              <div className="w-5 h-5 bg-green-500 text-white rounded-full flex items-center justify-center text-xs font-bold cursor-help hover:bg-green-600 transition-all">
                                ?
                              </div>
                              <div className="invisible group-hover:visible absolute left-0 top-7 z-10 w-72 p-3 bg-green-600 text-white text-sm rounded-lg shadow-2xl border-2 border-green-400">
                                <div className="font-semibold mb-1">💰 Chiffre d'Affaires :</div>
                                Montant total des ventes cible pour la période. Au moins un objectif KPI est requis.
                              </div>
                            </div>
                          </div>
                          <input
                            type="number"
                            value={editingChallenge ? editingChallenge.ca_target : newChallenge.ca_target}
                            onChange={(e) => editingChallenge
                              ? setEditingChallenge({ ...editingChallenge, ca_target: e.target.value })
                              : setNewChallenge({ ...newChallenge, ca_target: e.target.value })
                            }
                            className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-[#ffd871] focus:outline-none"
                            placeholder="Ex: 10000"
                          />
                        </div>

                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <label className="block text-sm font-semibold text-gray-700">🛍️ Objectif Ventes</label>
                            <div className="group relative">
                              <div className="w-5 h-5 bg-green-500 text-white rounded-full flex items-center justify-center text-xs font-bold cursor-help hover:bg-green-600 transition-all">
                                ?
                              </div>
                              <div className="invisible group-hover:visible absolute left-0 top-7 z-10 w-72 p-3 bg-green-600 text-white text-sm rounded-lg shadow-2xl border-2 border-green-400">
                                <div className="font-semibold mb-1">🛍️ Nombre de Ventes :</div>
                                Nombre de transactions à réaliser. Laissez vide si vous ne souhaitez pas suivre ce KPI.
                              </div>
                            </div>
                          </div>
                          <input
                            type="number"
                            value={editingChallenge ? editingChallenge.ventes_target : newChallenge.ventes_target}
                            onChange={(e) => editingChallenge
                              ? setEditingChallenge({ ...editingChallenge, ventes_target: e.target.value })
                              : setNewChallenge({ ...newChallenge, ventes_target: e.target.value })
                            }
                            className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-[#ffd871] focus:outline-none"
                            placeholder="Ex: 50"
                          />
                        </div>

                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <label className="block text-sm font-semibold text-gray-700">🛒 Objectif Panier Moyen (€)</label>
                            <div className="group relative">
                              <div className="w-5 h-5 bg-green-500 text-white rounded-full flex items-center justify-center text-xs font-bold cursor-help hover:bg-green-600 transition-all">
                                ?
                              </div>
                              <div className="invisible group-hover:visible absolute left-0 top-7 z-10 w-72 p-3 bg-green-600 text-white text-sm rounded-lg shadow-2xl border-2 border-green-400">
                                <div className="font-semibold mb-1">🛒 Panier Moyen :</div>
                                Valeur moyenne par transaction (CA ÷ Nb de ventes). Mesure l'efficacité commerciale.
                              </div>
                            </div>
                          </div>
                          <input
                            type="number"
                            step="0.01"
                            value={editingChallenge ? editingChallenge.panier_moyen_target : newChallenge.panier_moyen_target}
                            onChange={(e) => editingChallenge
                              ? setEditingChallenge({ ...editingChallenge, panier_moyen_target: e.target.value })
                              : setNewChallenge({ ...newChallenge, panier_moyen_target: e.target.value })
                            }
                            className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-[#ffd871] focus:outline-none"
                            placeholder="Ex: 150"
                          />
                        </div>

                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <label className="block text-sm font-semibold text-gray-700">💎 Objectif Indice Vente</label>
                            <div className="group relative">
                              <div className="w-5 h-5 bg-green-500 text-white rounded-full flex items-center justify-center text-xs font-bold cursor-help hover:bg-green-600 transition-all">
                                ?
                              </div>
                              <div className="invisible group-hover:visible absolute left-0 top-7 z-10 w-72 p-3 bg-green-600 text-white text-sm rounded-lg shadow-2xl border-2 border-green-400">
                                <div className="font-semibold mb-1">💎 Indice de Vente :</div>
                                Moyenne d'articles par vente (Nb Articles ÷ Nb Ventes). Mesure la capacité à vendre plusieurs articles.
                              </div>
                            </div>
                          </div>
                          <input
                            type="number"
                            step="0.1"
                            value={editingChallenge ? editingChallenge.indice_vente_target : newChallenge.indice_vente_target}
                            onChange={(e) => editingChallenge
                              ? setEditingChallenge({ ...editingChallenge, indice_vente_target: e.target.value })
                              : setNewChallenge({ ...newChallenge, indice_vente_target: e.target.value })
                            }
                            className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-[#ffd871] focus:outline-none"
                            placeholder="Ex: 2.5"
                          />
                        </div>
                      </div>

                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                        <p className="text-xs text-blue-800">
                          💡 <strong>Astuce :</strong> Remplissez au moins un objectif KPI. Vous pouvez combiner plusieurs KPIs pour un challenge complet.
                        </p>
                      </div>

                      <div className="flex gap-3">
                        <button
                          type="submit"
                          className="flex-1 bg-gradient-to-r from-[#ffd871] to-yellow-300 text-gray-800 font-bold py-3 px-6 rounded-xl hover:shadow-lg transition-all"
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
                                  <h4 className="font-bold text-gray-800">{challenge.title}</h4>
                                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                                    challenge.type === 'collective'
                                      ? 'bg-green-100 text-green-700'
                                      : 'bg-purple-100 text-purple-700'
                                  }`}>
                                    {challenge.type === 'collective' ? '🏆 Collectif' : '👤 Individuel'}
                                  </span>
                                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                                    challenge.status === 'active'
                                      ? 'bg-blue-100 text-blue-700'
                                      : challenge.status === 'completed'
                                      ? 'bg-green-100 text-green-700'
                                      : 'bg-red-100 text-red-700'
                                  }`}>
                                    {challenge.status === 'active' ? '✅ Actif' : challenge.status === 'completed' ? '✔️ Terminé' : '❌ Échoué'}
                                  </span>
                                </div>
                                {challenge.description && (
                                  <p className="text-sm text-gray-600 mb-2">{challenge.description}</p>
                                )}
                                <div className="flex flex-wrap gap-3 text-xs text-gray-600">
                                  <span>📅 Du {new Date(challenge.start_date).toLocaleDateString('fr-FR')} au {new Date(challenge.end_date).toLocaleDateString('fr-FR')}</span>
                                  {challenge.ca_target && <span>💰 CA: {challenge.ca_target}€</span>}
                                  {challenge.ventes_target && <span>🛍️ Ventes: {challenge.ventes_target}</span>}
                                  {challenge.panier_moyen_target && <span>🛒 PM: {challenge.panier_moyen_target}€</span>}
                                  {challenge.indice_vente_target && <span>💎 IV: {challenge.indice_vente_target}</span>}
                                </div>
                              </div>
                              <div className="flex gap-2 ml-4">
                                <button
                                  onClick={() => setEditingChallenge(challenge)}
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
