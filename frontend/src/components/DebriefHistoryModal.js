import React, { useState, useMemo } from 'react';
import { X, MessageSquare, Sparkles, Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL || '';

export default function DebriefHistoryModal({ debriefs, onClose, onNewDebrief, token }) {
  const [filtreHistorique, setFiltreHistorique] = useState('all');
  const [expandedDebriefs, setExpandedDebriefs] = useState({});
  const [displayLimit, setDisplayLimit] = useState(20);
  const [loading, setLoading] = useState(false);
  
  // Modal states
  const [showVenteConclueForm, setShowVenteConclueForm] = useState(false);
  const [showOpportuniteManqueeForm, setShowOpportuniteManqueeForm] = useState(false);
  
  // Form vente conclue
  const [formConclue, setFormConclue] = useState({
    produit: '',
    type_client: '',
    description_vente: '',
    moment_perte_client: [], // Sélection multiple
    moment_perte_autre: '',
    raisons_echec: [], // Sélection multiple
    raisons_echec_autre: '',
    amelioration_pensee: '',
    visible_to_manager: false
  });
  
  // Form opportunité manquée
  const [formManquee, setFormManquee] = useState({
    produit: '',
    type_client: '',
    description_vente: '',
    moment_perte_client: [], // Sélection multiple
    moment_perte_autre: '',
    raisons_echec: [], // Sélection multiple
    raisons_echec_autre: '',
    amelioration_pensee: '',
    visible_to_manager: false
  });

  const toggleDebrief = (debriefId) => {
    setExpandedDebriefs(prev => ({
      ...prev,
      [debriefId]: !prev[debriefId]
    }));
  };
  
  // Toggle checkbox pour sélection multiple
  const toggleCheckbox = (form, setForm, field, value) => {
    setForm(prev => {
      const currentArray = prev[field] || [];
      const newArray = currentArray.includes(value)
        ? currentArray.filter(item => item !== value)
        : [...currentArray, value];
      return { ...prev, [field]: newArray };
    });
  };
  
  // Soumettre vente conclue
  const handleSubmitConclue = async () => {
    // Validation détaillée
    if (!formConclue.produit.trim()) {
      toast.error('📦 Veuillez indiquer le produit vendu');
      return;
    }
    
    if (!formConclue.type_client) {
      toast.error('👤 Veuillez sélectionner le type de client');
      return;
    }
    
    if (!formConclue.description_vente.trim()) {
      toast.error('💬 Veuillez décrire brièvement la vente');
      return;
    }
    
    if (formConclue.moment_perte_client.length === 0) {
      toast.error('✨ Veuillez sélectionner au moins un moment clé du succès');
      return;
    }
    
    if (formConclue.moment_perte_client.includes('Autre') && !formConclue.moment_perte_autre.trim()) {
      toast.error('✨ Veuillez préciser le moment clé (Autre)');
      return;
    }
    
    if (formConclue.raisons_echec.length === 0) {
      toast.error('🎉 Veuillez sélectionner au moins un facteur de réussite');
      return;
    }
    
    if (formConclue.raisons_echec.includes('Autre') && !formConclue.raisons_echec_autre.trim()) {
      toast.error('🎉 Veuillez préciser les facteurs de réussite (Autre)');
      return;
    }
    
    if (!formConclue.amelioration_pensee.trim()) {
      toast.error('💪 Veuillez indiquer ce qui a fait la différence');
      return;
    }
    
    setLoading(true);
    try {
      // Préparer les données
      const moment = formConclue.moment_perte_client.includes('Autre')
        ? formConclue.moment_perte_client.filter(m => m !== 'Autre').concat([formConclue.moment_perte_autre]).join(', ')
        : formConclue.moment_perte_client.join(', ');
      const raisons = formConclue.raisons_echec.includes('Autre') 
        ? formConclue.raisons_echec.filter(r => r !== 'Autre').concat([formConclue.raisons_echec_autre]).join(', ')
        : formConclue.raisons_echec.join(', ');
      
      await axios.post(
        `${API}/api/debriefs`,
        {
          vente_conclue: true,
          visible_to_manager: formConclue.visible_to_manager,
          produit: formConclue.produit,
          type_client: formConclue.type_client,
          situation_vente: 'En magasin', // Toujours en magasin
          description_vente: formConclue.description_vente,
          moment_perte_client: moment,
          raisons_echec: raisons,
          amelioration_pensee: formConclue.amelioration_pensee
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success('🎉 Analyse créée avec succès !');
      setFormConclue({
        produit: '',
        type_client: '',
        description_vente: '',
        moment_perte_client: [],
        moment_perte_autre: '',
        raisons_echec: [],
        raisons_echec_autre: '',
        amelioration_pensee: '',
        visible_to_manager: false
      });
      setShowVenteConclueForm(false);
      if (onNewDebrief) onNewDebrief();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Erreur lors de la création');
    } finally {
      setLoading(false);
    }
  };
  
  // Soumettre opportunité manquée
  const handleSubmitManquee = async () => {
    // Validation détaillée
    if (!formManquee.produit.trim()) {
      toast.error('📦 Veuillez indiquer le produit');
      return;
    }
    
    if (!formManquee.type_client) {
      toast.error('👤 Veuillez sélectionner le type de client');
      return;
    }
    
    if (!formManquee.description_vente.trim()) {
      toast.error('💬 Veuillez décrire ce qui s\'est passé');
      return;
    }
    
    if (formManquee.moment_perte_client.length === 0) {
      toast.error('⏱️ Veuillez sélectionner au moins un moment où ça a basculé');
      return;
    }
    
    if (formManquee.moment_perte_client.includes('Autre') && !formManquee.moment_perte_autre.trim()) {
      toast.error('⏱️ Veuillez préciser le moment (Autre)');
      return;
    }
    
    if (formManquee.raisons_echec.length === 0) {
      toast.error('🤔 Veuillez sélectionner au moins une raison de l\'échec');
      return;
    }
    
    if (formManquee.raisons_echec.includes('Autre') && !formManquee.raisons_echec_autre.trim()) {
      toast.error('🤔 Veuillez préciser les raisons (Autre)');
      return;
    }
    
    if (!formManquee.amelioration_pensee.trim()) {
      toast.error('🔄 Veuillez indiquer ce que vous auriez pu faire différemment');
      return;
    }
    
    setLoading(true);
    try {
      const moment = formManquee.moment_perte_client.includes('Autre')
        ? formManquee.moment_perte_client.filter(m => m !== 'Autre').concat([formManquee.moment_perte_autre]).join(', ')
        : formManquee.moment_perte_client.join(', ');
      const raisons = formManquee.raisons_echec.includes('Autre')
        ? formManquee.raisons_echec.filter(r => r !== 'Autre').concat([formManquee.raisons_echec_autre]).join(', ')
        : formManquee.raisons_echec.join(', ');
      
      await axios.post(
        `${API}/api/debriefs`,
        {
          vente_conclue: false,
          visible_to_manager: formManquee.visible_to_manager,
          produit: formManquee.produit,
          type_client: formManquee.type_client,
          situation_vente: 'En magasin',
          description_vente: formManquee.description_vente,
          moment_perte_client: moment,
          raisons_echec: raisons,
          amelioration_pensee: formManquee.amelioration_pensee
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success('Analyse créée avec succès !');
      setFormManquee({
        produit: '',
        type_client: '',
        description_vente: '',
        moment_perte_client: [],
        moment_perte_autre: '',
        raisons_echec: [],
        raisons_echec_autre: '',
        amelioration_pensee: '',
        visible_to_manager: false
      });
      setShowOpportuniteManqueeForm(false);
      if (onNewDebrief) onNewDebrief();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Erreur lors de la création');
    } finally {
      setLoading(false);
    }
  };
  
  // Toggle visibility
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
      console.error('Error:', error);
      toast.error('Erreur lors de la modification');
    }
  };

  // Filtrer debriefs
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
    <div onClick={(e) => { if (e.target === e.currentTarget && !loading) { onClose(); } }} 
         className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header simple */}
        <div className="sticky top-0 bg-gradient-to-r from-[#1E40AF] to-[#1E3A8A] p-6 rounded-t-2xl">
          <button
            onClick={onClose}
            disabled={loading}
            className="absolute top-4 right-4 text-white hover:text-gray-200 transition-colors z-10 disabled:opacity-50 disabled:cursor-not-allowed"
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* FORM VENTE CONCLUE */}
          {showVenteConclueForm && (
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-xl p-4 border-l-4 border-green-500">
                <h3 className="text-lg font-bold text-green-900 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  Analyser une vente réussie
                </h3>
                <p className="text-sm text-green-700 mt-2">
                  Super ! Quelques secondes pour enregistrer ce succès 🎉
                </p>
              </div>

              <div className="space-y-4">
                {/* Produit */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    🎯 Produit vendu
                  </label>
                  <input
                    type="text"
                    value={formConclue.produit}
                    onChange={(e) => setFormConclue({...formConclue, produit: e.target.value})}
                    placeholder="Ex: iPhone 16 Pro"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>

                {/* Type client */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    👤 Type de client
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {['Nouveau client', 'Client fidèle', 'Touriste', 'Indécis'].map(type => (
                      <button
                        key={`conclue-type-${type}`}
                        type="button"
                        onClick={() => setFormConclue({...formConclue, type_client: type})}
                        className={`p-2 rounded-lg border-2 text-sm font-medium transition-all ${
                          formConclue.type_client === type
                            ? 'border-green-500 bg-green-50 text-green-700'
                            : 'border-gray-200 hover:border-green-300'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Description courte */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    💬 En 2 mots, comment ça s'est passé ?
                  </label>
                  <textarea
                    value={formConclue.description_vente}
                    onChange={(e) => setFormConclue({...formConclue, description_vente: e.target.value})}
                    placeholder="Ex: Client convaincu dès la démo..."
                    rows={2}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                  />
                </div>

                {/* Moment clé - SÉLECTION MULTIPLE */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ✨ Moments clés du succès (plusieurs choix possibles)
                  </label>
                  <div className="space-y-2">
                    {['Accueil', 'Découverte du besoin', 'Argumentation', 'Closing', 'Autre'].map(moment => (
                      <label
                        key={`conclue-moment-${moment}`}
                        className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                          formConclue.moment_perte_client.includes(moment)
                            ? 'border-green-500 bg-green-50'
                            : 'border-gray-200 hover:border-green-300 hover:bg-green-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={formConclue.moment_perte_client.includes(moment)}
                          onChange={() => toggleCheckbox(formConclue, setFormConclue, 'moment_perte_client', moment)}
                          className="w-5 h-5 text-green-600 rounded focus:ring-green-500"
                        />
                        <span className="text-sm font-medium text-gray-700">{moment}</span>
                      </label>
                    ))}
                  </div>
                  {formConclue.moment_perte_client.includes('Autre') && (
                    <input
                      type="text"
                      value={formConclue.moment_perte_autre}
                      onChange={(e) => setFormConclue({...formConclue, moment_perte_autre: e.target.value})}
                      placeholder="Précisez..."
                      className="w-full mt-2 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    />
                  )}
                </div>

                {/* Facteurs de réussite - SÉLECTION MULTIPLE */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    🎉 Facteurs de réussite (plusieurs choix possibles)
                  </label>
                  <div className="space-y-2">
                    {[
                      'Bonne écoute active',
                      'Argumentation solide',
                      'Produit adapté au besoin',
                      'Bonne relation établie',
                      'Autre'
                    ].map(facteur => (
                      <label
                        key={`conclue-facteur-${facteur}`}
                        className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                          formConclue.raisons_echec.includes(facteur)
                            ? 'border-green-500 bg-green-50'
                            : 'border-gray-200 hover:border-green-300 hover:bg-green-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={formConclue.raisons_echec.includes(facteur)}
                          onChange={() => toggleCheckbox(formConclue, setFormConclue, 'raisons_echec', facteur)}
                          className="w-5 h-5 text-green-600 rounded focus:ring-green-500"
                        />
                        <span className="text-sm font-medium text-gray-700">{facteur}</span>
                      </label>
                    ))}
                  </div>
                  {formConclue.raisons_echec.includes('Autre') && (
                    <textarea
                      value={formConclue.raisons_echec_autre}
                      onChange={(e) => setFormConclue({...formConclue, raisons_echec_autre: e.target.value})}
                      placeholder="Précisez les autres facteurs..."
                      rows={2}
                      className="w-full mt-2 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 resize-none"
                    />
                  )}
                </div>

                {/* Ce qui a fonctionné */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    💪 Qu'est-ce qui a vraiment fait la différence ?
                  </label>
                  <textarea
                    value={formConclue.amelioration_pensee}
                    onChange={(e) => setFormConclue({...formConclue, amelioration_pensee: e.target.value})}
                    placeholder="Ex: La démo en direct..."
                    rows={2}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 resize-none"
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
                            <Eye className="w-4 h-4" /> Visible
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-gray-500">
                            <EyeOff className="w-4 h-4" /> Privé
                          </span>
                        )}
                      </p>
                    </div>
                  </label>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowVenteConclueForm(false)}
                    disabled={loading}
                    className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-all"
                  >
                    ← Retour
                  </button>
                  <button
                    onClick={handleSubmitConclue}
                    disabled={loading}
                    className="flex-1 bg-gradient-to-r from-green-500 to-green-600 text-white font-bold py-3 px-6 rounded-xl hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
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
            </div>
          )}

          {/* FORM OPPORTUNITÉ MANQUÉE */}
          {showOpportuniteManqueeForm && (
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-orange-50 to-orange-100 rounded-xl p-4 border-l-4 border-orange-500">
                <h3 className="text-lg font-bold text-orange-900 flex items-center gap-2">
                  <XCircle className="w-5 h-5" />
                  Analyser une opportunité manquée
                </h3>
                <p className="text-sm text-orange-700 mt-2">
                  Quelques secondes pour progresser 📈
                </p>
              </div>

              <div className="space-y-4">
                {/* Produit */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    🎯 Produit
                  </label>
                  <input
                    type="text"
                    value={formManquee.produit}
                    onChange={(e) => setFormManquee({...formManquee, produit: e.target.value})}
                    placeholder="Ex: iPhone 16 Pro"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>

                {/* Type client */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    👤 Type de client
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {['Nouveau client', 'Client fidèle', 'Touriste', 'Indécis'].map(type => (
                      <button
                        key={`manquee-type-${type}`}
                        type="button"
                        onClick={() => setFormManquee({...formManquee, type_client: type})}
                        className={`p-2 rounded-lg border-2 text-sm font-medium transition-all ${
                          formManquee.type_client === type
                            ? 'border-orange-500 bg-orange-50 text-orange-700'
                            : 'border-gray-200 hover:border-orange-300'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    💬 En 2 mots, ce qui s'est passé
                  </label>
                  <textarea
                    value={formManquee.description_vente}
                    onChange={(e) => setFormManquee({...formManquee, description_vente: e.target.value})}
                    placeholder="Ex: Client hésitant sur le prix..."
                    rows={2}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 resize-none"
                  />
                </div>

                {/* Moment de perte - SÉLECTION MULTIPLE */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ⏱️ Moments où ça a basculé (plusieurs choix possibles)
                  </label>
                  <div className="space-y-2">
                    {['Accueil', 'Découverte du besoin', 'Argumentation', 'Objections', 'Closing', 'Autre'].map(moment => (
                      <label
                        key={`manquee-moment-${moment}`}
                        className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                          formManquee.moment_perte_client.includes(moment)
                            ? 'border-orange-500 bg-orange-50'
                            : 'border-gray-200 hover:border-orange-300 hover:bg-orange-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={formManquee.moment_perte_client.includes(moment)}
                          onChange={() => toggleCheckbox(formManquee, setFormManquee, 'moment_perte_client', moment)}
                          className="w-5 h-5 text-orange-600 rounded focus:ring-orange-500"
                        />
                        <span className="text-sm font-medium text-gray-700">{moment}</span>
                      </label>
                    ))}
                  </div>
                  {formManquee.moment_perte_client.includes('Autre') && (
                    <input
                      type="text"
                      value={formManquee.moment_perte_autre}
                      onChange={(e) => setFormManquee({...formManquee, moment_perte_autre: e.target.value})}
                      placeholder="Précisez..."
                      className="w-full mt-2 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                    />
                  )}
                </div>

                {/* Raisons - SÉLECTION MULTIPLE */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    🤔 Raisons de l'échec (plusieurs choix possibles)
                  </label>
                  <div className="space-y-2">
                    {[
                      'N\'a pas perçu la valeur',
                      'Pas convaincu',
                      'Manque de confiance',
                      'J\'ai manqué d\'arguments',
                      'Prix trop élevé',
                      'Autre'
                    ].map(raison => (
                      <label
                        key={`manquee-raison-${raison}`}
                        className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                          formManquee.raisons_echec.includes(raison)
                            ? 'border-orange-500 bg-orange-50'
                            : 'border-gray-200 hover:border-orange-300 hover:bg-orange-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={formManquee.raisons_echec.includes(raison)}
                          onChange={() => toggleCheckbox(formManquee, setFormManquee, 'raisons_echec', raison)}
                          className="w-5 h-5 text-orange-600 rounded focus:ring-orange-500"
                        />
                        <span className="text-sm font-medium text-gray-700">{raison}</span>
                      </label>
                    ))}
                  </div>
                  {formManquee.raisons_echec.includes('Autre') && (
                    <textarea
                      value={formManquee.raisons_echec_autre}
                      onChange={(e) => setFormManquee({...formManquee, raisons_echec_autre: e.target.value})}
                      placeholder="Précisez les autres raisons..."
                      rows={2}
                      className="w-full mt-2 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 resize-none"
                    />
                  )}
                </div>

                {/* Amélioration */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    🔄 Qu'aurais-tu pu faire différemment ?
                  </label>
                  <textarea
                    value={formManquee.amelioration_pensee}
                    onChange={(e) => setFormManquee({...formManquee, amelioration_pensee: e.target.value})}
                    placeholder="Ex: Mieux reformuler le besoin..."
                    rows={2}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 resize-none"
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
                            <Eye className="w-4 h-4" /> Visible
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-gray-500">
                            <EyeOff className="w-4 h-4" /> Privé
                          </span>
                        )}
                      </p>
                    </div>
                  </label>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowOpportuniteManqueeForm(false)}
                    disabled={loading}
                    className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-all"
                  >
                    ← Retour
                  </button>
                  <button
                    onClick={handleSubmitManquee}
                    disabled={loading}
                    className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold py-3 px-6 rounded-xl hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
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
            </div>
          )}

          {/* HISTORIQUE */}
          {!showVenteConclueForm && !showOpportuniteManqueeForm && (
            <>
              {/* Boutons d'action - TOUJOURS VISIBLES */}
              <div className="mb-6">
                <p className="text-sm text-gray-600 mb-3 font-medium">Créer une nouvelle analyse :</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowVenteConclueForm(true)}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition-all shadow-md hover:shadow-lg"
                  >
                    <CheckCircle className="w-5 h-5" />
                    Vente conclue
                  </button>
                  <button
                    onClick={() => setShowOpportuniteManqueeForm(true)}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-xl transition-all shadow-md hover:shadow-lg"
                  >
                    <XCircle className="w-5 h-5" />
                    Opportunité manquée
                  </button>
                </div>
              </div>

              {debriefs.length > 0 ? (
                <>
                  {/* Séparateur */}
                  <div className="border-t border-gray-200 my-6"></div>
                  
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
                      Réussies ({debriefs.filter(d => d.vente_conclue).length})
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
                      Manquées ({debriefs.filter(d => !d.vente_conclue).length})
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
                                    {isConclue ? '✅ Réussie' : '❌ Manquée'}
                                  </span>
                                  <span className="text-sm font-semibold text-gray-800">
                                    {debrief.produit}
                                  </span>
                                  <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded">
                                    {debrief.type_client}
                                  </span>
                                  {/* Toggle visibilité */}
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

                  {/* Charger plus */}
                  {hasMore && (
                    <div className="mt-6 text-center">
                      <button
                        onClick={() => setDisplayLimit(prev => prev + 20)}
                        className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-all"
                      >
                        Charger plus ({remainingCount} restante{remainingCount > 1 ? 's' : ''})
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">💬</div>
                  <p className="text-gray-500 font-medium mb-4">Aucune analyse pour le moment</p>
                  <p className="text-gray-400 text-sm">Utilisez les boutons ci-dessus pour créer votre première analyse !</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
