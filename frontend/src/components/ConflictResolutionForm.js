import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { AlertCircle, CheckCircle, Loader, ChevronDown, ChevronUp } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function ConflictResolutionForm({ sellerId, sellerName }) {
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

  useEffect(() => {
    fetchConflictHistory();
  }, [sellerId]);

  const fetchConflictHistory = async () => {
    setLoadingHistory(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/manager/conflict-history/${sellerId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setConflictHistory(response.data);
    } catch (err) {
      console.error('Error loading conflict history:', err);
      toast.error('Erreur de chargement de l\'historique');
    } finally {
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

    setLoading(true);
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/manager/conflict-resolution`,
        {
          seller_id: sellerId,
          ...formData
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Update state in batch
      setAiRecommendations(response.data);
      setFormData({
        contexte: '',
        comportement_observe: '',
        impact: '',
        tentatives_precedentes: '',
        description_libre: ''
      });
      
      toast.success('Recommandations générées avec succès');
      
      // Refresh history after a short delay to avoid DOM conflicts
      setTimeout(() => {
        fetchConflictHistory();
      }, 100);
    } catch (err) {
      console.error('Error creating conflict resolution:', err);
      toast.error('Erreur lors de la génération des recommandations');
    } finally {
      setLoading(false);
    }
  };

  const toggleHistoryItem = (id) => {
    setExpandedHistoryItems(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  return (
    <div className="space-y-8">
      {/* Form Section */}
      <div className="glass-morphism rounded-2xl p-6">
        <h3 className="text-2xl font-bold text-gray-800 mb-6">
          🤝 Aide à la gestion de conflit avec {sellerName}
        </h3>
        
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
                <CheckCircle className="w-5 h-5" />
                Obtenir des recommandations personnalisées
              </>
            )}
          </button>
        </form>
      </div>

      {/* AI Recommendations Display */}
      {aiRecommendations && (
        <div className="glass-morphism rounded-2xl p-6 border-2 border-green-200 bg-green-50">
          <h3 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-3">
            <CheckCircle className="w-8 h-8 text-green-600" />
            Recommandations IA personnalisées
          </h3>

          <div className="space-y-6">
            {/* Analyse de la situation */}
            <div className="bg-white rounded-xl p-5">
              <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-blue-600" />
                Analyse de la situation
              </h4>
              <p className="text-gray-700 whitespace-pre-line">{aiRecommendations.ai_analyse_situation}</p>
            </div>

            {/* Approche de communication */}
            <div className="bg-white rounded-xl p-5">
              <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                💬 Approche de communication
              </h4>
              <p className="text-gray-700 whitespace-pre-line">{aiRecommendations.ai_approche_communication}</p>
            </div>

            {/* Actions concrètes */}
            <div className="bg-white rounded-xl p-5">
              <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                ✅ Actions concrètes à mettre en place
              </h4>
              <ul className="space-y-2">
                {aiRecommendations.ai_actions_concretes.map((action, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-green-100 text-green-700 rounded-full flex items-center justify-center text-sm font-bold">
                      {index + 1}
                    </span>
                    <span className="text-gray-700 flex-1">{action}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Points de vigilance */}
            <div className="bg-white rounded-xl p-5">
              <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                ⚠️ Points de vigilance
              </h4>
              <ul className="space-y-2">
                {aiRecommendations.ai_points_vigilance.map((point, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-orange-100 text-orange-700 rounded-full flex items-center justify-center text-sm font-bold">
                      !
                    </span>
                    <span className="text-gray-700 flex-1">{point}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Metadata */}
            <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-600">
              <p>
                <strong>Date :</strong> {new Date(aiRecommendations.created_at).toLocaleDateString('fr-FR', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
              <p><strong>Statut :</strong> {aiRecommendations.statut}</p>
            </div>
          </div>
        </div>
      )}

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
                        <p className="text-sm text-blue-800 whitespace-pre-line">{conflict.ai_analyse_situation}</p>
                      </div>

                      <div className="bg-purple-50 rounded-lg p-3">
                        <p className="text-xs font-semibold text-purple-900 mb-1">💬 Approche de communication :</p>
                        <p className="text-sm text-purple-800 whitespace-pre-line">{conflict.ai_approche_communication}</p>
                      </div>

                      <div className="bg-green-50 rounded-lg p-3">
                        <p className="text-xs font-semibold text-green-900 mb-2">✅ Actions concrètes :</p>
                        <ul className="space-y-1">
                          {conflict.ai_actions_concretes.map((action, idx) => (
                            <li key={idx} className="text-sm text-green-800 flex items-start gap-2">
                              <span className="text-green-600">•</span>
                              <span>{action}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="bg-orange-50 rounded-lg p-3">
                        <p className="text-xs font-semibold text-orange-900 mb-2">⚠️ Points de vigilance :</p>
                        <ul className="space-y-1">
                          {conflict.ai_points_vigilance.map((point, idx) => (
                            <li key={idx} className="text-sm text-orange-800 flex items-start gap-2">
                              <span className="text-orange-600">•</span>
                              <span>{point}</span>
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
  );
}
