import React, { useState } from 'react';
import axios from 'axios';
import { X, Sparkles, Copy, Check, FileText, Calendar, Loader2, CheckCircle, AlertTriangle, Target, MessageSquare, Star, Download } from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';

/**
 * EvaluationGenerator - Modal pour générer un guide d'entretien annuel IA
 * Version 2.0 - Affichage JSON en Cartes Colorées
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
  const [comments, setComments] = useState('');
  const [loading, setLoading] = useState(false);
  const [guideData, setGuideData] = useState(null); // JSON structuré
  const [stats, setStats] = useState(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [exportingPDF, setExportingPDF] = useState(false);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    setLoading(true);
    setError('');
    setGuideData(null);
    setStats(null);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/api/evaluations/generate`,
        {
          employee_id: employeeId,
          start_date: startDate,
          end_date: endDate,
          comments: comments.trim() || null
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      setGuideData(response.data.guide_content);
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
      // Formater le JSON en texte lisible pour la copie
      const textContent = formatGuideForCopy(guideData);
      await navigator.clipboard.writeText(textContent);
      setCopied(true);
      toast.success('Guide copié dans le presse-papier !');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Erreur lors de la copie');
    }
  };

  const formatGuideForCopy = (data) => {
    if (!data) return '';
    
    let text = `📋 GUIDE D'ENTRETIEN - ${employeeName}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    
    if (data.synthese) {
      text += `📊 SYNTHÈSE\n${data.synthese}\n\n`;
    }
    
    if (data.victoires?.length) {
      text += `🏆 POINTS FORTS / VICTOIRES\n`;
      data.victoires.forEach((v, i) => text += `  ${i+1}. ${v}\n`);
      text += '\n';
    }
    
    if (data.axes_progres?.length) {
      text += `📈 AXES DE PROGRÈS\n`;
      data.axes_progres.forEach((a, i) => text += `  ${i+1}. ${a}\n`);
      text += '\n';
    }
    
    // Pour Manager: Objectifs / Pour Seller: Souhaits
    if (data.objectifs?.length) {
      text += `🎯 OBJECTIFS\n`;
      data.objectifs.forEach((o, i) => text += `  ${i+1}. ${o}\n`);
      text += '\n';
    }
    
    if (data.souhaits?.length) {
      text += `⭐ MES SOUHAITS\n`;
      data.souhaits.forEach((s, i) => text += `  ${i+1}. ${s}\n`);
      text += '\n';
    }
    
    const questions = data.questions_coaching || data.questions_manager;
    if (questions?.length) {
      text += `💬 ${role === 'seller' ? 'QUESTIONS À POSER' : 'QUESTIONS DE COACHING'}\n`;
      questions.forEach((q, i) => text += `  ${i+1}. ${q}\n`);
    }
    
    return text;
  };

  // Export to PDF
  const exportToPDF = async () => {
    if (!guideData) return;
    
    setExportingPDF(true);
    
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      let yPosition = 0;

      // === HEADER ===
      const headerColor = role === 'seller' ? [249, 115, 22] : [30, 64, 175]; // Orange for seller, Blue for manager
      pdf.setFillColor(...headerColor);
      pdf.rect(0, 0, pageWidth, 50, 'F');
      
      // Logo
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(22);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Retail Performer AI', margin, 18);
      
      // Title
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'normal');
      const titleText = role === 'seller' ? 'Fiche de Préparation - Entretien Annuel' : "Guide d&apos;Entretien Annuel";
      pdf.text(titleText, margin, 28);
      
      // Employee name
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.text(employeeName || 'Collaborateur', margin, 40);
      
      // Period
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      const periodText = `Période : ${new Date(startDate).toLocaleDateString('fr-FR')} - ${new Date(endDate).toLocaleDateString('fr-FR')}`;
      pdf.text(periodText, pageWidth - margin - pdf.getTextWidth(periodText), 40);

      yPosition = 60;

      // === STATS BOX ===
      if (stats) {
        pdf.setFillColor(248, 250, 252);
        pdf.setDrawColor(226, 232, 240);
        pdf.roundedRect(margin, yPosition, pageWidth - 2 * margin, 25, 3, 3, 'FD');
        
        pdf.setTextColor(100, 116, 139);
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'bold');
        pdf.text('STATISTIQUES DE LA PÉRIODE', margin + 5, yPosition + 7);
        
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);
        pdf.setTextColor(51, 65, 85);
        
        const statsLine1 = `CA Total: ${stats.ca_total?.toLocaleString('fr-FR') || 'N/A'}€  •  Ventes: ${stats.nb_ventes || 'N/A'}  •  Jours travaillés: ${stats.nb_jours || 'N/A'}`;
        pdf.text(statsLine1, margin + 5, yPosition + 16);
        
        const statsLine2 = `Panier moyen: ${stats.panier_moyen?.toFixed(0) || 'N/A'}€  •  Indice de vente: ${stats.indice_vente?.toFixed(2) || 'N/A'}`;
        pdf.text(statsLine2, margin + 5, yPosition + 22);
        
        yPosition += 35;
      }

      // Helper function for sections
      const addSection = (emoji, title, items, bgColor, titleColor, isList = true) => {
        if (!items || (Array.isArray(items) && items.length === 0)) return;
        
        if (yPosition > pageHeight - 50) {
          pdf.addPage();
          yPosition = 20;
        }
        
        // Section header
        pdf.setFillColor(...bgColor);
        pdf.roundedRect(margin, yPosition, pageWidth - 2 * margin, 10, 2, 2, 'F');
        
        pdf.setTextColor(...titleColor);
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'bold');
        pdf.text(emoji + ' ' + title, margin + 5, yPosition + 7);
        
        yPosition += 14;
        
        // Content
        pdf.setTextColor(55, 65, 81);
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        
        if (isList && Array.isArray(items)) {
          items.forEach((item, index) => {
            if (yPosition > pageHeight - 15) {
              pdf.addPage();
              yPosition = 20;
            }
            const lines = pdf.splitTextToSize(`${index + 1}. ${item}`, pageWidth - 2 * margin - 15);
            lines.forEach((line, lineIndex) => {
              pdf.text(lineIndex === 0 ? line : '   ' + line, margin + 8, yPosition);
              yPosition += 5;
            });
            yPosition += 2;
          });
        } else {
          const lines = pdf.splitTextToSize(items, pageWidth - 2 * margin - 10);
          lines.forEach(line => {
            if (yPosition > pageHeight - 15) {
              pdf.addPage();
              yPosition = 20;
            }
            pdf.text(line, margin + 5, yPosition);
            yPosition += 5;
          });
        }
        
        yPosition += 8;
      };

      // === SECTIONS ===
      
      // Synthèse
      if (guideData.synthese) {
        addSection('📊', 'Synthèse Globale', guideData.synthese, [224, 231, 255], [67, 56, 202], false);
      }
      
      // Victoires / Points forts
      if (guideData.victoires?.length) {
        addSection('🏆', 'Points Forts & Victoires', guideData.victoires, [220, 252, 231], [22, 101, 52]);
      }
      
      // Axes de progrès
      if (guideData.axes_progres?.length) {
        addSection('📈', 'Axes de Progrès', guideData.axes_progres, [254, 243, 199], [180, 83, 9]);
      }
      
      // Objectifs (Manager) ou Souhaits (Seller)
      if (guideData.objectifs?.length) {
        addSection('🎯', 'Objectifs Proposés', guideData.objectifs, [219, 234, 254], [29, 78, 216]);
      }
      if (guideData.souhaits?.length) {
        addSection('⭐', 'Mes Souhaits & Aspirations', guideData.souhaits, [254, 226, 226], [185, 28, 28]);
      }
      
      // Questions
      const questions = guideData.questions_coaching || guideData.questions_manager;
      if (questions?.length) {
        const qTitle = role === 'seller' ? 'Questions à Poser à Mon Manager' : 'Questions de Coaching';
        addSection('💬', qTitle, questions, [243, 232, 255], [107, 33, 168]);
      }

      // === FOOTER ===
      const pageCount = pdf.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        pdf.setFillColor(248, 250, 252);
        pdf.rect(0, pageHeight - 15, pageWidth, 15, 'F');
        
        pdf.setTextColor(148, 163, 184);
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'normal');
        pdf.text('Généré par Retail Performer AI • ' + new Date().toLocaleDateString('fr-FR'), margin, pageHeight - 6);
        pdf.text('Page ' + i + '/' + pageCount, pageWidth - margin - 20, pageHeight - 6);
        
        // Confidential note
        pdf.setTextColor(220, 38, 38);
        pdf.setFontSize(7);
        pdf.text('Document confidentiel', pageWidth / 2 - 15, pageHeight - 6);
      }

      // Save
      const roleLabel = role === 'seller' ? 'preparation' : 'evaluation';
      const fileName = `${roleLabel}_${(employeeName || 'collaborateur').replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);
      
      toast.success('PDF téléchargé avec succès !');
    } catch (error) {
      console.error('Erreur export PDF:', error);
      toast.error('Erreur lors de la génération du PDF');
    } finally {
      setExportingPDF(false);
    }
  };

  const handleClose = () => {
    setGuideData(null);
    setStats(null);
    setError('');
    setComments('');
    onClose();
  };

  // Formatage du titre selon le rôle
  const modalTitle = role === 'seller' 
    ? "🎯 Préparer Mon Entretien Annuel"
    : `📋 Préparer l'Entretien - ${employeeName}`;

  const generateButtonText = role === 'seller'
    ? "✨ Générer Ma Fiche de Préparation"
    : "✨ Générer le Guide d&apos;Évaluation";

  const commentsPlaceholder = role === 'seller'
    ? "Ajoute tes notes personnelles (ex: 'J'ai géré seul(e) le magasin en août', 'J'ai formé 2 nouveaux vendeurs')..."
    : "Ajoutez vos observations spécifiques (ex: 'Très bon sur l'accueil, mais retards fréquents', 'A progressé sur le closing')...";

  // Force l'ouverture du date picker au clic
  const handleDateClick = (e) => {
    if (e.target.showPicker) {
      e.target.showPicker();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col">
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
          {/* Date Selection - Improved UX */}
          <div className="bg-gray-50 rounded-xl p-4 mb-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Période d&apos;analyse
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Date de début</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  onClick={handleDateClick}
                  className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-[#1E40AF] focus:ring-1 focus:ring-[#1E40AF] text-sm cursor-pointer hover:border-gray-300 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Date de fin</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  onClick={handleDateClick}
                  className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-[#1E40AF] focus:ring-1 focus:ring-[#1E40AF] text-sm cursor-pointer hover:border-gray-300 transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Comments / Context Field - NEW */}
          {!guideData && !loading && (
            <div className="bg-purple-50 rounded-xl p-4 mb-4 border-2 border-purple-100">
              <h3 className="text-sm font-semibold text-purple-800 mb-2 flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                {role === 'seller' ? 'Tes notes personnelles (optionnel)' : 'Vos observations (optionnel)'}
              </h3>
              <textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder={commentsPlaceholder}
                rows={3}
                className="w-full px-3 py-2 border-2 border-purple-200 rounded-lg focus:border-purple-400 focus:ring-1 focus:ring-purple-400 text-sm resize-none placeholder:text-purple-300"
              />
              <p className="text-xs text-purple-600 mt-1">
                💡 L'IA prendra en compte ces informations pour personnaliser le guide
              </p>
            </div>
          )}

          {/* Generate Button */}
          {!guideData && !loading && (
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

          {/* Generated Content - CARTES COLORÉES */}
          {guideData && (
            <div className="space-y-4">
              {/* Header avec bouton copier */}
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-800">
                  {role === 'seller' ? '📝 Ta Fiche de Préparation' : '📋 Guide d\'Évaluation'}
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={handleCopy}
                    className={`flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      copied 
                        ? 'bg-green-100 text-green-700 border-2 border-green-200' 
                        : 'bg-white text-gray-600 hover:bg-gray-100 border-2 border-gray-200'
                    }`}
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? 'Copié !' : 'Copier'}
                  </button>
                  <button
                    onClick={exportToPDF}
                    disabled={exportingPDF}
                    className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium bg-[#1E40AF] text-white hover:bg-[#1E3A8A] transition-all disabled:opacity-50"
                  >
                    {exportingPDF ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    {exportingPDF ? 'Export...' : 'PDF'}
                  </button>
                </div>
              </div>

              {/* 🔵 Carte Bleue - Synthèse */}
              {guideData.synthese && (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border-2 border-blue-200">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                      <FileText className="w-4 h-4 text-white" />
                    </div>
                    <h4 className="text-base font-bold text-blue-800">Synthèse & Contexte</h4>
                  </div>
                  <p className="text-gray-700 leading-relaxed">{guideData.synthese}</p>
                </div>
              )}

              {/* 🟢 Carte Verte - Victoires */}
              {guideData.victoires?.length > 0 && (
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4 border-2 border-green-200">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
                      <CheckCircle className="w-4 h-4 text-white" />
                    </div>
                    <h4 className="text-base font-bold text-green-800">
                      {role === 'seller' ? 'Tes Victoires 🏆' : 'Points Forts / Victoires'}
                    </h4>
                  </div>
                  <ul className="space-y-2">
                    {guideData.victoires.map((item, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-700">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 🟠 Carte Orange - Axes de Progrès */}
              {guideData.axes_progres?.length > 0 && (
                <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl p-4 border-2 border-orange-200">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
                      <AlertTriangle className="w-4 h-4 text-white" />
                    </div>
                    <h4 className="text-base font-bold text-orange-800">
                      {role === 'seller' ? 'Tes Axes de Progrès 📈' : 'Axes de Progrès'}
                    </h4>
                  </div>
                  <ul className="space-y-2">
                    {guideData.axes_progres.map((item, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-700">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 🟣 Carte Violette - Objectifs (Manager only) */}
              {role !== 'seller' && guideData.objectifs?.length > 0 && (
                <div className="bg-gradient-to-r from-purple-50 to-violet-50 rounded-xl p-4 border-2 border-purple-200">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center">
                      <Target className="w-4 h-4 text-white" />
                    </div>
                    <h4 className="text-base font-bold text-purple-800">
                      Objectifs & Recommandations 🎯
                    </h4>
                  </div>
                  <ul className="space-y-2">
                    {guideData.objectifs.map((item, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <Target className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-700">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* ⭐ Carte Jaune/Dorée - Souhaits (Seller only) */}
              {role === 'seller' && guideData.souhaits?.length > 0 && (
                <div className="bg-gradient-to-r from-yellow-50 to-amber-50 rounded-xl p-4 border-2 border-yellow-200">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 bg-yellow-500 rounded-lg flex items-center justify-center">
                      <Star className="w-4 h-4 text-white" />
                    </div>
                    <h4 className="text-base font-bold text-yellow-800">
                      Mes Souhaits & Demandes ⭐
                    </h4>
                  </div>
                  <ul className="space-y-2">
                    {guideData.souhaits.map((item, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <Star className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-700">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 🩷 Carte Rose - Questions (Manager: coaching / Seller: à poser) */}
              {(guideData.questions_coaching?.length > 0 || guideData.questions_manager?.length > 0) && (
                <div className="bg-gradient-to-r from-pink-50 to-rose-50 rounded-xl p-4 border-2 border-pink-200">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 bg-pink-500 rounded-lg flex items-center justify-center">
                      <MessageSquare className="w-4 h-4 text-white" />
                    </div>
                    <h4 className="text-base font-bold text-pink-800">
                      {role === 'seller' ? 'Questions à Poser 💬' : 'Questions de Coaching'}
                    </h4>
                  </div>
                  <ul className="space-y-2">
                    {(guideData.questions_coaching || guideData.questions_manager || []).map((item, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="w-6 h-6 bg-pink-100 text-pink-600 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                          {index + 1}
                        </span>
                        <span className="text-gray-700">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Regenerate Button */}
              <button
                onClick={handleGenerate}
                disabled={loading}
                className="w-full py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                Régénérer avec d'autres paramètres
              </button>
            </div>
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
