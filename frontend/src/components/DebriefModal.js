import React, { useState, useEffect } from 'react';
import { api } from '../lib/apiClient';
import { logger } from '../utils/logger';
import { toast } from 'sonner';
import { X, Sparkles } from 'lucide-react';
import DebriefResultView from './debriefModal/DebriefResultView';
import DebriefFormSections from './debriefModal/DebriefFormSections';

export default function DebriefModal({ onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState(null);

  // Onglets
  const [activeTab, setActiveTab] = useState('conclue'); // 'conclue', 'manquee', 'historique'
  const [venteConclue, setVenteConclue] = useState(true);
  const [visibleToManager, setVisibleToManager] = useState(false);
  const [historique, setHistorique] = useState([]);
  const [filtreHistorique, setFiltreHistorique] = useState('all'); // 'all', 'conclue', 'manquee'

  // Form data
  const [formData, setFormData] = useState({
    produit: '',
    type_client: '',
    situation_vente: '',
    description_vente: '',
    moment_perte_client: '',
    moment_perte_autre: '',
    raisons_echec: [],  // Maintenant un array pour sélection multiple
    raisons_echec_autre: '',
    amelioration_pensee: ''
  });

  // Charger l'historique au montage
  useEffect(() => {
    const fetchHistorique = async () => {
      try {
        const response = await api.get('/debriefs');
        setHistorique(response.data);
      } catch (error) {
        logger.error('Erreur chargement historique:', error);
      }
    };
    fetchHistorique();
  }, []);

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
      vente_conclue: venteConclue,
      shared_with_manager: visibleToManager,
      produit: formData.produit,
      type_client: formData.type_client,
      situation_vente: formData.situation_vente,
      description_vente: formData.description_vente,
      moment_perte_client: formData.moment_perte_client === 'Autre' ? formData.moment_perte_autre : formData.moment_perte_client,
      raisons_echec: formData.raisons_echec === 'Autre' ? formData.raisons_echec_autre : formData.raisons_echec,
      amelioration_pensee: formData.amelioration_pensee
    };

    try {
      const response = await api.post('/debriefs', submitData);
      setAiAnalysis(response.data);
      setShowResult(true);
      toast.success('Analyse de vente enregistrée avec succès!');
    } catch (err) {
      logger.error('Error submitting debrief:', err);
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
      <DebriefResultView
        aiAnalysis={aiAnalysis}
        onClose={onClose}
        onDismiss={handleClose}
      />
    );
  }

  // Form view
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh]">
        {/* Header avec onglets */}
        <div className="bg-gradient-to-r from-[#1E40AF] to-[#1E3A8A] p-4 rounded-t-2xl relative flex-shrink-0">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 text-white hover:text-gray-200 transition-colors z-10"
          >
            <X className="w-5 h-5" />
          </button>

          <h2 className="text-xl font-bold text-white mb-4">📊 Analyse de vente</h2>

          {/* Onglets */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setActiveTab('conclue')}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-lg font-medium transition-all flex-shrink-0 ${
                activeTab === 'conclue'
                  ? 'bg-white text-green-700 shadow-lg'
                  : 'bg-white bg-opacity-20 text-white hover:bg-opacity-30'
              }`}
            >
              <span className="text-lg">✅</span>
              <span className="text-sm sm:text-base">Vente conclue</span>
            </button>
            <button
              onClick={() => setActiveTab('manquee')}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-lg font-medium transition-all flex-shrink-0 ${
                activeTab === 'manquee'
                  ? 'bg-white text-orange-700 shadow-lg'
                  : 'bg-white bg-opacity-20 text-white hover:bg-opacity-30'
              }`}
            >
              <span className="text-lg">❌</span>
              <span className="text-sm sm:text-base">Opportunité manquée</span>
            </button>
            <button
              onClick={() => setActiveTab('historique')}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-lg font-medium transition-all flex-shrink-0 ${
                activeTab === 'historique'
                  ? 'bg-white text-blue-700 shadow-lg'
                  : 'bg-white bg-opacity-20 text-white hover:bg-opacity-30'
              }`}
            >
              <span className="text-lg">📚</span>
              <span className="text-sm sm:text-base">Historique</span>
              {historique.length > 0 && (
                <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">
                  {historique.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Progress Bar - Sticky */}
        <div className="px-6 pt-4 pb-3 bg-gradient-to-b from-gray-50 to-white border-b border-gray-200 flex-shrink-0 sticky top-0 z-10">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-gray-800">
              {answeredCount()} / 7 questions répondues
            </p>
            <p className="text-sm font-bold text-blue-600">
              {Math.round((answeredCount() / 7) * 100)}%
            </p>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 shadow-inner">
            <div
              className="bg-gradient-to-r from-[#1E40AF] to-[#1E3A8A] h-3 rounded-full transition-all duration-300 shadow-sm"
              style={{ width: `${(answeredCount() / 7) * 100}%` }}
            />
          </div>
        </div>

        {/* Form Content - Scrollable */}
        <div className="px-6 py-6 overflow-y-auto flex-1 bg-gray-50">
          <DebriefFormSections
            formData={formData}
            handleChange={handleChange}
            venteConclue={venteConclue}
          />
        </div>

        {/* Actions compactes */}
        <div className="bg-gradient-to-r from-gray-50 to-white border-t-2 border-gray-200 p-4 flex-shrink-0 rounded-b-2xl">
          <div className="flex items-center gap-3 mb-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={visibleToManager}
                onChange={(e) => setVisibleToManager(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <span className="text-xs text-gray-700">
                📤 Partager avec mon manager
              </span>
            </label>
          </div>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isComplete() || loading}
            className={`w-full py-3 rounded-xl font-bold text-base transition-all shadow-lg ${
              isComplete() && !loading
                ? 'bg-gradient-to-r from-[#1E40AF] to-[#1E3A8A] text-white hover:shadow-xl hover:scale-[1.01]'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Sparkles className="w-4 h-4 animate-pulse" />
                Analyse en cours...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Sparkles className="w-4 h-4" />
                Recevoir mon coaching IA
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
