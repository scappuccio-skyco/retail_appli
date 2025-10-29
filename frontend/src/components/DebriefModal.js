import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { X, ArrowRight, ArrowLeft, Sparkles } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function DebriefModal({ onClose, onSuccess }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  
  // Form data
  const [formData, setFormData] = useState({
    type_client: '',
    moment_journee: '',
    emotion: '',
    produit: '',
    raisons_echec: '',
    raisons_echec_autre: '',
    moment_perte_client: '',
    moment_perte_autre: '',
    sentiment: '',
    amelioration_pensee: '',
    action_future: ''
  });

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const canProceedStep1 = () => {
    return formData.type_client && formData.moment_journee && formData.emotion && formData.produit.trim();
  };

  const canSubmit = () => {
    const raisonsFinal = formData.raisons_echec === 'Autre' ? formData.raisons_echec_autre : formData.raisons_echec;
    const momentFinal = formData.moment_perte_client === 'Autre' ? formData.moment_perte_autre : formData.moment_perte_client;
    
    return raisonsFinal && momentFinal && formData.sentiment.trim() && 
           formData.amelioration_pensee.trim() && formData.action_future.trim();
  };

  const handleSubmit = async () => {
    if (!canSubmit()) return;
    
    setLoading(true);
    
    // Prepare final data
    const submitData = {
      type_client: formData.type_client,
      moment_journee: formData.moment_journee,
      emotion: formData.emotion,
      produit: formData.produit,
      raisons_echec: formData.raisons_echec === 'Autre' ? formData.raisons_echec_autre : formData.raisons_echec,
      moment_perte_client: formData.moment_perte_client === 'Autre' ? formData.moment_perte_autre : formData.moment_perte_client,
      sentiment: formData.sentiment,
      amelioration_pensee: formData.amelioration_pensee,
      action_future: formData.action_future
    };
    
    try {
      const response = await axios.post(`${API}/debriefs`, submitData);
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
                  <p className="text-blue-800">{aiAnalysis.ai_analyse}</p>
                </div>
              </div>
            </div>

            {/* Points à travailler */}
            <div className="bg-orange-50 border-l-4 border-orange-500 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl">🎯</span>
                <div className="flex-1">
                  <h3 className="font-bold text-orange-900 mb-2">Points à travailler</h3>
                  <ul className="space-y-2">
                    {aiAnalysis.ai_points_travailler && aiAnalysis.ai_points_travailler.map((point, idx) => (
                      <li key={idx} className="text-orange-800 flex items-start gap-2">
                        <span className="text-orange-600 font-bold">•</span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Recommandation */}
            <div className="bg-green-50 border-l-4 border-green-500 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl">🚀</span>
                <div>
                  <h3 className="font-bold text-green-900 mb-2">Recommandation</h3>
                  <p className="text-green-800 font-medium">{aiAnalysis.ai_recommandation}</p>
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

        {/* Progress */}
        <div className="px-6 pt-4 flex-shrink-0">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className={`w-3 h-3 rounded-full ${step === 1 ? 'bg-[#ffd871]' : 'bg-gray-300'}`} />
            <div className="w-12 h-1 bg-gray-200" />
            <div className={`w-3 h-3 rounded-full ${step === 2 ? 'bg-[#ffd871]' : 'bg-gray-300'}`} />
          </div>
          <p className="text-center text-sm text-gray-600 mb-4">
            Étape {step} sur 2 : {step === 1 ? 'Contexte rapide' : 'Analyse personnelle'}
          </p>
        </div>

        {/* Form Content - Scrollable */}
        <div className="px-6 overflow-y-auto flex-1">
          {/* Step 1 - Always in DOM, hidden with CSS */}
          <div className={`space-y-6 pb-6 ${step === 1 ? 'block' : 'hidden'}`}>
            {/* Type de client */}
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-3">
                Type de client
              </label>
              <div className="grid grid-cols-2 gap-2">
                {['Pressé', 'Indécis / hésitant', 'Déjà informé', 'Fidèle / régulier', 'En recherche de conseil'].map(type => (
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

            {/* Moment de la journée */}
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-3">
                Moment de la journée
              </label>
              <div className="grid grid-cols-3 gap-2">
                {['Début', 'Milieu', 'Fin'].map(moment => (
                  <button
                    key={moment}
                    type="button"
                    onClick={() => handleChange('moment_journee', moment)}
                    className={`p-3 rounded-xl border-2 text-sm transition-all ${
                      formData.moment_journee === moment
                        ? 'border-[#ffd871] bg-[#ffd871] bg-opacity-10'
                        : 'border-gray-200 hover:border-[#ffd871]'
                    }`}
                  >
                    {moment}
                  </button>
                ))}
              </div>
            </div>

            {/* Émotion ressentie */}
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-3">
                Émotion ressentie pendant la vente
              </label>
              <div className="grid grid-cols-2 gap-2">
                {['Confiant', 'Stressé', 'Fatigué', 'Neutre'].map(emotion => (
                  <button
                    key={emotion}
                    type="button"
                    onClick={() => handleChange('emotion', emotion)}
                    className={`p-3 rounded-xl border-2 text-sm transition-all ${
                      formData.emotion === emotion
                        ? 'border-[#ffd871] bg-[#ffd871] bg-opacity-10'
                        : 'border-gray-200 hover:border-[#ffd871]'
                    }`}
                  >
                    {emotion}
                  </button>
                ))}
              </div>
            </div>

            {/* Produit */}
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-3">
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
          </div>

          {/* Step 2 - Always in DOM, hidden with CSS */}
          <div className={`space-y-6 pb-6 ${step === 2 ? 'block' : 'hidden'}`}>
              {/* Raisons échec */}
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-3">
                  Selon toi, pourquoi la vente n'a pas abouti ?
                </label>
                <div className="space-y-2">
                  {[
                    'Mauvaise compréhension du besoin',
                    'Manque d\'argument convaincant',
                    'Difficulté à conclure',
                    'Client peu réceptif',
                    'Erreur sur le produit proposé',
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
                  <input
                    type="text"
                    value={formData.raisons_echec_autre}
                    onChange={(e) => handleChange('raisons_echec_autre', e.target.value)}
                    placeholder="Précisez..."
                    className="w-full mt-2 px-4 py-2 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#ffd871] focus:border-transparent"
                  />
                )}
              </div>

              {/* Moment perte client */}
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-3">
                  À quel moment penses-tu avoir "perdu" le client ?
                </label>
                <div className="space-y-2">
                  {[
                    'Accueil',
                    'Découverte du besoin',
                    'Argumentation',
                    'Proposition',
                    'Conclusion / closing',
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

              {/* Sentiment */}
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-3">
                  Comment t'es-tu senti à ce moment-là ?
                </label>
                <input
                  type="text"
                  value={formData.sentiment}
                  onChange={(e) => handleChange('sentiment', e.target.value)}
                  placeholder="Ex: Frustré, découragé, surpris..."
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#ffd871] focus:border-transparent"
                />
              </div>

              {/* Amélioration pensée */}
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-3">
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

              {/* Action future */}
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-3">
                  Que feras-tu la prochaine fois dans une situation similaire ?
                </label>
                <textarea
                  value={formData.action_future}
                  onChange={(e) => handleChange('action_future', e.target.value)}
                  placeholder="Décris ton plan d'action..."
                  rows={3}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#ffd871] focus:border-transparent resize-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="border-t border-gray-200 p-6 flex gap-3 flex-shrink-0">
          {step === 2 && (
            <button
              onClick={() => setStep(1)}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-full hover:bg-gray-50 flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Retour
            </button>
          )}
          
          {step === 1 ? (
            <button
              onClick={() => setStep(2)}
              disabled={!canProceedStep1()}
              className={`flex-1 py-3 rounded-full font-semibold flex items-center justify-center gap-2 transition-all ${
                canProceedStep1()
                  ? 'bg-[#ffd871] text-gray-800 hover:shadow-lg'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              Suivant
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!canSubmit() || loading}
              className={`flex-1 py-3 rounded-full font-semibold transition-all ${
                canSubmit() && !loading
                  ? 'bg-[#ffd871] text-gray-800 hover:shadow-lg'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {loading ? 'Analyse en cours...' : 'Recevoir mon coaching'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
