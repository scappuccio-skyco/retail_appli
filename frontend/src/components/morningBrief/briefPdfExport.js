import { logger } from '../../utils/logger';
import { toast } from 'sonner';

/**
 * Export brief to PDF using DOM snapshot (preferred method).
 * Falls back to string-based generation if ref is not available.
 */
export async function exportBriefToPDF(briefData, { storeName, briefContentRef, setExportingPDF }) {
  if (!briefData) return;
  setExportingPDF(true);

  try {
    const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
      import('jspdf'),
      import('html2canvas'),
    ]);

    if (!briefContentRef.current) {
      logger.warn('⚠️ briefContentRef not ready, falling back to string-based PDF');
      return await exportBriefToPDF_legacy(briefData, { storeName, setExportingPDF });
    }

    const briefElement = briefContentRef.current;
    const clonedElement = briefElement.cloneNode(true);
    clonedElement.style.position = 'absolute';
    clonedElement.style.left = '-9999px';
    clonedElement.style.top = '0';
    clonedElement.style.width = briefElement.offsetWidth + 'px';
    // Masquer les éléments data-pdf-ignore dans le clone
    clonedElement.querySelectorAll('[data-pdf-ignore="true"]').forEach(el => { el.style.display = 'none'; });
    document.body.appendChild(clonedElement);

    try {
      const canvas = await html2canvas(clonedElement, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: briefElement.offsetWidth,
        windowHeight: briefElement.offsetHeight,
      });

      document.body.removeChild(clonedElement);

      const imgData = canvas.toDataURL('image/png', 0.95);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const margin = 8;
      const headerHeight = 12;

      const dateLabel = briefData.date || new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
      const storeLine = briefData.store_name || storeName || '';

      const drawHeader = () => {
        pdf.setFillColor(30, 64, 175);
        pdf.rect(0, 0, pdfWidth, headerHeight, 'F');
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Retail Performer AI — Brief Matinal', margin, 8);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        const rightLabel = storeLine ? `${storeLine} • ${dateLabel}` : dateLabel;
        pdf.text(rightLabel, pdfWidth - margin, 8, { align: 'right' });
      };

      drawHeader();

      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const contentWidth = pdfWidth - 2 * margin;
      const ratio = contentWidth / imgWidth;
      const contentHeight = imgHeight * ratio;
      const startY = headerHeight + 4;
      const availableHeight = pdfHeight - startY - margin;

      if (contentHeight <= availableHeight) {
        pdf.addImage(imgData, 'PNG', margin, startY, contentWidth, contentHeight);
      } else {
        let remainingHeight = contentHeight;
        let currentY = 0;
        let pageNum = 0;

        while (remainingHeight > 0) {
          if (pageNum > 0) {
            pdf.addPage();
            drawHeader();
          }

          const sliceHeight = Math.min(availableHeight, remainingHeight);
          const sy = (currentY / contentHeight) * imgHeight;
          const sh = (sliceHeight / contentHeight) * imgHeight;
          const shInt = Math.max(1, Math.round(sh));

          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = imgWidth;
          tempCanvas.height = shInt;
          tempCanvas.getContext('2d').drawImage(canvas, 0, sy, imgWidth, sh, 0, 0, imgWidth, shInt);

          pdf.addImage(tempCanvas.toDataURL('image/png', 1.0), 'PNG', margin, startY, contentWidth, sliceHeight);
          currentY += sliceHeight;
          remainingHeight -= sliceHeight;
          pageNum++;
        }
      }

      const fileName = `brief_matinal_${(briefData.store_name || storeName || 'store').replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);
      logger.log('✅ PDF généré depuis DOM snapshot');
      toast.success('PDF téléchargé avec succès !');
    } catch (canvasError) {
      if (document.body.contains(clonedElement)) document.body.removeChild(clonedElement);
      throw canvasError;
    }
  } catch (error) {
    logger.error('Erreur export PDF (DOM-based):', error);
    toast.error('Erreur lors de la génération du PDF');
  } finally {
    setExportingPDF(false);
  }
}

/** Fallback string-based PDF generation */
async function exportBriefToPDF_legacy(briefData, { storeName, setExportingPDF }) {
  logger.warn('⚠️ Using legacy string-based PDF generation (fallback)');
  try {
    const { default: jsPDF } = await import('jspdf');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 15;
    let yPosition = 0;

    pdf.setFillColor(30, 64, 175);
    pdf.rect(0, 0, pageWidth, 45, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(24);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Retail Performer AI', margin, 20);
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Brief Matinal', margin, 30);
    pdf.setFontSize(10);
    const dateText = briefData.date || new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    pdf.text(dateText, pageWidth - margin - pdf.getTextWidth(dateText), 20);
    if (briefData.store_name || storeName) {
      pdf.setFontSize(12);
      const storeText = briefData.store_name || storeName;
      pdf.text(storeText, pageWidth - margin - pdf.getTextWidth(storeText), 30);
    }
    yPosition = 55;

    pdf.setFillColor(249, 115, 22, 0.1);
    pdf.setDrawColor(249, 115, 22);
    pdf.roundedRect(margin, yPosition, pageWidth - 2 * margin, 20, 3, 3, 'FD');
    pdf.setTextColor(249, 115, 22);
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Manager : ' + (briefData.manager_name || 'N/A'), margin + 5, yPosition + 8);
    if (briefData.data_date) {
      pdf.setFont('helvetica', 'normal');
      pdf.text('Données du : ' + briefData.data_date, margin + 5, yPosition + 15);
    }
    yPosition += 30;

    const cleanMarkdownForPDF = (text) => {
      if (!text) return '';
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = text;
      let cleaned = tempDiv.textContent || tempDiv.innerText || text;
      const entityMap = {};
      let entityCounter = 0;
      cleaned = cleaned.replace(/&(amp|lt|gt|quot|apos|nbsp|#\d+|#x[\da-f]+);/gi, (match) => {
        const key = `__ENTITY_${entityCounter}__`;
        entityMap[key] = match;
        entityCounter++;
        return key;
      });
      cleaned = cleaned.replace(/&/g, '');
      Object.keys(entityMap).forEach(key => { cleaned = cleaned.replace(key, entityMap[key]); });
      cleaned = cleaned.replace(/\s+/g, ' ');
      cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, '$1');
      cleaned = cleaned.replace(/^#+\s+/gm, '');
      cleaned = cleaned.replace(/^-\s+/gm, '• ');
      cleaned = cleaned.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');
      cleaned = cleaned.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '$1');
      cleaned = cleaned.replace(/^---+\s*$/gm, '');
      cleaned = cleaned.replace(/^\*\*\*\s*$/gm, '');
      cleaned = cleaned.replace(/[\u{1F300}-\u{1F9FF}]/gu, '');
      cleaned = cleaned.replace(/[\u{2600}-\u{26FF}]/gu, '');
      cleaned = cleaned.replace(/[\u{2700}-\u{27BF}]/gu, '');
      cleaned = cleaned.replace(/```[\s\S]*?```/g, '');
      cleaned = cleaned.replace(/`([^`]+)`/g, '$1');
      cleaned = cleaned.replace(/[ \t]+/g, ' ');
      cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
      return cleaned.trim();
    };

    const structured = briefData.structured;
    if (structured) {
      const addSection = (emoji, title, content, bgColor, textColor) => {
        if (!content) return;
        if (yPosition > pageHeight - 60) { pdf.addPage(); yPosition = 20; }
        pdf.setFillColor(...bgColor);
        pdf.roundedRect(margin, yPosition, pageWidth - 2 * margin, 10, 2, 2, 'F');
        pdf.setTextColor(...textColor);
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        let titleText = cleanMarkdownForPDF(title).replace(/[^\w\s\-àâäéèêëïîôùûüÿçÀÂÄÉÈÊËÏÎÔÙÛÜŸÇ]/gi, '').trim();
        if (!titleText) titleText = title.replace(/[^\w\s\-àâäéèêëïîôùûüÿçÀÂÄÉÈÊËÏÎÔÙÛÜŸÇ]/gi, '').trim();
        if (titleText) pdf.text(titleText, margin + 5, yPosition + 7);
        yPosition += 14;
        pdf.setTextColor(60, 60, 60);
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        const lines = pdf.splitTextToSize(cleanMarkdownForPDF(content), pageWidth - 2 * margin - 10);
        lines.forEach(line => {
          if (yPosition > pageHeight - 20) { pdf.addPage(); yPosition = 20; }
          pdf.text(line, margin + 5, yPosition);
          yPosition += 5;
        });
        yPosition += 8;
      };

      addSection('📊', 'Flash-Back', structured.flashback, [224, 231, 255], [67, 56, 202]);
      addSection('🌟', 'Coup de Projecteur', structured.spotlight, [254, 243, 199], [146, 64, 14]);
      addSection('🎯', 'Mission du Jour', structured.focus, [220, 252, 231], [22, 101, 52]);

      if (structured.examples?.length > 0) {
        if (yPosition > pageHeight - 60) { pdf.addPage(); yPosition = 20; }
        pdf.setFillColor(254, 243, 199);
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
          if (yPosition > pageHeight - 20) { pdf.addPage(); yPosition = 20; }
          pdf.text('• ' + cleanMarkdownForPDF(example), margin + 8, yPosition);
          yPosition += 6;
        });
        yPosition += 8;
      }

      addSection('', 'Le Defi', structured.team_question, [243, 232, 255], [107, 33, 168]);
      addSection('', 'On y va !', structured.booster, [252, 231, 243], [157, 23, 77]);
    } else {
      const briefText = briefData.brief || '';
      pdf.setTextColor(60, 60, 60);
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      const lines = pdf.splitTextToSize(cleanMarkdownForPDF(briefText), pageWidth - 2 * margin);
      lines.forEach(line => {
        if (yPosition > pageHeight - 20) { pdf.addPage(); yPosition = 20; }
        pdf.text(line, margin, yPosition);
        yPosition += 5;
      });
    }

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

    const fileName = `brief_matinal_${(briefData.store_name || storeName || 'store').replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    pdf.save(fileName);
    toast.success('PDF téléchargé avec succès !');
  } catch (error) {
    logger.error('Erreur export PDF:', error);
    toast.error('Erreur lors de la génération du PDF');
  } finally {
    setExportingPDF(false);
  }
}
