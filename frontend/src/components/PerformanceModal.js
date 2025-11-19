import React, { useState, useMemo, useRef } from 'react';
import { X, TrendingUp, BarChart3, ChevronLeft, ChevronRight, Download, Sparkles, AlertTriangle, Target } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { unstable_batchedUpdates } from 'react-dom';

export default function PerformanceModal({ 
  isOpen, 
  onClose,
  bilanData,
  kpiEntries,
  user,
  onDataUpdate,
  onRegenerate,
  generatingBilan,
  onEditKPI,
  kpiConfig,
  currentWeekOffset,
  onWeekChange
}) {
  const [activeTab, setActiveTab] = useState('bilan'); // 'bilan' or 'kpi'
  const [displayedKpiCount, setDisplayedKpiCount] = useState(20); // Start with 20 entries
  const contentRef = useRef(null);
  const [exportingPDF, setExportingPDF] = useState(false);

  if (!isOpen) return null;

  // Prepare chart data from KPI entries for current week
  const chartData = useMemo(() => {
    if (!kpiEntries || kpiEntries.length === 0) return [];
    
    const now = new Date();
    const offsetDays = (currentWeekOffset || 0) * 7;
    const monday = new Date(now);
    monday.setDate(monday.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1) + offsetDays);
    monday.setHours(0, 0, 0, 0);
    
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    
    const weekEntries = kpiEntries.filter(entry => {
      const entryDate = new Date(entry.date);
      return entryDate >= monday && entryDate <= sunday;
    });
    
    const sortedEntries = weekEntries.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    return sortedEntries.map(entry => ({
      date: new Date(entry.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' }),
      CA: entry.ca_journalier || 0,
      Ventes: entry.nb_ventes || 0,
      Articles: entry.nb_articles || 0,
      'Panier Moyen': entry.ca_journalier && entry.nb_ventes ? (entry.ca_journalier / entry.nb_ventes).toFixed(2) : 0
    }));
  }, [kpiEntries, currentWeekOffset]);

  // Export to PDF function
  const exportToPDF = async () => {
    if (!contentRef.current || !document.body.contains(contentRef.current)) {
      console.error('Content ref not available');
      return;
    }
    
    unstable_batchedUpdates(() => {
      setExportingPDF(true);
    });
    
    try {
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const canvas = await html2canvas(contentRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
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
          
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = imgWidth;
          tempCanvas.height = sh;
          const tempCtx = tempCanvas.getContext('2d');
          tempCtx.drawImage(canvas, 0, sy, imgWidth, sh, 0, 0, imgWidth, sh);
          
          const sliceImgData = tempCanvas.toDataURL('image/png', 1.0);
          pdf.addImage(sliceImgData, 'PNG', margin, margin, contentWidth, sliceHeight);
          
          currentY += sliceHeight;
          remainingHeight -= sliceHeight;
          pageNum++;
        }
      }
      
      const fileName = `bilan_${bilanData?.periode || 'actuel'}.pdf`.replace(/\s+/g, '_');
      pdf.save(fileName);
      
    } catch (error) {
      console.error('Erreur export PDF:', error);
      alert('Erreur lors de l\'export PDF');
    } finally {
      unstable_batchedUpdates(() => {
        setExportingPDF(false);
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header avec onglets */}
        <div className="border-b border-gray-200">
          <div className="flex items-center justify-between p-4 border-b border-gray-100">
            <h2 className="text-2xl font-bold text-gray-800">📊 Mes Performances</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          
          {/* Onglets */}
          <div className="flex">
            <button
              onClick={() => setActiveTab('bilan')}
              className={`flex-1 px-6 py-4 font-semibold transition-all border-b-2 ${
                activeTab === 'bilan'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-transparent text-gray-600 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <TrendingUp className="w-5 h-5" />
                <span>Mon Bilan</span>
              </div>
              <p className="text-xs mt-1 opacity-75">KPI hebdomadaires</p>
            </button>
            <button
              onClick={() => setActiveTab('kpi')}
              className={`flex-1 px-6 py-4 font-semibold transition-all border-b-2 ${
                activeTab === 'kpi'
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                  : 'border-transparent text-gray-600 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <BarChart3 className="w-5 h-5" />
                <span>Mes KPI</span>
              </div>
              <p className="text-xs mt-1 opacity-75">
                {kpiEntries?.length || 0} enregistré{kpiEntries?.length > 1 ? 's' : ''}
              </p>
            </button>
          </div>
        </div>

        {/* Contenu du modal selon l'onglet actif */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'bilan' && bilanData && (
            <div className="prose max-w-none">
              <h3 className="text-xl font-bold mb-4">Mon Bilan Hebdomadaire</h3>
              <div className="bg-blue-50 p-4 rounded-lg mb-4">
                <p className="text-gray-700">{bilanData.bilan_text || "Aucun bilan disponible"}</p>
              </div>
              {generatingBilan && (
                <div className="text-center text-gray-500">
                  <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                  Génération en cours...
                </div>
              )}
              {onRegenerate && (
                <button
                  onClick={onRegenerate}
                  disabled={generatingBilan}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  Régénérer le bilan
                </button>
              )}
            </div>
          )}
          
          {activeTab === 'kpi' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold">Historique de mes KPI</h3>
                {kpiEntries && kpiEntries.length > 0 && (
                  <span className="text-sm text-gray-500">
                    Affichage de {Math.min(displayedKpiCount, kpiEntries.length)} sur {kpiEntries.length} entrées
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 mb-4">💡 Cliquez sur une entrée pour la modifier</p>
              {kpiEntries && kpiEntries.length > 0 ? (
                <>
                  <div className="space-y-4">
                    {kpiEntries.slice(0, displayedKpiCount).map((entry, index) => {
                      // Calculate days difference
                      const entryDate = new Date(entry.date);
                      const today = new Date();
                      const diffTime = today - entryDate;
                      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                      
                      return (
                        <div 
                          key={index} 
                          onClick={() => {
                            if (onEditKPI) {
                              onEditKPI(entry);
                            } else {
                              alert('Modification KPI non disponible');
                            }
                          }}
                          className="bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer"
                        >
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-semibold text-gray-800">{entry.date}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-500">
                                il y a {diffDays === 0 ? "aujourd'hui" : `${diffDays} jour${diffDays > 1 ? 's' : ''}`}
                              </span>
                              <span className="text-xs text-blue-600 font-medium">✏️ Modifier</span>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>💰 CA: {entry.ca_journalier || 0}€</div>
                            <div>🛒 Ventes: {entry.nb_ventes || 0}</div>
                            <div>📦 Articles: {entry.nb_articles || 0}</div>
                            <div>🚶 Prospects: {entry.nb_prospects || 0}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Bouton Charger plus */}
                  {displayedKpiCount < kpiEntries.length && (
                    <div className="mt-6 text-center">
                      <button
                        onClick={() => setDisplayedKpiCount(prev => prev + 20)}
                        className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
                      >
                        Charger plus ({Math.min(20, kpiEntries.length - displayedKpiCount)} entrées supplémentaires)
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-gray-500">Aucun KPI enregistré pour le moment.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
