import React, { useState, useEffect, useReducer } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Loader, ChevronDown, ChevronUp } from 'lucide-react';
import AIRecommendations from './AIRecommendations';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Reducer for managing complex state
const conflictReducer = (state, action) => {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_AI_RECOMMENDATIONS':
      return { ...state, aiRecommendations: action.payload, loading: false, showResult: true };
    case 'RESET_FORM':
      return { 
        ...state, 
        formData: {
          contexte: '',
          comportement_observe: '',
          impact: '',
          tentatives_precedentes: '',
          description_libre: ''
        },
        showResult: false
      };
    case 'UPDATE_FORM':
      return { 
        ...state, 
        formData: { ...state.formData, [action.field]: action.value }
      };
    case 'SET_HISTORY':
      return { ...state, conflictHistory: action.payload, loadingHistory: false };
    case 'SET_LOADING_HISTORY':
      return { ...state, loadingHistory: action.payload };
    case 'TOGGLE_HISTORY_ITEM':
      return {
        ...state,
        expandedHistoryItems: {
          ...state.expandedHistoryItems,
          [action.id]: !state.expandedHistoryItems[action.id]
        }
      };
    case 'BACK_TO_FORM':
      return { ...state, showResult: false, aiRecommendations: null };
    default:
      return state;
  }
};

const initialState = {
  formData: {
    contexte: '',
    comportement_observe: '',
    impact: '',
    tentatives_precedentes: '',
    description_libre: ''
  },
  loading: false,
  aiRecommendations: null,
  conflictHistory: [],
  expandedHistoryItems: {},
  loadingHistory: true,
  showResult: false // Add showResult to control view
};

export default function ConflictResolutionForm({ sellerId, sellerName }) {
  const [state, dispatch] = useReducer(conflictReducer, initialState);

  useEffect(() => {
    fetchConflictHistory();
  }, [sellerId]);

  // Refresh history when new AI recommendations are set
  useEffect(() => {
    if (state.aiRecommendations) {
      fetchConflictHistory();
    }
  }, [state.aiRecommendations]);

  const fetchConflictHistory = async () => {
    dispatch({ type: 'SET_LOADING_HISTORY', payload: true });
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/manager/conflict-history/${sellerId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      dispatch({ type: 'SET_HISTORY', payload: response.data });
    } catch (err) {
      console.error('Error loading conflict history:', err);
      toast.error('Erreur de chargement de l\'historique');
      dispatch({ type: 'SET_LOADING_HISTORY', payload: false });
    }
  };

  const handleChange = (e) => {
    dispatch({ 
      type: 'UPDATE_FORM', 
      field: e.target.name, 
      value: e.target.value 
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!state.formData.contexte || !state.formData.comportement_observe || !state.formData.impact) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    dispatch({ type: 'SET_LOADING', payload: true });
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/manager/conflict-resolution`,
        {
          seller_id: sellerId,
          ...state.formData
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Batch all state updates together with reducer
      dispatch({ type: 'SET_AI_RECOMMENDATIONS', payload: response.data });
      dispatch({ type: 'RESET_FORM' });
      
      toast.success('Recommandations générées avec succès');
    } catch (err) {
      console.error('Error creating conflict resolution:', err);
      toast.error('Erreur lors de la génération des recommandations');
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const toggleHistoryItem = (id) => {
    dispatch({ type: 'TOGGLE_HISTORY_ITEM', id });
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
                value={state.formData.contexte}
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
                value={state.formData.comportement_observe}
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
                value={state.formData.impact}
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
                value={state.formData.tentatives_precedentes}
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
                value={state.formData.description_libre}
                onChange={handleChange}
                placeholder="Ajoutez tout autre élément important pour comprendre la situation..."
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#ffd871] focus:border-transparent resize-none"
                rows="4"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={state.loading}
            className="w-full btn-primary py-4 text-lg font-semibold flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {state.loading ? (
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

      {/* AI Recommendations Display - Now in separate component */}
      {state.aiRecommendations && (
        <AIRecommendations recommendations={state.aiRecommendations} />
      )}

      {/* Historique des consultations */}
      <div className="glass-morphism rounded-2xl p-6">
        <h3 className="text-2xl font-bold text-gray-800 mb-6">📚 Historique des consultations</h3>
        
        {state.loadingHistory ? (
          <div className="text-center py-8">
            <Loader className="w-8 h-8 animate-spin mx-auto text-gray-400" />
            <p className="text-gray-500 mt-2">Chargement...</p>
          </div>
        ) : state.conflictHistory.length > 0 ? (
          <div className="space-y-4">
            {state.conflictHistory.map((conflict) => (
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
                    {state.expandedHistoryItems[conflict.id] ? (
                      <ChevronUp className="w-5 h-5" />
                    ) : (
                      <ChevronDown className="w-5 h-5" />
                    )}
                  </div>
                </button>

                {state.expandedHistoryItems[conflict.id] && (
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
