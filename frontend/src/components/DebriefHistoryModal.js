import React, { useState, useMemo } from 'react';
import { X, MessageSquare, Sparkles, Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL || '';

export default function DebriefHistoryModal({ debriefs, onClose, onNewDebrief, token }) {
  const [activeTab, setActiveTab] = useState('historique'); // 'conclue', 'manquee', 'historique'
  const [filtreHistorique, setFiltreHistorique] = useState('all'); // 'all', 'conclue', 'manquee'
  const [expandedDebriefs, setExpandedDebriefs] = useState({});
  const [displayLimit, setDisplayLimit] = useState(20); // Afficher 20 débriefs à la fois
  const [loading, setLoading] = useState(false);
  
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
      const response = await axios.post(
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
      setActiveTab('historique');
      if (onNewDebrief) onNewDebrief(); // Refresh debriefs
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
      const response = await axios.post(
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
      setActiveTab('historique');
      if (onNewDebrief) onNewDebrief(); // Refresh debriefs
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
      if (onNewDebrief) onNewDebrief(); // Refresh debriefs
    } catch (error) {
      console.error('Error toggling visibility:', error);
      toast.error('Erreur lors de la modification de la visibilité');
    }
  };

  // Filtrer et trier les débriefs par date (plus récents en premier) et limiter l'affichage
  const sortedAndLimitedDebriefs = useMemo(() => {
    let filtered = [...debriefs];
    
    // Appliquer le filtre
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
    <div onClick={(e) => { if (e.target === e.currentTarget) { onClose(); } }} className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header avec onglets */}
        <div className="sticky top-0 bg-gradient-to-r from-[#1E40AF] to-[#1E3A8A] p-4 rounded-t-2xl">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 text-white hover:text-gray-200 transition-colors z-10"
          >
            <X className="w-5 h-5" />
          </button>
          
          <h2 className="text-xl font-bold text-white mb-4">📊 Analyse de vente</h2>
          
          {/* Onglets */}
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('conclue')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                activeTab === 'conclue'
                  ? 'bg-white text-green-700 shadow-lg'
                  : 'bg-white bg-opacity-20 text-white hover:bg-opacity-30'
              }`}
            >
              <span className="text-lg">✅</span>
              <span>Vente conclue</span>
            </button>
            <button
              onClick={() => setActiveTab('manquee')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                activeTab === 'manquee'
                  ? 'bg-white text-orange-700 shadow-lg'
                  : 'bg-white bg-opacity-20 text-white hover:bg-opacity-30'
              }`}
            >
              <span className="text-lg">❌</span>
              <span>Opportunité manquée</span>
            </button>
            <button
              onClick={() => setActiveTab('historique')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                activeTab === 'historique'
                  ? 'bg-white text-blue-700 shadow-lg'
                  : 'bg-white bg-opacity-20 text-white hover:bg-opacity-30'
              }`}
            >
              <span className="text-lg">📚</span>
              <span>Historique</span>
              {debriefs.length > 0 && (
                <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">
                  {debriefs.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {debriefs.length > 0 ? (
            <>
              {/* Bouton Nouveau Debrief en haut */}
              <div className="mb-6">
                <button
                  onClick={onNewDebrief}
                  className="w-full bg-gradient-to-r from-[#1E40AF] to-[#1E3A8A] text-gray-800 font-bold py-4 px-6 rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  <MessageSquare className="w-5 h-5" />
                  ✨ Débriefer une nouvelle vente
                </button>
              </div>

              {/* Liste des débriefs */}
              <div className="space-y-4">
                {sortedAndLimitedDebriefs.map((debrief) => (
                  <div
                    key={debrief.id}
                    className="bg-gradient-to-r from-white to-blue-50 rounded-2xl border-2 border-blue-100 hover:shadow-lg transition-all overflow-hidden"
                  >
                    {/* Compact Header - Always Visible */}
                    <button
                      onClick={() => toggleDebrief(debrief.id)}
                      className="w-full p-5 text-left hover:bg-white hover:bg-opacity-50 transition-colors"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-3">
                            <span className="px-3 py-1 bg-blue-500 text-white text-xs font-bold rounded-full">
                              {new Date(debrief.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </span>
                            <span className="text-sm font-semibold text-gray-800">
                              {debrief.produit}
                            </span>
                            <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded">
                              {debrief.type_client}
                            </span>
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-start gap-2">
                              <span className="text-gray-400 text-sm mt-0.5">💬</span>
                              <p className="text-sm text-gray-700 line-clamp-2">{debrief.description_vente}</p>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-gray-600">
                              <span className="flex items-center gap-1">
                                <span>📍</span> {debrief.moment_perte_client}
                              </span>
                              <span className="flex items-center gap-1">
                                <span>❌</span> {debrief.raisons_echec}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="ml-4 flex-shrink-0">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg transition-all ${
                            expandedDebriefs[debrief.id] 
                              ? 'bg-blue-500 text-white' 
                              : 'bg-blue-100 text-blue-600'
                          }`}>
                            {expandedDebriefs[debrief.id] ? '−' : '+'}
                          </div>
                        </div>
                      </div>
                    </button>

                    {/* AI Analysis - Expandable */}
                    {expandedDebriefs[debrief.id] && (
                      <div className="px-5 pb-5 space-y-3 bg-white border-t-2 border-blue-100 pt-4 animate-fadeIn">
                        {/* Analyse */}
                        <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl p-4 border-l-4 border-blue-500">
                          <p className="text-sm font-bold text-blue-900 mb-2 flex items-center gap-2">
                            <span className="text-lg">💬</span> Analyse
                          </p>
                          <p className="text-sm text-blue-800 whitespace-pre-line leading-relaxed">{debrief.ai_analyse}</p>
                        </div>

                        {/* Points à travailler */}
                        <div className="bg-gradient-to-r from-orange-50 to-orange-100 rounded-xl p-4 border-l-4 border-[#F97316]">
                          <p className="text-sm font-bold text-orange-900 mb-2 flex items-center gap-2">
                            <span className="text-lg">🎯</span> Points à travailler
                          </p>
                          <p className="text-sm text-orange-800 whitespace-pre-line leading-relaxed">{debrief.ai_points_travailler}</p>
                        </div>

                        {/* Recommandation */}
                        <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-xl p-4 border-l-4 border-[#10B981]">
                          <p className="text-sm font-bold text-green-900 mb-2 flex items-center gap-2">
                            <span className="text-lg">🚀</span> Recommandation
                          </p>
                          <p className="text-sm text-green-800 whitespace-pre-line leading-relaxed">{debrief.ai_recommandation}</p>
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
                ))}
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
                    Charger plus ({remainingCount} débrief{remainingCount > 1 ? 's' : ''} restant{remainingCount > 1 ? 's' : ''})
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">💬</div>
              <p className="text-gray-500 font-medium mb-4">Aucun débrief pour le moment</p>
              <p className="text-gray-400 text-sm mb-6">Analysez votre première vente non conclue !</p>
              <button
                onClick={onNewDebrief}
                className="btn-primary inline-flex items-center gap-2"
              >
                <MessageSquare className="w-5 h-5" />
                Débriefer ma première vente
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
