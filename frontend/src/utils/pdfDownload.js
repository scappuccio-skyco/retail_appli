/**
 * PDF Download Utilities
 * 
 * Helper functions for downloading PDFs from the backend API
 * and generating PDFs from DOM elements using html2canvas + jsPDF.
 * 
 * Standardizes PDF download behavior across the application.
 */

import { api } from '../lib/apiClient';
import { logger } from '../utils/logger';

/**
 * Download a PDF from a backend API endpoint
 * 
 * @param {string} url - Full URL or relative path to the PDF endpoint
 * @param {string} [filename] - Optional filename. If not provided, extracted from Content-Disposition header
 * @param {object} [options] - Additional options
 * @param {object} [options.headers] - Additional headers to include
 * @param {function} [options.onProgress] - Progress callback (bytesLoaded, bytesTotal)
 * @returns {Promise<void>}
 * 
 * @example
 * // Download with explicit filename
 * await apiDownloadPdf('/api/docs/integrations.pdf', 'NOTICE_API_INTEGRATIONS.pdf');
 * 
 * // Download with filename from Content-Disposition header
 * await apiDownloadPdf('/api/docs/integrations.pdf');
 */
export async function apiDownloadPdf(url, filename = null, options = {}) {
  try {
    const token = localStorage.getItem('token');
    
    if (!token) {
      throw new Error('Vous devez être connecté pour télécharger le PDF.');
    }

    // Nettoyer l'URL (enlever /api/ si présent, car apiClient l'ajoute déjà)
    let cleanUrl = url;
    if (cleanUrl.startsWith('/api/')) {
      cleanUrl = cleanUrl.substring(4);
    }
    if (!cleanUrl.startsWith('/')) {
      cleanUrl = '/' + cleanUrl;
    }

    // Make request with responseType blob via apiClient
    const response = await api.getBlob(cleanUrl, {
      ...(options.headers || {}),
      onDownloadProgress: options.onProgress ? (progressEvent) => {
        if (progressEvent.total) {
          options.onProgress(progressEvent.loaded, progressEvent.total);
        }
      } : undefined
    });

    // Verify response is PDF
    const contentType = response.headers['content-type'] || response.data.type;
    if (contentType && !contentType.includes('application/pdf') && !contentType.includes('pdf')) {
      logger.error('Type de fichier reçu:', contentType);
      throw new Error('Le fichier reçu n\'est pas un PDF');
    }

    // Extract filename from Content-Disposition header if not provided
    let finalFilename = filename;
    if (!finalFilename) {
      const contentDisposition = response.headers['content-disposition'];
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (filenameMatch && filenameMatch[1]) {
          finalFilename = filenameMatch[1].replace(/['"]/g, '');
          // Decode URL-encoded filename (e.g., %20 -> space)
          try {
            finalFilename = decodeURIComponent(finalFilename);
          } catch (e) {
            // If decoding fails, use as-is
          }
        }
      }
    }

    // Default filename if still not set
    if (!finalFilename) {
      finalFilename = 'document.pdf';
    }

    // Download the blob
    await downloadBlobAsFile(response.data, finalFilename);

  } catch (error) {
    logger.error('Erreur lors du téléchargement du PDF:', error);
    
    if (error.response) {
      // Server error
      const status = error.response.status;
      const statusText = error.response.statusText;
      throw new Error(`Erreur ${status}: ${statusText || 'Erreur lors du téléchargement du PDF'}`);
    } else if (error.message) {
      // Client error (network, etc.)
      throw error;
    } else {
      throw new Error('Erreur inconnue lors du téléchargement du PDF');
    }
  }
}

/**
 * Download a Blob as a file
 * 
 * @param {Blob} blob - The blob to download
 * @param {string} filename - Filename for the download
 * @returns {Promise<void>}
 * 
 * @example
 * const blob = new Blob([pdfData], { type: 'application/pdf' });
 * await downloadBlobAsFile(blob, 'document.pdf');
 */
export async function downloadBlobAsFile(blob, filename) {
  // Verify blob type
  if (blob.type && !blob.type.includes('pdf') && !blob.type.includes('application/pdf')) {
    console.warn('Type de blob:', blob.type, '- Téléchargement quand même');
  }

  // Create object URL
  const url = window.URL.createObjectURL(blob);
  
  try {
    // Create temporary anchor element
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    
    // Append to body, click, then remove
    document.body.appendChild(a);
    a.click();
    
    // Cleanup
    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, 100);
  } catch (error) {
    // Cleanup on error
    window.URL.revokeObjectURL(url);
    throw error;
  }
}

/**
 * Generate PDF from DOM element using html2canvas + jsPDF
 * 
 * This is a helper wrapper for the common pattern of:
 * 1. Capturing DOM with html2canvas
 * 2. Converting to PDF with jsPDF
 * 
 * @param {HTMLElement} element - DOM element to capture
 * @param {string} filename - Filename for the PDF
 * @param {object} [options] - Options for html2canvas and jsPDF
 * @param {object} [options.html2canvasOptions] - Options for html2canvas
 * @param {object} [options.jsPDFOptions] - Options for jsPDF constructor
 * @param {function} [options.onPdfReady] - Callback with jsPDF instance before saving (for custom headers/footers)
 * @returns {Promise<void>}
 * 
 * @example
 * const element = document.getElementById('content');
 * await generatePdfFromDom(element, 'document.pdf', {
 *   html2canvasOptions: { scale: 2, backgroundColor: '#ffffff' },
 *   onPdfReady: (pdf) => {
 *     // Add custom header
 *     pdf.setFontSize(18);
 *     pdf.text('Title', 10, 10);
 *   }
 * });
 */
export async function generatePdfFromDom(element, filename, options = {}) {
  const { default: html2canvas } = await import('html2canvas');
  const { default: jsPDF } = await import('jspdf');

  if (!element || !document.body.contains(element)) {
    throw new Error('Element not available or not in DOM');
  }

  // Default html2canvas options
  const html2canvasOpts = {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
    ...(options.html2canvasOptions || {})
  };

  // Capture DOM
  const canvas = await html2canvas(element, html2canvasOpts);
  const imgData = canvas.toDataURL('image/png', 0.95);

  // Default jsPDF options
  const jsPDFOpts = {
    orientation: 'p',
    unit: 'mm',
    format: 'a4',
    ...(options.jsPDFOptions || {})
  };

  // Create PDF
  const pdf = new jsPDF(jsPDFOpts);
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = options.margin || 15;

  // Calculate image dimensions
  const imgWidth = pageWidth - 2 * margin;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  // Call onPdfReady callback if provided (for custom headers/footers)
  if (options.onPdfReady) {
    options.onPdfReady(pdf, { pageWidth, pageHeight, margin });
  }

  // Add image to PDF (handle pagination)
  let heightLeft = imgHeight;
  let position = margin;

  pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
  heightLeft -= (pageHeight - position - margin);

  // Add additional pages if needed
  while (heightLeft > 0) {
    position = -heightLeft + margin;
    pdf.addPage();
    pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
    heightLeft -= (pageHeight - 2 * margin);
  }

  // Save PDF
  pdf.save(filename);
}

