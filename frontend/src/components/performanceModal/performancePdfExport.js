import { unstable_batchedUpdates } from 'react-dom';
import { toast } from 'sonner';
import { logger } from '../../utils/logger';

export async function exportToPDF(contentRef, bilanData, setExportingPDF) {
  if (!contentRef.current || !document.body.contains(contentRef.current)) {
    logger.error('Content ref not available');
    return;
  }

  unstable_batchedUpdates(() => { setExportingPDF(true); });

  try {
    const [jspdfModule, { default: html2canvas }] = await Promise.all([
      import('jspdf'),
      import('html2canvas'),
    ]);
    const jsPDF = jspdfModule.jsPDF ?? jspdfModule.default;

    await new Promise(resolve => setTimeout(resolve, 150));

    const canvas = await html2canvas(contentRef.current, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      scrollY: -globalThis.scrollY,
      scrollX: -globalThis.scrollX,
      width: 1200,
      windowWidth: 1200,
      allowTaint: true,
      foreignObjectRendering: false,
      ignoreElements: (el) => el.getAttribute('data-pdf-ignore') === 'true',
    });

    const imgData = canvas.toDataURL('image/png', 0.95);
    const pdf = new jsPDF('p', 'mm', 'a4');

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const margin = 8;
    const headerHeight = 12;

    const periodLabel = bilanData?.periode || '';

    const drawHeader = () => {
      pdf.setFillColor(30, 64, 175);
      pdf.rect(0, 0, pdfWidth, headerHeight, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Retail Performer AI — Bilan vendeur', margin, 8);
      if (periodLabel) {
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        pdf.text(periodLabel, pdfWidth - margin, 8, { align: 'right' });
      }
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

    const fileName = `bilan_${bilanData?.periode || 'actuel'}.pdf`
      .replace(/\s+/g, '_')
      .replace(/[/\\:*?"<>|]/g, '-');
    pdf.save(fileName);
    toast.success('PDF exporté avec succès');

  } catch (error) {
    logger.error('Erreur export PDF:', error);
    toast.error("Erreur lors de l'export PDF");
  } finally {
    unstable_batchedUpdates(() => { setExportingPDF(false); });
  }
}
