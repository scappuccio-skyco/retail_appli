import React, { useState, useRef, useEffect } from 'react';
import { X, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../lib/apiClient';
import { logger } from '../utils/logger';
import FormPanel from './evaluationGenerator/FormPanel';
import GuideContent from './evaluationGenerator/GuideContent';

/**
 * EvaluationGenerator - Modal pour générer un guide d'entretien annuel IA
 * Version 2.0 - Affichage JSON en Cartes Colorées
 *
 * @param {boolean}  isOpen       - Contrôle l'affichage de la modale
 * @param {function} onClose      - Callback pour fermer la modale
 * @param {string}   employeeId   - ID du vendeur à évaluer
 * @param {string}   employeeName - Nom du vendeur
 * @param {string}   role         - 'manager' ou 'seller'
 */
export default function EvaluationGenerator({ isOpen, onClose, employeeId, employeeName, role }) {
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

  // DOM snapshot source for PDF export
  const guideContentRef = useRef(null);

  // Load interview notes when the modal opens or the period changes
  useEffect(() => {
    if (isOpen && employeeId) {
      loadInterviewNotes();
    }
  }, [isOpen, role, employeeId, startDate, endDate]);

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
      const notesInPeriod = allNotes.filter(note => startDate <= note.date && note.date <= endDate);
      setInterviewNotes(notesInPeriod);
    } catch (err) {
      logger.error('Error loading interview notes:', err);
      setInterviewNotes([]);
    } finally {
      setLoadingNotes(false);
    }
  };

  if (!isOpen) return null;

  // ─── Handlers ────────────────────────────────────────────────────────────────

  const handleGenerate = async () => {
    if (startDate > endDate) {
      setError('La date de début doit être antérieure à la date de fin.');
      return;
    }
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

  const formatGuideForCopy = (data) => {
    if (!data) return '';
    let text = `📋 GUIDE D'ENTRETIEN - ${employeeName}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    if (data.synthese) text += `📊 SYNTHÈSE\n${data.synthese}\n\n`;
    if (data.victoires?.length) {
      text += `🏆 POINTS FORTS / VICTOIRES\n`;
      data.victoires.forEach((v, i) => { text += `  ${i + 1}. ${v}\n`; });
      text += '\n';
    }
    if (data.axes_progres?.length) {
      text += `📈 AXES DE PROGRÈS\n`;
      data.axes_progres.forEach((a, i) => { text += `  ${i + 1}. ${a}\n`; });
      text += '\n';
    }
    if (data.objectifs?.length) {
      text += `🎯 OBJECTIFS\n`;
      data.objectifs.forEach((o, i) => { text += `  ${i + 1}. ${o}\n`; });
      text += '\n';
    }
    if (data.souhaits?.length) {
      text += `⭐ MES SOUHAITS\n`;
      data.souhaits.forEach((s, i) => { text += `  ${i + 1}. ${s}\n`; });
      text += '\n';
    }
    const questions = data.questions_coaching || data.questions_manager;
    if (questions?.length) {
      text += `💬 ${role === 'seller' ? 'QUESTIONS À POSER' : 'QUESTIONS DE COACHING'}\n`;
      questions.forEach((q, i) => { text += `  ${i + 1}. ${q}\n`; });
    }
    return text;
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
        logger.warn('⚠️ guideContentRef not ready, cannot generate PDF');
        toast.error("Le contenu n'est pas encore chargé. Veuillez réessayer.");
        return;
      }

      const guideElement = guideContentRef.current;
      const clonedElement = guideElement.cloneNode(true);
      clonedElement.style.position = 'absolute';
      clonedElement.style.left = '-9999px';
      clonedElement.style.top = '0';
      clonedElement.style.width = guideElement.offsetWidth + 'px';
      clonedElement.style.backgroundColor = '#ffffff';
      document.body.appendChild(clonedElement);

      try {
        await new Promise(resolve => setTimeout(resolve, 100));
        const canvas = await html2canvas(clonedElement, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          windowWidth: guideElement.offsetWidth,
          windowHeight: guideElement.offsetHeight,
        });
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
        pdf.setFontSize(18);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Retail Performer AI', margin, 12);
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'normal');
        const titleText = role === 'seller'
          ? 'Fiche de Préparation - Entretien Annuel'
          : "Guide d'Entretien Annuel";
        pdf.text(titleText, margin, 20);
        pdf.setFontSize(10);
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
          pdf.setFillColor(248, 250, 252);
          pdf.rect(0, pageHeight - 12, pageWidth, 12, 'F');
          pdf.setTextColor(148, 163, 184);
          pdf.setFontSize(8);
          pdf.setFont('helvetica', 'normal');
          pdf.text('Généré par Retail Performer AI • ' + new Date().toLocaleDateString('fr-FR'), margin, pageHeight - 5);
          pdf.text('Page ' + i + '/' + pageCount, pageWidth - margin - 20, pageHeight - 5);
        }

        const roleLabel = role === 'seller' ? 'preparation' : 'evaluation';
        const fileName = `${roleLabel}_${(employeeName || 'collaborateur').replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
        pdf.save(fileName);
        logger.log('✅ PDF généré depuis DOM snapshot');
        toast.success('PDF téléchargé avec succès !');
      } catch (canvasError) {
        if (document.body.contains(clonedElement)) document.body.removeChild(clonedElement);
        throw canvasError;
      }
    } catch (err) {
      logger.error('Erreur export PDF (DOM-based):', err);
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
    setStartDate(defaultStartDate);
    setEndDate(today);
    onClose();
  };

  // ─── Derived labels ───────────────────────────────────────────────────────────

  const modalTitle = role === 'seller'
    ? '🎯 Préparer Mon Entretien Annuel'
    : `📋 Préparer l'Entretien - ${employeeName}`;

  const generateButtonText = role === 'seller'
    ? '✨ Générer Ma Fiche de Préparation'
    : "✨ Générer le Guide d'Évaluation";

  const commentsPlaceholder = role === 'seller'
    ? "Notes supplémentaires (optionnel) - Tes notes du bloc-notes seront automatiquement incluses dans la synthèse"
    : "Ajoutez vos observations spécifiques (ex: 'Très bon sur l'accueil, mais retards fréquents', 'A progressé sur le closing')...";

  // ─── Render ───────────────────────────────────────────────────────────────────

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

        {/* Scrollable content */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1">

          {/* Form (only shown before generation) */}
          {!guideData && !loading && (
            <FormPanel
              role={role}
              startDate={startDate}
              endDate={endDate}
              comments={comments}
              loading={loading}
              loadingNotes={loadingNotes}
              interviewNotes={interviewNotes}
              commentsPlaceholder={commentsPlaceholder}
              generateButtonText={generateButtonText}
              onStartDateChange={setStartDate}
              onEndDateChange={setEndDate}
              onCommentsChange={setComments}
              onGenerate={handleGenerate}
            />
          )}

          {/* Loading state */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-12 h-12 text-[#1E40AF] animate-spin mb-4" />
              <p className="text-gray-600 font-medium">Génération en cours...</p>
              <p className="text-gray-400 text-sm mt-1">L'IA analyse les données de performance</p>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 mb-4">
              <p className="text-red-700 font-medium">❌ {error}</p>
            </div>
          )}

          {/* Stats summary */}
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

          {/* Generated guide cards */}
          {guideData && (
            <GuideContent
              ref={guideContentRef}
              guideData={guideData}
              role={role}
              copied={copied}
              exportingPDF={exportingPDF}
              onCopy={handleCopy}
              onExportPDF={exportToPDF}
              onReset={() => { setGuideData(null); setStats(null); }}
            />
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
