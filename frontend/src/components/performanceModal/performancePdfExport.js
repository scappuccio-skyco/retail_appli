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
    });

    const imgData = canvas.toDataURL('image/png', 0.95);
    const pdf = new jsPDF('p', 'mm', 'a4');

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const margin = 8;

    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    const contentWidth = pdfWidth - (2 * margin);
    const ratio = contentWidth / imgWidth;
    const contentHeight = imgHeight * ratio;

    if (contentHeight <= pdfHeight - 20) {
      pdf.addImage(imgData, 'PNG', margin, margin, contentWidth, contentHeight);
    } else {
      let remainingHeight = contentHeight;
      let currentY = 0;
      let pageNum = 0;

      while (remainingHeight > 0) {
        if (pageNum > 0) pdf.addPage();

        const sliceHeight = Math.min(pdfHeight - 20, remainingHeight);
        const sy = (currentY / contentHeight) * imgHeight;
        const sh = (sliceHeight / contentHeight) * imgHeight;

        const shInt = Math.max(1, Math.round(sh));
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = imgWidth;
        tempCanvas.height = shInt;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(canvas, 0, sy, imgWidth, sh, 0, 0, imgWidth, shInt);

        const sliceImgData = tempCanvas.toDataURL('image/png', 1.0);
        pdf.addImage(sliceImgData, 'PNG', margin, margin, contentWidth, sliceHeight);

        currentY += sliceHeight;
        remainingHeight -= sliceHeight;
        pageNum++;
      }
    }

    const fileName = `bilan_${bilanData?.periode || 'actuel'}.pdf`
      .replace(/\s+/g, '_')
      .replace(/[/\\:*?"<>|]/g, '-');
    pdf.save(fileName);

  } catch (error) {
    logger.error('Erreur export PDF:', error);
    toast.error("Erreur lors de l'export PDF");
  } finally {
    unstable_batchedUpdates(() => { setExportingPDF(false); });
  }
}
