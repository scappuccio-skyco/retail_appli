import React, { useState, useEffect } from 'react';
import { api } from '../lib/apiClient';
import { logger } from '../utils/logger';
import { toast } from 'sonner';
import { Loader, ChevronDown, ChevronUp } from 'lucide-react';
import AIRecommendations from './AIRecommendations';
import { renderMarkdownBold } from '../utils/markdownRenderer';
import { getApiPrefixByRole, normalizeHistoryResponse } from '../utils/apiHelpers';
import { useAuth } from '../contexts';

export default function ConflictResolutionForm({ sellerId, sellerName }) {
  const { user } = useAuth();
  // Pattern Ultra Simple - États séparés avec useState
  const [formData, setFormData] = useState({
    contexte: '',
    comportement_observe: '',
    impact: '',
    tentatives_precedentes: '',
    description_libre: ''
  });
  const [loading, setLoading] = useState(false);
  const [aiRecommendations, setAiRecommendations] = useState(null);
  const [conflictHistory, setConflictHistory] = useState([]);
  const [expandedHistoryItems, setExpandedHistoryItems] = useState({});
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetchConflictHistory();
  }, [sellerId]);

  // Pattern Ultra Simple - Pas de useEffect compliqué

  const fetchConflictHistory = async () => {
    setLoadingHistory(true);
    try {
      const userRole = user?.role || 'manager';
      const apiPrefix = getApiPrefixByRole(userRole);
      
      let url;
      if (userRole === 'seller') {
        // Seller: GET /api/seller/conflict-history (no sellerId param)
        url = `${apiPrefix}/conflict-history`;
      } else {
        // Manager: GET /api/manager/conflict-history/{sellerId}
        url = `${apiPrefix}/conflict-history/${sellerId}`;
      }
      
      const response = await api.get(url);
      
      // Normalize response (handles both array and {consultations: [...]} formats)
      const history = normalizeHistoryResponse(response.data);
      setConflictHistory(history);
      setLoadingHistory(false);
    } catch (err) {
      logger.error('Error loading conflict history:', err);
      toast.error('Erreur de chargement de l\'historique');
      setLoadingHistory(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!formData.contexte || !formData.comportement_observe || !formData.impact) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    // IMPORTANT : Fermer le form AVANT l'appel API (pattern correct)
    setShowForm(false);
    setLoading(true);
    
    // Afficher loading toast
    const loadingToast = toast.loading('🤖 Génération des recommandations IA...');
    
    try {
      const userRole = user?.role || 'manager';
      const apiPrefix = getApiPrefixByRole(userRole);
      
      // Build payload based on role
      let payload;
      if (userRole === 'seller') {
        // Seller: no seller_id needed (uses current user)
        payload = formData;
      } else {
        // Manager: include seller_id
        payload = {
          seller_id: sellerId,
          ...formData
        };
      }
      
      const response = await api.post(
        `${apiPrefix}/conflict-resolution`,
        payload
      );

      toast.dismiss(loadingToast);
      toast.success('Recommandations générées avec succès');
      
      // Attendre 500ms pour garantir un cycle de rendu propre
      setTimeout(() => {
        setAiRecommendations(response.data);
        // Rafraîchir l'historique
        fetchConflictHistory();
      }, 500);
      
      // Reset form
      setFormData({
        contexte: '',
        comportement_observe: '',
        impact: '',
        tentatives_precedentes: '',
        description_libre: ''
      });
      
    } catch (err) {
      logger.error('Error creating conflict resolution:', err);
      toast.dismiss(loadingToast);
      toast.error('Erreur lors de la génération des recommandations');
    } finally {
      setLoading(false);
    }
  };

  const toggleHistoryItem = (id) => {
    setExpandedHistoryItems({
      ...expandedHistoryItems,
      [id]: !expandedHistoryItems[id]
    });
  };

  return (
    <div className="space-y-8">
      {/* Overview Section - Show by default */}
      {!showForm && !aiRecommendations && (
        <div className="space-y-6">
          {/* Hero section avec bouton */}
          <div className="glass-morphism rounded-2xl p-8 text-center">
            <div className="mb-6">
              <h3 className="text-3xl font-bold text-gray-800 mb-3">
                🤝 Gestion de Conflit avec {sellerName}
              </h3>
              <p className="text-gray-600 text-lg">
                Obtenez des recommandations IA personnalisées pour résoudre des situations difficiles
              </p>
            </div>
            
            <button
              onClick={() => setShowForm(true)}
              className="btn-primary px-8 py-4 text-lg font-semibold inline-flex items-center gap-3"
            >
              ➕ Nouvelle consultation de gestion de conflit
            </button>
          </div>

          {/* Historique des consultations */}
          <div className="glass-morphism rounded-2xl p-6">
            <h3 className="text-2xl font-bold text-gray-800 mb-6">📚 Historique des consultations</h3>
            
            {loadingHistory ? (
              <div className="text-center py-8">
                <Loader className="w-8 h-8 animate-spin mx-auto text-gray-400" />
                <p className="text-gray-500 mt-2">Chargement...</p>
              </div>
            ) : conflictHistory.length > 0 ? (
              <div className="space-y-4">
                {conflictHistory.map((conflict) => (
                  <div
                    key={conflict.id}
                    className="bg-white rounded-xl border border-gray-200 hover:shadow-md transition-all overflow-hidden"
                  >
                    <button
                      onClick={() => toggleHistoryItem(conflict.id)}
                      className="w-full p-4 text-left hover:bg-gray-50 transition-colors flex justify-between items-start"
                    >
                      <div className="flex-1">
                        <p className="text-sm text-gray-500 mb-2">
                          🗓️ {new Date(conflict.created_at).toLocaleDateString('fr-FR', { 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                          })} — Statut : <span className="font-semibold">{conflict.statut}</span>
                        </p>
                        <p className="text-gray-700 font-medium line-clamp-2">{conflict.contexte}</p>
                      </div>
                      <div className="ml-4 text-gray-600">
                        {expandedHistoryItems[conflict.id] ? (
                          <ChevronUp className="w-5 h-5" />
                        ) : (
                          <ChevronDown className="w-5 h-5" />
                        )}
                      </div>
                    </button>

                    {expandedHistoryItems[conflict.id] && (
                      <div className="px-4 pb-4 space-y-4 border-t border-gray-100 pt-4 animate-fadeIn">
                        <div className="space-y-3">
                          <div>
                            <p className="text-xs font-semibold text-gray-600 mb-1">Comportement observé :</p>
                            <p className="text-sm text-gray-700">{conflict.comportement_observe}</p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-gray-600 mb-1">Impact :</p>
                            <p className="text-sm text-gray-700">{conflict.impact}</p>
                          </div>
                          {conflict.tentatives_precedentes && (
                            <div>
                              <p className="text-xs font-semibold text-gray-600 mb-1">Tentatives précédentes :</p>
                              <p className="text-sm text-gray-700">{conflict.tentatives_precedentes}</p>
                            </div>
                          )}
                        </div>

                        {/* AI Recommendations */}
                        <div className="space-y-3 mt-4 pt-4 border-t border-gray-200">
                          <div className="bg-blue-50 rounded-lg p-3">
                            <p className="text-xs font-semibold text-blue-900 mb-1">💡 Analyse IA :</p>
                            <p className="text-sm text-blue-800 whitespace-pre-line">{renderMarkdownBold(conflict.ai_analyse_situation)}</p>
                          </div>

                          <div className="bg-purple-50 rounded-lg p-3">
                            <p className="text-xs font-semibold text-purple-900 mb-1">💬 Approche de communication :</p>
                            <p className="text-sm text-purple-800 whitespace-pre-line">{renderMarkdownBold(conflict.ai_approche_communication)}</p>
                          </div>

                          <div className="bg-green-50 rounded-lg p-3">
                            <p className="text-xs font-semibold text-green-900 mb-2">✅ Actions concrètes :</p>
                            <ul className="space-y-1">
                              {conflict.ai_actions_concretes.map((action, idx) => (
                                <li key={`conflict-${conflict.id}-action-${idx}-${action.substring(0, 20)}`} className="text-sm text-green-800 flex items-start gap-2">
                                  <span className="text-[#10B981]">•</span>
                                  <span>{renderMarkdownBold(action)}</span>
                                </li>
                              ))}
                            </ul>
                          </div>

                          <div className="bg-orange-50 rounded-lg p-3">
                            <p className="text-xs font-semibold text-orange-900 mb-2">⚠️ Points de vigilance :</p>
                            <ul className="space-y-1">
                              {conflict.ai_points_vigilance.map((point, idx) => (
                                <li key={`conflict-${conflict.id}-vigilance-${idx}-${point.substring(0, 20)}`} className="text-sm text-orange-800 flex items-start gap-2">
                                  <span className="text-[#F97316]">•</span>
                                  <span>{renderMarkdownBold(point)}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                Aucune consultation pour le moment
              </div>
            )}
          </div>
        </div>
      )}

      {/* Form Section - Only show when showForm is true */}
      {showForm && !aiRecommendations && (
      <div className="glass-morphism rounded-2xl p-6">
        <div className="mb-6 flex items-center gap-4">
          <button
            onClick={() => { setShowForm(false); setAiRecommendations(null); }}
            className="text-gray-600 hover:text-gray-800 flex items-center gap-2"
          >
            ← Retour
          </button>
          <h3 className="text-2xl font-bold text-gray-800">
            🤝 Aide à la gestion de conflit avec {sellerName}
          </h3>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Questions structurées */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                1. Contexte de la situation <span className="text-red-500">*</span>
              </label>
              <textarea
                name="contexte"
                value={formData.contexte}
                onChange={handleChange}
                placeholder="Décrivez le contexte général (ex: retards répétés, attitude avec les clients, non-respect des procédures...)"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#ffd871] focus:border-transparent resize-none"
                rows="3"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                2. Comportement observé <span className="text-red-500">*</span>
              </label>
              <textarea
                name="comportement_observe"
                value={formData.comportement_observe}
                onChange={handleChange}
                placeholder="Décrivez précisément ce que vous avez observé (fréquence, situations spécifiques...)"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#ffd871] focus:border-transparent resize-none"
                rows="3"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                3. Impact sur l'équipe/performance/clients <span className="text-red-500">*</span>
              </label>
              <textarea
                name="impact"
                value={formData.impact}
                onChange={handleChange}
                placeholder="Quel est l'impact de cette situation ? (moral de l'équipe, résultats commerciaux, satisfaction client...)"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#ffd871] focus:border-transparent resize-none"
                rows="3"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                4. Tentatives précédentes
              </label>
              <textarea
                name="tentatives_precedentes"
                value={formData.tentatives_precedentes}
                onChange={handleChange}
                placeholder="Qu'avez-vous déjà essayé pour résoudre cette situation ? (discussions, rappels, actions...)"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#ffd871] focus:border-transparent resize-none"
                rows="3"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                5. Détails supplémentaires
              </label>
              <textarea
                name="description_libre"
                value={formData.description_libre}
                onChange={handleChange}
                placeholder="Ajoutez tout autre élément important pour comprendre la situation..."
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#ffd871] focus:border-transparent resize-none"
                rows="4"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-primary py-4 text-lg font-semibold flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader className="w-5 h-5 animate-spin" />
                Génération des recommandations IA...
              </>
            ) : (
              <>
                ✅ Obtenir des recommandations personnalisées
              </>
            )}
          </button>
        </form>
      </div>
      )}

      {/* AI Recommendations Display - Only show when showResult is true */}
      {aiRecommendations && (
        <div className="space-y-6">
          <AIRecommendations recommendations={aiRecommendations} />
          
          {/* Button to go back to overview */}
          <div className="text-center">
            <button
              onClick={() => { setShowForm(false); setAiRecommendations(null); }}
              className="btn-secondary px-8 py-3"
            >
              ← Retour à l'aperçu
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
