import React, { useState, useEffect, useRef } from 'react';
import { api } from '../lib/apiClient';
import { logger } from '../utils/logger';
import { getSubscriptionErrorMessage } from '../utils/apiHelpers';
import { useAuth } from '../contexts';
import { toast } from 'sonner';
import { X } from 'lucide-react';
import NewBriefTab from './morningBrief/NewBriefTab';
import HistoryTab from './morningBrief/HistoryTab';

/**
 * MorningBriefModal - Générateur de Brief Matinal IA
 *
 * Permet au manager de générer un script de brief matinal personnalisé
 * avec possibilité d'ajouter une consigne spécifique.
 * Inclut l'historique des briefs générés.
 */
const MorningBriefModal = ({ isOpen, onClose, storeName, managerName, storeId }) => {
  const { user } = useAuth();
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
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import('jspdf'),
        import('html2canvas'),
      ]);

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
      const { default: jsPDF } = await import('jspdf');
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
        addSection('🌟', 'Coup de Projecteur', structured.spotlight, [254, 243, 199], [146, 64, 14]); // Amber
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

        addSection('', 'Le Defi', structured.team_question, [243, 232, 255], [107, 33, 168]); // Purple
        addSection('', 'On y va !', structured.booster, [252, 231, 243], [157, 23, 77]); // Pink

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
        objective_daily: objectiveDaily ? Number.parseFloat(objectiveDaily) : null
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
      toast.error(getSubscriptionErrorMessage(error, user?.role) || error.response?.data?.detail || 'Erreur lors de la génération du brief');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteBrief = async (briefId) => {
    if (!globalThis.confirm('Êtes-vous sûr de vouloir supprimer ce brief ?')) {
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
          {activeTab === 'new' && (
            <NewBriefTab
              storeName={storeName}
              managerName={managerName}
              objectiveDaily={objectiveDaily}
              setObjectiveDaily={setObjectiveDaily}
              comments={comments}
              setComments={setComments}
              isLoading={isLoading}
              brief={brief}
              handleGenerate={handleGenerate}
              handleRegenerate={handleRegenerate}
              handleCopy={handleCopy}
              handleClose={handleClose}
              exportBriefToPDF={exportBriefToPDF}
              copied={copied}
              exportingPDF={exportingPDF}
              briefContentRef={briefContentRef}
            />
          )}

          {activeTab === 'history' && (
            <HistoryTab
              history={history}
              loadingHistory={loadingHistory}
              expandedItems={expandedItems}
              setExpandedItems={setExpandedItems}
              setActiveTab={setActiveTab}
              handleDeleteBrief={handleDeleteBrief}
              handleCopy={handleCopy}
              exportBriefToPDF={exportBriefToPDF}
            />
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
