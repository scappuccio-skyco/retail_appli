import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { X, MessageCircle, AlertTriangle, Users, Loader, Filter, Calendar, ChevronDown, Trash2 } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

export default function RelationshipManagementModal({ onClose, onSuccess, sellers = [], autoShowResult = false }) {
  // Use all sellers (no filter) - archived sellers are already filtered by ManagerDashboard
  const activeSellers = sellers;
  
  // Debug
  console.log('Total sellers:', sellers.length);
  console.log('Active sellers:', activeSellers.length);
  console.log('Sellers data:', sellers);
  if (sellers.length > 0) {
    console.log('First seller structure:', sellers[0]);
  }
  const [activeMainTab, setActiveMainTab] = useState(autoShowResult ? 'history' : 'form'); // 'form' or 'history'
  const [activeFormTab, setActiveFormTab] = useState('relationnel'); // 'relationnel' or 'conflit'
  const [activeHistoryTab, setActiveHistoryTab] = useState('all'); // 'all', 'relationnel', or 'conflit'
  const [selectedSeller, setSelectedSeller] = useState('');
  const [situationType, setSituationType] = useState('');
  const [description, setDescription] = useState('');
  const [history, setHistory] = useState([]);
  const [historyFilter, setHistoryFilter] = useState('all');
  const [isSellerDropdownOpen, setIsSellerDropdownOpen] = useState(false);
  const sellerDropdownRef = useRef(null);
  const [expandedItems, setExpandedItems] = useState({});
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const filterDropdownRef = useRef(null);
  
  // Types de situations
  const situationTypes = {
    relationnel: [
      { value: 'augmentation', label: '💰 Demande d\'augmentation' },
      { value: 'demotivation', label: '😔 Baisse de motivation' },
      { value: 'formation', label: '📚 Demande de formation' },
      { value: 'reorganisation', label: '🔄 Adaptation à une réorganisation' },
      { value: 'charge_travail', label: '⚖️ Charge de travail' },
      { value: 'ambitions', label: '🎯 Discussion sur les ambitions' },
      { value: 'feedback', label: '💬 Donner un feedback constructif' },
      { value: 'autre', label: '📝 Autre situation' }
    ],
    conflit: [
      { value: 'collegue', label: '👥 Conflit avec un collègue' },
      { value: 'client', label: '🛍️ Conflit avec un client' },
      { value: 'manager', label: '👔 Tension avec le manager' },
      { value: 'communication', label: '💬 Problème de communication' },
      { value: 'horaires', label: '⏰ Conflit d\'horaires' },
      { value: 'taches', label: '📋 Désaccord sur les tâches' },
      { value: 'comportement', label: '⚠️ Comportement inapproprié' },
      { value: 'autre', label: '📝 Autre conflit' }
    ]
  };
  
  // Load history
  const loadHistory = async (sellerId = null) => {
    try {
      const token = localStorage.getItem('token');
      const url = sellerId 
        ? `${API}/api/manager/relationship-history?seller_id=${sellerId}`
        : `${API}/api/manager/relationship-history`;
      
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const consultations = response.data.consultations || [];
      setHistory(consultations);
      
      // Si autoShowResult, auto-expand le dernier bilan
      if (autoShowResult && consultations.length > 0) {
        const latestId = consultations[0].consultation_id;
        setExpandedItems({ [latestId]: true });
      }
    } catch (error) {
      console.error('Error loading history:', error);
      toast.error('Erreur lors du chargement de l\'historique');
    }
  };
  
  const handleDeleteConsultation = async (consultationId) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette consultation ?')) {
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      await axios.delete(
        `${API}/api/manager/relationship-consultation/${consultationId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success('Consultation supprimée avec succès');
      // Recharger l'historique
      loadHistory(historyFilter !== 'all' ? historyFilter : null);
    } catch (error) {
      console.error('Error deleting consultation:', error);
      toast.error('Erreur lors de la suppression');
    }
  };
  
  useEffect(() => {
    if (activeMainTab === 'history') {
      loadHistory();
    }
  }, [activeMainTab]);
  
  // Close dropdown when clicking outside (filter dropdown)
  useEffect(() => {
    function handleClickOutside(event) {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target)) {
        setIsFilterDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  // Pattern Ultra Simple - Pas de useEffect compliqué
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (sellerDropdownRef.current && !sellerDropdownRef.current.contains(event.target)) {
        setIsSellerDropdownOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  const handleGenerateAdvice = async (e) => {
    e.preventDefault();
    
    if (!selectedSeller || !situationType || !description.trim()) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }
    
    // IMPORTANT : Fermer le modal AVANT l'appel API (pattern correct)
    // Le parent va faire l'appel API et rouvrir le modal
    if (onSuccess) {
      onSuccess({
        seller_id: selectedSeller,
        advice_type: activeFormTab,
        situation_type: situationType,
        description: description
      });
    }
  };
  
  const resetForm = () => {
    setSelectedSeller('');
    setSituationType('');
    setDescription('');
  };
  
  // Filter history by type and seller
  const filteredHistory = history
    .filter(h => {
      // Filter by type tab
      if (activeHistoryTab === 'relationnel') return h.advice_type === 'relationnel';
      if (activeHistoryTab === 'conflit') return h.advice_type === 'conflit';
      return true; // 'all'
    })
    .filter(h => {
      // Filter by seller
      if (historyFilter === 'all') return true;
      return h.seller_id === historyFilter;
    });
  
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
          <div className="flex gap-2 px-6 pt-2">
            <button
              onClick={() => {
                setActiveMainTab('form');
                setActiveFormTab('relationnel');
                resetForm();
              }}
              className={`px-6 py-3 font-semibold transition-all rounded-t-lg ${
                activeMainTab === 'form' && activeFormTab === 'relationnel'
                  ? 'bg-purple-300 text-gray-800 shadow-md border-b-4 border-purple-500'
                  : 'text-gray-600 hover:text-purple-600 hover:bg-gray-100'
              }`}
            >
              <MessageCircle className="w-4 h-4 inline mr-2" />
              Gestion relationnelle
            </button>
            <button
              onClick={() => {
                setActiveMainTab('form');
                setActiveFormTab('conflit');
                resetForm();
              }}
              className={`px-6 py-3 font-semibold transition-all rounded-t-lg ${
                activeMainTab === 'form' && activeFormTab === 'conflit'
                  ? 'bg-purple-300 text-gray-800 shadow-md border-b-4 border-purple-500'
                  : 'text-gray-600 hover:text-purple-600 hover:bg-gray-100'
              }`}
            >
              <AlertTriangle className="w-4 h-4 inline mr-2" />
              Gestion de conflit
            </button>
            <button
              onClick={() => setActiveMainTab('history')}
              className={`px-6 py-3 font-semibold transition-all rounded-t-lg ${
                activeMainTab === 'history'
                  ? 'bg-purple-300 text-gray-800 shadow-md border-b-4 border-purple-500'
                  : 'text-gray-600 hover:text-purple-600 hover:bg-gray-100'
              }`}
            >
              <Calendar className="w-4 h-4 inline mr-2" />
              Historique
            </button>
          </div>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeMainTab === 'form' ? (
            <div className="space-y-6">
              {/* Info banner */}
              <div className="bg-purple-500 rounded-xl p-4 border-2 border-purple-600">
                <p className="text-sm text-white font-bold">
                  💡 <strong>Recommandations IA personnalisées</strong> : Les conseils sont adaptés aux profils de personnalité, performances et historique de debriefs.
                </p>
              </div>
              
              {/* Form */}
              <form onSubmit={handleGenerateAdvice} className="space-y-4">
                {/* Seller selection - Custom Dropdown */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    👤 Membre de l'équipe concerné
                  </label>
                  <div className="relative" ref={sellerDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setIsSellerDropdownOpen(!isSellerDropdownOpen)}
                      className={`w-full px-4 py-3 border-2 ${
                        isSellerDropdownOpen ? 'border-purple-500' : 'border-gray-300'
                      } rounded-lg focus:border-purple-500 focus:outline-none bg-white text-left flex items-center justify-between transition-colors`}
                    >
                      <span className={selectedSeller ? 'text-gray-900' : 'text-gray-400'}>
                        {selectedSeller 
                          ? activeSellers.find(s => s.id === selectedSeller)?.name || 
                            `${activeSellers.find(s => s.id === selectedSeller)?.first_name || ''} ${activeSellers.find(s => s.id === selectedSeller)?.last_name || ''}`.trim()
                          : 'Sélectionner un vendeur...'}
                      </span>
                      <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${isSellerDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {isSellerDropdownOpen && (
                      <div className="absolute z-10 w-full mt-2 bg-white border-2 border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {activeSellers.length === 0 ? (
                          <div className="px-4 py-3 text-gray-500 text-sm">
                            Aucun vendeur actif disponible
                          </div>
                        ) : (
                          activeSellers.map(seller => (
                            <button
                              key={seller.id}
                              type="button"
                              onClick={() => {
                                setSelectedSeller(seller.id);
                                setIsSellerDropdownOpen(false);
                              }}
                              className={`w-full px-4 py-3 text-left hover:bg-purple-50 transition-colors border-b border-gray-100 last:border-b-0 ${
                                selectedSeller === seller.id 
                                  ? 'bg-purple-100 text-purple-700 font-semibold' 
                                  : 'text-gray-900'
                              }`}
                            >
                              {seller.name || `${seller.first_name || ''} ${seller.last_name || ''}`.trim() || 'Vendeur sans nom'}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-700 mt-1 font-semibold">
                    {activeSellers.length > 0 
                      ? `✓ ${activeSellers.length} vendeur(s) actif(s) disponible(s)` 
                      : '⚠️ Aucun vendeur actif disponible'}
                  </p>
                </div>
                
                {/* Situation type */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    📋 Type de situation
                  </label>
                  <select
                    value={situationType}
                    onChange={(e) => setSituationType(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none"
                    style={{ color: '#1f2937', backgroundColor: '#ffffff' }}
                    required
                  >
                    <option value="" style={{ color: '#6b7280' }}>Choisir le type de situation...</option>
                    {situationTypes[activeFormTab].map(type => (
                      <option key={type.value} value={type.value} style={{ color: '#1f2937' }}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>
                
                {/* Description */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    📝 Description détaillée
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Décrivez la situation en détail : contexte, ce qui s'est passé, ce que le vendeur a dit, vos préoccupations..."
                    rows={6}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none resize-none"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Plus vous donnez de détails, plus les recommandations seront précises
                  </p>
                </div>
                
                {/* Submit button */}
                <button
                  type="submit"
                  className="w-full py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  <MessageCircle className="w-5 h-5" />
                  Obtenir des recommandations
                </button>
              </form>
            </div>
          ) : (
            /* History view */
            <div className="space-y-4">
              {/* History sub-tabs */}
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setActiveHistoryTab('all')}
                  className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all border-2 ${
                    activeHistoryTab === 'all'
                      ? 'border-purple-500 bg-purple-500 text-white shadow-md'
                      : 'border-gray-300 text-gray-700 hover:border-purple-400 hover:text-purple-600 hover:bg-purple-50'
                  }`}
                >
                  📊 Tout l'historique
                </button>
                <button
                  onClick={() => setActiveHistoryTab('relationnel')}
                  className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all border-2 ${
                    activeHistoryTab === 'relationnel'
                      ? 'border-purple-500 bg-purple-500 text-white shadow-md'
                      : 'border-gray-300 text-gray-700 hover:border-purple-400 hover:text-purple-600 hover:bg-purple-50'
                  }`}
                >
                  <MessageCircle className="w-4 h-4 inline mr-1" />
                  Relationnel
                </button>
                <button
                  onClick={() => setActiveHistoryTab('conflit')}
                  className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all border-2 ${
                    activeHistoryTab === 'conflit'
                      ? 'border-purple-500 bg-purple-500 text-white shadow-md'
                      : 'border-gray-300 text-gray-700 hover:border-purple-400 hover:text-purple-600 hover:bg-purple-50'
                  }`}
                >
                  <AlertTriangle className="w-4 h-4 inline mr-1" />
                  Conflit
                </button>
              </div>

              {/* Filter by seller - Custom Dropdown */}
              <div className="flex items-center gap-3">
                <Filter className="w-5 h-5 text-gray-600" />
                <label className="text-sm font-semibold text-gray-700 mr-2">Filtrer par vendeur :</label>
                <div className="relative" ref={filterDropdownRef}>
                  <button
                    onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
                    className="px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none bg-white text-gray-900 flex items-center justify-between gap-3 min-w-[250px] hover:bg-gray-50 transition-colors"
                  >
                    <span>
                      {historyFilter === 'all' 
                        ? 'Tous les vendeurs' 
                        : sellers.find(s => s.id === historyFilter)?.name || 'Sélectionner...'}
                    </span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${isFilterDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {isFilterDropdownOpen && (
                    <div className="absolute top-full left-0 mt-2 w-full bg-white border-2 border-gray-300 rounded-lg shadow-xl z-10 max-h-64 overflow-y-auto">
                      <button
                        onClick={() => {
                          setHistoryFilter('all');
                          loadHistory(null);
                          setIsFilterDropdownOpen(false);
                        }}
                        className={`w-full px-4 py-2 text-left hover:bg-purple-50 transition-colors ${
                          historyFilter === 'all' ? 'bg-purple-100 text-purple-700 font-semibold' : 'text-gray-900'
                        }`}
                      >
                        Tous les vendeurs
                      </button>
                      {sellers.map(seller => (
                        <button
                          key={seller.id}
                          onClick={() => {
                            setHistoryFilter(seller.id);
                            loadHistory(seller.id);
                            setIsFilterDropdownOpen(false);
                          }}
                          className={`w-full px-4 py-2 text-left hover:bg-purple-50 transition-colors ${
                            historyFilter === seller.id ? 'bg-purple-100 text-purple-700 font-semibold' : 'text-gray-900'
                          }`}
                        >
                          {seller.name} {seller.status !== 'active' && `(${seller.status})`}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
              {/* History list */}
              {filteredHistory.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>Aucune consultation dans l'historique</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredHistory.map((item, index) => {
                    const isExpanded = expandedItems[item.id];
                    const isLatest = index === 0;
                    
                    return (
                      <div 
                        key={item.id} 
                        className={`border-2 rounded-xl overflow-hidden transition-all ${
                          isLatest 
                            ? 'border-purple-400 bg-gradient-to-br from-purple-50 to-indigo-50 shadow-lg' 
                            : 'border-gray-200 bg-white hover:shadow-md'
                        }`}
                      >
                        {/* Header - Cliquable pour expand/collapse */}
                        <div 
                          className="p-4 cursor-pointer hover:bg-white/50 transition-colors"
                          onClick={() => setExpandedItems(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                {isLatest && (
                                  <span className="px-2 py-0.5 bg-purple-500 text-white text-xs font-bold rounded-full">
                                    NOUVEAU
                                  </span>
                                )}
                                <h4 className="font-bold text-gray-800">
                                  {item.seller_name}
                                  {item.seller_status !== 'active' && (
                                    <span className="text-xs text-gray-500 ml-2">({item.seller_status})</span>
                                  )}
                                </h4>
                              </div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                                  item.advice_type === 'relationnel' 
                                    ? 'bg-blue-100 text-blue-700' 
                                    : 'bg-red-100 text-red-700'
                                }`}>
                                  {item.advice_type === 'relationnel' ? '🤝 Relationnel' : '⚡ Conflit'}
                                </span>
                                <span className="text-sm text-gray-600 font-medium">
                                  {item.situation_type}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="flex flex-col items-end gap-2">
                                <span className="text-xs text-gray-500 font-medium">
                                  {new Date(item.created_at).toLocaleDateString('fr-FR', { 
                                    day: 'numeric', 
                                    month: 'short', 
                                    year: 'numeric' 
                                  })}
                                </span>
                                <ChevronDown 
                                  className={`w-5 h-5 text-gray-500 transition-transform ${
                                    isExpanded ? 'rotate-180' : ''
                                  }`}
                                />
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteConsultation(item.id);
                                }}
                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                title="Supprimer cette consultation"
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
                            </div>
                          </div>
                          
                          {/* Aperçu de la situation quand fermé */}
                          {!isExpanded && (
                            <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                              <strong>Situation :</strong> {item.description}
                            </p>
                          )}
                        </div>
                        
                        {/* Contenu détaillé quand ouvert - Design inspiré du Défi IA */}
                        {isExpanded && (
                          <div className="border-t-2 border-gray-200 bg-gradient-to-br from-orange-50 to-yellow-50">
                            {/* Situation complète */}
                            <div className="p-6">
                              <div className="bg-white rounded-xl p-5 shadow-sm border-l-4 border-orange-400 mb-6">
                                <h5 className="font-bold text-gray-800 mb-3 flex items-center gap-2 text-base">
                                  📋 Situation décrite
                                </h5>
                                <p className="text-gray-700 leading-relaxed">
                                  {item.description}
                                </p>
                              </div>
                            
                              {/* Recommandations avec design amélioré */}
                              <div className="space-y-4">
                                {(() => {
                                  const sections = item.recommendation.split('##').filter(s => s.trim());
                                  
                                  return sections.map((section, idx) => {
                                    const lines = section.trim().split('\n');
                                    const title = lines[0].trim();
                                    const content = lines.slice(1).join('\n').trim();
                                    
                                    // Déterminer la couleur selon le type de section
                                    let colorScheme = {
                                      badge: 'bg-purple-100 text-purple-800',
                                      card: 'bg-purple-50 border-purple-200',
                                      icon: '💡'
                                    };
                                    
                                    if (title.toLowerCase().includes('analyse')) {
                                      colorScheme = {
                                        badge: 'bg-blue-100 text-blue-800',
                                        card: 'bg-blue-50 border-blue-200',
                                        icon: '🔍'
                                      };
                                    } else if (title.toLowerCase().includes('conseil') || title.toLowerCase().includes('pratique')) {
                                      colorScheme = {
                                        badge: 'bg-green-100 text-green-800',
                                        card: 'bg-green-50 border-green-200',
                                        icon: '✅'
                                      };
                                    } else if (title.toLowerCase().includes('phrase') || title.toLowerCase().includes('communication')) {
                                      colorScheme = {
                                        badge: 'bg-amber-100 text-amber-800',
                                        card: 'bg-amber-50 border-amber-200',
                                        icon: '💬'
                                      };
                                    } else if (title.toLowerCase().includes('vigilance')) {
                                      colorScheme = {
                                        badge: 'bg-red-100 text-red-800',
                                        card: 'bg-red-50 border-red-200',
                                        icon: '⚠️'
                                      };
                                    }
                                    
                                    return (
                                      <div key={idx} className={`rounded-xl p-5 shadow-sm border-2 ${colorScheme.card}`}>
                                        {/* Badge titre */}
                                        <div className="mb-4">
                                          <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full font-bold text-sm ${colorScheme.badge}`}>
                                            <span>{colorScheme.icon}</span>
                                            {title}
                                          </span>
                                        </div>
                                        
                                        {/* Contenu */}
                                        <div className="space-y-3">
                                          {content.split('\n').map((line, lineIdx) => {
                                            const cleaned = line.trim();
                                            if (!cleaned) return null;
                                            
                                            // Liste numérotée (style défi IA)
                                            if (cleaned.match(/^\d+[\.)]/)) {
                                              const number = cleaned.match(/^(\d+)[\.)]/)[1];
                                              const text = cleaned.replace(/^\d+[\.)]\s*/, '');
                                              return (
                                                <div key={lineIdx} className="flex gap-3 items-start bg-white rounded-lg p-3 shadow-sm">
                                                  <span className="flex-shrink-0 w-7 h-7 bg-gradient-to-br from-purple-500 to-indigo-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                                                    {number}
                                                  </span>
                                                  <p className="flex-1 text-gray-800">{text}</p>
                                                </div>
                                              );
                                            }
                                            
                                            // Liste à puces
                                            if (cleaned.startsWith('-') || cleaned.startsWith('•')) {
                                              const text = cleaned.replace(/^[-•]\s*/, '');
                                              return (
                                                <div key={lineIdx} className="flex gap-3 items-start">
                                                  <span className="text-purple-600 font-bold text-lg mt-0.5">•</span>
                                                  <p className="flex-1 text-gray-700">{text}</p>
                                                </div>
                                              );
                                            }
                                            
                                            // Paragraphe normal
                                            return (
                                              <p key={lineIdx} className="text-gray-700 leading-relaxed">
                                                {cleaned}
                                              </p>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    );
                                  });
                                })()}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
