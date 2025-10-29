import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { X, Sparkles } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function DebriefModal({ onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  
  // Form data
  const [formData, setFormData] = useState({
    produit: '',
    type_client: '',
    situation_vente: '',
    description_vente: '',
    moment_perte_client: '',
    moment_perte_autre: '',
    raisons_echec: '',
    raisons_echec_autre: '',
    amelioration_pensee: ''
  });

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const isComplete = () => {
    const momentFinal = formData.moment_perte_client === 'Autre' ? formData.moment_perte_autre : formData.moment_perte_client;
    const raisonsFinal = formData.raisons_echec === 'Autre' ? formData.raisons_echec_autre : formData.raisons_echec;
    
    return formData.produit.trim() && formData.type_client && formData.situation_vente && 
           formData.description_vente.trim() && momentFinal && raisonsFinal && 
           formData.amelioration_pensee.trim();
  };

  const answeredCount = () => {
    let count = 0;
    if (formData.produit.trim()) count++;
    if (formData.type_client) count++;
    if (formData.situation_vente) count++;
    if (formData.description_vente.trim()) count++;
    if (formData.moment_perte_client === 'Autre' ? formData.moment_perte_autre : formData.moment_perte_client) count++;
    if (formData.raisons_echec === 'Autre' ? formData.raisons_echec_autre : formData.raisons_echec) count++;
    if (formData.amelioration_pensee.trim()) count++;
    return count;
  };

  const handleSubmit = async () => {
    if (!isComplete()) return;
    
    setLoading(true);
    
    // Prepare final data
    const submitData = {
      produit: formData.produit,
      type_client: formData.type_client,
      situation_vente: formData.situation_vente,
      description_vente: formData.description_vente,
      moment_perte_client: formData.moment_perte_client === 'Autre' ? formData.moment_perte_autre : formData.moment_perte_client,
      raisons_echec: formData.raisons_echec === 'Autre' ? formData.raisons_echec_autre : formData.raisons_echec,
      amelioration_pensee: formData.amelioration_pensee
    };
    
    try {
      const response = await axios.post(`${API}/debriefs`, submitData, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setAiAnalysis(response.data);
      setShowResult(true);
      toast.success('Débrief enregistré avec succès!');
    } catch (err) {
      console.error('Error submitting debrief:', err);
      toast.error(err.response?.data?.detail || 'Erreur lors de l\'enregistrement');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (showResult) {
      onSuccess();
    }
    onClose();
  };

  // Result view
  if (showResult && aiAnalysis) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="border-b border-gray-200 p-6 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <Sparkles className="w-6 h-6 text-[#ffd871]" />
              <h2 className="text-2xl font-bold text-gray-800">Ton coaching personnalisé</h2>
            </div>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* Analyse */}
            <div className="bg-blue-50 border-l-4 border-blue-500 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl">💬</span>
                <div>
                  <h3 className="font-bold text-blue-900 mb-2">Analyse</h3>
                  <p className="text-blue-800 whitespace-pre-line">{aiAnalysis.ai_analyse}</p>
                </div>
              </div>
            </div>

            {/* Points à travailler */}
            <div className="bg-orange-50 border-l-4 border-orange-500 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl">🎯</span>
                <div className="flex-1">
                  <h3 className="font-bold text-orange-900 mb-2">Points à travailler</h3>
                  <p className="text-orange-800 whitespace-pre-line">{aiAnalysis.ai_points_travailler}</p>
                </div>
              </div>
            </div>

            {/* Recommandation */}
            <div className="bg-green-50 border-l-4 border-green-500 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl">🚀</span>
                <div>
                  <h3 className="font-bold text-green-900 mb-2">Recommandation</h3>
                  <p className="text-green-800 font-medium whitespace-pre-line">{aiAnalysis.ai_recommandation}</p>
                </div>
              </div>
            </div>

            {/* Exemple concret */}
            <div className="bg-purple-50 border-l-4 border-purple-500 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl">💡</span>
                <div>
                  <h3 className="font-bold text-purple-900 mb-2">Exemple concret</h3>
                  <p className="text-purple-800 italic whitespace-pre-line">{aiAnalysis.ai_exemple_concret}</p>
                </div>
              </div>
            </div>

            <button
              onClick={handleClose}
              className="w-full py-3 bg-[#ffd871] text-gray-800 rounded-full font-semibold hover:shadow-lg transition-all"
            >
              Retour au tableau de bord
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Form view
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        <div className="border-b border-gray-200 p-6 flex justify-between items-center flex-shrink-0">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-1">
              💬 Une vente n'a pas abouti ?
            </h2>
            <p className="text-gray-600 text-sm">Fais-en ton meilleur apprentissage !</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Bar - Sticky */}
        <div className="px-6 pt-4 pb-2 border-b border-gray-100 flex-shrink-0 bg-white sticky top-0 z-10">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-700">
              {answeredCount()} / 7 questions répondues
            </p>
            <p className="text-sm text-gray-600">
              {Math.round((answeredCount() / 7) * 100)}%
            </p>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-[#ffd871] h-2 rounded-full transition-all duration-300"
              style={{ width: `${(answeredCount() / 7) * 100}%` }}
            />
          </div>
        </div>

        {/* Form Content - Scrollable */}
        <div className="px-6 py-6 overflow-y-auto flex-1">
          <div className="space-y-6">
            {/* SECTION 1 - CONTEXTE RAPIDE */}
            <div className="pb-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-800 mb-1">
                Section 1 — Contexte rapide
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Dis-moi rapidement le contexte de cette vente.
              </p>

              {/* Produit */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-800 mb-2">
                  Produit ou service proposé
                </label>
                <input
                  type="text"
                  value={formData.produit}
                  onChange={(e) => handleChange('produit', e.target.value)}
                  placeholder="Ex: iPhone 15, forfait mobile..."
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#ffd871] focus:border-transparent"
                />
              </div>

              {/* Type de client */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-800 mb-2">
                  Type de client
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {['Nouveau client', 'Client fidèle', 'Touriste / passage', 'Indécis', 'Autre'].map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => handleChange('type_client', type)}
                      className={`p-3 rounded-xl border-2 text-sm transition-all ${
                        formData.type_client === type
                          ? 'border-[#ffd871] bg-[#ffd871] bg-opacity-10'
                          : 'border-gray-200 hover:border-[#ffd871]'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Situation de la vente */}
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-2">
                  Situation de la vente
                </label>
                <div className="space-y-2">
                  {[
                    'Client venu spontanément',
                    'Vente initiée par moi (approche proactive)',
                    'Vente sur recommandation d\'un collègue'
                  ].map(situation => (
                    <button
                      key={situation}
                      type="button"
                      onClick={() => handleChange('situation_vente', situation)}
                      className={`w-full text-left p-3 rounded-xl border-2 text-sm transition-all ${
                        formData.situation_vente === situation
                          ? 'border-[#ffd871] bg-[#ffd871] bg-opacity-10'
                          : 'border-gray-200 hover:border-[#ffd871]'
                      }`}
                    >
                      {situation}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* SECTION 2 - CE QUI S'EST PASSÉ */}
            <div>
              <h3 className="text-lg font-bold text-gray-800 mb-1">
                Section 2 — Ce qui s'est passé
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Décris en quelques mots ce qui s'est passé.
              </p>

              {/* Description */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-800 mb-2">
                  Comment la vente s'est déroulée selon toi ?
                </label>
                <textarea
                  value={formData.description_vente}
                  onChange={(e) => handleChange('description_vente', e.target.value)}
                  placeholder="Décris brièvement la scène..."
                  rows={3}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#ffd871] focus:border-transparent resize-none"
                />
              </div>

              {/* Moment blocage */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-800 mb-2">
                  À quel moment la vente a basculé ou s'est bloquée ?
                </label>
                <div className="space-y-2">
                  {[
                    'Accueil',
                    'Découverte du besoin',
                    'Proposition produit',
                    'Argumentation / objections',
                    'Closing (moment d\'achat)',
                    'Autre'
                  ].map(moment => (
                    <button
                      key={moment}
                      type="button"
                      onClick={() => handleChange('moment_perte_client', moment)}
                      className={`w-full text-left p-3 rounded-xl border-2 text-sm transition-all ${
                        formData.moment_perte_client === moment
                          ? 'border-[#ffd871] bg-[#ffd871] bg-opacity-10'
                          : 'border-gray-200 hover:border-[#ffd871]'
                      }`}
                    >
                      {moment}
                    </button>
                  ))}
                </div>
                {formData.moment_perte_client === 'Autre' && (
                  <input
                    type="text"
                    value={formData.moment_perte_autre}
                    onChange={(e) => handleChange('moment_perte_autre', e.target.value)}
                    placeholder="Précisez..."
                    className="w-full mt-2 px-4 py-2 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#ffd871] focus:border-transparent"
                  />
                )}
              </div>

              {/* Raisons */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-800 mb-2">
                  Pourquoi penses-tu que le client n'a pas acheté ?
                </label>
                <div className="space-y-2">
                  {[
                    'Il n\'a pas perçu la valeur du produit',
                    'Il n\'a pas été convaincu',
                    'Il n\'avait pas confiance / pas prêt',
                    'J\'ai manqué d\'arguments ou de reformulation',
                    'Autre'
                  ].map(raison => (
                    <button
                      key={raison}
                      type="button"
                      onClick={() => handleChange('raisons_echec', raison)}
                      className={`w-full text-left p-3 rounded-xl border-2 text-sm transition-all ${
                        formData.raisons_echec === raison
                          ? 'border-[#ffd871] bg-[#ffd871] bg-opacity-10'
                          : 'border-gray-200 hover:border-[#ffd871]'
                      }`}
                    >
                      {raison}
                    </button>
                  ))}
                </div>
                {formData.raisons_echec === 'Autre' && (
                  <textarea
                    value={formData.raisons_echec_autre}
                    onChange={(e) => handleChange('raisons_echec_autre', e.target.value)}
                    placeholder="Précisez..."
                    rows={2}
                    className="w-full mt-2 px-4 py-2 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#ffd871] focus:border-transparent resize-none"
                  />
                )}
              </div>

              {/* Amélioration */}
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-2">
                  Qu'aurais-tu pu faire différemment selon toi ?
                </label>
                <textarea
                  value={formData.amelioration_pensee}
                  onChange={(e) => handleChange('amelioration_pensee', e.target.value)}
                  placeholder="Partage tes réflexions..."
                  rows={3}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#ffd871] focus:border-transparent resize-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="border-t border-gray-200 p-6 flex gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isComplete() || loading}
            className={`flex-1 py-3 rounded-full font-semibold transition-all ${
              isComplete() && !loading
                ? 'bg-[#ffd871] text-gray-800 hover:shadow-lg'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {loading ? 'Analyse en cours...' : 'Recevoir mon coaching'}
          </button>
        </div>
      </div>
    </div>
  );
}
