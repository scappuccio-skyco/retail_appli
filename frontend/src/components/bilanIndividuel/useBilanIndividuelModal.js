import { useState, useMemo, useRef } from 'react';
import { unstable_batchedUpdates } from 'react-dom';
import { toast } from 'sonner';
import { logger } from '../../utils/logger';

export default function useBilanIndividuelModal({ bilan, kpiEntries, currentWeekOffset }) {
  const [exportingPDF, setExportingPDF] = useState(false);
  const contentRef = useRef(null);

  const chartData = useMemo(() => {
    if (!kpiEntries || kpiEntries.length === 0) return [];
    const now = new Date();
    const offsetDays = currentWeekOffset * 7;
    const monday = new Date(now);
    monday.setDate(monday.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1) + offsetDays);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    return kpiEntries
      .filter(entry => { const d = new Date(entry.date); return d >= monday && d <= sunday; })
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map(entry => ({
        date: new Date(entry.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' }),
        CA: entry.ca_journalier || 0,
        Ventes: entry.nb_ventes || 0,
        Articles: entry.nb_articles || 0,
        'Panier Moyen': entry.ca_journalier && entry.nb_ventes ? (entry.ca_journalier / entry.nb_ventes).toFixed(2) : 0,
      }));
  }, [kpiEntries, currentWeekOffset]);

  const comparisonData = useMemo(() => {
    if (!bilan?.kpi_resume) return null;
    const current = bilan.kpi_resume;
    return {
      ca_trend: current.ca_total > 0 ? 'up' : 'stable',
      ventes_trend: current.ventes > 0 ? 'up' : 'stable',
    };
  }, [bilan]);

  const exportToPDF = async () => {
    if (!contentRef.current || !document.body.contains(contentRef.current)) {
      logger.error('Content ref not available or not in DOM');
      return;
    }
    unstable_batchedUpdates(() => { setExportingPDF(true); });
    try {
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([import('jspdf'), import('html2canvas')]);
      await new Promise(resolve => setTimeout(resolve, 150));
      if (!contentRef.current || !document.body.contains(contentRef.current)) throw new Error('Content ref became invalid during wait');

      const canvas = await html2canvas(contentRef.current, {
        scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff',
        scrollY: -globalThis.scrollY, scrollX: -globalThis.scrollX,
        width: 1200, windowWidth: 1200, allowTaint: true, foreignObjectRendering: false,
        onclone: (clonedDoc) => {
          const el = clonedDoc.querySelector('[data-pdf-content]');
          if (el) { el.style.overflow = 'visible'; el.style.maxHeight = 'none'; el.style.height = 'auto'; }
        },
      });

      const imgData = canvas.toDataURL('image/png', 0.95);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const margin = 8;

      pdf.setFillColor(255, 216, 113);
      pdf.rect(0, 0, pdfWidth, 25, 'F');
      pdf.setFontSize(18); pdf.setTextColor(51, 51, 51); pdf.setFont('helvetica', 'bold');
      pdf.text('Retail Performer', margin, 10);
      pdf.setFontSize(12); pdf.setFont('helvetica', 'normal');
      pdf.text('Bilan Individuel de Performance', margin, 17);
      pdf.setFontSize(9); pdf.setTextColor(80, 80, 80);
      const periodText = bilan.periode || 'Semaine actuelle';
      pdf.text(periodText, pdfWidth - margin - pdf.getTextWidth(periodText), 17);

      const contentWidth = pdfWidth - 2 * margin;
      const ratio = contentWidth / canvas.width;
      const contentHeight = canvas.height * ratio;
      const headerHeight = 30;
      const footerHeight = 8;
      const firstPageAvailable = pdfHeight - headerHeight - footerHeight;
      const otherPagesAvailable = pdfHeight - 2 * margin - footerHeight;

      if (contentHeight <= firstPageAvailable) {
        pdf.addImage(imgData, 'PNG', margin, headerHeight, contentWidth, contentHeight, undefined, 'FAST');
      } else {
        let remainingHeight = contentHeight;
        let currentY = 0;
        let pageNum = 0;
        while (remainingHeight > 0) {
          if (pageNum > 0) pdf.addPage();
          const availableSpace = pageNum === 0 ? firstPageAvailable : otherPagesAvailable;
          const startY = pageNum === 0 ? headerHeight : margin;
          const sliceHeight = Math.min(availableSpace, remainingHeight);
          const sy = (currentY / contentHeight) * canvas.height;
          const sh = (sliceHeight / contentHeight) * canvas.height;
          const shInt = Math.max(1, Math.round(sh));
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = canvas.width;
          tempCanvas.height = shInt;
          tempCanvas.getContext('2d').drawImage(canvas, 0, sy, canvas.width, sh, 0, 0, canvas.width, shInt);
          pdf.addImage(tempCanvas.toDataURL('image/png', 1.0), 'PNG', margin, startY, contentWidth, sliceHeight, undefined, 'FAST');
          currentY += sliceHeight;
          remainingHeight -= sliceHeight;
          pageNum++;
        }
      }

      const pageCount = pdf.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8); pdf.setTextColor(128, 128, 128);
        pdf.text(`Page ${i} / ${pageCount} - Généré le ${new Date().toLocaleDateString('fr-FR')}`, pdfWidth / 2, pdfHeight - 5, { align: 'center' });
      }

      pdf.setProperties({ title: `Bilan Individuel - ${bilan.periode || 'Actuel'}`, subject: 'Rapport de performance hebdomadaire', author: 'Retail Performer', creator: 'Retail Performer App' });
      const fileName = `bilan_${bilan.periode || 'actuel'}.pdf`.replace(/\s+/g, '_');
      await new Promise(resolve => { unstable_batchedUpdates(() => { pdf.save(fileName); resolve(); }); });
    } catch (error) {
      logger.error("Erreur lors de l'export PDF:", error);
      toast.error('Erreur lors de l\'export PDF. Veuillez réessayer.');
    } finally {
      unstable_batchedUpdates(() => { setExportingPDF(false); });
    }
  };

  return { contentRef, exportingPDF, exportToPDF, chartData, comparisonData };
}
