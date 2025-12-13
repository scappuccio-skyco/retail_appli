import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { X, Coffee, Sparkles, Copy, Check, RefreshCw, Calendar, Clock } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * MorningBriefModal - Générateur de Brief Matinal IA
 * 
 * Permet au manager de générer un script de brief matinal personnalisé
 * avec possibilité d'ajouter une consigne spécifique.
 * 
 * Design unifié avec TeamAIAnalysisModal
 */
const MorningBriefModal = ({ isOpen, onClose, storeName, managerName, storeId }) => {
  const [comments, setComments] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [brief, setBrief] = useState(null);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    setIsLoading(true);
    setBrief(null);

    try {
      const token = localStorage.getItem('token');
      const storeParam = storeId ? `?store_id=${storeId}` : '';
      const response = await axios.post(
        `${API_URL}/api/briefs/morning${storeParam}`,
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

  // Parse et affiche le brief avec le style des sections colorées
  const renderBriefContent = (briefText) => {
    // Nettoyer le texte - enlever le premier # si présent
    const cleanedText = briefText.replace(/^#\s+[^\n]+\n/, '');
    
    // Séparer par les sections (### ou ##)
    const sections = cleanedText.split(/(?=###?\s)/).filter(s => s.trim());
    
    // Palette de couleurs pour le brief matinal (tons chauds)
    const colorPalette = [
      {
        badge: 'bg-amber-100 text-amber-800',
        card: 'bg-amber-50 border-amber-200',
        icon: '🌤️',
        gradient: 'from-amber-500 to-orange-500'
      },
      {
        badge: 'bg-indigo-100 text-indigo-800',
        card: 'bg-indigo-50 border-indigo-200',
        icon: '📊',
        gradient: 'from-indigo-500 to-purple-600'
      },
      {
        badge: 'bg-green-100 text-green-800',
        card: 'bg-green-50 border-green-200',
        icon: '🎯',
        gradient: 'from-green-500 to-emerald-600'
      },
      {
        badge: 'bg-purple-100 text-purple-800',
        card: 'bg-purple-50 border-purple-200',
        icon: '🎲',
        gradient: 'from-purple-500 to-indigo-600'
      },
      {
        badge: 'bg-pink-100 text-pink-800',
        card: 'bg-pink-50 border-pink-200',
        icon: '🚀',
        gradient: 'from-pink-500 to-rose-600'
      }
    ];

    return sections.map((section, sectionIdx) => {
      const lines = section.trim().split('\n');
      // Extraire le titre (enlever les # et les emojis au début pour le badge)
      let rawTitle = lines[0].replace(/^#+\s*/, '').trim();
      // Garder le titre avec emojis
      const title = rawTitle.replace(/\*\*/g, '');
      const content = lines.slice(1).join('\n').trim();
      
      // Déterminer la couleur selon le contenu du titre
      let colorScheme;
      const titleLower = title.toLowerCase();
      
      if (titleLower.includes('humeur') || titleLower.includes('bonjour') || titleLower.includes('matin')) {
        colorScheme = colorPalette[0]; // Amber
      } else if (titleLower.includes('flash') || titleLower.includes('bilan') || titleLower.includes('performance') || titleLower.includes('hier')) {
        colorScheme = colorPalette[1]; // Indigo
      } else if (titleLower.includes('mission') || titleLower.includes('objectif') || titleLower.includes('focus')) {
        colorScheme = colorPalette[2]; // Green
      } else if (titleLower.includes('challenge') || titleLower.includes('défi') || titleLower.includes('café')) {
        colorScheme = colorPalette[3]; // Purple
      } else if (titleLower.includes('mot') || titleLower.includes('fin') || titleLower.includes('conclusion')) {
        colorScheme = colorPalette[4]; // Pink
      } else {
        colorScheme = colorPalette[sectionIdx % colorPalette.length];
      }

      return (
        <div key={sectionIdx} className={`rounded-xl p-5 shadow-sm border-2 ${colorScheme.card}`}>
          {/* Badge titre */}
          <div className="mb-4">
            <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full font-bold text-sm ${colorScheme.badge}`}>
              {title}
            </span>
          </div>
          
          {/* Contenu */}
          <div className="space-y-3">
            {content.split('\n').map((line, lineIdx) => {
              const cleaned = line.trim();
              if (!cleaned) return null;
              
              // Titre en gras seul sur une ligne (**Titre**)
              if (cleaned.startsWith('**') && cleaned.endsWith('**') && !cleaned.includes(':') && cleaned.split('**').length === 3) {
                const subtitle = cleaned.replace(/\*\*/g, '');
                return (
                  <h5 key={lineIdx} className="text-base font-bold text-gray-900 mt-3 mb-2 flex items-center gap-2 first:mt-0">
                    <span className={`w-2 h-2 rounded-full bg-gradient-to-br ${colorScheme.gradient}`}></span>
                    {subtitle}
                  </h5>
                );
              }
              
              // Ligne avec **Label** : Valeur (comme CA réalisé, Top Performance, etc.)
              if (cleaned.includes('**') && cleaned.includes(':')) {
                const parts = cleaned.split(/(\*\*.*?\*\*)/g);
                
                return (
                  <div key={lineIdx} className="flex gap-2 items-start">
                    <p className="flex-1 text-gray-700 leading-relaxed">
                      {parts.map((part, i) => {
                        if (part.startsWith('**') && part.endsWith('**')) {
                          return <strong key={i} className="font-bold text-gray-900">{part.slice(2, -2)}</strong>;
                        }
                        return <span key={i}>{part}</span>;
                      })}
                    </p>
                  </div>
                );
              }
              
              // Liste à puces
              if (cleaned.startsWith('-') || cleaned.startsWith('•')) {
                const text = cleaned.replace(/^[-•]\s*/, '');
                const parts = text.split(/(\*\*.*?\*\*)/g);
                
                return (
                  <div key={lineIdx} className="flex gap-3 items-start">
                    <span className="text-gray-400 font-bold text-lg mt-0.5">•</span>
                    <p className="flex-1 text-gray-700 leading-relaxed">
                      {parts.map((part, i) => {
                        if (part.startsWith('**') && part.endsWith('**')) {
                          return <strong key={i} className="font-bold text-gray-900">{part.slice(2, -2)}</strong>;
                        }
                        return <span key={i}>{part}</span>;
                      })}
                    </p>
                  </div>
                );
              }
              
              // Paragraphe normal avec **texte en gras**
              const parts = cleaned.split(/(\*\*.*?\*\*)/g);
              return (
                <p key={lineIdx} className="text-gray-700 leading-relaxed">
                  {parts.map((part, i) => {
                    if (part.startsWith('**') && part.endsWith('**')) {
                      return <strong key={i} className="font-bold text-gray-900">{part.slice(2, -2)}</strong>;
                    }
                    return <span key={i}>{part}</span>;
                  })}
                </p>
              );
            })}
          </div>
        </div>
      );
    });
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header - Style unifié */}
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-6 text-white">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <span>☕</span> Brief du Matin
            </h2>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 max-h-[calc(80vh-180px)]">
          {!brief && !isLoading && (
            /* Phase 1: Configuration */
            <div className="space-y-6">
              {/* Info magasin */}
              <div className="bg-white rounded-xl p-4 shadow-sm border-2 border-gray-200">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Calendar className="w-4 h-4" />
                    <span className="font-semibold">Magasin :</span>
                    <span>{storeName || 'Mon Magasin'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Coffee className="w-4 h-4" />
                    <span className="font-semibold">Manager :</span>
                    <span>{managerName || 'Manager'}</span>
                  </div>
                </div>
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

              {/* Bouton de génération - Style unifié */}
              <div className="text-center py-4">
                <div className="text-6xl mb-4">☕</div>
                <p className="text-gray-600 mb-6">
                  Générez un brief matinal personnalisé pour motiver votre équipe
                </p>
                <button
                  onClick={handleGenerate}
                  className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold rounded-lg hover:shadow-lg transition-all flex items-center gap-2 mx-auto"
                >
                  <Sparkles className="w-5 h-5" />
                  Générer le Brief
                </button>
              </div>
            </div>
          )}

          {/* Loading state - Style unifié */}
          {isLoading && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
              <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
                <div className="text-center mb-6">
                  <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-amber-500 to-orange-500 rounded-full flex items-center justify-center animate-pulse">
                    <Coffee className="w-10 h-10 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-800 mb-2">
                    Préparation du brief...
                  </h3>
                  <p className="text-gray-600">
                    L'IA prépare votre brief matinal personnalisé
                  </p>
                </div>
                
                {/* Progress Bar */}
                <div className="relative w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 animate-progress-slide"></div>
                </div>
                
                <div className="mt-4 text-center text-sm text-gray-500">
                  <p>⏱️ Temps estimé : 30-60 secondes</p>
                </div>
              </div>
            </div>
          )}

          {/* Phase 2: Affichage du brief */}
          {brief && !isLoading && (
            <div className="space-y-4">
              {/* Métadonnées */}
              <div className="bg-white rounded-xl p-4 shadow-sm border-2 border-gray-200">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar className="w-4 h-4" />
                      <span className="font-semibold">Date :</span>
                      <span>{brief.date}</span>
                    </div>
                    {brief.data_date && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Clock className="w-4 h-4" />
                        <span className="font-semibold">Données du :</span>
                        <span>{brief.data_date}</span>
                      </div>
                    )}
                  </div>
                  {brief.has_context && (
                    <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-semibold">
                      ✓ Consigne intégrée
                    </span>
                  )}
                </div>
              </div>

              {/* Brief content avec sections colorées */}
              <div className="bg-gradient-to-br from-orange-50 to-yellow-50 rounded-xl p-6 space-y-4">
                {renderBriefContent(brief.brief)}
              </div>

              {/* Actions */}
              <div className="flex justify-center gap-3">
                <button
                  onClick={handleRegenerate}
                  className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-medium rounded-lg hover:shadow-lg transition-all flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Regénérer
                </button>
                <button
                  onClick={handleCopy}
                  className={`px-4 py-2 rounded-lg transition-colors font-medium flex items-center gap-2 ${
                    copied 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copié !' : 'Copier'}
                </button>
                <button
                  onClick={handleClose}
                  className="px-4 py-2 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Fermer
                </button>
              </div>

              {/* Footer info */}
              <div className="text-xs text-gray-400 text-center">
                Généré le {new Date(brief.generated_at).toLocaleString('fr-FR')}
                {brief.fallback && ' (version simplifiée)'}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!brief && !isLoading && (
          <div className="border-t border-gray-100 p-4 bg-gray-50">
            <p className="text-xs text-gray-500 text-center">
              💡 Astuce : Lisez ce brief à voix haute à votre équipe en 3 minutes max !
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MorningBriefModal;
