import React, { useState } from 'react';
import axios from 'axios';
import { X, Sparkles, Copy, Check, FileText, Calendar, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

/**
 * EvaluationGenerator - Modal pour générer un guide d'entretien annuel IA
 * 
 * @param {boolean} isOpen - Contrôle l'affichage de la modale
 * @param {function} onClose - Callback pour fermer la modale
 * @param {string} employeeId - ID du vendeur à évaluer
 * @param {string} employeeName - Nom du vendeur
 * @param {string} role - 'manager' ou 'seller' (détermine le type de guide généré)
 */
export default function EvaluationGenerator({ isOpen, onClose, employeeId, employeeName, role }) {
  // Dates par défaut : 1er janvier de l'année en cours -> aujourd'hui
  const currentYear = new Date().getFullYear();
  const defaultStartDate = `${currentYear}-01-01`;
  const today = new Date().toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(today);
  const [loading, setLoading] = useState(false);
  const [guideContent, setGuideContent] = useState('');
  const [stats, setStats] = useState(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleGenerate = async () => {
    setLoading(true);
    setError('');
    setGuideContent('');
    setStats(null);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/api/evaluations/generate`,
        {
          employee_id: employeeId,
          start_date: startDate,
          end_date: endDate
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      setGuideContent(response.data.guide_content);
      setStats(response.data.stats_summary);
      toast.success('Guide généré avec succès !');
    } catch (err) {
      const errorMsg = err.response?.data?.detail || 'Erreur lors de la génération';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(guideContent);
      setCopied(true);
      toast.success('Guide copié dans le presse-papier !');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Erreur lors de la copie');
    }
  };

  const handleClose = () => {
    setGuideContent('');
    setStats(null);
    setError('');
    onClose();
  };

  // Formatage du titre selon le rôle
  const modalTitle = role === 'seller' 
    ? "🎯 Préparer Mon Entretien Annuel"
    : `📋 Préparer l'Entretien - ${employeeName}`;

  const generateButtonText = role === 'seller'
    ? "✨ Générer Ma Fiche de Préparation"
    : "✨ Générer le Guide d'Évaluation";

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#1E40AF] to-[#1E3A8A] p-4 sm:p-6 rounded-t-2xl relative">
          <button
            onClick={handleClose}
            className="absolute top-3 right-3 sm:top-4 sm:right-4 text-white hover:text-gray-200 transition-colors"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
          
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white">{modalTitle}</h2>
              <p className="text-white/80 text-sm">
                {role === 'seller' 
                  ? "Prépare tes arguments avec l'aide de l'IA"
                  : "Guide d'entretien généré par l'IA"}
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          {/* Date Selection */}
          <div className="bg-gray-50 rounded-xl p-4 mb-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Période d'analyse
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Date de début</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-[#1E40AF] focus:ring-1 focus:ring-[#1E40AF] text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Date de fin</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-[#1E40AF] focus:ring-1 focus:ring-[#1E40AF] text-sm"
                />
              </div>
            </div>
          </div>

          {/* Generate Button */}
          {!guideContent && !loading && (
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white font-semibold rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2 text-lg"
            >
              <Sparkles className="w-5 h-5" />
              {generateButtonText}
            </button>
          )}

          {/* Loading State */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-12 h-12 text-[#1E40AF] animate-spin mb-4" />
              <p className="text-gray-600 font-medium">Génération en cours...</p>
              <p className="text-gray-400 text-sm mt-1">L'IA analyse les données de performance</p>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 mb-4">
              <p className="text-red-700 font-medium">❌ {error}</p>
            </div>
          )}

          {/* Stats Summary */}
          {stats && !stats.no_data && (
            <div className="bg-blue-50 rounded-xl p-4 mb-4 border-2 border-blue-100">
              <h3 className="text-sm font-semibold text-[#1E40AF] mb-3">📊 Données utilisées</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="bg-white rounded-lg p-2">
                  <p className="text-lg font-bold text-[#1E40AF]">{stats.total_ca?.toLocaleString('fr-FR')} €</p>
                  <p className="text-xs text-gray-500">CA Total</p>
                </div>
                <div className="bg-white rounded-lg p-2">
                  <p className="text-lg font-bold text-[#F97316]">{stats.total_ventes}</p>
                  <p className="text-xs text-gray-500">Ventes</p>
                </div>
                <div className="bg-white rounded-lg p-2">
                  <p className="text-lg font-bold text-green-600">{stats.avg_panier?.toLocaleString('fr-FR')} €</p>
                  <p className="text-xs text-gray-500">Panier Moyen</p>
                </div>
                <div className="bg-white rounded-lg p-2">
                  <p className="text-lg font-bold text-purple-600">{stats.days_worked}</p>
                  <p className="text-xs text-gray-500">Jours travaillés</p>
                </div>
              </div>
            </div>
          )}

          {/* Generated Content */}
          {guideContent && (
            <div className="border-2 border-gray-200 rounded-xl overflow-hidden">
              <div className="bg-gray-100 px-4 py-2 flex items-center justify-between border-b border-gray-200">
                <span className="text-sm font-medium text-gray-700">
                  {role === 'seller' ? '📝 Ta Fiche de Préparation' : '📋 Guide d\'Évaluation'}
                </span>
                <button
                  onClick={handleCopy}
                  className={`flex items-center gap-1 px-3 py-1 rounded-lg text-sm font-medium transition-all ${
                    copied 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copié !' : 'Copier'}
                </button>
              </div>
              <div 
                className="p-4 max-h-[400px] overflow-y-auto bg-white prose prose-sm max-w-none"
                style={{ whiteSpace: 'pre-wrap' }}
              >
                {guideContent}
              </div>
            </div>
          )}

          {/* Regenerate Button (after generation) */}
          {guideContent && (
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="w-full mt-4 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Régénérer avec d'autres dates
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-4 bg-gray-50 rounded-b-2xl flex justify-end gap-3">
          <button
            onClick={handleClose}
            className="px-6 py-2 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300 transition-all"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
