import React from 'react';
import { Sparkles, X, TrendingUp, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import BilanChartsSection from './bilanIndividuel/BilanChartsSection';
import BilanTextPanels from './bilanIndividuel/BilanTextPanels';
import KPISummary from './bilanIndividuel/KPISummary';
import useBilanIndividuelModal from './bilanIndividuel/useBilanIndividuelModal';

export default function BilanIndividuelModal({ bilan, kpiConfig, kpiEntries, onClose, currentWeekOffset, onWeekChange, onRegenerate, generatingBilan }) {
  if (!bilan) return null;

  const { contentRef, exportingPDF, exportToPDF, chartData } = useBilanIndividuelModal({ bilan, kpiEntries, currentWeekOffset });

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl my-4 sm:my-8">

        {/* Header */}
        <div className="bg-gradient-to-r from-[#1E40AF] to-[#1E3A8A] p-4 sm:p-6 rounded-t-2xl relative">
          <button onClick={onClose} className="absolute top-4 right-4 text-white hover:text-gray-200 transition-colors">
            <X className="w-6 h-6" />
          </button>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Sparkles className="w-8 h-8 text-white" />
              <div>
                <h2 className="text-2xl font-bold text-white">🤖 Mon Bilan Individuel</h2>
                <p className="text-sm text-white opacity-90">📅 {currentWeekOffset === 0 ? 'Semaine actuelle' : bilan.periode}</p>
              </div>
            </div>

            {onWeekChange && (
              <div className="flex items-center gap-3 mr-10 bg-white bg-opacity-50 rounded-xl px-3 py-2">
                <button onClick={() => onWeekChange(currentWeekOffset - 1)} className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-all shadow-md" title="Semaine précédente">
                  <ChevronLeft className="w-5 h-5 text-white" />
                </button>
                <div className="text-center px-2">
                  <p className="text-xs font-semibold text-white">Naviguer</p>
                  <p className="text-xs text-white opacity-90">← Semaines →</p>
                </div>
                <button onClick={() => onWeekChange(currentWeekOffset + 1)} disabled={currentWeekOffset === 0} className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-all shadow-md disabled:opacity-30 disabled:cursor-not-allowed" title="Semaine suivante">
                  <ChevronRight className="w-5 h-5 text-white" />
                </button>
              </div>
            )}
          </div>

          <div className="flex gap-2 mt-3">
            {onRegenerate && (
              <button onClick={onRegenerate} disabled={generatingBilan} className="px-4 py-2 bg-white bg-opacity-50 hover:bg-opacity-70 text-gray-800 font-semibold rounded-lg transition-all flex items-center gap-2 disabled:opacity-50">
                <TrendingUp className={`w-4 h-4 ${generatingBilan ? 'animate-spin' : ''}`} />
                {generatingBilan ? 'Génération...' : 'Regénérer le bilan'}
              </button>
            )}
            <button onClick={exportToPDF} disabled={exportingPDF} className="px-4 py-2 bg-[#10B981] hover:bg-green-600 text-white font-semibold rounded-lg transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
              <Download className={`w-4 h-4 ${exportingPDF ? 'animate-bounce' : ''}`} />
              {exportingPDF ? 'Export...' : 'Exporter PDF'}
            </button>
          </div>
        </div>

        {/* Content */}
        <div ref={contentRef} data-pdf-content className="p-3 sm:p-6 max-h-[70vh] overflow-y-auto">
          <KPISummary bilan={bilan} kpiConfig={kpiConfig} />
          <BilanChartsSection chartData={chartData} kpiConfig={kpiConfig} />
          <BilanTextPanels bilan={bilan} />
        </div>
      </div>
    </div>
  );
}
