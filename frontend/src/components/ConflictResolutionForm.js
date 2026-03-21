import React from 'react';
import { Loader } from 'lucide-react';
import AIRecommendations from './AIRecommendations';
import useConflictResolutionForm from './conflictResolutionForm/useConflictResolutionForm';
import ConflictHistoryList from './conflictResolutionForm/ConflictHistoryList';

export default function ConflictResolutionForm({ sellerId, sellerName }) {
  const {
    formData, loading, aiRecommendations,
    conflictHistory, expandedHistoryItems, loadingHistory,
    showForm, setShowForm,
    handleChange, handleSubmit, toggleHistoryItem, handleBack,
  } = useConflictResolutionForm({ sellerId });

  return (
    <div className="space-y-8">
      {/* Overview */}
      {!showForm && !aiRecommendations && (
        <div className="space-y-6">
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

          <div className="glass-morphism rounded-2xl p-6">
            <h3 className="text-2xl font-bold text-gray-800 mb-6">📚 Historique des consultations</h3>
            <ConflictHistoryList
              conflictHistory={conflictHistory}
              loadingHistory={loadingHistory}
              expandedHistoryItems={expandedHistoryItems}
              onToggle={toggleHistoryItem}
            />
          </div>
        </div>
      )}

      {/* Form */}
      {showForm && !aiRecommendations && (
        <div className="glass-morphism rounded-2xl p-6">
          <div className="mb-6 flex items-center gap-4">
            <button onClick={handleBack} className="text-gray-600 hover:text-gray-800 flex items-center gap-2">
              ← Retour
            </button>
            <h3 className="text-2xl font-bold text-gray-800">
              🤝 Aide à la gestion de conflit avec {sellerName}
            </h3>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              {[
                { name: 'contexte', label: '1. Contexte de la situation', required: true, placeholder: 'Décrivez le contexte général (ex: retards répétés, attitude avec les clients, non-respect des procédures...)' },
                { name: 'comportement_observe', label: '2. Comportement observé', required: true, placeholder: 'Décrivez précisément ce que vous avez observé (fréquence, situations spécifiques...)' },
                { name: 'impact', label: '3. Impact sur l\'équipe/performance/clients', required: true, placeholder: 'Quel est l\'impact de cette situation ? (moral de l\'équipe, résultats commerciaux, satisfaction client...)' },
                { name: 'tentatives_precedentes', label: '4. Tentatives précédentes', required: false, placeholder: 'Qu\'avez-vous déjà essayé pour résoudre cette situation ? (discussions, rappels, actions...)' },
                { name: 'description_libre', label: '5. Détails supplémentaires', required: false, placeholder: 'Ajoutez tout autre élément important pour comprendre la situation...', rows: 4 },
              ].map(({ name, label, required, placeholder, rows = 3 }) => (
                <div key={name}>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {label} {required && <span className="text-red-500">*</span>}
                  </label>
                  <textarea
                    name={name}
                    value={formData[name]}
                    onChange={handleChange}
                    placeholder={placeholder}
                    rows={rows}
                    required={required}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#ffd871] focus:border-transparent resize-none"
                  />
                </div>
              ))}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary py-4 text-lg font-semibold flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <><Loader className="w-5 h-5 animate-spin" />Génération des recommandations IA...</>
              ) : (
                <>✅ Obtenir des recommandations personnalisées</>
              )}
            </button>
          </form>
        </div>
      )}

      {/* Result */}
      {aiRecommendations && (
        <div className="space-y-6">
          <AIRecommendations recommendations={aiRecommendations} />
          <div className="text-center">
            <button onClick={handleBack} className="btn-secondary px-8 py-3">
              ← Retour à l'aperçu
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
