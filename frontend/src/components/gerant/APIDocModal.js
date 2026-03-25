import React, { useState, useRef } from 'react';
import { X, Book, Download } from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '../../utils/logger';
import SupportModal from '../SupportModal';
import { generatePdfFromDom } from '../../utils/pdfDownload';
import DocContent from './apiDocModal/DocContent';

export default function APIDocModal({ isOpen, onClose }) {
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const contentRef = useRef(null);

  if (!isOpen) return null;

  const handleDownloadPDF = async () => {
    if (!contentRef.current) return;
    setIsGeneratingPdf(true);
    try {
      await generatePdfFromDom(contentRef.current, 'NOTICE_API_INTEGRATIONS.pdf');
    } catch (error) {
      logger.error('Erreur lors du téléchargement du PDF:', error);
      toast.error(`Erreur lors du téléchargement du PDF: ${error.message || 'Veuillez réessayer.'}`);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-[#1E40AF] to-[#1E3A8A]">
          <div className="flex items-center gap-3">
            <Book className="w-6 h-6 text-white" />
            <h2 className="text-2xl font-bold text-white">Guide d'Intégration API</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
            <X className="w-6 h-6 text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div ref={contentRef}>
            <DocContent onContactSupport={() => setShowSupportModal(true)} />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50 flex justify-between items-center">
          <button
            onClick={handleDownloadPDF}
            disabled={isGeneratingPdf}
            className="flex items-center gap-2 px-4 py-2 bg-[#1E40AF] text-white rounded-lg hover:bg-[#1E3A8A] transition-colors text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            {isGeneratingPdf ? 'Génération...' : 'Télécharger PDF'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors text-sm"
          >
            Fermer
          </button>
        </div>
      </div>

      {showSupportModal && (
        <SupportModal isOpen={showSupportModal} onClose={() => setShowSupportModal(false)} />
      )}
    </div>
  );
}
