import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { X, Coffee, Sparkles, Loader2, Copy, Check, RefreshCw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

const API_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * MorningBriefModal - Générateur de Brief Matinal IA
 * 
 * Permet au manager de générer un script de brief matinal personnalisé
 * avec possibilité d'ajouter une consigne spécifique.
 */
const MorningBriefModal = ({ isOpen, onClose, storeName, managerName }) => {
  const [comments, setComments] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [brief, setBrief] = useState(null);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    setIsLoading(true);
    setBrief(null);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_URL}/api/briefs/morning`,
        { comments: comments.trim() || null },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        setBrief(response.data);
        toast.success('☕ Brief matinal généré !');
      } else {
        toast.error('Erreur lors de la génération');
      }
    } catch (error) {
      console.error('Erreur génération brief:', error);
      toast.error(error.response?.data?.detail || 'Erreur lors de la génération du brief');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    if (brief?.brief) {
      try {
        await navigator.clipboard.writeText(brief.brief);
        setCopied(true);
        toast.success('Brief copié dans le presse-papier !');
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        toast.error('Erreur lors de la copie');
      }
    }
  };

  const handleRegenerate = () => {
    setBrief(null);
    handleGenerate();
  };

  const handleClose = () => {
    setComments('');
    setBrief(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <Coffee className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">☕ Brief du Matin</h2>
              <p className="text-white/80 text-sm">Générez votre script en 1 clic</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-white/80 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-lg"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {!brief ? (
            /* Phase 1: Configuration */
            <div className="space-y-6">
              {/* Info magasin */}
              <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
                <p className="text-amber-800 text-sm">
                  <span className="font-semibold">📍 {storeName || 'Mon Magasin'}</span>
                  <span className="mx-2">•</span>
                  <span>Manager : {managerName || 'Manager'}</span>
                </p>
              </div>

              {/* Textarea pour la consigne */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  🎯 Une consigne particulière pour ce matin ?
                </label>
                <textarea
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  placeholder="Ex: Insister sur la vente des chaussettes, féliciter Julie pour hier, attention aux retards cette semaine..."
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 resize-none transition-all"
                  rows={4}
                  maxLength={500}
                />
                <p className="text-xs text-gray-400 mt-1 text-right">
                  {comments.length}/500 caractères
                </p>
              </div>

              {/* Exemples de consignes */}
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs font-semibold text-gray-500 mb-2">💡 EXEMPLES DE CONSIGNES :</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    "Focus nouvelle collection",
                    "Féliciter l'équipe pour le rangement",
                    "Rappel sur les retards",
                    "Objectif panier moyen +10%",
                    "Journée sans sac plastique"
                  ].map((example, idx) => (
                    <button
                      key={idx}
                      onClick={() => setComments(example)}
                      className="text-xs bg-white border border-gray-200 text-gray-600 px-3 py-1.5 rounded-full hover:bg-amber-50 hover:border-amber-300 hover:text-amber-700 transition-all"
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bouton de génération */}
              <button
                onClick={handleGenerate}
                disabled={isLoading}
                className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-orange-500/30 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Génération en cours...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    Générer mon Brief Matinal
                  </>
                )}
              </button>
            </div>
          ) : (
            /* Phase 2: Affichage du brief */
            <div className="space-y-4">
              {/* Actions */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">
                  {brief.has_context && (
                    <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded-full text-xs font-medium">
                      ✓ Consigne intégrée
                    </span>
                  )}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={handleRegenerate}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Regénérer
                  </button>
                  <button
                    onClick={handleCopy}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors text-sm font-medium ${
                      copied 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                    }`}
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? 'Copié !' : 'Copier'}
                  </button>
                </div>
              </div>

              {/* Brief content */}
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-6 border border-amber-200">
                <div className="prose prose-sm max-w-none prose-headings:text-gray-800 prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-p:text-gray-700 prose-li:text-gray-700 prose-strong:text-amber-700">
                  <ReactMarkdown>{brief.brief}</ReactMarkdown>
                </div>
              </div>

              {/* Metadata */}
              <div className="text-xs text-gray-400 text-center">
                Généré le {new Date(brief.generated_at).toLocaleString('fr-FR')}
                {brief.fallback && ' (version simplifiée)'}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 p-4 bg-gray-50">
          <p className="text-xs text-gray-500 text-center">
            💡 Astuce : Lisez ce brief à voix haute à votre équipe en 3 minutes max !
          </p>
        </div>
      </div>
    </div>
  );
};

export default MorningBriefModal;
