import React, { useState, useMemo } from 'react';
import { X, MessageSquare, Sparkles, Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL || '';

export default function DebriefHistoryModal({ debriefs, onClose, onNewDebrief, token }) {
  const [filtreHistorique, setFiltreHistorique] = useState('all'); // 'all', 'conclue', 'manquee'
  const [expandedDebriefs, setExpandedDebriefs] = useState({});
  const [displayLimit, setDisplayLimit] = useState(20);
  const [loading, setLoading] = useState(false);
  
  // Modal states for creating new analyses
  const [showVenteConclueForm, setShowVenteConclueForm] = useState(false);
  const [showOpportuniteManqueeForm, setShowOpportuniteManqueeForm] = useState(false);
  
  // Form states pour "Vente conclue"
  const [formConclue, setFormConclue] = useState({
    produit: '',
    type_client: '',
    situation_vente: '',
    description_vente: '',
    moment_perte_client: '', // "moment clé du succès"
    raisons_echec: '', // "facteurs de réussite"
    amelioration_pensee: '', // "ce qui a le mieux fonctionné"
    visible_to_manager: false
  });
  
  // Form states pour "Opportunité manquée"
  const [formManquee, setFormManquee] = useState({
    produit: '',
    type_client: '',
    situation_vente: '',
    description_vente: '',
    moment_perte_client: '',
    raisons_echec: '',
    amelioration_pensee: '',
    visible_to_manager: false
  });

  const toggleDebrief = (debriefId) => {
    setExpandedDebriefs(prev => ({
      ...prev,
      [debriefId]: !prev[debriefId]
    }));
  };
  
  // Soumettre le formulaire "Vente conclue"
  const handleSubmitConclue = async () => {
    if (!formConclue.produit || !formConclue.type_client || !formConclue.situation_vente || 
        !formConclue.description_vente || !formConclue.moment_perte_client || 
        !formConclue.raisons_echec || !formConclue.amelioration_pensee) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }
    
    setLoading(true);
    try {
      await axios.post(
        `${API}/api/debriefs`,
        {
          vente_conclue: true,
          visible_to_manager: formConclue.visible_to_manager,
          produit: formConclue.produit,
          type_client: formConclue.type_client,
          situation_vente: formConclue.situation_vente,
          description_vente: formConclue.description_vente,
          moment_perte_client: formConclue.moment_perte_client,
          raisons_echec: formConclue.raisons_echec,
          amelioration_pensee: formConclue.amelioration_pensee
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success('🎉 Analyse créée avec succès !');
      setFormConclue({
        produit: '',
        type_client: '',
        situation_vente: '',
        description_vente: '',
        moment_perte_client: '',
        raisons_echec: '',
        amelioration_pensee: '',
        visible_to_manager: false
      });
      setShowVenteConclueForm(false);
      if (onNewDebrief) onNewDebrief();
    } catch (error) {
      console.error('Error submitting vente conclue:', error);
      toast.error('Erreur lors de la création de l\'analyse');
    } finally {
      setLoading(false);
    }
  };
  
  // Soumettre le formulaire "Opportunité manquée"
  const handleSubmitManquee = async () => {
    if (!formManquee.produit || !formManquee.type_client || !formManquee.situation_vente || 
        !formManquee.description_vente || !formManquee.moment_perte_client || 
        !formManquee.raisons_echec || !formManquee.amelioration_pensee) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }
    
    setLoading(true);
    try {
      await axios.post(
        `${API}/api/debriefs`,
        {
          vente_conclue: false,
          visible_to_manager: formManquee.visible_to_manager,
          produit: formManquee.produit,
          type_client: formManquee.type_client,
          situation_vente: formManquee.situation_vente,
          description_vente: formManquee.description_vente,
          moment_perte_client: formManquee.moment_perte_client,
          raisons_echec: formManquee.raisons_echec,
          amelioration_pensee: formManquee.amelioration_pensee
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success('Analyse créée avec succès !');
      setFormManquee({
        produit: '',
        type_client: '',
        situation_vente: '',
        description_vente: '',
        moment_perte_client: '',
        raisons_echec: '',
        amelioration_pensee: '',
        visible_to_manager: false
      });
      setShowOpportuniteManqueeForm(false);
      if (onNewDebrief) onNewDebrief();
    } catch (error) {
      console.error('Error submitting opportunité manquée:', error);
      toast.error('Erreur lors de la création de l\'analyse');
    } finally {
      setLoading(false);
    }
  };
  
  // Toggle visibility d'une analyse
  const handleToggleVisibility = async (debriefId, currentVisibility) => {
    try {
      await axios.put(
        `${API}/api/debriefs/${debriefId}/visibility`,
        { visible_to_manager: !currentVisibility },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success(!currentVisibility ? 'Analyse visible par le manager' : 'Analyse masquée au manager');
      if (onNewDebrief) onNewDebrief();
    } catch (error) {
      console.error('Error toggling visibility:', error);
      toast.error('Erreur lors de la modification de la visibilité');
    }
  };

  // Filtrer et trier les débriefs
  const sortedAndLimitedDebriefs = useMemo(() => {
    let filtered = [...debriefs];
    
    if (filtreHistorique === 'conclue') {
      filtered = filtered.filter(d => d.vente_conclue === true);
    } else if (filtreHistorique === 'manquee') {
      filtered = filtered.filter(d => d.vente_conclue === false || !d.vente_conclue);
    }
    
    const sorted = filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return sorted.slice(0, displayLimit);
  }, [debriefs, displayLimit, filtreHistorique]);

  const hasMore = displayLimit < debriefs.length;
  const remainingCount = debriefs.length - displayLimit;

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) { onClose(); } }} 
         className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header simple sans onglets */}
        <div className="sticky top-0 bg-gradient-to-r from-[#1E40AF] to-[#1E3A8A] p-6 rounded-t-2xl">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white hover:text-gray-200 transition-colors z-10"
          >
            <X className="w-6 h-6" />
          </button>
          
          <div className="flex items-center gap-3">
            <span className="text-3xl">📊</span>
            <div>
              <h2 className="text-2xl font-bold text-white">Analyse de vente</h2>
              {debriefs.length > 0 && (
                <p className="text-blue-100 text-sm mt-1">
                  {debriefs.length} analyse{debriefs.length > 1 ? 's' : ''} enregistrée{debriefs.length > 1 ? 's' : ''}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Content - Toujours l'historique */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Form modal Vente conclue */}
          {showVenteConclueForm && (
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-xl p-4 border-l-4 border-green-500">
                <h3 className="text-lg font-bold text-green-900 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  Analyser une vente réussie
                </h3>
                <p className="text-sm text-green-700 mt-2">
                  Félicitations ! Partagez les détails de votre succès pour identifier vos forces et les reproduire.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    🎯 Produit vendu
                  </label>
                  <input
                    type="text"
                    value={formConclue.produit}
                    onChange={(e) => setFormConclue({...formConclue, produit: e.target.value})}
                    placeholder="Ex: iPhone 16 Pro Max"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    👤 Type de client
                  </label>
                  <select
                    value={formConclue.type_client}
                    onChange={(e) => setFormConclue({...formConclue, type_client: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="">Sélectionner...</option>
                    <option value="Nouveau client">Nouveau client</option>
                    <option value="Client existant">Client existant</option>
                    <option value="Client fidèle">Client fidèle</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    💼 Situation de vente
                  </label>
                  <select
                    value={formConclue.situation_vente}
                    onChange={(e) => setFormConclue({...formConclue, situation_vente: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="">Sélectionner...</option>
                    <option value="En magasin">En magasin</option>
                    <option value="Au téléphone">Au téléphone</option>
                    <option value="En ligne">En ligne</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    💬 Décrivez le déroulement de cette vente
                  </label>
                  <textarea
                    value={formConclue.description_vente}
                    onChange={(e) => setFormConclue({...formConclue, description_vente: e.target.value})}
                    placeholder="Racontez comment s'est déroulée la vente, du premier contact à la conclusion..."
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ✨ Moment clé du succès
                  </label>
                  <input
                    type="text"
                    value={formConclue.moment_perte_client}
                    onChange={(e) => setFormConclue({...formConclue, moment_perte_client: e.target.value})}
                    placeholder="Ex: Quand j'ai démontré la fonctionnalité..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    🎉 Facteurs de réussite
                  </label>
                  <input
                    type="text"
                    value={formConclue.raisons_echec}
                    onChange={(e) => setFormConclue({...formConclue, raisons_echec: e.target.value})}
                    placeholder="Ex: Bonne écoute active, argumentation personnalisée..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    💪 Ce qui a le mieux fonctionné
                  </label>
                  <textarea
                    value={formConclue.amelioration_pensee}
                    onChange={(e) => setFormConclue({...formConclue, amelioration_pensee: e.target.value})}
                    placeholder="Qu'est-ce qui a vraiment fait la différence selon vous ?"
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>

                {/* Toggle visibilité */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formConclue.visible_to_manager}
                      onChange={(e) => setFormConclue({...formConclue, visible_to_manager: e.target.checked})}
                      className="w-5 h-5 text-green-600 rounded focus:ring-green-500"
                    />
                    <div>
                      <p className="font-medium text-gray-900">Partager avec mon manager</p>
                      <p className="text-sm text-gray-600">
                        {formConclue.visible_to_manager ? (
                          <span className="flex items-center gap-1 text-green-600">
                            <Eye className="w-4 h-4" /> Votre manager pourra voir cette analyse
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-gray-500">
                            <EyeOff className="w-4 h-4" /> Cette analyse reste privée
                          </span>
                        )}
                      </p>
                    </div>
                  </label>
                </div>

                <button
                  onClick={handleSubmitConclue}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white font-bold py-3 px-6 rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      Analyse en cours...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      Obtenir mon analyse AI
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Form modal Opportunité manquée */}
          {showOpportuniteManqueeForm && (
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-orange-50 to-orange-100 rounded-xl p-4 border-l-4 border-orange-500">
                <h3 className="text-lg font-bold text-orange-900 flex items-center gap-2">
                  <XCircle className="w-5 h-5" />
                  Analyser une opportunité manquée
                </h3>
                <p className="text-sm text-orange-700 mt-2">
                  Transformez cette expérience en apprentissage. Identifiez les leviers d'amélioration.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    🎯 Produit
                  </label>
                  <input
                    type="text"
                    value={formManquee.produit}
                    onChange={(e) => setFormManquee({...formManquee, produit: e.target.value})}
                    placeholder="Ex: iPhone 16 Pro Max"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    👤 Type de client
                  </label>
                  <select
                    value={formManquee.type_client}
                    onChange={(e) => setFormManquee({...formManquee, type_client: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  >
                    <option value="">Sélectionner...</option>
                    <option value="Nouveau client">Nouveau client</option>
                    <option value="Client existant">Client existant</option>
                    <option value="Client fidèle">Client fidèle</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    💼 Situation de vente
                  </label>
                  <select
                    value={formManquee.situation_vente}
                    onChange={(e) => setFormManquee({...formManquee, situation_vente: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  >
                    <option value="">Sélectionner...</option>
                    <option value="En magasin">En magasin</option>
                    <option value="Au téléphone">Au téléphone</option>
                    <option value="En ligne">En ligne</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    💬 Décrivez ce qui s'est passé
                  </label>
                  <textarea
                    value={formManquee.description_vente}
                    onChange={(e) => setFormManquee({...formManquee, description_vente: e.target.value})}
                    placeholder="Racontez comment s'est déroulée la vente, du premier contact jusqu'à la fin..."
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    📍 Moment où vous avez perdu le client
                  </label>
                  <input
                    type="text"
                    value={formManquee.moment_perte_client}
                    onChange={(e) => setFormManquee({...formManquee, moment_perte_client: e.target.value})}
                    placeholder="Ex: Lors de l'objection sur le prix..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ❌ Raisons de l'échec (selon vous)
                  </label>
                  <input
                    type="text"
                    value={formManquee.raisons_echec}
                    onChange={(e) => setFormManquee({...formManquee, raisons_echec: e.target.value})}
                    placeholder="Ex: Pas assez écouté le besoin, argument trop générique..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    🔄 Ce que vous pensez pouvoir améliorer
                  </label>
                  <textarea
                    value={formManquee.amelioration_pensee}
                    onChange={(e) => setFormManquee({...formManquee, amelioration_pensee: e.target.value})}
                    placeholder="Qu'auriez-vous pu faire différemment ?"
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>

                {/* Toggle visibilité */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formManquee.visible_to_manager}
                      onChange={(e) => setFormManquee({...formManquee, visible_to_manager: e.target.checked})}
                      className="w-5 h-5 text-orange-600 rounded focus:ring-orange-500"
                    />
                    <div>
                      <p className="font-medium text-gray-900">Partager avec mon manager</p>
                      <p className="text-sm text-gray-600">
                        {formManquee.visible_to_manager ? (
                          <span className="flex items-center gap-1 text-orange-600">
                            <Eye className="w-4 h-4" /> Votre manager pourra voir cette analyse
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-gray-500">
                            <EyeOff className="w-4 h-4" /> Cette analyse reste privée
                          </span>
                        )}
                      </p>
                    </div>
                  </label>
                </div>

                <button
                  onClick={handleSubmitManquee}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold py-3 px-6 rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      Analyse en cours...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      Obtenir mon analyse AI
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Historique - Toujours affiché si pas de formulaire ouvert */}
          {!showVenteConclueForm && !showOpportuniteManqueeForm && (
            <>
              {debriefs.length > 0 ? (
                <>
                  {/* Filtres */}
                  <div className="mb-6 flex gap-2">
                    <button
                      onClick={() => setFiltreHistorique('all')}
                      className={`px-4 py-2 rounded-lg font-medium transition-all ${
                        filtreHistorique === 'all'
                          ? 'bg-blue-600 text-white shadow-lg'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Toutes ({debriefs.length})
                    </button>
                    <button
                      onClick={() => setFiltreHistorique('conclue')}
                      className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
                        filtreHistorique === 'conclue'
                          ? 'bg-green-600 text-white shadow-lg'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <CheckCircle className="w-4 h-4" />
                      Ventes conclues ({debriefs.filter(d => d.vente_conclue).length})
                    </button>
                    <button
                      onClick={() => setFiltreHistorique('manquee')}
                      className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
                        filtreHistorique === 'manquee'
                          ? 'bg-orange-600 text-white shadow-lg'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <XCircle className="w-4 h-4" />
                      Opportunités manquées ({debriefs.filter(d => !d.vente_conclue).length})
                    </button>
                  </div>

                  {/* Liste des débriefs */}
                  <div className="space-y-4">
                    {sortedAndLimitedDebriefs.map((debrief) => {
                      const isConclue = debrief.vente_conclue === true;
                      return (
                        <div
                          key={`debrief-${debrief.id}`}
                          className={`rounded-2xl border-2 hover:shadow-lg transition-all overflow-hidden ${
                            isConclue
                              ? 'bg-gradient-to-r from-white to-green-50 border-green-200'
                              : 'bg-gradient-to-r from-white to-orange-50 border-orange-200'
                          }`}
                        >
                          {/* Header */}
                          <button
                            onClick={() => toggleDebrief(debrief.id)}
                            className="w-full p-5 text-left hover:bg-white hover:bg-opacity-50 transition-colors"
                          >
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-3 flex-wrap">
                                  <span className={`px-3 py-1 text-white text-xs font-bold rounded-full ${
                                    isConclue ? 'bg-green-500' : 'bg-orange-500'
                                  }`}>
                                    {new Date(debrief.created_at).toLocaleDateString('fr-FR', { 
                                      day: '2-digit', 
                                      month: 'short', 
                                      year: 'numeric' 
                                    })}
                                  </span>
                                  <span className={`px-3 py-1 text-xs font-bold rounded-full ${
                                    isConclue 
                                      ? 'bg-green-100 text-green-700' 
                                      : 'bg-orange-100 text-orange-700'
                                  }`}>
                                    {isConclue ? '✅ Vente conclue' : '❌ Opportunité manquée'}
                                  </span>
                                  <span className="text-sm font-semibold text-gray-800">
                                    {debrief.produit}
                                  </span>
                                  <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded">
                                    {debrief.type_client}
                                  </span>
                                  {/* Indicateur visibilité */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleToggleVisibility(debrief.id, debrief.visible_to_manager);
                                    }}
                                    className={`px-2 py-1 text-xs font-medium rounded flex items-center gap-1 ${
                                      debrief.visible_to_manager
                                        ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                                    title={debrief.visible_to_manager ? 'Visible par le manager' : 'Privé'}
                                  >
                                    {debrief.visible_to_manager ? (
                                      <><Eye className="w-3 h-3" /> Visible</>
                                    ) : (
                                      <><EyeOff className="w-3 h-3" /> Privé</>
                                    )}
                                  </button>
                                </div>
                                <div className="space-y-2">
                                  <div className="flex items-start gap-2">
                                    <span className="text-gray-400 text-sm mt-0.5">💬</span>
                                    <p className="text-sm text-gray-700 line-clamp-2">{debrief.description_vente}</p>
                                  </div>
                                </div>
                              </div>
                              <div className="ml-4 flex-shrink-0">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg transition-all ${
                                  expandedDebriefs[debrief.id]
                                    ? isConclue ? 'bg-green-500 text-white' : 'bg-orange-500 text-white'
                                    : isConclue ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'
                                }`}>
                                  {expandedDebriefs[debrief.id] ? '−' : '+'}
                                </div>
                              </div>
                            </div>
                          </button>

                          {/* AI Analysis - Expandable */}
                          {expandedDebriefs[debrief.id] && (
                            <div className="px-5 pb-5 space-y-3 bg-white border-t-2 pt-4 animate-fadeIn"
                                 style={{
                                   borderTopColor: isConclue ? 'rgb(34, 197, 94)' : 'rgb(251, 146, 60)'
                                 }}>
                              {/* Analyse */}
                              <div className={`rounded-xl p-4 border-l-4 ${
                                isConclue
                                  ? 'bg-gradient-to-r from-green-50 to-green-100 border-green-500'
                                  : 'bg-gradient-to-r from-blue-50 to-blue-100 border-blue-500'
                              }`}>
                                <p className={`text-sm font-bold mb-2 flex items-center gap-2 ${
                                  isConclue ? 'text-green-900' : 'text-blue-900'
                                }`}>
                                  <span className="text-lg">💬</span> Analyse
                                </p>
                                <p className={`text-sm whitespace-pre-line leading-relaxed ${
                                  isConclue ? 'text-green-800' : 'text-blue-800'
                                }`}>{debrief.ai_analyse}</p>
                              </div>

                              {/* Points à travailler / Points forts */}
                              <div className={`rounded-xl p-4 border-l-4 ${
                                isConclue
                                  ? 'bg-gradient-to-r from-blue-50 to-blue-100 border-blue-500'
                                  : 'bg-gradient-to-r from-orange-50 to-orange-100 border-orange-500'
                              }`}>
                                <p className={`text-sm font-bold mb-2 flex items-center gap-2 ${
                                  isConclue ? 'text-blue-900' : 'text-orange-900'
                                }`}>
                                  <span className="text-lg">{isConclue ? '⭐' : '🎯'}</span> 
                                  {isConclue ? 'Points forts' : 'Points à travailler'}
                                </p>
                                <p className={`text-sm whitespace-pre-line leading-relaxed ${
                                  isConclue ? 'text-blue-800' : 'text-orange-800'
                                }`}>{debrief.ai_points_travailler}</p>
                              </div>

                              {/* Recommandation */}
                              <div className={`rounded-xl p-4 border-l-4 ${
                                isConclue
                                  ? 'bg-gradient-to-r from-yellow-50 to-yellow-100 border-yellow-500'
                                  : 'bg-gradient-to-r from-green-50 to-green-100 border-green-500'
                              }`}>
                                <p className={`text-sm font-bold mb-2 flex items-center gap-2 ${
                                  isConclue ? 'text-yellow-900' : 'text-green-900'
                                }`}>
                                  <span className="text-lg">🚀</span> Recommandation
                                </p>
                                <p className={`text-sm whitespace-pre-line leading-relaxed ${
                                  isConclue ? 'text-yellow-800' : 'text-green-800'
                                }`}>{debrief.ai_recommandation}</p>
                              </div>

                              {/* Exemple concret */}
                              <div className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-xl p-4 border-l-4 border-purple-500">
                                <p className="text-sm font-bold text-purple-900 mb-2 flex items-center gap-2">
                                  <span className="text-lg">💡</span> Exemple concret
                                </p>
                                <p className="text-sm text-purple-800 italic whitespace-pre-line leading-relaxed">{debrief.ai_exemple_concret}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Bouton Charger plus */}
                  {hasMore && (
                    <div className="mt-6 text-center">
                      <button
                        onClick={() => setDisplayLimit(prev => prev + 20)}
                        className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-all inline-flex items-center gap-2"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                        Charger plus ({remainingCount} analyse{remainingCount > 1 ? 's' : ''} restante{remainingCount > 1 ? 's' : ''})
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">💬</div>
                  <p className="text-gray-500 font-medium mb-4">Aucune analyse pour le moment</p>
                  <p className="text-gray-400 text-sm mb-6">Commencez à analyser vos ventes !</p>
                  <div className="flex gap-3 justify-center">
                    <button
                      onClick={() => setActiveTab('conclue')}
                      className="btn-primary inline-flex items-center gap-2 bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="w-5 h-5" />
                      Vente conclue
                    </button>
                    <button
                      onClick={() => setActiveTab('manquee')}
                      className="btn-primary inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-700"
                    >
                      <XCircle className="w-5 h-5" />
                      Opportunité manquée
                    </button>
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
