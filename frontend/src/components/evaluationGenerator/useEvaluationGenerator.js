import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { api } from '../../lib/apiClient';
import { logger } from '../../utils/logger';

export default function useEvaluationGenerator({ isOpen, employeeId, employeeName, role, onClose }) {
  const currentYear = new Date().getFullYear();
  const defaultStartDate = `${currentYear}-01-01`;
  const today = new Date().toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(today);
  const [comments, setComments] = useState('');
  const [loading, setLoading] = useState(false);
  const [guideData, setGuideData] = useState(null);
  const [stats, setStats] = useState(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [exportingPDF, setExportingPDF] = useState(false);
  const [interviewNotes, setInterviewNotes] = useState([]);
  const [loadingNotes, setLoadingNotes] = useState(false);

  const guideContentRef = useRef(null);

  useEffect(() => {
    if (isOpen && employeeId) loadInterviewNotes();
  }, [isOpen, role, employeeId, startDate, endDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadInterviewNotes = async () => {
    try {
      setLoadingNotes(true);
      let allNotes = [];
      if (role === 'manager') {
        const response = await api.get(`/manager/sellers/${employeeId}/interview-notes`);
        allNotes = response.data.notes || [];
      } else {
        const response = await api.get('/seller/interview-notes');
        allNotes = response.data.notes || [];
      }
      setInterviewNotes(allNotes.filter(note => startDate <= note.date && note.date <= endDate));
    } catch (err) {
      logger.error('Error loading interview notes:', err);
      setInterviewNotes([]);
    } finally {
      setLoadingNotes(false);
    }
  };

  const handleGenerate = async () => {
    if (startDate > endDate) { setError('La date de début doit être antérieure à la date de fin.'); return; }
    setLoading(true);
    setError('');
    setGuideData(null);
    setStats(null);
    try {
      const response = await api.post('/evaluations/generate', {
        employee_id: employeeId,
        start_date: startDate,
        end_date: endDate,
        comments: comments.trim() || null,
      });
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

  const formatGuideForCopy = (data) => {
    if (!data) return '';
    const questions = data.questions_coaching || data.questions_manager;
    let text = `📋 GUIDE D'ENTRETIEN - ${employeeName}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    if (data.synthese) text += `📊 SYNTHÈSE\n${data.synthese}\n\n`;
    if (data.victoires?.length) { text += `🏆 POINTS FORTS / VICTOIRES\n`; data.victoires.forEach((v, i) => { text += `  ${i + 1}. ${v}\n`; }); text += '\n'; }
    if (data.axes_progres?.length) { text += `📈 AXES DE PROGRÈS\n`; data.axes_progres.forEach((a, i) => { text += `  ${i + 1}. ${a}\n`; }); text += '\n'; }
    if (data.objectifs?.length) { text += `🎯 OBJECTIFS\n`; data.objectifs.forEach((o, i) => { text += `  ${i + 1}. ${o}\n`; }); text += '\n'; }
    if (data.souhaits?.length) { text += `⭐ MES SOUHAITS\n`; data.souhaits.forEach((s, i) => { text += `  ${i + 1}. ${s}\n`; }); text += '\n'; }
    if (questions?.length) { text += `💬 ${role === 'seller' ? 'QUESTIONS À POSER' : 'QUESTIONS DE COACHING'}\n`; questions.forEach((q, i) => { text += `  ${i + 1}. ${q}\n`; }); }
    return text;
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formatGuideForCopy(guideData));
      setCopied(true);
      toast.success('Guide copié dans le presse-papier !');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Erreur lors de la copie');
    }
  };

  const exportToPDF = async () => {
    if (!guideData) return;
    setExportingPDF(true);
    try {
      const [jspdfModule, { default: html2canvas }] = await Promise.all([
        import('jspdf'),
        import('html2canvas'),
      ]);
      const jsPDF = jspdfModule.jsPDF ?? jspdfModule.default;
      if (!guideContentRef.current) {
        toast.error("Le contenu n'est pas encore chargé. Veuillez réessayer.");
        return;
      }
      const guideElement = guideContentRef.current;
      const clonedElement = guideElement.cloneNode(true);
      clonedElement.style.cssText = `position:absolute;left:-9999px;top:0;width:${guideElement.offsetWidth}px;background-color:#ffffff;`;
      document.body.appendChild(clonedElement);
      try {
        await new Promise(resolve => setTimeout(resolve, 100));
        const canvas = await html2canvas(clonedElement, { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff', windowWidth: guideElement.offsetWidth, windowHeight: guideElement.offsetHeight });
        document.body.removeChild(clonedElement);

        const imgData = canvas.toDataURL('image/png', 0.95);
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 15;

        const headerColor = role === 'seller' ? [249, 115, 22] : [30, 64, 175];
        pdf.setFillColor(...headerColor);
        pdf.rect(0, 0, pageWidth, 30, 'F');
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(18); pdf.setFont('helvetica', 'bold');
        pdf.text('Retail Performer AI', margin, 12);
        pdf.setFontSize(12); pdf.setFont('helvetica', 'normal');
        pdf.text(role === 'seller' ? 'Fiche de Préparation - Entretien Annuel' : "Guide d'Entretien Annuel", margin, 20);
        const periodText = `Période : ${new Date(startDate).toLocaleDateString('fr-FR')} - ${new Date(endDate).toLocaleDateString('fr-FR')}`;
        pdf.text(periodText, pageWidth - margin - pdf.getTextWidth(periodText), 20);

        const imgWidth = pageWidth - 2 * margin;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        let heightLeft = imgHeight;
        let position = 35;
        pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
        heightLeft -= (pageHeight - position - margin);
        while (heightLeft > 0) {
          position = -heightLeft + margin;
          pdf.addPage();
          pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
          heightLeft -= (pageHeight - 2 * margin);
        }

        const pageCount = pdf.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
          pdf.setPage(i);
          pdf.setFillColor(248, 250, 252); pdf.rect(0, pageHeight - 12, pageWidth, 12, 'F');
          pdf.setTextColor(148, 163, 184); pdf.setFontSize(8); pdf.setFont('helvetica', 'normal');
          pdf.text('Généré par Retail Performer AI • ' + new Date().toLocaleDateString('fr-FR'), margin, pageHeight - 5);
          pdf.text('Page ' + i + '/' + pageCount, pageWidth - margin - 20, pageHeight - 5);
        }

        const roleLabel = role === 'seller' ? 'preparation' : 'evaluation';
        pdf.save(`${roleLabel}_${(employeeName || 'collaborateur').replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
        toast.success('PDF téléchargé avec succès !');
      } catch (canvasError) {
        if (document.body.contains(clonedElement)) document.body.removeChild(clonedElement);
        throw canvasError;
      }
    } catch (err) {
      logger.error('Erreur export PDF:', err);
      toast.error('Erreur lors de la génération du PDF');
    } finally {
      setExportingPDF(false);
    }
  };

  const handleClose = () => {
    setGuideData(null); setStats(null); setError('');
    setComments(''); setStartDate(defaultStartDate); setEndDate(today);
    onClose();
  };

  const handleReset = () => { setGuideData(null); setStats(null); };

  return {
    startDate, setStartDate, endDate, setEndDate,
    comments, setComments, loading, guideData, stats,
    copied, error, exportingPDF, interviewNotes, loadingNotes,
    guideContentRef,
    handleGenerate, handleCopy, exportToPDF, handleClose, handleReset,
  };
}
