import React, { useState, useEffect, useRef } from 'react';
import { api } from '../lib/apiClient';
import { logger } from '../utils/logger';
import { toast } from 'sonner';
import { X, Coffee, Sparkles, Copy, Check, RefreshCw, Calendar, Clock, Trash2, ChevronDown, Download, FileText } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * MorningBriefModal - Générateur de Brief Matinal IA
 * 
 * Permet au manager de générer un script de brief matinal personnalisé
 * avec possibilité d'ajouter une consigne spécifique.
 * Inclut l'historique des briefs générés.
 */
const MorningBriefModal = ({ isOpen, onClose, storeName, managerName, storeId }) => {
  const [comments, setComments] = useState('');
  const [objectiveDaily, setObjectiveDaily] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [brief, setBrief] = useState(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('new');
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [expandedItems, setExpandedItems] = useState({});
  const [exportingPDF, setExportingPDF] = useState(false);
  
  // Ref pour le container du brief (source unique pour le PDF - DOM snapshot)
  const briefContentRef = useRef(null);

  const storeParam = storeId ? `?store_id=${storeId}` : '';

  // Export Brief to PDF - NOUVELLE VERSION basée sur DOM snapshot
  const exportBriefToPDF = async (briefData) => {
    if (!briefData) return;
    
    setExportingPDF(true);
    
    try {
      // ============================================================
      // ÉTAPE 1: DIAGNOSTIC - Logs des 3 sources de contenu
      // ============================================================
      logger.log('=== PDF GENERATION DIAGNOSTIC ===');
      logger.log('PDF_SOURCE_rawState:', JSON.stringify(briefData, null, 2));
      logger.log('PDF_SOURCE_domText:', briefContentRef.current?.innerText || 'REF_NOT_READY');
      logger.log('PDF_SOURCE_domHTML:', briefContentRef.current?.innerHTML?.substring(0, 500) || 'REF_NOT_READY');
      
      // Vérifier si le ref est disponible (le brief doit être rendu)
      if (!briefContentRef.current) {
        logger.warn('⚠️ briefContentRef not ready, falling back to string-based PDF');
        // Fallback vers l'ancienne méthode (sera supprimée après validation)
        return await exportBriefToPDF_legacy(briefData);
      }
      
      // ============================================================
      // ÉTAPE 2: CAPTURE DOM avec html2canvas (source unique)
      // ============================================================
      const briefElement = briefContentRef.current;
      
      // Cloner l'élément pour éviter de modifier le DOM visible
      const clonedElement = briefElement.cloneNode(true);
      clonedElement.style.position = 'absolute';
      clonedElement.style.left = '-9999px';
      clonedElement.style.top = '0';
      clonedElement.style.width = briefElement.offsetWidth + 'px';
      document.body.appendChild(clonedElement);
      
      try {
        // Capturer le DOM en canvas
        const canvas = await html2canvas(clonedElement, {
          scale: 2, // Haute résolution
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          windowWidth: briefElement.offsetWidth,
          windowHeight: briefElement.offsetHeight
        });
        
        // Nettoyer le clone
        document.body.removeChild(clonedElement);
        
        // ============================================================
        // ÉTAPE 3: CRÉER PDF depuis le canvas
        // ============================================================
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 15;
        
        // Calculer les dimensions de l'image pour qu'elle rentre dans la page
        const imgWidth = pageWidth - 2 * margin;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        
        // Ajouter l'image au PDF (gérer le pagination si nécessaire)
        let heightLeft = imgHeight;
        let position = margin;
        
        pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
        heightLeft -= pageHeight - 2 * margin;
        
        // Ajouter des pages supplémentaires si nécessaire
        while (heightLeft > 0) {
          position = heightLeft - imgHeight + margin;
          pdf.addPage();
          pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
          heightLeft -= pageHeight - 2 * margin;
        }
        
        // ============================================================
        // ÉTAPE 4: SAUVEGARDER
        // ============================================================
        const fileName = `brief_matinal_${(briefData.store_name || storeName || 'store').replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
        pdf.save(fileName);
        
        logger.log('✅ PDF généré depuis DOM snapshot (pas de corruption attendue)');
        toast.success('PDF téléchargé avec succès !');
        
      } catch (canvasError) {
        // Nettoyer le clone en cas d'erreur
        if (document.body.contains(clonedElement)) {
          document.body.removeChild(clonedElement);
        }
        throw canvasError;
      }
      
    } catch (error) {
      logger.error('Erreur export PDF (DOM-based):', error);
      toast.error('Erreur lors de la génération du PDF');
    } finally {
      setExportingPDF(false);
    }
  };
  
  // ANCIENNE MÉTHODE (fallback) - À SUPPRIMER après validation
  const exportBriefToPDF_legacy = async (briefData) => {
    logger.warn('⚠️ Using legacy string-based PDF generation (fallback)');
    
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      let yPosition = 0;

      // === HEADER avec gradient ===
      pdf.setFillColor(30, 64, 175); // Bleu #1E40AF
      pdf.rect(0, 0, pageWidth, 45, 'F');
      
      // Logo text
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(24);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Retail Performer AI', margin, 20);
      
      // Subtitle
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Brief Matinal', margin, 30);
      
      // Date in header
      pdf.setFontSize(10);
      const dateText = briefData.date || new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      pdf.text(dateText, pageWidth - margin - pdf.getTextWidth(dateText), 20);
      
      // Store name
      if (briefData.store_name || storeName) {
        pdf.setFontSize(12);
        const storeText = briefData.store_name || storeName;
        pdf.text(storeText, pageWidth - margin - pdf.getTextWidth(storeText), 30);
      }

      yPosition = 55;

      // === MANAGER INFO BOX ===
      pdf.setFillColor(249, 115, 22, 0.1); // Orange léger
      pdf.setDrawColor(249, 115, 22);
      pdf.roundedRect(margin, yPosition, pageWidth - 2 * margin, 20, 3, 3, 'FD');
      
      pdf.setTextColor(249, 115, 22);
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Manager : ' + (briefData.manager_name || managerName || 'N/A'), margin + 5, yPosition + 8);
      
      if (briefData.data_date) {
        pdf.setFont('helvetica', 'normal');
        pdf.text('Données du : ' + briefData.data_date, margin + 5, yPosition + 15);
      }
      
      yPosition += 30;

      // === STRUCTURED CONTENT ===
      const structured = briefData.structured;
      
      // Helper function to clean Markdown for PDF
      const cleanMarkdownForPDF = (text) => {
        if (!text) return '';
        
        // First, decode HTML entities (handle &amp; &lt; etc.)
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = text;
        let cleaned = tempDiv.textContent || tempDiv.innerText || text;
        
        // Aggressively remove corrupted patterns where & appears between characters
        // Pattern: &[char]& repeated (like "&C&A& &r&é&a&l&i&s&é&")
        // Strategy: Remove all & that are not part of valid HTML entities, then clean up spacing
        
        // First, protect valid HTML entities by temporarily replacing them
        const entityMap = {};
        let entityCounter = 0;
        cleaned = cleaned.replace(/&(amp|lt|gt|quot|apos|nbsp|#\d+|#x[\da-f]+);/gi, (match) => {
          const key = `__ENTITY_${entityCounter}__`;
          entityMap[key] = match;
          entityCounter++;
          return key;
        });
        
        // Now remove ALL remaining & characters (they're corrupted)
        cleaned = cleaned.replace(/&/g, '');
        
        // Restore valid HTML entities
        Object.keys(entityMap).forEach(key => {
          cleaned = cleaned.replace(key, entityMap[key]);
        });
        
        // Clean up any double spaces created by removing &
        cleaned = cleaned.replace(/\s+/g, ' ');
        
        // Remove markdown bold (**text** -> text)
        cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, '$1');
        
        // Remove markdown headers (#, ##, ###)
        cleaned = cleaned.replace(/^#+\s+/gm, '');
        
        // Convert markdown lists (- item) to plain text with bullet
        cleaned = cleaned.replace(/^-\s+/gm, '• ');
        
        // Remove markdown links [text](url) -> text
        cleaned = cleaned.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');
        
        // Remove markdown emphasis (*text* -> text) but not if it's part of **
        cleaned = cleaned.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '$1');
        
        // Remove markdown horizontal rules
        cleaned = cleaned.replace(/^---+\s*$/gm, '');
        cleaned = cleaned.replace(/^\*\*\*\s*$/gm, '');
        
        // Remove emojis and special Unicode characters that jsPDF can't handle well
        cleaned = cleaned.replace(/[\u{1F300}-\u{1F9FF}]/gu, ''); // Emojis
        cleaned = cleaned.replace(/[\u{2600}-\u{26FF}]/gu, ''); // Misc symbols
        cleaned = cleaned.replace(/[\u{2700}-\u{27BF}]/gu, ''); // Dingbats
        
        // Remove markdown code blocks
        cleaned = cleaned.replace(/```[\s\S]*?```/g, '');
        cleaned = cleaned.replace(/`([^`]+)`/g, '$1');
        
        // Clean up multiple spaces
        cleaned = cleaned.replace(/[ \t]+/g, ' ');
        
        // Clean up multiple newlines
        cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
        cleaned = cleaned.trim();
        
        return cleaned;
      };
      
      if (structured) {
        // Helper function to add a section
        const addSection = (emoji, title, content, bgColor, textColor) => {
          if (!content) return;
          
          // Check if we need a new page
          if (yPosition > pageHeight - 60) {
            pdf.addPage();
            yPosition = 20;
          }
          
          // Section header (remove emoji for PDF compatibility)
          pdf.setFillColor(...bgColor);
          pdf.roundedRect(margin, yPosition, pageWidth - 2 * margin, 10, 2, 2, 'F');
          
          pdf.setTextColor(...textColor);
          pdf.setFontSize(12);
          pdf.setFont('helvetica', 'bold');
          // Remove emoji and special characters, clean for PDF
          let titleText = cleanMarkdownForPDF(title);
          // Remove any remaining problematic characters but keep French accents
          titleText = titleText.replace(/[^\w\s\-àâäéèêëïîôùûüÿçÀÂÄÉÈÊËÏÎÔÙÛÜŸÇ]/gi, '').trim();
          if (!titleText) {
            // Fallback: use original title without special chars but keep accents
            titleText = title.replace(/[^\w\s\-àâäéèêëïîôùûüÿçÀÂÄÉÈÊËÏÎÔÙÛÜŸÇ]/gi, '').trim();
          }
          if (titleText) {
            pdf.text(titleText, margin + 5, yPosition + 7);
          }
          
          yPosition += 14;
          
          // Section content - clean Markdown first
          pdf.setTextColor(60, 60, 60);
          pdf.setFontSize(10);
          pdf.setFont('helvetica', 'normal');
          
          const cleanedContent = cleanMarkdownForPDF(content);
          const lines = pdf.splitTextToSize(cleanedContent, pageWidth - 2 * margin - 10);
          lines.forEach(line => {
            if (yPosition > pageHeight - 20) {
              pdf.addPage();
              yPosition = 20;
            }
            pdf.text(line, margin + 5, yPosition);
            yPosition += 5;
          });
          
          yPosition += 8;
        };

        // Add each section with colors
        addSection('📊', 'Flash-Back', structured.flashback, [224, 231, 255], [67, 56, 202]); // Indigo
        addSection('🎯', 'Mission du Jour', structured.focus, [220, 252, 231], [22, 101, 52]); // Green
        
        // Examples as bullet points
        if (structured.examples && structured.examples.length > 0) {
          if (yPosition > pageHeight - 60) {
            pdf.addPage();
            yPosition = 20;
          }
          
          pdf.setFillColor(254, 243, 199); // Amber
          pdf.roundedRect(margin, yPosition, pageWidth - 2 * margin, 10, 2, 2, 'F');
          pdf.setTextColor(180, 83, 9);
          pdf.setFontSize(12);
          pdf.setFont('helvetica', 'bold');
          pdf.text('Methode', margin + 5, yPosition + 7);
          yPosition += 14;
          
          pdf.setTextColor(60, 60, 60);
          pdf.setFontSize(10);
          pdf.setFont('helvetica', 'normal');
          
          structured.examples.forEach(example => {
            if (yPosition > pageHeight - 20) {
              pdf.addPage();
              yPosition = 20;
            }
            const cleanedExample = cleanMarkdownForPDF(example);
            pdf.text('• ' + cleanedExample, margin + 8, yPosition);
            yPosition += 6;
          });
          yPosition += 8;
        }
        
        addSection('', 'Question Equipe', structured.team_question, [243, 232, 255], [107, 33, 168]); // Purple
        addSection('', 'Le Mot de la Fin', structured.booster, [252, 231, 243], [157, 23, 77]); // Pink

      } else {
        // Fallback: Parse markdown content
        const briefText = briefData.brief || '';
        pdf.setTextColor(60, 60, 60);
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        
        // Clean Markdown before splitting
        const cleanedText = cleanMarkdownForPDF(briefText);
        const lines = pdf.splitTextToSize(cleanedText, pageWidth - 2 * margin);
        lines.forEach(line => {
          if (yPosition > pageHeight - 20) {
            pdf.addPage();
            yPosition = 20;
          }
          pdf.text(line, margin, yPosition);
          yPosition += 5;
        });
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
      }

      // Save
      const fileName = `brief_matinal_${(briefData.store_name || storeName || 'store').replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);
      
      toast.success('PDF téléchargé avec succès !');
    } catch (error) {
      logger.error('Erreur export PDF:', error);
      toast.error('Erreur lors de la génération du PDF');
    } finally {
      setExportingPDF(false);
    }
  };

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
      const res = await api.get(`/briefs/morning/history${storeParam}`);
      setHistory(res.data.briefs || []);
    } catch (err) {
      logger.error('Error loading brief history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleGenerate = async () => {
    setIsLoading(true);
    setBrief(null);

    try {
      const payload = {
        comments: comments.trim() || null,
        objective_daily: objectiveDaily ? parseFloat(objectiveDaily) : null
      };

      const response = await api.post(
        `/briefs/morning${storeParam}`,
        payload
      );

      if (response.data.success) {
        setBrief(response.data);
        toast.success('☕ Brief matinal généré !');
        loadHistory(); // Refresh history
      } else {
        toast.error('Erreur lors de la génération');
      }
    } catch (error) {
      logger.error('Erreur génération brief:', error);
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
      await api.delete(`/briefs/morning/${briefId}${storeParam}`);
      toast.success('Brief supprimé');
      loadHistory();
    } catch (err) {
      logger.error('Error deleting brief:', err);
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
    setObjectiveDaily('');
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

  // Helper function to parse Markdown bold text
  const parseBoldText = (text) => {
    if (!text) return [<span key="empty"></span>];
    
    const parts = [];
    let lastIndex = 0;
    const regex = /\*\*([^*]+)\*\*/g;
    let match;
    
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        const beforeText = text.substring(lastIndex, match.index);
        if (beforeText) {
          parts.push(beforeText);
        }
      }
      parts.push({ type: 'bold', text: match[1] });
      lastIndex = regex.lastIndex;
    }
    
    if (lastIndex < text.length) {
      const remainingText = text.substring(lastIndex);
      if (remainingText) {
        parts.push(remainingText);
      }
    }
    
    if (parts.length === 0) {
      parts.push(text);
    }
    
    return parts.map((part, i) => {
      if (typeof part === 'object' && part.type === 'bold') {
        return <strong key={i} className="font-semibold text-gray-900">{part.text}</strong>;
      }
      return <span key={i}>{part}</span>;
    });
  };

  // Helper function to render content with Markdown support
  const renderContentWithMarkdown = (content) => {
    if (!content) return null;
    
    // Split by lines to handle lists
    const lines = content.split('\n');
    
    return (
      <div className="space-y-2">
        {lines.map((line, lineIdx) => {
          const cleaned = line.trim();
          if (!cleaned) return null;
          
          // Handle list items (lines starting with -)
          if (cleaned.match(/^[-•]\s*/)) {
            const text = cleaned.replace(/^[-•]\s*/, '');
            return (
              <div key={lineIdx} className="flex gap-3 items-start pl-2 mb-1">
                <span className="w-2 h-2 rounded-full mt-2 flex-shrink-0 bg-indigo-500"></span>
                <div className="flex-1 text-gray-700 leading-relaxed">
                  {parseBoldText(text)}
                </div>
              </div>
            );
          }
          
          // Regular text with bold support
          return (
            <p key={lineIdx} className="text-gray-700 leading-relaxed">
              {parseBoldText(cleaned)}
            </p>
          );
        })}
      </div>
    );
  };

  // Render structured brief (nouveau format V2)
  const renderStructuredBrief = (structured) => {
    if (!structured) return null;

    return (
      <div className="space-y-4">
        {/* 🌤️ Humeur du Jour - AFFICHÉ EN PREMIER */}
        {structured.humeur && (
          <div className={`rounded-xl p-5 shadow-sm border-2 ${colorPalette[0].card}`}>
            <div className="mb-3">
              <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm ${colorPalette[0].badge}`}>
                ⛅ L'Humeur du Jour
              </span>
            </div>
            {renderContentWithMarkdown(structured.humeur)}
          </div>
        )}

        {/* 📊 Flashback */}
        {structured.flashback && (
          <div className={`rounded-xl p-5 shadow-sm border-2 ${colorPalette[1].card}`}>
            <div className="mb-3">
              <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm ${colorPalette[1].badge}`}>
                📊 Flash-Back
              </span>
            </div>
            {renderContentWithMarkdown(structured.flashback)}
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
            {renderContentWithMarkdown(structured.focus)}
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
                  <div className="text-gray-700">
                    {parseBoldText(example)}
                  </div>
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
            {renderContentWithMarkdown(structured.team_question)}
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
            {renderContentWithMarkdown(structured.booster)}
          </div>
        )}
      </div>
    );
  };

  // Parse et affiche le brief avec le style des sections colorées (legacy format)
  const renderBriefContent = (briefData) => {
    // ⭐ TOUJOURS utiliser le markdown complet pour l'affichage
    // Le format structuré peut manquer certaines sections, le markdown est plus complet
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
              
              // Titre de sous-section (ligne entière en gras)
              if (cleaned.startsWith('**') && cleaned.endsWith('**') && !cleaned.includes(':') && cleaned.split('**').length === 3) {
                const subtitle = cleaned.replace(/\*\*/g, '');
                return (
                  <h5 key={lineIdx} className="text-base font-bold text-gray-900 mt-3 mb-2 flex items-center gap-2 first:mt-0">
                    <span className={`w-2 h-2 rounded-full bg-gradient-to-br ${colorScheme.gradient}`}></span>
                    {subtitle}
                  </h5>
                );
              }
              
              // Fonction helper pour parser le texte en gras
              const parseBoldText = (text) => {
                if (!text) return [<span key="empty"></span>];
                
                // Regex améliorée pour capturer **texte** même avec caractères spéciaux, espaces, etc.
                const parts = [];
                let lastIndex = 0;
                const regex = /\*\*([^*]+)\*\*/g;
                let match;
                
                while ((match = regex.exec(text)) !== null) {
                  // Ajouter le texte avant le match
                  if (match.index > lastIndex) {
                    const beforeText = text.substring(lastIndex, match.index);
                    if (beforeText) {
                      parts.push(beforeText);
                    }
                  }
                  // Ajouter le texte en gras
                  parts.push({ type: 'bold', text: match[1] });
                  lastIndex = regex.lastIndex;
                }
                
                // Ajouter le reste du texte
                if (lastIndex < text.length) {
                  const remainingText = text.substring(lastIndex);
                  if (remainingText) {
                    parts.push(remainingText);
                  }
                }
                
                // Si aucun match, retourner le texte tel quel
                if (parts.length === 0) {
                  parts.push(text);
                }
                
                return parts.map((part, i) => {
                  if (typeof part === 'object' && part.type === 'bold') {
                    return <strong key={i} className="font-semibold text-gray-900">{part.text}</strong>;
                  }
                  return <span key={i}>{part}</span>;
                });
              };
              
              // Liste avec tiret (doit aller à la ligne)
              // Détecte les tirets avec ou sans espace après
              if (cleaned.match(/^[-•]\s*/)) {
                // Retirer le tiret et l'espace qui suit
                const text = cleaned.replace(/^[-•]\s*/, '');
                
                return (
                  <div key={lineIdx} className="flex gap-3 items-start pl-2 mb-2">
                    <span className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 bg-gradient-to-br ${colorScheme.gradient}`}></span>
                    <div className="flex-1 text-gray-700 leading-relaxed">
                      {parseBoldText(text)}
                    </div>
                  </div>
                );
              }
              
              // Texte normal avec support du gras
              return (
                <p key={lineIdx} className="text-gray-700 leading-relaxed">
                  {parseBoldText(cleaned)}
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

              {/* Objectif CA du jour */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  💰 Objectif CA du jour (€)
                </label>
                <input
                  type="number"
                  value={objectiveDaily}
                  onChange={(e) => setObjectiveDaily(e.target.value)}
                  placeholder="Ex: 1200"
                  min="0"
                  step="0.01"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all"
                />
                <p className="text-xs text-gray-400 mt-1">Montant en euros (optionnel)</p>
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
                  <p className="text-gray-600">L&apos;IA prépare votre brief matinal</p>
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

              <div 
                ref={briefContentRef}
                className="bg-gradient-to-br from-orange-50 to-yellow-50 rounded-xl p-6 space-y-4"
              >
                {renderBriefContent(brief)}
              </div>

              <div className="flex justify-center gap-3 flex-wrap">
                <button onClick={handleRegenerate} className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-medium rounded-lg hover:shadow-lg transition-all flex items-center gap-2">
                  <RefreshCw className="w-4 h-4" /> Regénérer
                </button>
                <button onClick={() => handleCopy()} className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 ${copied ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copié !' : 'Copier'}
                </button>
                <button 
                  onClick={() => exportBriefToPDF(brief)} 
                  disabled={exportingPDF}
                  className="px-4 py-2 bg-[#1E40AF] text-white font-medium rounded-lg hover:bg-[#1E3A8A] transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {exportingPDF ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  {exportingPDF ? 'Export...' : 'PDF'}
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
                  <p className="text-gray-600">Chargement de l&apos;historique...</p>
                </div>
              )}

              {!loadingHistory && history.length === 0 && (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">📋</div>
                  <p className="text-gray-600">Aucun brief dans l&apos;historique</p>
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
                              {renderBriefContent(item)}
                            </div>
                            <div className="mt-4 flex justify-end gap-2">
                              <button
                                onClick={() => handleCopy(item.brief)}
                                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 flex items-center gap-2 text-sm"
                              >
                                <Copy className="w-4 h-4" /> Copier
                              </button>
                              <button
                                onClick={() => exportBriefToPDF(item)}
                                className="px-4 py-2 bg-[#1E40AF] text-white rounded-lg hover:bg-[#1E3A8A] flex items-center gap-2 text-sm"
                              >
                                <Download className="w-4 h-4" /> PDF
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
