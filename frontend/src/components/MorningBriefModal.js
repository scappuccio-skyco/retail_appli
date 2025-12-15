import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { X, Coffee, Sparkles, Copy, Check, RefreshCw, Calendar, Clock, Trash2, ChevronDown } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * MorningBriefModal - Générateur de Brief Matinal IA
 * 
 * Permet au manager de générer un script de brief matinal personnalisé
 * avec possibilité d'ajouter une consigne spécifique.
 * Inclut l'historique des briefs générés.
 */
const MorningBriefModal = ({ isOpen, onClose, storeName, managerName, storeId }) => {
  const [comments, setComments] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [brief, setBrief] = useState(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('new');
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [expandedItems, setExpandedItems] = useState({});

  const storeParam = storeId ? `?store_id=${storeId}` : '';

  // Charger l'historique
  useEffect(() => {
    if (isOpen) {
      loadHistory();
    }
  }, [isOpen]);

  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory();
    }
  }, [activeTab]);

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(
        `${API_URL}/api/briefs/morning/history${storeParam}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setHistory(res.data.briefs || []);
    } catch (err) {
      console.error('Error loading brief history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleGenerate = async () => {
    setIsLoading(true);
    setBrief(null);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_URL}/api/briefs/morning${storeParam}`,
        { comments: comments.trim() || null },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        setBrief(response.data);
        toast.success('☕ Brief matinal généré !');
        loadHistory(); // Refresh history
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

  const handleDeleteBrief = async (briefId) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce brief ?')) {
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      await axios.delete(
        `${API_URL}/api/briefs/morning/${briefId}${storeParam}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Brief supprimé');
      loadHistory();
    } catch (err) {
      console.error('Error deleting brief:', err);
      toast.error('Erreur lors de la suppression');
    }
  };

  const handleCopy = async (briefText) => {
    try {
      await navigator.clipboard.writeText(briefText || brief?.brief);
      setCopied(true);
      toast.success('Brief copié dans le presse-papier !');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Erreur lors de la copie');
    }
  };

  const handleRegenerate = () => {
    setBrief(null);
    handleGenerate();
  };

  const handleClose = () => {
    setComments('');
    setBrief(null);
    setActiveTab('new');
    onClose();
  };

  // Palette de couleurs
  const colorPalette = [
    { badge: 'bg-amber-100 text-amber-800', card: 'bg-amber-50 border-amber-200', gradient: 'from-amber-500 to-orange-500' },
    { badge: 'bg-indigo-100 text-indigo-800', card: 'bg-indigo-50 border-indigo-200', gradient: 'from-indigo-500 to-purple-600' },
    { badge: 'bg-green-100 text-green-800', card: 'bg-green-50 border-green-200', gradient: 'from-green-500 to-emerald-600' },
    { badge: 'bg-purple-100 text-purple-800', card: 'bg-purple-50 border-purple-200', gradient: 'from-purple-500 to-indigo-600' },
    { badge: 'bg-pink-100 text-pink-800', card: 'bg-pink-50 border-pink-200', gradient: 'from-pink-500 to-rose-600' }
  ];

  // Render structured brief (nouveau format V2)
  const renderStructuredBrief = (structured) => {
    if (!structured) return null;

    return (
      <div className="space-y-4">
        {/* 📊 Flashback */}
        {structured.flashback && (
          <div className={`rounded-xl p-5 shadow-sm border-2 ${colorPalette[1].card}`}>
            <div className="mb-3">
              <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm ${colorPalette[1].badge}`}>
                📊 Flash-Back
              </span>
            </div>
            <p className="text-gray-700 leading-relaxed">{structured.flashback}</p>
          </div>
        )}

        {/* 🎯 Focus/Mission */}
        {structured.focus && (
          <div className={`rounded-xl p-5 shadow-sm border-2 ${colorPalette[2].card}`}>
            <div className="mb-3">
              <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm ${colorPalette[2].badge}`}>
                🎯 Mission du Jour
              </span>
            </div>
            <p className="text-gray-800 font-medium leading-relaxed">{structured.focus}</p>
          </div>
        )}

        {/* 💡 Méthodes/Exemples */}
        {structured.examples && structured.examples.length > 0 && (
          <div className={`rounded-xl p-5 shadow-sm border-2 ${colorPalette[0].card}`}>
            <div className="mb-3">
              <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm ${colorPalette[0].badge}`}>
                💡 Méthode
              </span>
            </div>
            <ul className="space-y-2">
              {structured.examples.map((example, idx) => (
                <li key={idx} className="flex gap-3 items-start">
                  <span className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 bg-gradient-to-br ${colorPalette[0].gradient}`}></span>
                  <span className="text-gray-700">{example}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 🗣️ Question Équipe */}
        {structured.team_question && (
          <div className={`rounded-xl p-5 shadow-sm border-2 ${colorPalette[3].card}`}>
            <div className="mb-3">
              <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm ${colorPalette[3].badge}`}>
                🗣️ Question Équipe
              </span>
            </div>
            <p className="text-gray-800 italic leading-relaxed">"{structured.team_question}"</p>
          </div>
        )}

        {/* 🚀 Booster */}
        {structured.booster && (
          <div className={`rounded-xl p-5 shadow-sm border-2 ${colorPalette[4].card}`}>
            <div className="mb-3">
              <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm ${colorPalette[4].badge}`}>
                🚀 Le Mot de la Fin
              </span>
            </div>
            <p className="text-gray-800 font-medium leading-relaxed">"{structured.booster}"</p>
          </div>
        )}
      </div>
    );
  };

  // Parse et affiche le brief avec le style des sections colorées (legacy format)
  const renderBriefContent = (briefData) => {
    // Si on a le format structuré, l'utiliser en priorité
    if (briefData.structured) {
      return renderStructuredBrief(briefData.structured);
    }
    
    // Sinon, fallback sur le parsing du Markdown (rétro-compatibilité)
    const briefText = typeof briefData === 'string' ? briefData : briefData.brief;
    if (!briefText) return null;
    
    const sections = briefText.split(/(?=###\s)/).filter(s => s.trim() && s.trim().startsWith('###'));

    return sections.map((section, sectionIdx) => {
      const lines = section.trim().split('\n');
      let rawTitle = lines[0].replace(/^#+\s*/, '').trim();
      const title = rawTitle.replace(/\*\*/g, '');
      const content = lines.slice(1).join('\n').trim();
      
      let colorScheme;
      const titleLower = title.toLowerCase();
      
      if (titleLower.includes('humeur') || titleLower.includes('bonjour') || titleLower.includes('matin')) {
        colorScheme = colorPalette[0];
      } else if (titleLower.includes('flash') || titleLower.includes('bilan') || titleLower.includes('performance') || titleLower.includes('hier')) {
        colorScheme = colorPalette[1];
      } else if (titleLower.includes('mission') || titleLower.includes('objectif') || titleLower.includes('focus')) {
        colorScheme = colorPalette[2];
      } else if (titleLower.includes('challenge') || titleLower.includes('défi') || titleLower.includes('café')) {
        colorScheme = colorPalette[3];
      } else if (titleLower.includes('mot') || titleLower.includes('fin') || titleLower.includes('conclusion')) {
        colorScheme = colorPalette[4];
      } else {
        colorScheme = colorPalette[sectionIdx % colorPalette.length];
      }

      return (
        <div key={sectionIdx} className={`rounded-xl p-5 shadow-sm border-2 ${colorScheme.card}`}>
          <div className="mb-4">
            <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm ${colorScheme.badge}`}>
              {title}
            </span>
          </div>
          
          <div className="space-y-2">
            {content.split('\n').map((line, lineIdx) => {
              const cleaned = line.trim();
              if (!cleaned || cleaned === '---' || cleaned === '***' || cleaned.startsWith('*Brief généré')) return null;
              
              if (cleaned.startsWith('**') && cleaned.endsWith('**') && !cleaned.includes(':') && cleaned.split('**').length === 3) {
                const subtitle = cleaned.replace(/\*\*/g, '');
                return (
                  <h5 key={lineIdx} className="text-base font-bold text-gray-900 mt-3 mb-2 flex items-center gap-2 first:mt-0">
                    <span className={`w-2 h-2 rounded-full bg-gradient-to-br ${colorScheme.gradient}`}></span>
                    {subtitle}
                  </h5>
                );
              }
              
              if (cleaned.startsWith('-') || cleaned.startsWith('•')) {
                const text = cleaned.replace(/^[-•]\s*/, '');
                const parts = text.split(/(\*\*.*?\*\*)/g);
                
                return (
                  <div key={lineIdx} className="flex gap-3 items-start pl-2">
                    <span className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 bg-gradient-to-br ${colorScheme.gradient}`}></span>
                    <p className="flex-1 text-gray-700 leading-relaxed">
                      {parts.map((part, i) => {
                        if (part.startsWith('**') && part.endsWith('**')) {
                          return <strong key={i} className="font-semibold text-gray-900">{part.slice(2, -2)}</strong>;
                        }
                        return <span key={i}>{part}</span>;
                      })}
                    </p>
                  </div>
                );
              }
              
              const parts = cleaned.split(/(\*\*.*?\*\*)/g);
              return (
                <p key={lineIdx} className="text-gray-700 leading-relaxed">
                  {parts.map((part, i) => {
                    if (part.startsWith('**') && part.endsWith('**')) {
                      return <strong key={i} className="font-semibold text-gray-900">{part.slice(2, -2)}</strong>;
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
        {/* Header */}
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

        {/* Tabs */}
        <div className="border-b border-gray-200 px-6">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('new')}
              className={`px-4 py-3 font-semibold transition-colors border-b-2 ${
                activeTab === 'new'
                  ? 'border-amber-500 text-amber-600'
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
            >
              Nouveau Brief
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 py-3 font-semibold transition-colors border-b-2 ${
                activeTab === 'history'
                  ? 'border-amber-500 text-amber-600'
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
            >
              Historique ({history.length})
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 max-h-[calc(80vh-180px)]">
          
          {/* TAB: Nouveau Brief */}
          {activeTab === 'new' && !brief && !isLoading && (
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

              {/* Textarea */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  🎯 Une consigne particulière pour ce matin ?
                </label>
                <textarea
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  placeholder="Ex: Insister sur la vente des chaussettes, féliciter Julie pour hier..."
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 resize-none transition-all"
                  rows={4}
                  maxLength={500}
                />
                <p className="text-xs text-gray-400 mt-1 text-right">{comments.length}/500</p>
              </div>

              {/* Exemples */}
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs font-semibold text-gray-500 mb-2">💡 EXEMPLES :</p>
                <div className="flex flex-wrap gap-2">
                  {["Focus nouvelle collection", "Féliciter l'équipe", "Rappel ponctualité", "Objectif panier +10%"].map((ex, idx) => (
                    <button
                      key={idx}
                      onClick={() => setComments(ex)}
                      className="text-xs bg-white border border-gray-200 text-gray-600 px-3 py-1.5 rounded-full hover:bg-amber-50 hover:border-amber-300 hover:text-amber-700 transition-all"
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bouton */}
              <div className="text-center py-4">
                <div className="text-6xl mb-4">☕</div>
                <p className="text-gray-600 mb-6">Générez un brief matinal personnalisé</p>
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

          {/* Loading */}
          {isLoading && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
              <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
                <div className="text-center mb-6">
                  <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-amber-500 to-orange-500 rounded-full flex items-center justify-center animate-pulse">
                    <Coffee className="w-10 h-10 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-800 mb-2">Préparation du brief...</h3>
                  <p className="text-gray-600">L'IA prépare votre brief matinal</p>
                </div>
                <div className="relative w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 animate-progress-slide"></div>
                </div>
                <p className="mt-4 text-center text-sm text-gray-500">⏱️ ~30-60 secondes</p>
              </div>
            </div>
          )}

          {/* Brief généré */}
          {activeTab === 'new' && brief && !isLoading && (
            <div className="space-y-4">
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
                        <span className="font-semibold">Données :</span>
                        <span>{brief.data_date}</span>
                      </div>
                    )}
                  </div>
                  {brief.has_context && (
                    <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-semibold">✓ Consigne intégrée</span>
                  )}
                </div>
              </div>

              <div className="bg-gradient-to-br from-orange-50 to-yellow-50 rounded-xl p-6 space-y-4">
                {renderBriefContent(brief.brief)}
              </div>

              <div className="flex justify-center gap-3">
                <button onClick={handleRegenerate} className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-medium rounded-lg hover:shadow-lg transition-all flex items-center gap-2">
                  <RefreshCw className="w-4 h-4" /> Regénérer
                </button>
                <button onClick={() => handleCopy()} className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 ${copied ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copié !' : 'Copier'}
                </button>
                <button onClick={handleClose} className="px-4 py-2 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300 transition-colors">
                  Fermer
                </button>
              </div>

              <div className="text-xs text-gray-400 text-center">
                Généré le {new Date(brief.generated_at).toLocaleString('fr-FR')}
              </div>
            </div>
          )}

          {/* TAB: Historique */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              {loadingHistory && (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-amber-500 mx-auto mb-4"></div>
                  <p className="text-gray-600">Chargement de l'historique...</p>
                </div>
              )}

              {!loadingHistory && history.length === 0 && (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">📋</div>
                  <p className="text-gray-600">Aucun brief dans l'historique</p>
                  <button
                    onClick={() => setActiveTab('new')}
                    className="mt-4 px-6 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600"
                  >
                    Créer un brief
                  </button>
                </div>
              )}

              {!loadingHistory && history.length > 0 && (
                <div className="space-y-4">
                  {history.map((item, index) => {
                    const isExpanded = expandedItems[item.brief_id];
                    const isLatest = index === 0;

                    return (
                      <div
                        key={item.brief_id}
                        className={`border-2 rounded-xl overflow-hidden transition-all ${
                          isLatest
                            ? 'border-amber-400 bg-gradient-to-br from-amber-50 to-orange-50 shadow-lg'
                            : 'border-gray-200 bg-white hover:shadow-md'
                        }`}
                      >
                        {/* Header */}
                        <div
                          className="p-4 cursor-pointer hover:bg-white/50 transition-colors"
                          onClick={() => setExpandedItems(prev => ({ ...prev, [item.brief_id]: !prev[item.brief_id] }))}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                {isLatest && (
                                  <span className="px-2 py-0.5 bg-amber-500 text-white text-xs font-bold rounded-full">DERNIER</span>
                                )}
                                <span className="text-sm font-semibold text-gray-800">Brief du {item.date}</span>
                              </div>
                              <div className="flex items-center gap-4 flex-wrap text-sm text-gray-600">
                                {item.data_date && (
                                  <div className="flex items-center gap-1">
                                    <Calendar className="w-4 h-4" />
                                    <span>Données: {item.data_date}</span>
                                  </div>
                                )}
                                <div className="flex items-center gap-1">
                                  <Clock className="w-4 h-4" />
                                  <span>{new Date(item.generated_at).toLocaleString('fr-FR')}</span>
                                </div>
                                {item.has_context && (
                                  <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-xs">Avec consigne</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <ChevronDown className={`w-5 h-5 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDeleteBrief(item.brief_id); }}
                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                title="Supprimer"
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Expanded content */}
                        {isExpanded && (
                          <div className="border-t-2 border-gray-200 bg-gradient-to-br from-orange-50 to-yellow-50 p-6">
                            <div className="space-y-4">
                              {renderBriefContent(item.brief)}
                            </div>
                            <div className="mt-4 flex justify-end">
                              <button
                                onClick={() => handleCopy(item.brief)}
                                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 flex items-center gap-2 text-sm"
                              >
                                <Copy className="w-4 h-4" /> Copier
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {activeTab === 'new' && !brief && !isLoading && (
          <div className="border-t border-gray-100 p-4 bg-gray-50">
            <p className="text-xs text-gray-500 text-center">
              💡 Lisez ce brief à voix haute à votre équipe en 3 minutes max !
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MorningBriefModal;
